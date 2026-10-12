import { FUNCTIONS, functionById, rootInputs, sampleCurve } from '../../js/lib/functions.js';

const MAX_STEPS = 200;

// Plain decimal formatting for notes: about `sig` significant digits, no exponent notation.
function num(v, sig = 7) {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e9 || a < 1e-13) return v.toExponential(2).replace('-', '−');
  let s = v.toFixed(Math.max(0, Math.min(16, sig - 1 - Math.floor(Math.log10(a)))));
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('-', '−');
}
const side = (v) => (v > 0 ? 'above zero' : 'below zero');

function run(input, t) {
  const F = functionById[input.fn];
  if (!F) throw new Error('Unknown function.');
  const tol = input.tolerance;
  if (!(tol > 0)) throw new Error('The tolerance must be greater than zero.');
  let a = input.a ?? F.a, b = input.b ?? F.b;
  if (!(a < b)) throw new Error('The bracket needs a left end smaller than its right end.');
  let fa = F.f(a); t.count('function evaluations');
  let fb = F.f(b); t.count('function evaluations');
  if (fa === 0 || fb === 0) throw new Error('One end of the bracket is already a root. Nothing to search for.');
  if ((fa > 0) === (fb > 0)) {
    throw new Error(`The function is ${side(fa)} at both ends of the bracket, so nothing shows that it crosses zero between them. Bisection needs opposite signs at the two ends.`);
  }
  const startWidth = b - a;
  let steps = 0, exact = false, atLimit = false, root = null;

  const views = ({ m = null, fm = null, dropped = null, done = false } = {}) => {
    const [y0, y1] = F.y;
    const w = b - a;
    const roomy = w >= 0.04 * (F.x[1] - F.x[0]);
    const band = done ? 'done' : 'frontier';
    const main = [];
    if (dropped) main.push({ type: 'rect', x: dropped[0], y: y0, w: dropped[1] - dropped[0], h: y1 - y0, role: 'dim', alpha: 0.2 });
    main.push({ type: 'rect', x: a, y: y0, w, h: y1 - y0, role: band, alpha: 0.22 });
    if (!roomy) main.push({ type: 'segments', segments: [[a + w / 2, y0, a + w / 2, y1]], role: band, width: 1.5, alpha: 0.7 });
    main.push({ type: 'segments', segments: [[F.x[0], 0, F.x[1], 0]], role: 'muted', width: 1 });
    main.push({ type: 'line', points: sampleCurve(F), role: 'moss', width: 2.4 });
    main.push({ type: 'points', points: [[F.root, 0]], role: 'forest', hollow: true, r: 6 });
    main.push({ type: 'segments', segments: [[a, 0, a, fa], [b, 0, b, fb]], role: 'frontier', width: 1.5 });
    main.push({ type: 'points', points: [{ x: a, y: fa, label: roomy ? 'a' : '' }, { x: b, y: fb, label: roomy ? 'b' : '' }], role: 'frontier', r: 4.5 });
    if (m !== null) {
      main.push({ type: 'segments', segments: [[m, 0, m, fm]], role: 'active', width: 1.5 });
      main.push({ type: 'points', points: [{ x: m, y: fm, label: roomy ? 'm' : '' }], role: 'active', r: 5.5, ring: true });
    }

    // The same bracket, magnified so that it always fills the strip.
    const zx = [a - 0.1 * w, b + 0.1 * w];
    const top = 1.35 * Math.max(Math.abs(fa), Math.abs(fb)) || 1;
    const labelY = (fv) => (fv > 0 ? -0.62 : 0.5) * top;
    const zoom = [
      { type: 'rect', x: a, y: -top, w, h: 2 * top, role: band, alpha: 0.16 },
      { type: 'segments', segments: [[zx[0], 0, zx[1], 0]], role: 'muted', width: 1 },
      { type: 'line', points: sampleCurve(F, 48, zx), role: 'moss', width: 2.4 },
      { type: 'points', points: [[a, fa], [b, fb]], role: 'frontier', r: 4.5 },
      { type: 'text', at: [a + 0.012 * w, labelY(fa)], text: `a = ${num(a, 10)}`, role: 'text', align: 'left' },
      { type: 'text', at: [b - 0.012 * w, labelY(fb)], text: `b = ${num(b, 10)}`, role: 'text', align: 'right' },
    ];
    if (m !== null) {
      zoom.push({ type: 'segments', segments: [[m, 0, m, fm]], role: 'active', width: 1.5 });
      zoom.push({ type: 'points', points: [[m, fm]], role: 'active', r: 5.5, ring: true });
      zoom.push({ type: 'text', at: [m, labelY(fm)], text: `m = ${num(m, 10)}`, role: 'text', align: 'center' });
    }
    if (done && root !== null) {
      main.push({ type: 'points', points: [{ x: root, y: 0, label: 'answer' }], role: 'done', r: 4.5 });
      zoom.push({ type: 'points', points: [[root, 0]], role: 'done', r: 6, ring: true });
      zoom.push({ type: 'text', at: [root, 0.5 * top], text: `answer = ${num(root, 10)}`, role: 'text', align: 'center' });
    }
    return [
      { kind: 'scene', title: `The curve y = ${F.expr} and the bracket that traps its crossing`, x: F.x, y: F.y, aspect: 0.46, axes: { xLabel: 'x', yLabel: 'f(x)' }, layers: main,
        legend: [{ label: 'the curve f(x)', role: 'moss' }, { label: 'true crossing (ring) and final answer (dot)', role: 'forest' }, { label: 'bracket from a to b', role: 'frontier' }, { label: 'midpoint m', role: 'active' }, { label: 'half just discarded', role: 'dim' }] },
      { kind: 'scene', title: `Magnified: the bracket is ${num(w, 3)} wide and fills this strip`, x: zx, y: [-top, top], aspect: 0.2, axes: false, layers: zoom },
    ];
  };

  t.frame(() => ({ line: [0, 1],
    note: `We want the x where the curve y = ${F.expr} crosses zero. At **a = ${num(a)}** the function is ${num(fa, 5)}, which is ${side(fa)}. At **b = ${num(b)}** it is ${num(fb, 5)}, which is ${side(fb)}. The curve has no breaks, so it must cross zero somewhere between them. The shaded band is that bracket.`,
    views: views(), vars: { a: num(a), b: num(b), width: num(b - a, 4) } }));

  while (b - a > tol) {
    if (steps >= MAX_STEPS) { atLimit = true; break; }
    const m = a + (b - a) / 2;
    if (!(m > a && m < b)) { atLimit = true; break; }   // no number left between a and b
    const fm = F.f(m); t.count('function evaluations');
    steps++;
    const k = steps;
    t.frame(() => ({ line: 3,
      note: `Step ${k}. The midpoint of the bracket is **m = ${num(m, 9)}**. There the function is ${num(fm, 5)}, which is ${fm === 0 ? 'exactly zero' : side(fm)}.`,
      views: views({ m, fm }), vars: { step: k, a: num(a, 9), b: num(b, 9), m: num(m, 9), 'f(m)': num(fm, 5) } }));
    if (fm === 0) {
      exact = true; root = m;
      break;
    }
    let dropped;
    const sameAsA = (fm > 0) === (fa > 0);
    if (sameAsA) { dropped = [a, m]; a = m; fa = fm; } else { dropped = [m, b]; b = m; fb = fm; }
    t.frame(() => ({ line: sameAsA ? [5, 6] : [5, 7, 8],
      note: `f(m) is ${side(fm)}, the same side as f(${sameAsA ? 'a' : 'b'}). The crossing is therefore between ${sameAsA ? 'm and b' : 'a and m'}, so move **${sameAsA ? 'a' : 'b'}** to ${num(m, 9)} and discard the other half. The bracket is now ${num(b - a, 4)} wide, half of what it was.`,
      views: views({ dropped }), vars: { step: k, a: num(a, 9), b: num(b, 9), width: num(b - a, 4) } }));
  }

  if (root === null) root = a + (b - a) / 2;
  const width = b - a;
  t.frame(() => ({ line: exact ? 4 : 9,
    note: exact
      ? `The midpoint ${num(root, 10)} makes the function exactly zero, so it is the root itself. This is rare: it took ${steps} step${steps === 1 ? '' : 's'}.`
      : atLimit
        ? `The bracket is ${num(width, 3)} wide and cannot be halved again: the computer has no number between a and b. The answer is **${num(root, 14)}**, as exact as this number format allows.`
        : `The bracket is ${num(width, 3)} wide, no wider than the tolerance ${num(tol, 3)}, so stop. The answer is its midpoint, **${num(root, 10)}**. The true crossing is inside the bracket, so the answer is off by at most ${num(width / 2, 3)}. It took ${steps} halving${steps === 1 ? '' : 's'}: the bracket started ${num(startWidth, 4)} wide.`,
    views: views({ done: true }),
    vars: { root: num(root, 10), steps, 'final width': num(width, 3) } }));

  return { root, iterations: steps, status: 'converged', exact, atLimit, a, b, width, startWidth, tolerance: tol, fn: F.id };
}

