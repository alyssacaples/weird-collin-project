const { BlobServiceClient } = require("@azure/storage-blob");

const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
);

const containerClient = blobServiceClient.getContainerClient("gamedata");

module.exports = async function (context, req) {
    context.log('Submitting daily high score to blob storage');
    context.log('Request method:', req.method);
    context.log('Request body:', JSON.stringify(req.body));

    if (req.method !== 'POST') {
        context.res = { 
            status: 405, 
            headers: {
                "Access-Control-Allow-Origin": "*"
            },
            body: { error: 'Method not allowed' }
        };
        return;
    }

    try {
        // Parse request body if it's a string
        let requestBody = req.body;
        if (typeof req.body === 'string') {
            try {
                requestBody = JSON.parse(req.body);
            } catch (parseError) {
                context.log.error('Error parsing request body:', parseError);
                context.res = {
                    status: 400,
                    headers: {
                        "Access-Control-Allow-Origin": "*"
                    },
                    body: { error: 'Invalid JSON in request body' }
                };
                return;
            }
        }

        const { playerName, time } = requestBody;
        
        context.log('Extracted playerName:', playerName);
        context.log('Extracted time:', time, 'Type:', typeof time);
    
        // Validate input
        if (!playerName || typeof time !== 'number' || isNaN(time) || time <= 0) {
            context.log('Validation failed - playerName:', playerName, 'time:', time);
            context.res = {
                status: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*"
                },
                body: { error: 'Invalid input. playerName and valid time are required.' }
            };
            return;
        }

        // Get today's date and create blob client for today's scores
        const today = new Date().toISOString().split('T')[0];
        const blobClient = containerClient.getBlobClient(`daily-scores-${today}.json`);
    
        // Check if blob exists for today
        const exists = await blobClient.exists();
        let scores = [];
        context.log('Daily blob exists for', today, ':', exists);
    
        if (exists) {
            try {
                // Download and parse the existing JSON file
                const downloadResponse = await blobClient.download();
                const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
                const scoresText = downloaded.toString();
                context.log('Downloaded daily scores text:', scoresText);
                
                if (scoresText.trim()) {
                    scores = JSON.parse(scoresText);
                }
                context.log('Parsed daily scores:', JSON.stringify(scores));
            } catch (parseError) {
                context.log.error('Error parsing daily scores blob:', parseError);
                // Continue with empty array instead of returning error
                scores = [];
            }
        }

        // Ensure scores is an array
        if (!Array.isArray(scores)) {
            context.log('Warning: daily scores is not an array, resetting to empty array');
            scores = [];
        }

        // Check if this time qualifies for top 10
        const sortedScores = [...scores].sort((a, b) => a.time - b.time);
        const qualifiesForTop10 = sortedScores.length < 10 || time < sortedScores[sortedScores.length - 1]?.time;
        
        context.log('Qualifies for daily top 10:', qualifiesForTop10);
        context.log('Current daily scores count:', sortedScores.length);
        context.log('Worst current daily time:', sortedScores.length > 0 ? sortedScores[sortedScores.length - 1]?.time : 'N/A');
        
        if (qualifiesForTop10) {
            // Add new score
            const newScore = {
                playerName: playerName.substring(0, 20).trim(),
                time: parseFloat(time.toFixed(3)),
                timestamp: new Date().toISOString()
            };

            context.log('Adding new daily score:', JSON.stringify(newScore));
            scores.push(newScore);
            
            // Sort by time (ascending) and keep only top 10
            scores.sort((a, b) => a.time - b.time);
            scores = scores.slice(0, 10);

            context.log('Final daily scores array:', JSON.stringify(scores));

            // Upload updated scores back to blob
            const jsonString = JSON.stringify(scores, null, 2);
            context.log('Uploading daily scores JSON string:', jsonString);
            
            const blockBlobClient = containerClient.getBlockBlobClient(`daily-scores-${today}.json`);
            await blockBlobClient.upload(jsonString, jsonString.length, { overwrite: true });
            context.log('Successfully uploaded daily scores to blob');

            context.res = {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: { success: true, message: 'Daily high score submitted!' }
            };
        } else {
            context.res = {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: { success: false, message: 'Score did not qualify for daily top 10' }
            };
        }
    } catch (error) {
        context.log.error('Error submitting daily score:', error);
        context.log.error('Error stack:', error.stack);
        context.res = {
            status: 500,
            headers: {
                "Access-Control-Allow-Origin": "*"
            },
            body: { error: 'Failed to submit daily score', details: error.message }
        };
    }
};

// Helper function to convert stream to buffer
async function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => {
            chunks.push(data instanceof Buffer ? data : Buffer.from(data));
        });
        readableStream.on("end", () => {
            resolve(Buffer.concat(chunks));
        });
        readableStream.on("error", reject);
    });
}