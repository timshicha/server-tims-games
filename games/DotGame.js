const crypto = require("crypto");
const { fillMatrix, calculateArea } = require("./dotGamesAlgs");

const BOARD_SIZE = 18 - 1;
const MAX_AREA = (BOARD_SIZE - 1) * (BOARD_SIZE - 1);
const AREA_DIFFERENCE_WIN = 20;
const AREA_PERCENTAGE_WIN = 25;
const MISSED_TURNS_WIN = 4;
// How many milliseconds seconds per move
const MAX_TIME_TO_MOVE = 5000;


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
        this.timeoutID = null;
        // The time in milliseconds when the turn expires
        this.timeoutTime = null;
        this.forfeit = null;
        // Keep a counter of how many turns were missed in a row.
        // 4 missed turns in a row represents a loss
        this.player1missedTurns = 0;
        this.player2missedTurns = 0;
        player1socket.emit("dot-game-start", { success: true, opponent: player2username, you: 1});
        player2socket.emit("dot-game-start", { success: true, opponent: player1username, you: -1 });
        
        this.sendTurn();
        console.log("[Dot Game] New game: " + player1username + " vs " + player2username);
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

    // Called after a user hasn't moved for longer than the allowed time
    expireTurn = async () => {
        console.log("Someone didn't move");
        let gameFinished = false;
        if (this.turn === 1) {
            this.player1missedTurns += 1;
            if (this.player1missedTurns >= MISSED_TURNS_WIN) {
                gameFinished = await this.checkWin();
            }
        }
        else {
            this.player2missedTurns += 1;
            if (this.player2missedTurns >= MISSED_TURNS_WIN) {
                gameFinished = await this.checkWin();
            }
        }
        this.turn *= -1;
        if (!gameFinished) {
            this.sendTurn();
        }
    }

    sendTurn = () => {
        let timeoutTime = (new Date()).getTime() + MAX_TIME_TO_MOVE + 2000;
        if (this.turn === 1) {
            this.player1socket.emit("dot-game-move", { moveBy: timeoutTime });
            this.player2socket.emit("dot-game-opponent-move", {moveBy: timeoutTime});
        }
        else {
            this.player1socket.emit("dot-game-opponent-move", {moveBy: timeoutTime});
            this.player2socket.emit("dot-game-move", {moveBy: timeoutTime});
        }
        this.timeoutTime = timeoutTime;
        this.timeoutID = setTimeout(this.expireTurn, MAX_TIME_TO_MOVE + 2000);
    }

    // Make a move
    move = async (username, x, y) => {
        let player = this.p(username);
        if (player !== this.turn) {
            return;
        }
        // If the spot is empty, move there
        if (this.board[x][y] === 0) {
            this.board[x][y] = player;

            clearTimeout(this.timeoutID);

            // Fill in the matrix
            fillMatrix(this.board, player);
            // Calculate how much each player controls
            this.player1area = calculateArea(this.board, 1);
            this.player2area = calculateArea(this.board, -1);
            this.player1areaPercent = (this.player1area / MAX_AREA * 100).toFixed(2);
            this.player2areaPercent = (this.player2area / MAX_AREA * 100).toFixed(2);

            // If player 1 moved
            if (player === 1) {
                this.player1missedTurns = 0;
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
                this.player2missedTurns = 0;
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

            // Check for wins
            if (await this.checkWin()) {
                return;
            }

            this.turn *= -1;
            this.sendTurn();
        }
    }

    forfeitGame = (player) => {
        this.forfeit = player;
        this.checkWin();
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
            clearTimeout(this.timeoutID);
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
            clearTimeout(this.timeoutID);
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
            clearTimeout(this.timeoutID);
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
            clearTimeout(this.timeoutID);
            return true;
        }
        // Check for wins by inactivity
        else if (this.player1missedTurns >= MISSED_TURNS_WIN) {
            this.player1socket.emit("dot-game-over", {
                winner: "opponent",
                reason: "Opponent wins because you missed " + MISSED_TURNS_WIN + " consecutive turns."
            });
            this.player2socket.emit("dot-game-over", {
                winner: "you",
                reason: "You win because your opponent missed " + MISSED_TURNS_WIN + " consecutive turns."
            });
            await this.recordResult(this.player2username, this.player1username);
            clearTimeout(this.timeoutID);
            return true;
        }
        else if (this.player2missedTurns >= MISSED_TURNS_WIN) {
            this.player1socket.emit("dot-game-over", {
                winner: "you",
                reason: "You win because your opponent missed " + MISSED_TURNS_WIN + " consecutive turns."
            });
            this.player2socket.emit("dot-game-over", {
                winner: "opponent",
                reason: "Opponent wins because you missed " + MISSED_TURNS_WIN + " consecutive turns."
            });
            await this.recordResult(this.player1username, this.player2username);
            clearTimeout(this.timeoutID);
            return true;
        }
        // Check for forfeit
        else if (this.forfeit) {
            if (this.forfeit === this.player1username) {
                this.player1socket.emit("dot-game-over", {
                    winner: "opponent",
                    reason: "Opponent wins because you foreited."
                });
                this.player2socket.emit("dot-game-over", {
                    winner: "you",
                    reason: "You win because your opponent forfeited."
                });
                await this.recordResult(this.player2username, this.player1username);
                clearTimeout(this.timeoutID);
                return true;
            }
            else if (this.forfeit === this.player2username) {
                this.player1socket.emit("dot-game-over", {
                    winner: "you",
                    reason: "You win because your opponent forfeited."
                });
                this.player2socket.emit("dot-game-over", {
                    winner: "opponent",
                    reason: "Opponent wins because you foreited."
                });
                await this.recordResult(this.player1username, this.player2username);
                clearTimeout(this.timeoutID);
                return true;
            }
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

const forfeit = (username) => {
    let game = players[username];
    // If the player tried to forfeit while not in a game
    if (!game) {
        return;
    }
    game.forfeitGame(username);
}


module.exports = { startGame, stop, move, forfeit, BOARD_SIZE };