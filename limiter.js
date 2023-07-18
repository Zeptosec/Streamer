const limit = 5 * 1024 ** 2;
let counts = {}

function getCount(ip) {
    // load counts
    if (!counts[ip]) {
        counts[ip] = {
            bandwidth: 0
        }
    }
    return counts[ip];
}

function ControlBandwidth(req, res, next) {
    const data = getCount(req.socket.remoteAddress);
    console.log(`${data.bandwidth} > ${limit}`);
    if (data.bandwidth > limit) {
        return res.status(509).json({ error: "Bandwidth limit exceeded" });
    }
    res.on('finish', () => {
        const contLen = res.getHeaders()['content-length'];
        if (contLen) {
            console.log(`conLen: ${Number(contLen)}`)
            data.bandwidth += Number(contLen);
        }
    })
    next();
}

module.exports = {
    ControlBandwidth
};