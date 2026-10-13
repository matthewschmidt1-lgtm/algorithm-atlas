import { makeLine, DATA_RANGE } from '../../js/lib/datasets.js';

const TOL = 1e-4;
const f3 = (v) => {
  if (!Number.isFinite(v)) return String(v);
  if (Math.abs(v) >= 1e6) return v.toExponential(2);
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  const s = v.toFixed(3);
  return s === '-0.000' ? '0.000' : s;
};
const advice = (g, raise, lower, keep) => (Math.abs(g) < 5e-4 ? keep : g < 0 ? raise : lower);
const lineText = (w, b) => `y = ${f3(w)}·x ${b < 0 ? '−' : '+'} ${f3(Math.abs(b))}`;

function resolvePoints(input) {
  let pts;
  if (Array.isArray(input.custom) && input.custom.length) {
    const c = input.custom;
    if (c.length % 2 !== 0 || c.length < 4) throw new Error('Type your own points as x, y pairs: an even count of numbers, and at least two points.');
    pts = [];
    for (let i = 0; i < c.length; i += 2) pts.push({ x: c[i], y: c[i + 1] });
  } else {
    pts = makeLine({ points: input.points, noise: input.noise, seed: input.seed }).points.map((p) => ({ x: p.x, y: p.y }));
  }
  // The experiment shifts every x sideways to show what an off-centre feature does to the descent.
  const shift = Number(input.shift) || 0;
  if (shift) pts = pts.map((p) => ({ x: p.x + shift, y: p.y }));
  return pts;
}

// Ordinary least squares for one feature: the reference the iteration must converge to.
function closedForm(pts) {
  const n = pts.length;
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0;
  for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) * (p.x - mx); }
  if (sxx < 1e-12) throw new Error('Every point has the same x value, so no single slope fits best. Spread the points out sideways.');
  const w = sxy / sxx;
  return { w, b: my - w * mx, meanX: mx, meanY: my };
}

function run(input, t) {
  let pts = resolvePoints(input);
  const n = pts.length;
  const best = closedForm(pts);
  const center = !!input.center;
  if (center) pts = pts.map((p) => ({ x: p.x - best.meanX, y: p.y }));

  const mse = (w, b) => {
    let s = 0;
    for (const p of pts) { const r = w * p.x + b - p.y; s += r * r; }
    return s / n;
  };
  // Largest curvature of the loss surface: the top eigenvalue of (2/n)·XᵀX.
  let m1 = 0, m2 = 0;
  for (const p of pts) { m1 += p.x; m2 += p.x * p.x; }
  m1 /= n; m2 /= n;
  const curvature = (m2 + 1) + Math.sqrt((m2 - 1) * (m2 - 1) + 4 * m1 * m1);
  const eta = input.autoRate ? 1 / curvature : input.rate;
  const maxSteps = input.steps;

  let w = 0, b = 0;
  const bestForFit = center ? { w: best.w, b: best.meanY } : best;
  const bestLoss = mse(bestForFit.w, bestForFit.b);
  const losses = [mse(w, b)];
  let status = 'budget';
  const [lo, hi] = DATA_RANGE;
  const clampY = (v) => Math.max(-1e4, Math.min(1e4, v));

  const views = (showResiduals) => {
    const layers = [];
    if (showResiduals) layers.push({ type: 'segments', segments: pts.map((p) => [p.x, p.y, p.x, clampY(w * p.x + b)]), role: 'compare', width: 1.3, alpha: 0.85 });
    layers.push({ type: 'line', points: [[lo, best.w * lo + best.b], [hi, best.w * hi + best.b]], role: 'done', width: 1.6, dash: true });
    layers.push({ type: 'line', points: [[lo, clampY(w * lo + b)], [hi, clampY(w * hi + b)]], role: 'active', width: 2.6 });
    layers.push({ type: 'points', points: pts.map((p) => [p.x, p.y]), role: 'ink', r: 3.6 });
    const finite = losses.filter(Number.isFinite);
    const top = Math.max(...finite, 1e-9);
    const span = Math.max(10, maxSteps);
    return [
      { kind: 'scene', title: 'The data and the current line', x: DATA_RANGE, y: DATA_RANGE, aspect: 0.56, axes: { xLabel: 'x (input)', yLabel: 'y (output)' }, layers,
        legend: [{ label: 'data point', role: 'ink' }, { label: 'current line', role: 'active' }, { label: 'residual (gap between point and line)', role: 'compare' }, { label: 'least squares line from the formula', role: 'done' }] },
      { kind: 'scene', title: 'Mean squared error at each step', x: [0, span], y: [0, top * 1.08], aspect: 0.2, axes: { xLabel: 'step' },
        layers: [
          { type: 'line', points: [[0, bestLoss], [span, bestLoss]], role: 'done', width: 1.3, dash: true },
          { type: 'line', points: losses.map((v, i) => [i, Number.isFinite(v) ? Math.min(v, top * 2) : top * 2]), role: 'active', width: 2 },
        ],
        legend: [{ label: 'loss of the current line', role: 'active' }, { label: 'smallest possible loss', role: 'done' }] },
    ];
  };

  t.frame(() => ({ line: 1,
    note: `${n} points. Start with the flat line y = 0. Each ochre segment is a **residual**: the vertical gap between a point and the line. Square every residual and average them to get the loss, the mean squared error: **${f3(losses[0])}**. The dashed green line is the least squares line from the formula, ${lineText(best.w, best.b)}. Descent should end up there.`,
    views: views(true), vars: { w: f3(w), b: f3(b), loss: f3(losses[0]) } }));

  let k = 0;
  for (; k < maxSteps; k++) {
    let gw = 0, gb = 0;
    for (const p of pts) { const r = w * p.x + b - p.y; gw += r * p.x; gb += r; }
    gw *= 2 / n; gb *= 2 / n;
    t.count('gradient evaluations');
    const norm = Math.hypot(gw, gb);
    if (norm < TOL) {
      status = 'converged';
      t.frame(() => ({ line: 6, note: `Both gradient values are now almost zero (length ${norm.toExponential(1)}). Tilting or shifting the line would no longer lower the loss, so stop.`, views: views(true), vars: { step: k, 'g_w': gw.toExponential(1), 'g_b': gb.toExponential(1), loss: f3(losses[losses.length - 1]) } }));
      break;
    }
    t.frame(() => ({ line: [3, 4, 5],
      note: `Measure every residual with the current line and combine them into the gradient: ${f3(gw)} for the slope and ${f3(gb)} for the intercept. A negative value means the loss falls if that number is raised. So the line should ${advice(gw, 'tilt upward', 'tilt downward', 'keep its tilt')} and ${advice(gb, 'move up', 'move down', 'stay at this height')}.`,
      views: views(true), vars: { step: k, 'g_w': f3(gw), 'g_b': f3(gb), loss: f3(losses[losses.length - 1]) } }));
    const w0 = w, b0 = b;
    w -= eta * gw;
    b -= eta * gb;
    const loss = mse(w, b);
    const prev = losses[losses.length - 1];
    losses.push(loss);
    if (!Number.isFinite(loss) || loss > 1e6) {
      status = 'diverged';
      t.frame(() => ({ line: [7, 8], note: `Step ${k + 1} threw the line far off the chart and the loss has passed a million. Every step overshoots by more than the last: the learning rate is too large and the iteration has **diverged**.`, views: views(false), vars: { step: k + 1 } }));
      break;
    }
    t.frame(() => ({ line: [7, 8],
      note: `Step ${k + 1}: move each number against its gradient, by learning rate × gradient. Slope ${f3(w0)} → **${f3(w)}**, intercept ${f3(b0)} → **${f3(b)}**. The loss ${loss <= prev ? 'fell' : 'rose'} from ${f3(prev)} to ${f3(loss)}.${loss > prev ? ' A rise means the step jumped past the best line and landed farther away on the other side.' : ''}`,
      views: views(true), vars: { step: k + 1, w: f3(w), b: f3(b), loss: f3(loss) } }));
  }

  const finalLoss = losses[losses.length - 1];
  const steps = losses.length - 1;
  if (status === 'converged') {
    t.frame(() => ({ line: [9, 11, 12],
      note: `Converged after ${steps} steps at ${lineText(w, b)}. The formula gives ${lineText(bestForFit.w, bestForFit.b)}. The two agree because this loss has a single lowest point, and both methods find it. The remaining loss, ${f3(finalLoss)}, is scatter that no straight line can remove.`,
      views: views(true), vars: { steps, w: f3(w), b: f3(b), loss: f3(finalLoss) } }));
  } else if (status === 'budget') {
    const worse = finalLoss > losses[0];
    t.frame(() => ({ line: [9, 11, 12],
      note: worse
        ? `Used all ${maxSteps} steps, and the loss (${f3(finalLoss)}) is higher than where it started (${f3(losses[0])}). The line is swinging farther from the data with every step: the learning rate is too large.`
        : `Used all ${maxSteps} steps and stopped at ${lineText(w, b)} with loss ${f3(finalLoss)}. The formula gives ${lineText(bestForFit.w, bestForFit.b)} with loss ${f3(bestLoss)}. The gradient is not yet below the tolerance, so more steps or a larger learning rate would bring the line closer.`,
      views: views(true), vars: { steps, w: f3(w), b: f3(b), loss: f3(finalLoss) } }));
  }

  // Report the fit in the original coordinates even when the experiment centred x first.
  const outB = center ? b - w * best.meanX : b;
  return { w, b: outB, loss: finalLoss, closedForm: { w: best.w, b: best.b, loss: bestLoss }, steps, status, losses, n, initialLoss: losses[0] };
}

