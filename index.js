import express from 'express';
import streamRoutes from './streaming.js';
import downRoutes from './downloading.js';
const app = express();
app.use('/stream', streamRoutes)
app.use('/down', downRoutes)
app.get("/", function (req, res) {
    res.status(200).send("alive");
})


app.listen(process.env.PORT || 8000, function () {
    console.log("Listening on " + (process.env.PORT || 8000));
})