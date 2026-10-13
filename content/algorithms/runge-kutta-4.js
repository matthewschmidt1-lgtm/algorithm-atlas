import { odeById, odeInputs, stepCount, errorNorm, exactCurve, plotRange } from '../../js/lib/odes.js';

const BLOW_UP = 1e6;

// Plain decimal formatting for notes: about `sig` significant digits.
function num(v, sig = 4) {
  if (!Number.isFinite(v)) return 'not a finite number';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e9 || a < 1e-7) {
    const [m, e] = v.toExponential(2).split('e');
    return `${m.replace('-', '−')} × 10^${Number(e)}`.replace('^-', '^−');
  }
  let s = v.toFixed(Math.max(0, Math.min(12, sig - 1 - Math.floor(Math.log10(a)))));
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('-', '−');
}
const tnum = (v) => num(Math.round(v * 1e9) / 1e9, 6);
const axpy = (y, c, k) => y.map((v, j) => v + c * k[j]);

// The comparison method for the experiment: plain Euler steps, one evaluation each.
function eulerRun(S, h, n, t) {
  let y = S.y0.slice(), maxError = 0;
  for (let i = 0; i < n; i++) {
    const k = S.f(i * h, y); t.count('derivative evaluations');
    y = axpy(y, h, k);
    const err = y.every(Number.isFinite) ? errorNorm(y, S.exact((i + 1) * h)) : Infinity;
    if (err > maxError) maxError = err;
    if (!(err < BLOW_UP)) break;
  }
  return { y, maxError };
}

