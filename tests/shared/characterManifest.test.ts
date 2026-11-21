import { describe, expect, it } from "vitest";
import manifest from "../../client/src/assets/characters/manifest.json";
import { frameFor, resolveAnimationName } from "../../client/src/game/characterSprites";
import type { AttackId, FighterAction } from "../../shared/game/types";

const requiredAnimations = [
  "idle",
  "walkForward",
  "walkBack",
  "crouch",
  "jump",
  "dashForward",
  "lightPunch",
  "heavyPunch",
  "kick",
  "blockHigh",
  "hitStun",
  "knockdown",
  "getUp",
  "victory",
  "ko",
] as const;

describe("character sprite manifest", () => {
  it("ships all combat animation sets for every character variant", () => {
    expect(manifest.variants.map((variant) => variant.id)).toEqual(["nadiyah"]);
    for (const variant of manifest.variants) {
      for (const animation of requiredAnimations) {
        expect(variant.animations[animation].frames.length, `${variant.id} ${animation}`).toBeGreaterThan(0);
      }
      expect(variant.totalFrames).toBe(80);
      expect(variant.frame).toEqual({ width: 320, height: 256 });
    }
  });

  it("uses non-uppercut frames for jump playback", () => {
    const jumpFrames = Array.from({ length: 24 }, (_value, actionFrame) => frameFor({
      action: "jump",
      actionFrame,
      attackId: "",
      vx: 0,
      facing: 1,
    }));
    expect(jumpFrames.every((frame) => manifest.variants[0].animations.jump.frames.includes(frame))).toBe(true);
    expect(jumpFrames.every((frame) => frame.startsWith("jump_"))).toBe(true);
  });

  it("plays idle at authored animation speed instead of every simulation tick", () => {
    const firstFrame = frameFor({ action: "idle", actionFrame: 0, attackId: "", vx: 0, facing: 1 });
    expect(frameFor({ action: "idle", actionFrame: 1, attackId: "", vx: 0, facing: 1 })).toBe(firstFrame);
    expect(frameFor({ action: "idle", actionFrame: 6, attackId: "", vx: 0, facing: 1 })).toBe(firstFrame);
    expect(frameFor({ action: "idle", actionFrame: 8, attackId: "", vx: 0, facing: 1 })).not.toBe(firstFrame);
  });

  it("resolves reachable fighter actions to frames from their manifest animation", () => {
    const requests: Array<{ action: FighterAction; attackId: AttackId | ""; vx: number; facing: number }> = [
      { action: "idle", attackId: "", vx: 0, facing: 1 },
      { action: "walk", attackId: "", vx: 120, facing: 1 },
      { action: "walk", attackId: "", vx: -120, facing: 1 },
      { action: "dash", attackId: "", vx: 0, facing: 1 },
      { action: "jump", attackId: "", vx: 0, facing: 1 },
      { action: "attack", attackId: "light", vx: 0, facing: 1 },
      { action: "attack", attackId: "heavy", vx: 0, facing: 1 },
      { action: "attack", attackId: "kick", vx: 0, facing: 1 },
      { action: "block", attackId: "", vx: 0, facing: 1 },
      { action: "blockstun", attackId: "", vx: 0, facing: 1 },
      { action: "hitstun", attackId: "", vx: 0, facing: 1 },
      { action: "knockdown", attackId: "", vx: 0, facing: 1 },
      { action: "ko", attackId: "", vx: 0, facing: 1 },
    ];

    for (const request of requests) {
      const animationName = resolveAnimationName(request);
      const frames = manifest.variants[0].animations[animationName].frames;
      for (let actionFrame = 0; actionFrame < 36; actionFrame += 1) {
        expect(frames, `${request.action}:${request.attackId}:${actionFrame}`).toContain(frameFor({ ...request, actionFrame }));
      }
    }
  });
});
