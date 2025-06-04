const { BlobServiceClient } = require("@azure/storage-blob");

const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
);

const containerClient = blobServiceClient.getContainerClient("gamedata");
const blobClient = containerClient.getBlobClient("hardDailyHighscores.json");

module.exports = async function (context, req) {
    context.log('Getting hard mode daily high scores from blob storage');

    try {
        // Check if blob exists
        const exists = await blobClient.exists();
        
        if (!exists) {
            // Return empty array if file doesn't exist yet
            context.res = {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: []
            };
            return;
        }

        // Download and parse the JSON file
        const downloadResponse = await blobClient.download();
        const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
        const scores = JSON.parse(downloaded.toString());

        // Filter for today's scores only
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const todayScores = scores.filter(score => {
            // If score has date property, check if it's today
            if (score.date) {
                return score.date.startsWith(today);
            }
            // If no date property, include it (for backward compatibility)
            return true;
        });

        context.res = {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: todayScores
        };
    } catch (error) {
        context.log.error('Error getting hard mode daily high scores:', error);
        context.res = {
            status: 500,
            body: { error: 'Failed to get hard mode daily high scores' }
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