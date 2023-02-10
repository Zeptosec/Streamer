import axios from "axios";
import * as dotenv from 'dotenv';
dotenv.config();

// --------- CONFIG -------------
const maxStreamInfoSize = 20; // max amount of streamsInfo. This does not take much space so this can be fairly high.
const maxQueueSize = 6; // queue size this is expensive. one item in queue is 8MB. Be careful not to run out of memory.
// ------------------------------
const linkStart = process.env.LINKSTART;
const streamsInfo = new Map();
const chunkSize = 8 * 1024 ** 2 - 192;

async function getStreamInfo(id) {
    if (streamsInfo.has(id)) {
        return streamsInfo.get(id);
    } else {
        try {
            const res = await axios.get(`${linkStart}/${id}/blob`);
            if (!res.data.chunks || !res.data.size) return null;
            streamsInfo.set(id, res.data);
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

export async function getStreamBuffer(id, start) {
    const streamInfo = await getStreamInfo(id);
    if (streamInfo === null) return null;
    if (start < 0) return null;
    const index = Math.floor(start / chunkSize);
    if (index >= streamInfo.chunks.length) return null;

    AddToQueue(id, index, streamInfo);
    if (index + 1 < streamInfo.chunks.length) // buffer up more stream
        AddToQueue(id, index + 1, streamInfo);

    return {
        buffer: (await getFromQueue(id, index)).data,
        streamSize: streamInfo.size
    };
}

let Queue = [];
function AddToQueue(id, index, streamInfo) {
    const item = Queue.find(w => w.id === id && w.index === index);
    if (item) return;
    const controller = new AbortController();
    const buffer = axios.get(`${linkStart}/${streamInfo.chunks[index]}/blob`, {
        responseType: 'arraybuffer',
        signal: controller.signal
    }).catch(err => { console.log("canceled"); });
    Queue.unshift({ id, index, buffer, controller });
    if (Queue.length > maxQueueSize) {
        Queue.pop().controller.abort();
    }
}

async function getFromQueue(id, index) {
    const item = Queue.find(w => w.id === id && w.index === index);
    if (!item) return null;
    const buffer = await item.buffer;
    return buffer;
}