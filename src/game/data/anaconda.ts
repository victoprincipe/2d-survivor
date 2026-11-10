// Deliberately independent of the gorilla's tuning: future changes are boss-specific.
export const ANACONDA = {
  x: -4000, y: -3600, hp: 16000, damage: 60, radius: 95, speed: 78,
  bite: { range: 715, speed: 988.28125, radius: 62.5, warning: 0.75 / 1.4375, cooldown: 1.8 },
  leap: { cooldown: 2.25, count: 3, warning: 0.65 / 1.4375, flight: 0.7 / 1.4375, height: 180, radius: 95, stun: 1, range: 800 },
  slam: { radius: 185 * Math.SQRT2, warning: 0.85 / 1.4375, cooldown: 3.75, recovery: 0.4 / 1.4375 },
  acid: { warning: 1, duration: 5, radius: 500, cooldown: 15, heal: 0.2, damage: 0.5, poisonDuration: 2 },
};
