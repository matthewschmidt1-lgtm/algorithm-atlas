import { odeById, odeInputs, stepCount, errorNorm, exactCurve, plotRange } from '../../js/lib/odes.js';

const BLOW_UP = 1e6;

// Plain decimal formatting for notes: about `sig` significant digits.
function num(v, sig = 4) {
  if (!Number.isFinite(v)) return 'not a finite number';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e9 || a < 1e-9) {
    const [m, e] = v.toExponential(2).split('e');
    return `${m.replace('-', '−')} × 10^${Number(e)}`.replace('^-', '^−');
  }
  let s = v.toFixed(Math.max(0, Math.min(12, sig - 1 - Math.floor(Math.log10(a)))));
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('-', '−');
}
const tnum = (v) => num(Math.round(v * 1e9) / 1e9, 6);

function run(input, t) {
  const S = odeById[input.system];
  if (!S) throw new Error('Unknown system.');
  const h = input.dt, T = input.duration;
  if (!(h > 0) || !(T > 0)) throw new Error('The step size and the duration must be greater than zero.');
  const n = stepCount(T, h);
  if (n < 1) throw new Error(`A step of ${num(h)} is longer than the whole duration of ${num(T)}. Shorten the step or lengthen the duration.`);
  if (n > 200000) throw new Error('That is more than 200,000 steps. Use a larger step or a shorter duration.');
  const two = S.dim === 2;
  let y = S.y0.slice();
  const ts = [0], ys = [y.slice()], errors = [0];
  let maxError = 0, maxErrorAt = 0, status = 'completed';
  let exactSize = Math.hypot(...S.y0);         // largest size the exact solution reaches at a step
  const detail = n <= 30;
  const stride = detail ? 1 : Math.ceil(n / 120);
  const state = (v) => (two ? `${S.names[0]} = ${num(v[0])}, ${S.names[1]} = ${num(v[1])}` : `${S.names[0]} = ${num(v[0])}`);

  const views = (slope = null) => {
    const i = ys.length - 1, tn = ts[i], yn = ys[i];
    const pts = ts.map((tt, j) => [tt, ys[j][0]]);
    const base = plotRange(S, T);
    let lo = base[0], hi = base[1];
    const fit = (v) => { if (v < lo) lo = v; if (v > hi) hi = v; };
    for (const p of pts) fit(p[1]);
    if (slope) fit(yn[0] + h * slope[0]);
    if (lo < base[0] || hi > base[1]) { const pad = 0.06 * (hi - lo); lo -= pad; hi += pad; }
    lo = Math.max(lo, -BLOW_UP * 1.1); hi = Math.min(hi, BLOW_UP * 1.1);
    const layers = [];
    if (lo < 0 && hi > 0) layers.push({ type: 'segments', segments: [[0, 0, T, 0]], role: 'muted', width: 1 });
    layers.push({ type: 'line', points: exactCurve(S, T), role: 'forest', width: 2.4 });
    layers.push({ type: 'line', points: pts, role: 'active', width: 2 });
    if (n <= 80) layers.push({ type: 'points', points: pts, role: 'active', r: 2.8 });
    const ex = S.exact(tn)[0];
    if (i > 0) layers.push({ type: 'segments', segments: [[tn, yn[0], tn, ex]], role: 'alert', width: 2.2 });
    if (slope) layers.push({ type: 'segments', segments: [[tn, yn[0], tn + h, yn[0] + h * slope[0]]], role: 'compare', width: 2.4, arrow: true });
    layers.push({ type: 'points', points: [[tn, yn[0]]], role: 'active', r: 5.5, ring: true });
    const top = Math.max(...errors.map((e) => (Number.isFinite(e) ? Math.min(e, BLOW_UP) : 0)), 1e-12);
    return [
      { kind: 'scene', title: two ? `${S.label}. The plot shows the position x over time` : S.label, x: [0, T], y: [lo, hi], aspect: 0.5, axes: { xLabel: 'time t', yLabel: S.names[0] }, layers,
        legend: [{ label: 'exact solution', role: 'forest' }, { label: 'Euler\'s approximation', role: 'active' }, { label: 'slope being followed for one step', role: 'compare' }, { label: 'gap to the exact solution', role: 'alert' }] },
      { kind: 'scene', title: two ? 'Error at each step: distance from the exact position and velocity' : 'Error at each step: distance from the exact solution', x: [0, T], y: [0, top * 1.12], aspect: 0.2, axes: { xLabel: 'time t' },
        layers: [{ type: 'line', points: errors.map((e, j) => [ts[j], Math.min(e, BLOW_UP)]), role: 'alert', width: 2 }] },
    ];
  };
  const vars = (i) => {
    const out = { t: tnum(ts[i]) };
    S.names.forEach((name, j) => { out[name] = num(ys[i][j]); });
    if (S.energy) out.energy = num(S.energy(ys[i]));
    out.error = num(errors[i], 3);
    return out;
  };

  t.frame(() => ({ line: [0, 1],
    note: `The rule of change: ${S.rule}. Start at time 0 with ${state(y)}. The green curve is the exact solution, shown for comparison; normally it is not known. Euler's method will take ${n} step${n === 1 ? '' : 's'} of ${num(h)}.`,
    views: views(), vars: vars(0) }));

  for (let i = 0; i < n; i++) {
    const tn = i * h;
    const slope = S.f(tn, y); t.count('derivative evaluations');
    const before = y;
    if (detail) {
      t.frame(() => ({ line: 3,
        note: two
          ? `At time ${tnum(tn)}, ${state(before)}. The rule gives the rates of change here: ${S.names[0]} is changing at ${num(slope[0])} and ${S.names[1]} at ${num(slope[1])}. The arrow shows where that leads if the rates hold for one step.`
          : `At time ${tnum(tn)} the value is ${num(before[0])}. The rule gives the rate of change here: **${num(slope[0])}**. The arrow shows where that rate leads if it holds for one step of ${num(h)}.`,
        views: views(slope), vars: vars(i) }));
    }
    y = before.map((v, j) => v + h * slope[j]);
    const tNext = (i + 1) * h;
    const exact = S.exact(tNext);
    const err = y.every(Number.isFinite) ? errorNorm(y, exact) : Infinity;
    ts.push(tNext); ys.push(y.slice()); errors.push(err);
    if (err > maxError) { maxError = err; maxErrorAt = tNext; }
    exactSize = Math.max(exactSize, Math.hypot(...exact));
    const k = i + 1, now = y;
    if (!(err < BLOW_UP)) {
      status = 'blew-up';
      t.frame(() => ({ line: [4, 5],
        note: `After step ${k} the computed value has passed one million in size while the exact solution stays small. With a step of ${num(h)} every step makes the error larger, so the run stops here. The method is **unstable** at this step size.`,
        views: views(), vars: vars(k) }));
      break;
    }
    if (detail) {
      t.frame(() => ({ line: [4, 5],
        note: two
          ? `Step ${k}: ${S.names[0]} becomes ${num(before[0])} + ${num(h)} × (${num(slope[0])}) = **${num(now[0])}** and ${S.names[1]} becomes ${num(before[1])} + ${num(h)} × (${num(slope[1])}) = **${num(now[1])}**. The exact values at time ${tnum(tNext)} are ${num(exact[0])} and ${num(exact[1])}, so the error is ${num(err, 3)}.${S.energy ? ` The energy is now ${num(S.energy(now))}; it should stay at ${num(S.energy(S.y0))}.` : ''}`
          : `Step ${k}: ${num(before[0])} + ${num(h)} × (${num(slope[0])}) = **${num(now[0])}**. The exact value at time ${tnum(tNext)} is ${num(exact[0])}, so the error is ${num(err, 3)}.`,
        views: views(), vars: vars(k) }));
    } else if (k % stride === 0 && k < n) {
      t.frame(() => ({ line: [2, 3, 4, 5],
        note: `${stride > 1 ? `Steps ${k - stride + 1} to ${k}` : `Step ${k}`}: now at time ${tnum(tNext)} with ${state(now)}. The exact solution has ${state(exact)}, so the error is ${num(err, 3)}.${S.energy ? ` Energy: ${num(S.energy(now))}.` : ''}`,
        views: views(), vars: vars(k) }));
    }
  }

  const steps = ys.length - 1;
  const tEnd = ts[steps];
  const finalError = errors[steps];
  // The error ended at its largest and exceeds the solution itself: the run is going wrong, not just drifting.
  const runaway = status === 'completed' && steps > 1 && finalError === maxError && maxError > exactSize;
  if (status === 'completed') {
    t.frame(() => ({ line: 6,
      note: `Done: ${steps} step${steps === 1 ? '' : 's'} of ${num(h)} reached time ${tnum(tEnd)}. The largest error along the way was **${num(maxError, 3)}**, at time ${tnum(maxErrorAt)}. Each step used one evaluation of the rule of change, ${steps} in all.${S.energy ? ` The energy went from ${num(S.energy(S.y0))} to ${num(S.energy(ys[steps]))}: Euler's method multiplies it by 1 + dt² on every step, so the swing keeps growing.` : ''}${runaway ? ' The error is now larger than the solution itself and still growing: at this step size the method is unstable on this system.' : ''}`,
      views: views(), vars: vars(steps) }));
  }
  if (input.measure) t.count('max error (thousandths)', Math.min(maxError, BLOW_UP) * 1000);
  return { maxError, steps, status, runaway, finalError, maxErrorAt, tEnd, ts, ys, errors, system: S.id, dt: h };
}

