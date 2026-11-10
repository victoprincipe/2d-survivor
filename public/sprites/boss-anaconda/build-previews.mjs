import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await fs.readFile(path.join(directory, 'animations.json'), 'utf8'));
const source = path.join(directory, path.basename(config.image));
const metadata = await sharp(source).metadata();
const width = Math.floor(metadata.width / config.columns);
const height = Math.ceil(metadata.height / config.rows);
const padding = 16;
const pageWidth = width + padding * 2;
const pageHeight = height + padding * 2;
for (const [name, animation] of Object.entries(config.animations)) {
  const top = Math.floor(animation.row * metadata.height / config.rows);
  const bottom = Math.floor((animation.row + 1) * metadata.height / config.rows);
  const cells = [];
  for (let i = 0; i < config.columns; i++) {
    // Decode each cell as an independent padded PNG so scaling never samples neighbours.
    const frame = await sharp(source).extract({ left: i * width, top, width, height: bottom - top })
      .extend({ left: padding, right: padding, top: padding, bottom: padding + height - (bottom - top),
        background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer();
    cells.push(frame);
    await sharp(frame, { raw: { width: pageWidth, height: pageHeight, channels: 4 } })
      .png().toFile(path.join(directory, `${name}-${i}.png`));
  }
  await sharp(Buffer.concat(animation.frames.map(index => cells[index])), {
    raw: { width: pageWidth, height: pageHeight * animation.frames.length, channels: 4, pageHeight },
  }).flatten({ background: '#18251e' }).gif({ loop: 0, delay: animation.durations })
    .toFile(path.join(directory, `${name}-preview.gif`));
}
console.log('Created 12 individual transparent frames and idle, slither and bite GIF previews.');
