import { Camera } from '../engine/Camera';

/** Peaceful camp resident, never registered as a combat target. */
export class TribeHunter {
  private readonly sprite = new Image();
  private readonly riseSprite = new Image();
  private time = 0;
  private delivered: boolean;
  private riseElapsed: number;
  private readonly riseDuration = 1.1;
  constructor(public readonly x: number, public readonly y: number, completed = false) {
    this.sprite.src = '/sprites/tribe-hunter/seated-elder.png';
    this.riseSprite.src = '/sprites/tribe-hunter/stand-up-elder.png';
    this.delivered = completed;
    this.riseElapsed = completed ? this.riseDuration : 0;
  }
  get animationFrame(): number {
    return this.delivered ? Math.min(7, Math.floor(this.riseElapsed / this.riseDuration * 8)) : 0;
  }
  get isStanding(): boolean { return this.delivered && this.riseElapsed >= this.riseDuration; }
  onFoodDelivered(): void {
    if (this.delivered) return;
    this.delivered = true;
    this.riseElapsed = 0;
  }
  update(dt: number): void {
    this.time += dt;
    if (this.delivered) this.riseElapsed = Math.min(this.riseDuration, this.riseElapsed + dt);
  }
  canInteract(player: { x: number; y: number }): boolean {
    return Math.hypot(player.x - this.x, player.y - this.y) <= 145;
  }
  render(ctx: CanvasRenderingContext2D, camera: Camera, completed: boolean): void {
    if (!camera.isInView(this.x, this.y, 250)) return;
    const p = camera.worldToScreen(this.x, this.y);
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(113,75,40,0.5)';
    ctx.beginPath(); ctx.ellipse(35, 5, 120, 62, 0, 0, Math.PI * 2); ctx.fill();
    if (this.riseSprite.complete && this.riseSprite.naturalWidth > 0) {
      const frame = this.animationFrame;
      const progress = this.delivered ? Math.min(1, this.riseElapsed / this.riseDuration) : 0;
      const eased = progress * progress * (3 - 2 * progress);
      // Slightly larger than the playable hero, with a smaller seated silhouette.
      const height = (52.5 + 22.5 * eased) * (1 + Math.sin(this.time * 2) * 0.006);
      const frameWidth = this.riseSprite.naturalWidth / 4;
      const frameHeight = this.riseSprite.naturalHeight / 2;
      const width = height * frameWidth / frameHeight;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.riseSprite, frame % 4 * frameWidth, Math.floor(frame / 4) * frameHeight,
        frameWidth, frameHeight, -width / 2, 8 - height, width, height);
    } else if (this.sprite.complete && this.sprite.naturalWidth > 0) {
      const height = 52.5 * (1 + Math.sin(this.time * 2) * 0.006);
      const width = height * this.sprite.naturalWidth / this.sprite.naturalHeight;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.sprite, -width / 2, 8 - height, width, height);
    } else {
      ctx.fillStyle = '#a56d46'; ctx.beginPath(); ctx.arc(0, -20, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d6aa54'; ctx.fillRect(-10, -12, 20, 18);
    }
    ctx.translate(85, 4);
    ctx.strokeStyle = '#57432f'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-20, 7); ctx.lineTo(19, -1);
    ctx.moveTo(-17, -2); ctx.lineTo(19, 8); ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7;
      ctx.fillStyle = '#6b6c64'; ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 26, Math.sin(a) * 11 + 7, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Simulation time freezes these flames together with the paused world.
    for (let i = 0; i < 3; i++) {
      const sway = Math.sin(this.time * 8 + i * 2) * 4;
      const height = 24 + Math.sin(this.time * 11 + i) * 6;
      ctx.fillStyle = ['#ea580c', '#f59e0b', '#fde68a'][i];
      ctx.beginPath(); ctx.moveTo(-15 + i * 5, 3);
      ctx.quadraticCurveTo(-18 + sway, -height / 2, sway, -height);
      ctx.quadraticCurveTo(20 - sway, -height / 2, 14 - i * 4, 3); ctx.fill();
    }
    if (completed) {
      ctx.strokeStyle = '#735034'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-34, 1); ctx.lineTo(-26, -32);
      ctx.lineTo(-19, 1); ctx.moveTo(20, 1); ctx.lineTo(27, -32); ctx.lineTo(35, 1);
      ctx.moveTo(-31, -29); ctx.lineTo(32, -29); ctx.stroke();
      ctx.fillStyle = '#d9a354'; ctx.beginPath(); ctx.ellipse(0, -29, 17, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-15, -29); ctx.lineTo(-25, -36); ctx.lineTo(-25, -22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#30231e'; ctx.beginPath(); ctx.arc(10, -30, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#89572d'; ctx.lineWidth = 2;
      for (let i = -7; i <= 5; i += 6) { ctx.beginPath(); ctx.moveTo(i, -33); ctx.lineTo(i - 2, -25); ctx.stroke(); }
    }
    ctx.restore();
  }
  renderPrompt(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.worldToScreen(this.x, this.y - 88);
    ctx.save(); ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#101b14'; ctx.beginPath(); ctx.roundRect(p.x - 122, p.y - 18, 244, 28, 7); ctx.fill();
    ctx.fillStyle = '#fde68a'; ctx.fillText('[E] Conversar com o caçador', p.x, p.y); ctx.restore();
  }
}
