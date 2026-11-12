import { Camera } from '../engine/Camera';

export interface DamageNumber {
  value: number;
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
  private readonly maxParticles = 512;
  private readonly maxDamageNumbers = 160;
  private readonly numberBuckets = new Map<string, DamageNumber>();
  private mergeTime = 0;
  private readonly textSprites = new Map<string, HTMLCanvasElement>();
  private textSpriteBytes = 0;
  private damageNumbers: DamageNumber[] = [];
  private particles: Particle[] = [];
  public screenFlashColor: string = '#ffffff';
  public screenFlashAlpha: number = 0;

  public get count(): number {
    return this.damageNumbers.length + this.particles.length;
  }

  addDamageNumber(x: number, y: number, damage: number, isCrit: boolean = false, isHeal: boolean = false): void {
    const value = isHeal ? damage : Math.round(damage);
    const color = isHeal ? '#22c55e' : isCrit ? '#f97316' : '#ffffff';
    const key = `${Math.floor(x / 32)}:${Math.floor(y / 32)}:${color}:${Number(isCrit)}`;
    const existing = this.numberBuckets.get(key);
    if (existing) {
      existing.value += value;
      existing.text = `${isHeal ? '+' : ''}${existing.value}`;
      return;
    }
    if (this.damageNumbers.length >= this.maxDamageNumbers) return;
    const number: DamageNumber = {
      value,
      x: x + (Math.random() - 0.5) * 16,
      y: y - 10,
      text: `${isHeal ? '+' : ''}${value}`,
      color,
      isCrit,
      vy: isCrit ? -80 : -50,
      life: 0.65,
      maxLife: 0.65,
    };
    this.damageNumbers.push(number);
    this.numberBuckets.set(key, number);
  }

  addDeathBurst(x: number, y: number, color: string = '#ef4444', count: number = 10): void {
    count = Math.min(count, this.maxParticles - this.particles.length);
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
    count = Math.min(count, this.maxParticles - this.particles.length);
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
    this.mergeTime += dt;
    if (this.mergeTime >= 0.1) {
      this.mergeTime %= 0.1;
      this.numberBuckets.clear();
    }
    // Screen flash decay
    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - dt * 2.5);
    }

    // Update damage numbers
    let liveNumbers = 0;
    for (let i = 0; i < this.damageNumbers.length; i++) {
      const dn = this.damageNumbers[i];
      dn.life -= dt;
      dn.y += dn.vy * dt;
      dn.vy += 60 * dt; // gravity
      if (dn.life > 0) this.damageNumbers[liveNumbers++] = dn;
    }
    this.damageNumbers.length = liveNumbers;

    // Update particles
    const drag = Math.pow(0.1, dt);
    let liveParticles = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
      if (p.life > 0) this.particles[liveParticles++] = p;
    }
    this.particles.length = liveParticles;
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
    const textScale = typeof document === 'undefined' ? 1 : Math.max(1, Math.abs(ctx.getTransform().a));
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

      const sprite = this.getTextSprite(dn, textScale);
      if (sprite) {
        ctx.drawImage(sprite, screen.x - sprite.width / textScale / 2, screen.y - 23, sprite.width / textScale, sprite.height / textScale);
        continue;
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
    this.numberBuckets.clear();
    this.mergeTime = 0;
  }

  private getTextSprite(number: DamageNumber, scale: number): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const key = `${scale}:${number.color}:${number.isCrit}:${number.text}`;
    const cached = this.textSprites.get(key);
    if (cached) {
      this.textSprites.delete(key); this.textSprites.set(key, cached);
      return cached;
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const font = number.isCrit ? '900 17px sans-serif' : 'bold 13px sans-serif';
    ctx.font = font;
    const width = Math.ceil(ctx.measureText(number.text).width + 8);
    canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(30 * scale);
    ctx.scale(scale, scale); ctx.font = font; ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 3; ctx.fillStyle = number.color;
    ctx.strokeText(number.text, canvas.width / scale / 2, 23);
    ctx.fillText(number.text, canvas.width / scale / 2, 23);
    const bytes = canvas.width * canvas.height * 4;
    // Bounded LRU: changing totals cannot retain an unlimited set of canvases.
    while (this.textSprites.size && (this.textSprites.size >= 256 || this.textSpriteBytes + bytes > 2 * 1024 * 1024)) {
      const oldest = this.textSprites.keys().next().value!;
      const old = this.textSprites.get(oldest)!;
      this.textSpriteBytes -= old.width * old.height * 4;
      this.textSprites.delete(oldest); old.width = old.height = 0;
    }
    if (bytes > 2 * 1024 * 1024) return null;
    this.textSprites.set(key, canvas); this.textSpriteBytes += bytes;
    return canvas;
  }
}