function run(input, t) {
  const S = odeById[input.system];
  if (!S) throw new Error('Unknown system.');
  const h = input.dt, T = input.duration;
  if (!(h > 0) || !(T > 0)) throw new Error('The step size and the duration must be greater than zero.');
  const n = stepCount(T, h);
  if (n < 1) throw new Error(`A step of ${num(h)} is longer than the whole duration of ${num(T)}. Shorten the step or lengthen the duration.`);
  if (n > 200000) throw new Error('That is more than 200,000 steps. Use a larger step or a shorter duration.');
  const two = S.dim === 2;
  const pair = (v) => (two ? `(${num(v[0], 5)}, ${num(v[1], 5)})` : num(v[0], 5));
  const state = (v) => (two ? `${S.names[0]} = ${num(v[0])}, ${S.names[1]} = ${num(v[1])}` : `${S.names[0]} = ${num(v[0])}`);

  if (input.method === 'euler') {
    const r = eulerRun(S, h, n, t);
    t.frame(() => ({ line: null, note: `Comparison run: ${n} plain Euler steps of ${num(h)}. Largest error ${num(r.maxError, 3)}.`,
      views: [{ kind: 'scene', title: S.label, x: [0, T], y: plotRange(S, T), aspect: 0.5, axes: { xLabel: 'time t', yLabel: S.names[0] }, layers: [{ type: 'line', points: exactCurve(S, T), role: 'forest', width: 2.4 }] }] }));
    if (input.measure) t.count('max error (thousandths)', Math.min(r.maxError, BLOW_UP) * 1000);
    return { maxError: r.maxError, steps: n, status: 'completed', method: 'euler', system: S.id, dt: h };
  }

  let y = S.y0.slice();
  const ts = [0], ys = [y.slice()], errors = [0];
  let maxError = 0, maxErrorAt = 0, status = 'completed';
  let exactSize = Math.hypot(...S.y0);              // largest size the exact solution reaches at a step
  let last = null;                                  // the most recent step, for the magnified view
  const detailSteps = n <= 12 ? n : 2;              // steps shown one slope sample at a time
  const stride = Math.max(1, Math.ceil((n - detailSteps) / 110));

  // All four sample points of the step that starts at (tn, y0). Used only to frame the magnified
  // view before the samples have been taken; these evaluations are plotting work and are not counted.
  const preview = (tn, y0) => {
    const k1 = S.f(tn, y0), y2 = axpy(y0, h / 2, k1);
    const k2 = S.f(tn + h / 2, y2), y3 = axpy(y0, h / 2, k2);
    const k3 = S.f(tn + h / 2, y3), y4 = axpy(y0, h, k3);
    const k4 = S.f(tn + h, y4);
    const yNew = y0.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    return { tn, y0, k: [k1, k2, k3, k4], P: [[tn, y0], [tn + h / 2, y2], [tn + h / 2, y3], [tn + h, y4]], yNew };
  };

  // shown: how many slope samples of step `st` are visible (0 to 4); 5 also shows the step actually taken.
  const views = (st, shown) => {
    const i = ys.length - 1;
    const pts = ts.map((tt, j) => [tt, ys[j][0]]);
    const base = plotRange(S, T);
    let lo = base[0], hi = base[1];
    for (const p of pts) { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; }
    if (lo < base[0] || hi > base[1]) { const pad = 0.06 * (hi - lo); lo -= pad; hi += pad; }
    lo = Math.max(lo, -BLOW_UP * 1.1); hi = Math.min(hi, BLOW_UP * 1.1);
    const main = [];
    if (st) main.push({ type: 'rect', x: st.tn, y: lo, w: h, h: hi - lo, role: 'frontier', alpha: 0.14 });
    if (lo < 0 && hi > 0) main.push({ type: 'segments', segments: [[0, 0, T, 0]], role: 'muted', width: 1 });
    main.push({ type: 'line', points: exactCurve(S, T), role: 'forest', width: 2.4 });
    main.push({ type: 'line', points: pts, role: 'active', width: 2 });
    if (n <= 80) main.push({ type: 'points', points: pts, role: 'active', r: 2.8 });
    if (st && shown >= 1 && shown <= 4) main.push({ type: 'points', points: st.P.slice(0, shown).map(([tt, v]) => [tt, v[0]]), role: 'compare', r: 3.2 });
    main.push({ type: 'points', points: [[ts[i], ys[i][0]]], role: 'active', r: 5.5, ring: true });

    const out = [{ kind: 'scene', title: two ? `${S.label}. The plot shows the position x over time` : S.label, x: [0, T], y: [lo, hi], aspect: 0.4, axes: { xLabel: 'time t', yLabel: S.names[0] }, layers: main,
      legend: [{ label: 'exact solution', role: 'forest' }, { label: 'RK4 approximation', role: 'active' }, { label: 'slope samples k1 to k4 and the trial moves that reach them', role: 'compare' }, { label: 'gap to the exact solution', role: 'alert' }] }];
    if (!st) return out;

    const { tn, y0, k, P, yNew } = st;
    const zx = [tn - 0.2 * h, tn + 1.2 * h];
    const half = 0.1 * h;
    let zlo = Infinity, zhi = -Infinity;
    const fit = (v) => { if (v < zlo) zlo = v; if (v > zhi) zhi = v; };
    const exactPts = Array.from({ length: 41 }, (_, j) => { const tt = Math.max(0, zx[0]) + (j / 40) * (zx[1] - Math.max(0, zx[0])); return [tt, S.exact(tt)[0]]; });
    for (const p of exactPts) if (p[0] >= tn && p[0] <= tn + h) fit(p[1]);
    P.forEach(([, v], j) => { fit(v[0] - half * k[j][0]); fit(v[0] + half * k[j][0]); });
    fit(yNew[0]);
    const zpad = 0.24 * (zhi - zlo) || 0.5;
    zlo -= zpad; zhi += zpad;
    const zoom = [{ type: 'line', points: exactPts, role: 'forest', width: 2.4 }];
    const seen = Math.min(shown, 4);
    if (seen >= 2) zoom.push({ type: 'segments', segments: P.slice(1, seen).map(([tt, v]) => [tn, y0[0], tt, v[0]]), role: 'compare', width: 1.2, dash: [4, 4], alpha: 0.8 });
    for (let j = 0; j < seen; j++) {
      const [tt, v] = P[j];
      const current = j === shown - 1;
      zoom.push({ type: 'segments', segments: [[tt - half, v[0] - half * k[j][0], tt + half, v[0] + half * k[j][0]]], role: 'compare', width: current ? 3.2 : 2 });
      zoom.push({ type: 'points', points: [[tt, v[0]]], role: 'compare', r: current ? 5 : 3.6, ring: current });
      // Labels: k1 and k4 hang just below the outer end of their stroke. k2 and k3 share a time, so the
      // lower of the two is labelled underneath and the upper one on top, clear of the curve between them.
      const zr = zhi - zlo;
      let label;
      if (j === 0) label = { at: [tt - 1.15 * half, v[0] - half * k[0][0] - 0.1 * zr], align: 'right' };
      else if (j === 3) label = { at: [tt + 1.15 * half, v[0] + half * k[3][0] - 0.1 * zr], align: 'left' };
      else {
        const lower = j === 1 ? P[1][1][0] <= P[2][1][0] : P[2][1][0] < P[1][1][0];
        label = { at: [tt, v[0] + (lower ? -0.14 : 0.08) * zr], align: 'center' };
      }
      zoom.push({ type: 'text', text: `k${j + 1}`, role: 'text', ...label });
    }
    if (shown === 5) {
      zoom.push({ type: 'segments', segments: [[tn, y0[0], tn + h, yNew[0]]], role: 'active', width: 2.6 });
      zoom.push({ type: 'segments', segments: [[tn + h, yNew[0], tn + h, S.exact(tn + h)[0]]], role: 'alert', width: 2.2 });
      zoom.push({ type: 'points', points: [[tn + h, yNew[0]]], role: 'active', r: 5 });
    }
    zoom.push({ type: 'points', points: [[tn, y0[0]]], role: 'active', r: 5, ring: shown === 0 });
    out.push({ kind: 'scene', title: `Magnified: the step from time ${tnum(tn)} to ${tnum(tn + h)} (the shaded strip above)`, x: zx, y: [zlo, zhi], aspect: 0.3, axes: { xLabel: 'time t' }, layers: zoom });
    return out;
  };
  const vars = (i, extra = {}) => {
    const out = { t: tnum(ts[i]) };
    S.names.forEach((name, j) => { out[name] = num(ys[i][j], 6); });
    Object.assign(out, extra);
    if (S.energy) out.energy = num(S.energy(ys[i]), 6);
    out.error = num(errors[i], 3);
    return out;
  };

  t.frame(() => ({ line: [0, 1],
    note: `The rule of change: ${S.rule}. Start at time 0 with ${state(y)}. The green curve is the exact solution, shown for comparison. RK4 will take ${n} step${n === 1 ? '' : 's'} of ${num(h)}, and each step samples the slope four times.`,
    views: views(preview(0, y), 0), vars: vars(0) }));

  for (let i = 0; i < n; i++) {
    const tn = i * h, y0 = y, step = i + 1;
    const detail = i < detailSteps;
    let cached = null;
    const shape = () => cached || (cached = preview(tn, y0));   // built only when a frame is recorded

    const k1 = S.f(tn, y0); t.count('derivative evaluations');
    if (detail) {
      t.frame(() => ({ line: 3,
        note: `Step ${step}, first sample. At the start of the step (time ${tnum(tn)}, ${state(y0)}) the rule gives the slope **k1 = ${pair(k1)}**. Euler's method would follow this slope for the whole step. RK4 uses it only to look ahead.`,
        views: views(shape(), 1), vars: vars(i, { k1: pair(k1) }) }));
    }
    const y2 = axpy(y0, h / 2, k1);
    const k2 = S.f(tn + h / 2, y2); t.count('derivative evaluations');
    if (detail) {
      t.frame(() => ({ line: 4,
        note: `Second sample. Follow k1 for half a step to a trial point: ${pair(y0)} + ${num(h / 2)} × ${two ? pair(k1) : `(${pair(k1)})`} = ${pair(y2)}. The slope there, at time ${tnum(tn + h / 2)}, is **k2 = ${pair(k2)}**.`,
        views: views(shape(), 2), vars: vars(i, { k1: pair(k1), k2: pair(k2) }) }));
    }
    const y3 = axpy(y0, h / 2, k2);
    const k3 = S.f(tn + h / 2, y3); t.count('derivative evaluations');
    if (detail) {
      t.frame(() => ({ line: 5,
        note: `Third sample. Go back to the start and follow k2 for half a step instead: ${pair(y0)} + ${num(h / 2)} × ${two ? pair(k2) : `(${pair(k2)})`} = ${pair(y3)}. The slope there is **k3 = ${pair(k3)}**, a second and better estimate of the slope at the middle of the step.`,
        views: views(shape(), 3), vars: vars(i, { k1: pair(k1), k2: pair(k2), k3: pair(k3) }) }));
    }
    const y4 = axpy(y0, h, k3);
    const k4 = S.f(tn + h, y4); t.count('derivative evaluations');
    if (detail) {
      t.frame(() => ({ line: 6,
        note: `Fourth sample. From the start again, follow k3 for the whole step: ${pair(y0)} + ${num(h)} × ${two ? pair(k3) : `(${pair(k3)})`} = ${pair(y4)}. The slope there, at time ${tnum(tn + h)}, is **k4 = ${pair(k4)}**.`,
        views: views(shape(), 4), vars: vars(i, { k1: pair(k1), k2: pair(k2), k3: pair(k3), k4: pair(k4) }) }));
    }
    const avg = k1.map((v, j) => (v + 2 * k2[j] + 2 * k3[j] + k4[j]) / 6);
    y = y0.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    const tNext = step * h;
    const exact = S.exact(tNext);
    const err = y.every(Number.isFinite) ? errorNorm(y, exact) : Infinity;
    ts.push(tNext); ys.push(y.slice()); errors.push(err);
    if (err > maxError) { maxError = err; maxErrorAt = tNext; }
    exactSize = Math.max(exactSize, Math.hypot(...exact));
    const now = y;
    last = { tn, y0, k: [k1, k2, k3, k4], P: [[tn, y0], [tn + h / 2, y2], [tn + h / 2, y3], [tn + h, y4]], yNew: now };
    const taken = last;
    if (!(err < BLOW_UP)) {
      status = 'blew-up';
      t.frame(() => ({ line: [7, 8],
        note: `After step ${step} the computed value has passed one million in size while the exact solution stays small. A step of ${num(h)} is too long for RK4 on this system: every step magnifies the error. The run stops here.`,
        views: views(null, 0), vars: vars(step) }));
      break;
    }
    if (detail) {
      t.frame(() => ({ line: [7, 8],
        note: `Combine. Average the four slopes, counting the two middle ones twice: (k1 + 2 × k2 + 2 × k3 + k4) ÷ 6 = **${pair(avg)}**. Take the real step with that slope: ${pair(y0)} + ${num(h)} × ${two ? pair(avg) : `(${pair(avg)})`} = **${pair(now)}**. The exact ${two ? 'state' : 'value'} at time ${tnum(tNext)} is ${pair(exact)}, so the error is ${num(err, 3)}.`,
        views: views(taken, 5), vars: vars(step, { 'average slope': pair(avg) }) }));
    } else if ((step - detailSteps) % stride === 0 && step < n) {
      t.frame(() => ({ line: [2, 3, 4, 5, 6, 7, 8],
        note: `${stride > 1 ? `Steps ${step - stride + 1} to ${step}` : `Step ${step}`}, each with four slope samples: now at time ${tnum(tNext)} with ${state(now)}. The exact solution has ${state(exact)}, so the error is ${num(err, 3)}.${S.energy ? ` Energy: ${num(S.energy(now), 6)}.` : ''}`,
        views: views(taken, 5), vars: vars(step) }));
    }
  }

  const steps = ys.length - 1;
  const tEnd = ts[steps];
  // The error ended at its largest and exceeds the solution itself: the run is going wrong, not just drifting.
  const runaway = status === 'completed' && steps > 1 && errors[steps] === maxError && maxError > exactSize;
  if (status === 'completed') {
    t.frame(() => ({ line: 9,
      note: `Done: ${steps} step${steps === 1 ? '' : 's'} of ${num(h)} reached time ${tnum(tEnd)}. The largest error along the way was **${num(maxError, 3)}**, at time ${tnum(maxErrorAt)}. Each step used four evaluations of the rule of change, ${4 * steps} in all.${S.energy ? ` The energy went from ${num(S.energy(S.y0), 6)} to ${num(S.energy(ys[steps]), 6)}.` : ''}${runaway ? ' The error is now larger than the solution itself and still growing: at this step size the method is unstable on this system.' : ''}`,
      views: views(last, 5), vars: vars(steps) }));
  }
  if (input.measure) t.count('max error (thousandths)', Math.min(maxError, BLOW_UP) * 1000);
  return { maxError, steps, status, runaway, finalError: errors[steps], maxErrorAt, tEnd, ts, ys, errors, lastStep: last, system: S.id, dt: h, method: 'rk4' };
}

