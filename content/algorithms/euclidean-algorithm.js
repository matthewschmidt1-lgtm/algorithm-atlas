import { makeRng } from '../../js/lib/rng.js';

const SERIES = ['forest', 'terracotta', 'ochre', 'moss', 'ink', 'brick', 'sage'];
const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
const term = (coef, name) => `${coef < 0 ? '− ' : '+ '}${Math.abs(coef)} × ${name}`;
// "6 = 2 × 78 − 5 × 30"
const combination = (r, x, a0, y, b0) => `${r} = ${x} × ${a0} ${term(y, b0)}`;

// Count-only runs used by the experiment: no picture, just division steps.
function countDivisions(a, b) {
  let steps = 0;
  while (b !== 0) { const r = a % b; a = b; b = r; steps += 1; }
  return steps;
}
function experimentRun(input, t) {
  const digits = Math.max(1, Math.min(15, Math.floor(input.digits)));
  const limit = 10 ** digits;
  let a, b, steps;
  if (input.mode === 'fibonacci') {
    // b is the largest Fibonacci number with this many digits, a the next one.
    let f0 = 1, f1 = 1;
    while (f1 < limit) { const f2 = f0 + f1; f0 = f1; f1 = f2; }
    a = f1; b = f0;
    steps = countDivisions(a, b);
    t.count('divisions', steps);
  } else {
    const rng = makeRng((input.seed || 1) * 97 + digits);
    const pairs = Math.max(1, Math.floor(input.pairs || 200));
    const lo = limit / 10, span = limit - lo;
    const draw = () => lo + ((Math.floor(rng.next() * 1e7) * 1e8 + Math.floor(rng.next() * 1e8)) % span);
    let total = 0;
    for (let k = 0; k < pairs; k++) { a = draw(); b = draw(); total += countDivisions(a, b); }
    steps = total / pairs;
    t.count('divisions', steps);
  }
  t.frame(() => ({ line: 1, note: `Count-only run for numbers with ${plural(digits, 'digit')}: ${steps} division steps.`, views: [{ kind: 'table', colLabels: ['digits', 'division steps'], cells: [[digits, steps]] }] }));
  return { gcd: null, a, b, steps: [], divisions: steps, x: 0, y: 0 };
}

function run(input, t) {
  if (input.digits) return experimentRun(input, t);
  const a0 = Math.floor(Number(input.a)), b0 = Math.floor(Number(input.b));
  if (!(a0 >= 1) || !(b0 >= 1)) throw new Error('Both numbers must be whole numbers of at least 1.');
  if (a0 > 1e9 || b0 > 1e9) throw new Error('Please keep both numbers at or below 1,000,000,000.');
  const extended = !!input.extended;
  const W = Math.max(a0, b0), H = Math.min(a0, b0);
  const steps = [];        // { a, b, q, r, x, y } where r = x·a0 + y·b0
  const squares = [];      // { x, y, side, step }
  const blocks = [];       // { x, y, w, h, side, count, step } for quotients too large to draw square by square
  // The part of the rectangle not yet cut into squares.
  let region = { x: 0, y: 0, w: W, h: H };

  const views = ({ current = -1, done = false } = {}) => {
    const layers = [];
    for (const b of blocks) layers.push({ type: 'rect', x: b.x, y: b.y, w: b.w, h: b.h, role: SERIES[b.step % SERIES.length], fillAlpha: 0.5, stroke: true, width: 1 });
    for (const s of squares) layers.push({ type: 'rect', x: s.x, y: s.y, w: s.side, h: s.side, role: SERIES[s.step % SERIES.length], fillAlpha: 0.5, stroke: true, width: 1 });
    layers.push({ type: 'rect', x: 0, y: 0, w: W, h: H, role: 'muted', fill: false, stroke: true, width: 1.5 });
    if (!done && region.w > 0 && region.h > 0) layers.push({ type: 'rect', x: region.x, y: region.y, w: region.w, h: region.h, role: 'current', fill: false, stroke: true, width: 2.5, dash: [6, 4] });
    for (const s of squares) if (s.side >= W * 0.055) layers.push({ type: 'text', at: [s.x + s.side / 2, s.y + s.side / 2], text: String(s.side), role: 'text', align: 'center', dy: 4 });
    for (const b of blocks) if (b.h >= W * 0.03 || b.w >= W * 0.3) layers.push({ type: 'text', at: [b.x + b.w / 2, b.y + b.h / 2], text: `${b.count} squares of side ${b.side}`, role: 'text', align: 'center', dy: 4 });
    const scene = {
      kind: 'scene', title: `A ${W} by ${H} rectangle, cut into the largest squares that fit`, x: [0, W], y: [0, H], equal: true, axes: false,
      aspect: Math.min(0.62, Math.max(0.4, H / W)), layers,
      legend: [{ label: 'each colour is one division step; numbers are side lengths', role: 'forest' }, { label: 'part still to be cut', role: 'current' }],
    };
    const colLabels = ['a', 'b', 'quotient q', 'remainder r', 'a = q × b + r'];
    if (extended) colLabels.push(`r as a mix of ${a0} and ${b0}`);
    const roles = {};
    if (current >= 0) roles[`${current},3`] = 'current';
    if (done && steps.length) roles[`${steps.length - 1},1`] = 'done';
    const table = {
      kind: 'table', title: 'One row per division', corner: 'step', colLabels,
      rowLabels: steps.map((_, i) => i + 1),
      cells: steps.map((s) => {
        const row = [s.a, s.b, s.q, s.r, `${s.a} = ${s.q} × ${s.b} + ${s.r}`];
        if (extended) row.push(combination(s.r, s.x, a0, s.y, b0));
        return row;
      }),
      roles,
    };
    return steps.length ? [scene, table] : [scene];
  };

  t.frame(() => ({ line: 0, note: `Find the greatest common divisor of **${a0}** and **${b0}**: the largest whole number that divides both exactly. Picture a ${W} by ${H} rectangle. The answer is the side of the largest square tile that can cover it exactly.`, views: views(), vars: { a: a0, b: b0 } }));

  let a = a0, b = b0;
  let x0 = 1, y0 = 0, x1 = 0, y1 = 1; // a = x0·a0 + y0·b0 and b = x1·a0 + y1·b0 throughout
  let horizontal = true;               // squares are laid along the width first, then down the leftover strip, and so on
  let index = 0;
  if (a0 < b0) {
    // a < b: zero copies of b fit, so the first division only swaps the two numbers. Nothing is cut.
    t.count('divisions');
    steps.push({ a, b, q: 0, r: a, x: x0, y: y0 });
    t.frame(() => ({ line: [1, 2, 3, 4], note: `${a0} is smaller than ${b0}, so ${b0} fits into it 0 times and the remainder is ${a0} itself. This first step just swaps the two numbers, and the real work starts with ${b0} and ${a0}.`, views: views({ current: 0 }), vars: { a: a0, b: b0, q: 0, r: a0 } }));
    [a, b] = [b, a];
    [x0, y0, x1, y1] = [x1, y1, x0, y0];
    index = 1;
  }

  while (b !== 0) {
    const q = Math.floor(a / b);
    const r = a - q * b;
    t.count('divisions');
    const step = index;
    const ca = a, cb = b;
    t.frame(() => ({ line: [1, 2], note: `The part still to be cut is ${ca} by ${cb}. How many squares of side ${cb} fit along the ${ca} side? ${cb} goes into ${ca} **${q}** ${q === 1 ? 'time' : 'times'}.`, views: views(), vars: { a: ca, b: cb, q } }));
    // Lay the q squares, one frame each while that stays readable.
    const side = cb;
    if (q <= 12) {
      for (let k = 0; k < q; k++) {
        squares.push({ x: region.x, y: region.y, side, step });
        if (horizontal) region = { x: region.x + side, y: region.y, w: region.w - side, h: region.h };
        else region = { x: region.x, y: region.y + side, w: region.w, h: region.h - side };
        if (q > 1 && k < q - 1) {
          const placed = k + 1;
          t.frame(() => ({ line: 2, note: `Cut off a ${side} by ${side} square. That is ${placed} so far, and another one still fits.`, views: views(), vars: { a: ca, b: cb, 'squares cut': placed } }));
        }
      }
    } else {
      if (q <= 60) for (let k = 0; k < q; k++) squares.push(horizontal ? { x: region.x + k * side, y: region.y, side, step } : { x: region.x, y: region.y + k * side, side, step });
      else blocks.push(horizontal ? { x: region.x, y: region.y, w: q * side, h: side, side, count: q, step } : { x: region.x, y: region.y, w: side, h: q * side, side, count: q, step });
      if (horizontal) region = { x: region.x + q * side, y: region.y, w: region.w - q * side, h: region.h };
      else region = { x: region.x, y: region.y + q * side, w: region.w, h: region.h - q * side };
    }
    horizontal = !horizontal;
    const nx = x0 - q * x1, ny = y0 - q * y1;
    steps.push({ a: ca, b: cb, q, r, x: nx, y: ny });
    t.frame(() => ({ line: extended ? [3, 4, 13, 14] : [3, 4],
      note: r === 0
        ? `${plural(q, 'square')} of side ${cb} ${q === 1 ? 'fits' : 'fit'} exactly, with nothing left over: ${ca} = ${q} × ${cb} + 0. The remainder is 0, so the algorithm stops.`
        : `${plural(q, 'square')} of side ${cb} ${q === 1 ? 'fits' : 'fit'}, leaving a strip ${r} wide: ${ca} = ${q} × ${cb} + ${r}. Any tile that covers both ${ca} and ${cb} must also cover that strip, so the problem is now the smaller rectangle, ${cb} by ${r}.${extended ? ` In terms of the original numbers, ${combination(r, nx, a0, ny, b0)}.` : ''}`,
      views: views({ current: steps.length - 1 }), vars: { a: ca, b: cb, q, r } }));
    a = cb; b = r;
    [x0, y0, x1, y1] = [x1, y1, nx, ny];
    index += 1;
  }

  const g = a;
  const total = steps.length;
  t.frame(() => ({ line: extended ? [5, 15] : 5,
    note: `The last remainder that was not zero is **${g}**, so gcd(${a0}, ${b0}) = ${g}. Square tiles of side ${g} cover the whole ${W} by ${H} rectangle exactly. No larger square can, because anything that divides both ${a0} and ${b0} must also divide every remainder along the way, and so must divide ${g}. It took ${plural(total, 'division')}.${extended ? ` The extended algorithm also gives ${combination(g, x0, a0, y0, b0)}.` : ''}${g === 1 ? ` A gcd of 1 means ${a0} and ${b0} share no factor: they are **coprime**.` : ''}`,
    views: views({ done: true }), vars: extended ? { gcd: g, x: x0, y: y0 } : { gcd: g } }));

  return { gcd: g, a: a0, b: b0, steps, divisions: total, x: x0, y: y0 };
}

