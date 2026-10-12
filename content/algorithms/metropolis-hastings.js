import { makeRng } from '../../js/lib/rng.js';

// The target, known to the sampler only up to a constant: two bumps of equal width,
// centred at -2 and +2, holding 30% and 70% of the probability.
const SIGMA = 0.6, LEFT = -2, RIGHT = 2, W_LEFT = 0.3, W_RIGHT = 0.7;
const height = (x) => W_LEFT * Math.exp(-((x - LEFT) ** 2) / (2 * SIGMA * SIGMA)) + W_RIGHT * Math.exp(-((x - RIGHT) ** 2) / (2 * SIGMA * SIGMA));
const AREA = SIGMA * Math.sqrt(2 * Math.PI);      // area under height(x): used only to draw the histogram at the same scale
const EXACT_MEAN = W_LEFT * LEFT + W_RIGHT * RIGHT;                 // 0.8
// Simpson's rule, used once to get the exact share of probability to the left of zero (about 0.3002).
function integrate(f, a, b, n = 4000) {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  return (sum * h) / 3;
}
const EXACT_LEFT = integrate(height, -12, 0) / integrate(height, -12, 12);
const X0 = -5.6, X1 = 5.6, BIN = 0.28, NBINS = Math.round((X1 - X0) / BIN);
const CURVE = Array.from({ length: 281 }, (_, i) => { const x = X0 + (i / 280) * (X1 - X0); return [x, height(x)]; });
const BIN_XS = Array.from({ length: NBINS }, (_, i) => X0 + (i + 0.5) * BIN);
const QUIET = { record: false, count() {}, frame() {} };
const f2 = (v) => v.toFixed(2);
const f3 = (v) => v.toFixed(3);
const pct = (v) => (100 * v).toFixed(1) + '%';

function run(input, t) {
  const width = Number(input.width);
  if (!(width > 0)) throw new Error('The proposal width must be positive.');
  const steps = Math.floor(Number(input.steps));
  if (!(steps >= 1)) throw new Error('Take at least one step.');
  const start = Number(input.start);
  if (!Number.isFinite(start)) throw new Error('The starting position must be a number.');
  const scale = Number(input.scale) > 0 ? Number(input.scale) : 1;   // tests only: multiplies the target by a constant
  const p = (v) => scale * height(v);
  const rng = makeRng(input.seed);
  const picture = t.record !== false;
  const bins = new Array(NBINS).fill(0);
  const trace = picture ? [[0, start]] : null;
  const log = [];
  let x = start, hx = p(x);
  if (!(hx > 0)) throw new Error('The target is zero at the starting position. Start closer to the bumps.');
  let accepted = 0, sum = 0, leftCount = 0, switches = 0;
  let bump = start < 0 ? 'left' : 'right';    // the bump whose core (within 1 of its centre) the chain visited last
  t.count('density evaluations');
  t.count('accepted proposals', 0);
  t.count('mode switches', 0);

  const legend = [
    { label: 'target (height known only up to a constant)', role: 'ink' },
    { label: 'histogram of samples so far, scaled to the same area (cut off at the top of the chart)', role: 'sage' },
    { label: 'current position', role: 'current' },
    { label: 'accepted proposal', role: 'done' },
    { label: 'rejected proposal', role: 'rejected' },
  ];
  // done: number of samples so far; step: { from, to, ok } for the proposal just handled, or null.
  const views = (done, step) => {
    const scale = done ? AREA / (done * BIN) : 0;
    const layers = [
      { type: 'bars', xs: BIN_XS, heights: bins.map((c) => c * scale), barWidth: BIN * 0.92, role: 'sage', alpha: 0.75 },
      { type: 'line', points: CURVE, role: 'ink', width: 2 },
    ];
    if (step) {
      layers.push({ type: 'segments', segments: [[step.from, height(step.from), step.to, height(step.to)]], role: step.ok ? 'done' : 'rejected', width: 1.8, arrow: true, dash: !step.ok });
      layers.push({ type: 'points', points: [[step.to, height(step.to)]], role: step.ok ? 'done' : 'rejected', r: 4.5 });
      if (step.ok) layers.push({ type: 'points', points: [[step.from, height(step.from)]], role: 'muted', r: 3.5, hollow: true });
    }
    layers.push({ type: 'points', points: [[x, height(x)]], role: 'current', r: 5.5, ring: true });
    const shown = trace.length > 1200 ? trace.filter((_, i) => i % Math.ceil(trace.length / 1200) === 0) : trace.slice();
    return [
      { kind: 'scene', title: 'Target and samples', x: [X0, X1], y: [0, 1.15], aspect: 0.5, axes: { xLabel: 'x', yLabel: 'height' }, layers, legend },
      { kind: 'scene', title: 'Trace: position of the chain at each step', x: [0, steps], y: [X0, X1], aspect: 0.22, axes: { xLabel: 'step', yLabel: 'x' },
        layers: [
          { type: 'line', points: [[0, LEFT], [steps, LEFT]], role: 'sage', width: 1, dash: true },
          { type: 'line', points: [[0, RIGHT], [steps, RIGHT]], role: 'sage', width: 1, dash: true },
          { type: 'line', points: shown, role: 'terracotta', width: 1.5 },
        ],
        legend: [{ label: 'chain', role: 'terracotta' }, { label: 'centres of the two bumps', role: 'sage' }] },
    ];
  };

  t.frame(() => ({ line: [0, 1], note: `The dark curve is the target: two bumps, with the right one holding 70% of the area. The sampler can ask for the height of the curve at any point but knows nothing else about it. The chain starts at x = ${f2(start)}, where the height is ${f3(hx)}. The aim is a list of samples whose histogram matches the curve.`, views: views(0, null), vars: { x: f2(x), height: f3(hx) } }));

  const stride = steps <= 250 ? 1 : Math.ceil(steps / 250);
  let batchAccepted = 0;
  for (let s = 1; s <= steps; s++) {
    const from = x, hFrom = hx;
    const proposal = rng.normal(x, width);
    const hProp = p(proposal);
    t.count('density evaluations');
    const ratio = hProp / hFrom;
    const u = rng.next();
    const ok = u < ratio;
    if (ok) {
      x = proposal; hx = hProp; accepted++; batchAccepted++;
      t.count('accepted proposals');
    }
    const core = Math.abs(x - LEFT) < 1 ? 'left' : Math.abs(x - RIGHT) < 1 ? 'right' : bump;
    if (core !== bump) { bump = core; switches++; t.count('mode switches'); }
    sum += x;
    if (x < 0) leftCount++;
    const b = Math.floor((x - X0) / BIN);
    if (b >= 0 && b < NBINS) bins[b]++;
    if (picture) trace.push([s, x]);
    if (s <= 300) log.push({ from, proposal, ratio, u, accepted: ok, x });

    if (s % stride === 0 || s === steps) {
      const got = batchAccepted, acc = accepted;
      batchAccepted = 0;
      const lead = stride === 1 ? `Step ${s}.` : `Steps ${s - ((s - 1) % stride)} to ${s}: ${got} ${got === 1 ? 'proposal' : 'proposals'} accepted. In step ${s},`;
      const where = `${stride === 1 ? 'The' : 'the'} chain is at x = ${f2(from)} (height ${f3(hFrom)}) and proposes x′ = ${f2(proposal)} (height ${hProp < 0.0005 ? hProp.toExponential(1) : f3(hProp)}).`;
      const verdict = ratio >= 1
        ? `The target is higher there, ${ratio > 999 ? 'far more than' : f2(ratio) + ' times'} as high, so the move is **accepted** without needing any luck.`
        : ok
          ? `The target there is ${ratio < 0.005 ? ratio.toExponential(1) : f2(ratio)} times as high as here, so the move is accepted with that probability. The random number u = ${f2(u)} is below it: **accepted**.`
          : `The target there is ${ratio < 0.005 ? ratio.toExponential(1) : f2(ratio)} times as high as here, so the move is accepted with that probability. The random number u = ${f2(u)} is not below it: **rejected**. The chain stays at ${f2(from)}, and that position is recorded as a sample again.`;
      t.frame(() => ({ line: ok ? [3, 4, 5, 6, 7, 8] : [3, 4, 5, 6, 8], note: `${lead} ${where} ${verdict}`,
        views: views(s, { from, to: proposal, ok }), vars: { step: s, x: f2(x), 'x′': f2(proposal), ratio: ratio > 999 ? '>999' : f3(ratio), u: f3(u), 'accepted so far': pct(acc / s) } }));
    }
  }

  const mean = sum / steps, leftMass = leftCount / steps, acceptanceRate = accepted / steps;
  t.frame(() => ({ line: 9,
    note: `After ${steps} steps, ${accepted} proposals were accepted (${pct(acceptanceRate)}). The samples have mean ${f2(mean)}; the exact mean of the target is ${f2(EXACT_MEAN)}. ${pct(leftMass)} of the samples lie in the left bump; its exact share is ${pct(EXACT_LEFT)}. ${switches === 0 ? 'The chain never crossed from one bump to the other, so the histogram shows only one of them.' : `The chain crossed between the bumps ${switches} ${switches === 1 ? 'time' : 'times'}. The more often it crosses, the more trustworthy those two numbers are.`}`,
    views: views(steps, null), vars: { samples: steps, mean: f2(mean), 'left share': pct(leftMass), accepted: pct(acceptanceRate) } }));

  return { steps, accepted, acceptanceRate, mean, leftMass, switches, final: x, log, bins, exactMean: EXACT_MEAN, exactLeft: EXACT_LEFT };
}

