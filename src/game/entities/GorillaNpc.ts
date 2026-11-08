import animationData from '../../../public/sprites/boss-gorilla/animations.json';
import { Camera } from '../engine/Camera';

/** Decorative forest resident: never registered as an enemy or collision target. */
export class GorillaNpc {
  // Fixed at the centre of the northeastern plateau, reached by its dirt ramp.
  public readonly x = 2100;
  public readonly y = -1900;

  private readonly sprite: HTMLImageElement;
  private animationTime = 0;
  private readonly cycleDuration = animationData.animations.idle.durations.reduce(
    (total, duration) => total + duration, 0
  );

  constructor() {
    this.sprite = new Image();
    this.sprite.src = animationData.image;
  }

  update(dt: number): void {
    this.animationTime = (this.animationTime + dt * 1000) % this.cycleDuration;
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!this.sprite.complete || this.sprite.naturalWidth === 0) return;
    if (!camera.isInView(this.x, this.y, 240)) return;

    const idle = animationData.animations.idle;
    let time = this.animationTime;
    let frameIndex = 0;
    while (frameIndex < idle.durations.length - 1 && time >= idle.durations[frameIndex]) {
      time -= idle.durations[frameIndex];
      frameIndex++;
    }
    const frame = idle.frames[frameIndex];
    const { frameWidth, frameHeight, columns } = animationData;
    const screen = camera.worldToScreen(this.x, this.y);
    const scale = 0.46;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, 72, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.sprite,
      (frame % columns) * frameWidth,
      Math.floor(frame / columns) * frameHeight,
      frameWidth,
      frameHeight,
      screen.x - frameWidth * scale / 2,
      screen.y - 445 * scale, // Knuckles/feet baseline within the generated cells.
      frameWidth * scale,
      frameHeight * scale
    );
    ctx.restore();
  }
}
