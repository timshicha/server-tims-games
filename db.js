
const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URL);

// Try connecting
client.connect().then(() => {
    console.log("Successfully connected to database.");
}).catch(() => {
    throw new Error("Could not connect to database.");
});


module.exports = { client };