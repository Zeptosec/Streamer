const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { getUpdatedLinks } = require('./manager');

const router = express.Router();

function containsOnlyNumbers(str) {
    return /^\d+$/.test(str);
}

router.get('/:cid/:fid', async (req, res, next) => {
    const { cid, fid } = req.params;
    console.log(cid, fid);
    if (containsOnlyNumbers(cid) && containsOnlyNumbers(fid) && cid.length === 19 && fid.length === 19) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        const updatedLink = await getUpdatedLinks([`https://cdn.discordapp.com/attachments/${cid}/${fid}/blob`])
        const ind = updatedLink[0].indexOf('?');
        if (ind === -1) throw new Error("Failed to get link hmac");

        const rs = await fetch(`https://cdn.discordapp.com/attachments/${cid}/${fid}/blob?${updatedLink[0].slice(ind + 1)}`);
        if (rs.body) {
            return await rs.body.pipeTo(new WritableStream({
                write(chunk) {
                    res.write(chunk);
                },
                close() {
                    res.end();
                },
                abort() {
                    res.end();
                },
            }));
        } else {
            const text = await rs.text();
            console.log("error: ", text);
            return res.status(500).send("Missing response body!");
        }
    } else {
        return res.status(400).send("Bad parameters");
    }
})

module.exports = router;