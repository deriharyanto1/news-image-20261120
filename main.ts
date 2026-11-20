// THE WORLD TODAY — front page for Friday, 20 November 2026.
// Draws the whole newspaper with a hand-rolled stroke font and a
// hand-rolled PNG encoder. Node 22 standard library only, no network.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";

// ---------------------------------------------------------------- font --
// One glyph = a list of polylines. Each point is on a 5-wide, 7-tall
// grid (x 0..4, y 0..6, y grows downwards). '9' is a top bowl plus a
// right stem, never a double loop, so it cannot read as '8'.
type Pt = [number, number];
type Glyph = Pt[][];
const FONT: Record<string, Glyph> = {
  A: [[[0, 6], [2, 0], [4, 6]], [[1, 4], [3, 4]]],
  B: [[[0, 0], [0, 6]], [[0, 0], [3, 0], [3, 3], [0, 3]], [[0, 3], [3, 3], [3, 6], [0, 6]]],
  C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]],
  D: [[[0, 0], [0, 6]], [[0, 0], [3, 0], [4, 1], [4, 5], [3, 6], [0, 6]]],
  E: [[[0, 0], [0, 6]], [[0, 0], [4, 0]], [[0, 3], [3, 3]], [[0, 6], [4, 6]]],
  F: [[[0, 0], [0, 6]], [[0, 0], [4, 0]], [[0, 3], [3, 3]]],
  G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3], [2, 3]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[1, 0], [3, 0]], [[2, 0], [2, 6]], [[1, 6], [3, 6]]],
  J: [[[1, 0], [3, 0]], [[3, 0], [3, 5], [2, 6], [1, 6], [0, 5]]],
  K: [[[0, 0], [0, 6]], [[4, 0], [0, 3], [4, 6]]],
  L: [[[0, 0], [0, 6]], [[0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 3], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  O: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  P: [[[0, 0], [0, 6]], [[0, 0], [3, 0], [4, 1], [4, 3], [3, 4], [0, 3]]],
  Q: [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[3, 4], [4, 6]]],
  R: [[[0, 0], [0, 6]], [[0, 0], [3, 0], [4, 1], [4, 3], [3, 4], [0, 3]], [[2, 3], [4, 6]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  W: [[[0, 0], [1, 6], [2, 3], [3, 6], [4, 0]]],
  X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
  Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
  "0": [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  "1": [[[1, 1], [2, 0], [2, 6]], [[0, 6], [4, 6]]],
  "2": [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 3], [0, 6], [4, 6]]],
  "3": [[[1, 0], [3, 0], [4, 1], [4, 2], [2, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  "4": [[[3, 0], [0, 4], [4, 4]], [[3, 0], [3, 6]]],
  "5": [[[4, 0], [0, 0], [0, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  "6": [[[4, 0], [3, 0], [1, 1], [0, 3], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3], [0, 3]]],
  "7": [[[0, 0], [4, 0], [2, 6]]],
  "8": [[[1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3], [0, 2], [0, 1], [1, 0]],
       [[1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5], [0, 4], [1, 3]]],
  "9": [[[1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3], [0, 2], [0, 1], [1, 0]], [[4, 1], [4, 6]]],
  ".": [[[2, 5], [2, 6]]],
  ",": [[[2, 5], [2, 6], [1, 7]]],
  ":": [[[2, 2], [2, 3]], [[2, 5], [2, 6]]],
  ";": [[[2, 2], [2, 3]], [[2, 5], [2, 6], [1, 7]]],
  "!": [[[2, 0], [2, 4]], [[2, 5], [2, 6]]],
  "?": [[[1, 0], [3, 0], [4, 1], [4, 2], [2, 3], [2, 4]], [[2, 6], [2, 6]]],
  "'": [[[2, 0], [2, 1], [1, 2]]],
  '"': [[[1, 0], [1, 2]], [[3, 0], [3, 2]]],
  "-": [[[0, 3], [4, 3]]],
  "(": [[[3, 0], [2, 1], [2, 5], [3, 6]]],
  ")": [[[1, 0], [2, 1], [2, 5], [1, 6]]],
  "/": [[[4, 0], [0, 6]]],
  "%": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], [[3, 5], [4, 5], [4, 6], [3, 6], [3, 5]], [[4, 0], [0, 6]]],
  "$": [[[2, 0], [2, 6]], [[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  "*": [[[2, 0], [2, 4]], [[0, 1], [4, 3]], [[4, 1], [0, 3]]],
  "+": [[[2, 1], [2, 5]], [[0, 3], [4, 3]]],
  "=": [[[0, 2], [4, 2]], [[0, 4], [4, 4]]],
  " ": [],
};

// ------------------------------------------------------------- canvas --
type RGB = [number, number, number];
const PAPER: RGB = [250, 246, 236];
const INK: RGB = [17, 17, 17];
const RED: RGB = [176, 30, 30];
const GREY: RGB = [90, 86, 78];

class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8Array;
  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
    this.fillRect(0, 0, w, h, bg);
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) {
        this.set(xx, yy, c);
      }
    }
  }
  disc(cx: number, cy: number, r: number, c: RGB): void {
    const rr = Math.ceil(r);
    for (let yy = -rr; yy <= rr; yy++) {
      for (let xx = -rr; xx <= rr; xx++) {
        if (xx * xx + yy * yy <= r * r) this.set(cx + xx, cy + yy, c);
      }
    }
  }
  // Bresenham line with a round brush of diameter `thick`.
  line(x0: number, y0: number, x1: number, y1: number, thick: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    const r = Math.max(0.5, thick / 2);
    for (;;) {
      this.disc(x, y, r, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }
  hline(x: number, y: number, w: number, thick: number, c: RGB): void {
    this.fillRect(x, y, w, thick, c);
  }
  vline(x: number, y: number, h: number, thick: number, c: RGB): void {
    this.fillRect(x, y, thick, h, c);
  }
  rect(x: number, y: number, w: number, h: number, thick: number, c: RGB): void {
    this.hline(x, y, w, thick, c);
    this.hline(x, y + h - thick, w, thick, c);
    this.vline(x, y, h, thick, c);
    this.vline(x + w - thick, y, h, thick, c);
  }
  // Width of `text` at `size`: every glyph advances 6 grid units.
  textWidth(text: string, size: number): number {
    return text.length * 6 * (size / 7);
  }
  // Draw `text` with its top at (x, y). Unknown glyphs are skipped.
  text(str: string, x: number, y: number, size: number, c: RGB): void {
    const unit = size / 7;
    const thick = Math.max(1, Math.round(size / 15));
    let cx = x;
    for (const ch of str) {
      const glyph = FONT[ch];
      if (glyph) {
        for (const poly of glyph) {
          for (let i = 0; i + 1 < poly.length; i++) {
            const [ax, ay] = poly[i];
            const [bx, by] = poly[i + 1];
            const x0 = Math.round(cx + ax * unit);
            const y0 = Math.round(y + ay * unit);
            const x1 = Math.round(cx + bx * unit);
            const y1 = Math.round(y + by * unit);
            if (x0 === x1 && y0 === y1) {
              this.disc(x0, y0, Math.max(0.5, thick / 2), c);
            } else {
              this.line(x0, y0, x1, y1, thick, c);
            }
          }
        }
      }
      cx += 6 * unit;
    }
  }
  textCentered(str: string, cx: number, y: number, size: number, c: RGB): void {
    const w = this.textWidth(str, size);
    this.text(str, Math.round(cx - w / 2), y, size, c);
  }
  // Greedy word wrap. Returns lines that each fit in maxW.
  wrap(str: string, maxW: number, size: number): string[] {
    const words = str.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const trial = cur === "" ? w : cur + " " + w;
      if (this.textWidth(trial, size) <= maxW || cur === "") {
        cur = trial;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur !== "") lines.push(cur);
    return lines;
  }
}

// -------------------------------------------------------- PNG encoder --
function crc32(buf: Buffer): number {
  let table = (crc32 as unknown as { t?: Int32Array }).t;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    (crc32 as unknown as { t: Int32Array }).t = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const stride = w * 3;
  const raw = Buffer.alloc(h * (stride + 1));
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const row = Buffer.from(rgb.subarray(y * stride, (y + 1) * stride));
    const candidates: Buffer[] = [];
    for (let f = 0; f < 5; f++) {
      const out = Buffer.alloc(stride);
      for (let i = 0; i < stride; i++) {
        const v = row[i];
        let pred = 0;
        if (f === 1) pred = i >= 3 ? row[i - 3] : 0;
        else if (f === 2) pred = prev[i];
        else if (f === 3) pred = ((i >= 3 ? row[i - 3] : 0) + prev[i]) >> 1;
        else if (f === 4) pred = paeth(i >= 3 ? row[i - 3] : 0, prev[i], i >= 3 ? prev[i - 3] : 0);
        out[i] = (v - pred) & 0xff;
      }
      candidates.push(out);
    }
    let best = 0;
    let bestScore = Infinity;
    for (let f = 0; f < 5; f++) {
      let score = 0;
      const c = candidates[f];
      for (let i = 0; i < stride; i++) {
        const s = c[i] >= 128 ? c[i] - 256 : c[i];
        score += Math.abs(s);
      }
      if (score < bestScore) { bestScore = score; best = f; }
    }
    raw[y * (stride + 1)] = best;
    candidates[best].copy(raw, y * (stride + 1) + 1);
    row.copy(prev);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ content --
interface Panel {
  kicker: string;
  headline: string;
  body: string;
}

const PANELS: Panel[] = [
  {
    kicker: "SUMMIT",
    headline: "TRUMP, XI AND PUTIN MEET IN SHENZHEN",
    body: "FIRST-EVER TRILATERAL SUMMIT. A JOINT PEACE DECLARATION.",
  },
  {
    kicker: "MARKETS",
    headline: "ANTHROPIC SHARES SOAR ON DEBUT",
    body: "SHARES JUMP 17% ON DEBUT. VALUED AT ABOUT $2 TRILLION.",
  },
  {
    kicker: "GULF",
    headline: "IRAN ESCALATES ATTACKS ON GULF TANKERS",
    body: "A TANKER CATCHES FIRE AFTER HITTING A MINE.",
  },
  {
    kicker: "CYCLONE",
    headline: "CYCLONE AKVAN HITS ODISHA",
    body: "INDIA EVACUATES MORE THAN 80,000 PEOPLE.",
  },
  {
    kicker: "WAR",
    headline: "KYIV HIT, CRIMEAN BRIDGE STRUCK",
    body: "BALLISTIC MISSILES HIT KYIV. BRIDGE STRUCK A THIRD TIME.",
  },
  {
    kicker: "MARKETS",
    headline: "MARKETS FALL",
    body: "S AND P 500 DOWN 2.0%. NIKKEI DOWN 4.68%.",
  },
  {
    kicker: "CLIMATE",
    headline: "COP31 DRAFT DROPS FOSSIL FUELS",
    body: "THE DRAFT DROPS ITS FOSSIL FUELS REFERENCE.",
  },
  {
    kicker: "DIPLOMACY",
    headline: "EUROPE READY FOR TALKS WITH RUSSIA",
    body: "ALLIES SAY THEY ARE READY FOR TALKS WITH RUSSIA.",
  },
];

const BRIEFS: string[] = [
  "HOUTHI CLAIM SAUDI STRIKES",
  "RIYADH'S TALLEST TOWER HIT",
  "ISRAEL HITS HEZBOLLAH SITES",
  "SARATOV DRONE ATTACK KILLS 3",
  "1 DEAD, 15 HURT IN FRANCE",
  "3-YEAR-OLD SAVED IN TBILISI",
  "DRONE STOPS GENOA FLIGHTS",
  "MIGRANTS LOST OFF SENEGAL",
  "DOZENS MISSING OFF SENEGAL",
  "YEMEN: HOUTHI ARE TERRORISTS",
  "COP31 SPLIT ON FOSSIL FUELS",
  "1 IN 4 CHILDREN IN WAR ZONES",
  "HARRIS MEETS MACRON IN PARIS",
  "NVIDIA PROBED ON CHINA CHIPS",
  "PETE ROSE PARDONED BY TRUMP",
  "FIONA THE HIPPO DIES",
  "COP31 TALKS IN FINAL DAYS",
  "45BN-EURO LOAN FOR UKRAINE",
  "PUTIN INVITES EUROPE LEADERS",
  "E3 EYES MEETING WITH RUSSIA",
  "ANTHROPIC SHARES UP 17%",
  "ANTHROPIC WORTH $2 TRILLION",
  "TANKER ON FIRE AFTER MINE",
  "MINE EAST OF HORMUZ STRAIT",
  "80,000 EVACUATED IN ODISHA",
  "CRIMEAN BRIDGE STRUCK AGAIN",
  "S AND P 500 DOWN 2.0%",
  "NIKKEI DOWN 4.68%",
  "COP31 DROPS FOSSIL FUELS",
  "EUROPE EYES RUSSIA TALKS",
  "ICJ RULING GIVEN ON 19 NOV",
  "GENOCIDE RULING FOR ROHINGYA",
  "PEACE DECLARATION ISSUED",
];

const TOP_SUMMARY =
  "THE INTERNATIONAL COURT OF JUSTICE RULES MYANMAR COMMITTED GENOCIDE " +
  "AGAINST THE ROHINGYA - THE FIRST SUCH FINDING AGAINST A STATE. " +
  "THE RULING WAS HANDED DOWN ON 19 NOVEMBER.";

function drawPage(): Canvas {
  const W = 1024;
  const H = 1024;
  const cv = new Canvas(W, H, PAPER);
  const CX = W / 2;
  const MX = 36; // content left edge
  const RX = 988; // content right edge

  // Outer frame.
  cv.rect(12, 12, W - 24, H - 24, 3, INK);

  // Masthead.
  cv.textCentered("THE WORLD TODAY", CX, 40, 64, INK);
  cv.hline(MX, 118, RX - MX, 3, INK);

  // Date line.
  cv.textCentered("FRIDAY, 20 NOVEMBER 2026", CX, 130, 25, RED);
  cv.hline(MX, 166, RX - MX, 2, INK);
  cv.hline(MX, 171, RX - MX, 1, INK);

  // Top story.
  cv.textCentered("TOP STORY", CX, 184, 14, RED);
  cv.textCentered("COURT RULES MYANMAR", CX, 206, 46, INK);
  cv.textCentered("COMMITTED GENOCIDE", CX, 256, 46, INK);
  const sumLines = cv.wrap(TOP_SUMMARY, RX - MX - 36, 15);
  let sy = 314;
  for (const ln of sumLines) {
    cv.textCentered(ln, CX, sy, 15, INK);
    sy += 20;
  }
  cv.hline(MX, 388, RX - MX, 2, INK);

  // Panel grid: 4 columns x 2 rows.
  const colW = 229;
  const gutter = 12;
  const rowTop = [404, 556];
  const rowH = 140;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      const p = PANELS[r * 4 + c];
      const x = MX + c * (colW + gutter);
      const y = rowTop[r];
      cv.text(p.kicker, x, y + 2, 12, RED);
      const headLines = cv.wrap(p.headline, colW, 18);
      let hy = y + 18;
      for (const ln of headLines) {
        cv.text(ln, x, hy, 18, INK);
        hy += 22;
      }
      const bodyLines = cv.wrap(p.body, colW, 12);
      let by = y + 90;
      for (const ln of bodyLines) {
        cv.text(ln, x, by, 12, INK);
        by += 15;
      }
    }
  }
  // Column rules and the row rule.
  for (let c = 1; c < 4; c++) {
    const x = MX + c * colW + (c - 1) * gutter + 6;
    cv.vline(x, rowTop[0], rowTop[1] + rowH - rowTop[0], 1, GREY);
  }
  cv.hline(MX, 550, RX - MX, 1, GREY);
  cv.hline(MX, 712, RX - MX, 2, INK);

  // In brief: three columns, eleven one-line items each.
  cv.textCentered("IN BRIEF", CX, 726, 17, INK);
  const colX = [MX, 357, 678];
  for (let i = 0; i < BRIEFS.length; i++) {
    const col = Math.floor(i / 11);
    const row = i % 11;
    const x = colX[col];
    const y = 754 + row * 18;
    cv.fillRect(x, y + 4, 6, 6, RED);
    cv.text(BRIEFS[i], x + 14, y, 12, INK);
  }

  // Voices: a resident of a besieged Yemeni city, speaking to the BBC.
  cv.hline(MX, 954, RX - MX, 1, INK);
  cv.textCentered("I TELL MY SON IT'S JUST FIREWORKS", CX, 964, 14, INK);
  cv.textCentered("RESIDENT OF A BESIEGED YEMENI CITY, TO THE BBC", CX, 984, 10, GREY);

  return cv;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const cv = drawPage();
  const png = encodePNG(cv.w, cv.h, cv.px);
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, png);
  const sha = crypto.createHash("sha256").update(png).digest("hex");
  console.log(`wrote ${outPath}: ${png.length} bytes, sha256 ${sha}`);
}

main();
