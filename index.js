require("dotenv").config();
const rateLimiter = require("express-rate-limit");
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const PORT = process.env.PORT || 3000;

const accountsRoutes = require("./routes/accounts.js");
const sessionRoutes = require("./routes/sessions.js");
const socketIOHandler = require("./routes/serverSocket.js").socketIOHandler;
const deleteExpiredSessions = require("./utilities/sessionTools.js").deleteExpiredSessions;
const prefix = "/api";

const expressRateLimitor = rateLimiter({
    max: 10,
    windowMS: 10000,
});

// Delete expired sessions every 60 seconds
setInterval(deleteExpiredSessions, 60 * 1000);


// Set up CORS to allow requests from our client
const cors = require("cors");
corsOptions = {
    origin: process.env.CLIENT_URL,
    optionsSuccessStatus: 200,
    credentials: true
};

app.use(cors(corsOptions));
app.use(expressRateLimitor);
app.use(prefix, accountsRoutes);
app.use(prefix, sessionRoutes);

socketIOHandler(http, corsOptions);

http.listen(PORT, () => { console.log(`Server running on port ${PORT}`) });