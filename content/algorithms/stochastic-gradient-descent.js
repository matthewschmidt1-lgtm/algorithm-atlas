import { makeLine, DATA_RANGE } from '../../js/lib/datasets.js';
import { makeRng } from '../../js/lib/rng.js';

// The plotting window of the slope and intercept map. The generated data sit near slope 0.7, intercept 0.1.
const W_RANGE = [-0.4, 1.6];
const B_RANGE = [-0.8, 0.8];

const f3 = (v) => {
  if (!Number.isFinite(v)) return String(v);
  if (Math.abs(v) >= 1e6) return v.toExponential(2);
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  const s = v.toFixed(3);
  return s === '-0.000' ? '0.000' : s;
};
const pair = (a, b) => `(${f3(a)}, ${f3(b)})`;
const lineText = (w, b) => `y = ${f3(w)}·x ${b < 0 ? '−' : '+'} ${f3(Math.abs(b))}`;
const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
const trim = (v) => String(Number(v.toFixed(2)));
// A tracer that records nothing, for the extra runs some tests make.
const quiet = { count() {}, frame() {} };

function resolvePoints(input) {
  if (Array.isArray(input.custom) && input.custom.length) {
    const c = input.custom;
    if (c.length % 2 !== 0 || c.length < 4) throw new Error('Type your own points as x, y pairs: an even count of numbers, and at least two points.');
    const pts = [];
    for (let i = 0; i < c.length; i += 2) pts.push({ x: c[i], y: c[i + 1] });
    return pts;
  }
  return makeLine({ points: input.points, noise: input.noise, seed: input.seed }).points.map((p) => ({ x: p.x, y: p.y }));
}

// Ordinary least squares for one feature: the line every run is compared with.
function closedForm(pts) {
  const n = pts.length;
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0;
  for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) * (p.x - mx); }
  if (sxx < 1e-12) throw new Error('Every point has the same x value, so no single slope fits best. Spread the points out sideways.');
  const w = sxy / sxx;
  return { w, b: my - w * mx };
}

// One point's share of the loss is its squared residual (w·x + b − y)². This is the gradient of that share.
function exampleGradient(p, w, b) {
  const r = w * p.x + b - p.y;
  return [2 * r * p.x, 2 * r];
}

