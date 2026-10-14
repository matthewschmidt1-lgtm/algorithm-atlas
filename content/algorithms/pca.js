import { makeRng } from '../../js/lib/rng.js';

const TOLERANCE = 1e-9;  // stop when the tip of the arrow moves less than this in one step
const MAX_STEPS = 300;
const trim = (v, d) => {
  const s = v.toFixed(d);
  return Number(s) === 0 ? (0).toFixed(d) : s;
};
const f2 = (v) => trim(v, 2);
const f3 = (v) => trim(v, 3);
const f4 = (v) => trim(v, 4);
const pct = (v) => `${(100 * v).toFixed(1)}%`;
const vec = (v, f = f3) => `(${f(v[0])}, ${f(v[1])})`;
// A small positive number written out in full with two significant digits: 0.00000032.
const tiny = (v) => (v === 0 ? '0' : v >= 0.001 ? f4(v) : v.toFixed(Math.min(18, 1 - Math.floor(Math.log10(v)))).replace(/0+$/, ''));
const par = (s) => (s.startsWith('-') ? `(${s})` : s);
const TOL_TEXT = 'one billionth';
const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const times = (C, v) => [C[0] * v[0] + C[1] * v[1], C[1] * v[0] + C[2] * v[1]]; // C = [a, b, d] stands for [[a, b], [b, d]]
const degrees = (v) => { const a = Math.atan2(v[1], v[0]) * 180 / Math.PI; return ((a % 180) + 180) % 180; };

function resolvePoints(input) {
  if (Array.isArray(input.custom) && input.custom.length) {
    const c = input.custom;
    if (c.length % 2 !== 0 || c.length < 4) throw new Error('Type your own points as x, y pairs: an even count of numbers, and at least two points.');
    const pts = [];
    for (let i = 0; i < c.length; i += 2) pts.push([c[i], c[i + 1]]);
    return { pts, custom: true };
  }
  // An oval cloud: wide along one direction, narrow across it, turned by the chosen angle.
  const rng = makeRng(input.seed * 9973 + 5);
  const a = input.angle * Math.PI / 180;
  const long = 0.55, short = long * input.thickness;
  const round3 = (v) => { const r = Math.round(v * 1000) / 1000; return r === 0 ? 0 : r; };
  const pts = [];
  for (let i = 0; i < input.points; i++) {
    const along = rng.normal(0, long), across = rng.normal(0, short);
    pts.push([round3(0.35 + along * Math.cos(a) - across * Math.sin(a)), round3(0.25 + along * Math.sin(a) + across * Math.cos(a))]);
  }
  return { pts, custom: false };
}

