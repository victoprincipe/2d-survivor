import { ANACONDA } from '../data/anaconda';
import { Camera } from '../engine/Camera';

type Target = { x: number; y: number; radius: number };
const config = ANACONDA.acid;
const seed = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** One source and one damage clock: exposure refreshes duration, never stacks DPS. */
export class AcidRain {
  public phase: 'none' | 'warning' | 'active' | 'fading' = 'none';
  public pendingHeal = false;
  public pendingTicks = 0;
  private x = 0;
  private y = 0;
  private remaining = 0;
  private elapsed = 0;
  private poisonRemaining = 0;
  private tickTime = 0;

  get casting(): boolean { return this.phase === 'warning' || this.phase === 'active'; }
  get poisoned(): boolean { return this.poisonRemaining > 0; }
  begin(x: number, y: number): void {
    this.x = x; this.y = y; this.phase = 'warning'; this.remaining = config.warning; this.elapsed = 0;
  }
  clear(): void {
    this.phase = 'none'; this.pendingHeal = false; this.pendingTicks = 0;
    this.poisonRemaining = 0; this.tickTime = 0;
  }
  update(dt: number, player: Target): void {
    this.elapsed += dt;
    if (this.phase === 'warning') {
      this.remaining = Math.max(0, this.remaining - dt);
      if (this.remaining === 0) { this.phase = 'active'; this.remaining = config.duration; this.pendingHeal = true; }
      return;
    }
    let covered = 0;
    if (this.phase === 'active') {
      const activeDt = Math.min(dt, this.remaining);
      if (Math.hypot(player.x - this.x, player.y - this.y) <= config.radius + player.radius) {
        covered = activeDt;
        this.poisonRemaining = config.poisonDuration;
      }
      this.remaining = Math.max(0, this.remaining - dt);
      if (this.remaining < 1e-8) { this.phase = 'fading'; this.remaining = 1; }
    } else if (this.phase === 'fading') {
      this.remaining = Math.max(0, this.remaining - dt);
      if (this.remaining === 0) this.phase = 'none';
    }
    const lingering = Math.min(Math.max(0, dt - covered), this.poisonRemaining);
    this.poisonRemaining = Math.max(0, this.poisonRemaining - (dt - covered));
    this.tickTime += covered + lingering;
    while (this.tickTime >= 1 - 1e-8) { this.tickTime = Math.max(0, this.tickTime - 1); this.pendingTicks++; }
    if (!this.poisoned && covered === 0) this.tickTime = 0;
  }

  renderGround(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!this.casting || !camera.isInView(this.x, this.y, config.radius + 30)) return;
    const p = camera.worldToScreen(this.x, this.y);
    ctx.save(); ctx.fillStyle = this.phase === 'warning' ? 'rgba(163,230,53,0.06)' : 'rgba(74,222,128,0.12)';
    ctx.strokeStyle = '#bef264'; ctx.lineWidth = 3; ctx.setLineDash(this.phase === 'warning' ? [12, 9] : []);
    ctx.beginPath(); ctx.arc(p.x, p.y, config.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  renderAir(ctx: CanvasRenderingContext2D, camera: Camera, player: Target): void {
    if (this.phase !== 'none' && camera.isInView(this.x, this.y, config.radius + 300)) {
      const p = camera.worldToScreen(this.x, this.y);
      const opacity = this.phase === 'warning' ? Math.min(1, this.elapsed / config.warning) : this.phase === 'fading' ? this.remaining : 1;
      ctx.save(); ctx.globalAlpha = opacity;
      // Fixed-size particle set with seeded positions; no frame-dependent random flicker.
      for (let i = 0; i < 16; i++) {
        const angle = seed(i + 1) * Math.PI * 2, radius = Math.sqrt(seed(i + 30)) * 350;
        const x = p.x + Math.cos(angle) * radius + Math.sin(this.elapsed + i) * 12;
        const y = p.y - 235 + Math.sin(angle) * radius * 0.45;
        const glow = ctx.createRadialGradient(x, y, 5, x, y, 100);
        glow.addColorStop(0, 'rgba(132,204,22,0.16)'); glow.addColorStop(1, 'rgba(22,101,52,0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(x, y, 110, 65, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (this.phase !== 'warning') for (let i = 0; i < 96; i++) {
        const angle = seed(i + 80) * Math.PI * 2, radius = Math.sqrt(seed(i + 230)) * config.radius;
        const x = p.x + Math.cos(angle) * radius, groundY = p.y + Math.sin(angle) * radius;
        const cycle = (this.elapsed * (1.3 + seed(i + 10) * 0.5) + seed(i + 430)) % 1;
        ctx.strokeStyle = 'rgba(190,242,100,0.65)'; ctx.lineWidth = 2;
        ctx.beginPath();
        if (cycle < 0.86) {
          const y = groundY - 260 + Math.pow(cycle / 0.86, 2) * 260;
          ctx.moveTo(x, y - 9); ctx.lineTo(x - 2, y);
        } else {
          const size = (cycle - 0.86) / 0.14 * 12;
          ctx.ellipse(x, groundY, size, size * 0.4, 0, 0, Math.PI * 2);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    if (this.poisoned) {
      const p = camera.worldToScreen(player.x, player.y);
      ctx.save(); ctx.fillStyle = '#bef264'; ctx.strokeStyle = '#143022'; ctx.lineWidth = 3;
      ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.strokeText('ENVENENADO', p.x, p.y - 80); ctx.fillText('ENVENENADO', p.x, p.y - 80);
      for (let i = 0; i < 7; i++) {
        ctx.beginPath(); ctx.arc(p.x + Math.sin(this.elapsed * 3 + i) * 20, p.y - ((this.elapsed * 25 + i * 8) % 50), 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }
}