function run(input, t) {
  const pts = resolvePoints(input);
  const n = pts.length;
  const B = Math.max(1, Math.min(n, Math.floor(Number(input.batch) || 1)));
  const full = B === n;
  const eta0 = input.rate, decay = Number(input.decay) || 0, maxSteps = input.steps;
  const best = closedForm(pts);
  const rng = makeRng(Math.floor(input.seed) * 7919 + 13);

  const mse = (w, b) => {
    let s = 0;
    for (const p of pts) { const r = w * p.x + b - p.y; s += r * r; }
    return s / n;
  };
  // The gradient over every point. The algorithm itself never computes this unless the batch is the
  // whole dataset. It is measured here only to show how far each batch's estimate is from it.
  const fullGradient = (w, b) => {
    let gw = 0, gb = 0;
    for (const p of pts) { const g = exampleGradient(p, w, b); gw += g[0]; gb += g[1]; }
    return [gw / n, gb / n];
  };
  const bestLoss = mse(best.w, best.b);
  // The experiment stops a run the first time the loss is within this fraction of the best possible.
  const target = input.stopAt === undefined ? null : bestLoss * (1 + input.stopAt);

  let w = 0, b = 0;
  const path = [[w, b]];
  const losses = [mse(w, b)];
  const batches = [], rates = [];
  let order = [], pos = n, epoch = 0, used = 0, gapSum = 0, rises = 0;
  let status = 'budget';

  // Picture-only work, done once and only when frames are being recorded.
  let contour = null, ghost = null;
  const contourLayer = () => {
    if (!contour) {
      let m1 = 0, m2 = 0, mxy = 0, my = 0, myy = 0;
      for (const p of pts) { m1 += p.x; m2 += p.x * p.x; mxy += p.x * p.y; my += p.y; myy += p.y * p.y; }
      m1 /= n; m2 /= n; mxy /= n; my /= n; myy /= n;
      const nx = 56, ny = 42, values = new Float64Array(nx * ny);
      for (let j = 0; j < ny; j++) {
        const bb = B_RANGE[0] + (j / (ny - 1)) * (B_RANGE[1] - B_RANGE[0]);
        for (let i = 0; i < nx; i++) {
          const ww = W_RANGE[0] + (i / (nx - 1)) * (W_RANGE[1] - W_RANGE[0]);
          values[j * nx + i] = ww * ww * m2 + 2 * ww * bb * m1 + bb * bb - 2 * ww * mxy - 2 * bb * my + myy;
        }
      }
      contour = { type: 'contour', nx, ny, values, x: W_RANGE, y: B_RANGE, role: 'sage', levels: 12 };
    }
    return contour;
  };
  // What plain gradient descent would do from the same start with the same learning rates.
  const plain = () => {
    if (!ghost) {
      let gw = 0, gb = 0;
      const gp = [[gw, gb]], gl = [mse(gw, gb)];
      for (let k = 0; k < maxSteps; k++) {
        const g = fullGradient(gw, gb);
        const eta = eta0 / (1 + decay * k);
        gw -= eta * g[0]; gb -= eta * g[1];
        const l = mse(gw, gb);
        if (!Number.isFinite(l) || l > 1e6) break;
        gp.push([gw, gb]); gl.push(l);
      }
      ghost = { path: gp, losses: gl };
    }
    return ghost;
  };

  const [lo, hi] = DATA_RANGE;
  const clampY = (v) => Math.max(-1e4, Math.min(1e4, v));
  const views = ({ batch = null, g = null, all = null } = {}) => {
    const map = [contourLayer(), { type: 'points', points: [[best.w, best.b]], role: 'forest', hollow: true, r: 5 }];
    if (!full) map.push({ type: 'line', points: plain().path.slice(), role: 'ink', width: 1.3, dash: true, alpha: 0.75 });
    map.push({ type: 'line', points: path.slice(), role: 'terracotta', width: 2 });
    map.push({ type: 'points', points: path.slice(0, -1), role: 'terracotta', r: 2.2, alpha: 0.75 });
    const arrow = (v, role, width) => {
      const scale = 0.14 * (W_RANGE[1] - W_RANGE[0]) / (Math.hypot(v[0], v[1]) || 1);
      map.push({ type: 'segments', segments: [[w, b, w - v[0] * scale, b - v[1] * scale]], role, width, arrow: true });
    };
    if (all && !full) arrow(all, 'ink', 1.6);
    if (g) arrow(g, 'ochre', 2.2);
    map.push({ type: 'points', points: [[w, b]], role: 'terracotta', r: 5.5, ring: true });
    const mapLegend = [{ label: 'contours of equal loss', role: 'sage' }, { label: 'least squares line', role: 'forest' }, { label: 'path so far', role: 'terracotta' }, { label: 'downhill according to this batch', role: 'ochre' }];
    if (!full) mapLegend.push({ label: 'plain gradient descent: its direction here, and its path (dashed)', role: 'ink' });

    const inBatch = new Set(batch || []);
    const data = [];
    if (batch) data.push({ type: 'segments', segments: batch.map((i) => [pts[i].x, pts[i].y, pts[i].x, clampY(w * pts[i].x + b)]), role: 'compare', width: 1.6 });
    data.push({ type: 'line', points: [[lo, best.w * lo + best.b], [hi, best.w * hi + best.b]], role: 'done', width: 1.6, dash: true });
    data.push({ type: 'line', points: [[lo, clampY(w * lo + b)], [hi, clampY(w * hi + b)]], role: 'active', width: 2.4 });
    data.push({ type: 'points', points: pts.filter((_, i) => !inBatch.has(i)).map((p) => [p.x, p.y]), role: 'ink', r: 3.2, alpha: batch && !full ? 0.45 : 1 });
    if (batch) data.push({ type: 'points', points: batch.map((i) => [pts[i].x, pts[i].y]), role: 'active', r: 5 });

    const finite = losses.filter(Number.isFinite);
    const top = Math.max(...finite, 1e-9);
    const span = Math.max(10, maxSteps);
    const chart = [{ type: 'line', points: [[0, bestLoss], [span, bestLoss]], role: 'done', width: 1.3, dash: true }];
    if (!full) chart.push({ type: 'line', points: plain().losses.map((v, i) => [i, Math.min(v, top * 2)]), role: 'ink', width: 1.3, dash: true, alpha: 0.75 });
    chart.push({ type: 'line', points: losses.map((v, i) => [i, Number.isFinite(v) ? Math.min(v, top * 2) : top * 2]), role: 'active', width: 2 });
    const chartLegend = [{ label: 'loss of this run', role: 'active' }, { label: 'smallest possible loss', role: 'done' }];
    if (!full) chartLegend.push({ label: 'plain gradient descent, step for step', role: 'ink' });

    return [
      { kind: 'scene', title: 'Path over the loss surface: every position is one candidate line', x: W_RANGE, y: B_RANGE, aspect: 0.5, axes: { xLabel: 'slope w', yLabel: 'intercept b' }, layers: map, legend: mapLegend },
      { kind: 'scene', title: 'The data, the current line, and the points this step looks at', x: DATA_RANGE, y: DATA_RANGE, aspect: 0.36, axes: { xLabel: 'x (input)', yLabel: 'y (output)' }, layers: data,
        legend: [{ label: 'data point', role: 'ink' }, { label: 'current line, and the points in this batch', role: 'active' }, { label: 'gap measured for this step', role: 'compare' }, { label: 'least squares line', role: 'done' }] },
      { kind: 'scene', title: 'Loss over all points at each step', x: [0, span], y: [0, top * 1.08], aspect: 0.2, axes: { xLabel: 'step' }, layers: chart, legend: chartLegend },
    ];
  };

  t.frame(() => ({ line: 1,
    note: `${n} points, and a line that starts flat at y = 0. The loss is the average squared gap between the line and the points: **${f3(losses[0])}**. The dashed green line is the least squares line, ${lineText(best.w, best.b)}, where the loss is as small as it can be, ${f3(bestLoss)}. ${full
      ? `The batch size is ${B}, which is every point, so each step will measure all ${n} gaps. That is plain gradient descent.`
      : `Plain gradient descent would measure all ${n} gaps before every step. This run measures only ${B} per step, so a step costs ${B === 1 ? `one ${n}th` : `${B}/${n}`} as much, and the direction it gets is an estimate.`}`,
    views: views(), vars: { n, 'batch size': B, w: f3(w), b: f3(b), loss: f3(losses[0]) } }));

  let k = 0;
  for (; k < maxSteps; k++) {
    if (target !== null && losses[losses.length - 1] <= target) { status = 'reached'; break; }
    if (pos >= n) {
      order = rng.shuffle(pts.map((_, i) => i));
      pos = 0;
      epoch++;
      if (!full) {
        const first = epoch === 1;
        t.frame(() => ({ line: [3, 4],
          note: first
            ? `Shuffle the ${n} points into a random order. Batches are dealt from this shuffled deck, ${B} at a time, so every point is used once before any point is used twice.`
            : `All ${n} points have now been used ${epoch - 1 === 1 ? 'once' : `${epoch - 1} times`}. One full pass through the data is called an **epoch**. Shuffle again for epoch ${epoch}, so the points are grouped into different batches than last time.`,
          views: views(), vars: { step: k, epoch, loss: f3(losses[losses.length - 1]) } }));
      }
    }
    const batch = order.slice(pos, pos + B).sort((i, j) => i - j);
    pos += batch.length;
    let gw = 0, gb = 0;
    for (const i of batch) {
      const g = exampleGradient(pts[i], w, b);
      gw += g[0]; gb += g[1];
      t.count('point gradients');
    }
    gw /= batch.length; gb /= batch.length;
    used += batch.length;
    if (batches.length < 400) batches.push(batch);
    const all = fullGradient(w, b);
    const gap = Math.hypot(gw - all[0], gb - all[1]);
    gapSum += gap;

    t.frame(() => {
      const names = batch.map((i) => i + 1);
      const cos = (gw * all[0] + gb * all[1]) / ((Math.hypot(gw, gb) * Math.hypot(all[0], all[1])) || 1);
      const angle = Math.round((Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI);
      const wide = angle > 90 ? ' That is more than a right angle: for the data as a whole, this batch points uphill.' : '';
      const firstStep = k === 0;
      let note;
      if (full) {
        note = `Step ${k + 1} uses all ${n} points, so its gradient is the full gradient, ${pair(gw, gb)}: the first number is for the slope and the second for the intercept.${firstStep ? ' Nothing in this step is random. It is the step plain gradient descent takes.' : ''}`;
      } else if (batch.length === 1) {
        const p = pts[batch[0]];
        const r = w * p.x + b - p.y;
        const ask = `${Math.abs(gw) < 5e-4 ? 'keep its tilt' : gw < 0 ? 'tilt upward' : 'tilt downward'} and ${Math.abs(gb) < 5e-4 ? 'stay at this height' : gb < 0 ? 'move up' : 'move down'}`;
        note = `Step ${k + 1} looks at one point, number ${names[0]}, at ${pair(p.x, p.y)}. The line passes ${f3(Math.abs(r))} ${r > 0 ? 'above' : 'below'} it, so this point alone asks the line to ${ask}: its gradient is ${pair(gw, gb)}, slope first, then intercept. All ${n} points together would give ${pair(all[0], all[1])}. The two arrows are ${angle}° apart.${wide}${firstStep ? ' A point drawn at random is a fair sample of the data, so its gradient equals the full one on average, but any single draw is off.' : ''}`;
      } else {
        note = `Step ${k + 1} looks at ${batch.length} points (numbers ${names.join(', ')}) and averages their gradients: ${pair(gw, gb)}, slope first, then intercept. All ${n} points together would give ${pair(all[0], all[1])}. The two arrows are ${angle}° apart.${wide}${firstStep ? ` Averaging ${batch.length} points lets their individual oddities partly cancel, which is why a larger batch lands closer to the full gradient than a single point does.` : ''}`;
      }
      return { line: [5, 6, 7], note, views: views({ batch, g: [gw, gb], all }), vars: { step: k + 1, epoch, 'g_w': f3(gw), 'g_b': f3(gb) } };
    });

    const eta = eta0 / (1 + decay * k);
    rates.push(eta);
    const w0 = w, b0 = b;
    w -= eta * gw;
    b -= eta * gb;
    t.count('steps');
    const loss = mse(w, b);
    const prev = losses[losses.length - 1];
    path.push([w, b]);
    losses.push(loss);
    if (loss > prev) rises++;
    if (!Number.isFinite(loss) || loss > 1e6) {
      status = 'diverged';
      t.frame(() => ({ line: [8, 9], note: `Step ${k + 1} threw the line far off the chart and the loss has passed a million. Each step is overshooting by more than the last. The learning rate is too large for this data: the run has **diverged**.`, views: views({ batch }), vars: { step: k + 1 } }));
      k++;
      break;
    }
    t.frame(() => {
      const rateText = decay > 0 ? `the learning rate, which has shrunk from ${f3(eta0)} to ${f3(eta)},` : `the learning rate ${f3(eta)}`;
      let why = '';
      if (loss > prev) {
        why = full
          ? ' A rise with the full gradient means the step was too long: it jumped past the lowest point and landed higher on the far side.'
          : ` It rose because the step was chosen by ${plural(batch.length, 'point')} out of ${n}. A move that suits ${batch.length === 1 ? 'that point' : 'those points'} can be a bad move for the others.`;
      }
      return { line: [8, 9],
        note: `Move against that gradient by ${rateText}: slope ${f3(w0)} → **${f3(w)}**, intercept ${f3(b0)} → **${f3(b)}**. Measured on all ${n} points, the loss ${loss <= prev ? 'fell' : 'rose'} from ${f3(prev)} to ${f3(loss)}.${why}`,
        views: views({ batch }), vars: { step: k + 1, epoch, 'η': f3(eta), w: f3(w), b: f3(b), loss: f3(loss) } };
    });
  }

  const steps = losses.length - 1;
  const finalLoss = losses[steps];
  if (status !== 'diverged') {
    t.frame(() => {
      const fit = `The line is ${lineText(w, b)}, with loss ${f3(finalLoss)} over all points. The best possible is ${f3(bestLoss)}, at ${lineText(best.w, best.b)}.`;
      let note;
      if (full) {
        note = `Finished: ${plural(steps, 'step')}, each using all ${n} points, so ${used} point gradients in total. Nothing was random, so this run was plain gradient descent. ${fit}`;
      } else {
        const same = Math.floor(used / n);
        const gl = plain().losses;
        const fair = same === 0
          ? `Plain gradient descent spends ${n} point gradients on every step, so with this much work it would not have finished its first step.`
          : `Plain gradient descent spends ${n} point gradients on every step, so the same work would have bought it ${plural(same, 'step')}${same < gl.length ? ` and a loss of ${f3(gl[same])}` : ''}.`;
        let rest;
        if (finalLoss > losses[0]) {
          rest = `The loss ended higher than the ${f3(losses[0])} it started at. This learning rate is too large for ${B === 1 ? 'one point at a time' : `batches of ${B}`}: a point far from the centre has a much steeper loss of its own than the average over all points, so its step overshoots.`;
        } else if (decay > 0) {
          rest = `The learning rate has shrunk from ${f3(eta0)} to ${f3(rates[rates.length - 1])}, so each batch now moves the line less and the path is settling.`;
        } else if (bestLoss < 1e-5) {
          rest = 'These points all lie on one line, to within rounding. At that line every single point has no gap left, so no batch asks for a move and the path comes to rest without any decay.';
        } else {
          rest = `The loss went up on ${rises} of the ${steps} steps. With a fixed learning rate the path does not come to rest: even at the best line the points still disagree with each other, so every batch still asks for a move.`;
        }
        note = `Finished: ${plural(steps, 'step')} of ${plural(B, 'point')} each, so ${used} point gradients in total, the work of ${trim(used / n)} passes through the data. ${fit} ${fair} ${rest}`;
      }
      return { line: 10, note, views: views(), vars: { w: f3(w), b: f3(b), loss: f3(finalLoss), 'best possible': f3(bestLoss) } };
    });
  }

  return {
    w, b, loss: finalLoss, steps, status, losses, path, batches, rates, n, batchSize: B, used, epochs: epoch, rises,
    meanGap: steps ? gapSum / steps : 0,
    closedForm: { w: best.w, b: best.b, loss: bestLoss },
    points: pts.map((p) => ({ x: p.x, y: p.y })),
    // Every point's own gradient at the final line, for the test that averages them.
    probe: { at: [w, b], gradients: pts.map((p) => exampleGradient(p, w, b)) },
  };
}

// The four points of the worked example. Seed 68 shuffles them into the order B, A, C, D.
const EXAMPLE = { custom: [-1, -1, 1, 1, -1, 0, 1, 0], batch: 1, rate: 0.125, decay: 0, steps: 8, seed: 68 };
const DEFAULTS = { points: 24, noise: 0.25, seed: 3, batch: 1, rate: 0.2, decay: 0, steps: 60, custom: [] };

// Plain gradient descent written separately from run(), as the reference for the tests.
function referenceDescent(points, rate, decay, steps) {
  const n = points.length;
  let w = 0, b = 0;
  const out = [[w, b]];
  for (let k = 0; k < steps; k++) {
    let sw = 0, sb = 0;
    for (const p of points) { sw += (w * p.x + b - p.y) * p.x; sb += w * p.x + b - p.y; }
    const eta = rate / (1 + decay * k);
    w -= eta * (2 / n) * sw;
    b -= eta * (2 / n) * sb;
    out.push([w, b]);
  }
  return out;
}
const samePath = (a, b, tol = 1e-12) => a.length === b.length && a.every((p, i) => Math.abs(p[0] - b[i][0]) <= tol && Math.abs(p[1] - b[i][1]) <= tol);

export default {
  meta: {
    id: 'stochastic-gradient-descent',
    name: 'Stochastic Gradient Descent',
    aliases: ['SGD', 'mini-batch gradient descent', 'minibatch gradient descent', 'mini-batch SGD', 'online gradient descent', 'stochastic gradient method'],
    kind: 'algorithm',
    discipline: 'optimization',
    alsoIn: [
      { id: 'machine-learning', why: 'A model\'s loss is an average over training examples, and sampling a few of them per step is what makes fitting on large datasets affordable.' },
      { id: 'deep-learning', why: 'Neural networks are trained on mini-batches: backpropagation computes the gradient for one batch and a stochastic gradient step applies it.' },
    ],
    subfield: 'Gradient methods',
    family: 'First-order methods',
    variantOf: 'gradient-descent',
    lab: 'optimization',
    summary: 'Gradient descent that estimates the gradient from one example or a small random batch at each step instead of the whole dataset.',
    difficulty: 'intermediate',
    order: 530,
    paradigms: ['gradient-based', 'iterative-refinement', 'randomized-sampling'],
    randomized: true,
    approximate: true,
    time: { best: 'O(B·d) per step', average: 'O(1/ε) steps (strongly convex, shrinking rate)', worst: 'No guarantee without assumptions', class: 'iterative' },
    space: { worst: 'O(d) plus one batch of data', class: 'linear' },
    tags: {
      problems: ['train a model on more data than fits in memory', 'learn from examples that arrive one at a time', 'make each training step cheaper', 'train a neural network on a large dataset', 'fit parameters to data', 'reduce a loss'],
      techniques: ['mini-batch', 'random sampling', 'learning rate schedule', 'epoch', 'gradient estimate'],
      applications: ['machine learning', 'signal processing', 'statistics', 'data processing'],
    },
    prerequisites: ['gradient-descent', 'concept:gradient', 'concept:loss-function', 'concept:sampling', 'concept:learning-rate'],
  },

  bigIdea: {
    simple: "Stochastic gradient descent is how a computer learns from a mountain of examples without looking at all of them before every move. Suppose a program should guess a house's price from its size, and it has a million past sales to learn from. It starts with a bad guessing rule. To improve the rule, it could check it against all million sales, work out the best small change, and make it. That is slow: a million checks for one small change. So it does something quicker. It picks a handful of sales at random, checks the rule on only those, and makes the small change they suggest. Then it picks another handful and does it again. Each handful gives a rough answer, a bit off in some random direction. But the handfuls are off in different directions, so over many steps the errors mostly cancel while the improvements add up. The word stochastic means random: chance decides which examples are used at each step.",
    when: 'Use it when the loss is an average over many examples and one pass over all of them is expensive: large datasets, data that arrive as a stream, and almost all neural network training. With a few hundred points and a simple model, full-batch [gradient descent](#/algorithm/gradient-descent) or an exact solver is simpler and has no sampling noise to manage. When the problem is small enough for second derivatives, [Newton\'s method](#/algorithm/newtons-method) needs far fewer steps.',
    interesting: 'The noise never fully goes away, and that is by design. At the best possible setting the full gradient is zero, but the gradient of any single example is not: the examples still disagree with each other. So with a fixed learning rate the method does not stop at the minimum. It hovers around it, in a cloud whose width is set by the learning rate and the batch size. You can watch the cloud shrink in the visualization by raising the batch size or by letting the learning rate decay.',
    analogy: {
      title: 'Asking ten customers instead of the whole town',
      text: 'A baker wants to know whether the town would like the bread saltier or sweeter. Asking all 20,000 townspeople would give a reliable answer, once, after weeks. Instead the baker asks ten customers picked at random, changes the recipe slightly in the direction they favour, and asks ten different customers the next day. Any ten people can be unusual, so on some days the recipe moves the wrong way. Over many days the unusual groups pull in different directions and cancel, and the recipe drifts toward what the town as a whole prefers. Asking a hundred people each day gives a steadier answer, but every day then costs ten times as much.',
      limits: 'The baker adjusts one thing. A model has many adjustable numbers, and each batch gives a direction for all of them at once. The baker could also stop when the customers seem content, but the batches in this method never agree: even at the best recipe, each small group still asks for some change, so the recipe keeps jittering unless the changes are made smaller over time. Last, the picture only works if the ten are chosen at random. A baker who only asks the early morning crowd ends up with bread for early risers, and a program that forgets to shuffle its data makes the same mistake.',
    },
  },

  example: {
    setup: "Four points: A (−1, −1), B (1, 1), C (−1, 0) and D (1, 0). The line starts flat, with slope 0 and height 0. The best line for these four points is known: slope 0.5, height 0. Each step looks at one point only. Find the gap, which is the point's y minus the line's y at that point. Then add a quarter of the gap to the height, and add a quarter of the gap times the point's x to the slope. The quarter comes from the learning rate, the number that sets how big each change is.",
    steps: [
      "Shuffle the points. The order comes out B, A, C, D. Point B is (1, 1). The flat line says 0 there, so the gap is 1. Height: 0 + 0.25 = 0.25. Slope: 0 + 0.25 × 1 = 0.25.",
      "Point A is (−1, −1). The line now says −0.25 + 0.25 = 0 there, so the gap is −1. Height: 0.25 − 0.25 = 0. Slope: a quarter of (−1 × −1) is 0.25, so 0.25 + 0.25 = 0.5. The line has slope 0.5 and height 0, which is the best line.",
      "Point C is (−1, 0). The line says −0.5 there, so the gap is 0.5. Height: 0 + 0.125 = 0.125. Slope: a quarter of (0.5 × −1) is −0.125, so 0.5 − 0.125 = 0.375. The step moved away from the best line. Point C cannot know the line was already as good as it gets, because C itself is not on it.",
      "Point D is (1, 0). The line says 0.375 + 0.125 = 0.5 there, so the gap is −0.5. Height: 0.125 − 0.125 = 0. Slope: 0.375 − 0.125 = 0.25.",
      "Compare with using all four points at once, from the flat start. The four requested changes to the slope are 0.25, 0.25, 0 and 0, and their average is 0.125. The four requested changes to the height are 0.25, −0.25, 0 and 0, and their average is 0. So one all-points step gives slope 0.125, height 0.",
    ],
    result: "After one pass through the four points the line has slope 0.25 and height 0. Measuring four gaps bought four small steps this way, against a single step to slope 0.125 the other way. Notice step 2: the line stood exactly on the best answer and then left it. The best line still has gaps at single points, so a method that listens to one point at a time keeps moving.",
    tryInput: { ...EXAMPLE },
  },

  terms: [
    { term: "Example", meaning: "One piece of data to learn from: an input together with the answer that goes with it. Here, one point." },
    { term: "Loss", meaning: "A score for how wrong the current guess is, averaged over the examples. Lower is better." },
    { term: "Gradient", meaning: "The list of slopes of the loss, one for each adjustable number. It says which small change would raise the loss fastest, so the opposite change lowers it." },
    { term: "Stochastic", meaning: "Decided partly by chance. Here, chance decides which examples each step uses." },
    { term: "Mini-batch", meaning: "The small random group of examples used for one step." },
    { term: "Batch size", meaning: "How many examples are in each mini-batch. A batch size equal to the whole dataset gives plain gradient descent." },
    { term: "Learning rate", meaning: "A number that sets how far each step moves." },
    { term: "Epoch", meaning: "One full pass through the data, in which every example has been used once." },
    { term: "Noise", meaning: "The difference between the direction a mini-batch suggests and the direction all the data would suggest." },
  ],

  takeaway: "Check a few random examples, take a small step the way they point, and repeat: each step is rough, but there can be a great many of them.",

  viz: {
    describe: 'Three charts. The first is a contour map of the loss over every possible line, with the slope on the horizontal axis and the intercept on the vertical axis. A hollow green circle marks the least squares line. A terracotta path shows every line tried so far, an ochre arrow shows the downhill direction according to the current batch, and an ink arrow shows the downhill direction according to all the data. A dashed ink path shows where plain gradient descent would go. The second chart shows the data points and the current line, with the points of the current batch enlarged in terracotta and their gaps to the line drawn in ochre. The third chart plots the loss over all points at each step, with the smallest possible loss as a dashed green line.',
    inputs: [
      { id: 'batch', type: 'range', label: 'Batch size', min: 1, max: 64, step: 1, default: DEFAULTS.batch,
        help: 'How many points each step looks at. At or above the number of points, every step uses all of them, which is plain gradient descent.' },
      { id: 'rate', type: 'range', scale: 'log', label: 'Learning rate (η)', min: 0.01, max: 1.2, default: DEFAULTS.rate,
        help: 'Step length as a multiple of the gradient. Logarithmic slider.' },
      { id: 'decay', type: 'range', label: 'Learning rate decay', min: 0, max: 0.5, step: 0.01, default: DEFAULTS.decay,
        help: '0 keeps the learning rate fixed. Otherwise step k uses the rate divided by (1 + decay × k).' },
      { id: 'steps', type: 'range', label: 'Steps', min: 4, max: 300, step: 4, default: DEFAULTS.steps },
      { id: 'points', type: 'range', label: 'Number of points', min: 8, max: 64, step: 1, default: DEFAULTS.points },
      { id: 'noise', type: 'range', label: 'Scatter in the data', min: 0, max: 0.6, step: 0.05, default: DEFAULTS.noise,
        help: 'How far the points scatter above and below the line they were generated from. 0 puts them exactly on it.' },
      { id: 'seed', type: 'seed', label: 'Random seed', default: DEFAULTS.seed },
      { id: 'custom', type: 'list', label: 'Or type your own points', default: [], maxLength: 80, min: -1.5, max: 1.5, placeholder: 'e.g. -1, -1, 1, 1, -1, 0, 1, 0',
        help: 'Numbers between −1.5 and 1.5, read as x, y pairs. Leave empty to use the generated points.' },
    ],
    presets: [
      { label: 'One point per step', values: { ...DEFAULTS } },
      { label: 'Batches of 4', values: { ...DEFAULTS, batch: 4 } },
      { label: 'Batches of 12', values: { ...DEFAULTS, batch: 12 } },
      { label: 'Full batch: plain gradient descent', values: { ...DEFAULTS, batch: 24 } },
      { label: 'One point per step, shrinking rate', values: { ...DEFAULTS, decay: 0.1, steps: 120 } },
      { label: 'One point per step, rate too large', values: { ...DEFAULTS, rate: 0.6 } },
      { label: 'No scatter: the points agree', values: { ...DEFAULTS, noise: 0, steps: 120 } },
      { label: 'Worked example: four points', values: { ...EXAMPLE } },
    ],
    tryThis: [
      'Load "One point per step" and play it. Then raise the batch size to 4, to 12 and to 24 and replay. Watch the terracotta path close in on the dashed path of plain gradient descent, and the ochre arrow close in on the ink arrow. At 24 the two paths are the same path.',
      'Read the last frame at each batch size. It says how many point gradients the run used and what plain gradient descent would have achieved with the same number. Small batches reach a rough fit for far less work. Large batches are smoother but pay for every step.',
      'Load "One point per step, shrinking rate". The early steps are as wild as before, but the later ones barely move the line, and the loss curve flattens onto the dashed green line. Set the decay back to 0 and the curve keeps twitching to the end.',
      'Load "No scatter: the points agree". Every point now lies on one line, so at that line every single-point gradient is zero and the path comes to rest without any decay. The hovering in the other presets is caused by the points disagreeing, not by the sampling as such.',
      'Change the seed. The data change and so does the shuffle, and the path takes a different route to the same neighbourhood.',
    ],
    run,
    report: (r, c) => `${r.batchSize === r.n ? `Full batch of ${r.n}: plain gradient descent` : `Batches of ${r.batchSize} from ${r.n} points`}. ${r.status === 'diverged' ? 'Diverged' : 'Ran'} ${r.steps} steps, ${c['point gradients'] || 0} point gradients (${trim(r.used / r.n)} passes through the data).\nFinal line: ${lineText(r.w, r.b)}   loss ${f3(r.loss)}\nLeast squares line: ${lineText(r.closedForm.w, r.closedForm.b)}   loss ${f3(r.closedForm.loss)}`,
    experiment: {
      title: 'Work to reach a good fit as the dataset grows',
      note: 'Each point is a real run on generated data (scatter 0.25) with learning rate 0.1 and no decay, from the flat line. The run stops the first time the loss over all points is within 10 percent of the smallest possible loss, and the chart shows how many single-point gradients it had computed by then. Checking the loss over all points is done for this measurement only and is not counted. Full batch pays for every point at every step, so its cost grows in step with the data. The mini-batch runs need about the same number of gradients however many points there are. The one-point series is measured but no formula is claimed for it, because a single noisy run can cross the 10 percent line early or late by chance.',
      metric: 'point gradients',
      metricLabel: 'Point gradients computed',
      sizeLabel: 'Number of data points (n)',
      sizes: [32, 64, 128, 256, 512, 1024, 2048],
      variants: [
        { id: 'full', label: 'Full batch (plain gradient descent)' },
        { id: 'mini', label: 'Batches of 8' },
        { id: 'single', label: 'One point per step' },
      ],
      input: (n, variant, seed) => ({ points: n, noise: 0.25, seed, custom: [], batch: variant === 'full' ? n : variant === 'mini' ? 8 : 1, rate: 0.1, decay: 0, steps: 200000, stopAt: 0.1 }),
      theory: [
        { label: 'proportional to n', fn: (n) => n, scaled: true, variant: 'full' },
        { label: 'no growth with n', fn: () => 1, scaled: true, variant: 'mini' },
      ],
    },
  },

  logic: {
    intuition: 'The loss of a model is an average over examples, so its gradient is an average too: the mean of one small gradient per example. A mean can be estimated from a sample. Draw a few examples at random, average their gradients, and you have an estimate of the full gradient that is right on average and wrong by a random amount each time. Stepping along that estimate is a step of gradient descent with some noise added. Because each step is cheap, many more of them fit into the same budget, and the noise in different steps tends to cancel.',
    steps: [
      'Choose a batch size B, a learning rate η and a starting point. This page starts from the flat line.',
      'Shuffle the n examples into a random order.',
      'Take the next B examples from that order as the mini-batch. If fewer than B are left, take what is left.',
      'Compute the gradient of the loss on each example in the batch at the current parameters, and average them.',
      'Move the parameters against that average by the learning rate. With decay switched on, the rate used at step k is η divided by (1 + decay × k).',
      'When every example has been used, one epoch is complete. Shuffle again and continue from step 3 until the step budget is spent.',
    ],
    pseudocode: [
      'sgd(data, B, η, decay, steps):',
      '  w ← 0;  b ← 0;  pos ← n',
      '  for k ← 0 to steps − 1:',
      '    if pos ≥ n:',
      '      shuffle(order);  pos ← 0',
      '    batch ← next B of order',
      '    pos ← pos + B',
      '    g ← mean of ∇ℓᵢ in batch',
      '    ηₖ ← η / (1 + decay·k)',
      '    (w, b) ← (w, b) − ηₖ·g',
      '  return w, b',
    ],
    decisions: [
      { title: 'How large a batch?', text: 'The spread of the batch gradient around the full gradient shrinks in proportion to 1/B, so its typical error shrinks like 1/√B: four times the batch buys half the noise at four times the cost per step. Small batches make faster progress per example processed while the model is far from the answer. Larger batches give steadier steps and use parallel hardware better. In practice the batch size is often set by how many examples fit in memory at once.' },
      { title: 'Shuffle each epoch, or draw at random with replacement?', text: 'This page shuffles once per epoch and deals the batches from the shuffled order, so every example is used exactly once per pass. That is the common practice. Most of the classical theory instead assumes each batch is drawn independently, which is simpler to analyse.' },
      { title: 'Fixed or shrinking learning rate?', text: 'A fixed rate brings the parameters quickly into a neighbourhood of the minimum and then leaves them wandering inside it. A rate that shrinks toward zero at a suitable pace removes the wandering and gives convergence, at the price of slower progress late on. Schedules that hold the rate for a while and then lower it are a common compromise.' },
      { title: 'When to stop?', text: 'A mini-batch gradient is not zero at the minimum, so the small-gradient test of plain gradient descent does not work. Runs usually stop after a fixed number of epochs, or when the loss on data held back from training stops improving.' },
    ],
    invariants: [
      'At any fixed parameters, the average of the gradients of all n examples is the full gradient. A batch drawn uniformly at random therefore has the full gradient as its expected value.',
      'Within one epoch, every example appears in exactly one batch.',
      'When B = n the batch is the whole dataset and every step equals the gradient descent step.',
    ],
    edgeCases: [
      'Batch size 1: the noisiest and cheapest steps. This is the original, one-example-at-a-time form of the method.',
      'Batch size n or larger: no sampling at all. The method is plain gradient descent and its path is smooth.',
      'A batch size that does not divide n: the last batch of each epoch is smaller, so its gradient is a little noisier than the others.',
      'Data with no scatter, where one setting fits every example exactly: every single-example gradient is zero at that setting, the noise vanishes there, and a fixed learning rate converges.',
      'A learning rate that is safe for the full gradient can still be too large for single examples, because one unusual example can have a much steeper gradient than the average.',
      'Data that are not shuffled, for instance sorted by label: consecutive batches all push the same way, and the model swings toward whatever it saw most recently.',
    ],
    correctness: 'There is no guarantee for a single run, only statements about expected behaviour under assumptions. The key fact is that the batch gradient is an unbiased estimate: its expected value is the full gradient. If the loss is smooth and the variance of the estimate is bounded, then with a small enough fixed learning rate the expected loss decreases until the parameters reach a neighbourhood of a stationary point whose size is proportional to the learning rate. To converge to the point itself, the learning rate must shrink, and the classical conditions of Robbins and Monro say how: the rates must sum to infinity, so the method can travel any distance, while their squares must have a finite sum, so the accumulated noise stays bounded. A rate proportional to 1/k satisfies both. On a convex loss the limit is a global minimum. On a non-convex loss, such as a neural network\'s, only convergence to a stationary point can be shown.',
    mistakes: [
      'Adding up the batch\'s gradients and forgetting to divide by the batch size. The step then grows with the batch, and a learning rate tuned for one batch size diverges at a larger one.',
      'Not shuffling, or always taking the same first B examples. The model then fits those examples and ignores the rest.',
      'Judging progress from the loss on the current batch. That number is as noisy as the gradient. Track an average over many batches, or the loss on separate data.',
      'Keeping the learning rate that worked for full-batch descent. Single examples can be much steeper than their average.',
      'Changing the batch size without revisiting the learning rate. The two together set the size of the noise.',
    ],
  },

  code: {
    sample: {
      input: 'Fit a line to eight points with batches of 2 and then with the full batch of 8, from the same start and with the same shrinking learning rate, printing after every 16 point gradients so the two can be compared at equal work.',
      expected: 'batch 2 after 16 gradients: w=1.8613 b=0.9492 loss=0.0654\nbatch 2 after 32 gradients: w=2.0051 b=0.9756 loss=0.0240\nbatch 2 after 48 gradients: w=2.0285 b=0.9748 loss=0.0230\nbatch 8 after 16 gradients: w=1.0129 b=0.4908 loss=1.9238\nbatch 8 after 32 gradients: w=1.4824 b=0.7157 loss=0.5724\nbatch 8 after 48 gradients: w=1.7177 b=0.8268 loss=0.2015',
    },
    python: {
      source: `xs = [-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0]
ys = [-2.1, -1.2, 0.2, 0.8, 2.1, 2.9, 4.2, 4.9]
n = len(xs)
seed = 2024


def next_random(limit):
    # A small fixed generator, so every language draws the same numbers.
    global seed
    seed = seed * 48271 % 2147483647
    return seed % limit


def shuffled():
    order = list(range(n))
    for i in range(n - 1, 0, -1):
        j = next_random(i + 1)
        order[i], order[j] = order[j], order[i]
    return order


def loss(w, b):
    total = 0.0
    for x, y in zip(xs, ys):
        r = w * x + b - y
        total += r * r
    return total / n


def train(size, steps, label):
    w, b, pos, order = 0.0, 0.0, n, []
    for k in range(steps):
        if pos >= n:
            order, pos = shuffled(), 0
        batch = order[pos:pos + size]
        pos += size
        gw, gb = 0.0, 0.0
        for i in batch:
            r = w * xs[i] + b - ys[i]
            gw += 2 * r * xs[i]
            gb += 2 * r
        rate = 0.1 / (1 + 0.05 * k)
        w -= rate * gw / len(batch)
        b -= rate * gb / len(batch)
        used = (k + 1) * size
        if used % 16 == 0:
            print(f"{label} after {used} gradients: w={w:.4f} b={b:.4f} loss={loss(w, b):.4f}")


train(2, 24, "batch 2")
train(8, 6, "batch 8")`,
      notes: [
        { line: 7, text: 'Library random number generators differ between languages. Writing a tiny one out makes the shuffle, and so the whole run, identical everywhere.' },
        { line: 34, text: 'A new epoch: every point has been used, so shuffle again and start dealing from the front.' },
        { line: 35, text: 'The mini-batch is the next few indices of the shuffled order. With size equal to n it is every point, and the loop below computes the full gradient.' },
        { line: 40, text: 'Each point contributes the gradient of its own squared gap. Nothing outside the batch is looked at.' },
        { line: 43, text: 'Dividing by the batch size turns the sum into an average. Without it, the step would grow with the batch.' },
      ],
    },
    javascript: {
      source: `const xs = [-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0];
const ys = [-2.1, -1.2, 0.2, 0.8, 2.1, 2.9, 4.2, 4.9];
const n = xs.length;
let seed = 2024;

// A small fixed generator, so every language draws the same numbers.
function nextRandom(limit) {
  seed = (seed * 48271) % 2147483647;
  return seed % limit;
}

function shuffled() {
  const order = [];
  for (let i = 0; i < n; i++) order.push(i);
  for (let i = n - 1; i > 0; i--) {
    const j = nextRandom(i + 1);
    const kept = order[i];
    order[i] = order[j];
    order[j] = kept;
  }
  return order;
}

function loss(w, b) {
  let total = 0;
  for (let i = 0; i < n; i++) {
    const r = w * xs[i] + b - ys[i];
    total += r * r;
  }
  return total / n;
}

function train(size, steps, label) {
  let w = 0, b = 0, pos = n, order = [];
  for (let k = 0; k < steps; k++) {
    if (pos >= n) {
      order = shuffled();
      pos = 0;
    }
    const batch = order.slice(pos, pos + size);
    pos += size;
    let gw = 0, gb = 0;
    for (const i of batch) {
      const r = w * xs[i] + b - ys[i];
      gw += 2 * r * xs[i];
      gb += 2 * r;
    }
    const rate = 0.1 / (1 + 0.05 * k);
    w -= rate * gw / batch.length;
    b -= rate * gb / batch.length;
    const used = (k + 1) * size;
    if (used % 16 === 0) {
      console.log(label + " after " + used + " gradients: w=" + w.toFixed(4) + " b=" + b.toFixed(4) + " loss=" + loss(w, b).toFixed(4));
    }
  }
}

train(2, 24, "batch 2");
train(8, 6, "batch 8");`,
    },
    cpp: {
      source: `#include <algorithm>
#include <cstdio>
#include <vector>

const std::vector<double> xs = {-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0};
const std::vector<double> ys = {-2.1, -1.2, 0.2, 0.8, 2.1, 2.9, 4.2, 4.9};
const int n = 8;
long long seed = 2024;

// A small fixed generator, so every language draws the same numbers.
int nextRandom(int limit) {
    seed = seed * 48271 % 2147483647;
    return static_cast<int>(seed % limit);
}

std::vector<int> shuffled() {
    std::vector<int> order(n);
    for (int i = 0; i < n; ++i) order[i] = i;
    for (int i = n - 1; i > 0; --i) std::swap(order[i], order[nextRandom(i + 1)]);
    return order;
}

double loss(double w, double b) {
    double total = 0.0;
    for (int i = 0; i < n; ++i) {
        double r = w * xs[i] + b - ys[i];
        total += r * r;
    }
    return total / n;
}

void train(int size, int steps, const char* label) {
    double w = 0.0, b = 0.0;
    int pos = n;
    std::vector<int> order;
    for (int k = 0; k < steps; ++k) {
        if (pos >= n) {
            order = shuffled();
            pos = 0;
        }
        int end = std::min(pos + size, n);
        double gw = 0.0, gb = 0.0;
        for (int at = pos; at < end; ++at) {
            int i = order[at];
            double r = w * xs[i] + b - ys[i];
            gw += 2 * r * xs[i];
            gb += 2 * r;
        }
        int count = end - pos;
        pos += size;
        double rate = 0.1 / (1 + 0.05 * k);
        w -= rate * gw / count;
        b -= rate * gb / count;
        int used = (k + 1) * size;
        if (used % 16 == 0) {
            std::printf("%s after %d gradients: w=%.4f b=%.4f loss=%.4f\\n", label, used, w, b, loss(w, b));
        }
    }
}

int main() {
    train(2, 24, "batch 2");
    train(8, 6, "batch 8");
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The cost has two parts: the price of one step and the number of steps. One step costs B single-example gradients, where plain gradient descent pays n. The number of steps to a given accuracy is larger than for the exact gradient, and it depends on how noisy the estimates are, but it does not depend on how many examples the dataset holds. That is the reason the method scales: the work to reach a fixed quality of fit stays roughly level while the data grow.',
    cases: [
      { case: 'One step', time: 'O(B·d)', when: 'B examples, each with a gradient over d parameters. Plain gradient descent costs O(n·d).' },
      { case: 'Strongly convex loss, rate shrinking like 1/k', time: 'O(1/ε) steps', when: 'The expected gap to the optimum shrinks like 1/k after k steps. Plain gradient descent needs only O(log(1/ε)) steps here, but each of its steps costs n examples.' },
      { case: 'Convex loss, rate shrinking like 1/√k', time: 'O(1/ε²) steps', when: 'The expected gap of the averaged parameters shrinks like 1/√k.' },
      { case: 'Strongly convex loss, fixed rate', time: 'Fast to a neighbourhood, then no further', when: 'The expected gap falls geometrically until it reaches a floor proportional to the learning rate times the gradient variance, and stays there.' },
      { case: 'Smooth non-convex loss', time: 'O(1/ε²) steps to an expected squared gradient below ε', when: 'The bound is for the smallest expected squared gradient among the steps taken. Only a stationary point can be promised, as with plain gradient descent, and the rate is slower.' },
    ],
    space: 'O(d) for the parameters and one gradient, plus the examples of the current batch. The dataset itself can stay on disk or arrive as a stream.',
    memory: 'Only one batch has to be in memory at a time. This is what lets a model train on a dataset far larger than the machine\'s memory, and what lets the batch size be chosen to fill whatever memory the hardware has.',
    tradeoffs: 'Smaller batches mean cheaper, noisier steps. Larger batches mean steadier, more expensive ones. A fixed learning rate is fast early and never settles. A shrinking one settles and is slow late. None of these choices is best in general: they are tuned together for the problem and the hardware.',
    assumptions: [
      'The loss is an average of per-example losses, and each batch is a uniform random sample, so the batch gradient is an unbiased estimate of the full gradient.',
      'The stated rates are for the expected value over the random draws, assume the variance of the gradient estimate is bounded, and assume independent draws. Shuffling once per epoch, as this page does, behaves similarly in practice but is analysed separately.',
      'ε is the target accuracy in expected loss, except in the non-convex case where it bounds the expected squared length of the gradient.',
      'The experiment on this page measures one generated dataset per size and stops at the first step that is within 10 percent of the best loss. It illustrates how the cost depends on n and is not a general benchmark.',
    ],
  },

  tradeoffs: {
    struggles: [
      'Problems that need a very precise minimum. The noise that makes early progress cheap makes the last digits expensive.',
      'Badly scaled problems. Like plain gradient descent it crawls along narrow valleys, and the noise makes the zig-zag worse.',
      'Small datasets, where the full gradient is already cheap and the noise buys nothing.',
      'Settings where the learning rate cannot be tuned. It is sensitive to the rate, and the right schedule is found by trial.',
    ],
    pitfalls: [
      'Summing the batch gradients without averaging, so the effective learning rate changes with the batch size.',
      'Feeding the data in a fixed, meaningful order instead of shuffling.',
      'Reading the noisy per-batch loss as if it were the true loss, and stopping or changing settings because of one bad batch.',
      'Comparing two runs at equal numbers of steps when their batch sizes differ. The fair comparison is at equal numbers of examples processed, or equal time.',
    ],
    misunderstandings: [
      "\"Using only a few examples gives a wrong direction, so it cannot work.\" Each direction is wrong by a random amount, but it is right on average. Errors in different steps point different ways and largely cancel, while the shared downhill part adds up.",
      "\"If it runs long enough it lands exactly on the minimum.\" With a fixed learning rate it does not. It keeps hovering nearby, because single examples still have nonzero gradients at the minimum. The learning rate has to shrink for the hovering to stop.",
      "\"A bigger batch is always better.\" A bigger batch gives a steadier step, but it costs proportionally more and the noise only falls with the square root of the batch size. Per example processed, small batches often make more progress early on.",
      "\"Stochastic means the method is unreliable.\" The randomness is in which examples are drawn, and a fixed seed reproduces a run exactly. What changes from seed to seed is the route, not the neighbourhood it ends in.",
      "\"One epoch means the model has learned from all the data.\" It means every example has been used for one small step. Many epochs are usually needed.",
    ],
    constraints: [
      'Every example must be reachable in random order, or the stream must already arrive in an order that has nothing to do with its content.',
      'Parallel hardware processes a batch of many examples almost as fast as a batch of one, which pushes practical batch sizes well above 1.',
      'The plain update is rarely used alone for neural networks. Momentum is usually added, or an adaptive method such as Adam is used.',
    ],
    alternatives: [
      { id: 'gradient-descent', name: 'Gradient Descent', when: 'The dataset is small enough that the exact gradient is cheap, or a precise minimum is needed.' },
      { id: 'adam', name: 'Adam', when: 'Different parameters need very different step sizes, as in many neural networks, and tuning one global rate is hard.' },
      { id: 'newtons-method', name: 'Newton\'s Method', when: 'There are few parameters and second derivatives are affordable.' },
      { name: 'SGD with momentum', when: 'The loss surface has narrow valleys. Averaging recent steps damps the side-to-side motion and smooths the noise.' },
      { name: 'Variance-reduced methods (SAG, SVRG, SAGA)', when: 'The dataset is finite and a precise minimum of a convex loss is wanted. They correct each batch gradient with stored information and converge with a fixed learning rate.' },
    ],
    comparison: {
      columns: ['', 'One example (B = 1)', 'Mini-batch (1 < B < n)', 'Full batch (B = n)'],
      rows: [
        ['Cost of one step', '1 example gradient', 'B example gradients', 'n example gradients'],
        ['Direction of one step', 'Very noisy', 'Noise shrinks like 1/√B', 'Exact'],
        ['Steps per pass through the data', 'n', 'n / B', '1'],
        ['Behaviour with a fixed rate', 'Hovers widely around the minimum', 'Hovers more tightly', 'Converges to it'],
        ['Stopping test', 'Fixed budget or held-out loss', 'Fixed budget or held-out loss', 'Small gradient'],
      ],
    },
  },

  applications: [
    { title: 'Training neural networks', status: 'established', text: 'Deep networks are trained on mini-batches. Backpropagation computes the gradient of the loss on one batch, and a stochastic gradient step, usually with momentum or in an adaptive form such as Adam, updates the weights. The image classification networks AlexNet and ResNet were both trained with mini-batch stochastic gradient descent with momentum.' },
    { title: 'Large linear models', status: 'established', text: 'Linear classifiers and regressions on datasets with millions of examples are routinely fitted with stochastic gradient steps, because one pass over the data costs about the same as a single full gradient and gets much further.' },
    { title: 'Adaptive filters', status: 'established', text: 'The least mean squares filter of Widrow and Hoff adjusts its weights after every incoming sample by a stochastic gradient step on the squared error. It is a standard tool in signal processing, for example in echo cancellation.' },
    { title: 'Recommender systems', status: 'established', text: 'Matrix factorization models, which describe each user and each item by a short list of numbers, are commonly fitted by visiting the known ratings one at a time and nudging the two lists involved.' },
    { title: 'Learning from a live stream', status: 'illustrative', text: 'A model that predicts clicks or demand can take one small step for each new observation as it arrives, without ever storing the full history.' },
  ],

  connections: [
    { to: 'gradient-descent', type: 'prerequisite', why: 'Stochastic gradient descent takes the same downhill step as gradient descent, but measures the slope on a random sample of the data instead of all of it. With the batch equal to the dataset the two are identical.' },
    { to: 'concept:gradient', type: 'prerequisite', why: 'Each step of stochastic gradient descent moves against a gradient, here the average of the gradients of a few examples.' },
    { to: 'concept:sampling', type: 'prerequisite', why: 'A mini-batch is a random sample of the dataset, and stochastic gradient descent relies on that sample being drawn fairly so that its gradient is right on average.' },
    { to: 'concept:expectation', type: 'related', why: 'The mini-batch gradient in stochastic gradient descent is an unbiased estimate: its expected value over the random draw is exactly the full gradient.' },
    { to: 'concept:learning-rate', type: 'related', why: 'In stochastic gradient descent the learning rate sets both the speed of progress and the width of the cloud in which the parameters hover, which is why it is often lowered over time.' },
    { to: 'monte-carlo', type: 'related', why: 'Monte Carlo estimation and stochastic gradient descent both replace a sum that is too large to compute with an average over random samples, and both get an estimate whose error shrinks as the sample grows.' },
    { to: 'linear-regression', type: 'application', why: 'The demonstration fits a linear regression by stochastic gradient descent, and because least squares has an exact answer, the noisy path can be compared with where it ought to end.' },
    { to: 'logistic-regression', type: 'application', why: 'Logistic regression has no formula for its best weights, so on large datasets it is fitted by stochastic gradient descent, a few examples at a time.' },
    { to: 'perceptron', type: 'related', why: 'The perceptron learning rule updates its weights after each single example, the same one-example-at-a-time pattern as stochastic gradient descent with a batch size of 1.' },
    { to: 'backpropagation', type: 'related', why: 'Backpropagation computes the gradient of a network\'s loss on one mini-batch, and stochastic gradient descent is the rule that uses that gradient to change the weights.' },
    { to: 'adam', type: 'advanced', why: 'Adam starts from stochastic gradient descent and adds two running averages: one smooths the noisy batch gradients, and the other gives every parameter its own step size.' },
    { to: 'discipline:deep-learning', type: 'application', why: 'Training a deep network means running stochastic gradient descent, or a variant of it, over mini-batches for many epochs.' },
    { to: 'discipline:statistics', type: 'related', why: 'Stochastic gradient descent grew out of stochastic approximation, the statistical study of finding a root or an optimum from noisy measurements.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why is it acceptable to step along the gradient of a small random batch instead of the gradient of all the data?',
      options: ['Because a small batch always points the same way as the full gradient', 'Because the batch gradient equals the full gradient on average, so its errors tend to cancel over many steps', 'Because the full gradient is itself only an approximation', 'Because the learning rate corrects the error in each step'],
      answer: 1,
      explain: [
        'A single batch can point a long way off. In the demonstration the two arrows are often tens of degrees apart.',
        'The full gradient is the mean of the per-example gradients, and a fair random sample has that mean as its expected value. Individual steps are off, but not in any consistent direction.',
        'For a given dataset the full gradient is exact. It is the batch gradient that is the estimate.',
        'The learning rate scales a step. It has no way of knowing which way the step is wrong.',
      ],
    },
    {
      type: 'predict',
      q: 'The default run uses 24 points, one point per step and a learning rate of 0.2, and its loss goes up on many steps. What happens if only the batch size is changed, to 24?',
      options: ['The path gets noisier, because more points disagree', 'Nothing changes, because the same points are used in the end', 'The path becomes smooth and the loss never rises: it is exactly plain gradient descent', 'It diverges, because 24 gradients are added together'],
      answer: 2,
      explain: [
        'Averaging more points cancels more of their disagreement. Noise falls as the batch grows.',
        'Using a point one at a time and using all of them together are different things. Each step now sees every point.',
        'With every point in every batch there is nothing left to sample. Each step uses the full gradient, and at this learning rate the full gradient step always lowers the loss.',
        'The batch gradient is an average, not a sum, so its size does not grow with the batch.',
      ],
      tryInput: { ...DEFAULTS, batch: 24 },
    },
    {
      type: 'debug',
      q: 'With this loop the loss on the first four examples drops to almost nothing, but the loss on the whole dataset stays high. What is wrong?',
      code: `for step in range(1000):
    batch = data[:4]
    gw, gb = 0.0, 0.0
    for x, y in batch:
        r = w * x + b - y
        gw += 2 * r * x / len(batch)
        gb += 2 * r / len(batch)
    w -= rate * gw
    b -= rate * gb`,
      options: ['The gradient should not be divided by the batch size', 'Every step uses the same four examples, so the model only ever fits those', 'The learning rate must shrink over time', 'The residual has the wrong sign'],
      answer: 1,
      explain: [
        'Dividing by the batch size is right. It makes the batch gradient an average.',
        '`data[:4]` is the same slice every time. The batch must be a fresh random sample, for instance the next four indices of a shuffled order.',
        'A shrinking rate reduces hovering. It cannot make the model learn from examples it never sees.',
        'Prediction minus observation, followed by a subtraction in the update, is the correct pairing.',
      ],
    },
    {
      type: 'choice',
      q: 'A run with one point per step and a fixed learning rate gets close to the best line and then keeps jittering around it. Why does it not settle?',
      options: ['The learning rate is too small to finish the job', 'At the best line the gradient of each single point is still not zero, so every step still moves the line', 'The shuffle puts the points in a bad order', 'Rounding errors in the arithmetic build up'],
      answer: 1,
      explain: [
        'A smaller rate would shrink the jitter, not cause it.',
        'The best line makes the average gradient zero, not each point\'s own. Points above the line pull it up and points below pull it down, and a step that listens to one of them moves.',
        'Any order gives the same behaviour. The cause is that single points disagree with the average.',
        'Rounding errors are many orders of magnitude smaller than the jitter seen here.',
      ],
    },
    {
      type: 'challenge',
      title: 'Tame the noise three ways',
      prompt: 'Starting from the code sample, fix the batch size at 1 and compare three ways of getting a precise answer from noisy steps, all given the same number of example gradients. First, a learning rate that shrinks like 1/(1 + decay × k). Second, a fixed learning rate, but report the average of all the parameter values visited in the second half of the run instead of the last one. Third, a fixed learning rate with the batch size doubled every epoch. For each, measure the distance from the least squares line, averaged over 20 seeds. Which is most accurate, and which was most sensitive to its settings?',
      hints: ['The average of the visited parameters can be kept as a running mean, so it needs no extra memory.', 'Averaging the iterates is known as Polyak-Ruppert averaging.', 'To compare fairly, count example gradients, not steps.'],
    },
  ],

  compare: {
    idea: 'Take gradient descent steps, but work out each step from a few randomly chosen examples instead of all of them.',
    requires: 'A score for how wrong the model is that is an average over many examples, a way to pick examples at random, and a step size found by trying a few.',
    sensitivity: 'High. Sensitive to the learning rate and its schedule, the batch size, and the scaling of the inputs. Different seeds give different paths.',
    memory: 'The model\'s numbers plus one small batch of data at a time.',
    difficulty: 'low',
    difficultyNote: 'A few lines more than gradient descent. The work is in choosing the batch size and the learning rate schedule.',
    limits: 'It gets close to the best answer quickly but keeps wobbling around it unless the steps are made smaller over time. It is slow when a very exact answer is needed.',
    useWhen: 'There are too many examples to look at all of them before every step, or the examples keep arriving.',
  },

  advanced: {
    history: 'Herbert Robbins and Sutton Monro published "A Stochastic Approximation Method" in 1951. It showed how to find the root of a function that can only be observed with noise, by taking steps whose sizes shrink at a prescribed pace. Jack Kiefer and Jacob Wolfowitz adapted the idea in 1952 to finding the maximum of such a function. Bernard Widrow and Ted Hoff described the least mean squares rule in 1960, which adjusts a linear unit after every sample and is stochastic gradient descent on a squared error. When backpropagation became widely known in the 1980s, updating after each example or small batch became a usual way to train multi-layer networks. The method became the standard tool of large-scale machine learning as datasets grew past the point where a full gradient was affordable.',
    derivation: 'Write the loss as an average of per-example losses,\n\n$$L(\\theta) = \\frac{1}{n}\\sum_{i=1}^{n} \\ell_i(\\theta), \\qquad \\nabla L(\\theta) = \\frac{1}{n}\\sum_{i=1}^{n} \\nabla \\ell_i(\\theta).$$\n\nDraw an index $i$ uniformly at random. Then\n\n$$\\mathbb{E}\\left[\\nabla \\ell_i(\\theta)\\right] = \\sum_{i=1}^{n} \\frac{1}{n}\\nabla \\ell_i(\\theta) = \\nabla L(\\theta),$$\n\nso one example\'s gradient is an unbiased estimate of the full gradient. For a batch $S$ of $B$ indices drawn without replacement, the batch gradient $g_S = \\frac{1}{B}\\sum_{i \\in S}\\nabla \\ell_i(\\theta)$ has the same expected value, and its variance is\n\n$$\\mathbb{E}\\,\\lVert g_S - \\nabla L\\rVert^2 = \\frac{\\sigma^2}{B}\\cdot\\frac{n - B}{n - 1}, \\qquad \\sigma^2 = \\frac{1}{n}\\sum_{i=1}^{n}\\lVert\\nabla \\ell_i - \\nabla L\\rVert^2.$$\n\nThe factor $1/B$ is the usual gain from averaging. The second factor is the finite population correction: it reaches zero at $B = n$, where the batch is the whole dataset and the estimate is exact. The update is then $\\theta_{k+1} = \\theta_k - \\eta_k\\, g_{S_k}(\\theta_k)$.',
    proof: 'Assume $\\nabla L$ is $M$-Lipschitz, the estimate $g$ is unbiased, and $\\mathbb{E}\\lVert g - \\nabla L\\rVert^2 \\le \\sigma_B^2$. The descent lemma applied to the step $\\theta^+ = \\theta - \\eta g$ gives\n\n$$L(\\theta^+) \\le L(\\theta) - \\eta\\,\\nabla L(\\theta)^\\top g + \\frac{M\\eta^2}{2}\\lVert g\\rVert^2.$$\n\nTake the expectation over the draw. Unbiasedness gives $\\mathbb{E}[\\nabla L^\\top g] = \\lVert\\nabla L\\rVert^2$ and $\\mathbb{E}\\lVert g\\rVert^2 \\le \\lVert\\nabla L\\rVert^2 + \\sigma_B^2$, so\n\n$$\\mathbb{E}\\,L(\\theta^+) \\le L(\\theta) - \\eta\\left(1 - \\frac{M\\eta}{2}\\right)\\lVert\\nabla L(\\theta)\\rVert^2 + \\frac{M\\eta^2}{2}\\sigma_B^2.$$\n\nThe middle term is the progress of plain gradient descent. The last term is the price of the noise. With $\\eta \\le 1/M$ this guarantees that the expected loss falls as long as $\\lVert\\nabla L\\rVert^2 > M\\eta\\,\\sigma_B^2$, and guarantees nothing once the gradient is that small. That threshold marks the hovering region: it shrinks when $\\eta$ shrinks or when the batch grows, because $\\sigma_B^2$ falls like $1/B$.',
    complexityProof: 'If $L$ is also $\\mu$-strongly convex, then $\\lVert\\nabla L(\\theta)\\rVert^2 \\ge 2\\mu\\,(L(\\theta) - L^\\star)$. Substituting into the inequality above with a fixed $\\eta \\le 1/M$ gives\n\n$$\\mathbb{E}\\,[L(\\theta_{k+1}) - L^\\star] \\le (1 - \\mu\\eta)\\,\\mathbb{E}\\,[L(\\theta_k) - L^\\star] + \\frac{M\\eta^2}{2}\\sigma_B^2.$$\n\nUnrolling the recursion, the expected gap falls geometrically toward the floor $\\frac{M\\eta\\,\\sigma_B^2}{2\\mu}$ and no lower. With a rate that shrinks like $\\eta_k = c/(k + k_0)$ for suitable constants, the same recursion gives an expected gap of order $1/k$. Reaching accuracy $\\varepsilon$ therefore takes on the order of $1/\\varepsilon$ steps, each costing $B$ examples, a total that does not involve $n$. Plain gradient descent needs on the order of $\\kappa\\log(1/\\varepsilon)$ steps of $n$ examples each. Which is cheaper depends on $n$ and on the accuracy wanted.',
    variants: [
      { name: 'Momentum', text: 'Keeps a running average of recent batch gradients and steps along it. It smooths the noise and speeds progress along narrow valleys.' },
      { name: 'Adaptive methods (AdaGrad, RMSProp, Adam)', text: 'Give each parameter its own step size based on the sizes of its past gradients.' },
      { name: 'Iterate averaging (Polyak-Ruppert)', text: 'Runs with a larger learning rate and reports the average of the parameter values visited, which cancels much of the hovering.' },
      { name: 'Variance reduction (SAG, SVRG, SAGA)', text: 'Uses stored or periodically recomputed gradients to cancel most of the sampling noise on a finite dataset, which restores fast convergence with a fixed learning rate on convex problems.' },
      { name: 'Sampling with replacement', text: 'Draws every batch independently instead of dealing from a shuffled order. It matches the classical theory, at the cost of using some examples more often than others within a pass.' },
    ],
    implementation: 'Shuffle before every epoch. Average over the batch, so that the learning rate means the same thing at every batch size. Scale the inputs so that no parameter needs a much smaller step than the others. Monitor a running average of the batch loss, or the loss on held-out data, never a single batch. Lower the learning rate when progress stalls. For reproducible runs, fix the seed of the shuffle.',
    benchmarking: 'Compare runs at equal numbers of examples processed or equal wall-clock time, not equal numbers of steps. Repeat each setting over several seeds and report the spread, because one run is one draw from a distribution. Tune the learning rate separately for each batch size.',
    references: [
      { authors: 'H. Robbins and S. Monro', year: 1951, title: 'A stochastic approximation method', venue: 'The Annals of Mathematical Statistics 22(3), 400-407' },
      { authors: 'J. Kiefer and J. Wolfowitz', year: 1952, title: 'Stochastic estimation of the maximum of a regression function', venue: 'The Annals of Mathematical Statistics 23(3), 462-466' },
      { authors: 'L. Bottou, F. E. Curtis and J. Nocedal', year: 2018, title: 'Optimization methods for large-scale machine learning', venue: 'SIAM Review 60(2), 223-311' },
      { authors: 'I. Goodfellow, Y. Bengio and A. Courville', year: 2016, title: 'Deep Learning', venue: 'MIT Press' },
    ],
    furtherReading: [
      'L. Bottou, F. E. Curtis and J. Nocedal, "Optimization methods for large-scale machine learning", sections 3 and 4, for why stochastic steps win on large datasets and for the convergence analysis sketched here.',
      'I. Goodfellow, Y. Bengio and A. Courville, *Deep Learning*, chapter 8, "Optimization for Training Deep Models".',
      'B. T. Polyak and A. B. Juditsky, "Acceleration of stochastic approximation by averaging", *SIAM Journal on Control and Optimization* 30(4), 1992, for iterate averaging.',
    ],
  },

  tests: [
    { name: 'a batch of every point takes exactly the gradient descent step, at every step', input: { ...DEFAULTS, batch: 24, steps: 40 },
      check: (r) => (r.batchSize === 24 && samePath(r.path, referenceDescent(r.points, 0.2, 0, 40))) || `full-batch path differs from independent gradient descent; ended at (${r.w}, ${r.b})` },
    { name: 'a batch size above the number of points is treated as the full batch', input: { ...DEFAULTS, points: 10, batch: 64, rate: 0.3, decay: 0.05, steps: 30 },
      check: (r) => (r.batchSize === 10 && r.used === 300 && samePath(r.path, referenceDescent(r.points, 0.3, 0.05, 30))) || `batch size ${r.batchSize}, used ${r.used}` },
    { name: 'the average of the per-example gradients equals the full gradient', input: { ...DEFAULTS },
      check: (r) => {
        const n = r.points.length, [w, b] = r.probe.at;
        let aw = 0, ab = 0;
        for (const g of r.probe.gradients) { aw += g[0] / n; ab += g[1] / n; }
        let fw = 0, fb = 0;
        for (const p of r.points) { fw += (w * p.x + b - p.y) * p.x; fb += w * p.x + b - p.y; }
        fw *= 2 / n; fb *= 2 / n;
        return (r.probe.gradients.length === n && Math.hypot(fw, fb) > 1e-3 && Math.abs(aw - fw) < 1e-12 && Math.abs(ab - fb) < 1e-12) || `average (${aw}, ${ab}) against full (${fw}, ${fb})`;
      } },
    { name: 'every step is the average gradient of its own batch, times the stated learning rate', input: { ...DEFAULTS, batch: 5, decay: 0.07, steps: 50 },
      check: (r) => {
        for (let k = 0; k < r.steps; k++) {
          const [w, b] = r.path[k];
          let gw = 0, gb = 0;
          for (const i of r.batches[k]) { const p = r.points[i]; gw += 2 * (w * p.x + b - p.y) * p.x; gb += 2 * (w * p.x + b - p.y); }
          const eta = 0.2 / (1 + 0.07 * k), m = r.batches[k].length;
          if (Math.abs(r.path[k + 1][0] - (w - eta * gw / m)) > 1e-12 || Math.abs(r.path[k + 1][1] - (b - eta * gb / m)) > 1e-12) return `step ${k + 1} does not match its batch`;
        }
        return r.steps === 50 || `ran ${r.steps} steps`;
      } },
    { name: 'every point is used exactly once per epoch', input: { ...DEFAULTS, batch: 4, steps: 12 },
      check: (r) => {
        for (let e = 0; e < 2; e++) {
          const seen = r.batches.slice(e * 6, e * 6 + 6).flat().sort((a, b) => a - b);
          if (seen.length !== 24 || seen.some((v, i) => v !== i)) return `epoch ${e + 1} used points ${seen.join(',')}`;
        }
        return (r.epochs === 2 && r.used === 48) || `epochs ${r.epochs}, used ${r.used}`;
      } },
    { name: 'the last batch of an epoch is smaller when the batch size does not divide n', input: { ...DEFAULTS, points: 10, batch: 4, steps: 12 },
      check: (r) => {
        const sizes = r.batches.map((x) => x.length).join(',');
        for (let e = 0; e < 4; e++) {
          const seen = r.batches.slice(e * 3, e * 3 + 3).flat().sort((a, b) => a - b);
          if (seen.length !== 10 || seen.some((v, i) => v !== i)) return `epoch ${e + 1} used points ${seen.join(',')}`;
        }
        return (sizes === '4,4,2,4,4,2,4,4,2,4,4,2' && r.used === 40) || `batch sizes ${sizes}`;
      } },
    { name: 'larger batches estimate the full gradient more closely, and the full batch exactly', input: { ...DEFAULTS, batch: 1 },
      check: (r) => {
        const gap = (batch) => run({ ...DEFAULTS, batch }, quiet).meanGap;
        const g4 = gap(4), g12 = gap(12), g24 = gap(24);
        return (r.meanGap > g4 && g4 > g12 && g12 > g24 && g24 === 0) || `mean gaps ${r.meanGap}, ${g4}, ${g12}, ${g24}`;
      } },
    { name: 'the same seed reproduces the run exactly and a different seed does not', input: { ...DEFAULTS, batch: 3 },
      check: (r) => {
        const again = run({ ...DEFAULTS, batch: 3 }, quiet), other = run({ ...DEFAULTS, batch: 3, seed: 4 }, quiet);
        return (samePath(r.path, again.path, 0) && !samePath(r.path, other.path, 1e-9)) || 'seeding is not reproducible';
      } },
    { name: 'the worked example: order B, A, C, D and the lines quoted in the text', input: { ...EXAMPLE },
      check: (r) => {
        const want = [[0, 0], [0.25, 0.25], [0.5, 0], [0.375, 0.125], [0.25, 0]];
        const order = r.batches.slice(0, 4).map((x) => x[0]).join(',');
        const gd = referenceDescent(r.points, 0.125, 0, 1)[1];
        return (order === '1,0,2,3' && samePath(r.path.slice(0, 5), want, 1e-12) && Math.abs(r.closedForm.w - 0.5) < 1e-12 && Math.abs(r.closedForm.b) < 1e-12
          && Math.abs(gd[0] - 0.125) < 1e-12 && Math.abs(gd[1]) < 1e-12) || `order ${order}, path ${JSON.stringify(r.path.slice(0, 5))}, one full step ${gd}`;
      } },
    { name: 'quiz prediction: at batch size 24 the loss never rises, while at batch size 1 it does', input: { ...DEFAULTS, batch: 24 },
      check: (r) => {
        const noisy = run({ ...DEFAULTS }, quiet);
        return (r.rises === 0 && r.losses.every((v, i) => i === 0 || v <= r.losses[i - 1]) && noisy.rises > 5) || `full batch rose ${r.rises} times, batch 1 rose ${noisy.rises} times`;
      } },
    { name: 'with no scatter in the data a fixed learning rate comes to rest on the exact line', input: { ...DEFAULTS, noise: 0, steps: 300 },
      check: (r) => (Math.abs(r.w - r.closedForm.w) < 1e-3 && Math.abs(r.b - r.closedForm.b) < 1e-3 && r.loss < 1e-5) || `ended at (${r.w}, ${r.b}), loss ${r.loss}, closed form (${r.closedForm.w}, ${r.closedForm.b}) loss ${r.closedForm.loss}` },
    { name: 'a shrinking learning rate ends closer to the least squares line than a fixed one', input: { ...DEFAULTS, decay: 0.1, steps: 300 },
      check: (r) => {
        const fixed = run({ ...DEFAULTS, steps: 300 }, quiet);
        const tail = (x) => x.losses.slice(-100).reduce((s, v) => s + v, 0) / 100 - x.closedForm.loss;
        return (tail(r) < tail(fixed) && tail(r) < 1e-3 && Math.abs(r.rates[299] - 0.2 / (1 + 0.1 * 299)) < 1e-15) || `average excess loss over the last 100 steps: decay ${tail(r)}, fixed ${tail(fixed)}`;
      } },
  ],
};
