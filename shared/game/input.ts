export const INPUT_BITS = {
  left: 1 << 0,
  right: 1 << 1,
  up: 1 << 2,
  down: 1 << 3,
  jump: 1 << 4,
  light: 1 << 5,
  heavy: 1 << 6,
  kick: 1 << 7,
  block: 1 << 8,
  dash: 1 << 9,
} as const;

export type InputButton = keyof typeof INPUT_BITS;

export const hasButton = (buttons: number, button: InputButton): boolean => (
  (buttons & INPUT_BITS[button]) !== 0
);

export const normalizeButtons = (buttons: unknown): number => {
  const raw = Number(buttons ?? 0);
  if (!Number.isFinite(raw) || raw < 0) return 0;
  const allowedMask = Object.values(INPUT_BITS).reduce((mask, bit) => mask | bit, 0);
  return Math.trunc(raw) & allowedMask;
};
