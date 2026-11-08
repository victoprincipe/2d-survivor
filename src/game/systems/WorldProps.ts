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
const FRUIT_TREE_PROMPT_WIDTH = 210;
const FRUIT_TREE_PROMPT_HEIGHT = 42;
const FRUIT_TREE_PROMPT_PADDING = 10;

// The açaí palm is a hand-crafted 32x40 pixel-art sprite. Its colours live in
// a matrix that is rasterized once into an offscreen canvas (nearest-neighbour)
// and then reused every frame, so the tree stays crisp at any zoom.
const ACAI_SPRITE_WIDTH = 32;
const ACAI_SPRITE_HEIGHT = 40;
const ACAI_SPRITE_SCALE = 3;

// The cupuaçuzeiro is likewise hand-crafted pixel art: a 48x56 sprite with a
// large oval ground shadow, rasterized once into an offscreen canvas and then
// upscaled with nearest-neighbour so the canopy, branches and hanging fruits
// keep crisp pixel edges at any zoom.
const CUPUACU_SPRITE_WIDTH = 48;
const CUPUACU_SPRITE_HEIGHT = 56;
const CUPUACU_SPRITE_SCALE = 2;

// The castanheira-do-Brasil is the tallest hand-crafted fruit tree: a 64x92
// pixel-art sprite with buttress roots, a thick grey barked trunk, a broad
// rounded canopy and large round seed pods. It is rasterized once into an
// offscreen canvas and then upscaled with nearest-neighbour so every pixel
// stays crisp at any zoom.
const CASTANHA_SPRITE_WIDTH = 64;
const CASTANHA_SPRITE_HEIGHT = 92;
const CASTANHA_SPRITE_SCALE = 2;

// The buritizeiro is a slender hand-crafted 48x64 palm: a tall grey trunk with
// well-defined rings, a wide fan crown of large open dark-green fronds, hanging
// orange-red fruit bunches and a dark oval shadow under the trunk. It is
// rasterized once into an offscreen canvas and upscaled with nearest-neighbour.
const BURITI_SPRITE_WIDTH = 48;
const BURITI_SPRITE_HEIGHT = 64;
const BURITI_SPRITE_SCALE = 2;

// The pupunheira is a hand-crafted 48x64 palm: a dark contour, a slim
// segmented grey trunk bristling with black spine rings, a tall crown of
// arched green fronds, heavy red-and-orange fruit bunches hanging below the
// crown and a dark oval shadow under the base. It is rasterized once into an
// offscreen canvas and upscaled with nearest-neighbour.
const PUPUNHA_SPRITE_WIDTH = 48;
const PUPUNHA_SPRITE_HEIGHT = 64;
const PUPUNHA_SPRITE_SCALE = 2;

// The araçazeiro is a hand-crafted 56x64 pixel-art fruit tree: a dark contour,
// a textured brown trunk that forks into three main branches, a very dense
// rounded canopy with layered dark/light green leaves, bright round yellow
// araçá fruits scattered through the foliage and a dark oval ground shadow. It
// is rasterized once into an offscreen canvas and upscaled with
// nearest-neighbour so every pixel stays crisp at any zoom.
const ARACA_SPRITE_WIDTH = 56;
const ARACA_SPRITE_HEIGHT = 64;
const ARACA_SPRITE_SCALE = 2;

// Fruit tree minimap markers: hand-drawn 16x16 pixel-art icons, rasterized
// once into offscreen canvases and blitted at 16x16 with smoothing disabled
// so every pixel of the art is preserved.
const ACAI_MINIMAP_ICON_SIZE = 16;
const ACAI_MINIMAP_ICON_DRAW_SIZE = 16;

// Amazon field plants: dangerous thorn bushes and the medicinal São-Caetano
// herb. Both are scattered over dry land and the herb respawns elsewhere after
// being harvested, so the player always has a way to cure the wound.
const THORN_BUSH_COUNT = 56;
const THORN_BUSH_RADIUS = 24;
const HERB_COUNT = 14;
const HERB_RESPAWN = 35;
const HERB_PICKUP_RADIUS = 34;
const HERB_PROMPT_WIDTH = 262;
const HERB_PROMPT_HEIGHT = 44;

// Purely decorative Amazon vegetation. These trees are scattered once with the
// deterministic forest seed, never move, block the body through their trunk and
// fade their canopy over characters walking behind them.
const DECOR_TREE_COUNT = 720;

// Amazon water. The river and lakes slow anyone wading through them, while
// aquatic enemies use the stricter isNavigableWater check below to stay wet.
const RIVER_WIDTH = 980;
const RIVER_BANK = 260;
const RIVER_HALF_WIDTH = RIVER_WIDTH / 2;
// Muddy strip that oozes out of the water margins onto the sand and forest.
const MUD_BAND = 130;

// Movement penalties applied while wading through water or trudging in mud.
export const WATER_SPEED_MULTIPLIER = 0.7;
export const MUD_SPEED_MULTIPLIER = 0.8;

// Repeating pixel-art tiles used by the Amazon ground/beach/water textures.
const FOREST_GROUND_TILE = 320;
const SAND_GRAIN_TILE = 160;
const WATER_SHIMMER_TILE = 192;

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

/** Low, twisted bush whose thorns wound anyone walking through it. */
export interface ThornBushProp {
  id: number;
  x: number;
  y: number;
  radius: number;
  animTimer: number;
}

/** São-Caetano herb: heals the thorn slow and bleeding when harvested. */
export interface HerbProp {
  id: number;
  x: number;
  y: number;
  active: boolean;
  respawnTimer: number;
  animTimer: number;
}

// Fruit name shown in the collect prompt for each Amazon fruit tree.
const FRUIT_TREE_NAMES: Record<FruitTreeKind, string> = {
  acai: 'Açaí',
  cupuacu: 'Cupuaçu',
  castanha: 'Castanha-do-Pará',
  buriti: 'Buriti',
  pupunha: 'Pupunha',
  araca: 'Araçá',
};

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

type FloorPatchKind = 'dirt' | 'moss' | 'wet';

interface FloorPatch {
  x: number;
  y: number;
  rx: number;
  ry: number;
  tone: number;
  rotation: number;
  kind: FloorPatchKind;
}

// Small fixed vegetation and forest-floor details. They are scattered once
// with the deterministic forest seed and never move, so the ground keeps a
// stable pixel-art look between frames.
interface GroundTuftProp {
  x: number;
  y: number;
  size: number;
  tone: number;
  rotation: number;
}

interface BeachStoneProp {
  x: number;
  y: number;
  size: number;
  tone: number;
  rotation: number;
}

interface BeachBranchProp {
  x: number;
  y: number;
  length: number;
  tone: number;
  angle: number;
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

// Elevated plateaus in the middle of the forest. The ellipse is the walkable
// hilltop and its rim is an impassable earth/stone wall, except for the single
// dirt ramp described by rampAngle/rampHalfWidth/rampLength.
interface PlateauProp {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rampAngle: number;
  rampHalfWidth: number;
  rampLength: number;
}

type DecorTreeKind = 'samauma' | 'castanheira' | 'palmeira';

interface DecorTreeProp {
  kind: DecorTreeKind;
  x: number;
  y: number;
  scale: number;
  tone: number;
}

interface DecorTreeMetrics {
  trunkHeight: number;
  trunkHalfWidth: number;
  canopyX: number;
  canopyY: number;
  canopyRx: number;
  canopyRy: number;
  margin: number;
}

interface CanopyEntity {
  x: number;
  y: number;
  radius: number;
}

const PLATEAU_RIM_WIDTH = 22;
const PLATEAU_RAMP_INSET = 120;

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
  public thornBushes: ThornBushProp[] = [];
  private nextThornBushId: number = 1;
  public herbs: HerbProp[] = [];
  private nextHerbId: number = 1;
  private trees: TreeProp[] = [];
  // LRU cache: rasterize only visible trees, with a 16 MiB RGBA budget.
  private treeSprites = new Map<TreeProp, HTMLCanvasElement>();
  private treeSpriteBytes = 0;
  private treeSpriteScale = 1;
  private readonly treeSpriteBudget = 16 * 1024 * 1024;
  private floorPatches: FloorPatch[] = [];
  private lakes: LakeProp[] = [];
  private lakeOutlinePoints = new WeakMap<LakeProp, Float64Array>();
  private lilies: LilyProp[] = [];
  private palms: PalmProp[] = [];
  private ferns: FernProp[] = [];
  private rocks: RockProp[] = [];
  private bankPlants: BankPlantProp[] = [];
  private groundTufts: GroundTuftProp[] = [];
  private beachStones: BeachStoneProp[] = [];
  private beachBranches: BeachBranchProp[] = [];
  private plateaus: PlateauProp[] = [];
  private decorTrees: DecorTreeProp[] = [];

  private floorImage: HTMLImageElement | null = null;
  private floorPattern: CanvasPattern | null = null;
  private forestGroundPattern: CanvasPattern | null = null;
  private sandGrainPattern: CanvasPattern | null = null;
  private waterShimmerPattern: CanvasPattern | null = null;
  private acaiPixelSprite: HTMLCanvasElement | null = null;
  private cupuacuPixelSprite: HTMLCanvasElement | null = null;
  private castanhaPixelSprite: HTMLCanvasElement | null = null;
  private buritiPixelSprite: HTMLCanvasElement | null = null;
  private pupunhaPixelSprite: HTMLCanvasElement | null = null;
  private aracaPixelSprite: HTMLCanvasElement | null = null;
  private acaiMinimapIcon: HTMLCanvasElement | null = null;
  private fruitMinimapIcons: Partial<Record<FruitTreeKind, HTMLCanvasElement>> = {};
  private waterAnimTimer: number = 0;

  constructor(mapId: MapId = 'night_plain') {
    this.mapId = mapId;
    if (mapId === 'amazon_forest') {
      this.worldHalfSize = FOREST_HALF_SIZE;
      this.generatePlateaus();
      this.generateForest();
      this.spawnInitialFruitTrees();
      this.spawnFieldPlants();
    }
    this.loadFloorTexture();
  }

  /**
   * Picks a random valid land position for the hero. The Amazon Forest map is
   * finite, so the point stays away from the dense border tree wall, the
   * river/lake water, the plateaus and any solid tree trunk.
   */
  public getRandomPlayerSpawn(radius: number = 18): { x: number; y: number } {
    if (this.mapId !== 'amazon_forest') return { x: 0, y: 0 };

    const limit = FOREST_HALF_SIZE - 420;
    const isSafe = (x: number, y: number): boolean => {
      if (this.isWaterSurface(x, y)) return false;
      if (this.isOverPlateau(x, y, radius + 40)) return false;
      if (this.isOnPlateauRamp(x, y, radius + 40)) return false;
      if (this.collidesWithTree(x, y, radius + 24)) return false;
      return true;
    };

    for (let attempt = 0; attempt < 400; attempt++) {
      const x = (Math.random() * 2 - 1) * limit;
      const y = (Math.random() * 2 - 1) * limit;
      if (isSafe(x, y)) return { x, y };
    }

    // Extremely unlikely fallback: scan inland from the corners until a dry,
    // obstacle-free patch is found.
    for (let y = -limit; y <= limit; y += 240) {
      for (let x = -limit; x <= limit; x += 240) {
        if (isSafe(x, y)) return { x, y };
      }
    }

    return { x: 0, y: -limit };
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
      if (this.isOverPlateau(x, y, 70) || this.isOnPlateauRamp(x, y, 70)) continue;
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
      if (this.isInWater(x, y)) continue;
      if (this.isOverPlateau(x, y, 70) || this.isOnPlateauRamp(x, y, 70)) continue;
      if (this.collidesWithTree(x, y, 70)) continue;
      return { x, y };
    }

