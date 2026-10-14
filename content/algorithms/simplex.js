import { makeRng } from '../../js/lib/rng.js';

// Exact fractions. The tableau then shows 1/2 and not 0.5, and a tie in the ratio test is a
// real tie and not an accident of rounding.
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
function Q(n, d = 1) {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) throw new Error('The numbers grew too large to keep as exact fractions. Use smaller numbers in the problem.');
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const ZERO = Q(0), ONE = Q(1);
const add = (a, b) => { const g = gcd(a.d, b.d); return Q(a.n * (b.d / g) + b.n * (a.d / g), (a.d / g) * b.d); };
const neg = (a) => ({ n: -a.n, d: a.d });
const sub = (a, b) => add(a, neg(b));
const mul = (a, b) => { const g1 = gcd(a.n, b.d), g2 = gcd(b.n, a.d); return Q((a.n / g1) * (b.n / g2), (a.d / g2) * (b.d / g1)); };
const div = (a, b) => mul(a, Q(b.d, b.n));
const cmp = (a, b) => Math.sign(sub(a, b).n);
const num = (a) => a.n / a.d;
const show = (a) => `${a.n < 0 ? '−' : ''}${Math.abs(a.n)}${a.d === 1 ? '' : `/${a.d}`}`;
const point = (x, y) => `(${show(x)}, ${show(y)})`;
const listOf = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// "2x + 5y" written back out from its two coefficients.
function exprText(a) {
  const part = (q, v, first) => {
    if (q.n === 0) return '';
    const size = Math.abs(q.n) === q.d ? '' : q.d === 1 ? String(Math.abs(q.n)) : `(${Math.abs(q.n)}/${q.d})`;
    return first ? `${q.n < 0 ? '−' : ''}${size}${v}` : ` ${q.n < 0 ? '−' : '+'} ${size}${v}`;
  };
  const x = part(a[0], 'x', true);
  return (x + part(a[1], 'y', !x)) || '0';
}

const NUMBER = '\\d+(?:\\.\\d+)?(?:/\\d+)?';
function parseNumber(text) {
  const [top, bottom] = text.split('/');
  const [whole, frac = ''] = top.split('.');
  if (whole.length + frac.length > 7) throw new Error(`The number ${text} is too long. Use numbers with at most 7 digits.`);
  const q = Q(Number(whole + frac), 10 ** frac.length);
  if (bottom === undefined) return q;
  if (Number(bottom) === 0) throw new Error(`"${text}" divides by zero.`);
  return div(q, Q(Number(bottom)));
}

// "2x + 5y" -> [2, 5]. Only x and y are allowed, each with a number in front or none.
function parseExpr(text, what) {
  const s = text.replace(/\s+/g, '').replace(/[−–]/g, '-').toLowerCase();
  const term = new RegExp(`([+-]?)(${NUMBER})?\\*?([xy])`, 'y');
  const coef = [ZERO, ZERO];
  let at = 0;
  while (at < s.length) {
    term.lastIndex = at;
    const m = term.exec(s);
    if (!m || (at > 0 && !m[1])) throw new Error(`Could not read ${what} "${text.trim()}". Use x and y only, each with a number in front or none, such as 2x + 5y.`);
    const size = m[2] ? parseNumber(m[2]) : ONE;
    const k = m[3] === 'x' ? 0 : 1;
    coef[k] = add(coef[k], m[1] === '-' ? neg(size) : size);
    at = term.lastIndex;
  }
  if (!s) throw new Error(`Could not read ${what}: it is empty. Write it with x and y, such as 2x + 5y.`);
  return coef;
}

// The typed problem, with every limit rewritten as "something ≤ a number". A limit typed
// with ≥ has all its signs changed. A limit typed with = becomes two limits, one each way.
function parseProblem(objective, limits) {
  const goal = String(objective).trim().replace(/^max(?:imi[sz]e)?\s*:?\s*/i, '');
  if (/^min/i.test(goal)) throw new Error('This lesson maximises. To minimise something, maximise its opposite: to minimise 2x + 3y, type −2x − 3y and change the sign of the profit at the end.');
  const c = parseExpr(goal, 'the profit');
  const rows = [];
  for (const piece of String(limits).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = piece.match(/^(.*?)(<=|=<|≤|>=|=>|≥|=)(.*)$/);
    const right = m && m[3].replace(/\s+/g, '').replace(/[−–]/g, '-').match(new RegExp(`^([+-]?)(${NUMBER})$`));
    if (!m || !right) throw new Error(`Could not read the limit "${piece}". Write each limit with x and y on the left and a number on the right, such as x + 2y <= 10.`);
    const a = parseExpr(m[1], 'the left side of a limit,');
    if (a[0].n === 0 && a[1].n === 0) throw new Error(`The limit "${piece}" does not mention x or y.`);
    const b = right[1] === '-' ? neg(parseNumber(right[2])) : parseNumber(right[2]);
    const kind = m[2].includes('<') || m[2] === '≤' ? 'le' : m[2] === '=' ? 'eq' : 'ge';
    const typed = `${exprText(a)} ${kind === 'le' ? '≤' : kind === 'ge' ? '≥' : '='} ${show(b)}`;
    if (kind !== 'ge') rows.push({ a, b, text: `${exprText(a)} ≤ ${show(b)}`, typed, kind });
    if (kind !== 'le') rows.push({ a: a.map(neg), b: neg(b), text: `${exprText(a.map(neg))} ≤ ${show(neg(b))}`, typed, kind });
  }
  if (!rows.length) throw new Error('No limits found. Write at least one, such as x + 2y <= 10.');
  if (rows.length > 6) throw new Error(`At most 6 limits, please. These make ${rows.length} once each "=" is counted as two.`);
  return { c, rows };
}

// A problem given as plain whole numbers { c, A, b }, used by the tests and the experiment.
function fromNumbers({ c, A, b }) {
  return { c: c.map((v) => Q(v)), rows: A.map((a, i) => { const q = a.map((v) => Q(v)); return { a: q, b: Q(b[i]), text: `${exprText(q)} ≤ ${show(Q(b[i]))}`, typed: '', kind: 'le' }; }) };
}

// Every corner of the allowed shape, found directly: cross each pair of boundary lines and
// keep the crossing points that obey every limit. The demonstration uses this only for
// drawing, and for the answer it shows when the method itself cannot start.
function cornersOf(c, rows) {
  const lines = rows.map((r) => [r.a[0], r.a[1], r.b]).concat([[ONE, ZERO, ZERO], [ZERO, ONE, ZERO]]);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const [a1, a2, p] = lines[i], [b1, b2, q] = lines[j];
      const det = sub(mul(a1, b2), mul(a2, b1));
      if (det.n === 0) continue;
      const x = div(sub(mul(p, b2), mul(a2, q)), det), y = div(sub(mul(a1, q), mul(p, b1)), det);
      if (x.n < 0 || y.n < 0 || rows.some((r) => cmp(add(mul(r.a[0], x), mul(r.a[1], y)), r.b) > 0)) continue;
      if (!out.some((o) => cmp(o.x, x) === 0 && cmp(o.y, y) === 0)) out.push({ x, y, value: add(mul(c[0], x), mul(c[1], y)) });
    }
  }
  return out;
}
// A direction in which the allowed shape goes on for ever. With `c` given, only a direction
// that also raises the profit counts.
function openDirection(rows, c) {
  const candidates = [[ONE, ZERO], [ZERO, ONE]];
  for (const r of rows) candidates.push([r.a[1], neg(r.a[0])], [neg(r.a[1]), r.a[0]]);
  return candidates.find(([dx, dy]) => dx.n >= 0 && dy.n >= 0 && (dx.n > 0 || dy.n > 0)
    && rows.every((r) => add(mul(r.a[0], dx), mul(r.a[1], dy)).n <= 0)
    && (!c || add(mul(c[0], dx), mul(c[1], dy)).n > 0)) || null;
}

// For the picture only: the size of the drawing, the allowed shape cut to fit it, and the
// stretch of each limit line that crosses it.
function geometryOf(c, rows) {
  const corners = cornersOf(c, rows);
  const open = !!openDirection(rows, null);
  let X = Math.max(0, ...corners.map((p) => num(p.x))), Y = Math.max(0, ...corners.map((p) => num(p.y)));
  if (open || !corners.length) {
    for (const r of rows) {
      if (r.a[0].n !== 0 && num(r.b) / num(r.a[0]) > 0) X = Math.max(X, num(r.b) / num(r.a[0]));
      if (r.a[1].n !== 0 && num(r.b) / num(r.a[1]) > 0) Y = Math.max(Y, num(r.b) / num(r.a[1]));
    }
  }
  if (open) { X = Y = Math.max(X, Y, 1) * 1.6; } else { X = (X || Y || 1) * 1.22; Y = (Y || X) * (Y ? 1.22 : 1); }
  let shape = [[0, 0], [X, 0], [X, Y], [0, Y]];
  for (const r of rows) {
    const a = num(r.a[0]), b = num(r.a[1]), lim = num(r.b);
    const inside = (p) => a * p[0] + b * p[1] <= lim + 1e-9;
    const next = [];
    shape.forEach((p, i) => {
      const q = shape[(i + 1) % shape.length];
      if (inside(p)) next.push(p);
      if (inside(p) !== inside(q)) {
        const s = (lim - a * p[0] - b * p[1]) / (a * (q[0] - p[0]) + b * (q[1] - p[1]));
        next.push([p[0] + s * (q[0] - p[0]), p[1] + s * (q[1] - p[1])]);
      }
    });
    shape = next;
  }
  const cut = (a, b, lim) => {      // the part of the line a·x + b·y = lim inside the drawing
    const pts = [];
    const keep = (x, y) => { if (x >= -1e-9 && x <= X + 1e-9 && y >= -1e-9 && y <= Y + 1e-9 && !pts.some((p) => Math.hypot(p[0] - x, p[1] - y) < 1e-9)) pts.push([x, y]); };
    if (b !== 0) { keep(0, lim / b); keep(X, (lim - a * X) / b); }
    if (a !== 0) { keep(lim / a, 0); keep((lim - b * Y) / a, Y); }
    return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : null;
  };
  return { corners, X, Y, shape, cut, lines: rows.map((r) => cut(num(r.a[0]), num(r.a[1]), num(r.b))) };
}