const quiet = { count() {}, frame() {} };

export default {
  meta: {
    id: 'euler-method',
    name: 'Euler\'s Method',
    aliases: ['forward Euler', 'explicit Euler', 'Euler integration', 'Euler step'],
    kind: 'algorithm',
    discipline: 'physics',
    alsoIn: [
      { id: 'mathematics', why: 'It is the first method of numerical analysis for differential equations, and the model on which the ideas of order, convergence and stability are defined.' },
      { id: 'computer-graphics', why: 'Animations and games advance their physics in fixed time steps, and the simplest integrators used there are Euler steps and close variants of them.' },
      { id: 'machine-learning', why: 'Gradient descent is Euler\'s method applied to the equation that says "move downhill at a rate equal to the slope". The learning rate is the step size.' },
    ],
    subfield: 'Numerical simulation',
    family: 'Time integration (one-step methods)',
    lab: 'numerical',
    compareGroup: 'ode-integration',
    year: 1768,
    authors: 'Leonhard Euler',
    summary: 'Follows a differential equation forward in time by assuming, for each small step, that the current rate of change stays constant.',
    difficulty: 'beginner',
    order: 450,
    paradigms: ['incremental'],
    randomized: false,
    approximate: true,
    time: { best: 'O(T/dt) steps', average: 'O(T/dt) steps', worst: 'O(T/dt) steps, one derivative evaluation each', class: 'linear' },
    space: { worst: 'O(d) for a state of d numbers', class: 'linear' },
    tags: {
      problems: ['simulate motion', 'predict how something changes over time', 'solve a differential equation', 'step a simulation forward', 'integrate equations of motion', 'initial value problem'],
      techniques: ['time stepping', 'tangent line approximation', 'fixed step size', 'explicit integration'],
      applications: ['scientific computing', 'computer graphics', 'games', 'robotics', 'engineering design', 'machine learning'],
    },
    prerequisites: ['concept:derivative', 'concept:differential-equation', 'concept:discretization'],
  },

  bigIdea: {
    simple: "Euler's method predicts the future one small step at a time. Suppose you know two things about a cup of hot tea: how warm it is now, and how fast it is cooling at this moment. What will its temperature be in one minute? A simple guess is to pretend the cooling rate stays the same for that minute. Multiply the rate by one minute and take that much off. Now you have a new temperature. Cooler tea cools more slowly, so you work out the new rate and repeat for the next minute. Step by step, you trace out the whole future of the tea. Many things in nature are like this. We know the rule for how fast they change, but there is no formula for where they end up. Planets, populations and electric circuits are examples. The smaller the steps, the closer the prediction stays to the truth, and the more steps it takes. With steps that are too big, the prediction can go badly wrong.",
    what: 'A differential equation states how fast a quantity changes, given its current value and the time. Euler\'s method turns that statement into a prediction. From the current state it computes the rate of change, moves the state forward as if that rate held for a short time step dt, and repeats from the new state.',
    why: 'Most differential equations that describe real systems have no solution that can be written as a formula. The only way to find out what they predict is to compute it step by step. Euler\'s method is the simplest way to do that, and every more accurate method is built by improving on its one idea: use the slope to step forward.',
    when: 'Use it to understand a problem, to prototype, or when each step must be as cheap as possible and modest accuracy is acceptable. For accurate results choose [Runge-Kutta (RK4)](#/algorithm/runge-kutta-4), which reaches far smaller errors for the same number of derivative evaluations. For oscillating systems simulated over long times, and for equations with very fast decaying parts, use the variants built for those cases.',
    interesting: 'The step size controls two different things. It sets the accuracy: halving the step roughly halves the error. It also sets stability: above a certain step size the computed solution does not merely become inaccurate, it grows without limit while the true solution dies away. On a frictionless oscillator the method gains energy at every step for any step size at all.',
    where: 'Fixed-step integrators of this kind advance the physics in games and animation. The same update, with a random term added, simulates the random processes used in physics and finance. [Gradient descent](#/algorithm/gradient-descent) is Euler\'s method applied to the equation of steepest descent, so it also sits inside the training of every neural network.',
    analogy: {
      title: 'Navigating with only a compass and a speedometer',
      text: 'A ship out of sight of land cannot see where it is. The navigator knows the last marked position, the heading and the speed. So for the next hour the navigator draws a straight line on the chart in that direction, as long as the distance the ship would cover in an hour, and marks a new position at its end. Then the instruments are read again and the next line is drawn. The plotted course is a chain of straight segments standing in for the curved path of the real ship.',
      limits: 'The ship\'s instruments measure the real ship, wherever it truly is. Euler\'s method computes the rate of change from its own estimated position. Once the estimate has drifted, the rates it uses belong to the wrong place, so errors can feed on themselves. A navigator also sights land sooner or later and corrects the chart. Euler\'s method never receives a correction: every error it makes is carried forward to the end.',
    },
  },

  example: {
    setup: "A quantity starts at 1 and always shrinks at a rate equal to its own size. When it is 1, it is falling at a rate of 1 per unit of time. When it is 0.5, it is falling at a rate of 0.5. Predict it at times 0.5, 1, 1.5 and 2, using steps of 0.5.",
    steps: [
      "At time 0 the value is 1, so it is falling at a rate of 1. Over a step of 0.5 that removes 0.5 × 1 = 0.5. The new value is 1 − 0.5 = 0.5.",
      "At time 0.5 the value is 0.5, so it is falling at a rate of 0.5. A step of 0.5 removes 0.5 × 0.5 = 0.25. The new value is 0.25.",
      "At time 1 the value is 0.25. A step removes 0.5 × 0.25 = 0.125. The new value is 0.125.",
      "At time 1.5 the value is 0.125. A step removes 0.0625. The new value is 0.0625.",
    ],
    result: "Euler's method gives 0.5, 0.25, 0.125 and 0.0625. The true values are about 0.607, 0.368, 0.223 and 0.135. Every prediction is too low, because each step uses the rate from its start, and the true rate eases off during the step. The largest gap is 0.118, at time 1. Repeating the work with steps of 0.25 cuts the largest gap to 0.051, a little less than half.",
    tryInput: { system: 'decay', dt: 0.5, duration: 2 },
  },

  terms: [
    { term: "Rate of change", meaning: "How fast a quantity is rising or falling at one moment, such as degrees per minute." },
    { term: "Differential equation", meaning: "A rule that gives the rate of change of a quantity from its current value and the time." },
    { term: "Initial value", meaning: "The value of the quantity at the starting time. The rule of change and the initial value together fix the whole future." },
    { term: "State", meaning: "All the numbers needed to describe the system at one moment. For a swinging weight it is the position and the velocity." },
    { term: "Step size", meaning: "The length of time the method moves forward in one step, written dt." },
    { term: "Slope", meaning: "The rate of change drawn on a graph: how steeply the curve rises or falls at a point." },
    { term: "Exact solution", meaning: "The true values of the quantity at every time, which the method is trying to approximate." },
    { term: "Error", meaning: "The gap between the computed value and the exact solution at the same time." },
    { term: "Unstable", meaning: "Said of a computation whose errors grow at every step until the result is meaningless." },
  ],

  takeaway: "Assume the current rate of change holds for one short step, take the step, then measure the rate again.",

  viz: {
    describe: 'A plot of value against time. A green curve is the exact solution. A terracotta chain of straight segments, with a dot at every step, is Euler\'s approximation growing from left to right. An ochre arrow at the current point shows the slope about to be followed for one step, and a short brick-red vertical line shows the gap between the approximation and the exact solution. A second, smaller chart plots that error at every step.',
    inputs: odeInputs({ system: 'decay', dt: 0.5, duration: 5 }),
    presets: [
      { label: 'Decay, coarse steps', values: { system: 'decay', dt: 0.5, duration: 5 } },
      { label: 'Decay, steps half as long', values: { system: 'decay', dt: 0.25, duration: 5 } },
      { label: 'The worked example', values: { system: 'decay', dt: 0.5, duration: 2 } },
      { label: 'Decay, step too large: unstable', values: { system: 'decay', dt: 2.5, duration: 20 } },
      { label: 'Oscillator: energy drift', values: { system: 'oscillator', dt: 0.1, duration: 20 } },
      { label: 'Oscillator, large step', values: { system: 'oscillator', dt: 0.5, duration: 20 } },
      { label: 'Logistic growth', values: { system: 'logistic', dt: 0.5, duration: 10 } },
      { label: 'Moving target', values: { system: 'driven', dt: 0.3, duration: 12 } },
    ],
    tryThis: [
      'Run "Decay, coarse steps" and then "Decay, steps half as long". The largest error falls from 0.118 to 0.051. Halving the step roughly halves the error and doubles the number of steps. That one-for-one trade is what "first order" means.',
      'Load "Decay, step too large: unstable". With a step of 2.5 each step jumps past zero and lands farther away on the other side: 1, −1.5, 2.25, −3.4. Now set the step to 1.5. It still jumps past zero each time, but lands closer, so it settles. The boundary for this equation is a step of 2.',
      'Load "Oscillator: energy drift". The exact motion swings between −1 and 1 for ever. Euler\'s swing grows with every cycle. Make the step ten times smaller and the growth is slower, but it never stops.',
      'Choose logistic growth with a duration of 40 and raise the step size past 2. The exact solution glides up to 1 and stays there. Euler\'s values start to bounce around 1 instead of settling. The bouncing comes from the method, not from the equation.',
    ],
    run,
    report: (r, c) => `${r.status === 'blew-up' ? `Stopped after ${r.steps} steps: the computed solution blew up. The step size is too large for this system.` : `${r.steps} steps of ${num(r.dt)} reached time ${tnum(r.tEnd)}.${r.runaway ? ' The error exceeds the solution itself and was still growing at the end: unstable at this step size.' : ''}`}\nLargest error against the exact solution: ${r.status === 'blew-up' ? 'beyond one million' : `${num(r.maxError, 3)} (at time ${tnum(r.maxErrorAt)})`}.\n${c['derivative evaluations'] || 0} derivative evaluations, one per step.`,
    experiment: {
      title: 'Largest error as the number of steps grows',
      note: 'Each point is a real run over a fixed duration (5 for decay, 10 for logistic growth) with dt = duration ÷ n. The value plotted is the largest distance from the exact solution at any step, in thousandths. Doubling the number of steps roughly halves it. The curves are proportional to 1/n, scaled to the last measured point of each series.',
      metric: 'max error (thousandths)',
      metricLabel: 'Largest error (thousandths)',
      sizeLabel: 'Number of steps (n)',
      sizes: [10, 20, 40, 80, 160, 320, 640],
      variants: [
        { id: 'decay', label: 'Exponential decay' },
        { id: 'logistic', label: 'Logistic growth' },
      ],
      input: (n, variant) => ({ system: variant, duration: odeById[variant].duration, dt: odeById[variant].duration / n, measure: true }),
      theory: [
        { label: 'proportional to 1/n', fn: (n) => 1 / n, scaled: true, variant: 'decay' },
        { label: 'proportional to 1/n', fn: (n) => 1 / n, scaled: true, variant: 'logistic' },
      ],
    },
  },

  logic: {
    intuition: 'Over a short enough time, anything that changes smoothly changes at a nearly constant rate. A curve looks like a straight line when you zoom in. Euler\'s method takes that literally: it replaces the true curve, one short piece at a time, by the straight line that has the right slope at the start of the piece. The shorter the pieces, the less the true slope changes within each one, and the better the chain of lines follows the curve.',
    steps: [
      'Start at time 0 with the given initial state.',
      'Evaluate the rule of change at the current time and state. This gives the slope: the rate at which each number in the state is changing.',
      'Move every number in the state forward by the step size times its rate.',
      'Advance the time by the step size.',
      'Repeat from step 2 until the end time is reached.',
    ],
    pseudocode: [
      'euler(f, y₀, dt, steps):',
      '  t ← 0;  y ← y₀',
      '  repeat steps times:',
      '    slope ← f(t, y)',
      '    y ← y + dt · slope',
      '    t ← t + dt',
      '  return y',
    ],
    decisions: [
      { title: 'How large a step?', text: 'Small enough for the accuracy you need, and below the stability limit of the system. The error is roughly proportional to the step, so ten times more accuracy costs ten times more steps. If that is too expensive, a higher-order method is the answer, not a smaller step.' },
      { title: 'Fixed or changing step?', text: 'This page uses a fixed step. Practical solvers estimate the error of each step and shorten or lengthen the next one to keep that estimate near a target, spending effort only where the solution changes quickly.' },
      { title: 'What if the state has several numbers?', text: 'Nothing changes. The rule returns one rate for each number, and all of them are updated together from the same old state. Updating one number and then using its new value for the next is a different method with different behaviour.' },
    ],
    invariants: [
      'After k steps the stored time is k × dt and the stored state is the method\'s approximation to the solution at that time.',
      'Every number in the state is updated from the same old state: the slope is computed once, before anything moves.',
    ],
    edgeCases: [
      'Step size above the stability limit: for decay at rate 1 the limit is 2. Beyond it the computed values alternate in sign and grow.',
      'Systems that should conserve a quantity, such as the energy of a frictionless oscillator: Euler\'s method increases it at every step, for every step size.',
      'A duration that is not a whole number of steps: this page takes as many whole steps as fit and stops short of the end. Other implementations shorten the last step.',
      'Solutions that blow up in finite time, or rules that are undefined for some states: the method steps across the trouble without noticing.',
      'Extremely small steps: rounding error from the huge number of additions eventually outweighs the gain in accuracy.',
    ],
    correctness: 'Euler\'s method is correct in the sense of convergence: if the rule of change is well behaved (it does not change too abruptly as the state changes) and the exact solution is smooth, then the largest error over a fixed time span is at most a constant times dt, so it tends to zero as the step shrinks. One step commits an error proportional to dt², because the straight line and the curve separate quadratically. There are T/dt steps, so the accumulated error is proportional to dt. The constant can be very large, and it grows with the time span, which is why convergence in principle does not guarantee a useful answer at an affordable step size.',
    mistakes: [
      'Forgetting to multiply the slope by the step size, which gives answers that are right only when dt is 1.',
      'In a system, updating one variable and then using its new value when updating the next. This is the semi-implicit Euler method, a different integrator.',
      'Evaluating the rule at the new time with the old state, or the reverse.',
      'Accumulating time by repeated addition of dt and then testing for exact equality with the end time. Rounding makes the loop run one step too many or too few; count steps instead.',
      'Concluding that a simulation is accurate because it looks smooth. Rerun with half the step and compare.',
    ],
  },

  code: {
    sample: {
      input: 'Solve y′ = −y with y(0) = 1 up to t = 1, using 10, 20 and 40 steps, and compare with the exact value e⁻¹.',
      expected: 'dt = 0.100: y(1) = 0.348678, error = 0.019201\ndt = 0.050: y(1) = 0.358486, error = 0.009394\ndt = 0.025: y(1) = 0.363232, error = 0.004647',
    },
    python: {
      source: `import math


def euler(f, y, dt, steps):
    t = 0.0
    for _ in range(steps):
        slope = f(t, y)
        y = y + dt * slope
        t = t + dt
    return y


def decay(t, y):
    return -y


exact = math.exp(-1.0)
for steps in (10, 20, 40):
    dt = 1.0 / steps
    y = euler(decay, 1.0, dt, steps)
    print(f"dt = {dt:.3f}: y(1) = {y:.6f}, error = {abs(y - exact):.6f}")`,
      notes: [
        { line: 6, text: 'The loop counts steps instead of testing whether t has reached the end. Repeated addition of dt is not exact, so a comparison on t can be off by one step.' },
        { line: 7, text: 'One evaluation of the rule of change per step. This is the slope at the start of the step.' },
        { line: 8, text: 'The whole method: move forward by the step size times the slope, as if the slope stayed fixed for the step.' },
        { line: 18, text: 'Each pass halves the step. The printed error roughly halves each time, which is first-order convergence.' },
      ],
    },
    javascript: {
      source: `function euler(f, y, dt, steps) {
  let t = 0;
  for (let i = 0; i < steps; i++) {
    const slope = f(t, y);
    y = y + dt * slope;
    t = t + dt;
  }
  return y;
}

const decay = (t, y) => -y;

const exact = Math.exp(-1);
for (const steps of [10, 20, 40]) {
  const dt = 1 / steps;
  const y = euler(decay, 1, dt, steps);
  console.log("dt = " + dt.toFixed(3) + ": y(1) = " + y.toFixed(6) + ", error = " + Math.abs(y - exact).toFixed(6));
}`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>

double decay(double t, double y) { return -y; }

double euler(double (*f)(double, double), double y, double dt, int steps) {
    double t = 0.0;
    for (int i = 0; i < steps; ++i) {
        double slope = f(t, y);
        y = y + dt * slope;
        t = t + dt;
    }
    return y;
}

int main() {
    const double exact = std::exp(-1.0);
    const int choices[] = {10, 20, 40};
    for (int steps : choices) {
        double dt = 1.0 / steps;
        double y = euler(decay, 1.0, dt, steps);
        std::printf("dt = %.3f: y(1) = %.6f, error = %.6f\\n", dt, y, std::fabs(y - exact));
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The work is the number of steps, T/dt for a time span T, and each step costs one evaluation of the rule of change. The price of accuracy is what matters: the error is proportional to dt, so every extra digit of accuracy multiplies the work by ten.',
    cases: [
      { case: 'Work', time: 'T/dt steps', when: 'Always. One derivative evaluation and one update of the state per step.' },
      { case: 'Accuracy', time: 'Error proportional to dt', when: 'The rule of change and the solution are smooth and the step is below the stability limit. Halving dt halves the error.' },
      { case: 'Step above the stability limit', time: 'Error grows without bound', when: 'For decay at rate λ the limit is dt = 2/λ. No amount of extra time helps; only a smaller step does.' },
    ],
    space: 'O(d) for a state of d numbers: the state and its slope. Nothing from earlier steps is kept.',
    memory: 'Only the current state is stored, which is why the method suits simulations with millions of state variables. Recording the whole trajectory, as this page does for plotting, costs O(d) per step kept.',
    tradeoffs: 'Euler\'s method has the cheapest possible step and the poorest accuracy per step. RK4 costs four derivative evaluations per step, but its error falls with the fourth power of the step, so for any demanding accuracy it needs far fewer evaluations in total.',
    assumptions: [
      'The rule of change is Lipschitz continuous in the state and the exact solution has a bounded second derivative on the time span.',
      'The step size is fixed and T is the length of the time span.',
      'Arithmetic is exact. In floating point, rounding adds an error that grows as the step shrinks, so the total error has a minimum at some small step.',
      'Cost is counted in derivative evaluations.',
    ],
  },

  tradeoffs: {
    excels: [
      'Explaining and prototyping: the whole method is one line.',
      'Problems where each evaluation of the rule of change is so expensive that only one per step is affordable and rough accuracy is enough.',
      'Serving as the building block of better methods, which combine several Euler-like stages.',
    ],
    struggles: [
      'Accuracy: errors shrink only in proportion to the step size.',
      'Oscillating systems over long times. On a frictionless oscillator the computed energy grows for every step size.',
      'Stiff systems, which contain a part that decays very fast. The step must stay below the limit set by the fastest part even after that part has died away.',
    ],
    pitfalls: [
      'Choosing the step by eye. A run can look smooth and plausible and still be far from the true solution.',
      'Instability mistaken for interesting physics. Growing oscillations may be the method, not the system.',
      'Mixing old and new values when updating a system, which silently changes the method.',
    ],
    misunderstandings: [
      "\"A small enough step fixes everything.\" It improves accuracy, but only in proportion, and for a frictionless oscillator the energy still grows at every step. Some problems need a different method, not a smaller step.",
      "\"If each step is accurate, the result is accurate.\" Errors add up over many steps, and the equation itself can magnify earlier errors. The error at the end is what counts.",
      "\"The step size only affects accuracy.\" It also decides stability. Above a threshold the computed solution grows without limit while the true one dies away.",
      "\"Euler's method is only a classroom toy.\" Its close variants run inside real-time physics simulations, and gradient descent is Euler's method under another name.",
    ],
    constraints: [
      'Real-time simulations have a fixed time budget per frame, which fixes the step size and makes stability, not accuracy, the main concern.',
      'General-purpose solver libraries use higher-order methods with automatic step size control instead of plain Euler steps.',
    ],
    alternatives: [
      { id: 'runge-kutta-4', name: 'Runge-Kutta (RK4)', when: 'Accuracy matters. Four evaluations per step, error proportional to dt⁴.' },
      { name: 'Semi-implicit (symplectic) Euler', when: 'Simulating mechanics over long times. Updates the velocity first and uses the new velocity to move the position, which keeps the energy of an oscillator bounded at the same cost.' },
      { name: 'Backward (implicit) Euler', when: 'The system is stiff. Each step solves an equation for the new state and stays stable for any step size on decaying problems.' },
      { name: 'Midpoint and Heun methods', when: 'A cheap improvement is enough. Two evaluations per step, error proportional to dt².' },
    ],
    comparison: {
      columns: ['', 'Euler', 'Semi-implicit Euler', 'RK4'],
      rows: [
        ['Derivative evaluations per step', '1', '1', '4'],
        ['Error as dt shrinks', 'Proportional to dt', 'Proportional to dt', 'Proportional to dt⁴'],
        ['Frictionless oscillator', 'Energy grows every step', 'Energy stays bounded', 'Energy decays very slowly'],
        ['Typical use', 'Teaching, prototypes', 'Real-time physics', 'Accurate general-purpose simulation'],
      ],
    },
  },

  applications: [
    { title: 'Real-time physics in games and animation', status: 'established', text: 'Interactive simulations advance positions and velocities once per frame with a fixed time step. The integrators used are Euler steps and close variants, chosen because they need only one evaluation of the forces per step.' },
    { title: 'Simulating random processes', status: 'established', text: 'The Euler-Maruyama method adds a random kick to each Euler step. It is the basic scheme for simulating stochastic differential equations, for instance to generate many possible price paths for a Monte Carlo estimate.' },
    { title: 'Training by gradient descent', status: 'established', text: 'The equation "change the parameters at a rate equal to minus the gradient of the loss" describes continuous downhill motion. Taking Euler steps on it is exactly gradient descent, and the stability limit of Euler\'s method is the largest usable learning rate.' },
    { title: 'A stage inside better integrators', status: 'established', text: 'Runge-Kutta methods take several trial Euler steps within one step and combine their slopes. Predictor-corrector methods use an Euler step as the first guess that a second formula then improves.' },
    { title: 'Population and epidemic models', status: 'illustrative', text: 'A model that says how many people are infected and recover per day, given today\'s numbers, can be stepped forward a day at a time to see how an outbreak might unfold.' },
  ],

  connections: [
    { to: 'runge-kutta-4', type: 'advanced', why: 'RK4 keeps Euler\'s idea of stepping along a slope but samples the slope four times within the step and averages. The error per step falls from dt² to dt⁵.' },
    { to: 'gradient-descent', type: 'related', why: 'Gradient descent is Euler\'s method on the equation dx/dt = −∇f(x). The learning rate is the time step, and both become unstable when it exceeds 2 divided by the largest curvature or decay rate.' },
    { to: 'newtons-method', type: 'related', why: 'The implicit form of Euler\'s method defines the new state by an equation instead of a formula, and Newton\'s method is the usual way to solve it.' },
    { to: 'kalman-filter', type: 'application', why: 'A filter\'s prediction step moves the state estimate forward in time with a model of the dynamics, often a discretized differential equation. The measurement update then supplies the correction that plain time stepping never gets.' },
    { to: 'monte-carlo', type: 'application', why: 'Simulating a random process many times to average an outcome needs a time-stepping rule for each run. The Euler-Maruyama scheme is Euler\'s method with a random term.' },
    { to: 'ddpm', type: 'application', why: 'Drawing a sample from a diffusion model means following a differential equation from noise to data in a finite number of steps. The basic samplers are Euler-type steps.' },
    { to: 'concept:differential-equation', type: 'prerequisite', why: 'The method exists to turn a rule for the rate of change into values of the changing quantity.' },
    { to: 'concept:discretization', type: 'prerequisite', why: 'Continuous time is replaced by a finite list of instants, and the error of doing so is what the step size controls.' },
    { to: 'concept:convergence', type: 'related', why: 'The method converges as the step shrinks, at first order: the error is proportional to the step.' },
    { to: 'discipline:computer-graphics', type: 'application', why: 'Physically based animation is the numerical integration of equations of motion, one frame at a time.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'What does Euler\'s method assume during each step?',
      options: ['That the quantity itself stays constant', 'That the rate of change stays at the value it had at the start of the step', 'That the rate of change is the average of its values at the start and end of the step', 'That the solution is a straight line for all time'],
      answer: 1,
      explain: [
        'If the quantity stayed constant nothing would ever change.',
        'Correct. The slope is measured once, at the start, and followed for the whole step.',
        'Averaging the two slopes is Heun\'s method, a second-order improvement.',
        'Only within one step. The slope is measured afresh at every step.',
      ],
    },
    {
      type: 'predict',
      q: 'The rule is "the value falls at a rate equal to the value", starting from 1. The true solution fades smoothly toward zero. What does Euler\'s method produce with a step of 2.5?',
      options: ['Values that fade smoothly toward zero, slightly too fast', 'Values that flip sign and grow: −1.5, 2.25, −3.375 and so on', 'The value 1 at every step', 'Zero after the first step, and zero from then on'],
      answer: 1,
      explain: [
        'That is what a small step gives. A step of 2.5 is past the stability limit of 2.',
        'Correct. Each step replaces the value y by y − 2.5y = −1.5y, so the sign flips and the size grows by half each time.',
        'The slope at 1 is −1, so the value certainly moves.',
        'That happens with a step of exactly 1, where y − 1 × y = 0.',
      ],
      tryInput: { system: 'decay', dt: 2.5, duration: 20 },
    },
    {
      type: 'debug',
      q: 'This function gives a different answer for every step size, and the answers do not approach the exact solution as dt shrinks. What is wrong?',
      code: `def euler(f, y, dt, steps):
    t = 0.0
    for _ in range(steps):
        slope = f(t, y)
        y = y + slope
        t = t + dt
    return y`,
      options: ['The slope should be computed after t is advanced', 'The update leaves out the step size: it should add dt × slope', 'The loop should run steps + 1 times', 'The function should return t'],
      answer: 1,
      explain: [
        'Euler\'s method uses the slope at the start of the step, as written.',
        'Correct. Adding the slope itself is a step of length 1 whatever dt is. The time variable advances by dt while the state advances as if dt were 1.',
        'steps passes of the loop take steps steps.',
        'The state y is the result.',
      ],
    },
    {
      type: 'choice',
      q: 'Euler\'s method simulates a frictionless mass on a spring. The true motion keeps its energy for ever. What happens to the computed energy?',
      options: ['It stays exactly constant', 'It decreases slowly to zero', 'It grows at every step, for every step size', 'It grows only if the step is above a threshold'],
      answer: 2,
      explain: [
        'Euler\'s method does not conserve energy.',
        'Slow energy loss is what RK4 shows on this problem, not Euler.',
        'Correct. One Euler step multiplies the energy by exactly 1 + dt². That factor is above 1 for any step, so a smaller step slows the growth but never stops it.',
        'There is no safe threshold for this system. For decay problems there is one, which is why the two cases feel so different.',
      ],
    },
    {
      type: 'challenge',
      title: 'One changed line, bounded energy',
      prompt: 'Simulate the oscillator x′ = v, v′ = −x from x = 1, v = 0 with Euler\'s method and a step of 0.1 for 1,000 steps, printing the energy ½(x² + v²) every 100 steps. Then change the update so that v is updated first and the new v is used to update x. This is the semi-implicit Euler method. Compare the energy of the two runs, and measure how the error at t = 10 changes in each when you halve the step.',
      hints: ['Plain Euler: compute both new values from the old x and v. Semi-implicit: v ← v − dt·x, then x ← x + dt·v.', 'The semi-implicit energy wobbles but stays close to 0.5. Both methods are still first order, so halving the step should roughly halve the error.'],
    },
  ],

  compare: {
    idea: 'Step forward in time along the current slope, one fixed step at a time.',
    requires: 'A rule that gives how fast things are changing at any moment, a starting state, and a step size.',
    sensitivity: 'High to the step size: error is proportional to it, and above a system-dependent limit the solution blows up.',
    memory: 'O(d): the current state and its slope.',
    difficulty: 'low',
    difficultyNote: 'One line of arithmetic per step. Choosing a step that is both stable and accurate enough is the real work.',
    limits: 'Not very accurate: halving the step only halves the error. Things that should swing steadily slowly gain energy. Some systems force it to take very small steps.',
    useWhen: 'Simplicity or speed per step matters more than accuracy, or you want a first look at a problem.',
  },

  advanced: {
    history: 'Leonhard Euler described the method in his *Institutionum calculi integralis*, the first volume of which appeared in 1768. Augustin-Louis Cauchy later proved that the chain of straight segments converges to the true solution as the step shrinks, which made the construction a proof that solutions exist. In 1895 Carl Runge began the line of work that improves accuracy by sampling the slope more than once per step, and Wilhelm Kutta extended it in 1901.',
    derivation: 'Let $y(t)$ solve $y\' = f(t, y)$. Taylor\'s theorem gives\n\n$$y(t + h) = y(t) + h\\,f(t, y(t)) + \\tfrac{1}{2}h^2\\,y\'\'(\\xi)$$\n\nfor some $\\xi$ in the step. Dropping the last term gives the Euler update $y_{n+1} = y_n + h\\,f(t_n, y_n)$, with a local error of $\\tfrac{1}{2}h^2 y\'\'(\\xi)$ per step. On the test equation $y\' = \\lambda y$ the update is $y_{n+1} = (1 + h\\lambda)\\,y_n$, so $y_n = (1 + h\\lambda)^n y_0$. With $\\lambda = 1$ and $h = t/n$ this is $(1 + t/n)^n$, the compound-interest formula whose limit is $e^t$.',
    proof: 'Suppose $f$ is Lipschitz in $y$ with constant $L$ and $|y\'\'| \\le M$ on $[0, T]$. Let $e_n = y(t_n) - y_n$. Subtracting the Euler update from the Taylor expansion gives\n\n$$|e_{n+1}| \\le (1 + hL)\\,|e_n| + \\tfrac{1}{2}Mh^2.$$\n\nWith $e_0 = 0$, summing the geometric series and using $(1 + hL)^n \\le e^{Lt_n}$ yields\n\n$$|e_n| \\le \\frac{Mh}{2L}\\left(e^{Lt_n} - 1\\right).$$\n\nThe bound is proportional to $h$: the method converges with order one.',
    complexityProof: 'Stability on $y\' = \\lambda y$ requires $|1 + h\\lambda| \\le 1$. For real $\\lambda < 0$ this is $h \\le 2/|\\lambda|$, which is the limit of 2 seen for the decay system on this page. For the oscillator the eigenvalues are $\\lambda = \\pm i$, and $|1 \\pm ih|^2 = 1 + h^2 > 1$ for every $h > 0$. Each step therefore multiplies $x^2 + v^2$, twice the energy, by exactly $1 + h^2$: after $n$ steps the energy is $(1 + h^2)^n$ times its starting value.',
    variants: [
      { name: 'Backward (implicit) Euler', text: 'Uses the slope at the end of the step: y_{n+1} = y_n + h·f(t_{n+1}, y_{n+1}). The new state appears on both sides, so each step solves an equation. Stable for any step on decaying problems.' },
      { name: 'Semi-implicit (symplectic) Euler', text: 'For mechanics: update the velocity from the old position, then the position from the new velocity. Same cost and order as Euler, but the energy of an oscillator stays bounded.' },
      { name: 'Heun\'s method (improved Euler)', text: 'Takes an Euler step, measures the slope at its end, and redoes the step with the average of the two slopes. Second order.' },
      { name: 'Midpoint method', text: 'Uses an Euler half-step to estimate the state at the middle of the step, and the slope there for the full step. Second order.' },
      { name: 'Euler-Maruyama', text: 'Adds a normally distributed random increment, scaled by the square root of the step, to each Euler step. The basic method for stochastic differential equations.' },
    ],
    implementation: 'Compute the whole slope before changing any part of the state. Count steps with an integer instead of comparing accumulated time with the end time. To judge accuracy without an exact solution, run again with half the step: for a first-order method the difference between the two runs is a fair estimate of the error of the finer one.',
    benchmarking: 'Compare integrators by error against the number of derivative evaluations, not against the number of steps, since methods differ in evaluations per step. State the time span and how the error is measured: at the final time, or as the largest error at any step, as on this page.',
    references: [
      { authors: 'E. Hairer, S. P. Nørsett and G. Wanner', year: 1993, title: 'Solving Ordinary Differential Equations I: Nonstiff Problems (2nd edition)', venue: 'Springer' },
      { authors: 'R. L. Burden and J. D. Faires', year: 2011, title: 'Numerical Analysis (9th edition)', venue: 'Brooks/Cole, Cengage Learning' },
      { authors: 'J. C. Butcher', year: 2008, title: 'Numerical Methods for Ordinary Differential Equations (2nd edition)', venue: 'Wiley' },
    ],
    furtherReading: [
      'Burden and Faires, *Numerical Analysis*, section 5.2, "Euler\'s Method".',
      'W. H. Press, S. A. Teukolsky, W. T. Vetterling and B. P. Flannery, *Numerical Recipes* (3rd edition), chapter 17, "Integration of Ordinary Differential Equations".',
    ],
  },

  tests: [
    { name: 'the worked example: 1, 0.5, 0.25, 0.125, 0.0625 with largest error 0.118 at time 1', input: { system: 'decay', dt: 0.5, duration: 2 },
      check: (r, c) => {
        const got = r.ys.map((y) => y[0]);
        const want = [1, 0.5, 0.25, 0.125, 0.0625];
        if (got.length !== 5 || got.some((v, i) => v !== want[i])) return `values ${got.join(', ')}`;
        if (Math.abs(r.maxError - (Math.exp(-1) - 0.25)) > 1e-12 || r.maxErrorAt !== 1) return `largest error ${r.maxError} at ${r.maxErrorAt}`;
        return c['derivative evaluations'] === 4 || `${c['derivative evaluations']} evaluations`;
      } },
    { name: 'steps of 0.25 give the largest error 0.051 quoted in the example', input: { system: 'decay', dt: 0.25, duration: 2 },
      check: (r) => Math.abs(r.maxError - (Math.exp(-1) - Math.pow(0.75, 4))) < 1e-12 || `largest error ${r.maxError}` },
    { name: 'first order: halving dt roughly halves the largest error on every scalar system', input: { system: 'decay', dt: 0.1, duration: 5 },
      check: (r) => {
        for (const system of ['decay', 'growth', 'logistic', 'driven']) {
          const T = odeById[system].duration;
          const coarse = run({ system, dt: T / 200, duration: T }, quiet).maxError;
          const fine = run({ system, dt: T / 400, duration: T }, quiet).maxError;
          const ratio = coarse / fine;
          if (!(ratio > 1.9 && ratio < 2.1)) return `${system}: error ratio ${ratio.toFixed(3)} is not close to 2`;
        }
        const half = run({ system: 'decay', dt: 0.05, duration: 5 }, quiet).maxError;
        const ratio = r.maxError / half;
        return (ratio > 1.9 && ratio < 2.15) || `decay 0.1 against 0.05: ratio ${ratio}`;
      } },
    { name: 'matches the closed form (1 − dt)^n on decay', input: { system: 'decay', dt: 0.1, duration: 3 },
      check: (r) => (r.steps === 30 && r.ys.every((y, i) => Math.abs(y[0] - Math.pow(0.9, i)) < 1e-13)) || `${r.steps} steps` },
    { name: 'oscillator energy is multiplied by 1 + dt² on every step', input: { system: 'oscillator', dt: 0.1, duration: 20 },
      check: (r) => {
        if (r.steps !== 200) return `${r.steps} steps`;
        const E = (y) => 0.5 * (y[0] * y[0] + y[1] * y[1]);
        for (const i of [1, 50, 200]) {
          const want = 0.5 * Math.pow(1.01, i);
          if (Math.abs(E(r.ys[i]) - want) > 1e-10 * want) return `energy after ${i} steps is ${E(r.ys[i])}, expected ${want}`;
        }
        return true;
      } },
    { name: 'the quiz prediction: decay with dt = 2.5 gives 1, −1.5, 2.25, −3.375', input: { system: 'decay', dt: 2.5, duration: 20 },
      check: (r) => (r.steps === 8 && [1, -1.5, 2.25, -3.375].every((v, i) => r.ys[i][0] === v) && r.status === 'completed') || `values ${r.ys.slice(0, 4).map((y) => y[0]).join(', ')}` },
    { name: 'an unstable run is stopped and reported', input: { system: 'oscillator', dt: 3, duration: 40 },
      check: (r) => (r.status === 'blew-up' && r.steps <= 13 && r.steps >= 11) || `status ${r.status} after ${r.steps} steps` },
    { name: 'step count: whole steps that fit in the duration', input: { system: 'decay', dt: 0.3, duration: 1 },
      check: (r, c) => (r.steps === 3 && Math.abs(r.tEnd - 0.9) < 1e-12 && c['derivative evaluations'] === 3) || `${r.steps} steps to ${r.tEnd}` },
  ],
};
