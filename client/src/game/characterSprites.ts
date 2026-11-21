import type Phaser from "phaser";
import { ATTACKS, attackDuration } from "@shared/game/attacks";
import type { AttackId, FighterAction } from "@shared/game/types";
import characterManifest from "../assets/characters/manifest.json";
import nadiyahSheetUrl from "../assets/characters/nadiyah.png";

type AnimationKey = keyof typeof characterManifest.variants[number]["animations"];
export type CharacterVariantId = typeof characterManifest.variants[number]["id"];

type AnimationRequest = {
  action: FighterAction;
  attackId: AttackId | "";
  vx: number;
  facing: number;
  actionFrame?: number;
};

const SHEET_URLS: Record<CharacterVariantId, string> = {
  nadiyah: nadiyahSheetUrl,
};

const manifestVariant = characterManifest.variants[0];

export const CHARACTER_VARIANTS = characterManifest.variants.map((variant) => ({
  id: variant.id as CharacterVariantId,
  label: variant.label,
}));

export const defaultVariantId: CharacterVariantId = "nadiyah";
export const defaultFrameName = "idle_00";

export const VARIANT_TINTS: Record<CharacterVariantId, number> = {
  nadiyah: 0xffffff,
};

export const textureKeyFor = (variantId: CharacterVariantId): string => `fighter:${variantId}`;
export const animationKeyFor = (variantId: CharacterVariantId, animation: AnimationKey): string => `fighter:${variantId}:${animation}`;

export const preloadCharacterSheets = (scene: Phaser.Scene): void => {
  for (const variant of characterManifest.variants) {
    const variantId = variant.id as CharacterVariantId;
    scene.load.image(textureKeyFor(variantId), SHEET_URLS[variantId]);
  }
};

export const registerCharacterSheets = (scene: Phaser.Scene): void => {
  for (const variant of characterManifest.variants) {
    registerManifestCharacterSheet(scene, variant);
  }
};

const registerManifestCharacterSheet = (scene: Phaser.Scene, variant: typeof characterManifest.variants[number]): void => {
  const variantId = variant.id as CharacterVariantId;
  const textureKey = textureKeyFor(variantId);
  const texture = scene.textures.get(textureKey);
  const addFrame = (frameName: string, frameIndex: number): void => {
    if (texture.has(frameName)) return;
    const col = frameIndex % variant.columns;
    const row = Math.floor(frameIndex / variant.columns);
    texture.add(
      frameName,
      0,
      col * variant.frame.width,
      row * variant.frame.height,
      variant.frame.width,
      variant.frame.height,
    );
  };

  let index = 0;
  for (const animationName of characterManifest.animationOrder as AnimationKey[]) {
    for (const frameName of variant.animations[animationName].frames) {
      addFrame(frameName, index);
      index += 1;
    }
  }

  for (const [animationName, animation] of Object.entries(variant.animations) as Array<[AnimationKey, typeof variant.animations[AnimationKey]]>) {
    const key = animationKeyFor(variantId, animationName);
    if (!scene.anims.exists(key)) {
      scene.anims.create({
        key,
        frames: animation.frames.map((frame) => ({
          key: textureKey,
          frame,
        })),
        frameRate: animation.fps,
        repeat: animation.loop ? -1 : 0,
      });
    }
  }
};

export const variantForFighter = (): CharacterVariantId => "nadiyah";

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

const animationDefinition = (animationName: AnimationKey): typeof manifestVariant.animations[AnimationKey] => (
  manifestVariant.animations[animationName]
);

const frameAtProgress = (frames: string[], progress: number): string => {
  const clampedProgress = Math.min(0.999, Math.max(0, progress));
  return frames[Math.min(frames.length - 1, Math.floor(clampedProgress * frames.length))] ?? defaultFrameName;
};

const frameFromPhases = (actionFrame: number, attackId: AttackId): string => {
  const attack = ATTACKS[attackId];
  const animationName = attackId === "heavy" ? "heavyPunch" : attackId === "kick" ? "kick" : "lightPunch";
  const frames = animationDefinition(animationName).frames;
  const phaseFrame = Math.max(0, actionFrame);
  const windupEnd = Math.max(1, Math.floor(frames.length * 0.42));
  const activeEnd = Math.max(windupEnd + 1, Math.floor(frames.length * 0.78));

  if (phaseFrame < attack.startup) {
    return frameAtProgress(frames.slice(0, windupEnd), phaseFrame / Math.max(1, attack.startup));
  }
  if (phaseFrame < attack.startup + attack.active) {
    const activeFrame = phaseFrame - attack.startup;
    return frameAtProgress(frames.slice(windupEnd, activeEnd), activeFrame / Math.max(1, attack.active));
  }
  const recoveryFrame = phaseFrame - attack.startup - attack.active;
  return frameAtProgress(frames.slice(activeEnd), recoveryFrame / Math.max(1, attack.recovery));
};

const actionDurationFor = (animationName: AnimationKey, attackId: AttackId | ""): number => {
  if (animationName === "lightPunch") return attackDuration(ATTACKS.light);
  if (animationName === "heavyPunch") return attackDuration(ATTACKS.heavy);
  if (animationName === "kick") return attackDuration(ATTACKS.kick);
  if (animationName === "dashForward") return 7;
  if (animationName === "jump") return 24;
  if (animationName === "hitStun") return 14;
  if (animationName === "blockHigh") return 8;
  if (animationName === "knockdown" || animationName === "ko") return 28;
  if (animationName === "getUp") return 18;
  if (attackId && ATTACKS[attackId]) return attackDuration(ATTACKS[attackId]);
  return 36;
};

export const frameFor = (request: AnimationRequest): string => {
  const animationName = resolveAnimationName(request);
  if (request.action === "attack" && request.attackId) {
    return frameFromPhases(request.actionFrame ?? 0, request.attackId);
  }
  const animation = animationDefinition(animationName);
  const frame = Math.max(0, request.actionFrame ?? 0);
  if (animation.loop) {
    const ticksPerFrame = Math.max(1, Math.round(60 / animation.fps));
    return animation.frames[Math.floor(frame / ticksPerFrame) % animation.frames.length] ?? defaultFrameName;
  }
  const duration = Math.max(1, actionDurationFor(animationName, request.attackId));
  const index = Math.min(animation.frames.length - 1, Math.floor((frame / duration) * animation.frames.length));
  return animation.frames[index] ?? defaultFrameName;
};
