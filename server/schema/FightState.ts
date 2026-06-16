import { MapSchema, Schema, type } from "@colyseus/schema";
import type { FighterAction, MatchMode, RoundState } from "../../shared/game/types";

export class FighterState extends Schema {
  @type("number") slot = 0;
  @type("string") teamId = "blue";
  @type("string") name = "Fighter";
  @type("boolean") connected = true;
  @type("boolean") ready = false;
  @type("boolean") isHost = false;
  @type("boolean") isBot = false;
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") vx = 0;
  @type("number") vy = 0;
  @type("number") facing = 1;
  @type("boolean") grounded = true;
  @type("number") hp = 100;
  @type("number") meter = 0;
  @type("number") stocks = 1;
  @type("string") action: FighterAction = "idle";
  @type("number") actionFrame = 0;
  @type("string") attackId = "";
  @type("number") attackSeq = 0;
  @type("number") hitstunTicks = 0;
  @type("number") blockstunTicks = 0;
  @type("number") invulnTicks = 0;
  @type("number") inputAck = 0;
  @type("number") lastEventSeq = 0;
  @type("number") wins = 0;
}

export class FightState extends Schema {
  @type({ map: FighterState }) players = new MapSchema<FighterState>();
  @type("string") roundState: RoundState = "waiting";
  @type("string") mode: MatchMode = "duel";
  @type("string") code = "";
  @type("string") hostName = "Host";
  @type("number") serverTick = 0;
  @type("number") roundIndex = 1;
  @type("number") countdownTicks = 0;
  @type("number") roundTicksRemaining = 0;
  @type("number") roundEndTicks = 0;
  @type("string") winnerTeamId = "";
  @type("string") stageId = "training-yard";
}
