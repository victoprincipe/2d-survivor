import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const source = path.join(directory, 'spritesheet.png');
  const width = 384;
  const height = 512;
  const frames = [];
  for (let i = 0; i < 8; i++) {
    const frame = sharp(source).extract({
      left: (i % 4) * width, top: Math.floor(i / 4) * height, width, height,
    });
    await frame.clone().png().toFile(path.join(directory, `frame-${i}.png`));
    frames.push(await frame.ensureAlpha().raw().toBuffer());
  }
  const animations = {
    idle: { frames: [0, 1, 2, 1, 0, 3], durations: [500, 250, 400, 250, 450, 120] },
    challenge: { frames: [0, 4, 5, 6, 5, 6, 7, 0], durations: [650, 220, 200, 200, 200, 200, 300, 700] },
  };
  for (const [name, animation] of Object.entries(animations)) {
    // A solid backdrop makes the transparent sprites easy to inspect in GIF viewers.
    await sharp(Buffer.concat(animation.frames.map(i => frames[i])), {
      raw: { width, height: height * animation.frames.length, channels: 4, pageHeight: height },
    }).flatten({ background: '#18251e' }).gif({ loop: 0, delay: animation.durations })
      .toFile(path.join(directory, `${name}-preview.gif`));
  }
  await fs.writeFile(path.join(directory, 'animations.json'), JSON.stringify({
    image: '/sprites/boss-gorilla/spritesheet.png',
    frameWidth: width, frameHeight: height, columns: 4, rows: 2,
    animations,
  }, null, 2) + '\n');
  console.log('Created 8 transparent frames, two animated previews and animation metadata.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
