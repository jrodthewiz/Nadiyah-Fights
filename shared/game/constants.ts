export const ROOM_NAME = "nadiyah_fight_room";
export const BOT_SESSION_ID = "bot:nadiyah-spar";

export const SIMULATION = {
  tickHz: 60,
  patchHz: 20,
  stepMs: 1000 / 60,
  stepSeconds: 1 / 60,
} as const;

export const ARENA = {
  width: 1280,
  height: 720,
  floorY: 604,
  leftWall: 72,
  rightWall: 1208,
  p1SpawnX: 430,
  p2SpawnX: 850,
} as const;

export const FIGHTER = {
  maxHp: 100,
  walkSpeed: 260,
  dashSpeed: 640,
  dashTicks: 9,
  dashCooldownTicks: 42,
  jumpVelocity: -720,
  gravity: 2100,
  maxFallSpeed: 980,
  width: 48,
  height: 136,
  pushWidth: 42,
  pushHeight: 122,
  inputBufferTicks: 6,
  hitInvulnTicks: 5,
} as const;

export const ROUND = {
  countdownTicks: 90,
  roundTicks: 99 * SIMULATION.tickHz,
  roundEndTicks: 150,
  rematchDelayTicks: 30,
} as const;
