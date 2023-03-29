const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
    },
    host: "smtp.ionos.com",
    port: "465",
});

const sendEmail = async (to, subject, text, htmlContent) => {
    var mailOptions = {
        from: "Play Those Games Support Team <support-team@playthosegames.com>",
        to: to,
        subject: subject,
        text: text,
        html: htmlContent
    };

    let success = true;

    await transporter.sendMail(mailOptions).catch((err) => {
        success = false;
    });
    
    return success;
};

module.exports = { sendEmail }; 