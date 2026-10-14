import { makeDataset, datasetOptions, datasetById, probabilityHeat, CLASS_ROLES, DATA_RANGE } from '../../js/lib/datasets.js';

const f2 = (v) => v.toFixed(2);
const f3 = (v) => v.toFixed(3);
const pct = (v) => `${(100 * v).toFixed(1)}%`;

function resolvePoints(input) {
  if (Array.isArray(input.custom) && input.custom.length) {
    const c = input.custom;
    if (c.length % 3 !== 0 || c.length < 6) throw new Error('Type your own points as x, y, class triples (class 0 or 1), with at least two points.');
    const pts = [];
    for (let i = 0; i < c.length; i += 3) {
      if (c[i + 2] !== 0 && c[i + 2] !== 1) throw new Error('The third number of every triple is the class and must be 0 or 1.');
      pts.push({ x: c[i], y: c[i + 1], label: c[i + 2] });
    }
    return pts;
  }
  return makeDataset({ dataset: input.dataset, points: input.points, seed: input.seed }).points;
}

// The k nearest of `pts` to (qx, qy), closest first, skipping index `skip`. Ties in distance
// keep the earlier point first. `onPoint` lets the visualization watch every comparison.
function kNearest(pts, qx, qy, k, skip, onPoint) {
  const nearest = []; // { i, d }, sorted by distance, at most k long
  for (let i = 0; i < pts.length; i++) {
    if (i === skip) continue;
    const d = Math.hypot(pts[i].x - qx, pts[i].y - qy);
    let kept = false, dropped = null;
    if (nearest.length < k || d < nearest[nearest.length - 1].d) {
      let pos = nearest.length;
      while (pos > 0 && nearest[pos - 1].d > d) pos--;
      nearest.splice(pos, 0, { i, d });
      if (nearest.length > k) dropped = nearest.pop();
      kept = true;
    }
    if (onPoint) onPoint(i, d, kept, dropped, nearest);
  }
  return nearest;
}

// Majority label among the neighbours. A tie goes to the label of the single nearest one.
function vote(pts, nearest) {
  const votes = [0, 0];
  for (const nb of nearest) votes[pts[nb.i].label]++;
  const label = votes[0] === votes[1] ? pts[nearest[0].i].label : votes[0] > votes[1] ? 0 : 1;
  return { votes, label, tie: votes[0] === votes[1] };
}

function run(input, t) {
  const pts = resolvePoints(input);
  const n = pts.length;
  const k = input.k;
  if (k > n - 1) throw new Error(`k is ${k} but there are only ${n} training points. Choose k below the number of points.`);
  const qx = input.queryX, qy = input.queryY;

  const scene = ({ scanning = null, nearest = [], counted = 0, verdict = null, regions = false } = {}) => {
    const layers = [];
    if (regions) layers.push(probabilityHeat((x, y) => vote(pts, kNearest(pts, x, y, k, -1)).label, { cells: 30 }));
    if (nearest.length === k && scanning === null) layers.push({ type: 'circle', c: [qx, qy], r: nearest[k - 1].d, role: 'compare', fill: !regions, width: 1.2 });
    if (scanning !== null) layers.push({ type: 'segments', segments: [[qx, qy, pts[scanning].x, pts[scanning].y]], role: 'compare', width: 1.6 });
    const segs = [[], []];
    nearest.forEach((nb, idx) => { if (idx < counted) segs[pts[nb.i].label].push([qx, qy, pts[nb.i].x, pts[nb.i].y]); });
    const waiting = nearest.filter((_, idx) => idx >= counted && scanning === null).map((nb) => [qx, qy, pts[nb.i].x, pts[nb.i].y]);
    if (waiting.length) layers.push({ type: 'segments', segments: waiting, role: 'compare', width: 1.2, alpha: 0.8 });
    for (const c of [0, 1]) if (segs[c].length) layers.push({ type: 'segments', segments: segs[c], role: CLASS_ROLES[c], width: 2 });
    for (const c of [0, 1]) layers.push({ type: 'points', points: pts.filter((p) => p.label === c).map((p) => [p.x, p.y]), role: CLASS_ROLES[c], r: 4 });
    if (nearest.length) layers.push({ type: 'points', points: nearest.map((nb) => [pts[nb.i].x, pts[nb.i].y]), role: 'compare', hollow: true, r: 8 });
    if (scanning !== null) layers.push({ type: 'points', points: [[pts[scanning].x, pts[scanning].y]], role: 'ink', hollow: true, r: 8 });
    layers.push({ type: 'points', points: [{ x: qx, y: qy, label: 'query' }], role: verdict === null ? 'ink' : CLASS_ROLES[verdict], r: 6.5, ring: true });
    if (verdict !== null) layers.push({ type: 'points', points: [[qx, qy]], role: 'ink', hollow: true, r: 6.5 });
    const legend = [{ label: 'class 0', role: CLASS_ROLES[0] }, { label: 'class 1', role: CLASS_ROLES[1] }, { label: 'query point', role: 'ink' }, { label: `the ${k} nearest found so far`, role: 'compare' }];
    if (regions) legend.push({ label: 'shaded area: a query placed here would be labelled class 1', role: CLASS_ROLES[1] });
    return { kind: 'scene', title: 'Training points and the query', x: DATA_RANGE, y: DATA_RANGE, aspect: 0.7, equal: true, axes: { xLabel: 'feature 1', yLabel: 'feature 2' }, layers, legend };
  };
  const strip = (nearest, counted, votes) => ({
    kind: 'rows',
    rows: [
      { label: `Nearest ${k}`, cells: nearest.map((nb, idx) => ({ t: `#${nb.i + 1}`, sub: f2(nb.d), role: idx < counted || counted < 0 ? CLASS_ROLES[pts[nb.i].label] : 'compare' })) },
      { label: 'Votes', cells: votes ? [{ t: String(votes[0]), sub: 'class 0', role: CLASS_ROLES[0] }, { t: String(votes[1]), sub: 'class 1', role: CLASS_ROLES[1] }] : [] },
    ],
  });

  const where = Array.isArray(input.custom) && input.custom.length ? 'your own points' : `the "${datasetById[input.dataset].label}" set`;
  t.frame(() => ({ line: 0,
    note: `${n} training points from ${where}, each already labelled class 0 or class 1. The ringed ink point at (${f2(qx)}, ${f2(qy)}) is the **query**: a new point with no label. Nothing has been learned in advance. To label the query, find the ${k} training point${k === 1 ? '' : 's'} closest to it and let ${k === 1 ? 'it' : 'them'} vote.`,
    views: [scene(), strip([], 0, null)], vars: { k, n } }));

  const nearest = kNearest(pts, qx, qy, k, -1, (i, d, kept, dropped, list) => {
    t.count('distance computations');
    const snap = list.slice();
    t.frame(() => {
      let what;
      if (!kept) what = `That is farther than all ${k} kept so far (the farthest of them is ${f3(snap[snap.length - 1].d)} away), so ignore it.`;
      else if (dropped) what = `That is closer than point #${dropped.i + 1} at ${f3(dropped.d)}, so #${i + 1} joins the nearest list and #${dropped.i + 1} drops out.`;
      else what = `The list holds fewer than ${k} points, so #${i + 1} joins it.`;
      return { line: kept ? [3, 4, 5, 6] : [3, 4], note: `Point #${i + 1} (class ${pts[i].label}) is **${f3(d)}** from the query. ${what}`,
        views: [scene({ scanning: i, nearest: snap }), strip(snap, 0, null)], vars: { point: i + 1, distance: f3(d), kept: kept ? 'yes' : 'no' } };
    });
  });

  t.frame(() => ({ line: 7,
    note: `Every point has been measured: ${n} distances. The ${k} nearest are ringed, and the circle through the farthest of them (radius ${f3(nearest[k - 1].d)}) shows the neighbourhood. Now count their labels.`,
    views: [scene({ nearest }), strip(nearest, 0, [0, 0])], vars: { k, radius: f3(nearest[k - 1].d) } }));

  const tally = [0, 0];
  nearest.forEach((nb, idx) => {
    tally[pts[nb.i].label]++;
    const snap = tally.slice();
    t.frame(() => ({ line: 7,
      note: `Neighbour ${idx + 1} of ${k}: point #${nb.i + 1}, ${f3(nb.d)} away, votes **class ${pts[nb.i].label}**. The count is ${snap[0]} for class 0 and ${snap[1]} for class 1.`,
      views: [scene({ nearest, counted: idx + 1 }), strip(nearest, idx + 1, snap)], vars: { 'class 0': snap[0], 'class 1': snap[1] } }));
  });

  const result = vote(pts, nearest);
  t.frame(() => ({ line: 8,
    note: result.tie
      ? `The vote is tied ${result.votes[0]} to ${result.votes[1]}. This page breaks a tie with the label of the single nearest neighbour, point #${nearest[0].i + 1}, so the query is labelled **class ${result.label}**.`
      : `Class ${result.label} wins ${Math.max(...result.votes)} to ${Math.min(...result.votes)}, so the query is labelled **class ${result.label}**. This is a prediction, not a fact: it says what the query's neighbours look like.`,
    views: [scene({ nearest, counted: k, verdict: result.label }), strip(nearest, k, result.votes)], vars: { prediction: `class ${result.label}`, 'class 0': result.votes[0], 'class 1': result.votes[1] } }));

  // Leave-one-out accuracy: classify every training point from the other n - 1 points.
  let correct = 0;
  for (let i = 0; i < n; i++) if (vote(pts, kNearest(pts, pts[i].x, pts[i].y, k, i)).label === pts[i].label) correct++;
  const accuracy = correct / n;

  t.frame(() => ({ line: 8,
    note: `Repeating the same vote for a query at every position on a 30 by 30 grid gives the shading: a query placed in the shaded area would be labelled class 1, and anywhere else class 0. The edge of the shading is the **decision boundary**. It was never computed or stored. It is only a consequence of where the training points sit. Leave-one-out check: hide each training point in turn and classify it from the other ${n - 1}. ${correct} of ${n} come out right, an accuracy of **${pct(accuracy)}**.`,
    views: [scene({ nearest, counted: k, verdict: result.label, regions: true }), strip(nearest, k, result.votes)], vars: { prediction: `class ${result.label}`, 'leave-one-out accuracy': pct(accuracy) } }));

  return { accuracy, correct, n, k, prediction: result.label, votes: result.votes, tie: result.tie, neighbours: nearest.map((nb) => nb.i), distances: nearest.map((nb) => nb.d), query: [qx, qy] };
}

