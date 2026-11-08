import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Sprite packing only: retain the generated artwork, including limbs that
// crossed the nominal grid, but never copy pieces of a neighbouring pose.
const directory = path.dirname(fileURLToPath(import.meta.url));
const { data, info } = await sharp(path.join(directory, 'combat-spritesheet.png'))
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const labels = new Int32Array(info.width * info.height);
const components = [];
let label = 0;
for (let start = 0; start < labels.length; start++) {
  if (labels[start] || data[start * 4 + 3] < 32) continue;
  const pixels = [start];
  labels[start] = ++label;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i];
    const x = p % info.width;
    const y = Math.floor(p / info.width);
    sumX += x;
    sumY += y;
    for (const next of [x > 0 ? p - 1 : -1, x < info.width - 1 ? p + 1 : -1,
      y > 0 ? p - info.width : -1, y < info.height - 1 ? p + info.width : -1]) {
      if (next >= 0 && !labels[next] && data[next * 4 + 3] >= 32) {
        labels[next] = label;
        pixels.push(next);
      }
    }
  }
  if (pixels.length > 10000) components.push({ pixels, x: sumX / pixels.length, y: sumY / pixels.length });
}
if (components.length !== 18) throw new Error(`Expected 18 poses, found ${components.length}`);

const width = 320;
const height = 406;
const atlasWidth = width * 6;
const atlasHeight = height * 3;
const atlas = Buffer.alloc(atlasWidth * atlasHeight * 4);
const occupied = new Set();
for (const component of components) {
  const col = Math.floor(component.x / 256);
  const row = Math.floor(component.y / (info.height / 3));
  const cell = row * 6 + col;
  if (occupied.has(cell)) throw new Error(`Duplicate pose in cell ${cell}`);
  occupied.add(cell);
  // Include a two-pixel fringe to preserve the original antialiased silhouette.
  const mask = new Set(component.pixels);
  for (const p of component.pixels) {
    const x = p % info.width;
    const y = Math.floor(p / info.width);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (x + dx >= 0 && x + dx < info.width && y + dy >= 0 && y + dy < info.height) {
        mask.add((y + dy) * info.width + x + dx);
      }
    }
  }
  const sourceTop = Math.floor(row * info.height / 3);
  for (const p of mask) {
    const x = p % info.width - col * 256 + 32;
    const y = Math.floor(p / info.width) - sourceTop + 32;
    if (x < 2 || x >= width - 2 || y < 2 || y >= height - 2) {
      throw new Error(`Insufficient transparent padding for pose ${cell}`);
    }
    const destination = ((row * height + y) * atlasWidth + col * width + x) * 4;
    data.copy(atlas, destination, p * 4, p * 4 + 4);
  }
}
await sharp(atlas, { raw: { width: atlasWidth, height: atlasHeight, channels: 4 } })
  .png().toFile(path.join(directory, 'combat-atlas.png'));
console.log('Packed 18 isolated poses with transparent padding; complete limbs preserved.');
