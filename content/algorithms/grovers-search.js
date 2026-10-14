import { makeRng } from '../../js/lib/rng.js';

// A classical simulation of Grover's search. It stores all N = 2^n amplitudes and updates each
// one at every step, so its cost grows exponentially with the number of qubits n. A quantum
// computer would not do this arithmetic at all: the amplitudes would be the physical state of
// its qubits. With one marked item the amplitudes stay real numbers throughout, so no complex
// arithmetic is needed here.

const QUIET = { count() {}, frame() {} };   // a tracer that records nothing, used by the tests
const f4 = (v) => { const s = (Math.abs(v) < 5e-5 ? 0 : v).toFixed(4); return s.replace(/\.?0+$/, '') || '0'; };
const pc = (p) => `${(100 * p).toFixed(1)}%`;

// The number of rounds that brings the marked item closest to certainty on the first rise:
// the whole number nearest to π/(4θ) − 1/2, where sin θ = 1/√N. It is about (π/4)·√N.
const angle = (N) => Math.asin(1 / Math.sqrt(N));
const bestRounds = (N) => Math.max(0, Math.round(Math.PI / (4 * angle(N)) - 0.5));
const predicted = (N, k) => Math.sin((2 * k + 1) * angle(N)) ** 2;

function run(input, t) {
  const n = Math.max(1, Math.round(input.qubits));
  const N = 2 ** n;
  const asked = Math.max(0, Math.floor(input.marked));
  const marked = Math.min(asked, N - 1);
  const best = bestRounds(N);
  const K = input.iterations > 0 ? Math.floor(input.iterations) : best;
  const theta = angle(N);

  const a = new Float64Array(N).fill(1 / Math.sqrt(N));
  const probs = [a[marked] ** 2];
  const norms = [1];
  const other = () => a[marked === 0 ? 1 : 0];
  const total = () => { let s = 0; for (let i = 0; i < N; i++) s += a[i] * a[i]; return s; };

  const views = ({ mean, done, outcome } = {}) => {
    const xs = Array.from({ length: N }, (_, i) => i);
    const roles = { [marked]: 'target' };
    if (outcome !== undefined && outcome !== marked) roles[outcome] = 'active';
    const layers = [
      { type: 'line', points: [[-0.8, 0], [N - 0.2, 0]], role: 'faint', width: 1 },
      { type: 'bars', xs, heights: Array.from(a), barWidth: 0.72, role: 'moss', roles },
    ];
    if (mean !== undefined) {
      layers.push({ type: 'line', points: [[-0.8, mean], [N - 0.2, mean]], role: 'ochre', width: 1.6, dash: [6, 4] });
      layers.push({ type: 'text', at: [N - 0.35, -0.96], text: `dashed line: mean = ${f4(mean)}`, role: 'ochre', align: 'right' });
    }
    const top = a[marked];
    layers.push({ type: 'text', at: [marked, top], text: `P = ${pc(top * top)}`, role: 'target', align: marked > N * 0.75 ? 'right' : marked < N * 0.25 ? 'left' : 'center', dy: top >= 0 ? -7 : 16 });
    const span = Math.max(K, best + 2, 4);
    const curve = Array.from({ length: 121 }, (_, i) => { const x = (span * i) / 120; return [x, Math.sin((2 * x + 1) * theta) ** 2]; });
    const shown = probs.slice(0, done + 1).map((p, k) => [k, p]);
    return [
      { kind: 'scene', title: `Amplitudes of the ${N} items`, x: [-0.8, N - 0.2], y: [-1.1, 1.25], aspect: 0.46, axes: { xLabel: `item (0 to ${N - 1})`, yLabel: 'amplitude' }, layers,
        legend: [{ label: 'marked item', role: 'target' }, { label: 'every other item', role: 'moss' }, { label: 'mean of all amplitudes (dashed)', role: 'ochre' }].concat(outcome !== undefined && outcome !== marked ? [{ label: 'item this measurement returned', role: 'active' }] : []) },
      { kind: 'scene', title: 'Chance of measuring the marked item, by round', x: [-0.4, span + 0.4], y: [0, 1.08], aspect: 0.2, axes: { xLabel: 'rounds completed (one oracle call each)' },
        layers: [
          { type: 'line', points: curve, role: 'faint', width: 1.2, dash: [3, 4] },
          { type: 'line', points: [[best, 0], [best, 1.08]], role: 'faint', width: 1 },
          { type: 'text', at: [best, 0.08], text: `best: ${best}`, role: 'muted', align: 'left', dx: 5, size: 10.5 },
          { type: 'line', points: shown, role: 'target', width: 2 },
          { type: 'points', points: shown, role: 'target', r: 3.6 },
        ],
        legend: [{ label: 'this simulation', role: 'target' }, { label: 'predicted: sin² of (2k + 1)θ (dashed)', role: 'faint' }] },
    ];
  };

  t.frame(() => ({
    line: [0, 1],
    note: `${n} qubits can label N = ${N} items, numbered 0 to ${N - 1}. Item **${marked}** is the marked one${asked !== marked ? ` (item ${asked} does not exist at this size, so the last item is used)` : ''}. Each bar is one item's **amplitude**. Start with all of them equal to 1/√${N} = ${f4(a[0])}. Measured now, every item would come up with chance ${f4(a[0])} × ${f4(a[0])} = ${pc(probs[0])}: a blind guess.`,
    views: views({ done: 0 }),
    vars: { N, 'marked item': marked, 'planned rounds': K, 'P(marked)': pc(probs[0]) },
  }));

  for (let k = 1; k <= K; k++) {
    // Oracle: flip the sign of the marked item's amplitude. This is the one "look" at the problem.
    const wasMarked = a[marked];
    a[marked] = -a[marked];
    t.count('oracle calls');
    t.frame(() => ({
      line: 3,
      note: `Round ${k}, the **oracle**. It is the test that recognizes the right answer, built so that it flips the sign of that item's amplitude: ${f4(wasMarked)} becomes ${f4(a[marked])}. Nothing else changes. The chances are the same as before, because a number and its negative have the same square, so measuring now would gain nothing.`,
      views: views({ done: k - 1 }),
      vars: { round: `${k} of ${K}`, 'marked amplitude': f4(a[marked]), 'other amplitudes': f4(other()), 'P(marked)': pc(a[marked] ** 2) },
    }));

    // Diffusion, part 1: the mean of all amplitudes.
    let sum = 0;
    for (let i = 0; i < N; i++) sum += a[i];
    const mean = sum / N;
    t.frame(() => ({
      line: 4,
      note: `**Diffusion**, first half: take the mean of all ${N} amplitudes. It is ${f4(mean)}, drawn as the dashed line. The sign flip has pulled the mean down a little, so the ${N - 1} unmarked bars now stand ${other() >= mean ? 'just above' : 'below'} it and the marked bar is far below it.`,
      views: views({ mean, done: k - 1 }),
      vars: { round: `${k} of ${K}`, mean: f4(mean), 'marked amplitude': f4(a[marked]), 'other amplitudes': f4(other()) },
    }));

    // Diffusion, part 2: reflect every amplitude about the mean.
    const beforeMarked = a[marked], beforeOther = other();
    for (let i = 0; i < N; i++) a[i] = 2 * mean - a[i];
    const p = a[marked] ** 2;
    probs.push(p);
    norms.push(total());
    t.frame(() => ({
      line: 5,
      note: `Diffusion, second half: replace every amplitude by 2 × mean − itself, its mirror image in the dashed line. The marked item goes from ${f4(beforeMarked)} to **${f4(a[marked])}**. Each other item goes from ${f4(beforeOther)} to ${f4(other())}. The chance of measuring the marked item is now **${pc(p)}**${k > 1 ? (p < probs[k - 1] ? `, down from ${pc(probs[k - 1])}: the amplitudes have gone past their best point` : `, up from ${pc(probs[k - 1])}`) : `, up from ${pc(probs[0])}`}.`,
      views: views({ mean, done: k }),
      vars: { round: `${k} of ${K}`, mean: f4(mean), 'marked amplitude': f4(a[marked]), 'other amplitudes': f4(other()), 'P(marked)': pc(p) },
    }));
  }

  // Measurement: one item comes out, with chance equal to its amplitude squared.
  const rng = makeRng(input.seed || 1);
  const u = rng.next();
  let acc = 0, outcome = N - 1;
  for (let i = 0; i < N; i++) { acc += a[i] * a[i]; if (u < acc) { outcome = i; break; } }
  const finalP = probs[K];
  t.frame(() => ({
    line: 6,
    note: `**Measure.** Each item comes out with chance equal to its amplitude squared, so the marked item has a ${pc(finalP)} chance. This run's random draw gave item **${outcome}**, ${outcome === marked ? 'the marked item' : 'which is not the marked item'}. ${K === best ? `${K} round${K === 1 ? ' is' : 's are'} the best choice for ${N} items.` : `The best number of rounds for ${N} items is ${best}; this run used ${K}.`} A real run would check the answer with one ordinary test and repeat the whole procedure if it were wrong. An ordinary search needs about ${f4((N + 1) / 2)} tests on average.`,
    views: views({ done: K, outcome }),
    vars: { rounds: K, 'P(marked)': pc(finalP), measured: outcome, correct: outcome === marked ? 'yes' : 'no' },
  }));

  return { qubits: n, N, marked, iterations: K, best, theta, probs, norms, amplitudes: Array.from(a), outcome, success: outcome === marked, finalProbability: finalP };
}

