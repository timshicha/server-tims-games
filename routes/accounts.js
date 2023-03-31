const express = require("express");
const router = express.Router();
const sendEmail = require("../utilities/mailer.js").sendEmail;
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const rateLimiter = require("express-rate-limit");
const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URL);
const VERIFY_EMAIL_ATTEMPTS = parseInt(process.env.VERIFY_EMAIL_ATTEMPTS);
const { createSession } = require("../utilities/sessionTools");


const expressRateLimitor = rateLimiter({
    max: 3,
    windowMS: 60000,
});

const confirmEmail = (code) => {
    return (
        `<style>.text{font-family: Arial, Helvetica, sans-serif; } .space{letter-spacing: 4px; text-align: center; }</style><div style="width: fit-content; border: black solid 3px; padding: 10px;"><h2 class="text">Your email verification code is</h2><h2 class="text space"> ${code} </h2></div>`
    );
};

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
}

// Class to manage new accounts (awaiting email verification)
class NewAccounts {
    // [accountCreationID]: {email: "email@email.com", code: "123456", attemptsRemaining: 3, verified false}
    static newAccounts = {};

    static removeNewAccount = (accountCreationID) => {
        delete this.newAccounts[accountCreationID];
    };
    // Remove all other accountCreation objects with same email
    static removeNewEmailAccounts = (email) => {
        for (const [key, value] of Object.entries(this.newAccounts)) {
            delete this.newAccounts[key];
        }
    }

    static addNewAccount = (accountCreationID, email, code, attemptsRemaining) => {
        // Remove other requests to make an account using thie email
        this.removeNewEmailAccounts(email);
        this.newAccounts[accountCreationID] =
            { email: email, code: code, attemptsRemaining: attemptsRemaining, verified: false};
        setTimeout(() => { this.removeNewAccount(accountCreationID) }, process.env.VERIFY_EMAIL_MAX_AGE);
    };
};

router.post('/users/create-account-send-email', expressRateLimitor, (req, res) => {
    let body = "";
    req.on("data", chunk => {
        body += chunk.toString();
    });
    req.on("end", async () => {
        body = JSON.parse(body);
        let email = body.email.toString().toLowerCase();

        // Make sure this email doesn't exist in the database already
        await client.connect()
            .catch(() => {
                console.log("DB connection failed in createAccountSendEmail()");
                res.status(200).json({ "success": false, "reason": "A server error occured." });
        });
        let user = await client.db("playthosegames").collection("users").findOne({ "email": {"$regex": new RegExp("^" + email + "$"), $options: "i"}})
            .catch(() => {
                console.log("DB search failed in createAccountSendEmail()");
                res.status(200).json({ "success": false, "reason": "A server error occured." });

        });
        if (user) {
            res.status(200).json({ "success": false, "reason": "An account with this email already exists." });
        }
        else {
            let code = Math.floor(Math.random() * 1000000);
            // The code may have fewer than 6 digits, pad with 0's:
            let codeAsString = code.toString();
            while (codeAsString.length < 6) {
                codeAsString = "0" + codeAsString;
            }
            let accountCreationID = crypto.randomUUID();
            // If email send failed
            let emailSuccess = await sendEmail(email, "Email Verification Code", "", confirmEmail(codeAsString));
            if (!emailSuccess) {
                res.status(200).json({ "success": false, "reason": "Could not send verification code to this email." });
            }
            else {
                NewAccounts.addNewAccount(accountCreationID, email, code, VERIFY_EMAIL_ATTEMPTS);
                res.status(200).json({ "success": true, "accountCreationID": accountCreationID });
            }
        }
    });
});

