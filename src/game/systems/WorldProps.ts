import { Camera } from '../engine/Camera';
import { Player } from '../entities/Player';

const TILE_SIZE = 64;
const MAP_TILES = 180;
const WORLD_SIZE = TILE_SIZE * MAP_TILES;
const BORDER_TILES = 4;
const ELEVATION_PIXELS = 8;

const TILE_GROUND = 0;
const TILE_HILL = 1;
const TILE_PLATEAU = 2;
const TILE_RAMP = 3;
const TILE_RIVER = 4;
const TILE_BANK = 5;
const TILE_BORDER = 6;
const TILE_LOG = 7;
const TILE_ROCK = 8;
const TILE_LAKE = 9;

export type BiomeType = 'agua' | 'margem' | 'mata' | 'plato';

type DecorKind = 'tree' | 'palm' | 'fern' | 'lily' | 'log' | 'rock';

interface DecorProp {
  kind: DecorKind;
  x: number;
  y: number;
  scale: number;
  variant: number;
}

interface ResourceProp {
  kind: 'fruit' | 'flower';
  x: number;
  y: number;
  variant: number;
  cooldown: number;
}

export class WorldSystem {
  public readonly mapTiles = MAP_TILES;
  public readonly tileSize = TILE_SIZE;
  public readonly worldWidth = WORLD_SIZE;
  public readonly worldHeight = WORLD_SIZE;

  private tiles = new Uint8Array(MAP_TILES * MAP_TILES);
  private heights = new Uint8Array(MAP_TILES * MAP_TILES);
  private decor: DecorProp[] = [];
  private resources: ResourceProp[] = [];
  private elapsed: number = 0;

  constructor() {
    this.generateMap();
    this.generateDecor();
    this.generateResources();
  }

