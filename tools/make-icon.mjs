#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const SIZE = 512;
const SAMPLES = 4;
const OUTPUT = fileURLToPath(new URL('../plugins/project-setup-kit/.claude-plugin/icon.png', import.meta.url));

const TOP = [30, 27, 75];
const BOTTOM = [67, 56, 202];
const WHITE = [255, 255, 255];
const MINT = [110, 231, 183];

function roundedRectDistance(x, y, left, top, right, bottom, radius) {
  const cx = Math.max(left + radius, Math.min(x, right - radius));
  const cy = Math.max(top + radius, Math.min(y, bottom - radius));
  const inside = x >= left && x <= right && y >= top && y <= bottom;
  const distance = Math.hypot(x - cx, y - cy) - radius;
  return inside && distance < 0 ? distance : Math.max(distance, inside ? -0.0001 : 0.0001);
}

function segmentDistance(x, y, ax, ay, bx, by) {
  const length = (bx - ax) ** 2 + (by - ay) ** 2;
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length));
  return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
}

const ROWS = [150, 256, 362];

function shade(x, y) {
  if (roundedRectDistance(x, y, 0, 0, SIZE, SIZE, 112) > 0) return null;
  const t = y / SIZE;
  let color = TOP.map((value, index) => value + (BOTTOM[index] - value) * t);
  for (const rowY of ROWS) {
    const box = roundedRectDistance(x, y, 104, rowY - 38, 180, rowY + 38, 18);
    const boxRing = Math.abs(box + 6) < 6;
    const check =
      Math.min(segmentDistance(x, y, 122, rowY, 138, rowY + 16), segmentDistance(x, y, 138, rowY + 16, 164, rowY - 16)) < 7;
    const bar = roundedRectDistance(x, y, 214, rowY - 14, rowY === 256 ? 352 : 408, rowY + 14, 14) <= 0;
    if (check) color = MINT;
    else if (boxRing || bar) color = WHITE;
  }
  return color;
}

function render() {
  const rows = [];
  for (let y = 0; y < SIZE; y += 1) {
    const row = Buffer.alloc(1 + SIZE * 4);
    for (let x = 0; x < SIZE; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const color = shade(x + (sx + 0.5) / SAMPLES, y + (sy + 0.5) / SAMPLES);
          if (!color) continue;
          red += color[0];
          green += color[1];
          blue += color[2];
          alpha += 1;
        }
      }
      const offset = 1 + x * 4;
      if (alpha > 0) {
        row[offset] = Math.round(red / alpha);
        row[offset + 1] = Math.round(green / alpha);
        row[offset + 2] = Math.round(blue / alpha);
      }
      row[offset + 3] = Math.round((alpha / (SAMPLES * SAMPLES)) * 255);
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8;
header[9] = 6;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(render(), { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(OUTPUT, png);
process.stdout.write(`Wrote ${OUTPUT} (${png.length} bytes)\n`);
