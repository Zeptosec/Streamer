const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const router = express.Router();

function containsOnlyNumbers(str) {
    return /^\d+$/.test(str);
}

const dwnp = createProxyMiddleware({
    changeOrigin: true,
    ws: false,
    target: 'https://cdn.discordapp.com/attachments/',
    pathRewrite: (path, req) => {
        const { cid, fid } = req.params;
        return `${cid}/${fid}/blob`;
    },
    logger: console,
})
router.get('/:cid/:fid', (req, res, next) => {
    const { cid, fid } = req.params;
    if (containsOnlyNumbers(cid) && containsOnlyNumbers(fid) && cid.length === 19 && fid.length === 19) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
    } else {
        return res.status(400).send("Bad parameters");
    }
}, dwnp)

module.exports = router;