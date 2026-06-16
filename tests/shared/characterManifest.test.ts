import { describe, expect, it } from "vitest";
import manifest from "../../client/src/assets/characters/manifest.json";

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
    expect(manifest.variants.map((variant) => variant.id)).toEqual(["nadiyah", "ember", "violet", "frost"]);
    for (const variant of manifest.variants) {
      for (const animation of requiredAnimations) {
        expect(variant.animations[animation].frames.length, `${variant.id} ${animation}`).toBeGreaterThan(0);
      }
      expect(variant.totalFrames).toBe(80);
      expect(variant.frame).toEqual({ width: 160, height: 192 });
    }
  });
});
