// A real PNG map for the Locations checks — written on demand so a check is
// self-contained (the container restarts, /tmp does not survive).
//
// Size matters: pointer/drag coordinates are INTEGERS, so a tiny fixture
// can't express a fractional position on the map.
import { writeFileSync, existsSync } from 'fs';
import { deflateSync } from 'zlib';

const crcTable = [...Array(256)].map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = 0xffffffff;
  for (const b of body) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, crcBuf]);
};

/** Write a gradient PNG and return its path. */
export function writeMapFixture(path = '/tmp/scriptcraft-map-fixture.png', W = 800, H = 600) {
  if (existsSync(path)) return path;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 4 + 1);
    for (let x = 0; x < W; x++) {
      const i = row + 1 + x * 4;
      raw[i] = 40 + ((x / W) * 120) | 0;
      raw[i + 1] = 60 + ((y / H) * 90) | 0;
      raw[i + 2] = 90;
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]));
  return path;
}
