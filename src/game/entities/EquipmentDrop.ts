import { EquipmentItem } from '../types';
import { Drop } from './Drops';
import { Player } from './Player';
import { Camera } from '../engine/Camera';
import { equipmentArtwork } from '../data/inventory';

/** A physical reward: proximity attracts it, global XP/coin magnets do not. */
export class EquipmentDrop extends Drop {
  private readonly image = new Image();
  constructor(id: number, x: number, y: number, public readonly item: EquipmentItem) {
    super(id, 'chest', x, y);
    this.image.src = equipmentArtwork(item.id) ?? '';
  }
  override update(dt: number, player: Player): boolean {
    this.isBeingMagnetPulled = false;
    return super.update(dt, player);
  }
  override render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!camera.isInView(this.x, this.y, 80)) return;
    const p = camera.worldToScreen(this.x, this.y), bob = Math.sin(this.animTimer) * 3;
    ctx.save(); ctx.fillStyle = '#10382a'; ctx.strokeStyle = '#bef264'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(p.x - 22, p.y - 24 + bob, 44, 48, 8); ctx.fill(); ctx.stroke();
    if (this.image.complete && this.image.naturalWidth) ctx.drawImage(this.image, p.x - 18, p.y - 20 + bob, 36, 40);
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ecfccb';
    ctx.strokeStyle = '#052e16'; ctx.lineWidth = 3;
    ctx.strokeText(this.item.name, p.x, p.y - 34); ctx.fillText(this.item.name, p.x, p.y - 34); ctx.restore();
  }
}
