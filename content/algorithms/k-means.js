import { makeBlobs, DATA_RANGE } from '../../js/lib/datasets.js';
import { makeRng } from '../../js/lib/rng.js';
import { SERIES } from '../../js/viz/theme.js';

const MAX_ROUNDS = 100;
const trim = (v, d) => {
  const s = v.toFixed(d);
  return Number(s) === 0 ? (0).toFixed(d) : s;
};
const f2 = (v) => trim(v, 2);
const f3 = (v) => (Math.abs(v) >= 100 ? trim(v, 1) : trim(v, 3));
const at = (c) => `(${f2(c[0])}, ${f2(c[1])})`;
const INITS = [
  { value: 'random', label: 'Random data points' },
  { value: 'plusplus', label: 'k-means++ (spread out)' },
  { value: 'first', label: 'The first k points' },
];

function resolvePoints(input) {
  if (Array.isArray(input.custom) && input.custom.length) {
    const c = input.custom;
    if (c.length % 2 !== 0 || c.length < 4) throw new Error('Type your own points as x, y pairs: an even count of numbers, and at least two points.');
    const pts = [];
    for (let i = 0; i < c.length; i += 2) pts.push([c[i], c[i + 1]]);
    // Frame the chart around the typed points, square so that distances look right.
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-6) * 0.6;
    return { pts, x: [cx - half, cx + half], y: [cy - half, cy + half], custom: true };
  }
  const data = makeBlobs({ k: input.blobs, points: input.points, seed: input.seed });
  return { pts: data.points.map((p) => [p.x, p.y]), x: DATA_RANGE, y: DATA_RANGE, custom: false };
}

const dist2 = (p, c) => (p[0] - c[0]) * (p[0] - c[0]) + (p[1] - c[1]) * (p[1] - c[1]);

function run(input, t) {
  const { pts, x: xRange, y: yRange } = resolvePoints(input);
  const n = pts.length;
  const k = input.k;
  if (k > n) throw new Error(`k is ${k} but there are only ${n} points. Choose k no larger than the number of points.`);
  const rng = makeRng((input.initSeed || 1) * 7907 + 11);

  const centres = [];        // current centre positions
  const trails = [];         // every position each centre has held
  const assign = new Array(n).fill(-1);
  const history = [];        // within-cluster sum of squares after each assignment and each update
  let lastMove = null;       // { j, from, to } for the arrow on an update frame

  const wcss = () => {
    let s = 0;
    for (let i = 0; i < n; i++) s += dist2(pts[i], centres[assign[i]]);
    return s;
  };
  const sizes = () => { const c = new Array(k).fill(0); for (const a of assign) if (a >= 0) c[a]++; return c; };

  const views = ({ spokes = false, focus = null } = {}) => {
    const layers = [];
    if (spokes) for (let j = 0; j < centres.length; j++) {
      const segs = [];
      for (let i = 0; i < n; i++) if (assign[i] === j) segs.push([pts[i][0], pts[i][1], centres[j][0], centres[j][1]]);
      if (segs.length) layers.push({ type: 'segments', segments: segs, role: SERIES[j], width: 1, alpha: focus === null || focus === j ? 0.45 : 0.15 });
    }
    for (let j = 0; j < trails.length; j++) if (trails[j].length > 1) layers.push({ type: 'line', points: trails[j].map((p) => p.slice()), role: SERIES[j], width: 1.4, dash: [3, 4] });
    const loose = pts.filter((_, i) => assign[i] < 0);
    if (loose.length) layers.push({ type: 'points', points: loose.map((p) => p.slice()), role: 'default', r: 3.6 });
    for (let j = 0; j < k; j++) {
      const mine = pts.filter((_, i) => assign[i] === j);
      if (mine.length) layers.push({ type: 'points', points: mine.map((p) => p.slice()), role: SERIES[j], r: 3.6 });
    }
    if (lastMove && focus === lastMove.j) layers.push({ type: 'segments', segments: [[...lastMove.from, ...lastMove.to]], role: 'ink', width: 2, arrow: true });
    for (let j = 0; j < centres.length; j++) {
      layers.push({ type: 'points', points: [{ x: centres[j][0], y: centres[j][1], label: String(j + 1) }], role: SERIES[j], r: 8, ring: true });
      layers.push({ type: 'points', points: [centres[j].slice()], role: 'ink', hollow: true, r: 8 });
    }
    const legend = Array.from({ length: k }, (_, j) => ({ label: `cluster ${j + 1}`, role: SERIES[j] }));
    legend.push({ label: 'centre (large, outlined, numbered)', role: 'ink' });
    const out = [{ kind: 'scene', title: 'Points and cluster centres', x: xRange, y: yRange, aspect: 0.7, equal: true, axes: { xLabel: 'feature 1', yLabel: 'feature 2' }, layers, legend }];
    if (history.length) {
      const top = Math.max(...history) * 1.08 || 1;
      const span = Math.max(8, history.length + 1);
      out.push({ kind: 'scene', title: 'Cost (within-cluster sum of squares) after each half-step', x: [0, span], y: [0, top], aspect: 0.2, axes: { xLabel: 'half-step (assignment or update)' },
        layers: [
          { type: 'line', points: history.map((v, i) => [i + 1, v]), role: 'forest', width: 2 },
          { type: 'points', points: history.map((v, i) => [i + 1, v]), role: 'forest', r: 3 },
        ] });
    }
    return out;
  };

  t.frame(() => ({ line: 0,
    note: `${n} points with no labels. The task is to split them into **${k} cluster${k === 1 ? '' : 's'}** so that each point is close to the centre of its own cluster. The algorithm needs ${k} starting centre${k === 1 ? '' : 's'}, and where they start matters.`,
    views: views(), vars: { n, k } }));

  // ---- choose the starting centres ----
  const place = (idx, why) => {
    centres.push(pts[idx].slice());
    trails.push([pts[idx].slice()]);
    const j = centres.length - 1;
    t.frame(() => ({ line: 1, note: `Centre ${j + 1} starts on point #${idx + 1} at ${at(pts[idx])}. ${why}`, views: views(), vars: { centre: j + 1, x: f2(pts[idx][0]), y: f2(pts[idx][1]) } }));
  };
  if (input.init === 'first') {
    for (let j = 0; j < k; j++) place(j, 'This start simply takes the points in the order they are listed.');
  } else if (input.init === 'plusplus') {
    place(rng.int(0, n - 1), 'The first centre is a data point chosen at random.');
    while (centres.length < k) {
      const d2 = pts.map((p) => Math.min(...centres.map((c) => dist2(p, c))));
      t.count('distance computations', n);
      const total = d2.reduce((s, v) => s + v, 0);
      let idx = n - 1;
      if (total > 0) {
        let r = rng.next() * total;
        for (let i = 0; i < n; i++) { r -= d2[i]; if (r < 0) { idx = i; break; } }
      } else idx = rng.int(0, n - 1);
      const share = total > 0 ? (100 * d2[idx] / total).toFixed(1) : '0';
      place(idx, `k-means++ picks each further centre at random, but a point's chance grows with the square of its distance from the nearest centre already placed. This point had a ${share}% chance, so far-away points are favoured and the centres start spread out.`);
    }
  } else {
    const order = rng.shuffle(pts.map((_, i) => i));
    for (let j = 0; j < k; j++) place(order[j], 'It is a data point chosen at random, with every point equally likely.');
  }

  // ---- Lloyd's iteration ----
  let rounds = 0, converged = false;
  while (rounds < MAX_ROUNDS) {
    rounds++;
    let changed = 0;
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity;
      for (let j = 0; j < k; j++) { const d = dist2(pts[i], centres[j]); if (d < bestD) { bestD = d; best = j; } }
      if (assign[i] !== best) { assign[i] = best; changed++; }
    }
    t.count('distance computations', n * k);
    const round = rounds, sz = sizes();
    if (changed === 0) {
      converged = true;
      t.frame(() => ({ line: [3, 4, 5], note: `Round ${round}, assignment: every point is already with its nearest centre, so **no point changes cluster**. The centres would not move either. The algorithm has converged.`, views: views({ spokes: true }), vars: { round, changed: 0, cost: f3(history[history.length - 1]) } }));
      break;
    }
    const before = history.length ? history[history.length - 1] : null;
    history.push(wcss());
    lastMove = null;
    t.frame(() => ({ line: [3, 4],
      note: `Round ${round}, assignment: give every point to its nearest centre. ${round === 1 ? `All ${n} points receive a cluster` : `${changed} point${changed === 1 ? ' changes' : 's change'} cluster`}, making sizes ${sz.join(', ')}. The cost, the sum of squared distances from each point to its centre, is ${before === null ? '' : `down from ${f3(before)} to `}**${f3(history[history.length - 1])}**.`,
      views: views({ spokes: true }), vars: { round, changed, cost: f3(history[history.length - 1]) } }));

    const moves = [];
    for (let j = 0; j < k; j++) {
      let sx = 0, sy = 0, m = 0;
      for (let i = 0; i < n; i++) if (assign[i] === j) { sx += pts[i][0]; sy += pts[i][1]; m++; }
      const from = centres[j].slice();
      if (m > 0) { centres[j] = [sx / m, sy / m]; trails[j].push(centres[j].slice()); }
      moves.push({ j, from, to: centres[j].slice(), m });
      const mv = moves[moves.length - 1];
      lastMove = mv;
      t.frame(() => ({ line: [6, 7],
        note: mv.m === 0
          ? `Round ${round}, update: no point chose centre ${mv.j + 1}, so it has nothing to average and stays at ${at(mv.from)}.`
          : `Round ${round}, update: centre ${mv.j + 1} moves to the average position of its ${mv.m} point${mv.m === 1 ? '' : 's'}, from ${at(mv.from)} to **${at(mv.to)}**${Math.hypot(mv.to[0] - mv.from[0], mv.to[1] - mv.from[1]) < 5e-4 ? ', which is where it already was' : ''}.`,
        views: views({ spokes: true, focus: mv.j }), vars: { round, centre: mv.j + 1, points: mv.m, x: f2(mv.to[0]), y: f2(mv.to[1]) } }));
    }
    history.push(wcss());
    lastMove = null;
  }

  const cost = wcss();
  const finalSizes = sizes();
  t.frame(() => ({ line: 8,
    note: converged
      ? `Finished after ${rounds} round${rounds === 1 ? '' : 's'} with cost **${f3(cost)}** and cluster sizes ${finalSizes.join(', ')}. Every point is with its nearest centre and every centre is at the average of its points, so neither step can lower the cost any further. That does not make it the best possible grouping: a different start can end somewhere better or worse.`
      : `Stopped at the limit of ${MAX_ROUNDS} rounds with cost ${f3(cost)}. Points were still changing cluster.`,
    views: views({ spokes: true }), vars: { rounds, cost: f3(cost) } }));

  return { centroids: centres.map((c) => c.slice()), assignment: assign.slice(), wcss: cost, history: history.slice(), rounds, converged, k, n, sizes: finalSizes, points: pts };
}