// Independent check used by the tests: sort all distances, take the first k.
function bruteForce(pts, qx, qy, k, skip = -1) {
  const all = pts.map((p, i) => ({ i, d: Math.hypot(p.x - qx, p.y - qy) })).filter((o) => o.i !== skip);
  all.sort((a, b) => a.d - b.d || a.i - b.i);
  const top = all.slice(0, k);
  const ones = top.filter((o) => pts[o.i].label === 1).length;
  const label = ones * 2 === k ? pts[top[0].i].label : ones * 2 > k ? 1 : 0;
  return { top, label };
}
function matchesBruteForce(r, counters, ctx) {
  const pts = resolvePoints(ctx.input);
  const ref = bruteForce(pts, r.query[0], r.query[1], r.k);
  if (ref.top.map((o) => o.i).join() !== r.neighbours.join()) return `neighbours ${r.neighbours} differ from the sorted reference ${ref.top.map((o) => o.i)}`;
  if (ref.label !== r.prediction) return `prediction ${r.prediction}, reference ${ref.label}`;
  let correct = 0;
  pts.forEach((p, i) => { if (bruteForce(pts, p.x, p.y, r.k, i).label === p.label) correct++; });
  if (Math.abs(correct / pts.length - r.accuracy) > 1e-12) return `leave-one-out accuracy ${r.accuracy}, reference ${correct / pts.length}`;
  if (counters['distance computations'] !== pts.length) return `expected ${pts.length} distance computations, counted ${counters['distance computations']}`;
  return true;
}

const EXAMPLE = [0.3, 0.4, 1, -0.6, 0, 0, 0, -0.8, 0, 0.6, 0.8, 1, 1.2, 0.5, 1, -1.2, -0.9, 0];
// Eight points for the quiz, four of each class. From (0, 0) they lie at distances 0.4, 0.5, 0.6,
// 0.7, 1.0, 1.3, 1.5 and about 1.7, with classes 0, 0, 1, 1, 1, 0, 0, 1 in that order.
const EIGHT = [-0.4, 0, 0, -0.3, 0.4, 0, 0.6, 0, 1, 0.42, -0.56, 1, 0.6, 0.8, 1, -1.2, 0.5, 0, -0.9, -1.2, 0, 1.2, 1.2, 1];

