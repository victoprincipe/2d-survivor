import { Camera } from '../engine/Camera';

/** Small sheltered room; outdoor simulation waits while the hero explores it. */
export class CaveInterior {
  private readonly bow = new Image();

  constructor() {
    this.bow.src = '/sprites/equipment/guardian-bow.svg';
  }

  nearExit(p: { x: number; y: number }): boolean { return Math.hypot(p.x, p.y - 145) < 65; }
  nearReward(p: { x: number; y: number }): boolean { return Math.hypot(p.x, p.y + 100) < 75; }

  resolveMovement(x: number, y: number, radius: number): { x: number; y: number } {
    return { x: Math.max(-230 + radius, Math.min(230 - radius, x)), y: Math.max(-190 + radius, Math.min(180 - radius, y)) };
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera, player: { x: number; y: number }, unlocked: boolean, opened: boolean): void {
    ctx.save();
    ctx.fillStyle = '#090c10'; ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);
    const origin = camera.worldToScreen(0, 0);
    ctx.translate(origin.x, origin.y);
    ctx.fillStyle = '#353b40'; ctx.beginPath(); ctx.roundRect(-260, -230, 520, 440, 55); ctx.fill();
    ctx.fillStyle = '#1c2428'; ctx.beginPath(); ctx.roundRect(-230, -190, 460, 370, 28); ctx.fill();
    // Deterministic stone floor and rocky rim, without per-frame randomness.
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 10; col++) {
        const x = -220 + col * 44 + (row % 2) * 9;
        const y = -180 + row * 44;
        ctx.strokeStyle = '#2b3335'; ctx.lineWidth = 2;
        ctx.strokeRect(x, y, 34, 30);
      }
    }
    for (const x of [-238, 238]) {
      for (let y = -170; y < 170; y += 55) {
        ctx.fillStyle = '#495052'; ctx.beginPath(); ctx.ellipse(x, y, 15, 22, 0.3, 0, Math.PI * 2); ctx.fill();
      }
      const glow = ctx.createRadialGradient(x, -65, 2, x, -65, 115);
      glow.addColorStop(0, '#fbbf2445'); glow.addColorStop(1, '#fbbf2400');
      ctx.fillStyle = glow; ctx.fillRect(x - 115, -180, 230, 230);
      ctx.fillStyle = '#795338'; ctx.fillRect(x - 4, -65, 8, 27);
      ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.ellipse(x, -70, 7, 13, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#526d51'; ctx.fillRect(-40, 150, 80, 50);
    ctx.fillStyle = '#a9c49a'; ctx.beginPath(); ctx.moveTo(0, 177); ctx.lineTo(-10, 162); ctx.lineTo(10, 162); ctx.fill();
    if (unlocked && !opened) {
      const glow = ctx.createRadialGradient(0, -100, 5, 0, -100, 80);
      glow.addColorStop(0, '#fbbf2470'); glow.addColorStop(1, '#fbbf2400');
      ctx.fillStyle = glow; ctx.fillRect(-80, -180, 160, 160);
    }
    ctx.fillStyle = '#4b4b43'; ctx.fillRect(-28, -95, 56, 24);
    ctx.fillStyle = '#777363'; ctx.fillRect(-33, -101, 66, 9);
    ctx.strokeStyle = '#ba985a'; ctx.lineWidth = 2; ctx.strokeRect(-33, -101, 66, 9);
    if (unlocked && !opened) {
      if (this.bow.complete && this.bow.naturalWidth > 0) {
        ctx.drawImage(this.bow, -22, -186, 48, 85);
      } else {
        ctx.strokeStyle = '#c8aa74'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(-12, -110); ctx.quadraticCurveTo(40, -148, 12, -180); ctx.stroke();
        ctx.lineWidth = 1; ctx.lineTo(-12, -110); ctx.stroke();
      }
    }
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fde68a';
    ctx.fillText('Caverna do Guardião', 0, -201);
    ctx.font = '13px sans-serif';
    if (this.nearReward(player)) {
      ctx.font = '12px sans-serif';
      ctx.fillText(opened ? 'Arco já resgatado' : unlocked ? '[E] Resgatar Arco do Guardião' : 'Conclua o quiz do velho', 0, -55);
    }
    if (this.nearExit(player)) ctx.fillText('[E] Voltar à floresta', 0, 135);
    ctx.restore();
  }
}