// A tracer that records nothing, for tests that need a second run to compare against.
const SILENT = { count() {}, frame() {} };
const DEFAULTS = { blobs: 3, points: 60, seed: 3, k: 3, init: 'random', initSeed: 1, custom: [] };
const quiet = (input) => run({ ...DEFAULTS, ...input }, SILENT);

// Fixed-point properties every converged run must have, checked from the result alone.
function isFixedPoint(r) {
  if (!r.converged) return 'did not converge';
  for (let i = 0; i < r.n; i++) {
    const mine = dist2(r.points[i], r.centroids[r.assignment[i]]);
    for (let j = 0; j < r.k; j++) if (dist2(r.points[i], r.centroids[j]) < mine - 1e-12) return `point ${i} is closer to centre ${j} than to its own`;
  }
  for (let j = 0; j < r.k; j++) {
    const mine = r.points.filter((_, i) => r.assignment[i] === j);
    if (!mine.length) continue;
    const mx = mine.reduce((s, p) => s + p[0], 0) / mine.length, my = mine.reduce((s, p) => s + p[1], 0) / mine.length;
    if (Math.hypot(mx - r.centroids[j][0], my - r.centroids[j][1]) > 1e-9) return `centre ${j} is not the mean of its points`;
  }
  for (let i = 1; i < r.history.length; i++) if (r.history[i] > r.history[i - 1] + 1e-9) return `cost rose from ${r.history[i - 1]} to ${r.history[i]} at half-step ${i + 1}`;
  let total = 0;
  for (let i = 0; i < r.n; i++) total += dist2(r.points[i], r.centroids[r.assignment[i]]);
  if (Math.abs(total - r.wcss) > 1e-9) return `reported cost ${r.wcss} but recomputed ${total}`;
  return true;
}

const LINE = [1, 0, 2, 0, 3, 0, 8, 0, 9, 0, 10, 0];
const TWO_ROWS = [1, 1, 1, 3, 3, 1, 3, 3, 7, 1, 7, 3, 9, 1, 9, 3];