function run(input, t) {
  const { c, rows } = input.problem ? fromNumbers(input.problem) : parseProblem(input.objective, input.limits);
  const m = rows.length, n = 2, V = n + m;     // V is the index of the value column
  const names = ['x', 'y', ...rows.map((_, i) => `s${i + 1}`)];
  const goal = exprText(c);
  const boundary = (j) => (j < n ? `the rule that ${names[j]} cannot go below zero` : `limit ${j - n + 1}, ${rows[j - n].text}`);

  // The tableau: one row per limit, [ A | I | b ], and the profit row [ −c | 0 | 0 ].
  const T = rows.map((r, i) => [r.a[0], r.a[1], ...rows.map((_, k) => (k === i ? ONE : ZERO)), r.b]);
  T.push([neg(c[0]), neg(c[1]), ...rows.map(() => ZERO), ZERO]);
  const basis = rows.map((_, i) => n + i);
  const valueOf = (j) => (basis.includes(j) ? T[basis.indexOf(j)][V] : ZERO);
  const here = () => [valueOf(0), valueOf(1)];
  const path = [here()];
  // The corner the picture shows. It changes only when a pivot is complete, so that a
  // half-rewritten table is never drawn as if it were a corner.
  let spot = here(), spotProfit = T[m][V];
  let status = null, pivots = 0, ties = 0, stalls = 0, ray = null, other = null;

  let geo = null;
  const views = ({ enter = null, leave = null, dir = null, reach = null, hits = [], lit = [], ratios = {}, cells = [], final = null, labelled = true } = {}) => {
    geo = geo || geometryOf(c, rows);
    const { X, Y, shape, corners } = geo;
    const [hx, hy] = spot.map(num);
    const z = num(spotProfit);
    const layers = [];
    if (shape.length >= 3) layers.push({ type: 'polygon', points: shape, role: 'moss', fill: true, fillAlpha: 0.24, stroke: false });
    layers.push({ type: 'line', points: [[0, Y], [0, 0], [X, 0]], role: 'muted', width: 1.3 });
    geo.lines.forEach((seg, i) => {
      if (!seg) return;
      const on = lit.includes(i);
      const a = num(rows[i].a[0]), b = num(rows[i].a[1]);
      layers.push({ type: 'line', points: seg, role: on ? 'compare' : 'sage', width: on ? 3 : 1.5 });
      layers.push({ type: 'text', at: [seg[0][0] + 0.62 * (seg[1][0] - seg[0][0]), seg[0][1] + 0.62 * (seg[1][1] - seg[0][1])], text: `${i + 1}`, role: on ? 'compare' : 'muted', size: 12,
        dx: a > 0 ? 7 : a < 0 ? -7 : 0, dy: b > 0 ? -7 : b < 0 ? 15 : 4, align: a < 0 ? 'right' : 'left' });
    });
    if (final !== 'no-start' && (c[0].n !== 0 || c[1].n !== 0)) {
      const level = geo.cut(num(c[0]), num(c[1]), z);
      if (level) layers.push({ type: 'line', points: level, role: 'ink', width: 1.2, dash: [5, 5], alpha: 0.55 });
    }
    const walked = path.map((p) => p.map(num));
    if (walked.length > 1) layers.push({ type: 'line', points: walked, role: 'terracotta', width: 3 });
    if (dir) {
      const [dx, dy] = dir.map(num);
      // how far to draw the arrow: to the landing point if it is known, to the edge of the drawing for an endless ray, otherwise a short stub
      const toEdge = Math.min(dx > 0 ? (X - hx) / dx : Infinity, dy > 0 ? (Y - hy) / dy : Infinity, dx < 0 ? hx / -dx : Infinity, dy < 0 ? hy / -dy : Infinity);
      const stub = 0.2 / (Math.hypot(dx / X, dy / Y) || 1);
      const len = reach !== null ? reach : final === 'unbounded' ? toEdge * 0.97 : Math.min(stub, toEdge);
      if (len > 0) layers.push({ type: 'segments', segments: [[hx, hy, hx + dx * len, hy + dy * len]], role: final === 'unbounded' ? 'alert' : 'ochre', width: 2.6, arrow: true });
      for (const h of hits) layers.push({ type: 'points', points: [[hx + dx * h.at, hy + dy * h.at]], role: h.chosen ? 'current' : 'ochre', r: h.chosen ? 5 : 4.5, hollow: !h.chosen });
    }
    if (final === 'optimal' || (final === 'no-start' && labelled)) {
      const top = corners.length ? corners.reduce((a, b) => (cmp(b.value, a.value) > 0 ? b : a)) : null;
      layers.push({ type: 'points', r: 4, points: corners.map((p) => {
        const best = final === 'optimal' ? cmp(p.x, spot[0]) === 0 && cmp(p.y, spot[1]) === 0 : cmp(p.value, top.value) === 0 && !openDirection(rows, c);
        return { x: num(p.x), y: num(p.y), role: best ? 'forest' : 'muted', r: best ? 6.5 : 4, label: `${point(p.x, p.y)} profit ${show(p.value)}` };
      }) });
    }
    if (final === 'no-start') layers.push({ type: 'points', points: [{ x: 0, y: 0, role: 'alert', r: 6, label: 'start (0, 0): not allowed' }], ring: true });
    else if (final !== 'optimal') {
      layers.push({ type: 'points', points: walked.slice(0, -1), role: 'terracotta', r: 3.5 });
      layers.push({ type: 'points', points: [{ x: hx, y: hy, role: 'current', r: 6, label: `${point(...spot)} profit ${show(spotProfit)}` }], ring: true });
    }
    const scene = {
      kind: 'scene', title: 'Every mix of x and y: the shaded shape obeys all the limits', aspect: 0.62,
      x: [-0.05 * X, X], y: [-0.07 * Y, Y], axes: { xLabel: 'x', yLabel: 'y' }, layers,
      legend: [{ label: 'allowed mixes', role: 'moss' }, { label: 'a limit, numbered', role: 'sage' }, { label: 'the walk so far', role: 'terracotta' }, { label: 'edge and limits being tested', role: 'ochre' }, { label: 'mixes with the same profit as here', role: 'ink' }, { label: 'best corner', role: 'forest' }],
    };

    const roles = {};
    if (enter !== null) for (let i = 0; i <= m; i++) roles[`${i},${enter}`] = 'compare';
    if (leave !== null) for (let k = 0; k <= V; k++) roles[`${leave},${k}`] = 'compare';
    if (enter !== null && leave !== null) roles[`${leave},${enter}`] = 'current';
    for (const [i, k, role] of cells) roles[`${i},${k}`] = role;
    const table = {
      kind: 'table', corner: 'basis', title: 'The tableau: one row per limit, and the profit row',
      colLabels: [...names, 'value', 'ratio'],
      rowLabels: [...basis.map((j) => names[j]), 'profit'],
      cells: T.map((row, i) => [...row.map(show), ratios[i] !== undefined ? ratios[i] : '']),
      roles,
    };
    return [scene, table];
  };
  const state = () => ({ corner: point(...spot), profit: show(spotProfit), basis: basis.map((j) => names[j]).join(' ') });

  const rewritten = rows.filter((r) => r.kind !== 'le');
  const rewriteNote = rewritten.length ? ` ${listOf([...new Set(rewritten.map((r) => `"${r.typed}"`))])} ${new Set(rewritten.map((r) => r.typed)).size === 1 ? 'was' : 'were'} not typed as "at most", so the table holds ${rewritten.length === 1 ? 'it' : 'them'} rewritten: ${listOf(rewritten.map((r) => `"${r.text}"`))}.` : '';
  const limitList = listOf(rows.map((r, i) => `(${i + 1}) ${r.text}`));

  // Outside the form: a negative number on the right of a limit. The origin breaks that
  // limit, so there is no corner to start from. Show why, and show the true answer.
  const bad = rows.findIndex((r) => r.b.n < 0);
  if (bad >= 0) {
    const corners = cornersOf(c, rows);
    const open = corners.length ? openDirection(rows, c) : null;
    const top = corners.length ? corners.reduce((a, b) => (cmp(b.value, a.value) > 0 ? b : a)) : null;
    t.frame(() => ({ line: [1, 2], note: `Maximise **${goal}** with x and y never negative and these limits: ${limitList}.${rewriteNote} This problem is outside the form the method needs. The walk always starts at the corner where x = 0 and y = 0, and there limit ${bad + 1} reads 0 ≤ ${show(rows[bad].b)}, which is false. In the table the same fact shows as a negative number in the value column: the slack ${names[n + bad]} would have to be ${show(rows[bad].b)}, and a slack cannot be negative. With no allowed corner to start from, the walk cannot begin.`,
      views: views({ final: 'no-start', labelled: false, lit: [bad], cells: [[bad, V, 'alert']] }), vars: { start: '(0, 0)', breaks: `limit ${bad + 1}` } }));
    t.frame(() => ({ line: [1, 2], note: !corners.length
      ? 'Checking the picture directly shows something more: no point obeys every limit at once, so there is no allowed mix at all. A full solver finds that out in an extra first phase, before any walking.'
      : open
        ? 'Checking the shape directly shows that it goes on for ever in a direction that keeps raising the profit, so this problem has no best mix. A full solver would first find an allowed corner in an extra phase and then discover that.'
        : `For comparison, the profit at every corner of the shaded shape has been worked out directly and written beside it. The best is **${point(top.x, top.y)}** with profit ${show(top.value)}. A full solver reaches it by first running an extra phase whose only job is to find an allowed starting corner, and then walking from corner to corner exactly as this lesson shows.`,
      views: views({ final: 'no-start', lit: [bad], cells: [[bad, V, 'alert']] }), vars: { start: '(0, 0)', breaks: `limit ${bad + 1}` } }));
    return {
      status: 'no-start', x: null, y: null, value: null, exact: null, pivots: 0, ties: 0, stalls: 0, alternative: false, endlessTie: false, ray: null, path: [], basis: [],
      truth: !corners.length ? { kind: 'empty' } : open ? { kind: 'unbounded' } : { kind: 'best', x: num(top.x), y: num(top.y), value: num(top.value) },
      problem: { c: c.map(num), A: rows.map((r) => r.a.map(num)), b: rows.map((r) => num(r.b)) },
    };
  }

  t.frame(() => ({ line: [3, 4, 5], note: `Maximise **${goal}** with x and y never negative and these limits: ${limitList}.${rewriteNote} The shaded shape is every mix of x and y that obeys all of them. Each limit gets a helper variable called a **slack**, which counts how much room is left under that limit: ${names[n]} for limit 1${m > 1 ? ', and so on' : ''}. The table has one row per limit and a last row for the profit. The names down its left side are called the **basis**: the variables whose values can be read from the value column. Every other variable is 0. The walk starts at the corner (0, 0), where the profit is 0 and every slack equals its whole limit, so the basis starts as the slacks.`,
    views: views(), vars: state() }));

  for (;;) {
    // Entering variable, by Bland's rule: the first column with a negative number in the profit row.
    const improving = [];
    for (let j = 0; j < V; j++) if (T[m][j].n < 0) improving.push(j);
    if (!improving.length) { status = 'optimal'; break; }
    const enter = improving[0];
    const E = names[enter];
    const dir = [0, 1].map((k) => (k === enter ? ONE : basis.includes(k) ? neg(T[basis.indexOf(k)][enter]) : ZERO));
    const gain = neg(T[m][enter]);
    t.frame(() => ({ line: [7, 8],
      note: `Look at the profit row. It has ${listOf(improving.map((j) => `${show(T[m][j])} under ${names[j]}`))}. A negative number there means the profit rises when that variable grows: each extra unit of ${E} adds ${show(gain)}. So this corner is not the best yet. ${improving.length > 1 ? `Bland's rule decides which variable grows: take the first such column from the left. That is **${E}**${improving.slice(1).some((j) => cmp(neg(T[m][j]), gain) > 0) ? ', even though another column promises more per unit' : ''}.` : `Only one column is negative, so **${E}** grows.`} In the picture, growing ${E} ${enter < n ? '' : `(leaving limit ${enter - n + 1} behind) `}means moving along the edge marked by the arrow.`,
      views: views({ enter, dir, cells: improving.map((j) => [m, j, j === enter ? 'current' : 'compare']) }), vars: { ...state(), entering: E } }));

    // Ratio test: how far can the entering variable grow before a basis variable hits zero?
    let leave = -1, best = null;
    const tested = [], skipped = [];
    const ratios = {};
    for (let i = 0; i < m; i++) {
      if (T[i][enter].n <= 0) { skipped.push(i); continue; }
      const ratio = div(T[i][V], T[i][enter]);
      t.count('ratio tests');
      const order = leave < 0 ? -1 : cmp(ratio, best);
      if (order < 0 || (order === 0 && basis[i] < basis[leave])) { leave = i; best = ratio; }
      tested.push({ i, ratio });
      ratios[i] = show(ratio);
      const B = names[basis[i]];
      t.frame(() => ({ line: [10, 11],
        note: `Row ${B}: how far can ${E} grow before ${B} runs out? The row has ${show(T[i][enter])} in the ${E} column and ${show(T[i][V])} in the value column, so ${B} reaches zero when ${E} has grown by ${show(T[i][V])} ÷ ${show(T[i][enter])} = **${show(ratio)}**. That number is the row's ratio. ${basis[i] < n ? `Past that point ${B} would be negative, which is not allowed.` : `That is where the walk would meet ${boundary(basis[i])}.`}`,
        views: views({ enter, dir, ratios: { ...ratios }, lit: basis[i] >= n ? [basis[i] - n] : [], hits: tested.map((x) => ({ at: num(x.ratio), chosen: false })), cells: [[i, enter, 'current'], [i, V, 'current'], [i, V + 1, 'current']] }),
        vars: { ...state(), entering: E, row: B, ratio: show(ratio) } }));
    }
    const idle = skipped.map((i) => names[basis[i]]);
    if (leave < 0) {
      status = 'unbounded';
      ray = dir;
      t.frame(() => ({ line: [12, 13],
        note: `No row has a positive number in the ${E} column${m > 1 ? '' : ' (there is only one row)'}, so growing ${E} never uses up any limit. Each unit of ${E} adds ${show(gain)} to the profit. Follow the arrow: every point along it obeys every limit, and the profit keeps rising without end. **There is no best mix.** A real business always runs out of something, so an answer like this usually means a limit was left out of the problem.`,
        views: views({ enter, dir, final: 'unbounded' }), vars: { ...state(), entering: E } }));
      break;
    }
    const tied = tested.filter((x) => cmp(x.ratio, best) === 0).map((x) => x.i);
    if (tied.length > 1) ties++;
    const L = names[basis[leave]];
    const leaving = basis[leave];
    t.frame(() => ({ line: [14, 15],
      note: `${tested.length === 1 ? `Only row ${L} sets a limit on ${E}, with ratio ${show(best)}.` : tied.length > 1 ? `Rows ${listOf(tied.map((i) => names[basis[i]]))} tie for the smallest ratio, ${show(best)}. Bland's rule breaks the tie: take the variable that comes first in the list ${names.join(', ')}. That is ${L}.` : `The smallest ratio is ${show(best)}, in row ${L}.`}${idle.length ? ` ${idle.length === 1 ? `Row ${idle[0]} was not tested: its number` : `Rows ${listOf(idle)} were not tested: their numbers`} in the ${E} column ${idle.length === 1 ? 'is' : 'are'} zero or negative, so growing ${E} never uses ${idle.length === 1 ? 'it' : 'them'} up.` : ''} ${best.n === 0 ? `A ratio of 0 means ${L} is already at zero, so ${E} cannot grow at all here. The pivot still happens, but the corner will not move.` : `Growing ${E} by more than ${show(best)} would push ${L} below zero and break ${boundary(leaving)}. So ${E} grows by exactly ${show(best)}.`} **${E} enters the basis and ${L} leaves.** The cell where the ${E} column crosses row ${L} is the pivot.`,
      views: views({ enter, leave, dir, reach: num(best), ratios: { ...ratios }, lit: leaving >= n ? [leaving - n] : [], hits: tested.map((x) => ({ at: num(x.ratio), chosen: x.i === leave })) }),
      vars: { ...state(), entering: E, leaving: L, ratio: show(best) } }));

    // Pivot: rewrite the table so that the entering variable has a 1 in the pivot row and 0 elsewhere.
    const p = T[leave][enter];
    const before = T[m][V];
    T[leave] = T[leave].map((v) => div(v, p));
    basis[leave] = enter;
    pivots++;
    t.count('pivots');
    t.count('row operations');
    t.frame(() => ({ line: [16, 19],
      note: `Now rewrite the table for the new corner. Start with the pivot row. ${p.n === p.d ? `The pivot is already 1, so the row stays as it is.` : `Divide the whole row by the pivot, ${show(p)}, so that ${E} has a 1 there.`} It is now the row of ${E}, and its value column says ${E} = ${show(T[leave][V])}.`,
      views: views({ enter, dir, reach: num(best), hits: [{ at: num(best), chosen: true }], cells: T[leave].map((_, k) => [leave, k, k === enter ? 'current' : 'compare']) }), vars: { entering: E, leaving: L, pivot: show(p) } }));
    const clean = [];
    for (let i = 0; i <= m; i++) {
      if (i === leave) continue;
      const f = T[i][enter];
      const label = i === m ? 'profit' : names[basis[i]];
      if (f.n === 0) { clean.push(label); continue; }
      const was = T[i][V];
      T[i] = T[i].map((v, k) => sub(v, mul(f, T[leave][k])));
      t.count('row operations');
      const times = Math.abs(f.n) === f.d ? '' : `${show(f.n < 0 ? neg(f) : f)} times `;
      t.frame(() => ({ line: [17, 18],
        note: `${i === m ? 'The profit row' : `Row ${label}`} has ${show(f)} in the ${E} column. ${f.n > 0 ? `Subtract ${times}the ${E} row` : `Add ${times}the ${E} row`} to turn that into 0. ${cmp(T[i][V], was) === 0 ? `${i === m ? 'The profit' : 'Its value'} stays at ${i === m ? `**${show(was)}**` : show(was)}, because the ${E} row has 0 in its value column.` : i === m ? `The profit goes from ${show(was)} to **${show(T[i][V])}**.` : `Its value goes from ${show(was)} to ${show(T[i][V])}.`}`,
        views: views({ enter, dir, reach: num(best), hits: [{ at: num(best), chosen: true }], cells: [...T[leave].map((_, k) => [leave, k, 'compare']), ...T[i].map((_, k) => [i, k, 'current'])] }), vars: { entering: E, row: label, value: show(T[i][V]) } }));
    }
    const moved = best.n !== 0;
    if (!moved) stalls++;
    spot = here();
    spotProfit = T[m][V];
    path.push(spot);
    t.frame(() => ({ line: 6,
      note: `${clean.length ? `${clean.length === 1 ? `${clean[0] === 'profit' ? 'The profit row' : `Row ${clean[0]}`} already had` : `${listOf(clean.map((x) => (x === 'profit' ? 'the profit row' : `row ${x}`))).replace(/^./, (ch) => ch.toUpperCase())} already had`} 0 in the ${E} column and needed no change. ` : ''}The table now describes the corner **${point(...here())}**. Read it from the value column: ${listOf(basis.map((j, i) => `${names[j]} = ${show(T[i][V])}`))}, and every variable outside the basis is 0. ${moved ? `The profit is ${show(T[m][V])}, up from ${show(before)}.` : `The corner has not moved and the profit is still ${show(T[m][V])}. More than two boundary lines pass through this corner, and the pivot only changed which two of them the table uses to describe it. This is called a degenerate pivot.`}`,
      views: views(), vars: state() }));
  }

  if (status === 'optimal') {
    // A 0 in the profit row under a variable outside the basis: growing it changes nothing.
    // If it can grow at all, a second corner earns the same profit.
    for (let j = 0; j < V && !other; j++) {
      if (basis.includes(j) || T[m][j].n !== 0) continue;
      let room = null;
      for (let i = 0; i < m; i++) if (T[i][j].n > 0) { const r = div(T[i][V], T[i][j]); if (room === null || cmp(r, room) < 0) room = r; }
      if (room !== null && room.n === 0) continue;
      const d = [0, 1].map((k) => (k === j ? ONE : basis.includes(k) ? neg(T[basis.indexOf(k)][j]) : ZERO));
      other = { name: names[j], endless: room === null, to: room === null ? null : here().map((v, k) => add(v, mul(room, d[k]))) };
    }
    const [bx, by] = here();
    t.frame(() => ({ line: 9,
      note: `No number in the profit row is negative, so no edge leaving this corner raises the profit. The shape has flat sides and no dents, so a corner that none of its neighbours can beat is the best point of all. **The best mix is x = ${show(bx)}, y = ${show(by)}, with profit ${show(T[m][V])}**, reached after ${pivots} ${pivots === 1 ? 'pivot' : 'pivots'}. The picture now shows the profit at every corner, worked out directly, so you can check that none is higher.${other ? ` One more thing: the profit row has a 0 under ${other.name}, which is outside the basis, so moving along that edge changes nothing. ${other.endless ? 'That edge never ends, so every point along it earns the same profit.' : `The corner at its far end, ${point(...other.to)}, earns the same ${show(T[m][V])}, and so does every point between the two.`}` : ''}`,
      views: views({ final: 'optimal', cells: [[m, V, 'done']] }), vars: state() }));
  }

  const [fx, fy] = here();
  return {
    status, pivots, ties, stalls,
    x: num(fx), y: num(fy), value: num(T[m][V]),
    exact: { x: show(fx), y: show(fy), value: show(T[m][V]) },
    alternative: !!other,
    endlessTie: !!other && other.endless,
    ray: ray ? ray.map(num) : null,
    path: path.map((p) => p.map(num)),
    basis: basis.map((j) => names[j]),
    truth: null,
    problem: { c: c.map(num), A: rows.map((r) => r.a.map(num)), b: rows.map((r) => num(r.b)) },
  };
}

