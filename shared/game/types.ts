export type MatchMode = "duel" | "teams" | "ffa";
export type RoundState = "waiting" | "countdown" | "active" | "roundEnd";
export type TeamId = "blue" | "red" | string;
export type Facing = -1 | 1;
export type FighterAction = "idle" | "walk" | "jump" | "dash" | "attack" | "block" | "hitstun" | "blockstun" | "knockdown" | "ko";
export type AttackId = "light" | "heavy" | "kick";

export type InputPayload = {
  seq: number;
  clientTick: number;
  buttons: number;
};

export type SetReadyPayload = {
  ready: boolean;
};

export type CreateFightRoomOptions = {
  hostName?: string;
  playerName?: string;
  private?: boolean;
  mode?: MatchMode;
  maxPlayers?: 2 | 4 | 6 | 8;
  stageId?: string;
  bot?: boolean;
};

export type JoinFightRoomOptions = {
  code?: string;
  playerName?: string;
  spectator?: boolean;
};

export type LobbyInfo = {
  roomId: string;
  code: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  roundState: RoundState;
  mode: MatchMode;
  private: boolean;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FrameBox = Rect & {
  frame: number;
};

export type AttackDef = {
  id: AttackId;
  label: string;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  blockDamage: number;
  hitstun: number;
  blockstun: number;
  knockbackX: number;
  knockbackY: number;
  cooldown: number;
  hitboxes: FrameBox[];
};

export type FighterSimState = {
  id: string;
  slot: number;
  teamId: TeamId;
  name: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: Facing;
  grounded: boolean;
  hp: number;
  meter: number;
  stocks: number;
  action: FighterAction;
  actionFrame: number;
  attackId: AttackId | "";
  attackSeq: number;
  cooldownTicks: number;
  dashTicks: number;
  dashCooldownTicks: number;
  hitstunTicks: number;
  blockstunTicks: number;
  invulnTicks: number;
  inputAck: number;
  lastEventSeq: number;
  wins: number;
};

export type MatchSimState = {
  serverTick: number;
  roundState: RoundState;
  mode: MatchMode;
  stageId: string;
  roundIndex: number;
  countdownTicks: number;
  roundTicksRemaining: number;
  roundEndTicks: number;
  winnerTeamId: string;
  eventSeq: number;
  fighters: Record<string, FighterSimState>;
};

export type CombatEventType = "hit" | "block" | "ko" | "dash" | "land" | "whiff" | "roundStart" | "roundEnd";

export type CombatEvent = {
  seq: number;
  tick: number;
  type: CombatEventType;
  sourceId: string;
  targetId: string;
  x: number;
  y: number;
};
