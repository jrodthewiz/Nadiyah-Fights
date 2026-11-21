import { describe, expect, it } from "vitest";
import { ARENA, FIGHTER, ROUND } from "../../shared/game/constants";
import { INPUT_BITS } from "../../shared/game/input";
import { createFighter, createMatch, startCountdown, stepMatch } from "../../shared/game/simulation";

const activate = () => {
  const match = createMatch();
  match.fighters.p1 = createFighter("p1", 0, "Nadiyah", "blue", true);
  match.fighters.p2 = createFighter("p2", 1, "Rival", "red");
  startCountdown(match);
  for (let i = 0; i < ROUND.countdownTicks; i += 1) stepMatch(match);
  return match;
};

describe("combat simulation", () => {
  it("moves, faces, jumps, and clamps fighters inside the arena", () => {
    const match = activate();
    stepMatch(match, { p1: { seq: 1, clientTick: 1, buttons: INPUT_BITS.right } });
    expect(match.fighters.p1.x).toBeGreaterThan(ARENA.p1SpawnX);
    expect(match.fighters.p1.x - ARENA.p1SpawnX).toBeCloseTo(FIGHTER.walkSpeed / 60, 2);
    expect(match.fighters.p1.facing).toBe(1);
    stepMatch(match, { p1: { seq: 2, clientTick: 2, buttons: INPUT_BITS.jump } });
    expect(match.fighters.p1.grounded).toBe(false);
    expect(match.fighters.p1.y).toBeLessThan(ARENA.floorY);
    expect(match.fighters.p1.attackSeq).toBe(0);
    expect(match.fighters.p1.attackId).toBe("");
  });

  it("buffers attack inputs during recovery so follow-up presses are not dropped", () => {
    const match = activate();
    stepMatch(match, { p1: { seq: 1, clientTick: 1, buttons: INPUT_BITS.light, pressed: INPUT_BITS.light } });
    for (let i = 0; i < 8; i += 1) stepMatch(match);
    stepMatch(match, { p1: { seq: 2, clientTick: 10, buttons: INPUT_BITS.kick, pressed: INPUT_BITS.kick } });
    for (let i = 0; i < FIGHTER.inputBufferTicks; i += 1) stepMatch(match);
    expect(match.fighters.p1.attackSeq).toBe(2);
    expect(match.fighters.p1.attackId).toBe("kick");
  });

  it("does not repeat attacks from a held or replayed attack input", () => {
    const match = activate();
    stepMatch(match, { p1: { seq: 1, clientTick: 1, buttons: INPUT_BITS.light, pressed: INPUT_BITS.light } });
    const heldLight = { seq: 2, clientTick: 2, buttons: INPUT_BITS.light };
    for (let i = 0; i < 35; i += 1) stepMatch(match, { p1: heldLight });
    expect(match.fighters.p1.attackSeq).toBe(1);
  });

  it("jump-only input clears stale attack buffer and jumps instead of attacking", () => {
    const match = activate();
    stepMatch(match, { p1: { seq: 1, clientTick: 1, buttons: INPUT_BITS.light, pressed: INPUT_BITS.light } });
    for (let i = 0; i < 8; i += 1) stepMatch(match);
    stepMatch(match, { p1: { seq: 2, clientTick: 10, buttons: INPUT_BITS.kick, pressed: INPUT_BITS.kick } });
    for (let i = 0; i < 8; i += 1) stepMatch(match, { p1: { seq: 3, clientTick: 11 + i, buttons: INPUT_BITS.jump } });
    expect(match.fighters.p1.grounded).toBe(false);
    expect(match.fighters.p1.action).toBe("jump");
    expect(match.fighters.p1.attackSeq).toBe(1);
    expect(match.fighters.p1.attackId).toBe("");
  });

  it("applies authored hitboxes, damage, hit-stun, and hit events", () => {
    const match = activate();
    match.fighters.p1.x = 600;
    match.fighters.p2.x = 660;
    match.fighters.p1.facing = 1;
    match.fighters.p2.facing = -1;
    let events = stepMatch(match, { p1: { seq: 1, clientTick: 1, buttons: INPUT_BITS.light, pressed: INPUT_BITS.light } });
    for (let i = 0; i < 8; i += 1) events = events.concat(stepMatch(match));
    expect(match.fighters.p2.hp).toBeLessThan(100);
    expect(match.fighters.p2.hitstunTicks).toBeGreaterThan(0);
    expect(events.some((event) => event.type === "hit")).toBe(true);
  });

  it("blocks front-facing attacks for reduced damage and block-stun", () => {
    const match = activate();
    match.fighters.p1.x = 600;
    match.fighters.p2.x = 660;
    match.fighters.p1.facing = 1;
    match.fighters.p2.facing = -1;
    stepMatch(match, { p2: { seq: 1, clientTick: 1, buttons: INPUT_BITS.block } });
    let events = stepMatch(match, { p1: { seq: 1, clientTick: 1, buttons: INPUT_BITS.heavy, pressed: INPUT_BITS.heavy }, p2: { seq: 2, clientTick: 2, buttons: INPUT_BITS.block } });
    for (let i = 0; i < 12; i += 1) events = events.concat(stepMatch(match, { p2: { seq: i + 3, clientTick: i + 3, buttons: INPUT_BITS.block } }));
    expect(match.fighters.p2.hp).toBe(96);
    expect(match.fighters.p2.blockstunTicks).toBeGreaterThan(0);
    expect(events.some((event) => event.type === "block")).toBe(true);
  });

  it("ends the round on KO", () => {
    const match = activate();
    match.fighters.p1.x = 600;
    match.fighters.p2.x = 660;
    match.fighters.p2.hp = 5;
    match.fighters.p1.facing = 1;
    let events = stepMatch(match, { p1: { seq: 1, clientTick: 1, buttons: INPUT_BITS.heavy, pressed: INPUT_BITS.heavy } });
    for (let i = 0; i < 14; i += 1) events = events.concat(stepMatch(match));
    expect(match.roundState).toBe("roundEnd");
    expect(match.winnerTeamId).toBe("blue");
    expect(events.some((event) => event.type === "ko")).toBe(true);
  });
});
