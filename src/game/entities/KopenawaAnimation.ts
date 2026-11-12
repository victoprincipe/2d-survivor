import metadata from '../../../public/sprites/kopenawa/animations.json';

export type KopenawaPose = 'idle' | 'walk' | 'cast' | 'channel' | 'slam';
const sheets = new Map<string, HTMLImageElement>();

/** Shared assets; each figure keeps only its own distance-based walk phase. */
export class KopenawaAnimation {
  private walkProgress = 0;
  private moving = false;

  constructor() {
    for (const animation of Object.values(metadata.animations)) {
      if (sheets.has(animation.image)) continue;
      const image = new Image();
      image.src = animation.image;
      sheets.set(animation.image, image);
    }
  }

  updateMovement(distance: number): void {
    this.moving = distance > 0.05;
    this.walkProgress = this.moving
      ? (this.walkProgress + distance / metadata.walkCycleDistance) % 1
      : 0;
  }

  get movementPose(): KopenawaPose { return this.moving ? 'walk' : 'idle'; }

  draw(ctx: CanvasRenderingContext2D, pose: KopenawaPose, progress = 0): boolean {
    if (pose === 'idle') return false;
    const animation = metadata.animations[pose];
    const image = sheets.get(animation.image);
    if (!image?.complete || image.naturalWidth === 0) return false;
    const phase = pose === 'walk' ? this.walkProgress : Math.max(0, Math.min(1, progress));
    const frame = animation.frames[Math.min(animation.frames.length - 1, Math.floor(phase * animation.frames.length))];
    const scale = animation.scale;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height,
      -frame.anchorX * scale, 4 - frame.anchorY * scale,
      frame.width * scale, frame.height * scale);
    return true;
  }
}

export const KOPENAWA_CHANNEL_CYCLE = metadata.channelCycleDuration;
