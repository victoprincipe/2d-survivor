import { Camera } from '../engine/Camera';

type Point = { x: number; y: number };
const IMAGE_WIDTH = 1655;
const IMAGE_HEIGHT = 950;
// Native scale keeps corridors proportionate to the hero's collision radius.
const toWorld = ([x, y]: readonly number[]): Point => ({ x: x - IMAGE_WIDTH / 2, y: y - IMAGE_HEIGHT / 2 });
// Trace of the user's red outline in the 1655 × 950 reference image.
// The lower edge closes along the image boundary; water and other ledges are excluded.
const WALKABLE = [
  [35, 942], [180, 860], [285, 811], [395, 758], [444, 723],
  [522, 697], [588, 655], [633, 624], [657, 592], [685, 540],
  [635, 559], [600, 568], [578, 577], [585, 548], [585, 537],
  [545, 518], [603, 514], [630, 501], [659, 479], [680, 476],
  [716, 494], [751, 494], [839, 459], [894, 452], [960, 452],
  [991, 440], [1058, 438], [1083, 456], [1148, 455], [1167, 459],
  [1178, 479], [1267, 480], [1298, 498], [1294, 554], [1301, 580],
  [1303, 641], [1283, 631], [1284, 645], [1299, 680], [1271, 693],
  [1261, 705], [1263, 716], [1279, 730], [1265, 739], [1206, 756],
  [1177, 776], [1104, 783], [1078, 793], [1041, 824], [1015, 829],
  [980, 829], [928, 819], [842, 812], [841, 765], [809, 745],
  [799, 747], [789, 757], [789, 770], [780, 778], [752, 782],
  [714, 805], [685, 814], [684, 828], [700, 853], [694, 858],
  [668, 853], [649, 855], [634, 869], [614, 864], [586, 852],
  [495, 852], [487, 884], [477, 901], [450, 920], [430, 950], [35, 950],
].map(toWorld);
const EXIT = toWorld([310, 870]);
const SPAWN = toWorld([355, 835]);
const REWARD = toWorld([980, 635]);

/** Small sheltered room; outdoor simulation waits while the hero explores it. */
export class CaveInterior {
  private readonly bow = new Image();
  private readonly background = new Image();

  constructor() {
    this.bow.src = '/sprites/equipment/guardian-bow.svg';
    this.background.src = '/sprites/forest-cave/interior-clean.png';
  }

  readonly spawn = SPAWN;

  nearExit(p: Point): boolean { return Math.hypot(p.x - EXIT.x, p.y - EXIT.y) < 35; }
  nearReward(p: Point): boolean { return Math.hypot(p.x - REWARD.x, p.y - REWARD.y) < 55; }

  updateCamera(camera: Camera, player: Point): void {
    const limitX = Math.max(0, (IMAGE_WIDTH - camera.viewportWidth) / 2);
    const limitY = Math.max(0, (IMAGE_HEIGHT - camera.viewportHeight) / 2);
    camera.x = Math.max(-limitX, Math.min(limitX, player.x));
    camera.y = Math.max(-limitY, Math.min(limitY, player.y));
    camera.shakeOffsetX = 0;
    camera.shakeOffsetY = 0;
  }

