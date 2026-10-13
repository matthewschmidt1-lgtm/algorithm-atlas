const METHODS = [
  { value: 'fast', label: 'Square and multiply' },
  { value: 'naive', label: 'One multiplication at a time' },
];

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).split('').map((d) => SUPERSCRIPT[Number(d)]).join('');
const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;

function run(input, t) {
  const a = Math.floor(Number(input.base)), e = Math.floor(Number(input.exponent)), m = Math.floor(Number(input.modulus));
  if (!(a >= 0) || !(e >= 0)) throw new Error('The base and the exponent must be whole numbers, zero or more.');
  if (!(m >= 2)) throw new Error('The modulus must be a whole number of at least 2.');
  if (m > 90000000) throw new Error('Please keep the modulus below 90,000,000 so that every product can be computed exactly.');
  const base = a % m;
  const naiveCount = Math.max(0, e - 1);

  if (e === 0) {
    t.frame(() => ({ line: 1, note: `Any number to the power 0 is 1, because no copies of it are multiplied together. So the answer is 1 mod ${m} = 1, with no multiplications.`, views: [{ kind: 'rows', rows: [{ label: 'Result', cells: [{ t: 1, role: 'done' }] }] }], vars: { result: 1 } }));
    return { base: a, exponent: e, modulus: m, result: 1 % m, multiplications: 0, squarings: 0, extra: 0, naive: 0, bits: '0' };
  }

  if (input.method === 'naive') return runNaive({ a, e, m, base }, t);

  const bits = e.toString(2);
  const k = bits.length;
  const rowsLog = []; // one entry per binary digit: { d, square, multiply, result, power }
  let result = base;
  let power = 1;      // the exponent reached so far: result = a^power mod m
  let squarings = 0, extra = 0;

  const views = ({ pos = -1, done = false, focus = 'result' } = {}) => {
    const showPlace = k <= 12;
    const digits = {
      kind: 'rows', title: `The exponent ${e} written in binary`,
      legend: [{ label: 'digit being processed', role: 'current' }, { label: 'digits already used', role: 'done' }],
      rows: [
        { label: 'Binary digits', cells: bits.split('').map((d, i) => ({ t: d, sub: showPlace ? 2 ** (k - 1 - i) : undefined, role: done || i < pos ? 'done' : i === pos ? 'current' : undefined })) },
      ],
    };
    if (pos >= 0 || done) digits.rows.push({ label: 'Exponent so far', cells: [{ t: `${power}, which is ${power.toString(2)} in binary`, role: 'active' }] });
    const shown = rowsLog.length > 14 ? rowsLog.slice(-12) : rowsLog;
    const offset = rowsLog.length - shown.length;
    const roles = {};
    if (shown.length) roles[`${shown.length - 1},${focus === 'square' ? 1 : 3}`] = done ? 'done' : 'current';
    const table = {
      kind: 'table', title: `Running values. Every result is a remainder, so it stays below ${m}`, corner: 'step',
      colLabels: ['digit', 'square', `then × ${base}`, 'result', 'which is'],
      rowLabels: shown.map((_, i) => (i + offset === 0 ? 'start' : `${i + offset}`)),
      cells: shown.map((r) => [r.d, r.square, r.multiply, r.result, `${a}${sup(r.power)} mod ${m}`]),
      roles,
    };
    return rowsLog.length ? [digits, table] : [digits];
  };

  t.frame(() => ({ line: [0, 2], note: `Compute **${a}${sup(e)} mod ${m}**: multiply ${e} ${e === 1 ? 'copy' : 'copies'} of ${a} together and take the remainder on division by ${m}. Written in binary, the exponent ${e} is ${bits}, which has ${plural(k, 'digit')}. The method reads those digits from left to right.`, views: views(), vars: { a, e, m } }));

  rowsLog.push({ d: 1, square: '', multiply: '', result, power });
  t.frame(() => ({ line: 3, note: `The leading binary digit is always 1. Start with the result ${a} mod ${m} = **${result}**. That is ${a}¹, so the exponent reached so far is 1.${a >= m ? ` From here on ${a} is replaced by its remainder ${base}, which changes nothing in the final answer.` : ''}`, views: views({ pos: 0 }), vars: { result, 'exponent so far': 1 } }));

  for (let i = 1; i < k; i++) {
    const d = bits[i] === '1' ? 1 : 0;
    const before = result, was = power;
    const sq = (before * before) % m;
    t.count('multiplications');
    squarings += 1;
    result = sq;
    power = was * 2;
    rowsLog.push({ d, square: `${before}² mod ${m} = ${sq}`, multiply: d ? '' : 'not needed', result: sq, power });
    t.frame(() => ({ line: [4, 5], note: `Next digit: ${d}. First square the result: ${before} × ${before} = ${before * before}, and ${before * before} mod ${m} = **${sq}**. Squaring doubles the exponent, from ${was} to ${was * 2}.${d === 0 ? ' The digit is 0, so nothing more is needed for this digit.' : ''}`,
      views: views({ pos: i, focus: d ? 'square' : 'result' }), vars: { digit: d, result: sq, 'exponent so far': was * 2 } }));
    if (d === 1) {
      const prod = sq * base;
      const r2 = prod % m;
      t.count('multiplications');
      extra += 1;
      result = r2;
      power = was * 2 + 1;
      const row = rowsLog[rowsLog.length - 1];
      row.multiply = `${sq} × ${base} mod ${m} = ${r2}`;
      row.result = r2;
      row.power = power;
      t.frame(() => ({ line: [6, 7], note: `The digit is 1, so multiply by ${base} once more: ${sq} × ${base} = ${prod}, and ${prod} mod ${m} = **${r2}**. That adds 1 to the exponent, making it ${was * 2 + 1}.`,
        views: views({ pos: i }), vars: { digit: d, result: r2, 'exponent so far': was * 2 + 1 } }));
    }
  }

  const total = squarings + extra;
  t.frame(() => ({ line: 8, note: `All ${plural(k, 'digit')} are used and the exponent has reached ${e}. So **${a}${sup(e)} mod ${m} = ${result}**, found with ${plural(total, 'multiplication')}: ${plural(squarings, 'squaring')} and ${extra} by ${base}. Multiplying by ${a} one step at a time would take ${naiveCount}.`, views: views({ done: true }), vars: { result, 'one at a time': naiveCount } }));

  return { base: a, exponent: e, modulus: m, result, multiplications: total, squarings, extra, naive: naiveCount, bits };
}

