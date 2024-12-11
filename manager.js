const axios = require("axios");
const z = require('zod');
require('dotenv').config()

// --------- CONFIG -------------
const maxStreamInfoSize = process.env.MAX_STREAM_INFO_SIZE ? parseInt(process.env.MAX_STREAM_INFO_SIZE) : 20; // max amount of streamsInfo. This does not take much space so this can be fairly high.
const maxQueueSize = process.env.MAX_QUEUE_SIZE ? parseInt(process.env.MAX_QUEUE_SIZE) : 6; // queue size this is expensive. one item in queue is HOLD_BUFFER_SIZE MB. Be careful not to run out of memory.
const buffSize = process.env.HOLD_BUFFER_SIZE ? parseInt(process.env.HOLD_BUFFER_SIZE) : 6.25 * 1024 ** 2;
const sendBufferSize = process.env.SEND_BUFFER_SIZE ? parseInt(process.env.SEND_BUFFER_SIZE) : 1.5625 * 1024 ** 2;
const linkStart = process.env.LINKSTART ? process.env.LINKSTART : "https://cdn.discordapp.com/attachments";
// ------------------------------
const streamsInfo = new Map();
const oldChunkSize = 8 * 1024 ** 2;
const USERAUTHTOKEN = process.env.USER_AUTH_TOKEN;

const infoSchema = z.object({
    name: z.string().max(120),
    size: z.number().positive(),
    chunks: z.string().min(18).max(21).array().min(1),
    channel_id: z.string().min(18).max(21),
    chunkSize: z.number().positive()
})

// let cachedLinks = new Map();
// function getCachedAndNew(links) {
//     let updatedLinks = [];
//     let linksToUpdate = [];
//     const now = new Date().getTime();
//     for (let i = 0; i < links.length; i++) {
//         const cachedLink = cachedLinks.get(l);
//         if (cachedLink === undefined || cachedLink.time + 22 * 3600 * 1000 < now) {
//             linksToUpdate.push({
//                 time: now,
//                 originalLink: l,
//                 index: i
//             });
//         } else {
//             updatedLinks[i] = cachedLink;
//         }
//     }
//     return {
//         updatedLinks,
//         linksToUpdate
//     }
// }


async function getUpdatedLinks(links) {
    // if (links.length > maxAmountOfUpdatedLinks) throw new Error("Too many links at once!");
    // const rez = getCachedAndNew(links);
    // if (rez.linksToUpdate.length === 0) {
    //     console.log(`All ${links.length} fetched from the cache!`)
    //     return rez.updatedLinks;
    // }

    const rs = await axios.post('https://discord.com/api/v9/attachments/refresh-urls', {
        "attachment_urls": links
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': USERAUTHTOKEN
        }
    })

    // for (let i = 0; i < rs.data.refreshed_urls.length; i++) {
    //     const refreshedUrl = rs.data.refreshed_urls[i].refreshed;
    //     rez.updatedLinks[rez.linksToUpdate[i].index] = refreshedUrl;
    //     cachedLinks.set(rez.linksToUpdate[i].originalLink, refreshedUrl);
    // }
    // console.log(`refreshed: ${rez.linksToUpdate.length} links`);
    return rs.data.refreshed_urls.map(w => w.refreshed);
}

async function getStreamInfo(fid, cid) {
    if (streamsInfo.has(fid)) {
        return streamsInfo.get(fid);
    } else {
        try {
            console.log(`trying to get file ${linkStart}/${cid}/${fid}/blob`);
            const updatedMainLink = await getUpdatedLinks([`${linkStart}/${cid}/${fid}/blob`]);
            const res = await axios.get(updatedMainLink[0]);
            if (!res.data.chunks || !res.data.size) return null;
            if (!res.data.chunkSize) res.data.chunkSize = oldChunkSize;
            if (!res.data.channel_id) res.data.channel_id = cid;
            let infoData = infoSchema.parse(res.data);
            infoData.type = getTypeFromName(res.data.name);
            console.log(infoData.chunkSize);
            // const updatedLinks = await getUpdatedLinks(infoData.chunks.map(w => `${linkStart}/${cid}/${w}/blob`));
            // assume that the order is correct
            // infoData.chunks = updatedLinks;
            infoData.chunks = infoData.chunks.map(w => ({ orig: w }));
            streamsInfo.set(fid, infoData);
            if (streamsInfo.size > maxStreamInfoSize) {
                streamsInfo.delete(streamsInfo.keys().next().value);
            }
            return infoData;
        } catch (err) {
            console.log(err);
            return null;
        }
    }
}

function getTypeFromName(name) {
    const parts = name.split('.');
    if (parts.length === 0) {
        return null;
    }
    const ext = parts[parts.length - 1].toLowerCase();
    console.log(ext);
    switch (ext) {
        case 'mp3':
        case 'wav':
            return 'audio/mpeg';
        case 'mp4':
            return 'video/mp4';
        case 'avi':
        case 'mkv':
            return 'video/webm';
        default:
            return null;
    }
}

async function getStreamBufferPart(fid, cid, start, bufferSize = sendBufferSize) {
    const packet = await getStreamBuffer(fid, cid, start);
    if (!packet || packet.buffer === null) return null;
    const offsetBytes = start - packet.start;
    const maxChunkSize = Math.min(packet.buffer.length - offsetBytes, bufferSize);
    const sliced = packet.buffer.slice(offsetBytes, offsetBytes + maxChunkSize);
    //console.log(`off: ${offsetBytes} | max: ${maxChunkSize} | slc: ${sliced.length}`);
    return {
        buffer: sliced,
        streamSize: packet.streamSize,
        length: sliced.length,
        type: packet.type,
        name: packet.name
    };
}

