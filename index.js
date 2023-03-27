require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const PORT = process.env.PORT || 3000;

const testRoutes = require("./routes/test.js");
const socketIOHandler = require("./routes/ws.js").socketIOHandler;
const prefix = "/api";

// Set up CORS to allow requests from our client
const cors = require("cors");
corsOptions = {
    origin: process.env.CLIENT_URL,
    optionsSuccessStatus: 200
}
app.use(cors(corsOptions));

app.use(prefix, testRoutes);

socketIOHandler(http, corsOptions);

http.listen(PORT, () => { console.log(`Server running on port ${PORT}`) });