  private hash(x: number, y: number, seed: number = 0): number {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  private inBorder(tx: number, ty: number): boolean {
    return (
      tx < BORDER_TILES ||
      ty < BORDER_TILES ||
      tx >= MAP_TILES - BORDER_TILES ||
      ty >= MAP_TILES - BORDER_TILES
    );
  }

  private indexAt(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return -1;
    return ty * MAP_TILES + tx;
  }

  private generateMap(): void {
    this.tiles.fill(TILE_GROUND);
    this.heights.fill(0);

    for (let ty = 0; ty < MAP_TILES; ty++) {
      for (let tx = 0; tx < MAP_TILES; tx++) {
        if (this.inBorder(tx, ty)) {
          this.tiles[ty * MAP_TILES + tx] = TILE_BORDER;
        }
      }
    }

    // Elevated plateaus surrounded by lower hills.
    this.paintBlob(46, 52, 27, 20, 1);
    this.paintBlob(46, 52, 17, 13, 2);
    this.paintBlob(136, 132, 24, 18, 1);
    this.paintBlob(136, 132, 15, 11, 2);
    this.paintBlob(72, 145, 18, 13, 1);
    this.paintBlob(122, 38, 17, 12, 1);

    this.carveRamps();

    // Muddy river crossing the map from north to south.
    for (let ty = BORDER_TILES + 1; ty < MAP_TILES - BORDER_TILES - 1; ty++) {
      const centerX = 118 + Math.sin(ty * 0.075) * 15 + Math.sin(ty * 0.021) * 9;
      const halfWidth = 5 + Math.sin(ty * 0.11) * 1.4 + Math.sin(ty * 0.037) * 0.8;

      for (let tx = Math.floor(centerX - halfWidth) - 2; tx <= Math.ceil(centerX + halfWidth) + 2; tx++) {
        if (this.inBorder(tx, ty)) continue;
        const index = this.indexAt(tx, ty);
        if (index < 0) continue;

        if (Math.abs(tx - centerX) <= halfWidth) {
          this.tiles[index] = TILE_RIVER;
        } else if (this.tiles[index] !== TILE_RIVER && this.tiles[index] !== TILE_LAKE) {
          this.tiles[index] = TILE_BANK;
        }
        this.heights[index] = 0;
      }
    }

    this.paintLake(34, 112, 17, 12);

    // Fallen logs and rocks are low obstacles that can be jumped over.
    for (let ty = BORDER_TILES + 1; ty < MAP_TILES - BORDER_TILES - 1; ty++) {
      for (let tx = BORDER_TILES + 1; tx < MAP_TILES - BORDER_TILES - 1; tx++) {
        const index = ty * MAP_TILES + tx;
        const tile = this.tiles[index];
        if (
          tile !== TILE_GROUND &&
          tile !== TILE_HILL &&
          tile !== TILE_PLATEAU &&
          tile !== TILE_RAMP
        ) {
          continue;
        }
        const roll = this.hash(tx, ty, 31);
        if (roll < 0.008) {
          this.tiles[index] = TILE_LOG;
        } else if (roll < 0.016) {
          this.tiles[index] = TILE_ROCK;
        }
      }
    }

    // Keep the spawn clearing free of obstacles.
    this.clearArea(76, 90, 7);
  }

  private paintBlob(cx: number, cy: number, rx: number, ry: number, height: number): void {
    for (let ty = Math.max(BORDER_TILES, cy - ry); ty <= Math.min(MAP_TILES - BORDER_TILES - 1, cy + ry); ty++) {
      for (let tx = Math.max(BORDER_TILES, cx - rx); tx <= Math.min(MAP_TILES - BORDER_TILES - 1, cx + rx); tx++) {
        const nx = (tx - cx) / rx;
        const ny = (ty - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;

        const index = ty * MAP_TILES + tx;
        if (height >= this.heights[index]) {
          this.heights[index] = height;
          this.tiles[index] = height >= 2 ? TILE_PLATEAU : TILE_HILL;
        }
      }
    }
  }

  private carveRamps(): void {
    for (let ty = BORDER_TILES + 1; ty < MAP_TILES - BORDER_TILES - 1; ty++) {
      for (let tx = BORDER_TILES + 1; tx < MAP_TILES - BORDER_TILES - 1; tx++) {
        const index = ty * MAP_TILES + tx;
        const height = this.heights[index];
        if (height === 0) continue;

        const neighbours = [
          this.heights[this.indexAt(tx - 1, ty)],
          this.heights[this.indexAt(tx + 1, ty)],
          this.heights[this.indexAt(tx, ty - 1)],
          this.heights[this.indexAt(tx, ty + 1)],
        ];
        const hasLowerNeighbour = neighbours.some((neighbour) => neighbour < height);
        if (!hasLowerNeighbour) continue;

        const roll = this.hash(tx, ty, 7);
        if (roll < 0.42 || (tx + ty) % 13 === 0) {
          this.tiles[index] = TILE_RAMP;
        }
      }
    }
  }

  private paintLake(cx: number, cy: number, rx: number, ry: number): void {
    for (let ty = cy - ry - 2; ty <= cy + ry + 2; ty++) {
      for (let tx = cx - rx - 2; tx <= cx + rx + 2; tx++) {
        if (this.inBorder(tx, ty)) continue;
        const index = this.indexAt(tx, ty);
        if (index < 0) continue;

        const nx = (tx - cx) / rx;
        const ny = (ty - cy) / ry;
        const distance = nx * nx + ny * ny;

        if (distance <= 1) {
          this.tiles[index] = TILE_LAKE;
          this.heights[index] = 0;
        } else if (distance <= 1.32 && this.tiles[index] !== TILE_RIVER) {
          this.tiles[index] = TILE_BANK;
          this.heights[index] = 0;
        }
      }
    }
  }

  private clearArea(cx: number, cy: number, radius: number): void {
    for (let ty = cy - radius; ty <= cy + radius; ty++) {
      for (let tx = cx - radius; tx <= cx + radius; tx++) {
        if (this.inBorder(tx, ty)) continue;
        const index = this.indexAt(tx, ty);
        if (index < 0) continue;
        this.tiles[index] = TILE_GROUND;
        this.heights[index] = 0;
      }
    }
  }

  private generateDecor(): void {
    for (let ty = 0; ty < MAP_TILES; ty++) {
      for (let tx = 0; tx < MAP_TILES; tx++) {
        const index = ty * MAP_TILES + tx;
        const tile = this.tiles[index];
        const roll = this.hash(tx, ty, 99);
        const x = tx * TILE_SIZE + TILE_SIZE / 2 + (this.hash(tx, ty, 100) - 0.5) * 18;
        const y = ty * TILE_SIZE + TILE_SIZE / 2 + (this.hash(tx, ty, 101) - 0.5) * 18;

        if (tile === TILE_BORDER) {
          if (roll < 0.62) {
            this.decor.push({
              kind: 'tree',
              x,
              y,
              scale: 1.5 + this.hash(tx, ty, 102) * 0.9,
              variant: Math.floor(this.hash(tx, ty, 103) * 4),
            });
          }
          continue;
        }

        if (tile === TILE_RIVER || tile === TILE_LAKE) {
          if (roll < 0.075) {
            this.decor.push({
              kind: 'lily',
              x,
              y,
              scale: 0.7 + this.hash(tx, ty, 104) * 0.7,
              variant: Math.floor(this.hash(tx, ty, 105) * 4),
            });
          }
          continue;
        }

        if (tile === TILE_BANK) {
          if (roll < 0.1) {
            this.decor.push({
              kind: 'palm',
              x,
              y,
              scale: 0.8 + this.hash(tx, ty, 106) * 0.6,
              variant: Math.floor(this.hash(tx, ty, 107) * 3),
            });
          } else if (roll < 0.16) {
            this.decor.push({
              kind: 'fern',
              x,
              y,
              scale: 0.7 + this.hash(tx, ty, 108) * 0.5,
              variant: Math.floor(this.hash(tx, ty, 109) * 3),
            });
          }
          continue;
        }

        if (tile === TILE_LOG || tile === TILE_ROCK) {
          this.decor.push({
            kind: tile === TILE_LOG ? 'log' : 'rock',
            x,
            y,
            scale: 0.9 + this.hash(tx, ty, 110) * 0.35,
            variant: Math.floor(this.hash(tx, ty, 111) * 3),
          });
          continue;
        }

        if (roll < 0.018) {
          this.decor.push({
            kind: 'tree',
            x,
            y,
            scale: 0.8 + this.hash(tx, ty, 112) * 0.7,
            variant: Math.floor(this.hash(tx, ty, 113) * 4),
          });
        } else if (roll < 0.032) {
          this.decor.push({
            kind: 'palm',
            x,
            y,
            scale: 0.75 + this.hash(tx, ty, 114) * 0.55,
            variant: Math.floor(this.hash(tx, ty, 115) * 3),
          });
        } else if (roll < 0.05) {
          this.decor.push({
            kind: 'fern',
            x,
            y,
            scale: 0.65 + this.hash(tx, ty, 116) * 0.55,
            variant: Math.floor(this.hash(tx, ty, 117) * 3),
          });
        }
      }
    }
  }

  private generateResources(): void {
    for (let i = 0; i < 120; i++) {
      const point = this.findLandPoint(i * 17 + 5);
      if (!point) continue;
      this.resources.push({
        kind: i % 2 === 0 ? 'fruit' : 'flower',
        x: point.x,
        y: point.y,
        variant: this.hash(Math.floor(point.x), Math.floor(point.y), 200),
        cooldown: 0,
      });
    }
  }

  private findLandPoint(seed: number): { x: number; y: number } | null {
    for (let attempt = 0; attempt < 40; attempt++) {
      const tx =
        BORDER_TILES +
        1 +
        Math.floor(this.hash(seed, attempt, 201) * (MAP_TILES - BORDER_TILES * 2 - 2));
      const ty =
        BORDER_TILES +
        1 +
        Math.floor(this.hash(seed, attempt, 202) * (MAP_TILES - BORDER_TILES * 2 - 2));
      const index = this.indexAt(tx, ty);
      if (index < 0) continue;

      const tile = this.tiles[index];
      if (
        tile === TILE_GROUND ||
        tile === TILE_HILL ||
        tile === TILE_PLATEAU ||
        tile === TILE_RAMP
      ) {
        return {
          x: tx * TILE_SIZE + TILE_SIZE / 2,
          y: ty * TILE_SIZE + TILE_SIZE / 2,
        };
      }
    }
    return null;
  }

  public getSpawnPoint(): { x: number; y: number } {
    return { x: WORLD_SIZE * 0.42, y: WORLD_SIZE * 0.5 };
  }

  public getBiomeAt(worldX: number, worldY: number): BiomeType {
    const tx = Math.floor(worldX / TILE_SIZE);
    const ty = Math.floor(worldY / TILE_SIZE);
    const index = this.indexAt(tx, ty);
    if (index < 0) return 'mata';

    const tile = this.tiles[index];
    if (tile === TILE_RIVER || tile === TILE_LAKE) return 'agua';
    if (tile === TILE_BANK) return 'margem';

    for (let oy = -2; oy <= 2; oy++) {
      for (let ox = -2; ox <= 2; ox++) {
        const neighbour = this.indexAt(tx + ox, ty + oy);
        if (neighbour < 0) continue;
        const neighbourTile = this.tiles[neighbour];
        if (neighbourTile === TILE_RIVER || neighbourTile === TILE_LAKE) {
          return 'margem';
        }
      }
    }

    return this.heights[index] >= 1 ? 'plato' : 'mata';
  }

  public isWaterAt(worldX: number, worldY: number): boolean {
    const index = this.indexAt(
      Math.floor(worldX / TILE_SIZE),
      Math.floor(worldY / TILE_SIZE)
    );
    if (index < 0) return false;
    return this.tiles[index] === TILE_RIVER || this.tiles[index] === TILE_LAKE;
  }

  public getHeightAtWorld(worldX: number, worldY: number): number {
    const index = this.indexAt(
      Math.floor(worldX / TILE_SIZE),
      Math.floor(worldY / TILE_SIZE)
    );
    if (index < 0) return 0;
    return this.heights[index];
  }

  public getMovementSpeedMultiplier(worldX: number, worldY: number, jumping: boolean): number {
    if (jumping) return 1.1;
    return this.isWaterAt(worldX, worldY) ? 0.55 : 1;
  }

  public clampSpawnPoint(worldX: number, worldY: number): { x: number; y: number } {
    const margin = BORDER_TILES * TILE_SIZE + TILE_SIZE;
    let x = Math.max(margin, Math.min(WORLD_SIZE - margin, worldX));
    let y = Math.max(margin, Math.min(WORLD_SIZE - margin, worldY));

    for (let attempt = 0; attempt < 12; attempt++) {
      const index = this.indexAt(
        Math.floor(x / TILE_SIZE),
        Math.floor(y / TILE_SIZE)
      );
      if (index < 0) break;
      const tile = this.tiles[index];
      if (tile !== TILE_BORDER && tile !== TILE_LOG && tile !== TILE_ROCK) {
        return { x, y };
      }
      x += (WORLD_SIZE / 2 - x) * 0.08;
      y += (WORLD_SIZE / 2 - y) * 0.08;
    }

    return this.getSpawnPoint();
  }

  public resolvePlayerMovement(player: Player, previousX: number, previousY: number): void {
    if (this.canWalkAt(player.x, player.y, previousX, previousY, player.isJumping)) {
      player.groundHeight = this.getHeightAtWorld(player.x, player.y);
      return;
    }

    player.x = previousX;
    player.y = previousY;
    player.groundHeight = this.getHeightAtWorld(previousX, previousY);
  }

  private canWalkAt(
    worldX: number,
    worldY: number,
    previousX: number,
    previousY: number,
    jumping: boolean
  ): boolean {
    const tx = Math.floor(worldX / TILE_SIZE);
    const ty = Math.floor(worldY / TILE_SIZE);
    const index = this.indexAt(tx, ty);
    if (index < 0) return false;

    const tile = this.tiles[index];
    if (tile === TILE_BORDER) return false;
    if ((tile === TILE_LOG || tile === TILE_ROCK) && !jumping) return false;

    const previousIndex = this.indexAt(
      Math.floor(previousX / TILE_SIZE),
      Math.floor(previousY / TILE_SIZE)
    );
    if (previousIndex < 0) return true;

    const heightDelta = this.heights[index] - this.heights[previousIndex];
    if (heightDelta === 0) return true;
    if (jumping) return true;

    return this.tiles[index] === TILE_RAMP || this.tiles[previousIndex] === TILE_RAMP;
  }

  public update(
    dt: number,
    player: Player,
    onPickup?: (x: number, y: number, color: string, text: string) => void
  ): void {
    this.elapsed += dt;

    for (let i = 0; i < this.resources.length; i++) {
      const resource = this.resources[i];
      if (resource.cooldown > 0) {
        resource.cooldown -= dt;
        continue;
      }

      const dx = player.x - resource.x;
      const dy = player.y - resource.y;
      const pickupRadius = player.radius + 24;
      if (dx * dx + dy * dy > pickupRadius * pickupRadius) continue;

      if (resource.kind === 'fruit') {
        player.heal(18);
        onPickup?.(resource.x, resource.y, '#22c55e', '+18');
      } else {
        const kind =
          resource.variant < 0.34 ? 'speed' : resource.variant < 0.67 ? 'might' : 'armor';
        player.applyFlowerBuff(kind);
        const label = kind === 'speed' ? 'VELOCIDADE' : kind === 'might' ? 'FORÇA' : 'ARMADURA';
        onPickup?.(resource.x, resource.y, '#facc15', label);
      }

      resource.cooldown = 24;
    }
  }

  renderFloor(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const viewportWidth = camera.viewportWidth;
    const viewportHeight = camera.viewportHeight;

    ctx.fillStyle = '#0a140e';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    const left = camera.x - viewportWidth / 2 - TILE_SIZE;
    const right = camera.x + viewportWidth / 2 + TILE_SIZE;
    const top = camera.y - viewportHeight / 2 - TILE_SIZE;
    const bottom = camera.y + viewportHeight / 2 + TILE_SIZE;

    const startX = Math.max(0, Math.floor(left / TILE_SIZE));
    const endX = Math.min(MAP_TILES - 1, Math.ceil(right / TILE_SIZE));
    const startY = Math.max(0, Math.floor(top / TILE_SIZE));
    const endY = Math.min(MAP_TILES - 1, Math.ceil(bottom / TILE_SIZE));

    for (let ty = startY; ty <= endY; ty++) {
      for (let tx = startX; tx <= endX; tx++) {
        const index = ty * MAP_TILES + tx;
        const tile = this.tiles[index];
        const height = this.heights[index];
        const screen = camera.worldToScreen(tx * TILE_SIZE, ty * TILE_SIZE);
        const drawX = Math.floor(screen.x);
        const drawY = Math.floor(screen.y - height * ELEVATION_PIXELS);

        ctx.fillStyle = this.tileColor(tile, tx, ty);
        ctx.fillRect(drawX, drawY, TILE_SIZE + 1, TILE_SIZE + 1);

        if (tile === TILE_GROUND || tile === TILE_HILL || tile === TILE_PLATEAU) {
          if (this.hash(tx, ty, 17) < 0.55) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
            ctx.fillRect(drawX + 10, drawY + 14, 7, 4);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.055)';
            ctx.fillRect(drawX + 38, drawY + 40, 9, 5);
          }
        } else if (tile === TILE_RIVER || tile === TILE_LAKE) {
          const wave = Math.sin(this.elapsed * 2 + tx * 0.7 + ty * 0.4);
          ctx.strokeStyle = 'rgba(214, 198, 148, 0.18)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(drawX + 8, drawY + 20 + wave * 3);
          ctx.lineTo(drawX + TILE_SIZE - 10, drawY + 20 + wave * 3);
          ctx.moveTo(drawX + 16, drawY + 44 - wave * 2);
          ctx.lineTo(drawX + TILE_SIZE - 16, drawY + 44 - wave * 2);
          ctx.stroke();
        } else if (tile === TILE_RAMP) {
          ctx.strokeStyle = 'rgba(63, 42, 20, 0.35)';
          ctx.lineWidth = 2;
          for (let stripe = 0; stripe < 3; stripe++) {
            ctx.beginPath();
            ctx.moveTo(drawX + 6 + stripe * 18, drawY + 10);
            ctx.lineTo(drawX + 20 + stripe * 18, drawY + TILE_SIZE - 10);
            ctx.stroke();
          }
        } else if (tile === TILE_BANK) {
          ctx.fillStyle = 'rgba(255, 240, 190, 0.08)';
          ctx.fillRect(drawX + 12, drawY + 22, 5, 4);
          ctx.fillRect(drawX + 42, drawY + 48, 4, 3);
        }

        const southIndex = this.indexAt(tx, ty + 1);
        if (height > 0 && southIndex >= 0 && this.heights[southIndex] < height) {
          ctx.fillStyle = this.sideColor(tile);
          ctx.fillRect(
            drawX,
            drawY + TILE_SIZE,
            TILE_SIZE + 1,
            (height - this.heights[southIndex]) * ELEVATION_PIXELS
          );
        }

        if (height > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
          ctx.fillRect(drawX, drawY, TILE_SIZE + 1, 2);
        }

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.045)';
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX, drawY, TILE_SIZE + 1, TILE_SIZE + 1);
      }
    }
  }

  private tileColor(tile: number, tx: number, ty: number): string {
    const variation = this.hash(tx, ty, 5);

    switch (tile) {
      case TILE_HILL:
        return variation < 0.5 ? '#3d6b37' : '#426f39';
      case TILE_PLATEAU:
        return variation < 0.5 ? '#4d773d' : '#527c41';
      case TILE_RAMP:
        return variation < 0.5 ? '#85673d' : '#8d6d41';
      case TILE_RIVER:
        return variation < 0.5 ? '#665635' : '#6d5c39';
      case TILE_LAKE:
        return variation < 0.5 ? '#4a5a40' : '#506148';
      case TILE_BANK:
        return variation < 0.5 ? '#7a6744' : '#816d48';
      case TILE_BORDER:
        return variation < 0.5 ? '#14261a' : '#182b1d';
      default:
        return variation < 0.33 ? '#2b5231' : variation < 0.66 ? '#305a35' : '#35623a';
    }
  }

  private sideColor(tile: number): string {
    switch (tile) {
      case TILE_PLATEAU:
        return '#365026';
      case TILE_HILL:
        return '#2f4a2a';
      case TILE_RAMP:
        return '#614a2b';
      default:
        return '#1d3020';
    }
  }

  renderProps(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (let i = 0; i < this.decor.length; i++) {
      const prop = this.decor[i];
      if (!camera.isInView(prop.x, prop.y, 180)) continue;
      this.drawDecor(ctx, camera, prop);
    }

    for (let i = 0; i < this.resources.length; i++) {
      const resource = this.resources[i];
      if (!camera.isInView(resource.x, resource.y, 80)) continue;
      this.drawResource(ctx, camera, resource);
    }
  }

  private drawDecor(ctx: CanvasRenderingContext2D, camera: Camera, prop: DecorProp): void {
    const screen = camera.worldToScreen(prop.x, prop.y);
    const elevation = this.getHeightAtWorld(prop.x, prop.y) * ELEVATION_PIXELS;

    ctx.save();
    ctx.translate(Math.floor(screen.x), Math.floor(screen.y - elevation));

    if (prop.kind === 'tree') {
      this.drawTree(ctx, prop.scale, prop.variant);
    } else if (prop.kind === 'palm') {
      this.drawPalm(ctx, prop.scale, prop.variant);
    } else if (prop.kind === 'fern') {
      this.drawFern(ctx, prop.scale, prop.variant);
    } else if (prop.kind === 'lily') {
      this.drawLily(ctx, prop.scale, prop.variant);
    } else if (prop.kind === 'log') {
      this.drawLog(ctx, prop.scale);
    } else {
      this.drawRock(ctx, prop.scale);
    }

    ctx.restore();
  }

  private drawTree(ctx: CanvasRenderingContext2D, scale: number, variant: number): void {
    const canopies = ['#1f4d2a', '#245c2f', '#2c6b35', '#1a4525'];
    const canopy = canopies[variant % canopies.length];

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 17 * scale, 7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4a2f1b';
    ctx.fillRect(-3 * scale, -26 * scale, 6 * scale, 29 * scale);

    ctx.fillStyle = canopy;
    ctx.beginPath();
    ctx.arc(-8 * scale, -32 * scale, 13 * scale, 0, Math.PI * 2);
    ctx.arc(8 * scale, -34 * scale, 14 * scale, 0, Math.PI * 2);
    ctx.arc(0, -46 * scale, 16 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(120, 190, 90, 0.18)';
    ctx.beginPath();
    ctx.arc(-4 * scale, -50 * scale, 8 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPalm(ctx: CanvasRenderingContext2D, scale: number, variant: number): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 12 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 4 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.quadraticCurveTo(-2 * scale, -18 * scale, 4 * scale, -38 * scale);
    ctx.stroke();

    ctx.strokeStyle = variant === 1 ? '#2f6b36' : '#3f7a36';
    ctx.lineWidth = 3 * scale;
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI + (i * Math.PI) / 4.5;
      ctx.beginPath();
      ctx.moveTo(4 * scale, -38 * scale);
      ctx.quadraticCurveTo(
        4 * scale + Math.cos(angle) * 18 * scale,
        -46 * scale + Math.sin(angle) * 8 * scale,
        4 * scale + Math.cos(angle) * 28 * scale,
        -38 * scale + Math.sin(angle) * 16 * scale
      );
      ctx.stroke();
    }
  }

  private drawFern(ctx: CanvasRenderingContext2D, scale: number, variant: number): void {
    const color = variant === 1 ? '#3f7a3a' : '#477f3b';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 * scale;
    ctx.lineCap = 'round';

    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (i - 2) * 0.42;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(
        Math.cos(angle) * 12 * scale,
        -10 * scale,
        Math.cos(angle) * 22 * scale,
        -8 * scale + Math.sin(angle) * 6 * scale
      );
      ctx.stroke();
    }
  }

  private drawLily(ctx: CanvasRenderingContext2D, scale: number, variant: number): void {
    ctx.fillStyle = 'rgba(40, 80, 42, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12 * scale, 7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5f8f4a';
    ctx.beginPath();
    ctx.ellipse(0, -1, 10 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (variant > 1) {
      ctx.fillStyle = variant === 2 ? '#f9a8d4' : '#fef3c7';
      ctx.beginPath();
      ctx.arc(2 * scale, -5 * scale, 4 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawLog(ctx: CanvasRenderingContext2D, scale: number): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 22 * scale, 7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4d3220';
    ctx.beginPath();
    ctx.roundRect(-22 * scale, -7 * scale, 44 * scale, 14 * scale, 6 * scale);
    ctx.fill();
    ctx.fillStyle = '#6b4b2e';
    ctx.beginPath();
    ctx.ellipse(19 * scale, 0, 5 * scale, 7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3b2616';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(19 * scale, 0, 2.5 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawRock(ctx: CanvasRenderingContext2D, scale: number): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 18 * scale, 6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.ellipse(-4 * scale, -3 * scale, 8 * scale, 4.5 * scale, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawResource(ctx: CanvasRenderingContext2D, camera: Camera, resource: ResourceProp): void {
    const screen = camera.worldToScreen(resource.x, resource.y);
    const elevation = this.getHeightAtWorld(resource.x, resource.y) * ELEVATION_PIXELS;
    const ready = resource.cooldown <= 0;

    ctx.save();
    ctx.translate(Math.floor(screen.x), Math.floor(screen.y - elevation));
    ctx.globalAlpha = ready ? 1 : 0.45;

    if (resource.kind === 'fruit') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
      ctx.beginPath();
      ctx.ellipse(0, 1, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a2f1b';
      ctx.fillRect(-2.5, -22, 5, 24);
      ctx.fillStyle = '#2d6a35';
      ctx.beginPath();
      ctx.arc(-5, -27, 11, 0, Math.PI * 2);
      ctx.arc(6, -29, 12, 0, Math.PI * 2);
      ctx.arc(0, -37, 12, 0, Math.PI * 2);
      ctx.fill();

      if (ready) {
        const fruits = ['#f59e0b', '#ef4444', '#fbbf24'];
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = fruits[i % fruits.length];
          const angle = (i * Math.PI) / 2;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * 8, -28 + Math.sin(angle) * 5, 2.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      const pulse = 1 + Math.sin(this.elapsed * 3 + resource.variant * 6) * 0.12;
      const glow = ctx.createRadialGradient(0, -10, 2, 0, -10, 20 * pulse);
      glow.addColorStop(0, ready ? 'rgba(250, 204, 21, 0.38)' : 'rgba(250, 204, 21, 0.08)');
      glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -10, 20 * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#3f7a36';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(0, -12);
      ctx.stroke();

      if (ready) {
        const petal =
          resource.variant < 0.34 ? '#38bdf8' : resource.variant < 0.67 ? '#f97316' : '#eab308';
        ctx.fillStyle = petal;
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5;
          ctx.beginPath();
          ctx.ellipse(
            Math.cos(angle) * 6,
            -14 + Math.sin(angle) * 6,
            5,
            3.5,
            angle,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(0, -14, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  public clear(): void {
    this.resources.forEach((resource) => {
      resource.cooldown = 0;
    });
    this.elapsed = 0;
  }
}
