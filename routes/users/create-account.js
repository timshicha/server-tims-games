const sendEmail = require("./mailer.js").sendEmail;
const { MongoClient } = require("mongodb");
const crypto  = require("crypto");
const client = new MongoClient(process.env.MONGO_URL);
const VERIFY_EMAIL_ATTEMPTS = parseInt(process.env.VERIFY_EMAIL_ATTEMPTS);

const confirmEmail = (code) => {
    return (
        `<style>.text{font-family: Arial, Helvetica, sans-serif; } .space{letter-spacing: 4px; text-align: center; }</style><div style="width: fit-content; border: black solid 3px; padding: 10px;"><h2 class="text">Your email verification code is</h2><h2 class="text space"> ${code} </h2></div>`
    );
};

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

// Send a verification email to the user
const createAccountSendEmail = (req, res) => {
    // Read data
    let body = "";
    req.on("data", chunk => {
        body += chunk.toString();
    });
    req.on("end", async () => {
        body = JSON.parse(body);
        let email = body.email;

        // Make sure this email doesn't exist in the database already
        await client.connect()
            .catch(() => {
                console.log("DB connection failed in createAccountSendEmail()");
                res.status(200).json({ "success": false, "reason": "A server error occured" });
        });
        let user = await client.db("playthosegames").collection("users").findOne({ "email": email })
            .catch(() => {
                console.log("DB search failed in createAccountSendEmail()");
                res.status(200).json({ "success": false, "reason": "A server error occured" });

        });
        if (user) {
            res.status(200).json({ "success": false, "reason": "An account with this email already exists." });
        }
        else {
            let code = Math.floor(Math.random() * 1000000);
            let accountCreationID = crypto.randomUUID();
            // If email send failed
            let emailSuccess = await sendEmail(email, "Email Verification Code", "", confirmEmail(code));
            if (!emailSuccess) {
                res.status(200).json({ "success": false, "reason": "Could not send verification code to this email." });
            }
            else {
                NewAccounts.addNewAccount(accountCreationID, email, code, VERIFY_EMAIL_ATTEMPTS);
                res.status(200).json({ "success": true, "accountCreationID": accountCreationID });
            }
        }
    });
};

const createAccountVerifyEmail = (req, res) => {
    let body = "";
    req.on("data", chunk => {
        body += chunk.toString();
    });
    req.on("end", async () => {
        body = JSON.parse(body);

        let accountCreationID = body.accountCreationID;
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
}

const createAccountUsernamePassword = (req, res) => {
    let body = "";
    req.on("data", chunk => {
        body += chunk.toString();
    });
    req.on("end", async () => {
        body = JSON.parse(body);

        // Add the user to the database
        let accountCreationID = body.accountCreationID;
        let accountCreationDetails;
        let username = body.username;
        let password = body.password;

        // Make sure all necessary data was send and accountCreationID exists
        if (!accountCreationID || !username || !password || !(accountCreationDetails = NewAccounts.newAccounts[accountCreationID])) {
            res.status(200).json({ "success": false, "reason": "Could not create account." });
        }
        else {
            // If the email is not verified
            if (!accountCreationDetails.verified) {
                res.status(200).json({ "success": false, "reason": "This email is not verified" });
                return;
            }
            NewAccounts.removeNewAccount(accountCreationID);

            await client.connect()
                .catch(() => {
                    console.log("DB connection failed in createAccountUsernamePassword()");
                    res.status(200).json({ "success": false, "reason": "A server error occured" });
                });
            await client.db("playthosegames").collection("users").insertOne({
                email: accountCreationDetails.email,
                username: username,
                password: password
            }).then(() => {
                res.status(200).json({ "success": true });
            }).catch(() => {
                console.log("DB search failed in createAccountUsernamePassword()");
                res.status(200).json({ "success": false, "reason": "A server error occured" });
            });
        }
    });
}


// setInterval(() => { console.log("New Accounts:", NewAccounts.newAccounts) }, 5000);

module.exports = { createAccountSendEmail, createAccountVerifyEmail, createAccountUsernamePassword };