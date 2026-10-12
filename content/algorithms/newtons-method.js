import { functionById, rootInputs, sampleCurve } from '../../js/lib/functions.js';

// Plain decimal formatting for notes: about `sig` significant digits.
function num(v, sig = 7) {
  if (Number.isNaN(v)) return 'not a number';
  if (!Number.isFinite(v)) return v > 0 ? 'infinity' : '−infinity';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e9 || a < 1e-13) {
    const [m, e] = v.toExponential(2).split('e');
    return `${m.replace('-', '−')} × 10^${Number(e)}`.replace('^-', '^−');
  }
  let s = v.toFixed(Math.max(0, Math.min(16, sig - 1 - Math.floor(Math.log10(a)))));
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('-', '−');
}
const sub = (k) => String(k).split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[Number(c)]).join('');
const side = (v) => (v > 0 ? 'above zero' : 'below zero');
// Correct decimal digits of x as an estimate of root: −log10 of the distance, kept within what a double can show.
const digitsRight = (x, root) => {
  const e = Math.abs(x - root);
  if (!(e > 1e-16)) return 16;
  return Math.max(-8, -Math.log10(e));
};

function run(input, t) {
  const F = functionById[input.fn];
  if (!F) throw new Error('Unknown function.');
  const tol = input.tolerance;
  if (!(tol > 0)) throw new Error('The tolerance must be greater than zero.');
  const maxSteps = Math.max(1, Math.floor(input.maxSteps ?? 50));
  let x = input.x0 ?? F.x0;
  const xs = [x];
  const tangents = [];          // [x_k, f(x_k), x_{k+1}] for every step taken
  let status = 'budget', k = 0, lastStep = null;
  const span = F.x[1] - F.x[0];
  const inView = (v) => v >= F.x[0] && v <= F.x[1];

  const views = ({ at = null, slope = null, landed = null, answer = null } = {}) => {
    const layers = [
      { type: 'segments', segments: [[F.x[0], 0, F.x[1], 0]], role: 'muted', width: 1 },
      { type: 'line', points: sampleCurve(F), role: 'moss', width: 2.4 },
    ];
    const old = tangents.slice(0, landed !== null ? -1 : undefined);
    if (old.length) {
      layers.push({ type: 'segments', segments: old.map(([a, fa, b]) => [a, fa, b, 0]), role: 'compare', width: at ? 1.2 : 1.6, alpha: at ? 0.45 : 0.85 });
      layers.push({ type: 'segments', segments: old.map(([a, fa]) => [a, 0, a, fa]), role: 'dim', width: 1, alpha: 0.5 });
    }
    layers.push({ type: 'points', points: xs.slice(0, landed !== null ? -1 : undefined).map((v) => [v, 0]), role: 'active', r: 2.6, alpha: 0.55 });
    layers.push({ type: 'points', points: [[F.root, 0]], role: 'forest', hollow: true, r: 6 });
    if (at) {
      const [xk, fk, idx] = at;
      if (slope !== null) {
        layers.push({ type: 'segments', segments: [[F.x[0], fk + slope * (F.x[0] - xk), F.x[1], fk + slope * (F.x[1] - xk)]], role: 'compare', width: 2 });
      }
      layers.push({ type: 'segments', segments: [[xk, 0, xk, fk]], role: 'active', width: 1.5 });
      layers.push({ type: 'points', points: [{ x: xk, y: fk, label: `x${sub(idx)}` }], role: 'active', r: 5.5, ring: true });
      if (landed !== null) {
        const far = Math.abs(landed - xk) > 0.03 * span;
        layers.push({ type: 'points', points: [{ x: landed, y: 0, label: far ? `x${sub(idx + 1)}` : '' }], role: 'compare', r: 5.5, ring: true });
      }
    }
    if (answer !== null) layers.push({ type: 'points', points: [{ x: answer, y: 0, label: 'answer' }], role: 'done', r: 4.5 });
    const digits = xs.map((v) => digitsRight(v, F.root));
    const lo = Math.min(-1, ...digits) - 0.5;
    const roles = {};
    roles[digits.length - 1] = 'active';
    return [
      { kind: 'scene', title: `The curve y = ${F.expr}, the tangent at the current guess, and where it reaches zero`, x: F.x, y: F.y, aspect: 0.5, axes: { xLabel: 'x', yLabel: 'f(x)' }, layers,
        legend: [{ label: 'the curve f(x)', role: 'moss' }, { label: 'true crossing (ring) and final answer (dot)', role: 'forest' }, { label: 'current guess', role: 'active' }, { label: 'tangent line and the next guess', role: 'compare' }] },
      { kind: 'scene', title: 'Accuracy of each guess, in correct decimal digits (16 is the most this number format holds)', x: [-0.7, Math.max(6, xs.length - 1) + 0.7], y: [lo, 17], aspect: 0.2, axes: { xLabel: 'step' },
        layers: [
          { type: 'segments', segments: [[-0.7, 0, Math.max(6, xs.length - 1) + 0.7, 0]], role: 'muted', width: 1 },
          { type: 'bars', xs: digits.map((_, i) => i), heights: digits, barWidth: 0.62, role: 'forest', roles },
        ] },
    ];
  };

  t.frame(() => ({ line: 0,
    note: `We want the x where the curve y = ${F.expr} crosses zero (the green ring). Start from the guess **x${sub(0)} = ${num(x)}**. The lower chart will show how many digits of each guess are correct.`,
    views: views(), vars: { [`x${sub(0)}`]: num(x), tolerance: num(tol, 3) } }));

  while (k < maxSteps) {
    const fx = F.f(x); t.count('function evaluations');
    if (fx === 0) { status = 'converged'; break; }
    const slope = F.df(x); t.count('derivative evaluations');
    const xk = x, idx = k;
    if (slope === 0 || !Number.isFinite(slope) || !Number.isFinite(fx)) {
      status = 'flat';
      t.frame(() => ({ line: [4, 5],
        note: Math.abs(xk) > 1e6
          ? `At x = ${num(xk, 4)} the function is ${num(fx, 5)} and the computed slope is ${num(slope, 3)}. The guesses have run so far from the root that no further step can be taken.`
          : `At x = ${num(xk)} the function is ${num(fx, 5)} but the slope is exactly 0. The tangent is horizontal, so it never reaches zero and there is no next guess.`,
        views: views({ at: [xk, fx, idx], slope: Number.isFinite(slope) && Number.isFinite(fx) ? slope : null }), vars: { step: idx, x: num(xk), 'f(x)': num(fx, 5), slope: num(slope, 5) } }));
      break;
    }
    t.frame(() => ({ line: [2, 4],
      note: `At **x${sub(idx)} = ${num(xk, 10)}** the curve is at height ${num(fx, 5)} (${side(fx)}) and its slope is ${num(slope, 5)}. The ochre line is the tangent: the straight line that touches the curve here and has that slope.${inView(xk) ? '' : ' This guess is outside the picture.'}`,
      views: views({ at: [xk, fx, idx], slope }), vars: { step: idx, x: num(xk, 10), 'f(x)': num(fx, 5), slope: num(slope, 5) } }));
    const step = fx / slope;
    x = xk - step;
    k++;
    lastStep = step;
    xs.push(x);
    tangents.push([xk, fx, x]);
    const xn = x;
    t.frame(() => ({ line: [6, 7],
      note: `Follow the tangent to zero. It gets there at ${num(xk, 10)} − (${num(fx, 5)} ÷ ${num(slope, 5)}) = **${num(xn, 10)}**. That is the new guess x${sub(idx + 1)}, a move of ${num(Math.abs(step), 3)}.${inView(xn) ? '' : ` It is off the ${xn > F.x[1] ? 'right' : 'left'} edge of the picture.`}`,
      views: views({ at: [xk, fx, idx], slope, landed: xn }), vars: { step: idx + 1, x: num(xn, 10), moved: num(Math.abs(step), 3) } }));
    if (!Number.isFinite(x)) break;
    if (Math.abs(step) <= tol) { status = 'converged'; break; }
  }

  // The run is over. If it failed, look at the guesses to say how it failed.
  const n = xs.length - 1;
  if (status !== 'converged') {
    const close = (u, v) => Math.abs(u - v) <= 1e-9 * Math.max(1, Math.abs(u));
    let period = 0;
    for (let p = 2; p <= 4 && !period; p++) if (n >= 2 * p && close(xs[n], xs[n - p]) && close(xs[n - 1], xs[n - 1 - p])) period = p;
    if (!Number.isFinite(x) || Math.abs(x) > 1e6) status = 'diverged';
    else if (status !== 'flat' && period) status = 'cycle';
  }
  const error = Math.abs(x - F.root);
  const finalNote = {
    converged: lastStep === null
      ? `The starting guess ${num(x)} already makes the function exactly zero. It is a root, and no step was needed.`
      : `The last move was ${num(Math.abs(lastStep), 3)}, no more than the tolerance ${num(tol, 3)}, so stop. The answer is **${num(x, 13)}** after ${k} step${k === 1 ? '' : 's'}. It differs from the true root by ${error < 1e-15 ? 'less than this number format can show' : num(error, 2)}.`,
    cycle: `Out of steps after ${k}. The guesses are repeating: ${xs.slice(-4).map((v) => num(v, 5)).join(', ')}. Each tangent sends the guess to a point whose own tangent sends it back. This is a **cycle**, and more steps will not help. A different starting guess, or a bracketing method, is needed.`,
    diverged: `The guesses have run away from the root instead of closing in: the last one is ${num(x, 4)}. Each tangent, taken where the curve is nearly flat, overshoots to a point even farther out. The method has **diverged** from this starting guess.`,
    flat: `No answer. The tangent at ${num(x)} is horizontal, so Newton's method cannot take a step from here. Start somewhere else.`,
    budget: `Out of steps after ${k}. The last guess is ${num(x, 10)}, still ${num(error, 2)} from the root, and the last move was ${num(Math.abs(lastStep ?? 0), 3)}, larger than the tolerance. ${lastStep !== null && n >= 3 && Math.abs(xs[n] - xs[n - 1]) < Math.abs(xs[n - 1] - xs[n - 2]) ? 'The moves are getting smaller, so it may still be converging, only slowly.' : 'It has not settled down.'}`,
  }[status];
  t.frame(() => ({ line: status === 'converged' ? (lastStep === null ? 3 : 8) : status === 'flat' ? 5 : 9, note: finalNote,
    views: views({ answer: status === 'converged' ? x : null }), vars: { status, steps: k, x: num(x, 13) } }));

  return { root: status === 'converged' ? x : null, iterations: k, status, lastX: x, xs, error, fn: F.id };
}

