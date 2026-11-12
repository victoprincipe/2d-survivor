// Kopenawa is the cave guardian turned into an active arena boss. His arena
// reuses the gorilla plateau's diameter so the fight keeps the same footprint.
export const KOPENAWAS = {
  triggerRadius: 300,
  arenaRadius: 600,
  hp: 12000,
  speed: 94,
  damage: 34,
  radius: 24,
  xpValue: 600,
  breath: {
    cooldown: 5.2,
    warning: 0.7,
    duration: 0.9,
    range: 460,
    halfAngle: Math.PI / 7,
    damageMultiplier: 0.8,
    transeDuration: 3.5,
  },
  spiritBolt: {
    initialCooldown: 2.4,
    cooldown: 4.6,
    speed: 265,
    radius: 12,
    life: 4.5,
    damageMultiplier: 0.6,
    confusionDuration: 4,
  },
  smoke: {
    threshold: 0.5,
    invulnerable: 1,
    cloneCount: 2,
    cloneRadius: 20,
  },
  entrance: {
    slamWindup: 0.6,
    slamRecovery: 0.35,
  },
} as const;