// Independent reference for the tests. It shares no code with the method above and uses
// ordinary floating-point numbers: cross every pair of boundary lines, keep the crossing
// points that obey every limit, and evaluate the profit at each of those corners. The shape
// is open towards more profit if some direction that never leaves it also raises the profit.
function checkEveryCorner({ c, A, b }) {
  const lines = A.map((a, i) => [a[0], a[1], b[i]]).concat([[1, 0, 0], [0, 1, 0]]);
  const allowed = (x, y) => x >= -1e-9 && y >= -1e-9 && A.every((a, i) => a[0] * x + a[1] * y <= b[i] + 1e-9);
  const corners = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const [a1, a2, p] = lines[i], [b1, b2, q] = lines[j];
      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) < 1e-12) continue;
      const x = (p * b2 - a2 * q) / det, y = (a1 * q - p * b1) / det;
      if (allowed(x, y) && !corners.some((o) => Math.abs(o.x - x) < 1e-9 && Math.abs(o.y - y) < 1e-9)) corners.push({ x, y, value: c[0] * x + c[1] * y });
    }
  }
  const directions = [[1, 0], [0, 1]];
  for (const a of A) directions.push([a[1], -a[0]], [-a[1], a[0]]);
  const unbounded = corners.length > 0 && directions.some(([dx, dy]) => dx >= 0 && dy >= 0 && dx + dy > 0
    && A.every((a) => a[0] * dx + a[1] * dy <= 1e-12) && c[0] * dx + c[1] * dy > 1e-12);
  const best = corners.length ? Math.max(...corners.map((o) => o.value)) : null;
  return { corners, best, unbounded, winners: corners.filter((o) => Math.abs(o.value - best) < 1e-9) };
}

const agreesWithEveryCorner = (r) => {
  const ref = checkEveryCorner(r.problem);
  const { c, A, b } = r.problem;
  const isCorner = (p) => ref.corners.some((o) => Math.abs(o.x - p[0]) < 1e-9 && Math.abs(o.y - p[1]) < 1e-9);
  const bad = r.path.find((p) => !isCorner(p));
  if (bad) return `the walk visited (${bad[0]}, ${bad[1]}), which is not a corner of the allowed shape`;
  const profits = r.path.map((p) => c[0] * p[0] + c[1] * p[1]);
  if (profits.some((v, i) => i > 0 && v < profits[i - 1] - 1e-9)) return 'the profit went down during the walk';
  if (r.path.length !== r.pivots + 1) return `${r.pivots} pivots but ${r.path.length} corners on the walk`;
  const limit = ((A.length + 2) * (A.length + 1)) / 2;
  if (r.pivots > limit) return `${r.pivots} pivots, more than the ${limit} possible bases`;
  if (ref.unbounded) {
    if (r.status !== 'unbounded') return `reported ${r.status}, but the shape is open in a direction that raises the profit`;
    const [dx, dy] = r.ray;
    const stays = dx >= 0 && dy >= 0 && A.every((a) => a[0] * dx + a[1] * dy <= 1e-9);
    return (stays && c[0] * dx + c[1] * dy > 1e-9) || 'the reported direction leaves the shape or does not raise the profit';
  }
  if (r.status !== 'optimal') return `reported ${r.status}, but checking every corner gives a best profit of ${ref.best}`;
  if (Math.abs(r.value - ref.best) > 1e-9) return `profit ${r.value}, but the best over all ${ref.corners.length} corners is ${ref.best}`;
  if (Math.abs(c[0] * r.x + c[1] * r.y - r.value) > 1e-9) return 'the reported profit is not the profit of the reported mix';
  if (A.some((a, i) => a[0] * r.x + a[1] * r.y > b[i] + 1e-9) || r.x < 0 || r.y < 0) return 'the reported mix breaks a limit';
  if (r.alternative && !r.endlessTie && ref.winners.length < 2) return `reported a second best corner, but only ${ref.winners.length} corner reaches the best profit`;
  return true;
};

// Small random problems for the tests, fixed by their seed. With `mixed`, some numbers are
// negative, so some of the shapes are open and some of the problems have no best mix.
function randomProblem(seed, m, mixed) {
  const rng = makeRng(seed);
  const lo = mixed ? -3 : 0;
  const c = [rng.int(mixed ? -2 : 1, 9), rng.int(1, 9)];
  const A = [], b = [];
  for (let i = 0; i < m; i++) {
    const a = [rng.int(lo, 6), rng.int(lo, 6)];
    if (a[0] === 0 && a[1] === 0) a[i % 2] = 1;
    A.push(a);
    b.push(rng.int(0, 5) === 0 ? 0 : rng.int(4, 30));
  }
  return { c, A, b };
}

// The family of problems behind the experiment: m limits whose lines follow a curve from
// (0, m²) down to (m, 0), so that the shape has m + 2 corners.
function staircase(m, objective) {
  const A = [], b = [];
  for (let k = 1; k <= m; k++) { A.push([2 * k - 1, 1]); b.push(m * m + k * (k - 1)); }
  return { c: objective === 'long' ? [1, 2 * m] : [0, 1], A, b };
}

const BAKERY = 'x <= 6, y <= 4, x + 2y <= 10';
const corner = (r) => `(${r.exact.x}, ${r.exact.y})`;

