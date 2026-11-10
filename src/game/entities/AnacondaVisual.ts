import { Camera } from '../engine/Camera';

export class AnacondaVisual {
  private readonly frames: Record<string, HTMLImageElement[]> = {};
  private readonly body = this.load('body.png');
  private readonly neck = this.load('neck.png');
  private readonly openHead = this.load('head-open.png');
  private readonly closedHead = this.load('head-closed.png');
  private time = 0;

  constructor() {
    for (const name of ['idle', 'slither', 'bite']) this.frames[name] = Array.from({ length: 4 }, (_, i) => this.load(`${name}-${i}.png`));
  }
  private load(file: string): HTMLImageElement { const image = new Image(); image.src = `/sprites/boss-anaconda/${file}`; return image; }
  update(dt: number): void { this.time += dt; }

  render(ctx: CanvasRenderingContext2D, camera: Camera, x: number, y: number,
    mode: 'idle' | 'slither' | 'bite' = 'idle', height = 0, flash = false): void {
    if (!camera.isInView(x, y, 300 + height)) return;
    const frame = mode === 'idle' ? Math.floor(this.time * 2.5) % 4 : Math.floor(this.time * 6) % 4;
    const image = this.frames[mode][frame];
    if (!image.complete || !image.naturalWidth) return;
    const p = camera.worldToScreen(x, y);
    ctx.save(); ctx.imageSmoothingEnabled = true;
    if (flash) ctx.globalAlpha = 0.65;
    ctx.drawImage(image, p.x - 150, p.y - 190 - height, 300, 270);
    ctx.restore();
  }

  renderRig(ctx: CanvasRenderingContext2D, camera: Camera, x: number, y: number,
    head: { x: number; y: number }, open: boolean, flash: boolean): void {
    const body = camera.worldToScreen(x, y);
    const tip = camera.worldToScreen(head.x, head.y);
    const base = { x: body.x, y: body.y - 40 };
    ctx.save(); ctx.imageSmoothingEnabled = true;
    if (flash) ctx.globalAlpha = 0.65;
    if (this.body.complete && this.body.naturalWidth) ctx.drawImage(this.body, body.x - 135, body.y - 95, 270, 170);
    // A textured articulated neck joins the unchanged coil layer to the moving head.
    const angle = Math.atan2(tip.y - base.y, tip.x - base.x);
    const distance = Math.hypot(tip.x - base.x, tip.y - base.y);
    const bend = Math.min(75, distance * 0.2);
    const control = { x: (base.x + tip.x) / 2 + Math.sin(angle) * bend,
      y: (base.y + tip.y) / 2 - Math.cos(angle) * bend };
    ctx.lineCap = 'round';
    for (const [color, width] of [['#252517', 47], ['#70723b', 41], ['#b4a45a', 25]] as const) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(base.x, base.y);
      ctx.quadraticCurveTo(control.x, control.y, tip.x, tip.y); ctx.stroke();
    }
    const steps = Math.max(2, Math.ceil(distance / 25));
    const point = (t: number) => ({
      x: (1 - t) ** 2 * base.x + 2 * (1 - t) * t * control.x + t * t * tip.x,
      y: (1 - t) ** 2 * base.y + 2 * (1 - t) * t * control.y + t * t * tip.y,
    });
    if (this.neck.complete && this.neck.naturalWidth) {
      for (let i = 0; i < steps; i++) {
        const start = point(i / steps), end = point((i + 1) / steps);
        const width = (this.neck.naturalWidth - 8) / steps;
        ctx.save(); ctx.translate((start.x + end.x) / 2, (start.y + end.y) / 2);
        ctx.rotate(Math.atan2(end.y - start.y, end.x - start.x));
        const length = Math.hypot(end.x - start.x, end.y - start.y) + 3;
        ctx.drawImage(this.neck, 4 + i * width, 0, width, this.neck.naturalHeight, -length / 2, -22, length, 44);
        ctx.restore();
      }
    }
    const image = open ? this.openHead : this.closedHead;
    if (image.complete && image.naturalWidth) {
      ctx.translate(tip.x, tip.y); ctx.rotate(angle);
      ctx.drawImage(image, -52, -38, 104, 76);
    }
    ctx.restore();
  }
}
