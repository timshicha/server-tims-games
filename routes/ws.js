const socketIO = require("socket.io");

const socketIOHandler = (http, corsOptions) => {
    var io = socketIO(http, { cors: corsOptions });

    io.sockets.on("connect", function (socket) {
        let handshakeData = socket.request;
        console.log("New client connected:", handshakeData._query["userID"]);
    });


}

module.exports = {socketIOHandler};