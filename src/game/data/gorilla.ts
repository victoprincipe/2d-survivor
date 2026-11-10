// Original charge: 275 units/s for 0.65s (178.75 units).
// +100% speed and +300% reach: double speed and duration for four times the reach.
export const GORILLA_SKILL_SPEED = 1.25 * 1.15;

export const GORILLA_CHARGE = {
  speed: 550 * GORILLA_SKILL_SPEED * 1.25,
  duration: 1.3 / GORILLA_SKILL_SPEED / 1.25,
  widthMultiplier: 1.25,
  cooldown: 1.8,
};

export const GORILLA_LEAP = {
  cooldown: 2.25,
  jumpsPerCombo: 3,
  warning: 0.65 / GORILLA_SKILL_SPEED,
  flight: 0.7 / GORILLA_SKILL_SPEED,
  height: 180,
  radius: 95,
  stun: 1,
  range: 800,
};

export const GORILLA_SLAM_COOLDOWN = 3.75;

export const GORILLA_ROAR = {
  cooldown: 15,
  warning: 0.8 / GORILLA_SKILL_SPEED,
  duration: 5,
  radius: 800,
  healFraction: 0.2,
  damageMultiplier: 0.5,
};

// The guardian awakens as soon as the hero steps into its line of sight.
// Its stone ring uses roughly the footprint of a medium forest plateau.
export const GORILLA_ARENA = {
  triggerRadius: 300,
  radius: 600,
  stoneCount: 64,
};

// Locked-in entrance: ground slam, stone ring, chest-beating roar, then combat.
export const GORILLA_ENTRANCE = {
  slamWindup: 0.75,
  slamRecovery: 0.45,
  roarDuration: 0.85,
};
