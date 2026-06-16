import Phaser from "phaser";
import type { AttackId, FighterAction } from "@shared/game/types";
import characterManifest from "../assets/characters/manifest.json";
import nadiyahPunchSheetUrl from "../assets/characters/generated/nadiyah-punches-normalized.png";

const SHEET_URLS: Record<string, string> = {
  nadiyah: new URL("../assets/characters/nadiyah.svg", import.meta.url).href,
  ember: new URL("../assets/characters/ember.svg", import.meta.url).href,
  violet: new URL("../assets/characters/violet.svg", import.meta.url).href,
  frost: new URL("../assets/characters/frost.svg", import.meta.url).href,
};

type AnimationKey = keyof typeof characterManifest.variants[number]["animations"];
export type CharacterVariantId = typeof characterManifest.variants[number]["id"];

type AnimationRequest = {
  action: FighterAction;
  attackId: AttackId | "";
  vx: number;
  facing: number;
};

const NADIYAH_PUNCH_SHEET = {
  textureKey: "fighter:nadiyah:punches",
  frameWidth: 320,
  frameHeight: 256,
  columns: 6,
  rows: 4,
  animations: {
    lightPunch: { frames: [0, 1, 2, 3, 4, 5], fps: 18 },
    heavyPunch: { frames: [6, 7, 8, 9, 10, 11], fps: 16 },
    hookPunch: { frames: [12, 13, 14, 15, 16, 17], fps: 16 },
    uppercutPunch: { frames: [18, 19, 20, 21, 22, 23], fps: 15 },
  },
} as const;

export const CHARACTER_VARIANTS = characterManifest.variants.map((variant) => ({
  id: variant.id as CharacterVariantId,
  label: variant.label,
}));

export const defaultVariantId: CharacterVariantId = "nadiyah";
export const defaultFrameName = "idle_00";

export const textureKeyFor = (variantId: CharacterVariantId): string => `fighter:${variantId}`;
export const animationKeyFor = (variantId: CharacterVariantId, animation: AnimationKey): string => `fighter:${variantId}:${animation}`;

export const preloadCharacterSheets = (scene: Phaser.Scene): void => {
  for (const variant of characterManifest.variants) {
    scene.load.svg(textureKeyFor(variant.id as CharacterVariantId), SHEET_URLS[variant.id], {
      width: characterManifest.columns * characterManifest.frame.width,
      height: characterManifest.rows * characterManifest.frame.height,
    });
  }
  scene.load.image(NADIYAH_PUNCH_SHEET.textureKey, nadiyahPunchSheetUrl);
};

export const registerCharacterSheets = (scene: Phaser.Scene): void => {
  const frameWidth = characterManifest.frame.width;
  const frameHeight = characterManifest.frame.height;

  for (const variant of characterManifest.variants) {
    const variantId = variant.id as CharacterVariantId;
    const textureKey = textureKeyFor(variantId);
    const texture = scene.textures.get(textureKey);
    let index = 0;

    for (const animationName of characterManifest.animationOrder as AnimationKey[]) {
      const animation = variant.animations[animationName];
      for (const frameName of animation.frames) {
        if (!texture.has(frameName)) {
          const col = index % characterManifest.columns;
          const row = Math.floor(index / characterManifest.columns);
          texture.add(frameName, 0, col * frameWidth, row * frameHeight, frameWidth, frameHeight);
        }
        index += 1;
      }

      const animKey = animationKeyFor(variantId, animationName);
      if (!scene.anims.exists(animKey)) {
        scene.anims.create({
          key: animKey,
          frames: animation.frames.map((frameName) => ({ key: textureKey, frame: frameName })),
          frameRate: animation.fps,
          repeat: animation.loop ? -1 : 0,
        });
      }
    }
  }

  registerNadiyahPunchSheet(scene);
};

const registerNadiyahPunchSheet = (scene: Phaser.Scene): void => {
  const texture = scene.textures.get(NADIYAH_PUNCH_SHEET.textureKey);
  let index = 0;
  for (let row = 0; row < NADIYAH_PUNCH_SHEET.rows; row += 1) {
    for (let col = 0; col < NADIYAH_PUNCH_SHEET.columns; col += 1) {
      const frameName = `punch_${String(index).padStart(2, "0")}`;
      if (!texture.has(frameName)) {
        texture.add(
          frameName,
          0,
          col * NADIYAH_PUNCH_SHEET.frameWidth,
          row * NADIYAH_PUNCH_SHEET.frameHeight,
          NADIYAH_PUNCH_SHEET.frameWidth,
          NADIYAH_PUNCH_SHEET.frameHeight,
        );
      }
      index += 1;
    }
  }

  for (const [name, animation] of Object.entries(NADIYAH_PUNCH_SHEET.animations)) {
    const key = `fighter:nadiyah:generated:${name}`;
    if (!scene.anims.exists(key)) {
      scene.anims.create({
        key,
        frames: animation.frames.map((frame) => ({
          key: NADIYAH_PUNCH_SHEET.textureKey,
          frame: `punch_${String(frame).padStart(2, "0")}`,
        })),
        frameRate: animation.fps,
        repeat: 0,
      });
    }
  }
};

export const variantForFighter = (teamId: string, isBot: boolean, slotLike: string): CharacterVariantId => {
  if (isBot) return "frost";
  if (teamId === "red") return "ember";
  if (slotLike.includes("violet")) return "violet";
  return "nadiyah";
};

export const resolveAnimationName = ({ action, attackId, vx, facing }: AnimationRequest): AnimationKey => {
  if (action === "attack") {
    if (attackId === "heavy") return "heavyPunch";
    if (attackId === "kick") return "kick";
    return "lightPunch";
  }
  if (action === "walk") return vx * facing < -8 ? "walkBack" : "walkForward";
  if (action === "dash") return "dashForward";
  if (action === "block" || action === "blockstun") return "blockHigh";
  if (action === "hitstun") return "hitStun";
  if (action === "knockdown") return "knockdown";
  if (action === "ko") return "ko";
  if (action === "jump") return "jump";
  return "idle";
};

export const animationFor = (variantId: CharacterVariantId, request: AnimationRequest): string => (
  variantId === "nadiyah" && request.action === "attack"
    ? `fighter:nadiyah:generated:${request.attackId === "heavy" ? "heavyPunch" : "lightPunch"}`
    : animationKeyFor(variantId, resolveAnimationName(request))
);