export default {
  meta: {
    id: 'metropolis-hastings',
    name: 'Metropolis-Hastings',
    aliases: ['Metropolis algorithm', 'MCMC', 'Markov chain Monte Carlo', 'random-walk Metropolis', 'M-H sampler'],
    kind: 'algorithm',
    discipline: 'statistics',
    alsoIn: [
      { id: 'physics', why: 'It was invented to compute the properties of a system of interacting particles, and it remains the basic simulation method of statistical mechanics.' },
      { id: 'machine-learning', why: 'Bayesian models are fitted by drawing samples from a posterior distribution that is known only up to a constant, which is the situation this algorithm is built for.' },
      { id: 'optimization', why: 'Simulated annealing is the same accept-or-reject rule with a temperature that is gradually lowered.' },
    ],
    subfield: 'Markov chain Monte Carlo',
    family: 'Markov chain samplers',
    lab: 'probability-statistics',
    year: 1953,
    authors: 'N. Metropolis, A. W. Rosenbluth, M. N. Rosenbluth, A. H. Teller and E. Teller; generalized by W. K. Hastings (1970)',
    summary: 'Draws samples from a distribution known only up to a constant by a random walk that accepts or rejects each proposed move according to a ratio of densities.',
    difficulty: 'advanced',
    order: 730,
    paradigms: ['randomized-sampling', 'probabilistic-inference'],
    randomized: true,
    approximate: true,
    time: { best: 'O(1) density evaluations per step', average: 'Steps needed depend on how fast the chain mixes', worst: 'No bound in general', class: 'iterative' },
    space: { worst: 'O(d) for the state, plus any samples kept', class: 'linear' },
    tags: {
      problems: ['sample from a complicated distribution', 'draw from a posterior', 'sample when the normalizing constant is unknown', 'simulate a physical system in equilibrium', 'explore a probability landscape'],
      techniques: ['Markov chain', 'accept-reject step', 'random walk', 'detailed balance', 'proposal distribution'],
      applications: ['statistics', 'machine learning', 'scientific computing', 'bioinformatics', 'finance'],
    },
    prerequisites: ['monte-carlo', 'bayesian-updating', 'concept:probability', 'concept:markov-chain', 'concept:sampling', 'concept:gaussian-distribution'],
  },

  bigIdea: {
    simple: "Metropolis-Hastings is a way to explore a landscape in proportion to its height, when you can only measure the height where you stand. Imagine a hiker wandering through hills in fog. She wants to spend most of her time on high ground, and exactly twice as long at places that are twice as high. She has an altimeter but no map. So she follows a simple rule. Pick a random spot nearby and check its height. If it is higher, go there. If it is lower, go there only sometimes: half the time if it is half as high, one time in ten if it is a tenth as high. Otherwise stay put, and write down the place where she is standing once more. Keep a list of everywhere she stood. Over a long walk, that list traces the shape of the whole landscape. Scientists use this to study things they can score but cannot list in full, such as every arrangement of the atoms in a liquid, or every explanation that fits a set of measurements.",
    what: 'Metropolis-Hastings produces samples from a probability distribution by running a random walk. At each step it proposes a move from the current point to a random nearby point, and accepts the move with probability equal to the ratio of the target density at the new point to the density at the old one (or always, if the ratio exceeds 1). If the move is rejected, the current point is recorded again. Over a long run, the fraction of time the walk spends in any region approaches that region\'s probability.',
    why: 'To draw samples directly from a distribution you usually need its normalizing constant, the number that makes the total probability equal 1. For the distributions that matter most in practice, including Bayesian posteriors and the states of physical systems, that constant is an integral or sum over an astronomical number of possibilities. Metropolis-Hastings needs only ratios of the density at two points, and in a ratio the constant cancels.',
    when: 'Use it when you can evaluate a density up to a constant but cannot sample from it directly, and when the quantities you want are averages over the distribution. If independent samples are available, plain [Monte Carlo](#/algorithm/monte-carlo) is better: its samples are not correlated. If the posterior has a closed form, as in [Bayesian updating](#/algorithm/bayesian-updating) with a conjugate prior, no sampling is needed. If you want the single highest point and not samples, use an optimizer or [simulated annealing](#/algorithm/simulated-annealing).',
    interesting: 'The size of the proposed jumps decides everything, and both extremes fail. Tiny jumps are almost always accepted, but the walk creeps and can spend the entire run inside one bump of a distribution that has two. Huge jumps land mostly where the density is negligible and are almost always rejected, so the walk stands still. A high acceptance rate is therefore not a sign of success. You can see all three regimes in the visualization.',
    where: 'It is the basis of Markov chain Monte Carlo, the standard way to fit Bayesian models in statistics and machine learning, and of equilibrium simulations in physics and chemistry. Its accept-or-reject rule also drives simulated annealing.',
    analogy: {
      title: 'A politician touring a chain of islands',
      text: 'A politician wants to spend time on each island of a long chain in proportion to its population, but has no list of populations. Each day they consider moving to a randomly chosen neighbouring island and ask the mayors for the two populations. If the neighbour is larger, they go. If it is smaller, they go with probability equal to the ratio of the populations, and otherwise stay another day. After many days, the number of days spent on each island is proportional to its population.',
      limits: "The islands are few and in a line. Real problems have a continuum of positions in many dimensions, where choosing a good size and direction for the proposed move is the hard part. The story also hides two facts. Successive days are not independent: where the politician is today depends on yesterday, so a week of days is worth far less than seven independent draws. And if two groups of islands are separated by a long stretch of empty ones, the politician may never cross, and nothing in the daily record would reveal that half the population was missed.",
    },
  },

  example: {
    setup: "A curve has two bumps: a smaller one centred at −2, where its height is 0.30, and a larger one centred at 2, where its height is 0.70. A walker starts at −2 and takes four steps. Each step comes with a proposed position, the height of the curve there, and a random number between 0 and 1 to settle the uncertain cases. The rule: divide the height at the proposed position by the height at the current position. If the random number is smaller than the result, move. Otherwise stay. Either way, write down where the walker now stands.",
    steps: [
      "At −2.00 the height is 0.300. The proposal is −1.30, where the height is 0.152. 0.152 / 0.300 = 0.51. The random number is 0.25, which is smaller, so move. Written down so far: −1.30.",
      "At −1.30 the proposal is 0.60, in the valley between the bumps, where the height is 0.045. 0.045 / 0.152 = 0.30. The random number is 0.85, which is not smaller, so stay. Written down: −1.30, −1.30.",
      "Still at −1.30, the proposal is 1.22, on the slope of the larger bump, where the height is 0.301. 0.301 / 0.152 = 1.98. A result above 1 always passes, so move. Written down: −1.30, −1.30, 1.22.",
      "At 1.22 the proposal is −3.23, where the height is 0.037. 0.037 / 0.301 = 0.12. The random number is 0.36, so stay. Written down: −1.30, −1.30, 1.22, 1.22.",
    ],
    result: "The four samples are −1.30, −1.30, 1.22 and 1.22. Two proposals were accepted and two were rejected, and each rejection added a repeat of the current position. In step 3 the walker crossed from one bump to the other in a single jump. Four samples say almost nothing about the curve. It takes thousands before their histogram settles into its shape.",
    tryInput: { width: 2.5, steps: 50, start: -2, seed: 36 },
  },

  terms: [
    { term: "Distribution", meaning: "A description of how likely each possible value is. Its picture is a curve whose height shows how likely values near each point are." },
    { term: "Target", meaning: "The distribution you want samples from. Here it is a curve with two bumps." },
    { term: "Known up to a constant", meaning: "You can compute how high the curve is at one point compared with another, but not the scale that would make the total probability exactly 1." },
    { term: "Sample", meaning: "One value drawn from a distribution. Many samples together show its shape." },
    { term: "Markov chain", meaning: "A sequence of positions in which each one is chosen at random using only the position just before it." },
    { term: "Proposal", meaning: "A candidate next position, chosen at random near the current one." },
    { term: "Acceptance ratio", meaning: "The height of the target at the proposed position divided by its height at the current position." },
    { term: "Mode", meaning: "A peak of a distribution. This target has two." },
    { term: "Mixing", meaning: "How quickly the chain moves around the whole distribution. A chain that mixes slowly gives samples that are nearly copies of each other." },
    { term: "Burn-in", meaning: "The early steps of a chain, before it has reached the region where the target is high. They are often thrown away." },
  ],

  takeaway: "Wander at random, always accept a move to somewhere more probable, accept a move to somewhere less probable only in proportion to how much less, and the places you visit become samples of the distribution.",

  viz: {
    describe: 'The main chart shows the target as a dark curve with a smaller bump at −2 and a larger one at +2. Sage bars form a histogram of the samples collected so far, scaled to the same area as the curve. A terracotta dot marks the current position of the chain on the curve. Each step draws an arrow from the current position to the proposed one: forest green and solid if the proposal was accepted, brick and dashed if it was rejected. A second chart below plots the position of the chain against the step number, with dashed lines at the centres of the two bumps. Histogram bars that would rise above the top of the chart are cut off there.',
    inputs: [
      { id: 'width', type: 'range', scale: 'log', label: 'Proposal width', min: 0.05, max: 50, default: 2.5,
        help: 'Standard deviation of the random jump that is proposed at each step. Logarithmic slider.' },
      { id: 'steps', type: 'range', label: 'Steps', min: 50, max: 3000, step: 50, default: 250,
        help: 'Up to 250 steps are shown one at a time. Longer runs are shown in batches.' },
      { id: 'start', type: 'range', label: 'Starting position', min: -5, max: 5, step: 0.5, default: -2 },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 36 },
    ],
    presets: [
      { label: 'Reasonable width', values: { width: 2.5, steps: 250, start: -2, seed: 36 } },
      { label: 'Too small: stuck in one bump', values: { width: 0.15, steps: 250, start: -2, seed: 36 } },
      { label: 'Too large: mostly rejections', values: { width: 40, steps: 250, start: -2, seed: 9 } },
      { label: 'Starting far out in the tail', values: { width: 0.2, steps: 250, start: 5, seed: 36 } },
      { label: 'Long run', values: { width: 2.5, steps: 3000, start: -2, seed: 36 } },
    ],
    tryThis: [
      'Load "Too small: stuck in one bump". Nearly every proposal is accepted, yet the trace never leaves the left bump and the histogram misses 70% of the distribution. Then look at the trace for "Reasonable width": it hops between the bumps.',
      'Load "Too large: mostly rejections". The trace is a staircase of long flat stretches, because most proposals land far out where the curve is nearly zero. Each flat stretch is the same sample recorded again and again.',
      'Load "Long run" and compare the histogram with the curve. Then change the seed a few times and watch the share of samples in the left bump. It should stay near 30%, and it varies less than it does over 250 steps.',
      'Load "Starting far out in the tail". The first stretch of the trace is the chain climbing toward the bump. Those early samples describe the starting point, not the target, which is why the beginning of a chain is usually discarded.',
    ],
    run,
    report: (r, c) => `${r.steps} samples. Accepted ${r.accepted} proposals (${pct(r.acceptanceRate)}). Crossed between the bumps ${r.switches} ${r.switches === 1 ? 'time' : 'times'}.\nMean of samples: ${f2(r.mean)} (exact ${f2(r.exactMean)}). Share in the left bump: ${pct(r.leftMass)} (exact ${pct(r.exactLeft)}).\n${c['density evaluations'] || 0} evaluations of the target.`,
    experiment: {
      title: 'Crossings between the bumps as the proposal width changes',
      note: 'Each point is one real run of 5000 steps from x = −2. The count is the number of accepted moves that carry the chain from one side of zero to the other. Narrow proposals almost never cross the valley. Very wide proposals are almost always rejected. The chain explores best in between.',
      metric: 'mode switches',
      metricLabel: 'Crossings in 5000 steps',
      sizeLabel: 'Proposal width',
      sizes: [0.1, 0.2, 0.5, 1, 2, 3, 5, 8, 12, 20, 40],
      variants: [{ id: 'random-walk', label: 'Random-walk Metropolis' }],
      input: (width, variant, seed) => ({ width, steps: 5000, start: -2, seed }),
    },
  },

  logic: {
    intuition: 'Think of a huge crowd of walkers spread over the line in proportion to the target. Let every walker take one step by the rule. For the crowd to keep its shape, the number of walkers stepping from any point a to any point b must equal the number stepping from b to a. Suppose b is half as high as a. Then there are half as many walkers at b, and all of them accept the uphill move to a. To balance, only half of the twice-as-many walkers at a may make the downhill move to b. That is exactly the rule: accept a downhill move with probability equal to the ratio of the heights. A single walker following the rule for a long time visits places in the same proportions as the crowd.',
    steps: [
      'Choose a starting point x, a proposal width w and a number of steps n. The function p gives the height of the target, up to a constant.',
      'Propose a new point x′ by adding a random jump to x. Here the jump is drawn from a normal distribution centred on zero, so a jump and its reverse are equally likely.',
      'Compute the acceptance ratio: the target height at x′ divided by the target height at x. Any constant factor in the target cancels.',
      'Draw a uniform random number u between 0 and 1. If u is less than the ratio, move to x′. A ratio of 1 or more always passes.',
      'Otherwise stay at x.',
      'Record the current position as a sample, whether or not the chain moved, and repeat from step 2.',
    ],
    pseudocode: [
      'metropolis(p, x₀, w, n):',
      '  x ← x₀',
      '  repeat n times:',
      '    x′ ← x + w·normal(0, 1)',
      '    ratio ← p(x′) / p(x)',
      '    u ← uniform(0, 1)',
      '    if u < ratio:',
      '      x ← x′',
      '    record x as a sample',
      '  return the samples',
    ],
    decisions: [
      { title: 'How wide should proposals be?', text: 'Wide enough to cross the distribution in a modest number of steps, narrow enough that a useful fraction is accepted. For a single bell-shaped target, theory suggests tuning toward an acceptance rate of roughly 44% in one dimension, falling to about 23% in many dimensions. For a target with separated bumps, like this one, the acceptance rate says little: what matters is whether the chain crosses between them.' },
      { title: 'What if the proposal is lopsided?', text: 'If jumping from x to x′ is not as likely as jumping back, the ratio must be corrected by the proposal densities: multiply by q(x | x′) / q(x′ | x). This correction is the contribution of Hastings. With a symmetric proposal, as on this page, the correction equals 1 and the method is the original Metropolis algorithm.' },
      { title: 'Which samples to keep?', text: 'If the chain starts far from where the target is high, discard an initial stretch, the burn-in. Keeping only every tenth or hundredth sample (thinning) saves memory but does not improve the estimate. The chain on this page starts inside a bump by default and keeps everything.' },
      { title: 'How to know it worked?', text: 'There is no certificate. Standard practice is to run several chains from scattered starting points and check that they agree, and to estimate how many independent samples the correlated ones are worth.' },
    ],
    invariants: [
      'The target distribution is stationary: if the current position is distributed according to the target, so is the next one.',
      'Every step records exactly one sample, whether the proposal was accepted or not.',
      'A proposal to a point where the target is at least as high as the current point is always accepted.',
    ],
    edgeCases: [
      'Separated modes: with narrow proposals the chain can stay in one mode for the whole run and report a confident, wrong answer.',
      'A starting point where the target is zero makes the first ratio a division by zero. Start where the target is positive.',
      'Proposals outside the support (where the target is zero) have ratio 0 and are always rejected, which is correct.',
      'Very small densities underflow to zero in floating point. Practical code works with logarithms: accept if log u < log p(x′) − log p(x).',
      'High dimensions: random-walk proposals must shrink as dimensions are added to keep being accepted, so progress slows. Gradient-based samplers were developed for this.',
    ],
    correctness: 'The chain satisfies detailed balance with respect to the target π: for any two points, π(x) × (probability of moving from x to x′) equals π(x′) × (probability of moving from x′ to x). For a symmetric proposal both sides equal the proposal density times min(π(x), π(x′)). Detailed balance implies that π is a stationary distribution of the chain. If the chain can also reach every region of positive probability and is not periodic, which holds for normal proposals on this target, then the distribution of its position converges to π from any starting point, and averages along the chain converge to averages under π. This is a statement about the limit. It says nothing about how many steps are enough, and for a badly chosen proposal the answer can exceed any practical run.',
    mistakes: [
      'Recording a sample only when a proposal is accepted. Rejected steps must record the current position again, or regions of high probability are under-counted.',
      'Using an asymmetric proposal without the Hastings correction.',
      'Reading a high acceptance rate as proof of good sampling.',
      'Treating the samples as independent when computing an error bar, which makes the error look far smaller than it is.',
      'Multiplying many small probabilities directly and dividing zero by zero, when the calculation should be done with logarithms.',
      'Running one chain, seeing a stable trace, and concluding that it has found the whole distribution.',
    ],
  },

  code: {
    sample: {
      input: 'Sample the two-bump target for 50,000 steps from x = −2 with three proposal widths, using a small generator that behaves identically in every language (seed 2024).',
      expected: 'width  0.1: accepted 94.8%  mean -0.13  left bump  53.1%\nwidth  2.5: accepted 36.3%  mean  0.77  left bump  30.7%\nwidth 40.0: accepted  3.4%  mean  0.74  left bump  31.8%\nexact target:                mean  0.80  left bump  30.0%',
    },
    python: {
      source: `import math


class Lcg:
    """A small random number generator (Park-Miller). Integer arithmetic only,
    so it produces the same numbers in every language."""

    def __init__(self, seed):
        self.state = seed

    def uniform(self):
        self.state = self.state * 48271 % 2147483647
        return self.state / 2147483647

    def normal(self):
        u = self.uniform()
        v = self.uniform()
        return math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * v)


def height(x):
    """The target, known only up to a constant: bumps at -2 and +2."""
    a = x + 2
    b = x - 2
    return 0.3 * math.exp(-a * a / 0.72) + 0.7 * math.exp(-b * b / 0.72)


def metropolis(x, width, steps, rng):
    accepted = 0
    total = 0.0
    left = 0
    for _ in range(steps):
        proposal = x + width * rng.normal()
        ratio = height(proposal) / height(x)
        if rng.uniform() < ratio:
            x = proposal
            accepted += 1
        total += x                      # record x, whether or not it moved
        if x < 0:
            left += 1
    return accepted / steps, total / steps, left / steps


for width in [0.1, 2.5, 40.0]:
    rate, mean, left = metropolis(-2.0, width, 50000, Lcg(2024))
    print(f"width {width:4.1f}: accepted {100 * rate:4.1f}%  mean {mean:5.2f}  left bump {100 * left:5.1f}%")
print("exact target:                mean  0.80  left bump  30.0%")`,
      notes: [
        { line: 18, text: 'The Box-Muller method turns two uniform random numbers into one standard normal number. It supplies the random jump.' },
        { line: 25, text: 'The target is never normalized. Multiplying this function by any constant would leave every ratio, and so the whole run, unchanged.' },
        { line: 34, text: 'The only place the target enters: a ratio of heights at the proposed and current points.' },
        { line: 35, text: 'A uniform number is below the ratio with probability min(1, ratio). When the ratio is 1 or more the test always passes.' },
        { line: 38, text: 'This line sits outside the `if`. A rejected proposal still contributes the current position as a sample.' },
      ],
    },
    javascript: {
      source: `// A small random number generator (Park-Miller). Integer arithmetic only,
// so it produces the same numbers in every language.
class Lcg {
  constructor(seed) { this.state = seed; }
  uniform() {
    this.state = (this.state * 48271) % 2147483647;
    return this.state / 2147483647;
  }
  normal() {
    const u = this.uniform();
    const v = this.uniform();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

// The target, known only up to a constant: bumps at -2 and +2.
function height(x) {
  const a = x + 2;
  const b = x - 2;
  return 0.3 * Math.exp(-a * a / 0.72) + 0.7 * Math.exp(-b * b / 0.72);
}

function metropolis(x, width, steps, rng) {
  let accepted = 0, total = 0, left = 0;
  for (let s = 0; s < steps; s++) {
    const proposal = x + width * rng.normal();
    const ratio = height(proposal) / height(x);
    if (rng.uniform() < ratio) {
      x = proposal;
      accepted += 1;
    }
    total += x;                         // record x, whether or not it moved
    if (x < 0) left += 1;
  }
  return [accepted / steps, total / steps, left / steps];
}

for (const width of [0.1, 2.5, 40.0]) {
  const [rate, mean, left] = metropolis(-2.0, width, 50000, new Lcg(2024));
  console.log("width " + width.toFixed(1).padStart(4, " ") + ": accepted " + (100 * rate).toFixed(1).padStart(4, " ") +
    "%  mean " + mean.toFixed(2).padStart(5, " ") + "  left bump " + (100 * left).toFixed(1).padStart(5, " ") + "%");
}
console.log("exact target:                mean  0.80  left bump  30.0%");`,
    },
    cpp: {
      source: `#include <cmath>
#include <cstdio>

// A small random number generator (Park-Miller). Integer arithmetic only,
// so it produces the same numbers in every language.
struct Lcg {
    long long state;
    double uniform() {
        state = state * 48271 % 2147483647;
        return static_cast<double>(state) / 2147483647.0;
    }
    double normal() {
        double u = uniform();
        double v = uniform();
        return std::sqrt(-2 * std::log(u)) * std::cos(2 * M_PI * v);
    }
};

// The target, known only up to a constant: bumps at -2 and +2.
double height(double x) {
    double a = x + 2;
    double b = x - 2;
    double left = 0.3 * std::exp(-a * a / 0.72);
    double right = 0.7 * std::exp(-b * b / 0.72);
    return left + right;
}

int main() {
    const double widths[] = {0.1, 2.5, 40.0};
    const int steps = 50000;
    for (double width : widths) {
        Lcg rng{2024};
        double x = -2.0, total = 0.0;
        int accepted = 0, left = 0;
        for (int s = 0; s < steps; ++s) {
            double jump = width * rng.normal();
            double proposal = x + jump;
            double ratio = height(proposal) / height(x);
            if (rng.uniform() < ratio) {
                x = proposal;
                accepted += 1;
            }
            total += x;                 // record x, whether or not it moved
            if (x < 0) left += 1;
        }
        std::printf("width %4.1f: accepted %4.1f%%  mean %5.2f  left bump %5.1f%%\\n",
                    width, 100.0 * accepted / steps, total / steps, 100.0 * left / steps);
    }
    std::printf("exact target:                mean  0.80  left bump  30.0%%\\n");
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'One step costs one evaluation of the target density (the value at the current point is remembered) plus a few random numbers. The real cost is the number of steps needed, and that is governed by how correlated successive samples are. A run of n steps is worth only n divided by the autocorrelation time in independent samples, and that time can range from a handful of steps to more steps than any computer could run.',
    cases: [
      { case: 'Per step', time: 'O(1) density evaluations', when: 'Always. For a statistical model one density evaluation usually means a pass over the data.' },
      { case: 'Error of an average after n steps', time: 'About σ √(τ / n)', when: 'τ is the integrated autocorrelation time: the number of steps that carry as much information as one independent sample. With τ = 1 this is the plain Monte Carlo rate.' },
      { case: 'Random walk in d dimensions, bell-shaped target', time: 'τ grows in proportion to d', when: 'With the proposal width tuned optimally, which means shrinking it like 1/√d. This is a result for idealized targets.' },
      { case: 'Separated modes, local proposals', time: 'τ grows in inverse proportion to the density in the valley', when: 'Crossing requires a run of unlikely accepted moves or one very lucky jump. In physical systems the valley density falls exponentially with the height of the energy barrier.' },
    ],
    space: 'O(d) for the current state in d dimensions. Stored samples take O(n d); averages can be accumulated on the fly instead, as the code samples do.',
    memory: 'The algorithm itself needs to remember only where it is. Diagnostics need more: several chains, and enough history to estimate autocorrelation.',
    tradeoffs: 'Random-walk Metropolis asks almost nothing of the target, only pointwise evaluation up to a constant. It pays for that generality with correlated samples and sensitivity to the proposal. Samplers that use gradients or the conditional structure of the model mix much faster on the problems they fit.',
    assumptions: [
      'The target density can be evaluated at any point, up to a constant factor.',
      'The error formula assumes the chain has reached its stationary distribution and that τ is finite.',
      'The dimension-scaling results are proved for idealized product-form targets and serve as guidance, not guarantees.',
      'The experiment on this page counts crossings in single runs of a one-dimensional example. It illustrates the effect of the proposal width and is not a general benchmark.',
    ],
  },

  tradeoffs: {
    excels: [
      'Distributions known only up to a normalizing constant, the usual situation for Bayesian posteriors.',
      'Targets defined by a program or a simulation, where only evaluation is possible.',
      'Low to moderate dimensions with a single dominant region of probability.',
    ],
    struggles: [
      'Several well-separated modes: the chain may never find some of them.',
      'High dimensions and strongly correlated variables, where random-walk proposals are either tiny or rejected.',
      'Problems where each density evaluation is expensive, since thousands of them are needed per effectively independent sample.',
    ],
    misunderstandings: [
      "\"A high acceptance rate means the sampler is working well.\" Tiny steps are accepted almost every time and go almost nowhere. In the visualization, the run that accepts over 90% of its proposals is the one that misses most of the distribution.",
      "\"Rejected proposals are wasted and should be left out of the samples.\" When a proposal is rejected, the current position must be recorded again. Leaving those repeats out gives too little weight to the most probable places.",
      "\"Ten thousand samples from the chain are as good as ten thousand independent samples.\" Each sample depends on the one before, so they carry less information. A slowly mixing chain may be worth only a few dozen independent draws.",
      "\"If the trace looks stable, the chain has converged.\" A chain stuck in one mode has a perfectly stable trace. Stability shows that the chain is not moving between regions, not that there are no other regions.",
    ],
    pitfalls: [
      'Tuning the proposal while collecting the samples that will be used, which breaks the guarantee unless done with care.',
      'Numerical underflow when densities are computed directly and not as logarithms.',
      'Reporting results from a single chain with no convergence check.',
    ],
    constraints: [
      'Modern statistical software uses gradient-based samplers such as Hamiltonian Monte Carlo for continuous models, because random-walk proposals scale poorly with dimension.',
      'Diagnostics can reveal failure but cannot prove success.',
    ],
    alternatives: [
      { id: 'monte-carlo', name: 'Plain Monte Carlo', when: 'Independent samples can be drawn directly. No correlation, no tuning.' },
      { id: 'simulated-annealing', name: 'Simulated Annealing', when: 'You want the highest point of the landscape and not samples from it.' },
      { name: 'Gibbs sampling', when: 'Each variable can be sampled exactly given the others. Every move is accepted.' },
      { name: 'Hamiltonian Monte Carlo', when: 'The target is continuous and its gradient is available. Proposals follow the shape of the density and travel far.' },
      { name: 'Rejection or importance sampling', when: 'A simple distribution that resembles the target is available, usually only in low dimensions.' },
    ],
    comparison: {
      columns: ['', 'Random-walk Metropolis', 'Plain Monte Carlo', 'Hamiltonian Monte Carlo'],
      rows: [
        ['Needs', 'Density up to a constant', 'A way to draw independent samples', 'Density up to a constant, and its gradient'],
        ['Samples', 'Correlated', 'Independent', 'Weakly correlated when well tuned'],
        ['Tuning', 'Proposal width', 'None', 'Step size and path length'],
        ['High dimensions', 'Slow', 'Unaffected, if sampling is possible', 'Much better than a random walk'],
      ],
    },
  },

  applications: [
    { title: 'Statistical mechanics', status: 'established', text: 'The original application: the 1953 paper computed the equation of state of a system of hard disks by sampling their arrangements. The same method simulates magnets, liquids and polymers, with the Boltzmann factor as the unnormalized density.' },
    { title: 'Bayesian data analysis', status: 'established', text: 'A posterior is proportional to prior times likelihood, with a normalizing constant that is rarely computable. Since about 1990, Markov chain Monte Carlo has been the standard way to obtain posterior samples, and Metropolis-Hastings steps are part of most general-purpose samplers.' },
    { title: 'Inferring evolutionary trees', status: 'established', text: 'Bayesian phylogenetics programs such as MrBayes and BEAST use Metropolis-Hastings moves over tree shapes and branch lengths to sample the trees that are plausible given DNA sequences.' },
    { title: 'Simulated annealing', status: 'established', text: 'Kirkpatrick, Gelatt and Vecchi turned the Metropolis rule into an optimization method in 1983 by lowering a temperature parameter during the run, so that the chain settles into low-cost states.' },
    { title: 'Fitting a model with a few unknowns', status: 'illustrative', text: 'To fit a curve with three parameters to noisy data, write down the prior and the likelihood, run a chain over the three numbers, and read off the spread of each parameter from the samples.' },
  ],

  connections: [
    { to: 'monte-carlo', type: 'prerequisite', why: 'Both estimate averages from random samples. Metropolis-Hastings supplies the samples when they cannot be drawn directly, and its error analysis is the Monte Carlo one with a penalty for correlation.' },
    { to: 'bayesian-updating', type: 'prerequisite', why: 'A posterior is prior times likelihood divided by a constant. When that constant has no formula, this algorithm samples the posterior using only the product.' },
    { to: 'simulated-annealing', type: 'variant', why: 'Annealing uses the same accept-or-reject rule on exp(−cost / T) and lowers T over time. At a fixed temperature it is a Metropolis sampler.' },
    { to: 'gradient-descent', type: 'related', why: 'Both walk across a landscape using only local information. Descent always moves toward better values and stops at the nearest optimum; Metropolis sometimes moves to worse values, which lets it report the whole shape.' },
    { to: 'ddpm', type: 'related', why: 'Both generate samples from a complicated distribution through a Markov chain of small random moves. A diffusion model learns its chain from data and runs it for a fixed number of steps.' },
    { to: 'pagerank', type: 'related', why: 'Both rest on the long-run distribution of a Markov chain. PageRank computes the stationary distribution of a given chain; Metropolis-Hastings designs a chain whose stationary distribution is the one you want.' },
    { to: 'reservoir-sampling', type: 'related', why: 'Both admit a candidate with a probability calculated so that the outcome has exactly the intended distribution.' },
    { to: 'particle-filter', type: 'related', why: 'Both represent a distribution by samples when no formula is available. Particle filters reweight a population of samples over time, and some use Metropolis-Hastings moves to keep the population diverse.' },
    { to: 'concept:markov-chain', type: 'prerequisite', why: 'The samples are the states of a Markov chain constructed to have the target as its stationary distribution.' },
    { to: 'concept:sampling', type: 'prerequisite', why: 'The goal is a set of draws whose frequencies match a given distribution.' },
    { to: 'discipline:physics', type: 'application', why: 'Equilibrium properties of many-particle systems are averages over the Boltzmann distribution, which is known only up to the partition function.' },
    { to: 'discipline:machine-learning', type: 'application', why: 'Bayesian learning needs posterior samples over model parameters, and the posterior is known only up to its evidence term.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'The chain is at a point where the target has height 0.6. It proposes a point where the height is 0.15. What happens?',
      options: ['The move is always rejected, because the new point is lower', 'The move is accepted with probability 0.25', 'The move is accepted with probability 0.45', 'The move is always accepted'],
      answer: 1,
      explain: [
        'Downhill moves must sometimes be accepted, or the chain would only climb and never sample the lower regions at all.',
        'Correct. The ratio is 0.15 / 0.6 = 0.25, so the move is accepted when the uniform random number falls below 0.25.',
        '0.45 is the difference of the heights. The rule uses their ratio.',
        'Only moves to a point at least as high are always accepted.',
      ],
    },
    {
      type: 'predict',
      q: 'The chain starts in the left bump and uses a proposal width of 0.15 for 250 steps. What will the samples show?',
      options: ['Both bumps, in the right proportions', 'Only the left bump, with most proposals accepted', 'Only the left bump, with most proposals rejected', 'Only the right bump, because it is higher'],
      answer: 1,
      explain: [
        'To reach the right bump the chain must cross a valley where the target is very low. With steps of about 0.15 that almost never happens within 250 steps.',
        'Correct. Small steps barely change the height, so nearly all are accepted, yet the chain never leaves the bump it started in. The run reports a mean near −2 when the true mean is 0.8.',
        'Rejections are the signature of proposals that are too wide, not too narrow.',
        'The chain has no knowledge of the right bump. It can only compare the heights of places it proposes.',
      ],
      tryInput: { width: 0.15, steps: 250, start: -2, seed: 36 },
    },
    {
      type: 'debug',
      q: 'The histogram from this sampler is too flat: it has too few samples at the peaks. What is wrong?',
      code: `for _ in range(steps):
    proposal = x + width * rng.normal()
    if rng.uniform() < height(proposal) / height(x):
        x = proposal
        samples.append(x)`,
      options: ['The ratio is upside down', 'A sample is recorded only when a proposal is accepted', 'The proposal should not depend on x', 'It should compare with 1 − ratio'],
      answer: 1,
      explain: [
        'The ratio is new height over current height, which is right.',
        'Correct. `samples.append(x)` belongs outside the `if`. At a peak most proposals are rejected, and each rejection should add another copy of the peak to the samples.',
        'A random walk proposal is centred on the current point by design.',
        'Accepting when u is below the ratio is the correct test.',
      ],
    },
    {
      type: 'choice',
      q: 'Why can the algorithm sample a distribution whose normalizing constant is unknown?',
      options: ['It estimates the constant during burn-in', 'It only ever uses the ratio of the density at two points, where the constant cancels', 'It assumes the constant is 1', 'The constant only matters in high dimensions'],
      answer: 1,
      explain: [
        'No estimate of the constant is ever formed.',
        'Correct. Multiplying the density by any constant changes numerator and denominator alike, so every accept-or-reject decision is unchanged.',
        'No assumption about its value is needed.',
        'The constant is equally irrelevant to the algorithm in every dimension.',
      ],
    },
    {
      type: 'challenge',
      title: 'Measure what the samples are worth',
      prompt: 'Run the sampler on the two-bump target for 100,000 steps at each of the widths 0.5, 1, 2.5, 5 and 10. For each run, estimate the integrated autocorrelation time of x (1 plus twice the sum of the autocorrelations at lags 1, 2, 3 and so on, stopping when they become noise) and report the effective sample size, the number of steps divided by that time. Which width gives the most effective samples per step, and what is its acceptance rate? Then run four chains from different starting points at width 0.5 and compare their means.',
      hints: ['A simple stopping rule: add up autocorrelations until the first one that is negative.', 'With width 0.5 the chains started in different bumps may disagree badly. That disagreement is the basis of standard convergence diagnostics.'],
    },
  ],

  compare: {
    idea: 'Random walk with an accept-or-reject step based on the ratio of target densities.',
    requires: 'The target density at any point, up to a constant. Converges to the target in the limit of a long run; no guarantee for a finite one.',
    sensitivity: 'High. Performance depends strongly on the proposal width, the starting point and the shape of the target.',
    memory: 'O(d) for the current state.',
    difficulty: 'moderate',
    difficultyNote: 'Ten lines to write, and a good deal of judgement to tune and to check.',
    limits: 'Correlated samples. Can miss separated modes entirely. Slow in high dimensions.',
    useWhen: 'You can evaluate a density up to a constant, cannot sample it directly, and want averages over it.',
  },

  advanced: {
    history: 'The algorithm appeared in 1953 in a paper by Nicholas Metropolis, Arianna Rosenbluth, Marshall Rosenbluth, Augusta Teller and Edward Teller, who used the MANIAC computer at Los Alamos to compute the equation of state of a two-dimensional system of hard disks. W. Keith Hastings generalized it in 1970 to proposals that are not symmetric and presented it as a general statistical tool. Stuart and Donald Geman introduced the Gibbs sampler for image models in 1984. The method became central to statistics after Alan Gelfand and Adrian Smith showed in 1990 how such samplers make Bayesian computation routine. Accounts differ on how the 1953 work was divided among its authors; Marshall Rosenbluth later said that he and Arianna Rosenbluth did most of it.',
    derivation: 'We want a transition rule $P(x \\to x\')$ whose stationary distribution is the target $\\pi$. A sufficient condition is detailed balance:\n\n$$\\pi(x)\\,P(x \\to x\') = \\pi(x\')\\,P(x\' \\to x) \\quad \\text{for all } x, x\'.$$\n\nBuild the transition in two stages: propose $x\'$ from a density $q(x\' \\mid x)$, then accept with probability $\\alpha(x, x\')$. For $x\' \\ne x$ this gives $P(x \\to x\') = q(x\' \\mid x)\\,\\alpha(x, x\')$. The choice\n\n$$\\alpha(x, x\') = \\min\\!\\left(1,\\; \\frac{\\pi(x\')\\,q(x \\mid x\')}{\\pi(x)\\,q(x\' \\mid x)}\\right)$$\n\nsatisfies detailed balance, because both sides then equal $\\min\\big(\\pi(x)\\,q(x\' \\mid x),\\; \\pi(x\')\\,q(x \\mid x\')\\big)$. Only the ratio $\\pi(x\')/\\pi(x)$ appears, so $\\pi$ may be replaced by any multiple of itself. When $q$ is symmetric, $q(x\' \\mid x) = q(x \\mid x\')$, the proposal terms cancel and $\\alpha = \\min(1, \\pi(x\')/\\pi(x))$: the Metropolis rule used on this page.',
    proof: 'Detailed balance implies stationarity. Suppose $x$ is distributed according to $\\pi$. The density of the next state at $x\'$ is\n\n$$\\int \\pi(x)\\,P(x \\to x\')\\,dx = \\int \\pi(x\')\\,P(x\' \\to x)\\,dx = \\pi(x\') \\int P(x\' \\to x)\\,dx = \\pi(x\'),$$\n\nusing detailed balance in the first step and the fact that transition probabilities out of $x\'$ total 1 in the last. (The probability of staying put, which includes all rejections, is part of $P$ and satisfies the balance condition trivially.) Convergence to $\\pi$ from an arbitrary start additionally requires that the chain be irreducible and aperiodic. A normal proposal can reach any interval from any point in one step, which gives irreducibility on this target, and the positive probability of rejection gives aperiodicity.',
    complexityProof: 'For a stationary chain with autocorrelation $\\rho_k$ at lag $k$, the variance of the average of $n$ successive values of $f(x)$ is approximately\n\n$$\\operatorname{Var}\\!\\left(\\bar f_n\\right) \\approx \\frac{\\sigma_f^2}{n}\\,\\tau, \\qquad \\tau = 1 + 2\\sum_{k=1}^{\\infty} \\rho_k.$$\n\nThe quantity $n/\\tau$ is the effective sample size. Independent samples have $\\tau = 1$, which recovers the Monte Carlo standard error $\\sigma_f/\\sqrt{n}$.',
    variants: [
      { name: 'Independence sampler', text: 'Proposes from a fixed distribution that does not depend on the current point. Works well only if that distribution resembles the target.' },
      { name: 'Gibbs sampling', text: 'Updates one variable at a time by drawing from its exact conditional distribution. It is a Metropolis-Hastings step whose acceptance probability is always 1.' },
      { name: 'Metropolis-adjusted Langevin algorithm', text: 'Shifts the proposal in the direction of the gradient of the log density, so that moves tend toward higher probability.' },
      { name: 'Hamiltonian Monte Carlo', text: 'Uses the gradient to simulate a physical trajectory and proposes its distant end point, which is accepted with high probability.' },
      { name: 'Parallel tempering', text: 'Runs several chains on flattened versions of the target and swaps their states, which lets the chain of interest cross between separated modes.' },
      { name: 'Adaptive Metropolis', text: 'Tunes the proposal from the history of the chain, with conditions that preserve convergence.' },
    ],
    implementation: 'Work with log densities and accept when log u < log π(x′) − log π(x). Cache the log density of the current point. Run several chains from dispersed starting points and compare them, for example with the R-hat statistic, and report effective sample sizes with the estimates. In more than one dimension, scale the proposal to the spread of each variable.',
    benchmarking: 'Compare samplers by effective sample size per unit of computing time, not by acceptance rate or raw sample count. Test on targets with known moments, as the tests of this lesson do, and include a target with more than one mode.',
    references: [
      { authors: 'N. Metropolis, A. W. Rosenbluth, M. N. Rosenbluth, A. H. Teller and E. Teller', year: 1953, title: 'Equation of state calculations by fast computing machines', venue: 'The Journal of Chemical Physics 21(6), 1087-1092' },
      { authors: 'W. K. Hastings', year: 1970, title: 'Monte Carlo sampling methods using Markov chains and their applications', venue: 'Biometrika 57(1), 97-109' },
      { authors: 'A. E. Gelfand and A. F. M. Smith', year: 1990, title: 'Sampling-based approaches to calculating marginal densities', venue: 'Journal of the American Statistical Association 85(410), 398-409' },
      { authors: 'G. O. Roberts, A. Gelman and W. R. Gilks', year: 1997, title: 'Weak convergence and optimal scaling of random walk Metropolis algorithms', venue: 'The Annals of Applied Probability 7(1), 110-120' },
      { authors: 'C. P. Robert and G. Casella', year: 2004, title: 'Monte Carlo Statistical Methods (2nd edition)', venue: 'Springer' },
    ],
    furtherReading: [
      'S. Chib and E. Greenberg, "Understanding the Metropolis-Hastings algorithm", *The American Statistician* 49(4), 327-335 (1995).',
      'J. K. Kruschke, *Doing Bayesian Data Analysis* (2nd edition, Academic Press, 2015), which introduces the algorithm with the island-hopping politician.',
      'J. E. Gubernatis, "Marshall Rosenbluth and the Metropolis algorithm", *Physics of Plasmas* 12, 057303 (2005).',
    ],
  },

  tests: [
    { name: 'the acceptance rule holds at every step, and every step records one sample', input: { width: 2.5, steps: 250, start: -2, seed: 36 },
      check: (r, c) => {
        let at = -2;
        for (const [i, e] of r.log.entries()) {
          if (e.from !== at) return `step ${i + 1} does not start where the previous one ended`;
          if (Math.abs(e.ratio - height(e.proposal) / height(e.from)) > 1e-12) return `step ${i + 1}: wrong ratio`;
          if (e.accepted !== (e.u < e.ratio)) return `step ${i + 1}: accepted is ${e.accepted} but u = ${e.u}, ratio = ${e.ratio}`;
          if (e.ratio >= 1 && !e.accepted) return `step ${i + 1}: an uphill move was rejected`;
          if (e.x !== (e.accepted ? e.proposal : e.from)) return `step ${i + 1}: wrong next position`;
          at = e.x;
        }
        const recorded = r.bins.reduce((a, b) => a + b, 0);
        const acc = r.log.filter((e) => e.accepted).length;
        return (r.log.length === 250 && recorded === 250 && acc === r.accepted && c['accepted proposals'] === acc && c['density evaluations'] === 251) || `recorded ${recorded} samples, ${acc} accepted`;
      } },
    { name: 'the worked example: the first four steps with seed 36', input: { width: 2.5, steps: 50, start: -2, seed: 36 },
      check: (r) => {
        const want = [[-2.0, -1.3, 0.152, 0.51, 0.25, true], [-1.3, 0.6, 0.045, 0.3, 0.85, false], [-1.3, 1.22, 0.301, 1.98, null, true], [1.22, -3.23, 0.037, 0.12, 0.36, false]];
        for (const [i, [from, prop, h, ratio, u, ok]] of want.entries()) {
          const e = r.log[i];
          if (f2(e.from) !== f2(from) || f2(e.proposal) !== f2(prop) || f3(height(e.proposal)) !== f3(h) || f2(e.ratio) !== f2(ratio) || (u !== null && f2(e.u) !== f2(u)) || e.accepted !== ok) {
            return `step ${i + 1}: from ${f2(e.from)} to ${f2(e.proposal)}, height ${f3(height(e.proposal))}, ratio ${f2(e.ratio)}, u ${f2(e.u)}, accepted ${e.accepted}`;
          }
        }
        return (f3(height(-2)) === '0.300' && f3(height(2)) === '0.700') || 'peak heights are not 0.30 and 0.70';
      } },
    { name: 'known values of the target: mean 0.8, left share about 0.3002', input: { width: 2.5, steps: 50, start: -2, seed: 1 },
      check: (r) => {
        const mean = integrate((x) => x * height(x), -12, 12) / integrate(height, -12, 12);
        return (Math.abs(mean - 0.8) < 1e-9 && Math.abs(r.exactMean - 0.8) < 1e-12 && Math.abs(r.exactLeft - 0.30017) < 2e-5 && Math.abs(integrate(height, -12, 12) - AREA) < 1e-9) || `mean ${mean}, left ${r.exactLeft}`;
      } },
    { name: 'long runs approach the known mean and the known mass of each bump', input: { width: 2.5, steps: 250, start: -2, seed: 36 },
      check: () => {
        for (const seed of [11, 12, 13]) {
          const r = run({ width: 2.5, steps: 200000, start: -2, seed }, QUIET);
          if (Math.abs(r.mean - EXACT_MEAN) > 0.08) return `seed ${seed}: mean ${r.mean.toFixed(4)}, expected ${EXACT_MEAN}`;
          if (Math.abs(r.leftMass - EXACT_LEFT) > 0.02) return `seed ${seed}: left share ${r.leftMass.toFixed(4)}, expected ${EXACT_LEFT.toFixed(4)}`;
          if (!(r.acceptanceRate > 0.3 && r.acceptanceRate < 0.42)) return `seed ${seed}: acceptance rate ${r.acceptanceRate.toFixed(3)}`;
        }
        return true;
      } },
    { name: 'multiplying the target by a constant changes nothing', input: { width: 2.5, steps: 250, start: -2, seed: 36 },
      check: (r) => {
        const scaled = run({ width: 2.5, steps: 250, start: -2, seed: 36, scale: 1024 }, QUIET);
        return (scaled.accepted === r.accepted && scaled.final === r.final && scaled.mean === r.mean) || 'the scaled target gave a different run';
      } },
    { name: 'quiz and preset: width 0.15 stays in the left bump although over 90% of proposals are accepted', input: { width: 0.15, steps: 250, start: -2, seed: 36 },
      check: (r) => (r.leftMass === 1 && r.switches === 0 && r.acceptanceRate > 0.9 && r.mean < -1.5) || `left share ${r.leftMass}, crossings ${r.switches}, acceptance ${r.acceptanceRate}` },
    { name: 'preset: width 40 rejects more than 90% of proposals', input: { width: 40, steps: 250, start: -2, seed: 9 },
      check: (r) => (r.acceptanceRate < 0.1 && r.accepted >= 1) || `acceptance ${r.acceptanceRate}` },
    { name: 'preset: a start in the tail climbs into the right bump', input: { width: 0.2, steps: 250, start: 5, seed: 36 },
      check: (r) => (r.log[0].from === 5 && r.log.slice(0, 10).every((e) => e.x > 3) && Math.abs(r.final - 2) < 1.5 && r.mean > 2.2) || `final ${r.final}, mean ${r.mean}` },
    { name: 'experiment: crossings are rare for narrow proposals and common for moderate ones', input: { width: 3, steps: 250, start: -2, seed: 7 },
      check: () => {
        const narrow = run({ width: 0.1, steps: 5000, start: -2, seed: 7 }, QUIET).switches;
        const medium = run({ width: 3, steps: 5000, start: -2, seed: 7 }, QUIET).switches;
        const wide = run({ width: 40, steps: 5000, start: -2, seed: 7 }, QUIET).switches;
        return (narrow <= 2 && medium > 150 && wide < medium / 2) || `crossings: ${narrow} narrow, ${medium} medium, ${wide} wide`;
      } },
  ],
};

