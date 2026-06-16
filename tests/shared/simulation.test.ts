import { describe, expect, it } from "vitest";
import { ARENA, ROUND } from "../../shared/game/constants";
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
    expect(match.fighters.p1.facing).toBe(1);
    stepMatch(match, { p1: { seq: 2, clientTick: 2, buttons: INPUT_BITS.jump } });
    expect(match.fighters.p1.grounded).toBe(false);
    expect(match.fighters.p1.y).toBeLessThan(ARENA.floorY);
  });

  it("applies authored hitboxes, damage, hit-stun, and hit events", () => {
    const match = activate();
    match.fighters.p1.x = 600;
    match.fighters.p2.x = 660;
    match.fighters.p1.facing = 1;
    match.fighters.p2.facing = -1;
    let events = stepMatch(match, { p1: { seq: 1, clientTick: 1, buttons: INPUT_BITS.light } });
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
    let events = stepMatch(match, { p1: { seq: 1, clientTick: 1, buttons: INPUT_BITS.heavy }, p2: { seq: 2, clientTick: 2, buttons: INPUT_BITS.block } });
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
    let events = stepMatch(match, { p1: { seq: 1, clientTick: 1, buttons: INPUT_BITS.heavy } });
    for (let i = 0; i < 14; i += 1) events = events.concat(stepMatch(match));
    expect(match.roundState).toBe("roundEnd");
    expect(match.winnerTeamId).toBe("blue");
    expect(events.some((event) => event.type === "ko")).toBe(true);
  });
});
