import type { AttackDef, AttackId } from "./types";

export const ATTACKS: Record<AttackId, AttackDef> = {
  light: {
    id: "light",
    label: "Jab",
    startup: 3,
    active: 4,
    recovery: 6,
    damage: 7,
    blockDamage: 1,
    hitstun: 14,
    blockstun: 7,
    knockbackX: 250,
    knockbackY: -40,
    cooldown: 3,
    hitboxes: [
      { frame: 3, x: 22, y: -104, width: 58, height: 28 },
      { frame: 4, x: 26, y: -104, width: 64, height: 28 },
      { frame: 5, x: 24, y: -102, width: 54, height: 26 },
    ],
  },
  heavy: {
    id: "heavy",
    label: "Cross",
    startup: 7,
    active: 5,
    recovery: 13,
    damage: 16,
    blockDamage: 4,
    hitstun: 22,
    blockstun: 12,
    knockbackX: 430,
    knockbackY: -100,
    cooldown: 8,
    hitboxes: [
      { frame: 7, x: 18, y: -112, width: 72, height: 34 },
      { frame: 8, x: 24, y: -112, width: 86, height: 34 },
      { frame: 9, x: 20, y: -108, width: 72, height: 34 },
    ],
  },
  kick: {
    id: "kick",
    label: "Snap Kick",
    startup: 5,
    active: 5,
    recovery: 11,
    damage: 12,
    blockDamage: 3,
    hitstun: 18,
    blockstun: 9,
    knockbackX: 350,
    knockbackY: -70,
    cooldown: 6,
    hitboxes: [
      { frame: 5, x: 16, y: -74, width: 76, height: 30 },
      { frame: 6, x: 24, y: -74, width: 90, height: 30 },
      { frame: 7, x: 22, y: -72, width: 80, height: 28 },
    ],
  },
};

export const attackDuration = (attack: AttackDef): number => attack.startup + attack.active + attack.recovery;
