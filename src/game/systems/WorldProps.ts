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

// Fruit trees are harvested on purpose: the player must stand close and press
// E (or tap the floating prompt on touch devices), then the tree respawns
// somewhere else on the map.
const FRUIT_TREE_RESPAWN = 45;
const FRUIT_TREE_PICKUP_RADIUS = 34;
const FRUIT_TREE_PROMPT_WIDTH = 190;
const FRUIT_TREE_PROMPT_HEIGHT = 42;
const FRUIT_TREE_PROMPT_PADDING = 10;

// The açaí palm is a hand-crafted 32x40 pixel-art sprite. Its colours live in
// a matrix that is rasterized once into an offscreen canvas (nearest-neighbour)
// and then reused every frame, so the tree stays crisp at any zoom.
const ACAI_SPRITE_WIDTH = 32;
const ACAI_SPRITE_HEIGHT = 40;
const ACAI_SPRITE_SCALE = 3;

// Fruit tree minimap markers: hand-drawn 16x16 pixel-art icons, rasterized
// once into offscreen canvases and blitted at 16x16 with smoothing disabled
// so every pixel of the art is preserved.
const ACAI_MINIMAP_ICON_SIZE = 16;
const ACAI_MINIMAP_ICON_DRAW_SIZE = 16;

// Amazon water. For the player the river and lakes are purely visual, but
// aquatic enemies use the stricter isNavigableWater check below to stay wet.
const RIVER_WIDTH = 980;
const RIVER_BANK = 260;
const RIVER_HALF_WIDTH = RIVER_WIDTH / 2;

export interface TorchProp {
  id: number;
  x: number;
  y: number;
  radius: number;
  animTimer: number;
  buff: DropType;
}

export type FruitTreeKind =
  | 'acai'
  | 'cupuacu'
  | 'castanha'
  | 'buriti'
  | 'pupunha'
  | 'araca';

export interface FruitTreeProp {
  id: number;
  kind: FruitTreeKind;
  x: number;
  y: number;
  active: boolean;
  respawnTimer: number;
  animTimer: number;
}

export interface CollectedFruit {
  kind: FruitTreeKind;
  x: number;
  y: number;
}

// Short benefit shown under the collect prompt for each Amazon fruit tree.
const FRUIT_TREE_BENEFITS: Record<FruitTreeKind, string> = {
  acai: 'Ímã: Atrai todo o XP do mapa',
  cupuacu: 'Cura: Restaura 35% de HP',
  castanha: 'Fortuna: Dropa pacote de Ouro',
  buriti: 'Frenesi: +Velocidade e Ataque (10s)',
  pupunha: 'Proteção: Escudo temporário (10s)',
  araca: 'Explosão: Dano em área nos inimigos',
};

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

interface BankPlantProp {
  x: number;
  y: number;
  size: number;
  tone: number;
  rotation: number;
  kind: 'tuft' | 'leafy';
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
  public fruitTrees: FruitTreeProp[] = [];
  private nextFruitTreeId: number = 1;
  private trees: TreeProp[] = [];
  private floorPatches: FloorPatch[] = [];
  private lakes: LakeProp[] = [];
  private lilies: LilyProp[] = [];
  private palms: PalmProp[] = [];
  private ferns: FernProp[] = [];
  private rocks: RockProp[] = [];
  private bankPlants: BankPlantProp[] = [];

  private floorImage: HTMLImageElement | null = null;
  private floorPattern: CanvasPattern | null = null;
  private acaiPixelSprite: HTMLCanvasElement | null = null;
  private acaiMinimapIcon: HTMLCanvasElement | null = null;
  private fruitMinimapIcons: Partial<Record<FruitTreeKind, HTMLCanvasElement>> = {};
  private waterAnimTimer: number = 0;

  constructor(mapId: MapId = 'night_plain') {
    this.mapId = mapId;
    if (mapId === 'amazon_forest') {
      this.worldHalfSize = FOREST_HALF_SIZE;
      this.generateForest();
      this.spawnInitialFruitTrees();
    }
    this.loadFloorTexture();
  }

  private spawnInitialFruitTrees(): void {
    // One tree of each fruit starts at a fully random land position.
    const kinds: FruitTreeKind[] = [
      'acai',
      'cupuacu',
      'castanha',
      'buriti',
      'pupunha',
      'araca',
    ];

    for (let i = 0; i < kinds.length; i++) {
      const spawn = this.findFruitTreeSpawn();
      this.fruitTrees.push({
        id: this.nextFruitTreeId++,
        kind: kinds[i],
        x: spawn.x,
        y: spawn.y,
        active: true,
        respawnTimer: 0,
        animTimer: Math.random() * Math.PI * 2,
      });
    }
  }

  private findFruitTreeSpawn(): { x: number; y: number } {
    const limit = FOREST_HALF_SIZE - 420;

    for (let attempt = 0; attempt < 200; attempt++) {
      const x = (Math.random() * 2 - 1) * limit;
      const y = (Math.random() * 2 - 1) * limit;

      if (this.isInWater(x, y)) continue;
      if (this.collidesWithTree(x, y, 70)) continue;

      let overlapsFruitTree = false;
      for (let i = 0; i < this.fruitTrees.length; i++) {
        const other = this.fruitTrees[i];
        if (!other.active) continue;
        const dx = x - other.x;
        const dy = y - other.y;
        if (dx * dx + dy * dy < 260 * 260) {
          overlapsFruitTree = true;
          break;
        }
      }
      if (overlapsFruitTree) continue;

      return { x, y };
    }

    // Extremely unlikely fallback: keep it random, but at least on dry land.
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = (Math.random() * 2 - 1) * limit;
      const y = (Math.random() * 2 - 1) * limit;
      if (this.isInWater(x, y) || this.collidesWithTree(x, y, 70)) continue;
      return { x, y };
    }

