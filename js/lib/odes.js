// Initial value problems shared by the ODE integration lessons, so that Euler's method and
// Runge-Kutta can be run on identical problems and scored against a known exact solution.
// An initial value problem gives a starting state y(0) and a rule y′ = f(t, y) for how the
// state changes; the task is to find y at later times.
//
// Exports
//   ODES            the catalogue, an array of records (see below)
//   odeById         { id: record }
//   odeOptions      [{ value, label }] for a `select` input
//   odeInputs(o)    the three inputs every ODE lesson shares: `system` (select), `dt`
//                   (log-scale range) and `duration` (range). o = { system, dt, duration }
//                   overrides the defaults.
//   stepCount(duration, dt)   how many whole steps of length dt fit in the duration
//   errorNorm(u, v) Euclidean distance between two states (absolute difference for scalars)
//   exactCurve(S, tEnd, n)    [[t, first component of the exact solution], ...] for plotting
//   plotRange(S, tEnd)        [min, max] vertical range that frames the exact solution's first
//                             component over 0..tEnd with a margin (equals roughly S.y at S.duration)
//
// The state is always an ARRAY, of length 1 for a scalar equation and 2 for the oscillator,
// so an integrator can be written once for every system. Each record has
//   id, label       identifier and the text shown in the select
//   dim             1 or 2
//   names           what each component of the state is called
//   f(t, y)         the right-hand side: returns the array of rates of change dy/dt
//   y0              the state at t = 0
//   exact(t)        the exact solution, as an array
//   duration        a sensible time span to integrate over
//   y               plotting range [min, max] for the first component over the full duration
//   rule            the equation in plain words, for notes
//   energy(y)       (oscillator only) a quantity the exact solution keeps constant
//   about           one or two plain sentences on why the system is in the catalogue

export const ODES = [
  {
    id: 'decay', label: 'Exponential decay: y′ = −y', dim: 1, names: ['y'],
    f: (t, y) => [-y[0]],
    y0: [1],
    exact: (t) => [Math.exp(-t)],
    duration: 5, y: [-0.1, 1.1],
    rule: 'the value falls at a rate equal to the value itself',
    about: 'The larger the value, the faster it falls: cooling, radioactive decay, a discharging capacitor. Exact solution y = e^(−t).',
  },
  {
    id: 'growth', label: 'Exponential growth: y′ = y', dim: 1, names: ['y'],
    f: (t, y) => [y[0]],
    y0: [1],
    exact: (t) => [Math.exp(t)],
    duration: 3, y: [0, 21],
    rule: 'the value grows at a rate equal to the value itself',
    about: 'The larger the value, the faster it grows: compound interest, unchecked population growth. Exact solution y = e^t.',
  },
  {
    id: 'logistic', label: 'Logistic growth: y′ = y(1 − y)', dim: 1, names: ['y'],
    f: (t, y) => [y[0] * (1 - y[0])],
    y0: [0.1],
    exact: (t) => [1 / (1 + 9 * Math.exp(-t))],
    duration: 10, y: [0, 1.15],
    rule: 'the value grows at a rate of value × (1 − value), so growth stalls as the value nears 1',
    about: 'Growth that starts exponential and levels off at a ceiling of 1. Exact solution y = 1 / (1 + 9e^(−t)).',
  },
  {
    id: 'driven', label: 'Driven relaxation: y′ = cos(t) − y', dim: 1, names: ['y'],
    f: (t, y) => [Math.cos(t) - y[0]],
    y0: [0],
    exact: (t) => [(Math.cos(t) + Math.sin(t) - Math.exp(-t)) / 2],
    duration: 12, y: [-0.95, 0.95],
    rule: 'the value is pulled toward cos(t), a target that keeps moving',
    about: 'The rate depends on the time as well as on the value. Exact solution y = (cos t + sin t − e^(−t)) / 2.',
  },
  {
    id: 'oscillator', label: 'Harmonic oscillator: x′ = v, v′ = −x', dim: 2, names: ['x', 'v'],
    f: (t, y) => [y[1], -y[0]],
    y0: [1, 0],
    exact: (t) => [Math.cos(t), -Math.sin(t)],
    duration: 20, y: [-2.2, 2.2],
    rule: 'the position x changes at rate v, and the velocity v changes at rate −x',
    energy: (y) => 0.5 * (y[0] * y[0] + y[1] * y[1]),
    about: 'A mass on an ideal spring. Two numbers, position and velocity, each driving the other. The exact motion x = cos t repeats for ever and keeps the energy ½(x² + v²) constant.',
  },
];

export const odeById = Object.fromEntries(ODES.map((S) => [S.id, S]));
export const odeOptions = ODES.map((S) => ({ value: S.id, label: S.label }));

// The inputs shared by every member of the `ode-integration` compare group.
export function odeInputs({ system = 'decay', dt = 0.5, duration = 5 } = {}) {
  return [
    { id: 'system', type: 'select', label: 'System', options: odeOptions, default: system,
      help: 'The rule of change to follow. Each one has a known exact solution to compare against.' },
    { id: 'dt', type: 'range', scale: 'log', label: 'Step size (dt)', min: 0.01, max: 3, default: dt,
      help: 'How far time advances in one step. Logarithmic slider.' },
    { id: 'duration', type: 'range', label: 'Duration', min: 1, max: 40, step: 1, default: duration,
      help: 'How much time to simulate. The run takes as many whole steps as fit.' },
  ];
}

// Whole steps of length dt that fit in the duration. The small allowance absorbs rounding
// when the duration is an exact multiple of dt (5 / 0.1 must give 50, not 49).
export const stepCount = (duration, dt) => Math.floor(duration / dt + 1e-9);

export function errorNorm(u, v) {
  let s = 0;
  for (let i = 0; i < u.length; i++) s += (u[i] - v[i]) * (u[i] - v[i]);
  return Math.sqrt(s);
}

const curveCache = new Map();
export function exactCurve(S, tEnd, n = 240) {
  const key = `${S.id}:${tEnd}:${n}`;
  if (!curveCache.has(key)) {
    if (curveCache.size > 60) curveCache.clear();
    curveCache.set(key, Array.from({ length: n + 1 }, (_, i) => {
      const t = (i / n) * tEnd;
      return [t, S.exact(t)[0]];
    }));
  }
  return curveCache.get(key);
}

// A vertical range that frames the exact solution over 0..tEnd, so that a short run of a
// fast-growing system is not drawn as a flat line at the bottom of a tall plot.
export function plotRange(S, tEnd) {
  let lo = Infinity, hi = -Infinity;
  for (const p of exactCurve(S, tEnd)) { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; }
  const pad = 0.1 * (hi - lo) || 0.5;
  return [lo - pad, hi + pad];
}
