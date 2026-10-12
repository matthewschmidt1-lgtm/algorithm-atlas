import { makeDataset, datasetOptions } from '../../js/lib/datasets.js';
import { makeRng } from '../../js/lib/rng.js';

const f3 = (v) => (Math.abs(v) < 0.0005 ? '0.000' : v.toFixed(3).replace('-', '−'));
const f2 = (v) => (Math.abs(v) < 0.005 ? '0.00' : v.toFixed(2).replace('-', '−'));
const sg = (v) => (v >= 0.0005 ? '+' : '') + f3(v);
const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const TINY = 1e-12;
const lossOf = (y, label) => -(label ? Math.log(Math.max(y, TINY)) : Math.log(Math.max(1 - y, TINY)));

// The network: 2 inputs, H tanh hidden units, 1 sigmoid output.
// p = { W1: [[w from x1, w from x2] per hidden unit], b1: [per hidden unit], W2: [per hidden unit], b2 }
function forward(p, x1, x2) {
  const H = p.b1.length, a = new Array(H), h = new Array(H);
  let z = p.b2;
  for (let j = 0; j < H; j++) {
    a[j] = p.W1[j][0] * x1 + p.W1[j][1] * x2 + p.b1[j];
    h[j] = Math.tanh(a[j]);
    z += p.W2[j] * h[j];
  }
  return { a, h, z, y: sigmoid(z) };
}

// The backward pass for one example: the chain rule applied layer by layer, output first.
function backward(p, x1, x2, label, f) {
  const H = p.b1.length;
  const dOut = f.y - label;                       // dLoss/dz at the output (sigmoid with cross-entropy)
  const gW2 = new Array(H), dHidden = new Array(H), gW1 = new Array(H), gb1 = new Array(H);
  for (let j = 0; j < H; j++) {
    gW2[j] = dOut * f.h[j];                        // dLoss/dW2[j]
    dHidden[j] = dOut * p.W2[j] * (1 - f.h[j] * f.h[j]);   // dLoss/da[j]: error sent back through W2[j] and tanh
    gW1[j] = [dHidden[j] * x1, dHidden[j] * x2];   // dLoss/dW1[j][i]
    gb1[j] = dHidden[j];
  }
  return { dOut, dHidden, gW2, gb2: dOut, gW1, gb1 };
}

function meanLoss(p, pts) {
  let s = 0;
  for (const q of pts) s += lossOf(forward(p, q.x, q.y).y, q.label);
  return s / pts.length;
}

// Full-batch gradient: forward and backward for every example, averaged.
function batchGradient(p, pts, t) {
  const H = p.b1.length, n = pts.length;
  const g = { W1: Array.from({ length: H }, () => [0, 0]), b1: new Array(H).fill(0), W2: new Array(H).fill(0), b2: 0 };
  let loss = 0, correct = 0;
  for (const q of pts) {
    const f = forward(p, q.x, q.y);
    const b = backward(p, q.x, q.y, q.label, f);
    t.count('network passes', 2);   // one forward, one backward
    loss += lossOf(f.y, q.label);
    if ((f.y >= 0.5 ? 1 : 0) === q.label) correct++;
    for (let j = 0; j < H; j++) {
      g.W1[j][0] += b.gW1[j][0] / n; g.W1[j][1] += b.gW1[j][1] / n;
      g.b1[j] += b.gb1[j] / n; g.W2[j] += b.gW2[j] / n;
    }
    g.b2 += b.gb2 / n;
  }
  return { g, loss: loss / n, correct };
}

// The slow alternative, used only to check the backward pass: nudge each weight up and down and
// see how the mean loss responds. Two forward passes per weight per example.
function numericGradient(p, pts, t) {
  const H = p.b1.length, v = flat(p), g = new Array(v.length), step = 1e-5;
  const lossAt = () => { t.count('network passes', pts.length); return meanLoss(unflat(v, H), pts); };
  for (let i = 0; i < v.length; i++) {
    const keep = v[i];
    v[i] = keep + step; const up = lossAt();
    v[i] = keep - step; const down = lossAt();
    v[i] = keep;
    g[i] = (up - down) / (2 * step);
  }
  return unflat(g, H);
}

const copyParams = (p) => ({ W1: p.W1.map((r) => r.slice()), b1: p.b1.slice(), W2: p.W2.slice(), b2: p.b2 });
const flat = (p) => [...p.W1.flat(), ...p.b1, ...p.W2, p.b2];
function unflat(v, H) {
  return { W1: Array.from({ length: H }, (_, j) => [v[2 * j], v[2 * j + 1]]), b1: v.slice(2 * H, 3 * H), W2: v.slice(3 * H, 4 * H), b2: v[4 * H] };
}
const accuracyOf = (p, pts) => pts.filter((q) => (forward(p, q.x, q.y).y >= 0.5 ? 1 : 0) === q.label).length / pts.length;

const GRID_X = 30, GRID_Y = 20;
const HEAT_TOP = 1.7;   // an output of 1 is drawn at 1/1.7 of full colour strength, so the data points stay readable