async function getStreamBuffer(fid, cid, start) {
    const streamInfo = await getStreamInfo(fid, cid);
    if (streamInfo === null || start < 0 || start > streamInfo.size) return null;
    // console.log(start);
    AddToQueue(fid, cid, streamInfo, start);
    if (start + buffSize < streamInfo.size) { // buffer up more stream
        AddToQueue(fid, cid, streamInfo, start + buffSize);
    }
    const item = await getFromQueue(fid, start);
    // console.log(item);
    if (!item) return null;
    return {
        buffer: item.buffer,
        start: item.start,
        streamSize: streamInfo.size,
        type: streamInfo.type ?? 'other',
        name: streamInfo.name
    };
}

async function getUrl(streamInfo, index) {
    const now = new Date().getTime();
    if (streamInfo.chunks[index].refreshed === undefined || streamInfo.chunks[index].time + 22 * 3600 * 1000 < now) {
        let linksToUpdate = [{
            ind: index,
            link: streamInfo.chunks[index].orig
        }];
        const now = new Date().getTime();
        for (let i = index + 1; i < Math.min(index + 35, streamInfo.chunks.length); i++) {
            const chunk = streamInfo.chunks[i];
            if (chunk.refreshed === undefined || chunk.time + 22 * 3600 * 1000 < now) {
                linksToUpdate.push({
                    ind: i,
                    link: streamInfo.chunks[i].orig
                })
            }
        }

        const refreshedLinks = await getUpdatedLinks(linksToUpdate.map(w => `${linkStart}/${streamInfo.channel_id}/${w.link}/blob`))
        for (let i = 0; i < linksToUpdate.length; i++) {
            const chunk = streamInfo.chunks[linksToUpdate[i].ind];
            chunk.refreshed = refreshedLinks[i];
            chunk.time = now;
        }
        console.log(`refreshed ${refreshedLinks.length} links`);
        return streamInfo.chunks[index].refreshed;
    } else {
        return streamInfo.chunks[index].refreshed;
    }
}

async function getDownloadBuffer(cid, streamInfo, start, controller) {
    let arr = []
    const markerAtChunk = start % streamInfo.chunkSize;
    const chunkIndex = Math.floor(start / streamInfo.chunkSize);
    const allowedBuffSize = Math.min(buffSize, streamInfo.size - start)
    let endByte = markerAtChunk + allowedBuffSize;
    let diff = 0;
    if (endByte > streamInfo.chunkSize) {
        diff = endByte - streamInfo.chunkSize;
        endByte -= diff;
    }

    // console.log(`${chunkIndex} | start: ${start}; max: ${streamInfo.size}; diff: ${diff}; abuff: ${allowedBuffSize}; ${markerAtChunk} - ${endByte}`)
    const chunkUrl1 = await getUrl(streamInfo, chunkIndex);
    arr.push(
        axios.get(chunkUrl1, {
            responseType: 'arraybuffer',
            signal: controller.signal,
            headers: {
                Range: `bytes=${markerAtChunk}-${endByte - 1}`
            }
        }).then(rs => rs.data).catch(err => { console.log("AXIOS ERROR 1", start, endByte, streamInfo.chunkSize, chunkIndex, err.stack, 1); return undefined; })
    )

    if (chunkIndex + 1 < streamInfo.chunks.length && diff > 0) {
        const chunkUrl2 = await getUrl(streamInfo, chunkIndex + 1);
        arr.push(
            axios.get(chunkUrl2, {
                responseType: 'arraybuffer',
                signal: controller.signal,
                headers: {
                    Range: `bytes=${0}-${diff - 1}`
                }
            }).then(rs => rs.data).catch(err => { console.log("AXIOS ERROR 2", err.stack, 2); return undefined; })
        )
    }
    const buffs = await Promise.all(arr);
    if (buffs.includes(undefined)) return null;
    return Buffer.concat(buffs);
}

let Queue = [];
function AddToQueue(fid, cid, streamInfo, start) {
    const item = Queue.find(w => w.fid === fid && w.start <= start && w.end - sendBufferSize > start);
    if (item) return;
    const controller = new AbortController();
    const buffer = getDownloadBuffer(cid, streamInfo, start, controller);
    Queue.unshift({ fid, buffer, controller, start, end: Math.min(streamInfo.size, start + buffSize) });
    if (Queue.length > maxQueueSize) {
        Queue.pop().controller.abort();
    }
}

async function getFromQueue(fid, start) {
    const item = Queue.find(w => w.fid === fid && w.start <= start && w.end > start);
    if (!item) return null;
    const buffer = await item.buffer;
    return { buffer, start: item.start };
}

function formatID(id) {
    const ind = id.lastIndexOf('.');
    let reg = /^\d+$/;
    if (ind !== -1) {
        const idPart = id.slice(0, ind);
        if (reg.test(idPart)) {
            return idPart;
        }
        return null;
    }
    if (reg.test(id)) {
        return id;
    }
    return null;
}

module.exports = {
    getStreamBuffer,
    getStreamBufferPart,
    sendBufferSize,
    formatID,
    getUpdatedLinks
}