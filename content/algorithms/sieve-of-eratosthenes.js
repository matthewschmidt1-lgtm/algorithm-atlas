const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
// "The smaller multiple, 6, was" / "The smaller multiples, 10, 15 and 20, were" / "..., 14, 21, 28 and so on, were"
function smallerMultiples(p) {
  const count = p - 2;
  if (count === 1) return `The smaller multiple, ${2 * p}, was`;
  const shown = [2 * p, 3 * p, 4 * p].slice(0, Math.min(count, 3));
  const text = count > 3 ? `${shown.join(', ')} and so on` : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
  return `The smaller multiples, ${text}, were`;
}

function run(input, t) {
  const n = Math.floor(Number(input.n));
  if (!(n >= 2)) throw new Error('The limit must be a whole number of at least 2.');
  const optimized = input.optimized !== false;
  const composite = new Uint8Array(n + 1);
  const by = new Int32Array(n + 1);       // the prime that first crossed each number out (used in the notes)
  const sievingPrimes = [];               // primes whose multiples were actually crossed out
  const cols = n > 100 && n % 20 === 0 ? 20 : 10; // wider rows when they come out even
  const rows = Math.ceil(n / cols);
  let crossings = 0;
  let passed = 1;                          // every number up to here has been decided

  const legend = [{ label: 'current prime p', role: 'current' }, { label: 'being crossed out now', role: 'rejected' }, { label: 'crossed out: not prime', role: 'visited' }, { label: 'prime', role: 'done' }];
  const views = ({ p = 0, hits = [], finished = false } = {}) => {
    const cells = new Array(rows * cols).fill('empty');
    const labels = new Array(rows * cols).fill('');
    const found = [];
    for (let k = 1; k <= n; k++) {
      labels[k - 1] = k;
      let role = 'empty'; // pale: still a candidate
      if (k === 1 || composite[k]) role = 'visited';
      else if (finished || k <= passed) { role = 'done'; found.push(k); }
      cells[k - 1] = role;
    }
    for (const m of hits) cells[m - 1] = 'rejected';
    if (p) cells[p - 1] = 'current';
    return [
      { kind: 'grid', title: `The numbers 1 to ${n}. Pale cells are still candidates`, rows, cols, cells, labels, legend },
      { kind: 'rows', rows: [{ label: finished ? 'Primes' : 'Primes so far', cells: found.map((k) => ({ t: k, role: 'done' })) }] },
    ];
  };

  t.frame(() => ({ line: [0, 1], note: `Write down the numbers up to ${n}. 1 is crossed out from the start: a prime has exactly two divisors, 1 and itself, and 1 has only one. Every other number is a candidate, shown pale, until something crosses it out.`, views: views(), vars: { n } }));

  let p = 2;
  let quiet = false; // naive mode: once 2p is past n, later passes cross out nothing and are not narrated
  for (; optimized ? p * p <= n : p <= n; p++) {
    const start = optimized ? p * p : 2 * p;
    if (composite[p]) {
      const cp = p;
      if (!quiet) t.frame(() => ({ line: [3, 4, 9], note: `${cp} is already crossed out: it is a multiple of ${by[cp]}. So it is not prime, and all of its multiples are multiples of ${by[cp]} too and are already gone. Skip it.`, views: views(), vars: { p: cp } }));
      passed = p;
      continue;
    }
    if (start > n) {
      // Only reached with the shortcuts off: p is prime but has no multiple within the limit.
      const cp = p;
      passed = p;
      if (!quiet) {
        quiet = true;
        t.frame(() => ({ line: [3, 4, 5, 6], note: `${cp} is not crossed out, so it is prime. Its first multiple, 2 × ${cp} = ${2 * cp}, is already past ${n}, and the same will be true for every larger number. Without the "stop at the square root" shortcut the loop still visits each of them, but none of those visits crosses anything out.`, views: views({ p: cp }), vars: { p: cp } }));
      }
      continue;
    }
    sievingPrimes.push(p);
    {
      const cp = p;
      t.frame(() => ({ line: [3, 4, 5], note: `${cp} has not been crossed out, so no smaller number divides it: **${cp} is prime**. Now cross out its multiples, starting at ${optimized ? `${cp} × ${cp} = ${start}` : `2 × ${cp} = ${start}`}.${optimized && cp > 2 ? ` ${smallerMultiples(cp)} already crossed out when smaller primes were handled.` : ''}`, views: views({ p: cp }), vars: { p: cp, 'first multiple': start } }));
    }
    const total = Math.floor((n - start) / p) + 1;
    const chunk = n <= 120 ? 1 : Math.ceil(total / 8);
    let batch = [], fresh = 0;
    for (let m = start; m <= n; m += p) {
      t.count('crossings');
      crossings += 1;
      const already = composite[m] === 1;
      if (!already) { composite[m] = 1; by[m] = p; fresh += 1; }
      batch.push(m);
      if (batch.length === chunk || m + p > n) {
        const cp = p, hits = batch, newly = fresh, first = by[m];
        t.frame(() => ({ line: [6, 7, 8],
          note: hits.length === 1
            ? `Cross out ${hits[0]}, which is ${hits[0] / cp} × ${cp}.${already ? ` It was already crossed out as a multiple of ${first}. The sieve does not check, so this step is repeated work.` : ''}`
            : `Cross out ${plural(hits.length, 'multiple')} of ${cp}, from ${hits[0]} to ${hits[hits.length - 1]}. ${newly === hits.length ? 'None of them had been crossed out before.' : `${newly} of them had not been crossed out before; the rest were already gone.`}`,
          views: views({ p: cp, hits }), vars: { p: cp, m: hits[hits.length - 1] } }));
        batch = [];
        fresh = 0;
      }
    }
    passed = p;
  }

  if (optimized) {
    const cp = p;
    t.frame(() => ({ line: 3, note: `${cp} × ${cp} = ${cp * cp} is larger than ${n}, so the loop stops. A number up to ${n} that is not prime must have a divisor no larger than its square root, and every such divisor has now been handled. So every number still standing is prime.`, views: views(), vars: { p: cp, 'p × p': cp * cp } }));
  }

  const primes = [];
  for (let k = 2; k <= n; k++) if (!composite[k]) primes.push(k);
  t.frame(() => ({ line: 10, note: `Done. There are **${primes.length}** primes up to ${n}${primes.length <= 30 ? `: ${primes.join(', ')}` : `, from 2 up to ${primes[primes.length - 1]}`}. The sieve made ${plural(crossings, 'crossing')} and never divided one number by another.`, views: views({ finished: true }), vars: { primes: primes.length } }));

  return { n, primes, count: primes.length, crossings, sievingPrimes };
}

