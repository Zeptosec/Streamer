import express from 'express';
import { getStreamBufferPart } from './manager.js';
import stream from 'stream';

const router = express.Router();

router.get("/:cid/:fid", async function (req, res) {
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
        const data = await getStreamBufferPart(fid, cid, start);

        if (!data) {
            console.log(`stream buffer not found!`)
            return res.status(500).send("Could not get stream buffer");
        }
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
        res.status(500).json(err.message);
    }
})

export default router;