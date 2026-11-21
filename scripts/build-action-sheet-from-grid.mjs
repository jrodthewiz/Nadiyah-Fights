import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/build-action-sheet-from-grid.mjs <source-grid-image>");
  process.exit(1);
}

const outDir = path.join(root, "client", "src", "assets", "characters");
mkdirSync(outDir, { recursive: true });

const py = `
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageDraw
import json, os, sys

source = sys.argv[1]
out_dir = sys.argv[2]
src = Image.open(source).convert("RGBA")

src_cols, src_rows = 6, 4
src_w, src_h = src.width // src_cols, src.height // src_rows
frame_w, frame_h = 320, 256
columns, rows = 8, 10

animations = [
  ("idle", 6, True, 8, [0,1,2,1,0,1]),
  ("walkForward", 8, True, 13, [1,2,3,4,5,4,3,2]),
  ("walkBack", 8, True, 12, [2,1,0,1,2,3,2,1]),
  ("crouch", 3, False, 9, [18,19,20]),
  ("jump", 5, False, 11, [6,7,8,7,6]),
  ("dashForward", 5, False, 16, [9,10,11,10,9]),
  ("lightPunch", 5, False, 18, [3,4,5,4,3]),
  ("heavyPunch", 6, False, 15, [9,10,11,10,9,1]),
  ("kick", 6, False, 15, [12,13,14,15,14,12]),
  ("blockHigh", 3, False, 10, [16,17,16]),
  ("hitStun", 4, False, 13, [18,19,20,19]),
  ("knockdown", 5, False, 12, [19,20,21,22,23]),
  ("getUp", 5, False, 12, [23,22,21,20,1]),
  ("victory", 6, True, 9, [0,1,2,1,0,2]),
  ("ko", 5, False, 10, [19,20,21,22,23]),
]

def chroma_to_alpha(img):
    img = img.convert("RGBA")
    px = img.load()
    out = Image.new("RGBA", img.size, (0,0,0,0))
    opx = out.load()
    for y in range(img.height):
        for x in range(img.width):
            r,g,b,a = px[x,y]
            greenish = g > 135 and g > r * 1.35 and g > b * 1.35
            if greenish:
                continue
            opx[x,y] = (r,g,b,a)
    alpha = out.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.35))
    out.putalpha(alpha)
    return out

def connected_bbox(alpha, expected_center):
    w, h = alpha.size
    pix = alpha.load()
    seen = bytearray(w*h)
    best = None
    for yy in range(h):
        for xx in range(w):
            idx = yy*w+xx
            if seen[idx] or pix[xx,yy] < 16:
                continue
            stack = [(xx,yy)]
            seen[idx] = 1
            minx=maxx=xx
            miny=maxy=yy
            area = 0
            while stack:
                x,y = stack.pop()
                area += 1
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
                for nx,ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    nidx = ny*w+nx
                    if seen[nidx] or pix[nx,ny] < 16:
                        continue
                    seen[nidx] = 1
                    stack.append((nx,ny))
            if area < 80:
                continue
            cx = (minx + maxx) / 2
            cy = (miny + maxy) / 2
            dist = ((cx - expected_center[0]) ** 2 + (cy - expected_center[1]) ** 2) ** 0.5
            score = area - dist * 18
            if best is None or score > best[0]:
                best = (score, (minx, miny, maxx + 1, maxy + 1))
    return None if best is None else best[1]

def extract(index):
    col = index % src_cols
    row = index // src_cols
    margin = 96
    raw_left = col * src_w
    raw_top = row * src_h
    crop_left = max(0, raw_left - margin)
    crop_top = max(0, raw_top - margin)
    crop_right = min(src.width, (col + 1) * src_w + margin)
    crop_bottom = min(src.height, (row + 1) * src_h + margin)
    cell = src.crop((crop_left, crop_top, crop_right, crop_bottom))
    cell = chroma_to_alpha(cell)
    expected_center = (raw_left + src_w / 2 - crop_left, raw_top + src_h / 2 - crop_top)
    bbox = connected_bbox(cell.getchannel("A"), expected_center)
    if not bbox:
        return Image.new("RGBA", (frame_w, frame_h), (0,0,0,0))
    pad = 10
    l,t,r,b = bbox
    l=max(0,l-pad); t=max(0,t-pad); r=min(cell.width,r+pad); b=min(cell.height,b+pad)
    subject = cell.crop((l,t,r,b))
    subject.thumbnail((int(frame_w*0.9), int(frame_h*0.93)), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (frame_w, frame_h), (0,0,0,0))
    x = (frame_w - subject.width)//2
    y = frame_h - subject.height - 2
    out.alpha_composite(subject, (x,y))
    return out

source_frames = [extract(i) for i in range(src_cols*src_rows)]
sheet = Image.new("RGBA", (frame_w*columns, frame_h*rows), (0,0,0,0))
frames_by_anim = {}
frame_index = 0
for anim, count, loop, fps, source_map in animations:
    frames = []
    for i in range(count):
        cell = source_frames[source_map[i % len(source_map)]].copy()
        if anim in ("lightPunch", "heavyPunch", "kick") and i in (2,3):
            d = ImageDraw.Draw(cell, "RGBA")
            d.ellipse((frame_w-92, frame_h//2-24, frame_w-32, frame_h//2+36), outline=(242,193,78,210), width=4)
            d.line((frame_w-96, frame_h//2+6, frame_w-24, frame_h//2+6), fill=(31,255,224,170), width=4)
        col = frame_index % columns
        row = frame_index // columns
        sheet.alpha_composite(cell, (col*frame_w, row*frame_h))
        frames.append(f"{anim}_{i:02d}")
        frame_index += 1
    frames_by_anim[anim] = frames

sheet.save(os.path.join(out_dir, "nadiyah.png"))
manifest = {
  "version": 2,
  "frame": {"width": frame_w, "height": frame_h},
  "columns": columns,
  "rows": rows,
  "totalFrames": frame_index,
  "animationOrder": [a[0] for a in animations],
  "variants": [{
    "id": "nadiyah",
    "label": "Nadiyah",
    "sheet": "nadiyah.png",
    "frame": {"width": frame_w, "height": frame_h},
    "columns": columns,
    "rows": rows,
    "totalFrames": frame_index,
    "animations": {a[0]: {"frames": frames_by_anim[a[0]], "fps": a[3], "loop": a[2]} for a in animations}
  }]
}
with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
    f.write("\\n")
`;

const result = spawnSync("python", ["-", source, outDir], {
  input: py,
  encoding: "utf8",
  stdio: ["pipe", "pipe", "pipe"],
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.stdout.write(result.stdout);
  process.exit(result.status ?? 1);
}
