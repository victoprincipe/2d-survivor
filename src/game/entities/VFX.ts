import { Camera } from '../engine/Camera';

export interface DamageNumber {
  x: number;
  y: number;
  text: string;
  color: string;
  isCrit: boolean;
  vy: number;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export class VFXManager {
  private damageNumbers: DamageNumber[] = [];
  private particles: Particle[] = [];
  public screenFlashColor: string = '#ffffff';
  public screenFlashAlpha: number = 0;

  public get count(): number {
    return this.damageNumbers.length + this.particles.length;
  }

  addDamageNumber(x: number, y: number, damage: number, isCrit: boolean = false, isHeal: boolean = false): void {
    const text = isHeal ? `+${damage}` : `${Math.round(damage)}`;
    const color = isHeal ? '#22c55e' : isCrit ? '#f97316' : '#ffffff';
    this.damageNumbers.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y - 10,
      text,
      color,
      isCrit,
      vy: isCrit ? -80 : -50,
      life: 0.65,
      maxLife: 0.65,
    });
  }

  addDeathBurst(x: number, y: number, color: string = '#ef4444', count: number = 10): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
      });
    }
  }

  addSparks(x: number, y: number, color: string = '#facc15', count: number = 6): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2,
        color,
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
      });
    }
  }

  triggerFlash(color: string = '#ffffff', alpha: number = 0.6): void {
    this.screenFlashColor = color;
    this.screenFlashAlpha = alpha;
  }

  update(dt: number): void {
    // Screen flash decay
    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - dt * 2.5);
    }

    // Update damage numbers
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      dn.life -= dt;
      dn.y += dn.vy * dt;
      dn.vy += 60 * dt; // gravity
      if (dn.life <= 0) {
        this.damageNumbers.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.1, dt);
      p.vy *= Math.pow(0.1, dt);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Render particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!camera.isInView(p.x, p.y, 20)) continue;
      const screen = camera.worldToScreen(p.x, p.y);
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render damage numbers
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < this.damageNumbers.length; i++) {
      const dn = this.damageNumbers[i];
      if (!camera.isInView(dn.x, dn.y, 30)) continue;
      const screen = camera.worldToScreen(dn.x, dn.y);
      const alpha = Math.min(1, dn.life / (dn.maxLife * 0.4));
      ctx.globalAlpha = alpha;

      if (dn.isCrit) {
        ctx.font = '900 17px sans-serif';
      } else {
        ctx.font = 'bold 13px sans-serif';
      }

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(dn.text, screen.x, screen.y);
      ctx.fillStyle = dn.color;
      ctx.fillText(dn.text, screen.x, screen.y);
    }

    ctx.globalAlpha = 1.0;

    // Full screen flash overlay
    if (this.screenFlashAlpha > 0.01) {
      ctx.fillStyle = this.screenFlashColor;
      ctx.globalAlpha = this.screenFlashAlpha;
      ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);
      ctx.globalAlpha = 1.0;
    }
  }

  clear(): void {
    this.damageNumbers = [];
    this.particles = [];
    this.screenFlashAlpha = 0;
  }
}
