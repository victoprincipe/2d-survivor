import { Camera } from '../engine/Camera';

const CAVE_WALLS = [
  [-150, -105, 150, -48],
  [-150, -48, -58, 12],
  [58, -48, 150, 12],
] as const;

/** Entrance beside Kopenawa's clearing; interact at the mouth to visit the interior. */
export class ForestCave {
  readonly x = -1950;
  readonly y = 1900;
  private readonly sprite: HTMLImageElement;

  constructor() {
    this.sprite = new Image();
    this.sprite.src = '/sprites/forest-cave/entrance.png';
  }

  collides(x: number, y: number, radius: number): boolean {
    const dx = x - this.x;
    const dy = y - this.y;
    // Circle/rectangle tests share the foot of the painted outcrop. Leave a
    // wide approach at the mouth, with a rear wall closing the decorative cave.
    return CAVE_WALLS.some(([left, top, right, bottom]) => {
      const nearestX = Math.max(left, Math.min(right, dx));
      const nearestY = Math.max(top, Math.min(bottom, dy));
      return (dx - nearestX) ** 2 + (dy - nearestY) ** 2 < radius ** 2;
    });
  }

  renderPath(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!camera.isInView(this.x, this.y, 400)) return;
    const p = camera.worldToScreen(this.x, this.y);
    ctx.save();
    ctx.lineCap = 'round';
    // A short dirt trail joins the sage's clearing to the cave threshold.
    ctx.strokeStyle = 'rgba(99, 75, 43, 0.35)';
    ctx.lineWidth = 62;
    ctx.beginPath();
    ctx.moveTo(p.x - 235, p.y + 34);
    ctx.bezierCurveTo(p.x - 150, p.y + 65, p.x - 50, p.y + 72, p.x, p.y + 20);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(153, 116, 67, 0.28)';
    ctx.lineWidth = 38;
    ctx.stroke();
    ctx.restore();
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!camera.isInView(this.x, this.y, 350)) return;
    const p = camera.worldToScreen(this.x, this.y);
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 12, 149, 37, 0, 0, Math.PI * 2);
    ctx.fill();
    if (this.sprite.complete && this.sprite.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.sprite, p.x - 175, p.y - 209, 350, 350 * this.sprite.naturalHeight / this.sprite.naturalWidth);
    } else {
      // Keep the solid landmark visible even when its image cannot load.
      ctx.fillStyle = '#62675b';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 78, 150, 105, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(p.x + 150, p.y + 12);
      ctx.lineTo(p.x - 150, p.y + 12);
      ctx.fill();
      ctx.fillStyle = '#101811';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 12, 58, 102, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4f6a31';
      ctx.fillRect(p.x - 118, p.y - 105, 52, 12);
      ctx.fillRect(p.x + 68, p.y - 70, 43, 13);
    }
    ctx.restore();
  }
}