function run(input, t) {
  const { pts, custom } = resolvePoints(input);
  const n = pts.length;
  if (n < 2) throw new Error('Principal component analysis needs at least two points.');

  // ---- step 1: centre ----
  const mean = [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
  const X = pts.map((p) => [p[0] - mean[0], p[1] - mean[1]]);

  // One square frame, centred on the origin, that holds the points before and after centring.
  let reach = 0;
  for (const p of pts.concat(X)) reach = Math.max(reach, Math.abs(p[0]), Math.abs(p[1]));
  if (reach === 0) throw new Error('All the points are at (0, 0), so there is no spread to analyse.');
  const R = reach * 1.12;
  const unit = R * 0.42; // drawn length of a direction arrow, which has length 1 in the arithmetic

  const found = [];      // components found so far: { v, lambda, steps, converged }
  const scene = ({ points = X, ghost = null, marks = [], arrows = [], axes = found, drops = null, title = 'The centred points' } = {}) => {
    const layers = [{ type: 'segments', segments: [[-R, 0, R, 0], [0, -R, 0, R]], role: 'faint', width: 1, alpha: 0.5 }];
    if (ghost) layers.push({ type: 'points', points: ghost.map((p) => p.slice()), role: 'moss', r: 3.2, alpha: 0.28 });
    axes.forEach((c, k) => {
      const half = Math.max(2 * Math.sqrt(Math.max(c.shown, 0)), R * 0.04);
      layers.push({ type: 'segments', segments: [[-c.v[0] * half, -c.v[1] * half, c.v[0] * half, c.v[1] * half]], role: k === 0 ? 'forest' : 'brick', width: 2.6 });
    });
    if (drops) {
      layers.push({ type: 'segments', segments: X.map((p, i) => [p[0], p[1], drops.v[0] * drops.scores[i], drops.v[1] * drops.scores[i]]), role: 'muted', width: 1, alpha: 0.6 });
      layers.push({ type: 'points', points: drops.scores.map((s) => [drops.v[0] * s, drops.v[1] * s]), role: drops.role, r: 2.8 });
    }
    layers.push({ type: 'points', points: points.map((p) => p.slice()), role: 'moss', r: 3.8 });
    for (const a of arrows) layers.push({ type: 'segments', segments: [[a.from ? a.from[0] : 0, a.from ? a.from[1] : 0, a.to[0], a.to[1]]], role: a.role, width: a.width || 2.4, arrow: true, alpha: a.alpha ?? 1, dash: a.dash });
    for (const m of marks) layers.push({ type: 'points', points: [{ x: m.at[0], y: m.at[1], label: m.label }], role: m.role || 'ink', r: 5, ring: true });
    const legend = [{ label: 'data point', role: 'moss' }];
    if (arrows.some((a) => a.role === 'active')) legend.push({ label: 'current direction (length 1, drawn enlarged)', role: 'active' });
    if (arrows.some((a) => a.role === 'compare')) legend.push({ label: 'matrix times the direction (length not to scale)', role: 'compare' });
    if (axes.length) legend.push({ label: 'first principal direction', role: 'forest' });
    if (axes.length > 1) legend.push({ label: 'second principal direction', role: 'brick' });
    if (drops) legend.push({ label: 'each point dropped straight onto the line', role: 'muted' });
    return { kind: 'scene', title, x: [-R, R], y: [-R, R], aspect: 0.7, equal: true, axes: { xLabel: 'x (feature 1)', yLabel: 'y (feature 2)' }, layers, legend };
  };
  const matrixView = (C, title, shown = 3, roles = {}) => ({ kind: 'table', title, corner: '', colLabels: ['x', 'y'], rowLabels: ['x', 'y'],
    cells: [[shown >= 1 ? f4(C[0]) : '', shown >= 3 ? f4(C[1]) : ''], [shown >= 3 ? f4(C[1]) : '', shown >= 2 ? f4(C[2]) : '']], roles });

  t.frame(() => ({ line: 0,
    note: `${n} points${custom ? ' that you typed' : ''}, each described by two numbers, x and y. Nobody has labelled them. Principal component analysis asks one question of such a cloud: along which direction are the points most spread out? It then describes every point by its position along that direction and along the one at right angles to it. That direction need not be the x axis or the y axis.`,
    views: [scene({ points: pts, title: 'The points as given' })], vars: { points: n } }));

  t.frame(() => ({ line: 1,
    note: `First find the middle. The average x is ${f3(mean[0])} and the average y is ${f3(mean[1])}, so the centre of the cloud is at **${vec(mean)}**. Spread has to be measured from the centre: measured from anywhere else, the distance to the cloud would be counted as if it were spread.`,
    views: [scene({ points: pts, title: 'The points as given, with their centre', marks: [{ at: mean, label: 'centre' }], arrows: [{ from: mean, to: [0, 0], role: 'ink', width: 1.6, dash: [5, 4] }] })],
    vars: { 'mean x': f3(mean[0]), 'mean y': f3(mean[1]) } }));

  t.frame(() => ({ line: 1,
    note: `Subtract the centre from every point. The whole cloud slides by (${f3(-mean[0])}, ${f3(-mean[1])}) without changing shape, and its centre lands on (0, 0). The faint dots show where the points were. From here on, a point's x and y say how far it is from the centre.`,
    views: [scene({ ghost: pts, marks: [{ at: [0, 0], label: 'centre' }] })], vars: { 'mean x': '0.000', 'mean y': '0.000' } }));

  // ---- step 2: covariance matrix (dividing by n - 1, the usual convention for a sample) ----
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of X) { sxx += p[0] * p[0]; sxy += p[0] * p[1]; syy += p[1] * p[1]; }
  sxx /= n - 1; sxy /= n - 1; syy /= n - 1;
  const C = [sxx, sxy, syy];
  const total = sxx + syy;
  if (!(total > 0)) throw new Error('All the points are in the same place, so there is no spread to analyse.');
  const title = 'Covariance matrix';

  t.frame(() => ({ line: 2,
    note: `Measure the spread along x. Square each point's x, add the ${n} squares, and divide by ${n - 1}: the **variance** of x is **${f4(sxx)}**. Squaring makes points on both sides of the centre count alike and makes far points count for more. Dividing by one less than the number of points is the usual convention for a sample; dividing by ${n} would change every entry by the same factor and leave the directions exactly where they are.`,
    views: [scene(), matrixView(C, title, 1, { '0,0': 'current' })], vars: { 'variance of x': f4(sxx) } }));
  t.frame(() => ({ line: 2,
    note: `The same for y: the variance of y is **${f4(syy)}**. Together the two variances give the **total variance**, ${f4(sxx)} + ${f4(syy)} = ${f4(total)}. That total is the amount of spread there is to explain.`,
    views: [scene(), matrixView(C, title, 2, { '1,1': 'current' })], vars: { 'variance of x': f4(sxx), 'variance of y': f4(syy), 'total variance': f4(total) } }));
  t.frame(() => ({ line: 2,
    note: `Now multiply each point's x by its y, add the products, and divide by ${n - 1}. This is the **covariance** of x and y: **${f4(sxy)}**. ${Math.abs(sxy) < 1e-12 ? 'It is zero: knowing a point\'s x tells you nothing about whether its y is high or low.' : sxy > 0 ? 'It is positive because points to the right of the centre tend to be above it, and points to the left below it, so most of the products are positive. The cloud leans up to the right.' : 'It is negative because points to the right of the centre tend to be below it, and points to the left above it, so most of the products are negative. The cloud leans down to the right.'} The three numbers fill a 2 by 2 table, the **covariance matrix**. The covariance appears twice because x with y is the same as y with x.`,
    views: [scene(), matrixView(C, title, 3, { '0,1': 'current', '1,0': 'current' })], vars: { 'variance of x': f4(sxx), 'variance of y': f4(syy), covariance: f4(sxy) } }));

  // ---- step 3: power iteration ----
  const rad = input.start * Math.PI / 180;
  const start = [Math.cos(rad), Math.sin(rad)];
  if (Math.abs(start[0]) < 1e-15) start[0] = 0;
  if (Math.abs(start[1]) < 1e-15) start[1] = 0;
  const arrow = (v, role, extra = {}) => ({ to: [v[0] * unit, v[1] * unit], role, ...extra });

  // Repeatedly multiply by the matrix M and rescale to length 1. Returns the direction it settles on.
  const powerIteration = (M, from, which) => {
    let v = from.slice();
    const changes = [], rayleigh = [], trail = [], directions = [];
    let lambda = 0, steps = 0, converged = false, collapsed = false;
    const name = which === 1 ? 'the covariance matrix' : 'the deflated matrix';
    const FLOOR = 1e-12; // movements smaller than this are drawn at the bottom of the chart
    const chart = () => {
      const span = Math.max(10, changes.length + 1);
      const dots = changes.map((c, i) => [i + 1, Math.log10(Math.max(c, FLOOR))]);
      return { kind: 'scene', title: 'Movement of the tip at each step, as a power of ten (−9 is a billionth)', x: [0, span], y: [-12.5, 1], aspect: 0.22,
        axes: { xLabel: 'step', yLabel: 'power of ten' },
        layers: [
          { type: 'segments', segments: [[0, Math.log10(TOLERANCE), span, Math.log10(TOLERANCE)]], role: 'brick', width: 1.2, dash: [5, 4] },
          { type: 'line', points: dots, role: 'active', width: 1.8 },
          { type: 'points', points: dots, role: 'active', r: 3 },
        ],
        legend: [{ label: 'movement at each step', role: 'active' }, { label: 'tolerance: stop below this line', role: 'brick' }] };
    };
    const old = () => trail.slice(-6).map((p, i, all) => arrow(p, 'faint', { width: 1.2, alpha: 0.25 + 0.5 * ((i + 1) / all.length) }));
    const verdict = (change) => (change < TOLERANCE ? `That is below the tolerance of ${TOL_TEXT}, so stop.` : `That is above the tolerance of ${TOL_TEXT}, so go round again.`);

    while (steps < MAX_STEPS) {
      steps++;
      const w = times(M, v);
      t.count('matrix-vector products');
      const length = Math.hypot(w[0], w[1]);
      const step = steps, before = v.slice();
      if (length < 1e-12 * total) {
        // The matrix sends this direction to zero: there is no spread along it at all.
        collapsed = true; converged = true; lambda = 0;
        t.frame(() => ({ line: [6, 7],
          note: `Step ${step}: ${name} times ${vec(before)} is (0, 0). ${which === 1 ? 'The points have no spread at all along this direction' : 'Nothing is left along this direction'}, so the product has no direction to follow and the iteration cannot move. A direction that a matrix sends to zero is still a direction the matrix does not turn. The variance along it is 0.`,
          views: [scene({ arrows: [arrow(before, 'active')] }), chart()], vars: { step, direction: vec(before), 'variance along it': '0.0000' } }));
        break;
      }
      lambda = dot(v, w); // the variance of the data along v
      const next = [w[0] / length, w[1] / length];
      const change = Math.hypot(next[0] - v[0], next[1] - v[1]);
      const previous = changes.length ? changes[changes.length - 1] : null;
      changes.push(change);
      rayleigh.push(lambda);
      trail.push(before);
      directions.push(next.slice());
      v = next;
      const after = v.slice(), l = lambda, done = change < TOLERANCE;
      const ratio = previous > 0 && change > 0 ? `, about ${f3(change / previous)} times the step before` : '';
      if (which === 1 && step <= 2) {
        t.frame(() => ({ line: [6, 7],
          note: `Step ${step}, multiply. The covariance matrix times the direction ${vec(before)} is (${f4(M[0])} × ${par(f3(before[0]))} + ${par(f4(M[1]))} × ${par(f3(before[1]))}, ${par(f4(M[1]))} × ${par(f3(before[0]))} + ${f4(M[2])} × ${par(f3(before[1]))}) = **${vec(w, f4)}**, drawn in ochre. ${step === 1 ? 'A covariance matrix stretches a direction most along the line where the points are most spread out, and that pulls the product towards that line.' : 'The same pull again: the part of the direction that lies along the long axis of the cloud is stretched more than the part that lies across it.'} The multiplication also gives a measurement for free. The direction dotted with the product, ${f4(l)}, is the variance of the points measured along ${vec(before)}.`,
          views: [scene({ arrows: [...old().slice(0, -1), arrow(before, 'active'), arrow([next[0] * 1.25, next[1] * 1.25], 'compare')] }), chart()],
          vars: { step, direction: vec(before), product: vec(w, f4), 'variance along it': f4(l) } }));
        t.frame(() => ({ line: done ? [8, 9] : [8],
          note: `Step ${step}, rescale. Only the direction of the product matters, so divide it by its own length, ${f4(length)}, to get a direction of length 1 again: **${vec(after)}**. Its tip has moved ${tiny(change)} from where it was${previous === null ? '' : `, compared with ${tiny(previous)} at the step before`}. ${verdict(change)}`,
          views: [scene({ arrows: [...old(), arrow(after, 'active')] }), chart()], vars: { step, direction: vec(after), moved: tiny(change) } }));
      } else {
        t.frame(() => ({ line: done ? [6, 7, 8, 9] : [6, 7, 8],
          note: `Step ${step}${which === 2 ? ' on the deflated matrix' : ''}: multiply ${vec(before)} by the matrix to get ${vec(w, f4)}, then divide by its length, ${f4(length)}. The direction is now **${vec(after)}**${which === 1 ? `, and the variance along the old one was ${f4(l)}` : ''}. The tip moved ${tiny(change)}${ratio}. ${verdict(change)}`,
          views: [scene({ arrows: [...old(), arrow(after, 'active')] }), chart()], vars: { step, direction: vec(after), 'variance along it': f4(l), moved: tiny(change) } }));
      }
      if (done) { converged = true; break; }
    }
    return { v, lambda, steps, converged, collapsed, changes, rayleigh, directions, which };
  };

  t.frame(() => ({ line: [3, 4],
    note: `To find the direction of greatest spread, this page uses **power iteration**. Start with any direction of length 1, here **${vec(start)}** (${input.start}° on the chart). Then repeat two moves: multiply the direction by the covariance matrix, and rescale the result to length 1. Directions are drawn enlarged so that they are easy to see.`,
    views: [scene({ arrows: [arrow(start, 'active')] }), matrixView(C, title)], vars: { start: vec(start) } }));

  const first = powerIteration(C, start, 1);
  first.shown = first.lambda;
  const rate = first.changes.length >= 3 ? first.changes[first.changes.length - 1] / first.changes[first.changes.length - 2] : null;
  found.push(first);
  t.frame(() => ({ line: 10,
    note: first.collapsed
      ? `The starting direction ${vec(first.v)} is kept as a component with variance 0. It cannot be the direction of greatest spread, because the total variance is ${f4(total)}. That will be put right once the other direction has been found.`
      : first.converged
        ? `After ${plural(first.steps, 'multiplication')} the direction has settled at **${vec(first.v, f4)}**, ${f2(degrees(first.v))}° on the chart. Multiplying it by the matrix no longer turns it: the product is the same direction, ${f4(first.lambda)} times as long. A direction that a matrix only stretches is called an **eigenvector**, and the stretch factor is its **eigenvalue**. For a covariance matrix the eigenvalue is the variance of the points along that direction, here **${f4(first.lambda)}** out of a total of ${f4(total)}. The green line marks this direction, two standard deviations long each way.`
        : `After ${MAX_STEPS} multiplications the direction is still moving by ${tiny(first.changes[first.changes.length - 1])} a step, so the iteration is stopped without having converged. The points are almost equally spread in every direction, and then no direction stands out for the method to find. The current direction ${vec(first.v, f4)} is kept, with variance ${f4(first.lambda)} along it.`,
    views: [scene({ arrows: [arrow(first.v, 'forest')] }), matrixView(C, title)], vars: { 'component 1': vec(first.v, f4), variance: f4(first.lambda), steps: first.steps } }));

  // ---- step 4: deflate, then find the second direction the same way ----
  const C2 = [C[0] - first.lambda * first.v[0] * first.v[0], C[1] - first.lambda * first.v[0] * first.v[1], C[2] - first.lambda * first.v[1] * first.v[1]];
  const perp = [-first.v[1], first.v[0]];
  const aligned = Math.abs(dot(start, first.v)) > 1 - 1e-12;
  const start2 = aligned ? perp : start;
  t.frame(() => ({ line: 11,
    note: `Now remove from the matrix the spread that the first direction accounts for: subtract ${f4(first.lambda)} times the table of products of ${vec(first.v, f4)} with itself. What is left, shown below, describes only the spread that the first direction misses. This is called **deflation**. Run the same iteration on the deflated matrix${aligned ? `. The original start points along the first direction, where the deflated matrix has nothing left, so start from ${vec(start2)}, at right angles to it` : `, from the same start ${vec(start2)}`}.`,
    views: [scene({ arrows: [arrow(start2, 'active')] }), matrixView(C2, 'Deflated matrix: the covariance matrix with the first direction\'s share removed')], vars: { start: vec(start2) } }));

  const second = powerIteration(C2, start2, 2);
  if (second.collapsed) { second.v = perp.slice(); second.lambda = 0; }
  second.shown = second.lambda;
  found.push(second);
  const dotProduct = dot(first.v, second.v);
  const square = Math.abs(dotProduct) < 5e-7;
  t.frame(() => ({ line: 10,
    note: second.collapsed
      ? `Nothing is left in the deflated matrix: once the first direction is accounted for, the points have no spread at all, so every point lies on the green line. With two features the only direction left is the one at right angles, **${vec(second.v, f4)}**, with variance 0.`
      : `The second search ends after ${plural(second.steps, 'multiplication')} at **${vec(second.v, f4)}**, with variance **${f4(second.lambda)}**. ${second.steps === 1 ? 'It took a single multiplication because the search began exactly on the one direction the deflated matrix has left.' : 'It is quick because a deflated 2 by 2 matrix has a single direction left in it, so one multiplication lands on it and the next confirms it.'} With more features this search would take several steps, like the first. Now check the angle between the two directions. ${square ? `Their dot product is 0.000000, which means they are **at right angles**. That is not luck. ${Math.abs(first.lambda - second.lambda) <= 1e-9 * total ? 'Deflation removed everything along the first direction, so the only directions left in the matrix are at right angles to it.' : 'A covariance matrix is symmetric, and two eigenvectors of a symmetric matrix with different eigenvalues are always perpendicular.'}` : `Their dot product is ${dotProduct.toFixed(6)}, so they are not exactly at right angles. The first search was stopped before it had settled, and the error carries over.`}${rate !== null && first.converged && second.lambda > 0 && first.lambda > 0 ? ` The second variance also explains the speed of the first search: each step there shrank the movement by a factor of about ${f3(rate)}, and ${f4(second.lambda)} ÷ ${f4(first.lambda)} = ${f3(second.lambda / first.lambda)}. The closer the two variances, the slower power iteration settles.` : ''}`,
    views: [scene(), matrixView(C2, 'Deflated matrix')], vars: { 'component 2': vec(second.v, f4), variance: f4(second.lambda), 'dot product': square ? '0.000000' : dotProduct.toFixed(6) } }));

  // ---- step 5: project ----
  const variance = (v) => X.reduce((s, p) => s + dot(p, v) * dot(p, v), 0) / (n - 1);
  let swapped = false;
  if (variance(second.v) > variance(first.v) + 1e-12 * total) {
    swapped = true;
    found.reverse();
    t.frame(() => ({ line: 10,
      note: `Something is out of order: the direction found second has more variance (${f4(found[0].lambda)}) than the one found first (${f4(found[1].lambda)}). That happens only when the starting direction is exactly at right angles to the direction of greatest spread. The start then has no part along that direction for the multiplications to enlarge, and the iteration stays where it began. Components are ranked by variance, so the two are swapped. Real implementations start from a random direction, which makes an exact right angle practically impossible.`,
      views: [scene(), matrixView(C, title)], vars: { 'component 1': vec(found[0].v, f4), 'component 2': vec(found[1].v, f4) } }));
  }
  const [c1, c2] = found;
  const scores1 = X.map((p) => dot(p, c1.v)), scores2 = X.map((p) => dot(p, c2.v));
  const var1 = variance(c1.v), var2 = variance(c2.v);
  const strip = (scores, role, label) => {
    const reachS = Math.max(...scores.map(Math.abs), 1e-9) * 1.15;
    return { kind: 'scene', title: label, x: [-reachS, reachS], y: [-1, 1], aspect: 0.16, axes: { xLabel: 'score: signed distance from the centre along the direction' },
      layers: [{ type: 'segments', segments: [[-reachS, 0, reachS, 0]], role: 'faint', width: 1 }, { type: 'points', points: scores.map((s) => [s, 0]), role, r: 3.4, alpha: 0.75 }] };
  };

  t.frame(() => ({ line: 12,
    note: `**Project** the points onto the first direction: drop each one straight onto the green line. Its position along the line is its **score**, the point's x times ${f3(c1.v[0])} plus its y times ${f3(c1.v[1])}. The strip below shows the ${n} scores: the two-dimensional cloud flattened to one number per point. The variance of these scores is **${f4(var1)}**${Math.abs(var1 - c1.lambda) <= 1e-9 * total ? ', the same number power iteration reported, as it must be: the eigenvalue is the variance along its direction' : `, against the ${f4(c1.lambda)} that power iteration last reported`}.`,
    views: [scene({ drops: { v: c1.v, scores: scores1, role: 'forest' } }), strip(scores1, 'forest', 'Scores on the first principal direction')], vars: { 'variance of the scores': f4(var1), 'from power iteration': f4(c1.lambda) } }));
  t.frame(() => ({ line: 12,
    note: `Project onto the second direction in the same way. These scores are the part of each point that the first direction misses, and their variance is **${f4(var2)}**. Add the two: ${f4(var1)} + ${f4(var2)} = **${f4(var1 + var2)}**${Math.abs(var1 + var2 - total) <= 1e-9 * total ? `, which is the total variance ${f4(total)} found at the start. Nothing was lost or invented. The two directions are at right angles, so by Pythagoras each point's squared distance from the centre is the square of one score plus the square of the other.` : `, against a total variance of ${f4(total)}. The sums agree only when the two directions are exactly at right angles, and here they are not quite.`}`,
    views: [scene({ drops: { v: c2.v, scores: scores2, role: 'brick' } }), strip(scores2, 'brick', 'Scores on the second principal direction')], vars: { 'variance 1': f4(var1), 'variance 2': f4(var2), sum: f4(var1 + var2), 'total variance': f4(total) } }));

  // ---- check against the closed form, which exists for a 2 by 2 symmetric matrix ----
  const mid = (sxx + syy) / 2, radius = Math.hypot((sxx - syy) / 2, sxy);
  const exact = { l1: mid + radius, l2: mid - radius };
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  exact.v1 = [Math.cos(theta), Math.sin(theta)];
  exact.v2 = [-Math.sin(theta), Math.cos(theta)];
  const round = radius <= 1e-9 * total; // equal variances: every direction is as good as any other
  const off = round ? 0 : Math.asin(Math.min(1, Math.abs(c1.v[0] * exact.v1[1] - c1.v[1] * exact.v1[0]))) * 180 / Math.PI;
  const share = var1 / total;
  t.frame(() => ({ line: null,
    note: `A check from a different route. For a 2 by 2 symmetric matrix the eigenvalues can be written down directly: half the sum of the two variances, plus or minus the square root of (half their difference squared plus the covariance squared). That gives **${f4(exact.l1)}** and **${f4(exact.l2)}**. Power iteration found ${f4(c1.lambda)} and ${f4(c2.lambda)}. ${round ? 'The two are equal, so the points are spread equally in every direction and there is no principal direction to find: any pair of perpendicular directions describes the cloud equally well.' : `The formula puts the first direction at ${f2(degrees(exact.v1))}° and power iteration at ${f2(degrees(c1.v))}°, a difference of ${off < 1e-4 ? 'less than 0.0001°' : `${off.toFixed(4)}°`}.`} The formula exists only for two features. Power iteration works the same way for any number of them, which is why it is the method shown here.`,
    views: [scene(), matrixView(C, title)], vars: { 'formula': `${f4(exact.l1)}, ${f4(exact.l2)}`, 'power iteration': `${f4(c1.lambda)}, ${f4(c2.lambda)}` } }));

  t.frame(() => ({ line: 12,
    note: `Done. The first principal direction ${vec(c1.v)} carries **${pct(share)}** of the total variance and the second, ${vec(c2.v)}, carries the remaining ${pct(1 - share)}. ${share > 0.999 ? 'Keeping only the first score for each point, one number in place of two, would lose nothing here.' : share > 0.9 ? 'Keeping only the first score for each point, one number in place of two, would keep most of the spread.' : share > 0.6 ? 'Keeping only the first score for each point would lose a real part of the spread, the part shown by the short brick line.' : 'The two shares are close, so dropping the second score would throw away nearly half of the spread.'} The lines are drawn two standard deviations long each way. Variance measures spread, and spread is not always what matters: these directions were chosen without knowing what the points are for.`,
    views: [scene({ drops: { v: c1.v, scores: scores1, role: 'forest' } }), strip(scores1, 'forest', 'The data reduced to one number per point: scores on the first principal direction')],
    vars: { 'component 1': vec(c1.v), 'share 1': pct(share), 'component 2': vec(c2.v), 'share 2': pct(1 - share) } }));

  return { n, mean, cov: C.slice(), total, components: [{ direction: c1.v.slice(), variance: var1, eigenvalue: c1.lambda, steps: c1.steps, converged: c1.converged }, { direction: c2.v.slice(), variance: var2, eigenvalue: c2.lambda, steps: c2.steps, converged: c2.converged }],
    share, scores: scores1, scores2, exact, angleError: off, round, swapped, changes: first.changes.slice(), rayleigh: first.rayleigh.slice(), directions: first.directions.map((d) => d.slice()), points: pts, centred: X };
}


