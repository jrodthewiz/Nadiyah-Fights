import { Client, Room } from "colyseus";
import { BOT_SESSION_ID, ROUND, SIMULATION } from "../../shared/game/constants";
import { CLIENT_MESSAGES, SERVER_MESSAGES } from "../../shared/game/messages";
import { createFighter, createMatch, rematch, resetFighterForRound, startCountdown, stepMatch, type StepInputs } from "../../shared/game/simulation";
import { INPUT_BITS } from "../../shared/game/input";
import type { CombatEvent, CreateFightRoomOptions, InputPayload, JoinFightRoomOptions, MatchMode, SetReadyPayload } from "../../shared/game/types";
import { createLobbyCode, normalizeLobbyCode, removeLobby, upsertLobby } from "../lobbies";
import { FighterState, FightState } from "../schema/FightState";

const toPlayerName = (value: unknown, fallback: string): string => {
  const normalized = String(value ?? fallback).replace(/\s+/g, " ").trim().slice(0, 18);
  return normalized || fallback;
};

const toMode = (value: unknown): MatchMode => (
  value === "teams" || value === "ffa" ? value : "duel"
);

const schemaFromSim = (state: FighterState, simId: string, room: FightRoom): void => {
  const fighter = room.sim.fighters[simId];
  if (!fighter) return;
  state.slot = fighter.slot;
  state.teamId = fighter.teamId;
  state.name = fighter.name;
  state.connected = fighter.connected;
  state.ready = fighter.ready;
  state.isHost = fighter.isHost;
  state.isBot = fighter.isBot;
  state.x = fighter.x;
  state.y = fighter.y;
  state.vx = fighter.vx;
  state.vy = fighter.vy;
  state.facing = fighter.facing;
  state.grounded = fighter.grounded;
  state.hp = fighter.hp;
  state.meter = fighter.meter;
  state.stocks = fighter.stocks;
  state.action = fighter.action;
  state.actionFrame = fighter.actionFrame;
  state.attackId = fighter.attackId;
  state.attackSeq = fighter.attackSeq;
  state.hitstunTicks = fighter.hitstunTicks;
  state.blockstunTicks = fighter.blockstunTicks;
  state.invulnTicks = fighter.invulnTicks;
  state.inputAck = fighter.inputAck;
  state.lastEventSeq = fighter.lastEventSeq;
  state.wins = fighter.wins;
};

export class FightRoom extends Room {
  maxClients = 2;
  state = new FightState();
  sim = createMatch();

  private hostSessionId = "";
  private privateLobby = false;
  private practiceBotEnabled = false;
  private lastInputs = new Map<string, InputPayload>();
  private lastSeqBySession = new Map<string, number>();
  private botNextAttackTick = 0;

  requestJoin(options: JoinFightRoomOptions, isNewRoom: boolean): boolean {
    if (isNewRoom) return true;
    const requestedCode = normalizeLobbyCode(options.code);
    return this.state.roundState === "waiting" && requestedCode.length > 0 && requestedCode === this.state.code && this.state.players.size < this.maxClients;
  }

  onCreate(options: CreateFightRoomOptions): void {
    this.privateLobby = options.private === true;
    this.practiceBotEnabled = options.bot === true;
    this.maxClients = 2;
    this.sim = createMatch(toMode(options.mode), typeof options.stageId === "string" ? options.stageId : "training-yard");
    this.state.code = createLobbyCode();
    this.state.mode = this.sim.mode;
    this.state.stageId = this.sim.stageId;
    this.state.hostName = toPlayerName(options.hostName ?? options.playerName, "Host");
    this.setPatchRate(1000 / SIMULATION.patchHz);
    this.setSimulationInterval(() => this.fixedTick(), 1000 / SIMULATION.tickHz);
    this.registerHandlers();
    this.syncStateFromSim();
    this.syncLobbyMetadata();
  }

