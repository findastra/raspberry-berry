// Draws Raspberry Pi, the pet, in the shape of the berry logo: two leaves on top and a
// berry of packed drupelets with black seams between them. 64x64, nine moods.
// Writes sprite.json, sprite.js, logo.svg, art/frames/<mood>-20261010.png and art/roster-20261010.png.
// Run: node scripts/draw-berry.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const S = 64;
const DATE = '20261010';
const INK = '#000000';
const RED = '#c51a4a', RED_HI = '#ec4f7f', RED_LO = '#8e0f35', SHINE = '#ffd6e3';
const GREEN = '#75a928', GREEN_HI = '#a6d65a', GREEN_LO = '#4c7417';
const SICK = '#8f8a3c', SICK_HI = '#b4b05a', SICK_LO = '#5f5b22';
const CHEEK = '#ff8fb5', WHITE = '#ffffff';

// Shared mood stickers, copied from astras-pet-apps scripts/art-kit.mjs (drawn at 2x for 64px).
const STICKERS = {
  sweat: { rows: ['.b.', 'bwb', 'bwb', '.b.'], pal: { b: '#4fa3ea', w: '#d9f1ff' } },
  tear: { rows: ['b', 'w', 'b'], pal: { b: '#4fa3ea', w: '#d9f1ff' } },
  zzz: { rows: ['####', '..#.', '.#..', '####'], pal: { '#': '#9fb4ff' } },
  zz: { rows: ['###', '.#.', '###'], pal: { '#': '#9fb4ff' } },
  bang: { rows: ['##', '##', '##', '##', '..', '##'], pal: { '#': '#ff5a5f' } },
  ask: { rows: ['.##.', '#..#', '..#.', '.#..', '....', '.#..'], pal: { '#': '#ffd166' } },
  plaster: { rows: ['.t.', 'ttt', '.t.'], pal: { t: '#f3d3a2' } },
};
const HALO = '#33283f';

// Drupelets: [x, y, r]. Power-distance cells give the logo's packed, seamed look.
const DRUPES = [
  [21, 28, 7.5], [32, 25, 7], [43, 28, 7.5],
  [16, 39, 6.5], [32, 38, 11], [48, 39, 6.5],
  [22, 49, 7], [42, 49, 7],
  [32, 55, 5.5],
];
// Leaves: rotated ellipses meeting at the stem, like the logo's two leaves.
const LEAVES = [
  { cx: 21, cy: 11, rx: 13, ry: 6.2, deg: 30 },
  { cx: 43, cy: 11, rx: 13, ry: 6.2, deg: -30 },
];

function inLeaf(l, x, y) {
  const a = (l.deg * Math.PI) / 180, dx = x - l.cx, dy = y - l.cy;
  const u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a);
  return { inside: (u / l.rx) ** 2 + (v / l.ry) ** 2 <= 1, u, v };
}

// label: -1 empty, 0..8 drupelet, 100/101 leaf
function labels() {
  const lab = new Int16Array(S * S).fill(-1);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const px = x + 0.5, py = y + 0.5;
    let best = -1, bd = Infinity;
    DRUPES.forEach(([cx, cy, r], i) => {
      const d2 = (px - cx) ** 2 + (py - cy) ** 2;
      if (d2 <= (r + 2.2) ** 2 && d2 - r * r < bd) { bd = d2 - r * r; best = i; }
    });
    if (best < 0) LEAVES.forEach((l, i) => { if (inLeaf(l, px, py).inside) best = 100 + i; });
    lab[y * S + x] = best;
  }
  return lab;
}

function base() {
  const lab = labels();
  const px = new Array(S * S).fill(null);
  const at = (x, y) => (x < 0 || y < 0 || x >= S || y >= S ? -1 : lab[y * S + x]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const L = at(x, y);
    if (L < 0) {
      if ([at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].some((n) => n >= 0)) px[y * S + x] = INK;
      continue;
    }
    // seam between different cells
    if ((at(x + 1, y) >= 0 && at(x + 1, y) !== L) || (at(x, y + 1) >= 0 && at(x, y + 1) !== L)) { px[y * S + x] = INK; continue; }
    if (L >= 100) {
      const { u, v } = inLeaf(LEAVES[L - 100], x + 0.5, y + 0.5);
      const vein = Math.abs(v) < 0.7 && Math.abs(u) < 8;
      px[y * S + x] = vein ? GREEN_LO : v < -1.5 ? GREEN_HI : v > 2.5 ? GREEN_LO : GREEN;
      continue;
    }
    const [cx, cy, r] = DRUPES[L];
    const t = ((x + 0.5 - cx) + (y + 0.5 - cy)) / r;
    px[y * S + x] = t < -0.75 ? RED_HI : t > 0.75 ? RED_LO : RED;
  }
  // a small shine on the upper drupelets
  [[18, 25], [29, 22], [40, 25], [13, 37], [45, 37], [19, 46], [39, 46]].forEach(([x, y]) => { px[y * S + x] = SHINE; });
  return px;
}

