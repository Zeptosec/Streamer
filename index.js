import express from 'express';
const app = express();
import stream from 'stream';
import { getStreamBufferPart, sendBufferSize } from './manager.js';

const timestamp = new Date();
app.get("/", function (req, res) {
    const timediff = new Date().getTime() - timestamp.getTime();
    const days = Math.floor(timediff / 1000 / 3600 / 24);
    const hours = Math.floor(timediff / 100 / 3600) / 10;
    res.status(200).send(`alive for ${days} days and ${hours} hours. Total ${timediff} mills`);
})

app.get("/stream/:cid/:fid", async function (req, res) {
    const range = req.headers.range;
    const { fid, cid } = req.params;
    if (cid.length !== 19 || fid.length !== 19) {
        return res.status(400).send("Ids are not valid.");
    }
    if (!cid || !fid) {
        return res.status(400).send("No fid or cid was specified");
    }
    if (!range) {
        return res.status(400).send("Requires Range header");
    }
    let canceled = false;
    req.on('close', () => {
        canceled = true;
    })
    const start = Number(range.replace(/\D/g, ""));
    try {
        await new Promise(r => setTimeout(r, 50)); // accounting for sliding of video or audio
        if (canceled)
            return res.status(200);
        const data = await getStreamBufferPart(fid, cid, start, sendBufferSize);

        if (!data) return res.status(500).json({ error: "Could not get stream buffer. Check server logs." });
        const end = start + data.length
        const contentLength = end - start;
        // i guess i dont need content type
        // const type = req.headers['sec-fetch-dest'] === 'audio' ? 'audio/mp3' : 'video/mp4';

        const headers = {
            "Content-Range": `bytes ${start}-${end - 1}/${data.streamSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": contentLength,
            // "Content-Type": type,
            "Access-Control-Allow-Origin": "*"
        };
        res.writeHead(206, headers);
        var bufferStream = new stream.PassThrough();
        bufferStream.end(data.buffer);
        bufferStream.pipe(res)
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
    }
})

app.listen(process.env.PORT || 8000, function () {
    console.log("Listening on " + (process.env.PORT || 8000));
})