import { ANACONDA } from '../data/anaconda';
import { Camera } from '../engine/Camera';
import { AnacondaVisual } from './AnacondaVisual';

export class AnacondaNpc {
  readonly x = ANACONDA.x;
  readonly y = ANACONDA.y;
  private readonly visual = new AnacondaVisual();
  canInteract(player: { x: number; y: number }): boolean { return Math.hypot(player.x - this.x, player.y - this.y) <= 200; }
  update(dt: number): void { this.visual.update(dt); }
  render(ctx: CanvasRenderingContext2D, camera: Camera): void { this.visual.render(ctx, camera, this.x, this.y); }
  renderPrompt(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.worldToScreen(this.x, this.y);
    ctx.save(); ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#10291e'; ctx.beginPath(); ctx.roundRect(p.x - 110, p.y - 220, 220, 34, 8); ctx.fill();
    ctx.fillStyle = '#fde68a'; ctx.fillText('[E] Desafiar a Sucuri Gigante', p.x, p.y - 198); ctx.restore();
  }
}
