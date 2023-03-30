const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");
const crypto  = require("crypto");
const client = new MongoClient(process.env.MONGO_URL);

// Read the provided username/email and passowrd and create session
router.post("/sessions/create", (req, res) => {
    let body = "";
    req.on("data", chunk => {
        body += chunk.toString();
    });
    req.on("end", async () => {
        body = JSON.parse(body);

        let username = body.username.toString();
        let password = body.password.toString();
        let emailRegex = /@/
        let isEmail = emailRegex.test(username);

        console.log("Username:", username);
        console.log("Is email:", isEmail);
        console.log("Password:", password);

        // If the user provided an email
        if (isEmail) {
            await client.connect().catch((err) => {
                console.log(err);
                res.send(200).json({ "success": false, "reason": "Failed to connect to database." });
            });
            let user = await client.db("playthosegames").collection("users")
                .findOne({ email: {"$regex": username, $options: "i" }, password: password });
            if (user) {
                console.log(user);
                res.status(200).json({ success: true, username: user.username});
            }
            else {
                res.status(200).json({ success: false, reason: "No account found." });
            }
        }
        // If the user provided a username
        else {
            await client.connect().catch((err) => {
                console.log(err);
                res.send(200).json({ "success": false, "reason": "Failed to connect to database." });
            });
            let user = await client.db("playthosegames").collection("users")
                .findOne({ username: {"$regex": username, $options: "i" }, password: password });
            if (user) {
                console.log(user);
                res.status(200).json({ success: true, email: user.email});
            }
            else {
                res.status(200).json({ success: false, reason: "No account found." });
            }
        }
    });
});


module.exports = router;