// ---- independent references for the tests ----

// A tracer that records nothing, for tests that need extra runs to compare against.
const SILENT = { count() {}, frame() {} };
const DEFAULTS = { points: 40, seed: 1, angle: 30, thickness: 0.3, start: 0, custom: [] };
const quiet = (input) => run({ ...DEFAULTS, ...input }, SILENT);

// Eigenvalues and eigenvectors of the covariance matrix of the points, from the closed form
// for a 2 by 2 symmetric matrix [[a, b], [b, d]]. Written from scratch: it shares no code
// with run, and builds the eigenvectors from (b, λ − a) where run's own check uses an angle.
function closedForm(points) {
  const n = points.length;
  let mx = 0, my = 0;
  for (const p of points) { mx += p[0] / n; my += p[1] / n; }
  let a = 0, b = 0, d = 0;
  for (const p of points) { a += (p[0] - mx) ** 2 / (n - 1); b += (p[0] - mx) * (p[1] - my) / (n - 1); d += (p[1] - my) ** 2 / (n - 1); }
  const half = (a + d) / 2, root = Math.sqrt(((a - d) / 2) ** 2 + b * b);
  const big = half + root, small = half - root;
  const unit = (x, y) => { const len = Math.hypot(x, y); return [x / len, y / len]; };
  let v1;
  if (Math.abs(b) > 1e-14 * (a + d)) v1 = Math.abs(big - a) > Math.abs(big - d) ? unit(b, big - a) : unit(big - d, b);
  else v1 = a >= d ? [1, 0] : [0, 1];
  return { a, b, d, total: a + d, big, small, v1, v2: [-v1[1], v1[0]], round: root <= 1e-9 * (a + d) };
}
const parallel = (u, v) => Math.abs(u[0] * v[1] - u[1] * v[0]);

function matchesClosedForm(r) {
  const ref = closedForm(r.points);
  const tol = 1e-9 * ref.total;
  if (Math.abs(r.cov[0] - ref.a) > tol || Math.abs(r.cov[1] - ref.b) > tol || Math.abs(r.cov[2] - ref.d) > tol) return `covariance ${r.cov}, reference ${[ref.a, ref.b, ref.d]}`;
  const [c1, c2] = r.components;
  if (Math.abs(c1.eigenvalue - ref.big) > tol || Math.abs(c2.eigenvalue - ref.small) > tol) return `eigenvalues ${c1.eigenvalue}, ${c2.eigenvalue}; closed form ${ref.big}, ${ref.small}`;
  if (!ref.round && (parallel(c1.direction, ref.v1) > 1e-6 || parallel(c2.direction, ref.v2) > 1e-6)) return `directions ${c1.direction} and ${c2.direction}; closed form ${ref.v1} and ${ref.v2}`;
  return true;
}
function perpendicular(r) {
  const [u, v] = r.components.map((c) => c.direction);
  if (Math.abs(Math.hypot(u[0], u[1]) - 1) > 1e-12 || Math.abs(Math.hypot(v[0], v[1]) - 1) > 1e-12) return 'a direction is not of length 1';
  const d = u[0] * v[0] + u[1] * v[1];
  return Math.abs(d) < 1e-8 || `the dot product of the two directions is ${d}`;
}
function variancesAddUp(r) {
  const ref = closedForm(r.points);
  const n = r.points.length;
  const mx = r.points.reduce((s, p) => s + p[0], 0) / n, my = r.points.reduce((s, p) => s + p[1], 0) / n;
  const along = (v) => r.points.reduce((s, p) => s + ((p[0] - mx) * v[0] + (p[1] - my) * v[1]) ** 2, 0) / (n - 1);
  const v1 = along(r.components[0].direction), v2 = along(r.components[1].direction);
  const tol = 1e-9 * ref.total;
  if (Math.abs(v1 - r.components[0].variance) > tol || Math.abs(v2 - r.components[1].variance) > tol) return `variances along the directions recomputed as ${v1} and ${v2}, reported ${r.components[0].variance} and ${r.components[1].variance}`;
  if (Math.abs(v1 + v2 - ref.total) > tol || Math.abs(r.total - ref.total) > tol) return `${v1} + ${v2} = ${v1 + v2}, but the total variance is ${ref.total}`;
  if (v2 > v1 + tol) return 'the components are not in order of variance';
  return true;
}
const allChecks = (r) => { for (const check of [matchesClosedForm, perpendicular, variancesAddUp]) { const verdict = check(r); if (verdict !== true) return verdict; } return true; };

const EXAMPLE = [5, 4, 1, 0, 3, 2, 4, 1, 2, 3];
const EXAMPLE_MM = [50, 4, 10, 0, 30, 2, 40, 1, 20, 3];
// The worked example with both features in millimetres: every number ten times larger.
const EXAMPLE_BOTH_MM = [50, 40, 10, 0, 30, 20, 40, 10, 20, 30];

