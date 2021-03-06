import Util from "./util";
import ByteArray from "./bytes";

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
    const c = new Uint8Array(a.length + b.length);
    c.set(a);
    c.set(b, a.length);
    return c;
}

function base64ToBytes(value: string): Uint8Array {
    const decoded = atob(value);
    const len = decoded.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; ++i) {
        arr[i] = decoded.charCodeAt(i);
    }
    return arr;
}

function str4ToBytes4(value: string): Uint8Array {
    const cc = new Uint8Array(4);
    cc[0] = value.charCodeAt(0);
    cc[1] = value.charCodeAt(1);
    cc[2] = value.charCodeAt(2);
    cc[3] = value.charCodeAt(3);
    return cc;
}

function bytes4ToStr4(bytes: Uint8Array): string {
    const cc =
        String.fromCharCode(bytes[0]) +
        String.fromCharCode(bytes[1]) +
        String.fromCharCode(bytes[2]) +
        String.fromCharCode(bytes[3]);
    return cc;
}

function int32ToBytes4(value: number): Uint8Array {
    let int32 = value;
    const arr = new Uint8Array([0, 0, 0, 0]);
    for (let idx = 0; idx < arr.length; idx++) {
        const byte = int32 & 0xff;
        arr[idx] = byte;
        int32 = (int32 - byte) / 256;
    }
    return arr.reverse();
}

function bytes4ToInt32(bytes: Uint8Array): number {
    const num = (bytes[0] << 24) + (bytes[1] << 12) + (bytes[2] << 8) + bytes[3];
    return num;
}

function int16ToBytes2(value: number): Uint8Array {
    let int16 = value;
    const arr = new Uint8Array([0, 0]);
    for (let idx = 0; idx < arr.length; idx++) {
        const byte = int16 & 0xff;
        arr[idx] = byte;
        int16 = (int16 - byte) / 256;
    }
    return arr.reverse();
}

class Chunk {
    idx: number;
    len: number;
    type: string;

    constructor(idx: number, len: number, type: string) {
        this.idx = idx;
        this.len = len;
        this.type = type;
    }
}

function findChunk(bytes: Uint8Array, type: string): Chunk | null {
    let offset = 8;
    let chunk = null;
    while (offset < bytes.length) {
        const chunk1 = bytes.slice(offset, offset + 4);
        const chunk2 = bytes.slice(offset + 4, offset + 8);
        const chunkLength = bytes4ToInt32(chunk1);
        const chunkType = bytes4ToStr4(chunk2);
        if (chunkType === type) {
            chunk = new Chunk(offset, chunkLength, chunkType);
            return chunk;
        }
        offset += 4 + 4 + chunkLength + 4;
    }
    return chunk;
}

function findChunkAll(bytes: Uint8Array, type: string): Chunk[] {
    let offset = 8;
    let chunk = null;
    const chunkArray = [];
    while (offset < bytes.length) {
        const chunk1 = bytes.slice(offset, offset + 4);
        const chunk2 = bytes.slice(offset + 4, offset + 8);
        const chunkLength = bytes4ToInt32(chunk1);
        const chunkType = bytes4ToStr4(chunk2);
        if (chunkType === type) {
            chunk = new Chunk(offset, chunkLength, chunkType);
            chunkArray.push(chunk);
        }
        offset += 4 + 4 + chunkLength + 4;
    }

    return chunkArray;
}

export class APNG {
    public repeat = 0;
    public delayNum = 2;
    public delayDen = 100;
    public dispose = 1;
    public blend = 1;
    data: ByteArray;
    encoding = false;
    private _canvas: HTMLCanvasElement;
    private _frames = -1;
    private _seq = -1;

    constructor(canvas: HTMLCanvasElement) {
        this._canvas = canvas;
    }

    start(): number {
        this.encoding = true;
        this.data = new ByteArray();
        this._frames = -1;
        this._seq = -1;
        return 0;
    }