const set = (px, x, y, c) => { if (x >= 0 && y >= 0 && x < S && y < S) px[y * S + x] = c; };
function stamp(px, x, y, rows, pal, k = 1) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.' || !pal[ch]) return;
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) set(px, x + i * k + a, y + j * k + b, pal[ch]);
  }));
}
function sticker(px, name, x, y) {
  const s = STICKERS[name], k = 2, w = Math.max(...s.rows.map((r) => r.length));
  const t = new Array(S * S).fill(null);
  stamp(t, x, y, s.rows, s.pal, k);
  for (let yy = y - 1; yy <= y + s.rows.length * k; yy++) for (let xx = x - 1; xx <= x + w * k; xx++) {
    if (xx < 0 || yy < 0 || xx >= S || yy >= S || t[yy * S + xx]) continue;
    const g = (a, b) => (a < 0 || b < 0 || a >= S || b >= S ? null : t[b * S + a]);
    if ([g(xx + 1, yy), g(xx - 1, yy), g(xx, yy + 1), g(xx, yy - 1)].some(Boolean) && !px[yy * S + xx]) px[yy * S + xx] = HALO;
  }
  t.forEach((c, i) => { if (c) px[i] = c; });
}

// Face sits in the big centre drupelet, like a face on the logo's middle cell.
const EX = [26, 35], EY = 34, MY = 41;
const E = { '#': INK, o: WHITE };
const EYES = {
  open: ['.##.', '#o##', '####', '.##.'],
  blink: ['....', '....', '####', '....'],
  happy: ['....', '.##.', '#..#', '....'],
  sleep: ['....', '....', '#..#', '.##.'],
  wide: ['####', '#oo#', '#oo#', '####'],
  sick: ['....', '####', '.##.', '....'],
  worried: ['.##.', '#o##', '####', '.##.'],
};
const MOUTHS = {
  smile: ['#....#', '.####.'],
  grin: ['######', '#oooo#', '.####.'],
  o: ['.##.', '#..#', '.##.'],
  frown: ['.####.', '#....#'],
  wavy: ['.#..#.', '#.##.#'],
  flat: ['####'],
  shout: ['.####.', '#oooo#', '#oooo#', '.####.'],
};
function face(px, eyes, mouth, { brows = null, cheeks = true } = {}) {
  const e = EYES[eyes], ew = e[0].length;
  EX.forEach((x) => stamp(px, x, EY, e, E));
  const m = MOUTHS[mouth], mw = m[0].length;
  stamp(px, 32 - Math.floor(mw / 2), MY, m, { '#': INK, o: '#5a0a24' });
  if (cheeks) [[23, 39], [24, 39], [40, 39], [41, 39]].forEach(([x, y]) => set(px, x, y, CHEEK));
  if (brows === 'worried') [[25, 32], [26, 31], [27, 31], [28, 30], [36, 30], [37, 31], [38, 31], [39, 32]].forEach(([x, y]) => set(px, x, y, INK));
  if (brows === 'up') { [[26, 31], [27, 31], [28, 31], [35, 30], [36, 30], [37, 30], [38, 30]].forEach(([x, y]) => set(px, x, y, INK)); }
}
function sickTint(px) {
  const map = { [RED]: SICK, [RED_HI]: SICK_HI, [RED_LO]: SICK_LO, [SHINE]: '#e2e0a8' };
  return px.map((c) => map[c] ?? c);
}

