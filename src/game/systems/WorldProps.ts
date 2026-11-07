import { Camera } from '../engine/Camera';
import { Player } from '../entities/Player';
import { Drop } from '../entities/Drops';
import { DropType, MapId } from '../types';

// The night plain is effectively open, so this is only a large safety limit
// that prevents the player from wandering out of the coordinate space.
const WORLD_HALF_SIZE = 100000;
// The Amazon Forest is a finite 14000x14000 map centered on the origin.
const FOREST_SIZE = 14000;
const FOREST_HALF_SIZE = FOREST_SIZE / 2;
const COLLISION_STEP = 8;

// Decorative Amazon water. The river and lakes do not affect player movement,
// but the aquatic fauna is locked to the river band.
const RIVER_WIDTH = 980;
const RIVER_BANK = 150;
const RIVER_HALF_WIDTH = RIVER_WIDTH / 2;

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

interface FloorPatch {
  x: number;
  y: number;
  rx: number;
  ry: number;
  tone: number;
  rotation: number;
}

interface LakeProp {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
}

interface LilyProp {
  x: number;
  y: number;
  size: number;
  tone: number;
  rotation: number;
}

interface PalmProp {
  x: number;
  y: number;
  size: number;
  tone: number;
  lean: number;
}

interface FernProp {
  x: number;
  y: number;
  size: number;
  tone: number;
  rotation: number;
}

interface RockProp {
  x: number;
  y: number;
  size: number;
  tone: number;
  rotation: number;
}

export class WorldSystem {
  public torches: TorchProp[] = [];
  private nextTorchId: number = 1;
  private torchSpawnTimer: number = 0;
  private maxTorches: number = 6;
  private readonly torchSpawnInterval: number = 13;

  private mapId: MapId;
  private worldHalfSize: number = WORLD_HALF_SIZE;
  private trees: TreeProp[] = [];
  private floorPatches: FloorPatch[] = [];
  private lakes: LakeProp[] = [];
  private lilies: LilyProp[] = [];
  private palms: PalmProp[] = [];
  private ferns: FernProp[] = [];
  private rocks: RockProp[] = [];

  private floorImage: HTMLImageElement | null = null;
  private floorPattern: CanvasPattern | null = null;

  constructor(mapId: MapId = 'night_plain') {
    this.mapId = mapId;
    if (mapId === 'amazon_forest') {
      this.worldHalfSize = FOREST_HALF_SIZE;
      this.generateForest();
    }
    this.loadFloorTexture();
  }

