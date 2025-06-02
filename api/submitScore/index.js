const { BlobServiceClient } = require("@azure/storage-blob");

const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
);

const containerClient = blobServiceClient.getContainerClient("gamedata");
const blobClient = containerClient.getBlobClient("highscores.json");

module.exports = async function (context, req) {
    context.log('Submitting high score to blob storage');

    if (req.method !== 'POST') {
        context.res = { status: 405, body: 'Method not allowed' };
        return;
    }

    try {
        const { playerName, time } = req.body;
        
        if (!playerName || !time || typeof time !== 'number') {
            context.res = {
                status: 400,
                body: { error: 'Invalid input: playerName and time (number) required' }
            };
            return;
        }

        // Get current scores
        let scores = [];
        const exists = await blobClient.exists();
        
        if (exists) {
            const downloadResponse = await blobClient.download();
            const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
            scores = JSON.parse(downloaded.toString());
        }

        // Check if this time qualifies for top 10
        const qualifiesForTop10 = scores.length < 10 || time < scores[scores.length - 1]?.time;
        
        if (qualifiesForTop10) {
            // Add new score
            const newScore = {
                playerName: playerName.substring(0, 20),
                time: parseFloat(time.toFixed(3)),
                timestamp: new Date().toISOString()
            };

            scores.push(newScore);
            
            // Sort by time (ascending) and keep only top 10
            scores.sort((a, b) => a.time - b.time);
            scores = scores.slice(0, 10);

            // Upload updated scores back to blob
            const jsonString = JSON.stringify(scores, null, 2);
            await blobClient.upload(jsonString, Buffer.byteLength(jsonString), {
                overwrite: true
            });

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
        context.res = {
            status: 500,
            body: { error: 'Failed to submit score' }
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