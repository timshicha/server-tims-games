const socketIO = require("socket.io");
const { getCookie } = require("../utilities/utilities");
const { client } = require("../db");
const DotGame = require("../games/DotGame");

const socketIOHandler = (http, corsOptions) => {
    var io = socketIO(http, { cors: corsOptions });

    io.sockets.on("connect", async (socket) => {
        let sessionID = getCookie(socket.handshake.headers.cookie, "sessionID");
        // If no session ID provided, disconnect
        if (!sessionID) {
            socket.emit("pre-disconnect", {
                reason: "You are not signed in."
            });
            socket.disconnect();
            return;
        }
                
        // Find the username
        let session = await client.db("playthosegames").collection("sessions")
            .findOne({ sessionID: sessionID });
        if (session) {
            socket.data.username = session.username;
        }
        else {
            socket.emit("pre-disconnect", {
                reason: "You are not signed in."
            });
            socket.disconnect();
            return;
        }

        console.log("[Socket] \u001b[32m" + socket.data.username + "\u001b[0m connected.");
        // Assign them to no games
        socket.data.inDotGame = false;
        
        socket.on("message", (data) => {
            console.log("[Socket] " + socket.data.username + ": " + data);
        });

        // Start a dot game
        socket.on("dot-game-start", (data) => {

            // console.log("dot-game-start");
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
                DotGame.startGame(socket.data.username, socket);
            }
            // Otherwise if they want to play with someone
            else {
                console.log("Play with " + data.playWith);
            }

        });

        // Stop searching for a dot game
        socket.on("dot-game-stop", (data) => {
            // console.log("dot-game-stop");
            
            // If they aren't in a game or are still searching, we can cancel
            if (!socket.data.inDotGame || DotGame.stop(socket.data.username)) {
                socket.data.inDotGame = false;
                socket.emit("dot-game-stop", { success: true });
            }
            else {
                socket.emit("dot-game-stop", { success: false });
            }
        });

        socket.on("dot-game-move", (data) => {
            // console.log("dot-game-move");
            // If no data
            if (!data) {
                return;
            }
            // If they are not in a dot game
            if (!socket.data.inDotGame) {
                return;
            }
            // Make sure they provided valid coordinates
            let x = parseInt(data.x);
            let y = parseInt(data.y);
            if (isNaN(x) || isNaN(y)) {
                return;
            }
            if (x < 0 || x >= DotGame.BOARD_SIZE || y < 0 || y >= DotGame.BOARD_SIZE) {
                return;
            }
            // Otherwise, make the move
            DotGame.move(socket.data.username, socket, x, y);
        });

        socket.on("dot-game-forfeit", () => {
            if (!socket.data.inDotGame) {
                return;
            }
            DotGame.forfeit(socket.data.username);
        });
        
        socket.on("disconnect", () => {
            // Stop any game searches they're making
            DotGame.stop(socket.data.username);
            console.log("[Socket] \u001b[31m" + socket.data.username + "\u001b[0m disconnected.");
        });
    });
}

module.exports = {socketIOHandler};