const express = require('express');
const streamRoutes = require('./streaming.js');
const downRoutes = require('./downloading.js');
var cors = require('cors');
const { convertMsToTime } = require('./utils.js');
const app = express();
app.use(cors({
    origin: '*'
}));
app.use('/stream', streamRoutes)
app.use('/down', downRoutes)



const timestamp = new Date();
app.get("/", function (req, res) {
    const timediff = new Date().getTime() - timestamp.getTime();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(`Alive for: ${convertMsToTime(timediff)}`);
})


app.listen(process.env.PORT || 8000, function () {
    console.log("Listening on " + (process.env.PORT || 8000));
})