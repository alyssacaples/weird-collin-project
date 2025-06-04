const { BlobServiceClient } = require("@azure/storage-blob");

const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
);

const containerClient = blobServiceClient.getContainerClient("gamedata");

module.exports = async function (context, req) {
    context.log('Getting daily high scores from blob storage');

    try {
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        const blobClient = containerClient.getBlobClient(`daily-scores-${today}.json`);
        
        // Check if blob exists for today
        const exists = await blobClient.exists();
        
        if (!exists) {
            // Return empty array if no scores for today yet
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

        // Sort by time (ascending - faster times first) and format
        const formattedScores = scores
            .sort((a, b) => a.time - b.time)
            .slice(0, 10)
            .map(score => ({
                playerName: score.playerName,
                time: parseFloat(score.time).toFixed(3)
            }));

        context.res = {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: formattedScores
        };
    } catch (error) {
        context.log.error('Error getting daily high scores:', error);
        context.res = {
            status: 500,
            headers: {
                "Access-Control-Allow-Origin": "*"
            },
            body: { error: 'Failed to get daily high scores' }
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