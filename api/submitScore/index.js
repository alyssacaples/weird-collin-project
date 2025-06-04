const { BlobServiceClient } = require("@azure/storage-blob");

const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
);

const containerClient = blobServiceClient.getContainerClient("gamedata");
const blobClient = containerClient.getBlobClient("highscores.json");

module.exports = async function (context, req) {
    context.log('Submitting high score to blob storage');
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
    
        // Check if blob exists
        const exists = await blobClient.exists();
        let scores = [];
        context.log('Blob exists:', exists);
    
        if (exists) {
            try {
                // Download and parse the existing JSON file
                const downloadResponse = await blobClient.download();
                const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
                const scoresText = downloaded.toString();
                context.log('Downloaded scores text:', scoresText);
                
                if (scoresText.trim()) {
                    scores = JSON.parse(scoresText);
                }
                context.log('Parsed scores:', JSON.stringify(scores));
            } catch (parseError) {
                context.log.error('Error parsing scores blob:', parseError);
                // Continue with empty array instead of returning error
                scores = [];
            }
        }

        // Ensure scores is an array
        if (!Array.isArray(scores)) {
            context.log('Warning: scores is not an array, resetting to empty array');
            scores = [];
        }

        // Check if this time qualifies for top 10
        const sortedScores = [...scores].sort((a, b) => a.time - b.time);
        const qualifiesForTop10 = sortedScores.length < 10 || time < sortedScores[sortedScores.length - 1]?.time;
        
        context.log('Qualifies for top 10:', qualifiesForTop10);
        context.log('Current scores count:', sortedScores.length);
        context.log('Worst current time:', sortedScores.length > 0 ? sortedScores[sortedScores.length - 1]?.time : 'N/A');
        
        if (qualifiesForTop10) {
            // Add new score
            const newScore = {
                playerName: playerName.substring(0, 20).trim(),
                time: parseFloat(time.toFixed(3)),
                timestamp: new Date().toISOString()
            };

            context.log('Adding new score:', JSON.stringify(newScore));
            scores.push(newScore);
            
            // Sort by time (ascending) and keep only top 10
            scores.sort((a, b) => a.time - b.time);
            scores = scores.slice(0, 10);

            context.log('Final scores array:', JSON.stringify(scores));

            // Upload updated scores back to blob
            const jsonString = JSON.stringify(scores, null, 2);
            context.log('Uploading JSON string:', jsonString);
            
            // Simple alternative that works with most versions
            const blockBlobClient = containerClient.getBlockBlobClient("highscores.json");
            await blockBlobClient.upload(jsonString, jsonString.length, { overwrite: true });
            context.log('Successfully uploaded scores to blob');

            context.res = {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: { success: true, message: 'High score submitted!' }
            };
        } else {
            context.res = {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: { success: false, message: 'Score did not qualify for top 10' }
            };
        }
    } catch (error) {
        context.log.error('Error submitting score:', error);
        context.log.error('Error stack:', error.stack);
        context.res = {
            status: 500,
            headers: {
                "Access-Control-Allow-Origin": "*"
            },
            body: { error: 'Failed to submit score', details: error.message }
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