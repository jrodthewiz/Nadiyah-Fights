import { ATTACKS, attackDuration } from "./attacks";
import { ARENA, FIGHTER, ROUND, SIMULATION } from "./constants";
import { hurtboxFor, intersects, isAttackFromFront, pushboxFor, worldHitbox } from "./boxes";
import { hasButton, normalizeButtons } from "./input";
import type { AttackId, CombatEvent, Facing, FighterAction, FighterSimState, InputPayload, MatchMode, MatchSimState, TeamId } from "./types";

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export type StepInputs = Record<string, InputPayload | undefined>;

export const createFighter = (id: string, slot: number, name: string, teamId: TeamId, isHost = false, isBot = false): FighterSimState => {
  const leftSide = slot % 2 === 0;
  return {
    id,
    slot,
    teamId,
    name,
    connected: true,
    ready: false,
    isHost,
    isBot,
    x: leftSide ? ARENA.p1SpawnX : ARENA.p2SpawnX,
    y: ARENA.floorY,
    vx: 0,
    vy: 0,
    facing: leftSide ? 1 : -1,
    grounded: true,
    hp: FIGHTER.maxHp,
    meter: 0,
    stocks: 1,
    action: "idle",
    actionFrame: 0,
    attackId: "",
    attackSeq: 0,
    cooldownTicks: 0,
    dashTicks: 0,
    dashCooldownTicks: 0,
    hitstunTicks: 0,
    blockstunTicks: 0,
    invulnTicks: 0,
    inputAck: 0,
    lastEventSeq: 0,
    wins: 0,
  };
};

export const createMatch = (mode: MatchMode = "duel", stageId = "training-yard"): MatchSimState => ({
  serverTick: 0,
  roundState: "waiting",
  mode,
  stageId,
  roundIndex: 1,
  countdownTicks: 0,
  roundTicksRemaining: ROUND.roundTicks,
  roundEndTicks: 0,
  winnerTeamId: "",
  eventSeq: 0,
  fighters: {},
});

export const resetFighterForRound = (fighter: FighterSimState): void => {
  const leftSide = fighter.slot % 2 === 0;
  fighter.x = leftSide ? ARENA.p1SpawnX : ARENA.p2SpawnX;
  fighter.y = ARENA.floorY;
  fighter.vx = 0;
  fighter.vy = 0;
  fighter.facing = leftSide ? 1 : -1;
  fighter.grounded = true;
  fighter.hp = FIGHTER.maxHp;
  fighter.meter = 0;
  fighter.stocks = 1;
  fighter.action = "idle";
  fighter.actionFrame = 0;
  fighter.attackId = "";
  fighter.attackSeq = 0;
  fighter.cooldownTicks = 0;
  fighter.dashTicks = 0;
  fighter.dashCooldownTicks = 0;
  fighter.hitstunTicks = 0;
  fighter.blockstunTicks = 0;
  fighter.invulnTicks = 0;
};

export const startCountdown = (match: MatchSimState): CombatEvent[] => {
  match.roundState = "countdown";
  match.countdownTicks = ROUND.countdownTicks;
  match.roundTicksRemaining = ROUND.roundTicks;
  match.winnerTeamId = "";
  for (const fighter of Object.values(match.fighters)) resetFighterForRound(fighter);
  return [];
};

export const rematch = (match: MatchSimState): void => {
  match.roundIndex += 1;
  match.roundState = "waiting";
  match.countdownTicks = 0;
  match.roundEndTicks = 0;
  match.winnerTeamId = "";
  for (const fighter of Object.values(match.fighters)) {
    fighter.ready = false;
    resetFighterForRound(fighter);
  }
};

const pushEvent = (match: MatchSimState, events: CombatEvent[], type: CombatEvent["type"], sourceId: string, targetId: string, x: number, y: number): void => {
  match.eventSeq += 1;
  const event = { seq: match.eventSeq, tick: match.serverTick, type, sourceId, targetId, x, y };
  events.push(event);
  const source = match.fighters[sourceId];
  if (source) source.lastEventSeq = event.seq;
  const target = match.fighters[targetId];
  if (target) target.lastEventSeq = event.seq;
};