const quiet = { count() {}, frame() {} };

export default {
  meta: {
    id: 'runge-kutta-4',
    name: 'Runge-Kutta (RK4)',
    aliases: ['RK4', 'classical Runge-Kutta method', 'fourth-order Runge-Kutta', 'Runge-Kutta method'],
    kind: 'algorithm',
    discipline: 'physics',
    alsoIn: [
      { id: 'mathematics', why: 'It is the standard example of a high-order one-step method in numerical analysis, and for a rule that depends only on time it reduces to Simpson\'s rule for integration.' },
      { id: 'robotics', why: 'Simulators and motion planners advance models of robot dynamics in fixed time steps, and RK4 is a common integrator for doing so.' },
    ],
    subfield: 'Numerical simulation',
    family: 'Time integration (one-step methods)',
    lab: 'numerical',
    compareGroup: 'ode-integration',
    year: 1901,
    authors: 'Carl Runge and Wilhelm Kutta',
    summary: 'Advances a differential equation one time step by sampling the slope four times within the step and following their weighted average.',
    difficulty: 'intermediate',
    order: 460,
    paradigms: ['incremental'],
    randomized: false,
    approximate: true,
    time: { best: 'O(T/dt) steps', average: 'O(T/dt) steps', worst: 'O(T/dt) steps, four derivative evaluations each', class: 'linear' },
    space: { worst: 'O(d) for a state of d numbers', class: 'linear' },
    tags: {
      problems: ['simulate motion accurately', 'solve a differential equation', 'predict how something changes over time', 'integrate equations of motion', 'initial value problem', 'step a simulation forward'],
      techniques: ['time stepping', 'multiple slope samples', 'weighted average of slopes', 'explicit integration'],
      applications: ['scientific computing', 'robotics', 'engineering design', 'computer graphics', 'games'],
    },
    prerequisites: ['euler-method', 'concept:derivative', 'concept:differential-equation', 'concept:discretization'],
  },

  bigIdea: {
    simple: "Runge-Kutta is a careful way to predict the future one step at a time. Suppose you want to know where a rolling ball will be one second from now. The quick way is to check its speed now and pretend that speed holds for the whole second. But the ball may be slowing down, so the quick guess goes too far. The careful way takes four readings of the speed instead of one. The first is the speed right now. The second is the speed the ball would have half a second from now, if the first reading were right. The third is the speed at the half second again, using the second reading to get there. The fourth is the speed at the end of the second. Then the method averages the four, counting the two middle readings twice, and moves the ball by that average. Each step is four times the work. In return the answer is so much more accurate that far fewer steps are needed.",
    what: 'RK4 solves the same problem as Euler\'s method: given the current state and a rule for its rate of change, find the state a short time later. Instead of trusting the slope at the start of the step, it evaluates the rule at four points: the start, two trial points at the middle, and a trial point at the end. It then takes one step along a weighted average of the four slopes, with weights 1, 2, 2 and 1.',
    why: '[Euler\'s method](#/algorithm/euler-method) is accurate only in proportion to the step size, so each extra digit of accuracy costs ten times the work. The four samples of RK4 are arranged so that their errors cancel up to the fourth power of the step size. Halving the step cuts the error about sixteen-fold, and an extra digit of accuracy costs less than twice the work.',
    when: 'Use it as a dependable fixed-step integrator when the rule of change is smooth and a moderate to high accuracy is wanted without much machinery. If the solution has both quiet and fast-changing stretches, use an adaptive Runge-Kutta solver that adjusts its own step. If the system is stiff, or energy must be conserved over very long runs, use the methods designed for those cases.',
    interesting: 'Three of the four slopes are measured at states the system never visits. They are trial moves, made only to learn how the slope changes across the step, and then discarded. The weights 1, 2, 2, 1 are those of Simpson\'s rule for the area under a curve, and when the rule of change depends only on the time, RK4 is exactly Simpson\'s rule.',
    where: 'It is a default fixed-step integrator across physics, engineering and robotics simulation. The adaptive solvers in numerical libraries are its descendants: they use five or more slope samples per step and compare two answers to control the step size.',
    analogy: {
      title: 'A navigator who checks the water ahead',
      text: 'A navigator plotting the next hour could draw one straight line using the current heading and speed. A more careful navigator first asks what the wind and current would be half an hour along that line, and redraws using those. Then checks the half-hour point again along the corrected line, then the full-hour point. The course finally drawn blends all four readings, giving most weight to the two taken at the middle of the hour.',
      limits: 'A real navigator cannot measure the sea at a place the ship has not reached. The method can make its trial readings only because the rule of change is a formula that can be evaluated for any time and any state, including states the system never visits. The weights are also not a navigator\'s judgement: they are fixed by algebra so that the errors of the four readings cancel as far as possible. And like Euler\'s method, RK4 never receives a correction from outside, so whatever error it makes is carried forward.',
    },
  },

  example: {
    setup: "A quantity starts at 1 and grows at a rate equal to its own size: when it is 1 it grows at 1 per unit of time, when it is 2 it grows at 2. Take a single step of length 1. The rate of change at any moment is called the slope. The true answer after one unit of time is 2.71828.",
    steps: [
      "First slope, at the start: the value is 1, so the slope is 1.",
      "Second slope, at the middle: follow the first slope for half a step, 1 + 0.5 × 1 = 1.5. The slope there is 1.5.",
      "Third slope, at the middle again: go back to the start and follow the second slope for half a step, 1 + 0.5 × 1.5 = 1.75. The slope there is 1.75.",
      "Fourth slope, at the end: from the start, follow the third slope for the whole step, 1 + 1 × 1.75 = 2.75. The slope there is 2.75.",
      "Average, counting the middle two twice: (1 + 2 × 1.5 + 2 × 1.75 + 2.75) ÷ 6 = 10.25 ÷ 6, about 1.70833. Take the real step: 1 + 1 × 1.70833 = 2.70833.",
    ],
    result: "RK4 gives 2.70833 against the true 2.71828, an error of about 0.01 from one large step. Euler's method with the same step uses only the first slope and gives 1 + 1 = 2, an error of 0.72. Even four Euler steps of 0.25, which cost the same four slope evaluations, give only 2.44.",
    tryInput: { system: 'growth', dt: 1, duration: 1 },
  },

  terms: [
    { term: "Rate of change", meaning: "How fast a quantity is rising or falling at one moment." },
    { term: "Differential equation", meaning: "A rule that gives the rate of change of a quantity from its current value and the time." },
    { term: "State", meaning: "All the numbers needed to describe the system at one moment, such as a position and a velocity." },
    { term: "Step size", meaning: "The length of time the method moves forward in one step, written dt." },
    { term: "Slope", meaning: "The rate of change drawn on a graph: how steeply the curve rises or falls at a point." },
    { term: "Slope sample", meaning: "One evaluation of the rule of change at a chosen time and state. RK4 takes four per step, called k1, k2, k3 and k4." },
    { term: "Trial point", meaning: "A state the method computes only in order to sample the slope there. The solution does not pass through it." },
    { term: "Weighted average", meaning: "An average in which some values count more than others. Here the two middle slopes count twice." },
    { term: "Order", meaning: "How fast the error shrinks with the step size. Fourth order means halving the step divides the error by about 16." },
  ],

  takeaway: "Before each step, sample the slope at the start, twice at the middle and once at the end, then step along their weighted average.",

  viz: {
    describe: 'Two plots. The upper one shows value against time: a green curve for the exact solution, a terracotta chain of segments with dots for the RK4 approximation, and a shaded strip marking the step being computed. The lower plot magnifies that one step. In it, four short ochre strokes labelled k1 to k4 show the slope sampled at the start, at two trial points in the middle and at a trial point at the end, with dashed ochre lines showing the trial moves from the start that reach them. A terracotta line then shows the step actually taken, and a short brick-red line shows the remaining gap to the exact solution.',
    inputs: odeInputs({ system: 'decay', dt: 1, duration: 5 }),
    presets: [
      { label: 'Decay, five large steps', values: { system: 'decay', dt: 1, duration: 5 } },
      { label: 'The worked example: one step', values: { system: 'growth', dt: 1, duration: 1 } },
      { label: 'Logistic growth', values: { system: 'logistic', dt: 1, duration: 10 } },
      { label: 'Moving target', values: { system: 'driven', dt: 1, duration: 12 } },
      { label: 'Oscillator, step 0.5', values: { system: 'oscillator', dt: 0.5, duration: 20 } },
      { label: 'Oscillator, step 0.1', values: { system: 'oscillator', dt: 0.1, duration: 20 } },
      { label: 'Decay, step too large: unstable', values: { system: 'decay', dt: 3, duration: 30 } },
    ],
    tryThis: [
      'Run "Decay, five large steps". It spends 20 derivative evaluations and its largest error is 0.0071. Now open Euler\'s method on the same system with a step of 0.25: also 20 evaluations, but the largest error is 0.051, about seven times worse.',
      'On decay with a duration of 5, set the step to 0.5 and note the largest error, then set it to 0.25. The error falls from about 0.00029 to 0.000015, a factor near 20 here and closer to 16 as the steps get smaller. Halving the step doubles the work and buys more than one extra digit.',
      'Load "Oscillator, step 0.5" and then the same system in Euler\'s method. Euler\'s swing grows quickly. RK4 stays close to the exact curve, and its energy creeps down very slowly instead of up.',
      'Load "Decay, step too large: unstable". With a step of 3 the computed values grow instead of fading. Slide the step down: below about 2.78 they fade again. RK4 has a stability limit too; it is only somewhat larger than Euler\'s limit of 2.',
      'Load "Moving target" and step through the first few steps. Here the rule depends on the time as well as the value, so the samples at the middle and end of the step see a target that has moved.',
    ],
    run,
    report: (r, c) => `${r.status === 'blew-up' ? `Stopped after ${r.steps} steps: the computed solution blew up. The step size is too large for this system.` : `${r.steps} steps of ${num(r.dt)} reached time ${tnum(r.tEnd)}.${r.runaway ? ' The error exceeds the solution itself and was still growing at the end: unstable at this step size.' : ''}`}\nLargest error against the exact solution: ${r.status === 'blew-up' ? 'beyond one million' : `${num(r.maxError, 3)} (at time ${tnum(r.maxErrorAt)})`}.\n${c['derivative evaluations'] || 0} derivative evaluations, four per step.`,
    experiment: {
      title: 'Largest error for the same number of derivative evaluations',
      note: 'Each point is a real run on exponential decay over a duration of 5. With a budget of B derivative evaluations, RK4 takes B ÷ 4 steps and Euler\'s method, implemented in this same module, takes B steps. The value plotted is the largest distance from the exact solution, in thousandths. The curves are proportional to 1/B⁴ and 1/B, scaled to the last measured point of each series. At the smallest budget RK4\'s steps are too long for its pattern to hold, and Euler is the more accurate of the two.',
      metric: 'max error (thousandths)',
      metricLabel: 'Largest error (thousandths)',
      sizeLabel: 'Derivative evaluations spent (B)',
      sizes: [8, 16, 32, 64, 128, 256],
      variants: [
        { id: 'rk4', label: 'RK4, B ÷ 4 steps' },
        { id: 'euler', label: 'Euler, B steps' },
      ],
      input: (budget, variant) => ({ system: 'decay', duration: 5, dt: variant === 'rk4' ? 20 / budget : 5 / budget, method: variant, measure: true }),
      theory: [
        { label: 'proportional to 1/B⁴', fn: (b) => 1 / Math.pow(b, 4), scaled: true, variant: 'rk4' },
        { label: 'proportional to 1/B', fn: (b) => 1 / b, scaled: true, variant: 'euler' },
      ],
    },
  },

  logic: {
    intuition: 'Euler\'s method uses the slope at the start of a step, which is out of date by the end. A better slope for the whole step would be something like the average slope across it, but that depends on states not yet known. RK4 gets around this by exploring: it uses the first slope to guess the middle of the step, measures the slope there, uses that to guess the middle again, and then the end. Each trial move is rough, yet the four slopes together describe how the slope varies across the step well enough for their weighted average to be very accurate.',
    steps: [
      'Sample the slope at the start of the step. Call it k1.',
      'Follow k1 for half a step to a trial point, and sample the slope there at the middle time. Call it k2.',
      'Return to the start, follow k2 for half a step to a second trial point, and sample the slope there. Call it k3.',
      'Return to the start, follow k3 for the whole step to a third trial point, and sample the slope there at the end time. Call it k4.',
      'Take the real step from the start along the weighted average (k1 + 2·k2 + 2·k3 + k4) / 6, and advance the time.',
      'Repeat from the new state until the end time is reached.',
    ],
    pseudocode: [
      'rk4(f, y₀, dt, steps):',
      '  t ← 0;  y ← y₀',
      '  repeat steps times:',
      '    k1 ← f(t, y)',
      '    k2 ← f(t + dt/2, y + (dt/2)·k1)',
      '    k3 ← f(t + dt/2, y + (dt/2)·k2)',
      '    k4 ← f(t + dt, y + dt·k3)',
      '    y ← y + (dt/6)·(k1 + 2·k2 + 2·k3 + k4)',
      '    t ← t + dt',
      '  return y',
    ],
    decisions: [
      { title: 'How large a step?', text: 'Large compared with what Euler\'s method needs, but still below the stability limit of the system and small enough that the solution is smooth across one step. A practical check is to rerun with half the step: the two answers should agree to roughly the accuracy you need, and the difference should be about 15 times the error of the finer run.' },
      { title: 'Fixed or adaptive step?', text: 'This page uses a fixed step. Adaptive Runge-Kutta solvers compute two answers of different order from shared slope samples, use their difference as an error estimate, and resize the next step to hold that estimate near a tolerance.' },
      { title: 'Why not a higher order still?', text: 'Order four is the last point at which the number of slope samples equals the order. A fifth-order method of this kind needs at least six samples per step, so the gain per evaluation becomes less clear-cut. Higher-order methods pay off mainly when very high accuracy is wanted.' },
    ],
    invariants: [
      'After k steps the stored time is k × dt and the stored state is the method\'s approximation to the solution at that time.',
      'All four slope samples within a step start from the same state, the one at the beginning of the step. Only the final update changes the state.',
    ],
    edgeCases: [
      'Step size above the stability limit: for decay at rate 1 the limit is about 2.785. Beyond it the computed values grow.',
      'A rule that depends on time: the middle samples must be taken at time t + dt/2 and the last at t + dt. Using t for all four silently reduces the accuracy.',
      'A rule of change with jumps or kinks: the cancellation that gives fourth order assumes smoothness, so accuracy drops near them.',
      'Stiff systems: the stability limit forces tiny steps long after the fast part has died away.',
      'Very long simulations of systems that should conserve energy: RK4 loses energy slowly but steadily.',
      'A duration that is not a whole number of steps: this page takes as many whole steps as fit and stops short of the end.',
    ],
    correctness: 'RK4 is correct in the sense of convergence, with order four. If the rule of change is smooth enough (four continuous derivatives are sufficient), the result of one step agrees with the Taylor series of the exact solution through the term in dt⁴, so one step commits an error proportional to dt⁵. Over T/dt steps the accumulated error is proportional to dt⁴. The weights and sample positions are precisely the ones that make the lower-order error terms cancel. As with Euler\'s method the constant in front grows with the time span, and the statement only applies below the stability limit.',
    mistakes: [
      'Building each trial point from the previous trial point instead of from the start of the step. Every trial move begins at the same state.',
      'Using dt instead of dt/2 for the two middle samples, or forgetting to advance the time argument for a rule that depends on time.',
      'Getting the weights wrong, for example averaging the four slopes equally. The method then falls to a much lower order with no visible sign.',
      'In a system, updating some variables before all four slopes of all variables have been computed.',
      'Comparing RK4 with Euler at the same step size and calling it fair. RK4 does four times the work per step; compare at equal numbers of derivative evaluations.',
    ],
  },

  code: {
    sample: {
      input: 'Solve y′ = −y with y(0) = 1 up to t = 1, using 5, 10 and 20 steps, and compare with the exact value e⁻¹.',
      expected: 'dt = 0.20: y(1) = 0.3678852381, error = 0.0000057970\ndt = 0.10: y(1) = 0.3678797744, error = 0.0000003332\ndt = 0.05: y(1) = 0.3678794611, error = 0.0000000200',
    },
    python: {
      source: `import math


def rk4(f, y, dt, steps):
    t = 0.0
    for _ in range(steps):
        k1 = f(t, y)
        k2 = f(t + dt / 2, y + dt / 2 * k1)
        k3 = f(t + dt / 2, y + dt / 2 * k2)
        k4 = f(t + dt, y + dt * k3)
        y = y + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
        t = t + dt
    return y


def decay(t, y):
    return -y


exact = math.exp(-1.0)
for steps in (5, 10, 20):
    dt = 1.0 / steps
    y = rk4(decay, 1.0, dt, steps)
    print(f"dt = {dt:.2f}: y(1) = {y:.10f}, error = {abs(y - exact):.10f}")`,
      notes: [
        { line: 7, text: 'The first sample is the slope at the start of the step. On its own this is all Euler\'s method uses.' },
        { line: 8, text: 'The second sample: follow k1 for half a step and evaluate the rule there, at the middle time.' },
        { line: 9, text: 'The third sample starts again from y, not from the previous trial point, and follows k2 for half a step.' },
        { line: 11, text: 'The step actually taken: the weighted average of the four slopes with weights 1, 2, 2, 1, divided by 6.' },
        { line: 21, text: 'Each pass halves the step. The printed error falls by a factor of about 16 each time, which is fourth-order convergence.' },
      ],
    },
    javascript: {
      source: `function rk4(f, y, dt, steps) {
  let t = 0;
  for (let i = 0; i < steps; i++) {
    const k1 = f(t, y);
    const k2 = f(t + dt / 2, y + dt / 2 * k1);
    const k3 = f(t + dt / 2, y + dt / 2 * k2);
    const k4 = f(t + dt, y + dt * k3);
    y = y + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
    t = t + dt;
  }
  return y;
}

const decay = (t, y) => -y;

const exact = Math.exp(-1);
for (const steps of [5, 10, 20]) {
  const dt = 1 / steps;
  const y = rk4(decay, 1, dt, steps);
  console.log("dt = " + dt.toFixed(2) + ": y(1) = " + y.toFixed(10) + ", error = " + Math.abs(y - exact).toFixed(10));
}`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>

double decay(double t, double y) { return -y; }

double rk4(double (*f)(double, double), double y, double dt, int steps) {
    double t = 0.0;
    for (int i = 0; i < steps; ++i) {
        double k1 = f(t, y);
        double k2 = f(t + dt / 2, y + dt / 2 * k1);
        double k3 = f(t + dt / 2, y + dt / 2 * k2);
        double k4 = f(t + dt, y + dt * k3);
        y = y + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
        t = t + dt;
    }
    return y;
}

int main() {
    const double exact = std::exp(-1.0);
    const int choices[] = {5, 10, 20};
    for (int steps : choices) {
        double dt = 1.0 / steps;
        double y = rk4(decay, 1.0, dt, steps);
        std::printf("dt = %.2f: y(1) = %.10f, error = %.10f\\n", dt, y, std::fabs(y - exact));
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The work is the number of steps, T/dt, times four derivative evaluations per step. The error is proportional to the fourth power of the step size. Together these mean that the work needed for a given accuracy grows only with the fourth root of that accuracy: ten times more accuracy costs about 1.8 times the work, where Euler\'s method would cost ten times.',
    cases: [
      { case: 'Work', time: '4 × T/dt derivative evaluations', when: 'Always. Four samples and one update of the state per step.' },
      { case: 'Accuracy', time: 'Error proportional to dt⁴', when: 'The rule of change is smooth and the step is small enough for the pattern to hold. Halving dt divides the error by about 16.' },
      { case: 'Step above the stability limit', time: 'Error grows without bound', when: 'For decay at rate λ the limit is about 2.785/λ. For an undamped oscillator of angular frequency ω it is 2√2/ω, about 2.83/ω.' },
    ],
    space: 'O(d) for a state of d numbers: the state, the four slopes and one trial state.',
    memory: 'Nothing from earlier steps is kept, so the method restarts cleanly after any change to the system, such as a collision or a new control input. Methods that reuse slopes from previous steps are cheaper per step but lose this property.',
    tradeoffs: 'RK4 spends four evaluations where Euler spends one, and at very loose accuracy that is not worth it. For anything more demanding the fourth-power error wins by a wide margin. Adaptive methods go further by choosing the step automatically, at the price of more bookkeeping.',
    assumptions: [
      'The rule of change has enough continuous derivatives for the fourth-order error analysis to apply, and the step is below the stability limit.',
      'The step size is fixed and T is the length of the time span.',
      'Arithmetic is exact. In double precision the error stops improving once it nears the rounding level, about 10⁻¹⁶ relative to the size of the solution.',
      'Cost is counted in derivative evaluations, which is the fair unit for comparing methods with different numbers of samples per step.',
    ],
  },

  tradeoffs: {
    excels: [
      'Smooth, non-stiff problems where a simple fixed-step method with good accuracy is wanted.',
      'Simulations that are interrupted often by events or inputs, because it needs no history from earlier steps.',
      'Oscillating systems over moderate times, where its small error per step keeps phase and amplitude close to the truth.',
    ],
    struggles: [
      'Stiff systems. Its stability limit is only modestly larger than Euler\'s, so the step stays tied to the fastest decaying part.',
      'Very long runs of systems that should conserve energy. The energy drifts slowly in one direction.',
      'Problems with widely varying time scales, unless the step is adapted.',
      'Rules of change that are very expensive to evaluate, when low accuracy would do.',
    ],
    pitfalls: [
      'Judging the method by step count instead of by derivative evaluations.',
      'A wrong coefficient that leaves the code running and converging, only at a lower order. Always measure the order with a step-halving test.',
      'Assuming a high-order method is stable at any step. It still blows up above its limit.',
    ],
    misunderstandings: [
      "\"RK4 takes four small steps.\" It takes one step. The four slope samples all start from the state at the beginning of the step, and three of them are at trial points the solution never passes through.",
      "\"Fourth order means four times as accurate as Euler.\" It means the error shrinks with the fourth power of the step size. Halving the step divides the error by about 16, not by 2.",
      "\"RK4 is exact enough that the step size hardly matters.\" Above its stability limit the solution blows up, and with coarse steps its error can exceed that of Euler's method at the same cost.",
      "\"RK4 conserves energy.\" It does not. On a frictionless oscillator the computed energy falls slowly at every step. It is very accurate, which is a different property.",
    ],
    constraints: [
      'General-purpose solver libraries default to adaptive Runge-Kutta pairs of orders four and five, not to fixed-step RK4.',
      'Real-time systems with a fixed budget of force evaluations per frame often cannot afford four per step.',
    ],
    alternatives: [
      { id: 'euler-method', name: 'Euler\'s Method', when: 'Each derivative evaluation is precious and low accuracy is acceptable, or for a first look at a problem.' },
      { name: 'Adaptive Runge-Kutta (Dormand-Prince, Fehlberg)', when: 'The solution changes speed along the way and you want a tolerance instead of a step size. The default in most solver libraries.' },
      { name: 'Symplectic integrators (leapfrog, Verlet)', when: 'Long simulations of mechanical systems, such as orbits and molecules, where bounded energy error matters more than accuracy per step.' },
      { name: 'Implicit methods (backward differentiation, implicit Runge-Kutta)', when: 'The system is stiff.' },
    ],
    comparison: {
      columns: ['', 'RK4', 'Euler', 'Adaptive Runge-Kutta 4(5)'],
      rows: [
        ['Derivative evaluations per step', '4', '1', '6 or 7'],
        ['Error as dt shrinks', 'Proportional to dt⁴', 'Proportional to dt', 'Controlled to a tolerance'],
        ['Step size', 'Fixed, chosen by the user', 'Fixed, chosen by the user', 'Chosen automatically each step'],
        ['Stability limit on decay at rate 1', 'About 2.785', '2', 'Step is reduced automatically'],
      ],
    },
  },

  applications: [
    { title: 'General-purpose differential equation solvers', status: 'established', text: 'The default solvers in numerical libraries, such as MATLAB\'s `ode45` and the `RK45` method of SciPy\'s `solve_ivp`, are adaptive Runge-Kutta pairs of orders four and five. They descend directly from RK4 and add an error estimate for step size control.' },
    { title: 'Simulation of robots and vehicles', status: 'established', text: 'Models of robot arms, drones and cars are advanced in fixed time steps for simulation, control design and trajectory optimization. RK4 is a common integrator choice because it is accurate at the step sizes those tasks use and needs no history.' },
    { title: 'Orbit and trajectory computation', status: 'established', text: 'The paths of spacecraft and projectiles are computed by integrating the equations of motion numerically. Runge-Kutta methods of order four and higher are standard choices for this.' },
    { title: 'Exploring nonlinear and chaotic systems', status: 'illustrative', text: 'Pictures of a swinging double pendulum or a weather-like chaotic system come from integrating a few coupled equations. RK4 gives trustworthy short-term trajectories with a few lines of code.' },
    { title: 'Physics in games', status: 'illustrative', text: 'A game that needs an accurate trajectory, for a thrown object or an orbit, can afford RK4 for a few bodies even when the rest of the scene uses a cheaper integrator.' },
  ],

  connections: [
    { to: 'euler-method', type: 'prerequisite', why: 'Each trial move inside an RK4 step is an Euler step. RK4 combines four of them so that their leading errors cancel, raising the order from one to four.' },
    { to: 'concept:differential-equation', type: 'prerequisite', why: 'The method turns a rule for the rate of change into values of the changing quantity at later times.' },
    { to: 'concept:discretization', type: 'prerequisite', why: 'Continuous time is replaced by steps, and the order of a method says how quickly the resulting error vanishes as the steps shrink.' },
    { to: 'concept:convergence', type: 'related', why: 'RK4 converges at fourth order: the error is proportional to the fourth power of the step size.' },
    { to: 'concept:floating-point', type: 'advanced', why: 'Its error falls so fast that rounding, not the method, soon becomes the limit on accuracy.' },
    { to: 'kalman-filter', type: 'application', why: 'Between measurements a filter must carry its state estimate forward through a model of the dynamics. For nonlinear models that prediction is a numerical integration, commonly a Runge-Kutta step.' },
    { to: 'rrt', type: 'application', why: 'A planner for a robot with dynamics grows its tree by simulating what the robot would do under a chosen control for a short time, which is a numerical integration of the equations of motion.' },
    { to: 'newtons-method', type: 'related', why: 'Implicit Runge-Kutta methods, used for stiff systems, define their slope samples by equations that are solved with Newton\'s method at every step.' },
    { to: 'discipline:robotics', type: 'application', why: 'Predicting how a machine will move under given commands is the integration of its equations of motion.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Within one RK4 step, where does each of the three trial moves start?',
      options: ['Each starts where the previous trial move ended', 'All start from the state at the beginning of the step', 'They start at the quarter, half and three-quarter points of the step', 'They start from the exact solution'],
      answer: 1,
      explain: [
        'Chaining the trial moves is a common bug. It gives a different and less accurate method.',
        'Correct. Every trial point is the starting state plus a multiple of one earlier slope. Only the final update moves the state.',
        'The samples are at the start, the middle (twice) and the end.',
        'The exact solution is unknown; the method only ever evaluates the rule of change.',
      ],
    },
    {
      type: 'predict',
      q: 'The rule is "the value falls at a rate equal to the value", starting from 1, and one step of length 1 is taken. Euler\'s method lands on 1 − 1 × 1 = 0. The true value is about 0.368. Where does RK4 land?',
      options: ['0, the same as Euler', '0.375', '0.5', '−0.25'],
      answer: 1,
      explain: [
        'RK4 uses three more slope samples, and they are all less steep than the first.',
        'Correct. The slopes are −1, −0.5, −0.75 and −0.25. Their weighted average is (−1 − 1 − 1.5 − 0.25) ÷ 6 = −0.625, and 1 − 0.625 = 0.375.',
        '0.5 is the first trial point at the middle of the step, not the result.',
        '−0.25 is the fourth slope, not the new value.',
      ],
      tryInput: { system: 'decay', dt: 1, duration: 1 },
    },
    {
      type: 'debug',
      q: 'This RK4 step runs and gives plausible results, but a step-halving test shows the error falling by a factor of about 4, not 16. Which line is wrong?',
      code: `k1 = f(t, y)
k2 = f(t + dt / 2, y + dt / 2 * k1)
k3 = f(t + dt / 2, y + dt / 2 * k2)
k4 = f(t + dt, y + dt * k3)
y = y + dt / 4 * (k1 + k2 + k3 + k4)
t = t + dt`,
      options: ['Line 2: the trial point should use dt, not dt / 2', 'Line 3: k3 should be sampled at time t', 'Line 5: the slopes must be weighted 1, 2, 2, 1 and divided by 6', 'Line 6: time should advance by dt / 2'],
      answer: 2,
      explain: [
        'The second sample is at the middle of the step, so dt / 2 is right.',
        'Both middle samples belong at time t + dt / 2.',
        'Correct. An equal-weight average still approximates the solution, so nothing looks broken, but the cancellation that gives fourth order is lost. Only measuring the order reveals it.',
        'A full step advances the time by dt.',
      ],
    },
    {
      type: 'choice',
      q: 'You have a budget of 400 derivative evaluations for a smooth problem. Which use of it is likely to give the smaller error?',
      options: ['400 Euler steps', '100 RK4 steps, each four times as long as the Euler steps', 'They give the same error, because the work is the same', '400 RK4 steps'],
      answer: 1,
      explain: [
        'Euler\'s error is proportional to its step size. Even with steps four times shorter it is far behind.',
        'Correct. RK4\'s error falls with the fourth power of the step, which more than repays steps that are four times longer once the steps are reasonably small.',
        'Equal work does not mean equal accuracy. The order of the method decides how well the work is spent.',
        '400 RK4 steps would cost 1,600 evaluations, four times the budget.',
      ],
    },
    {
      type: 'challenge',
      title: 'Let the method choose its own step',
      prompt: 'Write a function that advances one RK4 step of size dt, and use it to build step doubling: from the same state take one step of size dt and, separately, two steps of size dt/2. The difference between the two results estimates the error of the step. If it is above a tolerance, halve dt and retry; if it is far below, double dt for the next step. Run it on the "moving target" equation y′ = cos(t) − y from y(0) = 0 to t = 12 with a tolerance of 10⁻⁶. Record how the step size changes along the way and count the derivative evaluations, then compare with fixed-step RK4 reaching the same accuracy.',
      hints: ['For a fourth-order method the error of the two half steps is about the difference divided by 15.', 'Count honestly: a trial that is rejected still cost its evaluations. The first slope of the big step and of the first half step are the same evaluation and can be shared.'],
    },
  ],

  compare: {
    idea: 'Sample the slope four times across each step and step along the weighted average.',
    requires: 'A smooth rule that gives how fast things are changing at any moment, a starting state, and a step size. It works that rule out four times per step.',
    sensitivity: 'Moderate to the step size while it is small: error falls with its fourth power. Above a system-dependent limit the solution blows up.',
    memory: 'O(d): the state, four slopes and a trial state.',
    difficulty: 'low',
    difficultyNote: 'Six lines per step. The risk is a wrong coefficient that lowers the order without any visible failure.',
    limits: 'Not suited to systems where some parts change far faster than others. Energy drifts slowly over long runs. The step stays fixed unless the method is extended.',
    useWhen: 'The problem changes smoothly and you want good accuracy from a simple method with a fixed step.',
  },

  advanced: {
    history: 'Carl Runge published the first methods of this kind in 1895, improving on Euler\'s method by evaluating the slope at more than one point in each step. Karl Heun extended the approach in 1900. In 1901 Wilhelm Kutta gave a systematic treatment that included fourth-order methods, among them the one now called the classical Runge-Kutta method or RK4. In the 1960s John Butcher developed the algebraic theory that organizes all such methods and showed that orders above four need more slope samples than their order.',
    derivation: 'A general explicit method with $s$ slope samples has the form\n\n$$k_i = f\\Big(t_n + c_i h,\\; y_n + h\\sum_{j<i} a_{ij}k_j\\Big), \\qquad y_{n+1} = y_n + h\\sum_{i=1}^{s} b_i k_i.$$\n\nExpanding both $y_{n+1}$ and the exact solution $y(t_n + h)$ in powers of $h$ and matching terms gives conditions on the coefficients: one condition for order 1, two for order 2, four for order 3 and eight for order 4. With $s = 4$ there are enough free coefficients to satisfy all eight, and one solution is\n\n$$c = \\left(0, \\tfrac12, \\tfrac12, 1\\right), \\quad a_{21} = a_{32} = \\tfrac12,\\; a_{43} = 1, \\quad b = \\left(\\tfrac16, \\tfrac13, \\tfrac13, \\tfrac16\\right),$$\n\nwhich is RK4. When $f$ depends on $t$ only, $k_2 = k_3$ and the update is $h\\left[f(t_n) + 4f(t_n + \\tfrac h2) + f(t_n + h)\\right]/6$: Simpson\'s rule.',
    proof: 'On the test equation $y\' = \\lambda y$ every sample is a multiple of $y_n$, and substituting gives\n\n$$y_{n+1} = \\left(1 + z + \\frac{z^2}{2} + \\frac{z^3}{6} + \\frac{z^4}{24}\\right) y_n, \\qquad z = h\\lambda.$$\n\nThe bracket is the Taylor series of $e^z$ through the fourth power, so one step differs from the exact factor $e^z$ by $z^5/120 + \\dots$: a local error of order $h^5$ and, after $T/h$ steps, a global error of order $h^4$. With $z = -1$ the factor is $0.375$ against $e^{-1} \\approx 0.3679$, the numbers in this lesson\'s quiz. With $z = 1$ it is $65/24 \\approx 2.70833$ against $e$, the numbers in the worked example.',
    complexityProof: 'Stability requires the factor $R(z) = 1 + z + z^2/2 + z^3/6 + z^4/24$ to satisfy $|R(z)| \\le 1$. On the negative real axis this holds for $-2.785 \\lesssim z \\le 0$. For the oscillator $z = \\pm ih$ and\n\n$$|R(ih)|^2 = 1 - \\frac{h^6}{72} + \\frac{h^8}{576},$$\n\nwhich is at most 1 exactly when $h \\le 2\\sqrt{2}$. Each step multiplies the energy by this factor, slightly below 1 for small $h$: the slow energy loss seen in the visualization. For cost, reaching error $\\varepsilon$ needs $h \\propto \\varepsilon^{1/4}$ and so a number of evaluations proportional to $\\varepsilon^{-1/4}$, against $\\varepsilon^{-1}$ for Euler\'s method.',
    variants: [
      { name: 'Midpoint and Heun methods (RK2)', text: 'Two slope samples per step and second-order accuracy. The simplest members of the family.' },
      { name: 'The 3/8 rule', text: 'Kutta\'s other fourth-order method with four samples, at thirds of the step. Slightly smaller error constants, less convenient coefficients.' },
      { name: 'Embedded pairs (Fehlberg, Dormand-Prince)', text: 'Six or seven samples arranged to give a fourth-order and a fifth-order answer at once. Their difference estimates the error and drives automatic step size control.' },
      { name: 'Implicit Runge-Kutta methods', text: 'The samples depend on each other and are found by solving equations. They can be stable for any step on decaying problems, which suits stiff systems.' },
      { name: 'Symplectic Runge-Kutta and splitting methods', text: 'Designed to preserve the geometric structure of mechanical systems, so that the energy error stays bounded over very long runs.' },
    ],
    implementation: 'Keep the coefficients in one place and verify the order with a step-halving test on a problem with a known solution: the error ratio should approach 16. Compute all four slopes of all variables before updating any variable. For rules that depend on time, pass the correct sample time to each evaluation. Reuse a scratch array for the trial state to avoid allocating inside the loop.',
    benchmarking: 'Plot error against derivative evaluations on logarithmic axes. A fourth-order method appears as a line of slope −4 until rounding error flattens it. Report the time span, the error measure and whether rejected steps are counted when comparing with adaptive methods.',
    references: [
      { authors: 'C. Runge', year: 1895, title: 'Über die numerische Auflösung von Differentialgleichungen', venue: 'Mathematische Annalen 46' },
      { authors: 'W. Kutta', year: 1901, title: 'Beitrag zur näherungsweisen Integration totaler Differentialgleichungen', venue: 'Zeitschrift für Mathematik und Physik 46' },
      { authors: 'E. Hairer, S. P. Nørsett and G. Wanner', year: 1993, title: 'Solving Ordinary Differential Equations I: Nonstiff Problems (2nd edition)', venue: 'Springer' },
      { authors: 'J. C. Butcher', year: 2008, title: 'Numerical Methods for Ordinary Differential Equations (2nd edition)', venue: 'Wiley' },
    ],
    furtherReading: [
      'R. L. Burden and J. D. Faires, *Numerical Analysis*, section 5.4, "Runge-Kutta Methods".',
      'W. H. Press, S. A. Teukolsky, W. T. Vetterling and B. P. Flannery, *Numerical Recipes* (3rd edition), chapter 17, "Integration of Ordinary Differential Equations".',
    ],
  },

  tests: [
    { name: 'the worked example: one step of 1 on growth gives slopes 1, 1.5, 1.75, 2.75 and the value 65/24', input: { system: 'growth', dt: 1, duration: 1 },
      check: (r, c) => {
        const k = r.lastStep.k.map((v) => v[0]);
        if (k.join(',') !== '1,1.5,1.75,2.75') return `slopes ${k.join(', ')}`;
        if (Math.abs(r.ys[1][0] - 65 / 24) > 1e-14) return `value ${r.ys[1][0]}`;
        if (Math.abs(r.maxError - (Math.E - 65 / 24)) > 1e-13) return `error ${r.maxError}`;
        const fourEuler = Math.pow(1.25, 4);
        if (Math.abs(fourEuler - 2.44140625) > 1e-12) return 'four Euler steps of 0.25 should give 2.44';
        return c['derivative evaluations'] === 4 || `${c['derivative evaluations']} evaluations`;
      } },
    { name: 'the quiz prediction: one step of 1 on decay gives slopes −1, −0.5, −0.75, −0.25 and the value 0.375', input: { system: 'decay', dt: 1, duration: 1 },
      check: (r) => (r.lastStep.k.map((v) => v[0]).join(',') === '-1,-0.5,-0.75,-0.25' && Math.abs(r.ys[1][0] - 0.375) < 1e-15) || `value ${r.ys[1][0]}` },
    { name: 'matches the closed form (1 − h + h²/2 − h³/6 + h⁴/24)^n on decay', input: { system: 'decay', dt: 0.5, duration: 5 },
      check: (r) => {
        const R = 1 - 0.5 + 0.125 - 0.125 / 6 + 0.0625 / 24;
        return (r.steps === 10 && r.ys.every((y, i) => Math.abs(y[0] - Math.pow(R, i)) < 1e-14)) || 'trajectory differs from the closed form';
      } },
    { name: 'fourth order: halving dt cuts the largest error about 16-fold on every system', input: { system: 'decay', dt: 0.1, duration: 5 },
      check: (r) => {
        for (const system of ['decay', 'growth', 'logistic', 'driven', 'oscillator']) {
          const T = odeById[system].duration;
          const coarse = run({ system, dt: T / 80, duration: T }, quiet).maxError;
          const fine = run({ system, dt: T / 160, duration: T }, quiet).maxError;
          const ratio = coarse / fine;
          if (!(ratio > 14.5 && ratio < 17.5)) return `${system}: error ratio ${ratio.toFixed(2)} is not close to 16`;
        }
        const half = run({ system: 'decay', dt: 0.05, duration: 5 }, quiet).maxError;
        const ratio = r.maxError / half;
        return (ratio > 15 && ratio < 18) || `decay 0.1 against 0.05: ratio ${ratio}`;
      } },
    { name: 'the errors quoted in "try this": 0.0071 at dt = 1, 0.00029 at dt = 0.5, 0.000015 at dt = 0.25', input: { system: 'decay', dt: 1, duration: 5 },
      check: (r, c) => {
        if (Math.abs(r.maxError - 0.00712) > 5e-5 || c['derivative evaluations'] !== 20) return `dt = 1: error ${r.maxError}, ${c['derivative evaluations']} evaluations`;
        const a = run({ system: 'decay', dt: 0.5, duration: 5 }, quiet).maxError;
        const b = run({ system: 'decay', dt: 0.25, duration: 5 }, quiet).maxError;
        return (Math.abs(a - 0.000291) < 2e-6 && Math.abs(b - 0.0000148) < 2e-7) || `errors ${a}, ${b}`;
      } },
    { name: 'equal budget: 64 evaluations of RK4 beat 64 of Euler by more than 100-fold; at 8 Euler wins', input: { system: 'decay', dt: 5 / 16, duration: 5 },
      check: (r, c) => {
        const counter = { n: 0, count(name, by = 1) { if (name === 'derivative evaluations') this.n += by; }, frame() {} };
        const e = run({ system: 'decay', dt: 5 / 64, duration: 5, method: 'euler' }, counter);
        if (c['derivative evaluations'] !== 64 || counter.n !== 64) return `budgets ${c['derivative evaluations']} and ${counter.n}`;
        if (!(e.maxError > 100 * r.maxError)) return `Euler ${e.maxError}, RK4 ${r.maxError}`;
        const r8 = run({ system: 'decay', dt: 2.5, duration: 5 }, quiet).maxError;
        const e8 = run({ system: 'decay', dt: 0.625, duration: 5, method: 'euler' }, quiet).maxError;
        return e8 < r8 || `at 8 evaluations Euler ${e8}, RK4 ${r8}`;
      } },
    { name: 'oscillator energy is multiplied by 1 − h⁶/72 + h⁸/576 on every step', input: { system: 'oscillator', dt: 0.5, duration: 20 },
      check: (r) => {
        const h = 0.5, factor = 1 - Math.pow(h, 6) / 72 + Math.pow(h, 8) / 576;
        const E = (y) => 0.5 * (y[0] * y[0] + y[1] * y[1]);
        for (const i of [1, 10, 40]) {
          const want = 0.5 * Math.pow(factor, i);
          if (Math.abs(E(r.ys[i]) - want) > 1e-12) return `energy after ${i} steps is ${E(r.ys[i])}, expected ${want}`;
        }
        return r.steps === 40 || `${r.steps} steps`;
      } },
    { name: 'stability limit on decay: grows at dt = 3, decays at dt = 2.7', input: { system: 'decay', dt: 3, duration: 30 },
      check: (r) => {
        if (r.ys[1][0] !== 1.375 || !(Math.abs(r.ys[10][0]) > 20)) return `dt = 3: first value ${r.ys[1][0]}, tenth ${r.ys[10][0]}`;
        const ok = run({ system: 'decay', dt: 2.7, duration: 27 }, quiet);
        return Math.abs(ok.ys[10][0]) < 1 || `dt = 2.7: tenth value ${ok.ys[10][0]}`;
      } },
  ],
};
