const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URL);
const crypto = require("crypto");

const createSession = async (userID) => {
    let sessionUUID = crypto.randomUUID();
    let toReturn = null;

    await client.connect().catch((err) => {
        console.log(err);
    });
    await client.db("playthosegames").collection("sessions")
        .insertOne({ sessionID: sessionUUID, userID: userID })
        .then(() => {
            toReturn = sessionUUID;
        })
        .catch((err) => {
            console.log(err);
        });
    return toReturn;
}

module.exports = { createSession };