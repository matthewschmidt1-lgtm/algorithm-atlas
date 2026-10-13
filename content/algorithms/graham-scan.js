import { makeRng } from '../../js/lib/rng.js';

// Every point on this page has whole-number coordinates, so the turn test below is exact:
// it never has to round, and three points in a straight line give exactly zero.
const W = 1600, H = 900;                    // lattice for generated points (scaled up for large n)
const QUIET = { count() {}, frame() {} };   // a tracer that records nothing, used by the tests

// Twice the signed area of triangle a, b, c. Positive: a → b → c turns left (counter-clockwise).
// Negative: it turns right. Zero: the three points are in a straight line.
const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

const DISTRIBUTIONS = [
  { value: 'uniform', label: 'Scattered evenly' },
  { value: 'clustered', label: 'In three clusters' },
  { value: 'circle', label: 'On a circle' },
  { value: 'grid', label: 'On a coarse grid (many in a line)' },
];

function makePoints(input) {
  const custom = input.custom || [];
  if (custom.length) {
    if (custom.length % 2) throw new Error('Your own points need an even count of numbers: x then y for each point.');
    if (custom.some((v) => !Number.isInteger(v))) throw new Error('Your own points must use whole numbers.');
    const pts = [];
    for (let i = 0; i < custom.length; i += 2) pts.push([custom[i], custom[i + 1]]);
    return { raw: pts, custom: true };
  }
  const n = Math.max(1, Math.floor(input.n));
  // Larger sets get a finer lattice, so that points on a circle stay in convex position after rounding.
  const k = n <= 60 ? 1 : Math.ceil((n / 60) ** 2);
  const w = W * k, h = H * k;
  const rng = makeRng((input.seed || 1) * 31 + 17);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pts = [];
  if (input.distribution === 'circle') {
    const r = 0.42 * h, turnBy = rng.float(0, (2 * Math.PI) / n);
    for (let i = 0; i < n; i++) {
      const a = turnBy + (2 * Math.PI * i) / n;
      pts.push([Math.round(w / 2 + r * Math.cos(a)), Math.round(h / 2 + r * Math.sin(a))]);
    }
  } else if (input.distribution === 'grid') {
    const spots = [];
    for (let c = 2; c <= 14; c++) for (let r = 1; r <= 8; r++) spots.push([c * 100 * k, r * 100 * k]);
    rng.shuffle(spots);
    pts.push(...spots.slice(0, n));
  } else if (input.distribution === 'clustered') {
    const centres = [0, 1, 2].map(() => [rng.float(0.25, 0.75) * w, rng.float(0.3, 0.7) * h]);
    for (let i = 0; i < n; i++) {
      const c = centres[i % 3];
      pts.push([Math.round(clamp(rng.normal(c[0], 0.11 * h), 0.04 * w, 0.96 * w)), Math.round(clamp(rng.normal(c[1], 0.11 * h), 0.06 * h, 0.94 * h))]);
    }
  } else {
    for (let i = 0; i < n; i++) pts.push([Math.round(rng.float(0.05, 0.95) * w), Math.round(rng.float(0.07, 0.93) * h)]);
  }
  return { raw: pts, custom: false, w, h };
}

function mergeSort(items, before) {
  if (items.length < 2) return items;
  const mid = items.length >> 1;
  const left = mergeSort(items.slice(0, mid), before), right = mergeSort(items.slice(mid), before);
  const out = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) out.push(before(right[j], left[i]) ? right[j++] : left[i++]);
  while (i < left.length) out.push(left[i++]);
  while (j < right.length) out.push(right[j++]);
  return out;
}