export default {
  meta: {
    id: 'k-means',
    name: 'k-Means Clustering',
    aliases: ['k-means', 'Lloyd\'s algorithm', 'Lloyd-Forgy algorithm', 'kmeans', 'k-means++', 'vector quantization'],
    kind: 'algorithm',
    discipline: 'machine-learning',
    alsoIn: [
      { id: 'computer-vision', why: 'Clustering pixel colours with k-means is a standard way to reduce an image to a small palette and a simple way to segment it into regions.' },
      { id: 'information-theory', why: 'Lloyd devised the method to design quantizers: replace each signal value by the nearest of k representative levels with the least squared error.' },
      { id: 'statistics', why: 'It is the most widely used method of cluster analysis, and its cost is the within-group sum of squares familiar from the analysis of variance.' },
    ],
    subfield: 'Unsupervised learning',
    family: 'Centroid-based clustering',
    lab: 'machine-learning',
    year: 1957,
    authors: 'Stuart P. Lloyd',
    summary: 'Splits unlabelled points into k groups by alternating two steps: give each point to its nearest centre, then move each centre to the mean of its points.',
    difficulty: 'beginner',
    order: 620,
    paradigms: ['iterative-refinement', 'local-search'],
    randomized: true,
    approximate: true,
    time: { best: 'O(nkd) per round', average: 'O(nkd·i) for i rounds', worst: 'Exponentially many rounds', class: 'iterative' },
    space: { worst: 'O(nd + kd)', class: 'linear' },
    tags: {
      problems: ['group similar things', 'find clusters in data', 'sort items into groups without labels', 'segment customers', 'reduce the colours in an image'],
      techniques: ['centroids', 'alternating minimization', 'k-means++ seeding', 'sum of squares', 'random restarts'],
      applications: ['machine learning', 'image processing', 'data compression', 'statistics', 'signal processing'],
    },
    prerequisites: ['concept:unsupervised-learning', 'concept:distance-metric', 'concept:feature-space', 'concept:local-search'],
  },

  bigIdea: {
    simple: "k-means is a way to sort things into groups when nobody has told you what the groups are. Imagine a town that wants to put up three notice boards, so that everyone lives close to one of them. Where should they go? Start by putting the boards anywhere. Each household then picks the board nearest to it, which splits the town into three groups. Now move each board to the middle of the group that picked it. Some households will find that a different board has become their nearest, so they switch. Move the boards again, and keep going. After a few rounds nobody switches, and you stop. The boards now mark the centres of three neighbourhoods. Computers do the same with any kind of measurement, not only positions on a map. They can group customers with similar shopping habits, or the colours in a photograph. The letter k stands for the number of groups, and you have to choose it yourself.",
    what: 'k-means partitions a set of points into k clusters. Each cluster is represented by its **centroid**, the average position of its points. The algorithm repeats two steps until nothing changes: assign every point to the nearest centroid, then move every centroid to the mean of the points assigned to it. Each step lowers, or at least never raises, the total squared distance from points to their centroids.',
    why: 'Labels are expensive and most data have none. Clustering asks what structure the data show without them. Stuart Lloyd worked out the method at Bell Laboratories in 1957 for pulse-code modulation: deciding which k levels a signal should be rounded to, so that rounding each sample to the nearest level loses as little as possible. The same computation groups any points that can be averaged.',
    when: 'Use it when you want a fixed number of compact, roughly round groups of similar size, the features are numeric and on comparable scales, and speed matters. Run it from several starting positions and keep the best result. Choose something else when clusters are elongated, nested or of very different sizes, when you do not know k and cannot explore it, or when you have labels, in which case a classifier such as [k-nearest neighbours](#/algorithm/knn) uses them.',
    interesting: 'Finding the grouping with the lowest possible cost is NP-hard, yet this two-line loop usually gives a good answer in a handful of rounds. The catch is the word "usually". The loop only ever improves the grouping it was given, so it can settle into a poor arrangement that no single step can escape. Which arrangement you get is decided before the loop starts, by where the centres begin.',
    where: 'It reduces photographs to small colour palettes, builds codebooks for compressing signals and for fast similarity search, groups customers and documents for analysis, and provides starting values for more elaborate clustering models.',
    analogy: {
      title: 'Moving the notice boards',
      text: "Watch one round at the notice boards and ask who gains. When a household switches to a board that has become nearer, its own walk gets shorter. When a board moves to the middle of the households that chose it, that group as a whole is better served than before. Neither move ever makes things worse, so the town cannot go round in circles. Sooner or later a round passes in which no household switches, and that is where the method stops. Nobody had to define the neighbourhoods in advance.",
      limits: 'A real board cannot stand in the middle of a lake, but a centroid is a plain average and can land where there are no points at all. Households would measure distance along streets; the method uses straight-line distance and squares it, so a few far-away households pull a board strongly. The town also has to decide the number of boards before it starts, and the method will carve out that many neighbourhoods whether or not the town really has them. Finally, a bad first placement can leave two boards sharing one neighbourhood while another neighbourhood has to share a single board with its neighbour, and the procedure will not notice.',
    },
  },

  example: {
    setup: "Six houses stand along a straight road at kilometre marks 1, 2, 3, 8, 9 and 10. Split them into two clusters. Start with one centre on the first house, at 1, and the other on the second house, at 2. The cost of a grouping is found by taking each house's distance to its centre, squaring it, and adding these up.",
    steps: [
      "Assign each house to its nearest centre. The house at 1 goes to the centre at 1. The houses at 2, 3, 8, 9 and 10 are all nearer to the centre at 2. The cost is 0 + 0 + 1 + 36 + 49 + 64 = 150.",
      "Move each centre to the average of its houses. The first centre has only the house at 1, so it stays. The second moves to (2 + 3 + 8 + 9 + 10) ÷ 5 = 6.4. The cost drops to 53.2.",
      "Assign again, with centres at 1 and 6.4. The house at 2 is 1 away from the first centre and 4.4 from the second, so it switches. The house at 3 is 2 away and 3.4 away, so it switches too. The houses at 8, 9 and 10 stay. The cost drops to 27.28.",
      "Move the centres again. The first moves to (1 + 2 + 3) ÷ 3 = 2. The second moves to (8 + 9 + 10) ÷ 3 = 9. The cost drops to 1 + 0 + 1 + 1 + 0 + 1 = 4.",
      "Assign once more. Every house is already with its nearest centre, so nothing changes and the algorithm stops.",
    ],
    result: "The clusters are the houses at 1, 2, 3 with their centre at 2, and the houses at 8, 9, 10 with their centre at 9. The cost fell at every step: 150, then 53.2, then 27.28, then 4. Both centres started at the same end of the road, and the method still pulled one of them across. That does not always happen, as the quiz shows.",
    tryInput: { custom: LINE, k: 2, init: 'first' },
  },

  terms: [
    { term: "Cluster", meaning: "A group of points that are close to one another. Clustering means finding such groups when no labels are given." },
    { term: "k", meaning: "The number of clusters the algorithm is told to produce. It is chosen by the person, not discovered by the method." },
    { term: "Centroid", meaning: "The centre of a cluster: the average position of all the points in it. This page also calls it the centre." },
    { term: "Assignment step", meaning: "Giving every point to the cluster whose centre is nearest to it." },
    { term: "Update step", meaning: "Moving every centre to the average position of the points currently assigned to it." },
    { term: "Cost", meaning: "The sum, over all points, of the squared distance from the point to its cluster's centre. Also called the within-cluster sum of squares. Lower means tighter clusters." },
    { term: "Converge", meaning: "To reach a state that the steps no longer change. Here, an assignment step in which no point switches cluster." },
    { term: "Initialization", meaning: "The choice of where the centres start, made before the first round." },
    { term: "Local optimum", meaning: "A result that no single step can improve, even though a better result exists somewhere else." },
  ],

  takeaway: "Give each point to its nearest centre, move each centre to the middle of its points, and repeat until nothing changes.",

  viz: {
    describe: 'A square scatter plot of points. Each point is coloured by the cluster it currently belongs to, and thin lines join it to that cluster\'s centre. Centres are large numbered dots with a dark outline, and a dashed trail shows where each centre has been. On update frames an arrow shows a centre moving to the average of its points. A second, smaller chart plots the cost, the within-cluster sum of squares, after every assignment and every update. It never rises.',
    inputs: [
      { id: 'blobs', type: 'range', label: 'Groups in the data', min: 1, max: 6, step: 1, default: 3,
        help: 'How many round blobs the points are generated from. The algorithm is not told this number.' },
      { id: 'points', type: 'range', label: 'Number of points', min: 12, max: 150, step: 6, default: 60 },
      { id: 'seed', type: 'seed', label: 'Data seed', default: 3 },
      { id: 'k', type: 'range', label: 'Clusters to find (k)', min: 1, max: 7, step: 1, default: 3 },
      { id: 'init', type: 'select', label: 'Starting centres', options: INITS, default: 'random' },
      { id: 'initSeed', type: 'seed', label: 'Starting-centre seed', default: 1 },
      { id: 'custom', type: 'list', label: 'Or type your own points', default: [], maxLength: 120, min: -100, max: 100, placeholder: 'e.g. 1, 0, 2, 0, 3, 0, 8, 0, 9, 0, 10, 0',
        help: 'Read as x, y pairs. Leave empty to use the generated points.' },
    ],
    presets: [
      { label: 'Three groups, k = 3', values: { blobs: 3, points: 60, seed: 3, k: 3, init: 'random', initSeed: 1, custom: [] } },
      { label: 'A bad start', values: { blobs: 3, points: 60, seed: 3, k: 3, init: 'random', initSeed: 2, custom: [] } },
      { label: 'Same data, k-means++ start', values: { blobs: 3, points: 60, seed: 3, k: 3, init: 'plusplus', initSeed: 2, custom: [] } },
      { label: 'Too many clusters (k = 5)', values: { blobs: 3, points: 60, seed: 3, k: 5, init: 'plusplus', initSeed: 1, custom: [] } },
      { label: 'Too few clusters (k = 2)', values: { blobs: 4, points: 72, seed: 2, k: 2, init: 'plusplus', initSeed: 1, custom: [] } },
      { label: 'Worked example: six houses', values: { custom: LINE, k: 2, init: 'first' } },
      { label: 'Stuck: two rows of four', values: { custom: TWO_ROWS, k: 2, init: 'first' } },
    ],
    tryThis: [
      'Run the default. Two of the three centres start inside the same group. For several rounds they hardly move and the cost is almost flat. Then one of them drifts far enough to win points from the group that has no centre of its own, and the cost falls sharply. Watch the cost chart: it never rises, but it does not fall evenly either.',
      'Load "A bad start". The data are the same, only the starting centres differ. This time the run converges with two centres splitting one group between them and a single centre covering the other two. Compare the final cost in the output panel with the default run. Then load "Same data, k-means++ start".',
      'Keep the default data and press Randomize on the starting-centre seed several times. Count how often the cost ends at about 3.2 and how often it ends much higher. This is why k-means is normally run from many starts, keeping the best.',
      'Load "Too many clusters (k = 5)". The method returns five clusters because it was asked for five, cutting real groups in two. The cost is lower than with k = 3, which shows that a lower cost alone cannot tell you the right k.',
    ],
    run,
    report: (r, c) => `${r.converged ? `Converged after ${r.rounds} round${r.rounds === 1 ? '' : 's'}` : `Stopped at the limit of ${r.rounds} rounds`}. Cluster sizes: ${r.sizes.join(', ')}.\nCost (within-cluster sum of squares): ${f3(r.wcss)}\nCentres: ${r.centroids.map(at).join('  ')}\n${c['distance computations'] || 0} distance computations.`,
    experiment: {
      title: 'Work done as the number of points grows',
      note: 'Each point is a real run on n points drawn from four blobs with k = 4, counting every point-to-centre distance computed until convergence. One assignment pass costs n × k distances, so the total is that times the number of rounds, and the number of rounds depends on the data and on the start. The reference line is scaled to the last measured point.',
      metric: 'distance computations',
      metricLabel: 'Distance computations until convergence',
      sizeLabel: 'Number of points (n)',
      sizes: [50, 100, 200, 400, 800, 1600],
      variants: [
        { id: 'random', label: 'Random start' },
        { id: 'plusplus', label: 'k-means++ start' },
      ],
      input: (n, variant, seed) => ({ blobs: 4, points: n, seed, k: 4, init: variant, initSeed: seed, custom: [] }),
      theory: [{ label: 'proportional to n (scaled)', fn: (n) => n, scaled: true, variant: 'plusplus' }],
    },
  },

  logic: {
    intuition: 'The problem has two unknowns that depend on each other: which cluster each point belongs to, and where each cluster\'s centre is. If the centres were known, the best assignment would be obvious: nearest centre. If the assignment were known, the best centres would be obvious: the mean of each group. k-means guesses one, solves for the other, and alternates. Each half-step is the best possible answer to its own half of the problem, so the cost can only go down.',
    steps: [
      'Choose k and place k starting centres. This page offers random data points, the k-means++ rule, or the first k points.',
      'Assignment step: for every point, compute the distance to each centre and assign the point to the nearest one. Ties go to the lower-numbered centre.',
      'If no point changed cluster in that step, stop.',
      'Update step: move each centre to the mean of the points assigned to it. A centre with no points stays where it is.',
      'Go back to the assignment step.',
    ],
    pseudocode: [
      'k_means(points, k):',
      '  place k starting centres',
      '  repeat:',
      '    for each point p:',
      '      give p to nearest centre',
      '    if no point changed: stop',
      '    for each centre c:',
      '      c ← mean of its points',
      '  return centres, clusters',
    ],
    decisions: [
      { title: 'Where should the centres start?', text: 'Uniformly random data points are simple but often put two centres in one group. k-means++ picks the first centre at random and each later one with probability proportional to its squared distance from the nearest centre already chosen, which spreads the starts out and comes with a guarantee on the expected cost. Neither removes the need to try several starts and keep the cheapest result.' },
      { title: 'How many clusters?', text: 'The algorithm cannot say. The cost always falls as k rises, reaching zero when every point is its own cluster, so minimizing cost over k is useless. Common aids are to plot cost against k and look for the bend where improvement slows, or to use a score such as the silhouette that also rewards separation. Often the right k comes from the purpose: the number of colours a display allows, or the number of groups a team can act on.' },
      { title: 'When to stop?', text: 'This page stops when an assignment step changes nothing, which is exact convergence. On large data it is common to stop earlier, when the cost improves by less than a small fraction or after a fixed number of rounds.' },
      { title: 'What about an empty cluster?', text: 'If no point chooses a centre, its mean is undefined. This page leaves the centre where it is. Libraries often move it to the point farthest from its current centre.' },
    ],
    invariants: [
      'The cost never increases: not after an assignment step, and not after an update step.',
      'After an assignment step, every point belongs to the cluster of a centre nearest to it.',
      'After an update step, every centre that has points is exactly the mean of those points.',
    ],
    edgeCases: [
      'k = 1: one round places the single centre at the mean of all points.',
      'k equal to the number of distinct points: every point becomes its own centre and the cost is zero.',
      'Two starting centres on identical points: one of them receives every tied point and the other may be left empty.',
      'A point exactly halfway between two centres: the tie-breaking rule decides, and must be consistent or the loop could cycle.',
      'Features on different scales: the feature with the largest spread dominates the squared distance and decides the clusters.',
      'An outlier: one distant point can capture a centre of its own, or drag a centre away from the middle of its group.',
    ],
    correctness: 'The algorithm is guaranteed to **stop**, and to stop at a grouping that neither step can improve. Each assignment step moves points only to centres that are at least as close, so the cost cannot rise. Each update step replaces a centre by the mean of its points, which is the single position that minimizes the sum of squared distances to them. There are only finitely many ways to split n points into k groups. Whenever a centre moves, the cost strictly falls, and if no centre moves the next assignment step changes nothing. So no grouping can come back once it has been left, and the loop must end. What is **not** guaranteed is that the stopping point is the best grouping. It is a local optimum, and how good it is depends on the start. Finding the global optimum is NP-hard.',
    mistakes: [
      'Running it once and trusting the result. One run shows one local optimum.',
      'Comparing costs for different values of k and choosing the lowest. More clusters always cost less.',
      'Dividing by the total number of points when averaging a cluster, in place of the number of points in that cluster.',
      'Forgetting to rescale the features first.',
      'Treating cluster numbers as meaningful. "Cluster 1" in one run may be "cluster 3" in the next.',
      'Assuming the clusters found are real. The method returns k groups for any data, including data with no structure at all.',
    ],
  },

  code: {
    sample: {
      input: 'Cluster eight points that form two squares into k = 2 groups, starting from the first two points, printing the centres and the cost after each round.',
      expected: 'round 1: 8 changed, centres (1.00, 1.50) (6.33, 6.17), cost 124.67\nround 2: 2 changed, centres (1.50, 1.50) (8.50, 8.50), cost 4.00\nround 3: no point changed cluster, stop\nclusters: 1 1 1 1 2 2 2 2',
    },
    python: {
      source: `points = [(1, 1), (2, 1), (1, 2), (2, 2), (8, 8), (9, 8), (8, 9), (9, 9)]
k = 2
centres = [[float(points[j][0]), float(points[j][1])] for j in range(k)]
assign = [-1] * len(points)


def dist2(p, c):
    return (p[0] - c[0]) * (p[0] - c[0]) + (p[1] - c[1]) * (p[1] - c[1])


round_no = 0
while True:
    round_no += 1
    changed = 0
    for i, p in enumerate(points):  # assignment step
        best = 0
        for j in range(1, k):
            if dist2(p, centres[j]) < dist2(p, centres[best]):
                best = j
        if assign[i] != best:
            assign[i] = best
            changed += 1
    if changed == 0:
        print(f"round {round_no}: no point changed cluster, stop")
        break
    for j in range(k):  # update step
        sx, sy, m = 0.0, 0.0, 0
        for i, p in enumerate(points):
            if assign[i] == j:
                sx += p[0]
                sy += p[1]
                m += 1
        if m > 0:
            centres[j] = [sx / m, sy / m]
    cost = 0.0
    for i, p in enumerate(points):
        cost += dist2(p, centres[assign[i]])
    where = " ".join(f"({c[0]:.2f}, {c[1]:.2f})" for c in centres)
    print(f"round {round_no}: {changed} changed, centres {where}, cost {cost:.2f}")

print("clusters: " + " ".join(str(a + 1) for a in assign))`,
      notes: [
        { line: 3, text: 'The starting centres. Here they are the first two points, which both lie in the same square, so the first round is a poor split.' },
        { line: 18, text: 'A strict "less than" means a tie goes to the lower-numbered centre. A consistent rule here is what guarantees the loop ends.' },
        { line: 23, text: 'Convergence test: an assignment step that changes nothing. The update step would then change nothing either.' },
        { line: 34, text: 'A centre becomes the mean of its own points. Dividing by m, the size of this cluster, is the detail most often got wrong. A cluster with no points keeps its old centre.' },
        { line: 35, text: 'The cost, measured after the update. It is printed each round so you can see that it only falls.' },
      ],
    },
    javascript: {
      source: `const points = [[1, 1], [2, 1], [1, 2], [2, 2], [8, 8], [9, 8], [8, 9], [9, 9]];
const k = 2;
const centres = [];
for (let j = 0; j < k; j++) centres.push([points[j][0], points[j][1]]);
const assign = new Array(points.length).fill(-1);

const dist2 = (p, c) => (p[0] - c[0]) * (p[0] - c[0]) + (p[1] - c[1]) * (p[1] - c[1]);

let round = 0;
while (true) {
  round++;
  let changed = 0;
  for (let i = 0; i < points.length; i++) { // assignment step
    let best = 0;
    for (let j = 1; j < k; j++) {
      if (dist2(points[i], centres[j]) < dist2(points[i], centres[best])) best = j;
    }
    if (assign[i] !== best) {
      assign[i] = best;
      changed++;
    }
  }
  if (changed === 0) {
    console.log("round " + round + ": no point changed cluster, stop");
    break;
  }
  for (let j = 0; j < k; j++) { // update step
    let sx = 0, sy = 0, m = 0;
    for (let i = 0; i < points.length; i++) {
      if (assign[i] === j) {
        sx += points[i][0];
        sy += points[i][1];
        m++;
      }
    }
    if (m > 0) centres[j] = [sx / m, sy / m];
  }
  let cost = 0;
  for (let i = 0; i < points.length; i++) cost += dist2(points[i], centres[assign[i]]);
  const where = centres.map((c) => "(" + c[0].toFixed(2) + ", " + c[1].toFixed(2) + ")").join(" ");
  console.log("round " + round + ": " + changed + " changed, centres " + where + ", cost " + cost.toFixed(2));
}

console.log("clusters: " + assign.map((a) => a + 1).join(" "));`,
    },
    cpp: {
      source: `#include <cstdio>
#include <vector>

struct P { double x, y; };

double dist2(const P& p, const P& c) {
    return (p.x - c.x) * (p.x - c.x) + (p.y - c.y) * (p.y - c.y);
}

int main() {
    const std::vector<P> points = {{1, 1}, {2, 1}, {1, 2}, {2, 2}, {8, 8}, {9, 8}, {8, 9}, {9, 9}};
    const int n = (int)points.size(), k = 2;
    std::vector<P> centres(points.begin(), points.begin() + k);
    std::vector<int> assign(n, -1);

    int round = 0;
    while (true) {
        ++round;
        int changed = 0;
        for (int i = 0; i < n; ++i) {  // assignment step
            int best = 0;
            for (int j = 1; j < k; ++j) {
                if (dist2(points[i], centres[j]) < dist2(points[i], centres[best])) best = j;
            }
            if (assign[i] != best) {
                assign[i] = best;
                ++changed;
            }
        }
        if (changed == 0) {
            std::printf("round %d: no point changed cluster, stop\\n", round);
            break;
        }
        for (int j = 0; j < k; ++j) {  // update step
            double sx = 0.0, sy = 0.0;
            int m = 0;
            for (int i = 0; i < n; ++i) {
                if (assign[i] == j) {
                    sx += points[i].x;
                    sy += points[i].y;
                    ++m;
                }
            }
            if (m > 0) centres[j] = {sx / m, sy / m};
        }
        double cost = 0.0;
        for (int i = 0; i < n; ++i) cost += dist2(points[i], centres[assign[i]]);
        std::printf("round %d: %d changed, centres", round, changed);
        for (const P& c : centres) std::printf(" (%.2f, %.2f)", c.x, c.y);
        std::printf(", cost %.2f\\n", cost);
    }

    std::printf("clusters:");
    for (int a : assign) std::printf(" %d", a + 1);
    std::printf("\\n");
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'One round is cheap: every point is compared with every centre, then every centre is averaged. With n points, k clusters and d features that is O(nkd). The total cost is that times the number of rounds, which is small on typical data but has no good worst-case bound. And the answer reached is a local optimum of a problem whose exact solution is NP-hard.',
    cases: [
      { case: 'One assignment step', time: 'O(nkd)', when: 'n × k distances, each over d features.' },
      { case: 'One update step', time: 'O(nd)', when: 'Each point is added into one running sum.' },
      { case: 'Typical run', time: 'O(nkd·i)', when: 'i rounds until no point changes. On well-separated data i is usually a few to a few tens.' },
      { case: 'Worst case', time: 'Exponentially many rounds', when: 'Constructed inputs exist, even in the plane, on which the number of rounds grows exponentially with n. They do not resemble ordinary data.' },
      { case: 'k-means++ seeding', time: 'O(nkd)', when: 'One pass over the points for each centre chosen.' },
      { case: 'Exact optimum', time: 'NP-hard', when: 'No polynomial-time algorithm is known for minimizing the cost exactly. The loop on this page does not attempt it.' },
    ],
    space: 'O(nd) for the points, O(kd) for the centres and O(n) for the assignment.',
    memory: 'The algorithm keeps one cluster number per point and one running sum per cluster. Mini-batch variants process a small random sample of points per step and can cluster data that do not fit in memory.',
    tradeoffs: 'Each round is fast and simple, and the method scales to very large data. In exchange it returns only a local optimum, needs k in advance, and is sensitive to the starting centres, to feature scaling and to outliers. Running it from several starts multiplies the cost by the number of starts.',
    assumptions: [
      'Distance is squared Euclidean distance, and one distance costs O(d). On this page d = 2.',
      'The number of rounds is not bounded by a small polynomial in the worst case. The "typical run" row describes behaviour on ordinary data, not a guarantee.',
      'NP-hardness refers to minimizing the within-cluster sum of squares exactly, for general inputs.',
      'The experiment counts distances on generated blob data and includes the k-means++ seeding distances. It is an illustration, not a benchmark.',
    ],
  },

  tradeoffs: {
    excels: [
      'Compact, roughly round clusters of similar size.',
      'Large datasets, because each round is a single pass.',
      'Tasks where the centres themselves are the goal, such as choosing a palette of representative colours.',
      'A quick first look at the structure of unlabelled data.',
    ],
    struggles: [
      'Elongated, curved or nested clusters. The method draws straight borders halfway between centres.',
      'Clusters of very different sizes or densities. Large clusters get split and small ones absorbed.',
      'Data with outliers, which pull means strongly.',
      'Features that are categories, where an average has no meaning.',
    ],
    pitfalls: [
      'Reporting the result of a single random start.',
      'Choosing k by minimizing the cost.',
      'Clustering features in their raw units.',
      'Reading meaning into clusters without checking that they are stable across starts and across samples of the data.',
    ],
    misunderstandings: [
      "\"k-means finds the best grouping.\" It finds a grouping that its own two steps cannot improve. A better one may exist, and a different start may find it.",
      "\"It works out how many groups there are.\" It is told k and always returns exactly k clusters, even for data with a different number of groups or none.",
      "\"The lower the cost, the better the clustering.\" Only when k is the same. Raising k always lowers the cost, down to zero when every point is alone.",
      "\"If it converged, it worked.\" Convergence only means that nothing changes any more. The \"A bad start\" preset converges too, to a result with more than four times the cost.",
      "\"k-means and k-nearest neighbours are versions of the same thing.\" They share a letter. k-means groups unlabelled data and k is the number of groups. k-nearest neighbours classifies with labelled data and k is the number of voters.",
    ],
    constraints: [
      'Standard practice is k-means++ seeding with several restarts, keeping the lowest cost.',
      'For very large data, mini-batch k-means trades a little accuracy for much less computation per step.',
    ],
    alternatives: [
      { name: 'Gaussian mixture models (expectation-maximization)', when: 'Clusters overlap or are elongated, and a soft, probabilistic assignment is wanted.' },
      { name: 'DBSCAN', when: 'Clusters have irregular shapes, the number of clusters is unknown, and some points should be treated as noise.' },
      { name: 'Hierarchical clustering', when: 'A nested tree of groupings at every scale is more useful than a single partition.' },
      { name: 'k-medoids', when: 'Centres must be actual data points, or only pairwise dissimilarities are available.' },
      { id: 'pca', name: 'Principal Component Analysis', when: 'The goal is to summarize the data along a few directions of greatest spread, not to split them into groups.' },
    ],
    comparison: {
      columns: ['', 'Random data points', 'k-means++', 'Several restarts'],
      rows: [
        ['How centres start', 'k points, all equally likely', 'Later centres favour points far from earlier ones', 'Either rule, repeated'],
        ['Cost of seeding', 'O(k)', 'O(nkd)', 'Multiplies the whole run'],
        ['Guarantee on cost', 'None', 'Expected cost within O(log k) of the optimum', 'No worse than the best single start'],
        ['Can still get stuck', 'Often', 'Less often', 'Less often with each restart'],
      ],
    },
  },

  applications: [
    { title: 'Colour quantization', status: 'established', text: 'Treat every pixel\'s colour as a point in three dimensions and cluster with k equal to the palette size. Replacing each pixel by its cluster\'s centre reduces an image to k colours with small squared colour error.' },
    { title: 'Vector quantization of signals', status: 'established', text: 'Lloyd invented the method for the one-dimensional case, choosing the levels to which a signal is rounded. Extended to vectors, it learns a codebook of k representative vectors, and each piece of signal is stored or transmitted as the index of its nearest codeword. The same idea, applied to pieces of vectors, underlies product quantization in similarity search.' },
    { title: 'Image segmentation', status: 'established', text: 'Clustering pixels by colour, sometimes with position added as extra features, divides an image into regions of similar appearance. It is a simple baseline in computer vision.' },
    { title: 'Grouping customers or documents', status: 'established', text: 'Records are described by numeric features and clustered so that each group can be examined or treated separately. The clusters are a description of the data, and need checking before anyone acts on them.' },
    { title: 'Starting values for mixture models', status: 'established', text: 'The expectation-maximization algorithm for Gaussian mixtures is commonly started from the centres and groupings found by k-means.' },
    { title: 'Placing a few service points', status: 'illustrative', text: 'Given the locations of many households, k-means suggests k sites that keep squared straight-line distances small. Real siting has to respect roads, costs and land, so this is a first sketch only.' },
  ],

  connections: [
    { to: 'concept:unsupervised-learning', type: 'prerequisite', why: 'There are no labels. The method looks for structure in the inputs alone.' },
    { to: 'concept:distance-metric', type: 'prerequisite', why: 'Both steps are defined by squared Euclidean distance: points go to the nearest centre, and the mean is the point that minimizes squared distance.' },
    { to: 'concept:local-search', type: 'prerequisite', why: 'Each step moves to a neighbouring solution that is no worse, and the method stops when no such move improves the cost. It shares the weakness of all local search: it stops at a local optimum.' },
    { to: 'concept:np-hardness', type: 'related', why: 'Minimizing the k-means cost exactly is NP-hard, which is why a fast method that settles for a local optimum is used in practice.' },
    { to: 'concept:convergence', type: 'related', why: 'The cost is bounded below and never increases, and the number of possible groupings is finite, so the iteration must stop.' },
    { to: 'knn', type: 'related', why: 'Both decide by nearest distance. Nearest neighbours compares a query with labelled examples that stay fixed; k-means compares points with unlabelled centres that move.' },
    { to: 'gradient-descent', type: 'related', why: 'Both lower a cost step by step and stop at a point that depends on where they started. k-means takes exact minimizing steps in two alternating blocks of variables, with no learning rate.' },
    { to: 'simulated-annealing', type: 'same-problem', why: 'When a local search keeps getting stuck, annealing accepts some uphill moves to escape. Random restarts are the simpler remedy usually used with k-means.' },
    { to: 'pca', type: 'related', why: 'Both summarize unlabelled data by minimizing a squared reconstruction error: k-means replaces each point by one of k centres, principal component analysis by its projection onto a few directions.' },
    { to: 'ddpm', type: 'advanced', why: 'Both learn from unlabelled data. k-means summarizes a dataset with k points; a diffusion model learns the whole distribution well enough to draw new samples from it.' },
    { to: 'discipline:computer-vision', type: 'application', why: 'Clustering pixel colours gives palettes and simple segmentations.' },
    { to: 'discipline:information-theory', type: 'application', why: 'A set of k centres is a quantizer: it encodes each input as one of k symbols with the least mean squared distortion the local search can find.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why can the cost never go up during an update step?',
      options: ['Because the centres move toward the origin', 'Because the mean of a group of points is the position with the smallest total squared distance to them', 'Because the learning rate is small', 'Because points switch to closer centres'],
      answer: 1,
      explain: [
        'Centres move toward the middle of their own points, wherever that is.',
        'Correct. Moving a centre to the mean of its points is the best possible move for that cluster, so each cluster\'s share of the cost can only fall or stay the same.',
        'There is no learning rate in k-means. Each step jumps directly to the best position.',
        'That is why the cost cannot rise in the assignment step. The update step moves centres, not points.',
      ],
    },
    {
      type: 'predict',
      q: 'Eight points form two rows of four: (1,1), (3,1), (7,1), (9,1) along the bottom and (1,3), (3,3), (7,3), (9,3) along the top. With k = 2 and centres starting at (1,1) and (1,3), which clusters does k-means end with?',
      options: ['The four points on the left and the four on the right, with cost 16', 'The bottom row and the top row, with cost 80', 'It never converges', 'One cluster of seven points and one of a single point'],
      answer: 1,
      explain: [
        'That is the best grouping, and five times cheaper. But this start cannot reach it.',
        'Correct. Each bottom point is nearer to the start at (1,1) and each top point to the start at (1,3). The centres move to (5,1) and (5,3), every point is still with its nearest centre, and the algorithm stops at a local optimum.',
        'k-means always converges. The cost cannot rise and there are finitely many groupings.',
        'Each starting centre attracts its whole row, four points each.',
      ],
      tryInput: { custom: TWO_ROWS, k: 2, init: 'first' },
    },
    {
      type: 'debug',
      q: 'With this update step, every centre ends up much closer to the origin than the points of its own cluster. What is wrong?',
      code: `for j in range(k):
    sx, sy = 0.0, 0.0
    for i, p in enumerate(points):
        if assign[i] == j:
            sx += p[0]
            sy += p[1]
    centres[j] = [sx / len(points), sy / len(points)]`,
      options: ['The sums should include every point, not only those in cluster j', 'It divides by the total number of points when it should divide by the number of points in cluster j', 'The centres should be updated before the points are assigned', 'It should use squared coordinates'],
      answer: 1,
      explain: [
        'Including every point would put all the centres at the same place, the overall mean.',
        'Correct. A mean is the sum divided by how many values were summed. Dividing a cluster\'s sum by the whole dataset\'s size shrinks the result toward zero.',
        'The order of the two steps is not the problem here.',
        'The centre is the mean of the coordinates themselves.',
      ],
    },
    {
      type: 'choice',
      q: 'You run k-means with k = 3 and get a cost of 40. With k = 6 on the same data you get 22. What can you conclude?',
      options: ['The data contain six groups', 'k = 6 is the better clustering', 'Nothing about the right k: the cost falls whenever k rises', 'The k = 3 run was stuck in a local optimum'],
      answer: 2,
      explain: [
        'A lower cost does not show that. Splitting any real group in two also lowers the cost.',
        'Costs are only comparable between runs with the same k.',
        'Correct. More centres mean every point has a closer one. The cost reaches zero when k equals the number of points, which is a useless clustering.',
        'It might have been, but a fall in cost from 3 to 6 clusters is expected either way.',
      ],
    },
    {
      type: 'challenge',
      title: 'Restarts and the elbow',
      prompt: 'Write a function that runs k-means from 20 random starts and returns the result with the lowest cost. On data drawn from four blobs, record how many of the 20 starts reach the lowest cost, first with uniformly random starting points and then with k-means++. Then, using the best-of-20 result each time, plot the cost for k from 1 to 8 and describe where the curve bends and why.',
      hints: [
        'The cost at k = 1 is the total squared distance of all points from their overall mean.',
        'Up to the true number of groups, each added centre removes a large share of the cost. Beyond it, extra centres only split compact groups, and the gain is small.',
      ],
    },
  ],

  compare: {
    idea: 'Alternate between assigning points to the nearest centre and moving each centre to the mean of its points.',
    requires: 'Measurements that are numbers on comparable scales, the number of groups chosen in advance, and starting centres. It finds a good grouping, not always the best one.',
    sensitivity: 'High. Depends on the starting centres, on k, on feature scaling and on outliers.',
    memory: 'O(nd + kd).',
    difficulty: 'low',
    difficultyNote: 'Two short loops. The difficulty is choosing k, starting well, and knowing when the clusters mean something.',
    limits: 'A different start can give a different grouping, and the best one is too hard to guarantee. It expects round, tight groups. You must choose the number of groups yourself.',
    useWhen: 'You want a chosen number of tight groups, or that many representative points, from numeric data, quickly, and can afford to run it several times.',
  },

  advanced: {
    history: 'Stuart Lloyd developed the algorithm at Bell Laboratories in 1957 as a method for pulse-code modulation. It circulated as an internal report and was not formally published until 1982. Edward Forgy published essentially the same procedure in 1965, which is why it is sometimes called the Lloyd-Forgy algorithm, and Hugo Steinhaus had described the underlying idea in 1956. James MacQueen introduced the name "k-means" in 1967 for a closely related method that updates a centre each time a point is assigned. In 2007 David Arthur and Sergei Vassilvitskii proposed the k-means++ seeding rule and proved that it gives an expected cost within a factor of O(log k) of the optimum before the iteration even begins.',
    derivation: 'The objective is the within-cluster sum of squares\n\n$$J(c, \\mu) = \\sum_{i=1}^{n} \\lVert x_i - \\mu_{c(i)} \\rVert^2,$$\n\nwhere $c(i)$ is the cluster of point $i$ and $\\mu_j$ is the centre of cluster $j$. Hold the centres fixed: each term depends on one $c(i)$ only, so $J$ is minimized by $c(i) = \\arg\\min_j \\lVert x_i - \\mu_j \\rVert^2$. That is the assignment step. Hold the assignment fixed: for one cluster $S_j$ with mean $\\bar{x}_j$,\n\n$$\\sum_{i \\in S_j} \\lVert x_i - \\mu \\rVert^2 = \\sum_{i \\in S_j} \\lVert x_i - \\bar{x}_j \\rVert^2 + |S_j|\\,\\lVert \\bar{x}_j - \\mu \\rVert^2,$$\n\nbecause the cross term sums to zero. The right side is smallest when $\\mu = \\bar{x}_j$. That is the update step. The algorithm is therefore coordinate descent on $J$, alternating between the two blocks of variables.',
    proof: 'Convergence. Let $J_t$ be the cost after half-step $t$. By the derivation, each half-step minimizes $J$ over one block with the other fixed, so $J_{t+1} \\le J_t$. There are at most $k^n$ assignments, and after an update step the centres are a function of the assignment alone, so the pair (assignment, centres) takes finitely many values. Suppose an assignment step changes at least one point. If the following update step moves some centre, the cost strictly decreases, because the mean is the unique minimizer for its cluster. If it moves no centre, the next assignment step, which depends only on the centres and a fixed tie-breaking rule, reproduces the same assignment and the algorithm stops. So the cost strictly decreases in every round that is followed by another changing round, no state can recur, and the algorithm reaches an assignment step that changes nothing after finitely many rounds.\n\nNo global guarantee follows. The two-rows example in the quiz is a fixed point with cost 80 when the optimum is 16, and by spreading the rows farther apart along the horizontal axis the ratio can be made as large as desired.',
    complexityProof: 'An assignment step evaluates $nk$ squared distances at $O(d)$ each. An update step adds each point into one sum, $O(nd)$. For the number of rounds, only weak worst-case bounds are known: Vattani (2011) constructed point sets in the plane requiring $2^{\\Omega(n)}$ rounds. Arthur, Manthey and Röglin showed that if the input points are perturbed by small random noise, the expected number of rounds is polynomial, which helps explain why the worst case is not seen in practice. For the problem itself, Aloise, Deshpande, Hansen and Popat (2009) proved that minimizing $J$ is NP-hard even for $k = 2$ when the dimension is part of the input, and Mahajan, Nimbhorkar and Varadarajan (2009) proved NP-hardness in the plane when $k$ is part of the input.',
    variants: [
      { name: 'k-means++', text: 'A seeding rule, not a different iteration. The first centre is a random point; each later centre is a point drawn with probability proportional to its squared distance from the nearest centre chosen so far.' },
      { name: 'MacQueen\'s online k-means', text: 'Processes points one at a time, moving the winning centre a little toward each point as it arrives.' },
      { name: 'Mini-batch k-means', text: 'Uses a small random sample of the points for each update, for data too large to scan every round.' },
      { name: 'k-medoids', text: 'Requires each centre to be one of the data points and works with any dissimilarity measure, which makes it more robust to outliers.' },
      { name: 'Fuzzy c-means', text: 'Gives every point a degree of membership in every cluster in place of a single hard assignment.' },
      { name: 'Gaussian mixture models', text: 'Replace hard assignment by probabilities and let each cluster have its own shape. k-means is the limiting case of equal round clusters with vanishing spread.' },
    ],
    implementation: 'Standardize features first. Use k-means++ seeding and several restarts. Compare squared distances and skip the square root. For large k, bounds based on the triangle inequality avoid most distance computations without changing the result. Decide in advance what to do with an empty cluster.',
    benchmarking: 'Report the cost for a stated k, the seeding rule, the number of restarts and the stopping rule. Because the result is random, report the spread over several seeds. Never compare costs across different values of k as if lower were better.',
    references: [
      { authors: 'S. P. Lloyd', year: 1982, title: 'Least squares quantization in PCM', venue: 'IEEE Transactions on Information Theory 28(2), 129-137' },
      { authors: 'J. MacQueen', year: 1967, title: 'Some methods for classification and analysis of multivariate observations', venue: 'Proceedings of the Fifth Berkeley Symposium on Mathematical Statistics and Probability, volume 1, 281-297' },
      { authors: 'D. Arthur and S. Vassilvitskii', year: 2007, title: 'k-means++: the advantages of careful seeding', venue: 'Proceedings of the Eighteenth Annual ACM-SIAM Symposium on Discrete Algorithms (SODA)' },
      { authors: 'D. Aloise, A. Deshpande, P. Hansen and P. Popat', year: 2009, title: 'NP-hardness of Euclidean sum-of-squares clustering', venue: 'Machine Learning 75' },
      { authors: 'M. Mahajan, P. Nimbhorkar and K. Varadarajan', year: 2009, title: 'The planar k-means problem is NP-hard', venue: 'WALCOM: Algorithms and Computation, Springer' },
      { authors: 'A. Vattani', year: 2011, title: 'k-means requires exponentially many iterations even in the plane', venue: 'Discrete & Computational Geometry 45' },
    ],
    furtherReading: [
      'T. Hastie, R. Tibshirani and J. Friedman, *The Elements of Statistical Learning* (2nd edition), section 14.3, "Cluster Analysis".',
      'C. M. Bishop, *Pattern Recognition and Machine Learning*, chapter 9, which develops k-means and then Gaussian mixtures from it.',
    ],
  },

  tests: [
    { name: 'default run converges to a fixed point with non-increasing cost', input: {}, check: isFixedPoint },
    { name: 'fixed point and monotone cost with k-means++ on four blobs', input: { blobs: 4, points: 120, seed: 5, k: 4, init: 'plusplus', initSeed: 3 }, check: isFixedPoint },
    { name: 'fixed point and monotone cost when k does not match the data', input: { blobs: 3, points: 90, seed: 2, k: 6, init: 'random', initSeed: 8 }, check: isFixedPoint },
    { name: 'the worked example: costs 150, 53.2, 27.28, 4 and centres at 2 and 9', input: { custom: LINE, k: 2, init: 'first' },
      check: (r) => {
        const want = [150, 53.2, 27.28, 4];
        if (r.history.length !== 4 || r.history.some((v, i) => Math.abs(v - want[i]) > 1e-9)) return `cost history ${r.history}`;
        if (Math.abs(r.centroids[0][0] - 2) > 1e-12 || Math.abs(r.centroids[1][0] - 9) > 1e-12) return `centres ${r.centroids}`;
        if (r.assignment.join('') !== '000111' || r.rounds !== 3) return `assignment ${r.assignment}, rounds ${r.rounds}`;
        return isFixedPoint(r);
      } },
    { name: 'two rows of four: stuck at cost 80 although cost 16 exists (quiz prediction)', input: { custom: TWO_ROWS, k: 2, init: 'first' },
      check: (r) => {
        if (Math.abs(r.wcss - 80) > 1e-9 || r.assignment.join('') !== '01010101') return `cost ${r.wcss}, assignment ${r.assignment}`;
        const leftRight = r.points.reduce((s, p) => s + dist2(p, p[0] < 5 ? [2, 2] : [8, 2]), 0);
        if (Math.abs(leftRight - 16) > 1e-9) return `left/right cost ${leftRight}`;
        return isFixedPoint(r);
      } },
    { name: 'the bad-start preset ends far above the k-means++ result on the same data', input: { blobs: 3, points: 60, seed: 3, k: 3, init: 'random', initSeed: 2 },
      check: (r) => {
        const good = quiet({ init: 'plusplus', initSeed: 2 });
        const fine = quiet({ init: 'random', initSeed: 1 });
        if (!(r.wcss > 4 * good.wcss)) return `bad start cost ${r.wcss}, k-means++ cost ${good.wcss}`;
        if (Math.abs(fine.wcss - good.wcss) > 1e-9) return `default start cost ${fine.wcss} differs from k-means++ cost ${good.wcss}`;
        return isFixedPoint(r);
      } },
    { name: 'more clusters cost less on the same data', input: { blobs: 3, points: 60, seed: 3, k: 5, init: 'plusplus', initSeed: 1 },
      check: (r) => { const three = quiet({ k: 3, init: 'plusplus', initSeed: 1 }); return r.wcss < three.wcss || `k=5 cost ${r.wcss}, k=3 cost ${three.wcss}`; } },
    { name: 'k = 1 puts the centre at the overall mean in one round', input: { blobs: 2, points: 30, seed: 4, k: 1, init: 'random', initSeed: 1 },
      check: (r) => {
        const mx = r.points.reduce((s, p) => s + p[0], 0) / r.n, my = r.points.reduce((s, p) => s + p[1], 0) / r.n;
        return (Math.hypot(r.centroids[0][0] - mx, r.centroids[0][1] - my) < 1e-9 && r.rounds === 2) || `centre ${r.centroids[0]}, rounds ${r.rounds}`;
      } },
  ],
};
