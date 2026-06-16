import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "client", "src", "assets", "characters");
mkdirSync(outDir, { recursive: true });

const frame = { width: 160, height: 192 };

const animations = [
  { key: "idle", frames: 6, loop: true, fps: 8 },
  { key: "walkForward", frames: 8, loop: true, fps: 13 },
  { key: "walkBack", frames: 8, loop: true, fps: 12 },
  { key: "crouch", frames: 3, loop: false, fps: 9 },
  { key: "jump", frames: 5, loop: false, fps: 11 },
  { key: "dashForward", frames: 5, loop: false, fps: 16 },
  { key: "lightPunch", frames: 5, loop: false, fps: 18 },
  { key: "heavyPunch", frames: 6, loop: false, fps: 15 },
  { key: "kick", frames: 6, loop: false, fps: 15 },
  { key: "blockHigh", frames: 3, loop: false, fps: 10 },
  { key: "hitStun", frames: 4, loop: false, fps: 13 },
  { key: "knockdown", frames: 5, loop: false, fps: 12 },
  { key: "getUp", frames: 5, loop: false, fps: 12 },
  { key: "victory", frames: 6, loop: true, fps: 9 },
  { key: "ko", frames: 5, loop: false, fps: 10 },
];

const variants = [
  {
    id: "nadiyah",
    label: "Nadiyah",
    ink: "#050607",
    accent: "#1fffe0",
    accent2: "#f2c14e",
    skin: "#111317",
    hair: "#050607",
    trim: "#0ea5a4",
    eye: "#fff7c2",
    stance: 1,
  },
  {
    id: "ember",
    label: "Ember",
    ink: "#070607",
    accent: "#ff6b35",
    accent2: "#ffd166",
    skin: "#15100d",
    hair: "#120807",
    trim: "#dc2626",
    eye: "#ffe4b5",
    stance: 1.04,
  },
  {
    id: "violet",
    label: "Violet",
    ink: "#070611",
    accent: "#c084fc",
    accent2: "#67e8f9",
    skin: "#120f1d",
    hair: "#090511",
    trim: "#7c3aed",
    eye: "#d9f99d",
    stance: 0.96,
  },
  {
    id: "frost",
    label: "Frost",
    ink: "#061014",
    accent: "#7dd3fc",
    accent2: "#f8fafc",
    skin: "#0c1720",
    hair: "#071015",
    trim: "#2563eb",
    eye: "#ecfeff",
    stance: 1.08,
  },
];

const totalFrames = animations.reduce((sum, animation) => sum + animation.frames, 0);
const columns = 8;
const rows = Math.ceil(totalFrames / columns);

const esc = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll("\"", "&quot;");
const round = (value) => Number(value.toFixed(2));

