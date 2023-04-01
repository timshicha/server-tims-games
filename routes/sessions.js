const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");
const { createSession, destroySession } = require("../utilities/sessionTools");
const client = new MongoClient(process.env.MONGO_URL);
const cookieParser = require("cookie-parser");
const LOGIN_SESSION_MAX_AGE = parseInt(process.env.LOGIN_SESSION_MAX_AGE);


const validatePassword = async (password, hashedPassword) => {
    let result = await bcrypt.compare(password, hashedPassword);
    if (result === true) {
        return result;
    }
    return false;
}

router.use(cookieParser());

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
        let emailRegex = /@/;
        let isEmail = emailRegex.test(username);

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
                    let sessionID = await createSession(user.username);
                    if (sessionID) {
                        res.cookie("sessionID", sessionID, { maxAge: LOGIN_SESSION_MAX_AGE, httpOnly: true });
                        res.cookie("username", user.username, { maxAge: LOGIN_SESSION_MAX_AGE });
                        res.cookie("loggedIn", "true", { maxAge: LOGIN_SESSION_MAX_AGE });
                    }
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
                    let sessionID = await createSession(user.username);
                    if (sessionID) {
                        res.cookie("sessionID", sessionID, { maxAge: LOGIN_SESSION_MAX_AGE, httpOnly: true });
                        res.cookie("username", username, { maxAge: LOGIN_SESSION_MAX_AGE });
                        res.cookie("loggedIn", "true", { maxAge: LOGIN_SESSION_MAX_AGE });
                    }
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

// Read the provided username/email and passowrd and create session
router.delete("/sessions/destroy", (req, res) => {
    let body = "";
    req.on("data", chunk => {
        body += chunk.toString();
    });
    req.on("end", async () => {
        let sessionID = req.cookies.sessionID;
        await destroySession(sessionID);
        res.cookie("loggedIn", "", { maxAge: 0 });
        res.cookie("sessionID", "", { maxAge: 0 });
        res.cookie("username", "", { maxAge: 0 });
        res.status(200).send(JSON.stringify({success: true}));
    });
});


module.exports = router;