const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

const tableName = "HighScores";
const accountName = process.env.STORAGE_ACCOUNT_NAME;
const accountKey = process.env.STORAGE_ACCOUNT_KEY;

const credential = new AzureNamedKeyCredential(accountName, accountKey);
const tableClient = new TableClient(
  `https://${accountName}.table.core.windows.net`,
  tableName,
  credential
);

module.exports = async function (context, req) {
  if (req.method === "GET") {
    // Fetch top 10 high scores
    try {
      const entities = [];
      for await (const entity of tableClient.listEntities()) {
        entities.push(entity);
      }
      entities.sort((a, b) => parseFloat(a.Time) - parseFloat(b.Time));
      context.res = {
        status: 200,
        body: entities.slice(0, 10), // Return top 10 scores
      };
    } catch (error) {
      context.res = {
        status: 500,
        body: `Error fetching high scores: ${error.message}`,
      };
    }
  } else if (req.method === "POST") {
    // Save a new high score
    const { Name, Time } = req.body;
    if (!Name || !Time) {
      context.res = {
        status: 400,
        body: "Name and Time are required.",
      };
      return;
    }

    try {
      const entity = {
        partitionKey: "HighScores",
        rowKey: `${Date.now()}`, // Unique identifier
        Name,
        Time: Time.toString(),
      };
      await tableClient.createEntity(entity);
      context.res = {
        status: 201,
        body: { message: "High score saved successfully." },
      };
    } catch (error) {
      context.res = {
        status: 500,
        body: `Error saving high score: ${error.message}`,
      };
    }
  } else {
    context.res = {
      status: 405,
      body: "Method not allowed.",
    };
  }
};