const pose = (animation, index, count) => {
  const t = count <= 1 ? 0 : index / (count - 1);
  const wave = Math.sin(t * Math.PI * 2);
  const strike = Math.sin(t * Math.PI);
  const p = {
    lean: 0,
    bob: 0,
    headTilt: 0,
    armFrontX: 46,
    armFrontY: -116,
    armBackX: -34,
    armBackY: -78,
    legFrontX: 30,
    legFrontY: -2,
    legBackX: -30,
    legBackY: -2,
    crouch: 0,
    down: 0,
    scarfX: -46,
    scarfY: -114,
    sashY: -88,
    trail: 0,
    spark: 0,
    guard: 0,
    sweat: 0,
  };

  if (animation === "idle") {
    p.bob = wave * 2;
    p.armFrontY += wave * 3;
    p.armBackY -= wave * 2;
    p.scarfY += wave * 2;
  } else if (animation === "walkForward" || animation === "walkBack") {
    const dir = animation === "walkForward" ? 1 : -1;
    p.lean = dir * 5;
    p.bob = Math.abs(wave) * 3;
    p.legFrontX = 30 + wave * 22 * dir;
    p.legBackX = -30 - wave * 22 * dir;
    p.armFrontX = 38 - wave * 15 * dir;
    p.armBackX = -34 + wave * 18 * dir;
  } else if (animation === "crouch") {
    p.crouch = 28 * strike + 12;
    p.down = p.crouch;
    p.armFrontX = 32;
    p.armFrontY = -82;
    p.armBackX = -25;
    p.armBackY = -68;
  } else if (animation === "jump") {
    p.down = -34 * strike;
    p.lean = 3;
    p.legFrontX = 18;
    p.legBackX = -22;
    p.legFrontY = -20;
    p.legBackY = -16;
    p.armFrontX = 36;
    p.armFrontY = -140;
    p.armBackX = -32;
    p.armBackY = -126;
  } else if (animation === "dashForward") {
    p.lean = 18;
    p.trail = 1;
    p.armFrontX = 58;
    p.armFrontY = -96;
    p.armBackX = -46;
    p.armBackY = -98;
    p.legFrontX = 44;
    p.legBackX = -42;
  } else if (animation === "lightPunch") {
    p.lean = 5 + strike * 4;
    p.armFrontX = 48 + strike * 42;
    p.armFrontY = -116 - strike * 8;
    p.armBackX = -32;
    p.armBackY = -82;
    p.spark = strike;
  } else if (animation === "heavyPunch") {
    p.lean = -8 + strike * 18;
    p.armFrontX = 34 + strike * 62;
    p.armFrontY = -122 - strike * 10;
    p.armBackX = -48 + strike * 10;
    p.armBackY = -86;
    p.legFrontX = 38;
    p.spark = strike;
  } else if (animation === "kick") {
    p.lean = -10 + strike * 6;
    p.armFrontX = 32;
    p.armFrontY = -106;
    p.legFrontX = 24 + strike * 68;
    p.legFrontY = -2 - strike * 48;
    p.legBackX = -38;
    p.spark = strike;
  } else if (animation === "blockHigh") {
    p.lean = -7;
    p.armFrontX = 26;
    p.armFrontY = -138;
    p.armBackX = 34;
    p.armBackY = -104;
    p.legFrontX = 22;
    p.legBackX = -34;
    p.guard = 1;
  } else if (animation === "hitStun") {
    p.lean = -18 - strike * 8;
    p.headTilt = -7;
    p.armFrontX = 22;
    p.armFrontY = -74;
    p.armBackX = -50;
    p.armBackY = -98;
    p.legFrontX = 20;
    p.sweat = strike;
  } else if (animation === "knockdown") {
    p.down = 42 * t;
    p.lean = -58 * t;
    p.headTilt = -20 * t;
    p.armFrontX = 20;
    p.armFrontY = -76 + 48 * t;
    p.armBackX = -42;
    p.armBackY = -78 + 44 * t;
    p.legFrontX = 54;
    p.legFrontY = -4 + 28 * t;
    p.legBackX = -44;
    p.legBackY = -2 + 24 * t;
  } else if (animation === "getUp") {
    const up = 1 - t;
    p.down = 40 * up;
    p.lean = -42 * up;
    p.armFrontX = 30;
    p.armFrontY = -86 + 36 * up;
    p.legFrontX = 34;
  } else if (animation === "victory") {
    p.bob = Math.abs(wave) * -4;
    p.armFrontX = 30;
    p.armFrontY = -152;
    p.armBackX = -28;
    p.armBackY = -136 + wave * 8;
    p.scarfX = -52 - Math.abs(wave) * 12;
  } else if (animation === "ko") {
    p.down = 52;
    p.lean = -88;
    p.headTilt = -22;
    p.armFrontX = 46;
    p.armFrontY = -40;
    p.armBackX = -42;
    p.armBackY = -42;
    p.legFrontX = 60;
    p.legFrontY = 0;
    p.legBackX = -58;
    p.legBackY = 0;
  }
  return p;
};

const line = (x1, y1, x2, y2, color, width = 10, cap = "round", opacity = 1) =>
  `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" opacity="${opacity}" />`;

const outlinedLine = (x1, y1, x2, y2, color, width = 10, cap = "round") => `
      ${line(x1, y1, x2, y2, "#000000", width + 5, cap, 0.78)}
      ${line(x1, y1, x2, y2, color, width, cap)}
      ${line(x1, y1 - 1, x2, y2 - 1, "rgba(255,255,255,0.16)", Math.max(2, width * 0.22), cap)}`;

