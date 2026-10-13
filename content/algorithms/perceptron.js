import { makeDataset, datasetOptions, datasetById, isLinearlySeparable, CLASS_ROLES, DATA_RANGE, SEPARABLE_LINE } from '../../js/lib/datasets.js';

const trim = (v, d) => {
  const s = v.toFixed(d);
  return Number(s) === 0 ? (0).toFixed(d) : s;
};
const f2 = (v) => trim(v, 2);
// "+ 0.26" or "− 1.05": a signed term for writing out the boundary equation.
const term = (v) => `${Number(v.toFixed(2)) < 0 ? '−' : '+'} ${f2(Math.abs(v))}`;
const pct = (v) => `${(100 * v).toFixed(1)}%`;
const at = (p) => `(${f2(p.x)}, ${f2(p.y)})`;
const vec = (w) => `(${f2(w[0])}, ${f2(w[1])})`;

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

// The part of the line w1·x + w2·y + b = 0 that crosses the chart, or null if there is no line yet.
function boundary(w, b) {
  const [lo, hi] = DATA_RANGE;
  const cap = (v) => Math.max(-1e3, Math.min(1e3, v));
  if (Math.abs(w[0]) < 1e-12 && Math.abs(w[1]) < 1e-12) return null;
  if (Math.abs(w[1]) >= Math.abs(w[0])) return [[lo, cap(-(w[0] * lo + b) / w[1])], [hi, cap(-(w[0] * hi + b) / w[1])]];
  return [[cap(-(w[1] * lo + b) / w[0]), lo], [cap(-(w[1] * hi + b) / w[0]), hi]];
}

// The half-plane where the score is positive, as a polygon far larger than the chart
// (the scene clips it). Exact along the boundary, unlike a grid of shaded cells.
function positiveSide(w, b) {
  const len = Math.hypot(w[0], w[1]);
  const n = [w[0] / len, w[1] / len], d = [-n[1], n[0]];
  const p0 = [-b * w[0] / (len * len), -b * w[1] / (len * len)];
  const far = 20;
  const a = [p0[0] - far * d[0], p0[1] - far * d[1]], c = [p0[0] + far * d[0], p0[1] + far * d[1]];
  return [a, c, [c[0] + far * n[0], c[1] + far * n[1]], [a[0] + far * n[0], a[1] + far * n[1]]];
}

const target = (p) => (p.label === 1 ? 1 : -1);
const score = (p, w, b) => w[0] * p.x + w[1] * p.y + b;
// A point is right only when it is strictly on its own side. A score of exactly 0 is a mistake.
const isWrong = (p, w, b) => target(p) * score(p, w, b) <= 0;

function run(input, t) {
  const pts = resolvePoints(input);
  const n = pts.length;
  const maxEpochs = input.epochs;
  const isCustom = Array.isArray(input.custom) && input.custom.length > 0;
  let w = [0, 0], b = 0;
  const perEpoch = [];       // mistakes made in each finished pass
  let inPass = 0;            // mistakes so far in the current pass
  let updates = 0, converged = false, epoch = 0;

  const views = ({ current = -1, mistake = false, old = null } = {}) => {
    const ww = w.slice(), bb = b;
    const layers = [];
    const line = boundary(ww, bb);
    if (line) layers.push({ type: 'polygon', points: positiveSide(ww, bb), role: CLASS_ROLES[1], fill: true, fillAlpha: 0.3, stroke: false });
    if (old) { const prev = boundary(old.w, old.b); if (prev) layers.push({ type: 'line', points: prev, role: 'muted', width: 1.4, dash: true }); }
    if (line) layers.push({ type: 'line', points: line, role: 'ink', width: 2.2 });
    for (const c of [0, 1]) layers.push({ type: 'points', points: pts.filter((p) => p.label === c).map((p) => [p.x, p.y]), role: CLASS_ROLES[c], r: 4 });
    if (line) {
      const wrong = pts.filter((p) => isWrong(p, ww, bb));
      if (wrong.length) layers.push({ type: 'points', points: wrong.map((p) => [p.x, p.y]), role: 'alert', hollow: true, r: 7.5 });
    }
    if (current >= 0) layers.push({ type: 'points', points: [{ x: pts[current].x, y: pts[current].y, label: `#${current + 1}` }], role: mistake ? 'alert' : 'current', hollow: true, r: 12 });
    const bars = perEpoch.slice();
    const live = epoch > perEpoch.length;
    if (live) bars.push(inPass);
    const top = Math.max(4, ...bars) * 1.15;
    const span = Math.max(maxEpochs, bars.length, 5);
    return [
      { kind: 'scene', title: 'Training points and the current boundary', x: DATA_RANGE, y: DATA_RANGE, aspect: 0.7, equal: true, axes: { xLabel: 'feature 1', yLabel: 'feature 2' }, layers,
        legend: [{ label: 'class 0', role: CLASS_ROLES[0] }, { label: 'class 1', role: CLASS_ROLES[1] }, { label: 'shaded side: predicted class 1', role: CLASS_ROLES[1] }, { label: 'boundary', role: 'ink' }, { label: 'boundary before this update', role: 'muted' }, { label: 'point being checked (large ring)', role: 'current' }, { label: 'on the wrong side', role: 'alert' }] },
      { kind: 'scene', title: 'Mistakes in each pass over the data', x: [0.5, span + 0.5], y: [0, top], aspect: 0.2, axes: { xLabel: 'pass' },
        layers: [{ type: 'bars', xs: bars.map((_, i) => i + 1), heights: bars, barWidth: 0.6, role: 'forest', roles: live ? { [bars.length - 1]: 'active' } : {} }],
        legend: [{ label: 'finished pass', role: 'forest' }, { label: 'pass in progress', role: 'active' }] },
    ];
  };

  const where = isCustom ? 'your own points' : `the "${datasetById[input.dataset].label}" set`;
  t.frame(() => ({ line: 1,
    note: `${n} labelled points from ${where}. The perceptron keeps two weights and a bias, all starting at zero. For any point it computes a **score**: weight 1 × x + weight 2 × y + bias. A positive score means "class 1" and a negative score means "class 0". With everything at zero every score is 0, so there is no boundary yet and the first point checked is bound to count as a mistake.`,
    views: views(), vars: { 'w₁': f2(w[0]), 'w₂': f2(w[1]), b: f2(b) } }));

  while (epoch < maxEpochs) {
    epoch++;
    inPass = 0;
    let skipped = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i], tg = target(p);
      const s = score(p, w, b);
      t.count('point visits');
      const says = s > 0 ? 'class 1' : s < 0 ? 'class 0' : 'neither class';
      if (tg * s > 0) {
        if (epoch === 1) {
          t.frame(() => ({ line: [3, 4], note: `Pass 1, point #${i + 1} at ${at(p)}, class ${p.label}. Its score is ${f2(s)}, which says ${says}. Correct, so the weights are left alone.`,
            views: views({ current: i }), vars: { pass: epoch, point: i + 1, score: f2(s), mistakes: inPass } }));
        } else skipped++;
        continue;
      }
      const old = { w: w.slice(), b };
      w = [w[0] + tg * p.x, w[1] + tg * p.y];
      b += tg;
      updates++; inPass++;
      t.count('updates');
      const after = score(p, w, b);
      const quiet = skipped; skipped = 0;
      const made = inPass;
      t.frame(() => ({ line: [3, 4, 5, 6],
        note: `${quiet > 0 ? `${quiet} point${quiet === 1 ? ' was' : 's were'} checked and found correct. Then: ` : ''}Pass ${epoch}, point #${i + 1} at ${at(p)}, class ${p.label}. Its score is ${f2(s)}, which says ${says}. **Mistake.** ${tg > 0 ? 'Add' : 'Subtract'} the point's coordinates ${tg > 0 ? 'to' : 'from'} the weights and ${tg > 0 ? 'add 1 to' : 'subtract 1 from'} the bias: weights ${vec(old.w)} → **${vec(w)}**, bias ${f2(old.b)} → **${f2(b)}**. The point's score moves from ${f2(s)} to ${f2(after)}${tg * after > 0 ? ', which is now on the correct side' : ', better but still on the wrong side'}. The dashed line is the boundary before this update.`,
        views: views({ current: i, mistake: true, old }), vars: { pass: epoch, point: i + 1, 'w₁': f2(w[0]), 'w₂': f2(w[1]), b: f2(b), mistakes: made } }));
    }
    perEpoch.push(inPass);
    const made = inPass, passNo = epoch, quiet = skipped;
    if (made === 0) { converged = true; break; }
    const stillWrong = pts.filter((p) => isWrong(p, w, b)).length;
    if (epoch < maxEpochs) {
      t.frame(() => ({ line: 7,
        note: `Pass ${passNo} is finished${quiet > 0 && passNo > 1 ? ` (the last ${quiet} point${quiet === 1 ? ' was' : 's were'} correct)` : ''}. It made **${made} mistake${made === 1 ? '' : 's'}**, and each one moved the boundary. With the weights as they are now, ${stillWrong === 0 ? 'every point happens to be on the correct side, but only a full pass with no mistakes proves it' : `${stillWrong} of ${n} point${stillWrong === 1 ? ' is' : 's are'} on the wrong side`}. Go round again.${passNo === 1 ? ' From now on only the mistakes are shown.' : ''}`,
        views: views(), vars: { pass: passNo, mistakes: made, 'updates so far': updates } }));
    }
  }

  const correct = pts.filter((p) => !isWrong(p, w, b)).length;
  const accuracy = correct / n;
  const epochs = perEpoch.length;
  t.frame(() => ({ line: converged ? [7, 8] : 8,
    note: converged
      ? `Pass ${epochs} checked all ${n} points and made **no mistakes**, so every point is strictly on its correct side and the perceptron stops. It needed ${updates} update${updates === 1 ? '' : 's'} in total. The final boundary is ${f2(w[0])}·x ${term(w[1])}·y ${term(b)} = 0. It is **a** separating line, the first one the updates happened to reach, and it may pass very close to some points. Training accuracy: ${pct(accuracy)}.`
      : `Stopped at the limit of ${maxEpochs} pass${maxEpochs === 1 ? '' : 'es'} after ${updates} updates. The last pass still made ${perEpoch[epochs - 1]} mistake${perEpoch[epochs - 1] === 1 ? '' : 's'}, so the perceptron has **not converged**. The weights shown are simply where it was when it was stopped: ${correct} of ${n} points are on the correct side, a training accuracy of ${pct(accuracy)}. ${isLinearlySeparable(pts) ? 'A direct check shows that a separating line does exist for these points, so the perceptron would find one given more passes. Raise the limit.' : 'A direct check of these points confirms that no straight line separates them, so no number of extra passes would ever produce a pass without mistakes. The boundary would keep jumping for ever.'}`,
    views: views(), vars: { passes: epochs, updates, accuracy: pct(accuracy) } }));

  return { accuracy, correct, n, w: w.slice(), b, epochs, updates, converged, mistakesPerEpoch: perEpoch.slice(), points: pts };
}

