import { Enemy } from './Enemy';

/**
 * Filhote de Jacaré-açu. It has its own identity and growth mechanic, keeping
 * the adult ('elite_black_caiman') stats, spawn pool and elite behaviour intact.
 */
export class BabyCaiman extends Enemy {
  constructor(id: number, x: number, y: number, hpMultiplier: number = 1.0) {
    super(id, 'baby_black_caiman', x, y, hpMultiplier);
  }
}