    return {
      x: (Math.random() * 2 - 1) * limit,
      y: (Math.random() * 2 - 1) * limit,
    };
  }

  private collectFruitTree(tree: FruitTreeProp): CollectedFruit {
    const fruit = { kind: tree.kind, x: tree.x, y: tree.y };
    tree.active = false;
    tree.respawnTimer = FRUIT_TREE_RESPAWN;
    return fruit;
  }

  /** Returns the closest active fruit tree within the player's reach. */
  public getInteractableFruitTree(player: Player): FruitTreeProp | null {
    if (this.mapId !== 'amazon_forest') return null;

    const reach = player.radius + FRUIT_TREE_PICKUP_RADIUS;
    let closest: FruitTreeProp | null = null;
    let closestDistance = reach * reach;

    for (let i = 0; i < this.fruitTrees.length; i++) {
      const tree = this.fruitTrees[i];
      if (!tree.active) continue;

      const dx = player.x - tree.x;
      const dy = player.y - tree.y;
      const distance = dx * dx + dy * dy;
      if (distance <= closestDistance) {
        closest = tree;
        closestDistance = distance;
      }
    }

    return closest;
  }

  /** Harvests the nearby tree the player is prompting, if any. */
  public collectNearbyFruitTree(player: Player): CollectedFruit | null {
    const tree = this.getInteractableFruitTree(player);
    return tree ? this.collectFruitTree(tree) : null;
  }

  /** Nearest active fruit tree, used by the Anta when it forages alone. */
  public getNearestActiveFruitTree(x: number, y: number): FruitTreeProp | null {
    if (this.mapId !== 'amazon_forest') return null;

    let closest: FruitTreeProp | null = null;
    let closestDistance = Infinity;

    for (let i = 0; i < this.fruitTrees.length; i++) {
      const tree = this.fruitTrees[i];
      if (!tree.active) continue;

      const dx = x - tree.x;
      const dy = y - tree.y;
      const distance = dx * dx + dy * dy;
      if (distance < closestDistance) {
        closest = tree;
        closestDistance = distance;
      }
    }

    return closest;
  }

  /** Consumes a fruit tree for an animal, starting its 45s respawn timer. */
  public consumeFruitTreeById(id: number): boolean {
    const tree = this.fruitTrees.find((candidate) => candidate.id === id && candidate.active);
    if (!tree) return false;
    this.collectFruitTree(tree);
    return true;
  }

  /**
   * Handles a tap/click on the floating prompt. Returns the harvested fruit
   * when the pointer lands on the prompt of a tree that is in reach.
   */
  public collectFruitTreeAtScreenPoint(
    screenX: number,
    screenY: number,
    camera: Camera,
    player: Player
  ): CollectedFruit | null {
    const tree = this.getInteractableFruitTree(player);
    if (!tree) return null;

    const screen = camera.worldToScreen(tree.x, tree.y);
    const promptY = screen.y + this.getFruitPromptOffsetY(tree);

    const halfWidth = FRUIT_TREE_PROMPT_WIDTH / 2 + FRUIT_TREE_PROMPT_PADDING;
    const halfHeight = FRUIT_TREE_PROMPT_HEIGHT / 2 + FRUIT_TREE_PROMPT_PADDING;
    if (
      Math.abs(screenX - screen.x) > halfWidth ||
      Math.abs(screenY - promptY) > halfHeight
    ) {
      return null;
    }

    return this.collectFruitTree(tree);
  }

  private getFruitPromptOffsetY(tree: FruitTreeProp): number {
    // Place the prompt just above each tree's canopy.
    let offset: number;
    switch (tree.kind) {
      case 'castanha':
        offset = -158;
        break;
      case 'buriti':
        offset = -142;
        break;
      case 'pupunha':
        offset = -128;
        break;
      case 'cupuacu':
        offset = -112;
        break;
      case 'acai':
        offset = -146;
        break;
      case 'araca':
      default:
        offset = -104;
        break;
    }
    return offset + Math.sin(tree.animTimer * 2.2) * 2;
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

    // Low grass tufts and creeping plants scattered across the wider river
    // beach. They stay inside the sandy band, between the water and the forest.
    const bankMin = RIVER_HALF_WIDTH + 12;
    const bankMax = RIVER_HALF_WIDTH + RIVER_BANK - 18;
    for (let i = 0; i < 620; i++) {
      const x = (random() - 0.5) * FOREST_SIZE * 0.95;
      const side = random() < 0.5 ? -1 : 1;
      const offset = bankMin + random() * (bankMax - bankMin);
      const y = this.riverCenterY(x) + side * offset;
      if (
        Math.abs(x) > FOREST_HALF_SIZE - 140 ||
        Math.abs(y) > FOREST_HALF_SIZE - 140
      ) {
        continue;
      }
      this.bankPlants.push({
        x,
        y,
        size: 4 + random() * 7,
        tone: random(),
        rotation: random() * Math.PI * 2,
        kind: random() < 0.62 ? 'tuft' : 'leafy',
      });
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
    // River band, including the whole sandy beach so land props stay clear of it.
    if (Math.abs(y - this.riverCenterY(x)) < RIVER_HALF_WIDTH + RIVER_BANK) return true;

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

  /**
   * True when the point (plus the given body radius) fits inside the visible
   * water surface of the Amazon river or one of its lakes. Decorative water
   * includes the sandy banks, so aquatic enemies use this stricter check.
   */
  public isNavigableWater(x: number, y: number, radius: number = 0): boolean {
    if (this.mapId !== 'amazon_forest') return false;
    if (Math.abs(x) > FOREST_HALF_SIZE || Math.abs(y) > FOREST_HALF_SIZE) return false;

    // River band.
    const riverHalf = RIVER_HALF_WIDTH - 16 - radius;
    if (riverHalf > 0 && Math.abs(y - this.riverCenterY(x)) < riverHalf) return true;

    // Lakes (rotated ellipses), inset by the creature's body so it stays wet.
    const inset = 18 + radius;
    for (let i = 0; i < this.lakes.length; i++) {
      const lake = this.lakes[i];
      const rx = lake.rx - inset;
      const ry = lake.ry - inset;
      if (rx <= 0 || ry <= 0) continue;

      const dx = x - lake.x;
      const dy = y - lake.y;
      const cos = Math.cos(-lake.rotation);
      const sin = Math.sin(-lake.rotation);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if ((lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1) {
        return true;
      }
    }

    return false;
  }

  /**
   * True when the point is over the open water surface of the river or a lake.
   * The sandy beach is deliberately excluded: this is what tells the engine
   * whether the hero has actually stepped into the water.
   */
  public isWaterSurface(x: number, y: number): boolean {
    if (this.mapId !== 'amazon_forest') return false;
    if (Math.abs(x) > FOREST_HALF_SIZE || Math.abs(y) > FOREST_HALF_SIZE) return false;

    // River band.
    if (Math.abs(y - this.riverCenterY(x)) < RIVER_HALF_WIDTH) return true;

    // Lakes (rotated ellipses).
    for (let i = 0; i < this.lakes.length; i++) {
      const lake = this.lakes[i];
      const dx = x - lake.x;
      const dy = y - lake.y;
      const cos = Math.cos(-lake.rotation);
      const sin = Math.sin(-lake.rotation);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if ((lx * lx) / (lake.rx * lake.rx) + (ly * ly) / (lake.ry * lake.ry) <= 1) {
        return true;
      }
    }

    return false;
  }

  /**
   * True when the point (plus the given body radius) is inside the river or
   * lake water and its wider sandy beach. River predators use this instead of
   * the stricter water check so they may haul out onto the sand but never walk
   * into the forest.
   */
  public isRiverBankTerrain(x: number, y: number, radius: number = 0): boolean {
    if (this.mapId !== 'amazon_forest') return false;
    if (Math.abs(x) > FOREST_HALF_SIZE || Math.abs(y) > FOREST_HALF_SIZE) return false;

    const riverHalf = RIVER_HALF_WIDTH + RIVER_BANK - 10 - radius;
    if (riverHalf > 0 && Math.abs(y - this.riverCenterY(x)) < riverHalf) return true;

    const inset = 10 + radius;
    for (let i = 0; i < this.lakes.length; i++) {
      const lake = this.lakes[i];
      const rx = lake.rx + RIVER_BANK - inset;
      const ry = lake.ry + RIVER_BANK - inset;
      if (rx <= 0 || ry <= 0) continue;

      const dx = x - lake.x;
      const dy = y - lake.y;
      const cos = Math.cos(-lake.rotation);
      const sin = Math.sin(-lake.rotation);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if ((lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1) return true;
    }

    return false;
  }

  /**
   * Nearest sandy bank point where terrestrial herbivores can graze when the
   * hero is far away. The point sits between the water and the forest.
   */
  public getBeachGrazingTarget(x: number, y: number): { x: number; y: number } | null {
    if (this.mapId !== 'amazon_forest') return null;

    const limit = FOREST_HALF_SIZE - 220;
    const bankOffset = RIVER_HALF_WIDTH + RIVER_BANK * 0.55;
    let best: { x: number; y: number } | null = null;
    let bestDistance = Infinity;

    // River bank: keep the creature on the side it currently occupies.
    const riverX = Math.max(-limit, Math.min(limit, x));
    const riverCenterY = this.riverCenterY(riverX);
    const side = y >= riverCenterY ? 1 : -1;
    const riverY = riverCenterY + side * bankOffset;
    if (Math.abs(riverY) <= limit) {
      const dx = riverX - x;
      const dy = riverY - y;
      best = { x: riverX, y: riverY };
      bestDistance = dx * dx + dy * dy;
    }

    // Lake banks follow the ellipse rim, expanded past the water surface.
    for (let i = 0; i < this.lakes.length; i++) {
      const lake = this.lakes[i];
      const cos = Math.cos(-lake.rotation);
      const sin = Math.sin(-lake.rotation);
      const dx = x - lake.x;
      const dy = y - lake.y;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;

      const rx = lake.rx + RIVER_BANK * 0.55;
      const ry = lake.ry + RIVER_BANK * 0.55;
      const angle = Math.atan2(ly / Math.max(1, ry), lx / Math.max(1, rx));
      const localX = Math.cos(angle) * rx;
      const localY = Math.sin(angle) * ry;

      const cosR = Math.cos(lake.rotation);
      const sinR = Math.sin(lake.rotation);
      const targetX = lake.x + localX * cosR - localY * sinR;
      const targetY = lake.y + localX * sinR + localY * cosR;

      if (Math.abs(targetX) > limit || Math.abs(targetY) > limit) continue;

      const tdx = targetX - x;
      const tdy = targetY - y;
      const distance = tdx * tdx + tdy * tdy;
      if (distance < bestDistance) {
        best = { x: targetX, y: targetY };
        bestDistance = distance;
      }
    }

    return best;
  }

  /**
   * Closest point on the river centreline, used as a safe fallback spawn so
   * river predators never start stranded in the middle of the forest.
   */
  public getNearestRiverPoint(x: number): { x: number; y: number } {
    const limit = FOREST_HALF_SIZE - 160;
    const clampedX = Math.max(-limit, Math.min(limit, x));
    return { x: clampedX, y: this.riverCenterY(clampedX) };
  }

  /**
   * Moves a river predator from one point to another while keeping it inside
   * the river/lake and beach band. A creature that starts outside the band is
   * allowed to walk back in, but once inside it can never cross into the forest.
   */
  public resolveRiverBankMovement(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    radius: number
  ): { x: number; y: number } {
    if (this.mapId !== 'amazon_forest') return { x: toX, y: toY };
    if (!this.isRiverBankTerrain(fromX, fromY, radius)) return { x: toX, y: toY };

    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.0001) return { x: fromX, y: fromY };

    const steps = Math.max(1, Math.ceil(distance / COLLISION_STEP));
    const stepX = dx / steps;
    const stepY = dy / steps;
    let x = fromX;
    let y = fromY;

    for (let i = 0; i < steps; i++) {
      const nextX = x + stepX;
      if (this.isRiverBankTerrain(nextX, y, radius)) x = nextX;

      const nextY = y + stepY;
      if (this.isRiverBankTerrain(x, nextY, radius)) y = nextY;
    }

    return { x, y };
  }

  /**
   * Moves an aquatic enemy from one valid water position to another while
   * refusing any step that would reach dry land. Each axis is resolved
   * independently so the creature can slide along the riverbank.
   */
  public resolveAquaticMovement(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    radius: number
  ): { x: number; y: number } {
    if (this.mapId !== 'amazon_forest') return { x: toX, y: toY };

    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.0001) return { x: fromX, y: fromY };

    const steps = Math.max(1, Math.ceil(distance / COLLISION_STEP));
    const stepX = dx / steps;
    const stepY = dy / steps;
    let x = fromX;
    let y = fromY;

    for (let i = 0; i < steps; i++) {
      const nextX = x + stepX;
      if (this.isNavigableWater(nextX, y, radius)) x = nextX;

      const nextY = y + stepY;
      if (this.isNavigableWater(x, nextY, radius)) y = nextY;
    }

    return { x, y };
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
   * Amazon Forest lighting phases, synchronized with the 20-minute run clock:
   * 00:00–05:00 day, 05:00–10:00 sunset and 10:00–20:00 jungle night.
   */
  public getAmazonDayPhase(survivalTime: number): 'day' | 'sunset' | 'night' {
    if (survivalTime < 300) return 'day';
    if (survivalTime < 600) return 'sunset';
    return 'night';
  }

  /**
   * Renders the map's atmospheric lighting and ambient particles on top of the
   * world. The HUD/minimap stay above this layer because the engine draws them
   * afterwards.
   */
  public renderAmazonAtmosphere(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    player: Player,
    survivalTime: number
  ): void {
    if (this.mapId !== 'amazon_forest') return;

    const phase = this.getAmazonDayPhase(survivalTime);
    const width = camera.viewportWidth;
    const height = camera.viewportHeight;

    if (phase === 'day') {
      // Clear jungle daylight, free of ambient leaf particles.
      ctx.fillStyle = 'rgba(255, 247, 214, 0.05)';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    if (phase === 'sunset') {
      const sunset = ctx.createLinearGradient(0, 0, 0, height);
      sunset.addColorStop(0, 'rgba(249, 115, 22, 0.16)');
      sunset.addColorStop(0.55, 'rgba(234, 88, 12, 0.1)');
      sunset.addColorStop(1, 'rgba(120, 53, 15, 0.2)');
      ctx.fillStyle = sunset;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    // Night: deep blue atmosphere with a circular pool of light around the hero.
    const hero = camera.worldToScreen(player.x, player.y);
    const darkness = ctx.createRadialGradient(
      hero.x,
      hero.y,
      56,
      hero.x,
      hero.y,
      420
    );
    darkness.addColorStop(0, 'rgba(4, 10, 30, 0.08)');
    darkness.addColorStop(0.35, 'rgba(6, 14, 40, 0.3)');
    darkness.addColorStop(0.7, 'rgba(4, 10, 32, 0.62)');
    darkness.addColorStop(1, 'rgba(2, 6, 20, 0.8)');
    ctx.fillStyle = darkness;
    ctx.fillRect(0, 0, width, height);

    // Warm rim of the hero's lantern-like aura.
    const heroGlow = ctx.createRadialGradient(hero.x, hero.y, 16, hero.x, hero.y, 230);
    heroGlow.addColorStop(0, 'rgba(254, 243, 199, 0.16)');
    heroGlow.addColorStop(0.5, 'rgba(253, 224, 71, 0.06)');
    heroGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = heroGlow;
    ctx.beginPath();
    ctx.arc(hero.x, hero.y, 230, 0, Math.PI * 2);
    ctx.fill();

    this.renderFireflies(ctx, camera, player, survivalTime);
  }

  private renderFireflies(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    player: Player,
    survivalTime: number
  ): void {
    const count = 26;
    for (let i = 0; i < count; i++) {
      const slow = survivalTime * 0.7 + i * 1.73;
      const worldX =
        player.x +
        Math.sin(slow * 0.7 + i) * (150 + (i % 5) * 55) +
        Math.cos(slow * 0.35 + i * 1.4) * 55;
      const worldY =
        player.y +
        Math.cos(slow * 0.9 + i * 2.1) * (95 + (i % 4) * 45) +
        Math.sin(slow * 0.45 + i) * 40;
      const screen = camera.worldToScreen(worldX, worldY);

      const blink = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(survivalTime * 3.2 + i * 1.9));
      ctx.save();
      ctx.shadowColor = '#fef08a';
      ctx.shadowBlur = 12;
      ctx.fillStyle = `rgba(253, 230, 138, ${blink})`;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
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

    // Active fruit trees use their own 16x16 pixel-art fruit icon.
    for (let i = 0; i < this.fruitTrees.length; i++) {
      const tree = this.fruitTrees[i];
      if (!tree.active) continue;
      if (Math.abs(tree.x - centerX) > viewRadius) continue;
      if (Math.abs(tree.y - centerY) > viewRadius) continue;

      const icon = this.getFruitMinimapIcon(tree.kind);
      if (!icon) continue;

      const drawSize = ACAI_MINIMAP_ICON_DRAW_SIZE;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        icon,
        Math.round(toX(tree.x) - drawSize / 2),
        Math.round(toY(tree.y) - drawSize / 2),
        drawSize,
        drawSize
      );
      ctx.restore();
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

  private getAcaiPixelSprite(): HTMLCanvasElement | null {
    if (this.acaiPixelSprite) return this.acaiPixelSprite;
    if (typeof document === 'undefined') return null;

    const width = ACAI_SPRITE_WIDTH;
    const height = ACAI_SPRITE_HEIGHT;
    const pixels: (string | null)[] = new Array(width * height).fill(null);

    const setPixel = (x: number, y: number, color: string): void => {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || px >= width || py < 0 || py >= height) return;
      pixels[py * width + px] = color;
    };

    const fillCircle = (cx: number, cy: number, radius: number, color: string): void => {
      const minX = Math.floor(cx - radius);
      const maxX = Math.ceil(cx + radius);
      const minY = Math.floor(cy - radius);
      const maxY = Math.ceil(cy + radius);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= radius * radius + 0.2) setPixel(x, y, color);
        }
      }
    };

    // Dark oval shadow on the ground, wider than the trunk base just like the
    // reference art. It is plotted first so the tree stands on top of it.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - 16) / 15.2;
        const dy = (y - 37.3) / 2.8;
        if (dx * dx + dy * dy <= 1) setPixel(x, y, 'rgba(4, 10, 6, 0.62)');
      }
    }

    // Ringed brown trunk: two-pixel body with a dark outline and a slight
    // flare at the base.
    for (let y = 17; y < height - 1; y++) {
      if (y >= height - 3) {
        setPixel(13, y, '#2f1d10');
        setPixel(18, y, '#2f1d10');
        for (let x = 14; x <= 17; x++) setPixel(x, y, '#7a5a35');
      } else {
        setPixel(14, y, '#2f1d10');
        setPixel(17, y, '#2f1d10');
        setPixel(15, y, '#8a6a3f');
        setPixel(16, y, '#6b4f2a');
      }

      if (y % 3 === 0) {
        setPixel(15, y, '#4a3420');
        setPixel(16, y, '#4a3420');
      }
    }

    // Seven broad, arched fronds. Each blade gets a dark pixel outline and is
    // split into two green tones so the crown reads like the reference image.
    const drawFrond = (
      baseX: number,
      baseY: number,
      controlX: number,
      controlY: number,
      tipX: number,
      tipY: number,
      lightOnLeft: boolean
    ): void => {
      const outline = '#0a1c10';
      const darkGreen = '#14532d';
      const lightGreen = '#2f9e52';
      const steps = 72;

      const pointX = (t: number): number => {
        const u = 1 - t;
        return u * u * baseX + 2 * u * t * controlX + t * t * tipX;
      };
      const pointY = (t: number): number => {
        const u = 1 - t;
        return u * u * baseY + 2 * u * t * controlY + t * t * tipY;
      };
      const tangentX = (t: number): number =>
        2 * (1 - t) * (controlX - baseX) + 2 * t * (tipX - controlX);
      const tangentY = (t: number): number =>
        2 * (1 - t) * (controlY - baseY) + 2 * t * (tipY - controlY);

      // Outline pass first, then the coloured blade on top of it.
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = pointX(t);
        const y = pointY(t);
        const dx = tangentX(t);
        const dy = tangentY(t);
        const length = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / length;
        const ny = dx / length;
        const halfWidth = 0.8 + 1.6 * Math.sin(Math.PI * t);
        const outlineWidth = halfWidth + 1;
        const maxOffset = Math.ceil(outlineWidth);
        for (let offset = -maxOffset; offset <= maxOffset; offset++) {
          if (Math.abs(offset) <= outlineWidth) {
            setPixel(x + nx * offset, y + ny * offset, outline);
          }
        }
      }

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = pointX(t);
        const y = pointY(t);
        const dx = tangentX(t);
        const dy = tangentY(t);
        const length = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / length;
        const ny = dx / length;
        const halfWidth = 0.8 + 1.6 * Math.sin(Math.PI * t);
        const maxOffset = Math.ceil(halfWidth);
        for (let offset = -maxOffset; offset <= maxOffset; offset++) {
          if (Math.abs(offset) > halfWidth) continue;
          const lightSide = lightOnLeft ? offset <= 0 : offset >= 0;
          setPixel(x + nx * offset, y + ny * offset, lightSide ? lightGreen : darkGreen);
        }
      }
    };

    drawFrond(15.5, 17.5, 8, 20, 4, 23, false);
    drawFrond(16.5, 17.5, 23, 20, 28, 23, true);
    drawFrond(15, 17, 7, 12, 2, 13, true);
    drawFrond(16.5, 17, 24, 12, 29, 13, false);
    drawFrond(15, 16.5, 9, 7, 5, 4, false);
    drawFrond(16, 16.5, 22, 7, 27, 4, true);
    drawFrond(15.5, 16.5, 15.5, 6, 16, 1, true);

    // Short stems holding the two heavy açaí bunches.
    const drawLine = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      color: string
    ): void => {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        setPixel(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, color);
      }
    };
    drawLine(15, 18, 12, 22, '#4a3420');
    drawLine(16, 18, 20, 22, '#4a3420');

    const berries: { x: number; y: number; highlight: boolean }[] = [
      { x: 12, y: 23, highlight: true },
      { x: 11, y: 24, highlight: false },
      { x: 13, y: 24, highlight: false },
      { x: 10, y: 25, highlight: true },
      { x: 12, y: 25, highlight: false },
      { x: 13, y: 26, highlight: false },
      { x: 11, y: 26, highlight: true },
      { x: 12, y: 27, highlight: false },
      { x: 10, y: 27, highlight: false },
      { x: 13, y: 28, highlight: true },
      { x: 11, y: 29, highlight: false },
      { x: 12, y: 30, highlight: false },
      { x: 19, y: 24, highlight: true },
      { x: 21, y: 24, highlight: false },
      { x: 18, y: 25, highlight: false },
      { x: 20, y: 25, highlight: true },
      { x: 22, y: 25, highlight: false },
      { x: 19, y: 26, highlight: false },
      { x: 21, y: 26, highlight: true },
      { x: 18, y: 27, highlight: false },
      { x: 20, y: 27, highlight: false },
      { x: 22, y: 27, highlight: true },
      { x: 18, y: 28, highlight: false },
      { x: 19, y: 28, highlight: false },
      { x: 21, y: 29, highlight: true },
      { x: 20, y: 30, highlight: false },
    ];

    for (let i = 0; i < berries.length; i++) {
      const berry = berries[i];
      fillCircle(berry.x, berry.y, 1.6, '#2e0f3a');
      fillCircle(berry.x, berry.y, 1.05, '#4a1a5e');
      if (berry.highlight) setPixel(berry.x, berry.y - 1, '#8b3fa8');
    }

    // Rasterize the 32x40 colour matrix into an offscreen canvas.
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = pixels[y * width + x];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    this.acaiPixelSprite = canvas;
    return canvas;
  }

  /**
   * Builds (once) the 16x16 pixel-art minimap icon for a fruit tree kind.
   * Each fruit is plotted pixel by pixel with a thin dark contour and then
   * blitted with smoothing disabled, so the radar stays crisp and readable.
   */
  private getFruitMinimapIcon(kind: FruitTreeKind): HTMLCanvasElement | null {
    if (kind === 'acai') return this.getAcaiMinimapIcon();

    const cached = this.fruitMinimapIcons[kind];
    if (cached) return cached;
    if (typeof document === 'undefined') return null;

    const size = ACAI_MINIMAP_ICON_SIZE;
    const pixels: (string | null)[] = new Array(size * size).fill(null);

    const setPixel = (x: number, y: number, color: string): void => {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || px >= size || py < 0 || py >= size) return;
      pixels[py * size + px] = color;
    };

    const fillCircle = (cx: number, cy: number, radius: number, color: string): void => {
      const minX = Math.floor(cx - radius);
      const maxX = Math.ceil(cx + radius);
      const minY = Math.floor(cy - radius);
      const maxY = Math.ceil(cy + radius);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= radius * radius + 0.2) setPixel(x, y, color);
        }
      }
    };

    const fillEllipse = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      color: string
    ): void => {
      const minX = Math.floor(cx - rx);
      const maxX = Math.ceil(cx + rx);
      const minY = Math.floor(cy - ry);
      const maxY = Math.ceil(cy + ry);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1.05) setPixel(x, y, color);
        }
      }
    };

    const drawLine = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      color: string
    ): void => {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        setPixel(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, color);
      }
    };

    const outline = '#140a06';

    switch (kind) {
      case 'cupuacu': {
        // Short stem and one little leaf above the capsule.
        drawLine(8, 2, 8, 5, '#5a3a1c');
        fillEllipse(10.8, 2.4, 2.4, 1.2, outline);
        fillEllipse(10.8, 2.4, 1.9, 0.8, '#1d6b34');
        fillEllipse(10.5, 2.1, 1.3, 0.5, '#4fb867');

        // Large velvety brown capsule with darker bottom-right shading.
        fillEllipse(8, 9.2, 4.9, 5.9, outline);
        fillEllipse(8, 9.2, 4.2, 5.2, '#7a4a2b');
        fillEllipse(6.5, 7.2, 1.4, 1.8, '#a06a3d');
        fillEllipse(9.4, 10, 1.4, 2.4, '#4f2c18');
        drawLine(6, 6, 6.4, 12, '#5b3520');
        drawLine(10, 6, 9.6, 12, '#5b3520');
        setPixel(6.2, 6.5, '#c08a58');
        setPixel(7, 5.8, '#c08a58');
        break;
      }
      case 'castanha': {
        // Rounded dark-brown shell with a lighter rim.
        fillCircle(8, 8.2, 6.4, outline);
        fillCircle(8, 8.2, 5.7, '#5c341b');
        fillCircle(8, 8.2, 5.0, '#7a4a27');

        // Cracked opening showing three pale Brazil nuts.
        fillEllipse(8, 8.6, 4.3, 3.0, '#3a1d0e');
        fillEllipse(8, 8.6, 3.7, 2.5, '#241108');
        const nuts = [5.6, 8, 10.4];
        for (let i = 0; i < nuts.length; i++) {
          const nutX = nuts[i];
          fillCircle(nutX, 8.6, 1.45, outline);
          fillCircle(nutX, 8.6, 1.05, '#e9cf9a');
          fillCircle(nutX - 0.2, 8.3, 0.55, '#f7e8c4');
          setPixel(nutX - 0.6, 8.2, '#fff6de');
        }

        // Shell grain and highlights.
        drawLine(3.6, 5.4, 5.2, 3.8, '#9b6538');
        drawLine(10.5, 3.9, 12.2, 5.7, '#9b6538');
        setPixel(4.2, 11.2, '#9b6538');
        setPixel(11.8, 11, '#9b6538');
        break;
      }
      case 'buriti': {
        // Small stem at the top of the elongated fruit.
        drawLine(8, 1.8, 8, 4, '#4a2a12');

        // Oval brown-red fruit with warm shading.
        fillEllipse(8, 8.7, 4.2, 5.6, outline);
        fillEllipse(8, 8.7, 3.5, 4.9, '#8b3a24');
        fillEllipse(9.2, 10.4, 1.5, 2.4, '#6b2418');
        fillEllipse(6.5, 7.0, 1.3, 2.0, '#b4582e');
        setPixel(5.6, 6.0, '#f0a44a');
        setPixel(6.4, 5.4, '#f0a44a');

        // Overlapping scale texture with golden-orange glints.
        for (let y = 5; y <= 12; y += 2) {
          const offset = y % 4 === 1 ? 0 : 1;
          for (let x = 5 + offset; x <= 9; x += 2) {
            setPixel(x, y, '#5c1f12');
            setPixel(x + 1, y + 1, '#c86a32');
          }
        }
        break;
      }
      case 'pupunha': {
        // Stems fanning out from the crown, drawn behind the fruits.
        drawLine(8, 2, 5.2, 4.2, '#4a5a1c');
        drawLine(8, 2, 10.8, 4.2, '#4a5a1c');
        drawLine(8, 2, 5.6, 8.8, '#4a5a1c');
        drawLine(8, 2, 10.4, 8.8, '#4a5a1c');

        const fruits = [
          { x: 5.2, y: 6.4 },
          { x: 10.8, y: 6.4 },
          { x: 5.6, y: 11.2 },
          { x: 10.4, y: 11.2 },
        ];
        for (let i = 0; i < fruits.length; i++) {
          const fruit = fruits[i];
          // Red top fading into an orange-yellow base.
          fillEllipse(fruit.x, fruit.y, 2.2, 2.9, outline);
          fillEllipse(fruit.x, fruit.y + 0.2, 1.6, 2.35, '#d92b1f');
          fillEllipse(fruit.x, fruit.y - 0.2, 1.4, 1.5, '#f05a22');
          fillEllipse(fruit.x, fruit.y + 1.0, 1.1, 1.0, '#f7b32b');
          setPixel(fruit.x - 0.6, fruit.y - 1.0, '#ffe08a');
          setPixel(fruit.x - 0.2, fruit.y - 1.4, '#ffe08a');
        }

        // Small green crown leaf on top.
        fillEllipse(8, 2.0, 2.2, 1.0, outline);
        fillEllipse(8, 2.0, 1.7, 0.6, '#2f6b25');
        setPixel(7.6, 1.7, '#67a83e');
        break;
      }
      case 'araca': {
        const sepalDark = '#2f4d1c';
        const sepalLight = '#5d7f2c';

        // Thin stem and small leaf at the top.
        drawLine(8, 2.4, 8, 4.2, '#4a3420');
        fillEllipse(10.2, 2.3, 2.3, 1.1, outline);
        fillEllipse(10.2, 2.3, 1.8, 0.7, '#2f6b25');
        fillEllipse(9.9, 2.0, 1.2, 0.45, '#67a83e');

        // Small round green-yellow fruit.
        fillCircle(8, 8.8, 5.4, outline);
        fillCircle(8, 8.8, 4.7, '#a8bf3e');
        fillCircle(9.2, 9.8, 3.2, '#8da52f');
        fillCircle(6.4, 7.1, 1.7, '#d5e36a');
        setPixel(5.8, 6.4, '#f0f7a0');
        setPixel(6.6, 5.8, '#f0f7a0');

        // Crown of sepals around the base of the fruit.
        drawLine(8, 12.8, 5.2, 14.4, sepalDark);
        drawLine(8, 12.8, 6.6, 14.8, sepalDark);
        drawLine(8, 12.8, 9.4, 14.8, sepalDark);
        drawLine(8, 12.8, 10.8, 14.4, sepalDark);
        setPixel(6.0, 14.0, sepalLight);
        setPixel(7.0, 14.4, sepalLight);
        setPixel(9.0, 14.4, sepalLight);
        setPixel(10.0, 14.0, sepalLight);
        break;
      }
    }

    // One-pixel dark contour around the whole shape so every fruit keeps a
    // crisp silhouette on the dark minimap panel.
    const filled = pixels.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (filled[y * size + x]) continue;
        const nearFilled =
          (y > 0 && Boolean(filled[(y - 1) * size + x])) ||
          (y < size - 1 && Boolean(filled[(y + 1) * size + x])) ||
          (x > 0 && Boolean(filled[y * size + (x - 1)])) ||
          (x < size - 1 && Boolean(filled[y * size + (x + 1)]));
        if (nearFilled) pixels[y * size + x] = outline;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const color = pixels[y * size + x];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    this.fruitMinimapIcons[kind] = canvas;
    return canvas;
  }

  /**
   * Builds (once) the 16x16 pixel-art açaí bunch used by the minimap. The
   * reference art shows dark purple berries with lilac glints under a small
   * green crown, so the icon is plotted pixel by pixel, wrapped in a dark
   * outline and then blitted without smoothing.
   */
  private getAcaiMinimapIcon(): HTMLCanvasElement | null {
    if (this.acaiMinimapIcon) return this.acaiMinimapIcon;
    if (typeof document === 'undefined') return null;

    const size = ACAI_MINIMAP_ICON_SIZE;
    const pixels: (string | null)[] = new Array(size * size).fill(null);

    const setPixel = (x: number, y: number, color: string): void => {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || px >= size || py < 0 || py >= size) return;
      pixels[py * size + px] = color;
    };

    const fillCircle = (cx: number, cy: number, radius: number, color: string): void => {
      const minX = Math.floor(cx - radius);
      const maxX = Math.ceil(cx + radius);
      const minY = Math.floor(cy - radius);
      const maxY = Math.ceil(cy + radius);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= radius * radius + 0.2) setPixel(x, y, color);
        }
      }
    };

    const fillEllipse = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      color: string
    ): void => {
      const minX = Math.floor(cx - rx);
      const maxX = Math.ceil(cx + rx);
      const minY = Math.floor(cy - ry);
      const maxY = Math.ceil(cy + ry);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1.05) setPixel(x, y, color);
        }
      }
    };

    const outline = '#160a1e';
    const leafDark = '#1d6b34';
    const leafLight = '#3fa257';
    const stem = '#4a3420';
    const berryBody = '#3a1050';
    const berryMid = '#4f1a66';
    const berryGlint = '#b985e4';

    const drawLine = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      color: string
    ): void => {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        setPixel(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, color);
      }
    };

    // Two short stems fanning out from the crown into the bunch.
    drawLine(8, 4, 6, 6, stem);
    drawLine(8, 4, 9, 6, stem);

    // Green crown: two side leaves and one upright leaf.
    fillEllipse(4.2, 4.3, 2.5, 1.3, leafDark);
    fillEllipse(3.9, 4.0, 1.9, 0.8, leafLight);
    fillEllipse(11.8, 4.0, 2.5, 1.3, leafDark);
    fillEllipse(12.1, 3.7, 1.9, 0.8, leafLight);
    fillEllipse(8.4, 3.0, 1.5, 1.6, leafDark);
    fillEllipse(8.2, 2.8, 1.0, 1.1, leafLight);

    // Lower-right leaf peeking out from under the bunch, as in the reference.
    fillEllipse(13.3, 12.8, 2.1, 1.1, leafDark);
    fillEllipse(13.5, 12.5, 1.5, 0.7, leafLight);

    // Compact bunch: back row first so the front berries overlap naturally.
    const berries: { x: number; y: number }[] = [
      { x: 5.0, y: 6.9 },
      { x: 7.9, y: 6.5 },
      { x: 10.7, y: 7.4 },
      { x: 4.0, y: 9.4 },
      { x: 6.7, y: 9.2 },
      { x: 9.6, y: 9.5 },
      { x: 5.6, y: 11.5 },
      { x: 8.6, y: 11.8 },
    ];

    for (let i = 0; i < berries.length; i++) {
      const berry = berries[i];
      // Dark ring separates neighbouring berries; the body sits on top.
      fillCircle(berry.x, berry.y, 2.1, outline);
      fillCircle(berry.x, berry.y, 1.35, berryBody);
      fillCircle(berry.x - 0.15, berry.y - 0.35, 0.9, berryMid);
      // Lilac glint, like the reference fruit.
      setPixel(berry.x - 0.8, berry.y - 0.8, berryGlint);
      setPixel(berry.x - 0.1, berry.y - 1.0, berryGlint);
    }

    // One-pixel dark contour around the whole bunch so the marker keeps a
    // crisp silhouette on the dark minimap panel.
    const filled = pixels.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (filled[y * size + x]) continue;
        const nearFilled =
          (y > 0 && Boolean(filled[(y - 1) * size + x])) ||
          (y < size - 1 && Boolean(filled[(y + 1) * size + x])) ||
          (x > 0 && Boolean(filled[y * size + (x - 1)])) ||
          (x < size - 1 && Boolean(filled[y * size + (x + 1)]));
        if (nearFilled) pixels[y * size + x] = outline;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const color = pixels[y * size + x];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    this.acaiMinimapIcon = canvas;
    return canvas;
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
    this.waterAnimTimer += dt;

    // Torches/candles belong to the night plain. The Amazon Forest only keeps
    // its fruit trees as collectible resources, so no torch ever spawns there.
    if (this.mapId !== 'amazon_forest') {
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

    if (this.mapId === 'amazon_forest') {
      for (let i = 0; i < this.fruitTrees.length; i++) {
        const tree = this.fruitTrees[i];
        tree.animTimer += dt * 1.6;

        if (!tree.active) {
          tree.respawnTimer -= dt;
          if (tree.respawnTimer <= 0) {
            const spawn = this.findFruitTreeSpawn();
            tree.x = spawn.x;
            tree.y = spawn.y;
            tree.active = true;
            tree.respawnTimer = 0;
          }
          continue;
        }
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

    this.renderWaterSurfaceRipples(ctx, camera);

    ctx.restore();
  }

  /** Soft animated ripples that keep the river and lake surfaces alive. */
  private renderWaterSurfaceRipples(
    ctx: CanvasRenderingContext2D,
    camera: Camera
  ): void {
    const time = this.waterAnimTimer;
    const left = camera.x - camera.viewportWidth / 2 - 240;
    const right = camera.x + camera.viewportWidth / 2 + 240;
    const step = 260;
    const start = Math.floor(left / step) * step;

    ctx.save();
    ctx.strokeStyle = 'rgba(214, 244, 248, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    for (let x = start; x <= right; x += step) {
      const y = this.riverCenterY(x) + Math.sin(time * 0.7 + x * 0.004) * 48;
      const phase = time * 0.9 + x * 0.01;
      for (let ring = 0; ring < 2; ring++) {
        const rx = 34 + ring * 22 + Math.sin(phase + ring) * 6;
        const ry = 7 + ring * 4;
        ctx.globalAlpha = 0.16 + 0.08 * Math.sin(phase + ring * 1.3);
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (let i = 0; i < this.lakes.length; i++) {
      const lake = this.lakes[i];
      const margin = Math.max(lake.rx, lake.ry) + 30;
      if (!camera.isInView(lake.x, lake.y, margin)) continue;

      ctx.save();
      ctx.translate(lake.x, lake.y);
      ctx.rotate(lake.rotation);
      for (let ring = 0; ring < 3; ring++) {
        const scale = 0.22 + ring * 0.22;
        const wobble = Math.sin(time * 0.8 + ring * 1.7 + lake.x) * 0.04;
        ctx.globalAlpha = 0.12 + 0.06 * Math.sin(time * 0.6 + ring * 2.1);
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          lake.rx * scale * (1 + wobble),
          lake.ry * scale * (1 - wobble),
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  private renderAmazonDecorations(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Small grass tufts and creeping plants on the sandy river beach.
    for (let i = 0; i < this.bankPlants.length; i++) {
      const plant = this.bankPlants[i];
      if (!camera.isInView(plant.x, plant.y, plant.size * 2 + 8)) continue;

      const screen = camera.worldToScreen(plant.x, plant.y);
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(plant.rotation);

      if (plant.kind === 'tuft') {
        ctx.strokeStyle = plant.tone > 0.5 ? '#3f8f3a' : '#2f7d32';
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        for (let b = 0; b < 5; b++) {
          const spread = -0.85 + (b / 4) * 1.7;
          const height = plant.size * (1.1 + (b % 2) * 0.35);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(
            Math.sin(spread) * height * 0.35,
            -height * 0.65,
            Math.sin(spread) * height * 0.75,
            -height
          );
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      } else {
        ctx.fillStyle = plant.tone > 0.5 ? '#4f9a4b' : '#3c863c';
        for (let l = 0; l < 3; l++) {
          const spread = -0.9 + l * 0.9;
          ctx.beginPath();
          ctx.ellipse(
            Math.sin(spread) * plant.size * 0.7,
            -plant.size * 0.55,
            plant.size * 0.85,
            plant.size * 0.3,
            spread,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        ctx.fillStyle = '#2f6f32';
        ctx.beginPath();
        ctx.ellipse(0, -plant.size * 0.3, plant.size * 0.2, plant.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

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

  renderFruitTrees(ctx: CanvasRenderingContext2D, camera: Camera, player?: Player): void {
    if (this.mapId !== 'amazon_forest') return;

    const promptTree = player ? this.getInteractableFruitTree(player) : null;

    for (let i = 0; i < this.fruitTrees.length; i++) {
      const tree = this.fruitTrees[i];
      if (!tree.active) continue;
      if (!camera.isInView(tree.x, tree.y, 140)) continue;

      const screen = camera.worldToScreen(tree.x, tree.y);
      const sway = Math.sin(tree.animTimer) * 2;
      const acaiSprite = tree.kind === 'acai' ? this.getAcaiPixelSprite() : null;

      ctx.save();
      ctx.translate(screen.x, screen.y);

      if (tree.kind !== 'acai' || !acaiSprite) {
        // Shared shadow and a soft golden glow that marks a harvestable tree.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
        ctx.beginPath();
        ctx.ellipse(0, 8, 34, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
      ctx.beginPath();
      ctx.ellipse(0, 6, 46, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      if (acaiSprite) {
        // Nearest-neighbour upscale keeps the pixel-art grid perfectly crisp.
        const spriteWidth = ACAI_SPRITE_WIDTH * ACAI_SPRITE_SCALE;
        const spriteHeight = ACAI_SPRITE_HEIGHT * ACAI_SPRITE_SCALE;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          acaiSprite,
          -spriteWidth / 2,
          -spriteHeight,
          spriteWidth,
          spriteHeight
        );
        ctx.restore();
      } else if (tree.kind === 'cupuacu') {
        // Cupuaçuzeiro: short thick trunk, broad canopy and big brown fruit.
        ctx.fillStyle = '#5b3a1e';
        ctx.fillRect(-6, -42, 12, 46);

        ctx.fillStyle = '#166534';
        ctx.beginPath();
        ctx.arc(-18 + sway, -54, 24, 0, Math.PI * 2);
        ctx.arc(18 + sway, -56, 26, 0, Math.PI * 2);
        ctx.arc(0 + sway, -72, 28, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(-4 + sway, -66, 18, 0, Math.PI * 2);
        ctx.fill();

        // Stems holding the two large fruits.
        ctx.strokeStyle = '#4a2f1b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-20 + sway, -56);
        ctx.lineTo(-20, -46);
        ctx.moveTo(18 + sway, -54);
        ctx.lineTo(18, -44);
        ctx.stroke();

        ctx.fillStyle = '#7c4a21';
        ctx.beginPath();
        ctx.ellipse(-20, -38, 12, 16, 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#9a5f2d';
        ctx.beginPath();
        ctx.ellipse(18, -34, 11, 15, -0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(253, 230, 138, 0.35)';
        ctx.beginPath();
        ctx.ellipse(-23, -43, 4, 6, 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (tree.kind === 'castanha') {
        // Castanheira-do-Brasil: tall trunk, high canopy and spiky seed pods.
        ctx.fillStyle = '#5b3a1e';
        ctx.fillRect(-7, -92, 14, 96);

        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.arc(-24 + sway, -96, 26, 0, Math.PI * 2);
        ctx.arc(24 + sway, -96, 26, 0, Math.PI * 2);
        ctx.arc(0 + sway, -112, 34, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(0 + sway, -104, 22, 0, Math.PI * 2);
        ctx.fill();

        const pods: { x: number; y: number }[] = [
          { x: -18 + sway, y: -80 },
          { x: 18 + sway, y: -78 },
          { x: sway, y: -90 },
        ];
        for (let p = 0; p < pods.length; p++) {
          const pod = pods[p];
          ctx.fillStyle = '#6b4423';
          ctx.beginPath();
          for (let s = 0; s < 8; s++) {
            const angle = (s / 8) * Math.PI * 2;
            const radius = s % 2 === 0 ? 10 : 5;
            const px = pod.x + Math.cos(angle) * radius;
            const py = pod.y + Math.sin(angle) * radius;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
      } else if (tree.kind === 'buriti') {
        // Buritizeiro: tall palm with a fan crown and orange fruit clusters.
        const topX = sway * 0.5;
        const topY = -96;

        ctx.strokeStyle = '#6b4423';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(4, -52, topX, topY);
        ctx.stroke();
        ctx.lineCap = 'butt';

        for (let f = 0; f < 10; f++) {
          const angle = -Math.PI + (f / 9) * Math.PI;
          const length = 34 + (f % 3) * 6;
          ctx.strokeStyle = f % 2 === 0 ? '#15803d' : '#166534';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.quadraticCurveTo(
            topX + Math.cos(angle) * length * 0.55,
            topY + Math.sin(angle) * length * 0.55 - 5,
            topX + Math.cos(angle) * length,
            topY + Math.sin(angle) * length * 0.7
          );
          ctx.stroke();
        }

        // Hanging bunches of reddish buriti fruit.
        ctx.fillStyle = '#c2410c';
        for (let b = 0; b < 10; b++) {
          const angle = (b / 10) * Math.PI * 2;
          const radius = 8 + (b % 3) * 3;
          ctx.beginPath();
          ctx.arc(
            topX + Math.cos(angle) * radius,
            topY + 14 + Math.sin(angle) * radius * 0.6,
            3,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(topX - 4, topY + 11, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (tree.kind === 'pupunha') {
        // Pupunheira: slim ringed palm with long fronds and red fruit bunches.
        const topX = -sway * 0.4;
        const topY = -86;

        ctx.strokeStyle = '#7a4d29';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-3, -46, topX, topY);
        ctx.stroke();
        ctx.lineCap = 'butt';

        // Trunk rings.
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 1.4;
        for (let r = 0; r < 5; r++) {
          const t = 0.18 + r * 0.16;
          const rx = topX * t;
          const ry = topY * t;
          ctx.beginPath();
          ctx.moveTo(rx - 5, ry);
          ctx.lineTo(rx + 5, ry);
          ctx.stroke();
        }

        for (let f = 0; f < 9; f++) {
          const angle = -Math.PI + (f / 8) * Math.PI;
          const length = 30 + (f % 2) * 8;
          ctx.strokeStyle = f % 2 === 0 ? '#166534' : '#15803d';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.quadraticCurveTo(
            topX + Math.cos(angle) * length * 0.5,
            topY + Math.sin(angle) * length * 0.55 - 6,
            topX + Math.cos(angle) * length,
            topY + Math.sin(angle) * length * 0.75
          );
          ctx.stroke();
        }

        // Orange-red pupunha fruit cluster at the crown.
        ctx.fillStyle = '#dc2626';
        for (let b = 0; b < 9; b++) {
          const angle = (b / 9) * Math.PI * 2;
          const radius = 6 + (b % 3) * 2;
          ctx.beginPath();
          ctx.arc(
            topX + Math.cos(angle) * radius,
            topY + 9 + Math.sin(angle) * radius * 0.6,
            2.6,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(topX + 4, topY + 7, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (tree.kind === 'araca') {
        // Araçazeiro: bushy small tree with round yellow-green araçá fruit.
        ctx.fillStyle = '#5b3a1e';
        ctx.fillRect(-5, -34, 10, 38);

        ctx.fillStyle = '#166534';
        ctx.beginPath();
        ctx.arc(-17 + sway, -46, 21, 0, Math.PI * 2);
        ctx.arc(17 + sway, -48, 23, 0, Math.PI * 2);
        ctx.arc(0 + sway, -66, 26, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(-2 + sway, -54, 17, 0, Math.PI * 2);
        ctx.fill();

        // Round araçá fruit hanging under the canopy.
        const aracaFruit: { x: number; y: number }[] = [
          { x: -22 + sway, y: -50 },
          { x: -8 + sway, y: -40 },
          { x: 10 + sway, y: -44 },
          { x: 24 + sway, y: -54 },
          { x: 2 + sway, y: -60 },
        ];
        for (let f = 0; f < aracaFruit.length; f++) {
          const fruit = aracaFruit[f];
          ctx.fillStyle = f % 2 === 0 ? '#facc15' : '#a3e635';
          ctx.beginPath();
          ctx.arc(fruit.x, fruit.y, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.beginPath();
          ctx.arc(fruit.x - 1.8, fruit.y - 1.8, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      if (tree === promptTree) {
        this.renderFruitPrompt(
          ctx,
          screen.x,
          screen.y + this.getFruitPromptOffsetY(tree),
          tree.kind
        );
      }
    }
  }

  private renderFruitPrompt(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    kind: FruitTreeKind
  ): void {
    const halfWidth = FRUIT_TREE_PROMPT_WIDTH / 2;
    const halfHeight = FRUIT_TREE_PROMPT_HEIGHT / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(8, 15, 10, 0.85)';
    ctx.fillRect(x - halfWidth, y - halfHeight, FRUIT_TREE_PROMPT_WIDTH, FRUIT_TREE_PROMPT_HEIGHT);

    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      x - halfWidth + 0.5,
      y - halfHeight + 0.5,
      FRUIT_TREE_PROMPT_WIDTH - 1,
      FRUIT_TREE_PROMPT_HEIGHT - 1
    );

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#fef9c3';
    ctx.fillText('[E] Coletar', x, y - 8);

    ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#facc15';
    ctx.fillText(FRUIT_TREE_BENEFITS[kind], x, y + 10);
    ctx.restore();
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