    addFrame(): number {
        if (this._canvas === null || !this.encoding || this.data === null) {
            throw new Error();
        }
        this._frames += 1;
        const png = this._canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
        const bytes = base64ToBytes(png);
        let chunk: Chunk;

        if (this._frames == 0) {
            const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
            this.data.writeBytes(signature);

            let chunk = findChunk(bytes, "IHDR");
            if (chunk == null) {
                throw new Error();
            }
            const slice = bytes.slice(chunk.idx, chunk.idx + 12 + chunk.len);
            this.data.writeBytes(slice);

            let acTL = new Uint8Array(0);
            acTL = concat(acTL, new Uint8Array([0, 0, 0, 8]));
            acTL = concat(acTL, str4ToBytes4("acTL"));
            acTL = concat(acTL, new Uint8Array([0, 0, 0, 1]));
            acTL = concat(acTL, int32ToBytes4(this.repeat));
            const crc = Util.CRC32(acTL.slice(4, 4 + 4 + 8));
            acTL = concat(acTL, int32ToBytes4(crc));

            this.data.writeBytes(acTL);

            const chunks = findChunkAll(bytes, "IDAT");
            for (let i = 0; i < chunks.length; i++) {
                if (i == 0) {
                    this._seq += 1;
                    let fcTL = new Uint8Array(0);
                    fcTL = concat(fcTL, int32ToBytes4(26));
                    fcTL = concat(fcTL, str4ToBytes4("fcTL"));
                    fcTL = concat(fcTL, int32ToBytes4(this._seq));
                    fcTL = concat(fcTL, int32ToBytes4(this._canvas.width));
                    fcTL = concat(fcTL, int32ToBytes4(this._canvas.height));
                    fcTL = concat(fcTL, int32ToBytes4(0));
                    fcTL = concat(fcTL, int32ToBytes4(0));
                    fcTL = concat(fcTL, int16ToBytes2(this.delayNum));
                    fcTL = concat(fcTL, int16ToBytes2(this.delayDen));
                    fcTL = concat(fcTL, new Uint8Array([this.dispose]));
                    fcTL = concat(fcTL, new Uint8Array([this.blend]));

                    const crc = Util.CRC32(fcTL.slice(4, 4 + 4 + 26));
                    fcTL = concat(fcTL, int32ToBytes4(crc));
                    this.data.writeBytes(fcTL);
                }

                chunk = chunks[i]; // copy complete IDAT chunk
                const slice = bytes.slice(chunk.idx, chunk.idx + 12 + chunk.len);
                this.data.writeBytes(slice);
            } // for
        } // first frame

        if (this._frames > 0) {
            const chunks = findChunkAll(bytes, "IDAT");
            for (let i = 0; i < chunks.length; i++) {
                if (i == 0) {
                    this._seq += 1;
                    let fcTL = new Uint8Array(0);
                    fcTL = concat(fcTL, int32ToBytes4(26));
                    fcTL = concat(fcTL, str4ToBytes4("fcTL"));
                    fcTL = concat(fcTL, int32ToBytes4(this._seq));
                    fcTL = concat(fcTL, int32ToBytes4(this._canvas.width));
                    fcTL = concat(fcTL, int32ToBytes4(this._canvas.height));
                    fcTL = concat(fcTL, int32ToBytes4(0));
                    fcTL = concat(fcTL, int32ToBytes4(0));
                    fcTL = concat(fcTL, int16ToBytes2(this.delayNum));
                    fcTL = concat(fcTL, int16ToBytes2(this.delayDen));
                    fcTL = concat(fcTL, new Uint8Array([this.dispose]));
                    fcTL = concat(fcTL, new Uint8Array([this.blend]));

                    const crc = Util.CRC32(fcTL.slice(4, 4 + 4 + 26));
                    fcTL = concat(fcTL, int32ToBytes4(crc));
                    this.data.writeBytes(fcTL);
                }

                chunk = chunks[i];
                const chunkIdatData = bytes.slice(chunk.idx + 8, chunk.idx + 8 + chunk.len);
                const lenFdat = chunk.len + 4;

                this._seq += 1;
                let fdAT = new Uint8Array(0);
                fdAT = concat(fdAT, int32ToBytes4(lenFdat));
                fdAT = concat(fdAT, str4ToBytes4("fdAT"));
                fdAT = concat(fdAT, int32ToBytes4(this._seq));
                fdAT = concat(fdAT, chunkIdatData);
                const crc = Util.CRC32(fdAT.slice(4, 4 + 4 + lenFdat));
                fdAT = concat(fdAT, int32ToBytes4(crc));

                this.data.writeBytes(fdAT);
            }
        }

        return 0;
    }

    finish(): Uint8Array {
        if (!this.encoding) {
            throw new Error();
        }
        const suffix = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
        this.data.writeBytes(suffix);
        const output = this.data.getData();

        const chunk = findChunk(output, "acTL");
        if (chunk == null) {
            throw new Error();
        }
        const frames = int32ToBytes4(this._frames + 1);
        output[chunk.idx + 8] = frames[0];
        output[chunk.idx + 8 + 1] = frames[1];
        output[chunk.idx + 8 + 2] = frames[2];
        output[chunk.idx + 8 + 3] = frames[3];

        const actl = output.slice(chunk.idx + 4, chunk.idx + 4 + 4 + 8);
        const crc = Util.CRC32(actl);
        const bytes = int32ToBytes4(crc);
        output[chunk.idx + 4 + 4 + 8] = bytes[0];
        output[chunk.idx + 4 + 4 + 8 + 1] = bytes[1];
        output[chunk.idx + 4 + 4 + 8 + 2] = bytes[2];
        output[chunk.idx + 4 + 4 + 8 + 3] = bytes[3];

        this.encoding = false;
        return output;
    }
}
