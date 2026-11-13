import { DropType } from '../types';
import { Camera } from '../engine/Camera';
import { Player } from './Player';

export class Drop {
  public id: number;
  public type: DropType;
  public x: number;
  public y: number;
  public radius: number = 8;
  public value: number = 5;

  public vx: number = 0;
  public vy: number = 0;
  public isBeingMagnetPulled: boolean = false;
  public animTimer: number = Math.random() * 6;

  constructor(id: number, type: DropType, x: number, y: number, value?: number) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;

    switch (type) {
      case 'quest_fish':
        this.value = 1;
        this.radius = 10;
        break;
      case 'gem_blue':
        this.value = value ?? 5;
        this.radius = 7;
        break;
      case 'gem_green':
        this.value = value ?? 25;
        this.radius = 9;
        break;
      case 'gem_red':
        this.value = value ?? 100;
        this.radius = 11;
        break;
      case 'coin':
        this.value = value ?? 15;
        this.radius = 8;
        break;
      case 'chicken':
        this.value = 35; // HP heal
        this.radius = 12;
        break;
      case 'magnet':
        this.value = 1;
        this.radius = 12;
        break;
      case 'rosary':
        this.value = 1;
        this.radius = 13;
        break;
      case 'chest':
        this.value = 1;
        this.radius = 16;
        break;
    }
  }

  update(dt: number, player: Player): boolean {
    this.animTimer += dt * 5;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distSq = dx * dx + dy * dy;
    const pickupRadSq = player.pickupRadius * player.pickupRadius;

    // Check if within pickup radius or vacuum magnet is active
    if (this.isBeingMagnetPulled || distSq < pickupRadSq) {
      const dist = Math.sqrt(distSq);
      if (dist > 0) {
        const pullSpeed = this.isBeingMagnetPulled ? 600 : Math.min(500, 150 + (player.pickupRadius - dist) * 8);
        this.x += (dx / dist) * pullSpeed * dt;
        this.y += (dy / dist) * pullSpeed * dt;
      }

      // Check pickup collection
      if (dist < player.radius + this.radius + 4) {
        return true; // Picked up!
      }
    }

    return false;
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!camera.isInView(this.x, this.y, 40)) return;

    const screen = camera.worldToScreen(this.x, this.y);
    const bob = Math.sin(this.animTimer) * 2;

    ctx.save();
    ctx.translate(screen.x, screen.y + bob);

    if (this.type === 'quest_fish') {
      ctx.fillStyle = '#a5e6ed'; ctx.strokeStyle = '#0e7490'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 5, -0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-16, -6); ctx.lineTo(-16, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#164e63'; ctx.beginPath(); ctx.arc(5, -1, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'gem_blue') {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -3, 2, 2);
    } else if (this.type === 'gem_green') {
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -4, 3, 3);
    } else if (this.type === 'gem_red') {
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3, -5, 3, 3);
    } else if (this.type === 'coin') {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 0);
    } else if (this.type === 'chicken') {
      // Roast Chicken / Meat
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Bone
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(8, -2, 5, 4);
    } else if (this.type === 'magnet') {
      // Horseshoe Magnet
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 0, 9, Math.PI, 0, false);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ef4444';
      ctx.stroke();
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-9, 0, 4, 4);
      ctx.fillRect(5, 0, 4, 4);
    } else if (this.type === 'rosary') {
      // Holy Rosary cross
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-3, -10, 6, 20);
      ctx.fillRect(-8, -5, 16, 6);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1;
      ctx.strokeRect(-3, -10, 6, 20);
    } else if (this.type === 'chest') {
      // Glowing Treasure Chest
      const pulse = Math.sin(this.animTimer * 2) * 3;
      ctx.fillStyle = 'rgba(234, 179, 8, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, 20 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Chest body
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(-13, -8, 26, 18);
      // Gold trim
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-13, -3, 26, 3);
      ctx.fillRect(-3, -4, 6, 6);
    }

    ctx.restore();
  }
}
