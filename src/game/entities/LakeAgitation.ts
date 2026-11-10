import { ANACONDA } from '../data/anaconda';
import { Camera } from '../engine/Camera';

const C = ANACONDA.dive;

/** Simulation-timed dive, five one-second damage pulses, then resurfacing. */
export class LakeAgitation {
  phase: 'none' | 'warning' | 'active' | 'surfacing' = 'none';
  pendingTicks = 0;
  pendingSound = false;
  pendingEmergeImpact = false;
  private remaining = 0;
  private elapsed = 0;
  private x = 0;
  private y = 0;
  get casting(): boolean { return this.phase !== 'none'; }
  get submersion(): number {
    return this.phase === 'warning' ? 1 - this.remaining / C.warning
      : this.phase === 'active' ? 1 : this.phase === 'surfacing' ? this.remaining / C.surfacing : 0;
  }
  begin(x: number, y: number): void { this.clear(); this.x = x; this.y = y; this.phase = 'warning'; this.remaining = C.warning; this.elapsed = 0; }
  clear(): void { this.phase = 'none'; this.pendingTicks = 0; this.pendingSound = false; this.pendingEmergeImpact = false; }
  update(dt: number): void {
    if (!this.casting) return;
    this.elapsed += dt;
    const previous = this.remaining;
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.phase === 'warning' && this.remaining < 1e-8) {
      this.phase = 'active'; this.remaining = C.duration; this.pendingSound = true;
    } else if (this.phase === 'active') {
      const tick = (time: number) => Math.floor(C.duration - time + 1e-8);
      this.pendingTicks += tick(this.remaining) - tick(previous);
      if (this.remaining < 1e-8) { this.phase = 'surfacing'; this.remaining = C.surfacing; }
    } else if (this.phase === 'surfacing' && this.remaining < 1e-8) {
      this.phase = 'none'; this.pendingEmergeImpact = true;
    }
  }
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!this.casting || !camera.isInView(this.x, this.y, C.radius + 100)) return;
    const p = camera.worldToScreen(this.x, this.y);
    ctx.save(); ctx.strokeStyle = '#a5f3fc'; ctx.lineWidth = 3;
    ctx.setLineDash(this.phase === 'warning' ? [14, 10] : []);
    ctx.fillStyle = 'rgba(6,182,212,0.08)'; ctx.beginPath();
    ctx.arc(p.x, p.y, C.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    if (this.phase === 'surfacing') {
      ctx.fillStyle = 'rgba(165,243,252,0.12)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, C.emergeRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const progress = (this.elapsed * 0.7 + i / 7) % 1;
      ctx.strokeStyle = `rgba(165,243,252,${(1 - progress) * 0.55})`;
      ctx.lineWidth = 3 + Math.sin(this.elapsed * 4 + i) * 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 40 + progress * (C.radius - 40), 0, Math.PI * 2); ctx.stroke();
    }
    if (this.phase === 'active') for (let i = 0; i < 60; i++) {
      const angle = i * 2.39996 + Math.sin(this.elapsed * 2 + i) * 0.03;
      const radius = Math.sqrt((i + 1) / 60) * (C.radius - 30);
      const x = p.x + Math.cos(angle) * radius, y = p.y + Math.sin(angle) * radius;
      const lift = Math.sin(this.elapsed * 7 + i * 1.7);
      ctx.strokeStyle = 'rgba(236,254,255,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y - Math.max(0, lift) * 12, 9 + lift * 3, 3, angle, 0, Math.PI); ctx.stroke();
    }
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#cffafe';
    ctx.strokeStyle = '#083344'; ctx.lineWidth = 3;
    ctx.strokeText('AGITAÇÃO DO LAGO', p.x, p.y - 210); ctx.fillText('AGITAÇÃO DO LAGO', p.x, p.y - 210);
    ctx.restore();
  }
}