// Independent reference for the tests: try every candidate divisor.
const bruteGcd = (a, b) => { let g = 1; for (let d = 1; d <= Math.min(a, b); d++) if (a % d === 0 && b % d === 0) g = d; return g; };
const checkAll = (r) => {
  if (r.gcd !== bruteGcd(r.a, r.b)) return `gcd(${r.a}, ${r.b}) reported as ${r.gcd}, brute force says ${bruteGcd(r.a, r.b)}`;
  if (r.a * r.x + r.b * r.y !== r.gcd) return `Bezout check failed: ${r.a} × ${r.x} + ${r.b} × ${r.y} is not ${r.gcd}`;
  for (const s of r.steps) {
    if (s.a !== s.q * s.b + s.r || s.r < 0 || s.r >= s.b) return `bad division row ${s.a} = ${s.q} × ${s.b} + ${s.r}`;
    if (r.a * s.x + r.b * s.y !== s.r) return `remainder ${s.r} is not ${s.x} × ${r.a} + ${s.y} × ${r.b}`;
  }
  const digits = String(Math.min(r.a, r.b)).length;
  const real = r.steps.filter((s) => s.q > 0).length;
  return real <= 5 * digits || `${real} divisions exceeds the Lame bound of ${5 * digits}`;
};

export default {
  meta: {
    id: 'euclidean-algorithm',
    name: 'Euclidean Algorithm',
    aliases: ['Euclid\'s algorithm', 'greatest common divisor', 'gcd', 'highest common factor', 'HCF', 'extended Euclidean algorithm', 'Bezout coefficients'],
    kind: 'algorithm',
    discipline: 'mathematics',
    alsoIn: [
      { id: 'cryptography', why: 'Its extended form computes modular inverses, which is how an RSA private key is derived from the public one.' },
    ],
    subfield: 'Number theory',
    family: 'Greatest common divisor',
    lab: 'mathematics',
    authors: 'Euclid',
    summary: 'Finds the greatest common divisor of two whole numbers by repeatedly replacing the larger with its remainder on division by the smaller, until the remainder is zero.',
    difficulty: 'beginner',
    order: 400,
    paradigms: ['number-theoretic'],
    randomized: false,
    approximate: false,
    time: { best: 'O(1)', average: 'O(log min(a, b)) divisions', worst: 'O(log min(a, b)) divisions', class: 'logarithmic' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['greatest common divisor', 'highest common factor', 'simplify a fraction', 'reduce a ratio to lowest terms', 'largest square tile that fits a rectangle', 'find a modular inverse'],
      techniques: ['division with remainder', 'repeated reduction', 'Bezout coefficients'],
      applications: ['security', 'scientific computing', 'standard libraries', 'computer graphics'],
    },
    prerequisites: ['concept:modular-arithmetic'],
  },

  bigIdea: {
    simple: "The Euclidean algorithm finds the largest number that divides two whole numbers exactly. That number is called their greatest common divisor. Here is a way to picture it. A floor is 48 units long and 18 units wide. You want to cover it with identical square tiles, as large as possible, without cutting any. What size should the tiles be? Start by laying the biggest squares the floor allows, 18 by 18. Two of them fit, and a strip 12 wide is left over. Now treat the strip the same way. One 12 by 12 square fits, and a smaller strip 6 wide is left. Squares of side 6 fill that last strip exactly, with nothing left. So 6 is the answer: tiles of 6 by 6 cover the whole floor. The method is more than two thousand years old. It is still in daily use, for example when computers create the keys that keep messages private.",
    what: 'The greatest common divisor (gcd) of two whole numbers is the largest whole number that divides both without a remainder. The Euclidean algorithm computes it by division with remainder: divide the larger number by the smaller, keep the smaller number and the remainder, and repeat with that pair. When a remainder of zero appears, the last divisor is the gcd.',
    why: 'The obvious way to find a common divisor is to factor both numbers into primes, but factoring large numbers is extremely slow. Euclid\'s method never factors anything. It shrinks the numbers so quickly that the gcd of two numbers hundreds of digits long takes a few hundred divisions, which is what makes it usable in cryptography.',
    when: 'Use it whenever you need the gcd of two integers: to reduce a fraction, to test whether two numbers share a factor, or to compute a least common multiple. Use the extended version when you also need the whole numbers x and y with a·x + b·y = gcd(a, b), which is how modular inverses are found for systems such as [RSA](#/algorithm/rsa).',
    interesting: 'It is one of the oldest algorithms still in everyday use, written down by Euclid around 300 BC. Its slowest inputs are consecutive Fibonacci numbers, where every division has quotient 1. Gabriel Lamé proved this in 1844, in what is often described as the first analysis of how long an algorithm takes.',
    where: 'Every language\'s standard library has it: `math.gcd` in Python, `std::gcd` in C++. Fraction arithmetic uses it to keep results in lowest terms, and cryptographic libraries use the extended form to invert numbers in modular arithmetic.',
    analogy: {
      title: 'Measuring two sticks against each other',
      text: 'You have a long stick and a short stick and want the longest ruler that measures both exactly. Lay the short stick along the long one as many times as it fits and mark what is left over. Any ruler that measures both sticks must measure that leftover piece too. So forget the long stick: the problem is now the short stick and the leftover. Repeat with those two. When a piece fits with nothing left over, that piece is the ruler.',
      limits: 'With real sticks the process might never end. The side and the diagonal of a square have no common measure at all, and the leftovers get smaller forever. The algorithm is about whole numbers, where each leftover is a smaller whole number and so the process must stop. The picture also suggests laying the stick down one length at a time, which is repeated subtraction. The algorithm does all of those subtractions at once with a single division.',
    },
  },

  example: {
    setup: 'Find the greatest common divisor of 48 and 18: the largest whole number that divides both. Dividing one number by another gives a quotient (how many times it fits) and a remainder (what is left over).',
    steps: [
      'Divide 48 by 18. It fits 2 times, since 2 × 18 = 36, and the remainder is 48 − 36 = 12. Keep 18 and 12.',
      'Divide 18 by 12. It fits 1 time, and the remainder is 18 − 12 = 6. Keep 12 and 6.',
      'Divide 12 by 6. It fits 2 times exactly, and the remainder is 0. Stop.',
    ],
    result: 'The last number you divided by, 6, is the greatest common divisor. Check: 48 = 8 × 6 and 18 = 3 × 6, and 8 and 3 share no factor, so nothing larger than 6 divides both. It took 3 divisions. Notice how fast the numbers shrank: 48 and 18, then 18 and 12, then 12 and 6.',
    tryInput: { a: 48, b: 18, extended: false },
  },

  terms: [
    { term: 'Divisor', meaning: 'A whole number that divides another with nothing left over. 6 is a divisor of 48 because 48 = 8 × 6.' },
    { term: 'Greatest common divisor (gcd)', meaning: 'The largest whole number that is a divisor of both of two given numbers.' },
    { term: 'Quotient', meaning: 'How many whole times one number fits into another. 18 fits into 48 two times, so the quotient is 2.' },
    { term: 'Remainder', meaning: 'What is left over after a division. 48 divided by 18 leaves a remainder of 12.' },
    { term: 'Coprime', meaning: 'Two numbers whose greatest common divisor is 1. They share no factor other than 1.' },
    { term: 'Modular inverse', meaning: 'For a number a and a modulus m, the number that multiplies a to give a remainder of 1 on division by m. It exists only when a and m are coprime.' },
  ],

  takeaway: 'Divide the larger number by the smaller, keep the smaller number and the remainder, and repeat until the remainder is zero.',

  viz: {
    describe: 'A rectangle whose sides are the two numbers, cut step by step into the largest squares that fit. Each division step has its own colour and each square shows its side length. A dashed terracotta outline marks the part still to be cut. Below, a table lists each division: the two numbers, the quotient, the remainder and the equation that links them. The side of the smallest square is the greatest common divisor.',
    inputs: [
      { id: 'a', type: 'number', label: 'First number (a)', default: 120, min: 1, max: 1000000000 },
      { id: 'b', type: 'number', label: 'Second number (b)', default: 44, min: 1, max: 1000000000 },
      { id: 'extended', type: 'toggle', label: 'Show the extended algorithm', default: false,
        help: 'Adds a column that writes each remainder as a whole-number mix of the two original numbers.' },
    ],
    presets: [
      { label: 'Worked example: 48 and 18', values: { a: 48, b: 18, extended: false } },
      { label: 'Textbook case: 1071 and 462', values: { a: 1071, b: 462, extended: false } },
      { label: 'Worst case: Fibonacci numbers 144 and 89', values: { a: 144, b: 89, extended: false } },
      { label: 'No common factor: 35 and 18', values: { a: 35, b: 18, extended: false } },
      { label: 'One divides the other: 60 and 12', values: { a: 60, b: 12, extended: false } },
      { label: 'Modular inverse: 40 and 7, extended', values: { a: 40, b: 7, extended: true } },
    ],
    tryThis: [
      'Load "Worst case: Fibonacci numbers 144 and 89". Every division has quotient 1, so each step removes a single square and the numbers shrink as slowly as they possibly can: 10 divisions. Then change 89 to 90: only 4 divisions are needed.',
      'Enter a = 1920 and b = 1080, the size of a common screen in pixels. The gcd is 120, and dividing both numbers by it gives the aspect ratio 16 to 9.',
      'Load "Modular inverse: 40 and 7, extended". The last column ends with 1 = 3 × 40 − 17 × 7. Read it as a remainder on division by 40: −17 × 7 leaves remainder 1, and −17 is the same as 23, so 23 is the inverse of 7.',
      'Swap the two numbers so the smaller comes first. The first division has quotient 0 and simply swaps them back. The algorithm needs no special case for the order.',
    ],
    run,
    report: (r, c) => (r.gcd === null ? `${c.divisions} division steps.` : `gcd(${r.a}, ${r.b}) = ${r.gcd}, found with ${r.divisions} ${r.divisions === 1 ? 'division' : 'divisions'}.\n${r.steps.map((s) => `${s.a} = ${s.q} × ${s.b} + ${s.r}`).join('\n')}\nExtended result: ${combination(r.gcd, r.x, r.a, r.y, r.b)}`),
    experiment: {
      title: 'Divisions as the numbers get longer',
      note: 'Each point is a real run. The worst-case series uses, for each length, the largest Fibonacci number with that many digits and the Fibonacci number after it. The other series is the average over 200 random pairs of numbers with that many digits. The straight line 5 × digits is Lamé\'s upper limit; the second line is the leading term of the known average.',
      metric: 'divisions',
      metricLabel: 'Division steps',
      sizeLabel: 'Decimal digits in the smaller number',
      sizes: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15],
      variants: [
        { id: 'fibonacci', label: 'Consecutive Fibonacci numbers (worst case)' },
        { id: 'random', label: 'Random pairs (average of 200)' },
      ],
      input: (digits, variant, seed) => ({ digits, mode: variant, seed, pairs: 200 }),
      theory: [
        { label: '5 × digits (Lamé\'s limit)', fn: (d) => 5 * d, variant: 'fibonacci' },
        { label: '1.94 × digits (average, leading term)', fn: (d) => ((12 * Math.LN2 * Math.LN10) / (Math.PI * Math.PI)) * d, variant: 'random' },
      ],
    },
  },

  logic: {
    intuition: 'If a number divides both a and b, it also divides a − b, and a − 2b, and whatever is left after taking b away from a as many times as possible. That leftover is the remainder. So the pair (a, b) and the pair (b, remainder) have exactly the same common divisors, and the second pair is smaller. Keep trading the pair for a smaller one until the remainder is 0. A pair of the form (g, 0) has an obvious greatest common divisor: g.',
    steps: [
      'Start with two positive whole numbers `a` and `b`.',
      'If `b` is 0, stop. The answer is `a`.',
      'Divide `a` by `b` to get a quotient `q` and a remainder `r`, so that `a = q × b + r` with `r` smaller than `b`.',
      'Replace `a` by `b` and `b` by `r`. Go back to step 2.',
      'Extended version: alongside each number keep two coefficients that express it as a mix of the original inputs. Each time a remainder is formed as `a − q × b`, form its coefficients the same way from the coefficients of `a` and `b`.',
      'When the loop ends, the coefficients of the final `a` are whole numbers `x` and `y` with `a₀ × x + b₀ × y = gcd`.',
    ],
    pseudocode: [
      'gcd(a, b):',
      '  while b ≠ 0:',
      '    q ← ⌊a / b⌋',
      '    r ← a − q × b',
      '    a ← b;  b ← r',
      '  return a',
      '',
      'extended_gcd(a, b):',
      '  (x, x′) ← (1, 0)',
      '  (y, y′) ← (0, 1)',
      '  while b ≠ 0:',
      '    q ← ⌊a / b⌋',
      '    (a, b) ← (b, a − q × b)',
      '    (x, x′) ← (x′, x − q × x′)',
      '    (y, y′) ← (y′, y − q × y′)',
      '  return (a, x, y)',
    ],
    decisions: [
      { title: 'Division or subtraction?', text: 'Euclid\'s own description subtracts the smaller number from the larger until it no longer fits. Division does the same thing in one step. The difference matters: gcd(1,000,000, 1) takes one division but 999,999 subtractions.' },
      { title: 'Which number goes first?', text: 'It does not matter. If `a` is smaller than `b`, the first division has quotient 0 and remainder `a`, which swaps the two. No comparison is needed.' },
      { title: 'Plain or extended?', text: 'The plain algorithm returns only the gcd. The extended one costs a few more multiplications per step and also returns the coefficients `x` and `y`. You need them to find modular inverses and to solve equations of the form `a × x + b × y = c` in whole numbers.' },
      { title: 'Loop or recursion?', text: 'The definition `gcd(a, b) = gcd(b, a mod b)` reads naturally as recursion. A loop does the same work without using the call stack. The depth is small either way, since the number of steps is logarithmic.' },
    ],
    invariants: [
      'The set of common divisors of the current pair (a, b) is the same as for the original pair, so gcd(a, b) never changes.',
      'In the extended version, the current `a` equals `x × a₀ + y × b₀` and the current `b` equals `x′ × a₀ + y′ × b₀`, where a₀ and b₀ are the original inputs.',
      'After the first step, `b` is strictly smaller than `a`, and each new remainder is strictly smaller than the one before.',
    ],
    edgeCases: [
      'One number is 0: gcd(a, 0) = a, because every number divides 0. The loop body never runs.',
      'Both numbers are 0: every number divides both, so there is no greatest common divisor. By convention gcd(0, 0) is taken to be 0.',
      'Equal numbers: one division with remainder 0, and the gcd is the number itself.',
      'One number divides the other: a single division.',
      'Negative numbers: the gcd is defined as positive, so take absolute values first. Languages disagree about the sign of a remainder when an operand is negative.',
      'In the extended version, intermediate coefficients alternate in sign and can be negative. A modular inverse must be brought into the range 0 to m − 1 at the end.',
    ],
    correctness: 'Write `a = q × b + r`. If `d` divides both `a` and `b`, then it divides `a − q × b = r`, so it divides both `b` and `r`. Conversely, if `d` divides both `b` and `r`, it divides `q × b + r = a`. The pairs (a, b) and (b, r) therefore have exactly the same common divisors, and in particular the same greatest one. The algorithm replaces the pair again and again without changing its gcd. It must stop, because the second number is a non-negative whole number that gets strictly smaller at every step. When it stops, the pair is (g, 0), whose greatest common divisor is g. For the extended version, the same substitution `r = a − q × b` applied to the coefficients keeps each number expressed as a whole-number combination of the original inputs, so the final g is too.',
    mistakes: [
      'Updating in the wrong order: writing `a = b` and then `b = a % b` computes `b % b`, which is 0. Use a temporary variable or a simultaneous assignment.',
      'Returning `b` after the loop. When the loop ends `b` is 0; the answer is in `a`.',
      'Using repeated subtraction on numbers of very different size, which can take millions of steps where division takes one.',
      'Forgetting that the extended coefficients can be negative, and using a negative value directly as a modular inverse.',
      'Asking for the inverse of a number that is not coprime to the modulus. If the gcd is not 1, no inverse exists.',
    ],
  },

  code: {
    sample: {
      input: 'gcd(1071, 462) with each division shown, the coefficients from the extended algorithm, and the inverse of 7 modulo 40.',
      expected: '1071 = 2 * 462 + 147\n462 = 3 * 147 + 21\n147 = 7 * 21 + 0\ngcd(1071, 462) = 21\n21 = (-3) * 1071 + (7) * 462\ninverse of 7 mod 40 = 23',
    },
    python: {
      source: `def gcd(a, b):
    while b != 0:
        q = a // b
        r = a - q * b
        print(f"{a} = {q} * {b} + {r}")
        a, b = b, r
    return a


def extended_gcd(a, b):
    x0, y0 = 1, 0
    x1, y1 = 0, 1
    while b != 0:
        q = a // b
        a, b = b, a - q * b
        x0, x1 = x1, x0 - q * x1
        y0, y1 = y1, y0 - q * y1
    return a, x0, y0


def mod_inverse(a, m):
    g, x, _ = extended_gcd(a, m)
    if g != 1:
        return None
    return x % m


print(f"gcd(1071, 462) = {gcd(1071, 462)}")
g, x, y = extended_gcd(1071, 462)
print(f"{g} = ({x}) * 1071 + ({y}) * 462")
print(f"inverse of 7 mod 40 = {mod_inverse(7, 40)}")`,
      notes: [
        { line: 2, text: 'The loop runs until the remainder, which becomes the new `b`, is 0.' },
        { line: 6, text: 'Simultaneous assignment. Written as two separate statements, `a = b` would destroy the value needed on the next line.' },
        { line: 11, text: 'The starting coefficients say: a = 1 × a + 0 × b, and b = 0 × a + 1 × b.' },
        { line: 16, text: 'The coefficients are updated by the same rule as the numbers: new = older − q × newer.' },
        { line: 25, text: 'The coefficient `x` may be negative. Reducing it modulo `m` gives the inverse in the range 0 to m − 1.' },
      ],
    },
    javascript: {
      source: `function gcd(a, b) {
  while (b !== 0) {
    const q = Math.floor(a / b);
    const r = a - q * b;
    console.log(a + " = " + q + " * " + b + " + " + r);
    a = b;
    b = r;
  }
  return a;
}

function extendedGcd(a, b) {
  let x0 = 1, y0 = 0;
  let x1 = 0, y1 = 1;
  while (b !== 0) {
    const q = Math.floor(a / b);
    [a, b] = [b, a - q * b];
    [x0, x1] = [x1, x0 - q * x1];
    [y0, y1] = [y1, y0 - q * y1];
  }
  return [a, x0, y0];
}

function modInverse(a, m) {
  const [g, x] = extendedGcd(a, m);
  if (g !== 1) return null;
  return ((x % m) + m) % m;
}

console.log("gcd(1071, 462) = " + gcd(1071, 462));
const [g, x, y] = extendedGcd(1071, 462);
console.log(g + " = (" + x + ") * 1071 + (" + y + ") * 462");
console.log("inverse of 7 mod 40 = " + modInverse(7, 40));`,
    },
    cpp: {
      source: `#include <iostream>

long long gcd(long long a, long long b) {
    while (b != 0) {
        long long q = a / b;
        long long r = a - q * b;
        std::cout << a << " = " << q << " * " << b << " + " << r << "\\n";
        a = b;
        b = r;
    }
    return a;
}

long long extended_gcd(long long a, long long b, long long& x, long long& y) {
    long long x0 = 1, y0 = 0;
    long long x1 = 0, y1 = 1;
    while (b != 0) {
        long long q = a / b;
        long long r = a - q * b;
        a = b;
        b = r;
        long long nx = x0 - q * x1;
        x0 = x1;
        x1 = nx;
        long long ny = y0 - q * y1;
        y0 = y1;
        y1 = ny;
    }
    x = x0;
    y = y0;
    return a;
}

long long mod_inverse(long long a, long long m) {
    long long x = 0, y = 0;
    if (extended_gcd(a, m, x, y) != 1) return -1;
    return ((x % m) + m) % m;
}

int main() {
    long long g = gcd(1071, 462);
    std::cout << "gcd(1071, 462) = " << g << "\\n";
    long long x = 0, y = 0;
    g = extended_gcd(1071, 462, x, y);
    std::cout << g << " = (" << x << ") * 1071 + (" << y << ") * 462\\n";
    std::cout << "inverse of 7 mod 40 = " << mod_inverse(7, 40) << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The cost is the number of division steps. After any two steps the larger number has at least halved, so the count grows with the number of digits, not with the size of the numbers. Lamé\'s theorem makes this exact: the number of steps is never more than five times the number of decimal digits in the smaller number.',
    cases: [
      { case: 'Best', time: 'O(1)', when: 'One number divides the other: a single division with remainder 0.' },
      { case: 'Average', time: 'O(log min(a, b)) divisions', when: 'For random inputs the number of steps is about 0.843 × ln n, roughly 1.94 steps per decimal digit.' },
      { case: 'Worst', time: 'O(log min(a, b)) divisions', when: 'Consecutive Fibonacci numbers, where every quotient is 1. At most 5 steps per decimal digit of the smaller number (Lamé, 1844).' },
      { case: 'Bit operations on n-bit numbers', time: 'O(n²)', when: 'With schoolbook arithmetic on numbers too large for one machine word. Each division is cheaper the smaller its quotient, and the costs add up to quadratic, not cubic.' },
    ],
    space: 'O(1): two numbers, or six in the extended version. The numbers never grow beyond the inputs, and the extended coefficients stay smaller in size than the inputs.',
    memory: 'Nothing is stored between steps, so the algorithm runs comfortably on hardware with almost no memory. For numbers of thousands of digits, the working memory is a few numbers of that length.',
    tradeoffs: 'Division is the expensive operation on most hardware. The binary gcd algorithm replaces it with subtraction and halving, which can be faster for machine-sized integers, at the cost of more steps. For numbers of many thousands of digits, asymptotically faster "half-gcd" methods exist but are far more complicated.',
    assumptions: [
      'The count of O(log min(a, b)) is a count of division steps. It equals the running time only when one division takes constant time, which holds for numbers that fit in a machine word.',
      'For larger numbers the cost of each division grows with the length of the numbers. The O(n²) figure assumes schoolbook multiplication and division on n-bit inputs.',
      'The average-case figure assumes the two inputs are chosen at random from a large range.',
      'Inputs are non-negative whole numbers, not both zero.',
    ],
  },

  tradeoffs: {
    excels: [
      'Finding the gcd of two integers of any size without factoring them.',
      'Very large numbers: hundreds or thousands of digits are routine.',
      'Computing modular inverses and solving linear equations in whole numbers, through the extended version.',
      'Testing whether two numbers are coprime.',
    ],
    struggles: [
      'Finding the actual prime factors of a number. The gcd tells you only what two numbers share.',
      'Hardware without a fast division instruction, where the binary gcd algorithm can be quicker.',
      'Cryptographic code that must not leak secrets through timing: the number of steps depends on the inputs, so constant-time variants are used there.',
    ],
    pitfalls: [
      'Overwriting `a` before using it to compute the new `b`.',
      'Remainders of negative numbers, whose sign differs between programming languages.',
      'Overflow when computing a least common multiple as a × b ÷ gcd. Divide first: (a ÷ gcd) × b.',
      'Using a negative Bezout coefficient as a modular inverse without reducing it.',
    ],
    misunderstandings: [
      '"To find the gcd you have to factor both numbers." The Euclidean algorithm never factors anything. That is why it stays fast for numbers so large that factoring them is out of reach.',
      '"The larger number has to be given first." If the smaller comes first, the first division has quotient 0 and swaps the two. The result is the same.',
      '"Bigger numbers always need more steps." The count depends on how the remainders fall, not on size alone. gcd(1,000,000, 500,000) takes one step, while gcd(144, 89) takes ten.',
      '"A gcd of 1 means the numbers are prime." It means they share no common factor. 35 and 18 have gcd 1 and neither is prime.',
    ],
    constraints: [
      'Libraries for very large integers switch between several gcd algorithms depending on the size of the operands.',
      'In cryptographic software, modular inversion is often done by methods whose running time does not depend on the secret value, because the step count of the Euclidean algorithm can leak information.',
    ],
    alternatives: [
      { name: 'Binary gcd (Stein\'s algorithm)', when: 'Division is slow or unavailable: it uses only subtraction, comparison and halving.' },
      { name: 'Prime factorization', when: 'The numbers are small and their factorizations are needed anyway. Hopeless for large numbers.' },
      { id: 'modular-exponentiation', name: 'Modular exponentiation (Fermat\'s little theorem)', when: 'You need an inverse modulo a prime p: a raised to the power p − 2 is the inverse, with no gcd computation.' },
      { name: 'Lehmer\'s algorithm and half-gcd methods', when: 'The numbers have thousands of digits and the cost of full-length divisions dominates.' },
    ],
    comparison: {
      columns: ['', 'Euclidean algorithm', 'Repeated subtraction', 'Factor both numbers'],
      rows: [
        ['Steps for gcd(1,000,000, 1)', '1', '999,999', 'Trivial here, slow in general'],
        ['Worst-case steps', 'About 5 per decimal digit', 'Proportional to the numbers themselves', 'Grows much faster than any polynomial in the digits, by known methods'],
        ['Works for 300-digit numbers', 'Yes, in well under a second', 'No', 'No'],
        ['Also gives x and y with ax + by = gcd', 'Yes, in the extended form', 'With extra bookkeeping', 'No'],
      ],
    },
  },

  applications: [
    { title: 'Keeping fractions in lowest terms', status: 'established', text: 'Exact fraction arithmetic divides numerator and denominator by their gcd after each operation. Python\'s `fractions.Fraction` does this with `math.gcd`, so 48/18 is stored as 8/3.' },
    { title: 'Deriving an RSA private key', status: 'established', text: 'In RSA the private exponent d is the inverse of the public exponent e modulo a number computed from the two secret primes. The extended Euclidean algorithm finds it. With toy numbers, far too small to be secure, e = 7 and modulus 40 give d = 23.' },
    { title: 'Modular inverses throughout cryptography', status: 'established', text: 'Division in modular arithmetic means multiplying by an inverse. Elliptic-curve arithmetic, digital signatures and the Chinese remainder theorem all need inverses, and the extended algorithm or a variant of it is the general way to compute them.' },
    { title: 'Simplifying ratios', status: 'established', text: 'Reducing a ratio means dividing both parts by their gcd. A 1920 by 1080 screen has gcd 120, which gives the familiar aspect ratio 16:9.' },
    { title: 'Spacing events evenly', status: 'illustrative', text: 'Spreading k beats as evenly as possible over n time slots can be done with the same repeated-remainder structure. Godfried Toussaint pointed out in 2005 that the patterns this produces match many traditional rhythms.' },
  ],

  connections: [
    { to: 'rsa', type: 'application', why: 'RSA needs the inverse of the public exponent modulo a secret number. The extended Euclidean algorithm computes exactly that inverse.' },
    { to: 'modular-exponentiation', type: 'related', why: 'The two are the workhorses of modular arithmetic: one computes powers, the other computes inverses, and both take a number of steps proportional to the length of the numbers, not their size.' },
    { to: 'fibonacci-dp', type: 'related', why: 'Consecutive Fibonacci numbers are the inputs on which every quotient is 1, so they are the slowest case. The Fibonacci recurrence is the Euclidean algorithm run backwards.' },
    { to: 'sieve-of-eratosthenes', type: 'related', why: 'Both come from Greek number theory and both avoid trial factorization: the sieve finds primes by crossing out multiples, and Euclid finds common divisors by remainders.' },
    { to: 'binary-search', type: 'related', why: 'Both are fast for the same reason: each step discards a constant fraction of what remains, so the number of steps is logarithmic.' },
    { to: 'concept:modular-arithmetic', type: 'prerequisite', why: 'Each step replaces a number by its remainder modulo the other, and the extended form solves the basic equation of modular arithmetic, a × x ≡ 1.' },
    { to: 'concept:invariant', type: 'prerequisite', why: 'The proof is a single invariant: the pair changes at every step, but its set of common divisors never does.' },
    { to: 'concept:prime-numbers', type: 'related', why: 'Two numbers are coprime when their gcd is 1. The fact that a prime dividing a product divides one of the factors is proved from Bezout\'s identity.' },
    { to: 'concept:recursion', type: 'related', why: 'The rule gcd(a, b) = gcd(b, a mod b) with base case gcd(a, 0) = a is a textbook recursive definition.' },
    { to: 'discipline:cryptography', type: 'application', why: 'Public-key systems are built on modular arithmetic with very large numbers, where inverses are found by the extended algorithm.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why does replacing the pair (a, b) by (b, r), where r is the remainder of a divided by b, not change the greatest common divisor?',
      options: [
        'Because r is always smaller than b',
        'Because anything that divides both a and b also divides r, and anything that divides both b and r also divides a',
        'Because r is always a divisor of a',
        'Because the gcd is always equal to r',
      ],
      answer: 1,
      explain: [
        'That is true, and it is why the algorithm stops. It does not explain why the answer is preserved.',
        'Correct. Since r = a − q × b and a = q × b + r, the two pairs have exactly the same common divisors, so the same greatest one.',
        'Usually it is not. For 48 and 18 the remainder is 12, and 12 does divide 48, but for 50 and 18 the remainder is 14, which does not divide 50.',
        'Only the last non-zero remainder equals the gcd. Earlier remainders are multiples of it.',
      ],
    },
    {
      type: 'predict',
      q: 'How many divisions does the algorithm need for 144 and 89, two consecutive Fibonacci numbers?',
      options: ['2', '5', '10', '89'],
      answer: 2,
      explain: [
        'Two would need the remainders to shrink very fast. Here each remainder is only a little smaller than the one before.',
        'Five steps per digit is the limit, and 89 has two digits.',
        'Correct. Every quotient is 1 until the last, so the pair walks down the whole Fibonacci sequence: 144, 89, 55, 34, 21, 13, 8, 5, 3, 2, 1. That is 10 divisions, exactly Lamé\'s limit of 5 per digit.',
        '89 would be the count for repeated subtraction of 1. Division shrinks the numbers far faster than that.',
      ],
      tryInput: { a: 144, b: 89, extended: false },
    },
    {
      type: 'debug',
      q: 'This function returns the wrong answer for almost every input. For example it says gcd(48, 18) is 18. What is wrong?',
      code: `def gcd(a, b):
    while b != 0:
        a = b
        b = a % b
    return a`,
      options: [
        'Line 2: the loop should run while a is not 0',
        'Lines 3 and 4: `a` is overwritten before it is used, so line 4 computes `b % b`, which is 0',
        'Line 4: it should be `b % a`',
        'Line 5: it should return `b`',
      ],
      answer: 1,
      explain: [
        'The loop condition is right: the algorithm stops when the remainder, held in `b`, reaches 0.',
        'Correct. After `a = b` both variables hold the same value, so the remainder is 0 and the loop ends after one pass. Use `a, b = b, a % b`, or save the remainder in a temporary variable first.',
        'After line 3 both are equal, so `b % a` would also be 0.',
        'When the loop ends `b` is 0. The gcd is in `a`.',
      ],
    },
    {
      type: 'choice',
      q: 'The extended algorithm run on 40 and 7 ends with 1 = 3 × 40 − 17 × 7. What is the inverse of 7 modulo 40, the number between 0 and 39 that multiplies 7 to give remainder 1?',
      options: ['3', '17', '23', '33'],
      answer: 2,
      explain: [
        '3 is the coefficient of 40, which disappears modulo 40. Check: 7 × 3 = 21, not 1 more than a multiple of 40.',
        'The coefficient is −17, not 17. Check: 7 × 17 = 119, which is 1 less than 120.',
        'Correct. Modulo 40 the term 3 × 40 vanishes, leaving −17 × 7 ≡ 1. Adding 40 to −17 gives 23, and indeed 7 × 23 = 161 = 4 × 40 + 1.',
        'Check: 7 × 33 = 231 = 5 × 40 + 31, so the remainder is 31, not 1.',
      ],
    },
    {
      type: 'challenge',
      title: 'A gcd without division',
      prompt: 'Write a gcd function that uses only subtraction, comparison, testing whether a number is even, and halving. This is the binary gcd algorithm, published by Josef Stein in 1967. Then count the steps it takes on the pairs (144, 89) and (1,000,000, 1) and compare with the Euclidean algorithm.',
      hints: [
        'If both numbers are even, gcd(a, b) = 2 × gcd(a / 2, b / 2).',
        'If only one is even, the factor of 2 is not shared, so it can be dropped: gcd(a, b) = gcd(a / 2, b) when a is even and b is odd.',
        'If both are odd, their difference is even: gcd(a, b) = gcd(|a − b|, the smaller of a and b).',
      ],
    },
  ],

  compare: {
    idea: 'Replace the pair (a, b) by (b, a mod b) until the second number is 0.',
    requires: 'Two non-negative whole numbers, not both zero. The answer is exact.',
    sensitivity: 'Low. Between 1 step and about 5 steps per decimal digit of the smaller number, whatever the inputs.',
    memory: 'O(1): a handful of numbers.',
    difficulty: 'low',
    difficultyNote: 'Four lines. The extended version needs care with the order of updates and with negative coefficients.',
    limits: 'Says nothing about the prime factors themselves. Step count depends on the inputs, which matters in timing-sensitive cryptographic code.',
    useWhen: 'You need a gcd, a reduced fraction, a coprimality test or, in extended form, a modular inverse.',
  },

  advanced: {
    history: 'The algorithm appears in Euclid\'s *Elements*, written around 300 BC: Book VII gives it for whole numbers, and Book X gives a version for lengths, where it serves as a test of whether two lengths have a common measure. Euclid describes repeated subtraction; the formulation with division and remainders came later. In 1844 Gabriel Lamé proved that the number of division steps is at most five times the number of decimal digits of the smaller number, using the Fibonacci numbers, in what is often cited as the first rigorous analysis of an algorithm\'s running time. The identity a × x + b × y = gcd(a, b) carries the name of Étienne Bézout, who proved the corresponding statement for polynomials in the eighteenth century. For integers it had been published earlier by Claude Gaspard Bachet de Méziriac.',
    derivation: 'Why the worst case is Fibonacci. Suppose the algorithm takes $n$ division steps on $a > b \\ge 1$. Number the remainders backwards from the end: the last non-zero remainder is at least 1, and the one before it is at least 2 (it is larger than the last one). Each earlier number satisfies $r_{k-1} = q\\,r_k + r_{k+1} \\ge r_k + r_{k+1}$ because every quotient is at least 1. Numbers that start at 1 and 2 and grow at least as fast as the sum of the previous two are bounded below by the Fibonacci numbers, giving\n\n$$b \\ge F_{n+1}, \\qquad a \\ge F_{n+2},$$\n\nwith equality when every quotient is 1 (and the last is 2), that is, for consecutive Fibonacci numbers. Since $F_{n+1} \\ge \\varphi^{\\,n-1}$ with $\\varphi = (1+\\sqrt5)/2$,\n\n$$n - 1 \\le \\log_\\varphi b = \\frac{\\log_{10} b}{\\log_{10}\\varphi} < 4.785\\,\\log_{10} b.$$\n\nIf $b$ has $d$ decimal digits then $\\log_{10} b < d$. Because $\\log_{10}\\varphi > 1/5$, this gives $(n-1)/5 < d$, so $n - 1 < 5d$ and therefore $n \\le 5d$, which is Lamé\'s theorem.',
    proof: 'Bezout\'s identity by induction on the steps. Claim: every number that appears in the algorithm is an integer combination $x\\,a_0 + y\\,b_0$ of the inputs. The inputs themselves are: $a_0 = 1\\cdot a_0 + 0\\cdot b_0$ and $b_0 = 0\\cdot a_0 + 1\\cdot b_0$. If $a = x_0 a_0 + y_0 b_0$ and $b = x_1 a_0 + y_1 b_0$, then the next remainder is\n\n$$r = a - q\\,b = (x_0 - q\\,x_1)\\,a_0 + (y_0 - q\\,y_1)\\,b_0,$$\n\nwhich is again such a combination. The final non-zero remainder is $\\gcd(a_0, b_0)$, so there are integers $x, y$ with $a_0 x + b_0 y = \\gcd(a_0, b_0)$, and the extended algorithm computes them by carrying the two coefficient pairs along. Consequence: if $\\gcd(a, m) = 1$ then $a\\,x + m\\,y = 1$, so $a\\,x \\equiv 1 \\pmod m$ and $x$ is the inverse of $a$ modulo $m$.',
    complexityProof: 'A cruder bound that needs no Fibonacci numbers: after two consecutive steps the larger number has at least halved. Let $a \\ge b$ and $r = a \\bmod b$. If $b \\le a/2$ then $r < b \\le a/2$. If $b > a/2$ then $q = 1$ and $r = a - b < a/2$. Either way $r < a/2$, and after two steps $r$ has taken the place of $a$. So the number of steps is at most about $2\\log_2 a$. For the average case, the number of steps for inputs chosen at random up to $n$ is asymptotically $\\frac{12\\ln 2}{\\pi^2}\\ln n \\approx 0.843\\ln n$, a result due to Heilbronn and Dixon.',
    variants: [
      { name: 'Extended Euclidean algorithm', text: 'Carries coefficients along so that it returns x and y with a × x + b × y = gcd(a, b). The standard way to compute modular inverses.' },
      { name: 'Binary gcd (Stein\'s algorithm)', text: 'Uses only shifts, subtraction and parity tests. Often faster than division-based gcd on machine-word integers.' },
      { name: 'Lehmer\'s algorithm', text: 'For multi-word integers: works out several quotients at once from the leading digits alone, so most steps avoid a full-length division.' },
      { name: 'Polynomial gcd', text: 'The same procedure with polynomial division finds the greatest common divisor of two polynomials. It is used in computer algebra and in decoding error-correcting codes.' },
      { name: 'Continued fractions', text: 'The sequence of quotients produced by the algorithm is the continued fraction expansion of a/b. Cutting the expansion short gives the best rational approximations with small denominators.' },
    ],
    implementation: 'Use the library function where there is one. Take absolute values first if inputs may be negative. Compute a least common multiple as `(a / gcd) * b` to avoid overflow in the product. In the extended version use signed integers wide enough for the coefficients, and reduce the result into the range 0 to m − 1 before using it as an inverse.',
    benchmarking: 'Count divisions for a machine-independent measure, and say how the test inputs were chosen: random pairs take about 40 percent of the worst-case number of steps. For big integers, wall-clock time depends on the multiplication and division routines of the library far more than on the gcd loop itself.',
    references: [
      { authors: 'Euclid', year: 'c. 300 BC', title: 'Elements, Book VII, Propositions 1 and 2', venue: 'English translation by T. L. Heath, The Thirteen Books of Euclid\'s Elements, Cambridge University Press, 1908' },
      { authors: 'G. Lamé', year: 1844, title: 'Note sur la limite du nombre des divisions dans la recherche du plus grand commun diviseur entre deux nombres entiers', venue: 'Comptes Rendus de l\'Académie des Sciences 19' },
      { authors: 'D. E. Knuth', year: 1997, title: 'The Art of Computer Programming, Volume 2: Seminumerical Algorithms (3rd edition), section 4.5.2', venue: 'Addison-Wesley' },
      { authors: 'J. Stein', year: 1967, title: 'Computational problems associated with Racah algebra', venue: 'Journal of Computational Physics 1(3), 397-405' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Number-Theoretic Algorithms", covers the extended algorithm and Lamé\'s theorem.',
      'V. Shoup, *A Computational Introduction to Number Theory and Algebra*, chapter 4, gives careful running-time bounds in terms of bit operations.',
    ],
  },

  tests: [
    { name: 'matches a brute-force gcd and satisfies Bezout on the default input', input: { a: 120, b: 44, extended: false },
      check: (r) => {
        const ok = checkAll(r);
        if (ok !== true) return ok;
        return (r.gcd === 4 && r.divisions === 5) || `gcd ${r.gcd} in ${r.divisions}`;
      } },
    { name: 'matches the reference on 78 and 30', input: { a: 78, b: 30, extended: true },
      check: (r) => {
        const ok = checkAll(r);
        if (ok !== true) return ok;
        return (r.gcd === 6 && r.divisions === 4 && r.x === 2 && r.y === -5) || `gcd ${r.gcd} in ${r.divisions}`;
      } },
    { name: 'the try-this case: gcd(144, 90) = 18 in 4 divisions', input: { a: 144, b: 90, extended: false },
      check: (r) => (r.gcd === 18 && r.divisions === 4) || `gcd ${r.gcd} in ${r.divisions}` },
    { name: 'the worked example: gcd(48, 18) = 6 in 3 divisions', input: { a: 48, b: 18, extended: false },
      check: (r) => (r.gcd === 6 && r.divisions === 3 && r.steps.map((s) => `${s.q}:${s.r}`).join(' ') === '2:12 1:6 2:0') || `gcd ${r.gcd}, steps ${r.steps.map((s) => `${s.q}:${s.r}`).join(' ')}` },
    { name: 'the textbook case: gcd(1071, 462) = 21 = -3 × 1071 + 7 × 462', input: { a: 1071, b: 462, extended: true },
      check: (r) => (checkAll(r) === true && r.gcd === 21 && r.divisions === 3 && r.x === -3 && r.y === 7) || `gcd ${r.gcd}, x ${r.x}, y ${r.y}` },
    { name: 'worst case: Fibonacci numbers 144 and 89 take 10 divisions, all quotients 1 but the last', input: { a: 144, b: 89, extended: false },
      check: (r) => (checkAll(r) === true && r.gcd === 1 && r.divisions === 10 && r.steps.slice(0, 9).every((s) => s.q === 1) && r.steps[9].q === 2) || `gcd ${r.gcd} in ${r.divisions}` },
    { name: 'the modular inverse preset: 1 = 3 × 40 - 17 × 7, so the inverse of 7 mod 40 is 23', input: { a: 40, b: 7, extended: true },
      check: (r) => (r.gcd === 1 && r.x === 3 && r.y === -17 && (((r.y % 40) + 40) % 40) === 23 && (7 * 23) % 40 === 1) || `x ${r.x}, y ${r.y}` },
    { name: 'smaller number first: the first division swaps', input: { a: 18, b: 48, extended: false },
      check: (r) => (checkAll(r) === true && r.gcd === 6 && r.divisions === 4 && r.steps[0].q === 0) || `gcd ${r.gcd} in ${r.divisions}` },
    { name: 'equal numbers and exact division take one step', input: { a: 60, b: 12, extended: false },
      check: (r) => (r.gcd === 12 && r.divisions === 1) || `gcd ${r.gcd} in ${r.divisions}` },
    { name: 'the screen example: 1920 by 1080 has gcd 120, ratio 16 to 9', input: { a: 1920, b: 1080, extended: false },
      check: (r) => (checkAll(r) === true && r.gcd === 120 && 1920 / r.gcd === 16 && 1080 / r.gcd === 9) || `gcd ${r.gcd}` },
    { name: 'coprime inputs with a huge quotient', input: { a: 1000000, b: 1, extended: true },
      check: (r) => (r.gcd === 1 && r.divisions === 1 && r.a * r.x + r.b * r.y === 1) || `gcd ${r.gcd} in ${r.divisions}` },
    { name: 'large Fibonacci pair F30, F29 takes 28 divisions', input: { a: 832040, b: 514229, extended: true },
      check: (r) => (r.gcd === 1 && r.divisions === 28 && r.a * r.x + r.b * r.y === 1) || `gcd ${r.gcd} in ${r.divisions}` },
    { name: 'experiment worst case: two-digit Fibonacci pair hits the Lame limit of 10', input: { digits: 2, mode: 'fibonacci' },
      check: (r, c) => (r.a === 144 && r.b === 89 && c.divisions === 10) || `pair ${r.a}, ${r.b}: ${c.divisions}` },
    { name: 'experiment average stays under the Lame limit', input: { digits: 6, mode: 'random', seed: 3, pairs: 200 },
      check: (r, c) => (c.divisions > 6 && c.divisions < 30) || `average ${c.divisions}` },
  ],
};