const quiet = { count() {}, frame() {} };

export default {
  meta: {
    id: 'newtons-method',
    name: 'Newton\'s Method',
    aliases: ['Newton-Raphson method', 'Newton-Raphson', 'Newton iteration', 'tangent method'],
    kind: 'algorithm',
    discipline: 'mathematics',
    alsoIn: [
      { id: 'optimization', why: 'A smooth function is lowest where its derivative is zero, so minimizing is root finding on the derivative. Newton\'s method there uses the second derivative to scale each step.' },
      { id: 'finance', why: 'The volatility implied by an option\'s market price has no formula. It is found by root finding on the pricing formula, and Newton\'s method is one standard choice.' },
      { id: 'statistics', why: 'Logistic regression is fitted by iteratively reweighted least squares, which is exactly Newton\'s method applied to the equations that maximize the likelihood.' },
    ],
    subfield: 'Numerical analysis',
    family: 'Root finding',
    lab: 'numerical',
    compareGroup: 'root-finding',
    summary: 'Solves f(x) = 0 by following the tangent line at the current guess to where it crosses zero, and repeating from there.',
    difficulty: 'intermediate',
    order: 440,
    paradigms: ['iterative-refinement', 'gradient-based'],
    randomized: false,
    approximate: true,
    time: { best: 'O(log log(1/ε)) steps near a simple root', average: 'A handful of steps from a good start', worst: 'No guarantee: it can cycle or diverge', class: 'iterative' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['solve an equation', 'find where a function is zero', 'find a root', 'compute a square root', 'improve a guess quickly', 'solve a nonlinear equation'],
      techniques: ['tangent line', 'linearization', 'derivative', 'fixed-point iteration'],
      applications: ['scientific computing', 'engineering design', 'finance', 'machine learning', 'statistics'],
    },
    prerequisites: ['concept:derivative', 'concept:convergence', 'bisection-method'],
  },

  bigIdea: {
    simple: "Newton's method solves an equation by making a guess and then improving it, quickly. Suppose you want an oven at exactly 200 degrees, and the dial has no numbers. You pick a position and wait. The oven settles at 180 degrees, which is 20 too low. You also know that, around this position, one notch of the dial adds about 10 degrees. So you turn it up 2 notches. That would be perfect if every notch added exactly 10 degrees. Real dials are not that regular, so you might land on 199. You measure again and make a much smaller correction. Each round uses two facts: how far off you are, and how quickly the result changes when the guess changes. Dividing the first by the second gives the correction. Once the guess is close, every round roughly doubles the number of correct digits, so a few rounds are enough. The catch is that a poor first guess can send the method the wrong way.",
    what: 'Newton\'s method solves an equation written as f(x) = 0. At the current guess it measures two things: the value of the function and its slope. It then pretends the function is a straight line with that value and slope, which is the tangent line, and takes the point where that line crosses zero as the next guess.',
    why: 'Most equations cannot be solved by a formula. Bisection always works but gains only one binary digit per step. Newton\'s method uses the slope as well as the value, and near a simple root that extra information roughly doubles the number of correct digits at every step. Five or six steps often exhaust the precision of the computer.',
    when: 'Use it when you can compute the derivative and have a starting guess reasonably near the root. If you only have a bracket, or the function is rough, use the [bisection method](#/algorithm/bisection-method), which cannot fail. If you want both speed and safety, use a hybrid that takes Newton steps while they stay inside a bracket and bisects when they do not.',
    interesting: 'The same rule that converges faster than almost anything else can also fail completely. From one starting guess it finds the root to 15 digits in five steps. From another, on the same function, it bounces between two points for ever. Which starting guesses lead where can be very intricate: for equations in complex numbers the boundaries between them are fractals.',
    where: 'It is the standard way to solve nonlinear equations in scientific software: circuit simulators, implicit solvers for differential equations and statistical model fitting all run it at their centre, usually in a many-variable form. Applied to the equation x² = a it gives the ancient rule for square roots: average the guess with a divided by the guess.',
    analogy: {
      title: 'A straight ramp laid along the curve',
      text: 'Stand on the curve at your current guess. Lay a long straight plank so that it touches the curve under your feet and points the way the curve is heading. Walk along the plank to the point where it reaches ground level, the height zero. Then step straight up or down onto the curve again and lay a new plank. If the curve is nearly straight between you and the root, the first plank almost gets you there, and the second is aimed from much closer.',
      limits: 'A plank is straight and the curve is not. If the curve bends sharply between where you stand and the root, the plank can point to a place farther away than where you started. If the curve is level under your feet, the plank is level too and never reaches the ground. And the picture hides the price: to lay the plank you must know the slope, which means having a formula for the derivative or computing an estimate of it.',
    },
  },

  example: {
    setup: "Find the number that gives 2 when multiplied by itself (the square root of 2). Call the guess x and look at x × x − 2, which we want to be zero. For this expression, the slope at any x is 2 × x. The slope says how fast the value changes as x changes. Start from the guess x = 1.",
    steps: [
      "At x = 1 the value is 1 × 1 − 2 = −1 and the slope is 2. The correction is −1 ÷ 2 = −0.5. Subtract it: 1 − (−0.5) = 1.5.",
      "At x = 1.5 the value is 2.25 − 2 = 0.25 and the slope is 3. The correction is 0.25 ÷ 3, about 0.08333. Subtract it: 1.5 − 0.08333 = 1.41667.",
      "At x = 1.41667 the value is about 0.00694 and the slope is about 2.83333. The correction is about 0.00245. Subtract it: 1.41422.",
      "At x = 1.41422 the value is about 0.000006. The correction is about 0.000002. Subtract it: 1.41421.",
    ],
    result: "The guesses were 1, 1.5, 1.41667, 1.41422, 1.41421. The true value is 1.41421356. The first guess had no correct decimal places, the next had none, then 2, then 5, and one more step gives 11. The corrections shrink by themselves: 0.5, then 0.08, then 0.002, then 0.000002.",
    tryInput: { fn: 'sqrt2', x0: 1, tolerance: 1e-6, maxSteps: 20 },
  },

  terms: [
    { term: "Function", meaning: "A rule that turns an input number into an output number." },
    { term: "Root", meaning: "An input that makes the function's output exactly zero. On a graph it is where the curve crosses the horizontal axis." },
    { term: "Slope", meaning: "How fast the output changes when the input changes a little. A slope of 3 means the output rises 3 for each 1 the input rises." },
    { term: "Derivative", meaning: "The rule that gives the slope of a function at every input." },
    { term: "Tangent line", meaning: "The straight line that touches a curve at one point and has the same slope as the curve there." },
    { term: "Iteration", meaning: "One round of a repeated procedure. Here, one round turns a guess into a better guess." },
    { term: "Tolerance", meaning: "How small the latest correction must be before we accept the answer and stop." },
    { term: "Converge", meaning: "To settle down, getting closer and closer to one answer." },
    { term: "Diverge", meaning: "To fail to settle down: the guesses wander or run away instead of closing in." },
  ],

  takeaway: "Measure how far off your guess is and how fast things change there, divide one by the other to get the correction, and repeat.",

  viz: {
    describe: 'A plot of the chosen function with a horizontal line at zero and a hollow green ring at the true root. A terracotta dot on the curve marks the current guess. An ochre straight line is the tangent to the curve at that dot, and an ochre dot marks where the tangent crosses zero, which becomes the next guess. Earlier guesses and tangents stay on the picture, faded. Below, a bar chart shows how many decimal digits of each guess are correct.',
    inputs: [
      ...rootInputs(),
      { id: 'x0', type: 'range', label: 'Starting guess (x₀)', min: -3, max: 4, step: 0.05, default: 1,
        help: 'Where the first tangent is drawn. Newton\'s method is very sensitive to this.' },
      { id: 'maxSteps', type: 'range', label: 'Maximum steps', min: 1, max: 100, step: 1, default: 50,
        help: 'The run gives up after this many steps if it has not converged.' },
    ],
    presets: [
      { label: 'Square root of 2: fast', values: { fn: 'sqrt2', x0: 1, tolerance: 1e-6, maxSteps: 20 } },
      { label: 'Newton\'s own cubic', values: { fn: 'cubic', x0: 2, tolerance: 1e-6, maxSteps: 20 } },
      { label: 'A cycle: 0, 1, 0, 1', values: { fn: 'cycle', x0: 0, tolerance: 1e-6, maxSteps: 8 } },
      { label: 'Divergence on arctan', values: { fn: 'atan', x0: 1.5, tolerance: 1e-6, maxSteps: 6 } },
      { label: 'Same arctan, closer start', values: { fn: 'atan', x0: 1.2, tolerance: 1e-6, maxSteps: 20 } },
      { label: 'Triple root: slow', values: { fn: 'triple', x0: 3.5, tolerance: 1e-6, maxSteps: 60 } },
      { label: 'Horizontal tangent', values: { fn: 'sqrt2', x0: 0, tolerance: 1e-6, maxSteps: 20 } },
    ],
    tryThis: [
      'Run "Square root of 2: fast" and watch the bar chart. The bars go roughly 0, 1, 3, 6, 12, 16: the number of correct digits about doubles at each step until the number format runs out.',
      'Load "A cycle: 0, 1, 0, 1". The tangent at 0 leads to 1, and the tangent at 1 leads back to 0. Now move the starting guess to −2. From there the same function is solved in a few steps.',
      'Load "Divergence on arctan" and then "Same arctan, closer start". Slide the starting guess between 1.2 and 1.5. Somewhere near 1.39 the behaviour flips from converging to running away.',
      'Load "Triple root: slow". The curve is flat where it meets zero, and each step removes only one third of the remaining distance. The bars now climb in a straight line instead of doubling.',
      'Keep "Square root of 2" and tighten the tolerance from 0.001 to 0.000000000001. The run needs only one or two more steps, because each step squares the error.',
    ],
    run,
    report: (r, c) => {
      const head = {
        converged: `Converged to ${num(r.root, 13)} after ${r.iterations} step${r.iterations === 1 ? '' : 's'}.`,
        cycle: `Failed: the guesses are cycling. Last guess ${num(r.lastX, 6)} after ${r.iterations} steps.`,
        diverged: `Failed: the guesses diverged. Last guess ${num(r.lastX, 4)} after ${r.iterations} steps.`,
        flat: `Failed: the tangent at ${num(r.lastX, 6)} is horizontal, so no step can be taken.`,
        budget: `Stopped at the step limit of ${r.iterations} without meeting the tolerance. Last guess ${num(r.lastX, 10)}.`,
      }[r.status];
      return `${head}\n${c['function evaluations'] || 0} function evaluations and ${c['derivative evaluations'] || 0} derivative evaluations (each step needs one of each).`;
    },
    experiment: {
      title: 'Function evaluations as the tolerance tightens',
      note: 'Each point is a real run with the tolerance set to 10 to the power −d. The count is evaluations of f; Newton\'s method also makes the same number of derivative evaluations, which are not included. On x² − 2 and Newton\'s cubic the count barely grows, because each step about doubles the correct digits. On the triple root it grows in a straight line. The stepped line is the exact cost of bisection from a bracket of width 1.',
      metric: 'function evaluations',
      metricLabel: 'Function evaluations',
      sizeLabel: 'Decimal digits of accuracy asked for (d)',
      sizes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      variants: [
        { id: 'sqrt2', label: 'x² − 2 from x₀ = 1' },
        { id: 'cubic', label: 'x³ − 2x − 5 from x₀ = 2' },
        { id: 'triple', label: '(x − 2)³ from x₀ = 3.5 (triple root)' },
      ],
      input: (d, variant) => ({ fn: variant, tolerance: Math.pow(10, -d), x0: functionById[variant].x0, maxSteps: 500 }),
      theory: [
        { label: 'Bisection from a bracket of width 1: 2 + ⌈log₂(10^d)⌉', fn: (d) => 2 + Math.ceil(d * Math.log2(10)) },
      ],
    },
  },

  logic: {
    intuition: 'Seen from close enough, a smooth curve looks like a straight line. A straight line is easy: you can compute exactly where it crosses zero. Newton\'s method replaces the curve by the straight line that fits it best at the current guess, solves that easy problem, and uses the answer as the next guess. The closer the guess, the better the line fits, so the improvement accelerates.',
    steps: [
      'Choose a starting guess x.',
      'Evaluate the function at x. If it is exactly zero, x is a root. Stop.',
      'Evaluate the derivative at x. This is the slope of the tangent line. If it is zero the tangent is horizontal and the method cannot continue.',
      'Compute the step: the function value divided by the slope. Subtract it from x. The result is where the tangent line crosses zero.',
      'If the step was no larger than the tolerance, accept the new x. Otherwise repeat from step 2, giving up after a set number of steps.',
    ],
    pseudocode: [
      'newton(f, f′, x, tol, max_steps):',
      '  repeat max_steps times:',
      '    y ← f(x)',
      '    if y = 0: return x',
      '    slope ← f′(x)',
      '    if slope = 0: fail (horizontal tangent)',
      '    step ← y / slope',
      '    x ← x − step',
      '    if |step| ≤ tol: return x',
      '  fail (did not converge)',
    ],
    decisions: [
      { title: 'Where to start?', text: 'This is the decision that matters most. Convergence is only guaranteed from a start close enough to the root, and how close is enough depends on the function. Use knowledge of the problem, a plot, a coarse scan, or a few steps of bisection to get near first.' },
      { title: 'When to stop?', text: 'This page stops when the size of the last step is no more than the tolerance. Near a simple root the last step is a good estimate of the error before it was taken, and the error after it is far smaller. Testing |f(x)| instead is weaker, because on a flat curve the function can be tiny far from the root. A step limit is always needed as well, since nothing guarantees convergence.' },
      { title: 'Where does the derivative come from?', text: 'From a formula, from automatic differentiation, or from a finite-difference estimate. If none is convenient, the secant method replaces the tangent with the line through the last two guesses and needs no derivative at all.' },
    ],
    invariants: [
      'Each new guess is the exact root of the tangent line at the previous guess. No invariant guarantees progress toward the root of f itself; that depends on the function and the start.',
    ],
    edgeCases: [
      'The derivative is zero at a guess: the tangent is horizontal and the step is undefined. A derivative that is merely tiny produces a huge step instead.',
      'A cycle: the guesses repeat without converging. The function x³ − 2x + 2 from a start of 0 alternates between 0 and 1.',
      'Divergence: each step lands farther from the root. On arctan(x) this happens from any start beyond about 1.39 on either side.',
      'A multiple root, where the curve touches zero flat, such as (x − 2)³: the method still converges but only linearly, and it loses accuracy because both f and f′ become tiny.',
      'Several roots: the method converges to one of them, not necessarily the nearest to the starting guess.',
      'A starting guess that is already a root: the function value is zero and the method returns at once.',
    ],
    correctness: 'Newton\'s method does not always converge, so what can be proved is conditional. Suppose r is a simple root, meaning f(r) = 0 and f′(r) ≠ 0, and f has a continuous second derivative near r. Then there is an interval around r such that from any start inside it the guesses converge to r, and the error is roughly squared at each step: the new error is about f″(r) / (2f′(r)) times the square of the old one. Outside that interval nothing is promised. The step-size stopping test is justified by the same result: once convergence is quadratic, the last step is almost exactly the error that step removed.',
    mistakes: [
      'Adding the step instead of subtracting it. The update is x − f(x)/f′(x).',
      'Using a derivative that does not match the function, for example after editing one and forgetting the other. The method then converges slowly or to the wrong place.',
      'Leaving out the step limit. A cycle then becomes an infinite loop.',
      'Stopping when |f(x)| is small and reporting many correct digits. At a multiple root the function is tiny long before x is accurate.',
      'Assuming the root found is the one nearest the start.',
    ],
  },

  code: {
    sample: {
      input: 'Solve x² − 2 = 0 from the starting guess x = 1 with a tolerance of 10⁻⁹.',
      expected: 'step 1: x = 1.500000000000\nstep 2: x = 1.416666666667\nstep 3: x = 1.414215686275\nstep 4: x = 1.414213562375\nstep 5: x = 1.414213562373\nroot = 1.414213562373',
    },
    python: {
      source: `def newton(f, df, x, tol, max_steps=50):
    for step in range(1, max_steps + 1):
        y = f(x)
        if y == 0:
            return x
        slope = df(x)
        if slope == 0:
            raise ZeroDivisionError("horizontal tangent: no next guess")
        change = y / slope
        x -= change
        print(f"step {step}: x = {x:.12f}")
        if abs(change) <= tol:
            return x
    raise RuntimeError("did not converge")


def f(x):
    return x * x - 2


def df(x):
    return 2 * x


root = newton(f, df, 1.0, 1e-9)
print(f"root = {root:.12f}")`,
      notes: [
        { line: 2, text: 'The step limit. Newton\'s method can cycle or diverge, so the loop must be bounded.' },
        { line: 7, text: 'A zero slope means the tangent is horizontal and never reaches zero. Dividing by it would fail, so the function reports the problem instead.' },
        { line: 9, text: 'The correction: how far off the value is, divided by how fast the value changes. This is where the tangent line crosses zero, measured from x.' },
        { line: 12, text: 'Stop when the latest correction is no larger than the tolerance. Near a simple root the answer is then far more accurate than the tolerance.' },
      ],
    },
    javascript: {
      source: `function newton(f, df, x, tol, maxSteps = 50) {
  for (let step = 1; step <= maxSteps; step++) {
    const y = f(x);
    if (y === 0) return x;
    const slope = df(x);
    if (slope === 0) throw new Error("horizontal tangent: no next guess");
    const change = y / slope;
    x -= change;
    console.log("step " + step + ": x = " + x.toFixed(12));
    if (Math.abs(change) <= tol) return x;
  }
  throw new Error("did not converge");
}

const f = (x) => x * x - 2;
const df = (x) => 2 * x;

const root = newton(f, df, 1, 1e-9);
console.log("root = " + root.toFixed(12));`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>
#include <stdexcept>

double f(double x) { return x * x - 2; }
double df(double x) { return 2 * x; }

double newton(double x, double tol, int max_steps = 50) {
    for (int step = 1; step <= max_steps; ++step) {
        double y = f(x);
        if (y == 0) return x;
        double slope = df(x);
        if (slope == 0) throw std::runtime_error("horizontal tangent: no next guess");
        double change = y / slope;
        x -= change;
        std::printf("step %d: x = %.12f\\n", step, x);
        if (std::fabs(change) <= tol) return x;
    }
    throw std::runtime_error("did not converge");
}

int main() {
    double root = newton(1.0, 1e-9);
    std::printf("root = %.12f\\n", root);
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Each step costs one evaluation of the function and one of its derivative. The number of steps depends on the function and the start, not on any input size. Near a simple root the error is roughly squared each step, so the number of correct digits doubles and the step count grows only with the logarithm of the number of digits wanted.',
    cases: [
      { case: 'Simple root, good start', time: 'O(log log(1/ε)) steps', when: 'Quadratic convergence. Going from 8 correct digits to 16 takes one step.' },
      { case: 'Multiple root', time: 'O(log(1/ε)) steps', when: 'The curve touches zero flat. Convergence is linear: at a root of multiplicity m the error shrinks by the factor (m − 1)/m per step.' },
      { case: 'Poor start', time: 'May never converge', when: 'The guesses can cycle, diverge, or reach a point of zero slope.' },
    ],
    space: 'O(1) for one equation in one unknown: the current guess.',
    memory: 'For systems of n equations the method needs the n × n matrix of partial derivatives and solves a linear system at each step. That cost, not the number of steps, is what limits its use on very large problems.',
    tradeoffs: 'Compared with bisection, Newton\'s method takes far fewer steps but needs a derivative, costs two evaluations per step instead of one, and offers no guarantee. Counting each derivative as one evaluation, its efficiency per evaluation is that of a method that multiplies the correct digits by about 1.41, which is lower than the secant method\'s 1.62 per evaluation.',
    assumptions: [
      'Quadratic convergence assumes f is twice continuously differentiable, the root is simple (f′ is not zero there), and the start is close enough.',
      'ε is the target accuracy of x.',
      'Cost is counted in evaluations of f and f′. This page counts them separately: "function evaluations" are evaluations of f only.',
      'In floating point the doubling stops at about 16 decimal digits, the precision of a double.',
    ],
  },

  tradeoffs: {
    excels: [
      'Smooth functions with a known derivative and a good starting guess.',
      'Polishing an answer: turning an estimate with a few correct digits into one correct to machine precision in two or three steps.',
      'Problems solved repeatedly with small changes, where the previous answer is an excellent starting guess.',
    ],
    struggles: [
      'Poor starting guesses. Far from the root the tangent can point anywhere.',
      'Functions with flat stretches, sharp bends or points where the derivative is zero near the path of the guesses.',
      'Multiple roots, where convergence drops to linear.',
      'Functions whose derivative is unavailable or expensive.',
    ],
    pitfalls: [
      'No step limit, so a cycle hangs the program.',
      'A derivative that is nearly zero, which throws the guess far away.',
      'Trusting a small function value as proof of an accurate root.',
      'A hand-written derivative that is wrong. Check it against a finite difference.',
    ],
    misunderstandings: [
      "\"Newton's method always converges if you run it long enough.\" It can cycle for ever or run off to infinity. Convergence is only guaranteed from a start close enough to a simple root.",
      "\"It converges to the root nearest the starting guess.\" The first tangent can send the guess past several roots. Which root is reached can depend on the start in a very irregular way.",
      "\"Doubling the digits each step is a property of the method.\" It is a property of the method near a simple root of a smooth function. At a multiple root the gain per step is a fixed fraction, as with bisection.",
      "\"A tighter tolerance costs many more steps.\" Once convergence is quadratic, asking for twice as many digits costs about one more step.",
    ],
    constraints: [
      'Library solvers rarely use bare Newton steps. They add safeguards: a bracket to fall back on, or a line search that shortens a step when it fails to reduce |f|.',
      'For systems of equations the cost of forming and solving with the derivative matrix dominates, which motivates quasi-Newton methods that approximate it.',
    ],
    alternatives: [
      { id: 'bisection-method', name: 'Bisection Method', when: 'You have a bracket and need a guaranteed answer, or the function is not smooth.' },
      { name: 'Secant method', when: 'No derivative is available. Uses the line through the last two guesses; converges a little more slowly per step but needs one evaluation per step.' },
      { name: 'Brent\'s method', when: 'A bracket is known and you want speed with a guarantee, without derivatives.' },
      { id: 'gradient-descent', name: 'Gradient Descent', when: 'The goal is to minimize a function of very many variables, where second derivatives are too costly to use.' },
    ],
    comparison: {
      columns: ['', 'Newton\'s method', 'Bisection', 'Secant method'],
      rows: [
        ['Needs', 'A starting guess and the derivative', 'A bracket with a sign change', 'Two starting guesses'],
        ['Evaluations per step', 'One of f and one of f′', 'One of f', 'One of f'],
        ['Speed near a simple root', 'Correct digits roughly double each step', 'Error bound halves each step', 'Correct digits grow by a factor of about 1.6 each step'],
        ['Guaranteed to converge', 'No', 'Yes, for continuous f', 'No'],
        ['Extends to many variables', 'Yes, with a matrix of derivatives', 'No', 'Yes, as quasi-Newton methods'],
      ],
    },
  },

  applications: [
    { title: 'Circuit simulation', status: 'established', text: 'A circuit containing diodes and transistors is described by nonlinear equations. SPICE-type simulators solve them with the many-variable form of Newton\'s method, relinearizing the circuit at each step.' },
    { title: 'Implicit solvers for differential equations', status: 'established', text: 'Stiff problems are integrated with implicit methods, which require solving a nonlinear equation for the next state at every time step. Newton iterations are the standard way to do it.' },
    { title: 'High-precision division and square roots', status: 'established', text: 'Newton\'s method applied to 1/x − a = 0 computes a reciprocal using only multiplication and subtraction, and the number of correct digits doubles each step. This is a standard technique in multiple-precision arithmetic.' },
    { title: 'Fitting statistical models', status: 'established', text: 'Logistic regression is fitted by iteratively reweighted least squares, which is exactly Newton\'s method applied to the equations that set the gradient of the log-likelihood to zero. Other generalized linear models use the same scheme or a close variant of it.' },
    { title: 'Implied volatility', status: 'established', text: 'An option\'s market price is known and the volatility that would produce it is not. No formula inverts the pricing model, so the volatility is found by root finding. Newton\'s method is a natural fit when the derivative of price with respect to volatility has a closed form.' },
  ],

  connections: [
    { to: 'bisection-method', type: 'same-problem', why: 'Both solve f(x) = 0. Bisection uses only the sign of f and is guaranteed; Newton\'s method uses the value and the slope and is much faster when it works. Hybrid solvers combine them.' },
    { to: 'gradient-descent', type: 'related', why: 'Both improve a guess using derivative information at the current point. Gradient descent takes a step of fixed scale against the slope; Newton\'s method on the derivative divides by the curvature, which sets the step length automatically.' },
    { to: 'concept:derivative', type: 'prerequisite', why: 'The method consists of replacing the function by its tangent line, which is defined by the derivative.' },
    { to: 'concept:convergence', type: 'prerequisite', why: 'Newton\'s method is the standard example of quadratic convergence, and of convergence that holds only near the answer.' },
    { to: 'concept:floating-point', type: 'advanced', why: 'The doubling of correct digits stops at the precision of the number format, and near a multiple root rounding in f limits the accuracy that can be reached.' },
    { to: 'backpropagation', type: 'related', why: 'Both depend on computing derivatives exactly and cheaply. Automatic differentiation supplies the derivative Newton\'s method needs for functions defined by programs.' },
    { to: 'euler-method', type: 'application', why: 'The implicit version of Euler\'s method defines each new state by an equation that must be solved, and Newton\'s method is what solves it.' },
    { to: 'discipline:optimization', type: 'application', why: 'A minimum of a smooth function is a root of its derivative. Newton\'s method there converges quadratically and is the basis of second-order and quasi-Newton optimizers.' },
    { to: 'discipline:finance', type: 'application', why: 'Implied quantities such as volatility and yield are defined as roots of pricing equations.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'What does one step of Newton\'s method do, in terms of the picture?',
      options: ['Halves an interval that contains the root', 'Follows the tangent line at the current guess to the point where it crosses zero', 'Moves a fixed distance toward lower values of the function', 'Draws a line through the last two guesses'],
      answer: 1,
      explain: [
        'That is bisection. Newton\'s method keeps a single guess, not an interval.',
        'Correct. The curve is replaced by its tangent line, and the root of that line becomes the next guess.',
        'The step length is not fixed. It is the function value divided by the slope.',
        'That is the secant method, which avoids the derivative.',
      ],
    },
    {
      type: 'predict',
      q: 'Newton\'s method is run on x³ − 2x + 2 from the starting guess 0. At x = 0 the value is 2 and the slope is −2. At x = 1 the value is 1 and the slope is 1. What happens?',
      options: ['It converges to the root near −1.77 in a few steps', 'The guesses alternate between 0 and 1 for ever', 'The guesses run off to infinity', 'It stops at once because the slope is zero'],
      answer: 1,
      explain: [
        'It would from a start such as −2, but not from 0.',
        'Correct. From 0 the step is 2 ÷ (−2) = −1, giving 0 − (−1) = 1. From 1 the step is 1 ÷ 1 = 1, giving 1 − 1 = 0. The guesses are back where they started.',
        'The guesses stay bounded: they only ever visit 0 and 1.',
        'The slope at 0 is −2, not zero.',
      ],
      tryInput: { fn: 'cycle', x0: 0, tolerance: 1e-6, maxSteps: 8 },
    },
    {
      type: 'debug',
      q: 'This loop moves away from the root of x² − 2 instead of toward it. What is wrong?',
      code: `x = 1.0
for step in range(20):
    y = x * x - 2
    slope = 2 * x
    x = x + y / slope`,
      options: ['The slope should be x * x', 'The update adds the correction; it must subtract it', 'The loop needs more than 20 steps', 'y should be divided by 2'],
      answer: 1,
      explain: [
        'The derivative of x² − 2 is 2x, as written.',
        'Correct. The tangent crosses zero at x − y/slope. With a plus sign each step moves the opposite way.',
        'More steps of a wrong update only move farther away.',
        'There is no such factor in the update.',
      ],
    },
    {
      type: 'choice',
      q: 'Newton\'s method is converging to a simple root and the current guess is off by about 0.001. Roughly how far off is the next guess likely to be?',
      options: ['About 0.0005', 'About 0.0001', 'About 0.000001, give or take a constant factor', 'Exactly zero'],
      answer: 2,
      explain: [
        'Halving the error is what bisection does.',
        'Gaining one digit per step would be linear convergence.',
        'Correct. Near a simple root the new error is a constant times the square of the old one, and 0.001 squared is 0.000001.',
        'The tangent is only an approximation to the curve, so some error remains.',
      ],
    },
    {
      type: 'challenge',
      title: 'Newton with a safety net',
      prompt: 'Write a root finder that takes a bracket [a, b] with a sign change as well as the function and its derivative. At each step try a Newton step from the current guess. If the result lands outside the bracket, or the bracket did not shrink to less than half its previous width, take a bisection step instead. After every step, shrink the bracket using the sign of f at the new guess. Test it on x³ − 2x + 2 with the bracket [−2, 0] starting from x = 0, where plain Newton cycles, and on arctan(x) with the bracket [−1, 2] starting from 1.5, where plain Newton diverges.',
      hints: ['Keep the invariant that f(a) and f(b) have opposite signs, exactly as in bisection.', 'A Newton step x − f(x)/f′(x) lies inside the bracket when (x − a) × f′(x) − f(x) and (x − b) × f′(x) − f(x) have opposite signs, which avoids a division when the slope is near zero.'],
    },
  ],

  compare: {
    idea: 'Replace the curve by its tangent line at the current guess and jump to where that line crosses zero.',
    requires: 'A differentiable function, its derivative, and a starting guess near the root. Convergence is not guaranteed.',
    sensitivity: 'Very high to the starting guess: the same function can converge in five steps, cycle or diverge.',
    memory: 'O(1) in one variable. An n × n derivative matrix for systems of n equations.',
    difficulty: 'low',
    difficultyNote: 'The loop is a few lines. The difficulty is supplying a correct derivative and a good start, and handling failure.',
    limits: 'Can cycle or diverge. Slows to linear at multiple roots. Needs the derivative.',
    useWhen: 'The function is smooth, the derivative is available and you can start close to the root.',
  },

  advanced: {
    history: 'Isaac Newton described the method around 1669, applying it to the polynomial x³ − 2x − 5 = 0 that appears in this lesson\'s function list. His procedure worked with a sequence of polynomials and did not use derivatives explicitly. Joseph Raphson published a simpler version in 1690 that repeats one formula on successive guesses, which is why the method is also called Newton-Raphson. Thomas Simpson gave the formulation in terms of calculus, for general equations, in 1740. For x² = a the iteration reduces to averaging x with a/x, a rule for square roots known since antiquity. The history is traced in the paper by Ypma listed in the references.',
    derivation: 'Expand $f$ about the current guess $x_k$ and keep the linear terms:\n\n$$f(x) \\approx f(x_k) + f\'(x_k)\\,(x - x_k).$$\n\nSetting the right-hand side to zero and solving for $x$ gives the next guess:\n\n$$x_{k+1} = x_k - \\frac{f(x_k)}{f\'(x_k)}.$$\n\nFor $f(x) = x^2 - a$ this is $x_{k+1} = \\tfrac{1}{2}\\left(x_k + \\frac{a}{x_k}\\right)$, the averaging rule for square roots.',
    proof: 'Let $r$ be a root with $f\'(r) \\ne 0$, let $f$ be twice continuously differentiable, and write $e_k = x_k - r$. Taylor\'s theorem about $x_k$ gives\n\n$$0 = f(r) = f(x_k) - f\'(x_k)\\,e_k + \\tfrac{1}{2} f\'\'(\\xi_k)\\,e_k^2$$\n\nfor some $\\xi_k$ between $r$ and $x_k$. Dividing by $f\'(x_k)$ and using the definition of $x_{k+1}$:\n\n$$e_{k+1} = \\frac{f\'\'(\\xi_k)}{2 f\'(x_k)}\\,e_k^2.$$\n\nIf $|f\'\'|/(2|f\'|) \\le M$ on an interval around $r$ and $M|e_0| < 1$, then $M|e_{k+1}| \\le (M|e_k|)^2$, so the errors tend to zero and each is about the square of the one before. For $f(x) = x^2 - 2$ the relation is exact: $e_{k+1} = e_k^2 / (2x_k)$.',
    complexityProof: 'From $M|e_k| \\le (M|e_0|)^{2^k}$, reaching $|e_k| \\le \\varepsilon$ needs $2^k \\ge \\log(M\\varepsilon)/\\log(M|e_0|)$, that is $k = O(\\log\\log(1/\\varepsilon))$ steps. At a root of multiplicity $m > 1$, $f(x) \\approx c\\,(x - r)^m$ near $r$, so $f/f\' \\approx (x - r)/m$ and $e_{k+1} \\approx \\frac{m-1}{m}\\,e_k$: linear convergence. For the triple root in this lesson the factor is exactly $2/3$.',
    variants: [
      { name: 'Secant method', text: 'Replaces the derivative with the slope of the line through the last two guesses. One function evaluation per step, and the correct digits grow by a factor of about 1.618 per step.' },
      { name: 'Newton\'s method for systems', text: 'For n equations in n unknowns the slope becomes the Jacobian matrix, and each step solves a linear system for the correction.' },
      { name: 'Damped Newton and line search', text: 'Takes only a fraction of the Newton step when the full step fails to reduce |f|. This enlarges the set of starting points that converge.' },
      { name: 'Quasi-Newton methods', text: 'Build up an approximation to the derivative matrix from the steps taken, avoiding its direct computation. Broyden\'s method for equations and BFGS for optimization are the best known.' },
      { name: 'Modified Newton for multiple roots', text: 'Multiplying the step by the multiplicity m restores quadratic convergence at a root of known multiplicity.' },
      { name: 'Halley\'s method', text: 'Uses the second derivative as well and triples the number of correct digits per step near a simple root.' },
    ],
    implementation: 'Always bound the number of steps. Guard against a zero or tiny derivative. If a bracket is known, keep it and reject any Newton step that leaves it. Check a hand-coded derivative against a central difference before trusting results. When the function is expensive, remember that each step costs a derivative evaluation too.',
    benchmarking: 'Report function and derivative evaluations separately, along with the starting guess and the stopping rule. Step counts for Newton\'s method on one starting guess say little about another, so test a range of starts, including poor ones.',
    references: [
      { authors: 'R. L. Burden and J. D. Faires', year: 2011, title: 'Numerical Analysis (9th edition)', venue: 'Brooks/Cole, Cengage Learning' },
      { authors: 'W. H. Press, S. A. Teukolsky, W. T. Vetterling and B. P. Flannery', year: 2007, title: 'Numerical Recipes: The Art of Scientific Computing (3rd edition)', venue: 'Cambridge University Press' },
      { authors: 'T. J. Ypma', year: 1995, title: 'Historical development of the Newton-Raphson method', venue: 'SIAM Review 37(4), 531-551' },
    ],
    furtherReading: [
      'Burden and Faires, *Numerical Analysis*, section 2.3, "Newton\'s Method and Its Extensions".',
      'Press et al., *Numerical Recipes*, chapter 9, "Root Finding and Nonlinear Sets of Equations", which includes a Newton method safeguarded by bisection.',
      'J. Nocedal and S. J. Wright, *Numerical Optimization*, for Newton and quasi-Newton methods in many variables.',
    ],
  },

  tests: [
    { name: 'the worked example: guesses 1, 3/2, 17/12, 577/408, converging to the square root of 2 in 5 steps', input: { fn: 'sqrt2', x0: 1, tolerance: 1e-6, maxSteps: 20 },
      check: (r, c) => {
        const want = [1, 3 / 2, 17 / 12, 577 / 408];
        const bad = want.findIndex((w, i) => Math.abs(r.xs[i] - w) > 1e-14);
        if (bad >= 0) return `guess ${bad} is ${r.xs[bad]}, expected ${want[bad]}`;
        if (r.status !== 'converged' || r.iterations !== 5) return `status ${r.status} after ${r.iterations} steps`;
        if (Math.abs(r.root - Math.SQRT2) > 1e-15) return `root ${r.root}`;
        return (c['function evaluations'] === 5 && c['derivative evaluations'] === 5) || `counted ${c['function evaluations']} f and ${c['derivative evaluations']} f′ evaluations`;
      } },
    { name: 'the error is squared each step on x² − 2: e(k+1) = e(k)² / (2 x(k))', input: { fn: 'sqrt2', x0: 1, tolerance: 1e-12, maxSteps: 20 },
      check: (r) => {
        for (let k = 0; k < 3; k++) {
          const e = r.xs[k] - Math.SQRT2, next = r.xs[k + 1] - Math.SQRT2;
          if (Math.abs(next - (e * e) / (2 * r.xs[k])) > 1e-12) return `step ${k}: error ${next} does not match e²/(2x)`;
        }
        return true;
      } },
    { name: 'converges to the known root of every well-started catalogue function', input: { fn: 'cosx', x0: 1, tolerance: 1e-10, maxSteps: 50 },
      check: (r0) => {
        if (r0.status !== 'converged' || Math.abs(r0.root - 0.7390851332151607) > 1e-12) return `cos(x) − x: ${r0.status}, ${r0.root}`;
        for (const [fn, x0] of [['cubic', 2], ['cycle', -2], ['atan', 1.2], ['sqrt2', 4], ['sqrt2', -3]]) {
          const r = run({ fn, x0, tolerance: 1e-10, maxSteps: 50 }, quiet);
          const want = fn === 'sqrt2' && x0 < 0 ? -Math.SQRT2 : functionById[fn].root;
          if (r.status !== 'converged' || Math.abs(r.root - want) > 1e-9) return `${fn} from ${x0}: ${r.status}, ended at ${r.lastX}`;
        }
        return true;
      } },
    { name: 'the quiz prediction: x³ − 2x + 2 from 0 cycles between 0 and 1', input: { fn: 'cycle', x0: 0, tolerance: 1e-6, maxSteps: 8 },
      check: (r) => (r.status === 'cycle' && r.root === null && r.xs.every((v, i) => v === i % 2)) || `status ${r.status}, guesses ${r.xs.join(', ')}` },
    { name: 'arctan diverges from 1.5 and converges from 1.2', input: { fn: 'atan', x0: 1.5, tolerance: 1e-6, maxSteps: 6 },
      check: (r) => {
        if (r.status !== 'diverged' || !(Math.abs(r.lastX) > 1e6)) return `from 1.5: status ${r.status}, last guess ${r.lastX}`;
        const long = run({ fn: 'atan', x0: 1.5, tolerance: 1e-6, maxSteps: 100 }, quiet);
        if (long.status !== 'diverged') return `from 1.5 with 100 steps: status ${long.status}`;
        const near = run({ fn: 'atan', x0: 1.2, tolerance: 1e-6, maxSteps: 20 }, quiet);
        return (near.status === 'converged' && Math.abs(near.root) < 1e-9) || `from 1.2: status ${near.status}`;
      } },
    { name: 'a horizontal tangent is reported, not divided by', input: { fn: 'sqrt2', x0: 0, tolerance: 1e-6, maxSteps: 20 },
      check: (r) => (r.status === 'flat' && r.iterations === 0 && r.root === null) || `status ${r.status}` },
    { name: 'a triple root converges linearly with ratio 2/3', input: { fn: 'triple', x0: 3.5, tolerance: 1e-6, maxSteps: 60 },
      check: (r) => {
        if (r.status !== 'converged') return `status ${r.status}`;
        for (let k = 0; k < 10; k++) {
          const ratio = (r.xs[k + 1] - 2) / (r.xs[k] - 2);
          if (Math.abs(ratio - 2 / 3) > 1e-9) return `step ${k}: ratio ${ratio}`;
        }
        const short = run({ fn: 'triple', x0: 3.5, tolerance: 1e-6, maxSteps: 20 }, quiet);
        return short.status === 'budget' || `with 20 steps: status ${short.status}`;
      } },
    { name: 'a starting guess that is already a root returns without a step', input: { fn: 'triple', x0: 2, tolerance: 1e-6, maxSteps: 20 },
      check: (r, c) => (r.status === 'converged' && r.root === 2 && r.iterations === 0 && c['function evaluations'] === 1 && !c['derivative evaluations']) || `status ${r.status}, ${r.iterations} steps` },
  ],
};
