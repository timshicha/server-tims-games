const express = require("express");
const router = express.Router();
const rateLimiter = require("express-rate-limit");
const { createAccountSendEmail, createAccountVerifyEmail, createAccountUsernamePassword } = require("./users/create-account.js");

const expressRateLimitor = rateLimiter({
    max: 3,
    windowMS: 60000,
});

router.post('/users/create-account-send-email', expressRateLimitor, (req, res) => {
    createAccountSendEmail(req, res);
});

router.post('/users/create-account-verify-email', (req, res) => {
    createAccountVerifyEmail(req, res);
});

router.post('/users/create-account-username-password', (req, res) => {
    createAccountUsernamePassword(req, res);
});

module.exports = router;