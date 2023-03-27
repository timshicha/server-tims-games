const express = require("express");
const app = express();
const router = express.Router();


router.get('/test', (req, res) => {
    res.send("Hello, this message is from the server!");
})

module.exports = router;