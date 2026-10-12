// One line-drawn figure per discipline, in the manner of a field-guide plate. Each is
// generated from a little geometry rather than stored as artwork, and each shows something
// true about its subject: a hull really is the hull of those points, the modular circle
// really is multiplication by two, the descent path really follows the contours.
//
// Classes: .ink (charcoal line), .ink-soft (sage line), .ink-accent (the one thing to notice),
// .draw (accent strokes that draw themselves on hover).

const W = 240, H = 150;
const f = (n) => Number(n.toFixed(1));
const pts = (list) => list.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');
const path = (list) => 'M' + list.map((p) => `${f(p[0])} ${f(p[1])}`).join('L');
const rnd = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const len = (list) => { let s = 0; for (let i = 1; i < list.length; i++) s += Math.hypot(list[i][0] - list[i - 1][0], list[i][1] - list[i - 1][1]); return Math.ceil(s) + 4; };
const draw = (list, extra = '') => `<path class="ink-accent draw" style="--len:${len(list)}" d="${path(list)}" ${extra}/>`;
const dot = (p, r = 3, cls = 'fill-paper') => `<circle class="${cls}" cx="${f(p[0])}" cy="${f(p[1])}" r="${r}"/>`;

const FIG = {
  algorithms() {
    const hs = [34, 78, 52, 112, 64, 96, 44, 88, 120, 70];
    const bw = 15, gap = 7, x0 = 14;
    let s = `<line class="ink" x1="8" y1="134" x2="232" y2="134"/>`;
    hs.forEach((h, i) => { s += `<rect class="${i === 3 ? 'fill-accent' : 'fill-paper'}" x="${x0 + i * (bw + gap)}" y="${134 - h}" width="${bw}" height="${h}"/>`; });
    const a = x0 + 3 * (bw + gap) + bw / 2, b = x0 + 6 * (bw + gap) + bw / 2;
    const arc = Array.from({ length: 21 }, (_, k) => { const t = k / 20; return [a + (b - a) * t, 16 - Math.sin(Math.PI * t) * 10 + (1 - t) * 0 + t * 62]; });
    return s + draw(arc) + `<path class="ink-accent" d="M${b - 5} ${f(arc[20][1] - 7)}L${b} ${f(arc[20][1])}L${b + 6} ${f(arc[20][1] - 5)}"/>`;
  },
  'graph-theory'() {
    const n = [[26, 82], [70, 34], [78, 112], [124, 70], [168, 28], [176, 116], [216, 66]];
    const e = [[0, 1], [0, 2], [1, 3], [2, 3], [1, 4], [3, 4], [3, 5], [2, 5], [4, 6], [5, 6], [3, 6]];
    let s = e.map(([a, b]) => `<line class="ink-soft" x1="${n[a][0]}" y1="${n[a][1]}" x2="${n[b][0]}" y2="${n[b][1]}"/>`).join('');
    s += draw([n[0], n[2], n[3], n[6]]);
    return s + n.map((p, i) => dot(p, 5.5, [0, 2, 3, 6].includes(i) ? 'fill-accent' : 'fill-paper')).join('');
  },
  'computational-geometry'() {
    const r = rnd(11);
    const P = Array.from({ length: 22 }, () => [30 + r() * 180, 20 + r() * 110]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const S = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const lo = [], up = [];
    for (const p of S) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of S.slice().reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    const hull = lo.slice(0, -1).concat(up.slice(0, -1));
    const ring = hull.concat([hull[0]]);
    return draw(ring) + P.map((p) => dot(p, 3, hull.includes(p) ? 'fill-ink' : 'fill-paper')).join('');
  },
  'distributed-systems'() {
    const c = [120, 75], R = 54;
    const at = (a, rr = R) => [c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)];
    let s = `<circle class="ink-soft" cx="${c[0]}" cy="${c[1]}" r="${R}"/>`;
    const r = rnd(5);
    for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2; const p = at(a), q = at(a, R + 5); s += `<line class="ink" x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(q[0])}" y2="${f(q[1])}"/>`; }
    const servers = [0.3, 1.5, 2.7, 3.9, 5.2];
    const arc = Array.from({ length: 16 }, (_, k) => at(servers[1] + (servers[2] - servers[1]) * (k / 15)));
    s += draw(arc);
    return s + servers.map((a, i) => dot(at(a), 7, i === 2 ? 'fill-accent' : 'fill-paper')).join('');
  },
  'computer-graphics'() {
    const cols = 16, rows = 9, cs = 13, x0 = 16, y0 = 16;
    let s = '';
    for (let i = 0; i <= cols; i++) s += `<line class="ink-soft" x1="${x0 + i * cs}" y1="${y0}" x2="${x0 + i * cs}" y2="${y0 + rows * cs}" opacity=".55"/>`;
    for (let j = 0; j <= rows; j++) s += `<line class="ink-soft" x1="${x0}" y1="${y0 + j * cs}" x2="${x0 + cols * cs}" y2="${y0 + j * cs}" opacity=".55"/>`;
    // Bresenham's algorithm from cell (1, 7) to cell (14, 1), with the ideal line over it
    let x = 1, y = 7;
    const x1 = 14, y1 = 1, dx = Math.abs(x1 - x), dy = -Math.abs(y1 - y), sx = 1, sy = -1;
    let err = dx + dy;
    for (;;) {
      s += `<rect class="fill-accent" opacity=".85" x="${x0 + x * cs + 1}" y="${y0 + y * cs + 1}" width="${cs - 2}" height="${cs - 2}"/>`;
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return s + `<line class="ink" x1="${x0 + 1.5 * cs}" y1="${y0 + 7.5 * cs}" x2="${x0 + 14.5 * cs}" y2="${y0 + 1.5 * cs}"/>`;
  },
  mathematics() {
    // Euclid's algorithm as a rectangle cut into squares: gcd(89, 55)
    let x = 12, y = 14, w = 216, h = 133.5, dir = 0, s = '';
    const corners = [];
    for (let k = 0; k < 8 && w > 2 && h > 2; k++) {
      const side = Math.min(w, h);
      let sx = x, sy = y;
      if (dir === 2) sx = x + w - side;
      if (dir === 3) sy = y + h - side;
      s += `<rect class="fill-paper" x="${f(sx)}" y="${f(sy)}" width="${f(side)}" height="${f(side)}"/>`;
      corners.push([sx, sy, side, dir]);
      if (dir === 0) { x += side; w -= side; } else if (dir === 1) { y += side; h -= side; } else if (dir === 2) { w -= side; } else { h -= side; }
      dir = (dir + 1) % 4;
    }
    let d = '';
    for (const [sx, sy, side, dr] of corners) {
      const a = [[sx, sy + side], [sx, sy], [sx + side, sy], [sx + side, sy + side]][dr];
      const b = [[sx + side, sy], [sx + side, sy + side], [sx, sy + side], [sx, sy]][dr];
      d += `${d ? 'L' : 'M'}${f(a[0])} ${f(a[1])}A${f(side)} ${f(side)} 0 0 1 ${f(b[0])} ${f(b[1])}`;
    }
    return s + `<path class="ink-accent draw" style="--len:520" d="${d}"/>`;
  },
  statistics() {
    const bins = [3, 8, 17, 30, 42, 46, 38, 26, 14, 7, 3];
    const bw = 18, x0 = 21;
    let s = `<line class="ink" x1="12" y1="132" x2="228" y2="132"/>`;
    bins.forEach((b, i) => { s += `<rect class="fill-paper" x="${x0 + i * bw}" y="${132 - b * 2.1}" width="${bw}" height="${b * 2.1}"/>`; });
    const curve = Array.from({ length: 61 }, (_, k) => { const t = k / 60; const z = (t - 0.5) * 5.4; return [12 + t * 216, 132 - Math.exp(-0.5 * z * z) * 100]; });
    return s + draw(curve);
  },
  optimization() {
    const c = [140, 84];
    let s = '';
    for (let k = 1; k <= 6; k++) s += `<ellipse class="ink-soft" cx="${c[0]}" cy="${c[1]}" rx="${k * 17}" ry="${k * 9.5}" transform="rotate(-18 ${c[0]} ${c[1]})"/>`;
    // steepest descent on the matching quadratic, drawn in the rotated frame
    const th = (-18 * Math.PI) / 180, co = Math.cos(th), si = Math.sin(th);
    let u = -92, v = 44; const P = [];
    for (let k = 0; k < 16; k++) { P.push([c[0] + u * co - v * si, c[1] + u * si + v * co]); const gu = u / (17 * 17), gv = v / (9.5 * 9.5); const eta = 150; u -= eta * gu; v -= eta * gv; }
    return s + draw(P) + P.slice(0, 9).map((p) => dot(p, 2.2, 'fill-accent')).join('') + dot(c, 3.2, 'fill-ink');
  },
  'information-theory'() {
    const N = { r: [120, 16], a: [66, 50], b: [176, 50], c: [36, 88], d: [96, 88], e: [150, 88], g: [204, 88], h: [124, 126], i: [176, 126] };
    const E = [['r', 'a'], ['r', 'b'], ['a', 'c'], ['a', 'd'], ['b', 'e'], ['b', 'g'], ['e', 'h'], ['e', 'i']];
    let s = E.map(([p, q]) => `<line class="ink-soft" x1="${N[p][0]}" y1="${N[p][1]}" x2="${N[q][0]}" y2="${N[q][1]}"/>`).join('');
    s += draw([N.r, N.b, N.e, N.i]);
    const leaf = ['c', 'd', 'g', 'h', 'i'];
    for (const [k, p] of Object.entries(N)) s += leaf.includes(k) ? `<rect class="${k === 'i' ? 'fill-accent' : 'fill-paper'}" x="${p[0] - 7}" y="${p[1] - 7}" width="14" height="14"/>` : dot(p, 5, 'fill-paper');
    const lab = (p, q, t) => `<text x="${f((N[p][0] + N[q][0]) / 2 + (N[q][0] < N[p][0] ? -9 : 5))}" y="${f((N[p][1] + N[q][1]) / 2)}" class="plate-text">${t}</text>`;
    return s + E.map(([p, q]) => lab(p, q, N[q][0] < N[p][0] ? '0' : '1')).join('');
  },
  ai() {
    const root = [120, 14];
    const L1 = [[56, 52], [120, 52], [184, 52]];
    const L2 = [[28, 94], [62, 94], [96, 94], [144, 94], [176, 94], [212, 94]];
    const L3 = [[130, 134], [158, 134], [196, 134], [226, 134]];
    const E = [[root, L1[0]], [root, L1[1]], [root, L1[2]], [L1[0], L2[0]], [L1[0], L2[1]], [L1[1], L2[2]], [L1[1], L2[3]], [L1[2], L2[4]], [L1[2], L2[5]], [L2[3], L3[0]], [L2[3], L3[1]], [L2[5], L3[2]], [L2[5], L3[3]]];
    let s = E.map(([p, q]) => `<line class="ink-soft" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`).join('');
    s += draw([root, L1[1], L2[3], L3[1]]);
    return s + [root, ...L1, ...L2, ...L3].map((p) => dot(p, 4.5, p === L3[1] ? 'fill-accent' : 'fill-paper')).join('');
  },
  'machine-learning'() {
    const r = rnd(8);
    let s = `<line class="ink" x1="16" y1="134" x2="228" y2="134"/><line class="ink" x1="16" y1="134" x2="16" y2="12"/>`;
    const A = Array.from({ length: 13 }, () => [40 + r() * 80, 26 + r() * 62]);
    const B = Array.from({ length: 13 }, () => [124 + r() * 86, 64 + r() * 58]);
    s += draw([[40, 132], [212, 16]]);
    return s + A.map((p) => dot(p, 3.4, 'fill-paper')).join('') + B.map((p) => dot(p, 3.4, 'fill-ink')).join('');
  },
  'deep-learning'() {
    const layers = [3, 5, 5, 2];
    const X = [32, 92, 152, 212];
    const pos = layers.map((n, i) => Array.from({ length: n }, (_, k) => [X[i], 75 + (k - (n - 1) / 2) * (n === 5 ? 26 : 38)]));
    let s = '';
    for (let i = 0; i < 3; i++) for (const p of pos[i]) for (const q of pos[i + 1]) s += `<line class="ink-soft" opacity=".5" x1="${p[0]}" y1="${f(p[1])}" x2="${q[0]}" y2="${f(q[1])}"/>`;
    s += draw([pos[0][0], pos[1][1], pos[2][3], pos[3][0]]);
    return s + pos.flat().map((p) => dot(p, 6, [pos[0][0], pos[1][1], pos[2][3], pos[3][0]].includes(p) ? 'fill-accent' : 'fill-paper')).join('');
  },
  'computer-vision'() {
    const cols = 14, rows = 9, cs = 14, x0 = 22, y0 = 12;
    let s = '';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const d = Math.hypot(i - 8.2, j - 4.2);
      const v = d < 3.3 ? 0.75 : d < 4.4 ? 0.32 : 0.05;
      s += `<rect x="${x0 + i * cs}" y="${y0 + j * cs}" width="${cs - 1.5}" height="${cs - 1.5}" fill="currentColor" opacity="${v}"/>`;
    }
    const k = [x0 + 3 * cs - 1.5, y0 + 2 * cs - 1.5, cs * 3 + 1.5];
    return s + `<rect class="ink-accent draw" style="--len:180" x="${k[0]}" y="${k[1]}" width="${k[2]}" height="${k[2]}"/>` + `<rect class="fill-accent" x="${x0 + 4 * cs}" y="${y0 + 3 * cs}" width="${cs - 1.5}" height="${cs - 1.5}"/>`;
  },
  nlp() {
    const a = 'kitten'.split(''), b = 'sitting'.split('');
    const cw = 24, ax = 120 - (a.length * cw) / 2, bx = 120 - (b.length * cw) / 2, ay = 26, by = 98;
    const cell = (x, y, t, hot) => `<rect class="${hot ? 'ink-accent' : 'ink'}" x="${x}" y="${y}" width="${cw - 4}" height="26"/><text x="${x + (cw - 4) / 2}" y="${y + 18}" text-anchor="middle" class="plate-letter">${t}</text>`;
    let s = '';
    a.forEach((t, i) => { s += cell(ax + i * cw, ay, t, i === 0 || i === 4); });
    b.forEach((t, i) => { s += cell(bx + i * cw, by, t, i === 0 || i === 4 || i === 6); });
    a.forEach((t, i) => { const hot = i === 0 || i === 4; s += `<line class="${hot ? 'ink-accent' : 'ink-soft'}" x1="${ax + i * cw + 10}" y1="${ay + 26}" x2="${bx + i * cw + 10}" y2="${by}"/>`; });
    return s;
  },
  physics() {
    const c = [86, 74];
    let s = `<ellipse class="ink-soft" cx="${c[0]}" cy="${c[1]}" rx="64" ry="38"/><ellipse class="ink-soft" cx="${c[0]}" cy="${c[1]}" rx="38" ry="22" opacity=".7"/>`;
    s += dot([c[0] - 22, c[1]], 6, 'fill-ink');
    const orbit = Array.from({ length: 24 }, (_, k) => { const t = -0.4 + (k / 23) * 2.3; return [c[0] + 64 * Math.cos(t), c[1] + 38 * Math.sin(t)]; });
    s += draw(orbit) + dot(orbit[23], 4, 'fill-accent');
    const piv = [196, 16], L = 96;
    for (const a of [-0.5, -0.25, 0.25, 0.5]) s += `<line class="ink-soft" opacity=".6" x1="${piv[0]}" y1="${piv[1]}" x2="${f(piv[0] + L * Math.sin(a))}" y2="${f(piv[1] + L * Math.cos(a))}"/>`;
    s += `<line class="ink" x1="${piv[0]}" y1="${piv[1]}" x2="${piv[0]}" y2="${piv[1] + L}"/><line class="ink" x1="${piv[0] - 16}" y1="${piv[1]}" x2="${piv[0] + 16}" y2="${piv[1]}"/>`;
    return s + dot([piv[0], piv[1] + L], 7, 'fill-paper');
  },
  biology() {
    const A = [], B = [];
    for (let k = 0; k <= 60; k++) { const x = 14 + (k / 60) * 212; const y = 34 * Math.sin((k / 60) * Math.PI * 3.2); A.push([x, 75 + y]); B.push([x, 75 - y]); }
    let s = '';
    for (let k = 2; k <= 58; k += 4) { const hot = k % 12 === 2; s += `<line class="${hot ? 'ink-accent' : 'ink-soft'}" x1="${f(A[k][0])}" y1="${f(A[k][1])}" x2="${f(B[k][0])}" y2="${f(B[k][1])}"/>`; }
    return s + `<path class="ink" d="${path(A)}"/>` + draw(B);
  },
  'quantum-computing'() {
    const c = [120, 76], R = 58;
    let s = `<circle class="ink" cx="${c[0]}" cy="${c[1]}" r="${R}"/><ellipse class="ink-soft" cx="${c[0]}" cy="${c[1]}" rx="${R}" ry="17"/><ellipse class="ink-soft" cx="${c[0]}" cy="${c[1]}" rx="20" ry="${R}" opacity=".6"/>`;
    s += `<line class="ink-soft" x1="${c[0]}" y1="${c[1] - R - 10}" x2="${c[0]}" y2="${c[1] + R + 10}"/>`;
    const tip = [c[0] + 34, c[1] - 40];
    s += draw([c, tip]) + dot(tip, 4.5, 'fill-accent') + dot(c, 2.5, 'fill-ink');
    s += `<text x="${c[0] + 7}" y="${c[1] - R - 3}" class="plate-text">|0⟩</text><text x="${c[0] + 7}" y="${c[1] + R + 12}" class="plate-text">|1⟩</text>`;
    return s + `<path class="ink-soft" stroke-dasharray="2 3" d="M${tip[0]} ${tip[1]}L${tip[0]} ${c[1] + 9}L${c[0]} ${c[1]}"/>`;
  },
  cryptography() {
    // Multiplication by 2 modulo 61, drawn as chords: a one-way shuffle of the circle
    const c = [120, 75], R = 62, n = 61;
    const at = (k) => [c[0] + R * Math.cos((2 * Math.PI * k) / n - Math.PI / 2), c[1] + R * Math.sin((2 * Math.PI * k) / n - Math.PI / 2)];
    let s = `<circle class="ink" cx="${c[0]}" cy="${c[1]}" r="${R}"/>`;
    for (let k = 1; k < n; k++) { const p = at(k), q = at((k * 2) % n); s += `<line class="ink-soft" opacity=".75" x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(q[0])}" y2="${f(q[1])}"/>`; }
    const chain = [7, 14, 28, 56, 51, 41].map(at);
    return s + draw(chain) + dot(chain[0], 3.5, 'fill-accent') + dot(chain[5], 3.5, 'fill-ink');
  },
  finance() {
    const r = rnd(21);
    let s = `<line class="ink" x1="14" y1="136" x2="228" y2="136"/><line class="ink" x1="14" y1="136" x2="14" y2="12"/>`;
    for (let w = 0; w < 6; w++) {
      let y = 96; const P = [[14, y]];
      for (let k = 1; k <= 42; k++) { y += (r() - 0.53) * 11; y = Math.max(18, Math.min(130, y)); P.push([14 + k * 5.05, y]); }
      s += w === 5 ? draw(P) : `<path class="ink-soft" opacity="${0.45 + w * 0.08}" d="${path(P)}"/>`;
    }
    return s;
  },
  robotics() {
    const obs = [[58, 26, 34, 52], [118, 70, 30, 60], [172, 14, 28, 66]];
    let s = `<rect class="ink-soft" x="10" y="8" width="220" height="134"/>`;
    for (const o of obs) s += `<rect x="${o[0]}" y="${o[1]}" width="${o[2]}" height="${o[3]}" fill="currentColor" opacity=".16"/><rect class="ink" x="${o[0]}" y="${o[1]}" width="${o[2]}" height="${o[3]}"/>`;
    const tree = [[[24, 118], [44, 98]], [[44, 98], [40, 62]], [[44, 98], [74, 104]], [[74, 104], [100, 124]], [[74, 104], [104, 86]], [[104, 86], [108, 50]], [[108, 50], [140, 40]], [[140, 40], [158, 64]], [[158, 64], [160, 100]], [[160, 100], [190, 110]], [[108, 50], [100, 22]], [[160, 100], [150, 130]]];
    s += tree.map(([p, q]) => `<line class="ink-soft" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`).join('');
    const route = [[24, 118], [44, 98], [74, 104], [104, 86], [108, 50], [140, 40], [158, 64], [160, 100], [190, 110], [214, 96]];
    return s + draw(route) + dot(route[0], 4.5, 'fill-ink') + dot(route[9], 4.5, 'fill-accent');
  },
};

export function plateArt(id) {
  const body = (FIG[id] || FIG['graph-theory'])();
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true" focusable="false"><style>.plate-text{font:10px var(--font-mono);fill:var(--text-3)}.plate-letter{font:500 13px var(--font-mono);fill:currentColor}</style>${body}</svg>`;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV'];
export const roman = (i) => ROMAN[i] || String(i + 1);
