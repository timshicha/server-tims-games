const socketIO = require("socket.io");

const socketIOHandler = (http, corsOptions) => {
    var io = socketIO(http, { cors: corsOptions });

    io.sockets.on("connect", function (socket) {
        console.log("Client connected");
        let handshakeData = socket.request;
        console.log(handshakeData._query["userID"]);
    });


}

module.exports = {socketIOHandler};