function run(input, t) {
  const made = makePoints(input);
  const seen = new Set();
  const all = made.raw.filter((p) => { const k = `${p[0]},${p[1]}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const dropped = made.raw.length - all.length;
  const n = all.length;
  if (n < 3) throw new Error('A hull needs at least three different points.');

  // Picture bounds.
  let bx, by;
  if (made.custom) {
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const pad = Math.max(1, 0.12 * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
    bx = [Math.min(...xs) - pad, Math.max(...xs) + pad]; by = [Math.min(...ys) - pad, Math.max(...ys) + pad];
  } else { bx = [0, made.w]; by = [0, made.h]; }
  const labelAll = n <= 32;
  const name = (i) => (made.custom ? `${i} at (${pts[i][0]}, ${pts[i][1]})` : `${i}`);

  // 1. The pivot: the lowest point, and the leftmost of those if several are equally low.
  let lowest = 0;
  for (let i = 1; i < n; i++) if (all[i][1] < all[lowest][1] || (all[i][1] === all[lowest][1] && all[i][0] < all[lowest][0])) lowest = i;
  const p0 = all[lowest];

  let pts = all;          // becomes the sorted order; index in pts is the label shown in the picture
  let sorted = false;
  const stack = [];       // labels
  const popped = [];      // labels, in the order they were removed
  let scanTests = 0, sortComparisons = 0;

  const legend = [{ label: 'pivot (lowest point)', role: 'special' }, { label: 'on the stack: hull so far', role: 'done' }, { label: 'the three points being tested', role: 'compare' }, { label: 'being popped', role: 'rejected' }, { label: 'popped earlier (hollow)', role: 'dim' }];
  const views = ({ test, verdict, rays, sweep, final } = {}) => {
    const layers = [];
    const onStack = new Set(stack), gone = new Set(popped);
    const chain = stack.map((i) => pts[i]);
    if (final) layers.push({ type: 'polygon', points: chain, role: 'forest', fill: true, width: 2.4 });
    if (rays) layers.push({ type: 'segments', segments: pts.filter((p) => p !== p0).map((p) => [p0[0], p0[1], p[0], p[1]]), role: 'faint', width: 1, alpha: 0.45 });
    if (sweep !== undefined) layers.push({ type: 'line', points: [p0, pts[sweep]], role: 'faint', width: 1, dash: [3, 5] });
    if (!final && chain.length > 1) layers.push({ type: 'line', points: chain, role: 'forest', width: 2.4 });
    if (test) layers.push({ type: 'segments', segments: [[...pts[test[0]], ...pts[test[1]]], [...pts[test[1]], ...pts[test[2]]]], role: verdict === 'pop' ? 'rejected' : 'active', width: 2.4, arrow: true });
    const inTest = new Set(test || []);
    const dot = (i, extra) => ({ x: pts[i][0], y: pts[i][1], label: sorted && (labelAll || onStack.has(i) || inTest.has(i)) ? String(i) : undefined, ...extra });
    const waiting = [], hollow = [], solid = [];
    for (let i = 0; i < n; i++) {
      const isPivot = sorted ? i === 0 : pts[i] === p0;
      if (inTest.has(i)) solid.push(dot(i, { role: verdict === 'pop' && i === test[1] ? 'rejected' : 'compare', r: 5.5 }));
      else if (isPivot && (sorted || rays !== undefined || final)) solid.push(dot(i, { role: 'special', r: 5.5 }));
      else if (onStack.has(i)) solid.push(dot(i, { role: 'done', r: 4.6 }));
      else if (gone.has(i) || final) hollow.push(dot(i, {}));
      else waiting.push(dot(i, {}));
    }
    layers.push({ type: 'points', points: waiting, role: 'muted', r: 3.4 });
    layers.push({ type: 'points', points: hollow, role: 'dim', r: 3.4, hollow: true });
    layers.push({ type: 'points', points: solid, role: 'done' });
    const cell = (i) => ({ t: String(i), role: test && verdict === 'pop' && i === test[1] ? 'rejected' : test && verdict === 'push' && i === test[2] ? 'active' : i === 0 ? 'special' : 'done' });
    return [
      { kind: 'scene', title: final ? 'The convex hull' : 'Points and the hull so far', x: [bx[0] - 0.05 * (bx[1] - bx[0]), bx[1] + 0.05 * (bx[1] - bx[0])], y: [by[0] - 0.05 * (by[1] - by[0]), by[1] + 0.05 * (by[1] - by[0])],
        aspect: 0.56, equal: true, axes: false, layers, legend },
      { kind: 'rows', title: 'The stack, bottom first', rows: [
        { label: 'Stack', cells: stack.map(cell) },
        { label: 'Popped', cells: popped.map((i) => ({ t: String(i), role: 'dim' })) },
      ] },
    ];
  };

  t.frame(() => ({
    line: 0,
    note: `Here are ${n} points${dropped ? ` (${dropped} repeated point${dropped === 1 ? ' was' : 's were'} dropped)` : ''}. The goal is their **convex hull**: the outline a rubber band would make if it were stretched around all of them and let go.`,
    views: views(),
    vars: { points: n },
  }));
  t.frame(() => ({
    line: 1,
    note: `Find the lowest point${made.custom ? `, (${p0[0]}, ${p0[1]})` : ''}. Nothing lies below it, so it must be a corner of the hull. It becomes the **pivot**, the fixed point everything else is measured from. If two points were equally low, the one further left would be taken.`,
    views: views({ rays: false }),
    vars: { points: n },
  }));

  // 2. Sort the other points by direction as seen from the pivot, counter-clockwise from the right.
  const before = (a, b) => {
    sortComparisons++;
    t.count('sort comparisons');
    const s = turn(p0, a, b);
    if (s !== 0) return s > 0;
    return dist2(p0, a) < dist2(p0, b);     // same direction: the nearer point comes first
  };
  pts = [p0].concat(mergeSort(all.filter((p) => p !== p0), before));
  sorted = true;
  t.frame(() => ({
    line: [2, 3],
    note: `Sort the other points by direction as seen from the pivot, sweeping counter-clockwise from the right. The labels 1 to ${n - 1} show that order, and the pivot is point 0. The sort took ${sortComparisons} comparisons. Each one is a turn test on the pivot and two points, so no angle is ever calculated.`,
    views: views({ rays: true }),
    vars: { points: n, 'sorted order': `1 to ${n - 1}` },
  }));

  // 3. The scan.
  stack.push(0);
  t.frame(() => ({
    line: 4,
    note: 'Start the stack with the pivot. The stack will always hold the corners of the hull of the points visited so far, in counter-clockwise order.',
    views: views({ rays: false }),
    vars: { 'stack size': 1 },
  }));
  for (let c = 1; c < n; c++) {
    for (;;) {
      if (stack.length < 2) {
        stack.push(c);
        t.frame(() => ({
          line: [5, 9],
          note: `Only the pivot is on the stack, so there is no corner to test yet. Push point ${name(c)}.`,
          views: views({ sweep: c }),
          vars: { c, 'stack size': stack.length },
        }));
        break;
      }
      const a = stack[stack.length - 2], b = stack[stack.length - 1];
      const s = turn(pts[a], pts[b], pts[c]);
      scanTests++;
      t.count('orientation tests');
      if (s > 0) {
        stack.push(c);
        t.frame(() => ({
          line: [6, 7, 9],
          note: `Go from point ${name(a)} to point ${name(b)}, then on to point ${name(c)}. That is a **left turn** (turn value ${s}, above zero), so ${b} still looks like a corner. Push ${c} onto the stack.`,
          views: views({ test: [a, b, c], verdict: 'push', sweep: c }),
          vars: { a, b, c, 'turn value': s, 'stack size': stack.length },
        }));
        break;
      }
      t.frame(() => ({
        line: [6, 7, 8],
        note: s < 0
          ? `Go from point ${name(a)} to point ${name(b)}, then on to point ${name(c)}. That is a **right turn** (turn value ${s}, below zero). A hull never turns right, so ${b} is inside the triangle made by the pivot, ${a} and ${c}. Pop ${b} and test again.`
          : `Points ${name(a)}, ${name(b)} and ${name(c)} are in a **straight line** (turn value exactly 0). Point ${b} lies between the other two, so it is on an edge, not at a corner. This lesson keeps corners only: pop ${b} and test again.`,
        views: views({ test: [a, b, c], verdict: 'pop', sweep: c }),
        vars: { a, b, c, 'turn value': s, 'stack size': stack.length },
      }));
      popped.push(stack.pop());
    }
  }

  const degenerate = stack.length < 3;
  t.frame(() => ({
    line: 10,
    note: degenerate
      ? `Every point lies on one straight line, so there is no area to enclose. The "hull" is the segment between its two ends, points ${stack.join(' and ')}.`
      : `The sweep is complete. The stack holds the **${stack.length} corners** of the hull in counter-clockwise order: ${stack.join(', ')}. The other ${n - stack.length} points are inside it or on its edges. The scan made ${scanTests} turn tests for ${n} points, fewer than two per point.`,
    views: views({ final: true }),
    vars: { points: n, corners: stack.length, popped: popped.length },
  }));

  return { points: pts, hull: stack.slice(), hullPoints: stack.map((i) => pts[i]), n, dropped, popped: popped.length, scanTests, sortComparisons, degenerate };
}

/* ---- independent checks for the tests ---- */

// Gift wrapping (Jarvis march): no sort and no stack. From each corner, pick the point that has
// every other point on its left, taking the farthest when several are in line.
function giftWrap(pts) {
  const n = pts.length;
  let start = 0;
  for (let i = 1; i < n; i++) if (pts[i][1] < pts[start][1] || (pts[i][1] === pts[start][1] && pts[i][0] < pts[start][0])) start = i;
  const hull = [];
  let cur = start;
  do {
    hull.push(pts[cur]);
    let next = cur === 0 ? 1 : 0;
    for (let j = 0; j < n; j++) {
      if (j === cur || j === next) continue;
      const s = turn(pts[cur], pts[next], pts[j]);
      if (s < 0 || (s === 0 && dist2(pts[cur], pts[j]) > dist2(pts[cur], pts[next]))) next = j;
    }
    cur = next;
  } while (cur !== start && hull.length <= n);
  return hull;
}

function checkHull(r) {
  const h = r.hullPoints, m = h.length;
  if (r.degenerate) return r.points.every((p) => turn(h[0], h[1], p) === 0) || 'reported a degenerate hull for points that are not all in line';
  for (let i = 0; i < m; i++) {
    const a = h[i], b = h[(i + 1) % m], c = h[(i + 2) % m];
    if (turn(a, b, c) <= 0) return `corners ${i}, ${i + 1}, ${i + 2} do not make a strict left turn`;
    for (const p of r.points) if (turn(a, b, p) < 0) return `point (${p[0]}, ${p[1]}) is outside edge ${i}`;
  }
  const ref = giftWrap(r.points);
  if (ref.length !== m || ref.some((p, i) => p[0] !== h[i][0] || p[1] !== h[i][1])) return `gift wrapping found ${ref.length} corners, the scan found ${m}`;
  if (r.scanTests > 2 * r.n) return `the scan used ${r.scanTests} turn tests for ${r.n} points`;
  return true;
}

export default {
  meta: {
    id: 'graham-scan',
    name: 'Graham Scan',
    aliases: ['Graham\'s scan', 'convex hull', 'convex hull algorithm', 'rubber band algorithm'],
    kind: 'algorithm',
    discipline: 'computational-geometry',
    alsoIn: [
      { id: 'computer-graphics', why: 'A convex hull is a common stand-in for a complicated shape when testing what overlaps or what could be visible.' },
      { id: 'robotics', why: 'Planners and simulators often replace a robot part or an obstacle by the convex hull of its points, because convex shapes are simpler to test for collision.' },
      { id: 'algorithms', why: 'It is a sort followed by one pass with a stack, and a standard example of amortized analysis.' },
    ],
    subfield: 'Convex hulls',
    family: 'Planar convex hull algorithms',
    lab: 'geometry',
    year: 1972,
    authors: 'Ronald L. Graham',
    summary: 'Finds the convex hull of points in the plane: sort them by angle around the lowest point, then sweep once, discarding every point that would make a right turn.',
    difficulty: 'intermediate',
    order: 910,
    paradigms: ['incremental'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', class: 'linearithmic' },
    space: { worst: 'O(n)', class: 'linear' },
    tags: {
      problems: ['convex hull', 'outline of a set of points', 'smallest shape around points', 'rubber band around nails', 'outermost points', 'boundary of a point cloud'],
      techniques: ['angular sort', 'orientation test', 'cross product', 'stack', 'sweep'],
      applications: ['computer graphics', 'robotics', 'games', 'image processing', 'statistics'],
    },
    prerequisites: ['concept:stack', 'merge-sort', 'concept:invariant', 'concept:big-o'],
  },

  bigIdea: {
    simple: "Hammer some nails into a board. Now stretch a rubber band around all of them and let go. It snaps tight against the outermost nails and ignores the rest. That outline is called the convex hull. Convex means it has no dents. A computer has no rubber band, so it needs a method. Graham scan starts at the lowest nail, which must be on the outline. It then visits the other nails in order, sweeping around like a clock hand running backwards. It joins each nail to the one before, as if drawing the outline. After each new nail it checks the last corner it drew. If the path bends left there, fine. If it bends right, that corner is a dent, so the nail there cannot be on the outline. The nail is dropped, and the corner before it is checked again. When the sweep ends, the nails still kept are the corners of the rubber band's shape.",
    what: 'The convex hull of a set of points is the smallest convex shape that contains them all. Graham scan finds its corners in three stages. It picks the lowest point as a **pivot**. It sorts the other points by the direction in which they are seen from the pivot. Then it walks through them once, keeping a stack of the corners found so far and removing the top of the stack whenever the last three points fail to make a left turn.',
    why: 'Ronald Graham published the method in 1972, while at Bell Laboratories. Joseph O\'Rourke\'s textbook *Computational Geometry in C* recounts that an application there needed the hull of about ten thousand points, and that the method then in use, whose running time grew with the square of the number of points, was too slow. Graham\'s scan brought the cost down to that of sorting.',
    when: 'Use it for the hull of a fixed set of points in the plane when a worst-case bound of n log n matters and exact arithmetic on the coordinates is available. If very few points end up on the hull, gift wrapping or an output-sensitive algorithm can be faster. If points arrive one at a time, or the problem is in three dimensions, a different algorithm is needed.',
    interesting: 'The scan has a loop inside a loop, which usually signals quadratic time. Here it does not: each point is pushed onto the stack once and popped at most once, so the whole sweep makes fewer than two turn tests per point. All the real cost is in the sort, which can be any n log n method such as [merge sort](#/algorithm/merge-sort). It is also a rare geometric algorithm that needs no trigonometry and no division, only the sign of one small expression.',
    where: 'Convex hulls are a building block more often than an end in themselves. They serve as simplified collision shapes, as the first step in finding the two farthest points or the smallest enclosing rectangle of a set, and as the "minimum convex polygon" used by ecologists to outline where an animal has been seen.',
    analogy: {
      title: 'A rubber band around nails',
      text: 'Nails stand in a board, one for each point. Stretch a rubber band wide enough to surround them all and let go. It pulls in until it is stopped by the outermost nails, and it ends up as a polygon with straight sides and no dents. The nails it bends around are the corners of the convex hull. Nails in the middle never touch it.',
      limits: 'The band finds the whole outline at once, by physics. A computer has only a list of coordinates and must examine points a few at a time, which is why the sort and the stack are needed. A real band also rests against nails that happen to stand along a straight side, between two corners. This lesson\'s algorithm reports only the corners and leaves those out. Real nails have thickness and a real band has stretch; points have neither. And the picture is flat. In three dimensions the hull is more like shrink-wrap pulled over the points, and this scan does not carry over, because there is no single order in which to sweep around.',
    },
  },

  example: {
    setup: "Five nails stand at (0, 0), (4, 1), (3, 2), (4, 4) and (1, 3). The lowest is (0, 0), so start there. Seen from it, sweeping counter-clockwise from the right, the others come in the order (4, 1), (3, 2), (4, 4), (1, 3). Keep a pile of the points that currently look like corners. This pile is called a stack: you only ever add to its top or remove from its top.",
    steps: [
      "Put (0, 0) on the stack, then (4, 1). With fewer than two points on the stack there is no corner to check yet.",
      "Next is (3, 2). Walk from (0, 0) to (4, 1) and on to (3, 2): you turn left. Left turns are fine, so add (3, 2). The stack is (0, 0), (4, 1), (3, 2).",
      "Next is (4, 4). Walk from (4, 1) to (3, 2) and on to (4, 4): you turn right. So (3, 2) sits in a dent. Remove it from the stack.",
      "Check again with the new top two. From (0, 0) to (4, 1) and on to (4, 4) is a left turn, so add (4, 4).",
      "Last is (1, 3). From (4, 1) to (4, 4) and on to (1, 3) is a left turn, so add it.",
    ],
    result: "The hull is (0, 0), (4, 1), (4, 4), (1, 3), in counter-clockwise order. The point (3, 2) is inside it. The sweep made 4 turn checks for 5 points, and each check looked only at the newest point and the top two of the stack.",
    tryInput: { custom: [0, 0, 4, 1, 3, 2, 4, 4, 1, 3] },
  },

  terms: [
    { term: "Convex", meaning: "A shape with no dents: the straight line between any two points of the shape stays inside it." },
    { term: "Convex hull", meaning: "The smallest convex shape that contains a given set of points. Its corners are some of the points themselves." },
    { term: "Pivot", meaning: "The fixed point the algorithm measures directions from. Here it is the lowest point." },
    { term: "Counter-clockwise", meaning: "The direction opposite to the way a clock's hands move. The hull's corners are listed in this order." },
    { term: "Left turn, right turn", meaning: "Walking from a first point to a second and on to a third, you either swing to your left, swing to your right, or go straight on." },
    { term: "Turn test", meaning: "A short calculation on three points whose sign says whether they make a left turn, a right turn or a straight line. Also called an orientation test." },
    { term: "Stack", meaning: "A pile of items where you can only add to the top or take from the top." },
    { term: "Collinear", meaning: "Lying on one straight line. Three collinear points make no turn at all." },
  ],

  takeaway: "Start at the lowest point, sweep around the others in order, and throw away any point where the outline would bend to the right.",

  viz: {
    describe: 'A scatter of points. The pivot, the lowest point, is drawn in ink. After sorting, each point carries a number giving its order around the pivot. Points on the stack are forest green and joined by a green line, the hull so far. The three points in the current turn test are ochre, joined by arrows that are terracotta for a left turn and brick red for a right turn or straight line. Popped points become hollow grey circles. A dashed line from the pivot shows the direction of the sweep. At the end the hull is a filled green polygon. Below, two rows list the stack from bottom to top and the points popped so far.',
    inputs: [
      { id: 'n', type: 'range', label: 'Number of points', min: 3, max: 60, step: 1, default: 18 },
      { id: 'distribution', type: 'select', label: 'How the points are spread', options: DISTRIBUTIONS, default: 'uniform' },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 7 },
      { id: 'custom', type: 'list', label: 'Your own points (optional)', default: [], maxLength: 120, min: 0, max: 100, integer: true, placeholder: 'e.g. 0 0, 4 1, 3 2, 4 4, 1 3',
        help: 'Whole numbers from 0 to 100, written as x then y for each point. Leave empty to use random points.' },
    ],
    presets: [
      { label: 'Scattered points', values: { n: 18, distribution: 'uniform', seed: 7, custom: [] } },
      { label: 'Three clusters', values: { n: 30, distribution: 'clustered', seed: 4, custom: [] } },
      { label: 'On a circle: nothing is popped', values: { n: 16, distribution: 'circle', seed: 2, custom: [] } },
      { label: 'Coarse grid: points in a line', values: { n: 24, distribution: 'grid', seed: 3, custom: [] } },
      { label: 'Worked example', values: { custom: [0, 0, 4, 1, 3, 2, 4, 4, 1, 3] } },
      { label: 'Square with points on its sides', values: { custom: [0, 0, 2, 0, 4, 0, 4, 2, 4, 4, 2, 4, 0, 4, 0, 2, 2, 2] } },
    ],
    tryThis: [
      'Load "Scattered points" and watch the stack row. Most points are pushed and later popped. Count how often a single new point causes two or three pops in a row: that is the inner loop at work.',
      'Load "On a circle: nothing is popped". Every turn is a left turn, so every point stays. This is the case with the most corners, and yet the scan does the least work: one turn test per point.',
      'Load "Square with points on its sides". Points 1, 3, 6 and 7 lie on the edges, between corners. Points 1, 3 and 6 are popped with a turn value of exactly 0, and point 7 by a right turn when the farther corner 8 arrives. This lesson reports corners only.',
      'Set the spread to "Scattered evenly" and move the number of points from 20 to 60. The number of corners grows only slowly, while the number of popped points grows almost as fast as the number of points.',
    ],
    run,
    report: (r, c) => `${r.degenerate ? 'All points are in one line: the hull is a segment.' : `Convex hull of ${r.n} points: ${r.hull.length} corners, counter-clockwise from the lowest point.`}\nCorners (labels in sorted order): ${r.hull.join(', ')}\n${c['sort comparisons'] || 0} comparisons to sort, then ${c['orientation tests'] || 0} turn tests and ${r.popped} pops in the scan.`,
    experiment: {
      title: 'Turn tests in the scan as the point set grows',
      note: 'Each point on the chart is a real run counting only the turn tests made by the scan, after sorting. Scattered points use almost two tests per point, because nearly every point is pushed and later popped. Points on a circle use exactly one each, because nothing is popped. Sorting costs about n log₂ n further comparisons and is the larger part of the work.',
      metric: 'orientation tests',
      metricLabel: 'Turn tests in the scan',
      sizeLabel: 'Number of points (n)',
      sizes: [16, 32, 64, 128, 256, 512, 1024, 2048],
      variants: [
        { id: 'uniform', label: 'Scattered evenly' },
        { id: 'circle', label: 'On a circle' },
      ],
      input: (n, variant, seed) => ({ n, distribution: variant, seed, custom: [] }),
      theory: [
        { label: '2n (upper bound)', fn: (n) => 2 * n, variant: 'uniform' },
        { label: 'n − 2 (no pops)', fn: (n) => n - 2, variant: 'circle' },
      ],
    },
  },

  logic: {
    intuition: 'Walk around a convex shape counter-clockwise and you turn left at every corner. So a corner where the path turns right, or does not turn, cannot belong to the hull. If the points are visited in order of direction around a point known to be on the hull, the outline can be drawn as you go, and any corner that fails the left-turn test can be erased the moment a later point exposes it. Erasing one corner may expose the one before it, which is why the test is repeated.',
    steps: [
      'Find the lowest point, taking the leftmost if several are equally low. This is the pivot `p0`. It is certainly a corner of the hull.',
      'Sort the other points by direction as seen from `p0`, counter-clockwise. To compare two points, apply the turn test to `p0` and the pair. If two points lie in exactly the same direction, put the nearer one first.',
      'Start a stack containing only `p0`.',
      'Take the next point `c` in sorted order. While the stack holds at least two points and the top two together with `c` do not make a left turn, pop the top of the stack.',
      'Push `c` onto the stack and go back to step 4 until no points remain.',
      'The stack now holds the corners of the hull in counter-clockwise order.',
    ],
    pseudocode: [
      'graham_scan(points):',
      '  p0 ← the lowest point',
      '  sort the rest by angle at p0',
      '    (ties: nearer first)',
      '  stack ← [p0]',
      '  for each c in sorted order:',
      '    while size(stack) ≥ 2 and',
      '      turn(below, top, c) ≤ 0:',
      '      pop the stack',
      '    push c',
      '  return stack',
      '',
      'turn(a, b, c):',
      '  return (b−a) × (c−a)',
    ],
    decisions: [
      { title: 'How are three points in a line treated?', text: 'The turn value is exactly zero. This lesson pops on zero as well as on negative values, so the result contains only true corners, and points lying along an edge are left out. Among points in the same direction from the pivot, the nearer is sorted first so that the farther one, arriving later, removes it. Keeping edge points instead is possible but needs more care: the points on the final edge back to the pivot must then be visited farthest first.' },
      { title: 'How are directions compared without angles?', text: 'Point `a` comes before point `b` when `p0`, `a`, `b` make a left turn. Because the pivot is the lowest point, every other point lies in the half-plane above it, and within a half-plane this rule is a consistent ordering. No arctangent is needed, and with whole-number coordinates the comparison is exact.' },
      { title: 'Which point is the pivot?', text: 'Any point certain to be on the hull would do. The lowest point is the usual choice because it also guarantees that all directions fall within half a turn, which is what makes the turn test a valid way to sort.' },
    ],
    invariants: [
      'After each point is pushed, the stack holds the corners of the convex hull of the pivot and all points visited so far, in counter-clockwise order.',
      'Any three consecutive points on the stack make a strict left turn.',
      'The pivot is never popped, and each other point is pushed exactly once and popped at most once.',
    ],
    edgeCases: [
      'Three or more points in a straight line along a hull edge: the middle ones are popped, and only the two ends are reported.',
      'Several points in the same direction from the pivot: the nearer ones are sorted first and are popped when the farthest arrives.',
      'All points in one straight line: the stack ends with only the two end points. There is no polygon, and this page says so.',
      'Repeated points: this page removes duplicates before starting. Left in, a duplicate gives a turn value of zero and is popped.',
      'Fewer than three different points: there is no hull to compute, and the run stops with a message.',
      'Coordinates with fractional parts: the turn value can come out with the wrong sign when three points are almost in line, which can produce a dented or incomplete hull. See the implementation notes.',
    ],
    correctness: 'Claim: after point `c` is pushed, the stack is the hull of the pivot and all points up to `c`. It holds trivially for the first two points. Suppose it holds before `c` is processed. The new point `c` comes last in the angular order, so no earlier point lies beyond the ray from the pivot through `c`, and `c` is a corner of the new hull, or is collinear with the pivot and replaces a nearer point as the corner. Now let `a` and `b` be the top two points of the stack. If `a`, `b`, `c` do not make a left turn, then `b` lies on or inside the segment from `a` to `c` as seen from the pivot. Its direction is between those of `a` and `c`, so `b` is inside or on the boundary of the triangle formed by the pivot, `a` and `c`, and cannot be a corner. Popping it is safe, and the argument repeats with the new top. When the loop stops, every consecutive triple on the stack, including the one ending in `c`, turns left, and all turns are taken in increasing angular order around a point of the hull, so the stack is a convex polygon containing every point visited. That is the hull.',
    mistakes: [
      'Using `if` where the algorithm needs `while`: one new point can expose several earlier points as non-corners, and all of them must go.',
      'Sorting by an angle computed with `atan2` on floating-point numbers, then being surprised by ties and near-ties in the order.',
      'Breaking angle ties the wrong way round, so that a nearer collinear point survives on the first or last edge.',
      'Popping on a strict right turn only, without deciding what should happen to collinear points.',
      'Forgetting to guard the stack size, and reading two points from a stack that holds only the pivot.',
    ],
  },

  code: {
    sample: {
      input: 'Ten points: (1,1) (5,1) (9,1) (7,3) (9,5) (6,7) (3,6) (1,4) (4,3) (5,4). Three of them lie in a line along the bottom edge.',
      expected: 'hull: (1,1) (9,1) (9,5) (6,7) (3,6) (1,4)\n6 corners from 10 points',
    },
    python: {
      source: `from functools import cmp_to_key


def turn(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def graham_scan(points):
    p0 = min(points, key=lambda p: (p[1], p[0]))
    rest = [p for p in points if p != p0]

    def by_angle(a, b):
        t = turn(p0, a, b)
        if t != 0:
            return -1 if t > 0 else 1
        da = (a[0] - p0[0]) ** 2 + (a[1] - p0[1]) ** 2
        db = (b[0] - p0[0]) ** 2 + (b[1] - p0[1]) ** 2
        return da - db

    rest.sort(key=cmp_to_key(by_angle))
    stack = [p0]
    for c in rest:
        while len(stack) >= 2 and turn(stack[-2], stack[-1], c) <= 0:
            stack.pop()
        stack.append(c)
    return stack


points = [(1, 1), (5, 1), (9, 1), (7, 3), (9, 5), (6, 7), (3, 6), (1, 4), (4, 3), (5, 4)]
hull = graham_scan(points)
print("hull: " + " ".join(f"({x},{y})" for x, y in hull))
print(f"{len(hull)} corners from {len(points)} points")`,
      notes: [
        { line: 5, text: 'The turn test. It is twice the signed area of the triangle a, b, c: positive for a left turn, negative for a right turn, zero when the three points are in line.' },
        { line: 9, text: 'The pivot is the lowest point. Comparing (y, x) pairs breaks ties in favour of the leftmost.' },
        { line: 13, text: 'Directions are compared with the turn test itself, so no angle is ever computed.' },
        { line: 18, text: 'Two points in the same direction from the pivot: the nearer one sorts first, so the farther one can remove it later.' },
        { line: 23, text: 'The scan. `<= 0` pops on a right turn and on a straight line, which keeps corners only.' },
      ],
    },
    javascript: {
      source: `function turn(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function grahamScan(points) {
  let p0 = points[0];
  for (const p of points) {
    if (p[1] < p0[1] || (p[1] === p0[1] && p[0] < p0[0])) p0 = p;
  }
  const rest = points.filter((p) => p !== p0);
  rest.sort((a, b) => {
    const t = turn(p0, a, b);
    if (t !== 0) return t > 0 ? -1 : 1;
    const da = (a[0] - p0[0]) ** 2 + (a[1] - p0[1]) ** 2;
    const db = (b[0] - p0[0]) ** 2 + (b[1] - p0[1]) ** 2;
    return da - db;
  });
  const stack = [p0];
  for (const c of rest) {
    while (stack.length >= 2 && turn(stack[stack.length - 2], stack[stack.length - 1], c) <= 0) {
      stack.pop();
    }
    stack.push(c);
  }
  return stack;
}

const points = [[1, 1], [5, 1], [9, 1], [7, 3], [9, 5], [6, 7], [3, 6], [1, 4], [4, 3], [5, 4]];
const hull = grahamScan(points);
console.log("hull: " + hull.map(([x, y]) => "(" + x + "," + y + ")").join(" "));
console.log(hull.length + " corners from " + points.length + " points");`,
    },
    cpp: {
      source: `#include <algorithm>
#include <iostream>
#include <vector>

struct Point { long long x, y; };

long long turn(const Point& a, const Point& b, const Point& c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

std::vector<Point> grahamScan(std::vector<Point> pts) {
    auto lowest = std::min_element(pts.begin(), pts.end(), [](const Point& a, const Point& b) {
        return a.y < b.y || (a.y == b.y && a.x < b.x);
    });
    std::swap(pts[0], *lowest);
    const Point p0 = pts[0];
    std::sort(pts.begin() + 1, pts.end(), [&](const Point& a, const Point& b) {
        long long t = turn(p0, a, b);
        if (t != 0) return t > 0;
        long long da = (a.x - p0.x) * (a.x - p0.x) + (a.y - p0.y) * (a.y - p0.y);
        long long db = (b.x - p0.x) * (b.x - p0.x) + (b.y - p0.y) * (b.y - p0.y);
        return da < db;
    });
    std::vector<Point> stack = {p0};
    for (std::size_t i = 1; i < pts.size(); ++i) {
        while (stack.size() >= 2 && turn(stack[stack.size() - 2], stack.back(), pts[i]) <= 0) {
            stack.pop_back();
        }
        stack.push_back(pts[i]);
    }
    return stack;
}

int main() {
    std::vector<Point> points = {{1, 1}, {5, 1}, {9, 1}, {7, 3}, {9, 5}, {6, 7}, {3, 6}, {1, 4}, {4, 3}, {5, 4}};
    std::vector<Point> hull = grahamScan(points);
    std::cout << "hull:";
    for (const Point& p : hull) std::cout << " (" << p.x << "," << p.y << ")";
    std::cout << "\\n" << hull.size() << " corners from " << points.size() << " points\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Finding the pivot takes one pass. Sorting takes about n log₂ n comparisons. The scan then makes fewer than 2n turn tests in total, however the points are arranged. So the sort decides the running time: n log n in every case.',
    cases: [
      { case: 'Every input', time: 'O(n log n)', when: 'The sort dominates. The arrangement of the points changes the scan\'s work by at most a factor of two and the sort\'s work not at all in order of growth.' },
      { case: 'Scan alone', time: 'O(n)', when: 'Each point is pushed once and popped at most once, so the scan makes at most 2n − 2 − h turn tests, where h is the number of corners.' },
      { case: 'Points already sorted by angle', time: 'O(n)', when: 'If the order around the pivot is known in advance, only the scan is needed.' },
    ],
    space: 'O(n): the sorted list and the stack, which can hold every point when all of them are corners.',
    memory: 'The scan reads the sorted points once from start to end and touches only the top of the stack, so its memory access is sequential. The sort can be done in place.',
    tradeoffs: 'Graham scan always pays for a full sort, even when the hull has only three or four corners. Gift wrapping costs n per corner, which is better when corners are few and far worse when they are many. Output-sensitive algorithms reach n log h but are more complicated.',
    assumptions: [
      'The turn test takes constant time and returns the correct sign. With whole-number coordinates of bounded size, as on this page, it is exact.',
      'Sorting is done by comparisons, about n log₂ n of them.',
      'No faster method exists in general: an algorithm that returns hull corners in order can be used to sort numbers, so in models of computation where sorting needs n log n steps, so does the hull.',
      'The chart on this page counts turn tests in the scan only. It is not a measurement of time.',
    ],
  },

  tradeoffs: {
    excels: [
      'The hull of a fixed set of points in the plane with a guaranteed n log n bound.',
      'Inputs where many points are corners, such as points near a circle.',
      'Settings with exact integer or rational coordinates, where the turn test is reliable.',
      'Teaching: the whole algorithm is one sort and one loop with a stack.',
    ],
    struggles: [
      'Three or more dimensions. There is no angular order to sweep, and other algorithms are used.',
      'Points that arrive or disappear over time. The scan needs the whole set sorted before it starts.',
      'Hulls with very few corners among very many points, where output-sensitive algorithms do less work.',
      'Floating-point coordinates with nearly collinear points, unless the turn test is made robust.',
    ],
    pitfalls: [
      'A turn test that returns the wrong sign because of rounding or integer overflow. The product of two coordinate differences needs twice as many bits as a coordinate.',
      'Inconsistent treatment of collinear points between the sort and the scan.',
      'Assuming the output starts at a particular corner or runs clockwise. This version starts at the lowest point and runs counter-clockwise.',
    ],
    misunderstandings: [
      "\"The scan is slow because it has a loop inside a loop.\" The inner loop removes points, and each point can be removed only once. Over the whole run it makes fewer than two tests per point.",
      "\"The algorithm measures angles.\" It never computes an angle. It only asks, for three points, whether the path through them turns left or right, which takes two multiplications and a subtraction.",
      "\"Every point on the boundary of the hull is reported.\" This version reports corners only. A point lying on a straight edge between two corners is on the boundary but is left out.",
      "\"The hull is the outline of the points.\" It is the convex outline. A set of points shaped like the letter C has a hull that bridges straight across the opening.",
    ],
    constraints: [
      'Real coordinate data is usually floating point. Libraries either use exact or adaptive-precision predicates for the turn test or accept occasional errors on nearly collinear input.',
      'Many libraries implement the monotone chain variant, which sorts by coordinates instead of by angle and avoids the pivot altogether.',
    ],
    alternatives: [
      { name: 'Andrew\'s monotone chain', when: 'You want the same n log n scan with a simpler sort: order by x, then build the lower and upper halves of the hull separately.' },
      { name: 'Gift wrapping (Jarvis march)', when: 'The hull has few corners. It takes time proportional to n times the number of corners and needs no sort.' },
      { name: 'Quickhull', when: 'You want something fast on typical data, or you need three dimensions. Its worst case is quadratic.' },
      { name: 'Chan\'s algorithm', when: 'You need the best possible bound, n log h for h corners, and accept a more intricate method.' },
    ],
    comparison: {
      columns: ['', 'Graham scan', 'Gift wrapping', 'Monotone chain'],
      rows: [
        ['Time', 'O(n log n)', 'O(n · h)', 'O(n log n)'],
        ['Sort', 'By angle around a pivot', 'None', 'By x, then y'],
        ['Best when', 'Many corners, or a guarantee is needed', 'Very few corners', 'A simple, robust implementation is wanted'],
        ['Works in 3D', 'No', 'Yes, with changes', 'No'],
      ],
    },
  },

  applications: [
    { title: 'Convex hull operations in geometry libraries', status: 'established', text: 'Geometry libraries offer the convex hull as a standard operation on point sets and shapes. The JTS Topology Suite documents its implementation as a Graham scan; many others use the closely related monotone chain.' },
    { title: 'Simplified collision shapes', status: 'established', text: 'Testing two convex shapes for overlap is much simpler than testing arbitrary ones, so physics engines and motion planners often replace an object by the convex hull of its points. In the plane a scan like this one computes it. In three dimensions other algorithms, such as Quickhull, do the job.' },
    { title: 'A first step for other geometric questions', status: 'established', text: 'The two points of a set that are farthest apart are always hull corners, and the smallest rectangle enclosing a set always has a side along a hull edge. Algorithms for both problems compute the hull first and then walk around it.' },
    { title: 'Outlining where an animal lives', status: 'established', text: 'Ecologists estimate an animal\'s home range with the "minimum convex polygon": the convex hull of all the places where it was observed. It is simple and widely reported, and it is known to overestimate the range when a few sightings are far from the rest.' },
    { title: 'Peeling a data set from the outside in', status: 'illustrative', text: 'Remove the hull corners, take the hull of what is left, and repeat. The layers order the points from outermost to innermost, which gives one way to pick out unusual points in two-dimensional data.' },
  ],

  connections: [
    { to: 'concept:stack', type: 'prerequisite', why: 'The hull so far is kept on a stack because only its most recent corner can be invalidated by the next point, so all changes happen at one end.' },
    { to: 'merge-sort', type: 'prerequisite', why: 'The scan needs the points in angular order, and any n log n comparison sort supplies it. The sort is where almost all the running time goes.' },
    { to: 'concept:invariant', type: 'prerequisite', why: 'Correctness rests on one loop invariant: the stack is always the hull of the points visited so far.' },
    { to: 'concept:amortized-analysis', type: 'related', why: 'One step of the scan may pop many points, but each point is popped at most once overall. Charging each pop to the push that preceded it gives a linear total.' },
    { to: 'concept:lower-bound', type: 'advanced', why: 'Lifting numbers x to points (x, x²) and reading the hull in order sorts the numbers, so computing a hull in order is at least as hard as sorting.' },
    { to: 'bresenham-line', type: 'related', why: 'Both make geometric decisions from the sign of a whole-number expression of the same form, which keeps them exact where fractions would need rounding.' },
    { to: 'de-casteljau', type: 'related', why: 'A Bézier curve always lies inside the convex hull of its control points, which is why the hull is used as a quick bound on where the curve can be.' },
    { to: 'rrt', type: 'application', why: 'Motion planners spend most of their time testing whether a robot placement collides with an obstacle, and those tests are commonly run on convex approximations of both.' },
    { to: 'discipline:computer-graphics', type: 'application', why: 'Convex hulls serve as cheap bounding shapes when deciding what overlaps or what needs to be drawn.' },
    { to: 'discipline:robotics', type: 'application', why: 'Collision geometry for robots and obstacles is often stored as convex shapes, built as hulls of measured or modelled points.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why does the scan start from the lowest point?',
      options: ['It makes the hull come out clockwise', 'It is certain to be a hull corner, and every other point then lies within half a turn of it', 'It is the closest point to the others', 'Any interior point would do just as well with this version'],
      answer: 1,
      explain: [
        'This version produces a counter-clockwise hull, and the choice of pivot does not decide the direction.',
        'Correct. Nothing lies below it, so it is on the hull, and with all other points on one side the turn test gives a consistent angular order.',
        'Distance plays no part, except to break ties between points in exactly the same direction.',
        'This version relies on the pivot being a hull corner: the pivot is never tested and never popped.',
      ],
    },
    {
      type: 'predict',
      q: 'Sixteen points are placed evenly around a circle. How many points will the scan pop?',
      options: ['None', '8', '14', '15'],
      answer: 0,
      explain: [
        'Correct. Walking round a circle counter-clockwise is a left turn at every point, so every point is a corner and nothing is removed.',
        'Popping happens only at a right turn or a straight line, and a circle has neither.',
        '14 would leave a hull of two points. Every point on a circle is a corner.',
        'The pivot is never popped, and neither is anything else here.',
      ],
      tryInput: { n: 16, distribution: 'circle', seed: 2, custom: [] },
    },
    {
      type: 'debug',
      q: 'This scan sometimes returns an outline with a dent in it. Which change fixes it?',
      code: `stack = [p0]
for c in rest:
    if len(stack) >= 2 and turn(stack[-2], stack[-1], c) <= 0:
        stack.pop()
    stack.append(c)`,
      options: ['Change <= 0 to < 0', 'Change if to while', 'Start the stack empty', 'Append c before testing'],
      answer: 1,
      explain: [
        'That would keep collinear points as well, and the dent would remain.',
        'Correct. After one pop, the new top of the stack may also fail the left-turn test against c. The test has to repeat until it passes or only the pivot is left.',
        'The pivot belongs on the stack from the start. Removing it would lose a corner.',
        'Then the test would compare c with itself and its predecessor, and nothing sensible would be popped.',
      ],
    },
    {
      type: 'predict',
      q: 'Nine points: the four corners of a square, the midpoint of each side, and the centre. How many points are in the hull this page reports?',
      options: ['4', '8', '9', '5'],
      answer: 0,
      explain: [
        'Correct. The four side midpoints are popped, three of them with a turn value of exactly 0, and the centre is inside. Only the corners remain.',
        'The band would touch all eight boundary points, but this version reports corners only and drops points that lie along an edge.',
        'The centre is strictly inside the square and can never be on the hull.',
        'The centre is not a corner. The four corners are the whole answer.',
      ],
      tryInput: { custom: [0, 0, 2, 0, 4, 0, 4, 2, 4, 4, 2, 4, 0, 4, 0, 2, 2, 2] },
    },
    {
      type: 'choice',
      q: 'The scan has a while loop inside a for loop. Why does it still make fewer than 2n turn tests in total?',
      options: ['The while loop runs at most twice for each point', 'Each point is pushed once and can be popped at most once, so pops are limited to n over the whole run', 'The points are sorted, so most tests are skipped', 'Only hull corners are ever tested'],
      answer: 1,
      explain: [
        'A single new point can cause many pops in a row. The limit is on the total, not on each round.',
        'Correct. Every test either ends the inner loop, which happens once per point, or pops a point, which can happen once per point.',
        'No test is skipped. Sorting only fixes the order in which points arrive.',
        'Every point takes part in at least one test, corner or not.',
      ],
    },
    {
      type: 'challenge',
      title: 'Monotone chain',
      prompt: 'Write a second hull function that avoids the angular sort. Sort the points by x, breaking ties by y. Sweep left to right, keeping a stack and popping while the last three points do not make a left turn: this gives the lower half of the hull. Sweep right to left in the same way to get the upper half, and join the two. Check on random whole-number points that it returns exactly the same corners as the Graham scan, including when many points are collinear.',
      hints: ['The leftmost and rightmost points appear at the end of one half and the start of the other. Remove the repeats when joining.', 'The same turn test and the same `<= 0` rule give corners only.', 'To compare the two results, rotate one list so that both start at the same point.'],
    },
  ],

  compare: {
    idea: 'Sort the points by angle around the lowest one, then sweep once with a stack, discarding every point that does not make a left turn.',
    requires: 'Points on a flat surface, and arithmetic precise enough to tell a left turn from a right turn reliably.',
    sensitivity: 'Low. The sort costs the same whatever the arrangement, and the scan varies only between one and two tests per point.',
    memory: 'O(n) for the sorted points and the stack.',
    difficulty: 'moderate',
    difficultyNote: 'Short to write. The difficulty is in handling ties and collinear points consistently, and in making the turn test reliable.',
    limits: 'Flat surfaces only. It needs all the points before it starts. It always pays for putting the points in order.',
    useWhen: 'You need the outline that wraps a fixed set of points on a flat surface, with a dependable running time.',
  },

  advanced: {
    history: 'Ronald Graham published the algorithm in a two-page note in Information Processing Letters in 1972. His version measured directions from a point inside the hull; textbooks now usually take the lowest point as pivot, as this lesson does. R. A. Jarvis published gift wrapping in the same journal in 1973, and A. M. Andrew the monotone chain variant in 1979. D. G. Kirkpatrick and R. Seidel gave the first algorithm with running time n log h, where h is the number of corners, in 1986, and Timothy Chan gave a much simpler one in 1996.',
    derivation: 'The turn test is the z-component of a cross product. For points $a$, $b$, $c$,\n\n$$\\text{turn}(a, b, c) = (b_x - a_x)(c_y - a_y) - (b_y - a_y)(c_x - a_x) = \\begin{vmatrix} b_x - a_x & c_x - a_x \\\\ b_y - a_y & c_y - a_y \\end{vmatrix}.$$\n\nThis determinant equals twice the signed area of the triangle $abc$: positive when $a, b, c$ run counter-clockwise, negative when clockwise, and zero when the three points are collinear. It can also be written $|b-a|\\,|c-a|\\sin\\theta$, where $\\theta$ is the angle from $b-a$ to $c-a$, so its sign is the sign of that angle. With integer coordinates below $M$ in absolute value, every term is an integer below $8M^2$, so the test is exact in any integer type with room for that.',
    proof: 'Let $p_0$ be the pivot and $p_1, \\dots, p_{n-1}$ the other points in angular order. Write $H_i$ for the convex hull of $\\{p_0, \\dots, p_i\\}$. We show by induction that after $p_i$ is pushed the stack lists the corners of $H_i$ counter-clockwise.\n\nFor $i = 1$ the stack is $p_0, p_1$, which is $H_1$. For the step, $p_i$ has the largest angle seen so far, so all earlier points lie on or to the right of the ray from $p_0$ through $p_i$; hence $p_i$ is on the boundary of $H_i$, and it is a corner unless a farther point lies on the same ray, which the tie rule excludes. Let $a, b$ be the top two stack entries. If $\\text{turn}(a, b, p_i) \\le 0$, then $b$ is on or to the left of the directed line from $a$ to $p_i$, and its angle lies between those of $a$ and $p_i$, so $b$ lies in the triangle $p_0\\,a\\,p_i$ and is not a corner of $H_i$. If instead the turn is positive, then $b$ and every entry below it remain corners, because the polygon $p_0, \\dots, a, b, p_i$ turns left at every vertex and its vertices are in angular order around $p_0$, which makes it convex. It contains $p_i$ and every earlier point, since each popped point lies in a triangle spanned by three of its corners, and all its corners are input points, so it equals $H_i$.',
    complexityProof: 'Each of the $n-1$ points after the pivot is pushed exactly once. A turn test has one of two outcomes: a pop, or the end of the inner loop for the current point. The second happens at most once per point after the first, so at most $n-2$ times. Pops number exactly $n-h$ when the points are distinct, where $h$ is the size of the final stack, because every point is either on the final stack or was popped once. The scan therefore makes at most $(n-2) + (n-h) = 2n - 2 - h$ turn tests. Adding $O(n \\log n)$ for the sort and $O(n)$ to find the pivot gives $O(n \\log n)$.\n\nFor the lower bound, given numbers $x_1, \\dots, x_n$, form the points $(x_i, x_i^2)$. They lie on a parabola, so all are hull corners, and reading the hull counter-clockwise from the lowest point lists them in an order from which the sorted order follows in linear time.',
    variants: [
      { name: 'Andrew\'s monotone chain', text: 'Sorts by x-coordinate and builds the lower and upper hulls with two scans. It needs no pivot and no angular comparison, and is the form most libraries implement.' },
      { name: 'Keeping collinear points', text: 'Popping only on a strict right turn keeps points that lie along hull edges. The points on the last edge back to the pivot must then be ordered farthest first.' },
      { name: 'Scan of a simple polygon', text: 'If the input is already the boundary of a simple polygon, linear-time algorithms find its hull without sorting, though a plain Graham scan in boundary order is not always correct for this.' },
      { name: 'Chan\'s algorithm', text: 'Splits the points into groups, runs a Graham-style scan on each, and gift wraps around the group hulls, for a total of O(n log h).' },
    ],
    implementation: 'Compute the turn test in an integer type wide enough for the product of two coordinate differences, or with exact or adaptive-precision arithmetic if the coordinates are floating point. Compare directions with the turn test, not with computed angles. Remove duplicate points first. Decide at the outset whether collinear boundary points are wanted and make the sort tie-break and the pop condition agree with that decision.',
    benchmarking: 'Running time depends mostly on the sort, so compare against other hull algorithms on several distributions: points in a disc, where the hull is small; points on a circle, where every point is a corner; and data with many collinear points. Report the number of hull corners along with the timings.',
    references: [
      { authors: 'R. L. Graham', year: 1972, title: 'An efficient algorithm for determining the convex hull of a finite planar set', venue: 'Information Processing Letters 1(4), 132-133' },
      { authors: 'R. A. Jarvis', year: 1973, title: 'On the identification of the convex hull of a finite set of points in the plane', venue: 'Information Processing Letters 2(1), 18-21' },
      { authors: 'A. M. Andrew', year: 1979, title: 'Another efficient algorithm for convex hulls in two dimensions', venue: 'Information Processing Letters 9(5), 216-219' },
      { authors: 'D. G. Kirkpatrick and R. Seidel', year: 1986, title: 'The ultimate planar convex hull algorithm?', venue: 'SIAM Journal on Computing 15(1), 287-299' },
      { authors: 'J. R. Shewchuk', year: 1997, title: 'Adaptive precision floating-point arithmetic and fast robust geometric predicates', venue: 'Discrete & Computational Geometry 18(3), 305-363' },
    ],
    furtherReading: [
      'M. de Berg, O. Cheong, M. van Kreveld and M. Overmars, *Computational Geometry: Algorithms and Applications* (3rd edition), chapter 1.',
      'J. O\'Rourke, *Computational Geometry in C* (2nd edition), chapter 3, "Convex hulls in two dimensions".',
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Computational Geometry", section "Finding the convex hull".',
    ],
  },

  tests: [
    { name: 'default input: every point inside or on the hull, strictly convex, counter-clockwise, matches gift wrapping', input: {},
      check: (r) => checkHull(r) },
    { name: 'matches gift wrapping on 240 random inputs across all four distributions', input: {},
      check: () => {
        for (const d of DISTRIBUTIONS) for (let seed = 1; seed <= 20; seed++) for (const n of [3, 7, 23, 60]) {
          let r;
          try { r = run({ n, distribution: d.value, seed, custom: [] }, QUIET); } catch (e) { if (n === 3) continue; return `${d.value} n=${n} seed=${seed} threw ${e.message}`; }
          const verdict = checkHull(r);
          if (verdict !== true) return `${d.value} n=${n} seed=${seed}: ${verdict}`;
        }
        return true;
      } },
    { name: 'the worked example: hull 0, 1, 3, 4 with 4 turn tests and 1 pop', input: { custom: [0, 0, 4, 1, 3, 2, 4, 4, 1, 3] },
      check: (r, c) => (r.hull.join(',') === '0,1,3,4' && r.hullPoints.map((p) => p.join(' ')).join(', ') === '0 0, 4 1, 4 4, 1 3' && c['orientation tests'] === 4 && r.popped === 1) || `hull ${r.hull.join(',')}, ${c['orientation tests']} tests, ${r.popped} pops` },
    { name: 'points on a circle are all corners: no pops and n − 2 turn tests', input: { n: 16, distribution: 'circle', seed: 2, custom: [] },
      check: (r, c) => (r.hull.length === 16 && r.popped === 0 && c['orientation tests'] === 14 && checkHull(r) === true) || `${r.hull.length} corners, ${r.popped} pops, ${c['orientation tests']} tests` },
    { name: 'sixty points on a circle are still all corners', input: { n: 60, distribution: 'circle', seed: 9, custom: [] },
      check: (r) => (r.hull.length === 60 && checkHull(r) === true) || `${r.hull.length} corners` },
    { name: 'two thousand points on a circle: all corners, n − 2 turn tests', input: {},
      check: () => {
        const r = run({ n: 2048, distribution: 'circle', seed: 7, custom: [] }, QUIET);
        return (r.hull.length === 2048 && r.scanTests === 2046) || `${r.hull.length} corners, ${r.scanTests} tests`;
      } },
    { name: 'collinear points on edges are dropped: the square has 4 corners', input: { custom: [0, 0, 2, 0, 4, 0, 4, 2, 4, 4, 2, 4, 0, 4, 0, 2, 2, 2] },
      check: (r) => (r.hullPoints.map((p) => p.join(' ')).join(', ') === '0 0, 4 0, 4 4, 0 4' && checkHull(r) === true) || `got ${r.hullPoints.map((p) => p.join(' ')).join(', ')}` },
    { name: 'all points in one line give a two-point degenerate hull', input: { custom: [3, 3, 0, 0, 2, 2, 5, 5, 1, 1] },
      check: (r) => (r.degenerate && r.hullPoints.map((p) => p.join(' ')).join(', ') === '0 0, 5 5') || `got ${r.hullPoints.map((p) => p.join(' ')).join(', ')}` },
    { name: 'repeated points are removed before the scan', input: { custom: [0, 0, 4, 0, 4, 0, 2, 3, 0, 0, 2, 1] },
      check: (r) => (r.n === 4 && r.dropped === 2 && r.hull.length === 3 && checkHull(r) === true) || `n=${r.n}, dropped=${r.dropped}, corners=${r.hull.length}` },
    { name: 'the scan stays under 2n − 2 − h turn tests on a large scattered set', input: {},
      check: () => {
        const r = run({ n: 2000, distribution: 'uniform', seed: 5, custom: [] }, QUIET);
        return (r.scanTests <= 2 * r.n - 2 - r.hull.length && checkHull(r) === true) || `${r.scanTests} tests for n=${r.n}, h=${r.hull.length}`;
      } },
  ],
};
