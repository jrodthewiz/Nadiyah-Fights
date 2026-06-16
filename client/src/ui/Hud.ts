import type { LobbyInfo, RoundState } from "@shared/game/types";

type FighterView = {
  id: string;
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

export type HudSnapshot = {
  connected: boolean;
  connecting: boolean;
  status: string;
  code: string;
  roundState: RoundState | "offline";
  winnerTeamId: string;
  roundTicksRemaining: number;
  localSessionId: string;
  fighters: FighterView[];
  lobbies: LobbyInfo[];
};

type HudCallbacks = {
  hostLobby: (name: string) => void;
  practiceBot: (name: string) => void;
  joinLobby: (code: string, name: string) => void;
  refreshLobbies: () => void;
  setReady: () => void;
  rematch: () => void;
};

const emptySnapshot: HudSnapshot = {
  connected: false,
  connecting: false,
  status: "Offline",
  code: "------",
  roundState: "offline",
  winnerTeamId: "",
  roundTicksRemaining: 0,
  localSessionId: "",
  fighters: [],
  lobbies: [],
};

export class Hud {
  private readonly root: HTMLElement;
  private callbacks: HudCallbacks | null = null;
  private lobbyKey = "";

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = "hud";
    this.root.innerHTML = this.markup();
    this.bind();
    this.render(emptySnapshot);
  }

  setCallbacks(callbacks: HudCallbacks): void {
    this.callbacks = callbacks;
  }

  render(snapshot: HudSnapshot): void {
    const local = snapshot.fighters.find((fighter) => fighter.id === snapshot.localSessionId) ?? null;
    const blue = snapshot.fighters.find((fighter) => fighter.teamId === "blue") ?? null;
    const red = snapshot.fighters.find((fighter) => fighter.teamId === "red") ?? null;
    const active = snapshot.connected && snapshot.roundState !== "offline";
    this.root.dataset.roundState = snapshot.roundState;
    this.root.dataset.connected = String(snapshot.connected);
    this.root.dataset.localX = String(Math.round(local?.x ?? 0));
    this.root.dataset.localHp = String(Math.round(local?.hp ?? 0));
    this.root.dataset.blueHp = String(Math.round(blue?.hp ?? 0));
    this.root.dataset.redHp = String(Math.round(red?.hp ?? 0));
    this.root.dataset.fighterCount = String(snapshot.fighters.length);

    this.text("statusText", snapshot.status);
    this.text("roomCode", snapshot.code || "------");
    this.text("roundState", snapshot.roundState.toUpperCase());
    this.text("timerText", snapshot.roundTicksRemaining > 0 ? String(Math.ceil(snapshot.roundTicksRemaining / 60)) : "--");
    this.text("blueName", blue ? blue.name : "Waiting");
    this.text("redName", red ? red.name : "Waiting");
    this.text("blueHpText", `${Math.round(blue?.hp ?? 0)} HP`);
    this.text("redHpText", `${Math.round(red?.hp ?? 0)} HP`);
    this.text("blueWins", `${blue?.wins ?? 0}`);
    this.text("redWins", `${red?.wins ?? 0}`);
    this.bar("blueHpBar", blue?.hp ?? 0);
    this.bar("redHpBar", red?.hp ?? 0);
    this.bar("blueMeterBar", blue?.meter ?? 0);
    this.bar("redMeterBar", red?.meter ?? 0);
    this.text("waitingText", snapshot.fighters.length < 2 ? "Waiting for a rival." : "Both fighters must mark ready.");
    this.text("winnerText", snapshot.winnerTeamId ? `${snapshot.winnerTeamId.toUpperCase()} wins` : "Round complete");
    this.text("readyButtonLabel", local?.ready ? "Ready" : "Mark Ready");

    this.toggle("lobbyPanel", !active);
    this.toggle("activeHud", active);
    this.toggle("waitingPanel", snapshot.connected && snapshot.roundState === "waiting");
    this.toggle("endedPanel", snapshot.connected && snapshot.roundState === "roundEnd");
    this.toggle("countdownBanner", snapshot.connected && snapshot.roundState === "countdown");
    this.toggle("fightBanner", snapshot.connected && snapshot.roundState === "active");
    this.renderLobbies(snapshot.lobbies);
  }

  private markup(): string {
    return `
      <section id="lobbyPanel" class="lobby-panel">
        <div class="fight-ticket" aria-hidden="true">
          <span>Underground Card</span>
          <strong>01</strong>
        </div>
        <div class="brand-lockup">
          <div class="brand-mark">NF</div>
          <div>
            <h1>Nadiyah Fights</h1>
            <p>Fast hands. Clean reads. One round at a time.</p>
          </div>
        </div>
        <div class="status-pill" id="statusText">Offline</div>
        <div class="fighter-card-preview" aria-hidden="true">
          <div class="portrait-disc">N</div>
          <div>
            <strong>Nadiyah</strong>
            <span>Teal sash · hand-to-hand · duel ready</span>
          </div>
        </div>
        <label class="field-label">Fighter name<input id="playerNameInput" maxlength="18" value="Nadiyah" /></label>
        <div class="command-grid">
          <button id="hostButton" type="button">Host Lobby</button>
          <button id="practiceButton" type="button">Practice Bot</button>
          <button id="refreshButton" type="button">Browse Lobbies</button>
        </div>
        <label class="field-label">Lobby code<input id="joinCodeInput" maxlength="8" placeholder="ABC123" /></label>
        <button id="joinButton" class="wide-command" type="button">Join By Code</button>
        <div class="lobby-list">
          <div class="lobby-list-title">Open Lobbies</div>
          <div id="lobbyListRows" class="lobby-list-rows"></div>
        </div>
      </section>

      <section id="activeHud" class="active-hud">
        <div class="top-strip">
          <div class="fighter-card blue-card">
            <strong id="blueName">Waiting</strong><span id="blueHpText">0 HP</span>
            <div class="meter hp"><span id="blueHpBar"></span></div>
            <div class="meter power"><span id="blueMeterBar"></span></div>
            <small>Wins <b id="blueWins">0</b></small>
          </div>
          <div class="round-chip">
            <span id="roundState">WAITING</span>
            <strong id="timerText">--</strong>
            <small id="roomCode">------</small>
          </div>
          <div class="fighter-card red-card">
            <strong id="redName">Waiting</strong><span id="redHpText">0 HP</span>
            <div class="meter hp"><span id="redHpBar"></span></div>
            <div class="meter power"><span id="redMeterBar"></span></div>
            <small>Wins <b id="redWins">0</b></small>
          </div>
        </div>
        <div class="controls-chip">A/D move · W/Space jump · Shift dash · S block · J light · K heavy · L kick</div>
      </section>

      <section id="waitingPanel" class="match-panel">
        <p id="waitingText">Waiting for a rival.</p>
        <button id="readyButton" type="button"><span id="readyButtonLabel">Mark Ready</span></button>
      </section>
      <div id="countdownBanner" class="event-banner">Ready?</div>
      <div id="fightBanner" class="event-banner fight">Fight</div>
      <section id="endedPanel" class="match-panel ended-panel">
        <h2 id="winnerText">Round complete</h2>
        <button id="rematchButton" type="button">Rematch</button>
      </section>
    `;
  }

  private bind(): void {
    this.byId("hostButton")?.addEventListener("click", () => this.callbacks?.hostLobby(this.playerName()));
    this.byId("practiceButton")?.addEventListener("click", () => this.callbacks?.practiceBot(this.playerName()));
    this.byId("refreshButton")?.addEventListener("click", () => this.callbacks?.refreshLobbies());
    this.byId("joinButton")?.addEventListener("click", () => this.callbacks?.joinLobby(this.joinCode(), this.playerName()));
    this.byId("readyButton")?.addEventListener("click", () => this.callbacks?.setReady());
    this.byId("rematchButton")?.addEventListener("click", () => this.callbacks?.rematch());
  }

  private renderLobbies(lobbies: LobbyInfo[]): void {
    const key = lobbies.map((lobby) => `${lobby.code}:${lobby.playerCount}:${lobby.maxPlayers}:${lobby.roundState}`).join("|");
    if (key === this.lobbyKey) return;
    this.lobbyKey = key;
    const container = this.byId("lobbyListRows");
    if (!container) return;
    container.replaceChildren();
    if (lobbies.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-list";
      empty.textContent = "No open lobbies yet.";
      container.appendChild(empty);
      return;
    }
    for (const lobby of lobbies) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "lobby-row";
      row.innerHTML = `<strong>${lobby.code}</strong><span>${lobby.hostName}</span><em>${lobby.playerCount}/${lobby.maxPlayers}</em>`;
      row.addEventListener("click", () => this.callbacks?.joinLobby(lobby.code, this.playerName()));
      container.appendChild(row);
    }
  }

  private playerName(): string {
    return this.byId<HTMLInputElement>("playerNameInput")?.value.trim() || "Nadiyah";
  }

  private joinCode(): string {
    return this.byId<HTMLInputElement>("joinCodeInput")?.value.trim() || "";
  }

  private text(id: string, value: string): void {
    const element = this.byId(id);
    if (element) element.textContent = value;
  }

  private bar(id: string, value: number): void {
    const element = this.byId<HTMLElement>(id);
    if (element) element.style.width = `${Math.max(0, Math.min(100, value))}%`;
  }

  private toggle(id: string, visible: boolean): void {
    const element = this.byId<HTMLElement>(id);
    if (element) element.hidden = !visible;
  }

  private byId<T extends HTMLElement = HTMLElement>(id: string): T | null {
    return this.root.querySelector<T>(`#${id}`);
  }
}