export default {
  meta: {
    id: 'grovers-search',
    name: 'Grover\'s Search',
    aliases: ['Grover\'s algorithm', 'quantum search', 'quantum database search', 'amplitude amplification'],
    kind: 'algorithm',
    discipline: 'quantum-computing',
    alsoIn: [
      { id: 'cryptography', why: 'It sets the cost of brute-force key search on a quantum computer, which is why guidance for the post-quantum era doubles symmetric key lengths.' },
      { id: 'physics', why: 'Every step is an operation on a physical quantum state, and the method is a direct use of interference between amplitudes.' },
      { id: 'mathematics', why: 'It is linear algebra: two reflections of a vector compose into a rotation, and the rotation angle fixes the running time.' },
    ],
    subfield: 'Quantum search',
    family: 'Amplitude amplification',
    lab: 'mathematics',
    year: 1996,
    authors: 'Lov K. Grover',
    summary: 'A quantum algorithm that finds one marked item among N with about √N uses of the test that recognizes it, where any classical search needs about N/2.',
    difficulty: 'advanced',
    order: 950,
    paradigms: ['quantum'],
    randomized: true,
    approximate: false,
    time: { best: 'O(√N) oracle calls', average: 'O(√N) oracle calls', worst: 'O(√N) oracle calls', class: 'iterative' },
    space: { worst: 'O(log N) qubits (the classical simulation here stores N numbers)', class: 'logarithmic' },
    tags: {
      problems: ['find one item among many with no order', 'search an unsorted list', 'needle in a haystack', 'brute-force key search', 'quantum speedup'],
      techniques: ['amplitude amplification', 'oracle', 'reflection about the mean', 'interference', 'state vector simulation'],
      applications: ['security', 'scientific computing'],
    },
    prerequisites: ['linear-search', 'concept:superposition', 'concept:probability', 'concept:linear-algebra'],
  },

  bigIdea: {
    simple: "Suppose you have a huge pile of keys and one lock. Only one key fits, and the only way to find out is to try a key in the lock. An ordinary computer tries keys one at a time. On average it gets through half the pile. Grover's search is a method for a quantum computer that needs far fewer tries: for a million keys, about eight hundred. It does not test every key at the same moment. The state of a quantum computer is described by a list of numbers, one for each key, called amplitudes. Nobody can read these numbers directly. When you look at the machine you see just one key, and a key with a bigger number is more likely to be the one you see. Each use of the lock test, followed by one fixed adjustment, makes the right key's number grow and the others shrink. After the right number of rounds, looking gives the right key almost every time. Quantum computers big enough to do this for a useful problem do not exist yet. This page uses an ordinary computer to work out the same numbers.",
    what: 'Grover\'s search finds the one input, out of N, for which a yes-or-no test answers yes, when nothing about the test\'s structure can be exploited. It starts with a quantum state in which every input has the same amplitude. It then repeats two steps: the **oracle**, which flips the sign of the marked input\'s amplitude, and **diffusion**, which reflects every amplitude about their mean. After about (π/4)·√N repetitions, a measurement returns the marked input with high probability.',
    why: 'Lov Grover, at Bell Laboratories, published it in 1996, two years after Peter Shor\'s factoring algorithm. Shor\'s algorithm relies on special structure in its problem. Grover showed that a quantum computer also helps, though less dramatically, with the most structureless problem there is: checking candidates one after another.',
    when: 'It is the right tool, in principle, when the only way to find a solution is to test candidates, each test is cheap to compute, and the candidates need not be stored anywhere. It is not a faster way to look something up in a stored table: loading N items into a quantum computer already takes N steps, and if the data can be sorted or indexed, a classical [binary search](#/algorithm/binary-search) or [hash table](#/algorithm/hash-table) is far better. Today it cannot be used at any useful scale, because the hardware does not exist.',
    interesting: 'The speedup is quadratic, not exponential, and it has been proved that no quantum algorithm can do better for this problem. So Grover\'s search marks a limit as well as an advance: a quantum computer cannot solve search problems by "trying everything at once". Also unusual is that running it for too long makes the answer worse. The probability of success rises, peaks and then falls again.',
    where: 'Its practical effect so far is on paper. It is the reason post-quantum guidance treats a 128-bit symmetric key as offering only about 64 bits of security against a quantum attacker, and recommends 256-bit keys. Its core idea, amplitude amplification, is a subroutine in many other quantum algorithms. It has been run on real devices only for a handful of qubits.',
    analogy: {
      title: 'Turning a dial in equal clicks',
      text: 'Picture a dial with a pointer. Straight up means "certain to see the right answer". Flat means "certain to see a wrong one". At the start the pointer is almost flat, because the right answer is one among many. Each round of the algorithm turns the pointer upward by the same small angle. After enough rounds it points nearly straight up, and that is the moment to look. Keep turning and it swings past the top and back down, so extra rounds make things worse.',
      limits: 'There is no pointer inside the machine. The dial is a summary of a long list of amplitudes, and the turning comes from two operations that make some amplitudes add up and others cancel. Ordinary chances never cancel each other like that, which is why no everyday object behaves this way. You also cannot watch the dial. Looking at a quantum computer gives one answer and destroys the state, so the number of rounds has to be worked out beforehand. And the dial says nothing about cost. Each click needs the test to be built as a quantum circuit and run without errors, which is the hard part in practice.',
    },
  },

  example: {
    setup: "Four boxes are numbered 0, 1, 2 and 3, and box 2 is the one we are looking for. Each box has a number attached, called its amplitude. The chance of seeing a box when you look is its amplitude multiplied by itself. Start with every amplitude at 0.5, so each box has a chance of 0.5 × 0.5 = 0.25, one in four.",
    steps: [
      "The test: flip the sign of the amplitude of the box we want. The amplitudes are now 0.5, 0.5, −0.5, 0.5. The chances have not changed, because −0.5 × −0.5 is still 0.25.",
      "Find the average of the four amplitudes: 0.5 + 0.5 − 0.5 + 0.5 = 1, and 1 ÷ 4 = 0.25.",
      "Mirror each amplitude in the average: replace it by twice the average, minus itself. For boxes 0, 1 and 3 that is 0.5 − 0.5 = 0.",
      "For box 2 it is 0.5 − (−0.5) = 1. The amplitudes are now 0, 0, 1, 0.",
      "Look. The chances are 0, 0, 1 × 1 = 1, and 0. Box 2 is seen with certainty.",
    ],
    result: "One use of the test was enough. An ordinary search opens boxes one at a time and needs 2.5 tests on average if it tests every box it opens. Skipping the last test, since after three wrong boxes the fourth must be the one, brings that to 2.25. Four is a special size: with more boxes the best chance falls a little short of certain, and more rounds are needed.",
    tryInput: { qubits: 2, marked: 2, iterations: 1 },
  },

  terms: [
    { term: "Qubit", meaning: "The basic unit of a quantum computer. A set of n qubits can label 2 × 2 × ... × 2 (n times) different items." },
    { term: "Amplitude", meaning: "A number attached to each possible answer in a quantum state. It can be positive or negative, and it cannot be read directly." },
    { term: "Measurement", meaning: "Looking at the quantum computer. It shows exactly one answer, chosen at random, and the chance of each answer is its amplitude multiplied by itself." },
    { term: "Superposition", meaning: "A state in which more than one answer has an amplitude that is not zero, so a measurement could show any of them." },
    { term: "Oracle", meaning: "The test that recognizes the right answer, built as a quantum operation. It flips the sign of the right answer's amplitude." },
    { term: "Marked item", meaning: "The answer the oracle recognizes: the thing being searched for." },
    { term: "Diffusion", meaning: "The second step of each round. It replaces every amplitude by its mirror image in the average of all the amplitudes." },
    { term: "Interference", meaning: "Amplitudes adding together or cancelling out. It is how the right answer's amplitude grows while the others shrink." },
  ],

  takeaway: "Grover's search does not check every answer at once: it uses about the square root of N checks to make the right answer the one a measurement almost surely shows.",

  viz: {
    describe: 'A bar chart with one bar per item, showing that item\'s amplitude, which can be positive or negative. The marked item\'s bar is brick red and labelled with its current probability; all other bars are moss green. A dashed ochre line shows the mean of all amplitudes during the diffusion step. Below it, a smaller chart plots the probability of measuring the marked item after each round, with the predicted sine-squared curve dashed and a vertical line at the best number of rounds.',
    inputs: [
      { id: 'qubits', type: 'range', label: 'Qubits (n), giving N = 2ⁿ items', min: 2, max: 6, step: 1, default: 4,
        help: 'This page stores all N amplitudes, so every extra qubit doubles its work. That doubling is the reason a classical simulation is no substitute for a quantum computer.' },
      { id: 'marked', type: 'range', label: 'Marked item', min: 0, max: 63, step: 1, default: 5,
        help: 'If the number is larger than N − 1, the last item is used.' },
      { id: 'iterations', type: 'range', label: 'Rounds (0 = the best number for this size)', min: 0, max: 24, step: 1, default: 0,
        help: 'Each round is one oracle call and one diffusion step. Set it past the best number to watch the probability fall again.' },
      { id: 'seed', type: 'seed', label: 'Seed for the final measurement', default: 3 },
    ],
    presets: [
      { label: '16 items, best number of rounds', values: { qubits: 4, marked: 5, iterations: 0 } },
      { label: '4 items: certain after one round', values: { qubits: 2, marked: 2, iterations: 1 } },
      { label: '16 items, twice too many rounds', values: { qubits: 4, marked: 5, iterations: 6 } },
      { label: '64 items, best number of rounds', values: { qubits: 6, marked: 41, iterations: 0 } },
      { label: '64 items, a full rise and fall', values: { qubits: 6, marked: 41, iterations: 13 } },
      { label: '8 items: the best is only 94.5%', values: { qubits: 3, marked: 6, iterations: 0 } },
    ],
    tryThis: [
      { ask: 'Load "16 items, best number of rounds" and step through the first round slowly. Every item starts with a chance of 6.25%. What will the marked item\'s chance be straight after the oracle? And after the diffusion step that follows?',
        reveal: 'After the oracle it is still 6.25%. The oracle turns the marked amplitude from 0.25 into −0.25, and the chance is the amplitude multiplied by itself, so nothing a measurement could show has changed. After diffusion it is 47.3%. The marked bar has grown from 0.25 to 0.6875, and each of the other fifteen has shrunk from 0.25 to 0.1875.' },
      { ask: 'Load "16 items, twice too many rounds". Three rounds is the best number for 16 items, and this preset runs six. What will the marked item\'s chance be at the end?',
        reveal: 'About 2%, lower than the 6.25% it started with. The chance climbs to 96.1% at round 3, drops to 58.2% at round 4 and 12.5% at round 5, and ends at 2.0%. More work gives a worse answer, because each round turns the state by the same angle whether or not it has passed the top.' },
      { ask: 'Leave rounds at 0 and raise the qubits from 2 to 6, one step at a time. Each step doubles the number of items. Does the best number of rounds double as well?',
        reveal: 'No. For 4, 8, 16, 32 and 64 items the best number of rounds is 1, 2, 3, 4 and 6. Sixteen times as many items need only six times as many rounds. The rounds grow with the square root of the number of items, about 1.4 times for each doubling. A search that tests the items one by one doubles its work every time.' },
      { ask: 'Load "8 items: the best is only 94.5%" and run it with the measurement seed set to 1, 2, 3 and so on up to 20. In how many of the 20 runs will the measurement return a wrong item?',
        reveal: 'One. Seed 7 returns item 1, and the other nineteen return item 6. The chance of a wrong item is 5.5% on every run, about one in eighteen, so one miss in 20 is typical, though another 20 seeds could give none or several. Seeds 1 to 60 give four. The algorithm is probabilistic, which is why a real run ends by checking its answer.' },
    ],
    run,
    report: (r, c) => `N = ${r.N} items (${r.qubits} qubits), marked item ${r.marked}.\nAfter ${r.iterations} round${r.iterations === 1 ? '' : 's'} (${c['oracle calls'] || 0} oracle call${r.iterations === 1 ? '' : 's'}) the marked item would be measured with probability ${pc(r.finalProbability)}.\nBest number of rounds for this size: ${r.best}. A classical search needs about ${f4((r.N + 1) / 2)} tests on average.\nThis run's measurement returned item ${r.outcome} (${r.success ? 'correct' : 'wrong'}).\nThis was a classical simulation that updated all ${r.N} amplitudes in every round.`,
    experiment: {
      title: 'Oracle calls needed as the number of items grows',
      note: 'Each point is a real run of this page\'s simulation at the best number of rounds for that size, counting oracle calls. The upper curve is not measured: it is the average number of tests a classical search needs, (N + 1)/2. What is counted is calls to the test only. The simulation itself does far more arithmetic than a classical search, because it updates all N amplitudes in every round.',
      metric: 'oracle calls',
      metricLabel: 'Oracle calls (tests of a candidate)',
      sizeLabel: 'Number of items (N)',
      sizes: [4, 16, 64, 256, 1024, 4096],
      variants: [{ id: 'grover', label: 'Grover\'s search (simulated)' }],
      input: (N, variant, seed) => ({ qubits: Math.log2(N), marked: 1, iterations: 0, seed }),
      theory: [
        { label: '(π/4)·√N', fn: (N) => (Math.PI / 4) * Math.sqrt(N) },
        { label: 'classical average, (N + 1)/2', fn: (N) => (N + 1) / 2, reference: true },
      ],
    },
  },

  logic: {
    intuition: 'Think of the amplitudes as a row of bars. All the unmarked bars are always the same height, so only two numbers matter: the height of the marked bar and the height of the rest. The oracle turns the marked bar upside down, which lowers the average slightly. Mirroring every bar in that lowered average then pushes the unmarked bars down a little and throws the upside-down marked bar far above the line. Each round repeats the trick, and the marked bar gains a nearly constant amount each time, until it holds almost all of the available height.',
    steps: [
      'Use n qubits to label N = 2ⁿ candidate answers, and put them in the state where every candidate has amplitude 1/√N.',
      'Apply the oracle: it multiplies the amplitude of the marked candidate by −1 and leaves the others alone. This is one use of the test.',
      'Apply diffusion: compute the mean m of all amplitudes and replace each amplitude a by 2m − a.',
      'Repeat steps 2 and 3. The best number of repetitions is the whole number nearest to π/(4θ) − 1/2, where sin θ = 1/√N. For large N that is about (π/4)·√N.',
      'Measure. The marked candidate appears with probability sin²((2k + 1)θ) after k rounds.',
      'Check the result with one ordinary use of the test. If it is wrong, start again.',
    ],
    pseudocode: [
      'grover(N, f, k):',
      '  all a[x] ← 1/√N',
      '  repeat k times:',
      '    oracle: negate a[marked]',
      '    m ← mean of all a[x]',
      '    all a[x] ← 2m − a[x]',
      '  measure x, chance a[x]²',
      '',
      'marked: the x with f(x) = 1',
      'best k ≈ (π/4)·√N',
    ],
    decisions: [
      { title: 'How many rounds?', text: 'Too few and the marked amplitude is still small. Too many and it has passed its peak. With one marked item among N the best count is the whole number nearest to π/(4θ) − 1/2, with sin θ = 1/√N. If the number of marked items is not known in advance, this count cannot be computed, and a modified procedure that tries increasing numbers of rounds is needed.' },
      { title: 'What is the oracle, really?', text: 'It is not a lookup in a stored list. It is a quantum circuit that computes the yes-or-no test on whatever input it is given, and flips the sign when the answer is yes. Building that circuit is the real cost of each round, and the algorithm is only worthwhile when the test is something that can be computed, such as "does this key decrypt the message?"' },
      { title: 'Why simulate with real numbers?', text: 'Amplitudes are complex numbers in general. In this algorithm, with this starting state, they stay real, so the simulation on this page needs only ordinary signed numbers. That is a property of Grover\'s search and not of quantum computing as a whole.' },
    ],
    invariants: [
      'The squares of the amplitudes always add up to 1, because both steps are reflections and reflections preserve length.',
      'All unmarked items have the same amplitude at every moment.',
      'After k rounds the marked item has amplitude sin((2k + 1)θ) and each unmarked item has amplitude cos((2k + 1)θ)/√(N − 1), where sin θ = 1/√N.',
    ],
    edgeCases: [
      'N = 4: one round gives the marked item with certainty. With a single marked item, this is the only size above 1 where the peak is exactly 100%.',
      'N = 2: the probability stays at one half however many rounds are run. The method gives no advantage.',
      'Too many rounds: the probability falls again. At about twice the best count it is close to zero.',
      'Several marked items: with M of them the angle is given by sin θ = √(M/N) and fewer rounds are needed, about (π/4)·√(N/M). Running the count meant for one marked item overshoots.',
      'Half the items marked: every round leaves the probability at exactly one half.',
      'No marked item: the oracle does nothing, diffusion leaves the uniform state unchanged, and the measurement returns a random item. The final check catches this.',
      'A noisy machine: errors in the operations spoil the interference. The analysis here assumes perfect operations.',
    ],
    correctness: 'Because all unmarked amplitudes stay equal, the state is described by two numbers, and it is convenient to write it with an angle: marked amplitude sin φ, total unmarked weight cos φ. At the start sin φ = 1/√N, so φ = θ. The oracle changes the sign of the marked amplitude, which reflects the state across the "unmarked" direction and sends φ to −φ. Diffusion replaces each amplitude by 2m − a, which is a reflection across the starting state at angle θ and sends an angle ψ to 2θ − ψ. Together they send φ to 2θ + φ. One round is therefore a rotation by 2θ, and after k rounds φ = (2k + 1)θ. The probability of measuring the marked item is sin²((2k + 1)θ). This is largest when (2k + 1)θ is closest to a quarter turn, π/2, which gives k ≈ π/(4θ) − 1/2. Since θ is about 1/√N for large N, that is about (π/4)·√N rounds, and at that point the probability is at least 1 − 1/N.',
    mistakes: [
      'Describing the algorithm as trying every answer at once. The oracle acts on the whole state, but a measurement returns one item, and without the diffusion step that item is no more likely to be right than a guess.',
      'Running more rounds "to be safe". Past the peak, each extra round lowers the chance of success.',
      'Using round(π/4·√N) for small N. For N = 4 that gives 2 rounds, where 1 is exact and 2 drops the probability back to 25%.',
      'Reflecting about the mean with `mean − a` in place of `2·mean − a`, which does not preserve total probability.',
      'Counting the simulation\'s speed as evidence about the quantum algorithm. The simulation does N arithmetic updates per round; the quantum cost is counted in oracle calls and gates.',
      'Treating it as a way to search a stored database quickly. The data would first have to be made available to the quantum computer, which itself takes time proportional to N.',
    ],
  },

  code: {
    sample: {
      input: 'Eight items (three qubits) with item 5 marked. Print the marked item\'s amplitude, its probability and the total probability after 0 to 4 rounds.',
      expected: 'rounds=0 amplitude=0.354 probability=0.125 total=1.000\nrounds=1 amplitude=0.884 probability=0.781 total=1.000\nrounds=2 amplitude=0.972 probability=0.945 total=1.000\nrounds=3 amplitude=0.575 probability=0.330 total=1.000\nrounds=4 amplitude=-0.110 probability=0.012 total=1.000\nbest number of rounds: 2\npredicted probability there: 0.945',
    },
    breakIt: [
      { change: 'In the diffusion line, change `2 * mean - x` to `mean - x`. Watch the last column. What will `total` be after one round, and after four?',
        find: { python: 'a = [2 * mean - x for x in a]', javascript: 'a = a.map((x) => 2 * mean - x);' },
        replace: { python: 'a = [mean - x for x in a]', javascript: 'a = a.map((x) => mean - x);' },
        reveal: 'The total drops to 0.437 after one round and goes on falling: 0.246, 0.138, then 0.078 after four. It should be 1.000 on every line. The probability column never gets above 0.383. Without the factor 2 the step is not a mirror image. It shrinks the state, so the squares stop adding up to 1 and the numbers are no longer probabilities of anything. The last two lines still say 2 rounds and 0.945, because they come from the formula and not from the simulation.' },
      { change: 'Take the diffusion step out. In the same line, change `2 * mean - x` to plain `x`, so that a round is the oracle and nothing else. What will the probability column show?',
        find: { python: 'a = [2 * mean - x for x in a]', javascript: 'a = a.map((x) => 2 * mean - x);' },
        replace: { python: 'a = [x for x in a]', javascript: 'a = a.map((x) => x);' },
        reveal: 'Every line shows probability=0.125, one in eight, the same as a blind guess. The amplitude column flips between 0.354 and -0.354 and the total stays at 1.000. The oracle marks the item with a sign, and a sign cannot be seen in a measurement. It takes the diffusion step to turn that sign into a larger amplitude. The oracle acts on the whole state at once, and on its own it finds nothing.' },
      { change: 'Run twice as many rounds "to be safe": put `2 *` in front of the rounded value in the line that computes `best`. What will the predicted probability on the last line be?',
        find: { python: 'best = round(math.pi / (4 * theta) - 0.5)', javascript: 'const best = Math.round(Math.PI / (4 * theta) - 0.5);' },
        replace: { python: 'best = 2 * round(math.pi / (4 * theta) - 0.5)', javascript: 'const best = 2 * Math.round(Math.PI / (4 * theta) - 0.5);' },
        reveal: 'The last two lines become "best number of rounds: 4" and "predicted probability there: 0.012". The table above them says the same: 0.945 after 2 rounds, 0.012 after 4. Twice the best count turns the state almost half a turn, to where the marked amplitude is close to zero again. Extra rounds are not a safety margin.' },
    ],
    python: {
      source: `import math


def grover_rounds(n_items, marked, rounds):
    a = [1 / math.sqrt(n_items)] * n_items
    history = [(a[marked], sum(x * x for x in a))]
    for _ in range(rounds):
        a[marked] = -a[marked]               # oracle: flip the marked sign
        mean = sum(a) / n_items
        a = [2 * mean - x for x in a]        # diffusion: reflect about the mean
        history.append((a[marked], sum(x * x for x in a)))
    return history


n_items, marked = 8, 5
theta = math.asin(1 / math.sqrt(n_items))
best = round(math.pi / (4 * theta) - 0.5)
for k, (amp, total) in enumerate(grover_rounds(n_items, marked, 4)):
    print(f"rounds={k} amplitude={amp:.3f} probability={amp * amp:.3f} total={total:.3f}")
print(f"best number of rounds: {best}")
print(f"predicted probability there: {math.sin((2 * best + 1) * theta) ** 2:.3f}")`,
      notes: [
        { line: 5, text: 'The starting state: every item has the same amplitude, 1/√N, so the squares add up to 1.' },
        { line: 8, text: 'The oracle. In a simulation it is one sign flip. On a quantum computer it is a circuit that computes the test, and it is the step whose uses are counted.' },
        { line: 10, text: 'Reflection about the mean. The factor 2 matters: it is what keeps the total probability at 1.' },
        { line: 17, text: 'The best number of rounds, from the rotation angle θ. It is roughly (π/4)·√N.' },
        { line: 21, text: 'The closed-form prediction sin²((2k + 1)θ) agrees with the simulated value on the line for that k.' },
      ],
    },
    javascript: {
      source: `function groverRounds(nItems, marked, rounds) {
  let a = new Array(nItems).fill(1 / Math.sqrt(nItems));
  const total = (v) => v.reduce((s, x) => s + x * x, 0);
  const history = [[a[marked], total(a)]];
  for (let r = 0; r < rounds; r++) {
    a[marked] = -a[marked];                 // oracle: flip the marked sign
    const mean = a.reduce((s, x) => s + x, 0) / nItems;
    a = a.map((x) => 2 * mean - x);         // diffusion: reflect about the mean
    history.push([a[marked], total(a)]);
  }
  return history;
}

const nItems = 8, marked = 5;
const theta = Math.asin(1 / Math.sqrt(nItems));
const best = Math.round(Math.PI / (4 * theta) - 0.5);
groverRounds(nItems, marked, 4).forEach(([amp, total], k) => {
  console.log("rounds=" + k + " amplitude=" + amp.toFixed(3) + " probability=" + (amp * amp).toFixed(3) + " total=" + total.toFixed(3));
});
console.log("best number of rounds: " + best);
console.log("predicted probability there: " + (Math.sin((2 * best + 1) * theta) ** 2).toFixed(3));`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>
#include <vector>

double total(const std::vector<double>& a) {
    double s = 0;
    for (double x : a) s += x * x;
    return s;
}

int main() {
    const int nItems = 8, marked = 5, rounds = 4;
    const double pi = std::acos(-1.0);
    std::vector<double> a(nItems, 1 / std::sqrt(static_cast<double>(nItems)));
    std::printf("rounds=0 amplitude=%.3f probability=%.3f total=%.3f\\n", a[marked], a[marked] * a[marked], total(a));
    for (int k = 1; k <= rounds; ++k) {
        a[marked] = -a[marked];                  // oracle: flip the marked sign
        double mean = 0;
        for (double x : a) mean += x;
        mean /= nItems;
        for (double& x : a) x = 2 * mean - x;    // diffusion: reflect about the mean
        std::printf("rounds=%d amplitude=%.3f probability=%.3f total=%.3f\\n", k, a[marked], a[marked] * a[marked], total(a));
    }
    double theta = std::asin(1 / std::sqrt(static_cast<double>(nItems)));
    int best = static_cast<int>(std::lround(pi / (4 * theta) - 0.5));
    std::printf("best number of rounds: %d\\n", best);
    std::printf("predicted probability there: %.3f\\n", std::pow(std::sin((2 * best + 1) * theta), 2));
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The cost of a search like this is counted in uses of the test, called oracle calls or queries. A classical search needs about N/2 on average and N in the worst case. Grover\'s search needs about (π/4)·√N. That is a quadratic saving: a search over a trillion candidates takes about 785,000 rounds in place of half a trillion tests. It is not an exponential one, and it has been proved that no quantum algorithm can use fewer than on the order of √N queries.',
    cases: [
      { case: 'Quantum queries, one marked item', time: 'About (π/4)·√N', when: 'Success probability at least 1 − 1/N. Each query is one run of the oracle circuit.' },
      { case: 'Quantum queries, M marked items', time: 'About (π/4)·√(N/M)', when: 'M must be known, or estimated first, to choose the number of rounds.' },
      { case: 'Classical queries', time: 'About N/2 on average, N − 1 at worst', when: 'No structure to exploit: candidates can only be tested one by one.' },
      { case: 'Classical simulation on this page', time: 'O(N·√N) arithmetic steps', when: 'N amplitudes are updated in each of about √N rounds. With N = 2ⁿ this is exponential in the number of qubits n.' },
    ],
    space: 'The quantum algorithm needs n = log₂ N qubits for the candidates, plus whatever working qubits the oracle circuit uses. The classical simulation needs N numbers, which doubles with every added qubit.',
    memory: 'Simulating 6 qubits takes 64 numbers. Simulating 50 would take about a million billion, far beyond ordinary computers. That gap is exactly why the simulation teaches the algorithm without replacing the machine.',
    tradeoffs: 'The rounds must run one after another on a single quantum state, so the work cannot be split among many machines as freely as a classical search can: sharing it among p quantum machines reduces the rounds each one needs only by a factor of √p. Classical brute force, by contrast, divides perfectly. This narrows the practical advantage further.',
    assumptions: [
      'Cost is measured in oracle queries. The time for one query depends on the circuit that computes the test and is not included.',
      'All quantum operations are assumed to be perfect. Real devices are noisy, and running long computations reliably requires error correction with large overhead.',
      'The search is unstructured: nothing is known about which candidate is marked except what the oracle reveals.',
      'There is exactly one marked item unless stated otherwise.',
      'Large fault-tolerant quantum computers do not yet exist. The counts on this page come from a classical simulation of up to 4096 items.',
    ],
  },

  tradeoffs: {
    excels: [
      'In theory: problems where candidates can only be tested, the test is cheap to compute, and the number of candidates is enormous.',
      'As a subroutine. Many quantum algorithms use the same amplification step to boost the success probability of some other procedure.',
      'As a teaching example: the whole algorithm is two reflections, and its behaviour is given by an exact formula.',
    ],
    struggles: [
      'Anything today. No existing quantum computer can run it on a problem that a laptop could not search faster.',
      'Searching stored data. Making N stored items available to a quantum computer costs at least N steps, which removes the advantage.',
      'Problems with structure. If the data can be sorted, hashed or otherwise organized, classical methods need far fewer than √N steps.',
      'Problems that need an exponential speedup to become feasible. Halving the exponent of an astronomically large number still leaves an astronomically large number.',
    ],
    pitfalls: [
      'Choosing the number of rounds without knowing how many items are marked.',
      'Ignoring the cost of the oracle circuit, which can dwarf everything else.',
      'Reading the per-query count as running time and concluding that a quantum search of a database is fast in practice.',
    ],
    misunderstandings: [
      "\"A quantum computer tries every answer at the same time and picks the right one.\" It cannot pick. A measurement shows one answer at random. Grover's search works by slowly changing the odds, and it still needs about √N rounds to do so.",
      "\"Quantum computers make every search exponentially faster.\" For unstructured search the gain is quadratic, and that has been proved to be the most any quantum algorithm can achieve.",
      "\"Grover's search breaks encryption.\" It weakens symmetric ciphers by halving the effective key length, which is countered by using longer keys. The algorithm that threatens today's public-key cryptography is Shor's, a different method for a different problem.",
      "\"This page shows a quantum speedup.\" It shows the mathematics of one. The page runs on an ordinary computer and does more work than a simple classical search would.",
      "\"More rounds give a better answer.\" Only up to the best number. After that the chance of success goes down again.",
    ],
    constraints: [
      'A useful run needs a fault-tolerant quantum computer able to perform an enormous number of operations in sequence without error. No such machine exists yet.',
      'The speedup is quadratic, so the large overheads of quantum error correction can cancel it for all but very large problems.',
    ],
    alternatives: [
      { id: 'linear-search', name: 'Linear Search', when: 'Always, on today\'s hardware. It is the classical method Grover\'s search is measured against.' },
      { id: 'binary-search', name: 'Binary Search', when: 'The data can be kept in sorted order. It needs about log₂ N steps, far fewer than √N.' },
      { id: 'hash-table', name: 'Hash Table', when: 'The data can be indexed in advance. Lookups then take a constant number of steps.' },
      { id: 'shors-algorithm', name: 'Shor\'s Algorithm', when: 'The problem is factoring or a discrete logarithm, where structure allows an exponential quantum speedup.' },
    ],
    comparison: {
      columns: ['', 'Classical search', 'Grover\'s search', 'This page\'s simulation'],
      rows: [
        ['Uses of the test', 'About N/2', 'About (π/4)·√N', 'About (π/4)·√N'],
        ['Other work', 'None', 'About log₂ N gates per round', 'N arithmetic updates per round'],
        ['Memory', 'A counter', 'log₂ N qubits', 'N numbers'],
        ['Result', 'Certain', 'Correct with high probability', 'Correct with high probability'],
        ['Can be run today at scale', 'Yes', 'No', 'Up to a few dozen qubits'],
      ],
    },
  },

  applications: [
    { title: 'Key lengths for symmetric encryption', status: 'established', text: 'Trying every key of a k-bit cipher takes about 2ᵏ tests classically. Grover\'s search would take about 2 to the power k/2 quantum evaluations of the cipher. This is the reason post-quantum guidance treats long symmetric keys, such as 256 bits, as the safe choice. The effect is on planning only: no machine can carry out such a search, and the search cannot be parallelized as freely as a classical one.' },
    { title: 'Demonstrations on small quantum devices', status: 'established', text: 'The algorithm has been run on real quantum hardware since 1998, when nuclear magnetic resonance experiments searched among four items with two qubits. Such experiments confirm the principle on a handful of qubits. They do not outperform classical search.' },
    { title: 'A subroutine in other quantum algorithms', status: 'illustrative', text: 'The repeated pair of reflections, known as amplitude amplification, raises the success probability of any quantum procedure, not only a blind guess. In theory this gives quadratic savings for tasks such as counting solutions and estimating averages. These are results on paper until suitable hardware exists.' },
    { title: 'Brute-force search for hard puzzles', status: 'illustrative', text: 'For a problem where the only known approach is to test all 2ⁿ settings of n yes-or-no choices, Grover\'s search would need about 2 to the power n/2 tests. That is a real saving and still exponential, so it does not make such problems easy.' },
  ],

  connections: [
    { to: 'linear-search', type: 'same-problem', why: 'Both find an item when nothing is known about where it is. Linear search tests candidates one at a time and needs about N/2 tests; Grover\'s search needs about √N by changing amplitudes instead of ruling candidates out.' },
    { to: 'binary-search', type: 'related', why: 'Binary search shows what structure buys: with sorted data, each test rules out half the candidates. Grover\'s search is for the case where no such structure exists.' },
    { to: 'concept:superposition', type: 'prerequisite', why: 'The algorithm starts from a state in which every candidate has the same amplitude, and works by reshaping that state.' },
    { to: 'concept:linear-algebra', type: 'prerequisite', why: 'The state is a vector, each step is a reflection, and two reflections make a rotation. The running time is the number of rotations needed to turn through a quarter circle.' },
    { to: 'concept:probability', type: 'prerequisite', why: 'The output is random. The algorithm controls the probabilities, which are the squares of the amplitudes, and its answer must be checked.' },
    { to: 'concept:complex-numbers', type: 'related', why: 'Quantum amplitudes are complex numbers in general. Here they stay real, which is what lets the page draw them as signed bars.' },
    { to: 'concept:lower-bound', type: 'advanced', why: 'It is one of the few algorithms known to be exactly optimal: a proof shows that every quantum algorithm for unstructured search needs on the order of √N queries.' },
    { to: 'shors-algorithm', type: 'related', why: 'The two best-known quantum algorithms. Shor\'s uses the structure of its problem for an exponential speedup; Grover\'s applies to any search and gives a quadratic one.' },
    { to: 'rsa', type: 'related', why: 'RSA is threatened by Shor\'s algorithm, not by this one. Grover\'s search bears on symmetric ciphers and hash functions, where the only attack is to try candidates.' },
    { to: 'monte-carlo', type: 'advanced', why: 'Amplitude estimation, built from the same reflections, would estimate an average with roughly the square root of the samples that Monte Carlo sampling needs.' },
    { to: 'discipline:cryptography', type: 'application', why: 'The quadratic speedup for exhaustive search is why symmetric key lengths are doubled in planning for quantum attackers.' },
    { to: 'discipline:physics', type: 'related', why: 'The amplitudes follow the rules of quantum mechanics, and the algorithm is an engineered case of interference.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Immediately after the oracle step, before diffusion, how has the chance of measuring the marked item changed?',
      options: ['It has doubled', 'It has not changed', 'It has become certain', 'It has dropped to zero'],
      answer: 1,
      explain: [
        'The oracle changes only a sign. The chance depends on the amplitude squared, which a sign change leaves alone.',
        'Correct. The marked amplitude went from a to −a, and both have the same square. The sign flip only becomes useful when the diffusion step compares every amplitude with the mean.',
        'Certainty needs the marked amplitude to be 1 or −1. The oracle does not change its size.',
        'The size of the amplitude is unchanged, so the chance is too.',
      ],
    },
    {
      type: 'predict',
      q: 'With 32 items the best number of rounds is 4, which gives the marked item a 99.9% chance. What is the chance after 12 rounds, three times the best number?',
      options: ['Above 99.9%, because more rounds can only help', 'About 93%', 'About 50%', 'About 1%'],
      answer: 1,
      explain: [
        'More rounds do not keep improving the odds. Each round turns the state by the same fixed angle, and after round 4 it has passed the top.',
        'Correct. Four rounds turn the state almost a quarter turn, to the top. Eight turn it almost half a turn, where the chance is 1.4%. Twelve turn it almost three quarters of a turn, and the chance is back up at 92.9%. The marked amplitude is negative there, −0.964, but the chance is its square.',
        'It passes 54.6% at round 6 on the way down and 65.8% at round 11 on the way back up. By round 12 it is higher.',
        'That is where it stands after 8 rounds, twice the best number. It does not stay there. The state keeps turning, and the chance climbs again.',
      ],
      tryInput: { qubits: 5, marked: 20, iterations: 12 },
      check: (r, c) => (r.N === 32 && r.best === 4 && r.iterations === 12 && c['oracle calls'] === 12 && Math.abs(r.finalProbability - 0.92905) < 0.0001 && Math.abs(r.probs[4] - 0.99918) < 0.0001 && Math.abs(r.probs[8] - 0.01445) < 0.0001 && Math.abs(r.amplitudes[20] + 0.964) < 0.0005) || `probability ${r.finalProbability} after ${r.iterations} rounds`,
    },
    {
      type: 'debug',
      q: 'In this simulation the squares of the amplitudes stop adding up to 1 after the first round. Which line is wrong?',
      code: `a = [1 / math.sqrt(n)] * n
for _ in range(k):
    a[marked] = -a[marked]
    mean = sum(a) / n
    a = [mean - x for x in a]`,
      options: ['Line 1: the start should be 1 / n', 'Line 3: the oracle should set the marked amplitude to 1', 'Line 5: reflection about the mean is 2 * mean − x', 'Line 4: the mean should leave out the marked item'],
      answer: 2,
      explain: [
        'With 1/√n each, the squares add up to n × 1/n = 1, which is right. With 1/n they would add up to 1/n.',
        'The oracle only flips a sign. Setting the amplitude to 1 would break the total straight away.',
        'Correct. A mirror image of x in the line at height mean is as far above it as x is below: mean + (mean − x). Without the factor 2 the step is not a reflection and does not preserve the total.',
        'The mean is over all amplitudes, marked one included. That is what lets the sign flip pull it down.',
      ],
    },
    {
      type: 'choice',
      q: 'This page runs Grover\'s search on an ordinary computer. Why does that not give ordinary computers a fast search?',
      options: ['Because the page uses too few qubits', 'Because the simulation updates all N amplitudes in every round, which is more work than testing the N items directly', 'Because JavaScript is slow', 'Because the random measurement can be wrong'],
      answer: 1,
      explain: [
        'More qubits make it worse: the list of amplitudes doubles with each one.',
        'Correct. The simulation does about N·√N arithmetic steps to save on a count of oracle calls. On a quantum computer the amplitudes would be the physical state, not a list to be updated.',
        'The cost is in the method, not the language. Any classical simulation has to track N numbers.',
        'A wrong measurement is rare and easy to catch with one check. It is not what makes the simulation slow.',
      ],
    },
    {
      type: 'choice',
      q: 'What does Grover\'s search imply for a symmetric cipher with a 128-bit key?',
      options: ['It can be broken instantly by a quantum computer', 'A quantum attacker would need about 2⁶⁴ cipher evaluations in place of 2¹²⁸, so guidance favours 256-bit keys', 'Nothing: quantum computers do not affect symmetric ciphers', 'The key must be changed after every message'],
      answer: 1,
      explain: [
        'The speedup is quadratic, not unlimited. 2⁶⁴ sequential quantum operations is still an immense computation, far beyond any existing machine.',
        'Correct. Searching 2¹²⁸ keys takes about the square root of that many rounds. Doubling the key length restores the original margin.',
        'Exhaustive key search is exactly an unstructured search, so the quadratic speedup applies in principle.',
        'Key rotation does not address exhaustive search. A longer key does.',
      ],
    },
    {
      type: 'challenge',
      title: 'More than one marked item',
      prompt: 'Extend the simulation so that a set of M items is marked: the oracle flips the sign of each of them, and success means measuring any one. Confirm by experiment that the success probability after k rounds is sin²((2k + 1)θ) with sin θ = √(M/N). Then take N = 64 with the first M items marked, and for M = 1, 2, 4, 8 and 16 find the number of rounds at which the probability first peaks, and the probability there. Finally run M = 32. What happens in the two special cases M = N/4 and M = N/2, and how does the formula explain it?',
      expect: 'For N = 64 the probability first peaks after 6, 4, 3, 2 and 1 rounds for M = 1, 2, 4, 8 and 16, at 0.997, 0.999, 0.961, 0.945 and exactly 1. Those round counts are what round(π/(4θ) − 1/2) gives, and at every round the simulated probability agrees with sin²((2k + 1)θ) to about fifteen decimal places. M = 16 is N/4: θ is 30 degrees, one round turns the state to 90 degrees, and success is certain. M = 32 is N/2: the probability is 0.5 before the first round and after every round, because θ is 45 degrees and sin² of any odd multiple of 45 degrees is one half.',
      hints: ['The success probability is the sum of the squares of the marked amplitudes.', 'For M = N/4, sin θ = 1/2, so θ is 30 degrees and 3θ is a quarter turn.', 'For M = N/2, θ is 45 degrees. What is sin² of any odd multiple of 45 degrees?'],
    },
  ],

  compare: {
    idea: 'Alternate a sign flip on the marked item with a reflection of all amplitudes about their mean, rotating the state toward the answer.',
    requires: 'A quantum computer, and the check written as a quantum circuit. The answer is right with high probability and has to be confirmed.',
    sensitivity: 'High sensitivity to the number of rounds: too many is as bad as too few. Insensitive to which item is marked.',
    memory: 'log₂ N qubits on a quantum computer; N numbers in a classical simulation.',
    difficulty: 'high',
    difficultyNote: 'The arithmetic is a few lines. Understanding why it works needs amplitudes and interference, and running it needs hardware that does not exist yet.',
    limits: 'It cuts the work to its square root, and it is proved that nothing does better. No machine today can run it at a useful size. It does not help with data that is stored or has structure.',
    useWhen: 'For now, in theory only: searching an enormous number of possibilities where each one can be checked by a quantum circuit.',
  },

  advanced: {
    history: 'Lov Grover presented the algorithm at the ACM Symposium on Theory of Computing in 1996 and published a short account in Physical Review Letters in 1997 under the title "Quantum mechanics helps in searching for a needle in a haystack". Charles Bennett, Ethan Bernstein, Gilles Brassard and Umesh Vazirani proved that any quantum algorithm for unstructured search needs on the order of √N queries, so the algorithm is optimal up to a constant factor. Michel Boyer, Gilles Brassard, Peter Høyer and Alain Tapp gave the exact success probability and treated the case of an unknown number of solutions in 1998, and Christof Zalka showed in 1999 that Grover\'s algorithm is optimal exactly, not only up to a constant. Brassard, Høyer, Michele Mosca and Tapp generalized it to amplitude amplification. The first laboratory demonstrations, on two-qubit nuclear magnetic resonance devices, were reported in 1998.',
    derivation: 'Let $|w\\rangle$ be the marked basis state and $|r\\rangle = \\frac{1}{\\sqrt{N-1}}\\sum_{x \\ne w}|x\\rangle$ the uniform state over the rest. The starting state is\n\n$$|s\\rangle = \\frac{1}{\\sqrt N}\\sum_x |x\\rangle = \\sin\\theta\\,|w\\rangle + \\cos\\theta\\,|r\\rangle, \\qquad \\sin\\theta = \\frac{1}{\\sqrt N}.$$\n\nThe oracle is $O = I - 2|w\\rangle\\langle w|$, a reflection across $|r\\rangle$ within the plane spanned by $|w\\rangle$ and $|r\\rangle$. Diffusion is $D = 2|s\\rangle\\langle s| - I$, a reflection across $|s\\rangle$; applied to amplitudes $a_x$ it gives $2\\bar a - a_x$, where $\\bar a$ is their mean. The product of two reflections whose axes meet at angle $\\theta$ is a rotation by $2\\theta$, so\n\n$$(DO)^k|s\\rangle = \\sin\\big((2k+1)\\theta\\big)\\,|w\\rangle + \\cos\\big((2k+1)\\theta\\big)\\,|r\\rangle,$$\n\nand the probability of measuring $w$ after $k$ rounds is\n\n$$P_k = \\sin^2\\big((2k+1)\\theta\\big).$$\n\nIt is maximized when $(2k+1)\\theta$ is as close as possible to $\\pi/2$, that is $k = \\operatorname{round}\\!\\big(\\tfrac{\\pi}{4\\theta} - \\tfrac12\\big) \\approx \\tfrac{\\pi}{4}\\sqrt N$. At that $k$ the angle is within $\\theta$ of $\\pi/2$, so $P_k \\ge \\cos^2\\theta = 1 - \\tfrac1N$.',
    proof: 'Optimality (sketch of the argument of Bennett, Bernstein, Brassard and Vazirani, in the form given by Nielsen and Chuang). Fix any quantum algorithm that makes $T$ oracle queries. Let $|\\phi_T\\rangle$ be its final state when the oracle marks nothing, and $|\\psi_T^{y}\\rangle$ its final state when the oracle marks $y$. A single query can separate the two runs only in proportion to the amplitude the algorithm currently places on $y$, and those amplitudes, squared and summed over all $y$, total 1. Carrying this through $T$ queries gives\n\n$$\\sum_{y} \\big\\lVert\\, |\\psi_T^{y}\\rangle - |\\phi_T\\rangle \\big\\rVert^2 \\le 4T^2.$$\n\nOn the other hand, if the algorithm finds every $y$ with probability at least one half, the states $|\\psi_T^{y}\\rangle$ must be nearly orthogonal to one another, which forces the same sum to be at least $cN$ for a positive constant $c$. Together, $4T^2 \\ge cN$, so $T \\ge \\sqrt{cN}/2$: on the order of $\\sqrt N$ queries are unavoidable.',
    complexityProof: 'Query count: $k \\approx \\frac{\\pi}{4}\\sqrt N$ rounds with one oracle call each. Gate count on a quantum computer: the diffusion operator can be built from a layer of single-qubit gates on each side of an operation that flips the sign of one basis state, which takes a number of elementary gates proportional to $n = \\log_2 N$. So the total is $O(\\sqrt N \\log N)$ gates plus $O(\\sqrt N)$ runs of the oracle circuit.\n\nClassical simulation: each round updates $N$ amplitudes, for $O(N\\sqrt N) = O(2^{3n/2})$ arithmetic operations and $O(2^n)$ memory. Because only two distinct amplitude values ever occur, this particular algorithm can be simulated with two numbers per round; that shortcut exists because the marked item is already known to the simulator, and it tells us nothing about finding an unknown one.',
    variants: [
      { name: 'Several marked items', text: 'With M marked items among N the rotation angle satisfies sin θ = √(M/N) and about (π/4)·√(N/M) rounds are needed.' },
      { name: 'Unknown number of marked items', text: 'Run the algorithm with a number of rounds chosen at random from a range that grows geometrically until a check succeeds. The expected total is still on the order of √(N/M) queries.' },
      { name: 'Amplitude amplification', text: 'Replace the uniform starting state by the output of any quantum procedure that succeeds with probability p. About 1/√p repetitions raise the success probability close to 1.' },
      { name: 'Quantum counting and amplitude estimation', text: 'Estimate the rotation angle itself, and from it the number of marked items or the probability p, with quadratically fewer queries than sampling.' },
      { name: 'Exact search', text: 'Adjusting the phase used in the last round makes the final rotation land exactly on the marked item, giving certainty for any N.' },
    ],
    implementation: 'For a simulation, keep the amplitudes in a flat array, apply the oracle as a sign change and the diffusion as two passes (sum, then update). Check after every round that the squares add up to 1; a drift signals a bug. Compute the best number of rounds from the angle, not from (π/4)·√N rounded, which is wrong for small N. For circuits, the oracle is usually implemented with a working qubit prepared so that computing the test into it produces the sign change.',
    benchmarking: 'Report oracle queries, and separately the size of the oracle circuit and the number of qubits, including any needed for error correction. Do not compare the running time of a classical simulation with a classical search: the simulation is slower by construction. Comparisons of real devices should state the measured success probability against the 1/N of a random guess.',
    references: [
      { authors: 'L. K. Grover', year: 1996, title: 'A fast quantum mechanical algorithm for database search', venue: 'Proceedings of the 28th Annual ACM Symposium on Theory of Computing (STOC), 212-219' },
      { authors: 'C. H. Bennett, E. Bernstein, G. Brassard and U. Vazirani', year: 1997, title: 'Strengths and weaknesses of quantum computing', venue: 'SIAM Journal on Computing 26(5), 1510-1523' },
      { authors: 'M. Boyer, G. Brassard, P. Høyer and A. Tapp', year: 1998, title: 'Tight bounds on quantum searching', venue: 'Fortschritte der Physik 46(4-5), 493-505' },
      { authors: 'C. Zalka', year: 1999, title: 'Grover\'s quantum searching algorithm is optimal', venue: 'Physical Review A 60, 2746' },
      { authors: 'I. L. Chuang, N. Gershenfeld and M. Kubinec', year: 1998, title: 'Experimental implementation of fast quantum searching', venue: 'Physical Review Letters 80(15), 3408-3411' },
    ],
    furtherReading: [
      'M. A. Nielsen and I. L. Chuang, *Quantum Computation and Quantum Information*, chapter 6, "Quantum search algorithms".',
      'G. Brassard, P. Høyer, M. Mosca and A. Tapp, "Quantum amplitude amplification and estimation", in *Quantum Computation and Information*, Contemporary Mathematics 305 (2002).',
    ],
  },

  tests: [
    { name: 'the state stays normalized and matches sin²((2k + 1)θ) on the default input', input: {},
      check: (r, c) => {
        if (r.norms.some((v) => Math.abs(v - 1) > 1e-12)) return 'the squares of the amplitudes do not add up to 1';
        const bad = r.probs.findIndex((p, k) => Math.abs(p - predicted(r.N, k)) > 1e-12);
        if (bad >= 0) return `round ${bad}: simulated ${r.probs[bad]}, formula ${predicted(r.N, bad)}`;
        return (r.N === 16 && r.iterations === 3 && r.best === 3 && c['oracle calls'] === 3) || `N=${r.N}, rounds=${r.iterations}, best=${r.best}, oracle calls=${c['oracle calls']}`;
      } },
    { name: 'the worked example: four items, one round, amplitudes 0, 0, 1, 0 and certainty', input: { qubits: 2, marked: 2, iterations: 1 },
      check: (r) => (Math.abs(r.finalProbability - 1) < 1e-12 && r.amplitudes.every((v, i) => Math.abs(v - (i === 2 ? 1 : 0)) < 1e-12) && r.outcome === 2 && Math.abs(r.probs[0] - 0.25) < 1e-12) || `probability ${r.finalProbability}, amplitudes ${r.amplitudes.join(', ')}` },
    { name: 'default run quotes: 47.3% after one round, 96.1% after three', input: { qubits: 4, marked: 5, iterations: 0 },
      check: (r) => (Math.abs(r.probs[1] - 121 / 256) < 1e-12 && Math.abs(r.probs[3] - 0.96132) < 1e-5 && Math.abs(r.amplitudes[5] ** 2 - r.probs[3]) < 1e-15) || `got ${r.probs[1]} and ${r.probs[3]}` },
    { name: 'try-this: one round on 16 items lifts the marked amplitude to 0.6875 and leaves the others at 0.1875', input: { qubits: 4, marked: 5, iterations: 1 },
      check: (r) => (Math.abs(r.amplitudes[5] - 0.6875) < 1e-12 && r.amplitudes.every((v, i) => i === 5 || Math.abs(v - 0.1875) < 1e-12) && Math.abs(r.probs[0] - 0.0625) < 1e-12) || `amplitudes ${r.amplitudes.join(', ')}` },
    { name: 'try-this: 16 items stand at 58.2% after round 4 and 12.5% after round 5', input: { qubits: 4, marked: 5, iterations: 6 },
      check: (r) => (Math.abs(r.probs[4] - 0.5817) < 0.0001 && Math.abs(r.probs[5] - 0.12549) < 0.0001) || `got ${r.probs[4]} and ${r.probs[5]}` },
    { name: 'try-this: of measurement seeds 1 to 20 on 8 items only seed 7 is wrong, and four of seeds 1 to 60 are', input: {},
      check: () => {
        const wrong = [];
        for (let seed = 1; seed <= 60; seed++) { const r = run({ qubits: 3, marked: 6, iterations: 0, seed }, QUIET); if (!r.success) wrong.push(`${seed}:${r.outcome}`); }
        return wrong.join(' ') === '7:1 35:0 43:7 45:4' || `wrong seeds ${wrong.join(' ')}`;
      } },
    { name: 'quiz: 32 items, 12 rounds, back up at 92.9% after 1.4% at round 8', input: { qubits: 5, marked: 20, iterations: 12 },
      check: (r) => (Math.abs(r.finalProbability - predicted(32, 12)) < 1e-12 && Math.abs(r.finalProbability - 0.92905) < 0.0001 && Math.abs(r.probs[6] - 0.54589) < 0.0001 && Math.abs(r.probs[8] - 0.01445) < 0.0001 && Math.abs(r.probs[11] - 0.65762) < 0.0001 && r.amplitudes[20] < 0) || `probability ${r.finalProbability}` },
    { name: 'things to try: 16 items, 6 rounds, about 2%', input: { qubits: 4, marked: 5, iterations: 6 },
      check: (r) => (Math.abs(r.finalProbability - 0.0204) < 0.0005 && r.probs[3] > 0.96) || `probability ${r.finalProbability}` },
    { name: 'formula and normalization hold for every size from 2 to 6 qubits and up to 24 rounds', input: {},
      check: () => {
        for (let q = 2; q <= 6; q++) for (const marked of [0, 1, 2 ** q - 1]) {
          const r = run({ qubits: q, marked, iterations: 24, seed: 1 }, QUIET);
          for (let k = 0; k <= 24; k++) {
            if (Math.abs(r.norms[k] - 1) > 1e-10) return `q=${q}, round ${k}: total probability ${r.norms[k]}`;
            if (Math.abs(r.probs[k] - predicted(r.N, k)) > 1e-10) return `q=${q}, round ${k}: ${r.probs[k]} vs ${predicted(r.N, k)}`;
          }
        }
        return true;
      } },
    { name: 'the best number of rounds is 1, 2, 3, 4, 6 for 2 to 6 qubits and beats its neighbours', input: {},
      check: () => {
        const want = [1, 2, 3, 4, 6];
        for (let q = 2; q <= 12; q++) {
          const N = 2 ** q, b = bestRounds(N);
          if (q <= 6 && b !== want[q - 2]) return `q=${q}: best ${b}, expected ${want[q - 2]}`;
          if (predicted(N, b) < predicted(N, b - 1) || predicted(N, b) < predicted(N, b + 1)) return `q=${q}: round ${b} is not a local best`;
          if (predicted(N, b) < 1 - 1 / N - 1e-12) return `q=${q}: best probability ${predicted(N, b)} is below 1 − 1/N`;
          if (b !== Math.floor(Math.PI / (4 * angle(N)))) return `q=${q}: best ${b} disagrees with floor(π/4θ)`;
        }
        return true;
      } },
    { name: 'measurements succeed about as often as the probability says (8 items, 94.5%)', input: {},
      check: () => {
        let hits = 0;
        const trials = 3000;
        for (let seed = 1; seed <= trials; seed++) if (run({ qubits: 3, marked: 6, iterations: 0, seed }, QUIET).success) hits++;
        const f = hits / trials;
        return Math.abs(f - 121 / 128) < 0.02 || `success rate ${f.toFixed(3)}, expected about 0.945`;
      } },
    { name: 'a marked item beyond the last one is clamped, and oracle calls equal rounds', input: { qubits: 2, marked: 63, iterations: 5 },
      check: (r, c) => (r.marked === 3 && c['oracle calls'] === 5 && r.probs.length === 6) || `marked ${r.marked}, oracle calls ${c['oracle calls']}` },
    { name: 'for 1024 items the best count is 25 rounds, against 512.5 classical tests on average', input: {},
      check: () => {
        const r = run({ qubits: 10, marked: 1, iterations: 0, seed: 1 }, QUIET);
        return (r.best === 25 && r.iterations === 25 && r.finalProbability > 0.999) || `best ${r.best}, probability ${r.finalProbability}`;
      } },
  ],
};