  private canStand(x: number, y: number, radius: number): boolean {
    let inside = false;
    for (let i = 0, j = WALKABLE.length - 1; i < WALKABLE.length; j = i++) {
      const a = WALKABLE[j], b = WALKABLE[i];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
      if ((x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2 < radius ** 2) return false;
    }
    return inside;
  }

  resolveMovement(fromX: number, fromY: number, dx: number, dy: number, radius: number): Point {
    // Small steps prevent dashes from crossing concave edges or narrow gaps.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
    // Recover stale/outside positions instead of trapping the hero at an edge.
    const validStart = this.canStand(fromX, fromY, radius);
    let x = validStart ? fromX : this.spawn.x;
    let y = validStart ? fromY : this.spawn.y;
    for (let i = 0; i < steps; i++) {
      const nextX = x + dx / steps, nextY = y + dy / steps;
      if (this.canStand(nextX, nextY, radius)) { x = nextX; y = nextY; }
      else {
        if (this.canStand(nextX, y, radius)) x = nextX;
        if (this.canStand(x, nextY, radius)) y = nextY;
      }
    }
    return { x, y };
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera, player: { x: number; y: number }, unlocked: boolean, opened: boolean): void {
    ctx.save();
    ctx.fillStyle = '#090c10'; ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);
    const origin = camera.worldToScreen(0, 0);
    ctx.translate(origin.x, origin.y);
    if (this.background.complete && this.background.naturalWidth > 0) {
      // Preserve the supplied artwork's aspect ratio in world space.
      const width = IMAGE_WIDTH;
      const height = width * this.background.naturalHeight / this.background.naturalWidth;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.background, -width / 2, -IMAGE_HEIGHT / 2, width, height);
    } else {
      // Keep the room legible while the image loads or if it is unavailable.
      ctx.fillStyle = '#353b40'; ctx.beginPath();
      WALKABLE.forEach((point, index) => { if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); });
      ctx.closePath(); ctx.fill();
    }
    ctx.save(); ctx.translate(EXIT.x, EXIT.y);
    ctx.fillStyle = '#526d51'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 12, -0.45, 0, Math.PI * 2); ctx.fill();
    if (this.nearExit(player)) {
      ctx.fillStyle = 'rgba(9, 18, 22, 0.9)';
      ctx.beginPath(); ctx.roundRect(-90, -51, 180, 30, 7); ctx.fill();
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#fde68a';
      ctx.fillText('[E] Sair da caverna', 0, -31);
    }
    ctx.restore();
    // Reuse the reward artwork, anchored on the accessible main platform.
    ctx.save(); ctx.translate(REWARD.x, REWARD.y + 100);
    if (unlocked && !opened) {
      const glow = ctx.createRadialGradient(0, -100, 5, 0, -100, 80);
      glow.addColorStop(0, '#fbbf2470'); glow.addColorStop(1, '#fbbf2400');
      ctx.fillStyle = glow; ctx.fillRect(-80, -180, 160, 160);
    }
    // Low, irregular limestone outcrop with cool facets and sparse moss.
    ctx.fillStyle = 'rgba(5, 15, 18, 0.4)';
    ctx.beginPath(); ctx.ellipse(3, -84, 43, 13, -0.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#283b3e';
    ctx.beginPath(); ctx.moveTo(-39, -96); ctx.lineTo(-28, -123);
    ctx.lineTo(-9, -132); ctx.lineTo(22, -128); ctx.lineTo(36, -111);
    ctx.lineTo(40, -90); ctx.lineTo(16, -81); ctx.lineTo(-19, -84); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#52605a';
    ctx.beginPath(); ctx.moveTo(-28, -123); ctx.lineTo(-9, -132); ctx.lineTo(22, -128);
    ctx.lineTo(31, -113); ctx.lineTo(3, -109); ctx.lineTo(-31, -111); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3b4c48';
    ctx.beginPath(); ctx.moveTo(-39, -96); ctx.lineTo(-31, -111); ctx.lineTo(3, -109);
    ctx.lineTo(-4, -86); ctx.lineTo(-19, -84); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#213438'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(17, -126); ctx.lineTo(10, -116); ctx.lineTo(15, -109);
    ctx.moveTo(3, -109); ctx.lineTo(7, -96); ctx.lineTo(0, -87); ctx.stroke();
    ctx.fillStyle = '#526044';
    ctx.beginPath(); ctx.moveTo(-29, -121); ctx.lineTo(-16, -127); ctx.lineTo(-5, -124);
    ctx.lineTo(-14, -119); ctx.lineTo(-24, -116); ctx.closePath(); ctx.fill();
    if (unlocked && !opened) {
      if (this.bow.complete && this.bow.naturalWidth > 0) {
        ctx.drawImage(this.bow, -24, -211, 48, 85);
      } else {
        ctx.strokeStyle = '#c8aa74'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(-12, -130); ctx.quadraticCurveTo(40, -168, 12, -200); ctx.stroke();
        ctx.lineWidth = 1; ctx.lineTo(-12, -130); ctx.stroke();
      }
    }
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fde68a';
    ctx.font = '13px sans-serif';
    if (this.nearReward(player)) {
      ctx.font = '12px sans-serif';
      ctx.fillText(opened ? 'Arco já resgatado' : unlocked ? '[E] Resgatar Arco do Guardião' : 'Conclua o quiz do velho', 0, -55);
    }
    ctx.restore();
    ctx.restore();
  }
}