  onJoin(client: Client, options: JoinFightRoomOptions): void {
    const isHost = this.hostSessionId.length === 0;
    const slot = this.resolveNextSlot();
    if (slot === null) throw new Error("Lobby full");
    if (!isHost && normalizeLobbyCode(options.code) !== this.state.code) throw new Error("Invalid lobby code");

    const name = toPlayerName(options.playerName, isHost ? "Nadiyah" : "Rival");
    const teamId = slot === 0 ? "blue" : "red";
    const fighter = createFighter(client.sessionId, slot, name, teamId, isHost, false);
    if (isHost) {
      this.hostSessionId = client.sessionId;
      this.state.hostName = name;
    }
    this.sim.fighters[client.sessionId] = fighter;
    this.state.players.set(client.sessionId, new FighterState());
    if (this.practiceBotEnabled && isHost) this.addPracticeBot();
    this.syncStateFromSim();
    this.syncLobbyMetadata();
  }

  onLeave(client: Client): void {
    const fighter = this.sim.fighters[client.sessionId];
    if (!fighter) return;
    fighter.connected = false;
    fighter.ready = false;
    this.lastInputs.delete(client.sessionId);
    this.lastSeqBySession.delete(client.sessionId);
    if (this.state.roundState === "waiting") {
      delete this.sim.fighters[client.sessionId];
      this.state.players.delete(client.sessionId);
      this.promoteHostIfNeeded();
    }
    this.syncStateFromSim();
    this.syncLobbyMetadata();
  }

  onDispose(): void {
    removeLobby(this.state.code);
  }

  private registerHandlers(): void {
    this.onMessage(CLIENT_MESSAGES.INPUT, (client, payload: InputPayload) => this.handleInput(client.sessionId, payload));
    this.onMessage(CLIENT_MESSAGES.SET_READY, (client, payload: SetReadyPayload) => this.handleReady(client.sessionId, payload));
    this.onMessage(CLIENT_MESSAGES.REMATCH, () => this.handleRematch());
    this.onMessage(CLIENT_MESSAGES.SELECT_CHARACTER, () => undefined);
    this.onMessage(CLIENT_MESSAGES.SELECT_TEAM, () => undefined);
  }

  private handleInput(sessionId: string, payload: InputPayload): void {
    const fighter = this.sim.fighters[sessionId];
    if (!fighter || this.state.roundState !== "active") return;
    const seq = Number(payload?.seq ?? 0);
    const lastSeq = this.lastSeqBySession.get(sessionId) ?? 0;
    if (!Number.isFinite(seq) || seq <= lastSeq || seq - lastSeq > 120) return;
    const input = {
      seq: Math.trunc(seq),
      clientTick: Math.trunc(Number(payload?.clientTick ?? 0)),
      buttons: Math.trunc(Number(payload?.buttons ?? 0)),
    };
    this.lastSeqBySession.set(sessionId, input.seq);
    this.lastInputs.set(sessionId, input);
  }

  private handleReady(sessionId: string, payload: SetReadyPayload): void {
    const fighter = this.sim.fighters[sessionId];
    if (!fighter || this.state.roundState !== "waiting") return;
    fighter.ready = payload?.ready === true;
    if (this.practiceBotEnabled && this.sim.fighters[BOT_SESSION_ID]) this.sim.fighters[BOT_SESSION_ID].ready = true;
    const fighters = Object.values(this.sim.fighters).filter((candidate) => candidate.connected || candidate.isBot);
    if (fighters.length >= 2 && fighters.every((candidate) => candidate.ready)) {
      startCountdown(this.sim);
    }
    this.syncStateFromSim();
    this.syncLobbyMetadata();
  }

  private handleRematch(): void {
    if (this.state.roundState !== "roundEnd") return;
    rematch(this.sim);
    if (this.practiceBotEnabled && !this.sim.fighters[BOT_SESSION_ID]) this.addPracticeBot();
    this.syncStateFromSim();
    this.syncLobbyMetadata();
  }

