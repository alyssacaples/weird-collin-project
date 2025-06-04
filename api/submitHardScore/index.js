const { BlobServiceClient } = require("@azure/storage-blob");

const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
);

const containerClient = blobServiceClient.getContainerClient("gamedata");
const blobClient = containerClient.getBlobClient("hardHighscores.json");

module.exports = async function (context, req) {
    context.log('Submitting hard mode high score');

    try {
        // Validate input
if (!req.body || (!req.body.playerName && !req.body.name) || req.body.time === undefined) {
    context.res = {
        status: 400,
        body: { error: "Please provide name/playerName and time" }
    };
    return;
}

// Use playerName if provided, otherwise use name
const newScore = {
    playerName: req.body.playerName || req.body.name,
    time: parseFloat(req.body.time),
    date: new Date().toISOString()
};

        // Check if blob exists
        const exists = await blobClient.exists();
        
        let scores = [];
        if (exists) {
            // Download existing scores
            const downloadResponse = await blobClient.download();
            const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
            scores = JSON.parse(downloaded.toString());
        }

        // Add new score
        scores.push(newScore);
        
        // Sort by time (ascending)
        scores.sort((a, b) => a.time - b.time);
        
        // Keep top 100 scores only
        if (scores.length > 100) {
            scores = scores.slice(0, 100);
        }

        // Upload updated scores
        const uploadOptions = {
            blobHTTPHeaders: {
                blobContentType: "application/json"
            }
        };
        
        await blobClient.upload(JSON.stringify(scores), scores.length, uploadOptions);

        context.res = {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: { success: true, message: "Score submitted successfully" }
        };
    } catch (error) {
        context.log.error('Error submitting hard mode score:', error);
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