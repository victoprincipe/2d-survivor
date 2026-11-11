import { Camera } from '../engine/Camera';

/** Kopenawa waits at the cave clearing until the hero steps into his line of sight. */
export class KopenawaNpc {
  public readonly x = -2200;
  public readonly y = 1900;
  private time = 0;
  private readonly sprite: HTMLImageElement;

  constructor() {
    this.sprite = new Image();
    this.sprite.src = '/sprites/quiz-keeper/idle.png';
  }

  update(dt: number): void { this.time += dt; }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!this.sprite.complete || this.sprite.naturalWidth === 0) {
      this.renderFallback(ctx, camera);
      return;
    }
    if (!camera.isInView(this.x, this.y, 130)) return;
    const screen = camera.worldToScreen(this.x, this.y);
    const breath = Math.sin(this.time * 2) * 0.006;
    const height = 108 * (1 + breath);
    const width = height * this.sprite.naturalWidth / this.sprite.naturalHeight;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + 4, 24, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.sprite, screen.x - width * 0.44, screen.y + 4 - height * 0.97, width, height);
    ctx.restore();
  }

  private renderFallback(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!camera.isInView(this.x, this.y, 130)) return;
    const screen = camera.worldToScreen(this.x, this.y);
    const breath = Math.sin(this.time * 2) * 1.3;
    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 4, 24, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#70492d'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(28, 4); ctx.lineTo(31, -76); ctx.lineTo(23, -84); ctx.stroke();
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(19, -80, 7, 10);
    ctx.translate(0, breath);
    ctx.fillStyle = '#3f493b';
    ctx.beginPath(); ctx.moveTo(-15, -48); ctx.lineTo(-29, -24); ctx.lineTo(-17, -19);
    ctx.lineTo(-22, 3); ctx.lineTo(-10, 0); ctx.lineTo(-3, 5); ctx.lineTo(5, 1);
    ctx.lineTo(18, 4); ctx.lineTo(15, -24); ctx.lineTo(29, -29); ctx.lineTo(18, -47); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a38b5b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-15, -22); ctx.lineTo(14, -22); ctx.stroke();
    ctx.fillStyle = '#b8b4a3';
    ctx.beginPath(); ctx.ellipse(0, -59, 20, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bb906d';
    ctx.beginPath(); ctx.ellipse(0, -59, 12, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dad5c2';
    ctx.beginPath(); ctx.moveTo(-13, -56); ctx.lineTo(-14, -35); ctx.lineTo(-5, -16);
    ctx.lineTo(1, -24); ctx.lineTo(7, -18); ctx.lineTo(15, -40); ctx.lineTo(12, -56); ctx.lineTo(0, -48); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#292524'; ctx.fillRect(-8, -62, 4, 3); ctx.fillRect(4, -62, 4, 3);
    ctx.strokeStyle = '#e5decd'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-11, -66); ctx.lineTo(-3, -64); ctx.moveTo(3, -64); ctx.lineTo(11, -66); ctx.stroke();
    ctx.restore();
  }
}