function run(input, t) {
  const data = makeDataset({ dataset: input.dataset, points: input.points, seed: input.seed });
  const pts = data.points, n = pts.length;
  const H = Math.round(input.hidden), eta = input.rate, epochs = Math.round(input.epochs);
  if (H < 1) throw new Error('The network needs at least one hidden unit.');
  const rng = makeRng(input.seed * 7919 + 17);
  const p = { W1: Array.from({ length: H }, () => [rng.float(-1, 1), rng.float(-1, 1)]), b1: new Array(H).fill(0), W2: Array.from({ length: H }, () => rng.float(-1, 1)), b2: 0 };
  const initialParams = copyParams(p);
  const losses = [meanLoss(p, pts)];
  const yRange = [0, Math.max(losses[0], 0.1) * 1.12];
  const [x0, x1] = data.x, [y0, y1] = data.y;
  const cw = (x1 - x0) / GRID_X, ch = (y1 - y0) / GRID_Y;

  /* ---- pictures ---- */
  const surface = (mark) => {
    // Shading: the network's output on a coarse grid. The heat layer scales its colours to the smallest and
    // largest value it is given, so two extra columns on each side, outside the plotted range and therefore
    // clipped away, hold fixed values that pin the scale. The same output then has the same shade in every frame.
    const nx = GRID_X + 4, values = new Float64Array(nx * GRID_Y);
    for (let j = 0; j < GRID_Y; j++) {
      const y = y0 + (j + 0.5) * ch;
      for (let i = 0; i < nx; i++) {
        const x = x0 + (Math.min(GRID_X - 1, Math.max(0, i - 2)) + 0.5) * cw;
        values[j * nx + i] = i === 0 ? 0 : i === nx - 1 ? HEAT_TOP : forward(p, x, y).y;
      }
    }
    const bx = GRID_X + 1, by = GRID_Y + 1, edge = new Float64Array(bx * by);
    for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) edge[j * bx + i] = forward(p, x0 + i * cw, y0 + j * ch).y;
    const wrong = pts.filter((q) => (forward(p, q.x, q.y).y >= 0.5 ? 1 : 0) !== q.label);
    const layers = [
      { type: 'heat', nx, ny: GRID_Y, values, x: [x0 - 2 * cw, x1 + 2 * cw], y: [y0, y1], role: 'terracotta' },
      { type: 'contour', nx: bx, ny: by, values: edge, x: [x0, x1], y: [y0, y1], role: 'ink', levels: [0.5], width: 2 },
      { type: 'points', points: pts.filter((q) => q.label === 0).map((q) => [q.x, q.y]), role: 'forest', r: 4 },
      { type: 'points', points: pts.filter((q) => q.label === 1).map((q) => [q.x, q.y]), role: 'terracotta', r: 4 },
      { type: 'points', points: wrong.map((q) => [q.x, q.y]), role: 'alert', r: 7.5, hollow: true },
    ];
    if (mark) layers.push({ type: 'points', points: [{ x: mark.x, y: mark.y, label: 'example' }], role: 'ink', r: 10, hollow: true });
    return { kind: 'scene', title: 'Data and the network\'s current output', x: [x0, x1], y: [y0, y1], aspect: 0.52, axes: { xLabel: 'x₁', yLabel: 'x₂' }, layers,
      legend: [{ label: 'class 0', role: 'forest' }, { label: 'class 1, and shading where the output is near 1', role: 'terracotta' }, { label: 'boundary: output = 0.5', role: 'ink' }, { label: 'on the wrong side', role: 'alert' }] };
  };
  const chart = () => ({ kind: 'scene', title: 'Loss after each epoch', x: [0, Math.max(10, epochs)], y: yRange, aspect: 0.2, axes: { xLabel: 'epoch' },
    layers: [{ type: 'line', points: losses.map((v, i) => [i, v]), role: 'forest', width: 2 }] });

  const hy = (j) => (H === 1 ? 0.5 : 0.06 + (0.88 * j) / (H - 1));
  const hName = (j) => `h${SUB[j + 1]}`;
  // The network drawn as a graph. show: { sub: {id: text}, role: {id: role}, edges: Set of 'x1>h0' / 'h0>y' to highlight, plain: true to leave their weights off }
  const network = (title, show) => {
    const nodes = [
      { id: 'x1', label: 'x₁', x: 0.07, y: 0.3 }, { id: 'x2', label: 'x₂', x: 0.07, y: 0.7 },
      ...Array.from({ length: H }, (_, j) => ({ id: `h${j}`, label: hName(j), x: 0.5, y: hy(j) })),
      { id: 'y', label: 'ŷ', x: 0.93, y: 0.5 },
    ].map((nd) => ({ ...nd, sub: show.sub[nd.id], role: show.role[nd.id] || 'default' }));
    const edges = [];
    for (let j = 0; j < H; j++) {
      for (const i of [0, 1]) { const on = show.edges.has(`x${i + 1}>h${j}`); edges.push({ u: `x${i + 1}`, v: `h${j}`, role: on ? 'active' : 'dim', ...(on && !show.plain ? { w: f2(p.W1[j][i]) } : {}) }); }
      const on = show.edges.has(`h${j}>y`);
      edges.push({ u: `h${j}`, v: 'y', role: on ? 'active' : 'dim', ...(on && !show.plain ? { w: f2(p.W2[j]) } : {}) });
    }
    return { kind: 'graph', title, directed: true, aspect: 0.24 + 0.05 * H, nodes, edges,
      legend: [{ label: show.plain ? 'connections whose gradients are being computed' : 'being computed, and the connections it uses (with their weights)', role: 'current' }, { label: 'value known', role: 'done' }, { label: 'error signal known', role: 'alert' }] };
  };

  /* ---- frame 0: the starting point ---- */
  const start = batchGradient(p, pts, { count() {} });
  const initialGradient = flat(start.g);
  let k = 0;
  for (let i = 1; i < n; i++) if (lossOf(forward(p, pts[i].x, pts[i].y).y, pts[i].label) > lossOf(forward(p, pts[k].x, pts[k].y).y, pts[k].label)) k = i;
  const ex = pts[k];
  t.frame(() => ({ line: 1, note: `${n} points in two classes. The network has 2 inputs, ${H} hidden unit${H === 1 ? '' : 's'} and 1 output, and its ${4 * H + 1} weights start as random numbers. The shading shows its output for every position: so far it has nothing to do with the data. It puts ${start.correct} of ${n} points on the correct side and its loss is ${f3(losses[0])}. The ringed point is the one it gets most wrong.`,
    views: [surface(ex), chart()], vars: { epoch: 0, loss: f3(losses[0]), accuracy: `${start.correct}/${n}` } }));

  /* ---- one example, forward then backward ---- */
  const f = forward(p, ex.x, ex.y);
  const b = backward(p, ex.x, ex.y, ex.label, f);
  const exLoss = lossOf(f.y, ex.label);
  const walk = { hidden: 0, output: false, loss: false, dOut: false, gW2: false, dHidden: 0, gW1: false };
  const sheet = () => {
    const q = { t: '?', role: 'dim' };
    const rows = [
      { label: 'Example', cells: [{ t: f3(ex.x), sub: 'x₁' }, { t: f3(ex.y), sub: 'x₂' }, { t: ex.label, sub: 'true label' }] },
      { label: 'Forward', cells: [...f.h.map((v, j) => (j < walk.hidden ? { t: f3(v), sub: hName(j), role: 'done' } : { ...q, sub: hName(j) })),
        walk.output ? { t: f3(f.y), sub: 'ŷ', role: 'done' } : { ...q, sub: 'ŷ' }, walk.loss ? { t: f3(exLoss), sub: 'loss', role: 'done' } : { ...q, sub: 'loss' }] },
      { label: 'Error signals', cells: [walk.dOut ? { t: sg(b.dOut), sub: 'at ŷ', role: 'alert' } : { ...q, sub: 'at ŷ' },
        ...b.dHidden.map((v, j) => (j < walk.dHidden ? { t: sg(v), sub: `at ${hName(j)}`, role: 'alert' } : { ...q, sub: `at ${hName(j)}` }))] },
      { label: 'Gradients', cells: [
        ...b.gW2.map((v, j) => (walk.gW2 ? { t: sg(v), sub: `${hName(j)} to ŷ`, role: 'alert' } : { ...q, sub: `${hName(j)} to ŷ` })),
        ...b.gW1.flatMap((g, j) => g.map((v, i) => (walk.gW1 ? { t: sg(v), sub: `x${SUB[i + 1]} to ${hName(j)}`, role: 'alert' } : { ...q, sub: `x${SUB[i + 1]} to ${hName(j)}` })))] },
    ];
    return { kind: 'rows', title: 'Numbers for this one example', rows };
  };
  const state = (current, edges, plain) => {
    const sub = { x1: f3(ex.x), x2: f3(ex.y) }, role = { x1: 'done', x2: 'done' };
    for (let j = 0; j < H; j++) {
      if (j < walk.dHidden) { sub[`h${j}`] = `δ ${sg(b.dHidden[j])}`; role[`h${j}`] = 'alert'; }
      else if (j < walk.hidden) { sub[`h${j}`] = f3(f.h[j]); role[`h${j}`] = 'done'; }
    }
    if (walk.dOut) { sub.y = `δ ${sg(b.dOut)}`; role.y = 'alert'; } else if (walk.output) { sub.y = f3(f.y); role.y = 'done'; }
    for (const id of current) role[id] = 'current';
    return { sub, role, edges: new Set(edges), plain };
  };
  const step = (line, title, note, current, edges, plain = false) => t.frame(() => ({ line, note, views: [network(title, state(current, edges, plain)), sheet()],
    vars: { 'x₁': f3(ex.x), 'x₂': f3(ex.y), label: ex.label, ...(walk.output ? { 'ŷ': f3(f.y) } : {}), ...(walk.loss ? { loss: f3(exLoss) } : {}) } }));
  const FWD = 'Forward pass: from the inputs to the output', BWD = 'Backward pass: from the output back to the weights';

  walk.hidden = 1;
  step(4, FWD, `**Forward pass.** Follow the ringed example, (${f3(ex.x)}, ${f3(ex.y)}) with true label ${ex.label}, through the network. Hidden unit ${hName(0)} multiplies each input by the weight on its connection and adds the results: (${f2(p.W1[0][0])} × ${f3(ex.x)}) + (${f2(p.W1[0][1])} × ${f3(ex.y)}) = ${f3(f.a[0])}. (A bias is also added. Every bias starts at 0.) It then squashes that sum with the tanh function into a number between −1 and 1: ${hName(0)} = **${f3(f.h[0])}**.`,
    ['h0'], ['x1>h0', 'x2>h0']);
  if (H > 1) {
    walk.hidden = H;
    step(4, FWD, `The other hidden unit${H > 2 ? 's do' : ' does'} the same with ${H > 2 ? 'their' : 'its'} own weights: ${f.h.slice(1).map((v, j) => `${hName(j + 1)} = ${f3(v)}`).join(', ')}. These numbers are called activations.`,
      Array.from({ length: H - 1 }, (_, j) => `h${j + 1}`), []);
  }
  walk.output = true;
  step(5, FWD, `The output unit takes a weighted sum of the hidden activations, ${f.h.map((v, j) => `(${f2(p.W2[j])} × ${f3(v)})`).join(' + ')} = ${f3(f.z)}, and squashes it with the sigmoid function into a number between 0 and 1: ŷ = **${f3(f.y)}**. Read it as the network's estimate of the chance that this point is class 1.`,
    ['y'], Array.from({ length: H }, (_, j) => `h${j}>y`));
  walk.loss = true;
  step(5, FWD, `The true label is ${ex.label}, and the network gave ${ex.label ? 'class 1' : 'class 0'} a chance of only ${f3(ex.label ? f.y : 1 - f.y)}. The loss measures how bad that is: −log(${f3(ex.label ? f.y : 1 - f.y)}) = **${f3(exLoss)}**. A perfect answer would have loss 0. The forward pass is finished. Every number it produced is kept, because the backward pass needs them.`,
    [], []);
  walk.dOut = true;
  step(6, BWD, `**Backward pass.** Now ask of every weight: if it changed a little, how would the loss change? Start at the output. The error signal there is the output minus the true label: ${f3(f.y)} − ${ex.label} = **${sg(b.dOut)}**. It is ${b.dOut > 0 ? 'positive, so the loss would fall if the sum feeding the output went down' : 'negative, so the loss would fall if the sum feeding the output went up'}.`,
    ['y'], []);
  walk.gW2 = true;
  step([6, 8], BWD, `Each weight into the output gets a gradient: the error signal at its far end times the activation at its near end. For the weight from ${hName(0)}: ${sg(b.dOut)} × ${f3(f.h[0])} = **${sg(b.gW2[0])}**. A weight whose hidden unit was close to 0 gets a small gradient, because changing it would hardly have changed the output.`,
    ['y'], Array.from({ length: H }, (_, j) => `h${j}>y`));
  walk.dHidden = 1;
  step(7, BWD, `Send the error signal back to ${hName(0)}. This is the chain rule: multiply by each thing that stood between ${hName(0)} and the output. First the weight it travelled through, ${f2(p.W2[0])}. Then the slope of tanh at this unit, which is 1 − ${hName(0)}² = ${f3(1 - f.h[0] * f.h[0])}. The error signal at ${hName(0)} is ${sg(b.dOut)} × ${f2(p.W2[0])} × ${f3(1 - f.h[0] * f.h[0])} = **${sg(b.dHidden[0])}**.`,
    ['h0'], ['h0>y']);
  if (H > 1) {
    walk.dHidden = H;
    step(7, BWD, `The same rule gives the error signal at the other hidden unit${H > 2 ? 's' : ''}: ${b.dHidden.slice(1).map((v, j) => `${sg(v)} at ${hName(j + 1)}`).join(', ')}. No new forward pass was needed. Each signal reuses the one already computed at the output.`,
      Array.from({ length: H - 1 }, (_, j) => `h${j + 1}`), Array.from({ length: H - 1 }, (_, j) => `h${j + 1}>y`));
  }
  walk.gW1 = true;
  step(8, BWD, `The weights from the inputs follow the same pattern as before: error signal at the far end times value at the near end. For the weight from x₁ to ${hName(0)}: ${sg(b.dHidden[0])} × ${f3(ex.x)} = **${sg(b.gW1[0][0])}**. Every weight now has a gradient for this example, from one forward pass and one backward pass.`,
    [], Array.from({ length: H }, (_, j) => [`x1>h${j}`, `x2>h${j}`]).flat(), true);

  /* ---- training: full-batch gradient descent ---- */
  const stride = Math.max(1, Math.ceil((epochs - 10) / 110));
  let correct = start.correct;
  for (let e = 1; e <= epochs; e++) {
    const g = input.gradient === 'numeric' ? numericGradient(p, pts, t) : batchGradient(p, pts, t).g;
    for (let j = 0; j < H; j++) {
      p.W1[j][0] -= eta * g.W1[j][0]; p.W1[j][1] -= eta * g.W1[j][1];
      p.b1[j] -= eta * g.b1[j]; p.W2[j] -= eta * g.W2[j];
    }
    p.b2 -= eta * g.b2;
    t.count('weight updates');
    const loss = meanLoss(p, pts);
    losses.push(loss);
    if (Number.isFinite(loss) && loss * 1.12 > yRange[1]) yRange[1] = loss * 1.12;
    if (e <= 10 || e % stride === 0 || e === epochs) {
      const prev = losses[e - 1];
      correct = Math.round(accuracyOf(p, pts) * n);
      const c = correct;
      t.frame(() => ({ line: [3, 9], note: e === 1
        ? `That was one example. An **epoch** repeats both passes for all ${n} examples and averages the gradients. Then every weight takes a small step against its average gradient: new weight = old weight − ${f3(eta)} × gradient. After epoch 1 the loss has gone from ${f3(prev)} to **${f3(loss)}**, and ${c} of ${n} points are on the correct side.`
        : `Epoch ${e}: forward and backward through all ${n} examples, then one update of all ${4 * H + 1} weights. The loss ${loss < prev ? 'fell' : loss > prev ? 'rose' : 'stayed'} from ${f3(prev)} to **${f3(loss)}**${loss > prev ? ', a sign that the learning rate is too large for this stage' : ''}. ${c} of ${n} points are on the correct side of the boundary.`,
        views: [surface(null), chart()], vars: { epoch: e, loss: f3(loss), accuracy: `${c}/${n}` } }));
    }
  }
  const finalLoss = losses[epochs];
  const accuracy = accuracyOf(p, pts);
  t.frame(() => ({ line: 10, note: `Training stopped after ${epochs} epochs. The loss went from ${f3(losses[0])} to **${f3(finalLoss)}** and the network puts ${Math.round(accuracy * n)} of ${n} points on the correct side. ${accuracy === 1 ? 'Nothing told it what shape the boundary should have. The shape came from many small weight changes, each one pointed out by the backward pass.' : 'It has not separated every point. Try more hidden units, more epochs or a different learning rate.'}`,
    views: [surface(null), chart()], vars: { epochs, loss: f3(finalLoss), accuracy: `${Math.round(accuracy * n)}/${n}` } }));

  return { accuracy, loss: finalLoss, initialLoss: losses[0], losses, epochs, hidden: H, weights: 4 * H + 1,
    params: copyParams(p), initialParams, initialGradient, points: pts,
    example: { x1: ex.x, x2: ex.y, label: ex.label, h: f.h, output: f.y, loss: exLoss, dOut: b.dOut, dHidden: b.dHidden, gW2: b.gW2, gW1: b.gW1 } };
}

