import animationData from '../../../public/sprites/boss-gorilla/animations.json';
import { Camera } from '../engine/Camera';

/** Decorative forest resident: never registered as an enemy or collision target. */
export class GorillaNpc {
  // Fixed at the centre of the northeastern plateau, reached by its dirt ramp.
  public readonly x = 2100;
  public readonly y = -1900;

  private readonly sprite: HTMLImageElement;
  private animationTime = 0;

  constructor() {
    this.sprite = new Image();
    this.sprite.src = animationData.image;
  }

  update(dt: number): void {
    this.animationTime += dt * 1000;
  }

  canInteract(player: { x: number; y: number }): boolean {
    return Math.hypot(player.x - this.x, player.y - this.y) <= 150;
  }

  renderPrompt(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const screen = camera.worldToScreen(this.x, this.y);
    ctx.save();
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(15, 23, 18, 0.92)';
    ctx.beginPath();
    ctx.roundRect(screen.x - 100, screen.y - 242, 200, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.fillText('[E] Conversar com o gorila', screen.x, screen.y - 220);
    ctx.restore();
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera, x = this.x, y = this.y, challenge = false, flashing = false): void {
    if (!this.sprite.complete || this.sprite.naturalWidth === 0) return;
    if (!camera.isInView(x, y, 240)) return;

    const idle = challenge ? animationData.animations.challenge : animationData.animations.idle;
    let time = this.animationTime % idle.durations.reduce((sum, duration) => sum + duration, 0);
    let frameIndex = 0;
    while (frameIndex < idle.durations.length - 1 && time >= idle.durations[frameIndex]) {
      time -= idle.durations[frameIndex];
      frameIndex++;
    }
    const frame = idle.frames[frameIndex];
    const { frameWidth, frameHeight, columns } = animationData;
    const screen = camera.worldToScreen(x, y);
    const scale = 0.46;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, 72, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = true;
    if (flashing) ctx.globalAlpha = 0.6;
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
