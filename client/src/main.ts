import Phaser from "phaser";
import { Client, type Room } from "@colyseus/sdk";
import { ROOM_NAME } from "@shared/game/constants";
import { CLIENT_MESSAGES, SERVER_MESSAGES } from "@shared/game/messages";
import type { CombatEvent, LobbyInfo, RoundState, SetReadyPayload } from "@shared/game/types";
import "./styles.css";
import { GameScene } from "./game/GameScene";
import { Hud, type HudSnapshot } from "./ui/Hud";

const toWsUrl = (httpUrl: string): string => httpUrl.replace(/^http/, "ws");
const serverHttpUrl = import.meta.env.VITE_SERVER_URL ?? window.location.origin;

type FighterLike = {
  name: string;
  teamId: string;
  hp: number;
  meter: number;
  ready: boolean;
  isHost: boolean;
  isBot: boolean;
  x: number;
  action: string;
  wins: number;
};

type FightStateLike = {
  code?: string;
  roundState?: RoundState;
  winnerTeamId?: string;
  roundTicksRemaining?: number;
  players?: { forEach: (callback: (value: FighterLike, key: string) => void) => void };
};

class NadiyahApp {
  private readonly client = new Client(toWsUrl(serverHttpUrl));
  private readonly hud: Hud;
  private readonly game: Phaser.Game;
  private readonly scene: GameScene;
  private room: Room | null = null;
  private lobbies: LobbyInfo[] = [];
  private status = "Offline";
  private connecting = false;

  constructor() {
    const hudRoot = document.querySelector<HTMLElement>("#hud-root");
    if (!hudRoot) throw new Error("Missing #hud-root");
    this.hud = new Hud(hudRoot);
    this.scene = new GameScene();
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: "game-root",
      width: 1280,
      height: 720,
      backgroundColor: "#0d1216",
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [this.scene],
    });
    void this.game;
    this.hud.setCallbacks({
      hostLobby: (name) => void this.hostLobby(name),
      practiceBot: (name) => void this.practiceBot(name),
      joinLobby: (code, name) => void this.joinLobby(code, name),
      refreshLobbies: () => void this.refreshLobbies(),
      setReady: () => this.setReady(),
      rematch: () => this.rematch(),
    });
    void this.refreshLobbies();
    this.render();
  }

  private async hostLobby(playerName: string): Promise<void> {
    await this.connectingTask(async () => {
      const room = await this.client.create(ROOM_NAME, { playerName, hostName: playerName, mode: "duel", maxPlayers: 2 });
      this.attachRoom(room);
    }, "Hosting lobby...");
  }

  private async practiceBot(playerName: string): Promise<void> {
    await this.connectingTask(async () => {
      const room = await this.client.create(ROOM_NAME, { playerName, hostName: playerName, mode: "duel", maxPlayers: 2, bot: true, private: true });
      this.attachRoom(room);
    }, "Starting practice...");
  }

  private async joinLobby(code: string, playerName: string): Promise<void> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      this.status = "Enter a lobby code.";
      this.render();
      return;
    }
    await this.connectingTask(async () => {
      const response = await fetch(`${serverHttpUrl}/api/lobbies/${normalized}`);
      if (!response.ok) throw new Error("Lobby not found");
      const payload = await response.json() as { lobby?: LobbyInfo };
      const roomId = payload.lobby?.roomId;
      if (!roomId) throw new Error("Lobby unavailable");
      const room = await this.client.joinById(roomId, { code: normalized, playerName });
      this.attachRoom(room);
    }, "Joining lobby...");
  }

  private async refreshLobbies(): Promise<void> {
    try {
      const response = await fetch(`${serverHttpUrl}/api/lobbies`);
      const payload = await response.json() as { lobbies?: LobbyInfo[] };
      this.lobbies = payload.lobbies ?? [];
      this.status = this.room ? "Connected" : "Lobby list refreshed";
    } catch {
      this.status = "Lobby service unavailable";
    }
    this.render();
  }

  private setReady(): void {
    const payload: SetReadyPayload = { ready: true };
    this.room?.send(CLIENT_MESSAGES.SET_READY, payload);
  }

  private rematch(): void {
    this.room?.send(CLIENT_MESSAGES.REMATCH);
  }

  private attachRoom(room: Room): void {
    this.room?.leave();
    this.room = room;
    this.status = "Connected";
    this.scene.setRoom(room as Parameters<GameScene["setRoom"]>[0]);
    room.onMessage(SERVER_MESSAGES.COMBAT_EVENT, (event: CombatEvent) => this.scene.addCombatEvent(event));
    room.onLeave(() => {
      this.status = "Disconnected";
      this.room = null;
      this.scene.setRoom(null);
      this.render();
    });
    room.onError((_code, message) => {
      this.status = message || "Room error";
      this.render();
    });
    room.onStateChange(() => this.render());
    this.render();
  }

  private async connectingTask(task: () => Promise<void>, status: string): Promise<void> {
    this.connecting = true;
    this.status = status;
    this.render();
    try {
      await task();
    } catch (error) {
      this.status = error instanceof Error ? error.message : "Connection failed";
    } finally {
      this.connecting = false;
      this.render();
    }
  }

  private render(): void {
    const state = this.room?.state as FightStateLike | undefined;
    const fighters: HudSnapshot["fighters"] = [];
    state?.players?.forEach((fighter, id) => {
      fighters.push({ id, ...fighter });
    });
    this.hud.render({
      connected: this.room !== null,
      connecting: this.connecting,
      status: this.status,
      code: state?.code ?? "------",
      roundState: state?.roundState ?? "offline",
      winnerTeamId: state?.winnerTeamId ?? "",
      roundTicksRemaining: state?.roundTicksRemaining ?? 0,
      localSessionId: this.room?.sessionId ?? "",
      fighters,
      lobbies: this.lobbies,
    });
  }
}

new NadiyahApp();
