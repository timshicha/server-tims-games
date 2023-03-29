require("dotenv").config();
const rateLimiter = require("express-rate-limit");
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const PORT = process.env.PORT || 3000;

const usersRoutes = require("./routes/users.js");
const socketIOHandler = require("./routes/ws.js").socketIOHandler;
const prefix = "/api";

const expressRateLimitor = rateLimiter({
    max: 5,
    windowMS: 10000,
});


// Set up CORS to allow requests from our client
const cors = require("cors");
corsOptions = {
    origin: process.env.CLIENT_URL,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(expressRateLimitor);
app.use(prefix, usersRoutes);

socketIOHandler(http, corsOptions);

http.listen(PORT, () => { console.log(`Server running on port ${PORT}`) });