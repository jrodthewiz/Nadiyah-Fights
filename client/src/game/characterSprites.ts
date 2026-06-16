import Phaser from "phaser";
import type { AttackId, FighterAction } from "@shared/game/types";
import characterManifest from "../assets/characters/manifest.json";

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
  animationKeyFor(variantId, resolveAnimationName(request))
);
