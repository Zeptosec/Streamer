import axios from "axios";
import * as dotenv from 'dotenv';
dotenv.config();

// --------- CONFIG -------------
const maxStreamInfoSize = 20; // max amount of streamsInfo. This does not take much space so this can be fairly high.
const maxQueueSize = 6; // queue size this is expensive. one item in queue is 8MB. Be careful not to run out of memory.
// ------------------------------
const linkStart = process.env.LINKSTART;
const streamsInfo = new Map();
const oldChunkSize = 8 * 1024 ** 2;

async function getStreamInfo(fid, cid) {
    if (streamsInfo.has(fid)) {
        return streamsInfo.get(fid);
    } else {
        try {
            const res = await axios.get(`${linkStart}/${cid}/${fid}/blob`);
            if (!res.data.chunks || !res.data.size) return null;
            streamsInfo.set(fid, res.data);
            if (streamsInfo.size > maxStreamInfoSize) {
                streamsInfo.delete(streamsInfo.keys().next().value);
            }
            return res.data;
        } catch (err) {
            console.log(err);
            return null;
        }
    }
}

export async function getStreamBuffer(fid, cid, start) {
    const streamInfo = await getStreamInfo(fid, cid);
    let chunkSize = streamInfo.chunkSize ? streamInfo.chunkSize : oldChunkSize;
    if (streamInfo === null) return null;
    if (start < 0) return null;
    const index = Math.floor(start / chunkSize);
    if (index >= streamInfo.chunks.length) return null;
    AddToQueue(fid, cid, index, streamInfo);
    if (index + 1 < streamInfo.chunks.length) // buffer up more stream
        AddToQueue(fid, cid, index + 1, streamInfo);
    const item = await getFromQueue(fid, index);
    if(item === undefined) return null;
    return {
        buffer: item.data,
        streamSize: streamInfo.size,
        chunkSize
    };
}

let Queue = [];
function AddToQueue(fid, cid, index, streamInfo) {
    const item = Queue.find(w => w.id === fid && w.index === index);
    if (item) return;
    const controller = new AbortController();
    const buffer = axios.get(`${linkStart}/${cid}/${streamInfo.chunks[index]}/blob`, {
        responseType: 'arraybuffer',
        signal: controller.signal
    }).catch(err => { console.log("canceled"); });
    Queue.unshift({ fid, index, buffer, controller });
    if (Queue.length > maxQueueSize) {
        Queue.pop().controller.abort();
    }
}

async function getFromQueue(id, index) {
    const item = Queue.find(w => w.fid === id && w.index === index);
    if (!item) return null;
    const buffer = await item.buffer;
    return buffer;
}