export const CLIENT_MESSAGES = {
  INPUT: "input",
  SET_READY: "setReady",
  REMATCH: "rematch",
  SELECT_CHARACTER: "selectCharacter",
  SELECT_TEAM: "selectTeam",
} as const;

export const SERVER_MESSAGES = {
  COMBAT_EVENT: "combatEvent",
  ROUND_EVENT: "roundEvent",
  CORRECTION: "correction",
  ERROR: "errorMessage",
} as const;