// Variance of the generated x values, used only to draw the theory curve of the experiment.
const X_VARIANCE = (() => {
  const xs = makeLine({ points: 24, noise: 0, seed: 1 }).points.map((p) => p.x);
  const m = xs.reduce((s, v) => s + v, 0) / xs.length;
  return xs.reduce((s, v) => s + (v - m) * (v - m), 0) / xs.length;
})();
const conditionNumber = (shift) => {
  const m2 = X_VARIANCE + shift * shift;
  const root = Math.sqrt((m2 - 1) * (m2 - 1) + 4 * shift * shift);
  return (m2 + 1 + root) / (m2 + 1 - root);
};

export default {
  meta: {
    id: 'linear-regression',
    name: 'Linear Regression',
    aliases: ['least squares', 'ordinary least squares', 'OLS', 'line of best fit', 'simple linear regression', 'linear least squares'],
    kind: 'model',
    discipline: 'machine-learning',
    alsoIn: [
      { id: 'statistics', why: 'Least squares is the founding method of statistical estimation, and regression is still the first tool for measuring how one quantity changes with another.' },
      { id: 'finance', why: 'A stock\'s beta, its sensitivity to the market, is the slope of a regression of the stock\'s returns on the returns of a market index.' },
    ],
    subfield: 'Supervised learning',
    family: 'Linear models',
    lab: 'machine-learning',
    year: 1805,
    authors: 'Adrien-Marie Legendre',
    summary: 'Fits a straight line to data by choosing the slope and intercept that make the squared vertical gaps between line and points as small as possible.',
    difficulty: 'beginner',
    order: 600,
    paradigms: ['gradient-based', 'iterative-refinement'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n) closed form, one feature', average: 'O(nd) per gradient step', worst: 'O(nd² + d³) normal equations, d features', class: 'linear' },
    space: { worst: 'O(d) for gradient descent, O(d²) for the normal equations', class: 'linear' },
    tags: {
      problems: ['line of best fit', 'fit a line to data', 'predict a number', 'find a trend', 'estimate a relationship', 'forecast from past data', 'predict a house price from its size'],
      techniques: ['least squares', 'mean squared error', 'gradient descent', 'normal equations'],
      applications: ['machine learning', 'statistics', 'finance', 'scientific computing', 'engineering design'],
    },
    prerequisites: ['concept:supervised-learning', 'concept:loss-function', 'concept:derivative', 'gradient-descent'],
  },

  bigIdea: {
    simple: "Linear regression is a way to draw the best straight line through a scatter of dots. Suppose you write down how tall each of your classmates is and how big their shoes are. Put one dot on a chart for every person. The dots form a rough, sloping cloud, because taller people tend to have bigger feet. No straight line passes through every dot, so which line is the best one? The usual answer goes like this. For each dot, measure how far above or below the line it sits. Multiply each of those gaps by itself, so that big misses count for a lot. Then add them all up. The best line is the one with the smallest total. A computer can find it by starting with any line and nudging it, a little at a time, in whichever way makes the total smaller. Once you have the line, you can use it to make a sensible guess about someone new. Give it a height, and it reads off a shoe size.",
    what: 'Linear regression fits a straight line $y = wx + b$ to a set of points. The slope $w$ and the intercept $b$ are chosen to minimize the **mean squared error**: the average of the squared vertical gaps between each point and the line. This page finds that line twice: step by step with [gradient descent](#/algorithm/gradient-descent), and directly with a formula. The two answers agree.',
    why: 'Measurements are never exact, so several observations of the same relationship disagree with each other. Legendre published the method of least squares in 1805 as a principled way to combine such observations when computing the orbits of comets, and Gauss gave it a probabilistic justification in 1809. It turned "draw a line that looks about right" into a calculation with one definite answer.',
    when: 'Use it when the output is a number, the relationship is roughly straight over the range you care about, and you want a model you can read: the slope says how much the output changes per unit of input. Check a scatter plot first. If the points follow a curve, add transformed inputs or choose another model. If the output is a yes or no, use [logistic regression](#/algorithm/logistic-regression).',
    interesting: 'It is one of the few learning problems with an exact answer. The loss surface is a single smooth bowl, so the formula and the step-by-step descent must arrive at the same line. That makes it the ideal place to watch gradient descent work, because you can always check where it should end up.',
    where: 'It is the default first model in statistics, economics and the experimental sciences, and the baseline against which more complicated machine learning models are judged. A neural network with no hidden layers and a squared error loss is exactly this model.',
    analogy: {
      title: 'A rod held by springs',
      text: 'Pin every data point to the chart. Attach a spring from each pin straight up or down to a stiff rod, and let go. Each spring pulls the rod toward its own pin, and a spring stretched twice as far stores four times the energy. The rod swings and slides until the pulls balance. That resting position is the least squares line: it is the position with the least total energy in the springs, and spring energy grows with the square of the stretch.',
      limits: 'The springs in this picture can only stretch straight up and down, which no real spring would do without a guide rail. The method measures vertical gaps on purpose, because it is predicting y from x. The picture also explains a weakness as well as a strength: one pin placed far from the others stretches its spring so much that it drags the whole rod toward itself. And the rod settles somewhere even when the pins follow a curve, so a resting position is no evidence that a straight line was the right shape to use.',
    },
  },

  example: {
    setup: "Three points: (−1, −1), (0, 0.5) and (1, 0.5). The first number is the input x and the second is the output y. For any line, the gap between a point's real y and the line's y at that point is called a residual. Score a line by squaring each residual and adding the squares. Lower is better.",
    steps: [
      "Start with the flat line y = 0. Its residuals are 1, 0.5 and 0.5. Squared, they are 1, 0.25 and 0.25. The score is 1.5.",
      "The left point is below the line and the right point is above it, so tilt the line upward to the right. Try y = 0.5 × x. It predicts −0.5, 0 and 0.5. The residuals are 0.5, 0.5 and 0, and the score is 0.25 + 0.25 + 0 = 0.5.",
      "Tilt a little more: y = 0.75 × x. It predicts −0.75, 0 and 0.75. The residuals are 0.25, 0.5 and 0.25, and the score is 0.0625 + 0.25 + 0.0625 = 0.375.",
      "Tilt too far: y = 1 × x. It predicts −1, 0 and 1. The residuals are 0, 0.5 and 0.5, and the score rises back to 0.5.",
      "The least squares formula confirms it. The best slope is 0.75 and the best height where the line crosses x = 0 is 0.",
    ],
    result: "The best line is y = 0.75 × x, with a score of 0.375. No straight line can score lower, yet it does not pass through a single one of the three points. The visualization reports the average instead of the total, which is 0.375 ÷ 3 = 0.125. Load this example and the first step of the descent lands exactly on y = 0.5 × x, then creeps toward 0.75.",
    tryInput: { custom: [-1, -1, 0, 0.5, 1, 0.5], rate: 0.5, steps: 40 },
  },

  terms: [
    { term: "Slope", meaning: "How much the line rises when x increases by one. A slope of 2 means the line climbs two units for every unit it moves right." },
    { term: "Intercept", meaning: "The height of the line where x is zero. Changing it slides the whole line up or down without tilting it." },
    { term: "Residual", meaning: "The vertical gap between a data point and the line: how far the line's prediction misses that point." },
    { term: "Mean squared error", meaning: "The average of the squared residuals. It is the score that linear regression makes as small as possible." },
    { term: "Loss", meaning: "A score for how badly a model fits the data. Lower is better. Here the loss is the mean squared error." },
    { term: "Least squares", meaning: "The rule of choosing the line whose squared residuals add up to the smallest total." },
    { term: "Gradient", meaning: "A pair of numbers saying how fast the loss would change if the slope or the intercept were nudged upward." },
    { term: "Learning rate", meaning: "A number that sets how far the line moves at each step of gradient descent." },
    { term: "Outlier", meaning: "A data point that lies far from the pattern of the rest." },
  ],

  takeaway: "The best line is the one that makes the squared gaps between the line and the points add up to the least.",

  viz: {
    describe: 'A scatter plot of data points in ink with a terracotta line through them. Short ochre vertical segments join each point to the line: these are the residuals. A dashed green line shows the least squares line computed by formula. As gradient descent runs, the terracotta line tilts and shifts until it lies on the dashed one. A second, smaller chart plots the mean squared error at each step, with a dashed green line at the smallest possible value.',
    inputs: [
      { id: 'points', type: 'range', label: 'Number of points', min: 5, max: 60, step: 1, default: 24 },
      { id: 'noise', type: 'range', label: 'Noise', min: 0, max: 0.6, step: 0.05, default: 0.25,
        help: 'How far the points scatter above and below the line they were generated from. 0 puts them exactly on it.' },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 3 },
      { id: 'rate', type: 'range', scale: 'log', label: 'Learning rate (η)', min: 0.01, max: 1.2, default: 0.2,
        help: 'Step length as a multiple of the gradient. Logarithmic slider.' },
      { id: 'steps', type: 'range', label: 'Maximum steps', min: 10, max: 200, step: 10, default: 60 },
      { id: 'custom', type: 'list', label: 'Or type your own points', default: [], maxLength: 80, min: -1.5, max: 1.5, placeholder: 'e.g. -1, -1, 0, 0.5, 1, 0.5',
        help: 'Numbers between −1.5 and 1.5, read as x, y pairs. Leave empty to use the generated points.' },
    ],
    presets: [
      { label: 'Steady descent', values: { points: 24, noise: 0.25, seed: 3, rate: 0.2, steps: 60, custom: [] } },
      { label: 'No noise: a perfect fit', values: { points: 24, noise: 0, seed: 3, rate: 0.2, steps: 60, custom: [] } },
      { label: 'Very noisy data', values: { points: 40, noise: 0.6, seed: 3, rate: 0.2, steps: 60, custom: [] } },
      { label: 'Tiny steps: not finished', values: { points: 24, noise: 0.25, seed: 3, rate: 0.02, steps: 60, custom: [] } },
      { label: 'Step too large', values: { points: 24, noise: 0.25, seed: 3, rate: 1.05, steps: 60, custom: [] } },
      { label: 'Worked example: three points', values: { custom: [-1, -1, 0, 0.5, 1, 0.5], rate: 0.5, steps: 40 } },
    ],
    tryThis: [
      'Run the default and watch the first few steps. The line swings up quickly, then the steps shrink by themselves as the gradient gets smaller near the best line. Compare the final slope and intercept with the formula\'s values in the output panel.',
      'Raise the learning rate slowly from 0.2. Around 0.5 the fit takes far fewer steps. Close to 1 the line starts to bounce above and below the data. Just past 1 each bounce is bigger than the last and the loss climbs. The limit is 2 divided by the largest curvature of the loss surface, which is about 2 for this data.',
      'Load "No noise: a perfect fit". Every residual shrinks to nothing and the loss reaches zero. Now raise the noise. The smallest possible loss (the dashed line in the lower chart) rises, because no straight line can remove scatter.',
      'Load "Tiny steps: not finished". Sixty steps are not enough at this learning rate. Read the gap between the two lines in the final frame, then raise the maximum steps until they meet.',
    ],
    run,
    report: (r) => `Gradient descent: ${lineText(r.w, r.b)}   (${r.status === 'converged' ? 'converged' : r.status === 'diverged' ? 'diverged' : 'stopped at the step limit'} after ${r.steps} steps)\nLeast squares formula: ${lineText(r.closedForm.w, r.closedForm.b)}\nMean squared error: ${f3(r.loss)} (smallest possible: ${f3(r.closedForm.loss)}) on ${r.n} points.`,
    experiment: {
      title: 'Steps to converge when the inputs are not centred',
      note: 'Each point is a real run on 24 generated points (noise 0.25) whose x values have all been shifted to the right by the amount on the horizontal axis. The learning rate is 1 divided by the largest curvature of that loss surface, and the run stops when the gradient is shorter than 0.0001. "Centred first" subtracts the mean of x before fitting, which undoes the shift. The theory curve is the condition number of the loss surface, scaled to the last measured point.',
      metric: 'gradient evaluations',
      metricLabel: 'Steps to converge',
      sizeLabel: 'Shift added to every x value',
      sizes: [0, 0.5, 1, 1.5, 2, 3, 4],
      variants: [
        { id: 'raw', label: 'Shifted inputs' },
        { id: 'centred', label: 'Centred first' },
      ],
      input: (shift, variant, seed) => ({ points: 24, noise: 0.25, seed, custom: [], shift, center: variant === 'centred', autoRate: true, steps: 200000 }),
      theory: [
        { label: 'condition number κ (scaled)', fn: (s) => conditionNumber(s), scaled: true, variant: 'raw' },
      ],
    },
  },

  logic: {
    intuition: 'Every candidate line is a pair of numbers, a slope and an intercept. Give each pair a score: the mean squared error of that line on the data. The scores form a surface over the plane of all pairs, and for squared error that surface is a single smooth bowl. Fitting the line means finding the bottom of the bowl. You can walk there downhill, or you can solve for the point where the surface is flat in both directions, which is what the formula does.',
    steps: [
      'Start with any line. This page starts with slope 0 and intercept 0.',
      'For each point, compute the residual: the line\'s prediction minus the point\'s actual y.',
      'Combine the residuals into the gradient. The slope\'s share is the average of residual × x, doubled. The intercept\'s share is the average residual, doubled.',
      'If both shares are nearly zero, the line is at the bottom of the bowl. Stop.',
      'Otherwise subtract learning rate × gradient from the slope and the intercept, and repeat from step 2.',
      'Independently, compute the closed form: the slope is the covariance of x and y divided by the variance of x, and the intercept makes the line pass through the point of averages.',
    ],
    pseudocode: [
      'fit_line(points, η, steps):',
      '  w ← 0;  b ← 0',
      '  repeat up to steps times:',
      '    r ← w·x + b − y per point',
      '    g_w ← (2/n)·Σ r·x',
      '    g_b ← (2/n)·Σ r',
      '    if g_w, g_b ≈ 0: stop',
      '    w ← w − η·g_w',
      '    b ← b − η·g_b',
      '  return w, b',
      'closed_form(points):',
      '  w* ← Σ(x−x̄)(y−ȳ) / Σ(x−x̄)²',
      '  b* ← ȳ − w*·x̄',
    ],
    decisions: [
      { title: 'Formula or iteration?', text: 'With one input, or a few hundred, solve directly: it is exact and needs no learning rate. Iterate when there are so many inputs that building and solving the normal equations costs too much, when the data arrive in a stream, or when the same code must also train models that have no formula.' },
      { title: 'Why square the residuals?', text: 'Squaring makes every gap count as positive, gives a smooth loss with a single minimum, and leads to a formula. It also has a statistical meaning: if the scatter around the line is Gaussian, the least squares line is the most probable one. The price is sensitivity to outliers, because a residual three times larger counts nine times as much.' },
      { title: 'How large a learning rate?', text: 'The loss decreases at every step when the rate is below 2 divided by the largest curvature of the bowl. For the data on this page that limit is close to 1. Centring and rescaling the inputs makes the bowl rounder, which lets one rate work well in every direction.' },
    ],
    invariants: [
      'With a learning rate below 2 divided by the largest curvature, the mean squared error never increases from one step to the next.',
      'At the least squares line the residuals sum to zero, and so do the residuals multiplied by their x values. The line always passes through the point (mean of x, mean of y).',
    ],
    edgeCases: [
      'All points share the same x: the slope is undefined, because every line through the mean of y at that x fits equally well. The page reports this instead of dividing by zero.',
      'Exactly two points with different x: the line passes through both and the loss is zero.',
      'An outlier: one distant point can change the slope noticeably, because its squared residual dominates the sum.',
      'A curved relationship: the method still returns a line. The residuals then show a pattern, positive at the ends and negative in the middle or the reverse, which is the sign that a line is the wrong shape.',
      'Inputs far from zero: the bowl becomes a long narrow valley and gradient descent slows down sharply, although the formula is unaffected. See the experiment.',
    ],
    correctness: 'The mean squared error is a quadratic function of the slope and intercept, and its matrix of second derivatives is positive semidefinite, so the loss is convex. When the x values are not all equal the matrix is positive definite: the bowl has exactly one lowest point, where both partial derivatives are zero. Setting them to zero gives two linear equations, the normal equations, whose solution is the closed form. Gradient descent with a small enough learning rate converges to the same point because a convex quadratic has no other stationary point to stop at. What is **not** guaranteed is that the line means anything: least squares finds the best line for the data, whether or not a line is a sensible description of them.',
    mistakes: [
      'Computing the residual as actual minus predicted and then subtracting the gradient anyway, which flips the sign and climbs the loss.',
      'Forgetting the factor x in the slope\'s gradient, so the slope and intercept receive the same update.',
      'Reading the slope as proof of cause. A regression line describes how two quantities move together in the data, and nothing more.',
      'Predicting far outside the range of the data. The line is only supported by evidence where there were points.',
      'Judging the fit only by the loss on the data used to fit it. A model should be checked on data it has not seen.',
    ],
  },

  code: {
    sample: {
      input: 'Fit a line to the five points (−2, −3.1), (−1, −0.9), (0, 1.2), (1, 2.8), (2, 5.0) by gradient descent with learning rate 0.1, printing every tenth step, then print the closed-form answer.',
      expected: 'step  0: w=0.0000 b=0.0000 mse=8.9400\nstep 10: w=1.9780 b=0.8926 mse=0.0316\nstep 20: w=1.9899 b=0.9885 mse=0.0199\nstep 30: w=1.9900 b=0.9988 mse=0.0198\nstep 40: w=1.9900 b=0.9999 mse=0.0198\nstep 50: w=1.9900 b=1.0000 mse=0.0198\nstep 60: w=1.9900 b=1.0000 mse=0.0198\nclosed form: w=1.9900 b=1.0000 mse=0.0198',
    },
    python: {
      source: `xs = [-2.0, -1.0, 0.0, 1.0, 2.0]
ys = [-3.1, -0.9, 1.2, 2.8, 5.0]
n = len(xs)


def mse(w, b):
    total = 0.0
    for x, y in zip(xs, ys):
        r = w * x + b - y
        total += r * r
    return total / n


w, b, rate = 0.0, 0.0, 0.1
for step in range(61):
    if step % 10 == 0:
        print(f"step {step:2d}: w={w:.4f} b={b:.4f} mse={mse(w, b):.4f}")
    gw, gb = 0.0, 0.0
    for x, y in zip(xs, ys):
        r = w * x + b - y
        gw += 2 * r * x / n
        gb += 2 * r / n
    w -= rate * gw
    b -= rate * gb

mean_x = sum(xs) / n
mean_y = sum(ys) / n
sxy = 0.0
sxx = 0.0
for x, y in zip(xs, ys):
    sxy += (x - mean_x) * (y - mean_y)
    sxx += (x - mean_x) * (x - mean_x)
w_best = sxy / sxx
b_best = mean_y - w_best * mean_x
print(f"closed form: w={w_best:.4f} b={b_best:.4f} mse={mse(w_best, b_best):.4f}")`,
      notes: [
        { line: 9, text: 'The residual: what the line predicts minus what was observed. Its sign matters for the gradient, so keep the order consistent.' },
        { line: 21, text: 'The slope\'s gradient weights each residual by its x. A point far to the right has more leverage on the tilt than a point near the middle.' },
        { line: 22, text: 'The intercept\'s gradient is twice the average residual. It is zero when the amounts by which the line sits too high and too low cancel out.' },
        { line: 23, text: 'The update: move against the gradient. The gradient shrinks as the line approaches the best fit, so the steps shorten without any extra rule.' },
        { line: 33, text: 'The closed form. The slope is how x and y vary together divided by how much x varies, and the intercept puts the line through the point of averages.' },
      ],
    },
    javascript: {
      source: `const xs = [-2.0, -1.0, 0.0, 1.0, 2.0];
const ys = [-3.1, -0.9, 1.2, 2.8, 5.0];
const n = xs.length;

function mse(w, b) {
  let total = 0;
  for (let i = 0; i < n; i++) {
    const r = w * xs[i] + b - ys[i];
    total += r * r;
  }
  return total / n;
}

const show = (w, b) => "w=" + w.toFixed(4) + " b=" + b.toFixed(4) + " mse=" + mse(w, b).toFixed(4);

let w = 0, b = 0;
const rate = 0.1;
for (let step = 0; step <= 60; step++) {
  if (step % 10 === 0) console.log("step " + String(step).padStart(2, " ") + ": " + show(w, b));
  let gw = 0, gb = 0;
  for (let i = 0; i < n; i++) {
    const r = w * xs[i] + b - ys[i];
    gw += 2 * r * xs[i] / n;
    gb += 2 * r / n;
  }
  w -= rate * gw;
  b -= rate * gb;
}

let meanX = 0, meanY = 0;
for (let i = 0; i < n; i++) { meanX += xs[i]; meanY += ys[i]; }
meanX /= n;
meanY /= n;
let sxy = 0, sxx = 0;
for (let i = 0; i < n; i++) {
  sxy += (xs[i] - meanX) * (ys[i] - meanY);
  sxx += (xs[i] - meanX) * (xs[i] - meanX);
}
const wBest = sxy / sxx;
const bBest = meanY - wBest * meanX;
console.log("closed form: " + show(wBest, bBest));`,
    },
    cpp: {
      source: `#include <cstdio>
#include <vector>

const std::vector<double> xs = {-2.0, -1.0, 0.0, 1.0, 2.0};
const std::vector<double> ys = {-3.1, -0.9, 1.2, 2.8, 5.0};
const int n = 5;

double mse(double w, double b) {
    double total = 0.0;
    for (int i = 0; i < n; ++i) {
        double r = w * xs[i] + b - ys[i];
        total += r * r;
    }
    return total / n;
}

int main() {
    double w = 0.0, b = 0.0;
    const double rate = 0.1;
    for (int step = 0; step <= 60; ++step) {
        if (step % 10 == 0) {
            std::printf("step %2d: w=%.4f b=%.4f mse=%.4f\\n", step, w, b, mse(w, b));
        }
        double gw = 0.0, gb = 0.0;
        for (int i = 0; i < n; ++i) {
            double r = w * xs[i] + b - ys[i];
            gw += 2 * r * xs[i] / n;
            gb += 2 * r / n;
        }
        w -= rate * gw;
        b -= rate * gb;
    }

    double meanX = 0.0, meanY = 0.0;
    for (int i = 0; i < n; ++i) { meanX += xs[i]; meanY += ys[i]; }
    meanX /= n;
    meanY /= n;
    double sxy = 0.0, sxx = 0.0;
    for (int i = 0; i < n; ++i) {
        sxy += (xs[i] - meanX) * (ys[i] - meanY);
        sxx += (xs[i] - meanX) * (xs[i] - meanX);
    }
    double wBest = sxy / sxx;
    double bBest = meanY - wBest * meanX;
    std::printf("closed form: w=%.4f b=%.4f mse=%.4f\\n", wBest, bBest, mse(wBest, bBest));
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'With n points and d input features, one gradient step reads every point once and costs O(nd). The closed form builds a d-by-d system from the data in O(nd²) and solves it in O(d³). On this page d is 1, so both are a single pass over the points. How many gradient steps are needed depends on the shape of the loss surface, not on the number of points.',
    cases: [
      { case: 'Closed form, one feature', time: 'O(n)', when: 'Two passes over the data: one for the means, one for the sums of products.' },
      { case: 'Closed form, d features', time: 'O(nd² + d³)', when: 'Form the normal equations and solve them. Practical up to a few thousand features.' },
      { case: 'One gradient descent step', time: 'O(nd)', when: 'Every point contributes one residual to the gradient.' },
      { case: 'Gradient descent to accuracy ε', time: 'O(κ log(1/ε)) steps', when: 'κ is the condition number of the loss surface: its largest curvature divided by its smallest. Centred, similarly scaled inputs keep κ small.' },
      { case: 'Learning rate above 2 ÷ largest curvature', time: 'Diverges', when: 'Every step overshoots by more than the last. No number of steps helps.' },
    ],
    space: 'O(d) working memory for gradient descent: the parameters and their gradient. The normal equations need a d-by-d matrix, O(d²).',
    memory: 'Gradient descent never needs more than one data point in memory at a time, which is why it remains usable when the data do not fit in memory. The closed form needs the full d-by-d matrix of sums.',
    tradeoffs: 'The formula is exact and has nothing to tune, but its cost grows with the cube of the number of features. Gradient descent is cheap per step and scales to very many features, at the price of a learning rate to choose and a number of steps that depends on how well the inputs are scaled.',
    assumptions: [
      'Arithmetic on numbers takes constant time, and n is at least d so that the fit is determined.',
      'The step count for gradient descent assumes a fixed learning rate of 1 divided by the largest curvature. ε is the target accuracy in the loss.',
      'Costs are for the plain least squares problem. Regularized or weighted variants change constants but not the orders shown.',
      'The experiment counts steps on one generated dataset. It illustrates the dependence on the condition number and is not a general benchmark.',
    ],
  },

  tradeoffs: {
    excels: [
      'Relationships that are close to straight over the range of the data.',
      'Problems where the model must be explained: the slope is a rate of change in the units of the data.',
      'Small datasets, where a model with only two numbers to fit is hard to overfit.',
      'A first baseline, because it is fast, exact and has nothing to tune.',
    ],
    struggles: [
      'Curved relationships, unless the inputs are transformed first.',
      'Data with outliers, which squared error weights heavily.',
      'Outputs that are categories or probabilities. A line is unbounded, so it predicts values below 0 and above 1.',
      'Scatter that widens or narrows along the line: the fit is still the least squares line, but the usual error estimates for the slope are no longer valid.',
    ],
    pitfalls: [
      'Reporting a slope without looking at the scatter plot and the residuals.',
      'Extrapolating beyond the data.',
      'Running gradient descent on raw, uncentred inputs and concluding that the method is slow.',
      'Treating a small loss on the fitting data as evidence that predictions on new data will be good.',
    ],
    misunderstandings: [
      "\"The line of best fit passes through most of the points.\" It need not pass through any of them. It balances the squared gaps on either side, as the three-point worked example shows.",
      "\"A steep slope means a strong relationship.\" The slope says how much y changes per unit of x. How tightly the points hug the line is a separate question, answered by the size of the residuals.",
      "\"Least squares measures the shortest distance from each point to the line.\" It measures the vertical gap, because the goal is to predict y from x. Swapping the roles of x and y gives a different line.",
      "\"If x predicts y well, x causes y.\" Regression describes how two quantities vary together. Both may be driven by something that was never measured.",
      "\"Gradient descent and the formula are two different models.\" They are two ways of finding the same line. Any difference between their answers is unfinished descent.",
    ],
    constraints: [
      'The closed form needs the inputs to be linearly independent. With duplicated or nearly duplicated features the system is singular or unstable, and regularization or a QR or SVD solver is used instead.',
      'In practice the normal equations are rarely inverted directly. Libraries solve the least squares problem with QR or singular value decompositions, which are more accurate in floating point.',
    ],
    alternatives: [
      { id: 'logistic-regression', name: 'Logistic Regression', when: 'The output is one of two classes, not a number.' },
      { id: 'knn', name: 'k-Nearest Neighbours', when: 'The relationship is not a line and you would rather average nearby examples than assume a shape.' },
      { id: 'decision-tree', name: 'Decision Tree Learning', when: 'The output depends on thresholds and interactions that a single line cannot express.' },
      { name: 'Ridge and lasso regression', when: 'There are many features, some nearly redundant, and the plain fit is unstable or overfits.' },
      { name: 'Robust regression (least absolute deviations, Huber loss)', when: 'Outliers are present and should not dominate the fit.' },
    ],
    comparison: {
      columns: ['', 'Closed form', 'Gradient descent'],
      rows: [
        ['Answer', 'Exact, up to rounding', 'Approaches the same line step by step'],
        ['Cost with d features', 'O(nd² + d³)', 'O(nd) per step'],
        ['Settings to choose', 'None', 'Learning rate, number of steps'],
        ['Sensitive to input scaling', 'No, apart from rounding error', 'Yes: poorly scaled inputs need many more steps'],
        ['Extends to other models', 'Only to linear least squares', 'To any differentiable loss'],
      ],
    },
  },

  applications: [
    { title: 'Estimating a stock\'s beta', status: 'established', text: 'In finance, a stock\'s beta is the slope from regressing its returns on the returns of a market index over the same periods. A beta of 1.2 says the stock has tended to move 1.2 percent for each 1 percent move in the index. It is an estimate from past data, not a promise about the future.' },
    { title: 'Calibration curves in laboratories', status: 'established', text: 'An instrument is run on samples of known concentration, a line is fitted to reading against concentration, and the line is then used to convert readings from unknown samples back into concentrations.' },
    { title: 'Measuring relationships in economics and social science', status: 'established', text: 'Least squares regression, usually with many inputs, is the standard first tool for estimating how one quantity changes with another while holding others fixed.' },
    { title: 'Combining astronomical observations', status: 'established', text: 'The method was invented for this. Legendre introduced it in 1805 in a work on computing the orbits of comets from imperfect observations, and Gauss used it in his own orbit calculations.' },
    { title: 'A baseline for machine learning', status: 'established', text: 'Before trying a complicated model, practitioners fit a linear one. If the complicated model cannot beat it on held-out data, the extra complexity is not earning its keep.' },
    { title: 'Reading a trend from a few measurements', status: 'illustrative', text: 'Weigh a growing plant once a week, fit a line, and the slope is its average weekly gain. The same calculation applies to any quantity that changes at a roughly steady rate.' },
  ],

  connections: [
    { to: 'gradient-descent', type: 'prerequisite', why: 'The step-by-step fit on this page is gradient descent applied to the mean squared error. That loss is a convex quadratic, the case in which descent provably reaches the global minimum.' },
    { to: 'concept:loss-function', type: 'prerequisite', why: 'Fitting means choosing the parameters that minimize a loss. Here the loss is the mean squared error.' },
    { to: 'concept:supervised-learning', type: 'prerequisite', why: 'The model learns from examples that pair an input with the correct output, then predicts outputs for new inputs.' },
    { to: 'concept:convexity', type: 'related', why: 'The squared error surface is a convex bowl, which is why any downhill method and the formula reach the same single minimum.' },
    { to: 'concept:learning-rate', type: 'related', why: 'The step length decides whether the line creeps, converges briskly, bounces or diverges, and the limit is set by the curvature of the loss.' },
    { to: 'logistic-regression', type: 'variant', why: 'Logistic regression keeps the linear formula but passes it through an S-shaped curve and swaps squared error for cross-entropy, turning a predictor of numbers into a classifier.' },
    { to: 'perceptron', type: 'related', why: 'Both compute a weighted sum of the inputs plus a bias. The perceptron thresholds the sum to choose a class; regression uses the sum itself as the prediction.' },
    { to: 'knn', type: 'same-problem', why: 'Both predict from labelled examples. Regression compresses the examples into two numbers, while nearest neighbours keeps every example and assumes no shape.' },
    { to: 'backpropagation', type: 'advanced', why: 'A neural network stacks many linear models with nonlinear functions between them. Backpropagation computes the same kind of gradient derived here, layer by layer.' },
    { to: 'stochastic-gradient-descent', type: 'advanced', why: 'When there are too many points to visit at every step, the gradient is estimated from a random handful of them.' },
    { to: 'pca', type: 'related', why: 'Both fit a line to a cloud of points by least squares. Regression minimizes vertical gaps to predict y from x; principal component analysis minimizes perpendicular distances and treats the two coordinates alike.' },
    { to: 'bayesian-updating', type: 'related', why: 'Least squares is the maximum likelihood estimate when the scatter is Gaussian. Adding a prior belief about the slope and updating it with the data gives Bayesian linear regression.' },
    { to: 'discipline:statistics', type: 'application', why: 'Regression is a core statistical method for estimating relationships and quantifying the uncertainty of the estimates.' },
    { to: 'discipline:finance', type: 'application', why: 'Estimating beta is a regression of an asset\'s returns on the market\'s returns: the slope is the quantity of interest.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why does the method add up squared residuals instead of the residuals themselves?',
      options: ['Squares are faster to compute', 'Positive and negative residuals would cancel, so a terrible line could score zero', 'Squaring makes the line pass through more points', 'The residuals are always positive anyway'],
      answer: 1,
      explain: [
        'Speed is not the reason. Adding the raw residuals would be cheaper still.',
        'Correct. A line that is far too high on the left and far too low on the right has residuals that sum to zero. Squaring makes every gap count against the line.',
        'The least squares line need not pass through any point.',
        'Residuals are positive for points on one side of the line and negative on the other.',
      ],
    },
    {
      type: 'predict',
      q: 'On the default 24 points, what happens with a learning rate of 1.05?',
      options: ['It converges in a couple of steps', 'It converges, but slowly', 'The line swings above and below the data, a little farther each time, and the loss ends higher than it started', 'Nothing moves, because the gradient is zero'],
      answer: 2,
      explain: [
        'A larger rate is only faster up to a limit. Here the fastest fixed rate is near 0.6.',
        'Slow convergence is what a very small rate gives.',
        'Correct. The curvature in the intercept direction is about 2, so each step multiplies the intercept\'s error by about 1 − 1.05 × 2 = −1.1. It flips sign and grows by 10 percent per step.',
        'The gradient is zero only at the least squares line, and the starting line is far from it.',
      ],
      tryInput: { points: 24, noise: 0.25, seed: 3, rate: 1.05, steps: 60, custom: [] },
    },
    {
      type: 'debug',
      q: 'With this loop the line never settles. It swings back and forth across the data for as long as it runs, even with a small learning rate. What is wrong?',
      code: `gw, gb = 0.0, 0.0
for step in range(1000):
    for x, y in zip(xs, ys):
        r = w * x + b - y
        gw += 2 * r * x / n
        gb += 2 * r / n
    w -= rate * gw
    b -= rate * gb`,
      options: ['The residual has the wrong sign', 'gw and gb are never reset, so every step adds all the earlier gradients to the new one', 'The learning rate should shrink over time', 'The loop should stop after one pass over the points'],
      answer: 1,
      explain: [
        'Prediction minus observation, followed by a subtraction in the update, is the correct pairing.',
        'Correct. The gradient must start from zero at every step. Accumulating it across steps keeps pushing the line in a direction that was right many steps ago, so it overshoots and oscillates.',
        'A fixed rate below the stability limit converges on this problem.',
        'One pass computes one gradient. Many steps are needed.',
      ],
    },
    {
      type: 'choice',
      q: 'Gradient descent stops at slope 0.60 and the formula gives slope 0.66 for the same data. What is the most likely explanation?',
      options: ['The two methods minimize different losses', 'Descent found a different local minimum', 'Descent has not finished: it ran out of steps or the learning rate is very small', 'The formula is only approximate'],
      answer: 2,
      explain: [
        'Both minimize the same mean squared error.',
        'The squared error surface is a convex bowl with exactly one minimum, so there is no other place to settle.',
        'Correct. With a single minimum, any gap between the two answers is distance still to travel. More steps close it.',
        'The formula is exact up to rounding in floating point.',
      ],
    },
    {
      type: 'challenge',
      title: 'Make descent indifferent to where the data sit',
      prompt: 'Take any dataset and add 10 to every x value. Show by experiment that gradient descent with the best fixed learning rate now needs thousands of steps, while the closed form is unaffected. Then standardize x (subtract its mean and divide by its standard deviation) before fitting, run descent again, and convert the fitted slope and intercept back to the original units. Explain the difference in step counts using the two curvatures of the loss surface.',
      hints: [
        'The curvatures are the eigenvalues of the 2-by-2 matrix 2 × [[mean of x², mean of x], [mean of x, 1]].',
        'If z = (x − m) / s and the fit is y = a·z + c, then in the original units the slope is a / s and the intercept is c − a·m / s.',
      ],
    },
  ],

  compare: {
    idea: 'Choose the slope and intercept that minimize the mean squared vertical gap between line and points.',
    requires: 'Numeric inputs and outputs, and a relationship that is roughly linear. Exact solution by formula, or gradient descent with a suitable learning rate.',
    sensitivity: 'Sensitive to outliers. Gradient descent is also sensitive to the learning rate and to how the inputs are centred and scaled; the formula is not.',
    memory: 'O(d) for gradient descent; O(d²) for the normal equations.',
    difficulty: 'low',
    difficultyNote: 'A dozen lines of code. The judgment lies in checking that a line suits the data.',
    limits: 'Only straight-line relationships. Outliers pull the fit. Says nothing about cause.',
    useWhen: 'You need a fast, readable model of how a number changes with its inputs, or a baseline to beat.',
  },

  advanced: {
    history: 'Adrien-Marie Legendre published the method of least squares in 1805, in an appendix to a work on determining the orbits of comets. Carl Friedrich Gauss published his own account in 1809, connected it to the normal distribution of errors, and stated that he had been using the method since 1795, which led to a priority dispute. The word "regression" came later. Francis Galton used it in the 1880s for his observation that the children of unusually tall or short parents tend to be closer to average height than their parents, and the name became attached to the line-fitting method used to describe such data. The result now called the Gauss-Markov theorem states that, when the errors have zero mean, equal variance and no correlation, least squares has the smallest variance among all linear unbiased estimators.',
    derivation: 'Write the loss as\n\n$$L(w, b) = \\frac{1}{n}\\sum_{i=1}^{n} (w x_i + b - y_i)^2.$$\n\nIts partial derivatives are\n\n$$\\frac{\\partial L}{\\partial w} = \\frac{2}{n}\\sum_i (w x_i + b - y_i)\\,x_i, \\qquad \\frac{\\partial L}{\\partial b} = \\frac{2}{n}\\sum_i (w x_i + b - y_i).$$\n\nThese two numbers are the gradient used at every step of the descent. Setting the second to zero gives $b = \\bar{y} - w\\bar{x}$: the best line passes through the point of averages. Substituting into the first and setting it to zero gives\n\n$$w^\\star = \\frac{\\sum_i (x_i - \\bar{x})(y_i - \\bar{y})}{\\sum_i (x_i - \\bar{x})^2}, \\qquad b^\\star = \\bar{y} - w^\\star\\bar{x}.$$\n\nWith $d$ features, stack the inputs as rows of a matrix $X$ (with a column of ones for the intercept) and the outputs in a vector $y$. The same argument gives the normal equations $X^\\top X\\,\\beta = X^\\top y$.',
    proof: 'The matrix of second derivatives of $L$ is constant:\n\n$$H = 2\\begin{pmatrix} \\overline{x^2} & \\bar{x} \\\\ \\bar{x} & 1 \\end{pmatrix}, \\qquad \\det H = 4\\left(\\overline{x^2} - \\bar{x}^2\\right) = 4\\,\\mathrm{Var}(x).$$\n\nIts trace is positive and its determinant is positive whenever the $x_i$ are not all equal, so $H$ is positive definite and $L$ is strictly convex with a unique minimizer, the solution of the normal equations. For gradient descent, the error $e_k = (w_k - w^\\star, b_k - b^\\star)$ obeys $e_{k+1} = (I - \\eta H)e_k$ exactly, because the gradient of a quadratic is linear. The iteration converges if and only if $|1 - \\eta\\lambda| < 1$ for both eigenvalues $\\lambda$ of $H$, that is $0 < \\eta < 2/\\lambda_{\\max}$. When the inputs are centred, $H$ is diagonal with entries $2\\,\\mathrm{Var}(x)$ and $2$, which is why the stability limit on this page is close to 1.',
    complexityProof: 'From $e_{k+1} = (I - \\eta H)e_k$ with $\\eta = 1/\\lambda_{\\max}$, the slowest component of the error shrinks by the factor $1 - \\lambda_{\\min}/\\lambda_{\\max} = 1 - 1/\\kappa$ per step, so reaching accuracy $\\varepsilon$ takes about $\\kappa\\ln(1/\\varepsilon)$ steps. Shifting every $x$ by $s$ leaves $\\det H = 4\\,\\mathrm{Var}(x)$ unchanged but raises the trace to $2(1 + \\mathrm{Var}(x) + s^2)$, so $\\kappa$ grows roughly like $s^4/\\mathrm{Var}(x)$ for large $s$. This is the curve in the experiment, and it is why centring the inputs matters so much to gradient methods.',
    variants: [
      { name: 'Multiple linear regression', text: 'Several input features, each with its own weight. The fitted surface is a plane or hyperplane and the closed form is the solution of the normal equations.' },
      { name: 'Polynomial regression', text: 'Add powers of x as extra features. The model is curved in x but still linear in its weights, so the same least squares machinery applies.' },
      { name: 'Ridge regression', text: 'Adds a penalty on the squared size of the weights. It stabilizes the fit when features are nearly redundant and shrinks the weights toward zero.' },
      { name: 'Lasso', text: 'Penalizes the absolute size of the weights, which drives some of them exactly to zero and so selects features.' },
      { name: 'Weighted and generalized least squares', text: 'Give each observation a weight, or account for correlated errors, when the scatter is not the same everywhere.' },
      { name: 'Robust regression', text: 'Replaces the squared loss with one that grows more slowly for large residuals, such as absolute error or the Huber loss, to limit the pull of outliers.' },
    ],
    implementation: 'Do not invert $X^\\top X$ explicitly. Solve the least squares problem with a QR or singular value decomposition, which is what numerical libraries do, because forming $X^\\top X$ squares the condition number. For gradient methods, standardize each feature first. Always plot the residuals against the input: a visible pattern means the model is missing structure.',
    benchmarking: 'Judge a fitted line on data that were not used to fit it, and report the error in the units of the output. Compare iterative solvers at equal numbers of gradient evaluations and state the stopping tolerance.',
    references: [
      { authors: 'A.-M. Legendre', year: 1805, title: 'Nouvelles méthodes pour la détermination des orbites des comètes', venue: 'Firmin Didot, Paris' },
      { authors: 'C. F. Gauss', year: 1809, title: 'Theoria motus corporum coelestium in sectionibus conicis solem ambientium', venue: 'Perthes and Besser, Hamburg' },
      { authors: 'F. Galton', year: 1886, title: 'Regression towards mediocrity in hereditary stature', venue: 'The Journal of the Anthropological Institute of Great Britain and Ireland 15' },
      { authors: 'T. Hastie, R. Tibshirani and J. Friedman', year: 2009, title: 'The Elements of Statistical Learning: Data Mining, Inference, and Prediction (2nd edition)', venue: 'Springer' },
    ],
    furtherReading: [
      'T. Hastie, R. Tibshirani and J. Friedman, *The Elements of Statistical Learning*, chapter 3, "Linear Methods for Regression".',
      'S. M. Stigler, *The History of Statistics: The Measurement of Uncertainty before 1900*, Harvard University Press (1986), for the story of least squares.',
      'G. Strang, *Introduction to Linear Algebra*, the chapter on orthogonality and least squares, for the geometric view of the normal equations.',
    ],
  },

  tests: [
    { name: 'gradient descent matches the closed form on the default data', input: { points: 24, noise: 0.25, seed: 3, rate: 0.2, steps: 200 },
      check: (r) => (r.status === 'converged' && Math.abs(r.w - r.closedForm.w) < 1e-3 && Math.abs(r.b - r.closedForm.b) < 1e-3) || `status ${r.status}: got (${r.w}, ${r.b}), closed form (${r.closedForm.w}, ${r.closedForm.b})` },
    { name: 'matches the closed form across seeds and sizes', input: { points: 47, noise: 0.5, seed: 91, rate: 0.4, steps: 200 },
      check: (r) => (Math.abs(r.w - r.closedForm.w) < 1e-3 && Math.abs(r.b - r.closedForm.b) < 1e-3 && r.loss - r.closedForm.loss < 1e-6 && r.loss >= r.closedForm.loss - 1e-12) || `got (${r.w}, ${r.b}) loss ${r.loss}, closed form (${r.closedForm.w}, ${r.closedForm.b}) loss ${r.closedForm.loss}` },
    { name: 'closed form recovers an exact line when there is no noise', input: { points: 20, noise: 0, seed: 5, rate: 0.2, steps: 200 },
      check: (r) => (Math.abs(r.closedForm.w - 0.7) < 2e-3 && Math.abs(r.closedForm.b - 0.1) < 2e-3 && r.closedForm.loss < 1e-6) || `closed form (${r.closedForm.w}, ${r.closedForm.b}) loss ${r.closedForm.loss}` },
    { name: 'loss never increases below the stability limit', input: { points: 24, noise: 0.25, seed: 3, rate: 0.5, steps: 100 },
      check: (r) => r.losses.every((v, i) => i === 0 || v <= r.losses[i - 1] + 1e-12) || 'loss increased' },
    { name: 'the worked example: best line y = 0.75x, first step lands on y = 0.5x', input: { custom: [-1, -1, 0, 0.5, 1, 0.5], rate: 0.5, steps: 40 },
      check: (r) => (Math.abs(r.closedForm.w - 0.75) < 1e-12 && Math.abs(r.closedForm.b) < 1e-12 && Math.abs(r.closedForm.loss - 0.125) < 1e-12
        && Math.abs(r.losses[0] - 0.5) < 1e-12 && Math.abs(r.losses[1] - 0.5 / 3) < 1e-12 && Math.abs(r.w - 0.75) < 1e-3)
        || `closed form (${r.closedForm.w}, ${r.closedForm.b}) loss ${r.closedForm.loss}; losses ${r.losses.slice(0, 2)}; w ${r.w}` },
    { name: 'a learning rate of 1.05 makes the loss grow (quiz prediction)', input: { points: 24, noise: 0.25, seed: 3, rate: 1.05, steps: 60, custom: [] },
      check: (r) => (r.status !== 'converged' && r.loss > r.initialLoss && r.losses[r.losses.length - 1] > r.losses[r.losses.length - 2]) || `status ${r.status}, loss ${r.loss} from ${r.initialLoss}` },
  ],
};