const DEFAULTS = { dataset: 'xor', points: 40, hidden: 4, rate: 1, epochs: 200, seed: 7 };
const QUIET = { count() {}, frame() {} };

export default {
  meta: {
    id: 'backpropagation',
    name: 'Backpropagation',
    aliases: ['backprop', 'backward propagation of errors', 'reverse-mode differentiation', 'error backpropagation'],
    kind: 'algorithm',
    discipline: 'deep-learning',
    alsoIn: [
      { id: 'mathematics', why: 'It is the chain rule of calculus, organized so that every intermediate result is computed once and reused.' },
      { id: 'computer-vision', why: 'The networks that classify, detect and generate images are trained with gradients computed by backpropagation.' },
      { id: 'nlp', why: 'Language models are trained the same way: a forward pass to predict, a backward pass to assign blame to every weight.' },
    ],
    subfield: 'Training neural networks',
    family: 'Gradient computation',
    lab: 'neural-networks',
    summary: 'Computes how the loss of a neural network changes with every weight, by one forward pass and one backward pass that applies the chain rule layer by layer.',
    difficulty: 'advanced',
    order: 650,
    paradigms: ['gradient-based', 'dynamic-programming'],
    randomized: false,
    approximate: false,
    time: { best: 'O(W) per example', average: 'O(W) per example', worst: 'O(W) per example', class: 'linear' },
    space: { worst: 'O(W) plus one stored activation per unit', class: 'linear' },
    tags: {
      problems: ['make a neural network learn', 'train a neural network', 'work out which weight caused an error', 'compute the gradient of a loss', 'credit assignment'],
      techniques: ['chain rule', 'forward pass', 'backward pass', 'error signal', 'reverse-mode differentiation'],
      applications: ['machine learning', 'image processing', 'natural language', 'scientific computing'],
    },
    prerequisites: ['gradient-descent', 'logistic-regression', 'perceptron', 'concept:chain-rule', 'concept:neural-network', 'concept:activation-function', 'concept:loss-function', 'concept:gradient'],
  },

  bigIdea: {
    simple: "Backpropagation is how a neural network finds out which of its settings to blame for a mistake. A neural network is a chain of simple calculations with many adjustable numbers, called weights. It makes a guess, and the guess is compared with the right answer. Usually the guess is somewhat wrong. The hard question is which weights to change, and by how much, when there may be millions of them. Think of a factory line where each worker passes a part to the next. A faulty product comes out at the end. The inspector tells the last worker what was wrong. That worker works out how much was their own doing and how much came from the part they were handed, and passes that message back. So it goes, worker by worker, to the start of the line. Backpropagation does this with numbers. It runs the network forwards to get the guess, then sends the error backwards, and every weight learns which way to move. The network nudges each weight a little and tries again.",
    what: 'Backpropagation computes the gradient of a neural network\'s loss with respect to every weight. It runs the network forwards, keeping every intermediate value, then works backwards from the output: each layer receives an error signal from the layer after it, uses it to get the gradients of its own weights, and passes a transformed error signal to the layer before it.',
    why: 'Gradient descent needs to know how the loss changes with each weight. Measuring that by nudging the weights one at a time would take one run of the network per weight, which is hopeless for a network with millions of them. Backpropagation gets all the gradients at roughly the cost of two runs. The paper by Rumelhart, Hinton and Williams in 1986 showed that networks with hidden layers trained this way learn useful internal representations, and that made the method widely known.',
    when: 'Use it whenever a model is built from differentiable steps and you want the gradient of a single number, the loss, with respect to many parameters. That covers nearly all of deep learning. It does not apply when a step has no derivative, such as a hard yes-or-no decision, without some workaround. For a single layer it reduces to the gradient used in [logistic regression](#/algorithm/logistic-regression).',
    interesting: 'Backpropagation is not a learning rule and does not change any weight. It only computes derivatives. The learning is done by [gradient descent](#/algorithm/gradient-descent) or one of its variants, which uses those derivatives. Outside machine learning the same calculation is known as reverse-mode automatic differentiation, and it works on any program made of differentiable operations.',
    where: 'Every deep learning framework implements it, so that a user writes only the forward calculation. Image classifiers, speech recognizers, language models and diffusion models are all trained with gradients obtained this way.',
    analogy: {
      title: 'Tracing a fault back along a production line',
      text: 'A product passes through a line of workers, each of whom does something to it and hands it on. At the end an inspector finds it is faulty and says by how much. The last worker considers how their own setting affected the product, adjusts their idea of what to do next time, and tells the worker before them how much of the fault was already in the part when it arrived. That worker does the same. The message travels back up the line, changing at each station, until everyone knows how their own setting contributed.',
      limits: "Workers use judgment. Backpropagation uses one rule of calculus, applied mechanically, and its messages are exact rates of change that hold only for very small adjustments. In a network each unit also feeds many others, so blame comes back along many paths at once and has to be added up. And the message alone changes nothing. Deciding how far to move each setting is a separate step, done by gradient descent.",
    },
  },

  example: {
    setup: "Take the smallest possible network: one input and two weights in a row. The input is 2. The first weight is 3, so the middle value is 2 × 3 = 6. The second weight is 0.5, so the output is 6 × 0.5 = 3. The right answer was 1. The loss is half the square of the miss. For each weight we want its gradient: the number that says how fast the loss grows when that weight is raised. Real networks also bend each value with a squashing function. That adds one more multiplication to each step back, and is left out here to keep the numbers easy.",
    steps: [
      "Forward. Middle value: 2 × 3 = 6. Output: 6 × 0.5 = 3. Keep both numbers.",
      "Error at the output. Output minus target is 3 − 1 = 2. The output is too high by 2. This is the first error signal.",
      "Gradient of the second weight. The output is the middle value times this weight, so the gradient is the error signal times the middle value: 2 × 6 = 12.",
      "Send the error back to the middle value. It reached the output through the weight 0.5, so its error signal is 2 × 0.5 = 1.",
      "Gradient of the first weight. The middle value is the input times this weight, so the gradient is the error signal times the input: 1 × 2 = 2.",
      "Update with a learning rate of 0.01. The second weight becomes 0.5 − 0.01 × 12 = 0.38. The first becomes 3 − 0.01 × 2 = 2.98.",
    ],
    result: "With the new weights the output is 2 × 2.98 × 0.38 = 2.2648, closer to the target 1 than 3 was. Notice that step 5 reused the answer of step 4 instead of starting again from the output. In a large network that reuse is everything: each error signal is computed once and shared by all the weights behind it.",
  },

  terms: [
    { term: "Neural network", meaning: "A calculation built from layers of simple units, each of which adds up its weighted inputs and passes the sum through a fixed function." },
    { term: "Weight", meaning: "One adjustable number in the network. Each connection between two units has one. Learning means changing the weights." },
    { term: "Activation", meaning: "The number a unit produces for a particular input. Also the name of the squashing function it applies, such as tanh." },
    { term: "Loss", meaning: "A single number that measures how wrong the network's output is. Zero means a perfect answer." },
    { term: "Forward pass", meaning: "Running the network from its inputs to its output and keeping every value computed on the way." },
    { term: "Gradient", meaning: "For each weight, the rate at which the loss would grow if that weight were increased slightly. A negative gradient means increasing the weight helps." },
    { term: "Error signal", meaning: "The rate at which the loss would grow if the summed input of one unit were increased slightly. Often written with the Greek letter delta." },
    { term: "Backward pass", meaning: "Working from the output back to the inputs, computing the error signal of each unit from those of the units it feeds." },
    { term: "Chain rule", meaning: "A rule of calculus: when one quantity affects a second and the second affects a third, the rates of change multiply." },
    { term: "Epoch", meaning: "One pass over the whole training set." },
  ],

  takeaway: "Run the network forwards to see how wrong it is, then pass the error backwards so every weight learns which way to move.",

  viz: {
    describe: 'Two kinds of picture. During training, a plot of the data points, class 0 in dark green and class 1 in terracotta, over a shading that is darker where the network\'s output is closer to 1. A dark curve marks where the output equals 0.5, and points on the wrong side of it are ringed. Below it, a chart of the loss after each epoch. In the early frames the plot is replaced by a diagram of the network for a single example: two inputs on the left, the hidden units in the middle and the output on the right. The unit being computed is terracotta, units whose value is known are green, and units whose error signal is known are brick red, with the numbers underneath. A table below lists the example, its forward values, its error signals and its gradients as they are filled in.',
    inputs: [
      { id: 'dataset', type: 'select', label: 'Dataset', options: datasetOptions, default: DEFAULTS.dataset },
      { id: 'points', type: 'range', label: 'Number of points', min: 8, max: 80, step: 4, default: DEFAULTS.points },
      { id: 'hidden', type: 'range', label: 'Hidden units', min: 1, max: 6, step: 1, default: DEFAULTS.hidden },
      { id: 'rate', type: 'range', scale: 'log', label: 'Learning rate (η)', min: 0.01, max: 5, default: DEFAULTS.rate,
        help: 'How far each weight moves against its gradient in every epoch. Logarithmic slider.' },
      { id: 'epochs', type: 'range', label: 'Epochs', min: 20, max: 1000, step: 20, default: DEFAULTS.epochs },
      { id: 'seed', type: 'seed', label: 'Random seed', default: DEFAULTS.seed },
    ],
    presets: [
      { label: 'XOR with four hidden units', values: { ...DEFAULTS } },
      { label: 'One hidden unit: not enough', values: { ...DEFAULTS, hidden: 1 } },
      { label: 'Two hidden units: enough, with luck', values: { ...DEFAULTS, hidden: 2, seed: 1 } },
      { label: 'Two moons', values: { ...DEFAULTS, dataset: 'moons', hidden: 6, rate: 2, epochs: 400 } },
      { label: 'A separable set', values: { ...DEFAULTS, dataset: 'separable', hidden: 2, epochs: 60 } },
      { label: 'Learning rate too small', values: { ...DEFAULTS, rate: 0.05 } },
    ],
    tryThis: [
      'Step through the first ten frames slowly. In the forward frames, check one multiplication yourself. In the backward frames, notice that every error signal is built from one that is already known, and that no weight is changed until the passes are finished.',
      'Load "One hidden unit: not enough". A single hidden unit can only draw a straight boundary, and no straight line separates the XOR corners. The loss stops falling at about 0.5 and a quarter of the points stay on the wrong side. Backpropagation is working correctly here. The network is too small.',
      'Load "Two hidden units: enough, with luck". Two units can solve XOR, and with this seed they do not: after 200 epochs only 25 of 40 points are right. Press Randomize a few times. Over the seeds 1 to 30, two hidden units reach all 40 points 20 times and four hidden units all 30 times. The gradients are equally exact in every one of those runs. Where gradient descent ends up depends on where it starts.',
      'Load "Learning rate too small". The gradients are exactly the same as in the default run at the start, but each step is twenty times shorter, and 200 epochs are not enough. The loss curve is still falling when training stops.',
      'On the default run, raise the learning rate to 5. The loss jumps upwards a few times in the early epochs. The gradient only says which way is downhill for a small step, and a step this long can overshoot.',
    ],
    run,
    report: (r, c) => `Accuracy ${Math.round(r.accuracy * r.points.length)} of ${r.points.length} points (${(r.accuracy * 100).toFixed(0)}%).\nLoss ${f3(r.initialLoss)} at the start, ${f3(r.loss)} after ${r.epochs} epochs.\n${r.weights} weights, ${c['weight updates'] || 0} updates, ${(c['network passes'] || 0).toLocaleString('en-US')} passes through the network (forward and backward).`,
    experiment: {
      title: 'Passes through the network to get one gradient',
      note: 'Each point is a real run of one epoch on 40 XOR points. Backpropagation makes one forward and one backward pass per example, whatever the size of the network. The alternative shown, finite differences, nudges each weight up and down and reruns the forward pass for every example each time. A single pass also gets more expensive as the network grows, equally for both methods, so the true gap is wider than the chart shows.',
      metric: 'network passes',
      metricLabel: 'Passes through the network',
      sizeLabel: 'Hidden units (the network has 4 × hidden units + 1 weights)',
      sizes: [1, 2, 4, 8, 16, 32],
      variants: [
        { id: 'backprop', label: 'Backpropagation' },
        { id: 'numeric', label: 'Finite differences' },
      ],
      input: (hidden, variant, seed) => ({ ...DEFAULTS, hidden, epochs: 1, seed, gradient: variant }),
      theory: [
        { label: '2 × examples', fn: () => 80, variant: 'backprop' },
        { label: '2 × examples × weights', fn: (h) => 80 * (4 * h + 1), variant: 'numeric' },
      ],
    },
  },

  logic: {
    intuition: 'The loss depends on a first-layer weight only through a chain of effects: the weight changes a hidden unit\'s sum, which changes its activation, which changes the output sum, which changes the output, which changes the loss. The chain rule says the overall rate of change is the product of the rates along the chain. Many weights share most of their chain. All the first-layer weights into one hidden unit share everything from that unit onwards. Backpropagation computes each shared stretch once, starting from the loss end, and hands the result back as an error signal.',
    steps: [
      'Forward pass. For one example, compute each hidden unit\'s weighted sum and its tanh, then the output unit\'s weighted sum and its sigmoid. Keep all of these values.',
      'Compute the error signal at the output. With a sigmoid output and cross-entropy loss it is simply the output minus the true label.',
      'The gradient of each output weight is that error signal times the hidden activation the weight multiplies.',
      'Pass the error signal back to each hidden unit: multiply it by the weight connecting that unit to the output, and by the slope of tanh at that unit, which is 1 − h².',
      'The gradient of each first-layer weight is the hidden unit\'s error signal times the input the weight multiplies. A bias has the gradient of a weight whose input is always 1.',
      'Repeat for every example and average the gradients. Then let gradient descent move each weight a step against its gradient. Repeat for many epochs.',
    ],
    pseudocode: [
      'train(data, η, epochs):',
      '  set every weight to a small random number',
      '  repeat epochs times:',
      '    for each example (x, label):',
      '      h ← tanh(W₁·x + b₁)',
      '      ŷ ← sigmoid(w₂·h + b₂)',
      '      δ_out ← ŷ − label',
      '      δ_hid ← δ_out · w₂ · (1 − h²)',
      '      grad w₂ += δ_out·h;  grad W₁ += δ_hid·x',
      '    each weight ← weight − η · (average grad)',
      '  return the weights',
    ],
    decisions: [
      { title: 'Why work backwards?', text: 'There is one loss and many weights. Starting from the loss, a single sweep reaches every weight. Starting from the weights would need a separate sweep for each one. For a function with many inputs and one output, the backward order is the efficient one.' },
      { title: 'Which activation function?', text: 'The backward pass multiplies by the slope of each activation, so the function must have one. This page uses tanh, whose slope 1 − h² is easy to compute from the stored activation. Where a unit is saturated, with h near 1 or −1, the slope is near 0 and almost no error passes through.' },
      { title: 'Which loss?', text: 'For a yes-or-no output, a sigmoid with the cross-entropy loss makes the output error signal exactly ŷ − label. With a squared-error loss the signal would carry an extra factor ŷ(1 − ŷ), which is tiny when the output is confidently wrong, and learning would stall.' },
      { title: 'How to start the weights?', text: 'Randomly. If all hidden units began with identical weights they would receive identical gradients and stay identical for ever. Random starting values break that symmetry.' },
      { title: 'How many examples per update?', text: 'This page uses all of them, which is full-batch gradient descent. Large-scale training uses a small random batch per update, which is stochastic gradient descent. The backward pass is the same.' },
    ],
    invariants: [
      'After the backward pass, each stored gradient equals the derivative of the loss with respect to that weight at the current weights. This is what the finite-difference test checks.',
      'The error signal of a unit depends only on the error signals of the units it feeds, the weights on those connections, and its own stored activation.',
      'No weight changes during the forward or backward pass. The update happens only after all gradients are known.',
    ],
    edgeCases: [
      'A saturated unit, with activation very close to 1 or −1, has slope near 0 and blocks the error signal. Its incoming weights hardly learn.',
      'All weights equal at the start: every hidden unit computes the same thing and gets the same gradient, so the network behaves as if it had one hidden unit.',
      'An output of exactly 0 or 1 makes the logarithm in the loss infinite. Implementations clamp the output slightly away from 0 and 1 when computing the loss.',
      'A learning rate that is too large makes the loss rise or oscillate. The gradient is still correct. The step taken with it is too long.',
      'Too few hidden units: the gradients are exact, but no setting of the weights fits the data, as with one hidden unit on XOR.',
      'A zero gradient does not mean the best weights have been found. Training can settle at a point that is only locally best, as two hidden units sometimes do on XOR.',
    ],
    correctness: 'The backward pass is the chain rule and nothing else, so the gradients it returns are exact up to rounding. For the output, $\\partial L/\\partial z = \\hat y - y$. For a hidden unit with sum $a_j$ and activation $h_j = \\tanh(a_j)$, the loss depends on $a_j$ only through $z$, so $\\partial L/\\partial a_j = (\\partial L/\\partial z)\\, w_{2,j}\\, (1 - h_j^2)$. Each weight\'s gradient is the error signal of the unit it feeds times the value it multiplies. This can be checked numerically: nudge one weight by a tiny amount, rerun the forward pass, and compare the change in loss with the computed gradient. A test on this page does that for every weight. What backpropagation does not guarantee is that training succeeds. That depends on the network, the data, the starting weights and the optimizer.',
    mistakes: [
      'Leaving out the slope of the activation function when passing the error back.',
      'Updating a layer\'s weights before using them to pass the error to the layer below. The backward pass must use the weights that the forward pass used.',
      'Overwriting gradients instead of adding them up over the examples in a batch, or forgetting to reset them to zero before the next batch.',
      'Mixing up the two indices of a weight matrix, so that the error is sent back through the wrong connections.',
      'Trusting a hand-written backward pass without comparing it against finite differences.',
    ],
  },

  code: {
    sample: {
      input: 'A network with 2 inputs, 2 tanh hidden units and 1 sigmoid output learns XOR from its four cases, starting from fixed weights, with a learning rate of 1 for 2,000 epochs. The printed loss is the average over the four cases during that epoch.',
      expected: 'epoch    1: loss 0.7233\nepoch   10: loss 0.6987\nepoch  100: loss 0.5481\nepoch  500: loss 0.0086\nepoch 1000: loss 0.0036\nepoch 2000: loss 0.0017\n0 xor 0: output 0.0012, target 0\n0 xor 1: output 0.9978, target 1\n1 xor 0: output 0.9978, target 1\n1 xor 1: output 0.0011, target 0',
    },
    python: {
      source: `import math

DATA = [((0.0, 0.0), 0.0), ((0.0, 1.0), 1.0), ((1.0, 0.0), 1.0), ((1.0, 1.0), 0.0)]
w1 = [[0.5, -0.4], [0.3, 0.8]]  # w1[j][i]: from input i to hidden unit j
b1 = [0.1, -0.2]
w2 = [0.6, -0.7]                # from hidden unit j to the output
b2 = [0.05]
RATE = 1.0


def forward(x):
    h = [math.tanh(w1[j][0] * x[0] + w1[j][1] * x[1] + b1[j]) for j in range(2)]
    y = 1 / (1 + math.exp(-(w2[0] * h[0] + w2[1] * h[1] + b2[0])))
    return h, y


def train_one_epoch():
    """Forward and backward through all four examples, then one update."""
    g_w1 = [[0.0, 0.0], [0.0, 0.0]]
    g_b1 = [0.0, 0.0]
    g_w2 = [0.0, 0.0]
    g_b2 = 0.0
    loss = 0.0
    for x, label in DATA:
        h, y = forward(x)
        loss -= label * math.log(y) + (1 - label) * math.log(1 - y)
        d_out = y - label
        g_b2 += d_out
        for j in range(2):
            d_hidden = d_out * w2[j] * (1 - h[j] * h[j])
            g_w2[j] += d_out * h[j]
            g_b1[j] += d_hidden
            for i in range(2):
                g_w1[j][i] += d_hidden * x[i]
    n = len(DATA)
    b2[0] -= RATE * g_b2 / n
    for j in range(2):
        w2[j] -= RATE * g_w2[j] / n
        b1[j] -= RATE * g_b1[j] / n
        for i in range(2):
            w1[j][i] -= RATE * g_w1[j][i] / n
    return loss / n


for epoch in range(1, 2001):
    loss = train_one_epoch()
    if epoch in (1, 10, 100, 500, 1000, 2000):
        print(f"epoch {epoch:4d}: loss {loss:.4f}")
for x, label in DATA:
    print(f"{x[0]:.0f} xor {x[1]:.0f}: output {forward(x)[1]:.4f}, target {label:.0f}")`,
      notes: [
        { line: 12, text: 'The forward pass. Each hidden unit takes a weighted sum of the inputs and applies tanh. The output takes a weighted sum of the hidden values and applies the sigmoid.' },
        { line: 27, text: 'The error signal at the output. For a sigmoid output with cross-entropy loss it is simply the output minus the label.' },
        { line: 30, text: 'The chain rule. The error reaches hidden unit j through the weight `w2[j]` and through tanh, whose slope is 1 − h².' },
        { line: 31, text: 'Gradient of a weight: the error signal at the unit it feeds, times the value it multiplies. The same pattern appears three lines below for the first layer.' },
        { line: 36, text: 'Only now, after every gradient has been computed with the old weights, are the weights changed. This is the gradient descent step.' },
      ],
    },
    javascript: {
      source: `const DATA = [[[0, 0], 0], [[0, 1], 1], [[1, 0], 1], [[1, 1], 0]];
const w1 = [[0.5, -0.4], [0.3, 0.8]];  // w1[j][i]: from input i to hidden unit j
const b1 = [0.1, -0.2];
const w2 = [0.6, -0.7];                // from hidden unit j to the output
const b2 = [0.05];
const RATE = 1.0;

function forward(x) {
  const h = [0, 1].map((j) => Math.tanh(w1[j][0] * x[0] + w1[j][1] * x[1] + b1[j]));
  const y = 1 / (1 + Math.exp(-(w2[0] * h[0] + w2[1] * h[1] + b2[0])));
  return [h, y];
}

// Forward and backward through all four examples, then one update.
function trainOneEpoch() {
  const gW1 = [[0, 0], [0, 0]];
  const gB1 = [0, 0];
  const gW2 = [0, 0];
  let gB2 = 0;
  let loss = 0;
  for (const [x, label] of DATA) {
    const [h, y] = forward(x);
    loss -= label * Math.log(y) + (1 - label) * Math.log(1 - y);
    const dOut = y - label;
    gB2 += dOut;
    for (let j = 0; j < 2; j++) {
      const dHidden = dOut * w2[j] * (1 - h[j] * h[j]);
      gW2[j] += dOut * h[j];
      gB1[j] += dHidden;
      for (let i = 0; i < 2; i++) gW1[j][i] += dHidden * x[i];
    }
  }
  const n = DATA.length;
  b2[0] -= RATE * gB2 / n;
  for (let j = 0; j < 2; j++) {
    w2[j] -= RATE * gW2[j] / n;
    b1[j] -= RATE * gB1[j] / n;
    for (let i = 0; i < 2; i++) w1[j][i] -= RATE * gW1[j][i] / n;
  }
  return loss / n;
}

for (let epoch = 1; epoch <= 2000; epoch++) {
  const loss = trainOneEpoch();
  if ([1, 10, 100, 500, 1000, 2000].includes(epoch)) {
    console.log("epoch " + String(epoch).padStart(4, " ") + ": loss " + loss.toFixed(4));
  }
}
for (const [x, label] of DATA) {
  console.log(x[0] + " xor " + x[1] + ": output " + forward(x)[1].toFixed(4) + ", target " + label);
}`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>

const double X[4][2] = {{0, 0}, {0, 1}, {1, 0}, {1, 1}};
const double LABEL[4] = {0, 1, 1, 0};
double w1[2][2] = {{0.5, -0.4}, {0.3, 0.8}};  // w1[j][i]: from input i to hidden unit j
double b1[2] = {0.1, -0.2};
double w2[2] = {0.6, -0.7};                   // from hidden unit j to the output
double b2 = 0.05;
const double RATE = 1.0;

double forward(const double x[2], double h[2]) {
    for (int j = 0; j < 2; ++j) h[j] = std::tanh(w1[j][0] * x[0] + w1[j][1] * x[1] + b1[j]);
    return 1 / (1 + std::exp(-(w2[0] * h[0] + w2[1] * h[1] + b2)));
}

// Forward and backward through all four examples, then one update.
double train_one_epoch() {
    double g_w1[2][2] = {{0, 0}, {0, 0}}, g_b1[2] = {0, 0}, g_w2[2] = {0, 0}, g_b2 = 0, loss = 0;
    for (int k = 0; k < 4; ++k) {
        double h[2];
        double y = forward(X[k], h);
        loss -= LABEL[k] * std::log(y) + (1 - LABEL[k]) * std::log(1 - y);
        double d_out = y - LABEL[k];
        g_b2 += d_out;
        for (int j = 0; j < 2; ++j) {
            double d_hidden = d_out * w2[j] * (1 - h[j] * h[j]);
            g_w2[j] += d_out * h[j];
            g_b1[j] += d_hidden;
            for (int i = 0; i < 2; ++i) g_w1[j][i] += d_hidden * X[k][i];
        }
    }
    const int n = 4;
    b2 -= RATE * g_b2 / n;
    for (int j = 0; j < 2; ++j) {
        w2[j] -= RATE * g_w2[j] / n;
        b1[j] -= RATE * g_b1[j] / n;
        for (int i = 0; i < 2; ++i) w1[j][i] -= RATE * g_w1[j][i] / n;
    }
    return loss / n;
}

int main() {
    for (int epoch = 1; epoch <= 2000; ++epoch) {
        double loss = train_one_epoch();
        if (epoch == 1 || epoch == 10 || epoch == 100 || epoch == 500 || epoch == 1000 || epoch == 2000) {
            std::printf("epoch %4d: loss %.4f\\n", epoch, loss);
        }
    }
    for (int k = 0; k < 4; ++k) {
        double h[2];
        std::printf("%.0f xor %.0f: output %.4f, target %.0f\\n", X[k][0], X[k][1], forward(X[k], h), LABEL[k]);
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'For one example, the forward pass uses every weight once and the backward pass uses every weight once more, so a full set of gradients costs about as much as two forward passes: O(W) for a network with W weights. One epoch of full-batch training over N examples costs O(N · W).',
    cases: [
      { case: 'Gradient for one example', time: 'O(W)', when: 'One forward and one backward pass. The cost does not depend on which weight you care about: you get all of them.' },
      { case: 'One epoch, full batch', time: 'O(N · W)', when: 'N examples, each needing both passes, followed by one update.' },
      { case: 'Finite differences instead', time: 'O(W²) per example', when: 'Nudging each of W weights separately needs a forward pass, itself O(W), per weight. This is the cost backpropagation avoids.' },
    ],
    space: 'O(W) for the weights and their gradients, plus every activation from the forward pass, which must be kept until the backward pass has used it.',
    memory: 'Storing the activations is the real memory cost in deep networks: it grows with the depth of the network and the size of the batch, and it is why training needs far more memory than running a trained network.',
    tradeoffs: 'Backpropagation trades memory for time. It keeps every intermediate value so that no part of the chain rule is computed twice. The forward-mode alternative keeps almost nothing but needs one pass per weight.',
    assumptions: [
      'Every operation in the network is differentiable at the point where it is evaluated.',
      'W counts weights and biases. Arithmetic on numbers takes constant time.',
      'The bounds are for computing gradients. How many epochs training needs is a separate question with no general answer.',
      'The chart counts passes through the network on this page\'s small network. It shows how the two methods scale, not running time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Models with very many parameters and a single number to minimize. All gradients come at the cost of about two forward passes.',
      'Any calculation built from differentiable pieces: layers can be rearranged or added without deriving anything by hand.',
      'Exactness. The gradient is not an estimate. It is the true derivative up to rounding.',
    ],
    struggles: [
      'Steps without a useful derivative, such as rounding, sampling a discrete choice or a hard threshold.',
      'Very deep or recurrent networks with saturating activations, where the error signal shrinks at every layer until the early layers barely learn. This is the vanishing gradient problem.',
      'Memory: every intermediate value of the forward pass has to be stored.',
    ],
    pitfalls: [
      'A bug in the backward pass usually does not crash. Training just works less well. Always check against finite differences.',
      'Saturated units at the start, caused by starting weights that are too large.',
      'Mistaking a failure of the optimizer or of the network\'s size for a failure of backpropagation.',
    ],
    misunderstandings: [
      "\"Backpropagation is how the network learns.\" It only computes gradients. A separate rule, gradient descent, uses them to change the weights.",
      "\"The error signal is the error.\" Only at the output is it the plain difference between output and label. Further back it is a rate of change that has been multiplied by weights and slopes along the way.",
      "\"It is an approximation.\" The gradient it returns is exact for the current weights and the current batch of examples. What is approximate is the idea that a straight-line step along it will lower the loss.",
      "\"The brain learns this way.\" The method was not derived from biology, and whether anything like it happens in real neurons is an open research question.",
    ],
    constraints: [
      'Large networks are trained on random mini-batches, so the gradient computed is that of the batch, a noisy estimate of the gradient over the full data.',
      'Frameworks compute the backward pass automatically from the forward code, so in practice the work is in choosing the architecture, the loss and the optimizer.',
    ],
    alternatives: [
      { name: 'Finite differences', when: 'Only for checking a backward pass on a small network. Far too slow for training.' },
      { name: 'Forward-mode automatic differentiation', when: 'The function has few inputs and many outputs, the opposite shape to a network\'s loss.' },
      { id: 'genetic-algorithm', name: 'Evolutionary search over the weights', when: 'The model is not differentiable, or only a final score is available. Needs far more evaluations.' },
      { id: 'perceptron', name: 'Perceptron learning rule', when: 'There is a single layer and the classes are linearly separable. No hidden units, so nothing to propagate.' },
    ],
    comparison: {
      columns: ['', 'Backpropagation', 'Finite differences', 'Forward-mode differentiation'],
      rows: [
        ['Passes for all W gradients', 'One forward, one backward', 'W + 1 forward', 'W forward'],
        ['Result', 'Exact', 'Approximate', 'Exact'],
        ['Extra memory', 'All activations', 'None', 'Almost none'],
        ['Used for', 'Training', 'Checking gradients', 'Functions with few inputs'],
      ],
    },
  },

  applications: [
    { title: 'Deep learning frameworks', status: 'established', text: 'PyTorch, TensorFlow and JAX all provide reverse-mode automatic differentiation. The user writes the forward calculation, and the framework records it and runs the backward pass to produce the gradients.' },
    { title: 'Reading handwritten digits', status: 'established', text: 'In 1989 Yann LeCun and colleagues at Bell Labs trained a network with backpropagation to recognize handwritten ZIP code digits from United States mail, an early demonstration on a real task.' },
    { title: 'Language and image models', status: 'established', text: 'Large language models, image classifiers and image generators are all trained by repeating the same two steps billions of times: a forward pass to compute a loss on a batch of data, and a backward pass to get its gradient.' },
    { title: 'Sensitivities of large simulations', status: 'established', text: 'Outside machine learning the same backward calculation is called the adjoint method. Weather centres use it to work out how a forecast error depends on millions of initial values, and engineers use it to get the sensitivity of a design to all of its parameters at once.' },
    { title: 'Tuning any differentiable pipeline', status: 'illustrative', text: 'If a chain of processing steps, such as a camera model followed by image filters, is written with differentiable operations, the gradient of a quality score with respect to every setting can be obtained in the same way.' },
  ],

  connections: [
    { to: 'gradient-descent', type: 'prerequisite', why: 'Backpropagation supplies the gradient and gradient descent uses it. Neither trains a network alone.' },
    { to: 'logistic-regression', type: 'prerequisite', why: 'The output unit here is a logistic regression on the hidden activations, with the same error signal, output minus label. Backpropagation extends that gradient to the layers underneath.' },
    { to: 'perceptron', type: 'prerequisite', why: 'A perceptron adjusts one layer of weights from the error at its output. Backpropagation answers the question the perceptron could not: how to adjust weights that are not connected to the output directly.' },
    { to: 'concept:chain-rule', type: 'prerequisite', why: 'Every line of the backward pass is the chain rule: rates of change along a chain of dependencies multiply.' },
    { to: 'concept:dynamic-programming', type: 'related', why: 'The error signal at a unit is a subproblem shared by all the weights behind it. Computing it once and reusing it is the same idea that makes dynamic programming efficient.' },
    { to: 'concept:activation-function', type: 'prerequisite', why: 'The slope of each unit\'s activation function multiplies the error signal passing through it, so the choice of activation decides how well the error travels.' },
    { to: 'concept:loss-function', type: 'prerequisite', why: 'The loss is where the backward pass begins. Its derivative with respect to the output is the first error signal.' },
    { to: 'stochastic-gradient-descent', type: 'advanced', why: 'Runs the same forward and backward passes on a small random batch for each update, which is how networks are trained at scale.' },
    { to: 'adam', type: 'advanced', why: 'Takes the gradients from backpropagation and rescales them for each weight using their recent history before stepping.' },
    { to: 'attention', type: 'advanced', why: 'Transformers are built entirely from differentiable operations, so the same backward pass trains them, through many more layers.' },
    { to: 'ddpm', type: 'application', why: 'The denoising network at the centre of a diffusion model is trained by backpropagating a simple squared-error loss.' },
    { to: 'discipline:mathematics', type: 'related', why: 'It is an efficient ordering of the chain rule, an instance of reverse-mode automatic differentiation.' },
    { to: 'discipline:computer-vision', type: 'application', why: 'Convolutional and transformer networks for images are trained with gradients from backpropagation.' },
    { to: 'discipline:nlp', type: 'application', why: 'Language models learn to predict the next token by backpropagating the prediction loss through every layer.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'What does the backward pass need in order to compute the error signal at a hidden unit?',
      options: ['The error signals of the units it feeds, the weights on those connections, and the slope of its own activation', 'A fresh forward pass with that unit switched off', 'The inputs to the network and nothing else', 'The learning rate'],
      answer: 0,
      explain: [
        'Correct. Those three things are multiplied together, and summed if the unit feeds several others. All of them are already known when the backward pass arrives.',
        'Rerunning the network for every unit is what backpropagation avoids.',
        'The inputs matter for the gradients of the first-layer weights, but the error signal comes from the output side.',
        'The learning rate is used later, when the weights are updated. It plays no part in computing gradients.',
      ],
    },
    {
      type: 'predict',
      q: 'The XOR dataset has four groups of points at the corners of a square, with opposite corners sharing a class. A network with a single hidden unit is trained on 40 of these points. How many does it end up classifying correctly?',
      options: ['All 40', 'About 30, three of the four corners', 'About 20, no better than guessing', 'None'],
      answer: 1,
      explain: [
        'One hidden unit can only produce a straight boundary, and no straight line separates opposite corners from the other two.',
        'Correct. The best a straight boundary can do is cut off one corner, getting three groups right and one wrong: 30 of 40. The gradients are exact. The network is too small.',
        'It does better than guessing, because three of the four groups can be put on the right side.',
        'Getting everything wrong would be as hard as getting everything right.',
      ],
      tryInput: { ...DEFAULTS, hidden: 1 },
    },
    {
      type: 'debug',
      q: 'A finite-difference check passes for the output weights but fails for the first-layer weights. What is wrong with this backward pass?',
      code: `d_out = y - label
for j in range(2):
    w2[j] -= rate * d_out * h[j]
    d_hidden = d_out * w2[j] * (1 - h[j] * h[j])
    for i in range(2):
        w1[j][i] -= rate * d_hidden * x[i]`,
      options: ['d_out should be label − y', 'w2[j] is updated before it is used to pass the error back, so d_hidden is computed with the new weight', 'The slope of tanh should be h[j] * (1 − h[j])', 'The inner loop should run over j, not i'],
      answer: 1,
      explain: [
        'y − label is correct for a step that subtracts the gradient.',
        'Correct. The error must travel back through the weights the forward pass used. Compute every gradient first, then update.',
        'h(1 − h) is the slope of the sigmoid. For tanh it is 1 − h².',
        'The loops are right: i runs over the inputs feeding hidden unit j.',
      ],
    },
    {
      type: 'choice',
      q: 'A network has one million weights. Roughly how much work is it to get the gradient of the loss with respect to all of them for one example?',
      options: ['About one million forward passes, one per weight', 'About the work of two forward passes', 'About one thousand forward passes, the square root of the number of weights', 'It depends on the learning rate'],
      answer: 1,
      explain: [
        'That is the cost of nudging each weight in turn, which backpropagation replaces.',
        'Correct. One forward pass and one backward pass of similar cost give every gradient at once.',
        'No square root is involved. The cost is linear in the number of weights.',
        'The learning rate affects the update, not the cost of computing gradients.',
      ],
    },
    {
      type: 'challenge',
      title: 'Add a layer and check it',
      prompt: 'Extend the sample program to two hidden layers of three tanh units each. Derive the error signal for the new layer: it now receives error from several units in the layer above, so the contributions must be summed. Then write a gradient checker that nudges each weight by 0.00001 in both directions, and confirm that every analytic gradient agrees with the numerical one to at least six decimal places before you train anything.',
      hints: ['The error signal at a unit is the sum over the units it feeds of (their error signal × the connecting weight), all multiplied by the slope of its own activation.', 'Use the two-sided difference (loss(w + e) − loss(w − e)) / 2e. It is far more accurate than the one-sided version.'],
    },
  ],

  compare: {
    idea: 'One forward pass to compute the loss, one backward pass applying the chain rule to get the gradient for every weight.',
    requires: 'A model built from differentiable operations and a single number to differentiate. Returns exact gradients. Does not itself guarantee that training succeeds.',
    sensitivity: 'The gradients are exact. Training with them is sensitive to the learning rate, the starting weights and the size of the network.',
    memory: 'O(W) for weights and gradients, plus every activation of the forward pass.',
    difficulty: 'high',
    difficultyNote: 'The idea is the chain rule. Getting every index and every derivative right by hand is error-prone, which is why frameworks automate it.',
    limits: 'Needs differentiable operations. Stores all intermediate values. Error signals can shrink to nothing in deep saturating networks.',
    useWhen: 'You are training any model with many parameters by a gradient method.',
  },

  advanced: {
    history: 'The backward calculation of derivatives was found more than once. Closely related methods were used in optimal control theory from about 1960. In 1970 Seppo Linnainmaa described, in his master\'s thesis at the University of Helsinki, what is now called reverse-mode automatic differentiation: the general technique of which backpropagation is a special case. Paul Werbos developed the same backward calculation for fitting models in his 1974 doctoral thesis at Harvard. The method became widely known through the 1986 paper of David Rumelhart, Geoffrey Hinton and Ronald Williams, which showed that networks with hidden units, trained this way, learn useful internal representations. That mattered because Marvin Minsky and Seymour Papert had shown in 1969 that a single layer of units cannot compute functions such as XOR, and no practical way of training hidden layers had been established.',
    derivation: 'For one example with input $x$ and label $y \\in \\{0, 1\\}$, the network computes\n\n$$a = W_1 x + b_1, \\quad h = \\tanh(a), \\quad z = w_2^\\top h + b_2, \\quad \\hat y = \\sigma(z) = \\frac{1}{1 + e^{-z}},$$\n\nand the loss is the cross-entropy $L = -\\left[y \\log \\hat y + (1 - y)\\log(1 - \\hat y)\\right]$.\n\n**Output.** Since $\\partial L/\\partial \\hat y = (\\hat y - y)/(\\hat y(1 - \\hat y))$ and $\\partial \\hat y/\\partial z = \\hat y(1 - \\hat y)$, the product is\n\n$$\\delta^{\\text{out}} = \\frac{\\partial L}{\\partial z} = \\hat y - y.$$\n\n**Output weights.** $z$ is linear in $w_2$, so $\\partial L/\\partial w_{2,j} = \\delta^{\\text{out}} h_j$ and $\\partial L/\\partial b_2 = \\delta^{\\text{out}}$.\n\n**Hidden units.** $L$ depends on $a_j$ only through $h_j$ and then $z$, and $\\tanh\'(a) = 1 - \\tanh^2(a)$, so\n\n$$\\delta_j = \\frac{\\partial L}{\\partial a_j} = \\delta^{\\text{out}}\\, w_{2,j}\\,(1 - h_j^2).$$\n\n**First-layer weights.** $a_j$ is linear in the weights into unit $j$, so $\\partial L/\\partial W_{1,ji} = \\delta_j x_i$ and $\\partial L/\\partial b_{1,j} = \\delta_j$.\n\nFor a network with more layers the same two lines repeat. With activations $h^{(l)} = f(a^{(l)})$ and $a^{(l+1)} = W^{(l+1)} h^{(l)} + b^{(l+1)}$,\n\n$$\\delta^{(l)} = \\left(W^{(l+1)\\top} \\delta^{(l+1)}\\right) \\odot f\'(a^{(l)}), \\qquad \\frac{\\partial L}{\\partial W^{(l)}} = \\delta^{(l)}\\, h^{(l-1)\\top},$$\n\nwhere $\\odot$ multiplies element by element. The transpose in the first formula is the sum over all the units that a unit feeds.',
    complexityProof: 'In the forward pass each weight takes part in one multiplication. In the backward pass each weight takes part in at most two: once to form its own gradient, $\\delta \\cdot h$, and once to carry the error signal to the layer below, $W^\\top\\delta$. Each unit adds one evaluation of its activation and one of its slope. The total is a constant multiple of the number of weights, so the gradient costs $O(W)$, the same order as evaluating the network. A finite-difference gradient needs at least one extra forward pass per weight, $O(W)$ each, for $O(W^2)$ in total. This is a general property of reverse-mode differentiation: the gradient of a function with one output costs only a small constant times the cost of evaluating the function, however many inputs it has.',
    variants: [
      { name: 'Reverse-mode automatic differentiation', text: 'The general form. The program records each elementary operation during the forward calculation and replays the record backwards, applying the chain rule to each step. Backpropagation is this applied to a layered network.' },
      { name: 'Mini-batch training', text: 'The passes are run on a small random subset of the data for each update. This is what stochastic gradient descent and its relatives do.' },
      { name: 'Backpropagation through time', text: 'For recurrent networks, the network is unrolled over the steps of a sequence and the error is passed back through every step.' },
      { name: 'Forward-mode differentiation', text: 'Carries derivatives forwards alongside the values. Efficient when there are few inputs and many outputs, the opposite of a network\'s loss.' },
    ],
    implementation: 'Write the forward pass so that it returns every intermediate value the backward pass will need. Accumulate gradients over a batch in separate arrays and apply the update only at the end. Check the result against two-sided finite differences on a tiny network with a handful of examples before doing anything else. Start the weights at small random values scaled to the number of inputs of each unit, so that units do not begin saturated.',
    benchmarking: 'The correctness of a backward pass is tested, not benchmarked: the relative difference between analytic and numerical gradients should be around one part in a million or smaller in double precision. Training results should be reported over several random starting points, because the same network and data can end in different places.',
    references: [
      { authors: 'D. E. Rumelhart, G. E. Hinton and R. J. Williams', year: 1986, title: 'Learning representations by back-propagating errors', venue: 'Nature 323, 533-536' },
      { authors: 'P. J. Werbos', year: 1974, title: 'Beyond Regression: New Tools for Prediction and Analysis in the Behavioral Sciences', venue: 'PhD thesis, Harvard University' },
      { authors: 'Y. LeCun, B. Boser, J. S. Denker, D. Henderson, R. E. Howard, W. Hubbard and L. D. Jackel', year: 1989, title: 'Backpropagation applied to handwritten zip code recognition', venue: 'Neural Computation 1(4), 541-551' },
      { authors: 'I. Goodfellow, Y. Bengio and A. Courville', year: 2016, title: 'Deep Learning', venue: 'MIT Press' },
      { authors: 'A. G. Baydin, B. A. Pearlmutter, A. A. Radul and J. M. Siskind', year: 2018, title: 'Automatic differentiation in machine learning: a survey', venue: 'Journal of Machine Learning Research 18' },
    ],
    furtherReading: [
      'M. Nielsen, *Neural Networks and Deep Learning* (2015), the chapter "How the backpropagation algorithm works".',
      'C. Olah, "Calculus on Computational Graphs: Backpropagation" (2015).',
    ],
  },

  tests: [
    { name: 'the analytic gradient matches a finite-difference gradient for every weight', input: {},
      check: (r) => {
        const H = r.hidden, v = flat(r.initialParams), e = 1e-5;
        let worst = 0;
        for (let i = 0; i < v.length; i++) {
          const keep = v[i];
          v[i] = keep + e; const up = meanLoss(unflat(v, H), r.points);
          v[i] = keep - e; const down = meanLoss(unflat(v, H), r.points);
          v[i] = keep;
          worst = Math.max(worst, Math.abs((up - down) / (2 * e) - r.initialGradient[i]));
        }
        return (v.length === 17 && worst < 1e-8) || `largest difference ${worst}`;
      } },
    { name: 'the gradient also matches on another dataset and network size', input: { ...DEFAULTS, dataset: 'moons', hidden: 6, seed: 3 },
      check: (r) => {
        const H = r.hidden, v = flat(r.initialParams), e = 1e-5;
        let worst = 0;
        for (let i = 0; i < v.length; i++) {
          const keep = v[i];
          v[i] = keep + e; const up = meanLoss(unflat(v, H), r.points);
          v[i] = keep - e; const down = meanLoss(unflat(v, H), r.points);
          v[i] = keep;
          worst = Math.max(worst, Math.abs((up - down) / (2 * e) - r.initialGradient[i]));
        }
        return (v.length === 25 && worst < 1e-8) || `largest difference ${worst}`;
      } },
    { name: 'XOR is learned with the default settings and the loss falls', input: {},
      check: (r, c) => (r.accuracy === 1 && r.loss < 0.05 && r.loss < r.initialLoss / 10 && c['network passes'] === 2 * 40 * 200 && c['weight updates'] === 200) || `accuracy ${r.accuracy}, loss ${r.loss}` },
    { name: 'with a small learning rate the loss never rises', input: { ...DEFAULTS, rate: 0.05 },
      check: (r) => (r.losses.every((v, i) => i === 0 || v <= r.losses[i - 1]) && r.accuracy < 1) || 'the loss rose, or the slow run unexpectedly finished learning' },
    { name: 'one hidden unit gets three of the four XOR corners', input: { ...DEFAULTS, hidden: 1 },
      check: (r) => (r.accuracy === 0.75 && r.loss > 0.45) || `accuracy ${r.accuracy}, loss ${r.loss}` },
    { name: 'two hidden units on seed 1 end at 25 of 40', input: { ...DEFAULTS, hidden: 2, seed: 1 },
      check: (r) => r.accuracy === 0.625 || `accuracy ${r.accuracy}` },
    { name: 'a separable set is separated', input: { ...DEFAULTS, dataset: 'separable', hidden: 2, epochs: 60 },
      check: (r) => r.accuracy === 1 || `accuracy ${r.accuracy}` },
    { name: 'training with finite-difference gradients ends at the same weights', input: { ...DEFAULTS, epochs: 40, gradient: 'numeric' },
      check: (r) => {
        const ref = flat(run({ ...DEFAULTS, epochs: 40 }, QUIET).params), got = flat(r.params);
        const worst = Math.max(...got.map((v, i) => Math.abs(v - ref[i])));
        return worst < 1e-6 || `weights differ by ${worst}`;
      } },
    { name: 'the walkthrough numbers obey the stated rules', input: {},
      check: (r) => {
        const x = r.example, close = (a, b) => Math.abs(a - b) < 1e-12;
        const w2 = r.initialParams.W2;
        return (close(x.dOut, x.output - x.label) && x.gW2.every((g, j) => close(g, x.dOut * x.h[j]))
          && x.dHidden.every((d, j) => close(d, x.dOut * w2[j] * (1 - x.h[j] * x.h[j])))
          && x.gW1.every((g, j) => close(g[0], x.dHidden[j] * x.x1) && close(g[1], x.dHidden[j] * x.x2))) || 'a walkthrough number breaks its rule';
      } },
    { name: 'the worked example by hand', input: {},
      check: () => {
        const loss = (w1, w2) => 0.5 * (2 * w1 * w2 - 1) ** 2, e = 1e-6;
        const mid = 2 * 3, out = mid * 0.5, err = out - 1, g2 = err * mid, back = err * 0.5, g1 = back * 2;
        const n2 = (loss(3, 0.5 + e) - loss(3, 0.5 - e)) / (2 * e), n1 = (loss(3 + e, 0.5) - loss(3 - e, 0.5)) / (2 * e);
        const ok = mid === 6 && out === 3 && err === 2 && g2 === 12 && back === 1 && g1 === 2 && Math.abs(n2 - 12) < 1e-6 && Math.abs(n1 - 2) < 1e-6
          && Math.abs((0.5 - 0.01 * g2) - 0.38) < 1e-12 && Math.abs((3 - 0.01 * g1) - 2.98) < 1e-12 && Math.abs(2 * 2.98 * 0.38 - 2.2648) < 1e-12;
        return ok || 'a number in the worked example is wrong';
      } },
    { name: 'the seed statistics quoted in Try this', input: {},
      check: () => {
        let two = 0, four = 0;
        for (let seed = 1; seed <= 30; seed++) {
          if (run({ ...DEFAULTS, hidden: 2, seed }, QUIET).accuracy === 1) two++;
          if (run({ ...DEFAULTS, seed }, QUIET).accuracy === 1) four++;
        }
        return (two === 20 && four === 30) || `two hidden units: ${two} of 30, four: ${four} of 30`;
      } },
  ],
};
