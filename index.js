import express from 'express';
const app = express();
import stream from 'stream';
import { getStreamBuffer } from './manager.js';

app.get("/", function (req, res) {
    res.status(200).send("alive");
})

app.get("/stream/:id", async function (req, res) {
    const range = req.headers.range;
    const id = req.params.id;
    if (!id) {
        return res.status(400).send("No id was specified");
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
        const data = await getStreamBuffer(id, start);
        if (!data.buffer || !data.streamSize) return res.status(500).json({ error: "Could not get stream buffer" });
        const chunkSize = data.chunkSize / 4;
        const fileLimit = data.chunkSize;
        const CHUNK_SIZE = Math.min(chunkSize, fileLimit - start % fileLimit - 1);
        const end = Math.min(start + CHUNK_SIZE, data.streamSize - 1);
        const contentLength = end - start + 1;

        // i guess i dont need content type
        // const type = req.headers['sec-fetch-dest'] === 'audio' ? 'audio/mp3' : 'video/mp4';
        const headers = {
            "Content-Range": `bytes ${start}-${end}/${data.streamSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": contentLength,
            // "Content-Type": type,
            "Access-Control-Allow-Origin": "*"
        };
        res.writeHead(206, headers);

        const fend = end % fileLimit == 0 ? start % fileLimit + CHUNK_SIZE : end % fileLimit + 1;
        const sliced = data.buffer.slice(start % fileLimit, fend);

        var bufferStream = new stream.PassThrough();
        bufferStream.end(sliced);
        bufferStream.pipe(res)
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
    }
})

app.listen(process.env.PORT || 8000, function () {
    console.log("Listening on " + (process.env.PORT || 8000));
})