const express = require("express");
const router = express.Router();
const { createAccountSendEmail, createAccountVerifyEmail, createAccountUsernamePassword } = require("./users/create-account.js");

router.post('/users/create-account-send-email', (req, res) => {
    createAccountSendEmail(req, res);
});

router.post('/users/create-account-verify-email', (req, res) => {
    createAccountVerifyEmail(req, res);
});

router.post('/users/create-account-username-password', (req, res) => {
    createAccountUsernamePassword(req, res);
});

module.exports = router;