import express from 'express';
import streamRoutes from './streaming.js';
import downRoutes from './downloading.js';
const app = express();

app.use('/stream', streamRoutes)
app.use('/down', downRoutes)

const timestamp = new Date();
app.get("/", function (req, res) {
    const timediff = new Date().getTime() - timestamp.getTime();
    const days = Math.floor(timediff / 1000 / 3600 / 24);
    const hours = Math.floor(timediff / 100 / 3600) / 10;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(`alive for ${days} days and ${hours} hours. Total ${timediff} mills`);
})


app.listen(process.env.PORT || 8000, function () {
    console.log("Listening on " + (process.env.PORT || 8000));
})