const canAct = (fighter: FighterSimState): boolean => (
  fighter.action !== "ko"
  && fighter.action !== "knockdown"
  && fighter.hitstunTicks <= 0
  && fighter.blockstunTicks <= 0
  && fighter.action !== "attack"
);

const setAction = (fighter: FighterSimState, action: FighterAction): void => {
  if (fighter.action !== action) {
    fighter.action = action;
    fighter.actionFrame = 0;
  }
};

const chooseAttack = (buttons: number): AttackId | null => {
  if (hasButton(buttons, "heavy")) return "heavy";
  if (hasButton(buttons, "kick")) return "kick";
  if (hasButton(buttons, "light")) return "light";
  return null;
};

const beginAttack = (fighter: FighterSimState, attackId: AttackId): void => {
  fighter.action = "attack";
  fighter.actionFrame = 0;
  fighter.attackId = attackId;
  fighter.attackSeq += 1;
  fighter.cooldownTicks = ATTACKS[attackId].cooldown;
  fighter.vx *= 0.25;
};

const advanceTimers = (fighter: FighterSimState): void => {
  fighter.actionFrame += 1;
  fighter.cooldownTicks = Math.max(0, fighter.cooldownTicks - 1);
  fighter.dashCooldownTicks = Math.max(0, fighter.dashCooldownTicks - 1);
  fighter.invulnTicks = Math.max(0, fighter.invulnTicks - 1);
  fighter.hitstunTicks = Math.max(0, fighter.hitstunTicks - 1);
  fighter.blockstunTicks = Math.max(0, fighter.blockstunTicks - 1);
  if (fighter.dashTicks > 0) fighter.dashTicks -= 1;

  if (fighter.action === "attack" && fighter.attackId) {
    if (fighter.actionFrame > attackDuration(ATTACKS[fighter.attackId])) {
      fighter.attackId = "";
      setAction(fighter, fighter.grounded ? "idle" : "jump");
    }
  }
  if ((fighter.action === "hitstun" && fighter.hitstunTicks <= 0) || (fighter.action === "blockstun" && fighter.blockstunTicks <= 0)) {
    setAction(fighter, fighter.grounded ? "idle" : "jump");
  }
};

const resolveInput = (fighter: FighterSimState, input: InputPayload | undefined, events: CombatEvent[], match: MatchSimState): void => {
  const buttons = normalizeButtons(input?.buttons ?? 0);
  if (input && input.seq > fighter.inputAck) fighter.inputAck = input.seq;
  if (fighter.action === "ko" || fighter.action === "knockdown") return;

  if (fighter.hitstunTicks > 0) {
    setAction(fighter, "hitstun");
    return;
  }
  if (fighter.blockstunTicks > 0) {
    setAction(fighter, "blockstun");
    return;
  }

  if (fighter.dashTicks > 0) {
    setAction(fighter, "dash");
    fighter.vx = fighter.facing * FIGHTER.dashSpeed;
    return;
  }

  if (!canAct(fighter)) return;

  const wantsBlock = hasButton(buttons, "block");
  if (wantsBlock && fighter.grounded) {
    fighter.vx = 0;
    setAction(fighter, "block");
    return;
  }

  const attackId = chooseAttack(buttons);
  if (attackId && fighter.cooldownTicks <= 0) {
    beginAttack(fighter, attackId);
    return;
  }

  if (hasButton(buttons, "dash") && fighter.dashCooldownTicks <= 0) {
    fighter.dashTicks = FIGHTER.dashTicks;
    fighter.dashCooldownTicks = FIGHTER.dashCooldownTicks;
    fighter.vx = fighter.facing * FIGHTER.dashSpeed;
    setAction(fighter, "dash");
    pushEvent(match, events, "dash", fighter.id, "", fighter.x, fighter.y - 70);
    return;
  }

  if (hasButton(buttons, "jump") && fighter.grounded) {
    fighter.vy = FIGHTER.jumpVelocity;
    fighter.grounded = false;
    setAction(fighter, "jump");
  }

  const left = hasButton(buttons, "left");
  const right = hasButton(buttons, "right");
  const move = left === right ? 0 : left ? -1 : 1;
  fighter.vx = move * FIGHTER.walkSpeed;
  if (move !== 0) fighter.facing = move as Facing;
  setAction(fighter, fighter.grounded ? (move === 0 ? "idle" : "walk") : "jump");
};

