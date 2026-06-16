import { FIGHTER } from "./constants";
import type { Facing, FighterSimState, FrameBox, Rect } from "./types";

export const intersects = (a: Rect, b: Rect): boolean => (
  a.x < b.x + b.width
  && a.x + a.width > b.x
  && a.y < b.y + b.height
  && a.y + a.height > b.y
);

export const hurtboxFor = (fighter: FighterSimState): Rect => ({
  x: fighter.x - FIGHTER.width / 2,
  y: fighter.y - FIGHTER.height,
  width: FIGHTER.width,
  height: FIGHTER.height,
});

export const pushboxFor = (fighter: FighterSimState): Rect => ({
  x: fighter.x - FIGHTER.pushWidth / 2,
  y: fighter.y - FIGHTER.pushHeight,
  width: FIGHTER.pushWidth,
  height: FIGHTER.pushHeight,
});

export const worldHitbox = (fighter: FighterSimState, box: FrameBox): Rect => {
  const facing: Facing = fighter.facing;
  const localX = facing === 1 ? box.x : -box.x - box.width;
  return {
    x: fighter.x + localX,
    y: fighter.y + box.y,
    width: box.width,
    height: box.height,
  };
};

export const isAttackFromFront = (attacker: FighterSimState, defender: FighterSimState): boolean => {
  const attackSign = attacker.x < defender.x ? -1 : 1;
  return defender.facing === attackSign;
};