  private fixedTick(): void {
    const inputs: StepInputs = {};
    for (const [sessionId, input] of this.lastInputs) inputs[sessionId] = input;
    this.updatePracticeBotInput(inputs);
    const events = stepMatch(this.sim, inputs);
    this.syncStateFromSim();
    for (const event of events) this.broadcast(SERVER_MESSAGES.COMBAT_EVENT, event);
    if (this.sim.roundState === "roundEnd" && this.sim.roundEndTicks === ROUND.roundEndTicks - 1) {
      this.broadcast(SERVER_MESSAGES.ROUND_EVENT, { winnerTeamId: this.sim.winnerTeamId, roundIndex: this.sim.roundIndex });
    }
    if (this.sim.serverTick % SIMULATION.tickHz === 0) this.syncLobbyMetadata();
  }

  private updatePracticeBotInput(inputs: StepInputs): void {
    const bot = this.sim.fighters[BOT_SESSION_ID];
    if (!bot || this.sim.roundState !== "active") return;
    const opponent = Object.values(this.sim.fighters).find((fighter) => !fighter.isBot && fighter.hp > 0);
    if (!opponent) return;
    let buttons = 0;
    const distance = opponent.x - bot.x;
    if (Math.abs(distance) > 92) buttons |= distance > 0 ? INPUT_BITS.right : INPUT_BITS.left;
    else if (this.sim.serverTick >= this.botNextAttackTick) {
      buttons |= this.sim.serverTick % 2 === 0 ? INPUT_BITS.light : INPUT_BITS.kick;
      this.botNextAttackTick = this.sim.serverTick + 42;
    } else if (Math.abs(distance) < 68) {
      buttons |= INPUT_BITS.block;
    }
    inputs[BOT_SESSION_ID] = { seq: this.sim.serverTick, clientTick: this.sim.serverTick, buttons };
  }

  private addPracticeBot(): void {
    if (this.sim.fighters[BOT_SESSION_ID]) return;
    const bot = createFighter(BOT_SESSION_ID, 1, "Practice Rival", "red", false, true);
    bot.ready = true;
    this.sim.fighters[BOT_SESSION_ID] = bot;
    this.state.players.set(BOT_SESSION_ID, new FighterState());
  }

  private resolveNextSlot(): number | null {
    const used = new Set(Object.values(this.sim.fighters).map((fighter) => fighter.slot));
    for (const slot of [0, 1]) if (!used.has(slot)) return slot;
    return null;
  }

  private promoteHostIfNeeded(): void {
    if (this.hostSessionId && this.sim.fighters[this.hostSessionId]) return;
    const next = Object.values(this.sim.fighters).find((fighter) => !fighter.isBot);
    this.hostSessionId = next?.id ?? "";
    if (next) {
      next.isHost = true;
      this.state.hostName = next.name;
    }
  }

  private syncStateFromSim(): void {
    this.state.roundState = this.sim.roundState;
    this.state.mode = this.sim.mode;
    this.state.serverTick = this.sim.serverTick;
    this.state.roundIndex = this.sim.roundIndex;
    this.state.countdownTicks = this.sim.countdownTicks;
    this.state.roundTicksRemaining = this.sim.roundTicksRemaining;
    this.state.roundEndTicks = this.sim.roundEndTicks;
    this.state.winnerTeamId = this.sim.winnerTeamId;
    this.state.stageId = this.sim.stageId;
    for (const id of Array.from(this.state.players.keys())) {
      if (!this.sim.fighters[id]) this.state.players.delete(id);
    }
    for (const id of Object.keys(this.sim.fighters)) {
      if (!this.state.players.has(id)) this.state.players.set(id, new FighterState());
      const schema = this.state.players.get(id);
      if (schema) schemaFromSim(schema, id, this);
    }
  }

  private syncLobbyMetadata(): void {
    const connectedPlayers = Object.values(this.sim.fighters).filter((fighter) => !fighter.isBot && fighter.connected).length;
    upsertLobby({
      roomId: this.roomId,
      code: this.state.code,
      hostName: this.state.hostName,
      playerCount: connectedPlayers,
      maxPlayers: this.maxClients,
      roundState: this.state.roundState,
      mode: this.state.mode,
      private: this.privateLobby,
    });
  }
}

export const resetRoomFighterForTests = resetFighterForRound;
export type FightCombatEvent = CombatEvent;