const integrate = (fighter: FighterSimState): void => {
  if (!fighter.grounded) {
    fighter.vy = Math.min(FIGHTER.maxFallSpeed, fighter.vy + FIGHTER.gravity * SIMULATION.stepSeconds);
  }
  fighter.x = clamp(fighter.x + fighter.vx * SIMULATION.stepSeconds, ARENA.leftWall, ARENA.rightWall);
  fighter.y += fighter.vy * SIMULATION.stepSeconds;
  fighter.vx *= fighter.grounded && fighter.action !== "dash" ? 0.82 : 0.96;
  if (fighter.y >= ARENA.floorY) {
    fighter.y = ARENA.floorY;
    fighter.vy = 0;
    if (!fighter.grounded) fighter.actionFrame = 0;
    fighter.grounded = true;
  } else {
    fighter.grounded = false;
  }
};

const faceNearestOpponent = (fighters: FighterSimState[]): void => {
  for (const fighter of fighters) {
    if (fighter.action === "attack" || fighter.action === "dash" || fighter.action === "ko") continue;
    const opponent = fighters.find((candidate) => candidate.id !== fighter.id && candidate.teamId !== fighter.teamId && candidate.hp > 0);
    if (opponent) fighter.facing = fighter.x <= opponent.x ? 1 : -1;
  }
};

const resolvePushboxes = (fighters: FighterSimState[]): void => {
  if (fighters.length < 2) return;
  const [a, b] = fighters;
  if (!a || !b || a.action === "ko" || b.action === "ko") return;
  const aBox = pushboxFor(a);
  const bBox = pushboxFor(b);
  if (!intersects(aBox, bBox)) return;
  const overlap = Math.min(aBox.x + aBox.width - bBox.x, bBox.x + bBox.width - aBox.x);
  const split = Math.max(0, overlap / 2);
  if (a.x <= b.x) {
    a.x = clamp(a.x - split, ARENA.leftWall, ARENA.rightWall);
    b.x = clamp(b.x + split, ARENA.leftWall, ARENA.rightWall);
  } else {
    a.x = clamp(a.x + split, ARENA.leftWall, ARENA.rightWall);
    b.x = clamp(b.x - split, ARENA.leftWall, ARENA.rightWall);
  }
};

const isBlocking = (attacker: FighterSimState, defender: FighterSimState): boolean => (
  defender.action === "block" && defender.grounded && isAttackFromFront(attacker, defender)
);