const burst = (x, y, color, amount) => amount <= 0.08 ? "" : `
      ${line(x + 6, y - 2, x + 26, y - 15, color, 3, "round", 0.84)}
      ${line(x + 8, y + 5, x + 31, y + 7, color, 3, "round", 0.72)}
      ${line(x + 3, y + 9, x + 18, y + 24, color, 3, "round", 0.55)}
      <circle cx="${round(x + 20)}" cy="${round(y - 7)}" r="${round(2 + amount * 3)}" fill="${color}" opacity="0.75" />`;

const guardFlash = (x, y, color, enabled) => enabled ? `
      <path d="M ${round(x - 10)} ${round(y - 42)} C ${round(x + 42)} ${round(y - 26)}, ${round(x + 43)} ${round(y + 38)}, ${round(x - 6)} ${round(y + 49)}" fill="none" stroke="${color}" stroke-width="4" opacity="0.48" stroke-linecap="round" />
      <path d="M ${round(x - 3)} ${round(y - 32)} C ${round(x + 31)} ${round(y - 16)}, ${round(x + 30)} ${round(y + 26)}, ${round(x)} ${round(y + 38)}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.32" stroke-linecap="round" />` : "";

const frameSvg = (variant, animation, index, count) => {
  const p = pose(animation, index, count);
  const cx = frame.width / 2;
  const floor = frame.height - 16 + p.down;
  const stance = variant.stance ?? 1;
  const hip = { x: cx + p.lean * 0.2, y: floor - 62 - p.crouch * 0.55 + p.bob };
  const chest = { x: cx + p.lean, y: floor - 112 + p.crouch * 0.25 + p.bob };
  const head = { x: cx + p.lean + p.headTilt, y: floor - 144 + p.crouch * 0.28 + p.bob };
  const frontHand = { x: chest.x + p.armFrontX, y: chest.y + (p.armFrontY + 112) };
  const backHand = { x: chest.x + p.armBackX, y: chest.y + (p.armBackY + 112) };
  const frontFoot = { x: hip.x + p.legFrontX * stance, y: floor + p.legFrontY };
  const backFoot = { x: hip.x + p.legBackX * stance, y: floor + p.legBackY };
  const scarfEnd = { x: head.x + p.scarfX, y: head.y + (p.scarfY + 144) };
  const sashEnd = { x: chest.x + 26, y: chest.y + (p.sashY + 112) };

  return `
    <g>
      <ellipse cx="${round((backFoot.x + frontFoot.x) / 2)}" cy="${round(floor + 8)}" rx="${round(48 + Math.abs(p.lean) * 0.24)}" ry="7" fill="#000000" opacity="0.22" />
      ${p.trail ? `${line(head.x - 68, head.y + 9, head.x - 23, head.y + 9, variant.accent, 5, "round", 0.23)}
      ${line(chest.x - 82, chest.y + 4, chest.x - 22, chest.y + 2, variant.accent2, 4, "round", 0.18)}` : ""}
      ${line(head.x - 16, head.y + 9, scarfEnd.x, scarfEnd.y, "#000000", 12, "round", 0.56)}
      ${line(head.x - 16, head.y + 9, scarfEnd.x, scarfEnd.y, variant.accent, 7)}
      ${outlinedLine(head.x + 2, head.y + 20, chest.x, chest.y, variant.ink, 10)}
      ${outlinedLine(chest.x, chest.y, hip.x, hip.y, variant.ink, 12)}
      ${outlinedLine(chest.x, chest.y + 5, frontHand.x, frontHand.y, variant.ink, 10)}
      ${outlinedLine(chest.x - 2, chest.y + 8, backHand.x, backHand.y, variant.ink, 9)}
      ${outlinedLine(hip.x, hip.y, frontFoot.x, frontFoot.y, variant.ink, 10)}
      ${outlinedLine(hip.x, hip.y, backFoot.x, backFoot.y, variant.ink, 10)}
      ${line(chest.x - 20, chest.y + 17, sashEnd.x, sashEnd.y, "#000000", 10, "round", 0.54)}
      ${line(chest.x - 19, chest.y + 16, sashEnd.x, sashEnd.y, variant.accent, 6)}
      <circle cx="${round(head.x)}" cy="${round(head.y)}" r="22" fill="#000000" opacity="0.82" />
      <circle cx="${round(head.x)}" cy="${round(head.y)}" r="18.4" fill="${variant.hair}" />
      <path d="M ${round(head.x - 5)} ${round(head.y - 18)} C ${round(head.x - 25)} ${round(head.y - 25)}, ${round(head.x - 30)} ${round(head.y - 3)}, ${round(head.x - 15)} ${round(head.y + 13)}" fill="${variant.hair}" stroke="#000000" stroke-width="3" opacity="0.98" />
      <path d="M ${round(head.x - 9)} ${round(head.y - 24)} C ${round(head.x + 9)} ${round(head.y - 33)}, ${round(head.x + 23)} ${round(head.y - 17)}, ${round(head.x + 14)} ${round(head.y - 4)}" fill="${variant.trim}" opacity="0.85" />
      <circle cx="${round(head.x + 7)}" cy="${round(head.y - 3)}" r="3.8" fill="${variant.eye}" />
      <path d="M ${round(head.x + 2)} ${round(head.y + 8)} Q ${round(head.x + 8)} ${round(head.y + 12)}, ${round(head.x + 14)} ${round(head.y + 8)}" fill="none" stroke="${variant.accent2}" stroke-width="2" opacity="0.75" stroke-linecap="round" />
      <circle cx="${round(frontHand.x)}" cy="${round(frontHand.y)}" r="9.2" fill="#000000" opacity="0.72" />
      <circle cx="${round(frontHand.x)}" cy="${round(frontHand.y)}" r="6.4" fill="${variant.accent2}" />
      <circle cx="${round(backHand.x)}" cy="${round(backHand.y)}" r="8" fill="#000000" opacity="0.7" />
      <circle cx="${round(backHand.x)}" cy="${round(backHand.y)}" r="5.6" fill="${variant.accent}" />
      ${line(frontFoot.x - 9, frontFoot.y + 1, frontFoot.x + 13, frontFoot.y + 1, variant.accent2, 5)}
      ${line(backFoot.x - 10, backFoot.y + 1, backFoot.x + 12, backFoot.y + 1, variant.accent, 5)}
      ${guardFlash(frontHand.x + 3, frontHand.y + 3, variant.accent, p.guard)}
      ${burst(Math.max(frontHand.x, frontFoot.x), Math.min(frontHand.y, frontFoot.y), variant.accent2, p.spark)}
      ${p.sweat ? `<circle cx="${round(head.x + 23)}" cy="${round(head.y - 14)}" r="${round(2 + p.sweat * 2)}" fill="${variant.accent2}" opacity="0.8" />` : ""}
    </g>`;
};