    return {
      x: (Math.random() * 2 - 1) * limit,
      y: (Math.random() * 2 - 1) * limit,
    };
  }

  /**
   * Scatters the Amazon field plants: thorn bushes everywhere on dry ground
   * and a handful of São-Caetano herbs growing on the forest floor. Positions
   * are random but always clear of water, hills, ramps, tree trunks and the
   * other collectible plants.
   */
  private spawnFieldPlants(): void {
    for (let i = 0; i < THORN_BUSH_COUNT; i++) {
      const spawn = this.findFieldPlantSpawn(26);
      this.thornBushes.push({
        id: this.nextThornBushId++,
        x: spawn.x,
        y: spawn.y,
        radius: THORN_BUSH_RADIUS,
        animTimer: Math.random() * Math.PI * 2,
      });
    }

    for (let i = 0; i < HERB_COUNT; i++) {
      const spawn = this.findFieldPlantSpawn(20);
      this.herbs.push({
        id: this.nextHerbId++,
        x: spawn.x,
        y: spawn.y,
        active: true,
        respawnTimer: 0,
        animTimer: Math.random() * Math.PI * 2,
      });
    }
  }

  private findFieldPlantSpawn(clearance: number): { x: number; y: number } {
    const limit = FOREST_HALF_SIZE - 420;

    for (let attempt = 0; attempt < 240; attempt++) {
      const x = (Math.random() * 2 - 1) * limit;
      const y = (Math.random() * 2 - 1) * limit;

      if (this.isInWater(x, y)) continue;
      if (this.isOverPlateau(x, y, clearance + 40)) continue;
      if (this.isOnPlateauRamp(x, y, clearance + 40)) continue;
      if (this.collidesWithTree(x, y, clearance + 30)) continue;

      // Keep some breathing room around fruit trees and other field plants.
      let overlaps = false;
      for (let i = 0; i < this.fruitTrees.length; i++) {
        const tree = this.fruitTrees[i];
        const minDist = clearance + 120;
        const dx = x - tree.x;
        const dy = y - tree.y;
        if (dx * dx + dy * dy < minDist * minDist) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;
      for (let i = 0; i < this.thornBushes.length; i++) {
        const bush = this.thornBushes[i];
        const minDist = clearance + 60;
        const dx = x - bush.x;
        const dy = y - bush.y;
        if (dx * dx + dy * dy < minDist * minDist) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;
      for (let i = 0; i < this.herbs.length; i++) {
        const herb = this.herbs[i];
        const minDist = clearance + 60;
        const dx = x - herb.x;
        const dy = y - herb.y;
        if (dx * dx + dy * dy < minDist * minDist) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      return { x, y };
    }

    return this.findFruitTreeSpawn();
  }

  /** Returns the thorn bush whose spikes overlap a body at (x, y). */
  public getThornBushAt(x: number, y: number, radius: number): ThornBushProp | null {
    if (this.mapId !== 'amazon_forest') return null;

    for (let i = 0; i < this.thornBushes.length; i++) {
      const bush = this.thornBushes[i];
      const dx = x - bush.x;
      const dy = y - bush.y;
      const minDist = radius + bush.radius * 0.72;
      if (dx * dx + dy * dy <= minDist * minDist) return bush;
    }
    return null;
  }

  /** Returns the closest active herb within the player's reach. */
  public getInteractableHerb(player: Player): HerbProp | null {
    if (this.mapId !== 'amazon_forest') return null;

    const reach = player.radius + HERB_PICKUP_RADIUS;
    let closest: HerbProp | null = null;
    let closestDistance = reach * reach;

    for (let i = 0; i < this.herbs.length; i++) {
      const herb = this.herbs[i];
      if (!herb.active) continue;

      const dx = player.x - herb.x;
      const dy = player.y - herb.y;
      const distance = dx * dx + dy * dy;
      if (distance <= closestDistance) {
        closest = herb;
        closestDistance = distance;
      }
    }

    return closest;
  }

  /** Harvests the nearby herb the player is prompting, if any. */
  public collectNearbyHerb(player: Player): HerbProp | null {
    const herb = this.getInteractableHerb(player);
    if (!herb) return null;
    herb.active = false;
    herb.respawnTimer = HERB_RESPAWN;
    return herb;
  }

  private getHerbPromptOffsetY(herb: HerbProp): number {
    return -30 + Math.sin(herb.animTimer * 2.4) * 1.5;
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
        offset = -196;
        break;
      case 'buriti':
        offset = -142;
        break;
      case 'pupunha':
        offset = -142;
        break;
      case 'cupuacu':
        offset = -112;
        break;
      case 'acai':
        offset = -146;
        break;
      case 'araca':
      default:
        offset = -124;
        break;
    }
    return offset + Math.sin(tree.animTimer * 2.2) * 2;
  }

  private generatePlateaus(): void {
    // Three hand-placed hills around the centre of the map. Each one has a
    // single dirt ramp at a different side, so the player and the animals must
    // walk around the rim and climb through that opening.
    this.plateaus = [
      {
        x: -2200,
        y: 1900,
        rx: 860,
        ry: 640,
        rampAngle: 0.18,
        rampHalfWidth: 122,
        rampLength: 520,
      },
      {
        x: 2100,
        y: -1900,
        rx: 800,
        ry: 600,
        rampAngle: Math.PI - 0.22,
        rampHalfWidth: 112,
        rampLength: 470,
      },
      {
        x: 300,
        y: 2900,
        rx: 820,
        ry: 640,
        rampAngle: Math.PI / 2 + 0.2,
        rampHalfWidth: 118,
        rampLength: 500,
      },
    ];
  }

  /**
   * Deterministic organic wobble applied to a plateau's footprint. The low
   * frequency terms push the cliff in and out in broad lobes, while the higher
   * ones break the silhouette into small rocky irregularities.
   */
  private getPlateauEdgeScale(dirX: number, dirY: number, plateau: PlateauProp): number {
    const angle = Math.atan2(dirY, dirX);
    const phase = plateau.x * 0.0067 + plateau.y * 0.0081;
    return (
      1 +
      Math.sin(angle * 3 + phase) * 0.06 +
      Math.sin(angle * 5 - phase * 1.3) * 0.035 +
      Math.sin(angle * 8 + phase * 0.7) * 0.02
    );
  }

  /** Distance from the plateau centre to its organic rim along a direction. */
  private getPlateauBoundaryRadius(plateau: PlateauProp, dirX: number, dirY: number): number {
    const nx = dirX / plateau.rx;
    const ny = dirY / plateau.ry;
    const ellipseRadius = 1 / Math.sqrt(nx * nx + ny * ny);
    return ellipseRadius * this.getPlateauEdgeScale(dirX, dirY, plateau);
  }

  private isInsidePlateauTop(plateau: PlateauProp, x: number, y: number): boolean {
    const dx = x - plateau.x;
    const dy = y - plateau.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.0001) return true;
    return distance <= this.getPlateauBoundaryRadius(plateau, dx / distance, dy / distance);
  }

  /** True when (x, y) lies anywhere on the hilltop, dilated by padding. */
  private isOverPlateau(x: number, y: number, padding: number = 0): boolean {
    for (let i = 0; i < this.plateaus.length; i++) {
      const plateau = this.plateaus[i];
      const dx = x - plateau.x;
      const dy = y - plateau.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 0.0001) return true;
      const boundary =
        this.getPlateauBoundaryRadius(plateau, dx / distance, dy / distance) + padding;
      if (distance <= boundary) return true;
    }
    return false;
  }

  /** Traces the irregular hilltop/wall silhouette using organic radii. */
  private tracePlateauShape(
    ctx: CanvasRenderingContext2D,
    plateau: PlateauProp,
    extraRadius: number = 0,
    startAngle: number = 0,
    endAngle: number = Math.PI * 2
  ): void {
    const steps = Math.max(12, Math.ceil(((endAngle - startAngle) / (Math.PI * 2)) * 96));
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + ((endAngle - startAngle) * i) / steps;
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      const radius =
        this.getPlateauBoundaryRadius(plateau, dirX, dirY) + extraRadius;
      const x = dirX * radius;
      const y = dirY * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  /**
   * Ramp cross-section. Its centre meanders and its banks widen/narrow along
   * the slope so the passage reads as an eroded organic valley instead of a
   * straight rectangular cut.
   */
  private getPlateauRampProfile(
    plateau: PlateauProp,
    along: number,
    inner: number,
    outer: number
  ): { center: number; halfWidth: number } {
    const t = Math.max(0, Math.min(1, (along - inner) / Math.max(1, outer - inner)));
    const phase = plateau.x * 0.0031 + plateau.y * 0.0017;
    const center = Math.sin(t * Math.PI * 1.25 + phase) * plateau.rampHalfWidth * 0.14;
    const wobble =
      1 +
      Math.sin(t * 9.3 + phase * 1.6) * 0.06 +
      Math.sin(t * 17.1 - phase) * 0.03;
    return {
      center,
      halfWidth: plateau.rampHalfWidth * (1 + 0.18 * t) * wobble,
    };
  }

  /** Traces one winding edge of the dirt ramp. */
  private tracePlateauRampEdge(
    ctx: CanvasRenderingContext2D,
    plateau: PlateauProp,
    inner: number,
    outer: number,
    side: -1 | 1
  ): void {
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const along = inner + (outer - inner) * t;
      const profile = this.getPlateauRampProfile(plateau, along, inner, outer);
      const y = profile.center + side * profile.halfWidth;
      if (i === 0) ctx.moveTo(along, y);
      else ctx.lineTo(along, y);
    }
  }

  /** Traces the winding dirt ramp between its inner and outer ends. */
  private tracePlateauRamp(
    ctx: CanvasRenderingContext2D,
    plateau: PlateauProp,
    inner: number,
    outer: number
  ): void {
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const along = inner + (outer - inner) * t;
      const profile = this.getPlateauRampProfile(plateau, along, inner, outer);
      const y = profile.center - profile.halfWidth;
      if (i === 0) ctx.moveTo(along, y);
      else ctx.lineTo(along, y);
    }

    // Irregular outer lip so the slope melts into the forest instead of
    // ending on a perfectly straight cut.
    const outerProfile = this.getPlateauRampProfile(plateau, outer, inner, outer);
    const capSteps = 6;
    for (let i = 1; i < capSteps; i++) {
      const f = i / capSteps;
      ctx.lineTo(
        outer + Math.sin(f * Math.PI) * 10,
        outerProfile.center - outerProfile.halfWidth + f * 2 * outerProfile.halfWidth
      );
    }

    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const along = inner + (outer - inner) * t;
      const profile = this.getPlateauRampProfile(plateau, along, inner, outer);
      ctx.lineTo(along, profile.center + profile.halfWidth);
    }

    // Soft, uneven inner throat where the ramp meets the hilltop.
    const innerProfile = this.getPlateauRampProfile(plateau, inner, inner, outer);
    for (let i = 1; i < capSteps; i++) {
      const f = i / capSteps;
      ctx.lineTo(
        inner - Math.sin(f * Math.PI) * 8,
        innerProfile.center + innerProfile.halfWidth - f * 2 * innerProfile.halfWidth
      );
    }
    ctx.closePath();
  }

  /** True when (x, y) is inside the cut of the plateau's dirt ramp. */
  private isInsidePlateauRamp(
    plateau: PlateauProp,
    x: number,
    y: number,
    padding: number = 0
  ): boolean {
    const dirX = Math.cos(plateau.rampAngle);
    const dirY = Math.sin(plateau.rampAngle);
    const relX = x - plateau.x;
    const relY = y - plateau.y;
    const along = relX * dirX + relY * dirY;
    const lateral = -relX * dirY + relY * dirX;
    const boundary = this.getPlateauBoundaryRadius(plateau, dirX, dirY);
    const inner = boundary - PLATEAU_RAMP_INSET;
    const outer = boundary + plateau.rampLength;
    const profile = this.getPlateauRampProfile(plateau, along, inner, outer);
    return (
      along >= inner &&
      along <= outer &&
      Math.abs(lateral - profile.center) <= profile.halfWidth + padding
    );
  }

  /** True when (x, y) falls on any plateau ramp, including its outside slope. */
  private isOnPlateauRamp(x: number, y: number, padding: number = 0): boolean {
    for (let i = 0; i < this.plateaus.length; i++) {
      if (this.isInsidePlateauRamp(this.plateaus[i], x, y, padding)) return true;
    }
    return false;
  }

  /**
   * The raised rim is only crossable through the ramp. Jumping lets the hero
   * leave the hilltop (down the cliff), but never climb it from below.
   */
  private blocksOnPlateauRim(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    allowDescent: boolean,
    bodyRadius: number
  ): boolean {
    for (let i = 0; i < this.plateaus.length; i++) {
      const plateau = this.plateaus[i];
      const fromInside = this.isInsidePlateauTop(plateau, fromX, fromY);
      const toInside = this.isInsidePlateauTop(plateau, toX, toY);
      if (fromInside === toInside) continue;

      if (
        this.isInsidePlateauRamp(plateau, fromX, fromY, -bodyRadius) &&
        this.isInsidePlateauRamp(plateau, toX, toY, -bodyRadius)
      ) {
        continue;
      }

      if (allowDescent && fromInside && !toInside) continue;
      return true;
    }
    return false;
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

    // Dirt, moss and damp-soil patches over the dark green grass floor.
    for (let i = 0; i < 140; i++) {
      const kindRoll = random();
      this.floorPatches.push({
        x: (random() - 0.5) * FOREST_SIZE,
        y: (random() - 0.5) * FOREST_SIZE,
        rx: 30 + random() * 120,
        ry: 18 + random() * 80,
        tone: random(),
        rotation: random() * Math.PI,
        kind: kindRoll < 0.55 ? 'dirt' : kindRoll < 0.82 ? 'moss' : 'wet',
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
      const riverHalf = this.getRiverHalfWidth(x, RIVER_HALF_WIDTH);
      const y = this.riverCenterY(x) + (random() - 0.5) * riverHalf * 1.56;
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
    const bankMin = 12;
    const bankSpan = RIVER_BANK - 30;
    for (let i = 0; i < 620; i++) {
      const x = (random() - 0.5) * FOREST_SIZE * 0.95;
      const side = random() < 0.5 ? -1 : 1;
      const waterEdge = this.getRiverHalfWidth(x, RIVER_HALF_WIDTH);
      const offset = waterEdge + bankMin + random() * bankSpan;
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

    // Small stones and dry branches resting on the river margin.
    for (let i = 0; i < 460; i++) {
      const x = (random() - 0.5) * FOREST_SIZE * 0.95;
      const side = random() < 0.5 ? -1 : 1;
      const waterEdge = this.getRiverHalfWidth(x, RIVER_HALF_WIDTH);
      const offset = waterEdge + bankMin + random() * bankSpan;
      const y = this.riverCenterY(x) + side * offset;
      if (
        Math.abs(x) > FOREST_HALF_SIZE - 140 ||
        Math.abs(y) > FOREST_HALF_SIZE - 140
      ) {
        continue;
      }
      if (random() < 0.62) {
        this.beachStones.push({
          x,
          y,
          size: 2.5 + random() * 5,
          tone: random(),
          rotation: random() * Math.PI * 2,
        });
      } else {
        this.beachBranches.push({
          x,
          y,
          length: 8 + random() * 18,
          tone: random(),
          angle: random() * Math.PI * 2,
        });
      }
    }

    // Fixed grass tufts spread over the dry forest floor. The tiled ground
    // texture already carries fine noise; these add 2.5D volume up close.
    for (let i = 0; i < 6200; i++) {
      const x = (random() - 0.5) * FOREST_SIZE * 0.94;
      const y = (random() - 0.5) * FOREST_SIZE * 0.94;
      if (Math.abs(x) < 90 && Math.abs(y) < 90) continue;
      if (this.isInWater(x, y)) continue;
      this.groundTufts.push({
        x,
        y,
        size: 3 + random() * 6,
        tone: random(),
        rotation: (random() - 0.5) * 0.7,
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

    // Keep the hills and their ramps clear: base-level trees and ground clutter
    // would otherwise be drawn as if they grew out of the cliff or blocked the
    // only climbable passage.
    const clearOfPlateaus = (x: number, y: number, padding: number): boolean =>
      !this.isOverPlateau(x, y, padding) && !this.isOnPlateauRamp(x, y, padding);

    this.trees = this.trees.filter((tree) =>
      clearOfPlateaus(tree.x, tree.y, tree.size * 0.32)
    );
    this.groundTufts = this.groundTufts.filter((tuft) =>
      clearOfPlateaus(tuft.x, tuft.y, tuft.size + 8)
    );
    this.palms = this.palms.filter((palm) =>
      clearOfPlateaus(palm.x, palm.y, palm.size)
    );
    this.ferns = this.ferns.filter((fern) =>
      clearOfPlateaus(fern.x, fern.y, fern.size)
    );
    this.rocks = this.rocks.filter((rock) =>
      clearOfPlateaus(rock.x, rock.y, rock.size)
    );

    this.generateDecorTrees(random);
  }

  /**
   * Scatters the fixed decorative canopy trees. Placement is rejection-sampled
   * with the deterministic forest seed, so the forest looks identical on every
   * run, and refuses water, hills/ramps and other trunks.
   */
  private generateDecorTrees(random: () => number): void {
    const limit = FOREST_HALF_SIZE - 320;

    for (let i = 0; i < DECOR_TREE_COUNT; i++) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = (random() * 2 - 1) * limit;
        const y = (random() * 2 - 1) * limit;

        // Keep the initial spawn clearing readable.
        if (Math.abs(x) < 280 && Math.abs(y) < 280) continue;
        if (this.isInWater(x, y)) continue;
        if (this.isOverPlateau(x, y, 130) || this.isOnPlateauRamp(x, y, 130)) continue;
        if (this.collidesWithTree(x, y, 54)) continue;

        const kindRoll = random();
        const kind: DecorTreeKind =
          kindRoll < 0.26 ? 'samauma' : kindRoll < 0.68 ? 'castanheira' : 'palmeira';
        const scale =
          kind === 'samauma'
            ? 0.9 + random() * 0.5
            : kind === 'castanheira'
              ? 0.82 + random() * 0.42
              : 0.88 + random() * 0.46;

        this.decorTrees.push({ kind, x, y, scale, tone: random() });
        break;
      }
    }
  }

  private getDecorTreeMetrics(tree: DecorTreeProp): DecorTreeMetrics {
    switch (tree.kind) {
      case 'samauma':
        return {
          trunkHeight: 152 * tree.scale,
          trunkHalfWidth: 19 * tree.scale,
          canopyX: 0,
          canopyY: -176 * tree.scale,
          canopyRx: 98 * tree.scale,
          canopyRy: 64 * tree.scale,
          margin: 310 * tree.scale,
        };
      case 'castanheira':
        return {
          trunkHeight: 98 * tree.scale,
          trunkHalfWidth: 11 * tree.scale,
          canopyX: 0,
          canopyY: -114 * tree.scale,
          canopyRx: 64 * tree.scale,
          canopyRy: 43 * tree.scale,
          margin: 200 * tree.scale,
        };
      case 'palmeira':
      default:
        return {
          trunkHeight: 140 * tree.scale,
          trunkHalfWidth: 7 * tree.scale,
          canopyX: (tree.tone - 0.5) * 30 * tree.scale,
          canopyY: -148 * tree.scale,
          canopyRx: 58 * tree.scale,
          canopyRy: 34 * tree.scale,
          margin: 220 * tree.scale,
        };
    }
  }

  private getDecorTreeCollisionRadius(tree: DecorTreeProp): number {
    switch (tree.kind) {
      case 'samauma':
        return 17 * tree.scale;
      case 'castanheira':
        return 10 * tree.scale;
      case 'palmeira':
      default:
        return 7 * tree.scale;
    }
  }

  private riverCenterY(x: number): number {
    return (
      Math.sin((x / FOREST_SIZE) * Math.PI * 1.6) * 1450 +
      Math.sin(x / 1600) * 240 +
      Math.sin(x / 620) * 58
    );
  }

  /**
   * Organic widening/narrowing of the river along its course. Multiplying the
   * whole bank profile by this factor carves small bays and sharper bends while
   * keeping every water/collision check in sync with the painted shore.
   */
  private getRiverWidthScale(x: number): number {
    return (
      1 +
      Math.sin(x * 0.0011 + 0.7) * 0.075 +
      Math.sin(x * 0.0027 - 1.1) * 0.045 +
      Math.sin(x * 0.0061 + 2.3) * 0.02
    );
  }

  private getRiverHalfWidth(x: number, halfWidth: number): number {
    return halfWidth * this.getRiverWidthScale(x);
  }

  /**
   * Organic thickness of the muddy margin. The same profile feeds both the
   * painted mud and the terrain check, so footsteps match the dark clay.
   */
  private getMudBandThickness(x: number): number {
    return (
      MUD_BAND *
      (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(x * 0.0042 + 1.3)))
    );
  }

  /**
   * Deterministic irregular lake outline. The noise is a function of the
   * normalized ellipse angle, so painting and the collision checks agree.
   */
  private getLakeEdgeScale(lake: LakeProp, angle: number): number {
    const phase = lake.x * 0.0043 + lake.y * 0.0059;
    return (
      1 +
      Math.sin(angle * 3 + phase) * 0.09 +
      Math.sin(angle * 5 - phase * 1.4) * 0.045 +
      Math.sin(angle * 7 + phase * 0.8) * 0.025
    );
  }

  private getLakeNormalizedAngle(lake: LakeProp, x: number, y: number): number {
    const dx = x - lake.x;
    const dy = y - lake.y;
    const cos = Math.cos(-lake.rotation);
    const sin = Math.sin(-lake.rotation);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return Math.atan2(ly / Math.max(1, lake.ry), lx / Math.max(1, lake.rx));
  }

  /** Traces an organic lake/beach outline in the lake's local space. */
  private traceLakeShape(
    ctx: CanvasRenderingContext2D,
    lake: LakeProp,
    rx: number,
    ry: number
  ): void {
    const steps = 80;
    let points = this.lakeOutlinePoints.get(lake);
    if (!points) {
      points = new Float64Array((steps + 1) * 2);
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const scale = this.getLakeEdgeScale(lake, angle);
        points[i * 2] = Math.cos(angle) * scale;
        points[i * 2 + 1] = Math.sin(angle) * scale;
      }
      this.lakeOutlinePoints.set(lake, points);
    }
    for (let i = 0; i <= steps; i++) {
      const x = points[i * 2] * rx;
      const y = points[i * 2 + 1] * ry;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  private isInWater(x: number, y: number): boolean {
    // River band, including the whole sandy beach so land props stay clear of it.
    const riverHalf = this.getRiverHalfWidth(x, RIVER_HALF_WIDTH + RIVER_BANK);
    if (Math.abs(y - this.riverCenterY(x)) < riverHalf) return true;

    // Lakes (rotated organic ellipses).
    for (let i = 0; i < this.lakes.length; i++) {
      const lake = this.lakes[i];
      const dx = x - lake.x;
      const dy = y - lake.y;
      const cos = Math.cos(-lake.rotation);
      const sin = Math.sin(-lake.rotation);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const rho = Math.sqrt(
        (lx * lx) / (lake.rx * lake.rx) + (ly * ly) / (lake.ry * lake.ry)
      );
      const angle = this.getLakeNormalizedAngle(lake, x, y);
      if (rho <= 1.08 * this.getLakeEdgeScale(lake, angle)) {
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
    const riverHalf = this.getRiverHalfWidth(x, RIVER_HALF_WIDTH - 16 - radius);
    if (riverHalf > 0 && Math.abs(y - this.riverCenterY(x)) < riverHalf) return true;

    // Lakes (rotated organic ellipses), inset by the creature's body so it
    // stays wet.
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
      const rho = Math.sqrt((lx * lx) / (rx * rx) + (ly * ly) / (ry * ry));
      const angle = this.getLakeNormalizedAngle(lake, x, y);
      if (rho <= this.getLakeEdgeScale(lake, angle)) {
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
    const riverHalf = this.getRiverHalfWidth(x, RIVER_HALF_WIDTH);
    if (Math.abs(y - this.riverCenterY(x)) < riverHalf) return true;

    // Lakes (rotated organic ellipses).
    for (let i = 0; i < this.lakes.length; i++) {
      const lake = this.lakes[i];
      const dx = x - lake.x;
      const dy = y - lake.y;
      const cos = Math.cos(-lake.rotation);
      const sin = Math.sin(-lake.rotation);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const rho = Math.sqrt(
        (lx * lx) / (lake.rx * lake.rx) + (ly * ly) / (lake.ry * lake.ry)
      );
      const angle = this.getLakeNormalizedAngle(lake, x, y);
      if (rho <= this.getLakeEdgeScale(lake, angle)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Muddy margin that starts at the water edge and reaches a short way onto the
   * sandy beach and the forest floor. The hero and land animals move slower
   * while their feet are on it.
   */
  public isMud(x: number, y: number): boolean {
    if (this.mapId !== 'amazon_forest') return false;
    if (Math.abs(x) > FOREST_HALF_SIZE || Math.abs(y) > FOREST_HALF_SIZE) return false;

    // River banks: the ring between the water surface and the outer mud edge.
    const waterHalf = this.getRiverHalfWidth(x, RIVER_HALF_WIDTH);
    const mudHalf = waterHalf + this.getMudBandThickness(x);
    const riverOffset = Math.abs(y - this.riverCenterY(x));
    if (riverOffset >= waterHalf && riverOffset < mudHalf) return true;

    // Lakes: an organic ring around each water ellipse.
    for (let i = 0; i < this.lakes.length; i++) {
      const lake = this.lakes[i];
      const dx = x - lake.x;
      const dy = y - lake.y;
      const cos = Math.cos(-lake.rotation);
      const sin = Math.sin(-lake.rotation);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const angle = this.getLakeNormalizedAngle(lake, x, y);
      const edgeScale = this.getLakeEdgeScale(lake, angle);

      const waterRho = Math.sqrt(
        (lx * lx) / (lake.rx * lake.rx) + (ly * ly) / (lake.ry * lake.ry)
      );
      if (waterRho <= edgeScale) continue;

      const mudRho = Math.sqrt(
        (lx * lx) / ((lake.rx + MUD_BAND) * (lake.rx + MUD_BAND)) +
        (ly * ly) / ((lake.ry + MUD_BAND) * (lake.ry + MUD_BAND))
      );
      if (mudRho <= edgeScale) return true;
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

    const riverHalf = this.getRiverHalfWidth(
      x,
      RIVER_HALF_WIDTH + RIVER_BANK - 10 - radius
    );
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
      const rho = Math.sqrt((lx * lx) / (rx * rx) + (ly * ly) / (ry * ry));
      const angle = this.getLakeNormalizedAngle(lake, x, y);
      if (rho <= this.getLakeEdgeScale(lake, angle)) return true;
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
    const riverY =
      riverCenterY + side * this.getRiverHalfWidth(riverX, bankOffset);
    if (Math.abs(riverY) <= limit) {
      const dx = riverX - x;
      const dy = riverY - y;
      best = { x: riverX, y: riverY };
      bestDistance = dx * dx + dy * dy;
    }

    // Lake banks follow the organic rim, expanded past the water surface.
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
      const edgeScale = this.getLakeEdgeScale(lake, angle);
      const localX = Math.cos(angle) * rx * edgeScale;
      const localY = Math.sin(angle) * ry * edgeScale;

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

    // Elevated plateaus: dark earth rim around a lighter green hilltop.
    for (let i = 0; i < this.plateaus.length; i++) {
      const plateau = this.plateaus[i];
      if (Math.abs(plateau.x - centerX) > viewRadius + plateau.rx) continue;
      if (Math.abs(plateau.y - centerY) > viewRadius + plateau.ry) continue;

      ctx.fillStyle = 'rgba(74, 53, 34, 0.95)';
      ctx.beginPath();
      ctx.ellipse(
        toX(plateau.x),
        toY(plateau.y),
        (plateau.rx + PLATEAU_RIM_WIDTH) * scale,
        (plateau.ry + PLATEAU_RIM_WIDTH) * scale,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.fillStyle = 'rgba(47, 109, 61, 0.95)';
      ctx.beginPath();
      ctx.ellipse(
        toX(plateau.x),
        toY(plateau.y),
        plateau.rx * scale,
        plateau.ry * scale,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Subtle dark-green specks for the decorative canopy trees.
    ctx.fillStyle = 'rgba(20, 83, 45, 0.52)';
    for (let i = 0; i < this.decorTrees.length; i++) {
      const tree = this.decorTrees[i];
      if (Math.abs(tree.x - centerX) > viewRadius) continue;
      if (Math.abs(tree.y - centerY) > viewRadius) continue;
      const dot = tree.kind === 'samauma' ? 2 : 1.4;
      ctx.fillRect(toX(tree.x) - dot / 2, toY(tree.y) - dot / 2, dot, dot);
    }

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

      const drawSize = ACAI_MINIMAP_ICON_DRAW_SIZE;
      const drawX = Math.round(toX(tree.x) - drawSize / 2);
      const drawY = Math.round(toY(tree.y) - drawSize / 2);

      if (tree.kind === 'cupuacu') {
        this.drawCupuacuMinimapIcon(ctx, drawX, drawY);
        continue;
      }

      const icon = this.getFruitMinimapIcon(tree.kind);
      if (!icon) continue;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(icon, drawX, drawY, drawSize, drawSize);
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
   * Builds (once) the Cupuaçu tree sprite. The 48x56 pixel-art canvas follows
   * the reference image: dark contour, light-brown trunk forking into branches,
   * a full rounded canopy of dark green leaves, five large velvety brown fruits
   * hanging under the crown and a wide oval shadow centred on the ground.
   */
  private getCupuacuPixelSprite(): HTMLCanvasElement | null {
    if (this.cupuacuPixelSprite) return this.cupuacuPixelSprite;
    if (typeof document === 'undefined') return null;

    const width = CUPUACU_SPRITE_WIDTH;
    const height = CUPUACU_SPRITE_HEIGHT;
    const pixels: (string | null)[] = new Array(width * height).fill(null);

    const setPixel = (x: number, y: number, color: string): void => {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || px >= width || py < 0 || py >= height) return;
      pixels[py * width + px] = color;
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

    const fillCircle = (cx: number, cy: number, radius: number, color: string): void => {
      fillEllipse(cx, cy, radius, radius, color);
    };

    // Draws a tapered branch segment by stamping circles along its axis.
    const drawBranch = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      startRadius: number,
      endRadius: number,
      color: string
    ): void => {
      const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        fillCircle(
          x0 + (x1 - x0) * t,
          y0 + (y1 - y0) * t,
          startRadius + (endRadius - startRadius) * t,
          color
        );
      }
    };

    // A pointed pixel-art leaf: dark outline, two-tone blade and pale vein.
    const drawLeaf = (
      cx: number,
      cy: number,
      length: number,
      spread: number,
      angle: number,
      fill: string,
      light: string
    ): void => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const nx = -sin;
      const ny = cos;
      const baseX = cx - cos * length * 0.5;
      const baseY = cy - sin * length * 0.5;
      const steps = Math.max(16, Math.ceil(length * 6));
      const halfWidth = spread * 0.5;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = baseX + cos * length * t;
        const py = baseY + sin * length * t;
        const radius = Math.sin(Math.PI * t) * halfWidth + 0.55;
        const maxOffset = Math.ceil(radius);
        for (let offset = -maxOffset; offset <= maxOffset; offset++) {
          if (Math.abs(offset) > radius) continue;
          setPixel(px + nx * offset, py + ny * offset, '#06180c');
        }
      }

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = baseX + cos * length * t;
        const py = baseY + sin * length * t;
        const radius = Math.sin(Math.PI * t) * halfWidth;
        const maxOffset = Math.ceil(radius);
        for (let offset = -maxOffset; offset <= maxOffset; offset++) {
          if (Math.abs(offset) > radius) continue;
          setPixel(px + nx * offset, py + ny * offset, offset <= 0 ? light : fill);
        }
        // Pale central vein, like the hand-drawn reference leaves.
        setPixel(px, py, '#6dbb64');
      }
    };

    // Wide dark oval shadow sitting on the forest floor under the trunk.
    fillEllipse(24, 52.5, 20, 3.6, 'rgba(4, 10, 6, 0.62)');

    const canopyOutline = '#06180c';
    const canopyBase = '#123a21';
    const canopyBlobs: [number, number, number, number][] = [
      [24, 13, 18, 11],
      [12, 18, 10, 9],
      [36, 18, 10, 9],
      [16, 8, 11, 8],
      [32, 8, 11, 8],
      [24, 20, 17, 8],
      [16, 27, 9, 7],
      [32, 27, 9, 7],
    ];

    for (let i = 0; i < canopyBlobs.length; i++) {
      const [cx, cy, rx, ry] = canopyBlobs[i];
      fillEllipse(cx, cy, rx + 1.1, ry + 1.1, canopyOutline);
    }
    for (let i = 0; i < canopyBlobs.length; i++) {
      const [cx, cy, rx, ry] = canopyBlobs[i];
      fillEllipse(cx, cy, rx, ry, canopyBase);
    }
    // Slightly darker lower half gives the crown its 2.5D volume.
    fillEllipse(24, 26, 15, 6, 'rgba(5, 23, 12, 0.38)');

    const trunkOutline = '#24150a';
    const trunkBody = '#947a52';
    const trunkLight = '#b59b6d';
    const trunkShade = '#6f5638';

    // Two main branches fork out of the trunk, visible through the lower crown.
    drawBranch(24, 35, 13, 25, 2.3, 1.1, trunkOutline);
    drawBranch(24, 34, 35, 24, 2.3, 1.1, trunkOutline);
    drawBranch(24, 35, 13, 25, 1.2, 0.55, trunkBody);
    drawBranch(24, 34, 35, 24, 1.2, 0.55, trunkBody);

    // Trunk: dark contour, lighter bark and a flared root base.
    for (let y = 29; y <= 54; y++) {
      const t = (y - 29) / 25;
      const halfWidth =
        y >= 50 ? 1.9 + t * 1.5 + (y - 49) * 0.4 : 1.9 + t * 1.5;
      for (let x = Math.floor(24 - halfWidth - 0.8); x <= Math.ceil(24 + halfWidth + 0.8); x++) {
        setPixel(x, y, trunkOutline);
      }
      for (let x = Math.floor(24 - halfWidth); x <= Math.ceil(24 + halfWidth); x++) {
        const relative = (x - 24) / halfWidth;
        setPixel(
          x,
          y,
          relative < -0.25 ? trunkLight : relative > 0.45 ? trunkShade : trunkBody
        );
      }
      if (y % 3 === 0) {
        setPixel(24 - halfWidth * 0.4, y, trunkShade);
        setPixel(24 + halfWidth * 0.35, y, trunkLight);
      }
    }

    // Small roots spreading out over the shadow.
    drawLine(20, 53, 16, 55, trunkOutline);
    drawLine(21, 53, 18, 55, trunkBody);
    drawLine(28, 53, 32, 55, trunkOutline);
    drawLine(27, 53, 30, 55, trunkBody);

    const leafShade = '#174d29';
    const leafMid = '#23723b';
    const leafLight = '#349a4f';
    const leafHighlight = '#55bb68';

    const leaves: {
      x: number;
      y: number;
      length: number;
      spread: number;
      angle: number;
      fill: string;
      light: string;
    }[] = [
      // Outer crown, darker leaves defining the silhouette.
      { x: 10, y: 10, length: 11, spread: 5, angle: -2.2, fill: leafShade, light: leafMid },
      { x: 17, y: 6, length: 11, spread: 5, angle: -1.75, fill: leafShade, light: leafMid },
      { x: 24, y: 4, length: 11, spread: 5, angle: -1.57, fill: leafShade, light: leafMid },
      { x: 31, y: 6, length: 11, spread: 5, angle: -1.39, fill: leafShade, light: leafMid },
      { x: 38, y: 10, length: 11, spread: 5, angle: -0.94, fill: leafShade, light: leafMid },
      { x: 6, y: 18, length: 10, spread: 5, angle: 3.05, fill: leafShade, light: leafMid },
      { x: 42, y: 18, length: 10, spread: 5, angle: 0.09, fill: leafShade, light: leafMid },
      { x: 6, y: 27, length: 10, spread: 5, angle: 2.85, fill: leafShade, light: leafMid },
      { x: 42, y: 26, length: 10, spread: 5, angle: 0.3, fill: leafShade, light: leafMid },
      { x: 13, y: 31, length: 9, spread: 4, angle: 2.3, fill: leafShade, light: leafMid },
      { x: 35, y: 31, length: 9, spread: 4, angle: 0.85, fill: leafShade, light: leafMid },
      { x: 20, y: 33, length: 8, spread: 4, angle: 1.9, fill: leafShade, light: leafMid },
      { x: 28, y: 33, length: 8, spread: 4, angle: 1.25, fill: leafShade, light: leafMid },
      // Middle layer, warmer greens over the dark base.
      { x: 14, y: 15, length: 10, spread: 5, angle: -2.55, fill: leafMid, light: leafLight },
      { x: 24, y: 12, length: 11, spread: 5, angle: -1.75, fill: leafMid, light: leafLight },
      { x: 34, y: 15, length: 10, spread: 5, angle: -0.6, fill: leafMid, light: leafLight },
      { x: 10, y: 23, length: 10, spread: 5, angle: 2.75, fill: leafMid, light: leafLight },
      { x: 38, y: 22, length: 10, spread: 5, angle: 0.4, fill: leafMid, light: leafLight },
      { x: 18, y: 23, length: 10, spread: 5, angle: 2.4, fill: leafMid, light: leafLight },
      { x: 30, y: 22, length: 10, spread: 5, angle: 0.7, fill: leafMid, light: leafLight },
      { x: 24, y: 20, length: 11, spread: 5, angle: -1.85, fill: leafMid, light: leafLight },
      { x: 16, y: 28, length: 9, spread: 4, angle: 2.65, fill: leafMid, light: leafLight },
      { x: 32, y: 28, length: 9, spread: 4, angle: 0.5, fill: leafMid, light: leafLight },
      // Sunlit leaves concentrated on the upper-left, as in the reference.
      { x: 15, y: 12, length: 9, spread: 4, angle: -2.3, fill: leafLight, light: leafHighlight },
      { x: 23, y: 9, length: 9, spread: 4, angle: -1.9, fill: leafLight, light: leafHighlight },
      { x: 20, y: 18, length: 8, spread: 4, angle: -2.6, fill: leafLight, light: leafHighlight },
      { x: 13, y: 20, length: 8, spread: 4, angle: -2.9, fill: leafLight, light: leafHighlight },
      { x: 28, y: 17, length: 8, spread: 4, angle: -0.9, fill: leafLight, light: leafHighlight },
    ];

    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      drawLeaf(
        leaf.x,
        leaf.y,
        leaf.length,
        leaf.spread,
        leaf.angle,
        leaf.fill,
        leaf.light
      );
    }

    const fruitOutline = '#1d0f07';
    const fruitBody = '#7a4a2b';
    const fruitLight = '#ab7647';
    const fruitShade = '#4a2915';
    const fruitRib = '#5c3620';

    const drawFruit = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      stemX: number,
      stemY: number
    ): void => {
      // Short dark stem attaching the fruit to the branch under the canopy.
      drawLine(cx, cy - ry - 0.5, stemX, stemY, fruitOutline);
      drawLine(cx + 1, cy - ry - 0.5, stemX + 1, stemY, '#5a3a1c');

      // Large oval capsule with a dark contour and velvety brown shading.
      fillEllipse(cx, cy, rx + 0.6, ry + 0.6, fruitOutline);
      fillEllipse(cx, cy, rx, ry, fruitBody);
      fillEllipse(cx - rx * 0.32, cy - ry * 0.28, rx * 0.62, ry * 0.55, fruitLight);
      fillEllipse(cx + rx * 0.45, cy + ry * 0.28, rx * 0.48, ry * 0.52, fruitShade);
      drawLine(cx - rx * 0.62, cy - ry * 0.55, cx - rx * 0.62, cy + ry * 0.62, fruitRib);
      drawLine(cx + rx * 0.62, cy - ry * 0.5, cx + rx * 0.62, cy + ry * 0.58, fruitRib);
      setPixel(cx - rx * 0.4, cy - ry * 0.5, '#c08a58');
      setPixel(cx - rx * 0.65, cy - ry * 0.2, '#c08a58');
      setPixel(cx, cy - ry - 0.6, '#3a2412');
    };

    // Five heavy cupuaçu fruits hanging at different heights around the crown.
    drawFruit(37.5, 17.5, 2.6, 5, 36.5, 12.5);
    drawFruit(27, 22, 2.9, 5.5, 27.5, 16.5);
    drawFruit(12, 29, 2.8, 5.2, 13, 24);
    drawFruit(33, 29.5, 2.8, 5.2, 33.5, 24);
    drawFruit(16.5, 36.5, 2.7, 5, 18, 31.5);

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

    this.cupuacuPixelSprite = canvas;
    return canvas;
  }

  /**
   * Builds (once) the Araçazeiro sprite. The 56x64 pixel-art canvas follows the
   * reference: a dark contour, a textured brown trunk that splits into three
   * main branches near the base, a very dense rounded canopy layered with
   * dark-to-light green leaves, bright round yellow araçá fruits scattered and
   * hanging through the foliage, and a wide dark oval shadow on the ground.
   */
  private getAracaPixelSprite(): HTMLCanvasElement | null {
    if (this.aracaPixelSprite) return this.aracaPixelSprite;
    if (typeof document === 'undefined') return null;

    const width = ARACA_SPRITE_WIDTH;
    const height = ARACA_SPRITE_HEIGHT;
    const pixels: (string | null)[] = new Array(width * height).fill(null);

    const setPixel = (x: number, y: number, color: string): void => {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || px >= width || py < 0 || py >= height) return;
      pixels[py * width + px] = color;
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

    const fillCircle = (cx: number, cy: number, radius: number, color: string): void => {
      fillEllipse(cx, cy, radius, radius, color);
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

    // Tapered branch stamped with circles along its axis.
    const drawBranch = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      startRadius: number,
      endRadius: number,
      color: string
    ): void => {
      const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        fillCircle(
          x0 + (x1 - x0) * t,
          y0 + (y1 - y0) * t,
          startRadius + (endRadius - startRadius) * t,
          color
        );
      }
    };

    // Pointed pixel-art leaf with dark outline, two-tone blade and pale vein.
    const drawLeaf = (
      cx: number,
      cy: number,
      length: number,
      spread: number,
      angle: number,
      fill: string,
      light: string
    ): void => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const nx = -sin;
      const ny = cos;
      const baseX = cx - cos * length * 0.5;
      const baseY = cy - sin * length * 0.5;
      const steps = Math.max(16, Math.ceil(length * 6));
      const halfWidth = spread * 0.5;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = baseX + cos * length * t;
        const py = baseY + sin * length * t;
        const radius = Math.sin(Math.PI * t) * halfWidth + 0.55;
        const maxOffset = Math.ceil(radius);
        for (let offset = -maxOffset; offset <= maxOffset; offset++) {
          if (Math.abs(offset) > radius) continue;
          setPixel(px + nx * offset, py + ny * offset, '#06180c');
        }
      }

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = baseX + cos * length * t;
        const py = baseY + sin * length * t;
        const radius = Math.sin(Math.PI * t) * halfWidth;
        const maxOffset = Math.ceil(radius);
        for (let offset = -maxOffset; offset <= maxOffset; offset++) {
          if (Math.abs(offset) > radius) continue;
          setPixel(px + nx * offset, py + ny * offset, offset <= 0 ? light : fill);
        }
        setPixel(px, py, '#6dbb64');
      }
    };

    // Wide dark oval shadow resting on the forest floor under the tree.
    fillEllipse(28, 59.5, 21, 4.2, 'rgba(4, 10, 6, 0.62)');

    const canopyOutline = '#06180c';
    const canopyBase = '#0f3a20';
    const canopyBlobs: [number, number, number, number][] = [
      [28, 16, 22, 14],
      [12, 22, 11, 11],
      [44, 22, 11, 11],
      [17, 10, 13, 9],
      [39, 10, 13, 9],
      [28, 24, 20, 10],
      [16, 32, 11, 8],
      [40, 32, 11, 8],
      [28, 9, 10, 7],
    ];

    for (let i = 0; i < canopyBlobs.length; i++) {
      const [cx, cy, rx, ry] = canopyBlobs[i];
      fillEllipse(cx, cy, rx + 1.1, ry + 1.1, canopyOutline);
    }
    for (let i = 0; i < canopyBlobs.length; i++) {
      const [cx, cy, rx, ry] = canopyBlobs[i];
      fillEllipse(cx, cy, rx, ry, canopyBase);
    }
    // Darker lower half gives the rounded crown its 2.5D volume.
    fillEllipse(28, 30, 21, 7, 'rgba(5, 23, 12, 0.38)');

    const trunkOutline = '#24150a';
    const trunkBody = '#8a6a3f';
    const trunkLight = '#b08a55';
    const trunkShade = '#5f4527';

    // Three main branches fork out of the trunk just below the canopy.
    drawBranch(28, 47, 15, 30, 2.4, 1.0, trunkOutline);
    drawBranch(28, 46, 28, 25, 2.2, 1.0, trunkOutline);
    drawBranch(28, 47, 41, 30, 2.4, 1.0, trunkOutline);
    drawBranch(28, 47, 15, 30, 1.3, 0.55, trunkBody);
    drawBranch(28, 46, 28, 25, 1.2, 0.55, trunkBody);
    drawBranch(28, 47, 41, 30, 1.3, 0.55, trunkBody);

    // Textured trunk: dark contour, lighter bark and a flared root base.
    for (let y = 42; y <= 60; y++) {
      const t = (y - 42) / 18;
      const halfWidth = 2.1 + t * 1.4 + (y >= 57 ? (y - 56) * 0.55 : 0);
      for (let x = Math.floor(28 - halfWidth - 0.8); x <= Math.ceil(28 + halfWidth + 0.8); x++) {
        setPixel(x, y, trunkOutline);
      }
      for (let x = Math.floor(28 - halfWidth); x <= Math.ceil(28 + halfWidth); x++) {
        const relative = (x - 28) / halfWidth;
        setPixel(
          x,
          y,
          relative < -0.2 ? trunkLight : relative > 0.4 ? trunkShade : trunkBody
        );
      }
      if (y % 4 === 0) {
        setPixel(28 - halfWidth * 0.35, y, trunkShade);
        setPixel(28 + halfWidth * 0.3, y, trunkLight);
      }
      if (y === 48 || y === 49) setPixel(27, y, trunkShade);
    }

    // Roots spreading over the shadow.
    drawLine(24, 59, 19, 62, trunkOutline);
    drawLine(25, 59, 21, 62, trunkBody);
    drawLine(32, 59, 37, 62, trunkOutline);
    drawLine(31, 59, 35, 62, trunkBody);

    const leafShade = '#123a21';
    const leafMid = '#1c5a30';
    const leafLight = '#2f8a45';
    const leafHighlight = '#59bb63';

    const leaves: {
      x: number;
      y: number;
      length: number;
      spread: number;
      angle: number;
      fill: string;
      light: string;
    }[] = [
      // Outer crown, darker leaves defining the rounded silhouette.
      { x: 8, y: 16, length: 12, spread: 5, angle: -2.4, fill: leafShade, light: leafMid },
      { x: 14, y: 9, length: 12, spread: 5, angle: -2.0, fill: leafShade, light: leafMid },
      { x: 22, y: 6, length: 10, spread: 5, angle: -1.7, fill: leafShade, light: leafMid },
      { x: 30, y: 6, length: 10, spread: 5, angle: -1.45, fill: leafShade, light: leafMid },
      { x: 38, y: 8, length: 12, spread: 5, angle: -1.15, fill: leafShade, light: leafMid },
      { x: 46, y: 14, length: 12, spread: 5, angle: -0.8, fill: leafShade, light: leafMid },
      { x: 49, y: 22, length: 10, spread: 5, angle: -0.35, fill: leafShade, light: leafMid },
      { x: 48, y: 30, length: 10, spread: 5, angle: 0.1, fill: leafShade, light: leafMid },
      { x: 42, y: 36, length: 10, spread: 4, angle: 0.5, fill: leafShade, light: leafMid },
      { x: 34, y: 39, length: 9, spread: 4, angle: 0.9, fill: leafShade, light: leafMid },
      { x: 26, y: 40, length: 9, spread: 4, angle: 1.4, fill: leafShade, light: leafMid },
      { x: 18, y: 38, length: 10, spread: 4, angle: 1.9, fill: leafShade, light: leafMid },
      { x: 10, y: 33, length: 10, spread: 5, angle: 2.4, fill: leafShade, light: leafMid },
      { x: 7, y: 25, length: 10, spread: 5, angle: 2.85, fill: leafShade, light: leafMid },
      { x: 10, y: 23, length: 10, spread: 5, angle: 2.7, fill: leafShade, light: leafMid },
      // Middle layer, warmer greens filling the interior.
      { x: 14, y: 15, length: 11, spread: 5, angle: -2.7, fill: leafMid, light: leafLight },
      { x: 22, y: 12, length: 12, spread: 5, angle: -1.9, fill: leafMid, light: leafLight },
      { x: 31, y: 12, length: 11, spread: 5, angle: -1.3, fill: leafMid, light: leafLight },
      { x: 40, y: 15, length: 11, spread: 5, angle: -0.6, fill: leafMid, light: leafLight },
      { x: 43, y: 24, length: 10, spread: 5, angle: -0.05, fill: leafMid, light: leafLight },
      { x: 37, y: 31, length: 10, spread: 5, angle: 0.5, fill: leafMid, light: leafLight },
      { x: 28, y: 34, length: 10, spread: 5, angle: 1.2, fill: leafMid, light: leafLight },
      { x: 19, y: 31, length: 10, spread: 5, angle: 1.9, fill: leafMid, light: leafLight },
      { x: 11, y: 25, length: 10, spread: 5, angle: 2.6, fill: leafMid, light: leafLight },
      { x: 17, y: 22, length: 10, spread: 5, angle: 2.9, fill: leafMid, light: leafLight },
      { x: 27, y: 20, length: 11, spread: 5, angle: -1.8, fill: leafMid, light: leafLight },
      { x: 34, y: 20, length: 10, spread: 5, angle: -0.7, fill: leafMid, light: leafLight },
      { x: 23, y: 28, length: 9, spread: 4, angle: 2.2, fill: leafMid, light: leafLight },
      { x: 33, y: 27, length: 9, spread: 4, angle: 0.9, fill: leafMid, light: leafLight },
      // Sunlit upper-left leaves, as in the reference art.
      { x: 16, y: 13, length: 9, spread: 4, angle: -2.5, fill: leafLight, light: leafHighlight },
      { x: 24, y: 9, length: 10, spread: 4, angle: -2.0, fill: leafLight, light: leafHighlight },
      { x: 32, y: 10, length: 9, spread: 4, angle: -1.3, fill: leafLight, light: leafHighlight },
      { x: 20, y: 19, length: 9, spread: 4, angle: -2.8, fill: leafLight, light: leafHighlight },
      { x: 29, y: 17, length: 9, spread: 4, angle: -1.5, fill: leafLight, light: leafHighlight },
      { x: 38, y: 21, length: 8, spread: 4, angle: -0.4, fill: leafLight, light: leafHighlight },
      { x: 14, y: 23, length: 8, spread: 4, angle: 3.0, fill: leafLight, light: leafHighlight },
      // Brightest highlights on the top-left face of the crown.
      { x: 20, y: 12, length: 7, spread: 3, angle: -2.3, fill: leafHighlight, light: '#8ed17a' },
      { x: 27, y: 10, length: 7, spread: 3, angle: -1.8, fill: leafHighlight, light: '#8ed17a' },
      { x: 24, y: 16, length: 7, spread: 3, angle: -2.7, fill: leafHighlight, light: '#8ed17a' },
      { x: 17, y: 17, length: 6, spread: 3, angle: -2.9, fill: leafHighlight, light: '#8ed17a' },
      { x: 32, y: 15, length: 6, spread: 3, angle: -1.1, fill: leafHighlight, light: '#8ed17a' },
      { x: 35, y: 24, length: 6, spread: 3, angle: -0.3, fill: leafHighlight, light: '#8ed17a' },
    ];

    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      drawLeaf(
        leaf.x,
        leaf.y,
        leaf.length,
        leaf.spread,
        leaf.angle,
        leaf.fill,
        leaf.light
      );
    }

    // Bright round araçá fruits: dark contour, yellow body, lit highlight and a
    // tiny stem where the fruit hangs from the foliage.
    const drawFruit = (
      cx: number,
      cy: number,
      radius: number,
      stemY: number | null
    ): void => {
      if (stemY !== null) {
        drawLine(cx, cy - radius - 0.5, cx - 0.5, stemY, '#5f4527');
      }
      fillEllipse(cx, cy, radius + 0.6, radius + 0.6, '#3d2a05');
      fillEllipse(cx, cy, radius, radius, '#eab308');
      fillEllipse(cx - radius * 0.3, cy - radius * 0.3, radius * 0.62, radius * 0.62, '#facc15');
      fillEllipse(cx - radius * 0.35, cy - radius * 0.38, radius * 0.3, radius * 0.3, '#fef08a');
      fillEllipse(cx + radius * 0.35, cy + radius * 0.35, radius * 0.4, radius * 0.4, '#ca8a04');
      setPixel(cx - radius * 0.25, cy - radius * 0.35, '#fffde7');
    };

    const fruits: [number, number, number, number | null][] = [
      [13, 26, 2.4, 22],
      [20, 36, 2.6, 32],
      [27, 40, 2.7, 36],
      [35, 37, 2.5, 33],
      [43, 28, 2.4, 24],
      [10, 33, 2.2, 29],
      [46, 35, 2.3, 31],
      [16, 17, 2.5, 13],
      [25, 15, 2.6, 11],
      [34, 16, 2.4, 12],
      [40, 22, 2.5, 18],
      [30, 27, 2.4, 23],
      [21, 26, 2.2, 22],
      [37, 30, 2.2, 26],
      [24, 34, 2.2, 30],
      [31, 35, 2.3, 31],
      [14, 22, 2.0, 18],
      [44, 19, 2.1, 15],
    ];

    for (let i = 0; i < fruits.length; i++) {
      const [cx, cy, radius, stemY] = fruits[i];
      drawFruit(cx, cy, radius, stemY);
    }

    // Rasterize the 56x64 colour matrix into an offscreen canvas.
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

    this.aracaPixelSprite = canvas;
    return canvas;
  }

  /**
   * Builds (once) the Castanheira-do-Brasil sprite. The 64x92 pixel-art canvas
   * follows the reference: dark contour, wide buttress roots over a broad oval
   * shadow, a thick grey barked trunk that forks high into a volumetric round
   * canopy, and large round seed pods hanging from the branches.
   */
  private getCastanhaPixelSprite(): HTMLCanvasElement | null {
    if (this.castanhaPixelSprite) return this.castanhaPixelSprite;
    if (typeof document === 'undefined') return null;

    const width = CASTANHA_SPRITE_WIDTH;
    const height = CASTANHA_SPRITE_HEIGHT;
    const pixels: (string | null)[] = new Array(width * height).fill(null);

    const hash = (x: number, y: number): number => {
      const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return value - Math.floor(value);
    };

    const setPixel = (x: number, y: number, color: string): void => {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || px >= width || py < 0 || py >= height) return;
      pixels[py * width + px] = color;
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

    const fillCircle = (cx: number, cy: number, radius: number, color: string): void => {
      fillEllipse(cx, cy, radius, radius, color);
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

    const drawBranch = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      startRadius: number,
      endRadius: number,
      color: string
    ): void => {
      const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        fillCircle(
          x0 + (x1 - x0) * t,
          y0 + (y1 - y0) * t,
          startRadius + (endRadius - startRadius) * t,
          color
        );
      }
    };

    const trunkOutline = '#241a10';
    const trunkLight = '#aa9a76';
    const trunkBody = '#8e7f5f';
    const trunkMid = '#76684b';
    const trunkShade = '#5a4d34';
    const trunkDark = '#3e3322';
    const barkLine = '#4b402b';

    // Wide, dark oval shadow centred under the buttress roots.
    fillEllipse(32, 87.5, 27.5, 4.4, 'rgba(4, 10, 6, 0.62)');
    fillEllipse(32, 87.6, 21, 3.1, 'rgba(3, 7, 4, 0.45)');

    // Thick grey trunk, slightly flared at the base.
    for (let y = 38; y <= 87; y++) {
      const t = (y - 38) / 49;
      const flare = y >= 80 ? (y - 79) * 0.8 : 0;
      const halfWidth = 4.8 + t * 1.9 + flare;

      for (
        let x = Math.floor(32 - halfWidth - 1.2);
        x <= Math.ceil(32 + halfWidth + 1.2);
        x++
      ) {
        setPixel(x, y, trunkOutline);
      }
      for (let x = Math.floor(32 - halfWidth); x <= Math.ceil(32 + halfWidth); x++) {
        const relative = (x - 32) / halfWidth;
        let color: string;
        if (relative < -0.45) color = trunkLight;
        else if (relative < 0.05) color = trunkBody;
        else if (relative < 0.55) color = trunkMid;
        else color = trunkShade;
        setPixel(x, y, color);
      }
    }

    // Wavy bark grooves and small knots break up the flat trunk.
    const barkLines: [number, number, number, number][] = [
      [29, 45, 85, 1.2],
      [31.5, 42, 86, -1.1],
      [34, 48, 84, 1.3],
      [27, 60, 84, 0.8],
      [37, 58, 84, -0.7],
    ];
    for (let i = 0; i < barkLines.length; i++) {
      const baseX = barkLines[i][0];
      const startY = barkLines[i][1];
      const endY = barkLines[i][2];
      const wobble = barkLines[i][3];
      for (let y = startY; y <= endY; y++) {
        if (hash(baseX, y) < 0.28) continue;
        setPixel(baseX + Math.sin(y * 0.32) * wobble, y, barkLine);
      }
    }
    for (let i = 0; i < 18; i++) {
      const y = 45 + i * 2.4;
      const x = 27 + hash(3, i) * 9;
      setPixel(x, y, i % 2 === 0 ? trunkLight : trunkDark);
    }
    fillEllipse(29.5, 57, 1.5, 2.2, trunkDark);
    fillEllipse(29.8, 56.5, 0.8, 1.1, trunkLight);
    fillEllipse(35, 71, 1.3, 1.8, trunkDark);
    setPixel(34.7, 70.4, trunkLight);

    // Buttress roots crawling out over the shadow.
    const roots: [number, number, number, number, number][] = [
      [29, 82, 16, 89, 2.4],
      [35, 82, 48, 89, 2.4],
      [28, 85, 22, 91, 1.9],
      [36, 85, 42, 91, 1.9],
      [31, 86, 32, 91.5, 1.5],
      [26, 84, 19, 89.5, 1.6],
      [38, 84, 45, 89.5, 1.6],
    ];
    for (let i = 0; i < roots.length; i++) {
      const root = roots[i];
      drawBranch(root[0], root[1], root[2], root[3], root[4] + 0.8, 0.8, trunkOutline);
    }
    for (let i = 0; i < roots.length; i++) {
      const root = roots[i];
      drawBranch(root[0], root[1], root[2], root[3], root[4], 0.3, trunkBody);
      setPixel(root[0] - 0.4, root[1] + 0.6, trunkLight);
    }

    // Rounded canopy silhouette assembled from overlapping pixel blobs.
    const canopyOutline = '#06180c';
    const canopyPalette = ['#0b2c17', '#1c5b2e', '#2b7a3d', '#47a052', '#6cc46a'];
    const canopyBlobs: [number, number, number, number][] = [
      [32, 16, 25, 13],
      [14, 20, 12, 11],
      [50, 20, 12, 11],
      [9, 29, 8, 8],
      [55, 29, 8, 8],
      [20, 31, 11, 9],
      [44, 31, 11, 9],
      [32, 28, 17, 10],
      [15, 12, 10, 8],
      [49, 12, 10, 8],
      [32, 9, 17, 8],
      [25, 38, 8, 6],
      [39, 38, 8, 6],
    ];
    const canopyMask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let b = 0; b < canopyBlobs.length; b++) {
          const cx = canopyBlobs[b][0];
          const cy = canopyBlobs[b][1];
          const rx = canopyBlobs[b][2];
          const ry = canopyBlobs[b][3];
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1.02) {
            canopyMask[y * width + x] = 1;
            break;
          }
        }
      }
    }

    // One-pixel dark contour around the whole crown.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (canopyMask[y * width + x]) continue;
        let nearCrown = false;
        for (let oy = -1; oy <= 1 && !nearCrown; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue;
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            if (canopyMask[ny * width + nx]) {
              nearCrown = true;
              break;
            }
          }
        }
        if (nearCrown) setPixel(x, y, canopyOutline);
      }
    }

    // Volume: sunlit upper-left greens fading to deep shade on the lower right.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!canopyMask[y * width + x]) continue;
        const nx = (x - 32) / 30;
        const ny = (y - 20) / 22;
        const lighting = -(nx * 0.5 + ny * 0.95);
        const noise = hash(x, y);
        let level: number;
        if (lighting > 0.55) level = 4;
        else if (lighting > 0.24) level = 3;
        else if (lighting > -0.08) level = 2;
        else if (lighting > -0.48) level = 1;
        else level = 0;
        if (noise > 0.9) level = Math.min(4, level + 1);
        else if (noise < 0.1) level = Math.max(0, level - 1);
        setPixel(x, y, canopyPalette[level]);
      }
    }

    // Overlapping leaf clumps give the crown the fluffy pixel-art texture.
    const canopyClumps: [number, number, number, number, number][] = [
      [12, 18, 5, 3, 2],
      [18, 10, 5, 3, 3],
      [26, 7, 5, 3, 3],
      [35, 8, 5, 3, 2],
      [45, 10, 5, 3, 3],
      [54, 15, 4, 3, 2],
      [9, 29, 4, 3, 1],
      [17, 24, 5, 3, 2],
      [27, 19, 5, 3, 3],
      [37, 18, 5, 3, 2],
      [47, 23, 5, 3, 3],
      [56, 29, 4, 3, 1],
      [13, 34, 4, 3, 1],
      [23, 32, 5, 3, 2],
      [33, 30, 5, 3, 3],
      [43, 33, 5, 3, 1],
      [51, 36, 4, 3, 2],
      [21, 39, 4, 2, 1],
      [31, 38, 4, 2, 2],
      [41, 40, 4, 2, 1],
      [6, 22, 3, 3, 1],
      [48, 6, 4, 3, 3],
    ];
    for (let i = 0; i < canopyClumps.length; i++) {
      const cx = canopyClumps[i][0];
      const cy = canopyClumps[i][1];
      const rx = canopyClumps[i][2];
      const ry = canopyClumps[i][3];
      const color = canopyPalette[canopyClumps[i][4]];
      const minX = Math.floor(cx - rx);
      const maxX = Math.ceil(cx + rx);
      const minY = Math.floor(cy - ry);
      const maxY = Math.ceil(cy + ry);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (!canopyMask[y * width + x]) continue;
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1) setPixel(x, y, color);
        }
      }
    }
    // Tiny bright leaf glints on the sunlit side.
    for (let i = 0; i < 24; i++) {
      const x = Math.round(6 + hash(i, 4) * 50);
      const y = Math.round(5 + hash(i, 5) * 36);
      if (canopyMask[y * width + x]) setPixel(x, y, canopyPalette[4]);
    }

    // Branches fork out of the trunk and stay visible over the lower crown.
    const branches: [number, number, number, number, number][] = [
      [32, 46, 16, 31, 2.8],
      [32, 46, 47, 30, 2.8],
      [30, 45, 12, 41, 2.0],
      [34, 45, 52, 42, 2.0],
      [32, 44, 31, 32, 1.8],
    ];
    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      drawBranch(
        branch[0],
        branch[1],
        branch[2],
        branch[3],
        branch[4] + 0.8,
        1.0,
        trunkOutline
      );
    }
    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      drawBranch(branch[0], branch[1], branch[2], branch[3], branch[4], 0.4, trunkBody);
      setPixel(branch[0] - 0.6, branch[1] - 3, trunkLight);
    }

    // Large round seed pods hanging below the crown.
    const podOutline = '#1b0e06';
    const podBody = '#7a4a28';
    const podLight = '#a56d3f';
    const podShade = '#4c2a14';
    const podCap = '#3a2210';
    const podStem = '#3a2412';

    const drawPod = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      stemX: number,
      stemY: number
    ): void => {
      drawLine(cx, cy - ry, stemX, stemY, podStem);
      fillEllipse(cx, cy, rx + 0.8, ry + 0.8, podOutline);
      fillEllipse(cx, cy, rx, ry, podBody);
      fillEllipse(cx - rx * 0.3, cy - ry * 0.3, rx * 0.55, ry * 0.5, podLight);
      fillEllipse(cx + rx * 0.45, cy + ry * 0.3, rx * 0.42, ry * 0.45, podShade);
      fillEllipse(cx, cy - ry * 0.8, rx * 0.6, ry * 0.25, podCap);
      drawLine(cx + rx * 0.15, cy - ry * 0.55, cx + rx * 0.15, cy + ry * 0.65, podShade);
      setPixel(cx - rx * 0.5, cy - ry * 0.35, '#c08a58');
      setPixel(cx - rx * 0.3, cy - ry * 0.55, '#c08a58');
    };

    const drawOpenPod = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      stemX: number,
      stemY: number
    ): void => {
      drawLine(cx, cy - ry, stemX, stemY, podStem);
      fillEllipse(cx, cy, rx + 0.9, ry + 0.9, podOutline);
      fillEllipse(cx, cy, rx, ry, podBody);
      fillEllipse(cx + rx * 0.35, cy + ry * 0.2, rx * 0.5, ry * 0.55, podShade);
      // Cracked opening: dark rim around a pale woody interior.
      fillEllipse(cx, cy + 0.2, rx * 0.72, ry * 0.68, podOutline);
      fillEllipse(cx, cy + 0.2, rx * 0.6, ry * 0.56, '#c9a06a');
      fillEllipse(cx - rx * 0.1, cy + 0.6, rx * 0.42, ry * 0.34, '#e0c08c');
      // Brazil nuts nested inside the open shell.
      fillEllipse(cx - rx * 0.24, cy + ry * 0.12, rx * 0.15, ry * 0.2, podShade);
      fillEllipse(cx + rx * 0.18, cy + ry * 0.2, rx * 0.15, ry * 0.2, podShade);
      setPixel(cx - rx * 0.45, cy - ry * 0.1, '#d6b07a');
      fillEllipse(cx + rx * 0.55, cy - ry * 0.35, rx * 0.35, ry * 0.45, podLight);
    };

    drawPod(18, 27, 4.2, 4.7, 20, 20);
    drawPod(9, 41, 3.4, 4.1, 12, 34);
    drawPod(23, 54, 5.8, 6.4, 26, 44);
    drawPod(36, 29, 3.6, 4.1, 35, 23);
    drawPod(44, 49, 5.0, 5.8, 43, 39);
    drawPod(52, 54, 5.4, 6.1, 49, 43);
    drawOpenPod(40, 68, 4.8, 5.4, 39, 59);

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

    this.castanhaPixelSprite = canvas;
    return canvas;
  }

  /**
   * Builds (once) the Buritizeiro sprite. The 48x64 pixel-art canvas follows
   * the reference: A dark contour around a slender vertical grey trunk with
   * clearly defined rings, a wide fan crown made of large rounded open fronds
   * in deep greens, orange-red fruit bunches hanging under the crown and a dark
   * oval shadow centred on the base of the trunk.
   */
  private getBuritiPixelSprite(): HTMLCanvasElement | null {
    if (this.buritiPixelSprite) return this.buritiPixelSprite;
    if (typeof document === 'undefined') return null;

    const width = BURITI_SPRITE_WIDTH;
    const height = BURITI_SPRITE_HEIGHT;
    const pixels: (string | null)[] = new Array(width * height).fill(null);

    const setPixel = (x: number, y: number, color: string): void => {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || px >= width || py < 0 || py >= height) return;
      pixels[py * width + px] = color;
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

    // Soft dark oval shadow, centred exactly under the trunk base.
    fillEllipse(24, 61.3, 20.5, 4.1, 'rgba(4, 10, 6, 0.62)');
    fillEllipse(24, 61.5, 14.5, 2.7, 'rgba(3, 7, 4, 0.45)');

    const frondOutline = '#07160b';
    const frondDark = '#14532d';
    const frondMid = '#1d6f38';
    const frondLight = '#3f9c4c';
    const frondGlint = '#7ed16f';

    const drawFrond = (
      baseX: number,
      baseY: number,
      controlX: number,
      controlY: number,
      tipX: number,
      tipY: number,
      tone: number,
      litFromLeft: boolean
    ): void => {
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

      // Broad rounded blade that swells in the middle and tapers to the tip,
      // with a subtle scalloped edge that reads like palm pinnae in pixel art.
      const halfWidthAt = (t: number): number => {
        const shape = Math.sin(Math.PI * t);
        const scallop = 0.92 + Math.sin(t * 33 + baseX) * 0.1;
        return 0.8 + 2.5 * shape * scallop;
      };

      const steps = 80;

      // Dark contour pass.
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = pointX(t);
        const y = pointY(t);
        const dx = tangentX(t);
        const dy = tangentY(t);
        const length = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / length;
        const ny = dx / length;
        const halfWidth = halfWidthAt(t) + 1.05;
        const maxOffset = Math.ceil(halfWidth);
        for (let offset = -maxOffset; offset <= maxOffset; offset++) {
          if (Math.abs(offset) <= halfWidth) {
            setPixel(x + nx * offset, y + ny * offset, frondOutline);
          }
        }
      }

      // Volumetric leaf surface: sunlit edge, deep green body and a darker
      // lower rim, so the fan reads as a 2.5D crown instead of a flat shape.
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = pointX(t);
        const y = pointY(t);
        const dx = tangentX(t);
        const dy = tangentY(t);
        const length = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / length;
        const ny = dx / length;
        const halfWidth = halfWidthAt(t);
        const maxOffset = Math.ceil(halfWidth);
        for (let offset = -maxOffset; offset <= maxOffset; offset++) {
          if (Math.abs(offset) > halfWidth) continue;
          const side = halfWidth < 0.001 ? 0 : offset / halfWidth;
          const lit = litFromLeft ? side <= 0.05 : side >= -0.05;
          let color = tone === 1 ? frondMid : frondDark;
          if (lit) color = tone === 2 ? frondGlint : frondLight;
          if (Math.abs(side) > 0.74) color = frondDark;
          setPixel(x + nx * offset, y + ny * offset, color);
        }
        if (i % 6 === 0) {
          setPixel(x, y, t > 0.55 ? frondGlint : frondLight);
        }
      }
      setPixel(tipX, tipY, frondGlint);
    };

    // Back half of the fan is painted first so the trunk overlaps its base.
    drawFrond(24, 24.5, 10, 20, 1, 17, 0, true);
    drawFrond(24, 24, 12, 11, 6, 4, 1, true);
    drawFrond(24, 23.5, 18, 7, 15, 0, 2, true);
    drawFrond(24, 23.5, 24, 5, 24, 0, 1, true);
    drawFrond(24, 23.5, 30, 7, 33, 0, 2, false);
    drawFrond(24, 24, 36, 11, 42, 4, 1, false);
    drawFrond(24, 24.5, 38, 20, 47, 17, 0, false);

    const trunkOutline = '#15120e';
    const trunkLight = '#c4b69c';
    const trunkBody = '#a99c84';
    const trunkMid = '#8a7e68';
    const trunkShade = '#665c4b';
    const trunkRing = '#3e362b';

    for (let y = 23; y <= 61; y++) {
      const t = (y - 23) / 38;
      const flare = y >= 57 ? (y - 56) * 0.85 : 0;
      const halfWidth = 2.05 + t * 1.05 + flare;

      for (
        let x = Math.floor(24 - halfWidth - 1);
        x <= Math.ceil(24 + halfWidth + 1);
        x++
      ) {
        setPixel(x, y, trunkOutline);
      }
      for (let x = Math.floor(24 - halfWidth); x <= Math.ceil(24 + halfWidth); x++) {
        const relative = (x - 24) / halfWidth;
        let color = trunkBody;
        if (relative < -0.35) color = trunkLight;
        else if (relative > 0.55) color = trunkShade;
        else if (relative > 0.15) color = trunkMid;
        setPixel(x, y, color);
      }

      // Sharp, well-spaced rings give the slender trunk its buriti texture.
      if (y % 3 === 0) {
        for (let x = Math.ceil(24 - halfWidth); x <= Math.floor(24 + halfWidth); x++) {
          setPixel(x, y, trunkRing);
        }
      } else if (y % 3 === 1) {
        setPixel(24 - halfWidth + 0.6, y, '#e2d6bd');
      }
    }

    // Compact crown knob where the fronds and fruit stems meet the trunk.
    fillEllipse(24, 24, 3.6, 2.4, trunkOutline);
    fillEllipse(24, 23.8, 2.7, 1.6, trunkBody);
    fillEllipse(23, 23.3, 1.2, 0.7, trunkLight);

    // Front fronds drape over the trunk to add depth to the fan.
    drawFrond(24, 25.5, 34, 27, 46, 31, 0, false);
    drawFrond(24, 25.5, 14, 27, 2, 31, 1, true);
    drawFrond(24, 26, 17, 31, 8, 38, 2, true);
    drawFrond(24, 26, 31, 31, 40, 38, 2, false);

    const fruitOutline = '#1a0a05';
    const fruitBody = '#c2410c';
    const fruitLight = '#f97316';
    const fruitGlint = '#fbbf24';
    const fruitShade = '#7f1d12';
    const fruitStem = '#3a2412';

    const drawFruit = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      stemX: number,
      stemY: number
    ): void => {
      drawLine(cx, cy - ry, stemX, stemY, fruitStem);
      fillEllipse(cx, cy, rx + 0.7, ry + 0.7, fruitOutline);
      fillEllipse(cx, cy, rx, ry, fruitBody);
      fillEllipse(cx - rx * 0.28, cy - ry * 0.32, rx * 0.55, ry * 0.46, fruitLight);
      fillEllipse(cx + rx * 0.34, cy + ry * 0.36, rx * 0.42, ry * 0.38, fruitShade);

      // Scaly diamond texture from the reference art.
      setPixel(cx - rx * 0.18, cy + ry * 0.05, '#9a3412');
      setPixel(cx + rx * 0.25, cy - ry * 0.05, fruitGlint);
      setPixel(cx - rx * 0.1, cy - ry * 0.45, fruitGlint);
      setPixel(cx + rx * 0.42, cy + ry * 0.12, '#5c160d');
    };

    // Heavy central bunch, exactly like the reference, with two smaller
    // bunches tucked behind the left and right fronds.
    drawFruit(21.5, 32.5, 2.5, 3.0, 23.5, 26);
    drawFruit(26.2, 33.0, 2.6, 3.1, 24.5, 26);
    drawFruit(23.6, 37.2, 2.8, 3.3, 24, 27);
    drawFruit(28.4, 37.6, 2.5, 3.0, 26, 27);
    drawFruit(20.2, 37.8, 2.4, 2.9, 22, 27);
    drawFruit(24.5, 42.0, 2.5, 3.0, 24, 32);

    drawFruit(15.6, 29.6, 2.1, 2.5, 18.5, 25);
    drawFruit(18.4, 31.5, 2.2, 2.6, 19.5, 25.5);
    drawFruit(16.8, 34.0, 2.1, 2.5, 19, 27);

    drawFruit(33.4, 29.2, 2.0, 2.4, 31, 25);
    drawFruit(36.0, 30.6, 2.1, 2.5, 32, 25.5);
    drawFruit(34.8, 33.4, 2.0, 2.4, 32.5, 27);

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

    this.buritiPixelSprite = canvas;
    return canvas;
  }

  /**
   * Builds (once) the Pupunheira sprite. The 48x64 pixel-art canvas follows
   * the reference: a dark contour, a slim segmented grey trunk covered in
   * black spine rings, a tall crown of arched green palm fronds, large dense
   * bunches of round red-and-orange fruits hanging below the fronds and a
   * dark oval shadow at the base.
   */
  private getPupunhaPixelSprite(): HTMLCanvasElement | null {
    if (this.pupunhaPixelSprite) return this.pupunhaPixelSprite;
    if (typeof document === 'undefined') return null;

    const width = PUPUNHA_SPRITE_WIDTH;
    const height = PUPUNHA_SPRITE_HEIGHT;
    const pixels: (string | null)[] = new Array(width * height).fill(null);

    const setPixel = (x: number, y: number, color: string): void => {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || px >= width || py < 0 || py >= height) return;
      pixels[py * width + px] = color;
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

    // Dark oval shadow centred under the trunk base.
    fillEllipse(24, 61.5, 19.5, 4.1, 'rgba(4, 8, 5, 0.62)');
    fillEllipse(24, 61.7, 13.5, 2.7, 'rgba(3, 6, 4, 0.45)');

    const frondOutline = '#07180c';
    const frondDark = '#0f4a24';
    const frondBody = '#1d7a3a';
    const frondLight = '#3fa650';
    const frondGlint = '#78cf6c';

    const drawFrond = (
      baseX: number,
      baseY: number,
      controlX: number,
      controlY: number,
      tipX: number,
      tipY: number,
      tone: number,
      litFromLeft: boolean
    ): void => {
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

      // Dark rib running along the full arch.
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        setPixel(pointX(t), pointY(t), frondOutline);
      }

      // Feathery leaflets fan out on both sides of the rib, like the reference.
      for (let l = 1; l <= 7; l++) {
        const t = l / 8;
        const x = pointX(t);
        const y = pointY(t);
        const dx = tangentX(t);
        const dy = tangentY(t);
        const length = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / length;
        const ny = dx / length;
        const leafLength = 2.6 + Math.sin(Math.PI * t) * 3.6;
        const towardTipX = (dx / length) * leafLength * 0.55;
        const towardTipY = (dy / length) * leafLength * 0.55;

        const drawLeaflet = (side: number): void => {
          const endX = x + nx * side * leafLength + towardTipX;
          const endY = y + ny * side * leafLength + towardTipY;

          let color = frondDark;
          const lit = litFromLeft ? side < 0 : side > 0;
          if (lit) color = frondLight;
          if (tone === 1) color = lit ? frondBody : frondDark;
          else if (tone === 2) color = lit ? frondGlint : frondLight;

          drawLine(x, y, endX, endY, frondOutline);
          drawLine(
            x + (endX - x) * 0.22,
            y + (endY - y) * 0.22,
            x + (endX - x) * 0.8,
            y + (endY - y) * 0.8,
            color
          );
          setPixel(endX, endY, frondLight);
        };

        drawLeaflet(-1);
        drawLeaflet(1);
      }

      // Lit rib on top of the leaflets.
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        setPixel(
          pointX(t),
          pointY(t),
          t < 0.35 && litFromLeft ? frondLight : frondBody
        );
      }
      setPixel(tipX, tipY, frondGlint);
    };

    // Back half of the crown, painted before the trunk so fronds sit behind.
    drawFrond(24, 23, 17, 8, 9, 2, 0, true);
    drawFrond(24, 23, 22, 4, 21, 0, 1, true);
    drawFrond(24, 23, 28, 5, 32, 0, 2, false);
    drawFrond(24, 23, 35, 8, 42, 2, 1, false);
    drawFrond(24, 23, 8, 15, 1, 21, 0, true);
    drawFrond(24, 23, 42, 14, 47, 21, 1, false);
    drawFrond(24, 23, 13, 8, 13, 1, 1, true);
    drawFrond(24, 23, 35, 8, 36, 1, 0, false);

    const trunkOutline = '#191510';
    const trunkLight = '#c3bca8';
    const trunkBody = '#9c9480';
    const trunkMid = '#77705e';
    const trunkShade = '#514b3c';
    const ringDark = '#2c2820';
    const spineDark = '#100c08';
    const spineLight = '#3a3327';

    // Slim segmented grey trunk, slightly flared at the base.
    for (let y = 22; y <= 61; y++) {
      const t = (y - 22) / 39;
      const flare = y >= 57 ? (y - 56) * 0.6 : 0;
      const halfWidth = 2.2 + t * 0.8 + flare;

      for (
        let x = Math.floor(24 - halfWidth - 1);
        x <= Math.ceil(24 + halfWidth + 1);
        x++
      ) {
        setPixel(x, y, trunkOutline);
      }
      for (let x = Math.floor(24 - halfWidth); x <= Math.ceil(24 + halfWidth); x++) {
        const relative = (x - 24) / halfWidth;
        let color = trunkBody;
        if (relative < -0.4) color = trunkLight;
        else if (relative > 0.55) color = trunkShade;
        else if (relative > 0.1) color = trunkMid;
        setPixel(x, y, color);
      }

      // Horizontal growth rings.
      if (y % 4 === 0) {
        for (
          let x = Math.ceil(24 - halfWidth);
          x <= Math.floor(24 + halfWidth);
          x++
        ) {
          setPixel(x, y, ringDark);
        }
      } else if (y % 4 === 2) {
        setPixel(24 - halfWidth + 0.3, y, trunkShade);
        setPixel(24 + halfWidth - 0.3, y, trunkShade);
      }

      // Rows of protruding black spines around the rings.
      if (y % 3 === 1) {
        const left = 24 - halfWidth - 1.2;
        const right = 24 + halfWidth + 1.2;
        setPixel(left, y, spineDark);
        setPixel(left - 0.7, y - 0.6, spineDark);
        setPixel(right, y + 1, spineDark);
        setPixel(right + 0.7, y + 1.6, spineDark);
        if ((y - 22) % 6 === 0) {
          setPixel(left, y - 1, spineLight);
          setPixel(right, y + 2, spineLight);
        }
      }
    }

    // Crown knob where the fronds and fruit stems meet the trunk.
    fillEllipse(24, 23.2, 3.6, 2.5, trunkOutline);
    fillEllipse(24, 23, 2.7, 1.7, trunkBody);
    fillEllipse(23.1, 22.5, 1.2, 0.7, trunkLight);

    // Front fronds drape down over the top of the trunk for 2.5D depth.
    drawFrond(24, 25, 15, 27, 5, 34, 0, true);
    drawFrond(24, 25, 33, 27, 43, 34, 1, false);
    drawFrond(24, 26, 17, 32, 10, 41, 2, true);
    drawFrond(24, 26, 31, 32, 38, 41, 0, false);

    const fruitOutline = '#1a0805';
    const fruitBody = '#d92b1f';
    const fruitOrange = '#f97316';
    const fruitLight = '#fb923c';
    const fruitGlint = '#fde68a';
    const fruitShade = '#8f1a12';
    const fruitStem = '#4a2f1a';

    const drawFruit = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      stemX: number,
      stemY: number
    ): void => {
      drawLine(cx, cy - ry, stemX, stemY, fruitStem);
      fillEllipse(cx, cy, rx + 0.7, ry + 0.7, fruitOutline);
      fillEllipse(cx, cy, rx, ry, fruitBody);
      fillEllipse(cx + rx * 0.35, cy + ry * 0.3, rx * 0.5, ry * 0.5, fruitOrange);
      fillEllipse(cx - rx * 0.28, cy - ry * 0.32, rx * 0.55, ry * 0.46, fruitLight);
      fillEllipse(cx + rx * 0.38, cy + ry * 0.42, rx * 0.38, ry * 0.36, fruitShade);
      setPixel(cx - rx * 0.4, cy - ry * 0.42, fruitGlint);
      setPixel(cx - rx * 0.15, cy - ry * 0.55, fruitGlint);
    };

    // Large, dense cluster of round red-and-orange pupunha fruits hanging
    // right below the crown, plus a smaller bunch tucked to the left.
    drawFruit(23, 28, 2.3, 2.7, 24, 23.5);
    drawFruit(27, 29, 2.2, 2.6, 25, 23.5);
    drawFruit(19.5, 30, 2.1, 2.5, 22.5, 24);
    drawFruit(24.5, 31.5, 2.4, 2.8, 24, 25);
    drawFruit(28.5, 32.5, 2.1, 2.5, 26, 25);
    drawFruit(21, 33.5, 2.2, 2.6, 23, 27);
    drawFruit(25, 35.5, 2.3, 2.7, 24, 29);
    drawFruit(29, 36, 2.0, 2.4, 27, 29);
    drawFruit(17, 32, 1.9, 2.3, 21, 26);
    drawFruit(15.5, 35.5, 1.8, 2.2, 20, 29);
    drawFruit(19.5, 38, 2.0, 2.4, 22, 32);
    drawFruit(23.5, 40, 2.1, 2.5, 24, 34);
    drawFruit(31.5, 33.5, 1.8, 2.2, 29, 27);
    drawFruit(33, 37, 1.7, 2.1, 30, 30);

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

    this.pupunhaPixelSprite = canvas;
    return canvas;
  }

  /**
   * Draws the Cupuaçu minimap marker: a compact 16x16 pixel-art capsule that
   * follows the reference fruit — velvety brown oval, thin dark outline and a
   * small lighter highlight on the upper-left skin. It is painted with
   * smoothing disabled so every pixel stays crisp on the radar.
   */
  private drawCupuacuMinimapIcon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
  ): void {
    const size = ACAI_MINIMAP_ICON_SIZE;
    const pixels: (string | null)[] = new Array(size * size).fill(null);

    const setPixel = (px: number, py: number, color: string): void => {
      if (px < 0 || px >= size || py < 0 || py >= size) return;
      pixels[py * size + px] = color;
    };

    const outline = '#140a06';
    const body = '#8a5731';
    const bodyLight = '#a86f3f';
    const bodyDark = '#5c3a21';
    const shine = '#c58d59';
    const stem = '#4a2a14';

    const cx = 7.5;
    const cy = 8.4;
    const rx = 4.8;
    const ry = 5.8;

    // Velvety capsule: warm light on the upper-left and a darker lower-right
    // side give the flat oval some volume.
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;

        let color = body;
        const shade = dx * 0.55 + dy * 0.85;
        if (shade > 0.42) color = bodyDark;
        else if (shade < -0.4) color = bodyLight;

        const hx = (px - (cx - 1.5)) / 1.5;
        const hy = (py - (cy - 2.1)) / 1.3;
        if (hx * hx + hy * hy <= 1) color = shine;

        setPixel(px, py, color);
      }
    }

    // Tiny stem nub at the top-right, like the reference fruit.
    setPixel(10, 2, stem);
    setPixel(11, 2, stem);
    setPixel(10, 3, stem);

    // One-pixel dark contour around the whole shape so the marker keeps a
    // crisp silhouette on the dark minimap panel.
    const filled = pixels.slice();
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        if (filled[py * size + px]) continue;
        const nearFilled =
          (py > 0 && Boolean(filled[(py - 1) * size + px])) ||
          (py < size - 1 && Boolean(filled[(py + 1) * size + px])) ||
          (px > 0 && Boolean(filled[py * size + (px - 1)])) ||
          (px < size - 1 && Boolean(filled[py * size + (px + 1)]));
        if (nearFilled) pixels[py * size + px] = outline;
      }
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const color = pixels[py * size + px];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
    ctx.restore();
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
      case 'castanha': {
        // Whole dark-brown pod on the upper left, with its pointed stem nub.
        fillCircle(5.0, 4.7, 4.4, outline);
        fillCircle(5.0, 4.7, 3.8, '#5c341b');
        fillCircle(4.3, 4.0, 2.2, '#7a4a27');
        fillCircle(6.0, 5.6, 2.0, '#4a2714');
        setPixel(3.2, 2.9, '#9b6538');
        setPixel(3.9, 2.4, '#9b6538');
        setPixel(2.6, 3.9, '#9b6538');

        fillEllipse(5.0, 0.7, 1.3, 1.1, outline);
        fillEllipse(5.0, 0.8, 0.8, 0.6, '#6b3d20');

        // Cracked half in the lower right: dark shell rim around a pale beige
        // nut, drawn last so it sits in front of the whole pod.
        fillEllipse(10.7, 11.0, 4.2, 3.2, outline);
        fillEllipse(10.7, 11.0, 3.6, 2.7, '#5c341b');
        fillEllipse(11.2, 11.7, 2.8, 1.9, '#43220f');
        fillEllipse(10.5, 10.3, 3.1, 1.9, '#c9a46d');
        fillEllipse(10.5, 10.4, 2.4, 1.3, '#2a1509');
        fillEllipse(10.3, 10.2, 1.9, 0.95, '#e0c08c');
        fillEllipse(9.7, 9.9, 1.0, 0.45, '#f7e8c6');
        setPixel(9.0, 9.7, '#fff6de');
        setPixel(9.6, 9.5, '#fff6de');
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
    radius: number,
    airborne: boolean = false
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
      if (!this.collidesWithTree(nextX, y, radius)) {
        if (!this.blocksOnPlateauRim(x, y, nextX, y, airborne, radius)) x = nextX;
      }

      const nextY = Math.max(-limit, Math.min(limit, y + stepY));
      if (!this.collidesWithTree(x, nextY, radius)) {
        if (!this.blocksOnPlateauRim(x, y, x, nextY, airborne, radius)) y = nextY;
      }
    }

    return { x, y };
  }

  /**
   * Constrains a ground animal to the plateau geometry. Unlike the hero they
   * cannot jump, so both the climb and the descent must use a dirt ramp.
   */
  public resolveLandMovement(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    radius: number
  ): { x: number; y: number } {
    if (this.mapId !== 'amazon_forest' || this.plateaus.length === 0) {
      return { x: toX, y: toY };
    }

    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.0001) return { x: fromX, y: fromY };

    const steps = Math.max(1, Math.ceil(distance / COLLISION_STEP));
    const stepX = dx / steps;
    const stepY = dy / steps;
    let x = fromX;
    let y = fromY;
    // If the animal already spawned inside a trunk, let it walk out instead of
    // trapping it forever against the tree it overlaps.
    const startedInsideTree = this.collidesWithDecorTree(fromX, fromY, radius);

    for (let i = 0; i < steps; i++) {
      const nextX = x + stepX;
      if (
        !this.blocksOnPlateauRim(x, y, nextX, y, false, radius) &&
        (startedInsideTree || !this.collidesWithDecorTree(nextX, y, radius))
      ) {
        x = nextX;
      }

      const nextY = y + stepY;
      if (
        !this.blocksOnPlateauRim(x, y, x, nextY, false, radius) &&
        (startedInsideTree || !this.collidesWithDecorTree(x, nextY, radius))
      ) {
        y = nextY;
      }
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
    return this.collidesWithDecorTree(x, y, radius);
  }

  private collidesWithDecorTree(x: number, y: number, radius: number): boolean {
    for (let i = 0; i < this.decorTrees.length; i++) {
      const tree = this.decorTrees[i];
      const minDist = radius + this.getDecorTreeCollisionRadius(tree);
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

      // Thorn bushes only need their rustle animation.
      for (let i = 0; i < this.thornBushes.length; i++) {
        this.thornBushes[i].animTimer += dt * 1.8;
      }

      // Harvested herbs respawn somewhere else on dry land after a while, so
      // the map never runs out of antidotes.
      for (let i = 0; i < this.herbs.length; i++) {
        const herb = this.herbs[i];
        herb.animTimer += dt * 2.2;
        if (!herb.active) {
          herb.respawnTimer -= dt;
          if (herb.respawnTimer <= 0) {
            const spawn = this.findFieldPlantSpawn(20);
            herb.x = spawn.x;
            herb.y = spawn.y;
            herb.active = true;
            herb.respawnTimer = 0;
          }
        }
      }
    }
  }

  /**
   * Builds the repeating pixel-art forest-floor tile once: dark grass base,
   * mossy and muddy blotches, grass blades, loose soil and tiny fixed tufts.
   */
  private getForestGroundPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (this.forestGroundPattern) return this.forestGroundPattern;
    if (typeof document === 'undefined') return null;

    const size = FOREST_GROUND_TILE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const pctx = canvas.getContext('2d');
    if (!pctx) return null;

    let seed = 92731;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const pick = (items: string[]): string =>
      items[Math.floor(random() * items.length)];

    pctx.fillStyle = '#14351d';
    pctx.fillRect(0, 0, size, size);

    // Broad mossy and damp-soil blotches break up the flat green base.
    for (let i = 0; i < 26; i++) {
      pctx.fillStyle = pick([
        'rgba(31, 74, 40, 0.55)',
        'rgba(24, 58, 31, 0.5)',
        'rgba(52, 78, 37, 0.35)',
        'rgba(62, 47, 28, 0.28)',
        'rgba(18, 46, 27, 0.55)',
      ]);
      pctx.beginPath();
      pctx.ellipse(
        random() * size,
        random() * size,
        16 + random() * 56,
        10 + random() * 34,
        random() * Math.PI,
        0,
        Math.PI * 2
      );
      pctx.fill();
    }

    // Fine grass blades in a limited pixel-art palette.
    const grassColors = [
      '#173d21',
      '#1c4727',
      '#21512c',
      '#276033',
      '#2c6b38',
      '#163a1f',
      '#326f3a',
    ];
    for (let i = 0; i < 1900; i++) {
      pctx.fillStyle = pick(grassColors);
      pctx.fillRect(
        Math.floor(random() * size),
        Math.floor(random() * size),
        1,
        1 + Math.floor(random() * 4)
      );
    }

    // Loose soil, root fibres and tiny pebbles.
    const soilColors = ['#3a2b1a', '#4a3722', '#5a4329', '#2f2417', '#66502f'];
    for (let i = 0; i < 460; i++) {
      pctx.fillStyle = pick(soilColors);
      pctx.fillRect(
        Math.floor(random() * size),
        Math.floor(random() * size),
        1 + Math.floor(random() * 2),
        1 + Math.floor(random() * 2)
      );
    }

    // Shallow roots snaking across the topsoil.
    pctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = random() * size;
      const y = random() * size;
      const length = 16 + random() * 42;
      const bend = (random() - 0.5) * 18;
      pctx.strokeStyle =
        random() < 0.55 ? 'rgba(56, 40, 24, 0.55)' : 'rgba(44, 58, 30, 0.5)';
      pctx.lineWidth = 1 + random();
      pctx.beginPath();
      pctx.moveTo(x, y);
      pctx.quadraticCurveTo(
        x + length * 0.45,
        y + bend,
        x + length,
        y + bend * 0.4
      );
      pctx.stroke();

      // A short side root branching off the main one.
      pctx.lineWidth = 1;
      pctx.beginPath();
      pctx.moveTo(x + length * 0.5, y + bend * 0.6);
      pctx.lineTo(x + length * 0.62, y + bend * 0.6 - 5 - random() * 5);
      pctx.stroke();
    }
    pctx.lineCap = 'butt';

    // Small fixed tufts: a few blades sharing a root.
    for (let i = 0; i < 120; i++) {
      const x = random() * size;
      const y = random() * size;
      const blades = 2 + Math.floor(random() * 3);
      pctx.strokeStyle = pick(['#2c6b38', '#367a42', '#245c2e', '#3f8447']);
      pctx.lineWidth = 1;
      for (let b = 0; b < blades; b++) {
        const spread = (b - (blades - 1) / 2) * 2.4;
        pctx.beginPath();
        pctx.moveTo(x, y);
        pctx.lineTo(x + spread, y - 3 - random() * 4);
        pctx.stroke();
      }
    }

    // Dark organic specks give the tile a damp, earthy depth.
    pctx.fillStyle = 'rgba(8, 20, 11, 0.45)';
    for (let i = 0; i < 320; i++) {
      pctx.fillRect(Math.floor(random() * size), Math.floor(random() * size), 1, 1);
    }

    this.forestGroundPattern = ctx.createPattern(canvas, 'repeat');
    return this.forestGroundPattern;
  }

  /** Repeating transparent grain used to texture the sandy river banks. */
  private getSandGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (this.sandGrainPattern) return this.sandGrainPattern;
    if (typeof document === 'undefined') return null;

    const size = SAND_GRAIN_TILE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const pctx = canvas.getContext('2d');
    if (!pctx) return null;

    let seed = 48311;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Fine light and dark grains.
    for (let i = 0; i < 1400; i++) {
      pctx.fillStyle =
        random() < 0.55 ? 'rgba(250, 236, 200, 0.4)' : 'rgba(120, 92, 54, 0.34)';
      pctx.fillRect(
        Math.floor(random() * size),
        Math.floor(random() * size),
        1,
        1
      );
    }

    // A few slightly larger shell/pebble flecks.
    for (let i = 0; i < 80; i++) {
      pctx.fillStyle =
        random() < 0.5 ? 'rgba(255, 247, 222, 0.32)' : 'rgba(90, 68, 40, 0.3)';
      pctx.fillRect(
        Math.floor(random() * size),
        Math.floor(random() * size),
        1 + Math.floor(random() * 2),
        1
      );
    }

    // Tiny wavy sand ripples.
    pctx.strokeStyle = 'rgba(112, 86, 50, 0.22)';
    pctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const y = random() * size;
      const x = random() * size;
      pctx.beginPath();
      pctx.moveTo(x, y);
      pctx.quadraticCurveTo(x + 5, y - 2, x + 11, y);
      pctx.stroke();
    }

    this.sandGrainPattern = ctx.createPattern(canvas, 'repeat');
    return this.sandGrainPattern;
  }

  /** Repeating transparent shimmer/foam used to texture the river water. */
  private getWaterShimmerPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (this.waterShimmerPattern) return this.waterShimmerPattern;
    if (typeof document === 'undefined') return null;

    const size = WATER_SHIMMER_TILE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const pctx = canvas.getContext('2d');
    if (!pctx) return null;

    let seed = 73189;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Soft foam streaks following the current.
    pctx.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const y = random() * size;
      const x = random() * size;
      const length = 12 + random() * 34;
      pctx.strokeStyle =
        random() < 0.55
          ? 'rgba(212, 244, 250, 0.34)'
          : 'rgba(8, 58, 76, 0.28)';
      pctx.lineWidth = random() < 0.5 ? 1 : 1.6;
      pctx.beginPath();
      pctx.moveTo(x, y);
      pctx.quadraticCurveTo(x + length * 0.5, y - 2.5, x + length, y);
      pctx.stroke();
    }

    // Small highlights and darker undertow specks.
    for (let i = 0; i < 220; i++) {
      pctx.fillStyle =
        random() < 0.6 ? 'rgba(214, 244, 250, 0.28)' : 'rgba(6, 48, 64, 0.24)';
      pctx.fillRect(
        Math.floor(random() * size),
        Math.floor(random() * size),
        1 + Math.floor(random() * 2),
        1
      );
    }

    this.waterShimmerPattern = ctx.createPattern(canvas, 'repeat');
    return this.waterShimmerPattern;
  }

  renderFloor(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.mapId === 'amazon_forest') {
      // Deep darkness outside the finite map bounds.
      ctx.fillStyle = '#08120b';
      ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);

      // Everything below stays inside the 14000x14000 playable square.
      const origin = camera.worldToScreen(-FOREST_HALF_SIZE, -FOREST_HALF_SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.rect(origin.x, origin.y, FOREST_SIZE, FOREST_SIZE);
      ctx.clip();

      // Rich pixel-art ground texture: grass, moss, damp soil and roots.
      const groundPattern = this.getForestGroundPattern(ctx);
      if (groundPattern) {
        const tile = FOREST_GROUND_TILE;
        const offsetX =
          (-camera.x + camera.viewportWidth / 2 + camera.shakeOffsetX) % tile;
        const offsetY =
          (-camera.y + camera.viewportHeight / 2 + camera.shakeOffsetY) % tile;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.fillStyle = groundPattern;
        ctx.fillRect(
          -tile,
          -tile,
          camera.viewportWidth + tile * 2,
          camera.viewportHeight + tile * 2
        );
        ctx.restore();
      } else {
        ctx.fillStyle = '#14351d';
        ctx.fillRect(origin.x, origin.y, FOREST_SIZE, FOREST_SIZE);
      }

      for (let i = 0; i < this.floorPatches.length; i++) {
        const patch = this.floorPatches[i];
        const margin = Math.max(patch.rx, patch.ry) + 20;
        if (!camera.isInView(patch.x, patch.y, margin)) continue;

        const screen = camera.worldToScreen(patch.x, patch.y);
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(patch.rotation);

        if (patch.kind === 'moss') {
          // Older, greener ground where moss crept over the soil.
          ctx.fillStyle = patch.tone > 0.5 ? '#1d4a28' : '#214f2b';
          ctx.beginPath();
          ctx.ellipse(0, 0, patch.rx, patch.ry, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(74, 124, 62, 0.42)';
          ctx.beginPath();
          ctx.ellipse(
            patch.rx * 0.08,
            -patch.ry * 0.12,
            patch.rx * 0.58,
            patch.ry * 0.52,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        } else if (patch.kind === 'wet') {
          // Damp, almost black soil with a faint moisture sheen.
          ctx.fillStyle = patch.tone > 0.5 ? '#2c2317' : '#3a2d1c';
          ctx.beginPath();
          ctx.ellipse(0, 0, patch.rx, patch.ry, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(126, 150, 126, 0.16)';
          ctx.beginPath();
          ctx.ellipse(
            patch.rx * 0.12,
            -patch.ry * 0.2,
            patch.rx * 0.48,
            patch.ry * 0.34,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();

          ctx.fillStyle = 'rgba(10, 18, 12, 0.35)';
          ctx.beginPath();
          ctx.ellipse(
            -patch.rx * 0.16,
            patch.ry * 0.18,
            patch.rx * 0.3,
            patch.ry * 0.24,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        } else {
          // Regular earth patch with a lighter, drier centre.
          ctx.fillStyle = patch.tone > 0.5 ? '#5a3a20' : '#69482a';
          ctx.beginPath();
          ctx.ellipse(0, 0, patch.rx, patch.ry, 0, 0, Math.PI * 2);
          ctx.fill();

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

          // Small pebbles and root fibres scattered over the bare soil.
          let seed = Math.floor(Math.abs(patch.x * 17 + patch.y * 31)) % 2147483647;
          const random = () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
          };
          for (let k = 0; k < 7; k++) {
            ctx.fillStyle =
              k % 3 === 0 ? 'rgba(92, 66, 38, 0.7)' : 'rgba(150, 112, 68, 0.5)';
            ctx.fillRect(
              (random() - 0.5) * patch.rx * 1.5,
              (random() - 0.5) * patch.ry * 1.35,
              1.5,
              1.5
            );
          }
        }

        ctx.restore();
      }

      this.renderPlateaus(ctx, camera);

      ctx.restore();

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

  /**
   * Draws the raised forest plateaus: a dark earth/rock cliff ring around a
   * grassy hilltop, cut by one wide dirt ramp that marks the only crossing.
   */
  private renderPlateaus(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.mapId !== 'amazon_forest' || this.plateaus.length === 0) return;

    for (let i = 0; i < this.plateaus.length; i++) {
      const plateau = this.plateaus[i];
      const margin = Math.max(plateau.rx, plateau.ry) + plateau.rampLength + 180;
      if (!camera.isInView(plateau.x, plateau.y, margin)) continue;

      const screen = camera.worldToScreen(plateau.x, plateau.y);
      const dirX = Math.cos(plateau.rampAngle);
      const dirY = Math.sin(plateau.rampAngle);
      const boundary = this.getPlateauBoundaryRadius(plateau, dirX, dirY);
      const rim = PLATEAU_RIM_WIDTH;
      const rampInner = boundary - PLATEAU_RAMP_INSET;
      const rampOuter = boundary + plateau.rampLength;

      ctx.save();
      ctx.translate(screen.x, screen.y);

      // Soft mass shadow, slightly below the footprint.
      ctx.save();
      ctx.translate(0, 14);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
      ctx.beginPath();
      this.tracePlateauShape(ctx, plateau, rim + 24);
      ctx.fill();
      ctx.restore();

      // Vertical earth/stone wall around the whole hilltop.
      const cliffGradient = ctx.createLinearGradient(0, -plateau.ry, 0, plateau.ry);
      cliffGradient.addColorStop(0, '#4a3522');
      cliffGradient.addColorStop(0.45, '#5c4229');
      cliffGradient.addColorStop(1, '#291b10');
      ctx.fillStyle = cliffGradient;
      ctx.beginPath();
      this.tracePlateauShape(ctx, plateau, rim);
      ctx.fill();

      // Broken strata on the exposed wall band.
      ctx.save();
      ctx.beginPath();
      this.tracePlateauShape(ctx, plateau, rim);
      ctx.clip();
      ctx.strokeStyle = 'rgba(26, 16, 9, 0.55)';
      ctx.lineWidth = 3;
      for (let s = 0; s < 10; s++) {
        const angle = (s / 10) * Math.PI * 2;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        const outer = this.getPlateauBoundaryRadius(plateau, dirX, dirY) + rim - 2;
        const inner = outer - 11;
        const ax = dirX * outer;
        const ay = dirY * outer;
        const bx = Math.cos(angle + 0.14) * inner;
        const by = Math.sin(angle + 0.14) * inner;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      ctx.restore();

      // Grassy top surface, kept at the plateau's real world coordinates so
      // characters and animals stand exactly on it.
      const topGradient = ctx.createLinearGradient(0, -plateau.ry, 0, plateau.ry);
      topGradient.addColorStop(0, '#2f6d3d');
      topGradient.addColorStop(0.5, '#255a33');
      topGradient.addColorStop(1, '#1b4528');
      ctx.fillStyle = topGradient;
      ctx.beginPath();
      this.tracePlateauShape(ctx, plateau);
      ctx.fill();

      // Deterministic moss/soil patches so the hilltop does not look flat.
      ctx.save();
      ctx.beginPath();
      this.tracePlateauShape(ctx, plateau);
      ctx.clip();
      let seed = Math.floor(Math.abs(plateau.x * 13 + plateau.y * 7)) % 2147483647;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      for (let p = 0; p < 16; p++) {
        ctx.fillStyle =
          p % 3 === 0 ? 'rgba(112, 78, 45, 0.3)' : 'rgba(70, 120, 62, 0.28)';
        ctx.beginPath();
        ctx.ellipse(
          (random() - 0.5) * plateau.rx * 1.5,
          (random() - 0.5) * plateau.ry * 1.5,
          20 + random() * 58,
          12 + random() * 34,
          random() * Math.PI,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.restore();

      // Lower lip shadow and a lighter upper rim to sell the height.
      ctx.strokeStyle = 'rgba(8, 14, 9, 0.55)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      this.tracePlateauShape(ctx, plateau, -4, Math.PI * 0.08, Math.PI * 0.92);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(126, 174, 108, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.tracePlateauShape(ctx, plateau, -3);
      ctx.stroke();

      // Dirt ramp: it starts inside the hilltop, cuts through the cliff ring
      // and blends into the forest floor at its outer end.
      ctx.save();
      ctx.rotate(plateau.rampAngle);
      const rampGradient = ctx.createLinearGradient(rampInner, 0, rampOuter, 0);
      rampGradient.addColorStop(0, '#7b5734');
      rampGradient.addColorStop(0.5, '#68462a');
      rampGradient.addColorStop(1, '#4a3220');
      ctx.fillStyle = rampGradient;
      ctx.beginPath();
      this.tracePlateauRamp(ctx, plateau, rampInner, rampOuter);
      ctx.fill();

      // Eroded ramp edges.
      ctx.strokeStyle = 'rgba(42, 27, 14, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      this.tracePlateauRampEdge(ctx, plateau, rampInner, rampOuter, -1);
      this.tracePlateauRampEdge(ctx, plateau, rampInner, rampOuter, 1);
      ctx.stroke();

      // Traction ribs across the dirt.
      ctx.strokeStyle = 'rgba(38, 23, 11, 0.5)';
      ctx.lineWidth = 2.5;
      for (let d = rampInner + 34; d < rampOuter - 14; d += 44) {
        const profile = this.getPlateauRampProfile(plateau, d, rampInner, rampOuter);
        ctx.beginPath();
        ctx.moveTo(d, profile.center - profile.halfWidth);
        ctx.lineTo(d, profile.center + profile.halfWidth);
        ctx.stroke();
      }

      // Loose pebbles on the slope.
      ctx.fillStyle = 'rgba(190, 160, 116, 0.4)';
      for (let s = 0; s < 10; s++) {
        const t = (s + 0.5) / 10;
        const d = rampInner + (rampOuter - rampInner) * t;
        const profile = this.getPlateauRampProfile(plateau, d, rampInner, rampOuter);
        const lateral =
          profile.center + ((s % 3) - 1) * profile.halfWidth * 0.45;
        ctx.fillRect(d, lateral, 3, 2);
      }
      ctx.restore();

      // A few boulders embedded in the rim.
      ctx.fillStyle = 'rgba(120, 112, 96, 0.75)';
      for (let s = 0; s < 14; s++) {
        const angle = (s / 14) * Math.PI * 2;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        const radius =
          this.getPlateauBoundaryRadius(plateau, dirX, dirY) + rim * 0.5;
        const sx = dirX * radius;
        const sy = dirY * radius;
        const size = 3 + (s % 3) * 2;
        ctx.beginPath();
        ctx.ellipse(sx, sy, size, size * 0.65, angle, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
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

    const riverXs: number[] = [];
    for (let x = start; x <= end; x += step) riverXs.push(x);

    /**
     * Filled river band with an independently wobbling shoreline on each
     * cross-section. Unlike a constant-width stroke, this carves small bays,
     * narrowing channels and irregular sand margins along the course.
     */
    const traceRiverBand = (halfWidth: number) => {
      ctx.beginPath();
      for (let i = 0; i < riverXs.length; i++) {
        const x = riverXs[i];
        const y = this.riverCenterY(x);
        const half = this.getRiverHalfWidth(x, halfWidth);
        if (i === 0) ctx.moveTo(x, y - half);
        else ctx.lineTo(x, y - half);
      }
      for (let i = riverXs.length - 1; i >= 0; i--) {
        const x = riverXs[i];
        const y = this.riverCenterY(x);
        const half = this.getRiverHalfWidth(x, halfWidth);
        ctx.lineTo(x, y + half);
      }
      ctx.closePath();
    };

    /**
     * Dark clay margin that follows both riverbanks. It starts at the painted
     * water edge and oozes a short, irregular distance onto the sand, matching
     * the isMud() terrain check used by the movement code.
     */
    const traceRiverMudBand = (thicknessScale: number) => {
      ctx.beginPath();
      for (let i = 0; i < riverXs.length; i++) {
        const x = riverXs[i];
        const y = this.riverCenterY(x);
        const half = this.getRiverHalfWidth(x, RIVER_HALF_WIDTH);
        const mud = this.getMudBandThickness(x) * thicknessScale;
        if (i === 0) ctx.moveTo(x, y - half - mud);
        else ctx.lineTo(x, y - half - mud);
      }
      for (let i = riverXs.length - 1; i >= 0; i--) {
        const x = riverXs[i];
        const y = this.riverCenterY(x);
        const half = this.getRiverHalfWidth(x, RIVER_HALF_WIDTH);
        const mud = this.getMudBandThickness(x) * thicknessScale;
        ctx.lineTo(x, y + half + mud);
      }
      ctx.closePath();
    };

    // Sandy banks with a soft, mossy transition into the forest.
    traceRiverBand((RIVER_WIDTH + RIVER_BANK * 2 + 96) / 2);
    ctx.fillStyle = '#2b4524';
    ctx.fill();

    traceRiverBand((RIVER_WIDTH + RIVER_BANK * 2 + 40) / 2);
    ctx.fillStyle = '#6f5a34';
    ctx.fill();

    traceRiverBand((RIVER_WIDTH + RIVER_BANK * 2 + 12) / 2);
    ctx.fillStyle = '#a17f4a';
    ctx.fill();

    traceRiverBand((RIVER_WIDTH + RIVER_BANK * 2) / 2);
    ctx.fillStyle = '#b89355';
    ctx.fill();

    traceRiverBand((RIVER_WIDTH + RIVER_BANK * 1.35) / 2);
    ctx.fillStyle = '#cdb079';
    ctx.fill();

    traceRiverBand((RIVER_WIDTH + RIVER_BANK * 0.78) / 2);
    ctx.fillStyle = '#dcc28b';
    ctx.fill();

    // Granulated sand over the whole beach band.
    const sandGrain = this.getSandGrainPattern(ctx);
    if (sandGrain) {
      traceRiverBand((RIVER_WIDTH + RIVER_BANK * 1.85) / 2);
      ctx.fillStyle = sandGrain;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Muddy margins oozing from the water onto the beach and forest floor.
    traceRiverMudBand(1);
    ctx.fillStyle = '#4a3322';
    ctx.fill();

    traceRiverMudBand(0.62);
    ctx.fillStyle = '#3a2718';
    ctx.fill();

    // Water surface: dark edge, base water, lighter current and shimmer.
    traceRiverBand(RIVER_WIDTH / 2);
    ctx.fillStyle = '#145466';
    ctx.fill();

    traceRiverBand((RIVER_WIDTH - 24) / 2);
    ctx.fillStyle = '#1b6b82';
    ctx.fill();

    traceRiverBand((RIVER_WIDTH - 170) / 2);
    ctx.fillStyle = '#2b8ba1';
    ctx.fill();

    const waterShimmer = this.getWaterShimmerPattern(ctx);
    if (waterShimmer) {
      traceRiverBand((RIVER_WIDTH - 30) / 2);
      ctx.fillStyle = waterShimmer;
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Two lakes, each with its own sand rim and water texture.
    for (let i = 0; i < this.lakes.length; i++) {
      const lake = this.lakes[i];
      const margin = Math.max(lake.rx, lake.ry) + RIVER_BANK + 80;
      if (!camera.isInView(lake.x, lake.y, margin)) continue;

      ctx.save();
      ctx.translate(lake.x, lake.y);
      ctx.rotate(lake.rotation);

      ctx.fillStyle = '#2b4524';
      ctx.beginPath();
      this.traceLakeShape(
        ctx,
        lake,
        lake.rx + RIVER_BANK + 44,
        lake.ry + RIVER_BANK * 0.85 + 36
      );
      ctx.fill();

      ctx.fillStyle = '#6f5a34';
      ctx.beginPath();
      this.traceLakeShape(
        ctx,
        lake,
        lake.rx + RIVER_BANK + 18,
        lake.ry + RIVER_BANK * 0.85 + 14
      );
      ctx.fill();

      ctx.fillStyle = '#b89355';
      ctx.beginPath();
      this.traceLakeShape(
        ctx,
        lake,
        lake.rx + RIVER_BANK,
        lake.ry + RIVER_BANK * 0.85
      );
      ctx.fill();

      ctx.fillStyle = '#cdb079';
      ctx.beginPath();
      this.traceLakeShape(
        ctx,
        lake,
        lake.rx + RIVER_BANK * 0.62,
        lake.ry + RIVER_BANK * 0.54
      );
      ctx.fill();

      ctx.fillStyle = '#dcc28b';
      ctx.beginPath();
      this.traceLakeShape(
        ctx,
        lake,
        lake.rx + RIVER_BANK * 0.3,
        lake.ry + RIVER_BANK * 0.26
      );
      ctx.fill();

      if (sandGrain) {
        ctx.fillStyle = sandGrain;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        this.traceLakeShape(
          ctx,
          lake,
          lake.rx + RIVER_BANK * 0.85,
          lake.ry + RIVER_BANK * 0.72
        );
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Muddy lakeshore ring before the water covers its inner edge.
      ctx.fillStyle = '#4a3322';
      ctx.beginPath();
      this.traceLakeShape(ctx, lake, lake.rx + MUD_BAND, lake.ry + MUD_BAND);
      ctx.fill();

      ctx.fillStyle = '#3a2718';
      ctx.beginPath();
      this.traceLakeShape(
        ctx,
        lake,
        lake.rx + MUD_BAND * 0.62,
        lake.ry + MUD_BAND * 0.62
      );
      ctx.fill();

      ctx.fillStyle = '#145466';
      ctx.beginPath();
      this.traceLakeShape(ctx, lake, lake.rx, lake.ry);
      ctx.fill();

      ctx.fillStyle = '#1b6b82';
      ctx.beginPath();
      this.traceLakeShape(ctx, lake, lake.rx - 10, lake.ry - 8);
      ctx.fill();

      ctx.fillStyle = '#2b8ba1';
      ctx.beginPath();
      this.traceLakeShape(ctx, lake, lake.rx * 0.82, lake.ry * 0.82);
      ctx.fill();

      if (waterShimmer) {
        ctx.fillStyle = waterShimmer;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        this.traceLakeShape(ctx, lake, lake.rx * 0.97, lake.ry * 0.96);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

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
    // Fixed grass tufts scattered across the dry forest floor.
    for (let i = 0; i < this.groundTufts.length; i++) {
      const tuft = this.groundTufts[i];
      if (!camera.isInView(tuft.x, tuft.y, tuft.size * 2 + 8)) continue;

      const screen = camera.worldToScreen(tuft.x, tuft.y);
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(tuft.rotation);

      // Dark base blade gives the tuft a little 2.5D volume.
      ctx.strokeStyle = 'rgba(10, 30, 16, 0.65)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-1, 1);
      ctx.lineTo(-1.5, -tuft.size);
      ctx.stroke();

      const blades = tuft.tone > 0.5 ? 3 : 4;
      for (let b = 0; b < blades; b++) {
        const spread = (b - (blades - 1) / 2) * (tuft.size * 0.32);
        const height = tuft.size * (0.75 + (b % 2) * 0.3);
        ctx.strokeStyle =
          tuft.tone > 0.55
            ? b % 2 === 0
              ? '#2f7d3a'
              : '#3f9a48'
            : b % 2 === 0
              ? '#276b33'
              : '#357f3d';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(spread * 0.5, -height * 0.6, spread, -height);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.restore();
    }

    // Small stones resting on the river margin.
    for (let i = 0; i < this.beachStones.length; i++) {
      const stone = this.beachStones[i];
      if (!camera.isInView(stone.x, stone.y, stone.size + 12)) continue;

      const screen = camera.worldToScreen(stone.x, stone.y);
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(stone.rotation);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.ellipse(0, stone.size * 0.35, stone.size * 1.15, stone.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = stone.tone > 0.5 ? '#7d7f74' : '#65685d';
      ctx.beginPath();
      ctx.ellipse(0, 0, stone.size, stone.size * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(222, 219, 196, 0.45)';
      ctx.beginPath();
      ctx.ellipse(
        -stone.size * 0.22,
        -stone.size * 0.2,
        stone.size * 0.45,
        stone.size * 0.26,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.restore();
    }

    // Dry branches and twigs washed up beside the sand.
    for (let i = 0; i < this.beachBranches.length; i++) {
      const branch = this.beachBranches[i];
      if (!camera.isInView(branch.x, branch.y, branch.length + 8)) continue;

      const screen = camera.worldToScreen(branch.x, branch.y);
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(branch.angle);

      const half = branch.length / 2;
      ctx.strokeStyle = branch.tone > 0.5 ? '#5b4228' : '#6b4f2e';
      ctx.lineWidth = Math.max(1, branch.length * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-half, 0);
      ctx.quadraticCurveTo(0, -branch.length * 0.12, half, 0);
      ctx.stroke();

      // A short side twig.
      ctx.lineWidth = Math.max(1, branch.length * 0.06);
      ctx.beginPath();
      ctx.moveTo(branch.length * 0.05, 0);
      ctx.lineTo(branch.length * 0.2, -branch.length * 0.22);
      ctx.stroke();
      ctx.lineCap = 'butt';

      ctx.restore();
    }

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

  /**
   * Draws the fixed decorative canopy trees. Trees with someone behind them are
   * drawn without their canopy here; the translucent canopy is then painted by
   * renderDecorCanopyOverlay on top of the characters.
   */
  public renderDecorTrees(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    player: CanopyEntity,
    enemies: ReadonlyArray<CanopyEntity>
  ): void {
    if (this.mapId !== 'amazon_forest') return;

    for (let i = 0; i < this.decorTrees.length; i++) {
      const tree = this.decorTrees[i];
      const metrics = this.getDecorTreeMetrics(tree);
      if (!camera.isInView(tree.x, tree.y, metrics.margin)) continue;

      const screen = camera.worldToScreen(tree.x, tree.y);
      const behind = this.isAnyEntityBehindDecorCanopy(tree, metrics, player, enemies);
      ctx.save();
      ctx.translate(screen.x, screen.y);
      this.drawDecorTreeShadow(ctx, tree, metrics);
      this.drawDecorTreeTrunk(ctx, tree, metrics);
      if (!behind) this.drawDecorTreeCanopy(ctx, tree, metrics, 1);
      ctx.restore();
    }
  }

  /**
   * Re-draws the canopy of every decorative tree that the hero or an animal is
   * standing behind. At 30% opacity the leaves still sell the depth without
   * hiding the combat underneath.
   */
  public renderDecorCanopyOverlay(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    player: CanopyEntity,
    enemies: ReadonlyArray<CanopyEntity>
  ): void {
    if (this.mapId !== 'amazon_forest') return;

    for (let i = 0; i < this.decorTrees.length; i++) {
      const tree = this.decorTrees[i];
      const metrics = this.getDecorTreeMetrics(tree);
      if (!camera.isInView(tree.x, tree.y, metrics.margin)) continue;
      if (!this.isAnyEntityBehindDecorCanopy(tree, metrics, player, enemies)) continue;

      const screen = camera.worldToScreen(tree.x, tree.y);
      ctx.save();
      ctx.translate(screen.x, screen.y);
      this.drawDecorTreeCanopy(ctx, tree, metrics, 0.3);
      ctx.restore();
    }
  }

  private isAnyEntityBehindDecorCanopy(
    tree: DecorTreeProp,
    metrics: DecorTreeMetrics,
    player: CanopyEntity,
    enemies: ReadonlyArray<CanopyEntity>
  ): boolean {
    if (this.isBehindDecorCanopy(tree, metrics, player)) return true;
    for (let e = 0; e < enemies.length; e++) {
      if (this.isBehindDecorCanopy(tree, metrics, enemies[e])) return true;
    }
    return false;
  }

  private isBehindDecorCanopy(
    tree: DecorTreeProp,
    metrics: DecorTreeMetrics,
    entity: CanopyEntity
  ): boolean {
    if (entity.y >= tree.y) return false;

    const dx = Math.abs(entity.x - tree.x);
    if (dx > metrics.canopyRx + entity.radius) return false;

    const canopyCenterY = tree.y + metrics.canopyY;
    const top = canopyCenterY - metrics.canopyRy - entity.radius;
    const bottom = canopyCenterY + metrics.canopyRy + entity.radius;
    return entity.y >= top && entity.y <= bottom;
  }

  private drawDecorTreeShadow(
    ctx: CanvasRenderingContext2D,
    tree: DecorTreeProp,
    metrics: DecorTreeMetrics
  ): void {
    const hw = metrics.trunkHalfWidth;
    ctx.fillStyle = 'rgba(3, 8, 5, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 3, hw * (tree.kind === 'samauma' ? 4.2 : 3.5), hw * 1.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(2, 5, 3, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 1, hw * 2.35, hw * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDecorTreeTrunk(
    ctx: CanvasRenderingContext2D,
    tree: DecorTreeProp,
    metrics: DecorTreeMetrics
  ): void {
    if (tree.kind === 'palmeira') {
      this.drawPalmTrunk(ctx, tree, metrics);
    } else {
      this.drawBroadleafTrunk(ctx, tree, metrics);
    }
  }

  private drawBroadleafTrunk(
    ctx: CanvasRenderingContext2D,
    tree: DecorTreeProp,
    metrics: DecorTreeMetrics
  ): void {
    const height = metrics.trunkHeight;
    const hw = metrics.trunkHalfWidth;
    const outline = '#170f08';
    const bark = tree.tone > 0.5 ? '#68482a' : '#5a3c23';
    const light = tree.tone > 0.5 ? '#8f6538' : '#7d5732';
    const shade = '#35230f';

    // Buttress / surface roots over the oval shadow.
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.8, -height * 0.04);
    ctx.quadraticCurveTo(-hw * 1.8, -2, -hw * 2.9, hw * 0.6);
    ctx.lineTo(-hw * 1.0, hw * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hw * 0.8, -height * 0.04);
    ctx.quadraticCurveTo(hw * 1.8, -2, hw * 2.9, hw * 0.6);
    ctx.lineTo(hw * 1.0, hw * 0.55);
    ctx.closePath();
    ctx.fill();

    // Tapered pixel-art trunk silhouette.
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.moveTo(-hw * 1.25, 1);
    ctx.lineTo(-hw * 0.68, -height);
    ctx.lineTo(hw * 0.68, -height);
    ctx.lineTo(hw * 1.25, 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = bark;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.92, 0);
    ctx.lineTo(-hw * 0.42, -height + 1);
    ctx.lineTo(hw * 0.42, -height + 1);
    ctx.lineTo(hw * 0.92, 0);
    ctx.closePath();
    ctx.fill();

    // Sunlit bark strip and dark grooves.
    ctx.fillStyle = light;
    ctx.fillRect(-hw * 0.8, -height * 0.82, Math.max(1, hw * 0.3), height * 0.78);
    ctx.strokeStyle = shade;
    ctx.lineWidth = Math.max(1, tree.scale);
    for (let i = 0; i < 4; i++) {
      const offset = (i - 1.5) * hw * 0.32;
      ctx.beginPath();
      ctx.moveTo(offset, -height * 0.08);
      ctx.quadraticCurveTo(offset + hw * 0.25, -height * 0.5, offset, -height * 0.94);
      ctx.stroke();
    }

    if (tree.kind === 'samauma') {
      // Broken limbs make the giant trunk silhouette less uniform.
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.2, hw * 0.18);
      ctx.beginPath();
      ctx.moveTo(-hw * 0.4, -height * 0.62);
      ctx.lineTo(-hw * 1.5, -height * 0.76);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hw * 0.35, -height * 0.78);
      ctx.lineTo(hw * 1.35, -height * 0.9);
      ctx.stroke();
    }
  }

  private drawPalmTrunk(
    ctx: CanvasRenderingContext2D,
    tree: DecorTreeProp,
    metrics: DecorTreeMetrics
  ): void {
    const height = metrics.trunkHeight;
    const hw = metrics.trunkHalfWidth;
    const lean = metrics.canopyX * 0.5;
    const outline = '#17130c';
    const bark = tree.tone > 0.5 ? '#9c8a68' : '#8c7b5d';
    const light = '#c3b494';
    const ring = '#5c4e38';

    ctx.lineCap = 'round';
    ctx.strokeStyle = outline;
    ctx.lineWidth = hw * 2.8;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.quadraticCurveTo(lean * 0.55, -height * 0.55, metrics.canopyX, -height);
    ctx.stroke();

    ctx.strokeStyle = bark;
    ctx.lineWidth = hw * 1.9;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.quadraticCurveTo(lean * 0.55, -height * 0.55, metrics.canopyX, -height);
    ctx.stroke();

    // Segmented rings along the curved trunk.
    ctx.strokeStyle = ring;
    ctx.lineWidth = Math.max(1, hw * 0.4);
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      const u = 1 - t;
      const x = 2 * u * t * lean * 0.55 + t * t * metrics.canopyX;
      const y = u * u * 2 + 2 * u * t * (-height * 0.55) + t * t * (-height);
      const width = hw * (1.1 + Math.sin(Math.PI * t) * 0.25);
      ctx.beginPath();
      ctx.moveTo(x - width, y);
      ctx.lineTo(x + width, y);
      ctx.stroke();
    }

    // Slim lit edge.
    ctx.strokeStyle = light;
    ctx.lineWidth = Math.max(1, hw * 0.45);
    ctx.beginPath();
    ctx.moveTo(-hw * 0.5, -height * 0.15);
    ctx.quadraticCurveTo(
      lean * 0.55 - hw * 0.45,
      -height * 0.58,
      metrics.canopyX - hw * 0.5,
      -height * 0.96
    );
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  private drawDecorTreeCanopy(
    ctx: CanvasRenderingContext2D,
    tree: DecorTreeProp,
    metrics: DecorTreeMetrics,
    alpha: number
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (tree.kind === 'palmeira') {
      this.drawPalmCanopy(ctx, tree, metrics);
    } else {
      this.drawBroadleafCanopy(ctx, tree, metrics);
    }
    ctx.restore();
  }

  private drawBroadleafCanopy(
    ctx: CanvasRenderingContext2D,
    tree: DecorTreeProp,
    metrics: DecorTreeMetrics
  ): void {
    const cx = metrics.canopyX;
    const cy = metrics.canopyY;
    const rx = metrics.canopyRx;
    const ry = metrics.canopyRy;
    const giant = tree.kind === 'samauma';

    const blobs: [number, number, number, number][] = giant
      ? [
          [0, 0.05, 0.95, 0.78],
          [-0.62, 0.1, 0.56, 0.55],
          [0.62, 0.08, 0.58, 0.56],
          [-0.34, -0.5, 0.56, 0.48],
          [0.36, -0.48, 0.58, 0.5],
          [0, -0.18, 0.78, 0.6],
          [-0.5, 0.45, 0.42, 0.38],
          [0.52, 0.46, 0.44, 0.4],
          [0.02, 0.5, 0.52, 0.4],
        ]
      : [
          [0, 0, 0.9, 0.76],
          [-0.58, 0.08, 0.5, 0.48],
          [0.58, 0.06, 0.52, 0.5],
          [-0.3, -0.48, 0.52, 0.45],
          [0.32, -0.46, 0.54, 0.46],
          [0, 0.38, 0.56, 0.4],
          [0, -0.12, 0.68, 0.55],
        ];

    // Dark contour around the full crown.
    ctx.fillStyle = '#05180c';
    ctx.beginPath();
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      ctx.ellipse(
        cx + blob[0] * rx,
        cy + blob[1] * ry,
        blob[2] * rx + 1.5,
        blob[3] * ry + 1.5,
        0,
        0,
        Math.PI * 2
      );
    }
    ctx.fill();

    // Deep shadowed foliage.
    ctx.fillStyle = giant ? '#0b2c17' : '#0f3a20';
    ctx.beginPath();
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      ctx.ellipse(
        cx + blob[0] * rx,
        cy + blob[1] * ry,
        blob[2] * rx,
        blob[3] * ry,
        0,
        0,
        Math.PI * 2
      );
    }
    ctx.fill();

    // Mid-tone mass, nudged up-left to leave a shaded rim.
    ctx.fillStyle = tree.tone > 0.55 ? '#1d6a35' : '#185c2d';
    ctx.beginPath();
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      ctx.ellipse(
        cx + blob[0] * rx - rx * 0.03,
        cy + blob[1] * ry - ry * 0.05,
        blob[2] * rx * 0.84,
        blob[3] * ry * 0.84,
        0,
        0,
        Math.PI * 2
      );
    }
    ctx.fill();

    // Sunlit leaf clumps concentrated on the upper-left of the crown.
    const litBlobs: [number, number, number, number][] = giant
      ? [
          [-0.3, -0.28, 0.55, 0.44],
          [-0.62, 0.05, 0.3, 0.3],
          [0.05, -0.48, 0.42, 0.34],
          [-0.1, 0.2, 0.36, 0.3],
        ]
      : [
          [-0.25, -0.25, 0.48, 0.38],
          [-0.55, 0.06, 0.3, 0.3],
          [0.05, -0.44, 0.36, 0.3],
          [-0.05, 0.18, 0.3, 0.26],
        ];

    ctx.fillStyle = tree.tone > 0.5 ? '#359447' : '#2e8440';
    ctx.beginPath();
    for (let i = 0; i < litBlobs.length; i++) {
      const blob = litBlobs[i];
      ctx.ellipse(
        cx + blob[0] * rx,
        cy + blob[1] * ry,
        blob[2] * rx,
        blob[3] * ry,
        0,
        0,
        Math.PI * 2
      );
    }
    ctx.fill();

    ctx.fillStyle = '#55b45e';
    ctx.beginPath();
    for (let i = 0; i < litBlobs.length; i++) {
      const blob = litBlobs[i];
      ctx.ellipse(
        cx + blob[0] * rx - rx * 0.04,
        cy + blob[1] * ry - ry * 0.06,
        blob[2] * rx * 0.46,
        blob[3] * ry * 0.46,
        0,
        0,
        Math.PI * 2
      );
    }
    ctx.fill();

    if (tree.kind === 'samauma') {
      // Hanging vines dangle below the huge canopy.
      ctx.strokeStyle = 'rgba(38, 86, 39, 0.95)';
      ctx.lineWidth = Math.max(1, 1.2 * tree.scale);
      ctx.lineCap = 'round';
      for (let v = 0; v < 5; v++) {
        const vx = cx + (v - 2) * rx * 0.33;
        const startY = cy + ry * (0.32 + (v % 2) * 0.18);
        const length = ry * (0.65 + (v % 3) * 0.18);
        ctx.beginPath();
        ctx.moveTo(vx, startY);
        ctx.quadraticCurveTo(
          vx + 7 * tree.scale,
          startY + length * 0.5,
          vx - 5 * tree.scale,
          startY + length
        );
        ctx.stroke();

        ctx.fillStyle = '#2e7338';
        ctx.beginPath();
        ctx.ellipse(
          vx - 5 * tree.scale,
          startY + length,
          3.4 * tree.scale,
          1.6 * tree.scale,
          -0.45,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.lineCap = 'butt';
    }
  }

  private drawPalmCanopy(
    ctx: CanvasRenderingContext2D,
    tree: DecorTreeProp,
    metrics: DecorTreeMetrics
  ): void {
    const crownX = metrics.canopyX;
    const crownY = metrics.canopyY;
    const length = metrics.canopyRx * 1.25;
    const tint = tree.tone;

    const drawFronds = (fill: string, lengthScale: number, widthScale: number): void => {
      ctx.fillStyle = fill;
      for (let f = 0; f < 9; f++) {
        const angle = -Math.PI + (f / 8) * Math.PI + (tint - 0.5) * 0.34;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        const bladeLength = length * lengthScale * (0.82 + (f % 2) * 0.2);
        const tipX = crownX + dirX * bladeLength;
        const tipY = crownY + dirY * bladeLength * 0.58;
        const midX =
          crownX + dirX * bladeLength * 0.55 - dirY * bladeLength * 0.16 * widthScale;
        const midY =
          crownY + dirY * bladeLength * 0.55 + dirX * bladeLength * 0.16 * widthScale;
        const innerX = crownX + dirX * bladeLength * 0.4;
        const innerY = crownY + dirY * bladeLength * 0.24;

        ctx.beginPath();
        ctx.moveTo(crownX, crownY);
        ctx.quadraticCurveTo(midX, midY, tipX, tipY);
        ctx.quadraticCurveTo(innerX, innerY, crownX, crownY);
        ctx.fill();
      }
    };

    drawFronds('#061a0c', 1.08, 1.15);
    drawFronds(tree.tone > 0.5 ? '#14532d' : '#0f4a27', 1.0, 1.0);
    drawFronds(tree.tone > 0.5 ? '#2f8a45' : '#277a3d', 0.82, 0.7);

    // Crown knob and a small hanging fruit bunch.
    ctx.fillStyle = '#0d2a17';
    ctx.beginPath();
    ctx.ellipse(crownX, crownY + 3 * tree.scale, 6 * tree.scale, 3.5 * tree.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f7a35';
    ctx.beginPath();
    ctx.ellipse(
      crownX - 1.2 * tree.scale,
      crownY + 2.4 * tree.scale,
      3 * tree.scale,
      1.6 * tree.scale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = tree.tone > 0.5 ? '#b45309' : '#7c3a12';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(
        crownX + (i - 1.5) * 2.2 * tree.scale,
        crownY + (10 + (i % 2) * 2) * tree.scale,
        1.6 * tree.scale,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  renderTrees(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.mapId !== 'amazon_forest') return;

    this.renderAmazonDecorations(ctx, camera);

    const pixelRatio = Math.max(1, Math.abs(ctx.getTransform().a));
    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];
      if (!camera.isInView(tree.x, tree.y, tree.size + 30)) continue;

      const screen = camera.worldToScreen(tree.x, tree.y);
      const sprite = this.getTreeSprite(tree, pixelRatio);
      if (sprite) {
        const width = sprite.width / pixelRatio;
        const height = sprite.height / pixelRatio;
        ctx.drawImage(sprite, screen.x - width / 2,
          screen.y - Math.ceil(tree.size * 1.1 + 3), width, height);
      } else {
        ctx.save();
        ctx.translate(screen.x, screen.y);
        this.drawTree(ctx, tree);
        ctx.restore();
      }
    }
  }

  private getTreeSprite(tree: TreeProp, pixelRatio: number): HTMLCanvasElement | null {
    // Rebuild at the canvas resolution after moving between displays.
    if (pixelRatio !== this.treeSpriteScale) {
      for (const sprite of this.treeSprites.values()) sprite.width = sprite.height = 0;
      this.treeSprites.clear();
      this.treeSpriteBytes = 0;
      this.treeSpriteScale = pixelRatio;
    }
    const cached = this.treeSprites.get(tree);
    if (cached) {
      this.treeSprites.delete(tree);
      this.treeSprites.set(tree, cached);
      return cached;
    }
    const sprite = document.createElement('canvas');
    sprite.width = Math.ceil(Math.ceil(tree.size * 1.2 + 6) * pixelRatio);
    sprite.height = Math.ceil((Math.ceil(tree.size * 1.1 + 3) + Math.ceil(tree.size * 0.25 + 3)) * pixelRatio);
    const bytes = sprite.width * sprite.height * 4;
    if (bytes > this.treeSpriteBudget) return null;
    const context = sprite.getContext('2d');
    if (!context) return null;
    context.scale(pixelRatio, pixelRatio);
    context.translate(sprite.width / pixelRatio / 2, Math.ceil(tree.size * 1.1 + 3));
    this.drawTree(context, tree);
    while (this.treeSpriteBytes + bytes > this.treeSpriteBudget) {
      const oldest = this.treeSprites.keys().next().value;
      if (!oldest) break;
      const evicted = this.treeSprites.get(oldest)!;
      this.treeSpriteBytes -= evicted.width * evicted.height * 4;
      this.treeSprites.delete(oldest);
      evicted.width = evicted.height = 0;
    }
    this.treeSprites.set(tree, sprite);
    this.treeSpriteBytes += bytes;
    return sprite;
  }

  private drawTree(ctx: CanvasRenderingContext2D, tree: TreeProp): void {
    const size = tree.size;
    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 4, size * 0.55, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#4a2f1b';
    ctx.fillRect(-size * 0.08, -size * 0.5, size * 0.16, size * 0.6);

    // Surface roots crawling out over the forest floor.
    ctx.strokeStyle = tree.tone > 0.5 ? '#3f2a16' : '#4a2f1b';
    ctx.lineWidth = Math.max(1.5, size * 0.045);
    ctx.lineCap = 'round';
    for (let r = 0; r < 5; r++) {
      const spread = -1.15 + (r / 4) * 2.3;
      const length = size * (0.2 + (r % 2) * 0.08);
      ctx.beginPath();
      ctx.moveTo(0, size * 0.02);
      ctx.quadraticCurveTo(
        spread * length * 0.5,
        size * 0.075,
        spread * length,
        size * 0.12
      );
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

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
  }

  renderFruitTrees(ctx: CanvasRenderingContext2D, camera: Camera, player?: Player): void {
    if (this.mapId !== 'amazon_forest') return;

    const promptTree = player ? this.getInteractableFruitTree(player) : null;

    for (let i = 0; i < this.fruitTrees.length; i++) {
      const tree = this.fruitTrees[i];
      if (!tree.active) continue;
      if (!camera.isInView(tree.x, tree.y, tree.kind === 'castanha' ? 210 : 140)) continue;

      const screen = camera.worldToScreen(tree.x, tree.y);
      const sway = Math.sin(tree.animTimer) * 2;
      const acaiSprite = tree.kind === 'acai' ? this.getAcaiPixelSprite() : null;
      const cupuacuSprite =
        tree.kind === 'cupuacu' ? this.getCupuacuPixelSprite() : null;
      const castanhaSprite =
        tree.kind === 'castanha' ? this.getCastanhaPixelSprite() : null;
      const buritiSprite =
        tree.kind === 'buriti' ? this.getBuritiPixelSprite() : null;
      const pupunhaSprite =
        tree.kind === 'pupunha' ? this.getPupunhaPixelSprite() : null;
      const aracaSprite =
        tree.kind === 'araca' ? this.getAracaPixelSprite() : null;

      ctx.save();
      ctx.translate(screen.x, screen.y);

      if (
        !acaiSprite &&
        !cupuacuSprite &&
        !castanhaSprite &&
        !buritiSprite &&
        !pupunhaSprite &&
        !aracaSprite
      ) {
        // Shared ground shadow for the procedurally drawn trees.
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
      } else if (cupuacuSprite) {
        // Nearest-neighbour upscale keeps every pixel of the crafted sprite.
        const spriteWidth = CUPUACU_SPRITE_WIDTH * CUPUACU_SPRITE_SCALE;
        const spriteHeight = CUPUACU_SPRITE_HEIGHT * CUPUACU_SPRITE_SCALE;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          cupuacuSprite,
          -spriteWidth / 2,
          -spriteHeight,
          spriteWidth,
          spriteHeight
        );
        ctx.restore();
      } else if (castanhaSprite) {
        // Nearest-neighbour upscale keeps the crafted pixel-art grid crisp.
        const spriteWidth = CASTANHA_SPRITE_WIDTH * CASTANHA_SPRITE_SCALE;
        const spriteHeight = CASTANHA_SPRITE_HEIGHT * CASTANHA_SPRITE_SCALE;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          castanhaSprite,
          -spriteWidth / 2,
          -spriteHeight,
          spriteWidth,
          spriteHeight
        );
        ctx.restore();
      } else if (buritiSprite) {
        // Nearest-neighbour upscale keeps the hand-placed pixel-art grid crisp.
        const spriteWidth = BURITI_SPRITE_WIDTH * BURITI_SPRITE_SCALE;
        const spriteHeight = BURITI_SPRITE_HEIGHT * BURITI_SPRITE_SCALE;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          buritiSprite,
          -spriteWidth / 2,
          -spriteHeight,
          spriteWidth,
          spriteHeight
        );
        ctx.restore();
      } else if (pupunhaSprite) {
        // Nearest-neighbour upscale keeps the hand-placed pixel-art grid crisp.
        const spriteWidth = PUPUNHA_SPRITE_WIDTH * PUPUNHA_SPRITE_SCALE;
        const spriteHeight = PUPUNHA_SPRITE_HEIGHT * PUPUNHA_SPRITE_SCALE;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          pupunhaSprite,
          -spriteWidth / 2,
          -spriteHeight,
          spriteWidth,
          spriteHeight
        );
        ctx.restore();
      } else if (aracaSprite) {
        // Nearest-neighbour upscale keeps the hand-placed pixel-art grid crisp.
        const spriteWidth = ARACA_SPRITE_WIDTH * ARACA_SPRITE_SCALE;
        const spriteHeight = ARACA_SPRITE_HEIGHT * ARACA_SPRITE_SCALE;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          aracaSprite,
          -spriteWidth / 2,
          -spriteHeight,
          spriteWidth,
          spriteHeight
        );
        ctx.restore();
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

  /**
   * Low pixel-art thorn bushes: a dark green mound, twisted brown branches
   * with forks and pale spikes clearly poking out of the leaves.
   */
  public renderThornBushes(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.mapId !== 'amazon_forest') return;

    for (let i = 0; i < this.thornBushes.length; i++) {
      const bush = this.thornBushes[i];
      if (!camera.isInView(bush.x, bush.y, 64)) continue;

      const screen = camera.worldToScreen(bush.x, bush.y);
      const sway = Math.sin(bush.animTimer) * 1.2;

      ctx.save();
      ctx.translate(Math.round(screen.x), Math.round(screen.y));

      // Ground shadow.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 3, 20, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(sway, 0);

      // Layered low mound of leaves.
      ctx.fillStyle = '#1b3315';
      ctx.fillRect(-18, -5, 36, 8);
      ctx.fillRect(-15, -9, 30, 5);
      ctx.fillRect(-10, -13, 20, 5);

      // Twisted branches.
      ctx.strokeStyle = '#4a2f18';
      ctx.lineWidth = 3;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(-16, -1);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-3, -6);
      ctx.lineTo(4, -17);
      ctx.lineTo(10, -8);
      ctx.lineTo(17, -13);
      ctx.stroke();

      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, -11);
      ctx.lineTo(-14, -18);
      ctx.moveTo(4, -17);
      ctx.lineTo(1, -23);
      ctx.moveTo(10, -8);
      ctx.lineTo(14, -4);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Leaf clusters along the branches.
      ctx.fillStyle = '#2d541b';
      ctx.fillRect(-16, -7, 11, 4);
      ctx.fillRect(3, -10, 13, 4);
      ctx.fillRect(-7, -15, 13, 4);
      ctx.fillStyle = '#457a25';
      ctx.fillRect(-13, -11, 7, 3);
      ctx.fillRect(6, -6, 9, 3);
      ctx.fillRect(-2, -16, 6, 3);
      ctx.fillRect(-15, -19, 5, 4);
      ctx.fillRect(0, -22, 5, 4);
      ctx.fillRect(13, -16, 5, 4);

      // Pale thorns poking out in every direction.
      ctx.fillStyle = '#e7e5e4';
      const drawThorn = (x: number, y: number, dirX: number, dirY: number): void => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dirX * 2, y + dirY * 6);
        ctx.lineTo(x + dirX * 4, y);
        ctx.closePath();
        ctx.fill();
      };
      drawThorn(-13, -9, -1, -1);
      drawThorn(-6, -8, 1, -1);
      drawThorn(2, -14, -1, -1);
      drawThorn(7, -11, 1, 0);
      drawThorn(-15, -18, -1, -1);
      drawThorn(2, -21, 0, -1);
      drawThorn(14, -15, 1, -1);
      drawThorn(15, -4, 1, 0);

      ctx.restore();
    }
  }

  /**
   * Small creeping São-Caetano herbs with jagged leaves and open yellow
   * fruits. A floating prompt appears when the hero stands close enough.
   */
  public renderHerbs(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    player?: Player
  ): void {
    if (this.mapId !== 'amazon_forest') return;

    const promptHerb = player ? this.getInteractableHerb(player) : null;

    for (let i = 0; i < this.herbs.length; i++) {
      const herb = this.herbs[i];
      if (!herb.active) continue;
      if (!camera.isInView(herb.x, herb.y, 60)) continue;

      const screen = camera.worldToScreen(herb.x, herb.y);
      const sway = Math.sin(herb.animTimer) * 1;

      ctx.save();
      ctx.translate(Math.round(screen.x), Math.round(screen.y));

      // Soft ground shadow and a faint medicinal glow.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
      ctx.beginPath();
      ctx.ellipse(0, 3, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(190, 242, 100, 0.12)';
      ctx.beginPath();
      ctx.ellipse(0, -4, 17, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(sway, 0);

      // Creeping stems.
      ctx.strokeStyle = '#3f6212';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, 1);
      ctx.quadraticCurveTo(-14, -3, -17, -6);
      ctx.moveTo(10, 1);
      ctx.quadraticCurveTo(14, -4, 17, -7);
      ctx.moveTo(-6, 0);
      ctx.quadraticCurveTo(-8, -7, -10, -10);
      ctx.moveTo(6, 0);
      ctx.quadraticCurveTo(8, -8, 10, -11);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Jagged (serrated) pixel leaves.
      const drawLeaf = (
        x: number,
        y: number,
        angle: number,
        length: number,
        color: string
      ): void => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(length * 0.22, -2);
        ctx.lineTo(length * 0.38, 0);
        ctx.lineTo(length * 0.56, -2);
        ctx.lineTo(length * 0.72, 0);
        ctx.lineTo(length, 1);
        ctx.lineTo(length * 0.7, 2.4);
        ctx.lineTo(length * 0.46, 1.2);
        ctx.lineTo(length * 0.2, 2.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      drawLeaf(-12, -4, -2.7, 10, '#4d7c0f');
      drawLeaf(-8, -6, -2.1, 11, '#65a30d');
      drawLeaf(-2, -8, -1.5, 10, '#4d7c0f');
      drawLeaf(3, -9, -0.7, 11, '#65a30d');
      drawLeaf(9, -6, 0.1, 10, '#4d7c0f');
      drawLeaf(13, -3, 0.6, 9, '#65a30d');

      // Open yellow fruits at the tips.
      const drawOpenFruit = (x: number, y: number): void => {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(x - 1.5, y, 2.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 2, y + 1, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(Math.round(x - 2), Math.round(y - 1), 1, 1);
        ctx.fillRect(Math.round(x + 2), Math.round(y), 1, 1);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(Math.round(x), Math.round(y + 2), 1, 1);
      };
      drawOpenFruit(-17, -7);
      drawOpenFruit(17, -8);
      drawOpenFruit(-10, -11);
      drawOpenFruit(10, -12);

      ctx.restore();

      if (herb === promptHerb) {
        this.renderHerbPrompt(
          ctx,
          screen.x,
          screen.y + this.getHerbPromptOffsetY(herb)
        );
      }
    }
  }

  private renderHerbPrompt(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
  ): void {
    const halfWidth = HERB_PROMPT_WIDTH / 2;
    const halfHeight = HERB_PROMPT_HEIGHT / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(8, 15, 10, 0.88)';
    ctx.fillRect(x - halfWidth, y - halfHeight, HERB_PROMPT_WIDTH, HERB_PROMPT_HEIGHT);

    ctx.strokeStyle = 'rgba(190, 242, 100, 0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      x - halfWidth + 0.5,
      y - halfHeight + 0.5,
      HERB_PROMPT_WIDTH - 1,
      HERB_PROMPT_HEIGHT - 1
    );

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#f7fee7';
    ctx.fillText('[E] Coletar Erva de São-Caetano', x, y - 8);

    ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#bef264';
    ctx.fillText('Remove Lentidão e Sangramento', x, y + 10);
    ctx.restore();
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
    ctx.fillText(`[E] Coletar ${FRUIT_TREE_NAMES[kind]}`, x, y - 8);

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