// Novikoff's bound for a dataset with a known separating line a·x + b·y = c:
// the perceptron makes at most (R / γ)² mistakes, measured on inputs extended with a constant 1.
function novikoffBound(pts, line) {
  const size = Math.hypot(line.a, line.b, line.c);
  let gamma = Infinity, R = 0;
  for (const p of pts) {
    gamma = Math.min(gamma, target(p) * (line.a * p.x + line.b * p.y - line.c) / size);
    R = Math.max(R, Math.hypot(p.x, p.y, 1));
  }
  return { gamma, R, bound: (R / gamma) * (R / gamma) };
}

const EXAMPLE = [1, 1, 1, -1, 1, 0, 1, -1, 1, -1, -1, 0];

export default {
  meta: {
    id: 'perceptron',
    name: 'Perceptron',
    aliases: ['perceptron learning rule', 'Rosenblatt perceptron', 'single-layer perceptron', 'linear threshold unit', 'perceptron algorithm'],
    kind: 'algorithm',
    discipline: 'deep-learning',
    alsoIn: [
      { id: 'machine-learning', why: 'It is the simplest learning algorithm for a linear classifier, and the first with a proof that it succeeds whenever success is possible.' },
      { id: 'ai', why: 'It was one of the first machines that learned from examples, and the debate over what it could and could not learn shaped the early history of artificial intelligence.' },
    ],
    subfield: 'Foundations of neural networks',
    family: 'Single-layer networks',
    lab: 'neural-networks',
    compareGroup: 'classification',
    year: 1958,
    authors: 'Frank Rosenblatt',
    summary: 'Learns a straight boundary between two classes by visiting points one at a time and adjusting its weights only when it gets one wrong.',
    difficulty: 'beginner',
    order: 640,
    paradigms: ['incremental', 'iterative-refinement'],
    randomized: false,
    approximate: false,
    time: { best: 'O(nd): one clean pass', average: 'O(nd) per pass', worst: 'Never stops if the data are not separable', class: 'iterative' },
    space: { worst: 'O(d)', class: 'linear' },
    tags: {
      problems: ['separate two groups with a line', 'classify into two groups', 'learn from mistakes', 'make a neuron learn', 'train a linear classifier'],
      techniques: ['mistake-driven update', 'weighted sum', 'threshold', 'online learning', 'linear separability'],
      applications: ['machine learning', 'natural language', 'image processing'],
    },
    prerequisites: ['concept:supervised-learning', 'concept:feature-space'],
  },

  bigIdea: {
    simple: "A perceptron is a simple machine for sorting things into two groups, and it learns from its own mistakes. Picture a table with apples and oranges scattered across it and a ruler lying on the table. The rule is that everything on one side of the ruler is called an apple, and everything on the other side an orange. At first the ruler is in a poor position. So you check the fruit one at a time. If a fruit is on the correct side, you do nothing. If it is on the wrong side, you shift the ruler toward it, enough to give that fruit a better chance next time. Then you move on to the next fruit, and go round the table again and again. If a straight ruler can separate the fruit at all, this routine is certain to find a position that gets every one right, and then it stops. If no such position exists, it never stops fiddling. The perceptron began as a model of a single brain cell, and today's neural networks are built from units much like it.",
    what: 'A perceptron classifies a point by computing a weighted sum of its features plus a bias and checking the sign: positive means class 1, negative means class 0. The **perceptron learning rule** finds the weights. It visits the training points one at a time, and whenever a point is misclassified it adds that point to the weights (for class 1) or subtracts it (for class 0). Correctly classified points change nothing.',
    why: 'In 1943 McCulloch and Pitts described a model neuron that fires when the weighted sum of its inputs passes a threshold, but its weights had to be set by hand. Frank Rosenblatt\'s contribution, published in 1958, was a rule by which such a unit could set its own weights from labelled examples, together with the claim, later proved, that the rule always succeeds when a solution exists.',
    when: 'Use it to understand how a single neuron learns, or as a fast, simple online learner when the classes are known to be linearly separable. When the classes overlap, use [logistic regression](#/algorithm/logistic-regression), which settles on a sensible line and gives probabilities. When the boundary is not straight, use [k-nearest neighbours](#/algorithm/knn) or a network with hidden layers trained by [backpropagation](#/algorithm/backpropagation).',
    interesting: 'It comes with a guarantee that is rare in machine learning: an "if and only if". If a straight line can separate the classes, the rule finds one after a number of mistakes that can be bounded in advance. If no line can, the rule never stops. A four-point pattern called XOR, which no line separates, was enough to show the limits of a single perceptron and to make the case for networks with more than one layer.',
    where: 'The perceptron itself is mostly of historical and teaching interest now. Its descendants are everywhere: every unit in a neural network computes a weighted sum followed by a nonlinear function, and mistake-driven updates of the same form are still used to train fast linear models for language tasks.',
    analogy: {
      title: "What one nudge does",
      text: "Watch what a single nudge of the ruler does. It shifts and turns the ruler toward one fruit that was on the wrong side, and it takes no account of any other fruit. So a nudge that helps one fruit can push another, previously correct, onto the wrong side, to be put right on a later round. That is why the ruler has to go round the table several times. The routine also stops at the first position that gets every fruit right, even if the ruler ends up brushing against a fruit when there was room to sit comfortably between the two groups.",
      limits: "The ruler is nearly the real thing: with two measurements for each fruit, the perceptron's boundary is a straight line. One detail the picture leaves vague is the size of each nudge, which is fixed by where the offending fruit sits, not by how wrong the ruler is. And a ruler is straight. If the two kinds of fruit can only be separated by a curve, you will go round the table for ever.",
    },
  },

  example: {
    setup: "Four points: P1 at (1, 1) is class 1, P2 at (−1, 1) is class 0, P3 at (1, −1) is class 1 and P4 at (−1, −1) is class 0. The perceptron has two weights and a bias, all starting at 0. A point's score is the first weight times its x, plus the second weight times its y, plus the bias. A positive score means class 1 and a negative score means class 0. A score of exactly 0 counts as a mistake.",
    steps: [
      "P1 scores 0, which is not positive, but P1 is class 1. Mistake. Because P1 is class 1, add its coordinates to the weights and add 1 to the bias. The weights become (1, 1) and the bias 1.",
      "P2 scores 1 × (−1) + 1 × 1 + 1 = 1. That is positive, but P2 is class 0. Mistake. Because P2 is class 0, subtract its coordinates and subtract 1 from the bias. The weights become (1 − (−1), 1 − 1) = (2, 0) and the bias 0.",
      "P3 scores 2 × 1 + 0 × (−1) + 0 = 2. Positive, and P3 is class 1. Correct, so nothing changes.",
      "P4 scores 2 × (−1) + 0 + 0 = −2. Negative, and P4 is class 0. Correct, so nothing changes.",
      "Go round again. The scores are 2, −2, 2 and −2, all on the correct side. A full pass with no mistakes means the perceptron stops.",
    ],
    result: "The final weights are (2, 0) and the bias is 0, so the score is simply 2 × x. The boundary is the vertical line where x is 0: points to its right are class 1, points to its left class 0. Two corrections were enough, and the second weight ended at 0 because the y position tells you nothing about the class of these four points.",
    tryInput: { custom: EXAMPLE, epochs: 10 },
  },

  terms: [
    { term: "Feature", meaning: "One measured number describing an example. Each point on the chart has two features, its x and y positions." },
    { term: "Weight", meaning: "A number that says how much one feature counts toward the decision, and in which direction." },
    { term: "Bias", meaning: "A number added to every score. It lets the boundary sit away from the centre of the chart." },
    { term: "Score", meaning: "The weighted sum of a point's features plus the bias. Its sign is the perceptron's answer." },
    { term: "Decision boundary", meaning: "The straight line where the score is exactly 0. One side is predicted class 1, the other class 0." },
    { term: "Mistake", meaning: "A training point whose score has the wrong sign for its class, or is exactly 0." },
    { term: "Update", meaning: "The correction made after a mistake: add the point to the weights if it is class 1, subtract it if it is class 0." },
    { term: "Pass", meaning: "One trip through all the training points in order. Also called an epoch." },
    { term: "Linearly separable", meaning: "Describes two classes that some straight line splits perfectly, with every point of one class on one side." },
    { term: "Converge", meaning: "To reach a state that no longer changes. Here, a full pass with no mistakes." },
  ],

  takeaway: "Check the examples one at a time, and only when you get one wrong, shift the dividing line toward it.",

  viz: {
    describe: 'A square scatter plot of training points, green for class 0 and terracotta for class 1. An ink line is the current decision boundary and the side predicted as class 1 is shaded terracotta. A large ring marks the point being checked, brick-coloured when it is a mistake. Smaller brick rings mark every point currently on the wrong side. After an update a dashed grey line shows where the boundary was before. A bar chart below counts the mistakes made in each pass over the data. Training ends when a bar has height zero.',
    inputs: [
      { id: 'dataset', type: 'select', label: 'Dataset', options: datasetOptions, default: 'separable' },
      { id: 'points', type: 'range', label: 'Training points', min: 10, max: 80, step: 2, default: 30 },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 5 },
      { id: 'epochs', type: 'range', label: 'Maximum passes', min: 1, max: 40, step: 1, default: 20,
        help: 'Training stops early as soon as one full pass makes no mistakes.' },
      { id: 'custom', type: 'list', label: 'Or type your own training points', default: [], maxLength: 120, min: -1.5, max: 1.5, placeholder: 'e.g. 1, 1, 1, -1, 1, 0, 1, -1, 1, -1, -1, 0',
        help: 'Read as x, y, class triples, with class 0 or 1, visited in the order typed. Leave empty to use the generated dataset.' },
    ],
    presets: [
      { label: 'Separable: it converges', values: { dataset: 'separable', points: 30, seed: 5, epochs: 20, custom: [] } },
      { label: 'Separable, more points', values: { dataset: 'separable', points: 60, seed: 4, epochs: 20, custom: [] } },
      { label: 'XOR: it never converges', values: { dataset: 'xor', points: 24, seed: 1, epochs: 12, custom: [] } },
      { label: 'Overlapping groups: it never settles', values: { dataset: 'overlap', points: 30, seed: 5, epochs: 20, custom: [] } },
      { label: 'Moons', values: { dataset: 'moons', points: 30, seed: 1, epochs: 20, custom: [] } },
      { label: 'Worked example: four points', values: { custom: EXAMPLE, epochs: 10 } },
    ],
    tryThis: [
      'Run the default and step through the first pass. Notice that most points change nothing. Only the mistakes move the line, and each one swings it noticeably. Then watch the bar chart: the mistakes per pass shrink to zero, and the run stops.',
      'Look closely at the final line of the default run. It separates the classes, but it is not centred in the gap between them. The perceptron stops at the first line that works. Change the seed and compare how close the line passes to the nearest point each time.',
      'Load "XOR: it never converges". Every pass makes about as many mistakes as the one before, the boundary keeps swinging, and the run ends at the pass limit with roughly half the points wrong. Raise the maximum passes to 40. Nothing improves, because no straight line separates these four corners.',
      'Load "Overlapping groups: it never settles". A good line clearly exists here, one that gets most points right, but the perceptron cannot rest on it: a single point on the wrong side is enough to knock the line away again. Compare with [logistic regression](#/algorithm/logistic-regression) on the same dataset, which settles.',
    ],
    run,
    report: (r, c) => `${r.converged ? `Converged: pass ${r.epochs} made no mistakes` : `Not converged: stopped at the limit of ${r.epochs} pass${r.epochs === 1 ? '' : 'es'}`}. ${r.updates} update${r.updates === 1 ? '' : 's'} in ${c['point visits'] || 0} point visits.\nBoundary: ${f2(r.w[0])}·x ${term(r.w[1])}·y ${term(r.b)} = 0\nTraining accuracy: ${pct(r.accuracy)} (${r.correct} of ${r.n} training points strictly on the correct side with the final weights).\nMistakes per pass: ${r.mistakesPerEpoch.join(', ')}`,
  },

  logic: {
    intuition: 'The weights are an arrow, and the score of a point measures how far the point lies along that arrow. A class 1 point with a negative score is on the wrong side: the arrow does not point toward it enough. Adding the point to the arrow turns the arrow toward it, which raises that point\'s score. A class 0 point with a positive score has the opposite problem, so the point is subtracted, turning the arrow away. Each correction is local and may undo an earlier one. The surprising fact is that, when a separating line exists, the corrections cannot go on undoing each other for ever.',
    steps: [
      'Start with both weights and the bias at zero.',
      'Take the next training point and compute its score: the weighted sum of its features plus the bias.',
      'If the score is positive and the point is class 1, or negative and the point is class 0, the point is classified correctly. Change nothing.',
      'Otherwise it is a mistake. For a class 1 point, add its features to the weights and add 1 to the bias. For a class 0 point, subtract its features and subtract 1 from the bias.',
      'Move to the next point. After the last point, start again from the first.',
      'Stop when a complete pass makes no mistakes, or when the limit on the number of passes is reached.',
    ],
    pseudocode: [
      'perceptron(points, passes):',
      '  w ← (0, 0);  b ← 0',
      '  repeat up to passes times:',
      '    for each point (x, t):',
      '      if t·(w·x + b) ≤ 0:',
      '        w ← w + t·x',
      '        b ← b + t',
      '    if no mistakes: stop',
      '  return w, b',
    ],
    decisions: [
      { title: 'Why code the classes as +1 and −1?', text: 'In the pseudocode t is +1 for class 1 and −1 for class 0. Then "the score has the wrong sign" becomes the single test t × score ≤ 0, and "add for class 1, subtract for class 0" becomes the single update w ← w + t·x. It is bookkeeping, not a different algorithm.' },
      { title: 'Does a learning rate matter?', text: 'With weights starting at zero, multiplying every update by a constant only rescales the weights and bias together. The sign of every score, and so every prediction and every mistake, stays the same. That is why this page has no learning rate control.' },
      { title: 'In what order should the points be visited?', text: 'Any order that keeps returning to every point works for the convergence guarantee. This page goes through the points in a fixed order. Different orders can reach different final lines and take different numbers of updates.' },
      { title: 'What if the data are not separable?', text: 'Then the rule never stops by itself, and a limit on passes is essential. Common remedies are to keep the best weights seen so far (the pocket algorithm), to average the weights over all steps (the averaged perceptron), or to switch to a method with a loss that has a minimum, such as logistic regression.' },
    ],
    invariants: [
      'The weight vector is always a sum of class 1 training points minus a sum of class 0 training points: the ones on which mistakes were made, counted once per mistake.',
      'Immediately after an update on a point, that point\'s score has moved toward the correct side by the squared length of the point plus 1.',
      'If a pass ends with no mistakes, every training point is strictly on its correct side.',
    ],
    edgeCases: [
      'All weights zero at the start: every score is 0, so the first point visited is always counted as a mistake.',
      'A point exactly on the boundary: treated as a mistake, so the final line never passes through a training point.',
      'Data that are not linearly separable: no pass is ever free of mistakes, and the rule runs until the pass limit.',
      'Classes separable only by a line far from the origin: the bias changes by exactly 1 per update, so many updates may be needed to move the line into place.',
      'Two identical points with different labels: the data cannot be separable, and the two points undo each other\'s updates indefinitely.',
      'Stopping a non-converged run: the weights at that moment may be much worse than weights passed through earlier.',
    ],
    correctness: 'The perceptron convergence theorem, proved by Novikoff in 1962, states that if the training points are linearly separable, the rule makes only finitely many mistakes, at most $(R/\\gamma)^2$, where $R$ is the length of the longest input and $\\gamma$ is the margin by which the best line separates the classes. After the last mistake every pass is clean, so the rule stops with a separating line. Conversely, if the rule stops, its final pass has verified that every point is strictly on its correct side, so the data are separable. Together: it converges **if and only if** a separating line exists. The theorem promises a separating line, not a good one. It says nothing about how the line performs on new points, and nothing useful about data that are not separable.',
    mistakes: [
      'Updating with the label 0 in place of the target −1, so that mistakes on class 0 points change nothing.',
      'Updating on every point. The rule changes the weights only after a mistake.',
      'Leaving out the bias, which forces the boundary through the origin.',
      'Stopping when a pass has few mistakes. Only a pass with none proves a separating line was found.',
      'Running without a pass limit on data that might not be separable.',
      'Reading the final weights of a run that hit the limit as the "best" line. They are only the last line.',
    ],
  },

  code: {
    sample: {
      input: 'Train on six points that the line x + y = 3.5 separates, printing the mistakes and the weights after each pass, then whether it converged and the training accuracy.',
      expected: 'pass 1: 4 mistakes, weights (-1, 0), bias -2\npass 2: 3 mistakes, weights (0, 0), bias -3\npass 3: 3 mistakes, weights (1, 0), bias -4\npass 4: 3 mistakes, weights (0, 2), bias -5\npass 5: 3 mistakes, weights (1, 2), bias -6\npass 6: 0 mistakes, weights (1, 2), bias -6\nconverged after 6 passes\ntraining accuracy: 6 of 6',
    },
    python: {
      source: `# (x, y, label)
points = [(2, 3, 1), (1, 1, 0), (3, 2, 1), (2, 0, 0), (3, 3, 1), (0, 2, 0)]
w1, w2, b = 0, 0, 0
max_passes = 100

converged = False
passes = 0
while passes < max_passes and not converged:
    passes += 1
    mistakes = 0
    for x, y, label in points:
        target = 1 if label == 1 else -1
        score = w1 * x + w2 * y + b
        if target * score <= 0:  # wrong side, or exactly on the line
            w1 += target * x
            w2 += target * y
            b += target
            mistakes += 1
    print(f"pass {passes}: {mistakes} mistakes, weights ({w1}, {w2}), bias {b}")
    converged = mistakes == 0

if converged:
    print(f"converged after {passes} passes")
else:
    print(f"not converged after {passes} passes")
correct = 0
for x, y, label in points:
    predicted = 1 if w1 * x + w2 * y + b > 0 else 0
    if predicted == label:
        correct += 1
print(f"training accuracy: {correct} of {len(points)}")`,
      notes: [
        { line: 3, text: 'Two weights and a bias, all zero. The whole model is these three numbers.' },
        { line: 12, text: 'Class 1 becomes target +1 and class 0 becomes target −1, so one test and one update cover both classes.' },
        { line: 14, text: 'A mistake is a score with the wrong sign, or exactly zero. Correct points fall through and change nothing.' },
        { line: 15, text: 'The update: add the point for class 1, subtract it for class 0. There is no learning rate and no gradient.' },
        { line: 20, text: 'The only proof of success is a complete pass with no mistakes.' },
      ],
    },
    javascript: {
      source: `// [x, y, label]
const points = [[2, 3, 1], [1, 1, 0], [3, 2, 1], [2, 0, 0], [3, 3, 1], [0, 2, 0]];
let w1 = 0, w2 = 0, b = 0;
const maxPasses = 100;

let converged = false;
let passes = 0;
while (passes < maxPasses && !converged) {
  passes++;
  let mistakes = 0;
  for (const [x, y, label] of points) {
    const target = label === 1 ? 1 : -1;
    const score = w1 * x + w2 * y + b;
    if (target * score <= 0) { // wrong side, or exactly on the line
      w1 += target * x;
      w2 += target * y;
      b += target;
      mistakes++;
    }
  }
  console.log("pass " + passes + ": " + mistakes + " mistakes, weights (" + w1 + ", " + w2 + "), bias " + b);
  converged = mistakes === 0;
}

console.log((converged ? "converged after " : "not converged after ") + passes + " passes");
let correct = 0;
for (const [x, y, label] of points) {
  const predicted = w1 * x + w2 * y + b > 0 ? 1 : 0;
  if (predicted === label) correct++;
}
console.log("training accuracy: " + correct + " of " + points.length);`,
    },
    cpp: {
      source: `#include <cstdio>
#include <vector>

struct Point { int x, y, label; };

int main() {
    const std::vector<Point> points = {{2, 3, 1}, {1, 1, 0}, {3, 2, 1}, {2, 0, 0}, {3, 3, 1}, {0, 2, 0}};
    int w1 = 0, w2 = 0, b = 0;
    const int maxPasses = 100;

    bool converged = false;
    int passes = 0;
    while (passes < maxPasses && !converged) {
        ++passes;
        int mistakes = 0;
        for (const Point& p : points) {
            int target = p.label == 1 ? 1 : -1;
            int score = w1 * p.x + w2 * p.y + b;
            if (target * score <= 0) {  // wrong side, or exactly on the line
                w1 += target * p.x;
                w2 += target * p.y;
                b += target;
                ++mistakes;
            }
        }
        std::printf("pass %d: %d mistakes, weights (%d, %d), bias %d\\n", passes, mistakes, w1, w2, b);
        converged = mistakes == 0;
    }

    std::printf("%s %d passes\\n", converged ? "converged after" : "not converged after", passes);
    int correct = 0;
    for (const Point& p : points) {
        int predicted = w1 * p.x + w2 * p.y + b > 0 ? 1 : 0;
        if (predicted == p.label) ++correct;
    }
    std::printf("training accuracy: %d of %d\\n", correct, (int)points.size());
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'One pass visits each of the n points once, computing a weighted sum of d features: O(nd). The interesting question is how many passes are needed. For separable data the total number of mistakes is bounded by a quantity that depends on the geometry of the data and not on how many points there are. For non-separable data there is no bound, because the rule never stops.',
    cases: [
      { case: 'One pass', time: 'O(nd)', when: 'Each point costs one weighted sum, plus an update of d weights if it is a mistake.' },
      { case: 'Separable data, total mistakes', time: 'At most (R/γ)²', when: 'R is the length of the longest input and γ the margin of the best separating line, both measured with a constant 1 appended to every input to account for the bias. The bound does not depend on n or on the order of the points.' },
      { case: 'Separable data, total time', time: 'O(nd·(R/γ)²)', when: 'Every pass except the last contains at least one mistake, so the number of passes is at most the number of mistakes plus one.' },
      { case: 'Non-separable data', time: 'Does not terminate', when: 'Every pass contains at least one mistake. A pass limit is the only thing that stops it.' },
      { case: 'Predicting one point', time: 'O(d)', when: 'One weighted sum and a sign check.' },
    ],
    space: 'O(d): the weights and the bias. The training points are read one at a time and need not be held in memory together.',
    memory: 'The model is one number per feature plus the bias, whatever the size of the training set. Because each update uses a single point, the rule can learn from a stream of examples.',
    tradeoffs: 'Each step is as cheap as a learning step can be, with nothing to tune. The price is an all-or-nothing outcome: a perfect line if one exists, and no usable stopping point if none does. The mistake bound grows with the inverse square of the margin, so classes that nearly touch can take many passes.',
    assumptions: [
      'Arithmetic on numbers takes constant time.',
      'The mistake bound assumes the data are linearly separable with margin γ > 0 and that every point is revisited until a clean pass occurs.',
      'R and γ are computed in the extended space where each input has a constant 1 appended, so that the bias is treated as one more weight.',
      'The bound is a worst case. On typical separable data the number of mistakes is far smaller.',
    ],
  },

  tradeoffs: {
    excels: [
      'Linearly separable classes, where it is guaranteed to finish with zero training mistakes.',
      'Streams of examples, since it updates from one point at a time and stores only the weights.',
      'Teaching: every step can be checked by hand.',
    ],
    struggles: [
      'Classes that overlap even slightly. It never settles, and the line at any given moment may be poor.',
      'Patterns that need a curved boundary, such as XOR or the two moons.',
      'Separable classes with a narrow gap, which can require many updates.',
      'Any task that needs a measure of confidence. The output is a bare class with no probability.',
    ],
    pitfalls: [
      'No pass limit on data that turn out not to be separable.',
      'Treating the last weights of a non-converged run as a trained model.',
      'Forgetting the bias.',
      'Assuming zero training mistakes means the line will do well on new points.',
    ],
    misunderstandings: [
      "\"The perceptron finds the best separating line.\" It finds a separating line, the first one its updates reach. That line can pass very close to the training points. Finding the line with the widest gap is a different problem, solved by support vector machines.",
      "\"With enough passes it will learn anything.\" It can only ever represent a straight boundary. On XOR it never completes a pass without mistakes, however long it runs.",
      "\"If it has not converged, it just needs more time.\" Not necessarily. Unless you know the data are separable, there is no way to tell from the outside whether another thousand passes would help.",
      "\"A perceptron is the same thing as a modern neural network.\" It is a single unit with a hard threshold, trained by a rule that is not gradient descent. Networks stack many units with smooth functions between them and are trained by backpropagation.",
      "\"Correct points help to shape the line.\" They have no effect at all. Only mistakes change the weights.",
    ],
    constraints: [
      'In practice the averaged perceptron is preferred to the plain one: it returns the average of the weights over all steps, which is far more stable when the data are not separable.',
      'For non-separable problems a pass limit, or a method with a well-defined optimum, is needed.',
    ],
    alternatives: [
      { id: 'logistic-regression', name: 'Logistic Regression', when: 'The classes overlap, or probabilities are wanted. Its loss has a minimum, so training settles.' },
      { id: 'knn', name: 'k-Nearest Neighbours', when: 'The boundary is not straight and the training set is small enough to keep.' },
      { id: 'backpropagation', name: 'A multi-layer network trained by backpropagation', when: 'The boundary is not straight and features that would straighten it are not known.' },
      { id: 'decision-tree', name: 'Decision Tree Learning', when: 'The classes are separated by thresholds on individual features, as in XOR.' },
      { name: 'Support vector machine', when: 'The data are separable or nearly so and the line with the widest margin is wanted.' },
      { name: 'Averaged perceptron or pocket algorithm', when: 'You want to keep the perceptron\'s simplicity on data that are not separable.' },
    ],
    comparison: {
      columns: ['', 'Perceptron', 'Logistic regression', 'k-nearest neighbours'],
      rows: [
        ['Learns from', 'Mistakes only', 'Every point, in proportion to its error', 'Nothing: it stores the points'],
        ['Output', 'A class', 'A probability', 'A class, by vote'],
        ['Separable data', 'Stops with zero mistakes', 'Weights grow without bound', 'Works'],
        ['Overlapping data', 'Never settles', 'Settles on the best line', 'Works'],
        ['XOR', 'Never settles', 'Settles near chance', 'Works'],
        ['Stored model', 'Weights and a bias', 'Weights and a bias', 'All training points'],
      ],
    },
  },

  applications: [
    { title: 'The Mark I Perceptron', status: 'established', text: 'Rosenblatt\'s algorithm was built as a machine at the Cornell Aeronautical Laboratory in the late 1950s. It took input from an array of light sensors and learned to distinguish simple patterns, with its weights held in motor-driven adjustable resistors.' },
    { title: 'The unit from which neural networks are built', status: 'established', text: 'Each unit of a modern network computes a weighted sum of its inputs plus a bias and passes it through a nonlinear function. Replace the perceptron\'s hard threshold with a smooth function and connect units in layers, and the result can be trained by backpropagation.' },
    { title: 'Averaged and structured perceptrons in language processing', status: 'established', text: 'A mistake-driven update of the same form, applied to whole predicted sequences and with the weights averaged over training, was introduced for part-of-speech tagging and parsing in the early 2000s and remains a fast, accurate baseline.' },
    { title: 'Predicting branches in a processor', status: 'illustrative', text: 'Jiménez and Lin proposed in 2001 that a processor could predict which way a conditional branch will go using a small perceptron whose inputs are the outcomes of recent branches. The appeal is that a perceptron is cheap enough to evaluate in hardware.' },
    { title: 'A first spam filter', status: 'illustrative', text: 'With one feature per word, a perceptron can be trained online: each time it misjudges a message, the words of that message are added to or subtracted from the weights.' },
  ],

  connections: [
    { to: 'concept:supervised-learning', type: 'prerequisite', why: 'The rule learns from examples that come with their correct class, and corrects itself whenever its answer disagrees with the label.' },
    { to: 'concept:feature-space', type: 'prerequisite', why: 'Each example is a point whose coordinates are its features, and the classifier is a line dividing that space in two.' },
    { to: 'concept:neural-network', type: 'advanced', why: 'A neural network is many perceptron-like units connected in layers. The single perceptron is the case with no hidden layer.' },
    { to: 'concept:activation-function', type: 'related', why: 'The perceptron applies a hard step to its weighted sum. Replacing the step with a smooth function is what makes gradient-based training of networks possible.' },
    { to: 'logistic-regression', type: 'variant', why: 'Both compute a weighted sum and draw a straight boundary. Logistic regression replaces the hard threshold with a sigmoid and learns from every point by gradient descent, so it has a well-defined answer when the classes overlap.' },
    { to: 'backpropagation', type: 'advanced', why: 'A single perceptron cannot represent XOR. A network with a hidden layer can, and backpropagation is the method that trains its weights by passing the error backward through the layers.' },
    { to: 'gradient-descent', type: 'related', why: 'The perceptron update is a step of stochastic gradient descent on a loss that is zero for correct points and grows linearly with the score of misclassified ones. Rosenblatt\'s rule came first and the gradient reading came later.' },
    { to: 'stochastic-gradient-descent', type: 'related', why: 'Both update the weights from one example at a time and never look at the whole dataset at once.' },
    { to: 'knn', type: 'same-problem', why: 'Both classify points into two classes. Nearest neighbours handles any shape of boundary by storing the data; the perceptron compresses the data into a line and fails when a line is not enough.' },
    { to: 'linear-regression', type: 'related', why: 'Both are built on a weighted sum of the inputs plus a bias. Regression reports the sum itself; the perceptron reports only its sign.' },
    { to: 'decision-tree', type: 'same-problem', why: 'Both learn a classifier from labelled points. A tree can represent XOR with two splits, which a single line cannot.' },
    { to: 'discipline:machine-learning', type: 'application', why: 'The perceptron is the simplest online linear classifier and the starting point for the theory of mistake bounds.' },
    { to: 'discipline:ai', type: 'application', why: 'It was an early demonstration that a machine could acquire a skill from examples in place of explicit programming.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'When does the perceptron learning rule change the weights?',
      options: ['After every point', 'Only after a point that it classified wrongly', 'Once at the end of each pass', 'Only after a point that it classified correctly'],
      answer: 1,
      explain: [
        'Correctly classified points leave the weights exactly as they were.',
        'Correct. The rule is driven by mistakes. A point on its correct side contributes nothing.',
        'Updates happen immediately, point by point, not once per pass.',
        'It is the other way round.',
      ],
    },
    {
      type: 'predict',
      q: 'The XOR dataset has class 0 in the top-right and bottom-left corners and class 1 in the other two. With a limit of 12 passes, how does the perceptron\'s run end?',
      options: ['It converges in two or three passes', 'It converges, but only in the last few passes', 'It reaches the limit still making mistakes in every pass, and has not converged', 'It stops early because the weights return to zero'],
      answer: 2,
      explain: [
        'That is typical of well-separated data. XOR is not separable.',
        'Convergence would mean a line separates the corners, and none does.',
        'Correct. Every pass contains mistakes, because no line has all of class 1 on one side and all of class 0 on the other. The run ends only because of the limit, with the boundary wherever the last update left it.',
        'The weights never settle anywhere, and there is no rule that stops the run when they pass through zero.',
      ],
      tryInput: { dataset: 'xor', points: 24, seed: 1, epochs: 12, custom: [] },
    },
    {
      type: 'debug',
      q: 'This perceptron learns to call class 1 points class 1, but once it wrongly calls a class 0 point class 1 it never corrects itself, and training never finishes. What is wrong?',
      code: `for x, y, label in points:      # label is 0 or 1
    score = w1 * x + w2 * y + b
    predicted = 1 if score > 0 else 0
    if predicted != label:
        w1 += label * x
        w2 += label * y
        b += label`,
      options: ['The score should use >= 0', 'For a class 0 point the update multiplies by the label 0, so nothing changes. It must subtract the point', 'The bias should not be updated', 'The update should happen when predicted equals label'],
      answer: 1,
      explain: [
        'How a score of exactly zero is treated is a small detail, not the cause of this failure.',
        'Correct. The update needs a target of +1 for class 1 and −1 for class 0. With 0 in place of −1, a mistake on a class 0 point adds zero to everything. Using (label − predicted) as the multiplier also works.',
        'The bias must be updated, or the line could never leave the origin.',
        'Updating on correct points and ignoring mistakes would be worse still.',
      ],
    },
    {
      type: 'choice',
      q: 'Two people train a perceptron on the same separable data but visit the points in different orders. Both runs converge. What can you say about the two final lines?',
      options: ['They must be identical', 'Both separate the training points, but they can be different lines', 'Only the one found in fewer passes is correct', 'One of them must be the line with the widest margin'],
      answer: 1,
      explain: [
        'The updates depend on which points are mistakes, and that depends on the order.',
        'Correct. Usually many lines separate the data, and the rule stops at the first one it reaches. A different order can reach a different one.',
        'Any line reached by a clean pass separates the data. Speed does not make one more correct.',
        'The perceptron has no preference for wide margins. Neither line need be the widest.',
      ],
    },
    {
      type: 'challenge',
      title: 'Test the mistake bound, then tame a non-separable run',
      prompt: 'First, for a separable dataset of your own, compute R (the largest length of an input with a 1 appended) and the margin γ of a separating line you know, and check that the number of updates is below (R/γ)². Make the gap between the classes narrower and record how the number of updates and the bound change. Second, implement the pocket algorithm: alongside the usual updates, keep a copy of the weights that have classified the most training points correctly so far. Run both versions on the overlapping dataset and compare the accuracy each returns when stopped after 20 passes.',
      hints: [
        'The margin of a line a·x + b·y = c on a point is its signed distance in the extended space: target × (a·x + b·y − c) divided by the length of (a, b, c). γ is the smallest of these.',
        'For the pocket, counting the correct points after every update costs a full pass each time. Checking only at the end of each pass is a cheaper approximation.',
      ],
    },
  ],

  compare: {
    idea: 'Visit points one at a time and, after each misclassified one, add it to or subtract it from the weights.',
    requires: 'Examples of two groups. It is sure to finish only if a straight line can separate them, so it needs a limit on the number of passes.',
    sensitivity: 'Sensitive to the order of the points and to whether the data are separable at all. Insensitive to a learning rate when weights start at zero.',
    memory: 'O(d): one weight per feature and a bias.',
    difficulty: 'low',
    difficultyNote: 'A sum, a comparison and an addition. The subtlety is entirely in what it guarantees and what it does not.',
    limits: 'Straight boundaries only. It never settles if no line separates the groups. It returns some separating line, not the best one, and gives no probabilities.',
    useWhen: 'A straight line can separate the two groups completely and a simple, fast learner is enough, or you want to see how a single artificial neuron learns.',
  },

  advanced: {
    history: 'Warren McCulloch and Walter Pitts proposed a threshold model of the neuron in 1943. Frank Rosenblatt, a psychologist at the Cornell Aeronautical Laboratory, introduced the perceptron and its learning rule in a 1957 report and a 1958 paper in Psychological Review, and the laboratory built a hardware version, the Mark I Perceptron. Albert Novikoff published the standard proof of the convergence theorem in 1962. In 1969 Marvin Minsky and Seymour Papert\'s book *Perceptrons* gave a rigorous analysis of what single-layer perceptrons cannot compute, including the parity function of which XOR is the smallest case. The book is often credited with dampening interest in neural networks during the following decade, though how much it was responsible is debated. Interest revived in the 1980s when backpropagation made it practical to train networks with hidden layers, which do not share the single perceptron\'s limitation.',
    derivation: 'Write the extended input $\\tilde{x} = (x, 1)$ and the extended weights $\\theta = (w, b)$, so the score is $\\theta^\\top\\tilde{x}$, and let $t \\in \\{+1, -1\\}$ be the target. A point is misclassified when $t\\,\\theta^\\top\\tilde{x} \\le 0$. Define the perceptron loss of one point as\n\n$$\\ell(\\theta) = \\max\\bigl(0,\; -t\\,\\theta^\\top\\tilde{x}\\bigr).$$\n\nIt is zero for a correctly classified point and equals the size of the score for a misclassified one. Where the point is misclassified the gradient of $\\ell$ is $-t\\,\\tilde{x}$, and where it is correct the gradient is zero. A stochastic gradient step with step size 1 is therefore\n\n$$\\theta \\leftarrow \\theta + t\\,\\tilde{x} \\quad\\text{if } t\\,\\theta^\\top\\tilde{x} \\le 0, \\qquad \\theta \\text{ unchanged otherwise},$$\n\nwhich is exactly the perceptron rule. After an update the point\'s own margin changes by $t\\,(t\\tilde{x})^\\top\\tilde{x} = \\lVert\\tilde{x}\\rVert^2 > 0$: it always moves toward the correct side.',
    proof: 'Convergence (Novikoff). Suppose some unit vector $\\theta^\\star$ separates the data with margin $\\gamma > 0$, meaning $t_i\\,\\theta^{\\star\\top}\\tilde{x}_i \\ge \\gamma$ for all $i$, and let $R = \\max_i \\lVert\\tilde{x}_i\\rVert$. Let $\\theta_k$ be the weights after the $k$-th update, with $\\theta_0 = 0$.\n\nEach update, on some point $i$, gives $\\theta_k^\\top\\theta^\\star = \\theta_{k-1}^\\top\\theta^\\star + t_i\\,\\tilde{x}_i^\\top\\theta^\\star \\ge \\theta_{k-1}^\\top\\theta^\\star + \\gamma$, so\n\n$$\\theta_k^\\top\\theta^\\star \\ge k\\gamma.$$\n\nAlso $\\lVert\\theta_k\\rVert^2 = \\lVert\\theta_{k-1}\\rVert^2 + 2t_i\\,\\theta_{k-1}^\\top\\tilde{x}_i + \\lVert\\tilde{x}_i\\rVert^2 \\le \\lVert\\theta_{k-1}\\rVert^2 + R^2$, because the middle term is not positive when point $i$ is a mistake. So\n\n$$\\lVert\\theta_k\\rVert^2 \\le kR^2.$$\n\nBy the Cauchy-Schwarz inequality $\\theta_k^\\top\\theta^\\star \\le \\lVert\\theta_k\\rVert$, hence $k\\gamma \\le \\sqrt{k}\\,R$ and\n\n$$k \\le \\left(\\frac{R}{\\gamma}\\right)^2.$$\n\nThe number of updates is finite, so eventually a pass has none.\n\nXOR is not separable. Take the four points $(1,1)$ and $(-1,-1)$ with target $-1$, and $(1,-1)$ and $(-1,1)$ with target $+1$. A separating $(w_1, w_2, b)$ would need $w_1 + w_2 + b < 0$ and $-w_1 - w_2 + b < 0$, whose sum gives $b < 0$, and also $w_1 - w_2 + b > 0$ and $-w_1 + w_2 + b > 0$, whose sum gives $b > 0$. No such weights exist.',
    complexityProof: 'A pass costs $O(nd)$. Every pass before the final one contains at least one update, so the number of passes is at most one more than the number of updates, which is at most $(R/\\gamma)^2$ for separable data. The total is $O(nd\\,(R/\\gamma)^2)$. The bound depends on the data only through the ratio $R/\\gamma$, a scale-free measure of how narrow the gap is, and holds for any order of presentation.',
    variants: [
      { name: 'Averaged perceptron', text: 'Returns the average of the weight vectors over every step of training. It behaves well on data that are not separable and is the form normally used in practice.' },
      { name: 'Pocket algorithm', text: 'Runs the ordinary rule but keeps "in its pocket" the weights that have done best on the training set so far, and returns those.' },
      { name: 'Voted perceptron', text: 'Keeps every intermediate weight vector along with the number of points it survived, and classifies by a weighted vote among them.' },
      { name: 'Kernel perceptron', text: 'Stores the mistakes themselves and replaces inner products with a kernel function, which allows curved boundaries.' },
      { name: 'Multi-layer perceptron', text: 'Several layers of units with smooth activation functions, trained by backpropagation. Despite the name it is not trained by the perceptron rule.' },
      { name: 'Structured perceptron', text: 'Applies the same mistake-driven update when the prediction is a whole structure, such as the sequence of tags for a sentence.' },
    ],
    implementation: 'Append a constant 1 to every input so the bias is just another weight. Always set a pass limit. Shuffling the points before each pass usually reduces the number of passes. If the data may not be separable, return averaged weights. With weights starting at zero and integer inputs, all arithmetic stays in integers.',
    benchmarking: 'Report the number of updates and passes, the order in which points were presented, and accuracy on held-out data. For a run that hit the pass limit, say so: its final weights are not a converged result.',
    references: [
      { authors: 'F. Rosenblatt', year: 1958, title: 'The perceptron: a probabilistic model for information storage and organization in the brain', venue: 'Psychological Review 65(6), 386-408' },
      { authors: 'A. B. J. Novikoff', year: 1962, title: 'On convergence proofs on perceptrons', venue: 'Proceedings of the Symposium on the Mathematical Theory of Automata, Polytechnic Institute of Brooklyn' },
      { authors: 'M. Minsky and S. Papert', year: 1969, title: 'Perceptrons: An Introduction to Computational Geometry', venue: 'MIT Press' },
      { authors: 'W. S. McCulloch and W. Pitts', year: 1943, title: 'A logical calculus of the ideas immanent in nervous activity', venue: 'Bulletin of Mathematical Biophysics 5' },
      { authors: 'Y. Freund and R. E. Schapire', year: 1999, title: 'Large margin classification using the perceptron algorithm', venue: 'Machine Learning 37(3)' },
    ],
    furtherReading: [
      'C. M. Bishop, *Pattern Recognition and Machine Learning*, section 4.1.7, "The perceptron algorithm".',
      'M. Collins, "Discriminative training methods for hidden Markov models: theory and experiments with perceptron algorithms", *Proceedings of EMNLP* (2002), for the structured and averaged perceptron.',
      'D. A. Jiménez and C. Lin, "Dynamic branch prediction with perceptrons", *Proceedings of HPCA* (2001).',
    ],
  },

  tests: [
    { name: 'converges on separable data and every point is strictly on its correct side', input: {},
      check: (r) => {
        if (!r.converged || r.accuracy !== 1) return `converged ${r.converged}, accuracy ${r.accuracy}`;
        const bad = r.points.filter((p) => target(p) * score(p, r.w, r.b) <= 0).length;
        if (bad) return `${bad} points are not strictly on the correct side`;
        return r.mistakesPerEpoch[r.mistakesPerEpoch.length - 1] === 0 && r.updates === r.mistakesPerEpoch.reduce((s, v) => s + v, 0) || `mistakes per pass ${r.mistakesPerEpoch}, updates ${r.updates}`;
      } },
    { name: 'the number of updates respects Novikoff\'s bound (R/γ)²', input: { dataset: 'separable', points: 80, seed: 11, epochs: 40, custom: [] },
      check: (r) => {
        const { gamma, bound } = novikoffBound(r.points, SEPARABLE_LINE);
        if (!(gamma > 0)) return `the reference line does not separate the data (γ = ${gamma})`;
        return (r.converged && r.updates <= bound) || `converged ${r.converged}, ${r.updates} updates, bound ${bound}`;
      } },
    { name: 'respects the bound and converges for several seeds', input: { dataset: 'separable', points: 60, seed: 4, epochs: 40, custom: [] },
      check: (r) => { const { bound } = novikoffBound(r.points, SEPARABLE_LINE); return (r.converged && r.accuracy === 1 && r.updates <= bound) || `converged ${r.converged}, updates ${r.updates}, bound ${bound}`; } },
    { name: 'the worked example: two updates, weights (2, 0), bias 0', input: { custom: EXAMPLE, epochs: 10 },
      check: (r) => (r.converged && r.updates === 2 && r.epochs === 2 && r.w[0] === 2 && r.w[1] === 0 && r.b === 0 && r.accuracy === 1) || `w ${r.w}, b ${r.b}, updates ${r.updates}, passes ${r.epochs}` },
    { name: 'XOR never converges and stops at the pass limit (quiz prediction)', input: { dataset: 'xor', points: 24, seed: 1, epochs: 12, custom: [] },
      check: (r) => (!r.converged && r.epochs === 12 && r.mistakesPerEpoch.every((m) => m > 0) && r.accuracy < 0.8 && !isLinearlySeparable(r.points)) || `converged ${r.converged}, passes ${r.epochs}, mistakes ${r.mistakesPerEpoch}, accuracy ${r.accuracy}` },
    { name: 'exact XOR corners: every pass has mistakes', input: { custom: [1, 1, 0, -1, 1, 1, -1, -1, 0, 1, -1, 1], epochs: 40 },
      check: (r) => (!r.converged && r.mistakesPerEpoch.length === 40 && r.mistakesPerEpoch.every((m) => m > 0)) || `converged ${r.converged}, mistakes ${r.mistakesPerEpoch}` },
    { name: 'reported accuracy equals a recount from the returned weights', input: { dataset: 'overlap', points: 30, seed: 5, epochs: 20, custom: [] },
      check: (r) => {
        const right = r.points.filter((p) => target(p) * score(p, r.w, r.b) > 0).length;
        return (right === r.correct && Math.abs(right / r.n - r.accuracy) < 1e-12 && !r.converged && !isLinearlySeparable(r.points)) || `recount ${right}, reported ${r.correct}, converged ${r.converged}, separable ${isLinearlySeparable(r.points)}`;
      } },
    { name: 'converges exactly when an independent check says the points are separable', input: { dataset: 'overlap', points: 30, seed: 3, epochs: 40, custom: [] },
      check: (r) => (r.converged === isLinearlySeparable(r.points) && r.converged === true && r.accuracy === 1) || `converged ${r.converged}, separable ${isLinearlySeparable(r.points)}` },
    { name: 'moons preset is not separable and does not converge', input: { dataset: 'moons', points: 30, seed: 1, epochs: 40, custom: [] },
      check: (r) => (!r.converged && !isLinearlySeparable(r.points)) || `converged ${r.converged}, separable ${isLinearlySeparable(r.points)}` },
  ],
};
