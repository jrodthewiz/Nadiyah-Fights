import type { AttackDef, AttackId } from "./types";

export const ATTACKS: Record<AttackId, AttackDef> = {
  light: {
    id: "light",
    label: "Jab",
    startup: 4,
    active: 5,
    recovery: 10,
    damage: 8,
    blockDamage: 1,
    hitstun: 16,
    blockstun: 8,
    knockbackX: 230,
    knockbackY: -40,
    cooldown: 5,
    hitboxes: [
      { frame: 4, x: 22, y: -104, width: 52, height: 28 },
      { frame: 5, x: 24, y: -104, width: 58, height: 28 },
      { frame: 6, x: 22, y: -102, width: 50, height: 26 },
    ],
  },
  heavy: {
    id: "heavy",
    label: "Cross",
    startup: 9,
    active: 6,
    recovery: 18,
    damage: 16,
    blockDamage: 4,
    hitstun: 24,
    blockstun: 13,
    knockbackX: 390,
    knockbackY: -100,
    cooldown: 12,
    hitboxes: [
      { frame: 9, x: 18, y: -112, width: 66, height: 34 },
      { frame: 10, x: 22, y: -112, width: 76, height: 34 },
      { frame: 11, x: 18, y: -108, width: 66, height: 34 },
    ],
  },
  kick: {
    id: "kick",
    label: "Snap Kick",
    startup: 7,
    active: 7,
    recovery: 16,
    damage: 12,
    blockDamage: 3,
    hitstun: 20,
    blockstun: 10,
    knockbackX: 310,
    knockbackY: -70,
    cooldown: 9,
    hitboxes: [
      { frame: 7, x: 16, y: -74, width: 70, height: 30 },
      { frame: 8, x: 22, y: -74, width: 82, height: 30 },
      { frame: 9, x: 20, y: -72, width: 76, height: 28 },
    ],
  },
};

export const attackDuration = (attack: AttackDef): number => attack.startup + attack.active + attack.recovery;
