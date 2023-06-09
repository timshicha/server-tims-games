const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URL);
const crypto = require("crypto");
const LOGIN_SESSION_MAX_AGE = parseInt(process.env.LOGIN_SESSION_MAX_AGE);


const deleteExpiredSessions = async () => {
    await client.db("playthosegames").collection("sessions")
        .deleteMany({expireAt: {$lte: (new Date()).getTime()}});
}

const createSession = async (username) => {
    let sessionUUID = crypto.randomUUID();
    let toReturn = null;

    let expireAt = (new Date()).getTime() + LOGIN_SESSION_MAX_AGE;
    await client.db("playthosegames").collection("sessions")
        .insertOne({
            sessionID: sessionUUID,
            username: username,
            expireAt: expireAt
        })
        .then(() => {
            toReturn = sessionUUID;
        })
        .catch((err) => {
            console.log(err);
        });
    return toReturn;
}

const destroySession = async (sessionID) => {
    await client.db("playthosegames").collection("sessions")
        .deleteOne({sessionID: sessionID});
}

module.exports = { createSession, deleteExpiredSessions, destroySession };