  private generateForest(): void {
    // Deterministic scatter so the forest looks the same between renders.
    let seed = 1337;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Scattered trees inside the playable area.
    for (let i = 0; i < 80; i++) {
      const x = (random() - 0.5) * FOREST_SIZE * 0.86;
      const y = (random() - 0.5) * FOREST_SIZE * 0.86;
      // Keep the spawn area clear.
      if (Math.abs(x) < 180 && Math.abs(y) < 180) continue;
      this.trees.push({
        x,
        y,
        size: 26 + random() * 26,
        tone: random(),
      });
    }

    // Dense, solid wall of giant Amazon trees around the four edges.
    // Three overlapping rows make the border read as impenetrable forest.
    const spacing = 72;
    const rows = [0, 78, 156];
    for (let r = 0; r < rows.length; r++) {
      const offset = FOREST_HALF_SIZE - rows[r];
      for (let d = -FOREST_HALF_SIZE; d <= FOREST_HALF_SIZE; d += spacing) {
        const size = 150 + random() * 100;
        const jitter = () => (random() - 0.5) * 16;

        // Top and bottom edges.
        this.trees.push({ x: d + jitter(), y: -offset + jitter(), size, tone: random() });
        this.trees.push({ x: d + jitter(), y: offset + jitter(), size, tone: random() });

        // Left and right edges.
        this.trees.push({ x: -offset + jitter(), y: d + jitter(), size, tone: random() });
        this.trees.push({ x: offset + jitter(), y: d + jitter(), size, tone: random() });
      }
    }

    // Dirt patches over the dark green grass floor.
    for (let i = 0; i < 140; i++) {
      this.floorPatches.push({
        x: (random() - 0.5) * FOREST_SIZE,
        y: (random() - 0.5) * FOREST_SIZE,
        rx: 30 + random() * 120,
        ry: 18 + random() * 80,
        tone: random(),
        rotation: random() * Math.PI,
      });
    }

    // Two lakes to break up the green floor.
    this.lakes = [
      { x: -4000, y: -3600, rx: 1650, ry: 1050, rotation: -0.22 },
      { x: 4100, y: 3500, rx: 1400, ry: 950, rotation: 0.35 },
    ];

    // Floating water lilies along the river...
    for (let i = 0; i < 55; i++) {
      const x = (random() - 0.5) * FOREST_SIZE * 0.92;
      const y = this.riverCenterY(x) + (random() - 0.5) * RIVER_WIDTH * 0.78;
      this.lilies.push({
        x,
        y,
        size: 6 + random() * 10,
        tone: random(),
        rotation: random() * Math.PI * 2,
      });
    }

    // ...and inside both lakes.
    for (let l = 0; l < this.lakes.length; l++) {
      const lake = this.lakes[l];
      for (let i = 0; i < 24; i++) {
        const angle = random() * Math.PI * 2;
        const dist = Math.sqrt(random()) * 0.78;
        const lx = Math.cos(angle) * lake.rx * dist;
        const ly = Math.sin(angle) * lake.ry * dist;
        const cos = Math.cos(lake.rotation);
        const sin = Math.sin(lake.rotation);
        this.lilies.push({
          x: lake.x + lx * cos - ly * sin,
          y: lake.y + lx * sin + ly * cos,
          size: 6 + random() * 10,
          tone: random(),
          rotation: random() * Math.PI * 2,
        });
      }
    }

    // Palm trees, ferns and decorative rocks scattered over the dry ground.
    const scatter = (attempts: number, place: (x: number, y: number) => void) => {
      for (let i = 0; i < attempts; i++) {
        const x = (random() - 0.5) * FOREST_SIZE * 0.86;
        const y = (random() - 0.5) * FOREST_SIZE * 0.86;
        if (Math.abs(x) < 220 && Math.abs(y) < 220) continue;
        if (this.isInWater(x, y)) continue;
        place(x, y);
      }
    };

    scatter(30, (x, y) => {
      this.palms.push({
        x,
        y,
        size: 44 + random() * 34,
        tone: random(),
        lean: (random() - 0.5) * 0.55,
      });
    });

    scatter(70, (x, y) => {
      this.ferns.push({
        x,
        y,
        size: 12 + random() * 14,
        tone: random(),
        rotation: random() * Math.PI * 2,
      });
    });

    scatter(45, (x, y) => {
      this.rocks.push({
        x,
        y,
        size: 10 + random() * 16,
        tone: random(),
        rotation: random() * Math.PI * 2,
      });
    });
  }

  private riverCenterY(x: number): number {
    return (
      Math.sin((x / FOREST_SIZE) * Math.PI * 1.6) * 1450 +
      Math.sin(x / 1600) * 240
    );
  }

  private isInWater(x: number, y: number): boolean {
    // River band.
    if (Math.abs(y - this.riverCenterY(x)) < RIVER_HALF_WIDTH + 60) return true;

    // Lakes (rotated ellipses).
    for (let i = 0; i < this.lakes.length; i++) {
      const lake = this.lakes[i];
      const dx = x - lake.x;
      const dy = y - lake.y;
      const cos = Math.cos(-lake.rotation);
      const sin = Math.sin(-lake.rotation);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if ((lx * lx) / (lake.rx * lake.rx) + (ly * ly) / (lake.ry * lake.ry) <= 1.08) {
        return true;
      }
    }

    return false;
  }

  /** Water covering the river or the Amazon lakes. */
  public isWaterAt(x: number, y: number): boolean {
    return this.isInWater(x, y);
  }

  /** The river itself, where the four aquatic animals must stay. */
  public isInRiver(x: number, y: number): boolean {
    return Math.abs(y - this.riverCenterY(x)) <= RIVER_HALF_WIDTH;
  }

  public getRiverCenterY(x: number): number {
    return this.riverCenterY(x);
  }

  public getRiverHalfWidth(): number {
    return RIVER_HALF_WIDTH;
  }

  public getForestHalfSize(): number {
    return FOREST_HALF_SIZE;
  }

  /**
   * World span (in world units) shown across the minimap. For the finite
   * Amazon map this covers about 30% of the total map area; the night plain
   * has no real bounds, so a practical radar range is used instead.
   */
  public getMinimapViewSpan(): number {
    if (this.mapId === 'amazon_forest') {
      return FOREST_SIZE * Math.sqrt(0.3);
    }
    return 2600;
  }

