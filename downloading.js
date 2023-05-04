import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

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
    }
})
router.get('/:cid/:fid', (req, res, next) => {
    const { cid, fid } = req.params;
    if (containsOnlyNumbers(cid) && containsOnlyNumbers(fid) && cid.length === 19 && fid.length === 19) {
        next();
    } else {
        return res.status(400).send("Bad parameters");
    }
}, dwnp)

export default router;