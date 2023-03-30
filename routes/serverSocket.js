const socketIO = require("socket.io");

const socketIOHandler = (http, corsOptions) => {
    var io = socketIO(http, { cors: corsOptions });

    io.sockets.on("connect", function (socket) {
        let handshakeData = socket.request;
        let cookies = socket.request.headers.cookie;
        console.log("New client connected:", handshakeData._query["userID"]);
        console.log("Their cookies are:", cookies);

        
        socket.on("message", (data) => {
            console.log(data);
            console.log(socket.id);
        });
    });
}

module.exports = {socketIOHandler};