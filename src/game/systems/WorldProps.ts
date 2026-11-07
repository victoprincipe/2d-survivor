import { Camera } from '../engine/Camera';
import { Player } from '../entities/Player';
import { Drop } from '../entities/Drops';
import { DropType } from '../types';

export interface TorchProp {
  id: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
  animTimer: number;
  buff: DropType;
}

export class WorldSystem {
  public torches: TorchProp[] = [];
  private nextTorchId: number = 1;
  private torchSpawnTimer: number = 0;
  private maxTorches: number = 7;
  private readonly torchSpawnInterval: number = 9; // 1/3 of the previous 3s spawn rate

  private tilePatternCanvas: HTMLCanvasElement | null = null;
  private tilePattern: CanvasPattern | null = null;
  private readonly tileSize: number = 128;

  constructor() {
    this.createFloorPattern();
  }

  private createFloorPattern(): void {
    if (typeof window === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = this.tileSize;
    canvas.height = this.tileSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark gothic stone background
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, this.tileSize, this.tileSize);

    // Stone tile grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, this.tileSize, this.tileSize);

    // Inner subtle paving details
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 4, this.tileSize - 8, this.tileSize - 8);

    // Cracks / texture dots
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(20, 30, 8, 2);
    ctx.fillRect(75, 80, 12, 2);
    ctx.fillRect(90, 25, 2, 8);

    // Moss patch
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(100, 100, 7, 0, Math.PI * 2);
    ctx.fill();

    this.tilePatternCanvas = canvas;
  }

  private rollTorchBuff(): DropType {
    // Healing (chicken) is intentionally excluded from lamps.
    const roll = Math.random();
    if (roll < 0.6) return 'coin';
    if (roll < 0.85) return 'magnet';
    return 'rosary';
  }

  update(dt: number, player: Player, onBuffSpawn?: (drop: Drop) => void): void {
    this.torchSpawnTimer += dt;

    // Spawn new torches periodically near player
    if (this.torchSpawnTimer > this.torchSpawnInterval && this.torches.length < this.maxTorches) {
      this.torchSpawnTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      const dist = 350 + Math.random() * 250;
      const x = player.x + Math.cos(angle) * dist;
      const y = player.y + Math.sin(angle) * dist;
      const buff = this.rollTorchBuff();

      this.torches.push({
        id: this.nextTorchId++,
        x,
        y,
        radius: 12,
        hp: 1,
        animTimer: Math.random() * 5,
        buff,
      });

      // The lamp already carries its random buff when it spawns.
      onBuffSpawn?.(new Drop(Date.now() + Math.random(), buff, x, y));
    }

    // Clean up torches that are way too far away (> 1500 px)
    for (let i = this.torches.length - 1; i >= 0; i--) {
      const t = this.torches[i];
      t.animTimer += dt * 6;

      const dx = player.x - t.x;
      const dy = player.y - t.y;
      if (dx * dx + dy * dy > 1600 * 1600) {
        this.torches.splice(i, 1);
      }
    }
  }

  renderFloor(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!this.tilePattern && this.tilePatternCanvas) {
      this.tilePattern = ctx.createPattern(this.tilePatternCanvas, 'repeat');
    }

    if (this.tilePattern) {
      ctx.save();
      // Translate pattern matrix by camera coordinates
      const offsetX = (-camera.x + camera.viewportWidth / 2 + camera.shakeOffsetX) % this.tileSize;
      const offsetY = (-camera.y + camera.viewportHeight / 2 + camera.shakeOffsetY) % this.tileSize;

      ctx.translate(offsetX, offsetY);
      ctx.fillStyle = this.tilePattern;
      ctx.fillRect(-this.tileSize, -this.tileSize, camera.viewportWidth + this.tileSize * 2, camera.viewportHeight + this.tileSize * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);
    }
  }

  renderTorches(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (let i = 0; i < this.torches.length; i++) {
      const t = this.torches[i];
      if (!camera.isInView(t.x, t.y, 40)) continue;

      const screen = camera.worldToScreen(t.x, t.y);
      const flameWobble = Math.sin(t.animTimer) * 2;

      ctx.save();
      ctx.translate(screen.x, screen.y);

      // Light glow aura
      const glow = ctx.createRadialGradient(0, -12, 4, 0, -12, 35);
      glow.addColorStop(0, 'rgba(249, 115, 22, 0.3)');
      glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -12, 35, 0, Math.PI * 2);
      ctx.fill();

      // Stone Pedestal
      ctx.fillStyle = '#334155';
      ctx.fillRect(-6, 2, 12, 10);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-8, -4, 16, 6);

      // Torch post
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-3, -12, 6, 8);

      // Flickering Flame
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(-5, -12);
      ctx.quadraticCurveTo(-6 + flameWobble, -22, 0, -25);
      ctx.quadraticCurveTo(6 + flameWobble, -22, 5, -12);
      ctx.fill();

      // Inner yellow flame
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(-2, -12);
      ctx.lineTo(0, -19);
      ctx.lineTo(2, -12);
      ctx.fill();

      ctx.restore();
    }
  }

  clear(): void {
    this.torches = [];
  }
}
