import { describe, expect, it, beforeEach } from "vitest";
import { clearLobbiesForTests, createLobbyCode, getLobby, listOpenLobbies, normalizeLobbyCode, upsertLobby } from "../../server/lobbies";

describe("lobby registry", () => {
  beforeEach(() => clearLobbiesForTests());

  it("normalizes lobby codes", () => {
    expect(normalizeLobbyCode(" ab-c 123 ! ")).toBe("ABC123");
  });

  it("creates unique lobby codes and lists only open public waiting lobbies", () => {
    const code = createLobbyCode();
    upsertLobby({ roomId: "room-1", code, hostName: "Nadiyah", playerCount: 1, maxPlayers: 2, roundState: "waiting", mode: "duel", private: false });
    upsertLobby({ roomId: "room-2", code: "SECRET", hostName: "Hidden", playerCount: 1, maxPlayers: 2, roundState: "waiting", mode: "duel", private: true });
    upsertLobby({ roomId: "room-3", code: "FULLUP", hostName: "Full", playerCount: 2, maxPlayers: 2, roundState: "waiting", mode: "duel", private: false });
    expect(getLobby(code)?.hostName).toBe("Nadiyah");
    expect(listOpenLobbies().map((lobby) => lobby.code)).toEqual([code]);
  });
});
