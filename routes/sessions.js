const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { createSession, destroySession } = require("../utilities/sessionTools");
const { client } = require("../db");
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

class TempIDs {
    static tempIDs = {};

    static createTempID = (username) => {
        let tempID = crypto.randomUUID();
        this.tempIDs[tempID] = username;

        // Keep tempIDs short-lived. Delete them quickly
        setTimeout(() => { this.destroyTempID(tempID) }, 30000);
        return tempID;
    }

    static destroyTempID = (tempID) => {
        delete this.tempIDs[tempID];
    }

    static getUsername = (tempID) => {
        return this.tempIDs[tempID];
    }
};

// Get a tempID
router.get("/sessions/tempID", (req, res) => {
    if (!req.cookies.sessionID) {
        res.status(200).json({ success: false, reason: "You are not logged in." });
        return;
    }
    let body = "";
    req.on("data", chunk => {
        body += chunk.toString();
    });
    req.on("end", async () => {
        // If the sessionID cookie is valid, return a tempID pointing to their userID
        let session = await client.db("playthosegames").collection("sessions")
            .findOne({ sessionID: req.cookies.sessionID });
        if (session) {
            let tempID = TempIDs.createTempID(session.username);
            res.status(200).json({ success: true, tempID: tempID });
        }
        else {
            res.status(200).json({ success: false, reason: "You are not logged in." });
        }
    });
})


module.exports = router, { TempIDs };