import { makeDataset, datasetOptions, datasetById, probabilityHeat, isLinearlySeparable, CLASS_ROLES, DATA_RANGE } from '../../js/lib/datasets.js';

const TOL = 1e-4;
const trim = (v, d) => {
  if (!Number.isFinite(v)) return String(v);
  const s = v.toFixed(d);
  return Number(s) === 0 ? (0).toFixed(d) : s;
};
const f2 = (v) => trim(v, 2);
const f3 = (v) => trim(v, 3);
// "+ 0.26" or "− 1.05": a signed term for writing out the boundary equation.
const term = (v) => `${Number(v.toFixed(2)) < 0 ? '−' : '+'} ${f2(Math.abs(v))}`;
const pct = (v) => `${(100 * v).toFixed(1)}%`;
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

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

// Mean cross-entropy. The clamp only guards the logarithm against a probability of exactly 0 or 1.
function crossEntropy(pts, w1, w2, b) {
  let s = 0;
  for (const p of pts) {
    const q = Math.min(1 - 1e-15, Math.max(1e-15, sigmoid(w1 * p.x + w2 * p.y + b)));
    s -= p.label ? Math.log(q) : Math.log(1 - q);
  }
  return s / pts.length;
}
const wrongOnes = (pts, w1, w2, b) => pts.filter((p) => (sigmoid(w1 * p.x + w2 * p.y + b) >= 0.5 ? 1 : 0) !== p.label);

// The part of the line w1·x + w2·y + b = 0 that crosses the chart, or null if there is no line yet.
function boundary(w1, w2, b) {
  const [lo, hi] = DATA_RANGE;
  const cap = (v) => Math.max(-1e3, Math.min(1e3, v));
  if (Math.abs(w1) < 1e-9 && Math.abs(w2) < 1e-9) return null;
  if (Math.abs(w2) >= Math.abs(w1)) return [[lo, cap(-(w1 * lo + b) / w2)], [hi, cap(-(w1 * hi + b) / w2)]];
  return [[cap(-(w2 * lo + b) / w1), lo], [cap(-(w2 * hi + b) / w1), hi]];
}

function run(input, t) {
  const pts = resolvePoints(input);
  const n = pts.length;
  const eta = input.rate, maxSteps = input.steps;
  const isCustom = Array.isArray(input.custom) && input.custom.length > 0;
  let w1 = 0, w2 = 0, b = 0;
  const losses = [crossEntropy(pts, w1, w2, b)];
  const weights = [[w1, w2, b]];
  let status = 'budget';

  const views = () => {
    const a1 = w1, a2 = w2, a0 = b;
    const layers = [probabilityHeat((x, y) => sigmoid(a1 * x + a2 * y + a0), { cells: 30 })];
    const line = boundary(a1, a2, a0);
    if (line) layers.push({ type: 'line', points: line, role: 'ink', width: 2.2 });
    for (const c of [0, 1]) layers.push({ type: 'points', points: pts.filter((p) => p.label === c).map((p) => [p.x, p.y]), role: CLASS_ROLES[c], r: 4 });
    const wrong = wrongOnes(pts, a1, a2, a0);
    if (wrong.length && line) layers.push({ type: 'points', points: wrong.map((p) => [p.x, p.y]), role: 'alert', hollow: true, r: 8 });
    const top = Math.max(...losses.filter(Number.isFinite), 0.7);
    const span = Math.max(10, maxSteps);
    return [
      { kind: 'scene', title: 'Training points, predicted probability and decision boundary', x: DATA_RANGE, y: DATA_RANGE, aspect: 0.7, equal: true, axes: { xLabel: 'feature 1', yLabel: 'feature 2' }, layers,
        legend: [{ label: 'class 0', role: CLASS_ROLES[0] }, { label: 'class 1', role: CLASS_ROLES[1] }, { label: 'shading: predicted probability of class 1', role: CLASS_ROLES[1] }, { label: 'decision boundary (probability one half)', role: 'ink' }, { label: 'on the wrong side', role: 'alert' }] },
      { kind: 'scene', title: 'Cross-entropy loss at each step', x: [0, span], y: [0, top * 1.08], aspect: 0.2, axes: { xLabel: 'step' },
        layers: [{ type: 'line', points: losses.map((v, i) => [i, Math.min(v, top * 2)]), role: 'forest', width: 2 }] },
    ];
  };
  const countWrong = () => wrongOnes(pts, w1, w2, b).length;

  const where = isCustom ? 'your own points' : `the "${datasetById[input.dataset].label}" set`;
  t.frame(() => ({ line: 1,
    note: `${n} labelled points from ${where}. Both weights and the bias start at zero, so every point gets a score of 0, which the S-shaped curve turns into a probability of exactly one half. The model has no opinion yet, there is no boundary to draw, and the loss is ${f3(losses[0])}. That value, the natural logarithm of 2, is the loss of pure guessing.`,
    views: views(), vars: { 'w₁': f3(w1), 'w₂': f3(w2), b: f3(b), loss: f3(losses[0]) } }));

  let k = 0;
  for (; k < maxSteps; k++) {
    let g1 = 0, g2 = 0, g0 = 0;
    for (const p of pts) {
      const err = sigmoid(w1 * p.x + w2 * p.y + b) - p.label;
      g1 += err * p.x; g2 += err * p.y; g0 += err;
    }
    g1 /= n; g2 /= n; g0 /= n;
    t.count('gradient evaluations');
    const norm = Math.hypot(g1, g2, g0);
    if (norm < TOL) {
      status = 'converged';
      t.frame(() => ({ line: [6, 7], note: `The gradient has length ${norm.toExponential(1)}, below the tolerance. Changing the weights or the bias would no longer lower the loss, so stop.`, views: views(), vars: { step: k, '‖g‖': norm.toExponential(1), loss: f3(losses[losses.length - 1]) } }));
      break;
    }
    const prev = losses[losses.length - 1];
    w1 -= eta * g1; w2 -= eta * g2; b -= eta * g0;
    const loss = crossEntropy(pts, w1, w2, b);
    losses.push(loss);
    weights.push([w1, w2, b]);
    const wrong = countWrong();
    const sides = wrong === 0 ? 'Every point is on the correct side of the boundary.' : `${wrong} of ${n} point${wrong === 1 ? ' is' : 's are'} on the wrong side of the boundary.`;
    const moved = `weights (**${f3(w1)}**, **${f3(w2)}**), bias **${f3(b)}**`;
    const trend = `The loss ${loss <= prev ? 'fell' : 'rose'} from ${f3(prev)} to ${f3(loss)}.${loss > prev ? ' A rise means the step was too long and jumped past the low point.' : ''}`;
    t.frame(() => ({ line: [3, 4, 5, 6, 7, 8, 9],
      note: k === 0
        ? `Step 1: for every point, subtract the true label from the predicted probability. That difference is the point's error. Averaging error × position over all points gives the gradient for the weights, (${f3(g1)}, ${f3(g2)}), and the plain average error, ${f3(g0)}, is the gradient for the bias. Move against the gradient by the learning rate: ${moved}. A boundary appears where the probability is one half. ${trend} ${sides}`
        : `Step ${k + 1}: gradient (${f3(g1)}, ${f3(g2)}) for the weights and ${f3(g0)} for the bias. Move against it: ${moved}. ${trend} ${sides}`,
      views: views(), vars: { step: k + 1, 'w₁': f3(w1), 'w₂': f3(w2), b: f3(b), loss: f3(loss), accuracy: pct((n - wrong) / n) } }));
  }

  const steps = losses.length - 1;
  const finalLoss = losses[steps];
  const correct = n - countWrong();
  const accuracy = correct / n;
  const size = Math.hypot(w1, w2);
  t.frame(() => {
    const kind = isCustom ? 'custom' : input.dataset;
    let verdict;
    if (accuracy === 1) verdict = 'Every point is on the correct side, so this line separates the classes. The loss is small but not zero, and it would keep falling: with perfectly separated data, larger weights always mean more confidence, so the weights grow for as long as training runs and there is no finite best answer.';
    else if (isLinearlySeparable(pts)) verdict = 'A direct check shows that a line separating these points does exist, but descent has not reached it yet. More steps or a larger learning rate will get there.';
    else if (kind === 'xor') verdict = 'Opposite corners share a label, so no straight line separates the classes. The pulls of opposite corners on the weights cancel, the weights stay close to zero, and the model ends barely better than a coin toss. More steps or a different learning rate will not help. The model needs a boundary that is not a single line.';
    else if (kind === 'moons') verdict = 'The two moons hook into each other, and a straight line can only cut across them, leaving part of each moon on the wrong side.';
    else if (kind === 'overlap') verdict = 'The two groups overlap, so no straight line can put every point on the correct side. The shading shows how sure the model is: pale near the boundary, strong far from it.';
    else verdict = 'A direct check confirms that no straight line separates these points, so some are bound to end on the wrong side.';
    return { line: 10,
      note: `${status === 'converged' ? `Converged after ${steps} steps` : `Stopped at the limit of ${steps} steps`} with loss ${f3(finalLoss)}. The boundary is the line ${f2(w1)}·x ${term(w2)}·y ${term(b)} = 0. Predicting class 1 wherever the probability is at least one half gets **${correct} of the ${n} training points** right: a training accuracy of **${pct(accuracy)}**. ${verdict}`,
      views: views(), vars: { steps, loss: f3(finalLoss), accuracy: pct(accuracy), '‖w‖': f3(size) } };
  });

  return { accuracy, correct, n, loss: finalLoss, w: [w1, w2], b, steps, status, losses, weights, initialLoss: losses[0], points: pts };
}

