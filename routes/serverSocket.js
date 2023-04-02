const socketIO = require("socket.io");
const { getCookie } = require("../utilities/utilities");
const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URL);
const DotGame = require("../games/DotGame");

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

        // Assign them to no games
        socket.data.inDotGame = false;
        
        socket.on("message", (data) => {
            console.log("NEW MESSAGE");
            console.log("Username:", socket.data.username);
            console.log("Socket:", socket.id);
            console.log("Message:", data);
        });

        // Start a dot game
        socket.on("dot-game-start", (data) => {

            console.log("dot-game-start");
            if (!data) {
                return;
            }
            // Make sure they are not in a dot game already
            if (socket.data.inDotGame) {
                socket.emit("dot-game-start", {
                    success: false,
                    reason: "You are already in an active game."
                });
                return;
            }

            // When they start, assign them as in a dot game
            socket.data.inDotGame = true;

            // If they want to join a random game
            if (!data.playWith) {
                console.log("Play with a random opponent.");
                DotGame.startGame(socket.data.username, socket);
            }
            // Otherwise if they want to play with someone
            else {
                console.log("Play with " + data.playWith);
            }

        });

        socket.on("dot-game-move", (data) => {
            console.log("dot-game-move");
            // If no data
            if (!data) {
                return;
            }
            // If they are not in a dot game
            if (!socket.data.inDotGame) {
                socket.emit("dot-game-move", {
                    success: false,
                    reason: "You are not in a game."
                });
                return;
            }
            // Make sure they provided valid coordinates
            let x = parseInt(data.x);
            let y = parseInt(data.y);
            if (x === NaN || y === NaN) {
                return;
            }
            if (x < 0 || x >= DotGame.BOARD_SIZE || y < 0 || y >= DotGame.BOARD_SIZE) {
                return;
            }
            // Otherwise, make the move
            DotGame.move(socket.data.username, socket, x, y);
        });
        
        socket.on("disconnect", () => {
            console.log("Disconnect");
        });
        
        console.log("New client connected. SessionID:", sessionID);
    });
}

module.exports = {socketIOHandler};