export default {
  meta: {
    id: 'pca',
    name: 'Principal Component Analysis',
    aliases: ['PCA', 'principal components', 'principal components analysis', 'Karhunen-Loève transform', 'Hotelling transform', 'empirical orthogonal functions', 'dimensionality reduction'],
    kind: 'algorithm',
    discipline: 'machine-learning',
    alsoIn: [
      { id: 'statistics', why: 'It was devised by statisticians to summarize many correlated measurements, and it remains a standard first step in multivariate analysis.' },
      { id: 'mathematics', why: 'The principal directions are the eigenvectors of a symmetric matrix, and finding them is a problem of numerical linear algebra.' },
      { id: 'computer-vision', why: 'Treating each image as one long list of pixel values and keeping the leading principal directions gives a compact description of a set of images, the idea behind eigenfaces.' },
    ],
    subfield: 'Unsupervised learning',
    family: 'Dimensionality reduction',
    lab: 'machine-learning',
    year: 1901,
    authors: 'Karl Pearson',
    summary: 'Finds the perpendicular directions along which data vary most, so that many overlapping measurements can be replaced by a few new ones with little lost.',
    difficulty: 'intermediate',
    order: 625,
    paradigms: ['iterative-refinement', 'transform'],
    randomized: false,
    approximate: true,
    time: { best: 'O(nd²) to form the covariance matrix', average: 'O(nd² + k·i·d²) for k directions at i steps each', worst: 'Steps grow without limit as the top two variances approach each other', class: 'iterative' },
    space: { worst: 'O(nd) for the points and O(d²) for the matrix', class: 'linear' },
    tags: {
      problems: ['summarize many measurements with a few', 'plot data that has too many columns', 'find the main direction in a cloud of points', 'see which measurements rise and fall together', 'remove columns that repeat each other', 'shrink data and keep most of the differences'],
      techniques: ['covariance matrix', 'eigenvectors', 'power iteration', 'deflation', 'projection', 'singular value decomposition'],
      applications: ['machine learning', 'statistics', 'image processing', 'finance', 'bioinformatics', 'signal processing', 'data compression'],
    },
    prerequisites: ['concept:linear-algebra', 'concept:matrix', 'concept:unsupervised-learning', 'concept:feature-space'],
  },

  bigIdea: {
    simple: "Principal component analysis finds the directions in which a set of measurements varies most. Suppose you measure the height and the arm span of everyone in a school. Tall pupils tend to have long arms, so the two numbers mostly rise and fall together. Plot each pupil as a dot, with height across and arm span up, and the dots form a long thin cloud running diagonally. The long way along that cloud is the first principal direction. You could call it overall size. One number, how far along the cloud a pupil sits, tells you most of what the two measurements told you. The short way across the cloud is the second direction. It holds what is left over, such as arms that are unusually long for a pupil's height. The method finds these directions by arithmetic alone. Nobody tells it what size means. It earns its keep when there are not two measurements but fifty. Often a handful of directions hold nearly all the variation, and the rest can be dropped with little lost.",
    when: "Use it when you have many numeric measurements that overlap in what they say and you want fewer: to draw a chart of data with too many columns, to shrink the data before handing it to another method, or to see which measurements move together. Rescale the columns first unless they share a unit. Choose something else when the pattern in the data is curved, because the method finds only straight directions. Choose something else when you have labels and want the directions that separate the classes, because it never looks at labels. And think twice when every column of the result has to be something people recognize, because each new column is a blend of all the old ones.",
    interesting: "Nothing in the method asks for the directions to be at right angles, and they come out that way. Their variances add up exactly to the total: the method neither creates nor destroys spread. It only shares the spread out differently, as unevenly as it can. And the procedure that finds the first direction is about as simple as an algorithm gets: multiply by a table, rescale, repeat. The same procedure on a different table ranks web pages in [PageRank](#/algorithm/pagerank).",
    analogy: {
      title: "The shadow that shows the most",
      text: "Hold a fork between a lamp and a wall and turn it. End-on, its shadow is a small blob that could be anything. Side-on, the shadow is long and you can count the prongs. A shadow is a flattened copy of an object: three dimensions pressed into two. Principal component analysis chooses the angle that makes the shadow of a cloud of points as spread out as possible, on the grounds that the most spread-out shadow keeps the points furthest apart and so loses the least.",
      limits: "The widest shadow is not always the one that shows what you care about. Two kinds of point can differ in a direction where the cloud is thin, and the widest shadow would press them together. A lamp also flattens three dimensions to two, while the method goes from any number of measurements to any smaller number, which no picture can show. And a cloud that is bent like a horseshoe has no flat shadow that does it justice, because the method can only choose a straight direction to look along.",
    },
  },

  example: {
    setup: "Five points on a chart: (5, 4), (1, 0), (3, 2), (4, 1) and (2, 3). Think of each as two measurements of one object. The aim is to find the direction along which the five are most spread out.",
    steps: [
      "Find the centre. The average of the first numbers is (5 + 1 + 3 + 4 + 2) ÷ 5 = 3, and the average of the second numbers is 2. Subtract (3, 2) from every point. They become (2, 2), (−2, −2), (0, 0), (1, −1) and (−1, 1).",
      "Measure the spread. Square the first numbers and add: 4 + 4 + 0 + 1 + 1 = 10. Divide by 4, one less than the number of points, to get 2.5. The second numbers give 2.5 as well. Now multiply each point's two numbers together and add: 4 + 4 + 0 − 1 − 1 = 6, and 6 ÷ 4 = 1.5. Write these in a small table with 2.5 and 1.5 on the top row and 1.5 and 2.5 on the bottom.",
      "Start with an arrow along the first axis, (1, 0), and multiply it by the table. The new first number is 2.5 × 1 + 1.5 × 0 = 2.5, and the new second number is 1.5 × 1 + 2.5 × 0 = 1.5. The arrow (2.5, 1.5) is 2.92 long, so divide both numbers by 2.92 to bring it back to length 1: (0.86, 0.51). It has swung towards the diagonal.",
      "Do the same again. From (0.86, 0.51) the table gives (2.92, 2.57), which rescales to (0.75, 0.66). Once more gives (0.72, 0.70). Each round the arrow moves about a quarter as far as the round before, and it settles at (0.71, 0.71), the diagonal.",
      "Measure each point along that diagonal: add its two numbers and multiply by 0.71. The five results are 2.83, −2.83, 0, 0 and 0. Their squares add to 16, and 16 ÷ 4 = 4. Measured across the diagonal in the same way, the squares add to 4, and 4 ÷ 4 = 1.",
    ],
    result: "The first principal direction is the diagonal (0.71, 0.71), and the spread along it is 4. The second is at right angles to it, (0.71, −0.71), with a spread of 1. Together they make 5, the same as the 2.5 + 2.5 the table began with. The spread has not changed. It has been shared out differently, and four fifths of it now lies along a single direction.",
    tryInput: { custom: EXAMPLE, start: 0 },
  },

  terms: [
    { term: "Feature", meaning: "One measured number describing an item, such as a height. On this page there are two, x and y, and each is one axis of the chart." },
    { term: "Centre", meaning: "The average position of all the points: the average x together with the average y. Centring means subtracting it from every point." },
    { term: "Variance", meaning: "A measure of spread: the average of the squared distances from the centre, measured along one direction. Its square root is the standard deviation." },
    { term: "Covariance", meaning: "A number saying whether two features rise and fall together. It is positive when a high value of one tends to go with a high value of the other, negative when it goes with a low value, and zero when there is no such tendency." },
    { term: "Covariance matrix", meaning: "A small table holding the variance of every feature and the covariance of every pair. With two features it has four entries, two of them equal." },
    { term: "Direction", meaning: "An arrow of length 1 from the centre, given by two numbers. The arrow and its opposite mark the same line." },
    { term: "Projection", meaning: "Dropping a point straight onto a line, as a shadow falls. The point's position along the line is its score." },
    { term: "Principal direction", meaning: "A direction along which the points are as spread out as possible. The first is the best of all, and each later one is the best among directions at right angles to those before it. It is also called a principal axis, or a principal component." },
    { term: "Eigenvector", meaning: "A direction that a matrix stretches without turning. The stretch factor is called its eigenvalue. The principal directions are the eigenvectors of the covariance matrix." },
    { term: "Power iteration", meaning: "A way to find the eigenvector with the largest eigenvalue: multiply any starting direction by the matrix, rescale it to length 1, and repeat until it stops moving." },
    { term: "Deflation", meaning: "Removing from a matrix the part that an eigenvector already found accounts for, so that the same search finds the next one." },
  ],

  takeaway: "Find the direction along which the points spread out most, then the next one at right angles to it, and describe every point by where it sits along those few directions.",

  viz: {
    describe: 'A square scatter plot of unlabelled points in moss green, with faint axes through the origin. The first frames show the cloud sliding so that its centre sits on the origin. During power iteration a terracotta arrow from the origin shows the current direction, an ochre arrow shows the matrix times that direction, and faint arrows show where the direction was on earlier steps. A small chart below plots how far the tip of the arrow moved at each step, as a power of ten, against a dashed line at the stopping tolerance. Once found, the first principal direction is a forest green line and the second a brick line, each two standard deviations long either way. In the projection frames thin lines drop every point onto a principal direction, and a strip below shows the resulting scores as dots on one line. A table shows the covariance matrix while it is being built and again after deflation.',
    inputs: [
      { id: 'points', type: 'range', label: 'Number of points', min: 10, max: 120, step: 2, default: 40 },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 1 },
      { id: 'angle', type: 'range', label: 'Tilt of the cloud (degrees)', min: -80, max: 80, step: 5, default: 30,
        help: 'The direction the points are generated along. The method is not told this number.' },
      { id: 'thickness', type: 'range', label: 'Thickness of the cloud', min: 0.05, max: 0.8, step: 0.05, default: 0.3,
        help: 'The spread across the cloud as a fraction of the spread along it. At 0.05 the cloud is nearly a line, and at 0.8 it is nearly round.' },
      { id: 'start', type: 'range', label: 'Starting direction (degrees)', min: 0, max: 175, step: 5, default: 0,
        help: 'Where power iteration begins. 0 points along x and 90 along y.' },
      { id: 'custom', type: 'list', label: 'Or type your own points', default: [], maxLength: 120, min: -1000, max: 1000, placeholder: 'e.g. 5, 4, 1, 0, 3, 2, 4, 1, 2, 3',
        help: 'Read as x, y pairs. Leave empty to use the generated cloud.' },
    ],
    presets: [
      { label: 'A tilted oval cloud', values: { points: 40, seed: 1, angle: 30, thickness: 0.3, start: 0, custom: [] } },
      { label: 'Nearly round: slow to settle', values: { points: 40, seed: 2, angle: 30, thickness: 0.8, start: 0, custom: [] } },
      { label: 'Nearly a line', values: { points: 40, seed: 1, angle: 30, thickness: 0.05, start: 0, custom: [] } },
      { label: 'Starting almost at right angles', values: { points: 40, seed: 1, angle: 30, thickness: 0.3, start: 120, custom: [] } },
      { label: 'Tilted the other way', values: { points: 40, seed: 1, angle: -45, thickness: 0.3, start: 0, custom: [] } },
      { label: 'Worked example: five points', values: { custom: EXAMPLE, start: 0 } },
      { label: 'The worked example with x in millimetres', values: { custom: EXAMPLE_MM, start: 0 } },
    ],
    tryThis: [
      { ask: 'Run the default and watch the terracotta arrow during power iteration. Will it turn by the same amount at every step? And how many multiplications will the first search need before the tip of the arrow moves by less than one billionth?',
        reveal: 'It swings most on the first step and less on each step after: the tip moves 0.47, then 0.065, then 0.0079. Each step is about an eighth of the one before, because every multiplication shrinks the movement by the second variance divided by the first, here 0.0288 ÷ 0.2381. That constant factor is why the dots in the small chart fall along a straight line. The first search ends after 11 multiplications.' },
      { ask: 'Load "Nearly round: slow to settle". The default needed 11 multiplications to find its first direction. Will a rounder cloud need fewer or more, and roughly how many?',
        reveal: 'More: 29. The two variances are 0.359 and 0.182, so each step shrinks the movement only by about half, where the default shrank it to an eighth, and the line in the chart slopes more gently. In a rounder cloud the two variances are closer together and the leading direction stands out less. Lower the thickness and count again: on the same points the count falls to 18 at 0.6, 11 at 0.4 and 7 at 0.2.' },
      { ask: 'Load "Starting almost at right angles". The start has very little of the leading direction in it. Will the first step still be the largest, as it was in the default? And will the search end somewhere different?',
        reveal: 'The first step moves the tip of the arrow by 0.19, the second by 0.82 and the third by 0.44. Only after that does the movement shrink steadily. A start almost at right angles to the answer gives the first multiplication very little to amplify, so the movement grows before it shrinks. The search takes 13 multiplications where the default took 11, and it ends at the same direction, (0.852, 0.523), as from any other start.' },
      { ask: 'Load "Worked example: five points", where the first direction is the diagonal, at 45°, with 80% of the variance. Then load "The worked example with x in millimetres". The objects are the same and only the unit of x has changed, so every x is ten times larger. Where will the first direction point now, and what share of the variance will it hold?',
        reveal: 'It swings to (0.998, 0.060), which is 3.5° from the x axis, and its share goes from 80% to 99.4%. Multiplying x by 10 multiplies its variance by 100, to 250 against 2.5 for y, so nearly all the spread now lies along x. The method sees numbers, not objects. This is why columns in different units are rescaled before the method is used.' },
      { ask: 'Set the thickness to 0.05, so that the cloud is nearly a line. What share of the variance will the first direction hold? And will the first search be quicker or slower than the 11 multiplications of the default?',
        reveal: 'The first direction holds 99.7% of the variance, and the search is quicker: 5 multiplications. The second variance is about 300 times smaller than the first, so each step shrinks the movement about 300-fold. The strip of scores in the last frame holds nearly everything the two-dimensional plot did.' },
    ],
    run,
    report: (r, c) => `Centre (${f3(r.mean[0])}, ${f3(r.mean[1])}). Covariance matrix [${f4(r.cov[0])}, ${f4(r.cov[1])}; ${f4(r.cov[1])}, ${f4(r.cov[2])}], total variance ${f4(r.total)}.\nFirst principal direction ${vec(r.components[0].direction, f4)}: variance ${f4(r.components[0].variance)}, ${pct(r.share)} of the total.\nSecond principal direction ${vec(r.components[1].direction, f4)}: variance ${f4(r.components[1].variance)}, ${pct(1 - r.share)} of the total.\n${c['matrix-vector products'] || 0} matrix-vector products by power iteration${r.components[0].converged ? '' : ' (the first search was stopped before it settled)'}.${r.round ? '\nThe two variances are equal, so no direction stands out.' : ''}${r.swapped ? '\nThe start was exactly at right angles to the leading direction, so the components were found in the wrong order and swapped.' : ''}`,
    experiment: {
      title: 'Multiplications needed as the cloud gets rounder',
      note: 'Each point is a real run on 20,000 generated points, counting every multiplication of a direction by a matrix until both principal directions have settled to within one billionth. The horizontal axis is the thickness r, so the second variance is about r² times the first. Power iteration shrinks its error by that factor at every step. Starting 45° away from the answer, the first search should therefore need about 1 + ln(10⁻⁹ ÷ (1 − r²)) ÷ ln(r²) steps, and the second search needs 2 more. The measured counts differ a little from the formula because a sample of points never has exactly the intended ratio of variances.',
      metric: 'matrix-vector products',
      metricLabel: 'Matrix-vector products',
      sizeLabel: 'Thickness of the cloud (r)',
      sizes: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      variants: [{ id: 'both', label: 'Both directions, to a tolerance of one billionth' }],
      input: (r, variant, seed) => ({ points: 20000, seed, angle: 30, thickness: r, start: 75, custom: [] }),
      theory: [{ label: '3 + ln(10⁻⁹ ÷ (1 − r²)) ÷ ln(r²)', fn: (r) => 3 + Math.log(1e-9 / (1 - r * r)) / Math.log(r * r) }],
    },
  },

  logic: {
    intuition: "Every direction through the centre has a variance: project the points onto it and measure their spread. The covariance matrix holds all of these at once, because the variance along a direction is found by multiplying the matrix by the direction and taking the dot product with the direction again. So the search for the most spread-out direction becomes a question about the matrix, and the answer is its eigenvector with the largest eigenvalue. Power iteration finds that eigenvector by exploiting what an eigenvalue is. Any starting direction is a mixture of the two principal directions. Each multiplication stretches the part along the first by the larger variance and the part along the second by the smaller. After enough multiplications the first part dwarfs the second, and the direction has turned to face it.",
    steps: [
      "Centre the data: subtract the mean of each feature from every point.",
      "Form the covariance matrix: the variance of each feature, and the covariance of each pair.",
      "Pick a starting direction of length 1. Multiply it by the matrix and rescale the result to length 1. Repeat until the direction moves by less than a small tolerance.",
      "Record the direction and the variance along it. Then deflate the matrix by subtracting what that direction accounts for.",
      "Repeat the search on the deflated matrix to find the next direction, and so on for as many directions as are wanted.",
      "Project: the score of a point on a direction is the dot product of the centred point with that direction.",
    ],
    pseudocode: [
      'pca(points):',
      '  subtract the mean from each',
      '  C ← covariance matrix',
      '  for k ← 1, 2:',
      '    v ← starting direction',
      '    repeat:',
      '      w ← C × v',
      '      λ ← v · w',
      '      v ← w / length(w)',
      '    until v moves < tolerance',
      '    component k ← (v, λ)',
      '    C ← C − λ × v × vᵀ',
      '  scores ← points · directions',
    ],
    decisions: [
      { title: 'Raw units, or rescaled?', text: 'Variance depends on units, so the directions do too. If the features share a unit, such as pixel brightness or prices in one currency, use them as they are. If they do not, divide each centred feature by its standard deviation first. That is the same as analysing the correlation matrix in place of the covariance matrix, and it gives every feature the same say.' },
      { title: 'How many directions to keep?', text: 'There is no rule that fits every case. Common aids are to keep enough directions to reach a chosen share of the variance, to plot the variances in order and look for the point where they level off, or to choose the number that gives the best result in whatever the reduced data are used for. For a chart, the number is two.' },
      { title: 'Divide by n or by n − 1?', text: 'This page divides by n − 1, the usual convention when the points are a sample. Dividing by n multiplies the whole matrix by one constant, which changes the variances slightly and the directions not at all.' },
      { title: 'Power iteration, or something else?', text: 'Power iteration is shown here because every step can be seen. It suits very large problems where only the first few directions are wanted and the matrix is too big to factor. For ordinary sizes, libraries compute a singular value decomposition of the centred data, which gives all the directions at once and more accurately, without forming the covariance matrix.' },
      { title: 'Where to start, and when to stop?', text: 'Any start works unless it is exactly at right angles to the answer, so implementations start from a random direction. This page lets you choose the start to see what difference it makes. It stops when the tip of the direction moves less than one billionth in a step, or after 300 steps.' },
    ],
    invariants: [
      'After every rescaling the direction has length 1.',
      'The variance along the current direction never decreases from one step of power iteration to the next.',
      'The angle between the current direction and the leading principal direction never increases.',
      'After deflation the matrix is still symmetric, and it has no variance left along the directions already found.',
    ],
    edgeCases: [
      'Equal variances in every direction, as for the corners of a square: every direction is an eigenvector, the start is returned unchanged, and no principal direction exists to be found.',
      'A start exactly at right angles to the leading direction: the iteration cannot leave it and reports the second direction first. This page detects the wrong order from the variances and swaps the two.',
      'All points on one straight line: the second variance is zero and the first direction carries everything.',
      'Two variances that are nearly equal: power iteration converges very slowly, and the directions it finds change a great deal if a few points are altered.',
      'One point far from the rest: it can supply most of the variance alone, and the first direction then points at it.',
      'Features in different units: the feature with the largest numbers dominates.',
      'A direction and its opposite: both describe the same line, so the sign of a principal direction, and of its scores, carries no meaning.',
    ],
    correctness: "Two claims need support. The first is that the **eigenvector of the covariance matrix with the largest eigenvalue is the direction of greatest variance**. The variance along a direction of length 1 is a weighted average of the eigenvalues, with weights that are the squared parts of the direction along each eigenvector and that sum to 1. A weighted average cannot exceed the largest value, and it reaches it only when all the weight is on the leading eigenvector.\n\nThe second is that **power iteration converges to that eigenvector**. Write the start as a mixture of the eigenvectors. Each multiplication multiplies the part along each eigenvector by its eigenvalue, so after k steps the ratio of the second part to the first has shrunk by the factor (second eigenvalue ÷ first eigenvalue) raised to the power k. If the first eigenvalue is strictly the larger and the start has some part along the first eigenvector, that ratio goes to zero. Both conditions matter, and the edge cases show what happens when either fails.\n\nThe sum of the variances along the principal directions equals the total variance because the directions are perpendicular and of length 1: by Pythagoras, each point's squared distance from the centre is the sum of its squared scores. What is **not** guaranteed is that the directions are useful. They are the directions of greatest spread and nothing more.",
    mistakes: [
      'Forgetting to centre the data. The first direction then points from the origin towards the middle of the cloud, whatever the shape of the cloud.',
      'Mixing features in different units without rescaling them.',
      'Leaving out the rescaling step in power iteration. The numbers then grow or shrink at every step until they overflow or vanish.',
      'Testing convergence by comparing a direction with the previous one when the matrix can flip its sign. A covariance matrix never does, but a general symmetric matrix can.',
      'Computing the centre and the directions from all the data, test data included, before measuring how well a later method predicts.',
      'Reading each principal direction as a real cause behind the data. It is a blend of features chosen for its variance.',
      'Keeping directions out of habit, such as "the first two", without looking at how much variance they hold.',
    ],
  },

  code: {
    sample: {
      input: 'Find both principal directions of six points by centring, forming the covariance matrix, and running power iteration with deflation, printing every step. Then project the points onto the first direction.',
      expected: 'mean: (5.00, 15.00)\ncovariance: [8.4000 6.0000] [6.0000 5.2000]\ndirection 1, step 1: (0.8137, 0.5812) variance 8.4000\ndirection 1, step 2: (0.7940, 0.6080) variance 12.9946\ndirection 1, step 3: (0.7930, 0.6092) variance 13.0096\ndirection 1, step 4: (0.7930, 0.6092) variance 13.0097\ndirection 1, step 5: (0.7930, 0.6092) variance 13.0097\ndirection 1, step 6: (0.7930, 0.6092) variance 13.0097\ndirection 1, step 7: (0.7930, 0.6092) variance 13.0097\ndirection 1, step 8: (0.7930, 0.6092) variance 13.0097\ndirection 2, step 1: (0.6092, -0.7930) variance 0.2191\ndirection 2, step 2: (0.6092, -0.7930) variance 0.5903\nat right angles: yes\ntotal variance 13.6000 = 13.0097 + 0.5903\nshare along direction 1: 95.7%\nscores: -5.000 -2.804 -0.793 0.793 3.414 4.390',
    },
    breakIt: [
      { change: 'Skip the centring: build `centred` from the raw coordinates, without subtracting the two means. The cloud itself leans about 38° up from the x axis. Where will direction 1 point now?',
        find: { python: 'centred = [(p[0] - mean_x, p[1] - mean_y) for p in points]', javascript: 'const centred = points.map((p) => [p[0] - meanX, p[1] - meanY]);' },
        replace: { python: 'centred = [(p[0], p[1]) for p in points]', javascript: 'const centred = points.map((p) => [p[0], p[1]]);' },
        reveal: 'Direction 1 settles at (0.3341, 0.9425), about 70° up from the x axis, where the correct program found (0.7930, 0.6092), about 38°. The centre of the cloud is at (5, 15), which lies 72° up from the x axis as seen from the origin, and that is very nearly where the direction now points. Without the subtraction every point has large positive coordinates, the covariance line reads "[38.4000 96.0000] [96.0000 275.2000]", and the matrix describes where the cloud is, not what shape it has. The last line gives the mistake away: all six scores are positive, from 11.645 to 19.304, when scores measured from the centre add up to zero.' },
      { change: 'Record x in millimetres and leave y alone: multiply the first number of every point by 10, so that the list begins `(10, 12), (30, 13)`. The six objects have not changed. Where will direction 1 point?',
        find: { python: 'points = [(1, 12), (3, 13), (4, 15), (6, 15), (7, 18), (9, 17)]', javascript: 'const points = [[1, 12], [3, 13], [4, 15], [6, 15], [7, 18], [9, 17]];' },
        replace: { python: 'points = [(10, 12), (30, 13), (40, 15), (60, 15), (70, 18), (90, 17)]', javascript: 'const points = [[10, 12], [30, 13], [40, 15], [60, 15], [70, 18], [90, 17]];' },
        reveal: 'Almost along the x axis: (0.9975, 0.0713), about 4° from it, where it was (0.7930, 0.6092). The variance of x has gone from 8.4 to 840 while the variance of y is still 5.2, so the covariance line reads "[840.0000 60.0000] [60.0000 5.2000]" and the share along direction 1 rises from 95.7% to 99.9%. The search also ends sooner, after 4 steps where it took 8, because one variance now dwarfs the other. Nothing about the six objects is different. The method sees numbers and follows the largest spread, whatever unit produced it.' },
    ],
    python: {
      source: `import math

points = [(1, 12), (3, 13), (4, 15), (6, 15), (7, 18), (9, 17)]
n = len(points)

# 1. centre the data
mean_x = sum(p[0] for p in points) / n
mean_y = sum(p[1] for p in points) / n
centred = [(p[0] - mean_x, p[1] - mean_y) for p in points]
print(f"mean: ({mean_x:.2f}, {mean_y:.2f})")

# 2. covariance matrix [[a, b], [b, d]], dividing by n - 1
a = sum(x * x for x, y in centred) / (n - 1)
b = sum(x * y for x, y in centred) / (n - 1)
d = sum(y * y for x, y in centred) / (n - 1)
print(f"covariance: [{a:.4f} {b:.4f}] [{b:.4f} {d:.4f}]")


# 3. power iteration: multiply by the matrix, rescale to length 1, repeat
def power_iteration(a, b, d, name):
    vx, vy = 1.0, 0.0
    step = 0
    while True:
        step += 1
        wx = a * vx + b * vy
        wy = b * vx + d * vy
        variance = vx * wx + vy * wy
        length = math.sqrt(wx * wx + wy * wy)
        dx, dy = wx / length - vx, wy / length - vy
        vx, vy = wx / length, wy / length
        print(f"{name}, step {step}: ({vx:.4f}, {vy:.4f}) variance {variance:.4f}")
        if math.sqrt(dx * dx + dy * dy) < 1e-9:
            return vx, vy, variance


x1, y1, var1 = power_iteration(a, b, d, "direction 1")

# 4. deflate: remove the spread that direction 1 accounts for, then search again
x2, y2, var2 = power_iteration(a - var1 * x1 * x1, b - var1 * x1 * y1, d - var1 * y1 * y1, "direction 2")

perpendicular = abs(x1 * x2 + y1 * y2) < 1e-9
print("at right angles: " + ("yes" if perpendicular else "no"))
print(f"total variance {a + d:.4f} = {var1:.4f} + {var2:.4f}")
print(f"share along direction 1: {100 * var1 / (a + d):.1f}%")

# 5. project: one score per point
scores = [x * x1 + y * y1 for x, y in centred]
print("scores: " + " ".join(f"{s:.3f}" for s in scores))`,
      notes: [
        { line: 9, text: 'Centring. Everything after this line measures positions from the centre of the cloud.' },
        { line: 14, text: 'The covariance of x and y. It is positive here, so the cloud leans up to the right. Dividing by n − 1 is the convention for a sample.' },
        { line: 25, text: 'The multiplication: a 2 by 2 matrix times a direction, written out. Together with the next line it is one step of power iteration.' },
        { line: 27, text: 'The direction dotted with its own product is the variance of the points along that direction. Printed each step, it climbs towards the largest eigenvalue and never falls.' },
        { line: 30, text: 'Rescale to length 1. Without this the numbers would grow by a factor of about 13 at every step.' },
        { line: 32, text: 'Stop when the direction has moved by less than one billionth. The printed directions look settled by step 3, but only to the four decimals shown.' },
        { line: 39, text: 'Deflation. Subtracting var1 times the products of the first direction with itself leaves a matrix with no spread along that direction, so the same search now finds the second.' },
        { line: 47, text: 'Projection. Each score is the dot product of a centred point with the first direction: one number per point in place of two.' },
      ],
    },
    javascript: {
      source: `const points = [[1, 12], [3, 13], [4, 15], [6, 15], [7, 18], [9, 17]];
const n = points.length;

// 1. centre the data
const meanX = points.reduce((s, p) => s + p[0], 0) / n;
const meanY = points.reduce((s, p) => s + p[1], 0) / n;
const centred = points.map((p) => [p[0] - meanX, p[1] - meanY]);
console.log("mean: (" + meanX.toFixed(2) + ", " + meanY.toFixed(2) + ")");

// 2. covariance matrix [[a, b], [b, d]], dividing by n - 1
const a = centred.reduce((s, p) => s + p[0] * p[0], 0) / (n - 1);
const b = centred.reduce((s, p) => s + p[0] * p[1], 0) / (n - 1);
const d = centred.reduce((s, p) => s + p[1] * p[1], 0) / (n - 1);
console.log("covariance: [" + a.toFixed(4) + " " + b.toFixed(4) + "] [" + b.toFixed(4) + " " + d.toFixed(4) + "]");

// 3. power iteration: multiply by the matrix, rescale to length 1, repeat
function powerIteration(a, b, d, name) {
  let vx = 1, vy = 0;
  let step = 0;
  while (true) {
    step++;
    const wx = a * vx + b * vy;
    const wy = b * vx + d * vy;
    const variance = vx * wx + vy * wy;
    const length = Math.sqrt(wx * wx + wy * wy);
    const dx = wx / length - vx, dy = wy / length - vy;
    vx = wx / length;
    vy = wy / length;
    console.log(name + ", step " + step + ": (" + vx.toFixed(4) + ", " + vy.toFixed(4) + ") variance " + variance.toFixed(4));
    if (Math.sqrt(dx * dx + dy * dy) < 1e-9) return [vx, vy, variance];
  }
}

const [x1, y1, var1] = powerIteration(a, b, d, "direction 1");

// 4. deflate: remove the spread that direction 1 accounts for, then search again
const [x2, y2, var2] = powerIteration(a - var1 * x1 * x1, b - var1 * x1 * y1, d - var1 * y1 * y1, "direction 2");

const perpendicular = Math.abs(x1 * x2 + y1 * y2) < 1e-9;
console.log("at right angles: " + (perpendicular ? "yes" : "no"));
console.log("total variance " + (a + d).toFixed(4) + " = " + var1.toFixed(4) + " + " + var2.toFixed(4));
console.log("share along direction 1: " + (100 * var1 / (a + d)).toFixed(1) + "%");

// 5. project: one score per point
const scores = centred.map((p) => p[0] * x1 + p[1] * y1);
console.log("scores: " + scores.map((s) => s.toFixed(3)).join(" "));`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>
#include <vector>

struct Direction { double x, y, variance; };

// 3. power iteration: multiply by the matrix, rescale to length 1, repeat
Direction powerIteration(double a, double b, double d, const char* name) {
    double vx = 1.0, vy = 0.0;
    int step = 0;
    while (true) {
        ++step;
        double wx = a * vx + b * vy;
        double wy = b * vx + d * vy;
        double variance = vx * wx + vy * wy;
        double length = std::sqrt(wx * wx + wy * wy);
        double dx = wx / length - vx, dy = wy / length - vy;
        vx = wx / length;
        vy = wy / length;
        std::printf("%s, step %d: (%.4f, %.4f) variance %.4f\\n", name, step, vx, vy, variance);
        if (std::sqrt(dx * dx + dy * dy) < 1e-9) return {vx, vy, variance};
    }
}

int main() {
    const std::vector<std::vector<double>> points = {{1, 12}, {3, 13}, {4, 15}, {6, 15}, {7, 18}, {9, 17}};
    const int n = (int)points.size();

    // 1. centre the data
    double meanX = 0.0, meanY = 0.0;
    for (const auto& p : points) { meanX += p[0]; meanY += p[1]; }
    meanX /= n;
    meanY /= n;
    std::printf("mean: (%.2f, %.2f)\\n", meanX, meanY);

    // 2. covariance matrix [[a, b], [b, d]], dividing by n - 1
    double a = 0.0, b = 0.0, d = 0.0;
    for (const auto& p : points) {
        double x = p[0] - meanX, y = p[1] - meanY;
        a += x * x;
        b += x * y;
        d += y * y;
    }
    a /= n - 1;
    b /= n - 1;
    d /= n - 1;
    std::printf("covariance: [%.4f %.4f] [%.4f %.4f]\\n", a, b, b, d);

    Direction one = powerIteration(a, b, d, "direction 1");

    // 4. deflate: remove the spread that direction 1 accounts for, then search again
    Direction two = powerIteration(a - one.variance * one.x * one.x, b - one.variance * one.x * one.y, d - one.variance * one.y * one.y, "direction 2");

    bool perpendicular = std::fabs(one.x * two.x + one.y * two.y) < 1e-9;
    std::printf("at right angles: %s\\n", perpendicular ? "yes" : "no");
    std::printf("total variance %.4f = %.4f + %.4f\\n", a + d, one.variance, two.variance);
    std::printf("share along direction 1: %.1f%%\\n", 100 * one.variance / (a + d));

    // 5. project: one score per point
    std::printf("scores:");
    for (const auto& p : points) std::printf(" %.3f", (p[0] - meanX) * one.x + (p[1] - meanY) * one.y);
    std::printf("\\n");
    return 0;
}`,
    },
  },

  complexity: {
    summary: "The work falls into two parts. Building the covariance matrix reads every point once and costs more as the number of features grows, because the matrix has an entry for every pair of features. Finding a direction by power iteration costs one matrix multiplication per step, and the number of steps depends on the data and not on how many points there are: it is set by how close the second variance is to the first. With n points and d features, building the matrix is O(nd²) and each step is O(d²).",
    cases: [
      { case: 'Centring', time: 'O(nd)', when: 'One pass to find the means and one to subtract them.' },
      { case: 'Covariance matrix', time: 'O(nd²)', when: 'Every point contributes to each of the d² entries.' },
      { case: 'One step of power iteration', time: 'O(d²)', when: 'One multiplication of the d by d matrix by a direction.' },
      { case: 'One direction to tolerance ε', time: 'O(d² · log(1/ε) / log(λ₁/λ₂))', when: 'λ₁ and λ₂ are the largest and second largest variances. The error shrinks by the factor λ₂/λ₁ at each step.' },
      { case: 'Two nearly equal leading variances', time: 'Unbounded', when: 'As λ₂/λ₁ approaches 1 the number of steps grows without limit, and at exactly 1 there is no single direction to converge to.' },
      { case: 'All d directions by a standard library', time: 'O(nd² + d³)', when: 'The usual method for moderate d is a full eigenvalue or singular value decomposition, not power iteration.' },
      { case: 'Projecting the points', time: 'O(ndk)', when: 'One dot product of length d for each of n points and k kept directions.' },
    ],
    space: 'O(nd) for the points and O(d²) for the covariance matrix. Power iteration itself needs only the current direction and its product, O(d).',
    memory: 'The covariance matrix is the part that grows awkwardly: with 10,000 features it has 100 million entries. Methods for very wide data avoid forming it and multiply by the centred data directly.',
    tradeoffs: 'Power iteration is simple and needs almost no memory beyond the matrix, and it can stop after the first few directions. Its weakness is speed when two variances are close. Deflation also passes on the error of each direction to the ones found after it. A full decomposition is more accurate and finds every direction, at a cost that grows with the cube of the number of features.',
    assumptions: [
      'n is the number of points, d the number of features (2 on this page) and k the number of directions kept.',
      'The bound for one direction assumes the largest variance is strictly greater than the second and that the start is not exactly at right angles to the leading direction.',
      'The cost of a full decomposition is the standard figure for dense matrices.',
      'The experiment counts multiplications on generated clouds of 20,000 points, including the two used by the second search. Its formula is for a start 45° from the answer.',
    ],
  },

  tradeoffs: {
    struggles: [
      'Curved patterns. A cloud shaped like an arc or a spiral has no straight direction that describes it.',
      'Differences that live in a direction of small variance. If two groups are separated across the thin side of the cloud, the first direction ignores exactly what tells them apart.',
      'Data with a few extreme points. Variance squares distances, so one distant point can decide the first direction.',
      'Nearly equal variances. The directions are then poorly determined, and a slightly different sample gives quite different ones.',
      'Features that are categories or counts with many zeros, where averages and squared distances mean little.',
    ],
    pitfalls: [
      'Running it on features in mixed units without rescaling.',
      'Treating a small share of variance as proof that a direction is unimportant for the question at hand.',
      'Giving the directions names, such as "quality" or "size", and then reasoning from the names.',
      'Fitting the centre and directions on data that will also be used to test a model.',
      'Comparing signs of scores between two runs. A direction and its opposite are the same answer.',
    ],
    misunderstandings: [
      "\"The first principal component is the most important measurement.\" It is not one of the measurements. It is a new quantity blended from all of them, with a weight for each.",
      "\"It finds the line of best fit, the same as regression.\" Linear regression measures the gaps to the line vertically, because it is predicting y from x. Principal component analysis measures them at right angles to the line and treats x and y alike. On the same points the two lines differ.",
      "\"The directions with little variance are noise and can always be thrown away.\" Small variance means small spread. Whether that spread matters depends on what the data are for, and the method does not know.",
      "\"It separates the groups in the data.\" It never sees group labels. If the groups happen to differ along a direction of large variance they will look separated, and if they do not, they will not.",
      "\"The answer is a fact about the objects.\" It is a fact about the numbers. Record one feature in millimetres in place of centimetres and the directions change, though the objects have not.",
      "\"Power iteration is the method.\" It is one way to compute the directions, used here because each step can be watched. The directions are defined by the covariance matrix, and any correct way of finding its eigenvectors gives the same ones.",
    ],
    constraints: [
      'Libraries compute the directions from a singular value decomposition of the centred data, which avoids the loss of accuracy that comes from forming the covariance matrix.',
      'For very large or very wide data, randomized and incremental methods find the leading directions without holding everything in memory.',
    ],
    alternatives: [
      { id: 'k-means', name: 'k-Means Clustering', when: 'You want to split the items into groups, not to describe them along directions.' },
      { id: 'linear-regression', name: 'Linear Regression', when: 'One column is the thing to be predicted and the others are there to predict it.' },
      { name: 'Linear discriminant analysis', when: 'The items have class labels and you want the directions that separate the classes best.' },
      { name: 't-SNE and UMAP', when: 'The goal is a two-dimensional picture of data whose structure is curved or clustered, and distances in the picture need not mean anything exact.' },
      { name: 'Autoencoders', when: 'The data lie near a curved surface and there are enough of them to train a neural network to find it.' },
    ],
    comparison: {
      columns: ['', 'Principal component analysis', 'Linear regression', 'k-means'],
      rows: [
        ['Needs a target or labels', 'No', 'Yes, one column to predict', 'No'],
        ['What it produces', 'A few new axes and each point\'s position along them', 'A formula for one column from the others', 'A few centres and each point\'s nearest one'],
        ['What it minimizes', 'Squared distance from the points to a line or plane, measured at right angles', 'Squared gap between predicted and actual values of the target', 'Squared distance from each point to its centre'],
        ['Changes if a feature changes units', 'Yes', 'Only the weight for that feature', 'Yes'],
      ],
    },
  },

  applications: [
    { title: 'Eigenfaces', status: 'established', text: 'Turk and Pentland treated each photograph of a face as one long list of pixel brightnesses and computed the principal directions of a collection of them. Each direction, displayed as an image, looks like a ghostly face. A new face is described by a few dozen scores in place of thousands of pixels, and faces are compared by their scores.' },
    { title: 'Ancestry in genetic data', status: 'established', text: 'Applied to the genotypes of many people at many positions in the genome, the leading principal directions reflect shared ancestry, and in some samples they follow geography closely. Geneticists also include the leading scores in association studies to correct for differences in ancestry between cases and controls.' },
    { title: 'Movements of the yield curve', status: 'established', text: 'Litterman and Scheinkman applied the method to the returns of bonds of different maturities and found that three directions account for most of the variation. They are usually described as a shift in the level of interest rates, a change in the steepness of the curve, and a change in its curvature.' },
    { title: 'Charts of data with many columns', status: 'established', text: 'Plotting each item by its scores on the first two principal directions is a standard first look at a dataset with more columns than can be drawn. The share of variance those two directions hold says how much the chart leaves out.' },
    { title: 'Preparing data for another method', status: 'established', text: 'Replacing many correlated features by a smaller number of scores reduces the work for a later method and removes the correlation between its inputs. Regression on the leading scores is known as principal component regression.' },
    { title: 'Summarizing a customer survey', status: 'illustrative', text: 'A survey asks thirty questions, and many of them measure much the same thing. The first few principal directions might show that most of the differences between respondents come down to three or four themes, each a blend of related questions. The blends still have to be interpreted by a person.' },
  ],

  connections: [
    { to: 'concept:linear-algebra', type: 'prerequisite', why: 'Principal component analysis is stated in the language of linear algebra: directions are vectors, the principal directions are eigenvectors of the covariance matrix, and scores are dot products.' },
    { to: 'concept:matrix', type: 'prerequisite', why: 'The covariance matrix is the object principal component analysis works on, and power iteration is nothing but repeated multiplication of a vector by that matrix.' },
    { to: 'concept:unsupervised-learning', type: 'prerequisite', why: 'Principal component analysis uses no labels. It looks for structure in the measurements alone, which is what unsupervised learning means.' },
    { to: 'concept:feature-space', type: 'prerequisite', why: 'Each item is a point whose coordinates are its measurements, and principal component analysis chooses new axes for that space.' },
    { to: 'concept:convergence', type: 'related', why: 'Power iteration, the method used here to find each principal direction, converges at a steady rate set by the ratio of the two largest variances.' },
    { to: 'pagerank', type: 'related', why: 'PageRank and this lesson\'s principal component analysis both find the leading eigenvector of a matrix by power iteration: multiply, rescale, repeat.' },
    { to: 'k-means', type: 'related', why: 'k-means and principal component analysis both summarize unlabelled data by minimizing squared distance. k-means replaces each point by the nearest of a few centres, and principal component analysis by its projection onto a few directions.' },
    { to: 'linear-regression', type: 'related', why: 'Linear regression and principal component analysis both fit a line to a cloud of points by least squares. Regression measures the gaps vertically to predict one feature, and principal component analysis measures them at right angles and treats the features alike.' },
    { to: 'knn', type: 'related', why: 'k-nearest neighbours depends on distances, which become less informative as features are added. Principal component analysis is often used first, to replace many features by a few before distances are measured.' },
    { to: 'fft', type: 'related', why: 'The Fourier transform and principal component analysis both describe data along a new set of perpendicular directions. The Fourier transform uses fixed waves, while principal component analysis learns its directions from the data.' },
    { to: 'backpropagation', type: 'advanced', why: 'A neural network trained by backpropagation to squeeze data through a narrow layer and rebuild it generalizes principal component analysis: with no nonlinear units, the narrow layer learns the same subspace.' },
    { to: 'discipline:statistics', type: 'application', why: 'Principal component analysis is a basic tool of multivariate statistics, used to describe the joint variation of many measured variables with a few.' },
    { to: 'discipline:computer-vision', type: 'application', why: 'Sets of images are compressed and compared through their scores on a few principal directions, as in the eigenface method for faces.' },
    { to: 'discipline:finance', type: 'application', why: 'The joint movements of many interest rates or asset returns are routinely summarized by a few principal directions, which serve as risk factors.' },
    { to: 'discipline:biology', type: 'application', why: 'In population genetics the leading principal directions of genotype data reveal shared ancestry among the people sampled.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why is the mean subtracted from every point before anything else is computed?',
      options: ['To make all the numbers smaller and the arithmetic faster', 'Because spread has to be measured from the centre of the cloud, not from the origin', 'To make the two features have the same variance', 'Because power iteration only works on positive numbers'],
      answer: 1,
      explain: [
        'Speed is not the reason, and the size of the numbers does not matter to the method.',
        'Variance is spread about the centre. Without centring, the distance from the origin to the cloud is counted as if it were spread, and the first direction simply points at the middle of the cloud.',
        'Centring shifts the points and leaves every variance as it was. Making variances equal is a separate step, rescaling.',
        'Centred data have negative coordinates, and power iteration handles them without trouble.',
      ],
    },
    {
      type: 'predict',
      q: 'In the worked example the first principal direction is the diagonal, at 45°, and it holds 80% of the variance. Now suppose both measurements had been recorded in millimetres and not centimetres, so every number is ten times larger: (50, 40), (10, 0), (30, 20), (40, 10), (20, 30). Where does the first principal direction point, and what share does it hold?',
      options: ['Still at 45°, with the same 80% of the variance', 'Still at 45°, but with over 99% of the variance, because the numbers are larger', 'Almost along the x axis, as when x alone was put in millimetres', 'Nowhere: with variances this large, power iteration no longer settles'],
      answer: 0,
      explain: [
        'Correct. Multiplying both features by 10 multiplies every entry of the covariance matrix by 100, to 250, 150 and 250. A matrix times 100 stretches every direction by the same extra factor, so the directions stay where they were. The variances along them become 400 and 100, and 400 out of 500 is still 80%. What turns the direction is a change in one unit relative to the other.',
        'The share is a ratio. Both variances are multiplied by 100, to 400 and 100, so the first is still four fifths of the total.',
        'The direction turned towards x when x alone grew, because the spread of x then dwarfed the spread of y. Here both spreads grew by the same factor.',
        'Each step shrinks the movement by the second variance divided by the first, which is 100 ÷ 400. That is the same quarter as before, and the search takes the same 16 multiplications.',
      ],
      tryInput: { custom: EXAMPLE_BOTH_MM, start: 0 },
      check: (r) => {
        const [c1, c2] = r.components;
        return (Math.abs(c1.direction[0] - Math.SQRT1_2) < 1e-7 && Math.abs(c1.direction[1] - Math.SQRT1_2) < 1e-7 && Math.abs(c1.variance - 400) < 1e-6 && Math.abs(c2.variance - 100) < 1e-6 && Math.abs(r.share - 0.8) < 1e-9 && c1.steps === 16)
          || `direction ${c1.direction}, variances ${c1.variance} and ${c2.variance}, share ${r.share}, ${c1.steps} steps`;
      },
    },
    {
      type: 'debug',
      q: 'This function is meant to return the covariance of x and y. Used for principal component analysis, it gives a first direction that always points from the origin towards the middle of the cloud. What is wrong?',
      code: `def covariance(points):
    n = len(points)
    total = 0.0
    for x, y in points:
        total += x * y
    return total / (n - 1)`,
      options: ['It should divide by n, not by n − 1', 'It should add x + y, not multiply', 'The means of x and y are never subtracted', 'It should take the square root of the result'],
      answer: 2,
      explain: [
        'Dividing by n would change the value by a constant factor and leave the directions where they are.',
        'Covariance is built from products. A sum would not measure whether x and y move together.',
        'The products must be of distances from the centre: (x − mean of x) × (y − mean of y). Without the subtraction, a cloud far from the origin gives large positive products for every point, and the matrix describes where the cloud is, not what shape it has.',
        'A covariance can be negative, and no square root is taken.',
      ],
    },
    {
      type: 'choice',
      q: 'Two clouds have the same number of points. In the first, the variances along the principal directions are 10 and 1. In the second they are 10 and 9. On which does power iteration need more steps, and why?',
      options: ['The first, because the difference between its variances is larger', 'The second, because each step shrinks the error by the factor 9/10, against 1/10 for the first', 'The same, because the number of steps depends on the number of points', 'The second, because its total variance is larger'],
      answer: 1,
      explain: [
        'A large gap makes the leading direction stand out, which is the easy case.',
        'Each multiplication stretches the part along the first direction by 10 and the part along the second by 9, so the unwanted part shrinks by only a tenth of itself per step. With variances 10 and 1 it shrinks tenfold per step.',
        'The matrix is 2 by 2 whatever the number of points. Only the ratio of the variances sets the pace.',
        'Doubling every variance would not change the ratio or the number of steps.',
      ],
    },
    {
      type: 'challenge',
      title: 'Three features, and a fair comparison of units',
      prompt: 'Extend the code sample to three features: a 3 by 3 covariance matrix, and three directions found one after another by power iteration with deflation. Test it on these six points, whose first two features are those of the code sample: (1, 12, 3), (3, 13, 1), (4, 15, 2), (6, 15, 0), (7, 18, 2), (9, 17, 1). Check that the three directions are perpendicular in pairs and that the three variances add up to the total. Then multiply the third feature by 100 and run it again. Finally run it on features that have each been divided by their standard deviation, the one that divides by n − 1. Describe how the first direction changes across the three runs.',
      expect: 'As given: the variances along the three directions are 13.2302, 1.2502 and 0.2196, which add up to the total of 14.7, and the first direction is (0.7891, 0.5996, −0.1337) with 90.0% of the variance. With the third feature times 100: the first direction is (−0.0146, −0.0055, 0.9999), almost exactly the third feature alone, with 99.9% of a total of 11013.6. With each feature divided by its standard deviation (2.8983, 2.2804 and 1.0488): the variances are 2.1701, 0.7856 and 0.0443, which add up to 3, and the first direction is (0.6662, 0.6091, −0.4303) with 72.3%. A direction may come out with all its signs reversed, which is the same answer. In every run the three directions are at right angles in pairs.',
      hints: [
        'A 3 by 3 symmetric matrix has six distinct entries. Write a function that multiplies it by a vector of three numbers.',
        'Deflation subtracts λ × v[i] × v[j] from entry (i, j) of the matrix.',
        'The second search now takes more than two steps, because a deflated 3 by 3 matrix still has two directions left in it.',
        'After dividing each feature by its standard deviation, every variance on the diagonal of the matrix is 1.',
      ],
    },
  ],

  compare: {
    idea: 'Find the direction in which the items differ most, then the next one at right angles to it, and describe every item by where it sits along those directions.',
    requires: 'A table of numbers with the same measurements for every item, in units that can fairly be compared. If the units differ, rescale each column to the same spread first.',
    sensitivity: 'High to units and to extreme values. One column in large units, or one far-off item, can take over the first direction.',
    memory: 'The table of data, plus a second table with one row and one column per measurement.',
    difficulty: 'moderate',
    difficultyNote: 'The loop is a few lines. Knowing when to rescale, how many directions to keep and what they mean takes more thought.',
    limits: 'It finds only straight directions, so it misses curved patterns. It keeps what varies most, which is not always what matters. The new directions are blends of all the measurements and can be hard to give a name to.',
    useWhen: 'You have many measurements that largely repeat one another and want a few numbers that keep most of the differences between items, for a chart or as simpler input to another method.',
  },

  advanced: {
    history: "Karl Pearson introduced the method in 1901 as a problem in geometry: find the line, or the plane, that lies closest to a set of points when distances are measured at right angles to it. Harold Hotelling developed it independently in 1933, starting from the question of which combinations of variables have the greatest variance, in a paper whose title speaks of principal components. The two starting points lead to the same directions. In 1936 Eckart and Young showed that keeping the leading directions gives the best approximation of a table of data by one of lower rank, measured by squared error. The same computation is known in signal processing as the Karhunen-Loève transform and in meteorology as the method of empirical orthogonal functions. Power iteration, the procedure used on this page, is also called the von Mises iteration.",
    derivation: "Let the centred points be $x_1, \\dots, x_n$ and let $C = \\frac{1}{n-1}\\sum_i x_i x_i^{\\mathsf T}$ be their covariance matrix. The score of point $i$ on a direction $v$ with $\\lVert v \\rVert = 1$ is $x_i^{\\mathsf T} v$, and the variance of the scores is\n\n$$\\frac{1}{n-1}\\sum_i (x_i^{\\mathsf T} v)^2 = v^{\\mathsf T} C v.$$\n\nTo maximize it subject to $v^{\\mathsf T} v = 1$, set the gradient of $v^{\\mathsf T} C v - \\lambda (v^{\\mathsf T} v - 1)$ to zero, which gives $C v = \\lambda v$. So the best direction is an eigenvector of $C$, and the variance along it is $v^{\\mathsf T} C v = \\lambda$: the best is the eigenvector with the largest eigenvalue. Repeating the argument with the added condition that $v$ be perpendicular to the directions already found gives the remaining eigenvectors in order.\n\nPearson's view follows from Pythagoras. For each point, $\\lVert x_i \\rVert^2 = (x_i^{\\mathsf T} v)^2 + \\text{dist}_i^2$, where $\\text{dist}_i$ is the distance from the point to the line along $v$. The left side does not depend on $v$, so making the scores as spread out as possible is the same as making the perpendicular distances as small as possible.",
    proof: "**Power iteration.** $C$ is symmetric, so it has perpendicular eigenvectors $u_1, u_2$ of length 1 with eigenvalues $\\lambda_1 \\ge \\lambda_2 \\ge 0$. Write the start as $v_0 = c_1 u_1 + c_2 u_2$. Then $C^k v_0 = c_1 \\lambda_1^k u_1 + c_2 \\lambda_2^k u_2$, and the angle $\\theta_k$ between the iterate and $u_1$ satisfies\n\n$$\\tan\\theta_k = \\frac{c_2}{c_1}\\left(\\frac{\\lambda_2}{\\lambda_1}\\right)^{k}.$$\n\nIf $\\lambda_1 > \\lambda_2$ and $c_1 \\ne 0$ this tends to zero, by the factor $\\lambda_2/\\lambda_1$ at every step. Rescaling changes only the length, never the angle. If $c_1 = 0$ the iterate is $u_2$ at every step, which is the start at right angles that the demonstration detects.\n\n**The variance never falls.** With weights $c_i^2$, the variance along the iterate after $k$ steps is $m_{2k+1}/m_{2k}$, where $m_j = \\sum_i c_i^2 \\lambda_i^{\\,j}$. By the Cauchy-Schwarz inequality $m_{j+1}^2 \\le m_j\\, m_{j+2}$, so the ratios $m_{j+1}/m_j$ do not decrease as $j$ grows.\n\n**Deflation.** $C - \\lambda_1 u_1 u_1^{\\mathsf T}$ sends $u_1$ to zero and acts on every vector perpendicular to $u_1$ exactly as $C$ does. Its eigenvectors are those of $C$, with $\\lambda_1$ replaced by 0.\n\n**The variances add up.** The trace of $C$ is the sum of the variances of the features, and the trace of a symmetric matrix equals the sum of its eigenvalues. So $\\lambda_1 + \\lambda_2$ is the total variance.",
    complexityProof: "Forming $C$ adds one $d \\times d$ table of products per point: $O(nd^2)$. A step of power iteration is one product of $C$ with a vector, $O(d^2)$. For the direction to be within $\\varepsilon$ of $u_1$ we need $(\\lambda_2/\\lambda_1)^k \\lvert c_2/c_1 \\rvert \\le \\varepsilon$, that is\n\n$$k \\ge \\frac{\\ln(1/\\varepsilon) + \\ln\\lvert c_2/c_1 \\rvert}{\\ln(\\lambda_1/\\lambda_2)}.$$\n\nThe stopping rule on this page looks at the movement in one step, which for small angles is $\\tan\\theta_{k-1} - \\tan\\theta_k = (1 - \\rho)\\rho^{\\,k-1}\\lvert c_2/c_1 \\rvert$ with $\\rho = \\lambda_2/\\lambda_1$. Setting this below $\\varepsilon$ with $\\lvert c_2/c_1 \\rvert = 1$ gives $k \\approx 1 + \\ln(\\varepsilon/(1-\\rho))/\\ln\\rho$, the formula the experiment is compared with.",
    variants: [
      { name: 'Correlation-based PCA', text: 'Each feature is divided by its standard deviation before the analysis, so that every feature has variance 1 and units no longer matter.' },
      { name: 'PCA by singular value decomposition', text: 'The directions are the right singular vectors of the centred data matrix, and the variances are the squared singular values divided by n − 1. This is how libraries compute them.' },
      { name: 'Kernel PCA', text: 'Schölkopf, Smola and Müller replaced the dot products between points by a kernel function, which amounts to carrying out the analysis in a much larger feature space and can follow curved structure.' },
      { name: 'Probabilistic PCA', text: 'Tipping and Bishop gave the method a probability model in which the principal directions arise as maximum likelihood estimates, which allows missing values and comparison between models.' },
      { name: 'Randomized methods', text: 'For very large matrices, a small number of multiplications by random vectors finds a subspace that nearly contains the leading directions, and the exact computation is then done inside it.' },
      { name: 'Sparse and robust variants', text: 'Sparse PCA forces each direction to use only a few features, for easier interpretation. Robust variants reduce the influence of extreme points.' },
    ],
    implementation: "Centre with the means of the training data and reuse those means for any later data. Rescale features that are in different units. Prefer a library singular value decomposition to forming the covariance matrix. If you do use power iteration, start from a random direction, rescale at every step, and remember that deflation carries forward the error of every direction already found. Fix a sign convention, such as making the largest entry of each direction positive, if results must be compared between runs.",
    benchmarking: "Report the share of variance carried by each direction kept, and the error in rebuilding the data from the kept scores. State whether the features were rescaled. When the reduced data feed another method, judge the number of directions by that method's performance on held-out data, not by variance alone.",
    references: [
      { authors: 'K. Pearson', year: 1901, title: 'On lines and planes of closest fit to systems of points in space', venue: 'Philosophical Magazine, Series 6, 2(11), 559-572' },
      { authors: 'H. Hotelling', year: 1933, title: 'Analysis of a complex of statistical variables into principal components', venue: 'Journal of Educational Psychology 24, 417-441 and 498-520' },
      { authors: 'C. Eckart and G. Young', year: 1936, title: 'The approximation of one matrix by another of lower rank', venue: 'Psychometrika 1(3), 211-218' },
      { authors: 'M. Turk and A. Pentland', year: 1991, title: 'Eigenfaces for recognition', venue: 'Journal of Cognitive Neuroscience 3(1), 71-86' },
      { authors: 'R. Litterman and J. Scheinkman', year: 1991, title: 'Common factors affecting bond returns', venue: 'Journal of Fixed Income 1(1)' },
      { authors: 'I. T. Jolliffe', year: 2002, title: 'Principal Component Analysis (2nd edition)', venue: 'Springer' },
    ],
    furtherReading: [
      'C. M. Bishop, *Pattern Recognition and Machine Learning*, chapter 12, "Continuous Latent Variables".',
      'T. Hastie, R. Tibshirani and J. Friedman, *The Elements of Statistical Learning* (2nd edition), section 14.5, "Principal Components, Curves and Surfaces".',
      'G. H. Golub and C. F. Van Loan, *Matrix Computations*, Johns Hopkins University Press, for the power method and the methods that libraries use in its place.',
    ],
  },

  tests: [
    { name: 'default: directions and variances match the closed form for a 2 by 2 symmetric matrix', input: {},
      check: (r, c) => {
        const used = r.components[0].steps + r.components[1].steps;
        if (c['matrix-vector products'] !== used) return `counted ${c['matrix-vector products']} products, the two searches report ${used}`;
        if (r.components[0].steps !== 11 || !r.components[0].converged) return `first search took ${r.components[0].steps} steps`;
        return matchesClosedForm(r);
      } },
    { name: 'default: the two directions are perpendicular and of length 1', input: {}, check: perpendicular },
    { name: 'default: the variances along the two directions add up to the total variance', input: {}, check: variancesAddUp },
    { name: 'closed form, right angle and variance sum hold across tilts, thicknesses, seeds and starts', input: { points: 60, seed: 4, angle: -55, thickness: 0.5, start: 100 },
      check: (r) => {
        const here = allChecks(r);
        if (here !== true) return here;
        for (const seed of [1, 2, 3, 4, 5]) for (const angle of [-80, -30, 0, 45, 80]) for (const thickness of [0.05, 0.3, 0.6]) for (const start of [0, 65, 140]) {
          const other = quiet({ seed, angle, thickness, start, points: 30 });
          const verdict = allChecks(other);
          if (verdict !== true) return `seed ${seed}, tilt ${angle}, thickness ${thickness}, start ${start}: ${verdict}`;
          if (!other.components[0].converged) return `seed ${seed}, tilt ${angle}, thickness ${thickness}, start ${start}: did not converge`;
        }
        return true;
      } },
    { name: 'the worked example: covariance 2.5, 1.5, 2.5, first step (0.86, 0.51), variances 4 and 1 along the diagonals', input: { custom: EXAMPLE, start: 0 },
      check: (r) => {
        const near = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;
        if (!near(r.mean[0], 3) || !near(r.mean[1], 2) || !near(r.cov[0], 2.5) || !near(r.cov[1], 1.5) || !near(r.cov[2], 2.5)) return `mean ${r.mean}, covariance ${r.cov}`;
        const d = r.directions;
        if (!near(d[0][0], 2.5 / Math.hypot(2.5, 1.5)) || !near(d[0][1], 1.5 / Math.hypot(2.5, 1.5))) return `first step ${d[0]}`;
        if (d[0].map((v) => v.toFixed(2)).join() !== '0.86,0.51' || d[1].map((v) => v.toFixed(2)).join() !== '0.75,0.66' || d[2].map((v) => v.toFixed(2)).join() !== '0.72,0.70') return `first three directions ${d.slice(0, 3)}`;
        const [c1, c2] = r.components;
        if (!near(c1.variance, 4, 1e-8) || !near(c2.variance, 1, 1e-8) || !near(r.share, 0.8, 1e-8)) return `variances ${c1.variance}, ${c2.variance}`;
        if (!near(Math.abs(c1.direction[0]), Math.SQRT1_2, 1e-8) || !near(c1.direction[0], c1.direction[1], 1e-8) || !near(c2.direction[0], -c2.direction[1], 1e-8)) return `directions ${c1.direction}, ${c2.direction}`;
        if (r.scores.map((s) => s.toFixed(2).replace('-0.00', '0.00')).join() !== '2.83,-2.83,0.00,0.00,0.00') return `scores ${r.scores}`;
        const ratio = r.changes[5] / r.changes[4];
        return (near(ratio, 0.25, 1e-3) && allChecks(r)) || `movement ratio ${ratio}`;
      } },
    { name: 'the variance along the direction never falls, and the movement shrinks by the ratio of the two variances', input: { points: 40, seed: 3, angle: 60, thickness: 0.6, start: 150 },
      check: (r) => {
        for (let i = 1; i < r.rayleigh.length; i++) if (r.rayleigh[i] < r.rayleigh[i - 1] - 1e-12) return `variance along the direction fell at step ${i + 1}: ${r.rayleigh[i - 1]} to ${r.rayleigh[i]}`;
        const k = r.changes.length - 2;
        const rate = r.changes[k] / r.changes[k - 1], expected = r.components[1].variance / r.components[0].variance;
        return (Math.abs(rate - expected) < 1e-3 && allChecks(r)) || `movement shrinks by ${rate} a step, the ratio of variances is ${expected}`;
      } },
    { name: 'points on one straight line: the first direction carries all the variance', input: { custom: [1, 1, 2, 3, 3, 5, 5, 9], start: 20 },
      check: (r) => {
        const [c1, c2] = r.components;
        if (Math.abs(c2.variance) > 1e-12 || Math.abs(r.share - 1) > 1e-12) return `second variance ${c2.variance}, share ${r.share}`;
        if (parallel(c1.direction, [1 / Math.sqrt(5), 2 / Math.sqrt(5)]) > 1e-9) return `first direction ${c1.direction} is not along the line of slope 2`;
        return perpendicular(r) === true && variancesAddUp(r) === true || 'directions or variances inconsistent';
      } },
    { name: 'a start exactly at right angles finds the directions in the wrong order, and they are swapped', input: { custom: [0, 0, 2, 0, 0, 1, 2, 1], start: 90 },
      check: (r) => {
        if (!r.swapped) return 'the components were not swapped';
        if (parallel(r.components[0].direction, [1, 0]) > 1e-12 || Math.abs(r.components[0].variance - 4 / 3) > 1e-12 || Math.abs(r.components[1].variance - 1 / 3) > 1e-12) return `components ${JSON.stringify(r.components)}`;
        const normal = quiet({ custom: [0, 0, 2, 0, 0, 1, 2, 1], start: 45 });
        return (!normal.swapped && allChecks(normal) === true && allChecks(r) === true) || 'the same points from a start of 45° disagree with the closed form';
      } },
    { name: 'the corners of a square have no principal direction: equal variances, any perpendicular pair', input: { custom: [1, 1, -1, 1, -1, -1, 1, -1], start: 35 },
      check: (r) => (r.round && Math.abs(r.components[0].variance - 4 / 3) < 1e-12 && Math.abs(r.components[1].variance - 4 / 3) < 1e-12 && perpendicular(r) === true && variancesAddUp(r) === true) || `round ${r.round}, variances ${r.components.map((c) => c.variance)}` },
    { name: 'both features in millimetres: the same 45° direction and 80% share, with variances 400 and 100 (quiz prediction)', input: { custom: EXAMPLE_BOTH_MM, start: 0 },
      check: (r) => {
        const base = quiet({ custom: EXAMPLE, start: 0 });
        if (parallel(r.components[0].direction, base.components[0].direction) > 1e-9 || r.components[0].steps !== base.components[0].steps) return `direction ${r.components[0].direction} after ${r.components[0].steps} steps, against ${base.components[0].direction} after ${base.components[0].steps}`;
        if (Math.abs(r.components[0].variance - 100 * base.components[0].variance) > 1e-6 || Math.abs(r.share - base.share) > 1e-9) return `variance ${r.components[0].variance}, share ${r.share}`;
        return (Math.abs(r.cov[0] - 250) < 1e-9 && Math.abs(r.cov[1] - 150) < 1e-9 && Math.abs(r.cov[2] - 250) < 1e-9 && allChecks(r) === true) || `covariance ${r.cov}`;
      } },
    { name: 'x in millimetres: the first direction turns to within 4° of the x axis with over 99% of the variance (preset and "Things to try")', input: { custom: EXAMPLE_MM, start: 0 },
      check: (r) => {
        const degreesFromX = Math.atan2(Math.abs(r.components[0].direction[1]), Math.abs(r.components[0].direction[0])) * 180 / Math.PI;
        if (!(degreesFromX > 3 && degreesFromX < 4) || !(r.share > 0.99) || r.components[0].direction[0] * r.components[0].direction[1] <= 0) return `${degreesFromX}° from the x axis, share ${r.share}`;
        return (Math.abs(r.cov[0] - 250) < 1e-9 && Math.abs(r.cov[2] - 2.5) < 1e-9 && allChecks(r) === true) || `covariance ${r.cov}`;
      } },
    { name: 'the scores on the two directions are uncorrelated, and moving the whole cloud changes nothing', input: { points: 50, seed: 6, angle: 40, thickness: 0.4, start: 10 },
      check: (r) => {
        let cross = 0, s1 = 0, s2 = 0;
        for (let i = 0; i < r.n; i++) { cross += r.scores[i] * r.scores2[i]; s1 += r.scores[i]; s2 += r.scores2[i]; }
        if (Math.abs(cross / (r.n - 1)) > 1e-9 * r.total || Math.abs(s1) > 1e-9 || Math.abs(s2) > 1e-9) return `covariance of the two sets of scores ${cross / (r.n - 1)}, sums ${s1}, ${s2}`;
        const moved = quiet({ custom: r.points.flatMap((p) => [p[0] + 37, p[1] - 12]), start: 10 });
        if (parallel(moved.components[0].direction, r.components[0].direction) > 1e-7 || Math.abs(moved.components[0].variance - r.components[0].variance) > 1e-7) return 'shifting every point by the same amount changed the result';
        return allChecks(r);
      } },
    { name: 'presets: the nearly round cloud needs 29 multiplications for its first direction, the default 11', input: { points: 40, seed: 2, angle: 30, thickness: 0.8, start: 0 },
      check: (r) => {
        const base = quiet({});
        if (r.components[0].steps !== 29 || base.components[0].steps !== 11) return `${r.components[0].steps} and ${base.components[0].steps} steps`;
        const far = quiet({ start: 120 });
        if (!(far.changes[1] > far.changes[0]) || parallel(far.components[0].direction, base.components[0].direction) > 1e-7) return 'the start at 120° should move more on its second step than its first and end at the same direction';
        const thin = quiet({ thickness: 0.05 });
        return (thin.share > 0.99 && allChecks(r) === true && allChecks(far) === true) || `share for the thin cloud ${thin.share}`;
      } },
    { name: 'inputs with no spread are refused with a reason', input: {},
      check: () => {
        for (const custom of [[2, 3, 2, 3, 2, 3], [0, 0, 0, 0]]) {
          try { quiet({ custom }); return `identical points ${custom} were accepted`; } catch (e) { if (!/spread|same place/.test(e.message)) return `unexpected message: ${e.message}`; }
        }
        return true;
      } },
  ],
};