export default {
  meta: {
    id: 'simplex',
    name: 'Simplex Method',
    aliases: ['simplex algorithm', 'linear programming', 'LP', 'linear optimization', 'Dantzig\'s simplex method', 'tableau method'],
    kind: 'algorithm',
    discipline: 'optimization',
    alsoIn: [
      { id: 'mathematics', why: 'Each step is an elimination step from linear algebra, and the reason it works is a fact about shapes with flat sides: a linear function reaches its largest value at a corner.' },
    ],
    subfield: 'Linear programming',
    family: 'Pivoting methods',
    lab: 'optimization',
    year: 1947,
    authors: 'George B. Dantzig',
    summary: 'Maximises a linear objective under linear limits by walking from corner to corner of the allowed region, raising the objective at each step, until no neighbouring corner is better.',
    difficulty: 'advanced',
    order: 525,
    paradigms: ['local-search', 'iterative-refinement'],
    randomized: false,
    approximate: false,
    time: { best: 'O(m(n + m)) per pivot', average: 'Few pivots on practical problems; no simple formula', worst: 'Exponentially many pivots on specially built problems', class: 'iterative' },
    space: { worst: 'O(m(n + m))', class: 'quadratic' },
    tags: {
      problems: ['what mix of products earns the most', 'how much of each thing to make', 'make the most profit under several limits', 'share limited resources between products', 'cheapest mix that meets every requirement', 'best plan under a budget and other limits'],
      techniques: ['tableau', 'pivoting', 'slack variables', 'ratio test', 'Bland\'s rule'],
      applications: ['logistics', 'finance', 'engineering design', 'scientific computing'],
    },
    prerequisites: ['concept:linear-algebra', 'concept:matrix', 'concept:convexity'],
  },

  bigIdea: {
    simple: 'The simplex method finds the best mix of things to make when several limits apply at once. Picture a bakery that sells bread and cakes. Cakes earn more money. But there are only so many cake tins, so much oven space and so many hours in the day. Every possible plan is a point on a map: so much bread across, so many cakes up. Each limit rules out part of the map with a straight line. What is left is a shape with flat sides and corners. Here is the key fact. If there is a best plan, one of the corners is a best plan. So there is no need to check the endless points inside the shape. The method starts at the corner where nothing is made. It looks along the edges that leave that corner and follows one that raises the profit. At the next corner it does the same again. When no edge leads to more profit, it stops. That corner is the best plan.',
    when: 'Use it when the thing to maximise and every limit are plain sums of "amount times a fixed rate", and fractional amounts are acceptable. This lesson handles one form of problem only: maximise, with every limit written as "at most" (≤), a number that is zero or more on the right of each limit, and no variable allowed below zero. In that form the corner where nothing is made always obeys the limits, so the walk has somewhere to start. Outside it, with an "at least" limit, an "equals", or a negative number on the right, that corner can be illegal, and a solver must first run an extra phase to find a legal one. To minimise, maximise the opposite. If the amounts must be whole numbers, the best corner may be fractional and rounding it can give a worse plan or an illegal one. That is integer programming, a harder problem.',
    interesting: 'A shape with many limits can have an astronomical number of corners, and nobody has found a rule for choosing edges that is proven to avoid visiting exponentially many of them. Yet on practical problems the method usually stops after a number of steps that is a small multiple of the number of limits. That gap between the worst case and everyday behaviour puzzled people for decades, and the method is still inside every serious solver long after methods with better guarantees appeared.',
    analogy: {
      title: 'Walking the fence of a sloping field',
      text: 'A farmer\'s field lies on an even slope and is fenced with straight runs of fence. You want to stand at its highest point. Because the ground slopes evenly, the highest point cannot be in the middle of the field or partway along a fence: wherever you stand, you could go a little higher by walking uphill until a fence stops you, and then along that fence until a post stops you. So the highest point is at a fence post. Start at any post. Two fences leave it. If one of them climbs, follow it to the next post. Repeat. When both fences at your post lead downhill, you are at the top.',
      limits: 'A field has two directions and each post has two fences. A real problem with a thousand products is a shape in a thousand dimensions, with far more corners than could ever be listed and many edges at each one. Nobody can picture that shape, and the method never does: it works on a table of numbers, and the walk is only a way to understand what the table is doing. The slope must also be perfectly even. If the profit per item changes with the amount made, the best point need not be at a corner at all.',
    },
  },

  example: {
    setup: 'A bakery makes batches of bread and cakes. A batch of bread earns 2 coins and a cake earns 5. Three limits apply each day. The oven takes at most 6 batches of bread. There are only 4 cake tins, so at most 4 cakes. And there are 10 hours of work: a batch of bread takes 1 hour and a cake takes 2. How many of each should the bakery make to earn the most?',
    steps: [
      'Start with the plan "make nothing": 0 bread, 0 cakes, 0 coins. More bread would add profit and so would more cakes. The rule used on this page says: when more than one thing would help, take the first on the list. Bread is first.',
      'Make as much bread as the limits allow. The oven stops at 6 batches. The hours would allow 10. The tighter limit wins, so the plan becomes 6 bread, 0 cakes, worth 12 coins.',
      'Now add cakes. Bread has used 6 of the 10 hours, so 4 hours remain, which is enough for 2 cakes. The tins would allow 4. The hours are tighter, so the plan becomes 6 bread, 2 cakes, worth 12 + 10 = 22 coins.',
      'Every hour is now used. The only move left is a swap: give up 2 batches of bread to free 2 hours for 1 more cake. That loses 4 coins and gains 5, so each swap adds 1 coin. Keep swapping until something stops you. The tins run out at 4 cakes, after 2 swaps: 2 bread, 4 cakes, worth 24 coins.',
      'Look for another move. Making fewer cakes loses money. Making more bread means giving up a cake, and that swap was just shown to lose a coin. No move helps, so stop.',
    ],
    result: 'The best plan is 2 batches of bread and 4 cakes, for 24 coins. The method looked at four plans, (0, 0), then (6, 0), then (6, 2), then (2, 4), and each one is a corner of the shape of allowed plans. It never looked at a plan in the middle of the shape, and it never needed to.',
    tryInput: { objective: '2x + 5y', limits: BAKERY },
  },

  terms: [
    { term: 'Linear', meaning: 'Adding up in simple proportion: twice as many cakes earn twice the profit and use twice the hours, with no discounts and no fixed costs.' },
    { term: 'Objective', meaning: 'The quantity to make as large as possible. On this page it is called the profit.' },
    { term: 'Limit (constraint)', meaning: 'A rule the plan must obey, such as "bread hours plus cake hours come to at most 10".' },
    { term: 'Feasible region', meaning: 'The set of all plans that obey every limit. With two products it is a flat shape with straight sides.' },
    { term: 'Corner (vertex)', meaning: 'A point of the feasible region where two of its sides meet.' },
    { term: 'Slack variable', meaning: 'A helper number attached to one limit that says how much room is left under it. When it reaches zero, the limit is fully used.' },
    { term: 'Tableau', meaning: 'The table of numbers the method works on: one row for each limit and one row for the profit.' },
    { term: 'Basis', meaning: 'The variables that are currently allowed to be non-zero, one for each row of the tableau. Every other variable is zero. Each choice of basis describes one corner.' },
    { term: 'Pivot', meaning: 'One step of the method: one variable joins the basis, another leaves, and the tableau is rewritten. In the picture it is a move along one edge to the next corner.' },
    { term: 'Ratio test', meaning: 'The check that decides how far the walk can go along an edge before it would break a limit.' },
    { term: 'Bland\'s rule', meaning: 'A fixed way to break ties: whenever there is a choice, take the variable that comes first in the list. It guarantees the method finishes.' },
    { term: 'Unbounded', meaning: 'Said of a problem where the profit can be raised without end, so there is no best plan.' },
  ],

  takeaway: 'When everything adds up in straight lines, a best plan sits at a corner, so walk from corner to corner along edges that raise the profit until none does.',

  viz: {
    describe: 'Two linked views. The first is a graph with x across and y up. A shaded shape marks every mix that obeys all the limits, and each limit is a numbered straight line along one side of it. The walk is a terracotta line from corner to corner, starting at (0, 0), with the current corner ringed and labelled with its profit. A dashed line through the current corner joins all mixes that earn the same profit. While a move is being chosen, an ochre arrow shows the edge being considered and ochre circles show where each limit would stop it. At the end the best corner is forest green and every corner is labelled with its profit. The second view is the tableau: a table with a column for x, y, each slack variable, the value, and the ratio, and a row for each basis variable plus the profit row. The column of the variable about to enter and the row of the variable about to leave are tinted, and the pivot cell where they cross is outlined.',
    inputs: [
      { id: 'objective', type: 'text', label: 'Profit to maximise', default: '2x + 5y', maxLength: 60, help: 'Written with x and y, such as 2x + 5y. To minimise, type the opposite, such as -2x - 5y.' },
      { id: 'limits', type: 'text', label: 'Limits', default: BAKERY, maxLength: 300,
        help: 'Up to 6, separated by commas, each like x + 2y <= 10. x and y are never allowed below 0. The method needs every limit as <= with a number that is 0 or more on the right. Type >= or = to see what happens outside that form.' },
    ],
    presets: [
      { label: 'Bakery (worked example)', values: { objective: '2x + 5y', limits: BAKERY } },
      { label: 'Bakery where bread earns more', values: { objective: '5x + 2y', limits: BAKERY } },
      { label: 'Two corners equally good', values: { objective: 'x + 2y', limits: BAKERY } },
      { label: 'A tie in the ratio test', values: { objective: 'x + 2y', limits: 'x <= 2, x + y <= 4, y <= 2' } },
      { label: 'Nothing stops the profit', values: { objective: 'x + y', limits: 'x - y <= 2, -x + y <= 3' } },
      { label: 'Five limits', values: { objective: '3x + 4y', limits: 'x <= 8, y <= 6, x + y <= 10, x + 3y <= 20, 3x + y <= 25' } },
      { label: 'Outside the form: an "at least" limit', values: { objective: 'x + 2y', limits: 'x + y >= 2, x <= 4, y <= 3' } },
    ],
    tryThis: [
      { ask: 'Run the bakery and watch the dashed line. It joins all mixes that earn the current profit, and each pivot pushes it further out. When the walk stops, how much of the shaded shape will the dashed line still touch?',
        reveal: 'One corner and nothing else. The line moves out through profits 12, 22 and 24, and at 24 it touches the shape only at (2, 4). Push it any further and it leaves the shape altogether, which is another way of saying that no allowed mix earns more than 24.' },
      { ask: 'Load "Bakery where bread earns more". The limits have not changed, so the shape is the same. Will the walk end at the same corner as before, and will it need the same number of pivots?',
        reveal: 'No to both. It stops at (6, 2) with profit 34 after 2 pivots, one corner earlier than the 3 pivots that end at (2, 4) in the worked example. The dashed line now tilts the other way, so the corner it touches last is a different one. The shape decides which mixes are allowed. The profit decides which corner is best.' },
      { ask: 'Load "A tie in the ratio test". Three limit lines pass through the corner (2, 2), where two would be enough to pin it down. The run takes 3 pivots. How many of them move the walk to a new corner?',
        reveal: 'Two. The walk goes (0, 0), then (2, 0), then (2, 2). On the second pivot two rows tie in the ratio test and Bland\'s rule takes the one whose variable comes first. The third pivot rewrites the table, but the corner stays at (2, 2) and the profit stays at 6. A tie in the ratio test is the warning that a pivot like this may follow.' },
      { ask: 'Load "Nothing stops the profit" and run it. Then add the limit `x + y <= 12` to the end of the list, which closes the shape. Where will the walk end now, and will that corner be the only best one?',
        reveal: 'It ends at (7, 5) with profit 12 after 2 pivots, and that corner is not the only best one. The new limit line runs parallel to the lines of equal profit, so the whole side from (7, 5) to (9/2, 15/2) earns 12. Without the new limit the run stops after 1 pivot at (2, 0) and reports that y can grow for ever.' },
      { ask: 'Load "Outside the form". Its first limit is `x + y >= 2`. The walk always starts at (0, 0). What will the method do with this problem?',
        reveal: 'Nothing. At (0, 0) the sum x + y is 0, which is not at least 2, so the starting corner is not allowed and the method cannot begin. The page checks every corner directly instead and finds the best mix (4, 3) with profit 10. Change `x + y >= 2` to `x + y <= 6` and the walk runs: (0, 0), (4, 0), (4, 2), then (3, 3), with profit 9 after 3 pivots.' },
    ],
    run,
    report: (r) => {
      const size = `${r.problem.A.length} limits, tableau of ${r.problem.A.length + 1} rows by ${r.problem.A.length + 3} columns.`;
      if (r.status === 'no-start') {
        return `The method cannot start: the corner (0, 0) breaks a limit, so this problem is outside the form the lesson handles.\n`
          + (r.truth.kind === 'best' ? `Checking every corner directly: best mix x = ${r.truth.x}, y = ${r.truth.y}, profit ${r.truth.value}.` : r.truth.kind === 'empty' ? 'Checking directly: no mix obeys every limit.' : 'Checking directly: the profit can rise without end.')
          + `\n${size}`;
      }
      const walk = r.path.map((p, i) => (i > 0 && p[0] === r.path[i - 1][0] && p[1] === r.path[i - 1][1] ? '(same corner)' : `(${p.map((v) => Math.round(v * 1000) / 1000).join(', ')})`)).join(' → ');
      return (r.status === 'optimal'
        ? `Best mix: x = ${r.exact.x}, y = ${r.exact.y}, profit ${r.exact.value}.${r.alternative ? ' Another corner earns the same profit.' : ''}`
        : `No best mix: the profit can rise without end. The walk had reached ${corner(r)} with profit ${r.exact.value}.`)
        + `\nWalk: ${walk}\n${r.pivots} ${r.pivots === 1 ? 'pivot' : 'pivots'} with Bland's rule${r.ties ? `, ${r.ties} tied ratio ${r.ties === 1 ? 'test' : 'tests'}` : ''}${r.stalls ? `, ${r.stalls} that did not move the corner` : ''}.\n${size}`;
    },
    experiment: {
      title: 'Pivots as limits are added, for two objectives on the same shape',
      note: 'Each point is a real run on a shape whose boundary bends from (0, m²) down to (m, 0) in m straight pieces, so it has m + 2 corners. The best corner is the top one in both series. With profit x + 2m·y, Bland\'s rule lets x grow first, so the walk goes to the far end of the shape and comes back along every piece. With profit y, only y can grow and one pivot reaches the top. The same shape and the same answer can take very different walks.',
      metric: 'pivots',
      metricLabel: 'Pivots',
      sizeLabel: 'Number of limits (m)',
      sizes: [2, 4, 8, 16, 32, 64],
      variants: [{ id: 'long', label: 'Profit x + 2m·y: the long way round' }, { id: 'short', label: 'Profit y: straight to the top' }],
      input: (m, variant) => ({ problem: staircase(m, variant) }),
      theory: [
        { label: 'm + 1', fn: (m) => m + 1, variant: 'long' },
        { label: '1', fn: () => 1, variant: 'short' },
      ],
    },
  },

  logic: {
    intuition: 'The profit is a flat slope over the plane of plans. Along any straight edge it rises all the way, falls all the way, or stays level, so nothing is gained by stopping partway: go to the end of the edge, which is a corner. And because the allowed shape has no dents, a corner with no rising edge is the best point overall, not merely the best nearby. The tableau is bookkeeping that lets both questions be read from a table. The profit row says which edges rise. The ratio test says how far each edge goes before it hits a limit.',
    steps: [
      'Check the form: every limit is "at most" with a right-hand side of zero or more. Then the corner where every product is 0 obeys all the limits.',
      'Give each limit a slack variable, so that "x + 2y ≤ 10" becomes "x + 2y + s = 10" with s ≥ 0. Write the tableau: one row per limit and a profit row holding the negated profit rates. The basis starts as the slack variables.',
      'Choose the entering variable: the first column, from the left, with a negative number in the profit row. If there is none, the current corner is the best and the method stops.',
      'Run the ratio test: for each row with a positive number in that column, divide the row\'s value by that number. If no row has a positive number, the profit is unbounded and the method stops.',
      'The row with the smallest ratio holds the leaving variable. On a tie, take the row whose basis variable comes first in the list of variables.',
      'Pivot: divide that row by its number in the entering column, then subtract multiples of it from every other row, including the profit row, so that the entering column becomes 0 everywhere else. The entering variable replaces the leaving one in the basis. Go back to step 3.',
    ],
    pseudocode: [
      'simplex(c, A, b):',
      '  if some b[i] < 0:',
      '    stop: no starting corner',
      '  T ← rows [A | I | b]',
      '  profit row ← [−c | 0 | 0]',
      '  basis ← slack variables',
      '  loop:',
      '    j ← first column with a',
      '      negative profit entry',
      '    if none: return optimal',
      '    for rows with T[i][j] > 0:',
      '      ratio ← value / T[i][j]',
      '    if no such row:',
      '      return unbounded',
      '    r ← row of least ratio',
      '      (tie: lowest variable)',
      '    divide row r by T[r][j]',
      '    for every other row i:',
      '      subtract T[i][j] × row r',
      '    basis[r] ← j',
    ],
    decisions: [
      { title: 'Which variable enters?', text: 'This page uses Bland\'s rule: the first column with a negative number in the profit row. It is not the fastest choice, and in the bakery it takes three pivots where another rule takes two. Its merit is a proof that the method can never go round in circles. Dantzig\'s original rule takes the most negative number, which usually needs fewer pivots but can cycle on rare problems with ties. Solvers in practice use rules that estimate which edge climbs most steeply.' },
      { title: 'Which variable leaves on a tie?', text: 'When two rows give the same smallest ratio, the next corner has more boundary lines through it than it needs, and either row could leave. Bland\'s rule takes the row whose basis variable comes first in the list x, y, s1, s2 and so on. The choice does not change the corner reached. It changes which description of that corner the table holds, and that matters for what happens next.' },
      { title: 'Why slack variables?', text: 'Row operations keep a system of equations true, but they do not keep inequalities true. Adding a slack variable turns each "at most" into an equation, and the inequality survives as the simple rule that no variable may be negative.' },
      { title: 'Why the negated profit in the bottom row?', text: 'The bottom row is the equation "profit − 2x − 5y = 0" kept alongside the others, so the same row operations apply to it. A negative number under a variable then means the profit rises as that variable grows, and the bottom right cell is always the profit at the current corner. Some books store the row with the opposite signs and look for positive numbers. The method is the same.' },
      { title: 'Exact fractions or decimals?', text: 'The demonstration on this page keeps every number as an exact fraction, as you would by hand, so a tie is a real tie. The three programs use floating-point numbers and a small tolerance, as practical solvers do, because exact fractions become unwieldy on large problems.' },
    ],
    invariants: [
      'Every tableau is the original set of equations rewritten. It has exactly the same solutions.',
      'The value column of the limit rows is never negative, so the table always describes a corner that obeys every limit.',
      'Each basis variable has a 1 in its own row and 0 in every other row, including the profit row.',
      'The bottom right cell is the profit at the current corner, and it never goes down from one pivot to the next.',
    ],
    edgeCases: [
      'No negative number in the first profit row (every profit rate is zero or less): the starting corner is already best and no pivot happens.',
      'An unbounded problem: some variable raises the profit and no row limits it. There is no best plan, and the method reports the direction.',
      'A tie in the ratio test: the next corner is degenerate. A later pivot may then change the table without moving the corner or the profit.',
      'A 0 in the final profit row under a variable outside the basis: another corner, and every point between, is equally good.',
      'A limit that never matters because other limits are tighter: it stays in the tableau, its slack stays in the basis, and nothing goes wrong.',
      'A negative right-hand side: the starting corner breaks that limit. This lesson\'s method cannot begin, and a first phase is needed.',
    ],
    correctness: 'Each tableau is obtained from the one before by dividing a row by a non-zero number and adding multiples of it to other rows, so all tableaux have the same solutions as the original equations. Setting the variables outside the basis to 0 gives one solution, read from the value column. The ratio test picks the largest step that keeps every value at zero or more, so that solution always obeys the limits. A pivot changes the profit by the step length times the amount gained per unit, both of which are zero or more, so the profit never falls. When the method stops with no negative number in the profit row, that row reads "profit plus a sum of non-negative multiples of variables equals the bottom right cell". Every variable is zero or more in any allowed plan, so no allowed plan can have a profit above that cell, and the current corner reaches it. When the method stops as unbounded, growing the entering variable keeps every value non-negative for ever while the profit rises without limit. Finally, there are only finitely many possible bases, and Bland proved that with his rule no basis is ever visited twice, so the method must stop.',
    mistakes: [
      'Running the ratio test on rows with a zero or negative number in the entering column. A negative ratio then looks like the smallest and the pivot lands outside the allowed shape.',
      'Forgetting to apply the row operation to the profit row, so the test for stopping reads stale numbers.',
      'Treating "no positive number in the entering column" as "finished". It means unbounded, not optimal.',
      'Reading the answer from the wrong place. A variable outside the basis is 0, whatever numbers appear in its column.',
      'Comparing floating-point numbers with exact equality. After a few pivots a value that should be 0 is often a tiny positive or negative number.',
      'Rounding the answer to whole numbers and assuming the result is the best whole-number plan. It may not even obey the limits.',
    ],
  },

  code: {
    sample: {
      input: 'Four problems, each with profit rates c, limit coefficients A and right-hand sides b. The bakery: maximise 2x + 5y with x ≤ 6, y ≤ 4, x + 2y ≤ 10. An open shape: x + y with x − y ≤ 2, −x + y ≤ 3. A tie: x + 2y with x ≤ 2, x + y ≤ 4, y ≤ 2. And x − y with x ≤ 1, y ≤ 3 and x + y ≥ 2, the last written as −x − y ≤ −2, which is outside the form. Each pivot is printed with the profit it reaches.',
      expected: "bakery\n  x enters, s1 leaves, profit 12.00\n  y enters, s3 leaves, profit 22.00\n  s1 enters, s2 leaves, profit 24.00\n  best: x = 2.00, y = 4.00, profit 24.00\nopen\n  x enters, s1 leaves, profit 2.00\n  unbounded: nothing stops y from growing\ntie\n  x enters, s1 leaves, profit 2.00\n  y enters, s2 leaves, profit 6.00\n  s1 enters, s3 leaves, profit 6.00\n  best: x = 2.00, y = 2.00, profit 6.00\nat least\n  no starting corner: a limit has a negative right side",
    },
    breakIt: [
      { change: 'In the ratio test, change the condition on the entry in the entering column from `> EPS` to `!= 0`, so that rows with a negative entry take part too. Which of the four problems will now print something different?',
        find: { python: 'if T[i][enter] > EPS:', javascript: 'if (T[i][enter] > EPS) {' },
        replace: { python: 'if T[i][enter] != 0:', javascript: 'if (T[i][enter] !== 0) {' },
        hangs: true,
        reveal: 'None of them prints anything. The program never gets past the bakery, and the page stops it at the time limit. After two pivots the walk is at (6, 2) with profit 22 and s1 is about to enter. The row for y has −0.5 in that column and a value of 2, which gives a ratio of −4. That looks smaller than the honest ratios 6 and 4, so y leaves. The pivot lands on x = 10, y = 0, with s1 at −4: ten batches of bread in an oven that holds 6, for a profit of 20, lower than before. The next pivot brings y back in and returns to (6, 2), and the two pivots then repeat for ever. A row with a negative entry never limits the entering variable, so it has to be skipped.' },
      { change: 'Leave the hours out of the bakery: delete its third limit, so that `A` is `[[1, 0], [0, 1]]` and `b` is `[6, 4]`. What plan does the program print for the bakery now?',
        find: { python: 'report("bakery", [2, 5], [[1, 0], [0, 1], [1, 2]], [6, 4, 10])', javascript: 'report("bakery", [2, 5], [[1, 0], [0, 1], [1, 2]], [6, 4, 10]);' },
        replace: { python: 'report("bakery", [2, 5], [[1, 0], [0, 1]], [6, 4])', javascript: 'report("bakery", [2, 5], [[1, 0], [0, 1]], [6, 4]);' },
        reveal: 'The bakery now prints "y enters, s2 leaves, profit 32.00" and "best: x = 6.00, y = 4.00, profit 32.00". The plan fills the oven and uses every tin, which needs 6 + 2 × 4 = 14 hours of work when there are 10. Nothing in the output looks wrong. The method can only respect the limits it is given, so a missing limit gives a confident answer that nobody could carry out. The other three problems print what they did before.' },
      { change: 'Switch off the check for a negative right-hand side at the top of `simplex`, by replacing its condition with false (`False` in Python). What will the program now print for the last problem, the one with the limit x + y ≥ 2?',
        find: { python: 'if min(b) < 0:', javascript: 'if (Math.min(...b) < 0) return' },
        replace: { python: 'if False:', javascript: 'if (false) return' },
        reveal: 'Instead of "no starting corner" it prints "x enters, s2 leaves, profit 1.00" and "best: x = 1.00, y = 0.00, profit 1.00". That plan has x + y = 1, which breaks the limit x + y ≥ 2. The walk started at (0, 0), a point that was never allowed, and nothing later in the method checks whether it has entered the allowed shape. The true best plan is x = 1, y = 1, with profit 0. Reaching it takes a first phase that finds an allowed corner to start from.' },
    ],
    python: {
      source: `EPS = 1e-9


def simplex(c, A, b):
    """Maximise c.x subject to A x <= b and x >= 0. Every b must be zero or more."""
    m, n = len(A), len(c)
    if min(b) < 0:
        return "no start", [], None
    # One row per limit, [A | I | b], then the profit row [-c | 0 | 0].
    T = [list(A[i]) + [float(k == i) for k in range(m)] + [b[i]] for i in range(m)]
    T.append([-v for v in c] + [0.0] * (m + 1))
    basis = [n + i for i in range(m)]
    steps = []
    while True:
        # Bland's rule: the first column with a negative number in the profit row.
        enter = next((j for j in range(n + m) if T[m][j] < -EPS), None)
        if enter is None:
            x = [0.0] * n
            for i in range(m):
                if basis[i] < n:
                    x[basis[i]] = T[i][-1]
            return "optimal", steps, x
        # Ratio test over rows with a positive entry. A tie goes to the lowest variable.
        leave, best = None, 0.0
        for i in range(m):
            if T[i][enter] > EPS:
                ratio = T[i][-1] / T[i][enter]
                tie = leave is not None and abs(ratio - best) <= EPS
                if leave is None or ratio < best - EPS or (tie and basis[i] < basis[leave]):
                    leave, best = i, ratio
        if leave is None:
            return "unbounded", steps, enter
        pivot = T[leave][enter]
        T[leave] = [v / pivot for v in T[leave]]
        for i in range(m + 1):
            factor = T[i][enter]
            if i != leave and factor != 0:
                T[i] = [v - factor * w for v, w in zip(T[i], T[leave])]
        steps.append((enter, basis[leave], T[m][-1]))
        basis[leave] = enter


def name(j):
    return "xy"[j] if j < 2 else "s" + str(j - 1)


def report(title, c, A, b):
    status, steps, detail = simplex(c, A, b)
    print(title)
    for enter, leave, profit in steps:
        print(f"  {name(enter)} enters, {name(leave)} leaves, profit {profit:.2f}")
    if status == "optimal":
        profit = c[0] * detail[0] + c[1] * detail[1]
        print(f"  best: x = {detail[0]:.2f}, y = {detail[1]:.2f}, profit {profit:.2f}")
    elif status == "unbounded":
        print(f"  unbounded: nothing stops {name(detail)} from growing")
    else:
        print("  no starting corner: a limit has a negative right side")


report("bakery", [2, 5], [[1, 0], [0, 1], [1, 2]], [6, 4, 10])
report("open", [1, 1], [[1, -1], [-1, 1]], [2, 3])
report("tie", [1, 2], [[1, 0], [1, 1], [0, 1]], [2, 4, 2])
report("at least", [1, -1], [[-1, -1], [1, 0], [0, 1]], [-2, 1, 3])`,
      notes: [
        { line: 7, text: "The check of the form. A negative right-hand side means the corner where everything is 0 breaks that limit, so there is nowhere to start." },
        { line: 10, text: "One row per limit: its coefficients, a 1 in the column of its own slack variable, and the right-hand side." },
        { line: 11, text: "The profit row holds the profit rates with their signs changed. A negative entry means the profit rises as that variable grows." },
        { line: 16, text: "Bland's rule for the entering variable: the first improving column, not the most improving one." },
        { line: 26, text: "Only a row with a positive entry limits how far the entering variable can grow. Rows with zero or negative entries are skipped." },
        { line: 29, text: "The smallest ratio wins. On a tie, the row whose basis variable has the lower index wins, which is the second half of Bland's rule." },
        { line: 31, text: "No row limits the entering variable, so the profit can grow for ever." },
        { line: 38, text: "The elimination step, applied to every other row. The loop runs to `m` inclusive, so the profit row is updated too." },
      ],
    },
    javascript: {
      source: `const EPS = 1e-9;

// Maximise c.x subject to A x <= b and x >= 0. Every b must be zero or more.
function simplex(c, A, b) {
  const m = A.length, n = c.length;
  if (Math.min(...b) < 0) return { status: "no start", steps: [] };
  // One row per limit, [A | I | b], then the profit row [-c | 0 | 0].
  const T = A.map((row, i) => [...row, ...b.map((_, k) => (k === i ? 1 : 0)), b[i]]);
  T.push([...c.map((v) => -v), ...b.map(() => 0), 0]);
  const basis = b.map((_, i) => n + i);
  const last = n + m;
  const steps = [];
  for (;;) {
    // Bland's rule: the first column with a negative number in the profit row.
    const enter = T[m].findIndex((v, j) => j < last && v < -EPS);
    if (enter < 0) {
      const x = new Array(n).fill(0);
      basis.forEach((j, i) => { if (j < n) x[j] = T[i][last]; });
      return { status: "optimal", steps, x };
    }
    // Ratio test over rows with a positive entry. A tie goes to the lowest variable.
    let leave = -1, best = 0;
    for (let i = 0; i < m; i++) {
      if (T[i][enter] > EPS) {
        const ratio = T[i][last] / T[i][enter];
        const tie = leave >= 0 && Math.abs(ratio - best) <= EPS;
        if (leave < 0 || ratio < best - EPS || (tie && basis[i] < basis[leave])) {
          leave = i;
          best = ratio;
        }
      }
    }
    if (leave < 0) return { status: "unbounded", steps, enter };
    const pivot = T[leave][enter];
    T[leave] = T[leave].map((v) => v / pivot);
    for (let i = 0; i <= m; i++) {
      const factor = T[i][enter];
      if (i !== leave && factor !== 0) T[i] = T[i].map((v, k) => v - factor * T[leave][k]);
    }
    steps.push([enter, basis[leave], T[m][last]]);
    basis[leave] = enter;
  }
}

const name = (j) => (j < 2 ? "xy"[j] : "s" + (j - 1));

function report(title, c, A, b) {
  const r = simplex(c, A, b);
  console.log(title);
  for (const [enter, leave, profit] of r.steps) {
    console.log("  " + name(enter) + " enters, " + name(leave) + " leaves, profit " + profit.toFixed(2));
  }
  if (r.status === "optimal") {
    const profit = c[0] * r.x[0] + c[1] * r.x[1];
    console.log("  best: x = " + r.x[0].toFixed(2) + ", y = " + r.x[1].toFixed(2) + ", profit " + profit.toFixed(2));
  } else if (r.status === "unbounded") {
    console.log("  unbounded: nothing stops " + name(r.enter) + " from growing");
  } else {
    console.log("  no starting corner: a limit has a negative right side");
  }
}

report("bakery", [2, 5], [[1, 0], [0, 1], [1, 2]], [6, 4, 10]);
report("open", [1, 1], [[1, -1], [-1, 1]], [2, 3]);
report("tie", [1, 2], [[1, 0], [1, 1], [0, 1]], [2, 4, 2]);
report("at least", [1, -1], [[-1, -1], [1, 0], [0, 1]], [-2, 1, 3]);`,
    },
    cpp: {
      source: `#include <algorithm>
#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

const double EPS = 1e-9;
using Row = std::vector<double>;

struct Step { int enter, leave; double profit; };
struct Result { std::string status; std::vector<Step> steps; Row x; int enter = -1; };

// Maximise c.x subject to A x <= b and x >= 0. Every b must be zero or more.
Result simplex(const Row& c, const std::vector<Row>& A, const Row& b) {
    int m = static_cast<int>(A.size()), n = static_cast<int>(c.size()), last = n + m;
    Result r;
    if (*std::min_element(b.begin(), b.end()) < 0) { r.status = "no start"; return r; }
    // One row per limit, [A | I | b], then the profit row [-c | 0 | 0].
    std::vector<Row> T(m + 1, Row(last + 1, 0.0));
    std::vector<int> basis(m);
    for (int i = 0; i < m; ++i) {
        for (int j = 0; j < n; ++j) T[i][j] = A[i][j];
        T[i][n + i] = 1.0;
        T[i][last] = b[i];
        basis[i] = n + i;
    }
    for (int j = 0; j < n; ++j) T[m][j] = -c[j];
    for (;;) {
        // Bland's rule: the first column with a negative number in the profit row.
        int enter = -1;
        for (int j = 0; j < last && enter < 0; ++j) if (T[m][j] < -EPS) enter = j;
        if (enter < 0) {
            r.status = "optimal";
            r.x.assign(n, 0.0);
            for (int i = 0; i < m; ++i) if (basis[i] < n) r.x[basis[i]] = T[i][last];
            return r;
        }
        // Ratio test over rows with a positive entry. A tie goes to the lowest variable.
        int leave = -1;
        double best = 0.0;
        for (int i = 0; i < m; ++i) {
            if (T[i][enter] > EPS) {
                double ratio = T[i][last] / T[i][enter];
                bool tie = leave >= 0 && std::fabs(ratio - best) <= EPS;
                if (leave < 0 || ratio < best - EPS || (tie && basis[i] < basis[leave])) { leave = i; best = ratio; }
            }
        }
        if (leave < 0) { r.status = "unbounded"; r.enter = enter; return r; }
        double pivot = T[leave][enter];
        for (double& v : T[leave]) v /= pivot;
        for (int i = 0; i <= m; ++i) {
            double factor = T[i][enter];
            if (i == leave || factor == 0) continue;
            for (int k = 0; k <= last; ++k) T[i][k] -= factor * T[leave][k];
        }
        r.steps.push_back({enter, basis[leave], T[m][last]});
        basis[leave] = enter;
    }
}

std::string name(int j) { return j == 0 ? "x" : j == 1 ? "y" : "s" + std::to_string(j - 1); }

void report(const std::string& title, const Row& c, const std::vector<Row>& A, const Row& b) {
    Result r = simplex(c, A, b);
    std::printf("%s\\n", title.c_str());
    for (const Step& s : r.steps) {
        std::printf("  %s enters, %s leaves, profit %.2f\\n", name(s.enter).c_str(), name(s.leave).c_str(), s.profit);
    }
    if (r.status == "optimal") {
        std::printf("  best: x = %.2f, y = %.2f, profit %.2f\\n", r.x[0], r.x[1], c[0] * r.x[0] + c[1] * r.x[1]);
    } else if (r.status == "unbounded") {
        std::printf("  unbounded: nothing stops %s from growing\\n", name(r.enter).c_str());
    } else {
        std::printf("  no starting corner: a limit has a negative right side\\n");
    }
}

int main() {
    report("bakery", {2, 5}, {{1, 0}, {0, 1}, {1, 2}}, {6, 4, 10});
    report("open", {1, 1}, {{1, -1}, {-1, 1}}, {2, 3});
    report("tie", {1, 2}, {{1, 0}, {1, 1}, {0, 1}}, {2, 4, 2});
    report("at least", {1, -1}, {{-1, -1}, {1, 0}, {0, 1}}, {-2, 1, 3});
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'A pivot rewrites every cell of the tableau, which has m + 1 rows and n + m + 1 columns for m limits and n products. The uncertain part is the number of pivots. It depends on the problem and on the rule for choosing edges, and no simple formula describes it.',
    cases: [
      { case: 'One pivot', time: 'O(m(n + m))', when: 'The full tableau is updated, as on this page. Practical solvers update far less by exploiting the many zeros in real problems.' },
      { case: 'Two products, no ties', time: 'At most m + 1 pivots', when: 'The shape has at most m + 2 corners, and without ties every pivot moves to a new corner with more profit. The chart on this page shows a family of problems that reaches this limit.' },
      { case: 'Worst case', time: 'Exponentially many pivots', when: 'Klee and Minty built problems with n products and n limits on which Dantzig\'s rule visits all 2ⁿ corners. Similar constructions exist for many other rules.' },
      { case: 'Practical problems', time: 'Usually a small multiple of m pivots', when: 'An observation from decades of use, not a theorem. It is the reason the method is still used.' },
    ],
    space: 'O(m(n + m)) for the tableau, plus one basis entry per row.',
    memory: 'The tableau is dense: (m + 1) × (n + m + 1) numbers, even when the original problem is mostly zeros. The revised simplex method avoids this by keeping only the original data and a factorisation of the current basis.',
    tradeoffs: 'The choice of entering rule trades work per pivot against the number of pivots. Bland\'s rule costs almost nothing per pivot and guarantees an end, but tends to take more pivots. Steepest-edge rules do more work per pivot and usually take far fewer. Interior-point methods take a different route altogether, with a guaranteed bound on the number of steps but more work in each.',
    assumptions: [
      'Arithmetic on one number takes constant time. With exact fractions, as in the demonstration, the numbers themselves can grow, and this stops being true on large problems.',
      'The problem is in the form this lesson handles, so no first phase is counted.',
      'The chart on this page counts pivots made by this implementation with Bland\'s rule, not wall-clock time.',
    ],
  },

  tradeoffs: {
    struggles: [
      'Amounts that must be whole numbers. The best corner can be fractional, and the best whole-number plan may be far from it.',
      'Profits or limits that are not linear: bulk discounts, set-up costs, or effects that multiply. The corner argument no longer holds.',
      'Degenerate problems, where many boundary lines pass through the same corner. The method can spend many pivots without moving.',
      'Very large problems, where interior-point methods are often faster.',
    ],
    pitfalls: [
      'Leaving out a limit. The method then reports an unbounded profit, or a plan that is impossible in real life.',
      'Trusting a model more than the numbers that went into it. The best corner can jump to a different part of the shape when one profit rate changes slightly.',
      'Applying the method of this lesson to a problem with a negative right-hand side without a first phase.',
      'Using exact comparisons with floating-point numbers, which leads to wrong pivot choices and, occasionally, endless loops.',
    ],
    misunderstandings: [
      '"It checks every corner." It does not. It follows a path of improving corners and stops at the first one with no better neighbour. Most corners are never visited.',
      '"The best plan uses up every resource." Not necessarily. In the bakery the best plan leaves oven space for 4 more batches of bread. A limit with slack left over is simply not the one holding the profit back.',
      '"The product with the highest profit rate should be made first." The limits decide. The rule on this page starts with bread, the less profitable product, and still reaches the best plan.',
      '"A corner that beats its neighbours might still not be the best overall." For a linear problem it always is, because the allowed shape has no dents. This is what separates linear programming from harder kinds of optimization.',
      '"The simplex method is slow because its worst case is exponential." The worst case needs specially built problems. On practical ones it is among the fastest methods known.',
    ],
    constraints: [
      'Real models have thousands or millions of variables, almost all with zero coefficients in any given limit. Storing a full tableau is out of the question, and practical codes work with sparse factorisations.',
      'Rounding errors accumulate over many pivots, so solvers use tolerances, rescale the problem, and periodically recompute the basis from the original data.',
    ],
    alternatives: [
      { name: 'Two-phase simplex', when: 'The corner where everything is zero breaks a limit. A first phase finds an allowed corner, then the method of this lesson takes over.' },
      { name: 'Dual simplex', when: 'A solved problem gains a new limit, or a limit changes. It repairs the old answer instead of starting again, which is why integer programming solvers rely on it.' },
      { name: 'Interior-point methods', when: 'The problem is very large. They cut through the inside of the shape and have a proven polynomial bound on their steps.' },
      { name: 'Drawing the shape and checking every corner', when: 'There are two variables and a handful of limits. This is how the tests on this page check the method.' },
      { id: 'knapsack', name: 'Dynamic programming for the knapsack problem', when: 'Items must be taken whole and there is one limit of moderate size.' },
      { id: 'gradient-descent', name: 'Gradient descent', when: 'The objective is a smooth curve instead of a flat slope, and there are few or no limits.' },
    ],
    comparison: {
      columns: ['', 'Simplex method', 'Interior-point methods', 'Checking every corner'],
      rows: [
        ['Path', 'Along edges, corner to corner', 'Through the inside of the shape', 'No path: lists all corners'],
        ['Worst case', 'Exponentially many pivots', 'Polynomial', 'Exponentially many corners'],
        ['In practice', 'Fast, and fast to re-solve after a small change', 'Fast on very large problems', 'Only for tiny problems'],
        ['Answer', 'An exact corner', 'A point very near the best, then moved to a corner if needed', 'An exact corner'],
      ],
    },
  },

  applications: [
    { title: 'Blending and refining', status: 'established', text: 'Oil refineries were among the first industrial users of linear programming, in the 1950s, and still use it to decide how to blend streams of different quality into products that meet their specifications at the lowest cost. The same model blends animal feed, metal alloys and fertiliser.' },
    { title: 'The diet problem', status: 'established', text: 'Finding the cheapest set of foods that meets a list of nutritional requirements was one of the first problems the method was tried on, and it is still the standard teaching example of minimising cost under "at least" limits.' },
    { title: 'Inside integer programming solvers', status: 'established', text: 'Scheduling crews, routing vehicles and planning production often need whole-number answers. Solvers for these problems repeatedly solve linear programs with the whole-number rule dropped, and use the dual simplex method to re-solve quickly each time a limit is added.' },
    { title: 'General-purpose optimization software', status: 'established', text: 'Commercial and open-source solvers, including CPLEX, Gurobi, HiGHS and GLPK, contain simplex implementations alongside interior-point methods.' },
    { title: 'Production planning in a small business', status: 'illustrative', text: 'A workshop with limited machine hours, labour and materials can write its weekly plan as a linear program like the bakery on this page, with one variable per product and one limit per resource.' },
  ],

  connections: [
    { to: 'concept:convexity', type: 'prerequisite', why: 'The allowed region of a linear program is convex, which is why a corner that no neighbour can beat is the best point overall. The Simplex Method relies on this to stop at the first such corner.' },
    { to: 'concept:linear-algebra', type: 'prerequisite', why: 'A pivot in the Simplex Method is a step of elimination on a system of linear equations: it rewrites the same system so that a different set of variables can be read off directly.' },
    { to: 'concept:matrix', type: 'prerequisite', why: 'The Simplex Method keeps its whole state in a matrix, the tableau, and every step is a set of row operations on it.' },
    { to: 'concept:local-search', type: 'related', why: 'The Simplex Method is a local search over corners: move to a better neighbour until there is none. Unlike most local searches it cannot stop at a false peak, because a linear program has no dents to get caught in.' },
    { to: 'gradient-descent', type: 'related', why: 'Gradient Descent and the Simplex Method both improve an objective step by step. Gradient Descent moves through open space with a step size that must be tuned, while the Simplex Method moves along the edges of a shape with flat sides, takes steps whose length the limits decide, and stops exactly.' },
    { to: 'knapsack', type: 'related', why: 'The Knapsack problem and the Simplex Method both choose amounts under a limit to maximise a total. Knapsack demands whole items, which makes it hard. Allow fractions of items and it becomes a linear program that the Simplex Method solves exactly.' },
    { to: 'gaussian-elimination', type: 'related', why: 'Gaussian elimination and the Simplex Method use the same row operations. Elimination chooses its pivots to solve the equations. Simplex chooses them to raise an objective while keeping every variable non-negative.' },
    { to: 'critical-path', type: 'application', why: 'The Critical Path Method finds how long a project takes. Choosing which tasks to pay to speed up, at the least total cost, is a linear program that the Simplex Method can solve.' },
    { to: 'concept:np-hardness', type: 'advanced', why: 'The Simplex Method solves linear programs with fractional answers. Demand whole-number answers and the problem becomes NP-hard in general, which shows how sharply difficulty can change with one extra rule.' },
    { to: 'discipline:finance', type: 'application', why: 'Matching a stream of future payments with the cheapest set of bonds is a linear program, because prices and payments add up in proportion to the amount of each bond held. The Simplex Method solves it.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why does the method look only at corners of the allowed shape?',
      options: ['Corners are easier to compute than other points', 'The profit changes at an even rate along any straight line, so it can always be pushed to the end of an edge without losing anything', 'Points inside the shape break the limits', 'It is a shortcut that usually works'],
      answer: 1,
      explain: [
        'Ease is not the reason. The reason is that nothing better than the best corner exists anywhere in the shape.',
        'From any point you can move in a direction that does not lower the profit until a side stops you, then along that side until a corner stops you. So some corner is at least as good as any other point.',
        'Points inside the shape obey every limit. They are allowed, just never better than the best corner.',
        'It is not an approximation. For a linear problem with a best plan, a corner is always among the best plans.',
      ],
    },
    {
      type: 'predict',
      q: 'A workshop earns 4 coins for each chair, x, and 3 for each table, y. The limits are `x <= 5`, `y <= 6` and `x + y <= 8`. At which corner does the walk stop?',
      options: ['(5, 0)', '(5, 3)', '(2, 6)', '(0, 6)'],
      answer: 1,
      explain: [
        'At (5, 0) only 5 of the 8 allowed items are made. Each table added from there earns 3 more coins, so the walk goes on.',
        'At (5, 3) the profit is 29. Going on to (2, 6) would swap 3 chairs, worth 12, for 3 tables, worth 9, so no edge climbs any further. The walk took 2 pivots.',
        'The corner (2, 6) is worth 26, less than the 29 at (5, 3). The walk only moves along an edge that raises the profit, so it never goes there.',
        'Bland\'s rule lets x grow first, so the walk never passes through (0, 6), which is worth only 18.',
      ],
      tryInput: { objective: '4x + 3y', limits: 'x <= 5, y <= 6, x + y <= 8' },
      check: (r, c) => (r.status === 'optimal' && corner(r) === '(5, 3)' && r.exact.value === '29' && c.pivots === 2 && JSON.stringify(r.path) === '[[0,0],[5,0],[5,3]]') || `${r.status} at ${corner(r)}, profit ${r.exact.value}, ${c.pivots} pivots`,
    },
    {
      type: 'debug',
      q: 'This ratio test sometimes picks a pivot that makes a value negative, and the walk leaves the allowed shape. What is wrong?',
      code: `leave, best = None, 0.0
for i in range(m):
    if T[i][enter] != 0:
        ratio = T[i][-1] / T[i][enter]
        if leave is None or ratio < best:
            leave, best = i, ratio`,
      options: ['The test `!= 0` should be `> 0`: only rows with a positive number in the entering column limit how far the variable can grow', 'The comparison `ratio < best` should be `ratio > best`', 'The division is upside down', '`best` should start at 1.0'],
      answer: 0,
      explain: [
        'A row with a negative number gives a negative ratio, which looks like the smallest. But in such a row the basis variable grows as the entering variable grows, so it sets no limit and must be skipped.',
        'The smallest ratio is the first limit the walk meets. Taking the largest would step past the others and break them.',
        'The value divided by the entry in the entering column is the right way up: it is how far the variable can grow before the row\'s value reaches zero.',
        'The starting value of `best` is never used, because the first qualifying row always replaces it.',
      ],
    },
    {
      type: 'choice',
      q: 'The profit row has a negative number under y, but no limit row has a positive number in the y column. What does that mean?',
      options: ['The current corner is the best', 'The problem has no allowed plan', 'The profit can be raised without end, so there is no best plan', 'The method should choose a different column'],
      answer: 2,
      explain: [
        'The negative number in the profit row says growing y would still raise the profit, so this corner is not the best.',
        'The method is standing on an allowed corner, so allowed plans exist.',
        'Growing y raises the profit, and no row ever runs out as it grows. The shape is open in that direction.',
        'Another column might also improve the profit, but that does not change the fact that y can be grown for ever.',
      ],
    },
    {
      type: 'choice',
      q: 'After a pivot, the table has changed but the corner and the profit are exactly the same as before. What happened?',
      options: ['A row operation was done wrongly', 'The smallest ratio was 0: a basis variable was already at zero, so the entering variable could not grow', 'The method has finished', 'The problem is unbounded'],
      answer: 1,
      explain: [
        'Nothing is wrong. This is a normal event, called a degenerate pivot.',
        'More boundary lines pass through this corner than are needed to pin it down. The pivot changed which of them the table uses, without moving.',
        'The method finishes only when the profit row has no negative number. After a degenerate pivot it may still have one.',
        'Unbounded means no row limits the entering variable. Here a row limited it to a step of zero.',
      ],
    },
    {
      type: 'challenge',
      title: 'Try the largest-coefficient rule',
      prompt: 'Change one of the programs so that the entering variable is the column with the most negative number in the profit row, which was Dantzig\'s original rule, instead of the first negative one. Run it on the bakery, the first of the four problems, and compare the pivots it prints with the three that Bland\'s rule takes. Then find out why this rule, unlike Bland\'s, comes with no guarantee of finishing.',
      expect: 'On the bakery it prints two pivots instead of three: "y enters, s2 leaves, profit 20.00", then "x enters, s3 leaves, profit 24.00", then "best: x = 2.00, y = 4.00, profit 24.00". The walk goes through (0, 4) instead of (6, 0) and (6, 2) and ends at the same best plan. The tie problem also drops from three pivots to two, with profits 4.00 and 6.00.',
      hints: ['Only the line that chooses `enter` changes. Keep the tie-breaking in the ratio test as it is.', 'Look up "cycling" in the simplex method. It can only happen on problems with ties in the ratio test.'],
    },
  ],

  compare: {
    idea: 'Start at the corner where nothing is made, and keep moving along an edge to a neighbouring corner with more profit until no edge improves.',
    requires: 'A goal and limits that all add up in simple proportion: each unit of a product adds a fixed amount to the profit and uses a fixed amount of each resource. In the form taught here, every limit must say "at most" some number that is zero or more, and no amount can be negative.',
    sensitivity: 'High. The number of pivots depends on the shape, on the objective and on the rule for choosing edges. The chart on this page shows one shape taking 1 pivot or m + 1 depending on the objective.',
    memory: 'O(m(n + m)): the whole tableau.',
    difficulty: 'high',
    difficultyNote: 'Each pivot is simple arithmetic, but the sign conventions, the ratio test and the handling of ties each offer ways to go wrong, and floating-point errors add more.',
    limits: 'It cannot insist on whole-number answers, so it may tell you to make 2.5 chairs. Everything must scale in straight lines, with no bulk discounts and no set-up costs. On rare, specially built problems it can take a very long time.',
    useWhen: 'You are dividing limited resources among several products or activities, the profit and the limits add up in simple proportion, and fractional amounts are fine.',
  },

  advanced: {
    history: 'George Dantzig devised the method in 1947 while working on planning methods for the United States Air Force, where a schedule of training, supply and deployment was called a "program". That is where the name linear programming comes from. Leonid Kantorovich had studied problems of the same kind in the Soviet Union in 1939, and Tjalling Koopmans in the United States during the war. The two shared the 1975 Nobel Memorial Prize in Economic Sciences for the theory of the best allocation of resources. In 1972 Victor Klee and George Minty showed that Dantzig\'s pivot rule can be forced to visit exponentially many corners. In 1977 Robert Bland gave the index rule used on this page and proved that it never cycles. Leonid Khachiyan in 1979 and Narendra Karmarkar in 1984 gave methods with polynomial guarantees, and Karmarkar\'s started the family of interior-point methods. Daniel Spielman and Shang-Hua Teng later explained much of the simplex method\'s good behaviour in practice by showing that, for one pivot rule, a problem whose numbers are slightly and randomly disturbed takes polynomial time on average.',
    derivation: 'Write the problem as: maximise $c^\\top x$ subject to $Ax + s = b$, $x \\ge 0$, $s \\ge 0$, with $b \\ge 0$. Split the $n + m$ variables into $m$ basic ones, $x_B$, and $n$ non-basic ones, $x_N$, and write the equations as $B x_B + N x_N = b$. If $B$ is invertible, then $x_B = B^{-1} b - B^{-1} N x_N$. Setting $x_N = 0$ gives the basic solution $x_B = B^{-1} b$, which is a corner of the feasible region when it is non-negative.\n\nSubstituting into the objective, with $c_B$ and $c_N$ the profit rates of the two groups (zero for slacks), gives $$z = c_B^\\top B^{-1} b + (c_N^\\top - c_B^\\top B^{-1} N)\\, x_N.$$ The vector $c_N^\\top - c_B^\\top B^{-1} N$ holds the *reduced costs*: the change in profit per unit of each non-basic variable. The profit row of the tableau stores their negatives, and its last entry stores $c_B^\\top B^{-1} b$.\n\nRaising one non-basic variable $x_j$ by $\\theta$ changes the basic variables to $x_B = B^{-1} b - \\theta\\, d$, where $d = B^{-1} N_j$ is column $j$ of the tableau. They stay non-negative as long as $\\theta \\le (B^{-1} b)_i / d_i$ for every $i$ with $d_i > 0$. The smallest of these ratios is the step length, and the row that attains it leaves the basis. If no $d_i$ is positive, $\\theta$ can grow without limit. The row operations of a pivot are exactly what turns $B^{-1}$ for the old basis into $B^{-1}$ for the new one.',
    proof: '**Optimality.** Suppose the method stops with every profit-row entry $\\bar{c}_j \\ge 0$ and bottom right entry $v$. The profit row is the equation $z + \\sum_j \\bar{c}_j x_j = v$, and it holds for every solution of the original equations. For any feasible point, all $x_j \\ge 0$, so $z = v - \\sum_j \\bar{c}_j x_j \\le v$. The current basic solution has $x_j = 0$ wherever $\\bar{c}_j \\ne 0$, because basic variables have $\\bar{c}_j = 0$, so it attains $z = v$ and is optimal.\n\n**Unboundedness.** Suppose $\\bar{c}_j < 0$ and column $j$ has no positive entry in any limit row. For every $\\theta \\ge 0$, setting $x_j = \\theta$ and $x_B = B^{-1} b - \\theta\\, d$ with $d \\le 0$ gives a feasible point with $z = v - \\bar{c}_j \\theta$, which tends to infinity.\n\n**Termination.** A basis is a choice of $m$ of the $n + m$ variables, so there are at most $\\binom{n + m}{m}$ of them. If no basis repeats, the method stops. A pivot with a positive step strictly raises $z$, so a basis could only repeat through a run of degenerate pivots. Bland (1977) proved that when the entering variable is the lowest-indexed one with $\\bar{c}_j < 0$ and ties in the ratio test go to the lowest-indexed basic variable, no such run can return to a basis it has left.',
    complexityProof: 'One pivot divides one row of length $n + m + 1$ and updates at most $m$ other rows of the same length, so it costs $O(m(n + m))$ arithmetic operations. With two products and no ties in the ratio test, each pivot moves to a different corner with strictly larger profit, so no corner is visited twice. The region is bounded by at most $m + 2$ lines and so has at most $m + 2$ corners, which gives at most $m + 1$ pivots. The family in the chart attains this: its $m + 2$ corners are the origin and the points $(k, m^2 - k^2)$ for $k = 0, \\dots, m$, the profit $x + 2my$ grows as $k$ falls from $m$ to $0$, and Bland\'s rule sends the walk first to $(m, 0)$ and then through every one of them. In general the only bound is the number of bases, $\\binom{n + m}{m}$, which grows exponentially.',
    variants: [
      { name: 'Two-phase method', text: 'Phase one adds an artificial variable to each limit the origin breaks and minimises their sum with the simplex method itself. If the sum reaches zero, the result is an allowed corner for phase two. If it cannot, the problem has no allowed plan.' },
      { name: 'Big-M method', text: 'The two phases are merged by giving each artificial variable a very large penalty in the objective, so that the method drives them out first.' },
      { name: 'Dual simplex', text: 'Keeps the profit row free of negative numbers and works to remove negative values instead. It is the natural choice when a limit is added to a problem that has already been solved.' },
      { name: 'Revised simplex', text: 'Stores the original data and a factorisation of the current basis, and computes only the column and row each pivot needs. This is what practical solvers implement.' },
      { name: 'Other pivot rules', text: 'Dantzig\'s rule takes the most negative profit-row entry. Steepest-edge rules pick the edge with the greatest gain per unit of distance moved. Both usually need fewer pivots than Bland\'s rule but lack its guarantee.' },
      { name: 'Network simplex', text: 'A specialised form for problems of flow through a network, where a basis is a spanning tree and a pivot swaps one edge of the tree for another.' },
    ],
    implementation: 'Use tolerances everywhere a number is tested against zero: for choosing the entering column, for deciding which rows take part in the ratio test, and for detecting ties. Prefer the larger pivot element when ratios are nearly tied, since dividing by a tiny number magnifies errors. Scale the rows and columns so that the numbers are of similar size. For anything beyond small dense problems, use the revised method with a sparse factorisation, and refactorise from the original data every so often to shed accumulated error. Report the status clearly: optimal, unbounded and infeasible are three different answers.',
    benchmarking: 'Count pivots and time per pivot separately, since rules that lower one tend to raise the other. Use problems from practice as well as random ones: random dense problems are much easier than real sparse ones and say little about them. Record how many pivots were degenerate. When comparing with interior-point methods, include the time to move their answer to a corner if a corner is required.',
    references: [
      { authors: 'G. B. Dantzig', year: 1951, title: 'Maximization of a linear function of variables subject to linear inequalities', venue: 'In T. C. Koopmans (ed.), Activity Analysis of Production and Allocation, Wiley' },
      { authors: 'R. G. Bland', year: 1977, title: 'New finite pivoting rules for the simplex method', venue: 'Mathematics of Operations Research 2(2)' },
      { authors: 'V. Klee and G. J. Minty', year: 1972, title: 'How good is the simplex algorithm?', venue: 'In O. Shisha (ed.), Inequalities III, Academic Press' },
      { authors: 'D. A. Spielman and S.-H. Teng', year: 2004, title: 'Smoothed analysis of algorithms: Why the simplex algorithm usually takes polynomial time', venue: 'Journal of the ACM 51(3)' },
      { authors: 'V. Chvátal', year: 1983, title: 'Linear Programming', venue: 'W. H. Freeman' },
    ],
    furtherReading: [
      'G. B. Dantzig, *Linear Programming and Extensions*, Princeton University Press, 1963.',
      'D. Bertsimas and J. N. Tsitsiklis, *Introduction to Linear Optimization*, Athena Scientific, 1997.',
      'R. J. Vanderbei, *Linear Programming: Foundations and Extensions*, Springer.',
    ],
  },

  tests: [
    { name: 'the worked example: (0, 0), (6, 0), (6, 2), (2, 4), profit 24 in 3 pivots', input: { objective: '2x + 5y', limits: BAKERY },
      check: (r, c) => (r.status === 'optimal' && corner(r) === '(2, 4)' && r.exact.value === '24' && r.pivots === 3 && c.pivots === 3 && JSON.stringify(r.path) === '[[0,0],[6,0],[6,2],[2,4]]' && !r.alternative && agreesWithEveryCorner(r) === true)
        || `${r.status} at ${corner(r)}, profit ${r.exact.value}, ${r.pivots} pivots; ${agreesWithEveryCorner(r)}` },
    { name: 'the quiz prediction: profit 4x + 3y under x <= 5, y <= 6, x + y <= 8 stops at (5, 3) with 29', input: { objective: '4x + 3y', limits: 'x <= 5, y <= 6, x + y <= 8' },
      check: (r) => (corner(r) === '(5, 3)' && r.exact.value === '29' && r.pivots === 2 && agreesWithEveryCorner(r) === true) || `stopped at ${corner(r)} with profit ${r.exact.value}; ${agreesWithEveryCorner(r)}` },
    { name: 'the bakery with profits 5 and 2 stops at (6, 2)', input: { objective: '5x + 2y', limits: BAKERY },
      check: (r) => (corner(r) === '(6, 2)' && r.exact.value === '34' && r.pivots === 2 && agreesWithEveryCorner(r) === true) || `stopped at ${corner(r)} with profit ${r.exact.value}; ${agreesWithEveryCorner(r)}` },
    { name: 'five limits agree with a check of every corner', input: { objective: '3x + 4y', limits: 'x <= 8, y <= 6, x + y <= 10, x + 3y <= 20, 3x + y <= 25' },
      check: (r) => (corner(r) === '(5, 5)' && r.exact.value === '35' && agreesWithEveryCorner(r) === true) || `${corner(r)}; ${agreesWithEveryCorner(r)}` },
    { name: 'fractions and negative coefficients agree with a check of every corner', input: { objective: '1.5x + y', limits: '-x + y <= 2, 2x + 3y <= 12, x - y <= 3/2' },
      check: (r) => (r.status === 'optimal' && agreesWithEveryCorner(r) === true) || `${r.status}; ${agreesWithEveryCorner(r)}` },
    ...[3, 8, 15, 22, 31, 47].map((seed) => ({ name: `random problem ${seed} with 4 limits agrees with a check of every corner`, input: { problem: randomProblem(seed, 4, false) }, check: agreesWithEveryCorner })),
    ...[5, 26, 40, 3, 18, 27].map((seed) => ({ name: `random problem ${seed} with negative numbers agrees with a check of every corner, or of every open direction if it is unbounded`, input: { problem: randomProblem(seed, 3 + (seed % 3), true) }, check: agreesWithEveryCorner })),
    { name: 'an unbounded problem is reported, with a direction that stays allowed and raises the profit', input: { objective: 'x + y', limits: 'x - y <= 2, -x + y <= 3' },
      check: (r) => (r.status === 'unbounded' && r.pivots === 1 && r.ray[0] === 1 && r.ray[1] === 1 && checkEveryCorner(r.problem).unbounded && agreesWithEveryCorner(r) === true) || `${r.status}; ${agreesWithEveryCorner(r)}` },
    { name: 'closing the open shape with one more limit gives a best corner', input: { objective: 'x + y', limits: 'x - y <= 2, -x + y <= 3, x + y <= 12' },
      check: (r) => (r.status === 'optimal' && r.exact.value === '12' && r.alternative && agreesWithEveryCorner(r) === true) || `${r.status} ${r.exact.value}; ${agreesWithEveryCorner(r)}` },
    { name: 'a tie in the ratio test is broken by the lowest variable, and one pivot does not move', input: { objective: 'x + 2y', limits: 'x <= 2, x + y <= 4, y <= 2' },
      check: (r) => (corner(r) === '(2, 2)' && r.exact.value === '6' && r.pivots === 3 && r.ties === 1 && r.stalls === 1 && r.basis.join(' ') === 'x y s1' && agreesWithEveryCorner(r) === true) || `${corner(r)}, ${r.pivots} pivots, ${r.ties} ties, ${r.stalls} stalls, basis ${r.basis.join(' ')}; ${agreesWithEveryCorner(r)}` },
    { name: 'a tie between two best corners is reported', input: { objective: 'x + 2y', limits: BAKERY },
      check: (r) => (r.exact.value === '10' && corner(r) === '(6, 2)' && r.alternative && checkEveryCorner(r.problem).winners.length === 2 && agreesWithEveryCorner(r) === true) || `${corner(r)}, alternative ${r.alternative}; ${agreesWithEveryCorner(r)}` },
    { name: 'an equals with zero on the right is inside the form and solved through degenerate pivots', input: { objective: 'x + y', limits: 'x - y = 0, x <= 3' },
      check: (r) => (corner(r) === '(3, 3)' && r.stalls === 2 && agreesWithEveryCorner(r) === true) || `${corner(r)}, ${r.stalls} stalls; ${agreesWithEveryCorner(r)}` },
    { name: 'no profit rate is positive: the start is best and nothing pivots', input: { objective: '-x - 2y', limits: BAKERY },
      check: (r, c) => (r.status === 'optimal' && corner(r) === '(0, 0)' && r.pivots === 0 && !c.pivots && agreesWithEveryCorner(r) === true) || `${corner(r)}, ${r.pivots} pivots` },
    { name: 'outside the form: an "at least" limit cannot start, and the answer shown matches a check of every corner', input: { objective: 'x + 2y', limits: 'x + y >= 2, x <= 4, y <= 3' },
      check: (r) => {
        const ref = checkEveryCorner(r.problem);
        return (r.status === 'no-start' && r.truth.kind === 'best' && r.truth.x === 4 && r.truth.y === 3 && Math.abs(r.truth.value - ref.best) < 1e-9 && ref.best === 10) || `${r.status}, truth ${JSON.stringify(r.truth)}, reference ${ref.best}`;
      } },
    { name: 'outside the form: limits that cannot all hold are reported as having no allowed mix', input: { objective: 'x + 2y', limits: 'x + y >= 5, x <= 2, y <= 2' },
      check: (r) => (r.status === 'no-start' && r.truth.kind === 'empty' && checkEveryCorner(r.problem).corners.length === 0) || `${r.status}, truth ${JSON.stringify(r.truth)}` },
    { name: 'the staircase with 5 limits takes 6 pivots the long way and 1 the short way', input: { problem: staircase(5, 'long') },
      check: (r) => {
        const ref = checkEveryCorner(r.problem);
        return (r.pivots === 6 && corner(r) === '(0, 25)' && ref.corners.length === 7 && agreesWithEveryCorner(r) === true) || `${r.pivots} pivots to ${corner(r)}, ${ref.corners.length} corners`;
      } },
    { name: 'the staircase with 5 limits and profit y takes 1 pivot', input: { problem: staircase(5, 'short') },
      check: (r) => (r.pivots === 1 && corner(r) === '(0, 25)' && agreesWithEveryCorner(r) === true) || `${r.pivots} pivots to ${corner(r)}` },
  ],
};
