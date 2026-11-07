import { Camera } from '../engine/Camera';
import { Player } from '../entities/Player';
import { Drop } from '../entities/Drops';
import { DropType, MapId } from '../types';

export interface TorchProp {
  id: number;
  x: number;
  y: number;
  radius: number;
  animTimer: number;
  buff: DropType;
}

interface TreeProp {
  x: number;
  y: number;
  size: number;
  tone: number;
}

export class WorldSystem {
  public torches: TorchProp[] = [];
  private nextTorchId: number = 1;
  private torchSpawnTimer: number = 0;
  private maxTorches: number = 6;
  private readonly torchSpawnInterval: number = 13;

  private mapId: MapId;
  private trees: TreeProp[] = [];

  private floorImage: HTMLImageElement | null = null;
  private floorPattern: CanvasPattern | null = null;

  constructor(mapId: MapId = 'night_plain') {
    this.mapId = mapId;
    if (mapId === 'amazon_forest') this.generateTrees();
    this.loadFloorTexture();
  }

  private generateTrees(): void {
    // Deterministic scatter so the forest looks the same between renders.
    let seed = 1337;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < 80; i++) {
      const x = (random() - 0.5) * 3600;
      const y = (random() - 0.5) * 3600;
      // Keep the spawn area clear.
      if (Math.abs(x) < 150 && Math.abs(y) < 150) continue;
      this.trees.push({
        x,
        y,
        size: 26 + random() * 26,
        tone: random(),
      });
    }
  }

  private loadFloorTexture(): void {
    if (typeof window === 'undefined') return;
    const image = new Image();
    image.onload = () => {
      this.floorImage = image;
      this.floorPattern = null;
    };
    image.src = '/grass-texture.jpg';
  }

  private rollTorchBuff(): DropType {
    // Healing (chicken) is intentionally excluded from lamps.
    const roll = Math.random();
    if (roll < 0.72) return 'coin';
    if (roll < 0.94) return 'magnet';
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
    if (this.mapId === 'amazon_forest') {
      ctx.fillStyle = '#0f2a16';
      ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);
      return;
    }

    const image = this.floorImage;
    if (image) {
      if (!this.floorPattern) {
        this.floorPattern = ctx.createPattern(image, 'repeat');
      }

      if (this.floorPattern) {
        const tileWidth = image.naturalWidth;
        const tileHeight = image.naturalHeight;
        const offsetX = (-camera.x + camera.viewportWidth / 2 + camera.shakeOffsetX) % tileWidth;
        const offsetY = (-camera.y + camera.viewportHeight / 2 + camera.shakeOffsetY) % tileHeight;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.fillStyle = this.floorPattern;
        ctx.fillRect(
          -tileWidth,
          -tileHeight,
          camera.viewportWidth + tileWidth * 2,
          camera.viewportHeight + tileHeight * 2
        );
        ctx.restore();
        return;
      }
    }

    ctx.fillStyle = '#1f2b1f';
    ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);
  }

  renderTrees(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.mapId !== 'amazon_forest') return;

    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];
      if (!camera.isInView(tree.x, tree.y, tree.size + 30)) continue;

      const screen = camera.worldToScreen(tree.x, tree.y);
      const size = tree.size;

      ctx.save();
      ctx.translate(screen.x, screen.y);

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.ellipse(0, 4, size * 0.55, size * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Trunk
      ctx.fillStyle = '#4a2f1b';
      ctx.fillRect(-size * 0.08, -size * 0.5, size * 0.16, size * 0.6);

      // Canopy
      ctx.fillStyle = tree.tone > 0.5 ? '#14532d' : '#166534';
      ctx.beginPath();
      ctx.arc(0, -size * 0.62, size * 0.48, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(-size * 0.22, -size * 0.72, size * 0.34, 0, Math.PI * 2);
      ctx.arc(size * 0.24, -size * 0.7, size * 0.32, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
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
