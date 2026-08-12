import fs from "fs";
import path from "path";
import zlib from "zlib";

// Pure JavaScript PNG generator without external dependencies
function createPngBuffer(width, height, r = 6, g = 182, b = 212) {
  // CRC32 calculation helper
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function writeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, "ascii");
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // 1. Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // 2. IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(2, 9); // color type 2 (RGB)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdrChunk = writeChunk("IHDR", ihdrData);

  // 3. IDAT Chunk (RGB uncompressed filter 0 scanlines)
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + 1 + x * 3;
      rawData[idx] = r;
      rawData[idx + 1] = g;
      rawData[idx + 2] = b;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = writeChunk("IDAT", compressedData);

  // 4. IEND Chunk
  const iendChunk = writeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = "c:/Users/maddi/OneDrive/Documents/chatly/client/public";

const png192 = createPngBuffer(192, 192, 6, 182, 212);
const png512 = createPngBuffer(512, 512, 6, 182, 212);

fs.writeFileSync(path.join(publicDir, "icon-192.png"), png192);
fs.writeFileSync(path.join(publicDir, "icon-512.png"), png512);

console.log("Valid binary PNG icons generated successfully:", png192.length, png512.length);
