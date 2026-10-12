// One-variable functions shared by the root-finding lessons, so that bisection and Newton's
// method can be run on identical problems and compared. A root of f is an x where f(x) = 0.
//
// Exports
//   FUNCTIONS        the catalogue, an array of records (see below)
//   functionById     { id: record }
//   functionOptions  [{ value, label }] for a `select` input
//   rootInputs(o)    the two inputs every root-finding lesson shares: `fn` (select) and
//                    `tolerance` (log-scale range). o = { fn, tolerance } overrides the defaults.
//   sampleCurve(F, n, range)   [[x, f(x)], ...] at n + 1 evenly spaced points, for plotting.
//                    Cached for the default range. Plotting samples are not algorithm work
//                    and must not be counted as function evaluations.
//
// Each record has
//   id, label        identifier and the text shown in the select
//   expr             the formula in plain text, for notes
//   f(x), df(x)      the function and its exact derivative
//   a, b             a bracketing interval: f(a) and f(b) have opposite signs
//   x0               a suggested starting guess for Newton's method (deliberately bad where noted).
//                    Every function is also defined at x = 1, the default of the Newton lesson's slider.
//   root             the root inside [a, b], correct to double precision
//   x, y             plotting ranges [min, max]
//   about            one or two plain sentences on why the function is in the catalogue

export const FUNCTIONS = [
  {
    id: 'sqrt2', label: 'x² − 2 (the root is √2)', expr: 'x² − 2',
    f: (x) => x * x - 2,
    df: (x) => 2 * x,
    a: 1, b: 2, x0: 1, root: Math.SQRT2,
    x: [0, 2.5], y: [-2.6, 4.6],
    about: 'Solving x² − 2 = 0 computes the square root of 2. A smooth curve with one simple crossing: the easy case for every method.',
  },
  {
    id: 'cosx', label: 'cos(x) − x', expr: 'cos(x) − x',
    f: (x) => Math.cos(x) - x,
    df: (x) => -Math.sin(x) - 1,
    a: 0, b: 1, x0: 1, root: 0.7390851332151607,
    x: [-0.5, 2], y: [-2.6, 1.6],
    about: 'The number that equals its own cosine (in radians). No formula gives it, so it has to be found numerically.',
  },
  {
    id: 'cubic', label: 'x³ − 2x − 5 (the cubic Newton used)', expr: 'x³ − 2x − 5',
    f: (x) => x * x * x - 2 * x - 5,
    df: (x) => 3 * x * x - 2,
    a: 2, b: 3, x0: 2, root: 2.0945514815423265,
    x: [0.8, 3.1], y: [-8, 20],
    about: 'The equation Newton used to demonstrate his method. One real root, a little above 2.',
  },
  {
    id: 'cycle', label: 'x³ − 2x + 2 (Newton cycles from 0)', expr: 'x³ − 2x + 2',
    f: (x) => x * x * x - 2 * x + 2,
    df: (x) => 3 * x * x - 2,
    a: -2, b: 0, x0: 0, root: -1.7692923542386314,
    x: [-2.5, 1.8], y: [-9, 6],
    about: 'Started at 0, Newton\'s method steps to 1, then back to 0, for ever. The only real root is near −1.77.',
  },
  {
    id: 'atan', label: 'arctan(x) (Newton diverges from 1.5)', expr: 'arctan(x)',
    f: (x) => Math.atan(x),
    df: (x) => 1 / (1 + x * x),
    a: -1, b: 2, x0: 1.5, root: 0,
    x: [-6, 6], y: [-1.9, 1.9],
    about: 'The curve flattens out on both sides, so a tangent taken too far from the root at 0 overshoots to a point even farther away.',
  },
  {
    id: 'triple', label: '(x − 2)³ (a triple root)', expr: '(x − 2)³',
    f: (x) => (x - 2) * (x - 2) * (x - 2),
    df: (x) => 3 * (x - 2) * (x - 2),
    a: 1, b: 3.5, x0: 3.5, root: 2,
    x: [0.6, 3.7], y: [-3.4, 5.2],
    about: 'The curve touches the axis flat at x = 2. Newton\'s method still converges, but only by a factor of two thirds per step.',
  },
];

export const functionById = Object.fromEntries(FUNCTIONS.map((F) => [F.id, F]));
export const functionOptions = FUNCTIONS.map((F) => ({ value: F.id, label: F.label }));

// The inputs shared by every member of the `root-finding` compare group.
export function rootInputs({ fn = 'sqrt2', tolerance = 1e-6 } = {}) {
  return [
    { id: 'fn', type: 'select', label: 'Function', options: functionOptions, default: fn,
      help: 'The curve whose crossing of zero we want.' },
    { id: 'tolerance', type: 'range', scale: 'log', label: 'Tolerance', min: 1e-12, max: 0.5, default: tolerance,
      help: 'How close is close enough. Logarithmic slider: each notch to the left asks for a more exact answer.' },
  ];
}

const curveCache = new Map();
export function sampleCurve(F, n = 200, range = null) {
  const make = (lo, hi) => Array.from({ length: n + 1 }, (_, i) => {
    const x = lo + (i / n) * (hi - lo);
    return [x, F.f(x)];
  });
  if (range) return make(range[0], range[1]);
  const key = `${F.id}:${n}`;
  if (!curveCache.has(key)) curveCache.set(key, make(F.x[0], F.x[1]));
  return curveCache.get(key);
}