  /**
   * Draws the scenery layer (river, lakes and the map-edge tree wall) inside
   * the minimap. The minimap square is already clipped by the caller.
   */
  public renderMinimapScenery(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    viewRadius: number,
    originX: number,
    originY: number,
    size: number
  ): void {
    if (this.mapId !== 'amazon_forest') return;

    const scale = size / (viewRadius * 2);
    const half = size / 2;
    const toX = (worldX: number) => originX + half + (worldX - centerX) * scale;
    const toY = (worldY: number) => originY + half + (worldY - centerY) * scale;

    // Map boundary (the dense tree wall sits just inside it).
    ctx.strokeStyle = 'rgba(134, 239, 172, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      toX(-FOREST_HALF_SIZE),
      toY(-FOREST_HALF_SIZE),
      FOREST_SIZE * scale,
      FOREST_SIZE * scale
    );

    // Water never paints outside the finite forest bounds.
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      toX(-FOREST_HALF_SIZE),
      toY(-FOREST_HALF_SIZE),
      FOREST_SIZE * scale,
      FOREST_SIZE * scale
    );
    ctx.clip();

    // River band, with its sandy bank and water surface.
    const step = Math.max(60, viewRadius / 24);
    const start = centerX - viewRadius - step;
    const end = centerX + viewRadius + step;
    const traceRiver = () => {
      ctx.beginPath();
      for (let x = start; x <= end; x += step) {
        const y = this.riverCenterY(x);
        if (x === start) ctx.moveTo(toX(x), toY(y));
        else ctx.lineTo(toX(x), toY(y));
      }
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    traceRiver();
    ctx.strokeStyle = 'rgba(216, 188, 130, 0.65)';
    ctx.lineWidth = Math.max(2, (RIVER_WIDTH + RIVER_BANK * 2) * scale);
    ctx.stroke();

    traceRiver();
    ctx.strokeStyle = 'rgba(43, 139, 161, 0.95)';
    ctx.lineWidth = Math.max(1.5, RIVER_WIDTH * scale);
    ctx.stroke();

    // Lakes.
    for (let i = 0; i < this.lakes.length; i++) {
      const lake = this.lakes[i];
      const dx = lake.x - centerX;
      const dy = lake.y - centerY;
      if (Math.abs(dx) > viewRadius + lake.rx || Math.abs(dy) > viewRadius + lake.ry) continue;

      ctx.save();
      ctx.translate(toX(lake.x), toY(lake.y));
      ctx.rotate(lake.rotation);

      ctx.fillStyle = 'rgba(216, 188, 130, 0.65)';
      ctx.beginPath();
      ctx.ellipse(0, 0, (lake.rx + RIVER_BANK) * scale, (lake.ry + RIVER_BANK * 0.85) * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(43, 139, 161, 0.95)';
      ctx.beginPath();
      ctx.ellipse(0, 0, lake.rx * scale, lake.ry * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();

    // Dense wall of trees around the map limit.
    const borderTrees = this.trees;
    ctx.fillStyle = 'rgba(22, 101, 52, 0.95)';
    for (let i = 0; i < borderTrees.length; i++) {
      const tree = borderTrees[i];
      if (
        Math.abs(tree.x) < FOREST_HALF_SIZE - 320 &&
        Math.abs(tree.y) < FOREST_HALF_SIZE - 320
      ) {
        continue;
      }
      if (Math.abs(tree.x - centerX) > viewRadius + 300) continue;
      if (Math.abs(tree.y - centerY) > viewRadius + 300) continue;

      const dotSize = tree.size > 120 ? 2 : 1.5;
      ctx.fillRect(toX(tree.x) - dotSize / 2, toY(tree.y) - dotSize / 2, dotSize, dotSize);
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

  /**
   * Moves the player by (dx, dy) while preventing it from crossing trees or
   * leaving the playable area. The movement is sub-stepped so fast impulses
   * (such as the dash) cannot tunnel through obstacles.
   */
  public resolvePlayerMovement(
    fromX: number,
    fromY: number,
    dx: number,
    dy: number,
    radius: number
  ): { x: number; y: number } {
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.0001) return { x: fromX, y: fromY };

    const steps = Math.max(1, Math.ceil(distance / COLLISION_STEP));
    const stepX = dx / steps;
    const stepY = dy / steps;
    const limit = this.worldHalfSize - radius;
    let x = fromX;
    let y = fromY;

    for (let i = 0; i < steps; i++) {
      // Resolve each axis independently so the player can slide along props.
      const nextX = Math.max(-limit, Math.min(limit, x + stepX));
      if (!this.collidesWithTree(nextX, y, radius)) x = nextX;

      const nextY = Math.max(-limit, Math.min(limit, y + stepY));
      if (!this.collidesWithTree(x, nextY, radius)) y = nextY;
    }

    return { x, y };
  }

  private collidesWithTree(x: number, y: number, radius: number): boolean {
    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];
      const treeRadius = tree.size * 0.32;
      const minDist = radius + treeRadius;
      const dx = x - tree.x;
      const dy = y - tree.y;
      if (dx * dx + dy * dy < minDist * minDist) return true;
    }
    return false;
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
      // Deep darkness outside the finite map bounds.
      ctx.fillStyle = '#08120b';
      ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);

      // Dark green grass base restricted to the 14000x14000 playable square.
      const origin = camera.worldToScreen(-FOREST_HALF_SIZE, -FOREST_HALF_SIZE);
      ctx.fillStyle = '#14351d';
      ctx.fillRect(origin.x, origin.y, FOREST_SIZE, FOREST_SIZE);

      for (let i = 0; i < this.floorPatches.length; i++) {
        const patch = this.floorPatches[i];
        const margin = Math.max(patch.rx, patch.ry) + 20;
        if (!camera.isInView(patch.x, patch.y, margin)) continue;

        const screen = camera.worldToScreen(patch.x, patch.y);
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(patch.rotation);

        ctx.fillStyle = patch.tone > 0.5 ? '#5a3a20' : '#69482a';
        ctx.beginPath();
        ctx.ellipse(0, 0, patch.rx, patch.ry, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lighter, drier center gives the dirt some depth.
        ctx.fillStyle = 'rgba(126, 88, 50, 0.55)';
        ctx.beginPath();
        ctx.ellipse(
          patch.rx * 0.08,
          -patch.ry * 0.12,
          patch.rx * 0.55,
          patch.ry * 0.5,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
      }

      this.renderAmazonWater(ctx, camera);
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

  private renderAmazonWater(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const start = -FOREST_HALF_SIZE - 1200;
    const end = FOREST_HALF_SIZE + 1200;
    const step = 220;

    ctx.save();
    ctx.translate(
      camera.viewportWidth / 2 - camera.x + camera.shakeOffsetX,
      camera.viewportHeight / 2 - camera.y + camera.shakeOffsetY
    );

    // Keep the water inside the playable map; the rest stays dark forest.
    ctx.beginPath();
    ctx.rect(-FOREST_HALF_SIZE, -FOREST_HALF_SIZE, FOREST_SIZE, FOREST_SIZE);
    ctx.clip();

    const traceRiver = () => {
      ctx.beginPath();
      for (let x = start; x <= end; x += step) {
        const y = this.riverCenterY(x);
        if (x === start) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Sandy banks around the river.
    traceRiver();
    ctx.strokeStyle = '#b89355';
    ctx.lineWidth = RIVER_WIDTH + RIVER_BANK * 2;
    ctx.stroke();

    traceRiver();
    ctx.strokeStyle = '#d8bc82';
    ctx.lineWidth = RIVER_WIDTH + RIVER_BANK * 0.85;
    ctx.stroke();

    // Water surface with a lighter current down the middle.
    traceRiver();
    ctx.strokeStyle = '#1b6b82';
    ctx.lineWidth = RIVER_WIDTH;
    ctx.stroke();

    traceRiver();
    ctx.strokeStyle = '#2b8ba1';
    ctx.lineWidth = RIVER_WIDTH - 160;
    ctx.stroke();

    // Two lakes, each with its own sand rim.
    for (let i = 0; i < this.lakes.length; i++) {
      const lake = this.lakes[i];
      const margin = Math.max(lake.rx, lake.ry) + RIVER_BANK + 30;
      if (!camera.isInView(lake.x, lake.y, margin)) continue;

      ctx.save();
      ctx.translate(lake.x, lake.y);
      ctx.rotate(lake.rotation);

      ctx.fillStyle = '#b89355';
      ctx.beginPath();
      ctx.ellipse(0, 0, lake.rx + RIVER_BANK, lake.ry + RIVER_BANK * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#d8bc82';
      ctx.beginPath();
      ctx.ellipse(0, 0, lake.rx + RIVER_BANK * 0.5, lake.ry + RIVER_BANK * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1b6b82';
      ctx.beginPath();
      ctx.ellipse(0, 0, lake.rx, lake.ry, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#2b8ba1';
      ctx.beginPath();
      ctx.ellipse(0, 0, lake.rx * 0.82, lake.ry * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();

      // Soft highlight on the water.
      ctx.strokeStyle = 'rgba(170, 230, 240, 0.22)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.ellipse(lake.rx * 0.12, -lake.ry * 0.28, lake.rx * 0.55, lake.ry * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // Floating water lilies.
    for (let i = 0; i < this.lilies.length; i++) {
      const lily = this.lilies[i];
      if (!camera.isInView(lily.x, lily.y, lily.size + 10)) continue;

      ctx.save();
      ctx.translate(lily.x, lily.y);
      ctx.rotate(lily.rotation);

      // Pad with a small notch.
      ctx.fillStyle = lily.tone > 0.5 ? '#2f7d32' : '#3d8f3f';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, lily.size, 0.32, Math.PI * 2 - 0.32);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(140, 205, 100, 0.35)';
      ctx.beginPath();
      ctx.ellipse(-lily.size * 0.15, -lily.size * 0.18, lily.size * 0.5, lily.size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // A few pads carry a small flower.
      if (lily.tone > 0.72) {
        ctx.fillStyle = '#f9a8d4';
        ctx.beginPath();
        ctx.arc(0, 0, lily.size * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(0, 0, lily.size * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private renderAmazonDecorations(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Decorative rocks.
    for (let i = 0; i < this.rocks.length; i++) {
      const rock = this.rocks[i];
      if (!camera.isInView(rock.x, rock.y, rock.size + 20)) continue;

      const screen = camera.worldToScreen(rock.x, rock.y);
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(rock.rotation);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, rock.size * 0.35, rock.size * 1.1, rock.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = rock.tone > 0.5 ? '#6b7280' : '#57606a';
      ctx.beginPath();
      ctx.ellipse(0, 0, rock.size, rock.size * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(209, 213, 219, 0.35)';
      ctx.beginPath();
      ctx.ellipse(-rock.size * 0.22, -rock.size * 0.2, rock.size * 0.5, rock.size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Ferns fanning out from a short stem.
    for (let i = 0; i < this.ferns.length; i++) {
      const fern = this.ferns[i];
      if (!camera.isInView(fern.x, fern.y, fern.size * 2 + 20)) continue;

      const screen = camera.worldToScreen(fern.x, fern.y);
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(fern.rotation);

      ctx.fillStyle = fern.tone > 0.5 ? '#1f7a3d' : '#2d8a4a';
      const leaves = 6;
      for (let l = 0; l < leaves; l++) {
        const spread = -1.15 + (l / (leaves - 1)) * 2.3;
        ctx.save();
        ctx.rotate(spread);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(fern.size * 0.55, -fern.size * 0.9, 0, -fern.size * 2);
        ctx.quadraticCurveTo(-fern.size * 0.55, -fern.size * 0.9, 0, 0);
        ctx.fill();
        ctx.restore();
      }

      ctx.strokeStyle = '#166534';
      ctx.lineWidth = Math.max(1, fern.size * 0.1);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -fern.size * 0.8);
      ctx.stroke();

      ctx.restore();
    }

    // Palm trees: curved trunk plus a crown of fronds.
    for (let i = 0; i < this.palms.length; i++) {
      const palm = this.palms[i];
      if (!camera.isInView(palm.x, palm.y, palm.size * 3)) continue;

      const screen = camera.worldToScreen(palm.x, palm.y);
      const size = palm.size;
      const topX = palm.lean * size * 1.9;
      const topY = -size * 2.5;

      ctx.save();
      ctx.translate(screen.x, screen.y);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.ellipse(0, 6, size * 0.55, size * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = palm.tone > 0.5 ? '#6b4423' : '#7a4d29';
      ctx.lineWidth = size * 0.13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(palm.lean * size * 0.5, -size * 1.3, topX, topY);
      ctx.stroke();

      for (let f = 0; f < 7; f++) {
        const angle = -Math.PI + (f / 6) * Math.PI + palm.lean * 0.35;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        const length = size * (1.05 + (f % 2) * 0.18);
        const tipX = topX + dirX * length;
        const tipY = topY + dirY * length * 0.72;
        const ctrlX = topX + dirX * length * 0.6 - dirY * length * 0.22;
        const ctrlY = topY + dirY * length * 0.5 + dirX * length * 0.12;

        ctx.fillStyle = (f + Math.round(palm.tone * 3)) % 2 === 0 ? '#15803d' : '#1f9d4d';
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
        ctx.quadraticCurveTo(
          topX + dirX * length * 0.45,
          topY + dirY * length * 0.3,
          topX,
          topY
        );
        ctx.fill();
      }

      // Coconuts at the crown.
      ctx.fillStyle = '#4a2f1b';
      ctx.beginPath();
      ctx.arc(topX - size * 0.1, topY + size * 0.08, size * 0.1, 0, Math.PI * 2);
      ctx.arc(topX + size * 0.12, topY + size * 0.12, size * 0.09, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  renderTrees(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.mapId !== 'amazon_forest') return;

    this.renderAmazonDecorations(ctx, camera);

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