router.post('/users/create-account-verify-email', (req, res) => {
    let body = "";
    req.on("data", chunk => {
        body += chunk.toString();
    });
    req.on("end", async () => {
        body = JSON.parse(body);

        let accountCreationID = body.accountCreationID.toString();
        let code = parseInt(body.code);

        // Body variables must be present, and creation ID must exist
        // If programmed correctly in front-end, this would be an issue with the code expiring
        if (!accountCreationID || !NewAccounts.newAccounts[accountCreationID] || !code) {
            res.status(200).json({ "success": false, "reason": "The code expired. Please try signing up again.", "blocked": "false" });
        }
        // Verify that the code is correct
        else if (NewAccounts.newAccounts[accountCreationID].code === code) {
            NewAccounts.newAccounts[accountCreationID].verified = true;
            res.status(200).json({ "success": true });
        }
        else {
            NewAccounts.newAccounts[accountCreationID].attemptsRemaining -= 1;
            // If the user ran out of attempts
            if (NewAccounts.newAccounts[accountCreationID].attemptsRemaining <= 0) {
                NewAccounts.removeNewAccount(accountCreationID);
                res.status(200).json({"success": false, "reason": "The code is not correct.", "blocked": "true"});
            }
            else {
                res.status(200).json({ "success": false, "reason": "The code is not correct.", "blocked": "false" });
            }
        }
    });
});

router.post('/users/create-account-username-password', (req, res) => {
    // Check if a username is legal. A username may only have
    // letters, numbers, and underscores and must be between 1
    // and 25 characters.
    const checkValidUsername = (username) => {
        if (username.length === 0 || username.length > 25) {
            return false;
        }
        let notAllowed = /[^a-zA-Z0-9_]/;
        return !notAllowed.test(username);
    }

    // Check if a password is legal. A password must be between
    // 8 and 50 characters.
    const checkValidPassword = (password) => {
        if (password.length < 8 || password.length > 50) {
            return false;
        }
        return true;
    }

    let body = "";
    req.on("data", chunk => {
        body += chunk.toString();
    });
    req.on("end", async () => {
        body = JSON.parse(body);

        // Add the user to the database
        let accountCreationID = body.accountCreationID.toString();;
        let accountCreationDetails;
        let username = body.username.toString();
        let password = body.password.toString();

        // Make sure all necessary data was send and accountCreationID exists
        if (!accountCreationID || !username || !password || !(accountCreationDetails = NewAccounts.newAccounts[accountCreationID])) {
            res.status(200).json({ "success": false, "reason": "Code expired before you made an account. Please try getting another code." });
        }
        // Should always pass since checks happened in the browser as well
        else if (!checkValidUsername(username)) {
            res.status(200).json({"success": false, "reason": "Invalid username. Username may have letters, numbers, and underscores, and must be between 1 and 25 characters."})
        }
        // Should always pass since checks happened in the browser as well
        else if (!checkValidPassword(password)) {
            res.status(200).json({ "success": false, "reason": "Invalid password. Password must be between 8 and 50 characters." });
        }
        else {
            // If the email is not verified
            if (!accountCreationDetails.verified) {
                res.status(200).json({ "success": false, "reason": "This email is not verified." });
                return;
            }
            
            // Make sure a user doesn't already exist
            let user = await client.db("playthosegames").collection("users").findOne({
                username: { "$regex": new RegExp("^" + username + "$"), $options: "i" }
            })
            .catch(() => {
                console.log("DB connection failed in createAccountUsernamePassword()");
                res.status(200).json({ "success": false, "reason": "A server error occured." });
            });
            
            if (user) {
                res.status(200).json({ "success": false, "reason": "This username is taken." });
            }
            else {
                // Hash the password
                let hash = await hashPassword(password);
                // Create a uuid for the user
                let userUUID = crypto.randomUUID();
                await client.db("playthosegames").collection("users").insertOne({
                    userID: userUUID,
                    email: accountCreationDetails.email,
                    username: username,
                    password: hash,
                }).then(async () => {
                    NewAccounts.removeNewAccount(accountCreationID);
                    // Create a session
                    let sessionID = await createSession(userUUID);
                    if (sessionID) {
                        res.cookie("sessionID", sessionID);
                    }
                    res.status(200).json({ "success": true });
                }).catch(() => {
                    console.log("DB search failed in createAccountUsernamePassword()");
                    res.status(200).json({ "success": false, "reason": "A server error occured." });
                });
            }
        }
    });
});

module.exports = router;