const MOODS = {
  idle: () => { const p = base(); face(p, 'open', 'smile'); return p; },
  blink: () => { const p = base(); face(p, 'blink', 'smile'); return p; },
  happy: () => { const p = base(); face(p, 'happy', 'grin'); return p; },
  curious: () => { const p = base(); face(p, 'open', 'o', { brows: 'up' }); sticker(p, 'ask', 54, 3); return p; },
  worried: () => { const p = base(); face(p, 'worried', 'wavy', { brows: 'worried' }); sticker(p, 'sweat', 55, 22); return p; },
  sad: () => { const p = base(); face(p, 'open', 'frown', { brows: 'worried' }); sticker(p, 'tear', 27, 38); return p; },
  sick: () => { let p = base(); p = sickTint(p); face(p, 'sick', 'wavy', { cheeks: false }); sticker(p, 'plaster', 40, 24); return p; },
  alarmed: () => { const p = base(); face(p, 'wide', 'shout', { cheeks: false }); sticker(p, 'bang', 56, 2); return p; },
  sleep: () => { const p = base(); face(p, 'sleep', 'flat'); sticker(p, 'zzz', 55, 19); sticker(p, 'zz', 57, 9); return p; },
};

// ---- sprite.json (same shape as the hub's sheetToSprite output) ----
const KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const frames = {}, all = new Set(), drawn = {};
for (const [mood, fn] of Object.entries(MOODS)) {
  const px = fn(); drawn[mood] = px;
  const pal = {}, rev = {};
  const rows = [];
  for (let y = 0; y < S; y++) {
    let row = '';
    for (let x = 0; x < S; x++) {
      const c = px[y * S + x];
      if (!c) { row += '.'; continue; }
      if (!rev[c]) { rev[c] = KEYS[Object.keys(pal).length]; pal[rev[c]] = c; }
      row += rev[c]; all.add(c);
    }
    rows.push(row);
  }
  frames[mood] = { pal, rows };
}
const sprite = {
  id: 'raspberry-berry', name: 'raspberry-berry', source: 'scripts/draw-berry.mjs',
  size: [S, S], moods: Object.keys(MOODS), frames, pitch: 1, palette: [...all],
};
writeFileSync(new URL('../sprite.json', import.meta.url), JSON.stringify(sprite, null, 1) + '\n');
// sprite.js lets index.html show the pet when opened straight from disk (file:// cannot fetch JSON).
writeFileSync(new URL('../sprite.js', import.meta.url), '// Generated by scripts/draw-berry.mjs from the same frames as sprite.json.\nwindow.BERRY_SPRITE = ' + JSON.stringify({ size: sprite.size, frames }) + ';\n');

// ---- PNGs ----
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function blit(buf, bw, px, k, ox, oy) {
  px.forEach((c, i) => {
    if (!c) return;
    const [r, g, b] = rgb(c), x = i % S, y = (i / S) | 0;
    for (let a = 0; a < k; a++) for (let d = 0; d < k; d++) { const j = ((oy + y * k + a) * bw + ox + x * k + d) * 4; buf[j] = r; buf[j + 1] = g; buf[j + 2] = b; buf[j + 3] = 255; }
  });
}
const out = new URL('../art/frames/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [mood, px] of Object.entries(drawn)) {
  const k = 4, buf = Buffer.alloc(S * k * S * k * 4); // 256x256 like the hub's finished frames
  blit(buf, S * k, px, k, 0, 0);
  writeFileSync(new URL(`${mood}-${DATE}.png`, out), png(S * k, S * k, buf));
}
// roster: 3x3 on a grey card so it can be looked at
const k = 4, cell = S * k + 16, W3 = cell * 3, buf = Buffer.alloc(W3 * W3 * 4);
for (let i = 0; i < buf.length; i += 4) { buf[i] = 120; buf[i + 1] = 120; buf[i + 2] = 128; buf[i + 3] = 255; }
Object.values(drawn).forEach((px, i) => blit(buf, W3, px, k, (i % 3) * cell + 8, ((i / 3) | 0) * cell + 8));
writeFileSync(new URL(`../art/roster-${DATE}.png`, import.meta.url), png(W3, W3, buf));

// logo.svg: the berry without a face, one rect per pixel run, so the logo and the pet match.
{
  const px = base(), runs = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S;) {
    const c = px[y * S + x]; let w = 1;
    while (c && x + w < S && px[y * S + x + w] === c) w++;
    if (c) runs.push(`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`);
    x += w;
  }
  writeFileSync(new URL('../logo.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" shape-rendering="crispEdges" role="img" aria-label="Raspberry Berry logo">\n<title>Raspberry Berry</title>\n${runs.join('\n')}\n</svg>\n`);
}console.log('drew', Object.keys(drawn).join(', '));