const resolveHits = (match: MatchSimState, events: CombatEvent[]): void => {
  const fighters = Object.values(match.fighters).filter((fighter) => fighter.connected || fighter.isBot);
  for (const attacker of fighters) {
    if (attacker.action !== "attack" || !attacker.attackId) continue;
    const attack = ATTACKS[attacker.attackId];
    const boxes = attack.hitboxes.filter((box) => box.frame === attacker.actionFrame);
    if (boxes.length === 0) continue;
    for (const defender of fighters) {
      if (defender.id === attacker.id || defender.teamId === attacker.teamId || defender.hp <= 0 || defender.invulnTicks > 0) continue;
      const hurtbox = hurtboxFor(defender);
      const hitbox = boxes.map((box) => worldHitbox(attacker, box)).find((box) => intersects(box, hurtbox));
      if (!hitbox) continue;
      defender.invulnTicks = FIGHTER.hitInvulnTicks;
      const blocked = isBlocking(attacker, defender);
      if (blocked) {
        defender.hp = Math.max(0, defender.hp - attack.blockDamage);
        defender.blockstunTicks = attack.blockstun;
        defender.vx = attacker.facing * attack.knockbackX * 0.35;
        setAction(defender, "blockstun");
        pushEvent(match, events, "block", attacker.id, defender.id, hitbox.x + hitbox.width / 2, hitbox.y + hitbox.height / 2);
      } else {
        defender.hp = Math.max(0, defender.hp - attack.damage);
        defender.hitstunTicks = attack.hitstun;
        defender.vx = attacker.facing * attack.knockbackX;
        defender.vy = attack.knockbackY;
        defender.grounded = false;
        setAction(defender, defender.hp <= 0 ? "ko" : "hitstun");
        pushEvent(match, events, "hit", attacker.id, defender.id, hitbox.x + hitbox.width / 2, hitbox.y + hitbox.height / 2);
        if (defender.hp <= 0) {
          defender.stocks = 0;
          pushEvent(match, events, "ko", attacker.id, defender.id, defender.x, defender.y - 90);
        }
      }
      attacker.meter = clamp(attacker.meter + (blocked ? 4 : 9), 0, 100);
      defender.meter = clamp(defender.meter + (blocked ? 5 : 3), 0, 100);
    }
  }
};

const resolveWinner = (match: MatchSimState): string => {
  const aliveTeams = new Set(Object.values(match.fighters).filter((fighter) => fighter.hp > 0).map((fighter) => fighter.teamId));
  if (aliveTeams.size === 1) return Array.from(aliveTeams)[0] ?? "";
  if (aliveTeams.size === 0) return "draw";
  return "";
};

const endRound = (match: MatchSimState, winnerTeamId: string, events: CombatEvent[]): void => {
  match.roundState = "roundEnd";
  match.roundEndTicks = ROUND.roundEndTicks;
  match.winnerTeamId = winnerTeamId;
  for (const fighter of Object.values(match.fighters)) {
    if (fighter.teamId === winnerTeamId) fighter.wins += 1;
  }
  pushEvent(match, events, "roundEnd", "", winnerTeamId, ARENA.width / 2, ARENA.height / 2);
};

export const stepMatch = (match: MatchSimState, inputs: StepInputs = {}): CombatEvent[] => {
  const events: CombatEvent[] = [];
  match.serverTick += 1;

  if (match.roundState === "waiting") return events;

  if (match.roundState === "countdown") {
    match.countdownTicks -= 1;
    if (match.countdownTicks <= 0) {
      match.roundState = "active";
      pushEvent(match, events, "roundStart", "", "", ARENA.width / 2, ARENA.floorY - 120);
    }
    return events;
  }

  if (match.roundState === "roundEnd") {
    match.roundEndTicks -= 1;
    return events;
  }

  const fighters = Object.values(match.fighters).filter((fighter) => fighter.connected || fighter.isBot);
  for (const fighter of fighters) advanceTimers(fighter);
  for (const fighter of fighters) resolveInput(fighter, inputs[fighter.id], events, match);
  for (const fighter of fighters) integrate(fighter);
  faceNearestOpponent(fighters);
  resolvePushboxes(fighters);
  resolveHits(match, events);

  match.roundTicksRemaining = Math.max(0, match.roundTicksRemaining - 1);
  const winner = resolveWinner(match);
  if (winner || match.roundTicksRemaining <= 0) {
    const winnerByTimer = winner || fighters.reduce((best, fighter) => (fighter.hp > best.hp ? fighter : best), fighters[0] ?? createFighter("draw", 0, "Draw", "draw"));
    endRound(match, typeof winnerByTimer === "string" ? winnerByTimer : winnerByTimer.teamId, events);
  }
  return events;
};
