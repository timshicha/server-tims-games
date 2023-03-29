const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
    },
    host: "smtp.ionos.com",
    port: "465",
});

const sendEmail = (to, subject, text, htmlContent) => {
    var mailOptions = {
        from: "Play Those Games Support Team <support-team@playthosegames.com>",
        to: to,
        subject: subject,
        text: text,
        html: htmlContent
    };

    let success = true;
    return success;

    transporter.sendMail(mailOptions, (error) => {
        if (error) {
            success = false;
            console.log(error);
        }
    });
    return success;
};

module.exports = { sendEmail }; 