// Independent reference for the tests: Newton's method (iteratively reweighted least squares)
// on the same loss, solving the 3-by-3 system by Cramer's rule.
function newtonFit(pts) {
  let th = [0, 0, 0];
  const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  for (let it = 0; it < 50; it++) {
    const g = [0, 0, 0], H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const p of pts) {
      const f = [p.x, p.y, 1];
      const q = sigmoid(th[0] * p.x + th[1] * p.y + th[2]);
      for (let i = 0; i < 3; i++) { g[i] += (q - p.label) * f[i]; for (let j = 0; j < 3; j++) H[i][j] += q * (1 - q) * f[i] * f[j]; }
    }
    const d = det3(H);
    if (!(Math.abs(d) > 1e-300)) break;
    const step = [0, 1, 2].map((c) => det3(H.map((row, r) => row.map((v, j) => (j === c ? g[r] : v)))) / d);
    th = th.map((v, i) => v - step[i]);
    if (Math.hypot(...step) < 1e-12) break;
  }
  return th;
}

const EXAMPLE = [-1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 1, 1];

export default {
  meta: {
    id: 'logistic-regression',
    name: 'Logistic Regression',
    aliases: ['logit model', 'logistic model', 'binary logistic regression', 'sigmoid classifier', 'maximum entropy classifier'],
    kind: 'model',
    discipline: 'machine-learning',
    alsoIn: [
      { id: 'statistics', why: 'It is the standard regression model for a yes-or-no outcome. Each weight is the change in the log-odds of the outcome per unit of its feature, which is how results are reported in medicine and the social sciences.' },
      { id: 'deep-learning', why: 'A single artificial neuron with a sigmoid output, trained on cross-entropy, is logistic regression. The output layer of a network that classifies into two classes is the same model fed with learned features.' },
    ],
    subfield: 'Supervised learning',
    family: 'Linear models',
    lab: 'machine-learning',
    compareGroup: 'classification',
    summary: 'A two-class classifier that passes a weighted sum of the inputs through an S-shaped curve to get a probability, trained by gradient descent on cross-entropy.',
    difficulty: 'intermediate',
    order: 630,
    paradigms: ['gradient-based', 'iterative-refinement'],
    randomized: false,
    approximate: true,
    time: { best: 'O(nd) per step', average: 'O(nd·i) for i steps', worst: 'No finite optimum on separable data', class: 'iterative' },
    space: { worst: 'O(d)', class: 'linear' },
    tags: {
      problems: ['classify into two groups', 'predict yes or no', 'estimate a probability', 'spam or not spam', 'will a customer click'],
      techniques: ['sigmoid function', 'cross-entropy loss', 'gradient descent', 'maximum likelihood', 'decision boundary'],
      applications: ['machine learning', 'statistics', 'finance', 'bioinformatics', 'natural language'],
    },
    prerequisites: ['linear-regression', 'gradient-descent', 'concept:loss-function', 'concept:probability', 'concept:supervised-learning'],
  },

  bigIdea: {
    simple: "Logistic regression is a way to answer yes-or-no questions with a probability. Think of a doctor deciding whether a patient has a certain illness, using two measurements such as temperature and heart rate. Past patients are dots on a chart: one colour for those who were ill, another for those who were not. Logistic regression draws a straight line across the chart to separate the two colours as well as it can. A new patient far on one side of the line gets a confident answer, such as nine chances in ten of being ill. A patient right on the line gets fifty-fifty. Close to the line the answer is unsure, which is honest. The computer finds the line by starting with a poor one. It checks how wrong its probabilities are for the patients it already knows about, shifts the line a little to be less wrong, and repeats. The method can only draw a straight line. If the two colours cannot be split that way, it does a poor job.",
    what: 'Logistic regression computes a score for each input, a weighted sum of its features plus a bias, and passes the score through the **sigmoid** function, an S-shaped curve that maps any number to a value between 0 and 1. That value is read as the probability of class 1. The weights are chosen to minimize the **cross-entropy** loss, which punishes confident wrong answers heavily. There is no formula for the best weights, so they are found by iteration, here by [gradient descent](#/algorithm/gradient-descent).',
    why: 'A straight line fitted to 0 and 1 labels, as in [linear regression](#/algorithm/linear-regression), predicts values below 0 and above 1 and is dragged around by points that are already far on the correct side. Squashing the line\'s output into the range 0 to 1 fixes both problems and gives the output a meaning: a probability. Statisticians developed the model for outcomes such as survival or failure, and David Cox set out the regression form for binary data in 1958.',
    when: 'Use it when the outcome has two classes, you want probabilities and not just labels, and the classes can be separated reasonably well by a straight line or flat plane in the features you have. It is a strong default when the model must be explained. When the boundary is curved, either add features that capture the curve or use a model that can bend, such as [k-nearest neighbours](#/algorithm/knn) or a neural network.',
    interesting: 'It sits exactly between two worlds. Remove the sigmoid and you have linear regression. Replace the smooth sigmoid by a hard step and you have the [perceptron](#/algorithm/perceptron). Stack several of them in layers and you have a neural network, trained with the same loss and the same kind of gradient. And its failure on the XOR pattern is the limitation of single-layer models that Minsky and Papert analysed in 1969.',
    where: 'It is a standard tool for risk models in medicine, for credit scoring in banking, and for predicting whether a user will click on an advertisement or a search result. In machine learning it is the baseline classifier and the final layer of most networks that make a two-way decision.',
    analogy: {
      title: 'A ramp between a plain and a plateau',
      text: 'Picture the chart as a landscape seen from above. Along one straight line the ground is at exactly half height. On one side it rises smoothly to a plateau at height 1, and on the other it falls smoothly to a plain at height 0. The height at any spot is the model\'s probability that a point there belongs to class 1. Training turns the ramp, slides it and makes it steeper, until the known class 1 points stand on high ground and the known class 0 points on low ground.',
      limits: 'This ramp has the same profile all the way along, so its contour lines are straight and parallel. A real pattern may need a boundary that curves or closes on itself, which no turning or sliding of a straight ramp can produce. The height is also only the model\'s belief. It matches real frequencies only when a straight ramp is a fair description of the data. And if the two classes can be separated perfectly, training never finishes shaping the ramp: it keeps steepening it toward a cliff.',
    },
  },

  example: {
    setup: "Four points. Two are class 0, at (−1, 0) and (0, −1). Two are class 1, at (1, 0) and (0, 1). The model has two weights and a bias, all starting at 0. A point's score is the first weight times its x, plus the second weight times its y, plus the bias. An S-shaped curve turns the score into a probability of class 1: a score of 0 becomes 0.5, a score of 1 becomes 0.73 and a score of −1 becomes 0.27. Use a learning rate of 4.",
    steps: [
      "With all weights at 0, every point scores 0 and gets probability 0.5. The model is undecided about everything.",
      "Find each point's error: probability minus true label. The two class 0 points have error 0.5 − 0 = 0.5. The two class 1 points have error 0.5 − 1 = −0.5.",
      "For the first weight, multiply each error by that point's x and average: (0.5 × −1 + 0.5 × 0 − 0.5 × 1 − 0.5 × 0) ÷ 4 = −0.25. The same sum with y in place of x also gives −0.25. For the bias, average the errors alone: they cancel to 0.",
      "Move each number against its result, times the learning rate. The first weight becomes 0 − 4 × (−0.25) = 1. The second weight also becomes 1. The bias stays 0.",
      "Score the points again. The score is now x + y, which is −1 for both class 0 points and 1 for both class 1 points. The probabilities are 0.27 and 0.73.",
    ],
    result: "After one step each point gets probability 0.73 for its own true class, up from 0.5, and the boundary is the line where x + y = 0, with all four points on the correct side. More steps push 0.73 toward 1 without ever reaching it, because these points can be separated perfectly and larger weights always look better.",
    tryInput: { custom: EXAMPLE, rate: 4, steps: 10 },
  },

  terms: [
    { term: "Class", meaning: "One of the two possible answers. Here they are called class 0 and class 1." },
    { term: "Feature", meaning: "One measured number describing an example. Each point on the chart has two features, its x and y positions." },
    { term: "Weight", meaning: "A number that says how strongly, and in which direction, one feature pushes the answer toward class 1." },
    { term: "Bias", meaning: "A number added to every score. It shifts the boundary without turning it." },
    { term: "Score", meaning: "The weighted sum of a point's features plus the bias. Positive scores lean toward class 1, negative toward class 0." },
    { term: "Sigmoid", meaning: "An S-shaped curve that turns any score into a number between 0 and 1. Large positive scores give values near 1, large negative scores give values near 0, and a score of 0 gives one half." },
    { term: "Decision boundary", meaning: "The line where the score is 0 and the probability is exactly one half. Points on one side are predicted class 1, points on the other class 0." },
    { term: "Cross-entropy loss", meaning: "A score for how wrong the probabilities are. It is small when the true class is given high probability and grows without limit as the model becomes confident and wrong." },
    { term: "Linearly separable", meaning: "Describes two classes that some straight line can split perfectly, with every point of one class on one side." },
    { term: "Training accuracy", meaning: "The fraction of the points used for training that the finished model labels correctly." },
  ],

  takeaway: "Draw the straight line that best separates two groups, and let distance from the line say how sure you are.",

  viz: {
    describe: 'A square scatter plot of training points, green for class 0 and terracotta for class 1. The background is shaded terracotta in proportion to the predicted probability of class 1, clear where it is near 0 and strongest where it is near 1. An ink line marks the decision boundary, where the probability is one half, and brick rings mark points on the wrong side of it. As training runs the line turns and shifts and the shading sharpens. A second, smaller chart plots the cross-entropy loss at each step.',
    inputs: [
      { id: 'dataset', type: 'select', label: 'Dataset', options: datasetOptions, default: 'overlap' },
      { id: 'points', type: 'range', label: 'Training points', min: 10, max: 80, step: 2, default: 40 },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 7 },
      { id: 'rate', type: 'range', scale: 'log', label: 'Learning rate (η)', min: 0.01, max: 10, default: 4,
        help: 'Step length as a multiple of the gradient. Logarithmic slider.' },
      { id: 'steps', type: 'range', label: 'Maximum steps', min: 10, max: 300, step: 10, default: 100 },
      { id: 'custom', type: 'list', label: 'Or type your own training points', default: [], maxLength: 120, min: -1.5, max: 1.5, placeholder: 'e.g. -1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 1, 1',
        help: 'Read as x, y, class triples, with class 0 or 1. Leave empty to use the generated dataset.' },
    ],
    presets: [
      { label: 'Overlapping groups', values: { dataset: 'overlap', points: 40, seed: 7, rate: 4, steps: 100, custom: [] } },
      { label: 'Separable: the weights never stop growing', values: { dataset: 'separable', points: 40, seed: 1, rate: 4, steps: 300, custom: [] } },
      { label: 'Moons: a line across a curve', values: { dataset: 'moons', points: 40, seed: 1, rate: 4, steps: 150, custom: [] } },
      { label: 'XOR: a line cannot do it', values: { dataset: 'xor', points: 40, seed: 1, rate: 2, steps: 100, custom: [] } },
      { label: 'Tiny learning rate', values: { dataset: 'overlap', points: 40, seed: 7, rate: 0.05, steps: 100, custom: [] } },
      { label: 'Worked example: four points', values: { custom: EXAMPLE, rate: 4, steps: 10 } },
    ],
    tryThis: [
      'Run the default. The boundary swings into roughly the right place in the first few steps. After that the line barely moves, but the shading keeps sharpening as the weights grow: the model is becoming more confident, not changing its mind. Brick rings mark the points left on the wrong side.',
      'Load "XOR: a line cannot do it". The loss hardly leaves 0.693, the value for pure guessing, and the accuracy stays near 50 percent. Descent converges, to a model that has learned almost nothing. Then run [k-nearest neighbours](#/algorithm/knn) on the same dataset.',
      'Load "Separable: the weights never stop growing" and watch the last number in the readout, the length of the weight vector. The accuracy reaches 100 percent early, yet the loss keeps falling and the weights keep growing, and the shaded edge hardens toward a cliff. There is no finite set of best weights here.',
      'Load "Tiny learning rate" and compare the boundary after 100 steps with the default run. The direction is found early, but the loss has far to go. Then raise the rate to 10 on the XOR preset and watch the loss chart jump: the steps have become too long.',
    ],
    run,
    report: (r, c) => `Training accuracy: ${pct(r.accuracy)} (${r.correct} of ${r.n} training points on the correct side of the boundary).\nBoundary: ${f2(r.w[0])}·x ${term(r.w[1])}·y ${term(r.b)} = 0\nCross-entropy loss: ${f3(r.loss)} (started at ${f3(r.initialLoss)})\n${r.status === 'converged' ? 'Converged' : 'Stopped at the step limit'} after ${r.steps} steps, ${c['gradient evaluations'] || 0} gradient evaluations.`,
  },

  logic: {
    intuition: 'Take the linear model and ask it for a probability. The weighted sum can be any number, so squash it with the sigmoid into the range 0 to 1. Now choose the weights that make the observed labels as probable as possible: high probability for the class 1 points, low for the class 0 points. Maximizing that probability is the same as minimizing the cross-entropy loss. The loss is a smooth bowl in the weights, though not a parabola, so gradient descent can find its bottom. The gradient has a simple form: for each point, the error (probability minus label) times the point\'s features.',
    steps: [
      'Start with all weights and the bias at zero. Every prediction is one half.',
      'For each training point, compute the score, the weighted sum of its features plus the bias, and pass it through the sigmoid to get a probability.',
      'Compute each point\'s error: its predicted probability minus its true label (0 or 1).',
      'Average error × feature over all points to get the gradient for each weight. Average the errors alone to get the gradient for the bias.',
      'Subtract learning rate × gradient from the weights and the bias.',
      'Repeat from step 2 until the gradient is nearly zero or the step budget is spent.',
      'To classify a point, predict class 1 when its probability is at least one half, that is, when its score is not negative.',
    ],
    pseudocode: [
      'train(points, η, steps):',
      '  w ← (0, 0);  b ← 0',
      '  repeat up to steps times:',
      '    for each point (x, label):',
      '      p ← σ(w·x + b)',
      '      err ← p − label',
      '    g_w ← mean of err·x',
      '    g_b ← mean of err',
      '    w ← w − η·g_w',
      '    b ← b − η·g_b',
      '  predict 1 where σ(w·x+b) ≥ ½',
    ],
    decisions: [
      { title: 'Why cross-entropy and not squared error?', text: 'Cross-entropy is the negative log-likelihood of the labels under the model, so minimizing it is maximum likelihood estimation. With the sigmoid it gives a convex loss and a gradient proportional to the error. Squared error on sigmoid outputs is not convex, and its gradient almost vanishes for a point that is confidently wrong, exactly where a large correction is needed.' },
      { title: 'Gradient descent or Newton\'s method?', text: 'With a handful of features, Newton\'s method, known in this setting as iteratively reweighted least squares, converges in a few steps and is what statistical software uses. Gradient descent and its stochastic variants take over when there are very many features or examples, and they are what neural networks inherit.' },
      { title: 'Where to put the threshold?', text: 'One half is the natural default and gives the boundary drawn here. When one kind of mistake costs more than the other, such as missing an illness, the threshold is moved. The boundary shifts in parallel and the trade between false alarms and misses changes.' },
      { title: 'Should the weights be restrained?', text: 'Adding a penalty on the size of the weights, called regularization, gives a finite answer even on separable data and reduces overfitting when features are many. It is on by default in some widely used libraries. This page uses none, so that the unrestrained behaviour is visible.' },
    ],
    invariants: [
      'With a learning rate no larger than 1 divided by the largest curvature of the loss, the cross-entropy never increases from one step to the next.',
      'Every predicted probability lies strictly between 0 and 1.',
      'The decision boundary is always a straight line perpendicular to the weight vector.',
    ],
    edgeCases: [
      'Linearly separable data: the loss can always be lowered by scaling the weights up, so there is no minimum. The direction of the boundary settles while the weights grow without bound.',
      'All points in one class: the bias runs off toward plus or minus infinity for the same reason.',
      'Classes arranged like XOR: the best line is hardly better than no line, and the loss stays near that of guessing.',
      'Very large scores: computing the sigmoid or its logarithm directly can overflow or return exactly 0 or 1. Careful implementations work with the log of the sigmoid in a numerically stable form.',
      'Features on very different scales: the loss surface becomes a narrow valley and gradient descent slows down, as it does for linear regression.',
      'A learning rate that is too large: the loss jumps up and down in the early steps and may fail to settle.',
    ],
    correctness: 'The cross-entropy loss of logistic regression is a convex function of the weights and bias: its matrix of second derivatives is a sum of positive semidefinite terms. A convex function has no local minima other than global ones, so if gradient descent with a suitable learning rate converges, it converges to the best possible weights for this model. When the classes overlap, and the features are not redundant, that minimum exists and is unique. When the classes are linearly separable, no minimum exists and the iteration never truly converges. Either way, "best" means best among straight-line boundaries. The model can be optimal and still be wrong for the data, as on XOR.',
    mistakes: [
      'Computing the error as label minus probability and then subtracting the gradient, which climbs the loss.',
      'Leaving out the sigmoid and feeding raw scores into the logarithm of the loss.',
      'Reporting training accuracy as if it were accuracy on new data.',
      'Reading a predicted probability as trustworthy without checking calibration on held-out data.',
      'Interpreting the size of a weight as the importance of its feature when the features are on different scales.',
      'Expecting the weights to converge on separable data, and treating their endless growth as a bug.',
    ],
  },

  code: {
    sample: {
      input: 'Train on eight labelled points, which no straight line separates perfectly, with learning rate 1, printing the weights and loss at steps 0, 1, 10, 100 and 1000, then the training accuracy.',
      expected: 'step    0: w1=0.000 w2=0.000 b=0.000 loss=0.6931\nstep    1: w1=0.125 w2=0.219 b=0.000 loss=0.6341\nstep   10: w1=0.616 w2=1.348 b=-0.071 loss=0.4590\nstep  100: w1=0.476 w2=3.007 b=-0.354 loss=0.4017\nstep 1000: w1=0.403 w2=3.173 b=-0.378 loss=0.4013\ntraining accuracy: 6 of 8',
    },
    python: {
      source: `import math

# (x, y, label)
points = [(-1.0, -0.5, 0), (-0.5, -1.0, 0), (0.0, -0.5, 0), (0.5, 0.5, 0),
          (0.5, 0.0, 1), (0.0, 1.0, 1), (1.0, 0.5, 1), (-0.5, 0.5, 1)]
n = len(points)


def sigmoid(z):
    return 1.0 / (1.0 + math.exp(-z))


def loss(w1, w2, b):
    total = 0.0
    for x, y, label in points:
        p = sigmoid(w1 * x + w2 * y + b)
        total -= math.log(p) if label == 1 else math.log(1.0 - p)
    return total / n


w1, w2, b, rate = 0.0, 0.0, 0.0, 1.0
for step in range(1001):
    if step in (0, 1, 10, 100, 1000):
        print(f"step {step:4d}: w1={w1:.3f} w2={w2:.3f} b={b:.3f} loss={loss(w1, w2, b):.4f}")
    g1, g2, g0 = 0.0, 0.0, 0.0
    for x, y, label in points:
        err = sigmoid(w1 * x + w2 * y + b) - label
        g1 += err * x / n
        g2 += err * y / n
        g0 += err / n
    w1 -= rate * g1
    w2 -= rate * g2
    b -= rate * g0

correct = 0
for x, y, label in points:
    predicted = 1 if sigmoid(w1 * x + w2 * y + b) >= 0.5 else 0
    if predicted == label:
        correct += 1
print(f"training accuracy: {correct} of {n}")`,
      notes: [
        { line: 10, text: 'The sigmoid turns any score into a probability between 0 and 1.' },
        { line: 17, text: 'Cross-entropy: minus the logarithm of the probability the model gave to the true class. A confident wrong answer makes this very large.' },
        { line: 27, text: 'The error for one point is predicted probability minus true label. This one subtraction is the whole derivative of the loss with respect to the score.' },
        { line: 28, text: 'Each weight\'s gradient is the average of error times that feature, the same form as in linear regression.' },
        { line: 31, text: 'The update moves against the gradient. With rate 1 on this small dataset the loss falls at every step.' },
        { line: 37, text: 'A probability of at least one half means predict class 1. That is the same as asking whether the score is at least zero.' },
      ],
    },
    javascript: {
      source: `// [x, y, label]
const points = [[-1.0, -0.5, 0], [-0.5, -1.0, 0], [0.0, -0.5, 0], [0.5, 0.5, 0],
                [0.5, 0.0, 1], [0.0, 1.0, 1], [1.0, 0.5, 1], [-0.5, 0.5, 1]];
const n = points.length;

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function loss(w1, w2, b) {
  let total = 0;
  for (const [x, y, label] of points) {
    const p = sigmoid(w1 * x + w2 * y + b);
    total -= label === 1 ? Math.log(p) : Math.log(1 - p);
  }
  return total / n;
}

let w1 = 0, w2 = 0, b = 0;
const rate = 1;
for (let step = 0; step <= 1000; step++) {
  if ([0, 1, 10, 100, 1000].includes(step)) {
    console.log("step " + String(step).padStart(4, " ") + ": w1=" + w1.toFixed(3) + " w2=" + w2.toFixed(3)
      + " b=" + b.toFixed(3) + " loss=" + loss(w1, w2, b).toFixed(4));
  }
  let g1 = 0, g2 = 0, g0 = 0;
  for (const [x, y, label] of points) {
    const err = sigmoid(w1 * x + w2 * y + b) - label;
    g1 += err * x / n;
    g2 += err * y / n;
    g0 += err / n;
  }
  w1 -= rate * g1;
  w2 -= rate * g2;
  b -= rate * g0;
}

let correct = 0;
for (const [x, y, label] of points) {
  const predicted = sigmoid(w1 * x + w2 * y + b) >= 0.5 ? 1 : 0;
  if (predicted === label) correct++;
}
console.log("training accuracy: " + correct + " of " + n);`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>
#include <vector>

struct Point { double x, y; int label; };

const std::vector<Point> points = {
    {-1.0, -0.5, 0}, {-0.5, -1.0, 0}, {0.0, -0.5, 0}, {0.5, 0.5, 0},
    {0.5, 0.0, 1}, {0.0, 1.0, 1}, {1.0, 0.5, 1}, {-0.5, 0.5, 1}};
const int n = 8;

double sigmoid(double z) { return 1.0 / (1.0 + std::exp(-z)); }

double loss(double w1, double w2, double b) {
    double total = 0.0;
    for (const Point& p : points) {
        double q = sigmoid(w1 * p.x + w2 * p.y + b);
        total -= p.label == 1 ? std::log(q) : std::log(1.0 - q);
    }
    return total / n;
}

int main() {
    double w1 = 0.0, w2 = 0.0, b = 0.0;
    const double rate = 1.0;
    for (int step = 0; step <= 1000; ++step) {
        if (step == 0 || step == 1 || step == 10 || step == 100 || step == 1000) {
            std::printf("step %4d: w1=%.3f w2=%.3f b=%.3f loss=%.4f\\n", step, w1, w2, b, loss(w1, w2, b));
        }
        double g1 = 0.0, g2 = 0.0, g0 = 0.0;
        for (const Point& p : points) {
            double err = sigmoid(w1 * p.x + w2 * p.y + b) - p.label;
            g1 += err * p.x / n;
            g2 += err * p.y / n;
            g0 += err / n;
        }
        w1 -= rate * g1;
        w2 -= rate * g2;
        b -= rate * g0;
    }

    int correct = 0;
    for (const Point& p : points) {
        int predicted = sigmoid(w1 * p.x + w2 * p.y + b) >= 0.5 ? 1 : 0;
        if (predicted == p.label) ++correct;
    }
    std::printf("training accuracy: %d of %d\\n", correct, n);
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'One gradient step computes one score, one sigmoid and one error per training point, then updates each weight: O(nd) for n points with d features. The number of steps depends on the shape of the loss, which depends on the data. Prediction is a single weighted sum, O(d), however large the training set was.',
    cases: [
      { case: 'One gradient descent step', time: 'O(nd)', when: 'Every point contributes one error to every weight\'s gradient.' },
      { case: 'Training, overlapping classes', time: 'O(nd·i)', when: 'i steps until the gradient is small. The loss is convex with a unique minimum, and i grows as the classes become closer to separable and the surface flatter.' },
      { case: 'Training, separable classes', time: 'Never converges', when: 'The loss has no minimum. It decreases toward zero forever while the weights grow. Training is stopped by a step limit or by regularization.' },
      { case: 'One Newton step', time: 'O(nd² + d³)', when: 'Builds and solves a d-by-d system. Far fewer steps are needed, typically under ten for small d.' },
      { case: 'Predicting one point', time: 'O(d)', when: 'One weighted sum and one sigmoid. The training data are not needed.' },
    ],
    space: 'O(d) for the weights and the gradient, beyond the stored training data.',
    memory: 'The trained model is d weights and a bias. This is the opposite of k-nearest neighbours, which must keep every training point.',
    tradeoffs: 'A compact model and very fast prediction, in exchange for an iterative training phase and a boundary limited to a straight line. Newton\'s method trades more work per step for far fewer steps and is preferred when d is small.',
    assumptions: [
      'Evaluating the exponential function takes constant time.',
      'The step counts describe full-batch gradient descent with a fixed learning rate, as run on this page.',
      'No regularization is applied. With an L2 penalty the loss is strongly convex and has a unique finite minimum for any data.',
      'On this page d = 2.',
    ],
  },

  tradeoffs: {
    excels: [
      'Two classes that a straight line or flat plane separates reasonably well.',
      'Problems that need a probability, not only a label.',
      'Settings where the model must be explained, because each weight has a direct reading.',
      'Very large numbers of sparse features, where it trains quickly and predicts in one pass.',
    ],
    struggles: [
      'Curved or disconnected class regions, such as the moons and XOR datasets, unless suitable features are added.',
      'Perfectly separable data without regularization: the weights grow without bound and the probabilities become overconfident.',
      'Features that are strongly correlated with each other: the individual weights become unstable although the predictions stay reasonable.',
      'Classes that are heavily unbalanced, where the default threshold of one half is rarely the right one.',
    ],
    pitfalls: [
      'Judging the model by training accuracy alone.',
      'Using the default threshold without considering the costs of the two kinds of error.',
      'Forgetting to scale the features before gradient descent, or before comparing weights.',
      'Treating enormous weights on separable data as a sign of a very good model.',
    ],
    misunderstandings: [
      "\"Logistic regression predicts a number, as the name says.\" It predicts a probability and is used to classify. The name comes from the regression of the log-odds on the features.",
      "\"It can find any boundary if trained long enough.\" It can only place a straight line. On XOR it converges quickly, to a line that is useless.",
      "\"The output is the true probability.\" It is the model's estimate. It matches real frequencies only if a straight-line model suits the data, and it should be checked on data not used for training.",
      "\"A lower loss always means more points classified correctly.\" The loss also rewards being more confident about points that were already right. On separable data it keeps falling long after the accuracy has reached 100 percent.",
      "\"Because the loss is convex, training always converges.\" Convexity rules out bad local minima. It does not promise that a minimum exists, and on separable data there is none.",
    ],
    constraints: [
      'In practice a penalty on the weights is almost always added, and its strength is chosen by cross-validation.',
      'For more than two classes the sigmoid is replaced by the softmax function, giving multinomial logistic regression.',
    ],
    alternatives: [
      { id: 'knn', name: 'k-Nearest Neighbours', when: 'The boundary is irregular and you would rather keep the data than assume a line.' },
      { id: 'perceptron', name: 'Perceptron', when: 'Only a separating line is needed, without probabilities, and the data are separable.' },
      { id: 'decision-tree', name: 'Decision Tree Learning', when: 'The classes depend on thresholds and combinations of features that a single line cannot capture.' },
      { id: 'backpropagation', name: 'A neural network trained by backpropagation', when: 'The boundary is curved and features that straighten it are not known in advance.' },
      { id: 'linear-regression', name: 'Linear Regression', when: 'The outcome is a quantity, not one of two classes.' },
      { name: 'Support vector machine', when: 'A boundary with the widest possible margin is wanted, and probabilities are not needed.' },
    ],
    comparison: {
      columns: ['', 'Linear regression', 'Logistic regression', 'Perceptron'],
      rows: [
        ['Output', 'Any number', 'A probability between 0 and 1', 'A class, 0 or 1'],
        ['What is applied to the weighted sum', 'Nothing', 'The sigmoid', 'A hard threshold'],
        ['Loss', 'Squared error', 'Cross-entropy', 'Number of mistakes, handled by a correction rule'],
        ['Closed-form solution', 'Yes', 'No', 'No'],
        ['On separable data', 'Unaffected', 'Weights grow without bound', 'Stops after finitely many mistakes'],
        ['On XOR', 'Not applicable', 'Converges to a useless line', 'Never stops updating'],
      ],
    },
  },

  applications: [
    { title: 'Risk prediction in medicine', status: 'established', text: 'Models that estimate the probability of an outcome, such as a complication or the presence of a disease, from patient measurements are very often logistic regressions. The weights are reported as odds ratios, which clinicians can read directly.' },
    { title: 'Credit scoring', status: 'established', text: 'Lenders have long used logistic regression to estimate the probability that a borrower will default, in part because every factor\'s contribution to the score can be explained.' },
    { title: 'Click prediction', status: 'established', text: 'Predicting whether a user will click on an advertisement or a result is a two-class problem with enormous numbers of sparse features. Logistic regression trained by stochastic gradient methods was for many years the standard industrial model for it.' },
    { title: 'Text classification', status: 'established', text: 'With word counts as features, logistic regression is a strong and fast baseline for tasks such as separating spam from legitimate mail or assigning a sentiment to a review.' },
    { title: 'The output layer of a neural network', status: 'established', text: 'A network that makes a two-way decision ends in a single sigmoid unit trained with cross-entropy. That last layer is logistic regression applied to the features the earlier layers have learned.' },
    { title: 'Will it rain tomorrow?', status: 'illustrative', text: 'From today\'s pressure and humidity, a logistic model could give a probability of rain. The appeal is that it answers with a number such as 70 percent in place of a bare yes or no.' },
  ],

  connections: [
    { to: 'linear-regression', type: 'prerequisite', why: 'Both start from a weighted sum of the features. Logistic regression passes that sum through a sigmoid and changes the loss, and the gradient keeps the same form: error times feature.' },
    { to: 'gradient-descent', type: 'prerequisite', why: 'There is no formula for the best weights, so the convex cross-entropy loss is minimized by stepping against its gradient.' },
    { to: 'concept:loss-function', type: 'prerequisite', why: 'Training is defined as minimizing cross-entropy, the loss that corresponds to maximizing the probability of the observed labels.' },
    { to: 'concept:convexity', type: 'related', why: 'The loss is convex in the weights, so any minimum descent finds is the global one. Convexity does not guarantee that a minimum exists.' },
    { to: 'concept:activation-function', type: 'related', why: 'The sigmoid is the original activation function: a smooth, differentiable replacement for a hard threshold.' },
    { to: 'concept:overfitting', type: 'related', why: 'Unrestrained weights on separable data produce probabilities far more confident than the data justify. Regularization limits them.' },
    { to: 'perceptron', type: 'variant', why: 'Both draw a straight boundary from a weighted sum. The perceptron thresholds the sum and updates only on mistakes; logistic regression smooths the threshold and learns from every point in proportion to its error.' },
    { to: 'knn', type: 'same-problem', why: 'Both classify points into two classes. Nearest neighbours follows any boundary the data suggest and stores everything; logistic regression assumes a line and stores three numbers.' },
    { to: 'backpropagation', type: 'advanced', why: 'A neural network is layers of units like this one. Backpropagation extends the error-times-input gradient derived here through every layer by the chain rule.' },
    { to: 'concept:neural-network', type: 'advanced', why: 'Logistic regression is a network with no hidden layer. Adding hidden layers lets the model learn features in which a straight boundary is enough, which is how XOR is solved.' },
    { to: 'stochastic-gradient-descent', type: 'advanced', why: 'On large datasets the average over all points is replaced by an average over a small random batch, giving a cheap, noisy estimate of the same gradient.' },
    { to: 'newtons-method', type: 'related', why: 'Statistical software fits this model by Newton\'s method on the gradient of the loss, which uses the curvature to converge in a few steps.' },
    { to: 'bayesian-updating', type: 'related', why: 'The score is a log-odds. Adding a feature\'s weighted value to it is the same arithmetic as multiplying odds by a likelihood ratio when evidence arrives.' },
    { to: 'decision-tree', type: 'same-problem', why: 'Both classify from features. A tree cuts the space into boxes with axis-parallel splits and can represent XOR; logistic regression makes one oblique cut.' },
    { to: 'discipline:statistics', type: 'application', why: 'It is the generalized linear model for binary outcomes, fitted by maximum likelihood.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'What does the sigmoid function contribute to the model?',
      options: ['It makes the decision boundary curved', 'It turns an unbounded score into a number between 0 and 1 that can be read as a probability', 'It removes the need for a learning rate', 'It guarantees 100 percent accuracy on the training data'],
      answer: 1,
      explain: [
        'The boundary is where the score is zero, which is a straight line with or without the sigmoid.',
        'Correct. The weighted sum can be any number. The sigmoid maps it smoothly into the range 0 to 1.',
        'Gradient descent still needs a step length.',
        'Nothing guarantees that. On overlapping data some points must end on the wrong side.',
      ],
    },
    {
      type: 'predict',
      q: 'The XOR dataset has class 0 in the top-right and bottom-left corners and class 1 in the other two. What training accuracy does logistic regression reach on it?',
      options: ['Close to 100 percent, given enough steps', 'About 75 percent: it gets three of the four corners', 'About 50 percent, no better than guessing', '0 percent'],
      answer: 2,
      explain: [
        'More steps cannot help. The limit is the shape of the boundary, not the amount of training.',
        'A line that cuts off a single corner would score about this, but training does not find it. The pulls from opposite corners cancel and the weights stay near zero.',
        'Correct. The pulls from opposite corners cancel, the weights stay near zero, and the loss stays near 0.693, the value for guessing.',
        'Getting everything wrong would itself require a boundary that separates the classes.',
      ],
      tryInput: { dataset: 'xor', points: 40, seed: 1, rate: 2, steps: 100, custom: [] },
    },
    {
      type: 'debug',
      q: 'This training loop crashes with a math domain error inside the logarithm after a few steps. What is wrong?',
      code: `for step in range(1000):
    g1 = g2 = g0 = 0.0
    for x, y, label in points:
        p = w1 * x + w2 * y + b
        err = p - label
        g1 += err * x / n
        g2 += err * y / n
        g0 += err / n
    w1 -= rate * g1
    w2 -= rate * g2
    b -= rate * g0
    print(loss(w1, w2, b))`,
      options: ['The gradients should be reset inside the inner loop', 'The score is used as if it were a probability: the sigmoid is missing', 'The error should be label minus p', 'The learning rate is too small'],
      answer: 1,
      explain: [
        'They are correctly reset once per step.',
        'Correct. Without the sigmoid, p is a raw score that can be negative or greater than 1. The update is then the one for linear regression, and a loss that takes the logarithm of p or 1 − p fails.',
        'With a subtraction in the update, probability minus label is the right sign.',
        'A small rate would only be slow.',
      ],
    },
    {
      type: 'choice',
      q: 'On perfectly separable data, training accuracy reaches 100 percent after 20 steps. What happens if training continues for another 10,000 steps without regularization?',
      options: ['Nothing changes, because the model is already perfect', 'The weights keep growing and the loss keeps shrinking toward zero, without ever reaching it', 'The loss starts to rise', 'The boundary rotates until it misclassifies some points'],
      answer: 1,
      explain: [
        'The predictions on the training points do not change, but the weights do.',
        'Correct. Scaling the weights up makes every correct prediction more confident, which lowers the cross-entropy. There is always a little more to gain, so there is no finite minimum.',
        'With a suitable learning rate the convex loss cannot rise.',
        'The direction of the boundary settles. Only the size of the weights keeps changing.',
      ],
    },
    {
      type: 'challenge',
      title: 'Give the model the feature it lacks',
      prompt: 'Logistic regression fails on XOR because no straight line in (x, y) separates the classes. Add a third feature, the product x × y, so the score becomes w₁x + w₂y + w₃xy + b. Train on the XOR dataset and report the accuracy. Explain why the classes are linearly separable in the new three-feature space, and draw what the decision boundary looks like back in the original two dimensions.',
      hints: [
        'In two opposite corners x and y have the same sign, so their product is positive. In the other two it is negative.',
        'The boundary in the original plane is where w₃xy plus the smaller terms equals zero: roughly the two axes.',
      ],
    },
  ],

  compare: {
    idea: 'Pass a weighted sum of the features through a sigmoid to get a probability, and fit the weights by minimizing cross-entropy.',
    requires: 'Examples of both outcomes, measurements that are numbers, a step size and a limit on the number of steps.',
    sensitivity: 'Moderate. Sensitive to the learning rate and feature scaling during training, and to separability, which sends the weights to infinity.',
    memory: 'O(d): one weight per feature and a bias.',
    difficulty: 'moderate',
    difficultyNote: 'The code is short. Understanding why cross-entropy is used, and what the probabilities do and do not mean, takes more care.',
    limits: 'Straight boundaries only. If the groups separate perfectly it never settles unless it is held back. Its probabilities are only as good as the straight-line assumption.',
    useWhen: 'You need a probability of yes or no and a model you can explain, and a straight line can roughly separate the two groups.',
  },

  advanced: {
    history: 'The logistic function was introduced by Pierre-François Verhulst in the 1830s and 1840s as a model of population growth that levels off. In 1944 Joseph Berkson proposed using it to analyse dose-response experiments and coined the word "logit" for the log-odds. David Cox\'s 1958 paper set out regression for binary outcomes in the form used today, and the model became a standard part of statistics through the theory of generalized linear models introduced by Nelder and Wedderburn in 1972. In machine learning it is also known as the single-layer sigmoid network and as the maximum entropy classifier.',
    derivation: 'Let $p_i = \\sigma(w^\\top x_i + b)$ with $\\sigma(z) = 1/(1 + e^{-z})$ be the modelled probability that $y_i = 1$. The probability of the observed labels is $\\prod_i p_i^{y_i}(1 - p_i)^{1 - y_i}$. Taking the negative logarithm and averaging gives the cross-entropy loss\n\n$$L(w, b) = -\\frac{1}{n}\\sum_{i=1}^{n}\\Bigl[y_i \\log p_i + (1 - y_i)\\log(1 - p_i)\\Bigr].$$\n\nThe sigmoid satisfies $\\sigma\'(z) = \\sigma(z)(1 - \\sigma(z))$. Differentiating one term with respect to the score $z_i = w^\\top x_i + b$ gives\n\n$$\\frac{\\partial}{\\partial z_i}\\Bigl[-y_i\\log p_i - (1 - y_i)\\log(1 - p_i)\\Bigr] = -y_i(1 - p_i) + (1 - y_i)p_i = p_i - y_i,$$\n\nso by the chain rule\n\n$$\\nabla_w L = \\frac{1}{n}\\sum_i (p_i - y_i)\\,x_i, \\qquad \\frac{\\partial L}{\\partial b} = \\frac{1}{n}\\sum_i (p_i - y_i).$$\n\nThis is the "error times input" form used at every step. The decision boundary $p = \\tfrac12$ is the set $w^\\top x + b = 0$, a line in two dimensions.',
    proof: 'Convexity. Differentiating the gradient once more gives the Hessian with respect to the parameters $\\theta = (w, b)$ and augmented inputs $\\tilde{x}_i = (x_i, 1)$:\n\n$$H = \\frac{1}{n}\\sum_i p_i(1 - p_i)\\,\\tilde{x}_i\\tilde{x}_i^\\top.$$\n\nEach term is a positive multiple of an outer product, so $v^\\top H v = \\frac{1}{n}\\sum_i p_i(1-p_i)(v^\\top\\tilde{x}_i)^2 \\ge 0$ for every $v$: the loss is convex. Since $p(1-p) \\le \\tfrac14$, the largest eigenvalue of $H$ is at most a quarter of that of $\\frac{1}{n}\\sum_i \\tilde{x}_i\\tilde{x}_i^\\top$, which bounds the curvature and so gives a safe learning rate.\n\nNo minimum on separable data. Suppose some $\\theta$ separates the classes, so that $\\theta^\\top\\tilde{x}_i > 0$ exactly when $y_i = 1$. Then for $c > 0$ every term of $L(c\\,\\theta)$ is $\\log(1 + e^{-c|\\theta^\\top\\tilde{x}_i|})$, which decreases strictly toward 0 as $c \\to \\infty$. The infimum 0 is never attained, so $L$ has no minimizer.',
    complexityProof: 'Each step evaluates $n$ inner products of length $d$, $n$ sigmoids, and accumulates $n$ vectors of length $d$: $O(nd)$. With an L2 penalty of strength $\\lambda$ the loss is $\\lambda$-strongly convex and $L$-smooth with $L \\le \\tfrac14\\lambda_{\\max}(\\frac{1}{n}\\tilde{X}^\\top\\tilde{X}) + \\lambda$, so gradient descent with rate $1/L$ reaches accuracy $\\varepsilon$ in $O((L/\\lambda)\\log(1/\\varepsilon))$ steps. Without the penalty only the convex rate $O(1/\\varepsilon)$ is guaranteed when a minimizer exists.',
    variants: [
      { name: 'Regularized logistic regression', text: 'Adds a penalty on the weights: squared size (L2, or ridge) for stability, absolute size (L1, or lasso) to drive some weights to zero.' },
      { name: 'Multinomial (softmax) regression', text: 'Generalizes to more than two classes by giving each class its own weight vector and normalizing the exponentiated scores to sum to 1.' },
      { name: 'Iteratively reweighted least squares', text: 'Newton\'s method for this loss. Each step is a weighted linear regression, with weights p(1 − p) that emphasize uncertain points.' },
      { name: 'Stochastic gradient training', text: 'Updates the weights from one example or a small batch at a time, for datasets too large to scan at every step.' },
      { name: 'Probit regression', text: 'Uses the cumulative normal distribution in place of the sigmoid. The two curves are similar in shape and usually give similar conclusions.' },
    ],
    implementation: 'Compute the loss from the score, not the probability, to avoid taking the logarithm of 0: the loss of a point with label 1 and score z is log(1 + e^(−z)), evaluated in a form that does not overflow. Standardize features before gradient training. Add a penalty unless you have a reason not to. Check the gradient against finite differences once.',
    benchmarking: 'Report accuracy on held-out data, and for probabilities also the held-out log loss and a calibration plot. State the regularization strength and how it was chosen. When classes are unbalanced, accuracy is misleading and precision, recall or the area under the ROC curve should be reported as well.',
    references: [
      { authors: 'D. R. Cox', year: 1958, title: 'The regression analysis of binary sequences', venue: 'Journal of the Royal Statistical Society, Series B 20(2)' },
      { authors: 'J. Berkson', year: 1944, title: 'Application of the logistic function to bio-assay', venue: 'Journal of the American Statistical Association 39' },
      { authors: 'T. Hastie, R. Tibshirani and J. Friedman', year: 2009, title: 'The Elements of Statistical Learning: Data Mining, Inference, and Prediction (2nd edition)', venue: 'Springer' },
      { authors: 'C. M. Bishop', year: 2006, title: 'Pattern Recognition and Machine Learning', venue: 'Springer' },
    ],
    furtherReading: [
      'T. Hastie, R. Tibshirani and J. Friedman, *The Elements of Statistical Learning*, section 4.4, "Logistic Regression".',
      'C. M. Bishop, *Pattern Recognition and Machine Learning*, section 4.3, "Probabilistic Discriminative Models".',
      'J. S. Cramer, "The origins of logistic regression", Tinbergen Institute Discussion Paper (2002), for the history from Verhulst onward.',
    ],
  },

  tests: [
    { name: 'reaches the maximum-likelihood fit found independently by Newton\'s method', input: { dataset: 'moons', points: 40, seed: 1, rate: 5, steps: 300, custom: [] },
      check: (r) => {
        const ref = newtonFit(r.points);
        const refLoss = crossEntropy(r.points, ref[0], ref[1], ref[2]);
        if (r.loss < refLoss - 1e-12) return `loss ${r.loss} is below the Newton optimum ${refLoss}`;
        if (r.loss - refLoss > 1e-6) return `loss ${r.loss} is not within 1e-6 of the Newton optimum ${refLoss}`;
        const gap = Math.hypot(r.w[0] - ref[0], r.w[1] - ref[1], r.b - ref[2]);
        return gap < 0.05 || `weights (${r.w}, ${r.b}) differ from Newton (${ref}) by ${gap}`;
      } },
    { name: 'default run converges and matches Newton on overlapping data', input: {},
      check: (r) => {
        const ref = newtonFit(r.points);
        const refLoss = crossEntropy(r.points, ref[0], ref[1], ref[2]);
        return (r.status === 'converged' && r.loss - refLoss < 1e-6 && r.loss >= refLoss - 1e-12 && !isLinearlySeparable(r.points)) || `status ${r.status}, loss ${r.loss}, Newton ${refLoss}`;
      } },
    { name: 'loss never increases at a small learning rate', input: { dataset: 'overlap', points: 60, seed: 3, rate: 1, steps: 200, custom: [] },
      check: (r) => r.losses.every((v, i) => i === 0 || v <= r.losses[i - 1] + 1e-12) || 'loss increased' },
    { name: 'reported accuracy equals a recount from the returned weights', input: { dataset: 'moons', points: 50, seed: 4, rate: 4, steps: 100, custom: [] },
      check: (r) => {
        const right = r.points.filter((p) => (r.w[0] * p.x + r.w[1] * p.y + r.b >= 0 ? 1 : 0) === p.label).length;
        return (right === r.correct && Math.abs(right / r.n - r.accuracy) < 1e-12 && r.accuracy > 0.7 && r.accuracy < 1) || `recount ${right}, reported ${r.correct}, accuracy ${r.accuracy}`;
      } },
    { name: 'the worked example: one step gives weights (1, 1), bias 0, probability 0.73', input: { custom: EXAMPLE, rate: 4, steps: 10 },
      check: (r) => {
        const [a, b2, c] = r.weights[1];
        if (Math.abs(a - 1) > 1e-12 || Math.abs(b2 - 1) > 1e-12 || Math.abs(c) > 1e-12) return `weights after one step ${r.weights[1]}`;
        if (Math.abs(r.losses[0] - Math.log(2)) > 1e-12) return `initial loss ${r.losses[0]}`;
        if (Math.abs(sigmoid(1) - 0.731) > 1e-3 || Math.abs(r.losses[1] + Math.log(sigmoid(1))) > 1e-12) return `loss after one step ${r.losses[1]}`;
        return r.accuracy === 1 || `accuracy ${r.accuracy}`;
      } },
    { name: 'XOR stays at chance (quiz prediction)', input: { dataset: 'xor', points: 40, seed: 1, rate: 2, steps: 100, custom: [] },
      check: (r) => (r.accuracy >= 0.4 && r.accuracy <= 0.6 && r.loss > 0.68 && r.status === 'converged' && !isLinearlySeparable(r.points)) || `accuracy ${r.accuracy}, loss ${r.loss}, status ${r.status}` },
    { name: 'separable data: perfect accuracy, falling loss, weights still growing', input: { dataset: 'separable', points: 40, seed: 1, rate: 4, steps: 300, custom: [] },
      check: (r) => {
        const size = (i) => Math.hypot(r.weights[i][0], r.weights[i][1]);
        return (r.accuracy === 1 && isLinearlySeparable(r.points) && r.status === 'budget' && size(300) > size(200) && size(200) > size(100) && r.losses[300] < r.losses[200] && r.losses[300] > 0)
          || `accuracy ${r.accuracy}, status ${r.status}, sizes ${size(100)}, ${size(200)}, ${size(300)}`;
      } },
  ],
};
