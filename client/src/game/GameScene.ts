import Phaser from "phaser";
import { Room } from "@colyseus/sdk";
import { ARENA } from "@shared/game/constants";
import { INPUT_BITS } from "@shared/game/input";
import { CLIENT_MESSAGES } from "@shared/game/messages";
import type { CombatEvent, FighterAction, InputPayload } from "@shared/game/types";
import {
  defaultFrameName,
  frameFor,
  preloadCharacterSheets,
  registerCharacterSheets,
  textureKeyFor,
  VARIANT_TINTS,
  variantForFighter,
  type CharacterVariantId,
} from "./characterSprites";

type FighterView = {
  id: string;
  name: string;
  teamId: string;
  x: number;
  y: number;
  vx: number;
  facing: number;
  hp: number;
  action: FighterAction;
  actionFrame: number;
  attackId: string;
  isBot?: boolean;
};

type RoomLike = Room<unknown> & {
  state: {
    roundState?: string;
    serverTick?: number;
    players?: Map<string, FighterView> | { forEach: (callback: (value: FighterView, key: string) => void) => void };
  };
};

type ControlKeys = {
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
  jump: Phaser.Input.Keyboard.Key[];
  block: Phaser.Input.Keyboard.Key[];
  light: Phaser.Input.Keyboard.Key[];
  heavy: Phaser.Input.Keyboard.Key[];
  kick: Phaser.Input.Keyboard.Key[];
  dash: Phaser.Input.Keyboard.Key[];
};

type AnimationClock = {
  action: FighterAction;
  attackId: string;
  serverActionFrame: number;
  observedAt: number;
};

type LabActionId = "idle" | "walkForward" | "walkBack" | "jump" | "dash" | "light" | "heavy" | "kick" | "block" | "hitstun" | "knockdown" | "ko";

type LabAction = {
  id: LabActionId;
  label: string;
  action: FighterAction;
  attackId: "light" | "heavy" | "kick" | "";
  vx: number;
  duration: number;
};

const LAB_ACTIONS: LabAction[] = [
  { id: "idle", label: "Idle", action: "idle", attackId: "", vx: 0, duration: 48 },
  { id: "walkForward", label: "Walk Forward", action: "walk", attackId: "", vx: 260, duration: 48 },
  { id: "walkBack", label: "Walk Back", action: "walk", attackId: "", vx: -260, duration: 48 },
  { id: "jump", label: "Jump", action: "jump", attackId: "", vx: 0, duration: 42 },
  { id: "dash", label: "Dash", action: "dash", attackId: "", vx: 820, duration: 18 },
  { id: "light", label: "Jab", action: "attack", attackId: "light", vx: 0, duration: 18 },
  { id: "heavy", label: "Heavy Cross", action: "attack", attackId: "heavy", vx: 0, duration: 30 },
  { id: "kick", label: "Snap Kick", action: "attack", attackId: "kick", vx: 0, duration: 26 },
  { id: "block", label: "Guard", action: "block", attackId: "", vx: 0, duration: 20 },
  { id: "hitstun", label: "Hit Stun", action: "hitstun", attackId: "", vx: 0, duration: 18 },
  { id: "knockdown", label: "Knockdown", action: "knockdown", attackId: "", vx: 0, duration: 34 },
  { id: "ko", label: "KO", action: "ko", attackId: "", vx: 0, duration: 38 },
];