export default {
  meta: {
    id: 'knn',
    name: 'k-Nearest Neighbours',
    aliases: ['k-NN', 'kNN', 'k-nearest neighbors', 'nearest neighbour classifier', 'nearest neighbor rule'],
    kind: 'algorithm',
    discipline: 'machine-learning',
    alsoIn: [
      { id: 'statistics', why: 'It began as a nonparametric method of discrimination: classify without assuming any particular shape for the distribution of each class.' },
      { id: 'computational-geometry', why: 'Finding the closest stored points to a query is the nearest-neighbour search problem, and the regions of a 1-nearest-neighbour classifier are the Voronoi cells of the training points.' },
    ],
    subfield: 'Supervised learning',
    family: 'Instance-based methods',
    lab: 'machine-learning',
    compareGroup: 'classification',
    year: 1951,
    authors: 'Evelyn Fix, Joseph L. Hodges Jr.',
    summary: 'Labels a new point by majority vote among the k labelled training points closest to it. There is no training step: all the work happens at query time.',
    difficulty: 'beginner',
    order: 610,
    paradigms: ['brute-force'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n) per query', average: 'O(n) per query', worst: 'O(n) per query, no training', class: 'linear' },
    space: { worst: 'O(n): every training point is stored', class: 'linear' },
    tags: {
      problems: ['classify a new example', 'find similar items', 'label by similarity', 'which group does this belong to', 'recommend similar things'],
      techniques: ['majority vote', 'distance metric', 'nearest-neighbour search', 'lazy learning', 'leave-one-out validation'],
      applications: ['machine learning', 'statistics', 'search engines', 'image processing', 'bioinformatics'],
    },
    prerequisites: ['concept:supervised-learning', 'concept:distance-metric', 'concept:feature-space'],
  },

  bigIdea: {
    simple: "k-nearest neighbours is a way to label something new by looking at the labelled things most similar to it. Imagine a map of a town where every house is marked with the football team that family supports. A new family moves in, and you want to guess their team. A sensible guess is to look at the few houses closest to theirs and see which team most of them support. That is the whole method. The letter k is just the number of neighbours you ask. Ask only one, and a single odd household can fool you. Ask five and take the majority, and the guess is steadier. Ask the whole town, and you only learn which team is most popular overall. Computers use the same idea with measurements in place of streets. A fruit can be described by its weight and its colour. Two fruits with similar numbers sit close together on a chart, and a new fruit gets the label that most of its nearest neighbours carry.",
    what: 'k-nearest neighbours classifies a new point by finding the k labelled examples closest to it and returning the label that most of them share. "Closest" is measured with a distance, usually the ordinary straight-line distance between the points. The method keeps the whole training set and makes no summary of it.',
    why: 'Most classifiers assume a shape for the boundary between classes: a line, a curve of some fixed family. Nearest neighbours assumes only that points close together tend to share a label. Fix and Hodges proposed the rule in 1951, and in 1967 Cover and Hart proved that with unlimited data even the single-nearest-neighbour rule makes at most twice as many errors as the best possible classifier.',
    when: 'Use it when similar inputs really do have similar labels, the number of features is small, the training set is of moderate size, and you want a baseline with nothing to train. Avoid it when queries must be answered fast over a huge training set, when there are many features, or when the features are on scales that cannot sensibly be compared. A model that summarizes the data, such as [logistic regression](#/algorithm/logistic-regression), answers queries far more cheaply.',
    interesting: 'There is no training phase at all. "Fitting" the model means storing the data. Everything a learning algorithm normally does up front is postponed until a question is asked, and then paid for in full, for every question. It is the clearest example of the trade between work done before a query and work done during it.',
    where: 'The same find-the-closest-examples step sits behind recommendation by similar users or items, retrieval of similar documents and images from stored vectors, and the filling in of missing values in data tables. As a classifier it is a standard baseline that any more complicated method is expected to beat.',
    analogy: {
      title: 'Asking the nearest houses',
      text: "Notice what you never had to do in that town. You did not need a theory of why people support the teams they do. You did not need to study the town beforehand or boil it down to any rule. You kept the map, and when a new family arrived you walked to the k houses nearest theirs and counted. Everything the method knows is the map itself, and all of its work happens at the moment a question is asked.",
      limits: 'On a street map, distance has an obvious meaning and only two directions matter. Real data may have dozens of measurements in different units, such as grams and centimetres, and then the answer depends on how each one is scaled. With very many measurements, almost every point is far from every other, and the "nearest" neighbours are hardly nearer than the rest. The picture also hides the cost: to be sure which houses are nearest, the plain method measures the distance to every house in town, every time a new family arrives.',
    },
  },

  example: {
    setup: "Six labelled points and one new point, the query, at the centre of the chart. The distance from the query to each point, measured with a ruler, is: point 1 (class 1) at 0.5, point 2 (class 0) at 0.6, point 3 (class 0) at 0.8, point 4 (class 1) at 1.0, point 5 (class 1) at 1.3 and point 6 (class 0) at 1.5. Use k = 3, which means the three nearest points get a vote.",
    steps: [
      "Go through the points one at a time, keeping a list of the three closest seen so far. Points 1, 2 and 3 fill the list with distances 0.5, 0.6 and 0.8.",
      "Point 4 is 1.0 away. The farthest point on the list is 0.8 away, so point 4 is not close enough and the list stays the same.",
      "Points 5 and 6, at 1.3 and 1.5, are farther still. The three nearest are points 1, 2 and 3.",
      "Count their labels. Point 1 votes class 1. Points 2 and 3 vote class 0. The count is 2 for class 0 and 1 for class 1.",
      "Class 0 has the majority, so the query is labelled class 0.",
    ],
    result: "With k = 3 the query is labelled class 0, even though its single closest point is class 1. Change k and the answer changes: with k = 1 only point 1 votes, giving class 1, and with k = 5 the vote is 3 to 2 for class 1. The choice of k is part of the model, and no value is right for every dataset.",
    tryInput: { custom: EXAMPLE, k: 3, queryX: 0, queryY: 0 },
  },

  terms: [
    { term: "Training point", meaning: "An example whose correct label is already known. The method stores all of them." },
    { term: "Label", meaning: "The answer attached to an example, such as the name of its class. Here the labels are class 0 and class 1." },
    { term: "Query", meaning: "A new point with no label, which the method is asked to classify." },
    { term: "Feature", meaning: "One measured number describing an example, such as a weight or a length. Each feature is one axis of the chart." },
    { term: "Distance", meaning: "A number saying how far apart two points are. This page uses straight-line distance, the kind measured with a ruler." },
    { term: "Neighbour", meaning: "A training point close to the query. The k nearest neighbours are the k training points with the smallest distances." },
    { term: "Majority vote", meaning: "Each neighbour names its own label, and the label named most often wins." },
    { term: "Decision boundary", meaning: "The border between the region of the chart where a query would be labelled class 0 and the region where it would be labelled class 1." },
    { term: "Leave-one-out accuracy", meaning: "A fairness check: hide one training point, classify it from all the others, and repeat for every point. The accuracy is the fraction classified correctly." },
    { term: "Overfitting", meaning: "Following the accidents of the particular training points so closely that predictions on new points get worse." },
  ],

  takeaway: "To label something new, find the few known examples most like it and go with the majority.",

  viz: {
    describe: 'A square scatter plot of training points, green for class 0 and terracotta for class 1, with a ringed ink point marking the query. During the scan an ochre segment joins the query to the point being measured, and ochre rings mark the k nearest found so far. After the scan a circle shows the neighbourhood, segments in each class colour show the votes, and the query takes the colour of the winning class. In the last frame the part of the plane where a query would be labelled class 1 is shaded terracotta, and the rest, where it would be labelled class 0, is left clear. A strip below lists the k nearest points with their distances and the running vote count.',
    inputs: [
      { id: 'dataset', type: 'select', label: 'Dataset', options: datasetOptions, default: 'moons' },
      { id: 'points', type: 'range', label: 'Training points', min: 10, max: 80, step: 2, default: 40 },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 1 },
      { id: 'k', type: 'range', label: 'Neighbours (k)', min: 1, max: 15, step: 1, default: 5,
        help: 'How many of the closest training points vote. Odd values cannot tie.' },
      { id: 'queryX', type: 'range', label: 'Query position, horizontal', min: -1.4, max: 1.4, step: 0.05, default: -0.1 },
      { id: 'queryY', type: 'range', label: 'Query position, vertical', min: -1.4, max: 1.4, step: 0.05, default: -0.2 },
      { id: 'custom', type: 'list', label: 'Or type your own training points', default: [], maxLength: 120, min: -1.5, max: 1.5, placeholder: 'e.g. 0.3, 0.4, 1, -0.6, 0, 0',
        help: 'Read as x, y, class triples, with class 0 or 1. Leave empty to use the generated dataset.' },
    ],
    presets: [
      { label: 'Moons, k = 5', values: { dataset: 'moons', points: 40, seed: 1, k: 5, queryX: -0.1, queryY: -0.2, custom: [] } },
      { label: 'k = 1: every point rules its own patch', values: { dataset: 'overlap', points: 40, seed: 1, k: 1, queryX: 0, queryY: 0, custom: [] } },
      { label: 'k = 15: a smooth boundary', values: { dataset: 'overlap', points: 40, seed: 1, k: 15, queryX: 0, queryY: 0, custom: [] } },
      { label: 'XOR corners', values: { dataset: 'xor', points: 40, seed: 1, k: 5, queryX: 0.3, queryY: -0.2, custom: [] } },
      { label: 'A tied vote (k = 4)', values: { dataset: 'overlap', points: 40, seed: 1, k: 4, queryX: 0, queryY: 0, custom: [] } },
      { label: 'Worked example: six points', values: { custom: EXAMPLE, k: 3, queryX: 0, queryY: 0 } },
    ],
    tryThis: [
      { ask: 'Load "k = 1: every point rules its own patch" and go to the last frame. Each training point claims the area around itself, so a single stray point makes an island of its colour inside the other class. Then load "k = 15: a smooth boundary" on the same data. Before you read the output panel: which k has the better leave-one-out accuracy, and is the query at the centre labelled the same by both?',
        reveal: 'k = 15 scores better: 36 of 40 against 30 of 40 for k = 1. The islands are gone, because one stray point can no longer outvote fourteen others. The query changes label too. With k = 1 its single nearest point, 0.05 away, is class 0. With k = 15 the vote is 9 to 6 for class 1.' },
      { ask: 'Run the default moons. The query at (-0.10, -0.20) is labelled class 0 by 3 votes to 2. Now move the horizontal slider one click to the left, to -0.15. Is a move of 0.05 enough to change the label?',
        reveal: 'Yes. At (-0.15, -0.20) one class 0 point drops out of the five nearest and a class 1 point takes its place, so the vote becomes 3 to 2 for class 1. Keep going to -0.25 and it is 4 to 1. Near the boundary a small move of the query changes which points are nearest, and that changes the answer.' },
      { ask: 'Load "XOR corners". The two classes sit in opposite corners, so no straight line can separate them, which is why [logistic regression](#/algorithm/logistic-regression) and the [perceptron](#/algorithm/perceptron) fail on this dataset. How many of the 40 points will nearest neighbours with k = 5 get right when each is classified from the other 39?',
        reveal: 'All 40. In the last frame the shaded region covers the two class 1 corners and leaves the two class 0 corners clear. Nothing was changed to make this work: the method never assumes a shape for the boundary, so a boundary with a corner in it costs no more than a straight one.' },
      { ask: 'Load the worked example and set k to 1, 3 and then 5 to confirm the answers worked out by hand. Then try the even values. With k = 2 the vote is one each, and with k = 4 it is two each. What label does the query get?',
        reveal: 'Class 1 both times. The output panel says "tie broken by the nearest neighbour": when the vote is level, the single closest point decides, and here that is point 1, class 1, at distance 0.5. Every implementation has to choose some rule for this case. An odd k with two classes avoids the question.' },
    ],
    run,
    report: (r, c) => `Query (${f2(r.query[0])}, ${f2(r.query[1])}) is labelled class ${r.prediction}: votes ${r.votes[0]} for class 0, ${r.votes[1]} for class 1${r.tie ? ' (tie broken by the nearest neighbour)' : ''}.\n${c['distance computations'] || 0} distance computations for this one query, and no training.\nLeave-one-out accuracy with k = ${r.k}: ${pct(r.accuracy)} (${r.correct} of ${r.n} training points classified correctly from the others).`,
    experiment: {
      title: 'The cost of one query as the training set grows',
      note: 'Each point is a real run that classifies one query against n stored points from the overlapping dataset with k = 5, counting distance computations. There is nothing to train, so this is the whole cost, and it is paid again for every query. The leave-one-out accuracy check is not included in the count.',
      metric: 'distance computations',
      metricLabel: 'Distance computations per query',
      sizeLabel: 'Training points (n)',
      sizes: [50, 100, 200, 400, 800, 1600],
      variants: [{ id: 'brute', label: 'Scan every point' }],
      input: (n, variant, seed) => ({ dataset: 'overlap', points: n, seed, k: 5, queryX: 0, queryY: 0, custom: [] }),
      theory: [{ label: 'n', fn: (n) => n }],
    },
  },

  logic: {
    intuition: 'If points that are close together usually share a label, then the labels around a new point are the best available evidence about it. One neighbour is a noisy witness. Several neighbours voting average out the noise, at the price of listening to points that are farther away and so less relevant. The number k sets that balance.',
    steps: [
      'Store every training point with its label. This is all the "training" there is.',
      'When a query arrives, compute its distance to every stored point.',
      'While scanning, keep a list of the k closest points seen so far. A new point joins the list only if it is closer than the farthest point on it, which then drops out.',
      'Count the labels of the k points left on the list.',
      'Return the label with the most votes. If the vote is tied, this page returns the label of the single nearest point.',
    ],
    pseudocode: [
      'classify(q, points, k):',
      '  nearest ← empty list',
      '  for each point p:',
      '    d ← distance(q, p)',
      '    if d < k-th smallest:',
      '      add p to nearest',
      '      keep only the k closest',
      '  count labels in nearest',
      '  return the majority label',
    ],
    decisions: [
      { title: 'How many neighbours?', text: 'Small k follows the training data closely and is easily misled by a single mislabelled or unusual point. Large k is steadier but blurs real detail, and when k approaches n every query gets the overall majority class. The usual practice is to try several values and keep the one with the best accuracy on held-out data, for example by leave-one-out or cross-validation. With two classes an odd k avoids ties.' },
      { title: 'Which distance?', text: 'Straight-line (Euclidean) distance is the default. It treats every feature alike, so features should first be put on comparable scales, or one measured in large units will decide everything. Other choices include city-block distance and, for text or other high-dimensional vectors, cosine similarity.' },
      { title: 'How to break ties?', text: 'This page gives a tied vote to the label of the single nearest neighbour. Other common rules are to weight each vote by closeness, or to reduce k by one. Whatever the rule, it must be fixed in advance, because it changes predictions near the boundary.' },
      { title: 'Scan or index?', text: 'Scanning every point costs O(n) per query. Spatial indexes such as k-d trees find neighbours much faster when there are only a few features, and approximate methods are used when there are many.' },
    ],
    invariants: [
      'After the scan has examined the first i points, the list holds the min(k, i) closest of those i points, in order of distance.',
      'The farthest point on a full list defines a radius. No point examined so far that is off the list lies inside that radius.',
    ],
    edgeCases: [
      'A tied vote, possible whenever k is even: the result depends on the tie-breaking rule.',
      'Several points at exactly the same distance: this page keeps the one that appears earlier in the data.',
      'k equal to the number of training points: every query receives the overall majority class and position no longer matters.',
      'One class far more common than the other: the common class wins most votes simply by being numerous.',
      'Features on very different scales: the feature with the largest spread dominates the distance.',
      'A query far from all the data: it still receives a confident-looking label from neighbours that are not near at all.',
    ],
    correctness: 'The algorithm does what it says: by the invariant, the list holds the k closest training points when the scan ends, and the vote returns their majority label. Whether that label is **right** is a statistical question, not a matter of proof about the code. Cover and Hart showed that as the number of training points grows without limit, the error rate of the 1-nearest-neighbour rule is at most twice the Bayes error rate, the lowest error any classifier could achieve on that problem. If k also grows, but more slowly than n, the error rate approaches the Bayes rate itself. Neither result says how much data is enough, and in many dimensions the amount needed grows very quickly.',
    mistakes: [
      'Measuring accuracy by classifying the training points while they are still in the training set. With k = 1 every point is its own nearest neighbour at distance zero, so the score is a meaningless 100 percent. Leave the point out first.',
      'Forgetting to rescale the features, so that one of them silently decides every distance.',
      'Sorting all n distances when only the k smallest are needed.',
      'Choosing k by the accuracy on the same data that will be used to report the final result.',
      'Comparing squared distances with unsquared ones. Either works for ranking, but not mixed.',
    ],
  },

  code: {
    sample: {
      input: 'Classify the query (0, 0) from six labelled points with k = 1, 3 and 5, printing the nearest points with their distances, the vote and the predicted class. Then score k = 1 and k = 3 by leave-one-out: classify each of the six points from the other five and count how many come out right.',
      expected: 'k=1: nearest p1(0.50) | votes 0-1 -> class 1\nk=3: nearest p1(0.50) p2(0.60) p3(0.80) | votes 2-1 -> class 0\nk=5: nearest p1(0.50) p2(0.60) p3(0.80) p4(1.00) p5(1.30) | votes 2-3 -> class 1\nleave-one-out, k=1: 5 of 6 correct\nleave-one-out, k=3: 6 of 6 correct',
    },
    breakIt: [
      { change: 'In the leave-one-out loop at the bottom, stop leaving the point out: remove the last argument from the call, so that `classify(x, y, k, i)` becomes `classify(x, y, k)`. Which of the two scores changes, and to what?',
        find: { python: 'if classify(x, y, k, i)[0] == label:', javascript: 'if (classify(x, y, k, i).winner === label) correct++;' },
        replace: { python: 'if classify(x, y, k)[0] == label:', javascript: 'if (classify(x, y, k).winner === label) correct++;' },
        reveal: 'The k = 1 line now reads "leave-one-out, k=1: 6 of 6 correct" where it read 5 of 6. Every point is still in the training set when it is classified, so its nearest neighbour is itself, at distance 0, and it votes for its own label. With k = 1 that gives 100 percent on any data at all, so the number says nothing. The k = 3 line still reads 6 of 6, which is why the mistake is easy to miss when you only test one k.' },
      { change: 'Suppose x had been recorded in centimetres and y in metres, so that every difference in x is 100 times larger. In the distance line, put `10000 *` in front of the squared x difference. Which point becomes the nearest neighbour of the query?',
        find: { python: 'd = math.sqrt((x - qx) * (x - qx) + (y - qy) * (y - qy))', javascript: 'const d = Math.sqrt((x - qx) * (x - qx) + (y - qy) * (y - qy));' },
        replace: { python: 'd = math.sqrt(10000 * (x - qx) * (x - qx) + (y - qy) * (y - qy))', javascript: 'const d = Math.sqrt(10000 * (x - qx) * (x - qx) + (y - qy) * (y - qy));' },
        reveal: 'Point 3. The first line becomes "k=1: nearest p3(0.80) | votes 1-0 -> class 0", so the k = 1 answer flips from class 1 to class 0. The k = 3 line lists "p3(0.80) p1(30.00) p2(60.00)". Point 3 lies straight below the query, with the same x, so it is the only point whose distance did not grow. The neighbours are now ranked by x alone and y has no say. The leave-one-out score for k = 3 drops from 6 of 6 to 5 of 6. Nothing in the program is wrong except the units of its data.' },
    ],
    python: {
      source: `import math

# (x, y, label)
points = [(0.3, 0.4, 1), (-0.6, 0.0, 0), (0.0, -0.8, 0),
          (0.6, 0.8, 1), (1.2, 0.5, 1), (-1.2, -0.9, 0)]


def classify(qx, qy, k, skip=-1):
    nearest = []  # (distance, index) pairs, closest first, at most k of them
    for i, (x, y, label) in enumerate(points):
        if i == skip:
            continue  # this point is left out of the vote
        d = math.sqrt((x - qx) * (x - qx) + (y - qy) * (y - qy))
        if len(nearest) < k or d < nearest[-1][0]:
            pos = len(nearest)
            while pos > 0 and nearest[pos - 1][0] > d:
                pos -= 1
            nearest.insert(pos, (d, i))
            if len(nearest) > k:
                nearest.pop()
    votes = [0, 0]
    for d, i in nearest:
        votes[points[i][2]] += 1
    if votes[0] == votes[1]:
        winner = points[nearest[0][1]][2]
    else:
        winner = 0 if votes[0] > votes[1] else 1
    return winner, votes, nearest


for k in (1, 3, 5):
    winner, votes, nearest = classify(0.0, 0.0, k)
    listing = " ".join(f"p{i + 1}({d:.2f})" for d, i in nearest)
    print(f"k={k}: nearest {listing} | votes {votes[0]}-{votes[1]} -> class {winner}")

for k in (1, 3):
    correct = 0
    for i, (x, y, label) in enumerate(points):
        if classify(x, y, k, i)[0] == label:
            correct += 1
    print(f"leave-one-out, k={k}: {correct} of {len(points)} correct")`,
      notes: [
        { line: 9, text: 'The only state kept during the scan: the k closest points seen so far, in order. There is no model and nothing was computed before the query arrived.' },
        { line: 11, text: 'One point can be left out of the scan. The plain classification leaves nothing out. The accuracy check at the bottom leaves out the point being tested.' },
        { line: 13, text: 'Straight-line distance from the query to one stored point. This line runs once for every training point, for every query.' },
        { line: 14, text: 'A point joins the list only if the list is not yet full or the point is closer than the farthest one on it.' },
        { line: 20, text: 'Dropping the farthest keeps the list at k entries, so the scan never needs to sort all n distances.' },
        { line: 24, text: 'The tie rule: when the vote is level, the single nearest neighbour decides.' },
        { line: 39, text: 'Leave-one-out: point i is classified from the other five. If it were left in, it would find itself at distance zero and vote for its own label.' },
      ],
    },
    javascript: {
      source: `// [x, y, label]
const points = [[0.3, 0.4, 1], [-0.6, 0.0, 0], [0.0, -0.8, 0],
                [0.6, 0.8, 1], [1.2, 0.5, 1], [-1.2, -0.9, 0]];

function classify(qx, qy, k, skip = -1) {
  const nearest = []; // [distance, index] pairs, closest first, at most k of them
  for (let i = 0; i < points.length; i++) {
    if (i === skip) continue; // this point is left out of the vote
    const [x, y] = points[i];
    const d = Math.sqrt((x - qx) * (x - qx) + (y - qy) * (y - qy));
    if (nearest.length < k || d < nearest[nearest.length - 1][0]) {
      let pos = nearest.length;
      while (pos > 0 && nearest[pos - 1][0] > d) pos--;
      nearest.splice(pos, 0, [d, i]);
      if (nearest.length > k) nearest.pop();
    }
  }
  const votes = [0, 0];
  for (const [, i] of nearest) votes[points[i][2]]++;
  let winner;
  if (votes[0] === votes[1]) winner = points[nearest[0][1]][2];
  else winner = votes[0] > votes[1] ? 0 : 1;
  return { winner, votes, nearest };
}

for (const k of [1, 3, 5]) {
  const { winner, votes, nearest } = classify(0, 0, k);
  const listing = nearest.map(([d, i]) => "p" + (i + 1) + "(" + d.toFixed(2) + ")").join(" ");
  console.log("k=" + k + ": nearest " + listing + " | votes " + votes[0] + "-" + votes[1] + " -> class " + winner);
}

for (const k of [1, 3]) {
  let correct = 0;
  for (let i = 0; i < points.length; i++) {
    const [x, y, label] = points[i];
    if (classify(x, y, k, i).winner === label) correct++;
  }
  console.log("leave-one-out, k=" + k + ": " + correct + " of " + points.length + " correct");
}`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>
#include <utility>
#include <vector>

struct Point { double x, y; int label; };

const std::vector<Point> points = {
    {0.3, 0.4, 1}, {-0.6, 0.0, 0}, {0.0, -0.8, 0},
    {0.6, 0.8, 1}, {1.2, 0.5, 1}, {-1.2, -0.9, 0}};

// (distance, index) pairs, closest first, at most k of them
std::vector<std::pair<double, int>> nearest;
int votes[2];

int classify(double qx, double qy, int k, int skip = -1) {
    nearest.clear();
    for (int i = 0; i < (int)points.size(); ++i) {
        if (i == skip) continue;  // this point is left out of the vote
        double dx = points[i].x - qx, dy = points[i].y - qy;
        double d = std::sqrt(dx * dx + dy * dy);
        if ((int)nearest.size() < k || d < nearest.back().first) {
            int pos = (int)nearest.size();
            while (pos > 0 && nearest[pos - 1].first > d) --pos;
            nearest.insert(nearest.begin() + pos, {d, i});
            if ((int)nearest.size() > k) nearest.pop_back();
        }
    }
    votes[0] = votes[1] = 0;
    for (const auto& nb : nearest) ++votes[points[nb.second].label];
    if (votes[0] == votes[1]) return points[nearest[0].second].label;
    return votes[0] > votes[1] ? 0 : 1;
}

int main() {
    for (int k : {1, 3, 5}) {
        int winner = classify(0.0, 0.0, k);
        std::printf("k=%d: nearest", k);
        for (const auto& nb : nearest) std::printf(" p%d(%.2f)", nb.second + 1, nb.first);
        std::printf(" | votes %d-%d -> class %d\\n", votes[0], votes[1], winner);
    }
    for (int k : {1, 3}) {
        int correct = 0;
        for (int i = 0; i < (int)points.size(); ++i) {
            if (classify(points[i].x, points[i].y, k, i) == points[i].label) ++correct;
        }
        std::printf("leave-one-out, k=%d: %d of %d correct\\n", k, correct, (int)points.size());
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Nearest neighbours turns the usual cost of learning upside down. Training costs nothing beyond storing the n points. Answering one query costs a distance to every one of them. A model such as logistic regression does the opposite: expensive to fit, then almost free to query.',
    cases: [
      { case: 'Training', time: 'O(1) work, O(nd) storage', when: 'Nothing is computed. The n points, each with d features, are kept as they are.' },
      { case: 'One query, scanning every point', time: 'O(nd + nk)', when: 'n distances of d features each, plus keeping a sorted list of k. This is what the page runs. With a heap in place of the list the second term is O(n log k).' },
      { case: 'One query with a k-d tree, few features', time: 'O(log n) on average', when: 'Holds for points spread through a low-dimensional space. Building the tree costs O(n log n).' },
      { case: 'One query with a k-d tree, many features', time: 'Approaches O(n)', when: 'In high dimensions the search must visit most of the tree, and the index stops helping.' },
      { case: 'Leave-one-out accuracy', time: 'O(n²d)', when: 'Each of the n points is classified from the other n − 1 by a full scan.' },
    ],
    space: 'O(nd): the whole training set must be kept for as long as the classifier is in use. The scan itself needs only O(k) extra.',
    memory: 'The model is the data. A classifier built from a million examples carries a million examples with it, where a linear model built from the same data would carry one weight per feature.',
    tradeoffs: 'No training time and no assumptions about the shape of the boundary, in exchange for slow queries, a large memory footprint, and dependence on a meaningful distance. Index structures and approximate search recover query speed at the cost of build time and, for approximate methods, of occasionally missing a true neighbour.',
    assumptions: [
      'Computing one distance costs O(d) for d features. On this page d = 2.',
      'The scan keeps a sorted list of k entries by insertion, which costs O(k) per accepted point. k is treated as small compared with n.',
      'The k-d tree figure is an average for points distributed through a space of low, fixed dimension. It is not a worst-case bound.',
      'The experiment counts distance computations for a single query and excludes the leave-one-out check.',
    ],
  },

  tradeoffs: {
    excels: [
      'Class boundaries of irregular shape, which it follows without being told the shape.',
      'Problems with few features and a moderate number of examples.',
      'Situations where new labelled examples arrive often: adding one is just storing it.',
      'A quick baseline, because there is nothing to train and one setting to choose.',
    ],
    struggles: [
      'Large training sets with fast-response requirements, since every query looks at the data again.',
      'Many features. Distances between points become nearly equal, and the nearest neighbours stop being meaningfully near.',
      'Features that are irrelevant to the label. They add noise to every distance, and the method has no way to learn to ignore them.',
      'Unbalanced classes, where the common class outvotes the rare one.',
    ],
    pitfalls: [
      'Leaving features in their raw units, so one of them dominates the distance.',
      'Scoring the classifier on points that are still in the training set.',
      'Using an even k with two classes without deciding how ties are broken.',
      'Trusting the label of a query that lies far from all the training data.',
    ],
    misunderstandings: [
      "\"The algorithm learns a boundary during training.\" It learns nothing during training. The boundary in the last frame is drawn by asking the question at every grid position. It exists only as a consequence of the stored points.",
      "\"More neighbours always give a better answer.\" Larger k averages away noise, but it also brings in votes from points that are too far away to be relevant. With k equal to the size of the training set, every query gets the same answer.",
      "\"With k = 1 it is 100 percent accurate.\" Only on the points it has memorized, where each point is its own nearest neighbour. On new points, k = 1 is usually the setting most disturbed by noise.",
      "\"Nearest means most similar in every sense.\" Nearest means smallest value of the chosen distance on the chosen features. Change the units of one feature and different points become nearest.",
    ],
    constraints: [
      'At scale, exact search is replaced by approximate nearest-neighbour indexes, which trade a small chance of missing a true neighbour for much faster queries.',
      'Because the training data must be stored and consulted at prediction time, the method is unsuitable where the data cannot be kept or shipped with the model.',
    ],
    alternatives: [
      { id: 'logistic-regression', name: 'Logistic Regression', when: 'The boundary is roughly a straight line and queries must be cheap: it compresses the data into a few weights.' },
      { id: 'perceptron', name: 'Perceptron', when: 'The classes are linearly separable and a simple online learner is enough.' },
      { id: 'decision-tree', name: 'Decision Tree Learning', when: 'Features are on incomparable scales or many are irrelevant: trees split on one feature at a time and need no distance.' },
      { id: 'k-means', name: 'k-Means Clustering', when: 'There are no labels at all and the goal is to discover groups. The shared letter k means something different there.' },
      { name: 'k-d trees and approximate nearest-neighbour indexes', when: 'The method is right but the scan is too slow.' },
    ],
    comparison: {
      columns: ['', 'k-nearest neighbours', 'Logistic regression', 'Perceptron'],
      rows: [
        ['Training', 'None: store the data', 'Gradient descent on a loss', 'Repeated passes, updating on mistakes'],
        ['Cost of one query', 'O(n) distances', 'One weighted sum', 'One weighted sum'],
        ['Boundary shape', 'Any shape the data suggest', 'A straight line', 'A straight line'],
        ['What is stored', 'Every training point', 'One weight per feature and a bias', 'One weight per feature and a bias'],
        ['Handles the XOR dataset', 'Yes', 'No', 'No'],
      ],
    },
  },

  applications: [
    { title: 'Recommendation by similar users or items', status: 'established', text: 'Neighbourhood-based collaborative filtering recommends what the most similar users liked, or items most similar to those a user already chose. The core operation is a nearest-neighbour search over rating or purchase histories.' },
    { title: 'Similarity search over learned vectors', status: 'established', text: 'Documents, images and other items are turned into vectors by a learned model, and retrieval returns the stored vectors nearest to the query vector, usually with an approximate nearest-neighbour index.' },
    { title: 'Filling in missing values', status: 'established', text: 'A missing entry in a data table is estimated from the corresponding entries of the rows most similar to it. This k-nearest-neighbour imputation is a standard tool in data preparation.' },
    { title: 'A baseline classifier', status: 'established', text: 'Benchmarks for classification, including handwritten digit recognition, routinely report a nearest-neighbour result as the reference a learned model should improve on.' },
    { title: 'Identifying a specimen from measurements', status: 'illustrative', text: 'Given the petal and sepal sizes of flowers of known species, a new flower can be assigned the species most common among the flowers whose measurements are closest to its own.' },
  ],

  connections: [
    { to: 'concept:distance-metric', type: 'prerequisite', why: 'The whole method rests on one function that says how far apart two examples are. A different metric gives different neighbours and different answers.' },
    { to: 'concept:feature-space', type: 'prerequisite', why: 'Each example becomes a point whose coordinates are its measurements. "Similar" then means "close together in that space".' },
    { to: 'concept:supervised-learning', type: 'prerequisite', why: 'The method predicts labels for new inputs from examples whose labels are known.' },
    { to: 'concept:overfitting', type: 'related', why: 'k = 1 reproduces every quirk of the training data. Raising k smooths the boundary, the same trade between flexibility and stability that every learning method faces.' },
    { to: 'logistic-regression', type: 'same-problem', why: 'Both assign one of two classes to a point. Logistic regression commits to a straight boundary and summarizes the data in a few weights; nearest neighbours commits to nothing and keeps all the data.' },
    { to: 'perceptron', type: 'same-problem', why: 'Both are two-class classifiers. The perceptron learns a line and fails when no line separates the classes, while nearest neighbours follows whatever shape the points have.' },
    { to: 'k-means', type: 'related', why: 'Both assign a point to a group by distance. In k-means the groups are unknown and represented by centres that move; here the groups are given by labels and nothing moves.' },
    { to: 'decision-tree', type: 'same-problem', why: 'Both can represent boundaries that are not straight. A tree learns axis-aligned splits in advance and ignores scale; nearest neighbours defers all work to query time and depends on scale.' },
    { to: 'linear-search', type: 'related', why: 'The scan for the nearest points is a linear search that keeps the k best candidates in place of a single match.' },
    { to: 'monte-carlo', type: 'related', why: 'Leave-one-out accuracy is an estimate from a finite sample of points, and like any sample estimate it carries uncertainty that shrinks as the sample grows.' },
    { to: 'discipline:statistics', type: 'application', why: 'It is a nonparametric estimator: the vote among the k nearest points estimates the probability of each class near the query without assuming a distribution.' },
    { to: 'discipline:computational-geometry', type: 'application', why: 'Nearest-neighbour search and Voronoi diagrams are the geometric problems underneath the classifier.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'What does k-nearest neighbours compute during training?',
      options: ['The best straight line between the classes', 'The centre of each class', 'Nothing: it stores the training points and does all its work when a query arrives', 'The distance between every pair of training points'],
      answer: 2,
      explain: [
        'That describes a linear classifier such as logistic regression or the perceptron.',
        'Class centres are used by other methods, such as a nearest-centroid classifier.',
        'Correct. There is no training computation. Each query then costs a distance to every stored point.',
        'Pairwise distances are not needed. Only distances from the query to the stored points are computed, at query time.',
      ],
    },
    {
      type: 'predict',
      q: 'Eight labelled points, four of each class, surround a query at the centre of the chart. In order of distance from the query their classes are 0, 0, 1, 1, 1, 0, 0, 1. With k = 5 the query is labelled class 1, by 3 votes to 2. What does k = 7 give?',
      options: ['Class 1, by 4 votes to 3', 'Class 0, by 4 votes to 3', 'A tie, because there are four points of each class', 'Class 1, because more distant neighbours cannot overturn the nearer ones'],
      answer: 1,
      explain: [
        'Count the first seven classes in the list: 0, 0, 1, 1, 1, 0, 0. That is four votes for class 0 and three for class 1.',
        'Correct. The sixth and seventh nearest points are both class 0, so they turn a 3 to 2 defeat into a 4 to 3 win. The label has changed twice as k grew: class 0 at k = 3, class 1 at k = 5, class 0 again at k = 7. With seven of the eight points voting, the answer is close to a count of the whole training set, and the query\'s own surroundings matter little.',
        'All eight points would tie, but k = 7 leaves out the farthest one, which is class 1. Seven voters and two classes cannot tie.',
        'Every neighbour among the k nearest has one vote, however far away it is. Distance decides who votes and has no effect on how much a vote counts.',
      ],
      tryInput: { custom: EIGHT, k: 7, queryX: 0, queryY: 0 },
      check: (r) => (r.prediction === 0 && r.votes.join() === '4,3' && r.tie === false && r.neighbours.join() === '0,1,2,3,4,5,6') || `prediction ${r.prediction}, votes ${r.votes}, neighbours ${r.neighbours}`,
    },
    {
      type: 'debug',
      q: 'This function reports an accuracy of 100 percent for k = 1 on every dataset, however mixed the classes are. What is wrong?',
      code: `def accuracy(points, k):
    correct = 0
    for x, y, label in points:
        if classify(x, y, points, k) == label:
            correct += 1
    return correct / len(points)`,
      options: ['It should divide by k', 'Each point is classified while it is still in the training set, so its nearest neighbour is itself', 'classify should be called with k + 1', 'The loop should skip points of class 0'],
      answer: 1,
      explain: [
        'Accuracy is the fraction of points classified correctly, so dividing by the number of points is right.',
        'Correct. At distance zero every point finds itself first and votes for its own label. The point must be removed from the training set before it is classified, which is what leave-one-out does.',
        'Asking for k + 1 neighbours still lets the point vote for itself.',
        'Both classes must be tested.',
      ],
    },
    {
      type: 'choice',
      q: 'One feature is a person\'s height in metres and another is their income in dollars. What happens if they are used as they are?',
      options: ['Nothing, the units cancel out', 'Income differences of thousands swamp height differences of fractions, so the neighbours are chosen almost entirely by income', 'Height dominates because it is measured more precisely', 'The algorithm refuses to run'],
      answer: 1,
      explain: [
        'Distances add the squared differences of the raw numbers. Nothing cancels.',
        'Correct. The feature with the larger numeric spread decides the distance. Features should be rescaled to comparable ranges first.',
        'Precision is irrelevant. The size of the numbers is what matters.',
        'It runs without complaint, which is what makes this mistake easy to miss.',
      ],
    },
    {
      type: 'challenge',
      title: 'Choose k honestly, then weight the votes',
      prompt: 'First, in the demonstration, choose the overlapping dataset with 40 points and seed 1, and read the leave-one-out accuracy from the output panel for every k from 1 to 15. Which k is best? Repeat with seeds 2 and 3. Is the best k the same each time?\n\nThen change the vote in the code sample so that each neighbour counts with weight 1 divided by its distance. Test it on the sample\'s own six points and query (0, 0), with k = 2, 3, 4 and 5, printing the total weight for each class. Compare the weighted vote with the plain vote on a larger dataset at large k.\n\nFinally, explain why the k you chose should be confirmed on fresh data before you report an accuracy.',
      expect: 'Leave-one-out on the overlapping dataset with 40 points. Seed 1: 30 of 40 at k = 1, a single best value of 38 at k = 9, and 36 at k = 15. Seed 2: the best is 38, reached by every k from 9 to 15. Seed 3: the best is 36, reached by k = 1 to 6 and by k = 8, and k = 9 gives 34. So the best k is not the same each time, and a k chosen on one sample is partly fitted to that sample.\n\nWeighted vote on the six points with the query at (0, 0), as total weight for class 0 and for class 1. k = 2: 1.667 and 2.000, class 1. k = 3: 2.917 and 2.000, class 0. k = 4: 2.917 and 3.000, class 1. k = 5: 2.917 and 3.769, class 1. The labels match the plain vote at k = 3 and k = 5, and the ties at k = 2 and k = 4 are now settled by the weights with no separate tie rule.',
      hints: [
        'With weighted votes, a tie is almost impossible and far neighbours matter less, so large k does less harm.',
        'Picking the k with the best leave-one-out score uses the data twice: once to choose and once to report. The reported number is then slightly optimistic.',
      ],
    },
  ],

  compare: {
    idea: 'Label a query with the majority class among the k stored examples closest to it.',
    requires: 'Examples with known answers, a sensible way to measure how far apart two cases are, and measurements on comparable scales.',
    sensitivity: 'Sensitive to the choice of k, to feature scaling and to irrelevant features. With small k, sensitive to individual noisy points.',
    memory: 'O(n): the entire training set is kept.',
    difficulty: 'low',
    difficultyNote: 'A scan, a short sorted list and a count. The care goes into scaling the features and choosing k.',
    limits: 'Slow to answer on large collections. It gets worse as the number of measurements grows. It cannot ignore a measurement that does not matter.',
    useWhen: 'Similar cases tend to have the same answer, there are few measurements per case, and you want a method with no training step.',
  },

  advanced: {
    history: 'Evelyn Fix and Joseph Hodges described nearest-neighbour discrimination in a 1951 technical report for the United States Air Force School of Aviation Medicine, as a way to classify without assuming a distribution for each class. Thomas Cover and Peter Hart published the analysis that made the rule famous in 1967, bounding the error of the single-nearest-neighbour rule by twice the Bayes error. Charles Stone proved in 1977 that the k-nearest-neighbour rule is consistent for any distribution when k grows suitably with n. Jon Bentley introduced the k-d tree in 1975, which made fast exact search practical in low dimensions.',
    derivation: 'Suppose the query is $x$ and the probability that a point at $x$ belongs to class 1 is $p(x)$. The best possible rule predicts class 1 when $p(x) > \\tfrac12$ and errs with probability $\\min(p, 1-p)$; averaged over $x$ this is the Bayes error $R^\\star$. The k nearest neighbours of $x$ lie in a small ball around it, and each is class 1 with probability close to $p(x)$. The fraction of class 1 among them,\n\n$$\\hat p(x) = \\frac{1}{k}\\sum_{i \\in N_k(x)} y_i,$$\n\nis therefore an estimate of $p(x)$, and the majority vote is the rule "predict class 1 when $\\hat p(x) > \\tfrac12$". Two things can go wrong with the estimate. With small $k$ it is an average of few labels and is noisy (high variance). With large $k$ the ball is big, the neighbours are no longer at $x$, and $\\hat p$ estimates an average of $p$ over a wide region (high bias). Choosing $k$ balances the two.',
    proof: 'Sketch of the Cover and Hart bound for $k = 1$ and two classes. As $n \\to \\infty$ the nearest neighbour $x\'$ of $x$ converges to $x$, so its label is class 1 with probability $p(x)$, independently of the label of $x$ itself. The rule errs when the two labels differ, which has probability\n\n$$r(x) = p(x)\\bigl(1 - p(x)\\bigr) + \\bigl(1 - p(x)\\bigr)p(x) = 2p(x)\\bigl(1 - p(x)\\bigr).$$\n\nWrite $e(x) = \\min(p, 1-p)$ for the Bayes error at $x$. Then $r(x) = 2e(x)(1 - e(x)) \\le 2e(x)$, and taking expectations over $x$ gives $R_{1\\mathrm{NN}} \\le 2R^\\star$. Using the fact that the average of $e^2$ is at least the square of the average of $e$ sharpens this to $R_{1\\mathrm{NN}} \\le 2R^\\star(1 - R^\\star)$. The bound is about the limit of infinite data. It does not say how large $n$ must be.',
    complexityProof: 'The scan computes one distance per stored point, n in total. Inserting into a sorted list of at most k entries moves at most k entries, so the list costs O(k) per accepted point and O(nk) in the worst case; replacing it with a max-heap of size k gives O(n log k). A k-d tree splits the points in half along one coordinate at each level, giving depth O(log n). A query descends to a leaf and then backtracks into any subtree whose region could contain a closer point. In low dimensions few subtrees qualify. As the dimension grows, almost all of them do.',
    variants: [
      { name: 'Distance-weighted voting', text: 'Each neighbour\'s vote is weighted by closeness, for example by the reciprocal of its distance, so that near neighbours count for more than far ones.' },
      { name: 'k-nearest-neighbour regression', text: 'For a numeric target, predict the average of the neighbours\' values in place of a vote.' },
      { name: 'k-d trees and ball trees', text: 'Spatial indexes that find exact nearest neighbours without scanning every point, effective when the number of features is small.' },
      { name: 'Approximate nearest-neighbour search', text: 'Indexes based on hashing or on graphs of neighbouring points return neighbours that are close to the true nearest with high probability, in far less time. They are the standard choice for high-dimensional vectors.' },
      { name: 'Condensed and edited nearest neighbour', text: 'Methods that remove training points which do not affect the boundary, or which appear to be mislabelled, to reduce storage and noise.' },
    ],
    implementation: 'Standardize each feature before computing distances. Compare squared distances to avoid the square root when only the ranking matters. Keep the k best candidates in a bounded max-heap. For many queries against the same data, build an index once. Choose k by cross-validation, and report accuracy on data that played no part in choosing it.',
    benchmarking: 'Report accuracy on held-out data, never on the stored points themselves. State k, the distance, how features were scaled and how ties are broken, because each changes the result. For search structures, report both query time and the fraction of true nearest neighbours recovered.',
    references: [
      { authors: 'T. M. Cover and P. E. Hart', year: 1967, title: 'Nearest neighbor pattern classification', venue: 'IEEE Transactions on Information Theory 13(1), 21-27' },
      { authors: 'E. Fix and J. L. Hodges Jr.', year: 1951, title: 'Discriminatory analysis. Nonparametric discrimination: consistency properties', venue: 'Technical report, USAF School of Aviation Medicine, Randolph Field, Texas' },
      { authors: 'C. J. Stone', year: 1977, title: 'Consistent nonparametric regression', venue: 'The Annals of Statistics 5(4)' },
      { authors: 'J. L. Bentley', year: 1975, title: 'Multidimensional binary search trees used for associative searching', venue: 'Communications of the ACM 18(9)' },
      { authors: 'T. Hastie, R. Tibshirani and J. Friedman', year: 2009, title: 'The Elements of Statistical Learning: Data Mining, Inference, and Prediction (2nd edition)', venue: 'Springer' },
    ],
    furtherReading: [
      'T. Hastie, R. Tibshirani and J. Friedman, *The Elements of Statistical Learning*, section 2.3 (least squares and nearest neighbours compared) and chapter 13, "Prototype Methods and Nearest-Neighbors".',
      'R. O. Duda, P. E. Hart and D. G. Stork, *Pattern Classification* (2nd edition), chapter 4, "Nonparametric Techniques".',
    ],
  },

  tests: [
    { name: 'matches a sort-based reference on the default input', input: {}, check: matchesBruteForce },
    { name: 'matches the reference on overlapping data with an even k', input: { dataset: 'overlap', points: 60, seed: 9, k: 4, queryX: -0.2, queryY: 0.3 }, check: matchesBruteForce },
    { name: 'matches the reference on XOR', input: { dataset: 'xor', points: 48, seed: 3, k: 7, queryX: 0.6, queryY: -0.7 }, check: matchesBruteForce },
    { name: 'the worked example: k = 3 gives class 0 by 2 votes to 1', input: { custom: EXAMPLE, k: 3, queryX: 0, queryY: 0 },
      check: (r) => (r.prediction === 0 && r.votes.join() === '2,1' && r.neighbours.join() === '0,1,2' && r.distances.map((d) => d.toFixed(1)).join() === '0.5,0.6,0.8') || `prediction ${r.prediction}, votes ${r.votes}, neighbours ${r.neighbours}, distances ${r.distances}` },
    { name: 'the worked example: k = 1 gives class 1', input: { custom: EXAMPLE, k: 1, queryX: 0, queryY: 0 },
      check: (r) => (r.prediction === 1 && r.votes.join() === '0,1') || `prediction ${r.prediction}, votes ${r.votes}` },
    { name: 'eight points, four of each class: k = 7 gives class 0 by 4 votes to 3 (quiz prediction), after class 0 at k = 3 and class 1 at k = 5', input: { custom: EIGHT, k: 7, queryX: 0, queryY: 0 },
      check: (r, c, ctx) => {
        const pts = resolvePoints(ctx.input);
        const three = bruteForce(pts, 0, 0, 3), five = bruteForce(pts, 0, 0, 5);
        if (r.prediction !== 0 || r.votes.join() !== '4,3' || r.correct !== 0) return `prediction ${r.prediction}, votes ${r.votes}, leave-one-out ${r.correct}`;
        if (three.label !== 0 || five.label !== 1) return `k = 3 gives ${three.label}, k = 5 gives ${five.label}`;
        return matchesBruteForce(r, c, ctx);
      } },
    { name: 'the code sample: leave-one-out on the six points is 5 of 6 at k = 1', input: { custom: EXAMPLE, k: 1, queryX: 0, queryY: 0 },
      check: (r) => (r.correct === 5 && r.n === 6) || `${r.correct} of ${r.n}` },
    { name: 'the code sample: leave-one-out on the six points is 6 of 6 at k = 3', input: { custom: EXAMPLE, k: 3, queryX: 0, queryY: 0 },
      check: (r) => (r.correct === 6 && r.n === 6) || `${r.correct} of ${r.n}` },
    { name: 'the worked example: k = 5 gives class 1 by 3 votes to 2', input: { custom: EXAMPLE, k: 5, queryX: 0, queryY: 0 },
      check: (r) => (r.prediction === 1 && r.votes.join() === '2,3') || `prediction ${r.prediction}, votes ${r.votes}` },
    { name: 'a tied vote goes to the nearest neighbour', input: { custom: EXAMPLE, k: 2, queryX: 0, queryY: 0 },
      check: (r) => (r.tie === true && r.prediction === 1 && r.votes.join() === '1,1') || `tie ${r.tie}, prediction ${r.prediction}, votes ${r.votes}` },
    { name: 'accuracy is a fraction and XOR is learnable', input: { dataset: 'xor', points: 60, seed: 1, k: 5, queryX: 0, queryY: 0 },
      check: (r) => (r.accuracy >= 0.9 && r.accuracy <= 1) || `leave-one-out accuracy ${r.accuracy}` },
  ],
};
