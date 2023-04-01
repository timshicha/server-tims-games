const socketIO = require("socket.io");
const { getCookie } = require("../utilities/utilities");
const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URL);

const socketIOHandler = (http, corsOptions) => {
    var io = socketIO(http, { cors: corsOptions });

    io.sockets.on("connect", async (socket) => {
        let sessionID = getCookie(socket.handshake.headers.cookie, "sessionID");
        // If no session ID provided, disconnect
        if (!sessionID) {
            socket.disconnect();
            return;
        }
        
        let forcedDisconnect = false;
        
        // Find the username
        await client.connect().then(async () => {
            let session = await client.db("playthosegames").collection("sessions")
            .findOne({ sessionID: sessionID });
            if (session) {
                socket.data.username = session.username;
            }
            else {
                socket.disconnect();
                forcedDisconnect = true;
            }
        }).catch(err => {
            console.log(err);
            forcedDisconnect = true;
        });
        if (forcedDisconnect) {
            return;
        }
        
        socket.on("message", (data) => {
            console.log("NEW MESSAGE");
            console.log("Username:", socket.data.username);
            console.log("Socket:", socket.id);
            console.log("Message:", data);
            console.log();
        });
        
        socket.on("disconnect", (data) => {
            console.log("Disconnect");
        });
        
        console.log("New client connected. SessionID:", sessionID);
    });
}

module.exports = {socketIOHandler};