const generateSheet = (variant) => {
  const frames = {};
  const cells = [];
  let frameIndex = 0;
  for (const animation of animations) {
    frames[animation.key] = [];
    for (let i = 0; i < animation.frames; i += 1) {
      const col = frameIndex % columns;
      const row = Math.floor(frameIndex / columns);
      const name = `${animation.key}_${String(i).padStart(2, "0")}`;
      frames[animation.key].push(name);
      cells.push(`<g transform="translate(${col * frame.width} ${row * frame.height})">
        <rect width="${frame.width}" height="${frame.height}" fill="transparent" />
        ${frameSvg(variant, animation.key, i, animation.frames)}
      </g>`);
      frameIndex += 1;
    }
  }
  const width = columns * frame.width;
  const height = rows * frame.height;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${esc(variant.label)} Combat Sprite Sheet</title>
  ${cells.join("\n")}
</svg>
`;
  writeFileSync(path.join(outDir, `${variant.id}.svg`), svg, "utf8");
  return {
    id: variant.id,
    label: variant.label,
    sheet: `${variant.id}.svg`,
    frame,
    columns,
    rows,
    totalFrames,
    animations: Object.fromEntries(animations.map((animation) => [animation.key, {
      frames: frames[animation.key],
      fps: animation.fps,
      loop: animation.loop,
    }])),
  };
};

const manifest = {
  version: 1,
  frame,
  columns,
  rows,
  totalFrames,
  animationOrder: animations.map(({ key }) => key),
  variants: variants.map(generateSheet),
};

writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