const quiet = { count() {}, frame() {} };
const predicted = (width, tol) => Math.max(0, Math.ceil(Math.log2(width / tol)));

export default {
  meta: {
    id: 'bisection-method',
    name: 'Bisection Method',
    aliases: ['bisection', 'interval halving', 'binary chopping', 'binary search root finding', 'bracketing method'],
    kind: 'algorithm',
    discipline: 'mathematics',
    alsoIn: [
      { id: 'algorithms', why: 'It is binary search carried from a sorted list to the number line: one test at the middle discards half of what remains.' },
      { id: 'finance', why: 'Quantities such as an internal rate of return have no formula in general and are found by root finding; bisection is the method that cannot fail once the rate is bracketed.' },
    ],
    subfield: 'Numerical analysis',
    family: 'Root finding',
    lab: 'numerical',
    compareGroup: 'root-finding',
    summary: 'Solves f(x) = 0 by trapping a sign change between two points and halving that interval until it is as narrow as required.',
    difficulty: 'beginner',
    order: 430,
    paradigms: ['iterative-refinement', 'divide-and-conquer'],
    randomized: false,
    approximate: true,
    time: { best: 'O(1) if a midpoint is exactly the root', average: 'O(log((b − a)/ε)) function evaluations', worst: 'O(log((b − a)/ε)) function evaluations', class: 'logarithmic' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['solve an equation', 'find where a function is zero', 'find a root', 'find where a curve crosses the axis', 'compute a square root', 'invert a function'],
      techniques: ['bracketing', 'interval halving', 'sign test', 'intermediate value theorem'],
      applications: ['scientific computing', 'engineering design', 'finance', 'standard libraries'],
    },
    prerequisites: ['binary-search', 'concept:convergence', 'concept:invariant'],
  },

  bigIdea: {
    simple: "The bisection method finds the exact spot where something changes from too little to too much. Think of a shower dial. At one setting the water is too cold. At another setting it is too hot. Somewhere between the two is the setting that is just right. So you try the setting exactly halfway between. If the water is still too cold, the right setting must be in the upper half. If it is too hot, the right setting must be in the lower half. Either way, the gap you have to search is now half as wide. Try the middle of that gap, and halve it again. After ten tries the gap is about a thousand times narrower than at the start. After twenty tries it is a million times narrower. Computers use this to solve equations that no formula can solve. It is not the fastest method, but it is the safest. As long as the thing being measured changes smoothly, the answer can never slip out of the gap.",
    what: 'The bisection method solves an equation written as f(x) = 0. It starts from two numbers, a and b, where the function has opposite signs: negative at one, positive at the other. If the function is continuous, its curve must cross zero somewhere between them. The method evaluates the function at the midpoint, keeps whichever half still has opposite signs at its two ends, and repeats until the interval is as narrow as you asked.',
    why: 'Most equations cannot be rearranged into a formula for x. The answer has to be closed in on by trial. Bisection is the method to trust when little is known about the function. It needs no derivative, no good starting guess and no luck: only a continuous function and one change of sign. It also tells you, before you begin, exactly how many steps it will take.',
    when: 'Use it when you can bracket the root and reliability matters more than speed, or when the function is rough, costly to differentiate or poorly understood. Prefer [Newton\'s method](#/algorithm/newtons-method) when you have the derivative and a good starting guess, because it needs far fewer steps. Production root finders combine the two ideas: a fast method proposes each step, and bisection takes over whenever a proposal misbehaves.',
    interesting: 'Each step costs one evaluation of the function and buys exactly one binary digit of the answer. The shape of the function makes no difference: a wildly wiggling curve and a straight line take the same number of steps. It is [binary search](#/algorithm/binary-search) moved from a sorted list to the number line, where the list never ends and so the search stops at a tolerance instead of at a single item.',
    where: 'It is the safety net inside the root finders of numerical libraries. Brent\'s method, the usual general-purpose solver for one equation in one unknown, falls back on a bisection step whenever its faster guesses stop making progress. Bisection on a counting function is also a standard way to compute selected eigenvalues of symmetric tridiagonal matrices.',
    analogy: {
      title: 'Finding the right setting on a dial',
      text: 'A shower dial is too cold at one mark and too hot at another. The comfortable setting lies between them. Turn the dial to the halfway mark and feel the water. Whichever way it is wrong tells you which half holds the right setting, and you can forget the other half for good. Each test halves the stretch of dial that is still in question.',
      limits: 'A person at a shower uses more than "too hot" or "too cold". If the water is only slightly too cold, they nudge the dial a little instead of going to the halfway mark. Bisection ignores how far off the midpoint is and looks only at the sign, which is why faster methods exist. The dial also has one right setting, while a function can cross zero several times inside a bracket. Bisection then finds one of the crossings and says nothing about the others.',
    },
  },

  example: {
    setup: "Find the number that gives 2 when multiplied by itself (the square root of 2). Call the guess x and look at x × x − 2. We want the x that makes this zero. At x = 1 it is −1, which is too low. At x = 2 it is 2, which is too high. So the answer is trapped between 1 and 2.",
    steps: [
      "The middle of 1 and 2 is 1.5. Now 1.5 × 1.5 − 2 = 0.25, which is too high. The answer is between 1 and 1.5.",
      "The middle of 1 and 1.5 is 1.25. Now 1.25 × 1.25 − 2 = −0.4375, which is too low. The answer is between 1.25 and 1.5.",
      "The middle of 1.25 and 1.5 is 1.375. Now 1.375 × 1.375 − 2 is about −0.11, which is too low. The answer is between 1.375 and 1.5.",
      "The middle of 1.375 and 1.5 is 1.4375. Now 1.4375 × 1.4375 − 2 is about 0.07, which is too high. The answer is between 1.375 and 1.4375.",
    ],
    result: "After four steps the answer is trapped between 1.375 and 1.4375, a gap of 0.0625. That is one sixteenth of the starting gap, because halving four times divides by 16. The middle of the final gap, 1.40625, is within 0.03125 of the true value 1.41421.",
    tryInput: { fn: 'sqrt2', tolerance: 0.0625 },
  },

  terms: [
    { term: "Function", meaning: "A rule that turns an input number into an output number." },
    { term: "Root", meaning: "An input that makes the function's output exactly zero. On a graph it is where the curve crosses the horizontal axis." },
    { term: "Sign", meaning: "Whether a number is positive (above zero) or negative (below zero)." },
    { term: "Bracket", meaning: "Two inputs, one giving a negative output and one a positive output, so that a root is trapped between them." },
    { term: "Midpoint", meaning: "The number exactly halfway between two others." },
    { term: "Continuous", meaning: "Having no jumps or gaps. A continuous curve can be drawn without lifting the pen." },
    { term: "Tolerance", meaning: "How narrow the bracket must become before we accept the answer and stop." },
    { term: "Converge", meaning: "To settle down, getting closer and closer to one answer." },
  ],

  takeaway: "Trap the answer between a guess that is too low and one that is too high, test the middle, keep the half that still traps it, and repeat.",

  viz: {
    describe: 'A plot of the chosen function with a horizontal line at zero. A shaded ochre band marks the current bracket from a to b, with a dot on the curve at each end. A terracotta dot marks the midpoint being tested, a hollow green ring marks the true root, a grey band marks the half that was just discarded, and a green dot marks the final answer. Below, a strip shows the same bracket magnified to fill the full width, with the values of a, b and the midpoint written out.',
    inputs: rootInputs(),
    presets: [
      { label: 'Square root of 2', values: { fn: 'sqrt2', tolerance: 1e-6 } },
      { label: 'The worked example: four steps', values: { fn: 'sqrt2', tolerance: 0.0625 } },
      { label: 'cos(x) = x', values: { fn: 'cosx', tolerance: 1e-6 } },
      { label: 'Where Newton cycles, bisection is fine', values: { fn: 'cycle', tolerance: 1e-6 } },
      { label: 'Flat triple root', values: { fn: 'triple', tolerance: 1e-6 } },
    ],
    tryThis: [
      'Keep the function fixed and drag the tolerance from 0.001 to 0.000001. The answer becomes a thousand times more exact, yet the run needs only ten more steps, because 2 multiplied by itself ten times is 1,024.',
      'Run "Square root of 2" and then "cos(x) = x" at the same tolerance. Both start from a bracket of width 1, and both take exactly the same number of steps. The shape of the curve does not matter.',
      'Load "Where Newton cycles, bisection is fine". Newton\'s method can loop for ever on this function. Bisection only asks for the sign at each midpoint, so it closes in as steadily as on any other curve.',
      'Load "Flat triple root" and read the values of f(m) in the notes. They become tiny long before the bracket is narrow, because the curve is flat near its root. A small function value does not mean the answer is close; the bracket width is what tells you.',
    ],
    run,
    report: (r, c) => `Root ≈ ${num(r.root, 10)}, off by at most ${num(r.width / 2, 2)} (half the final bracket width).\nFinal bracket: [${num(r.a, 10)}, ${num(r.b, 10)}]\n${r.iterations} halvings and ${c['function evaluations'] || 0} function evaluations: two for the starting ends, then one for each midpoint.`,
    experiment: {
      title: 'Function evaluations as the tolerance tightens',
      note: 'Each point is a real run of this page\'s implementation with the tolerance set to 10 to the power −d. The count is 2 evaluations for the two ends of the starting bracket plus one per halving. The step lines are the formula 2 + ⌈log₂(width ÷ tolerance)⌉, which depends only on the starting width, not on the function.',
      metric: 'function evaluations',
      metricLabel: 'Function evaluations',
      sizeLabel: 'Decimal digits of accuracy asked for (d)',
      sizes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      variants: [
        { id: 'sqrt2', label: 'x² − 2 from the bracket [1, 2]' },
        { id: 'cycle', label: 'x³ − 2x + 2 from the bracket [−2, 0]' },
      ],
      input: (d, variant) => ({ fn: variant, tolerance: Math.pow(10, -d) }),
      theory: [
        { label: '2 + ⌈log₂(10^d)⌉ (starting width 1)', fn: (d) => 2 + predicted(1, Math.pow(10, -d)), variant: 'sqrt2' },
        { label: '2 + ⌈log₂(2 × 10^d)⌉ (starting width 2)', fn: (d) => 2 + predicted(2, Math.pow(10, -d)), variant: 'cycle' },
      ],
    },
  },

  logic: {
    intuition: 'A continuous curve that is below zero at one point and above zero at another has to pass through zero on the way. That fact needs no knowledge of the curve\'s shape. Testing the middle point tells you which half the crossing is in, and the same fact then applies to that half. Repeating the test squeezes the crossing into as small an interval as you like.',
    steps: [
      'Start with a bracket: two numbers a and b where f(a) and f(b) have opposite signs.',
      'Compute the midpoint m and evaluate f(m).',
      'If f(m) is exactly zero, m is the root. Stop.',
      'If f(m) has the same sign as f(a), the sign change is between m and b, so replace a with m. Otherwise it is between a and m, so replace b with m.',
      'The bracket is now half as wide and still has opposite signs at its ends. Repeat from step 2 until its width is no more than the tolerance.',
      'Report the midpoint of the final bracket. The true root is within half the final width of it.',
    ],
    pseudocode: [
      'bisection(f, a, b, tol):',
      '  require f(a) and f(b) to have opposite signs',
      '  while b − a > tol:',
      '    m ← a + (b − a) / 2',
      '    if f(m) = 0: return m',
      '    if f(m) has the same sign as f(a):',
      '      a ← m',
      '    else:',
      '      b ← m',
      '  return a + (b − a) / 2',
    ],
    decisions: [
      { title: 'When to stop?', text: 'This page stops when the bracket width b − a is no more than the tolerance, and returns the midpoint. The error is then at most half the tolerance. Another common rule stops when half the width is below the tolerance. Stopping when |f(m)| is small is weaker: on a flat curve the function can be tiny while x is still far from the root.' },
      { title: 'How to find the first bracket?', text: 'Bisection does not find its own bracket. Common approaches are to use what is known about the problem (a rate lies between 0 and 1, a length is positive), to scan a grid for a change of sign, or to start from one point and step outward with growing strides until the sign flips.' },
      { title: 'How to compare signs?', text: 'Compare the signs directly rather than testing whether the product f(a) × f(m) is negative. The product of two very small numbers can round to zero, and the product of two very large ones can overflow.' },
    ],
    invariants: [
      'At the start of every step, f(a) and f(b) have opposite signs, so the bracket [a, b] contains at least one root of a continuous f.',
      'After k steps the bracket is exactly the starting width divided by 2 to the power k.',
    ],
    edgeCases: [
      'Same sign at both ends: there may be no root, or an even number of them. The method cannot start, and this page reports an error.',
      'A midpoint lands exactly on the root: f(m) is zero and the method returns at once.',
      'Several roots inside the bracket: an odd number of crossings is present, and the method converges to one of them. Which one depends on where the midpoints fall.',
      'A root where the curve touches zero without crossing, such as x² at 0: there is no change of sign, so it cannot be bracketed.',
      'A jump instead of a crossing, such as 1/x between −1 and 1: the signs differ, so the method runs and converges to the jump, which is not a root.',
      'A tolerance finer than the spacing of floating-point numbers: the midpoint eventually equals one of the ends. The loop must detect this, or it never ends.',
    ],
    correctness: 'The loop keeps one invariant: f(a) and f(b) have opposite signs. It holds at the start by assumption. At each step f(m) is either zero, in which case m is returned and is a root, or it shares its sign with exactly one of f(a) and f(b). The method replaces that end with m, so the new ends again have opposite signs. By the intermediate value theorem, a continuous function with opposite signs at the ends of an interval has a root inside it, so every bracket contains a root. The width halves each step, so after k steps any point of the bracket is within (b − a)/2^k of that root, and the returned midpoint is within half of that.',
    mistakes: [
      'Moving the wrong end: replacing b when f(m) has the sign of f(b)\'s opposite. The bracket then no longer contains a sign change and the method homes in on nothing.',
      'Comparing the sign of f(m) with a stale value of f(a) after a has moved.',
      'Stopping when |f(m)| is small and reporting high accuracy. That measures the height of the curve, not the distance to the root.',
      'Calling it on a function with a jump and trusting the result without checking that f is small there.',
      'Writing the midpoint as (a + b) / 2. It is usually fine, but the sum can overflow for very large values. The form a + (b − a) / 2 cannot.',
    ],
  },

  code: {
    sample: {
      input: 'Solve x² − 2 = 0 on the bracket [1, 2] at tolerances of 10⁻¹, 10⁻³, 10⁻⁵ and 10⁻⁷.',
      expected: 'tolerance 1e-1:  4 steps, root = 1.4062500\ntolerance 1e-3: 10 steps, root = 1.4145508\ntolerance 1e-5: 17 steps, root = 1.4142113\ntolerance 1e-7: 24 steps, root = 1.4142136',
    },
    python: {
      source: `def bisection(f, a, b, tol):
    fa, fb = f(a), f(b)
    if (fa > 0) == (fb > 0):
        raise ValueError("f(a) and f(b) must have opposite signs")
    steps = 0
    while b - a > tol:
        m = a + (b - a) / 2
        fm = f(m)
        steps += 1
        if fm == 0:
            return m, steps
        if (fm > 0) == (fa > 0):
            a, fa = m, fm
        else:
            b = m
    return a + (b - a) / 2, steps


def f(x):
    return x * x - 2


for digits in (1, 3, 5, 7):
    root, steps = bisection(f, 1.0, 2.0, 10.0 ** -digits)
    print(f"tolerance 1e-{digits}: {steps:2d} steps, root = {root:.7f}")`,
      notes: [
        { line: 3, text: 'The precondition. Without opposite signs at the two ends there is no guarantee of a root between them, so the function refuses to start.' },
        { line: 6, text: 'The loop runs until the bracket is no wider than the tolerance. The number of passes is fixed in advance by the starting width and the tolerance.' },
        { line: 12, text: 'Signs are compared directly. If f(m) is on the same side of zero as f(a), the crossing is in the right half, so the left end moves up to m.' },
        { line: 16, text: 'The midpoint of the final bracket is returned. The root is inside the bracket, so the answer is wrong by at most half its width.' },
      ],
    },
    javascript: {
      source: `function bisection(f, a, b, tol) {
  let fa = f(a);
  const fb = f(b);
  if ((fa > 0) === (fb > 0)) {
    throw new Error("f(a) and f(b) must have opposite signs");
  }
  let steps = 0;
  while (b - a > tol) {
    const m = a + (b - a) / 2;
    const fm = f(m);
    steps++;
    if (fm === 0) return [m, steps];
    if ((fm > 0) === (fa > 0)) {
      a = m;
      fa = fm;
    } else {
      b = m;
    }
  }
  return [a + (b - a) / 2, steps];
}

const f = (x) => x * x - 2;

for (const digits of [1, 3, 5, 7]) {
  const [root, steps] = bisection(f, 1, 2, Math.pow(10, -digits));
  const count = String(steps).padStart(2, " ");
  console.log("tolerance 1e-" + digits + ": " + count + " steps, root = " + root.toFixed(7));
}`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>
#include <stdexcept>

double f(double x) { return x * x - 2; }

// Returns the root and writes the number of halvings to steps.
double bisection(double a, double b, double tol, int& steps) {
    double fa = f(a), fb = f(b);
    if ((fa > 0) == (fb > 0)) {
        throw std::invalid_argument("f(a) and f(b) must have opposite signs");
    }
    steps = 0;
    while (b - a > tol) {
        double m = a + (b - a) / 2;
        double fm = f(m);
        ++steps;
        if (fm == 0) return m;
        if ((fm > 0) == (fa > 0)) {
            a = m;
            fa = fm;
        } else {
            b = m;
        }
    }
    return a + (b - a) / 2;
}

int main() {
    const int digitChoices[] = {1, 3, 5, 7};
    for (int digits : digitChoices) {
        int steps = 0;
        double root = bisection(1.0, 2.0, std::pow(10.0, -digits), steps);
        std::printf("tolerance 1e-%d: %2d steps, root = %.7f\\n", digits, steps, root);
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The work is counted in evaluations of the function, since that is usually the expensive part. Two evaluations check the starting bracket, and each step adds one. The number of steps is the number of halvings needed to shrink the starting width down to the tolerance: the base-2 logarithm of their ratio, rounded up.',
    cases: [
      { case: 'Every input', time: '⌈log₂((b − a)/ε)⌉ steps', when: 'Always, unless a midpoint happens to be an exact root. The function\'s shape has no effect.' },
      { case: 'Per decimal digit', time: 'About 3.32 steps', when: 'Ten times more accuracy needs log₂ 10 ≈ 3.32 more halvings.' },
      { case: 'Lucky', time: 'Fewer steps', when: 'A midpoint makes f exactly zero and the method returns early.' },
    ],
    space: 'O(1): the two ends of the bracket and the function value at one of them.',
    memory: 'Nothing is stored between steps except the bracket. The method works the same whether a function evaluation is one multiplication or an hour-long simulation.',
    tradeoffs: 'Bisection converges linearly: the error bound halves each step, whatever the function. Newton\'s method roughly doubles the number of correct digits per step near a simple root, but needs a derivative and can fail from a poor start. Bisection buys certainty with extra evaluations.',
    assumptions: [
      'f is continuous on [a, b] and f(a), f(b) have opposite signs.',
      'ε is the tolerance on the width of the final bracket, and b − a is the width of the starting one.',
      'Cost is measured in function evaluations; each is assumed to take the same time.',
      'Real numbers are assumed. In floating point the bracket cannot shrink below the spacing between adjacent representable numbers.',
    ],
  },

  tradeoffs: {
    excels: [
      'Problems where failure is unacceptable and a bracket is known.',
      'Functions that are continuous but rough, noisy in their higher digits, or without a usable derivative.',
      'Situations that need a guaranteed error bound or a known running time in advance.',
    ],
    struggles: [
      'Speed. It gains one binary digit per evaluation however smooth the function is, while Newton\'s method or the secant method need far fewer evaluations on smooth problems.',
      'Roots where the curve touches zero without changing sign. They cannot be bracketed.',
      'Systems of several equations in several unknowns. The idea of a sign change between two points has no direct counterpart there.',
    ],
    pitfalls: [
      'A bracket around a jump (a pole such as 1/x at 0) passes the sign test and yields a point that is not a root.',
      'A tolerance below floating-point resolution makes a naive loop run for ever.',
      'Testing the product f(a) × f(m) for a negative sign can fail by underflow when both values are tiny.',
    ],
    misunderstandings: [
      "\"A sign change means there is exactly one root in the bracket.\" It means there is an odd number of crossings, if the function is continuous. Bisection finds one and gives no warning about the rest.",
      "\"No sign change means no root.\" Two crossings between a and b leave the signs at the ends equal. So does a curve that only touches zero.",
      "\"When f(m) is tiny, the answer is accurate.\" On a flat curve the function can be nearly zero far from the root. The width of the bracket is the reliable measure of accuracy.",
      "\"A smoother function makes bisection faster.\" The number of steps depends only on the starting width and the tolerance.",
    ],
    constraints: [
      'A bracket has to come from somewhere: knowledge of the problem or a preliminary scan.',
      'Library solvers rarely use plain bisection alone. They use it as the fallback inside a hybrid method.',
    ],
    alternatives: [
      { id: 'newtons-method', name: 'Newton\'s Method', when: 'The derivative is available and a good starting guess is known. Much faster, but not guaranteed.' },
      { name: 'Secant method', when: 'No derivative is available but the function is smooth. Faster than bisection, with no guarantee of convergence.' },
      { name: 'False position (regula falsi)', when: 'You want to keep a bracket but use the function values to place the test point better than the midpoint.' },
      { name: 'Brent\'s method', when: 'General use. It keeps the bracket and the guarantee of bisection and takes faster interpolation steps when they behave.' },
    ],
    comparison: {
      columns: ['', 'Bisection', 'Newton\'s method', 'Secant method'],
      rows: [
        ['Needs', 'A bracket with a sign change', 'A starting guess and the derivative', 'Two starting guesses'],
        ['Evaluations per step', 'One of f', 'One of f and one of f′', 'One of f'],
        ['Speed near a simple root', 'Error bound halves each step', 'Correct digits roughly double each step', 'Correct digits grow by a factor of about 1.6 each step'],
        ['Guaranteed to converge', 'Yes, for continuous f', 'No', 'No'],
        ['Steps known in advance', 'Yes', 'No', 'No'],
      ],
    },
  },

  applications: [
    { title: 'The safeguard inside library root finders', status: 'established', text: 'Brent\'s method keeps a bracket at all times and takes a bisection step whenever its interpolation steps fail to shrink the bracket fast enough. It is the algorithm behind SciPy\'s `brentq` and, in Dekker\'s and Brent\'s formulation, MATLAB\'s `fzero`.' },
    { title: 'Eigenvalues of symmetric tridiagonal matrices', status: 'established', text: 'A Sturm sequence count tells how many eigenvalues lie below any given number. Bisecting on that number isolates any chosen eigenvalue to full precision. LAPACK provides this method for computing selected eigenvalues.' },
    { title: 'Inverting a function that only goes up', status: 'illustrative', text: 'If a quantity rises steadily with its input, the input that produces a target output can be found by bisection. Finding the value below which 95 percent of a distribution lies is one example.' },
    { title: 'Timing an event in a simulation', status: 'illustrative', text: 'A simulated ball is above the floor at one time step and below it at the next. Bisecting on the time between the two steps finds the moment of impact as exactly as needed.' },
    { title: 'Rates in finance', status: 'illustrative', text: 'The interest rate at which a stream of payments is worth a given price has no general formula. The price falls as the rate rises, so a low rate and a high rate bracket the answer.' },
  ],

  connections: [
    { to: 'binary-search', type: 'prerequisite', why: 'Both test the middle of a range and discard the half that cannot hold the answer. Binary search stops at a single item of a sorted list; bisection works on a continuous interval and stops at a tolerance.' },
    { to: 'newtons-method', type: 'same-problem', why: 'Both solve f(x) = 0. Newton\'s method uses the slope to jump toward the root and usually arrives in far fewer steps, but only bisection is guaranteed to arrive.' },
    { to: 'concept:invariant', type: 'prerequisite', why: 'The whole method is one loop invariant: the two ends of the bracket always have opposite signs.' },
    { to: 'concept:convergence', type: 'prerequisite', why: 'Bisection is the plainest example of linear convergence: the error bound shrinks by the same factor, one half, at every step.' },
    { to: 'concept:floating-point', type: 'advanced', why: 'Halving cannot continue past the spacing between adjacent machine numbers, which sets a floor on the tolerance that can be met.' },
    { to: 'concept:divide-and-conquer', type: 'related', why: 'Each step splits the problem in two and keeps one part. Only one side is ever pursued, which is why the cost is logarithmic.' },
    { to: 'euler-method', type: 'related', why: 'A time-stepping simulation brackets an event between two consecutive steps when a quantity changes sign. Bisection on the time locates the event.' },
    { to: 'discipline:finance', type: 'application', why: 'Yields and rates of return are defined as the root of a pricing equation, and a bracketing method solves it without risk of divergence.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'What must be true before bisection can start?',
      options: ['The derivative of the function is known', 'The function is continuous and has opposite signs at the two ends of the interval', 'The starting guess is close to the root', 'The function is a polynomial'],
      answer: 1,
      explain: [
        'Bisection never uses a derivative. That is Newton\'s method.',
        'Correct. Opposite signs plus continuity force the curve to cross zero in between, and that is all the method relies on.',
        'There is no single starting guess. Any bracket works, however wide; a wider one only costs a few more steps.',
        'Any continuous function will do.',
      ],
    },
    {
      type: 'predict',
      q: 'The bracket is [1, 2] and the tolerance is 0.001. How many halvings will bisection make before it stops?',
      options: ['3', '10', '500', '1,000'],
      answer: 1,
      explain: [
        'Three halvings only reach a width of 1/8 = 0.125.',
        'Correct. The width must fall from 1 to 0.001 or less. Nine halvings give 1/512, still too wide; ten give 1/1,024, which is below 0.001.',
        'The width is halved each step, not reduced by a fixed amount, so far fewer steps are needed.',
        'A thousand steps would be needed only if each step removed a fixed 0.001 of the bracket.',
      ],
      tryInput: { fn: 'sqrt2', tolerance: 0.001 },
    },
    {
      type: 'debug',
      q: 'This version returns a value that is not a root. Which line is wrong?',
      code: `def bisection(f, a, b, tol):
    fa = f(a)
    while b - a > tol:
        m = a + (b - a) / 2
        fm = f(m)
        if (fm > 0) == (fa > 0):
            b = m
        else:
            a, fa = m, fm
    return a + (b - a) / 2`,
      options: ['Line 3: the loop should test b − a < tol', 'Line 4: the midpoint formula is wrong', 'Lines 7 and 9: the two updates are swapped', 'Line 10: it should return a'],
      answer: 2,
      explain: [
        'The loop must continue while the bracket is still too wide, which is what `b - a > tol` says.',
        'a + (b − a) / 2 is the midpoint.',
        'Correct. When f(m) has the same sign as f(a), the crossing is between m and b, so it is `a` that must move to m. As written, the method keeps the half without a sign change.',
        'Returning the midpoint is right: it halves the worst-case error compared with returning an end.',
      ],
    },
    {
      type: 'choice',
      q: 'Bisection has found a root to 3 decimal digits. Roughly how many more steps does it need to reach 6 digits?',
      options: ['The same number again times a thousand', 'About 10 more', 'About 3 more', 'Twice as many as it has used so far, whatever that was'],
      answer: 1,
      explain: [
        'The cost grows with the logarithm of the accuracy, not in proportion to it.',
        'Correct. Three more decimal digits is a factor of 1,000 in accuracy, and 2 to the power 10 is 1,024, so about ten more halvings.',
        'Each step gains one binary digit, not one decimal digit. A decimal digit costs about 3.32 steps.',
        'The extra steps depend only on the extra accuracy, not on how many steps came before.',
      ],
    },
    {
      type: 'challenge',
      title: 'Keep the bracket, use the values',
      prompt: 'Bisection ignores the sizes of f(a) and f(b). Write a variant that tests the point where the straight line from (a, f(a)) to (b, f(b)) crosses zero instead of the midpoint, keeping the same rule for which end to replace. This is the method of false position. Run both on x² − 2 from [1, 2] and count evaluations to reach a bracket width of 10⁻⁶. Explain what you observe about which end of the bracket moves, and why the width is a poor stopping test for this variant.',
      hints: ['The line through the two ends crosses zero at x = a − f(a)(b − a) / (f(b) − f(a)).', 'On a curve that bends one way, one end of the bracket may never move. Watch the step size instead of the width.'],
    },
  ],

  compare: {
    idea: 'Halve a bracket that contains a sign change, always keeping the half that still contains it.',
    requires: 'A continuous function and two points where it has opposite signs. No derivative.',
    sensitivity: 'None to the shape of the function. The step count depends only on the starting width and the tolerance.',
    memory: 'O(1): the two ends of the bracket.',
    difficulty: 'low',
    difficultyNote: 'A short loop. The care goes into comparing signs correctly and stopping at a sensible tolerance.',
    limits: 'Slow: one binary digit per function evaluation. Needs a bracket. One unknown only.',
    useWhen: 'You can bracket the root and want a guaranteed answer with a known cost.',
  },

  advanced: {
    history: 'The method rests on the intermediate value theorem. Bernard Bolzano gave a purely analytic proof of that theorem in 1817, and repeated halving of an interval is one of the standard ways to prove it, so the algorithm and the proof share one idea. In 1969 T. J. Dekker described a root finder that combines bisection with faster secant steps, and in 1973 Richard Brent published the refinement that numerical libraries still use.',
    derivation: 'Let the starting bracket be $[a_0, b_0]$. Each step halves the width, so after $k$ steps\n\n$$b_k - a_k = \\frac{b_0 - a_0}{2^k}.$$\n\nThe loop stops at the first $k$ with $b_k - a_k \\le \\varepsilon$, that is\n\n$$k = \\left\\lceil \\log_2 \\frac{b_0 - a_0}{\\varepsilon} \\right\\rceil.$$\n\nThe root $r$ lies in $[a_k, b_k]$, so the midpoint $m_k$ satisfies $|m_k - r| \\le \\frac{b_0 - a_0}{2^{k+1}}$. Each step therefore adds one binary digit to what is known about $r$, and one decimal digit costs $\\log_2 10 \\approx 3.32$ steps.',
    proof: 'The intervals $[a_k, b_k]$ are nested and their widths tend to zero, so the sequences $a_k$ and $b_k$ converge to a common limit $r$. The invariant gives $f(a_k)\\,f(b_k) \\le 0$ for every $k$. Because $f$ is continuous, taking the limit gives $f(r)^2 \\le 0$, which forces $f(r) = 0$. This argument is also a proof of the intermediate value theorem itself.',
    complexityProof: 'In double precision the numbers between 1 and 2 are spaced $2^{-52}$ apart. A bracket that starts as $[1, 2]$ can therefore be halved at most 52 times before its ends are adjacent machine numbers and no midpoint exists between them. In general the number of useful steps is bounded by the number of representable values between $a$ and $b$, and a robust implementation stops when the computed midpoint equals one of the ends.',
    variants: [
      { name: 'False position (regula falsi)', text: 'Tests the point where the chord between the two ends crosses zero. Keeps the bracket, but one end can stall on curves that bend one way, so plain false position can be slower than bisection.' },
      { name: 'Illinois method', text: 'A correction to false position that halves the stored function value at an end that has stalled, restoring fast convergence.' },
      { name: 'Dekker\'s and Brent\'s methods', text: 'Keep a bracket and choose each step between secant or inverse quadratic interpolation and bisection, guaranteeing convergence while usually converging much faster.' },
      { name: 'Bisection on a counting function', text: 'For symmetric tridiagonal matrices, the number of eigenvalues below x plays the role of the sign. Bisecting on x locates each eigenvalue.' },
    ],
    implementation: 'Evaluate f once per step and carry the function value of the end you keep. Compare signs rather than multiplying values. Compute the midpoint as a + (b − a) / 2. Stop when the midpoint equals an end, whatever the tolerance says. If the bracket came from a scan, check that the result has a small function value, to rule out a jump.',
    benchmarking: 'Count function evaluations, not time, and state the starting bracket and the stopping rule. Bisection\'s count is the same for every function, which makes it the natural baseline against which faster root finders are judged.',
    references: [
      { authors: 'R. L. Burden and J. D. Faires', year: 2011, title: 'Numerical Analysis (9th edition)', venue: 'Brooks/Cole, Cengage Learning' },
      { authors: 'W. H. Press, S. A. Teukolsky, W. T. Vetterling and B. P. Flannery', year: 2007, title: 'Numerical Recipes: The Art of Scientific Computing (3rd edition)', venue: 'Cambridge University Press' },
      { authors: 'R. P. Brent', year: 1973, title: 'Algorithms for Minimization without Derivatives', venue: 'Prentice-Hall' },
    ],
    furtherReading: [
      'Burden and Faires, *Numerical Analysis*, section 2.1, "The Bisection Method".',
      'Press et al., *Numerical Recipes*, chapter 9, "Root Finding and Nonlinear Sets of Equations".',
    ],
  },

  tests: [
    { name: 'steps equal ceil(log2(width / tolerance)) and the root is within half the tolerance', input: { fn: 'sqrt2', tolerance: 1e-6 },
      check: (r, c) => (r.iterations === 20 && c['function evaluations'] === 22 && Math.abs(r.root - Math.SQRT2) <= 5e-7) || `got ${r.iterations} steps, ${c['function evaluations']} evaluations, root ${r.root}` },
    { name: 'the step formula and the error bound hold for every catalogue function at several tolerances', input: { fn: 'cosx', tolerance: 1e-3 },
      check: () => {
        for (const F of FUNCTIONS) {
          for (const tol of [0.3, 1e-2, 1e-5, 1e-9, 1e-12]) {
            const r = run({ fn: F.id, tolerance: tol }, quiet);
            const want = predicted(F.b - F.a, tol);
            if (r.iterations !== want) return `${F.id} at ${tol}: ${r.iterations} steps, formula says ${want}`;
            if (Math.abs(r.root - F.root) > tol / 2 + 1e-15) return `${F.id} at ${tol}: root ${r.root} is farther than tol/2 from ${F.root}`;
            if (!(r.a <= F.root && F.root <= r.b)) return `${F.id} at ${tol}: the final bracket lost the root`;
            if (r.width > tol) return `${F.id} at ${tol}: final width ${r.width} exceeds the tolerance`;
          }
        }
        return true;
      } },
    { name: 'the worked example: four steps end at [1.375, 1.4375] with midpoint 1.40625', input: { fn: 'sqrt2', tolerance: 0.0625 },
      check: (r) => (r.iterations === 4 && r.a === 1.375 && r.b === 1.4375 && r.root === 1.40625) || `got [${r.a}, ${r.b}] after ${r.iterations} steps` },
    { name: 'the quiz prediction: tolerance 0.001 on [1, 2] takes 10 halvings', input: { fn: 'sqrt2', tolerance: 0.001 },
      check: (r) => r.iterations === 10 || `got ${r.iterations}` },
    { name: 'a midpoint that is an exact root returns at once', input: { fn: 'triple', tolerance: 1e-9, a: 1, b: 3 },
      check: (r) => (r.exact && r.root === 2 && r.iterations === 1) || `got root ${r.root} after ${r.iterations} steps` },
    { name: 'refuses a bracket without a sign change', input: { fn: 'sqrt2', tolerance: 1e-6 },
      check: () => {
        try { run({ fn: 'sqrt2', tolerance: 1e-6, a: 2, b: 3 }, quiet); } catch (e) { return /opposite signs/.test(e.message) || `unexpected message: ${e.message}`; }
        return 'expected an error for a bracket with equal signs';
      } },
    { name: 'a tolerance below floating-point spacing stops instead of looping', input: { fn: 'sqrt2', tolerance: 1e-6 },
      check: () => {
        const r = run({ fn: 'sqrt2', tolerance: 1e-300 }, quiet);
        return (r.atLimit && r.iterations === 52 && Math.abs(r.root - Math.SQRT2) < 1e-15) || `got ${r.iterations} steps, root ${r.root}`;
      } },
  ],
};
