import Phaser from "phaser";
import { Room } from "@colyseus/sdk";
import { ARENA } from "@shared/game/constants";
import { INPUT_BITS } from "@shared/game/input";
import { CLIENT_MESSAGES } from "@shared/game/messages";
import type { CombatEvent, FighterAction, InputPayload } from "@shared/game/types";
import { animationFor, defaultTextureKey, registerProceduralSprites } from "./proceduralSprites";

type FighterView = {
  id: string;
  name: string;
  teamId: string;
  x: number;
  y: number;
  facing: number;
  hp: number;
  action: FighterAction;
  attackId: string;
};

type RoomLike = Room<unknown> & {
  state: {
    roundState?: string;
    serverTick?: number;
    players?: Map<string, FighterView> | { forEach: (callback: (value: FighterView, key: string) => void) => void };
  };
};

const toFighters = (room: RoomLike | null): FighterView[] => {
  const players = room?.state.players;
  const fighters: FighterView[] = [];
  players?.forEach((value: FighterView, key: string) => {
    fighters.push({ ...value, id: key });
  });
  return fighters;
};

export class GameScene extends Phaser.Scene {
  private room: RoomLike | null = null;
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private nameTags = new Map<string, Phaser.GameObjects.Text>();
  private seq = 0;
  private lastButtons = -1;
  private nextSendAt = 0;
  private effects: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super("GameScene");
  }

  create(): void {
    registerProceduralSprites(this);
    this.drawArena();
    this.effects = this.add.graphics();
    this.cameras.main.setBounds(0, 0, ARENA.width, ARENA.height);
    this.cameras.main.centerOn(ARENA.width / 2, ARENA.height / 2);
  }

  setRoom(room: RoomLike | null): void {
    this.room = room;
    this.seq = 0;
    this.lastButtons = -1;
    this.sprites.clear();
    this.nameTags.clear();
    this.children.list.filter((child) => child.getData?.("fighter") === true).forEach((child) => child.destroy());
  }

  addCombatEvent(event: CombatEvent): void {
    if (!this.effects) return;
    const color = event.type === "block" ? 0x7dd3fc : event.type === "ko" ? 0xf43f5e : 0xfacc15;
    const ring = this.add.circle(event.x, event.y, event.type === "ko" ? 34 : 18, color, 0.7);
    ring.setStrokeStyle(3, 0xffffff, 0.7);
    this.tweens.add({
      targets: ring,
      scale: event.type === "ko" ? 2.2 : 1.8,
      alpha: 0,
      duration: 260,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    if (event.type === "hit" || event.type === "ko") this.cameras.main.shake(100, 0.004);
  }

  update(time: number): void {
    this.sendInput(time);
    this.renderFighters();
  }

  private drawArena(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x17202a, 0x17202a, 0x2d1b34, 0x10251f, 1);
    g.fillRect(0, 0, ARENA.width, ARENA.height);
    g.fillStyle(0x18211e, 1);
    g.fillRect(0, ARENA.floorY, ARENA.width, ARENA.height - ARENA.floorY);
    g.lineStyle(4, 0xf2c14e, 0.85);
    g.lineBetween(ARENA.leftWall, ARENA.floorY, ARENA.rightWall, ARENA.floorY);
    g.lineStyle(1, 0x11c5aa, 0.25);
    for (let x = ARENA.leftWall; x <= ARENA.rightWall; x += 80) g.lineBetween(x, ARENA.floorY, x + 48, ARENA.floorY + 60);
    g.fillStyle(0x0b1114, 0.55);
    g.fillRoundedRect(96, 92, 1088, 92, 8);
    this.add.text(ARENA.width / 2, 132, "NADIYAH FIGHTS", {
      fontFamily: "Impact, Arial Black, sans-serif",
      fontSize: "54px",
      color: "#f2c14e",
      stroke: "#050607",
      strokeThickness: 7,
    }).setOrigin(0.5);
  }

  private renderFighters(): void {
    const fighters = toFighters(this.room);
    const seen = new Set<string>();
    for (const fighter of fighters) {
      seen.add(fighter.id);
      let sprite = this.sprites.get(fighter.id);
      if (!sprite) {
        sprite = this.add.sprite(fighter.x, fighter.y - 80, defaultTextureKey);
        sprite.setData("fighter", true);
        sprite.setOrigin(0.5, 0.94);
        sprite.setScale(1.15);
        this.sprites.set(fighter.id, sprite);
        const label = this.add.text(fighter.x, fighter.y - 168, fighter.name, {
          fontFamily: "Arial, sans-serif",
          fontSize: "16px",
          color: fighter.teamId === "blue" ? "#74d7ff" : "#ff8ca3",
          stroke: "#050607",
          strokeThickness: 4,
        }).setOrigin(0.5);
        label.setData("fighter", true);
        this.nameTags.set(fighter.id, label);
      }
      sprite.x = Phaser.Math.Linear(sprite.x, fighter.x, 0.36);
      sprite.y = Phaser.Math.Linear(sprite.y, fighter.y, 0.36);
      sprite.setFlipX(fighter.facing < 0);
      sprite.setTint(fighter.teamId === "blue" ? 0xffffff : 0xffd5dc);
      const animKey = animationFor(fighter.action, fighter.attackId);
      if (sprite.anims.currentAnim?.key !== animKey) sprite.play(animKey, true);
      const label = this.nameTags.get(fighter.id);
      if (label) {
        label.x = sprite.x;
        label.y = sprite.y - 152;
        label.setText(`${fighter.name} ${Math.round(fighter.hp)}HP`);
      }
    }
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
        this.nameTags.get(id)?.destroy();
        this.nameTags.delete(id);
      }
    }
  }

  private sendInput(time: number): void {
    if (!this.room || this.room.state.roundState !== "active") return;
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    let buttons = 0;
    if (keyboard.addKey("A").isDown || keyboard.addKey("LEFT").isDown) buttons |= INPUT_BITS.left;
    if (keyboard.addKey("D").isDown || keyboard.addKey("RIGHT").isDown) buttons |= INPUT_BITS.right;
    if (keyboard.addKey("W").isDown || keyboard.addKey("UP").isDown || keyboard.addKey("SPACE").isDown) buttons |= INPUT_BITS.jump;
    if (keyboard.addKey("S").isDown || keyboard.addKey("DOWN").isDown) buttons |= INPUT_BITS.block;
    if (keyboard.addKey("J").isDown) buttons |= INPUT_BITS.light;
    if (keyboard.addKey("K").isDown) buttons |= INPUT_BITS.heavy;
    if (keyboard.addKey("L").isDown) buttons |= INPUT_BITS.kick;
    if (keyboard.addKey("SHIFT").isDown) buttons |= INPUT_BITS.dash;
    if (buttons === this.lastButtons && time < this.nextSendAt) return;
    this.lastButtons = buttons;
    this.nextSendAt = time + 50;
    this.seq += 1;
    const payload: InputPayload = { seq: this.seq, clientTick: Number(this.room.state.serverTick ?? 0), buttons };
    this.room.send(CLIENT_MESSAGES.INPUT, payload);
  }
}
