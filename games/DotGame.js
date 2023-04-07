const crypto = require("crypto");
const { fillMatrix, calculateArea } = require("./dotGamesAlgs");

const BOARD_SIZE = 18 - 1;
const MAX_AREA = (BOARD_SIZE - 1) * (BOARD_SIZE - 1);
const AREA_DIFFERENCE_WIN = 20;
const AREA_PERCENTAGE_WIN = 25;
const MISSED_TURNS_WIN = 4;
// How many seconds per move
const MAX_TIME_TO_MOVE = 5;


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
        this.player1area = 0;
        this.player2area = 0;
        // Percents are actual percents (0.00-100.00, not 0.00-1.00)
        this.player1areaPercent = 0.00;
        this.player2areaPercent = 0.00;
        // Keep a counter of how many turns were missed in a row.
        // 4 missed turns in a row represents a loss
        this.missedTurns = 0;
        player1socket.emit("dot-game-start", { success: true, opponent: player2username, you: 1});
        player2socket.emit("dot-game-start", { success: true, opponent: player1username, you: -1 });
        if (this.turn === 1) {
            player1socket.emit("dot-game-move");
        }
        else {
            player2socket.emit("dot-game-move");
        }
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
    move = async (username, x, y) => {
        let player = this.p(username);
        if (player !== this.turn) {
            return;
        }
        // If the spot is empty, move there
        console.log(x, y);
        if (this.board[x][y] === 0) {
            this.board[x][y] = player;

            // Fill in the matrix
            fillMatrix(this.board, player);
            // Calculate how much each player controls
            this.player1area = calculateArea(this.board, 1);
            this.player2area = calculateArea(this.board, -1);
            this.player1areaPercent = (this.player1area / MAX_AREA * 100).toFixed(2);
            this.player2areaPercent = (this.player2area / MAX_AREA * 100).toFixed(2);

            // Check for wins (and finalize game if it's over)
            let gameEnded = await this.checkWin();

            // If player 1 moved
            if (player === 1) {
                this.player1socket.emit("dot-game-update", {
                    success: true,
                    player: "you",
                    x: x,
                    y: y,
                    board: this.board,
                    area: { you: this.player1area, opponent: this.player2area },
                    areaPercent: {you: this.player1areaPercent, opponent: this.player2areaPercent}
                });
                this.player2socket.emit("dot-game-update", {
                    success: true,
                    player: "opponent",
                    x: x,
                    y: y,
                    board: this.board,
                    area: { you: this.player2area, opponent: this.player1area },
                    areaPercent: {you: this.player2areaPercent, opponent: this.player1areaPercent}
                });
            }
            // If player 2 moved
            else {
                this.player1socket.emit("dot-game-update", {
                    success: true,
                    player: "opponent",
                    x: x,
                    y: y,
                    board: this.board,
                    area: { you: this.player1area, opponent: this.player2area },
                    areaPercent: {you: this.player1areaPercent, opponent: this.player2areaPercent}

                });
                this.player2socket.emit("dot-game-update", {
                    success: true,
                    player: "you",
                    x: x,
                    y: y,
                    board: this.board,
                    area: { you: this.player2area, opponent: this.player1area },
                    areaPercent: {you: this.player2areaPercent, opponent: this.player1areaPercent}
                });
            }
            this.turn *= -1;
            if (!gameEnded) {
                if (this.turn === 1) {
                    this.player1socket.emit("dot-game-move");
                }
                else {
                    this.player2socket.emit("dot-game-move");
                }
            }
            this.missedTurns = 0;
        }
    }

    // Add the results to the database
    recordResult = async (winnerUsername, loserUsername) => {
        // Add here
        // Remove this game from the list
        delete players[this.player1username];
        delete players[this.player2username];
        // Reset the player's status to not in a game
        this.player1socket.data.inDotGame = false;
        this.player2socket.data.inDotGame = false;
    }

    checkWin = async () => {
        // Area difference wins
        if (this.player1area >= this.player2area + AREA_DIFFERENCE_WIN) {
            this.player1socket.emit("dot-game-over", {
                winner: "you",
                reason: "You win by area difference."
            });
            this.player2socket.emit("dot-game-over", {
                winner: "opponent",
                reason: "Opponent wins by area difference."
            });
            await this.recordResult(this.player1username, this.player2username);
            return true;
        }
        else if (this.player2area >= this.player1area + AREA_DIFFERENCE_WIN) {
            this.player1socket.emit("dot-game-over", {
                winner: "opponent",
                reason: "Opponent wins by area difference."
            });
            this.player2socket.emit("dot-game-over", {
                winner: "you",
                reason: "You win by area difference."
            });
            await this.recordResult(this.player2username, this.player1username);
            return true;
        }
        // Area percentage wins
        else if (this.player1areaPercent >= AREA_PERCENTAGE_WIN) {
            this.player1socket.emit("dot-game-over", {
                winner: "you",
                reason: "You win by area percentage."
            });
            this.player2socket.emit("dot-game-over", {
                winner: "opponent",
                reason: "Opponent wins by area percentage."
            });
            await this.recordResult(this.player1username, this.player2username);
            return true;
        }
        else if (this.player2areaPercent >= AREA_PERCENTAGE_WIN) {
            this.player1socket.emit("dot-game-over", {
                winner: "opponent",
                reason: "Opponent wins by area percentage."
            });
            this.player2socket.emit("dot-game-over", {
                winner: "you",
                reason: "You win by area percentage."
            });
            await this.recordResult(this.player2username, this.player1username);
            return true;
        }
        // Check for wins by inactivity
        if (this.missedTurns >= MISSED_TURNS_WIN) {
            // Player 1 missed their turns
            if (this.turn === 1) {
                this.player1socket.emit("dot-game-over", {
                    winner: "opponent",
                    reason: "Opponent wins because you missed 4 consecutive turns."
                });
                this.player2socket.emit("dot-game-over", {
                    winner: "you",
                    reason: "You win because your opponent missed 4 consecutive turns."
                });
                await this.recordResult(this.player2username, this.player1username);
            }
            else if (this.turn === -1) {
                this.player1socket.emit("dot-game-over", {
                    winner: "you",
                    reason: "You win because your opponent missed 4 consecutive turns."
                });
                this.player2socket.emit("dot-game-over", {
                    winner: "opponent",
                    reason: "Opponent wins because you missed 4 consecutive turns."
                });
                await this.recordResult(this.player1username, this.player2username);
            }
            return true;
        }
        return false;
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