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

  private renderSubmergedSprite(ctx: CanvasRenderingContext2D, image: HTMLImageElement,
    x: number, y: number, width: number, height: number, waterY: number): void {
    // The lake surface cuts through the middle of the coils. Keep a faint
    // underwater silhouette without moving the head or its collision position.
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, Math.max(0, waterY - y)); ctx.clip();
    ctx.drawImage(image, x, y, width, height); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(x, waterY, width, Math.max(0, y + height - waterY)); ctx.clip();
    ctx.globalAlpha *= 0.12; ctx.drawImage(image, x, y, width, height); ctx.restore();
  }

  private renderWaterline(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save(); ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const wave = (this.time * 0.45 + i / 3) % 1;
      ctx.strokeStyle = `rgba(165,243,252,${(1 - wave) * 0.5})`;
      ctx.beginPath(); ctx.ellipse(x, y, 115 + wave * 30, 12 + wave * 10, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera, x: number, y: number,
    mode: 'idle' | 'slither' | 'bite' = 'idle', height = 0, flash = false): void {
    if (!camera.isInView(x, y, 300 + height)) return;
    const frame = mode === 'idle' ? Math.floor(this.time * 2.5) % 4 : Math.floor(this.time * 6) % 4;
    const image = this.frames[mode][frame];
    if (!image.complete || !image.naturalWidth) return;
    const p = camera.worldToScreen(x, y);
    ctx.save(); ctx.imageSmoothingEnabled = true;
    if (flash) ctx.globalAlpha *= 0.65;
    this.renderSubmergedSprite(ctx, image, p.x - 150, p.y - 190 - height, 300, 270, p.y - 10);
    this.renderWaterline(ctx, p.x, p.y - 10);
    ctx.restore();
  }

  renderRig(ctx: CanvasRenderingContext2D, camera: Camera, x: number, y: number,
    head: { x: number; y: number }, open: boolean | number, flash: boolean): void {
    const body = camera.worldToScreen(x, y);
    const tip = camera.worldToScreen(head.x, head.y);
    const base = { x: body.x, y: body.y - 40 };
    ctx.save(); ctx.imageSmoothingEnabled = true;
    if (flash) ctx.globalAlpha *= 0.65;
    if (this.body.complete && this.body.naturalWidth) this.renderSubmergedSprite(ctx, this.body, body.x - 135, body.y - 95, 270, 170, body.y - 10);
    this.renderWaterline(ctx, body.x, body.y - 10);
    // End at the rear of the skull, not its centre. The final tangent matches
    // the head exactly; a cubic curve avoids the old hinge at the jaw.
    const angle = Math.atan2(tip.y - base.y, tip.x - base.x);
    const distance = Math.hypot(tip.x - base.x, tip.y - base.y);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const end = { x: tip.x - dx * 36, y: tip.y - dy * 36 };
    const length = Math.max(1, distance - 36), handle = Math.min(85, length * 0.32);
    const c1 = { x: base.x + dx * handle, y: base.y + dy * handle - Math.min(35, length * 0.12) };
    const c2 = { x: end.x - dx * handle, y: end.y - dy * handle };
    const point = (t: number) => {
      const u = 1 - t;
      return { x: u ** 3 * base.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * end.x,
        y: u ** 3 * base.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * end.y };
    };
    const steps = Math.max(16, Math.ceil(length / 6));
    const samples = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps, u = 1 - t, p = point(t);
      const tx = 3 * u * u * (c1.x - base.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (end.x - c2.x);
      const ty = 3 * u * u * (c1.y - base.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (end.y - c2.y);
      const norm = Math.hypot(tx, ty) || 1, radius = 23 - 6 * t;
      return { ...p, nx: -ty / norm * radius, ny: tx / norm * radius };
    });
    ctx.beginPath();
    samples.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x + p.nx, p.y + p.ny); else ctx.lineTo(p.x + p.nx, p.y + p.ny); });
    for (let i = samples.length - 1; i >= 0; i--) { const p = samples[i]; ctx.lineTo(p.x - p.nx, p.y - p.ny); }
    ctx.closePath(); ctx.fillStyle = '#70723b'; ctx.strokeStyle = '#252517'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip();
    // Fine overlapping slices share a single silhouette and a single facing:
    // individual slices must never flip as their tangent passes the vertical.
    const flip = dx < 0 ? -1 : 1;
    if (this.neck.complete && this.neck.naturalWidth) {
      for (let i = 0; i < steps; i++) {
        const start = samples[i], end = samples[i + 1];
        const width = (this.neck.naturalWidth - 8) / steps;
        ctx.save(); ctx.translate((start.x + end.x) / 2, (start.y + end.y) / 2);
        const segmentAngle = Math.atan2(end.y - start.y, end.x - start.x);
        ctx.rotate(segmentAngle);
        ctx.scale(1, flip);
        const segmentLength = Math.hypot(end.x - start.x, end.y - start.y) + 4;
        ctx.drawImage(this.neck, 4 + i * width, 0, width, this.neck.naturalHeight, -segmentLength / 2, -25, segmentLength, 50);
        ctx.restore();
      }
    }
    ctx.restore();
    ctx.translate(tip.x, tip.y); ctx.rotate(angle); ctx.scale(1, flip);
    const mouth = typeof open === 'boolean' ? Number(open) : Math.max(0, Math.min(1, open));
    for (const [image, opacity] of [[this.closedHead, 1 - mouth], [this.openHead, mouth]] as const) {
      if (!image.complete || !image.naturalWidth || opacity <= 0) continue;
      ctx.save(); ctx.globalAlpha *= opacity;
      // Both files share skull scale; retain aspect ratio when opening the jaw.
      ctx.drawImage(image, -52, -38, 104, image.naturalHeight * 104 / image.naturalWidth);
      ctx.restore();
    }
    ctx.restore();
  }
}