// Independent reference for the tests: trial division, which shares nothing with the sieve.
const isPrimeByDivision = (k) => { if (k < 2) return false; for (let d = 2; d * d <= k; d++) if (k % d === 0) return false; return true; };
const matchesTrialDivision = (r) => {
  const want = [];
  for (let k = 2; k <= r.n; k++) if (isPrimeByDivision(k)) want.push(k);
  return want.join(',') === r.primes.join(',') || `expected ${want.length} primes up to ${r.n}, got ${r.primes.length}`;
};

export default {
  meta: {
    id: 'sieve-of-eratosthenes',
    name: 'Sieve of Eratosthenes',
    aliases: ['prime sieve', 'Eratosthenes sieve', 'list of primes', 'find all primes up to n'],
    kind: 'algorithm',
    discipline: 'mathematics',
    alsoIn: [
      { id: 'cryptography', why: 'Tables of small primes made by sieving are used to weed out candidates quickly when large primes are generated for keys.' },
    ],
    subfield: 'Number theory',
    family: 'Prime sieves',
    lab: 'mathematics',
    authors: 'Eratosthenes of Cyrene',
    summary: 'Finds every prime up to a limit by writing out the numbers and crossing out the multiples of each prime in turn. Whatever is never crossed out is prime.',
    difficulty: 'beginner',
    order: 410,
    paradigms: ['number-theoretic'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n log log n)', average: 'O(n log log n)', worst: 'O(n log log n)', class: 'linearithmic' },
    space: { worst: 'O(n)', class: 'linear' },
    tags: {
      problems: ['find all prime numbers up to a limit', 'list the primes below 100', 'which numbers are prime', 'make a table of primes', 'count the primes up to n'],
      techniques: ['crossing out multiples', 'marking an array', 'stopping at the square root'],
      applications: ['security', 'scientific computing'],
    },
    prerequisites: ['concept:prime-numbers', 'concept:array'],
  },

  bigIdea: {
    simple: "The sieve of Eratosthenes finds all the prime numbers up to a limit you choose. A prime is a whole number bigger than 1 that cannot be divided evenly by anything except 1 and itself, such as 2, 3, 5 and 7. A kitchen sieve keeps what you want by letting everything else fall away, and this method does the same with numbers. Write down every number from 2 up to your limit. The first number, 2, is prime. Cross out every multiple of 2 after it: 4, 6, 8 and so on. Now move to the next number that is not crossed out. That is 3, so 3 is prime. Cross out its multiples. Keep going. Each time, the next number still standing is prime, and its multiples get crossed out. When you finish, the numbers left are exactly the primes. Nothing ever has to be divided. You only count along the list in equal steps.",
    what: 'The sieve of Eratosthenes produces every prime number up to a chosen limit n. It keeps one mark for each number from 2 to n. Going through the numbers in order, whenever it meets one that is still unmarked it has found a prime, and it marks all of that prime\'s multiples as composite, meaning not prime. The numbers left unmarked at the end are the primes.',
    why: 'Testing each number separately, by trying to divide it by smaller numbers, repeats a great deal of work. The sieve turns the problem around. It never asks "what divides this number?". It starts from each prime and removes, in one sweep, everything that prime divides. Getting all the primes up to a limit this way costs barely more than looking at each number once.',
    when: 'Use it when you want all the primes up to some limit, or need to answer many "is this prime?" questions about numbers below a limit, and you can afford memory proportional to that limit. It is the wrong tool for testing one very large number, such as a 300-digit candidate for a cryptographic key: the table would never fit. For that, use a primality test built on [modular exponentiation](#/algorithm/modular-exponentiation).',
    interesting: 'Two small observations make it much faster, and both are easy to check in the visualization. First, you can start crossing out the multiples of p at p × p, because every smaller multiple has a smaller prime factor and is already gone. Second, you can stop as soon as p × p passes the limit. With a limit of 100, only the multiples of 2, 3, 5 and 7 ever need crossing out.',
    where: 'It is the standard way to build tables of small primes, which are then used everywhere from number theory software to the first, cheap filtering step when cryptographic libraries search for large primes.',
    analogy: {
      title: 'Children sitting down in a line',
      text: "Children wearing the numbers 2 to 100 stand in a line. The first child, number 2, stays standing and walks down the line asking every second child after them to sit: 4, 6, 8 and so on. Then the next child still standing, number 3, asks every third child after them to sit, and so it goes on. A child who is still standing when their turn comes has been passed over by every walker before them. Their number is not a multiple of any smaller prime, and that is enough to make it prime. When nobody new is left to take a turn, the children still standing are wearing exactly the prime numbers.",
      limits: "This picture is close to exact, so its weak points are the method's own. Some children are asked to sit more than once: number 12 hears it from 2 and again from 3. The computer wastes effort in the same way, and it is the main inefficiency of the method. There must also be one child for every number up to the limit. That is the real cost of the sieve: memory for the whole range. It is fine for a limit of a hundred or a hundred million, and impossible for numbers with hundreds of digits.",
    },
  },

  example: {
    setup: 'Find every prime up to 30. A prime is a whole number above 1 whose only divisors are 1 and itself. Write the numbers 2 to 30 in a row and cross numbers out as you go.',
    steps: [
      '2 is not crossed out, so it is prime. Cross out its multiples starting from 2 × 2 = 4: that is 4, 6, 8 and so on up to 30. Fourteen numbers go.',
      '3 is not crossed out, so it is prime. Start at 3 × 3 = 9 and step by 3: 9, 12, 15, 18, 21, 24, 27, 30. Four of those (12, 18, 24, 30) were already crossed out. The new ones are 9, 15, 21 and 27.',
      '4 is crossed out, so skip it.',
      '5 is not crossed out, so it is prime. Start at 5 × 5 = 25 and step by 5: 25 and 30. Only 25 is new.',
      'The next number is 6, and 6 × 6 = 36 is beyond 30. Stop.',
    ],
    result: 'The numbers never crossed out are 2, 3, 5, 7, 11, 13, 17, 19, 23 and 29. Those are the ten primes up to 30. Only three primes, 2, 3 and 5, were needed to do all the crossing out, and it took 14 + 8 + 2 = 24 crossings.',
    tryInput: { n: 30, optimized: true },
  },

  terms: [
    { term: 'Divisor', meaning: 'A whole number that divides another with nothing left over. 3 is a divisor of 12.' },
    { term: 'Prime number', meaning: 'A whole number greater than 1 whose only divisors are 1 and itself: 2, 3, 5, 7, 11 and so on.' },
    { term: 'Composite number', meaning: 'A whole number greater than 1 that is not prime. It can be written as a product of two smaller whole numbers, as 12 = 3 × 4.' },
    { term: 'Multiple', meaning: 'What you get by multiplying a number by a whole number. The multiples of 3 are 3, 6, 9, 12 and so on.' },
    { term: 'Sieve', meaning: 'A method that finds what you want by removing everything else, the way a kitchen sieve holds back lumps.' },
    { term: 'Square root', meaning: 'The number which, multiplied by itself, gives the number you started with. The square root of 100 is 10.' },
  ],

  takeaway: 'Write down the numbers, and each time you reach one that has not been crossed out, call it prime and cross out all its multiples.',

  viz: {
    describe: 'A grid of the numbers from 1 up to the limit, ten or twenty to a row. Numbers not yet decided are pale. The prime currently being used is terracotta, the multiples being crossed out at this step are brick red, numbers crossed out earlier are sage green, and numbers confirmed as prime are dark forest green. A strip below lists the primes found so far.',
    inputs: [
      { id: 'n', type: 'range', label: 'Find primes up to', min: 20, max: 200, step: 10, default: 100 },
      { id: 'optimized', type: 'toggle', label: 'Use both shortcuts', default: true,
        help: 'On: start crossing out at p × p and stop when p × p passes the limit. Off: start at 2 × p and try every p up to the limit.' },
    ],
    presets: [
      { label: 'Primes up to 100', values: { n: 100, optimized: true } },
      { label: 'Worked example: up to 30', values: { n: 30, optimized: true } },
      { label: 'Up to 100 without the shortcuts', values: { n: 100, optimized: false } },
      { label: 'Primes up to 200', values: { n: 200, optimized: true } },
    ],
    tryThis: [
      { ask: 'Load "Primes up to 100". There are 25 primes up to 100, and 74 other numbers that have to be crossed out. How many of the 25 primes will do any crossing out?',
        reveal: 'Only four: 2, 3, 5 and 7. The next prime is 11, and 11 × 11 = 121 is already more than 100. Every number up to 100 that is not prime has a prime factor of 7 or less, so those four passes remove them all.' },
      { ask: 'In "Primes up to 100", step slowly through the pass for 3. It starts at 9 and visits every third number up to 99, which makes 31 numbers. How many of the 31 had already been crossed out by 2?',
        reveal: '15 of them, every second one: 12, 18, 24 and so on up to 96. The note says so each time. The sieve does not look before it crosses out, so those steps are repeated work. Over the whole run 30 of the 104 crossings are repeats, which is why the cost is a little more than one step per number.' },
      { ask: 'With both shortcuts on, the run up to 100 takes 104 crossings. Load "Up to 100 without the shortcuts". Will the count be about the same, about half as much again, or several times larger? And will the list of primes change?',
        reveal: 'It takes 146 crossings against 104, about 40 percent more, and 15 primes do the crossing out where four were enough. The list of primes is exactly the same. The shortcuts remove work that could never change the answer.' },
      { ask: 'At a limit of 100 the run takes 104 crossings and the last prime used is 7. Raise the limit to 200. Will the crossings double? And how far will the last prime used move?',
        reveal: 'The crossings slightly more than double, from 104 to 232. The last prime that has to be used only moves from 7 to 13, because 13 × 13 = 169 is under 200 and 17 × 17 = 289 is not. Doubling the limit adds two primes to the work, 11 and 13.' },
    ],
    run,
    report: (r, c) => `${r.count} primes up to ${r.n}, found with ${c.crossings || 0} crossings. Primes used for crossing out: ${r.sievingPrimes.join(', ')}.\n${r.primes.length <= 60 ? r.primes.join(' ') : `${r.primes.slice(0, 60).join(' ')} ... (${r.primes.length - 60} more)`}`,
    experiment: {
      title: 'Crossings as the limit grows',
      note: 'Each point is a real run counting every time a number is crossed out, including repeats. Both versions grow like n ln ln n. Over this range ln ln n only rises from about 1.9 to 2.4, so the curves look almost like straight lines, which is the point: the cost is very nearly proportional to n. The shortcuts lower the count by a roughly constant fraction.',
      metric: 'crossings',
      metricLabel: 'Crossings',
      sizeLabel: 'Limit (n)',
      sizes: [1000, 2000, 5000, 10000, 20000, 50000, 100000],
      variants: [
        { id: 'optimized', label: 'Start at p × p, stop at √n' },
        { id: 'plain', label: 'Start at 2p, try every p up to n' },
      ],
      input: (n, variant) => ({ n, optimized: variant === 'optimized' }),
      theory: [
        { label: 'n ln ln n (scaled)', fn: (n) => n * Math.log(Math.log(n)), scaled: true, variant: 'optimized' },
        { label: 'n ln ln n (scaled)', fn: (n) => n * Math.log(Math.log(n)), scaled: true, variant: 'plain' },
      ],
    },
  },

  logic: {
    intuition: 'Every composite number is a multiple of some prime smaller than itself. So if you remove the multiples of every prime, what remains cannot be composite. And you never need to know the primes in advance: when you reach a number that no smaller prime has removed, it has no smaller prime divisor, so it is itself the next prime.',
    steps: [
      'Make a list of marks, one for each number from 2 to n, all set to "candidate".',
      'Let p be 2.',
      'If p is still a candidate, it is prime. Cross out p × p, p × p + p, p × p + 2p and so on, up to n.',
      'Move p to the next number.',
      'Repeat steps 3 and 4 while p × p is at most n.',
      'Every number still marked as a candidate is prime.',
    ],
    pseudocode: [
      'sieve(n):',
      '  mark 2 … n as candidates',
      '  p ← 2',
      '  while p × p ≤ n:',
      '    if p is still a candidate:',
      '      m ← p × p',
      '      while m ≤ n:',
      '        cross out m',
      '        m ← m + p',
      '    p ← p + 1',
      '  return remaining candidates',
    ],
    decisions: [
      { title: 'Where to start crossing out?', text: 'A multiple k × p with k smaller than p has a prime factor smaller than p, namely any prime factor of k, so it was crossed out during an earlier pass. The first multiple that p alone is responsible for is p × p. Starting at 2 × p is also correct, only slower.' },
      { title: 'When to stop?', text: 'If a number m up to n is composite, write it as a product of two factors. They cannot both be larger than √n, or their product would exceed n. So m has a prime factor of at most √n and is crossed out by the time p reaches √n. Passes with larger p would start beyond n and do nothing.' },
      { title: 'What to store?', text: 'One true-or-false mark per number is enough. Serious implementations store one bit per number, and skip even numbers altogether, which halves the memory and the work.' },
      { title: 'Check before crossing out?', text: 'Testing whether a number is already crossed out before crossing it out again saves nothing: the test costs as much as the write. The repeats are simply accepted. Removing them altogether takes a different algorithm, the linear sieve.' },
    ],
    invariants: [
      'A number is crossed out only if it is a multiple of some prime smaller than itself, so no prime is ever crossed out.',
      'When the loop reaches p, every composite number that has a prime factor smaller than p has already been crossed out.',
      'Consequently, when the loop reaches p, every number below p × p that is still a candidate is prime.',
    ],
    edgeCases: [
      'A limit below 2: there are no primes to report. 0 and 1 are not prime.',
      'The number 2: the only even prime, and the first one found.',
      'Squares of primes, such as 49 or 121: they are crossed out for the first time by their own square root, so the stopping test must be "p × p ≤ n", not "p × p < n".',
      'Computing p × p for large p can overflow a fixed-size integer. Compare p with n ÷ p instead, or use a wider integer type.',
      'Very large limits: the array of marks stops fitting in memory long before the running time becomes a problem.',
    ],
    correctness: 'Two things must be shown. No prime is crossed out: a number is crossed out only as m = p × p + j × p = (p + j) × p with p at least 2 and p + j at least 2, which is a product of two numbers greater than 1 and therefore composite. Every composite number up to n is crossed out: let m be composite and let q be its smallest prime factor. Then m = q × k where every prime factor of k is at least q, so k ≥ q and m ≥ q × q. That gives q × q ≤ m ≤ n, so the loop reaches p = q. At that moment q is still a candidate, because by the first part no prime is ever crossed out. The inner loop then crosses out q × q, q × q + q and so on, which includes m since m is a multiple of q that is at least q × q. So the numbers left as candidates are exactly the primes.',
    mistakes: [
      'Starting the inner loop at p instead of at p × p or 2 × p. That crosses out p itself, so every prime the outer loop reaches is lost. With the outer loop stopping at √n those are the primes up to √n. With an outer loop that runs all the way to n, the result contains no primes at all.',
      'Stopping the outer loop while p × p < n instead of p × p ≤ n. When n is the square of a prime, such as 49, it is then wrongly reported as prime.',
      'Treating 1 as prime, or forgetting to exclude 0 and 1 when the array is indexed from 0.',
      'An array of size n instead of n + 1, so the number n itself has no mark.',
      'Using the sieve to test a single large number. It needs memory for every number up to that one.',
    ],
  },

  code: {
    sample: {
      input: 'The limit n = 49, which is 7 × 7, the square of a prime.',
      expected: 'primes up to 49: 2 3 5 7 11 13 17 19 23 29 31 37 41 43 47\ncount: 15\ncrossings: 43',
    },
    breakIt: [
      { change: 'In the test on the outer loop, change `p * p <= n` to `p * p < n`. The limit is 49. Which number will be wrongly reported as prime?',
        find: { python: 'while p * p <= n:', javascript: 'p * p <= n; p++' },
        replace: { python: 'while p * p < n:', javascript: 'p * p < n; p++' },
        reveal: '49. It prints "primes up to 49: 2 3 5 7 11 13 17 19 23 29 31 37 41 43 47 49" and "count: 16". 49 is 7 × 7, so 7 is the only prime that can cross it out. With `<` the loop stops when p reaches 7, because 7 × 7 is not less than 49, and 7 never takes its turn. The crossings fall from 43 to 42, and the one that is missing is the one that mattered. With a limit of 50 the same mistake would not show at all, which is why this program uses 49.' },
      { change: 'Start the inner loop at `p` instead of at `p * p`. Which primes will be missing from the list?',
        find: { python: 'm = p * p', javascript: 'let m = p * p;' },
        replace: { python: 'm = p', javascript: 'let m = p;' },
        reveal: '2, 3, 5 and 7. It prints "primes up to 49: 11 13 17 19 23 29 31 37 41 43 47" and "count: 11", with 56 crossings where there were 43. Each of the four small primes crossed itself out as the first step of its own pass. The larger primes survive only because the outer loop stops at 7 and they never get a turn. In a version whose outer loop runs all the way to n, every prime crosses itself out and the list comes back empty.' },
      { change: 'Before the loops start, 0 and 1 are both ruled out. Stop ruling out 1, and leave 0 ruled out. What will the list of primes begin with?',
        find: { python: 'is_candidate[0] = is_candidate[1] = False', javascript: '  isCandidate[1] = false;\n' },
        replace: { python: 'is_candidate[0] = False', javascript: '' },
        reveal: 'With 1. It prints "primes up to 49: 1 2 3 5 7 11 13 17 19 23 29 31 37 41 43 47" and "count: 16". Nothing in the sieve ever crosses out 1, because every number crossed out is a multiple of some p that is at least 2. Left as a candidate, 1 is reported as prime. It has to be ruled out by hand: a prime has exactly two divisors, and 1 has only one.' },
    ],
    python: {
      source: `def sieve(n):
    is_candidate = [True] * (n + 1)
    is_candidate[0] = is_candidate[1] = False
    crossings = 0
    p = 2
    while p * p <= n:
        if is_candidate[p]:
            m = p * p
            while m <= n:
                is_candidate[m] = False
                crossings += 1
                m += p
        p += 1
    primes = [k for k in range(n + 1) if is_candidate[k]]
    return primes, crossings


primes, crossings = sieve(49)
print("primes up to 49: " + " ".join(str(k) for k in primes))
print(f"count: {len(primes)}")
print(f"crossings: {crossings}")`,
      notes: [
        { line: 2, text: 'One mark per number from 0 to n. Size n + 1, so that index n exists.' },
        { line: 6, text: 'Stop once p × p passes n. Note the `<=`: when n is the square of a prime, that prime must still take its turn.' },
        { line: 7, text: 'If p is still a candidate, nothing smaller divides it, so it is prime.' },
        { line: 8, text: 'Start at p × p. Smaller multiples of p have a smaller prime factor and are already crossed out.' },
        { line: 12, text: 'Step by p. The sieve reaches every multiple by addition and never performs a division.' },
      ],
    },
    javascript: {
      source: `function sieve(n) {
  const isCandidate = new Array(n + 1).fill(true);
  isCandidate[0] = false;
  isCandidate[1] = false;
  let crossings = 0;
  for (let p = 2; p * p <= n; p++) {
    if (isCandidate[p]) {
      for (let m = p * p; m <= n; m += p) {
        isCandidate[m] = false;
        crossings++;
      }
    }
  }
  const primes = [];
  for (let k = 0; k <= n; k++) {
    if (isCandidate[k]) primes.push(k);
  }
  return { primes, crossings };
}

const { primes, crossings } = sieve(49);
console.log("primes up to 49: " + primes.join(" "));
console.log("count: " + primes.length);
console.log("crossings: " + crossings);`,
    },
    cpp: {
      source: `#include <iostream>
#include <vector>

int main() {
    const int n = 49;
    std::vector<bool> is_candidate(n + 1, true);
    is_candidate[0] = false;
    is_candidate[1] = false;
    int crossings = 0;
    for (int p = 2; p * p <= n; ++p) {
        if (is_candidate[p]) {
            for (int m = p * p; m <= n; m += p) {
                is_candidate[m] = false;
                ++crossings;
            }
        }
    }
    std::vector<int> primes;
    for (int k = 0; k <= n; ++k) {
        if (is_candidate[k]) primes.push_back(k);
    }
    std::cout << "primes up to 49:";
    for (int k : primes) std::cout << " " << k;
    std::cout << "\\n";
    std::cout << "count: " << primes.size() << "\\n";
    std::cout << "crossings: " << crossings << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The work is the number of crossings. Each prime p crosses out about n ÷ p numbers, so the total is about n × (1/2 + 1/3 + 1/5 + 1/7 + ...), summed over the primes. That sum of reciprocals grows very slowly, like ln ln n, which gives O(n log log n). For n of a billion, ln ln n is about 3.',
    cases: [
      { case: 'Every input', time: 'O(n log log n)', when: 'The work depends only on n. There is no lucky or unlucky input, because the same numbers are crossed out whatever happens.' },
      { case: 'Shortcuts off', time: 'O(n log log n)', when: 'Starting at 2p and trying every p up to n has the same growth, with a constant factor more crossings.' },
      { case: 'Linear sieve', time: 'O(n)', when: 'A different algorithm that crosses out each composite exactly once, by its smallest prime factor, at the cost of storing the list of primes as it goes.' },
    ],
    space: 'O(n): one mark per number. With one bit per number and only the odd numbers stored, a limit of one billion needs about 60 megabytes.',
    memory: 'Memory is the practical limit, and memory access is the practical cost. Crossing out the multiples of a large prime jumps through the array in big strides, and each jump lands in a part of memory that is not in the processor\'s cache. The segmented sieve fixes this by working through the range in blocks that fit in the cache, and needs only O(√n) memory beyond the block.',
    tradeoffs: 'The sieve trades memory for speed. It finds all primes up to n in close to linear time but needs a mark for every number in the range. Testing numbers one at a time needs almost no memory but repeats work. Which is better depends on whether you want many primes in a range or the verdict on a single number.',
    assumptions: [
      'Reading or writing one mark, and adding two numbers below n, each take constant time.',
      'The count is of crossings (inner-loop steps), including repeated crossings of the same number.',
      'The bound O(n log log n) uses the fact that the sum of 1/p over the primes up to n is ln ln n plus a bounded amount (Mertens, 1874).',
      'The whole array of marks fits in memory.',
    ],
  },

  tradeoffs: {
    excels: [
      'Producing every prime up to a limit, for limits up to around a billion on ordinary hardware and well beyond with segmentation.',
      'Answering many primality questions about small numbers: after one sieve, each answer is a single lookup.',
      'Tables related to factorization, such as the smallest prime factor of every number up to n, with a small change to the same loop.',
    ],
    struggles: [
      'Testing one large number. The memory needed grows with the number itself, not with its number of digits.',
      'Finding primes in a short interval far from zero, unless the segmented variant is used.',
      'Limits so large that the array of marks does not fit in memory.',
    ],
    pitfalls: [
      'Crossing out p itself by starting the inner loop at p.',
      'Missing the square of a prime by using < where ≤ is needed.',
      'Integer overflow in p × p for limits near the top of the integer range.',
      'Allocating a full byte, or more, per number when a bit would do, and running out of memory.',
    ],
    misunderstandings: [
      '"The sieve tests each number to see whether it is prime." It tests nothing. It removes multiples, and the primes are what is left over. No division is ever performed.',
      '"You have to cross out the multiples of every number." Only primes need a pass, and only primes up to the square root of the limit. For a limit of 100 that is 2, 3, 5 and 7.',
      '"It can check whether a huge number is prime." It needs memory for every number up to that one. Testing a single number with hundreds of digits takes quite different methods.',
      '"1 is a prime number." By the modern definition a prime has exactly two divisors, and 1 has one. The sieve starts at 2.',
    ],
    constraints: [
      'Real implementations sieve in cache-sized segments, store only odd numbers (or only numbers not divisible by 2, 3 or 5), and use one bit per number.',
      'When only a count of primes is wanted for very large n, specialised counting methods are used, since even listing the primes would take too long.',
    ],
    alternatives: [
      { name: 'Trial division', when: 'You need to test one modest-sized number, or only a few: divide by every number up to its square root.' },
      { name: 'Miller-Rabin primality test', when: 'You need to test a single very large number, as in cryptography.' },
      { name: 'Segmented sieve', when: 'The limit is too large for one array, or you want primes in an interval far from zero.' },
      { name: 'Linear sieve', when: 'You also want the smallest prime factor of every number, and want each composite touched exactly once.' },
    ],
    comparison: {
      columns: ['', 'Sieve of Eratosthenes', 'Trial division of each number', 'Segmented sieve'],
      rows: [
        ['All primes up to n', 'O(n log log n)', 'About O(n√n / log n)', 'O(n log log n)'],
        ['Memory', 'O(n)', 'O(1)', 'O(√n) plus one block'],
        ['Uses division', 'No', 'Yes, constantly', 'Only to position each prime in a block'],
        ['Tests a single large number', 'No', 'Slowly', 'No'],
      ],
    },
  },

  applications: [
    { title: 'Tables of small primes', status: 'established', text: 'Number theory software and many other programs need the primes below some bound, for factoring by trial division, for hashing, or for further computations. A sieve run once at startup is the usual way to get them.' },
    { title: 'Filtering candidates for large primes', status: 'established', text: 'When a cryptographic library needs a large random prime, it first rejects candidates divisible by any of a list of small primes, and only then runs an expensive primality test. The list of small primes comes from a sieve.' },
    { title: 'Sieving in integer factorization', status: 'established', text: 'The quadratic sieve and number field sieve factoring algorithms borrow the central trick: instead of testing numbers one by one for divisibility by small primes, step through an array in strides of each prime and mark every position it divides.' },
    { title: 'Tables of arithmetic functions', status: 'established', text: 'The same loop, recording which prime crossed out each number, gives the smallest prime factor of every number up to n. From that, the full factorization of any number in the range, and functions such as Euler\'s totient, can be read off quickly.' },
    { title: 'Puzzle and contest programming', status: 'illustrative', text: 'Problems that ask about primes below a few million, such as sums of primes or counts of numbers with a given number of divisors, are routinely solved by sieving first and then answering from the table.' },
  ],

  connections: [
    { to: 'euclidean-algorithm', type: 'related', why: 'Both are ancient Greek algorithms about divisibility that avoid factoring: Euclid finds what two numbers share by remainders, and the sieve finds primes by removing multiples.' },
    { to: 'modular-exponentiation', type: 'advanced', why: 'A sieve cannot test one huge number. Primality tests for large numbers are built on modular exponentiation, with a sieve of small primes used only as a first filter.' },
    { to: 'rsa', type: 'application', why: 'RSA keys are built from large primes. Candidates are first screened against small primes from a sieve, which cheaply removes most composites.' },
    { to: 'counting-sort', type: 'related', why: 'Both use an array indexed by the values themselves and do their work by stepping through it, with no comparisons between items.' },
    { to: 'concept:prime-numbers', type: 'prerequisite', why: 'The method rests on one fact about primes: every composite number has a prime factor no larger than its square root.' },
    { to: 'concept:array', type: 'prerequisite', why: 'The sieve is an array of marks indexed by number, visited in equal strides.' },
    { to: 'concept:brute-force', type: 'related', why: 'Trial division of every number is the brute-force way to list primes. The sieve gets the same list by reorganising the work around primes instead of around candidates.' },
    { to: 'concept:big-o', type: 'related', why: 'Its running time, n log log n, is a rare example of a bound between linear and n log n, and shows how slowly an iterated logarithm grows.' },
    { to: 'discipline:cryptography', type: 'application', why: 'Generating keys means finding large primes, and sieved tables of small primes make that search several times faster.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'When crossing out the multiples of 7, why is it safe to start at 49 and not at 14?',
      options: [
        'Because 14, 21, 28, 35 and 42 are prime',
        'Because 14, 21, 28, 35 and 42 each have a prime factor smaller than 7, so they were crossed out in earlier passes',
        'Because multiples below 49 are too small to matter',
        'Because 49 is the first odd multiple of 7',
      ],
      answer: 1,
      explain: [
        'None of them is prime. Each is 7 times a smaller number.',
        'Correct. They are 2 × 7, 3 × 7, 4 × 7, 5 × 7 and 6 × 7, and the smaller factor in each has a prime factor of 2, 3 or 5, whose pass has already removed it.',
        'They matter, and they must be crossed out. The point is that they already have been.',
        '21 and 35 are odd multiples of 7 and come before 49.',
      ],
    },
    {
      type: 'predict',
      q: 'With a limit of 130 and both shortcuts on, which is the largest prime whose multiples get crossed out?',
      options: ['7', '11', '13', '127'],
      answer: 1,
      explain: [
        '7 is the last prime used for a limit of 100. With a limit of 130 the square of the next prime, 11 × 11 = 121, fits as well.',
        'Correct. 11 × 11 = 121 is at most 130, so 11 takes a turn. It crosses out 121 and nothing else, since the next multiple, 132, is past the limit. The next prime is 13, and 13 × 13 = 169 is past 130 too.',
        '13 × 13 = 169 is past the limit, so 13 never takes a turn. Its multiples up to 130, such as 26, 39, 65 and 91, each have a smaller prime factor and were crossed out by 2, 3, 5 or 7.',
        '127 is the largest prime up to 130, but it crosses nothing out. Its first multiple is 254.',
      ],
      tryInput: { n: 130, optimized: true },
      check: (r) => (r.sievingPrimes.join(',') === '2,3,5,7,11' && r.primes[r.primes.length - 1] === 127 && matchesTrialDivision(r) === true) || `primes used ${r.sievingPrimes.join(',')}`,
    },
    {
      type: 'debug',
      q: 'This sieve reports that there are no primes at all. What is wrong?',
      code: `def sieve(n):
    is_candidate = [True] * (n + 1)
    for p in range(2, n + 1):
        if is_candidate[p]:
            for m in range(p, n + 1, p):
                is_candidate[m] = False
    return [k for k in range(2, n + 1) if is_candidate[k]]`,
      options: [
        'Line 2: the list should have n entries, not n + 1',
        'Line 3: p should start at 1',
        'Line 5: the inner loop starts at p, so it crosses out the prime itself; it should start at p * p or 2 * p',
        'Line 7: the result should include 1',
      ],
      answer: 2,
      explain: [
        'n + 1 entries are needed so that index n exists.',
        'Starting at 1 would cross out every number as a multiple of 1.',
        'Correct. `range(p, ...)` begins with p, so every prime crosses itself out the moment it is found. The first number to cross out is the first proper multiple.',
        '1 is not prime. The range correctly starts at 2.',
      ],
    },
    {
      type: 'choice',
      q: 'You need to know whether one particular 40-digit number is prime. Why is the sieve of Eratosthenes the wrong tool?',
      options: [
        'It only works for limits below 1,000',
        'It would need a mark for every number up to that 40-digit number, far more memory than exists',
        'It gives wrong answers for large numbers',
        'It cannot handle odd numbers',
      ],
      answer: 1,
      explain: [
        'There is no such restriction. Sieving up to a billion is routine.',
        'Correct. The sieve works on the whole range from 2 up to the limit. A 40-digit limit means about 10 to the power 40 marks. Tests for single numbers work with the digits of the number instead.',
        'It is exact for any limit. The obstacle is cost, not correctness.',
        'It handles all numbers. Many implementations store only the odd ones to save space.',
      ],
    },
    {
      type: 'challenge',
      title: 'Smallest prime factors',
      prompt: 'Change the sieve so that instead of a true-or-false mark it stores, for every number from 2 to n, the smallest prime that divides it. A prime stores itself. Then write a function that uses this table to print the prime factorization of any number up to n without doing any trial division, for example 360 = 2 × 2 × 2 × 3 × 3 × 5. Build the table for n = 1,000,000. Use it to factor 999,999 and 1,000,000, and count how many numbers in the table store themselves.',
      expect: 'The table entry for 999,999 is 3, and 999,999 = 3 × 3 × 3 × 7 × 11 × 13 × 37. The entry for 1,000,000 is 2, and its factorization is six 2s and six 5s. Exactly 78,498 numbers store themselves: those are the primes up to 1,000,000, and the largest is 999,983.',
      hints: [
        'When p crosses out m, record p only if m has no entry yet. Because primes are processed in increasing order, the first one to reach m is its smallest prime factor.',
        'To factor m, look up its smallest prime factor q, output q, replace m by m ÷ q, and repeat until m is 1.',
        'With the p × p shortcut, numbers that are never crossed out are prime: give them themselves as their entry.',
      ],
    },
  ],

  compare: {
    idea: 'Cross out the multiples of each prime in turn; what is never crossed out is prime.',
    requires: 'A limit small enough that one mark for each number fits in memory. The result is exact.',
    sensitivity: 'None. The work depends only on the limit.',
    memory: 'O(n): one mark, ideally one bit, per number up to the limit.',
    difficulty: 'low',
    difficultyNote: 'Two nested loops. The usual errors are the starting point of the inner loop and the stopping test of the outer one.',
    limits: 'Memory grows with the limit, so it cannot test a single very large number.',
    useWhen: 'You want every prime up to a limit, or to look up many numbers below it.',
  },

  advanced: {
    history: 'The method is credited to Eratosthenes of Cyrene, a Greek scholar of the third century BC who was head of the library at Alexandria and is also remembered for estimating the circumference of the Earth. None of his own writing on it survives. The earliest description that does is in the *Introduction to Arithmetic* of Nicomachus of Gerasa, written around 100 AD, which names the method the sieve and attributes it to him. The running time was understood much later: the estimate n log log n follows from Franz Mertens\'s 1874 theorem on the sum of the reciprocals of the primes.',
    derivation: 'Count the crossings. A prime $p \\le \\sqrt n$ crosses out the multiples $p^2, p^2 + p, \\dots$ up to $n$, which is at most $n/p$ numbers. So the total number of crossings is at most\n\n$$\\sum_{p \\le \\sqrt n} \\frac{n}{p} = n \\sum_{p \\le \\sqrt n} \\frac{1}{p}.$$\n\nMertens\'s second theorem says that the sum of the reciprocals of the primes up to $x$ is\n\n$$\\sum_{p \\le x} \\frac{1}{p} = \\ln\\ln x + M + o(1), \\qquad M \\approx 0.2615.$$\n\nTaking $x = \\sqrt n$ gives $\\ln\\ln\\sqrt n = \\ln\\ln n - \\ln 2$, so the number of crossings is $n \\ln\\ln n + O(n)$. The outer loop adds $O(\\sqrt n)$ steps and the final pass that collects the primes adds $O(n)$, so the running time is $O(n \\log\\log n)$.',
    proof: 'Why a composite $m \\le n$ has a prime factor at most $\\sqrt n$. Write $m = a \\times b$ with $1 < a \\le b$. If $a > \\sqrt m$ then $a \\times b > \\sqrt m \\times \\sqrt m = m$, a contradiction, so $a \\le \\sqrt m \\le \\sqrt n$. Any prime factor of $a$ is a prime factor of $m$ and is at most $a$. Why starting at $p^2$ loses nothing: a multiple $k \\times p$ with $2 \\le k < p$ has a prime factor $q \\le k < p$ (any prime factor of $k$), and it is a multiple of $q$ that is at least $q^2$, because $k \\times p > q \\times q$. By induction on the primes in increasing order it was crossed out in the pass for $q$ or earlier.',
    complexityProof: 'A matching lower bound for this algorithm: the prime $p$ makes $\\lfloor (n - p^2)/p \\rfloor + 1 \\ge n/p - p$ crossings, so the total is at least $n\\sum_{p \\le \\sqrt n} 1/p - \\sum_{p \\le \\sqrt n} p$. The second sum is $O(n/\\log n)$, so the total is $n\\ln\\ln n - O(n)$, and the count is $\\Theta(n\\log\\log n)$. The repeats are what keep it above linear: a number is crossed out once for each of its prime factors $p$ with $p^2$ at most the number, and the linear sieve reaches $O(n)$ by arranging that each composite is crossed out only by its smallest prime factor.',
    variants: [
      { name: 'Odds-only and wheel sieves', text: 'Store and visit only odd numbers, or only numbers not divisible by 2, 3 or 5. This removes most of the cheap crossings and shrinks the array by a constant factor.' },
      { name: 'Segmented sieve', text: 'First sieve the primes up to √n, then process the range in blocks that fit in the processor cache, crossing out within each block. Memory drops to O(√n) and speed improves greatly for large n.' },
      { name: 'Linear sieve', text: 'Keeps the list of primes found so far and crosses out each composite exactly once, as its smallest prime factor times a cofactor. O(n) time, and it yields the smallest prime factor of every number.' },
      { name: 'Sieve of Atkin', text: 'A sieve based on counting solutions of quadratic forms, introduced by Atkin and Bernstein. It has a slightly better asymptotic operation count but is rarely faster in practice than a well-tuned segmented sieve.' },
      { name: 'Incremental sieves', text: 'Produce primes one after another without fixing a limit in advance, by remembering for each prime found the next multiple it will cross out.' },
    ],
    implementation: 'Use a bit array. Handle 2 separately and sieve only odd numbers, stepping by 2p. Segment the range to fit the cache. Guard the stopping test against overflow by comparing p with n ÷ p, or use 64-bit arithmetic. Do not test "already crossed out?" before writing.',
    benchmarking: 'Crossings are a machine-independent measure, but real speed on large limits is governed by cache behaviour, so a segmented sieve with the same number of crossings can be several times faster. When comparing implementations, state whether even numbers are stored and whether the sieve is segmented.',
    references: [
      { authors: 'Nicomachus of Gerasa', year: 'c. 100 AD', title: 'Introduction to Arithmetic, Book I, chapter 13', venue: 'English translation by M. L. D\'Ooge, Macmillan, 1926' },
      { authors: 'F. Mertens', year: 1874, title: 'Ein Beitrag zur analytischen Zahlentheorie', venue: 'Journal für die reine und angewandte Mathematik 78, 46-62' },
      { authors: 'A. O. L. Atkin and D. J. Bernstein', year: 2004, title: 'Prime sieves using binary quadratic forms', venue: 'Mathematics of Computation 73(246), 1023-1030' },
      { authors: 'R. Crandall and C. Pomerance', year: 2005, title: 'Prime Numbers: A Computational Perspective (2nd edition), chapter 3', venue: 'Springer' },
    ],
    furtherReading: [
      'G. H. Hardy and E. M. Wright, *An Introduction to the Theory of Numbers*, for Mertens\'s theorems and the distribution of primes.',
      'M. E. O\'Neill, "The Genuine Sieve of Eratosthenes", *Journal of Functional Programming* 19(1), 2009, on what does and does not count as this algorithm.',
    ],
  },

  tests: [
    { name: 'matches trial division up to 200', input: { n: 200, optimized: true },
      check: (r) => { const ok = matchesTrialDivision(r); return ok !== true ? ok : r.count === 46 || `expected 46 primes, got ${r.count}`; } },
    { name: 'matches trial division with the shortcuts off', input: { n: 170, optimized: false }, check: matchesTrialDivision },
    { name: 'there are 25 primes up to 100, found with 104 crossings using 2, 3, 5 and 7', input: { n: 100, optimized: true },
      check: (r, c) => (r.count === 25 && c.crossings === 104 && r.sievingPrimes.join(',') === '2,3,5,7') || `count ${r.count}, crossings ${c.crossings}, primes used ${r.sievingPrimes.join(',')}` },
    { name: 'without the shortcuts, 100 takes 146 crossings and gives the same primes', input: { n: 100, optimized: false },
      check: (r, c) => (matchesTrialDivision(r) === true && r.count === 25 && c.crossings === 146) || `count ${r.count}, crossings ${c.crossings}` },
    { name: 'the worked example: 10 primes up to 30 with 24 crossings', input: { n: 30, optimized: true },
      check: (r, c) => (r.primes.join(',') === '2,3,5,7,11,13,17,19,23,29' && c.crossings === 24 && r.sievingPrimes.join(',') === '2,3,5') || `primes ${r.primes.join(',')}, crossings ${c.crossings}` },
    { name: 'the predict question: with limit 130 the last prime used is 11, which crosses out only 121', input: { n: 130, optimized: true },
      check: (r, c) => (matchesTrialDivision(r) === true && r.sievingPrimes.join(',') === '2,3,5,7,11' && r.count === 31 && c.crossings === 140 && 11 * 12 > 130) || `primes used ${r.sievingPrimes.join(',')}, crossings ${c.crossings}` },
    { name: 'the code sample: 15 primes up to 49 with 43 crossings', input: { n: 49, optimized: true },
      check: (r, c) => (r.count === 15 && c.crossings === 43 && r.sievingPrimes.join(',') === '2,3,5,7') || `count ${r.count}, crossings ${c.crossings}` },
    { name: 'things to try: up to 100, 30 of the 104 crossings are repeats, 15 of them among the 31 in the pass for 3', input: { n: 100, optimized: true },
      check: (r, c) => {
        const composites = r.n - 1 - r.count;
        let visited = 0, even = 0;
        for (let m = 9; m <= 100; m += 3) { visited++; if (m % 2 === 0) even++; }
        return (composites === 74 && c.crossings - composites === 30 && visited === 31 && even === 15) || `${composites} composites, ${c.crossings} crossings, ${even} of ${visited}`;
      } },
    { name: 'things to try: without the shortcuts 15 primes do the crossing out', input: { n: 100, optimized: false },
      check: (r) => r.sievingPrimes.length === 15 || `${r.sievingPrimes.length} primes used` },
    { name: 'with limit 50 the last prime used is 7', input: { n: 50, optimized: true },
      check: (r) => (r.sievingPrimes[r.sievingPrimes.length - 1] === 7 && r.count === 15) || `last prime used ${r.sievingPrimes[r.sievingPrimes.length - 1]}` },
    { name: 'the try-this case: limit 200 uses primes up to 13', input: { n: 200, optimized: true },
      check: (r, c) => (r.sievingPrimes[r.sievingPrimes.length - 1] === 13 && c.crossings === 232) || `last prime ${r.sievingPrimes[r.sievingPrimes.length - 1]}, crossings ${c.crossings}` },
    { name: 'a limit that is the square of a prime: 49 is crossed out', input: { n: 49, optimized: true },
      check: (r) => (!r.primes.includes(49) && r.count === 15) || `49 reported prime, or count ${r.count}` },
    { name: 'the smallest limit on the slider, shortcuts off', input: { n: 20, optimized: false },
      check: (r) => (r.primes.join(',') === '2,3,5,7,11,13,17,19') || `primes ${r.primes.join(',')}` },
  ],
};