// The slow method, for comparison: multiply by the base e − 1 times. Frames are thinned out for large e.
function runNaive({ a, e, m, base }, t) {
  let result = base;
  const recent = [{ power: 1, result }];
  const every = Math.max(1, Math.ceil((e - 1) / 40));
  const views = (done) => [
    { kind: 'rows', title: 'Multiplying by the base one step at a time', rows: [{ label: 'Progress', cells: [{ t: `${recent[recent.length - 1].power - 1} of ${e - 1} multiplications`, role: done ? 'done' : 'active' }] }] },
    { kind: 'table', title: 'The most recent steps', corner: 'power', colLabels: ['result'], rowLabels: recent.slice(-10).map((r) => `${a}${sup(r.power)} mod ${m}`), cells: recent.slice(-10).map((r) => [r.result]),
      roles: { [`${Math.min(recent.length, 10) - 1},0`]: done ? 'done' : 'current' } },
  ];
  t.frame(() => ({ line: 0, note: `The slow way to compute **${a}${sup(e)} mod ${m}**: start with ${a} mod ${m} = ${base} and multiply by ${base} again and again, taking the remainder each time. Reaching the power ${e} takes ${plural(e - 1, 'multiplication')}.`, views: views(false), vars: { a, e, m } }));
  for (let p = 2; p <= e; p++) {
    const before = result;
    result = (result * base) % m;
    t.count('multiplications');
    if (p <= 12 || p % every === 0 || p === e) {
      recent.push({ power: p, result });
      if (recent.length > 12) recent.shift();
      const now = result;
      t.frame(() => ({ line: 0, note: `Multiplication ${p - 1}: ${before} × ${base} mod ${m} = ${now}. That is ${a}${sup(p)}.${p === 12 && e > 13 && every > 1 ? ` From here only every ${every}th step is shown.` : ''}`, views: views(false), vars: { power: p, result: now } }));
    }
  }
  const total = e - 1;
  const bits = e.toString(2);
  const fastCount = (bits.length - 1) + (bits.split('1').length - 2);
  t.frame(() => ({ line: 0, note: `Done: **${a}${sup(e)} mod ${m} = ${result}** after ${plural(total, 'multiplication')}. Square and multiply reaches the same answer with ${fastCount}.`, views: views(true), vars: { result, 'square and multiply': fastCount } }));
  return { base: a, exponent: e, modulus: m, result, multiplications: total, squarings: 0, extra: total, naive: total, bits };
}

// Independent reference for the tests: plain repeated multiplication.
const slowPower = (a, e, m) => { let r = 1 % m; for (let i = 0; i < e; i++) r = (r * (a % m)) % m; return r; };
const fastCountFor = (e) => { const b = e.toString(2); return (b.length - 1) + (b.split('1').length - 2); };
const agrees = (r) => {
  const want = slowPower(r.base, r.exponent, r.modulus);
  if (r.result !== want) return `${r.base}^${r.exponent} mod ${r.modulus} gave ${r.result}, repeated multiplication gives ${want}`;
  return r.multiplications === fastCountFor(r.exponent) || `${r.multiplications} multiplications, expected ${fastCountFor(r.exponent)}`;
};