const LAB_VARIANTS: CharacterVariantId[] = ["nadiyah"];

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
  private animationClocks = new Map<string, AnimationClock>();
  private seq = 0;
  private lastButtons = -1;
  private currentButtons = 0;
  private nextSendAt = 0;
  private effects: Phaser.GameObjects.Graphics | null = null;
  private menuShowcase: Phaser.GameObjects.GameObject[] = [];
  private animationLabObjects: Phaser.GameObjects.GameObject[] = [];
  private animationLabSprite: Phaser.GameObjects.Sprite | null = null;
  private animationLabLabel: Phaser.GameObjects.Text | null = null;
  private animationLabMode = false;
  private animationLabActionIndex = 0;
  private animationLabVariantIndex = 0;
  private animationLabStartedAt = 0;
  private hitstopResumeAt = 0;
  private controlKeys: ControlKeys | null = null;

  constructor() {
    super("GameScene");
  }

  preload(): void {
    preloadCharacterSheets(this);
  }

  create(): void {
    registerCharacterSheets(this);
    this.drawArena();
    this.createMenuShowcase();
    this.effects = this.add.graphics();
    this.createControls();
    this.cameras.main.setBounds(0, 0, ARENA.width, ARENA.height);
    this.cameras.main.centerOn(ARENA.width / 2, ARENA.height / 2);
  }

  setRoom(room: RoomLike | null): void {
    this.room = room;
    this.seq = 0;
    this.lastButtons = -1;
    this.currentButtons = 0;
    this.sprites.clear();
    this.nameTags.clear();
    this.animationClocks.clear();
    this.children.list.filter((child) => child.getData?.("fighter") === true).forEach((child) => child.destroy());
  }

  setAnimationTestMode(enabled: boolean): void {
    this.animationLabMode = enabled;
    this.setMenuShowcaseVisible(!enabled && toFighters(this.room).length === 0);
    if (enabled) this.createAnimationLab();
    else this.destroyAnimationLab();
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
    if (event.type === "hit" || event.type === "ko") {
      this.cameras.main.flash(event.type === "ko" ? 110 : 60, 255, 232, 156);
      this.applyVisualHitstop(event.type === "ko" ? 70 : 45);
    }
  }

  update(time: number): void {
    this.sendInput(time);
    this.updateAnimationLab(time);
    this.renderFighters();
  }

  private drawArena(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x111821, 0x111821, 0x24162f, 0x06231f, 1);
    g.fillRect(0, 0, ARENA.width, ARENA.height);
    g.fillStyle(0x081012, 0.72);
    g.fillRoundedRect(82, 78, 1116, 130, 12);
    g.lineStyle(2, 0xf2c14e, 0.34);
    g.strokeRoundedRect(82, 78, 1116, 130, 12);
    g.fillStyle(0x0b0e13, 0.62);
    for (let index = 0; index < 24; index += 1) {
      const x = index * 58;
      const height = 36 + (index % 5) * 14;
      g.fillRect(x, ARENA.floorY - 114 - height, 44, height);
    }
    g.lineStyle(3, 0x11c5aa, 0.24);
    for (let index = 0; index < 12; index += 1) {
      const x = 120 + index * 96;
      g.beginPath();
      g.moveTo(x, 250);
      g.lineTo(x + 190, 98);
      g.strokePath();
    }
    g.fillStyle(0x18211e, 1);
    g.fillRect(0, ARENA.floorY, ARENA.width, ARENA.height - ARENA.floorY);
    g.fillGradientStyle(0x17231f, 0x17231f, 0x0d1413, 0x0d1413, 1);
    g.fillRect(0, ARENA.floorY + 4, ARENA.width, ARENA.height - ARENA.floorY - 4);
    g.lineStyle(4, 0xf2c14e, 0.85);
    g.lineBetween(ARENA.leftWall, ARENA.floorY, ARENA.rightWall, ARENA.floorY);
    g.lineStyle(1, 0x11c5aa, 0.25);
    for (let x = ARENA.leftWall; x <= ARENA.rightWall; x += 80) g.lineBetween(x, ARENA.floorY, x + 48, ARENA.floorY + 60);
    g.lineStyle(8, 0x111317, 0.7);
    g.strokeCircle(ARENA.width / 2, ARENA.floorY - 126, 86);
    g.lineStyle(3, 0xf2c14e, 0.5);
    g.strokeCircle(ARENA.width / 2, ARENA.floorY - 126, 72);
    this.add.text(ARENA.width / 2, 132, "NADIYAH FIGHTS", {
      fontFamily: "Impact, Arial Black, sans-serif",
      fontSize: "64px",
      color: "#f2c14e",
      stroke: "#050607",
      strokeThickness: 8,
    }).setOrigin(0.5).setAlpha(0.92);
    this.add.text(ARENA.width / 2, 194, "INKED HAND-TO-HAND TOURNAMENT", {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "18px",
      color: "#a7fff2",
      stroke: "#050607",
      strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0.82);
  }

  private createMenuShowcase(): void {
    const left = this.add.sprite(812, ARENA.floorY, textureKeyFor("nadiyah"), defaultFrameName).setOrigin(0.5, 1).setScale(1.08);
    const right = this.add.sprite(984, ARENA.floorY, textureKeyFor("nadiyah"), defaultFrameName).setOrigin(0.5, 1).setScale(1.08).setFlipX(true);
    left.play("fighter:nadiyah:idle");
    right.play("fighter:nadiyah:blockHigh");
    const leftName = this.add.text(812, ARENA.floorY - 252, "NADIYAH", {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "22px",
      color: "#a7fff2",
      stroke: "#050607",
      strokeThickness: 5,
    }).setOrigin(0.5);
    const rightName = this.add.text(984, ARENA.floorY - 252, "RIVAL", {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "22px",
      color: "#ff9daf",
      stroke: "#050607",
      strokeThickness: 5,
    }).setOrigin(0.5);
    const spark = this.add.circle(898, ARENA.floorY - 118, 20, 0xf2c14e, 0.34).setStrokeStyle(3, 0xffffff, 0.42);
    this.tweens.add({ targets: spark, scale: 1.55, alpha: 0.08, duration: 720, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.menuShowcase = [left, right, leftName, rightName, spark];
  }

  private setMenuShowcaseVisible(visible: boolean): void {
    for (const object of this.menuShowcase) {
      const item = object as unknown as Phaser.GameObjects.Components.Visible;
      item.setVisible(visible);
    }
  }

  private applyVisualHitstop(durationMs: number): void {
    const resumeAt = this.time.now + durationMs;
    this.hitstopResumeAt = Math.max(this.hitstopResumeAt, resumeAt);
    for (const sprite of this.sprites.values()) sprite.anims.pause();
    this.time.delayedCall(durationMs, () => {
      if (this.time.now < this.hitstopResumeAt) return;
      for (const sprite of this.sprites.values()) sprite.anims.resume();
    });
  }

  private renderFighters(): void {
    const fighters = toFighters(this.room);
    this.setMenuShowcaseVisible(fighters.length === 0 && !this.animationLabMode);
    const seen = new Set<string>();
    for (const fighter of fighters) {
      seen.add(fighter.id);
      let sprite = this.sprites.get(fighter.id);
      const variantId = variantForFighter();
      if (!sprite) {
        sprite = this.add.sprite(fighter.x, fighter.y - 80, textureKeyFor(variantId), defaultFrameName);
        sprite.setData("fighter", true);
        sprite.setData("variantId", variantId);
        sprite.setOrigin(0.5, 1);
        sprite.setScale(0.9);
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
      if (sprite.getData("variantId") !== variantId) {
        sprite.setTexture(textureKeyFor(variantId), defaultFrameName);
        sprite.setData("variantId", variantId);
      }
      sprite.x = Phaser.Math.Linear(sprite.x, fighter.x, 0.58);
      sprite.y = Phaser.Math.Linear(sprite.y, fighter.y, 0.58);
      sprite.setFlipX(fighter.facing < 0);
      sprite.setScale(0.9);
      sprite.setTint(VARIANT_TINTS[variantId]);
      if (sprite.anims.isPlaying) sprite.anims.stop();
      const predictedActionFrame = this.predictedActionFrame(fighter);
      sprite.setFrame(frameFor({
        action: fighter.action,
        actionFrame: predictedActionFrame,
        attackId: fighter.attackId as Parameters<typeof frameFor>[0]["attackId"],
        vx: fighter.vx,
        facing: fighter.facing,
      }));
      const label = this.nameTags.get(fighter.id);
      if (label) {
        label.x = sprite.x;
        label.y = sprite.y - 196;
        label.setText(fighter.name);
      }
    }
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
        this.animationClocks.delete(id);
        this.nameTags.get(id)?.destroy();
        this.nameTags.delete(id);
      }
    }
  }

  private predictedActionFrame(fighter: FighterView): number {
    const current = this.animationClocks.get(fighter.id);
    if (
      !current
      || current.action !== fighter.action
      || current.attackId !== fighter.attackId
      || current.serverActionFrame !== fighter.actionFrame
    ) {
      this.animationClocks.set(fighter.id, {
        action: fighter.action,
        attackId: fighter.attackId,
        serverActionFrame: fighter.actionFrame,
        observedAt: this.time.now,
      });
      return fighter.actionFrame;
    }
    const elapsedFrames = Math.floor((this.time.now - current.observedAt) / (1000 / 60));
    return fighter.actionFrame + elapsedFrames;
  }

  private createControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    this.controlKeys = {
      left: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT)],
      right: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT)],
      jump: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)],
      block: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)],
      light: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J)],
      heavy: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K)],
      kick: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L)],
      dash: [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)],
    };
    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
    ]);
    window.addEventListener("blur", () => {
      keyboard.resetKeys();
      this.sendButtons(0);
    });
    keyboard.on("keydown", (event: KeyboardEvent) => this.handleAnimationLabKey(event));
  }

  private createAnimationLab(): void {
    this.destroyAnimationLab();
    this.animationLabStartedAt = this.time.now;
    const variantId = LAB_VARIANTS[this.animationLabVariantIndex];
    const sprite = this.add.sprite(ARENA.width / 2, ARENA.floorY, textureKeyFor(variantId), defaultFrameName)
      .setOrigin(0.5, 1)
      .setScale(1.35)
      .setTint(VARIANT_TINTS[variantId]);
    const label = this.add.text(ARENA.width / 2, 272, "", {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "28px",
      color: "#f2c14e",
      stroke: "#050607",
      strokeThickness: 6,
      align: "center",
    }).setOrigin(0.5);
    const help = this.add.text(ARENA.width / 2, ARENA.floorY + 58, "1 Idle  2 Walk  3 Back  4 Jump  5 Dash  6 Jab  7 Heavy  8 Kick  9 Guard  0 Hit  R Knockdown  T KO  Q/E Variant", {
      fontFamily: "Arial, sans-serif",
      fontSize: "16px",
      color: "#f4efe2",
      stroke: "#050607",
      strokeThickness: 4,
      align: "center",
    }).setOrigin(0.5);
    this.animationLabSprite = sprite;
    this.animationLabLabel = label;
    this.animationLabObjects = [sprite, label, help];
  }

  private destroyAnimationLab(): void {
    for (const object of this.animationLabObjects) object.destroy();
    this.animationLabObjects = [];
    this.animationLabSprite = null;
    this.animationLabLabel = null;
  }

  private updateAnimationLab(time: number): void {
    if (!this.animationLabMode || !this.animationLabSprite) return;
    const labAction = LAB_ACTIONS[this.animationLabActionIndex];
    const variantId = LAB_VARIANTS[this.animationLabVariantIndex];
    const actionFrame = Math.floor((time - this.animationLabStartedAt) / (1000 / 60)) % labAction.duration;
    const jumpLift = labAction.id === "jump" ? Math.sin((actionFrame / labAction.duration) * Math.PI) * 120 : 0;
    const dashOffset = labAction.id === "dash" ? Math.min(90, actionFrame * 9) - 45 : 0;
    this.animationLabSprite
      .setTexture(textureKeyFor(variantId))
      .setFrame(frameFor({
        action: labAction.action,
        actionFrame,
        attackId: labAction.attackId,
        vx: labAction.vx,
        facing: 1,
      }))
      .setTint(VARIANT_TINTS[variantId])
      .setPosition((ARENA.width / 2) + dashOffset, ARENA.floorY - jumpLift);
    this.animationLabLabel?.setText(`${LAB_VARIANTS[this.animationLabVariantIndex].toUpperCase()} - ${labAction.label} - frame ${actionFrame}`);
  }

  private handleAnimationLabKey(event: KeyboardEvent): void {
    if (!this.animationLabMode) return;
    const indexByKey: Record<string, number> = {
      "1": 0,
      "2": 1,
      "3": 2,
      "4": 3,
      "5": 4,
      "6": 5,
      "7": 6,
      "8": 7,
      "9": 8,
      "0": 9,
      r: 10,
      t: 11,
    };
    const key = event.key.toLowerCase();
    if (key in indexByKey) {
      this.animationLabActionIndex = indexByKey[key];
      this.animationLabStartedAt = this.time.now;
    } else if (key === "q") {
      this.animationLabVariantIndex = (this.animationLabVariantIndex + LAB_VARIANTS.length - 1) % LAB_VARIANTS.length;
      this.animationLabStartedAt = this.time.now;
    } else if (key === "e") {
      this.animationLabVariantIndex = (this.animationLabVariantIndex + 1) % LAB_VARIANTS.length;
      this.animationLabStartedAt = this.time.now;
    }
  }

  private anyDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
    return keys.some((key) => key.isDown);
  }

  private sendInput(time: number): void {
    if (!this.room || this.room.state.roundState !== "active") return;
    if (!this.controlKeys) return;
    let buttons = 0;
    if (this.anyDown(this.controlKeys.left)) buttons |= INPUT_BITS.left;
    if (this.anyDown(this.controlKeys.right)) buttons |= INPUT_BITS.right;
    if (this.anyDown(this.controlKeys.jump)) buttons |= INPUT_BITS.jump;
    if (this.anyDown(this.controlKeys.block)) buttons |= INPUT_BITS.block;
    if (this.anyDown(this.controlKeys.light)) buttons |= INPUT_BITS.light;
    if (this.anyDown(this.controlKeys.heavy)) buttons |= INPUT_BITS.heavy;
    if (this.anyDown(this.controlKeys.kick)) buttons |= INPUT_BITS.kick;
    if (this.anyDown(this.controlKeys.dash)) buttons |= INPUT_BITS.dash;
    const pressed = buttons & ~this.currentButtons;
    if (buttons === this.lastButtons && pressed === 0 && time < this.nextSendAt) return;
    this.sendButtons(buttons, pressed);
    this.nextSendAt = time + 16;
  }

  private sendButtons(buttons: number, pressed = 0): void {
    if (!this.room || this.room.state.roundState !== "active") return;
    this.lastButtons = buttons;
    this.currentButtons = buttons;
    this.seq += 1;
    const payload: InputPayload = { seq: this.seq, clientTick: Number(this.room.state.serverTick ?? 0), buttons, pressed };
    this.room.send(CLIENT_MESSAGES.INPUT, payload);
  }
}
