const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const client = new MongoClient(process.env.MONGO_URL);

const validatePassword = async (password, hashedPassword) => {
    console.log(password, hashedPassword);
    let result = await bcrypt.compare(password, hashedPassword);
    if (result === true) {
        return result;
    }
    return false;
}

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
                .findOne({ email: {"$regex": new RegExp("^" + username + "$"), $options: "i" }});
            if (user) {
                let hash = user.password;
                if (await validatePassword(password, hash) === true) {
                    console.log(user);
                    res.status(200).json({ success: true, username: user.username});
                }
                else {
                    res.status(200).json({ success: false, reason: "The password is incorrect." });
                }
            }
            else {
                res.status(200).json({ success: false, reason: "This email is not registered." });
            }
        }
        // If the user provided a username
        else {
            await client.connect().catch((err) => {
                console.log(err);
                res.send(200).json({ "success": false, "reason": "Failed to connect to database." });
            });
            let user = await client.db("playthosegames").collection("users")
                .findOne({ username: {"$regex": new RegExp("^" + username + "$"), $options: "i" }});
            if (user) {
                let hash = user.password;
                if (await validatePassword(password, hash) === true) {
                    res.status(200).json({ success: true, username: user.email});
                }
                else {
                    res.status(200).json({ success: false, reason: "The password is incorrect." });
                }
            }
            else {
                res.status(200).json({ success: false, reason: "This username does not exist." });
            }
        }
    });
});


module.exports = router;