export default {
  meta: {
    id: 'modular-exponentiation',
    name: 'Fast Modular Exponentiation',
    aliases: ['square and multiply', 'binary exponentiation', 'exponentiation by squaring', 'repeated squaring', 'modpow', 'power mod'],
    kind: 'algorithm',
    discipline: 'mathematics',
    alsoIn: [
      { id: 'cryptography', why: 'RSA and Diffie-Hellman consist almost entirely of modular exponentiations with numbers hundreds of digits long.' },
    ],
    subfield: 'Number theory',
    family: 'Modular arithmetic',
    lab: 'cryptography',
    summary: 'Computes a power modulo m using the binary digits of the exponent: square for every digit, multiply once more for every 1. The work grows with the length of the exponent, not its size.',
    difficulty: 'intermediate',
    order: 420,
    paradigms: ['number-theoretic'],
    randomized: false,
    approximate: false,
    time: { best: 'O(log e) multiplications', average: 'O(log e) multiplications', worst: 'O(log e) multiplications', class: 'logarithmic' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['compute a huge power', 'remainder of a large power', 'power mod', 'last digits of a big power', 'raise a number to an exponent quickly'],
      techniques: ['repeated squaring', 'binary digits of the exponent', 'reducing after every step'],
      applications: ['security', 'networking', 'scientific computing'],
    },
    prerequisites: ['concept:modular-arithmetic', 'euclidean-algorithm'],
  },

  bigIdea: {
    simple: "Fast modular exponentiation finds the remainder of a huge power without ever working out the huge power. Suppose you multiply 1,000 sevens together and want the remainder when the result is divided by 13. The full product has more than 800 digits. You do not need it. Two ideas get the answer using small numbers only. First, you may take the remainder after every multiplication and carry on from there. The final remainder comes out the same, and no number ever grows beyond 13 times 13. Second, you do not need 1,000 multiplications. Squaring a result doubles the count of sevens multiplied into it: 2, then 4, then 8, then 16. By mixing squarings with a few extra multiplications by 7, you can land on exactly 1,000 in fewer than twenty steps. The encryption that protects messages and payments online depends on this, using numbers hundreds of digits long.",
    what: 'Modular exponentiation computes a^e mod m: the remainder when the product of e copies of a is divided by m. The fast method reads the exponent e in binary, from its leading digit to its last. For every digit it squares the running result, and for every digit that is 1 it also multiplies by a, taking the remainder modulo m after each multiplication.',
    why: 'The exponents used in cryptography have hundreds or thousands of binary digits. Multiplying by the base one step at a time would take more steps than there are atoms in the universe, and the full power would have more digits than could ever be stored. Square and multiply needs at most two multiplications per binary digit of the exponent, and keeps every intermediate number smaller than m squared.',
    when: 'Use it whenever you need a power modulo some number and the exponent is more than a handful: in public-key cryptography, in primality tests, and to compute modular inverses when the modulus is prime. The same square-and-multiply pattern works for anything that can be multiplied, including matrices and points on elliptic curves. If the exponent is tiny, plain repeated multiplication is just as good.',
    interesting: 'It is fast in one direction only. Computing a^e mod m takes a few thousand steps even for numbers of hundreds of digits. Going backwards, finding e when you are given a, m and the result, is called the discrete logarithm problem, and for well-chosen large numbers no efficient method is known. That lopsidedness is what [Diffie-Hellman key exchange](#/algorithm/diffie-hellman) is built on.',
    where: 'It is the core operation of [RSA](#/algorithm/rsa) encryption and signatures and of Diffie-Hellman key exchange. Programming languages provide it directly: `pow(a, e, m)` in Python, `modPow` on Java\'s `BigInteger`. Primality tests used to find large primes call it repeatedly.',
    analogy: {
      title: 'A copier that can only double',
      text: 'You need a stack of exactly 13 sheets. Your machine has two buttons. One doubles the whole stack. The other adds a single sheet. Starting from 1 sheet: double and add one to get 3, double to get 6, double and add one to get 13. Four steps of doubling, with an extra sheet twice, instead of adding one sheet twelve times. Which steps get the extra sheet is not a guess. It is read off 13 written in binary, 1101: after the leading 1, each digit means "double", and each 1 means "then add one".',
      limits: 'The stack counts how many copies of the base have been multiplied together, which is the exponent, not the value of the power. Doubling the stack corresponds to squaring the running result, and adding a sheet corresponds to multiplying by the base once. The picture also leaves out the other half of the method: taking the remainder after every step, which is what keeps the numbers small.',
    },
  },

  example: {
    setup: 'Find the remainder when 5 to the power 13 is divided by 23. "To the power 13" means 13 copies of 5 multiplied together. In binary, 13 is written 1101, because 13 = 8 + 4 + 1. Keep a running result, and after every multiplication replace it by its remainder on division by 23.',
    steps: [
      'The leading digit is 1. Start with the result 5. So far that is one copy of 5.',
      'Next digit, 1. Square: 5 × 5 = 25, remainder 2. That is two copies. The digit is 1, so multiply by 5: 2 × 5 = 10. That is three copies.',
      'Next digit, 0. Square: 10 × 10 = 100, and 100 = 4 × 23 + 8, so the remainder is 8. That is six copies. The digit is 0, so nothing more.',
      'Last digit, 1. Square: 8 × 8 = 64, and 64 = 2 × 23 + 18, remainder 18. That is twelve copies. The digit is 1, so multiply by 5: 18 × 5 = 90, and 90 = 3 × 23 + 21, remainder 21. That is thirteen copies.',
    ],
    result: 'The answer is 21. It took 5 multiplications (3 squarings and 2 multiplications by 5) where multiplying by 5 one step at a time would take 12. The largest number that ever appeared was 100. The full value of 5 to the power 13 is 1,220,703,125, and it was never needed.',
    tryInput: { base: 5, exponent: 13, modulus: 23, method: 'fast' },
  },

  terms: [
    { term: 'Power', meaning: 'A number multiplied by itself a given number of times. 5 to the power 3 is 5 × 5 × 5 = 125.' },
    { term: 'Base', meaning: 'The number being multiplied by itself. In 5 to the power 13, the base is 5.' },
    { term: 'Exponent', meaning: 'How many copies of the base are multiplied together. In 5 to the power 13, the exponent is 13.' },
    { term: 'Modulus', meaning: 'The number you divide by when only the remainder matters.' },
    { term: 'mod', meaning: 'Short for "the remainder on division by". 25 mod 23 is 2.' },
    { term: 'Binary', meaning: 'A way of writing numbers using only the digits 0 and 1, where each place is worth twice the place to its right. 13 is 1101 in binary: 8 + 4 + 0 + 1.' },
    { term: 'Squaring', meaning: 'Multiplying a number by itself.' },
    { term: 'Modular multiplication', meaning: 'Multiplying two numbers and keeping only the remainder on division by the modulus.' },
  ],

  takeaway: 'To raise a number to a big power, read the exponent in binary: square for every digit, multiply once more for every 1, and keep only the remainder as you go.',

  viz: {
    describe: 'The exponent is shown as a row of binary digits, read from left to right. The digit being processed is terracotta and digits already used are forest green; a strip beneath shows the exponent reached so far. Below, a table adds one row per digit with the squaring, the optional multiplication by the base, the running result and which power of the base that result is.',
    inputs: [
      { id: 'base', type: 'number', label: 'Base (a)', default: 7, min: 0, max: 999999 },
      { id: 'exponent', type: 'number', label: 'Exponent (e)', default: 1000, min: 0, max: 1000000000 },
      { id: 'modulus', type: 'number', label: 'Modulus (m)', default: 13, min: 2, max: 1000000 },
      { id: 'method', type: 'select', label: 'Method', options: METHODS, default: 'fast' },
    ],
    presets: [
      { label: '7 to the 1000th, mod 13', values: { base: 7, exponent: 1000, modulus: 13, method: 'fast' } },
      { label: 'Worked example: 5¹³ mod 23', values: { base: 5, exponent: 13, modulus: 23, method: 'fast' } },
      { label: 'Toy RSA encryption: 65¹⁷ mod 3233', values: { base: 65, exponent: 17, modulus: 3233, method: 'fast' } },
      { label: 'Toy RSA decryption: 2790²⁷⁵³ mod 3233', values: { base: 2790, exponent: 2753, modulus: 3233, method: 'fast' } },
      { label: 'Toy Diffie-Hellman: 5⁶ mod 23', values: { base: 5, exponent: 6, modulus: 23, method: 'fast' } },
      { label: 'Primality check: 2⁹⁰ mod 91', values: { base: 2, exponent: 90, modulus: 91, method: 'fast' } },
      { label: 'A composite that passes: 2⁵⁶⁰ mod 561', values: { base: 2, exponent: 560, modulus: 561, method: 'fast' } },
    ],
    tryThis: [
      'Load "Toy RSA encryption", then "Toy RSA decryption". The first turns the message 65 into 2790 and the second turns 2790 back into 65. These numbers are far too small to be secure, but real RSA performs the same exponentiation with numbers of more than 600 digits, plus padding steps that this toy leaves out.',
      'Set the exponent to 1023, then to 1024. The first is ten 1s in binary and needs 18 multiplications. The second is a 1 followed by ten 0s and needs only 10. The cost depends on the number of binary digits and on how many of them are 1.',
      'Switch the method to "One multiplication at a time" with the exponent at 1000. It reaches the same answer after 999 multiplications where square and multiply needed 14.',
      'Load "Primality check: 2⁹⁰ mod 91". If 91 were prime the answer would have to be 1, by Fermat\'s little theorem. It is 64, which proves 91 is not prime without finding its factors. Then load "A composite that passes": 561 = 3 × 11 × 17, yet the answer is 1. This is why practical primality tests use a stronger check.',
    ],
    run,
    report: (r) => `${r.base}^${r.exponent} mod ${r.modulus} = ${r.result}\nExponent in binary: ${r.bits} (${r.bits.length} ${r.bits.length === 1 ? 'digit' : 'digits'}).\n${r.multiplications} modular multiplications used. Square and multiply needs ${r.exponent === 0 ? 0 : fastCountFor(r.exponent)}; one at a time needs ${r.naive}.`,
    experiment: {
      title: 'Multiplications as the exponent gets longer',
      note: 'Each point is a real run with the exponent 2ᵇ − 1, which is b ones in binary and the worst case for square and multiply. Its count is exactly 2b − 2. Multiplying one step at a time needs 2ᵇ − 2 multiplications, which doubles with every extra binary digit. The runs stop at 16 digits because the slow method would otherwise take too long; cryptographic exponents have thousands.',
      metric: 'multiplications',
      metricLabel: 'Modular multiplications',
      sizeLabel: 'Binary digits in the exponent (b)',
      sizes: [2, 4, 6, 8, 10, 12, 14, 16],
      variants: [
        { id: 'fast', label: 'Square and multiply' },
        { id: 'naive', label: 'One multiplication at a time' },
      ],
      input: (bits, variant) => ({ base: 3, exponent: 2 ** bits - 1, modulus: 999983, method: variant }),
      theory: [
        { label: '2b − 2', fn: (b) => 2 * b - 2, variant: 'fast' },
        { label: '2ᵇ − 2', fn: (b) => 2 ** b - 2, variant: 'naive' },
      ],
    },
  },

  logic: {
    intuition: 'Write the exponent in binary and read it one digit at a time from the left. Each new digit doubles the number read so far and adds the digit: 1, then 11 (three), then 110 (six), then 1101 (thirteen). Doubling an exponent means squaring the result, and adding one to an exponent means multiplying by the base. So if the result is kept in step with the digits read, it is the answer when the digits run out. Taking the remainder after each step changes nothing in the end, because remainders can be multiplied in place of the numbers they came from.',
    steps: [
      'If the exponent is 0, the answer is 1.',
      'Write the exponent in binary. Its first digit is 1.',
      'Set the result to the base, reduced modulo m. This accounts for that first digit.',
      'For each remaining digit, from left to right, square the result and reduce it modulo m.',
      'If the digit is 1, also multiply the result by the base and reduce it modulo m.',
      'When the digits are used up, the result is the answer.',
    ],
    pseudocode: [
      'power_mod(a, e, m):',
      '  if e = 0: return 1 mod m',
      '  d₁ d₂ … dₖ ← e in binary',
      '  r ← a mod m',
      '  for i from 2 to k:',
      '    r ← r × r mod m',
      '    if dᵢ = 1:',
      '      r ← r × a mod m',
      '  return r',
    ],
    decisions: [
      { title: 'Which end of the exponent to start from?', text: 'This lesson reads the digits from the most significant end, squaring the result as it goes. The other common version reads from the least significant end: it keeps squaring the base to get a, a², a⁴, a⁸ and so on, and multiplies into the result those that correspond to a 1 digit. Both use the same number of multiplications. The right-to-left form needs no knowledge of how long the exponent is, so it is a natural loop; the left-to-right form always multiplies by the same small base.' },
      { title: 'When to reduce?', text: 'After every multiplication. Reducing only at the end would give the same answer but the intermediate numbers would double in length at every squaring and quickly become unmanageable. Reducing each time keeps every number below m, and every product below m².' },
      { title: 'One digit at a time, or several?', text: 'Processing the exponent in groups of several binary digits, with a small table of precomputed powers, cuts the number of extra multiplications. Implementations for cryptography use this "window" method.' },
      { title: 'Does it matter that the number of steps depends on the exponent?', text: 'In cryptography the exponent is often a secret, and this algorithm multiplies only when a digit is 1. Someone measuring time or power use can learn the digits. Secure implementations do the same sequence of operations whatever the digits are.' },
    ],
    invariants: [
      'After the first i binary digits of e have been processed, the result equals a raised to the number those i digits spell out, reduced modulo m.',
      'The result is always in the range 0 to m − 1, so every product formed is below m².',
    ],
    edgeCases: [
      'Exponent 0: the answer is 1 (or 0 if the modulus is 1). No multiplications.',
      'Exponent 1: the answer is the base reduced modulo m. No multiplications.',
      'Base larger than the modulus: reduce it first. The answer is unchanged.',
      'Base 0, or a base that is a multiple of the modulus: every positive power is 0.',
      'Negative exponents mean modular inverses, which exist only when the base and modulus are coprime. They need the extended Euclidean algorithm first.',
      'Products of two numbers below m can be as large as m². In languages with fixed-size integers that product must fit, or the result is silently wrong.',
    ],
    correctness: 'Let p be the number spelled by the binary digits read so far. Claim: the result equals a^p mod m. At the start one digit, 1, has been read, so p = 1 and the result is a mod m. Reading another digit d changes p to 2p + d. The algorithm squares the result, giving (a^p)² = a^(2p), and if d is 1 multiplies by a, giving a^(2p + 1). In both cases the result is a raised to the new p. Reducing modulo m at each step is allowed because of the rule (x mod m) × (y mod m) mod m = (x × y) mod m. When all digits have been read, p is e, so the result is a^e mod m.',
    mistakes: [
      'Multiplying before squaring inside the loop. The result is then a raised to twice the intended exponent.',
      'Reducing only at the end, or not at all, so that intermediate values overflow or become enormous.',
      'Forgetting that the product of two reduced values can overflow even when each value fits. With 64-bit integers, a modulus above about 4 billion needs a wider type for the product.',
      'Starting the loop at the leading digit after already setting the result to the base, which squares once too often.',
      'Using floating-point numbers. They lose exactness for large products, and the answer is then wrong, not approximately right.',
      'Assuming a^e mod m can be found by first reducing the exponent modulo m. Exponents do not reduce modulo m.',
    ],
  },

  code: {
    sample: {
      input: 'Five powers: a small one, a toy RSA encryption and its decryption (insecure, toy-sized numbers), a Fermat check and the default example.',
      expected: '4^13 mod 497 = 445 (5 multiplications)\n65^17 mod 3233 = 2790 (5 multiplications)\n2790^2753 mod 3233 = 65 (15 multiplications)\n2^560 mod 561 = 1 (11 multiplications)\n7^1000 mod 13 = 9 (14 multiplications)',
    },
    python: {
      source: `def power_mod(a, e, m):
    if e == 0:
        return 1 % m, 0
    base = a % m
    result = base
    count = 0
    digits = bin(e)[2:]
    for d in digits[1:]:
        result = result * result % m
        count += 1
        if d == "1":
            result = result * base % m
            count += 1
    return result, count


for a, e, m in [(4, 13, 497), (65, 17, 3233), (2790, 2753, 3233), (2, 560, 561), (7, 1000, 13)]:
    result, count = power_mod(a, e, m)
    print(f"{a}^{e} mod {m} = {result} ({count} multiplications)")`,
      notes: [
        { line: 5, text: 'The leading binary digit is always 1. Starting from the base accounts for it without a multiplication.' },
        { line: 7, text: '`bin(13)` is the text `0b1101`. Dropping the first two characters leaves the binary digits.' },
        { line: 9, text: 'Square for every digit after the first, and reduce at once so the number never exceeds m.' },
        { line: 12, text: 'An extra multiplication by the base only when the digit is 1.' },
      ],
    },
    javascript: {
      source: `function powerMod(a, e, m) {
  if (e === 0) return { result: 1 % m, count: 0 };
  const base = a % m;
  let result = base;
  let count = 0;
  const digits = e.toString(2);
  for (const d of digits.slice(1)) {
    result = (result * result) % m;  // exact while m is below 2^26, so products stay below 2^53
    count++;
    if (d === "1") {
      result = (result * base) % m;
      count++;
    }
  }
  return { result, count };
}

const cases = [[4, 13, 497], [65, 17, 3233], [2790, 2753, 3233], [2, 560, 561], [7, 1000, 13]];
for (const [a, e, m] of cases) {
  const { result, count } = powerMod(a, e, m);
  console.log(a + "^" + e + " mod " + m + " = " + result + " (" + count + " multiplications)");
}`,
    },
    cpp: {
      source: `#include <iostream>

// Works while m is below 2^32, so that a product of two reduced values fits in 64 bits.
unsigned long long power_mod(unsigned long long a, unsigned long long e, unsigned long long m, int& count) {
    count = 0;
    if (e == 0) return 1 % m;
    unsigned long long base = a % m;
    unsigned long long result = base;
    int top = 63;
    while (((e >> top) & 1ULL) == 0) --top;  // position of the leading binary digit
    for (int i = top - 1; i >= 0; --i) {
        result = result * result % m;
        ++count;
        if ((e >> i) & 1ULL) {
            result = result * base % m;
            ++count;
        }
    }
    return result;
}

int main() {
    const unsigned long long cases[5][3] = {
        {4, 13, 497}, {65, 17, 3233}, {2790, 2753, 3233}, {2, 560, 561}, {7, 1000, 13}};
    for (const auto& c : cases) {
        int count = 0;
        unsigned long long result = power_mod(c[0], c[1], c[2], count);
        std::cout << c[0] << "^" << c[1] << " mod " << c[2] << " = " << result
                  << " (" << count << " multiplications)\\n";
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'If the exponent has k binary digits, the method does k − 1 squarings and one extra multiplication for each 1 digit after the first. That is between k − 1 and 2k − 2 modular multiplications, where k is about log₂ e. An exponent of 2,048 binary digits needs at most 4,094 multiplications. The slow method would need about 2²⁰⁴⁸.',
    cases: [
      { case: 'Best', time: 'log₂ e multiplications', when: 'The exponent is a power of two: one squaring per digit and no extra multiplications.' },
      { case: 'Average', time: 'About 1.5 log₂ e multiplications', when: 'A random exponent has about half its digits equal to 1.' },
      { case: 'Worst', time: '2 ⌊log₂ e⌋ multiplications', when: 'Every binary digit of the exponent is 1, as in 2ᵏ − 1.' },
      { case: 'Bit operations for n-bit numbers', time: 'O(n³)', when: 'Exponent and modulus both have n bits and multiplication is done by the schoolbook method: about n multiplications, each costing O(n²).' },
    ],
    space: 'O(1) numbers: the result, the base and the modulus, each no longer than the modulus. Window methods add a small table of precomputed powers.',
    memory: 'All the work happens on a few numbers the size of the modulus, so memory use is tiny even for cryptographic sizes. The running time is dominated by the multiplications of long numbers, which is where real implementations spend their effort.',
    tradeoffs: 'The binary method is simple and close to the best possible, but it is not always optimal. Reaching the power 15 takes 6 multiplications this way and can be done in 5. Window methods spend a little memory on precomputed powers to save multiplications. Constant-time variants do extra work so that timing reveals nothing about a secret exponent.',
    assumptions: [
      'The count is of modular multiplications. It equals the running time only if one multiplication takes constant time, which holds when the modulus fits in a machine word.',
      'For large numbers each modular multiplication costs more as the numbers grow: O(n²) for n-bit numbers with schoolbook arithmetic, less with faster multiplication methods.',
      'The average case assumes each binary digit of the exponent is equally likely to be 0 or 1.',
      'Counts on this page start from the base itself, so the leading digit costs nothing. Versions that start from 1 perform up to two more multiplications.',
    ],
  },

  tradeoffs: {
    excels: [
      'Powers with very large exponents, where the number of steps must grow with the length of the exponent and not its value.',
      'Modular arithmetic with numbers of hundreds or thousands of digits, since no intermediate value exceeds the square of the modulus.',
      'Powers of anything that can be multiplied associatively: matrices, polynomials, permutations, points on elliptic curves.',
    ],
    struggles: [
      'Secret exponents, in its plain form: the pattern of squarings and multiplications mirrors the binary digits and can leak through timing or power measurements.',
      'The reverse problem. Recovering the exponent from the result is the discrete logarithm problem, which this method does nothing to solve.',
      'Tiny exponents, where the bookkeeping gains nothing over a short loop of multiplications.',
    ],
    pitfalls: [
      'Overflow in the product of two reduced values.',
      'Performing the multiply before the square in the left-to-right version.',
      'Leaking a secret exponent through data-dependent branches.',
      'Reducing the exponent by the wrong modulus when trying to shorten it.',
    ],
    misunderstandings: [
      '"You have to work out the huge power first and then take the remainder." The remainder can be taken after every multiplication without changing the final answer, so the huge number never exists.',
      '"An exponent of a million needs a million multiplications." It needs about one or two per binary digit of the exponent. A million has 20 binary digits.',
      '"Because the method is fast, the reverse must be fast too." Finding the exponent from the result is a different and much harder problem, and public-key cryptography relies on that difference.',
      '"The exponent can be reduced modulo m like the base." It cannot. When m is prime and the base is not a multiple of m, exponents can be reduced modulo m − 1, by Fermat\'s little theorem. For other moduli the right number depends on the prime factors of m.',
    ],
    constraints: [
      'Cryptographic libraries use Montgomery multiplication to avoid a slow division at every step, window methods to cut the number of multiplications, and constant-time code paths to avoid leaking the exponent.',
      'RSA decryption is commonly sped up about fourfold by computing separately modulo each of the two secret primes and combining the results with the Chinese remainder theorem.',
    ],
    alternatives: [
      { name: 'Repeated multiplication', when: 'The exponent is very small, or you want the simplest possible code.' },
      { name: 'Right-to-left binary method', when: 'You prefer a loop that halves the exponent and squares the base, with no need to find the leading digit.' },
      { name: 'Sliding-window exponentiation', when: 'The numbers are large and each multiplication is expensive enough to justify a table of precomputed powers.' },
      { name: 'Montgomery ladder', when: 'The exponent is secret and the sequence of operations must not depend on its digits.' },
      { id: 'euclidean-algorithm', name: 'Extended Euclidean algorithm', when: 'What you actually want is a modular inverse and the modulus is not prime.' },
    ],
    comparison: {
      columns: ['', 'Square and multiply', 'One multiplication at a time', 'Sliding window'],
      rows: [
        ['Multiplications for a k-digit binary exponent', 'k − 1 to 2k − 2', 'Up to 2ᵏ − 2', 'About k plus k ÷ (w + 1) for window width w, after a small table is built'],
        ['For a 2,048-digit binary exponent', 'About 3,000', 'More than 10⁶⁰⁰', 'About 2,400'],
        ['Extra memory', 'None', 'None', 'A small table of powers'],
        ['Safe for secret exponents as written', 'No', 'No', 'No'],
      ],
    },
  },

  applications: [
    { title: 'RSA encryption and signatures', status: 'established', text: 'Encrypting with RSA is one modular exponentiation, c = mᵉ mod n, and decrypting or signing is another with the private exponent. With the toy numbers in this lesson\'s presets, which are far too small to be secure, 65¹⁷ mod 3233 = 2790 and 2790²⁷⁵³ mod 3233 = 65.' },
    { title: 'Diffie-Hellman key exchange', status: 'established', text: 'Each party raises a public base to a private exponent modulo a public prime, sends the result, and then raises what it receives to its own private exponent. Both arrive at the same shared secret. Every step is a modular exponentiation.' },
    { title: 'Primality testing', status: 'established', text: 'The Fermat and Miller-Rabin tests decide whether a large number n is probably prime by computing powers of the form aᵈ mod n. Finding the primes for a cryptographic key means running such tests on many candidates.' },
    { title: 'Modular inverses for a prime modulus', status: 'established', text: 'When p is prime, Fermat\'s little theorem gives the inverse of a as a raised to the power p − 2, modulo p. This is a common way to divide in modular arithmetic, particularly where a constant-time method is wanted.' },
    { title: 'Jumping ahead in a recurrence', status: 'illustrative', text: 'A sequence defined by a fixed linear rule, such as the Fibonacci numbers, can be advanced n steps by raising a small matrix to the power n with the same square-and-multiply pattern, in about log n matrix multiplications.' },
  ],

  connections: [
    { to: 'rsa', type: 'application', why: 'RSA encryption, decryption, signing and verification are each one modular exponentiation. Without a fast method for it, RSA would be unusable.' },
    { to: 'diffie-hellman', type: 'application', why: 'The exchange consists of modular exponentiations, and its security rests on the reverse operation, the discrete logarithm, being hard.' },
    { to: 'euclidean-algorithm', type: 'prerequisite', why: 'Both do their work in a number of steps proportional to the length of the numbers. The Euclidean algorithm supplies the modular inverses that exponentiation alone cannot when the modulus is composite.' },
    { to: 'sieve-of-eratosthenes', type: 'related', why: 'A sieve lists small primes. For large numbers, primality tests built on modular exponentiation take over, with a sieve used only to discard easy composites first.' },
    { to: 'binary-search', type: 'related', why: 'Both get a logarithmic step count from binary structure: binary search halves a range at each step, and this method consumes one binary digit of the exponent at each step.' },
    { to: 'fibonacci-dp', type: 'related', why: 'Raising a 2 by 2 matrix to the power n by square and multiply gives the n-th Fibonacci number in about log n steps, faster than filling a table.' },
    { to: 'shors-algorithm', type: 'advanced', why: 'Shor\'s quantum factoring algorithm spends most of its circuit on modular exponentiation, performed on a superposition of exponents.' },
    { to: 'concept:modular-arithmetic', type: 'prerequisite', why: 'The method depends on the rule that the remainder of a product can be computed from the remainders of its factors.' },
    { to: 'concept:one-way-function', type: 'advanced', why: 'Modular exponentiation is the standard candidate for a one-way function: fast to compute, and believed to be infeasible to invert for well-chosen parameters.' },
    { to: 'concept:public-key-cryptography', type: 'application', why: 'The first practical public-key systems, RSA and Diffie-Hellman, are built from this single operation.' },
    { to: 'concept:invariant', type: 'related', why: 'Its correctness is one invariant: the result is always the base raised to the number spelled by the digits read so far.' },
    { to: 'discipline:cryptography', type: 'application', why: 'Key exchange, encryption and digital signatures over the integers all reduce to computing large modular powers quickly.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why does the algorithm take the remainder modulo m after every multiplication, and not just once at the end?',
      options: [
        'Because the answer would be different otherwise',
        'To keep every intermediate number small; the final answer is the same either way',
        'Because squaring only works on numbers smaller than m',
        'To make the number of multiplications smaller',
      ],
      answer: 1,
      explain: [
        'The final remainder is the same whether you reduce along the way or only at the end. That is the rule (x mod m)(y mod m) mod m = xy mod m.',
        'Correct. Without reduction the running value would double in length at each squaring. With it, nothing ever exceeds m squared.',
        'Any number can be squared. The issue is the size of the result.',
        'The number of multiplications is set by the binary digits of the exponent. Reducing affects how big the numbers are, not how many steps there are.',
      ],
    },
    {
      type: 'predict',
      q: 'How many modular multiplications does square and multiply use to compute 3 to the power 64, modulo 1000? In binary, 64 is 1000000.',
      options: ['6', '7', '12', '63'],
      answer: 0,
      explain: [
        'Correct. After the leading 1 there are six digits, all 0. Each costs one squaring and no extra multiplication: 3 to the 2nd, 4th, 8th, 16th, 32nd and 64th.',
        'There are seven binary digits, but the leading one costs nothing: the result simply starts as the base.',
        '12 would be the count if all six later digits were 1.',
        '63 is the count for multiplying by 3 one step at a time.',
      ],
      tryInput: { base: 3, exponent: 64, modulus: 1000, method: 'fast' },
    },
    {
      type: 'debug',
      q: 'This function returns wrong answers. For 5, 13 and 23 it gives 4 instead of 21. What is wrong?',
      code: `def power_mod(a, e, m):
    result = 1
    for d in bin(e)[2:]:
        if d == "1":
            result = result * a % m
        result = result * result % m
    return result`,
      options: [
        'Line 2: the result should start at 0',
        'Lines 4 to 6: it multiplies before squaring; the squaring must come first',
        'Line 3: the digits should be read from right to left',
        'Line 5: the remainder should not be taken there',
      ],
      answer: 1,
      explain: [
        'Starting at 0 would make every product 0. Starting at 1 and processing every digit is a valid variant.',
        'Correct. Reading a digit d should turn the exponent p into 2p + d: square, then multiply. Multiplying first turns it into 2(p + d), so the function computes a to the power 2e. Here that is 5 to the 26th, which is 4 modulo 23.',
        'Left to right is fine. Reading right to left needs a different loop body, in which the base is squared instead of the result.',
        'Taking the remainder at every step is correct and necessary.',
      ],
    },
    {
      type: 'choice',
      q: 'A program stores numbers in 64-bit integers, which hold values up to about 1.8 × 10¹⁹. It computes `result * result % m` with a modulus m near 10¹². What goes wrong?',
      options: [
        'Nothing: the result is always below m, so it fits',
        'The product can be as large as about 10²⁴, which overflows before the remainder is taken',
        'The remainder operator does not work on numbers that large',
        'The exponent becomes too large',
      ],
      answer: 1,
      explain: [
        'The result fits, but the product is formed first, and the product is what overflows.',
        'Correct. Two values just below 10¹² multiply to nearly 10²⁴. The stored product wraps around and the remainder of the wrong number is returned, with no error reported. The modulus must stay below 2³² for 64-bit products, or a wider type must be used.',
        'The operator is fine. It is simply given a number that has already overflowed.',
        'The exponent is only inspected one binary digit at a time. Its size is not the problem.',
      ],
    },
    {
      type: 'challenge',
      title: 'Fibonacci numbers by squaring',
      prompt: 'Square and multiply works for anything that can be multiplied. The 2 by 2 matrix with rows (1, 1) and (1, 0), raised to the power n, contains the n-th Fibonacci number in its top right corner. Write a function that multiplies two 2 by 2 matrices modulo 1,000,000,007, then use the square-and-multiply loop from this lesson to raise that matrix to the power n. Check your answer against a simple loop for n up to 90, then compute the Fibonacci number with index 10¹⁸ modulo 1,000,000,007.',
      hints: [
        'The loop is unchanged: replace "result × result" by a matrix product and "result × a" by a product with the original matrix.',
        'Start from the matrix itself, to account for the leading binary digit, exactly as the number version starts from the base.',
        'Each matrix entry is a sum of two products of numbers below 1,000,000,007. Make sure the type you use can hold that before reducing.',
      ],
    },
  ],

  compare: {
    idea: 'Read the exponent in binary: square for each digit, multiply by the base for each 1, reducing modulo m every time.',
    requires: 'A whole-number power, zero or more, and arithmetic wide enough to hold the square of the divisor. The result is exact.',
    sensitivity: 'Low. Between log₂ e and 2 log₂ e multiplications, depending only on how many binary digits of e are 1.',
    memory: 'O(1): the result, the base and the modulus.',
    difficulty: 'low',
    difficultyNote: 'A short loop. Order of operations and overflow are the usual errors; making it safe for secret exponents is a specialist task.',
    limits: 'In its plain form the time it takes reveals the power, which matters when the power is a secret. It cannot be run backwards to recover the power.',
    useWhen: 'You need the remainder of a large power, and the power is more than a handful.',
  },

  advanced: {
    history: 'The binary method of exponentiation is very old. Donald Knuth traces it to the *Chandah-sutra* of Pingala, an Indian work on poetic metre from before 200 BC, and it is closely related to the doubling method of multiplication used in ancient Egypt. It became central to computing in the 1970s, when Diffie and Hellman (1976) and then Rivest, Shamir and Adleman (1978) built public-key cryptography on modular exponentiation with very large numbers. In 1985 Peter Montgomery introduced a way to multiply modulo m without a division at each step, which is now standard in implementations. In 1996 Paul Kocher showed that the time taken by a square-and-multiply implementation can reveal a secret exponent, which led to the constant-time variants used today.',
    derivation: 'Write the exponent in binary as $e = (d_1 d_2 \\dots d_k)_2$ with $d_1 = 1$, and let $p_i = (d_1 \\dots d_i)_2$ be the number spelled by its first $i$ digits. Then\n\n$$p_1 = 1, \\qquad p_i = 2\\,p_{i-1} + d_i, \\qquad p_k = e.$$\n\nBy the laws of exponents,\n\n$$a^{p_i} = a^{2p_{i-1} + d_i} = \\left(a^{p_{i-1}}\\right)^2 \\cdot a^{d_i},$$\n\nso $a^{p_i}$ is obtained from $a^{p_{i-1}}$ by one squaring and, when $d_i = 1$, one multiplication by $a$. This is Horner\'s rule for evaluating the binary expansion of $e$, carried out in the exponent. The number of multiplications is\n\n$$(k - 1) + (\\nu(e) - 1) = \\lfloor \\log_2 e \\rfloor + \\nu(e) - 1,$$\n\nwhere $\\nu(e)$ is the number of 1 digits in the binary expansion of $e$.',
    proof: 'Reduction at every step is justified by the fact that congruence modulo $m$ respects multiplication: if $x \\equiv x\'$ and $y \\equiv y\' \\pmod m$ then $xy \\equiv x\'y\' \\pmod m$, because $xy - x\'y\' = x(y - y\') + y\'(x - x\')$ is a multiple of $m$. By induction on $i$, the value $r_i$ held by the algorithm after digit $i$ satisfies $r_i \\equiv a^{p_i} \\pmod m$ and $0 \\le r_i < m$: the base case is $r_1 = a \\bmod m$, and the step applies the congruence rule to the squaring and to the optional multiplication. At $i = k$ this gives $r_k = a^e \\bmod m$, the unique representative in $[0, m)$.',
    complexityProof: 'Lower bound: starting from $a$, each multiplication can at most double the largest exponent reached so far, so at least $\\lceil \\log_2 e \\rceil$ multiplications are needed to reach $a^e$ by any sequence of multiplications. The binary method uses at most $2\\lfloor \\log_2 e \\rfloor$, so it is within a factor of 2 of optimal. It is not always optimal: for $e = 15$ it uses 6 multiplications ($a^2, a^3, a^6, a^7, a^{14}, a^{15}$), while 5 suffice ($a^2, a^3, a^6, a^{12}, a^{15}$). A shortest sequence of this kind is called a shortest addition chain for $e$, and no efficient general method for finding one is known. In bit operations, with $n$-bit modulus and exponent and schoolbook arithmetic, the cost is $O(n)$ modular multiplications of $O(n^2)$ each, $O(n^3)$ in total.',
    variants: [
      { name: 'Right-to-left binary method', text: 'Scan the exponent from its last digit: square the base repeatedly and multiply it into the result whenever the current digit is 1. Same count of multiplications, and the exponent can be consumed by halving.' },
      { name: 'Fixed and sliding windows', text: 'Precompute a few small powers of the base and process several exponent digits per multiplication. Reduces the extra multiplications from about half the digits to a small fraction of them.' },
      { name: 'Montgomery ladder', text: 'Performs one squaring and one multiplication for every digit, whatever its value, so that the sequence of operations does not depend on the exponent.' },
      { name: 'Montgomery multiplication', text: 'Represents numbers in a transformed form in which reduction modulo m needs only shifts and multiplications, no division. It speeds up each step of any exponentiation method.' },
      { name: 'RSA with the Chinese remainder theorem', text: 'Computes the power separately modulo each of the two secret prime factors, with half-length numbers and exponents, and combines the two results. About four times faster.' },
      { name: 'Double and add', text: 'The same algorithm in a group written additively, such as the points of an elliptic curve: squaring becomes doubling a point and multiplying becomes adding the base point.' },
    ],
    implementation: 'Use the library routine for big integers: `pow(a, e, m)` in Python, `BigInteger.modPow` in Java. For machine-word code, make sure the product of two reduced values fits in the integer type, using a 128-bit intermediate if necessary. Never write your own exponentiation for real cryptographic keys; side-channel resistance is subtle and vetted libraries exist.',
    benchmarking: 'Count modular multiplications for a machine-independent measure, and separate squarings from general multiplications, since squaring can be implemented faster. For large numbers, time is governed by the multiplication routine, so compare implementations at the same modulus size and state it.',
    references: [
      { authors: 'D. E. Knuth', year: 1997, title: 'The Art of Computer Programming, Volume 2: Seminumerical Algorithms (3rd edition), section 4.6.3', venue: 'Addison-Wesley' },
      { authors: 'R. L. Rivest, A. Shamir and L. Adleman', year: 1978, title: 'A method for obtaining digital signatures and public-key cryptosystems', venue: 'Communications of the ACM 21(2), 120-126' },
      { authors: 'P. L. Montgomery', year: 1985, title: 'Modular multiplication without trial division', venue: 'Mathematics of Computation 44(170), 519-521' },
      { authors: 'P. C. Kocher', year: 1996, title: 'Timing attacks on implementations of Diffie-Hellman, RSA, DSS, and other systems', venue: 'Advances in Cryptology: CRYPTO \'96, Lecture Notes in Computer Science 1109, Springer' },
    ],
    furtherReading: [
      'A. J. Menezes, P. C. van Oorschot and S. A. Vanstone, *Handbook of Applied Cryptography*, chapter 14, "Efficient Implementation", surveys exponentiation methods in detail.',
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Number-Theoretic Algorithms", section on powers of an element.',
    ],
  },

  tests: [
    { name: 'the default: 7^1000 mod 13 = 9 with 14 multiplications', input: { base: 7, exponent: 1000, modulus: 13, method: 'fast' },
      check: (r, c) => { const ok = agrees(r); return ok !== true ? ok : (r.result === 9 && c.multiplications === 14 && r.bits === '1111101000') || `result ${r.result}, ${c.multiplications} multiplications`; } },
    { name: 'the worked example: 5^13 mod 23 = 21 with 3 squarings and 2 extra multiplications', input: { base: 5, exponent: 13, modulus: 23, method: 'fast' },
      check: (r, c) => (r.result === 21 && c.multiplications === 5 && r.squarings === 3 && r.extra === 2 && r.naive === 12) || `result ${r.result}, ${c.multiplications} multiplications` },
    { name: 'agrees with repeated multiplication on a larger case', input: { base: 123456, exponent: 54321, modulus: 999983, method: 'fast' }, check: agrees },
    { name: 'toy RSA: 65^17 mod 3233 = 2790', input: { base: 65, exponent: 17, modulus: 3233, method: 'fast' },
      check: (r, c) => (r.result === 2790 && c.multiplications === 5) || `result ${r.result}` },
    { name: 'toy RSA: 2790^2753 mod 3233 = 65', input: { base: 2790, exponent: 2753, modulus: 3233, method: 'fast' },
      check: (r, c) => (agrees(r) === true && r.result === 65 && c.multiplications === 15) || `result ${r.result}, ${c.multiplications} multiplications` },
    { name: 'toy Diffie-Hellman: 5^6 mod 23 = 8', input: { base: 5, exponent: 6, modulus: 23, method: 'fast' },
      check: (r) => r.result === 8 || `result ${r.result}` },
    { name: 'Fermat checks: 2^90 mod 91 = 64', input: { base: 2, exponent: 90, modulus: 91, method: 'fast' },
      check: (r) => (agrees(r) === true && r.result === 64) || `result ${r.result}` },
    { name: 'the Carmichael number 561 passes: 2^560 mod 561 = 1', input: { base: 2, exponent: 560, modulus: 561, method: 'fast' },
      check: (r) => (agrees(r) === true && r.result === 1) || `result ${r.result}` },
    { name: 'the predict question: 3^64 mod 1000 takes 6 multiplications', input: { base: 3, exponent: 64, modulus: 1000, method: 'fast' },
      check: (r, c) => (r.result === 281 && c.multiplications === 6) || `result ${r.result}, ${c.multiplications} multiplications` },
    { name: 'the try-this case: exponents 1023 and 1024 need 18 and 10 multiplications', input: { base: 7, exponent: 1023, modulus: 13, method: 'fast' },
      check: (r, c) => (agrees(r) === true && c.multiplications === 18 && fastCountFor(1024) === 10) || `${c.multiplications} multiplications` },
    { name: 'the slow method gives the same answer with e - 1 multiplications', input: { base: 7, exponent: 1000, modulus: 13, method: 'naive' },
      check: (r, c) => (r.result === 9 && c.multiplications === 999) || `result ${r.result}, ${c.multiplications} multiplications` },
    { name: 'exponent 0 and exponent 1', input: { base: 12, exponent: 1, modulus: 5, method: 'fast' },
      check: (r, c) => (r.result === 2 && (c.multiplications || 0) === 0) || `result ${r.result}` },
    { name: 'exponent 0 gives 1', input: { base: 12, exponent: 0, modulus: 5, method: 'fast' },
      check: (r) => r.result === 1 || `result ${r.result}` },
    { name: 'a base that is a multiple of the modulus gives 0', input: { base: 46, exponent: 9, modulus: 23, method: 'fast' },
      check: (r) => r.result === 0 || `result ${r.result}` },
    { name: 'worst-case exponent 2^16 - 1 uses 2 × 16 - 2 = 30 multiplications', input: { base: 3, exponent: 65535, modulus: 999983, method: 'fast' },
      check: (r, c) => (r.result === 695164 && c.multiplications === 30) || `result ${r.result}, ${c.multiplications} multiplications` },
  ],
};
