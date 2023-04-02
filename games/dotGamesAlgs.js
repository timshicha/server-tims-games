
const fillMatrix = (matrix, player) => {
    // v = visited
    const BOARD_SIZE = matrix.length;

    let v = Array(BOARD_SIZE + 2).fill().map(() => Array(BOARD_SIZE + 2).fill(0));
    // Recreate original matrix padded with empty layer (m)
    let m = Array(BOARD_SIZE + 2).fill().map(() => Array(BOARD_SIZE + 2).fill(0));
    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[0].length; j++) {
            m[i + 1][j + 1] = matrix[i][j];
        }
    } 
    let queue = [[0, 0]];
    // Propogate (through all dots not belonging to player) and fill
    while (queue.length > 0) {
        // c is current dot
        let c = queue.pop();
        // Set current dot as visited
        v[c[0]][c[1]] = 1;
        // If up
        if (c[0] > 0 && v[c[0] - 1][c[1]] === 0 && m[c[0] - 1][c[1]] !== player) {
            queue.push([c[0] - 1, c[1]]);
            // console.log("up");
        }
        // If right
        if (c[1] < BOARD_SIZE + 1 && v[c[0]][c[1] + 1] === 0 && m[c[0]][c[1] + 1] !== player) {
            queue.push([c[0], c[1] + 1]);
            // console.log("right");
        }
        // If down
        if (c[0] < BOARD_SIZE + 1 && v[c[0] + 1][c[1]] === 0 && m[c[0] + 1][c[1]] !== player) {
            queue.push([c[0] + 1, c[1]]);
            // console.log("down");
        }
        // If left
        if (c[1] > 0 && v[c[0]][c[1] - 1] === 0 && m[c[0]][c[1] - 1] !== player) {
            queue.push([c[0], c[1] - 1]);
            // console.log("left");
        }
    }
    // Everything that wasn't visited belongs to the player
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (v[i + 1][j + 1] === 0) {
                matrix[i][j] = player;
            }
        }
    }
}

module.exports = { fillMatrix };