// Deliberately independent of the gorilla's tuning: future changes are boss-specific.
export const ANACONDA = {
  x: -4000, y: -3600, hp: 16000, damage: 60, radius: 95, speed: 78,
  bite: { range: 357.5, speed: 988.28125, radius: 62.5, warning: 0.75 / 1.4375, cooldown: 1.8 },
  dive: { cooldown: 2.25, warning: 0.7, duration: 5, surfacing: 0.5, radius: 700, damage: 20, stun: 0.3, emergeRadius: 500, emergeDamage: 50 },
  slam: { radius: 185 * Math.SQRT2, warning: 0.85 / 1.4375, cooldown: 3.75, recovery: 0.4 / 1.4375 },
  acid: { warning: 1, duration: 5, radius: 500, cooldown: 15, heal: 0.2, damage: 0.5, poisonDuration: 2 },
};
