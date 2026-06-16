import Phaser from "phaser";
import type { FighterAction } from "@shared/game/types";

const FRAME_WIDTH = 128;
const FRAME_HEIGHT = 160;
const TEXTURE_PREFIX = "nadiyah";

const ACTION_FRAMES: Record<string, number> = {
  idle: 4,
  walk: 6,
  jump: 3,
  dash: 4,
  attack_light: 4,
  attack_heavy: 5,
  attack_kick: 5,
  block: 2,
  hitstun: 3,
  blockstun: 2,
  knockdown: 4,
  ko: 4,
};

const limb = (graphics: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, color = 0x111317): void => {
  graphics.lineStyle(8, color, 1);
  graphics.beginPath();
  graphics.moveTo(x1, y1);
  graphics.lineTo(x2, y2);
  graphics.strokePath();
};

const drawFrame = (graphics: Phaser.GameObjects.Graphics, action: string, frame: number): void => {
  graphics.clear();
  const cx = FRAME_WIDTH / 2;
  const floor = FRAME_HEIGHT - 10;
  const bob = action === "idle" ? Math.sin(frame / 4 * Math.PI * 2) * 2 : 0;
  const hipY = floor - 58 + bob;
  const chestY = floor - 102 + bob;
  const headY = floor - 128 + bob;
  const accent = 0x11c5aa;
  const gold = 0xf2c14e;
  let lean = 0;
  let armReach = 0;
  let kickReach = 0;
  if (action === "walk") lean = frame % 2 === 0 ? 5 : -5;
  if (action === "dash") lean = 16;
  if (action === "attack_light") armReach = frame >= 1 && frame <= 2 ? 28 : 8;
  if (action === "attack_heavy") armReach = frame >= 1 && frame <= 3 ? 42 : 12;
  if (action === "attack_kick") kickReach = frame >= 1 && frame <= 3 ? 38 : 0;
  if (action === "hitstun") lean = -18;
  if (action === "block" || action === "blockstun") lean = -6;
  if (action === "ko" || action === "knockdown") {
    graphics.lineStyle(8, 0x111317, 1);
    limb(graphics, cx - 42, floor - 18, cx + 42, floor - 26);
    limb(graphics, cx - 12, floor - 22, cx + 18, floor - 54);
    limb(graphics, cx + 18, floor - 54, cx + 44, floor - 58);
    limb(graphics, cx - 14, floor - 24, cx - 42, floor - 42);
    graphics.fillStyle(0x111317, 1);
    graphics.fillCircle(cx + 48, floor - 60, 16);
    graphics.lineStyle(5, accent, 1);
    graphics.beginPath();
    graphics.moveTo(cx + 30, floor - 64);
    graphics.lineTo(cx + 60, floor - 82);
    graphics.strokePath();
    return;
  }

  graphics.fillStyle(0x111317, 1);
  graphics.fillCircle(cx + lean, headY, 17);
  graphics.lineStyle(5, accent, 1);
  graphics.beginPath();
  graphics.moveTo(cx + lean - 16, headY + 6);
  graphics.lineTo(cx + lean - 46, headY + 18);
  graphics.strokePath();
  graphics.fillStyle(gold, 1);
  graphics.fillCircle(cx + lean + 7, headY - 3, 3);

  limb(graphics, cx + lean, headY + 18, cx, chestY);
  limb(graphics, cx, chestY, cx, hipY);

  if (action === "block" || action === "blockstun") {
    limb(graphics, cx, chestY + 4, cx + 25, chestY - 18);
    limb(graphics, cx + 2, chestY + 14, cx + 30, chestY + 2);
  } else {
    limb(graphics, cx, chestY + 4, cx + 34 + armReach, chestY - 12);
    limb(graphics, cx + 2, chestY + 12, cx - 26, chestY + 32);
  }

  const stride = action === "walk" ? Math.sin(frame / 6 * Math.PI * 2) * 18 : 0;
  const jumpLift = action === "jump" ? 16 : 0;
  limb(graphics, cx, hipY, cx - 26 - stride, floor - jumpLift);
  limb(graphics, cx, hipY, cx + 26 + stride + kickReach, floor - 2 - jumpLift);

  graphics.lineStyle(4, accent, 1);
  graphics.beginPath();
  graphics.moveTo(cx - 16, chestY - 2);
  graphics.lineTo(cx + 18, chestY + 22);
  graphics.strokePath();
};

export const registerProceduralSprites = (scene: Phaser.Scene): void => {
  const graphics = scene.add.graphics();
  graphics.setVisible(false);
  for (const [action, count] of Object.entries(ACTION_FRAMES)) {
    for (let frame = 0; frame < count; frame += 1) {
      const key = `${TEXTURE_PREFIX}:${action}:${frame}`;
      if (scene.textures.exists(key)) continue;
      drawFrame(graphics, action, frame);
      graphics.generateTexture(key, FRAME_WIDTH, FRAME_HEIGHT);
    }
  }
  graphics.destroy();

  for (const [action, count] of Object.entries(ACTION_FRAMES)) {
    const animKey = `${TEXTURE_PREFIX}:${action}`;
    if (scene.anims.exists(animKey)) continue;
    scene.anims.create({
      key: animKey,
      frames: Array.from({ length: count }, (_unused, frame) => ({ key: `${TEXTURE_PREFIX}:${action}:${frame}` })),
      frameRate: action === "idle" ? 6 : 12,
      repeat: action === "idle" || action === "walk" ? -1 : 0,
    });
  }
};

export const animationFor = (action: FighterAction, attackId: string): string => {
  if (action === "attack") return `${TEXTURE_PREFIX}:attack_${attackId || "light"}`;
  if (action === "blockstun") return `${TEXTURE_PREFIX}:blockstun`;
  return `${TEXTURE_PREFIX}:${action}`;
};

export const defaultTextureKey = `${TEXTURE_PREFIX}:idle:0`;
