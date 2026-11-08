import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await fs.readFile(path.join(directory, 'combat-animations.json'), 'utf8'));
const source = path.join(directory, path.basename(config.image));
for (const [name, delay] of [['walk', 210], ['run', 85], ['slam', [210, 210, 210, 220, 200, 200]]]) {
  const row = config[name];
  const frames = [];
  for (let i = 0; i < config.frameCount; i++) {
    const top = 400 - row.baseline;
    frames.push(await sharp(source).extract({ left: i * config.frameWidth, top: row.sourceY,
      width: config.frameWidth, height: row.height })
      .extend({ top, bottom: 500 - row.height - top, left: 0, right: 0,
        background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha().raw().toBuffer());
  }
  await sharp(Buffer.concat(frames), { raw: { width: config.frameWidth,
    height: 500 * frames.length, channels: 4, pageHeight: 500 } })
    .flatten({ background: '#18251e' }).gif({ loop: 0, delay })
    .toFile(path.join(directory, `${name}-preview.gif`));
}
console.log('Created walk, run and ground-slam previews (6 frames each).');
