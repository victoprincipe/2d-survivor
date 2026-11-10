import { Enemy } from './Enemy';
import { Player } from './Player';

/** Shared simulation helpers for optional, exclusive boss encounters. */
export class ChallengeBoss extends Enemy {
  protected updateAnchored(dt: number, player: Player, separation: { vx: number; vy: number }): boolean {
    const { x, y, skillCooldown } = this;
    this.skillCooldown = Number.MAX_SAFE_INTEGER;
    const alive = super.update(dt, player, separation);
    this.skillCooldown = skillCooldown;
    this.x = x;
    this.y = y;
    return alive;
  }
}

export function sweptCircleHits(target: { x: number; y: number; radius: number },
  from: { x: number; y: number }, to: { x: number; y: number }, radius: number): boolean {
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = dx * dx + dy * dy;
  const t = length > 0 ? Math.max(0, Math.min(1, ((target.x - from.x) * dx + (target.y - from.y) * dy) / length)) : 0;
  return Math.hypot(target.x - from.x - t * dx, target.y - from.y - t * dy) < target.radius + radius;
}
