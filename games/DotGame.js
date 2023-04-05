const crypto = require("crypto");
const { fillMatrix, calculateArea } = require("./dotGamesAlgs");

const BOARD_SIZE = 19;


// List of usernames and their games
// Key: username, Value: a game object
var players = {};

// Players waiting to play
// Key: username, Value: player's socket
var waitlist = {};


class DotGame {
    constructor(player1username, player1socket, player2username, player2socket) {
        // Make sure both sockets are connected
        if (!player1socket.connected || !player2socket.connected) {
            // See which player is connected to put them to waitlist or
            // place them in a different game
            if (player1socket.connected) {
                startGame(player1username, player1socket);
            }
            if (player2socket) {
                startGame(player2username, player2socket);
            }
        }

        this.player1username = player1username;
        this.player1socket = player1socket;
        this.player2username = player2username;
        this.player2socket = player2socket;
        this.board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(0));
        this.turn = (Math.random() < 0.5 ? 1 : -1);
        player1socket.emit("dot-game-start", { success: true, opponent: player2username });
        player2socket.emit("dot-game-start", { success: true, opponent: player1username });
    }

    // Get the player's value based on username
    // Are they player -1 or 1?
    p = (username) => {
        if (username === this.player1username) {
            return 1;
        }
        else {
            return -1;
        }
    }

    // Make a move
    move = (username, x, y) => {
        let player = this.p(username);
        if (player !== this.turn) {
            if (player === 1) {
                this.player1socket.emit("dot-game-move", {
                    success: false,
                    reason: "It is not your turn to move."
                });
            }
            else {
                this.player2socket.emit("dot-game-move", {
                    success: false,
                    reason: "It is not your turn to move."
                });
            }
            return;
        }
        // If the spot is empty, move there
        console.log(x, y);
        if (this.board[x][y] === 0) {
            this.board[x][y] = player;

            // Fill in the matrix
            fillMatrix(this.board, player);
            // Calculate how much each player controls
            let player1area = calculateArea(this.board, 1);
            let player2area = calculateArea(this.board, -1);

            // If player 1 moved
            if (player === 1) {
                this.player1socket.emit("dot-game-move", {
                    success: true,
                    player: "you",
                    x: x,
                    y: y,
                    board: this.board,
                    area: {you: player1area, opponent: player2area}
                });
                this.player2socket.emit("dot-game-move", {
                    success: true,
                    player: "opponent",
                    x: x,
                    y: y,
                    board: this.board,
                    area: {you: player2area, opponent: player1area}
                });
            }
            // If player 2 moved
            else {
                this.player1socket.emit("dot-game-move", {
                    success: true,
                    player: "opponent",
                    x: x,
                    y: y,
                    board: this.board,
                    area: {you: player1area, opponent: player2area}
                });
                this.player2socket.emit("dot-game-move", {
                    success: true,
                    player: "you",
                    x: x,
                    y: y,
                    board: this.board,
                    area: {you: player2area, opponent: player1area}
                });
            }
            this.turn *= -1;
        }
        // Otherwise, send error
        else {
            if (player === 1) {
                this.player1socket.emit("dot-game-move", { success: false });
            }
            else {
                this.player2socket.emit("dot-game-move", { success: false });
            }
        }
    }
}

const startGame = (username, socket) => {
    // If there's no one waiting for a game, add to waitlist
    if (Object.keys(waitlist).length === 0) {
        waitlist[username] = socket;
        return;
    }
    // Otherwise pair them up
    let player2username = Object.keys(waitlist)[0];
    let player2socket = waitlist[player2username];
    delete waitlist[player2username];

    // Create the game
    let game = new DotGame(username, socket, player2username, player2socket);
    players[username] = game;
    players[player2username] = game;
}

const move = (username, socket, x, y) => {
    let game = players[username];
    // If the player tried to move while not in a game
    if (!game) {
        socket.emit("dot-game-move", { success: false, reason: "You are not in a game. Please start a game first." });
        return;
    }
    // Otherwise, make the move on the game
    game.move(username, x, y);
}

// Stop searching for a game
const stop = (username) => {
    // If they are waiting
    if (waitlist[username]) {
        delete waitlist[username];
        return true;
    }
    // Otherwise, they are not waiting
    return false;
}


module.exports = { startGame, stop, move, BOARD_SIZE };