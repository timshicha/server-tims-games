const express = require("express");
const socketIO = require("socket.io");


const socketIOHandler = (http) => {
    var io = socketIO(http);

    
}

module.exports = {socketIOHandler};