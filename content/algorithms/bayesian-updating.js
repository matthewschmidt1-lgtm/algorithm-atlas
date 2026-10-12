import { makeRng } from '../../js/lib/rng.js';

const PRIORS = {
  uniform: { a: 1, b: 1, label: 'No opinion: Beta(1, 1)' },
  weak: { a: 2, b: 2, label: 'Probably fair, held loosely: Beta(2, 2)' },
  strong: { a: 20, b: 20, label: 'Almost surely fair: Beta(20, 20)' },
};
const f3 = (v) => v.toFixed(3);
const QUIET = { record: false, count() {}, frame() {} };

// log Γ(n) for whole numbers n ≥ 1, by summing logarithms. Exact enough and easy to check.
const LOG_GAMMA = [0, 0];
function logGamma(n) {
  for (let k = LOG_GAMMA.length; k <= n; k++) LOG_GAMMA[k] = LOG_GAMMA[k - 1] + Math.log(k - 1);
  return LOG_GAMMA[n];
}
// Density of Beta(a, b) at x, for whole-number a and b.
function betaPdf(x, a, b) {
  const part = (p, e) => (e === 0 ? 0 : e * Math.log(p));
  return Math.exp(part(x, a - 1) + part(1 - x, b - 1) + logGamma(a + b) - logGamma(a) - logGamma(b));
}
// Central interval holding the given share of the belief, found by adding up the density on a fine grid.
function centralInterval(a, b, share = 0.95) {
  const N = 2000, tail = (1 - share) / 2;
  let cum = 0, lo = 0, hi = 1, prev = betaPdf(0, a, b), haveLo = false;
  for (let i = 1; i <= N; i++) {
    const x = i / N, cur = betaPdf(x, a, b);
    cum += (prev + cur) / (2 * N);
    if (!haveLo && cum >= tail) { lo = x; haveLo = true; }
    if (cum >= 1 - tail) { hi = x; break; }
    prev = cur;
  }
  return [lo, hi];
}
// Bayes' rule for one yes-or-no hypothesis: probability it is true after seeing the evidence.
function bayesRule(prior, chanceIfTrue, chanceIfFalse) {
  return (prior * chanceIfTrue) / (prior * chanceIfTrue + (1 - prior) * chanceIfFalse);
}
// The conjugate update on its own, without drawing anything.
function updateAll(a, b, flips) {
  for (const f of flips) { if (f === 'H') a += 1; else b += 1; }
  return [a, b];
}

function run(input, t) {
  const prior = PRIORS[input.prior];
  if (!prior) throw new Error('Unknown prior.');
  const bias = Number(input.bias);
  if (!(bias >= 0 && bias <= 1)) throw new Error('The chance of heads must be between 0 and 1.');
  const n = Math.floor(Number(input.flips));
  if (!(n >= 1)) throw new Error('Flip the coin at least once.');
  const rng = makeRng(input.seed);
  const flips = Array.from({ length: n }, () => (rng.next() < bias ? 'H' : 'T'));

  const a0 = prior.a, b0 = prior.b;
  let a = a0, b = b0;
  const means = [a / (a + b)];
  const XS = Array.from({ length: 201 }, (_, i) => i / 200);
  const curve = (p, q) => XS.map((x) => [x, betaPdf(x, p, q)]);
  const priorCurve = curve(a0, b0);
  const [fa, fb] = updateAll(a0, b0, flips);   // only to fix the height of the vertical axis for the whole run
  const top = 1.12 * Math.max(...curve(fa, fb).map((p) => p[1]), ...priorCurve.map((p) => p[1]));

  const views = (seen, newest) => {
    const post = curve(a, b);
    const [lo, hi] = centralInterval(a, b);
    const inside = post.filter(([x]) => x >= lo - 1e-9 && x <= hi + 1e-9);
    const mean = a / (a + b);
    const right = bias > 0.6;
    const heads = a - a0, tails = b - b0;
    return [
      { kind: 'scene', title: 'Belief about the coin\'s chance of heads', x: [0, 1], y: [0, top], aspect: 0.5,
        axes: { xLabel: 'chance of heads', yLabel: 'how plausible (density)' },
        layers: [
          { type: 'band', upper: inside, lower: inside.map(([x]) => [x, 0]), role: 'terracotta' },
          { type: 'line', points: priorCurve, role: 'sage', width: 1.8, dash: true },
          { type: 'line', points: post, role: 'terracotta', width: 2.4 },
          { type: 'segments', segments: [[bias, 0, bias, top]], role: 'ink', width: 1.4, dash: true },
          { type: 'text', at: [bias, top * 0.94], text: 'true chance of heads', role: 'ink', align: right ? 'right' : 'left', dx: right ? -7 : 7 },
          { type: 'points', points: [[mean, betaPdf(mean, a, b)]], role: 'current', r: 4.5, ring: true },
        ],
        legend: [{ label: 'starting belief (prior)', role: 'sage' }, { label: 'current belief (posterior), with the middle 95% shaded and a dot at its mean', role: 'terracotta' }, { label: 'true chance of heads, never shown to the method', role: 'ink' }] },
      { kind: 'rows', title: 'Evidence so far', rows: [
        { label: 'Flips', cells: flips.slice(0, seen).map((f, i) => ({ t: f, role: i === newest ? 'current' : f === 'H' ? 'forest' : 'ochre' })) },
        { label: 'Tally', cells: [{ t: heads, sub: 'heads', role: 'forest' }, { t: tails, sub: 'tails', role: 'ochre' }, { t: `Beta(${a}, ${b})`, sub: 'belief' }, { t: f3(mean), sub: 'mean' }] },
      ], legend: [{ label: 'heads', role: 'forest' }, { label: 'tails', role: 'ochre' }, { label: 'newest flip', role: 'current' }] },
    ];
  };

  t.frame(() => ({ line: 0,
    note: `Before any flips, the belief is the prior Beta(${a0}, ${b0}), drawn as the dashed curve. The height of the curve above a value says how plausible that value is for the coin's chance of heads. ${a0 === 1 && b0 === 1 ? 'This prior is flat: every value is equally plausible.' : `This prior is centred on 0.5 and carries the weight of ${a0 + b0} flips, half of them heads.`} The dashed vertical line marks the true chance, ${bias}, which the method is never told.`,
    views: views(0, -1), vars: { a: a0, b: b0, mean: f3(a0 / (a0 + b0)) } }));

  for (let i = 0; i < n; i++) {
    const head = flips[i] === 'H';
    const before = a / (a + b);
    if (head) a += 1; else b += 1;
    t.count('updates');
    const after = a / (a + b);
    means.push(after);
    const sa = a, sb = b;
    t.frame(() => ({ line: head ? [1, 2, 3] : [1, 4, 5],
      note: `Flip ${i + 1} is **${head ? 'heads' : 'tails'}**. Each candidate value is reweighted by how well it predicted that, so belief shifts toward ${head ? 'higher' : 'lower'} values. In counts: ${head ? 'a' : 'b'} goes up by one and the belief becomes Beta(${sa}, ${sb}). Its mean moves from ${f3(before)} to **${f3(after)}**.`,
      views: views(i + 1, i), vars: { flip: i + 1, a: sa, b: sb, mean: f3(after) } }));
  }

  const heads = a - a0, tails = b - b0;
  const mean = a / (a + b);
  const interval = centralInterval(a, b);
  const covered = bias >= interval[0] && bias <= interval[1];
  t.frame(() => ({ line: 6,
    note: `After ${n} flips with ${heads} heads and ${tails} tails, the belief is Beta(${a0} + ${heads}, ${b0} + ${tails}) = Beta(${a}, ${b}). Its mean is ${a} / ${a + b} = **${f3(mean)}**, and 95% of the belief lies between ${interval[0].toFixed(2)} and ${interval[1].toFixed(2)}. The true chance of heads is ${bias}. ${covered ? 'It lies inside that range.' : 'It lies outside that range: the prior and the flips seen so far point somewhere else.'}`,
    views: views(n, -1), vars: { a, b, mean: f3(mean) } }));

  return { a, b, a0, b0, heads, tails, mean, interval, covered, bias, flips: flips.join(''), means };
}

export default {
  meta: {
    id: 'bayesian-updating',
    name: 'Bayesian Updating',
    aliases: ['Bayes\' rule', 'Bayes\' theorem', 'Bayesian inference', 'beta-binomial model', 'posterior update', 'conjugate prior'],
    kind: 'algorithm',
    discipline: 'statistics',
    alsoIn: [
      { id: 'ai', why: 'Probabilistic reasoning systems hold beliefs as probabilities and revise them with Bayes\' rule as observations arrive.' },
      { id: 'machine-learning', why: 'Bayesian methods treat model parameters as uncertain and update a distribution over them from data. Naive Bayes classifiers apply the rule directly.' },
      { id: 'robotics', why: 'A robot tracks where it is by repeating this update: predict, then correct the belief with each sensor reading.' },
    ],
    subfield: 'Bayesian inference',
    family: 'Conjugate models',
    lab: 'probability-statistics',
    year: 1763,
    authors: 'Thomas Bayes',
    summary: 'Revises a belief as evidence arrives: the new belief is the old belief reweighted by how well each possibility explains the evidence. Shown for a coin.',
    difficulty: 'beginner',
    order: 710,
    paradigms: ['probabilistic-inference'],
    randomized: false,
    approximate: false,
    time: { best: 'O(1) per observation', average: 'O(n) for n observations', worst: 'O(n) for n observations', class: 'linear' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['update a belief with new evidence', 'is this coin fair', 'what does a positive medical test mean', 'estimate a probability from few observations', 'combine prior knowledge with data', 'base rate'],
      techniques: ['Bayes\' rule', 'prior and posterior', 'likelihood', 'conjugate prior', 'beta distribution'],
      applications: ['statistics', 'machine learning', 'robotics', 'security', 'bioinformatics'],
    },
    prerequisites: ['concept:probability', 'concept:bayes-theorem', 'concept:expectation'],
  },

  bigIdea: {
    simple: "Bayesian updating is a rule for changing your mind by the right amount when you learn something new. Imagine a friend hands you a coin and warns you it might be a trick coin. Before any flips you already have an opinion. Perhaps you think it is probably fair. Then you flip it. One head tells you very little, so your opinion should barely move. Eight heads in ten flips is harder to shrug off. Eighty heads in a hundred flips should convince almost anyone. The rule says exactly how far to shift after each flip. Start from what you believed. Ask how well each possibility explains what you just saw. Possibilities that explain it well gain strength, and the others lose strength. Two things follow. Strong evidence moves you further than weak evidence. And the more firmly you believed something at the start, the more evidence it takes to change your mind. Doctors reading test results and email filters deciding what is spam both reason this way.",
    what: 'Bayesian updating turns a belief held before seeing some evidence (the prior) into the belief you should hold after seeing it (the posterior). Every possibility is reweighted by how probable the evidence would be if that possibility were true, and the weights are rescaled to total 1. This page applies it to a coin whose chance of heads is unknown: the belief is a curve over the values from 0 to 1, and each flip reshapes the curve.',
    why: 'Evidence is rarely conclusive. A test can be wrong, a sensor is noisy, a sample is small. The rule gives a consistent way to combine what was already known with what was just observed, and it keeps track of how uncertain the conclusion still is. It also corrects a common error of intuition: judging a claim only by how well the evidence fits it and forgetting how plausible the claim was to begin with.',
    when: 'Use it when you can say, at least roughly, what you believed beforehand and how probable the evidence is under each possibility. It suits small samples, evidence that arrives a piece at a time, and decisions that need a statement of uncertainty. When the belief has no convenient formula, the same rule is carried out numerically, for instance by [Metropolis-Hastings](#/algorithm/metropolis-hastings) sampling. When the quantity changes over time and the noise is Gaussian, the update becomes the [Kalman filter](#/algorithm/kalman-filter).',
    interesting: 'For the coin, the whole update collapses into counting. If the prior belief is a Beta distribution with parameters a and b, then after h heads and t tails the posterior is a Beta distribution with parameters a + h and b + t. The prior behaves exactly like a + b flips you imagine having seen before the experiment began. The order of the flips does not matter, and updating one flip at a time gives the same answer as updating once with all of them.',
    where: 'It underlies the interpretation of diagnostic tests, spam filtering, the tracking and navigation filters in robots and vehicles, the analysis of clinical trials and A/B tests, and the search for lost ships and aircraft.',
    analogy: {
      title: 'A detective and the clues',
      text: 'A detective starts a case with some suspects more likely than others. Each clue shifts suspicion toward the suspects who would more probably have left it. Mud on the carpet points to anyone who came through the garden, a little. A fingerprint points to one person, a lot. No single ordinary clue settles the case, but they accumulate, and a suspect who started out unlikely needs stronger clues before the detective accuses them.',
      limits: "A detective weighs clues by feel, and the rule needs numbers: how likely each suspect was at the start, and how probable each clue would be if they were guilty. Those numbers can be hard to justify, and two honest people may choose different ones. The rule also only shares belief out among the suspects on the list. If the culprit was never listed, no amount of evidence will name them.",
    },
  },

  example: {
    setup: "A coin has an unknown chance of landing heads. Start with no opinion: every chance from 0 to 1 counts as equally plausible. With that starting point, the best single guess after some flips is (heads seen + 1) divided by (flips seen + 2). The extra 1 and 2 are the starting belief, which acts like one imaginary head and one imaginary tail. The flips come up heads, heads, tails, heads.",
    steps: [
      "Before any flip: (0 + 1) / (0 + 2) = 0.5. With no evidence, the guess sits in the middle.",
      "First flip, heads: (1 + 1) / (1 + 2) = 2/3, about 0.667. One head pulls the guess up, but nowhere near 1.",
      "Second flip, heads: (2 + 1) / (2 + 2) = 3/4 = 0.75.",
      "Third flip, tails: (2 + 1) / (3 + 2) = 3/5 = 0.6. The tail pulls the guess back down.",
      "Fourth flip, heads: (3 + 1) / (4 + 2) = 4/6, about 0.667.",
    ],
    result: "After three heads and one tail the guess is 0.667, not the raw fraction 3/4. Four flips are thin evidence, so the guess stays closer to the middle than the raw fraction does. In the picture the belief is still a wide hump: values anywhere from about 0.3 to 0.95 remain plausible.",
    tryInput: { bias: 0.7, flips: 4, prior: 'uniform', seed: 16 },
  },

  terms: [
    { term: "Probability", meaning: "A number from 0 to 1 that says how strongly something is expected or believed. 0 means impossible and 1 means certain." },
    { term: "Hypothesis", meaning: "One of the possibilities you are trying to decide between, such as \"this coin lands heads 70% of the time\"." },
    { term: "Prior", meaning: "What you believe about the hypotheses before seeing the new evidence." },
    { term: "Evidence", meaning: "Something you observe that bears on the question, such as the result of one flip or one medical test." },
    { term: "Likelihood", meaning: "How probable the evidence would be if a particular hypothesis were true." },
    { term: "Posterior", meaning: "What you believe after taking the evidence into account. It becomes the prior for the next piece of evidence." },
    { term: "Base rate", meaning: "How common something is in general, before any specific evidence, such as the share of people who have a disease." },
    { term: "Beta distribution", meaning: "A family of curves over the range 0 to 1, each described by two numbers. For a coin, the two numbers are running counts of heads and tails, including the head start given by the prior." },
  ],

  takeaway: "Start from what you believed, shift toward whatever explains the new evidence better, and shift further when the evidence is stronger or your starting belief was weaker.",

  viz: {
    describe: 'A chart of belief about a coin\'s chance of heads, from 0 to 1. A dashed sage curve shows the starting belief (the prior). A terracotta curve shows the current belief (the posterior), with the middle 95% of it shaded and a dot at its mean. A dashed vertical ink line marks the coin\'s true chance of heads, which the method never sees. Below, one row lists the flips seen so far, heads in forest green and tails in ochre with the newest flip in terracotta, and a second row shows the tally of heads and tails, the current Beta parameters and the mean.',
    inputs: [
      { id: 'bias', type: 'range', label: 'True chance of heads', min: 0.05, max: 0.95, step: 0.05, default: 0.7,
        help: 'Used only to generate the flips. The method never sees it.' },
      { id: 'flips', type: 'range', label: 'Number of flips', min: 1, max: 100, step: 1, default: 40 },
      { id: 'prior', type: 'select', label: 'Starting belief (prior)', options: Object.entries(PRIORS).map(([value, p]) => ({ value, label: p.label })), default: 'uniform' },
      { id: 'seed', type: 'seed', label: 'Random seed for the flips', default: 16 },
    ],
    presets: [
      { label: 'Four flips by hand', values: { bias: 0.7, flips: 4, prior: 'uniform', seed: 16 } },
      { label: 'Biased coin, no opinion', values: { bias: 0.7, flips: 40, prior: 'uniform', seed: 16 } },
      { label: 'Biased coin, stubborn prior', values: { bias: 0.7, flips: 40, prior: 'strong', seed: 16 } },
      { label: 'Stubborn prior, more evidence', values: { bias: 0.7, flips: 100, prior: 'strong', seed: 16 } },
      { label: 'Fair coin', values: { bias: 0.5, flips: 60, prior: 'uniform', seed: 16 } },
    ],
    tryThis: [
      'Load "Biased coin, no opinion" and step through the first ten flips. Early flips move the curve a long way. Later flips barely shift it, because each one is a smaller share of the total evidence.',
      'Load "Biased coin, stubborn prior". The flips are identical, but the belief starts as a tall spike at 0.5 and ends near 0.59 where the open-minded prior reached about 0.67. Then load "Stubborn prior, more evidence" and watch 100 flips drag it further toward 0.7.',
      'Set the number of flips to 100 with the flat prior and change the seed several times. The shaded 95% range moves around, and in most runs it contains the dashed line. Occasionally it does not: a 95% range is expected to miss sometimes.',
      'Set the true chance of heads to 0.95. The curve piles up against the right edge and becomes lopsided. A belief about a chance cannot spill past 1.',
    ],
    run,
    report: (r) => `Prior Beta(${r.a0}, ${r.b0}). Saw ${r.heads} heads and ${r.tails} tails in ${r.heads + r.tails} flips.\nPosterior Beta(${r.a}, ${r.b}): mean ${f3(r.mean)}, with 95% of the belief between ${r.interval[0].toFixed(2)} and ${r.interval[1].toFixed(2)}.\nTrue chance of heads: ${r.bias} (${r.covered ? 'inside' : 'outside'} that range).`,
  },

  logic: {
    intuition: 'List every value the chance of heads could have and give each a weight: that is the prior. When a head comes up, multiply each weight by the chance that value gave to a head. A coin that lands heads 90% of the time has its weight multiplied by 0.9, and one that lands heads 10% of the time by 0.1. Then rescale so the weights again total 1. Values that predicted the flip well now hold a larger share of the belief. Repeat for every flip. For a coin with a Beta prior, all of that multiplication and rescaling works out to adding 1 to a counter.',
    steps: [
      'Choose a prior. For the coin: a Beta distribution with parameters a and b. In the formula for the mean it counts like a imagined heads and b imagined tails seen before the experiment began.',
      'Observe one piece of evidence: a flip.',
      'Multiply the belief in each candidate value θ by the likelihood of that flip: θ for heads, 1 − θ for tails.',
      'Rescale so the total belief is 1. For a Beta prior the result is again a Beta distribution: a head adds 1 to a, a tail adds 1 to b.',
      'Treat the result as the prior for the next flip and repeat from step 2.',
      'Summarize the posterior when needed: its mean is a / (a + b), and a central interval says how uncertain it still is.',
    ],
    pseudocode: [
      'update_belief(a, b, flips):',
      '  for each flip in flips:',
      '    if flip is heads:',
      '      a ← a + 1',
      '    else:',
      '      b ← b + 1',
      '  return Beta(a, b)',
    ],
    decisions: [
      { title: 'Which prior?', text: 'The prior should state what is known before the data. A flat Beta(1, 1) says every chance of heads is equally plausible. Beta(20, 20) says the coin is very probably close to fair. The sum a + b measures the strength of the prior in units of flips, which makes the choice easy to reason about: it is the number of real flips that would carry the same weight.' },
      { title: 'One at a time or all at once?', text: 'Both give the same posterior. Updating with ten flips in one step, or with each of the ten in turn, ends at the same Beta distribution, because the posterior depends on the flips only through the counts of heads and tails.' },
      { title: 'How to summarize the answer?', text: 'The posterior is the full answer. A single number such as the mean, or the most plausible value (a − 1) / (a + b − 2), discards the uncertainty. A credible interval, such as the central 95% shaded on this page, keeps it.' },
    ],
    invariants: [
      'After any number of flips, a equals its prior value plus the number of heads seen so far, and b equals its prior value plus the number of tails.',
      'The belief always totals 1: the area under the posterior curve is 1 after every update.',
      'The posterior does not depend on the order in which the flips arrived.',
    ],
    edgeCases: [
      'A possibility given a prior probability of exactly zero stays at zero whatever the evidence. Reserve zero for things that are truly impossible.',
      'All heads so far: with a flat prior and n heads in n flips the mean is (n + 1) / (n + 2), close to 1 but never equal to it.',
      'Very little data: the posterior is dominated by the prior, so the conclusion is mostly what was assumed.',
      'A wrong model: the update assumes the flips are independent and the chance of heads does not change. If the coin is swapped halfway through, the posterior confidently describes a coin that does not exist.',
      'Evidence that is equally probable under every hypothesis changes nothing, however surprising it seemed.',
    ],
    correctness: 'Bayes\' rule is a consequence of the definition of conditional probability, so the update is correct whenever the prior and the likelihood are the ones intended. For the coin: a Beta(a, b) prior has density proportional to θ^(a−1) (1 − θ)^(b−1), and h heads and t tails have likelihood θ^h (1 − θ)^t. Their product is proportional to θ^(a+h−1) (1 − θ)^(b+t−1), which is the density of Beta(a + h, b + t). The result is exact. What the rule cannot do is certify its inputs: a posterior is only as trustworthy as the prior and the model of how the evidence arises.',
    mistakes: [
      'Confusing the probability of the evidence given the hypothesis with the probability of the hypothesis given the evidence. A test that is positive for 90% of sick people does not make a positive person 90% likely to be sick.',
      'Ignoring the base rate, so that a rare condition is treated as likely after one positive result.',
      'Counting the same evidence twice, for example by updating on a report and then again on a copy of the same report.',
      'Multiplying the likelihoods of pieces of evidence that are not independent as though they were.',
      'Adding to both counters on every flip, or to the wrong one.',
    ],
  },

  code: {
    sample: {
      input: 'Ten flips, HHTHHHTHHT, starting from a flat prior. Each update is done twice: by the counting shortcut, and by the general rule on a grid of 200 candidate values.',
      expected: 'flip  1 H: Beta(2, 1)  mean 0.667  grid mean 0.667\nflip  2 H: Beta(3, 1)  mean 0.750  grid mean 0.750\nflip  3 T: Beta(3, 2)  mean 0.600  grid mean 0.600\nflip  4 H: Beta(4, 2)  mean 0.667  grid mean 0.667\nflip  5 H: Beta(5, 2)  mean 0.714  grid mean 0.714\nflip  6 H: Beta(6, 2)  mean 0.750  grid mean 0.750\nflip  7 T: Beta(6, 3)  mean 0.667  grid mean 0.667\nflip  8 H: Beta(7, 3)  mean 0.700  grid mean 0.700\nflip  9 H: Beta(8, 3)  mean 0.727  grid mean 0.727\nflip 10 T: Beta(8, 4)  mean 0.667  grid mean 0.667',
    },
    python: {
      source: `def update_counts(a, b, flip):
    """The shortcut for a coin: the belief Beta(a, b) gains one count."""
    return (a + 1, b) if flip == "H" else (a, b + 1)


def update_grid(belief, grid, flip):
    """The general rule: multiply by the likelihood, then rescale to total 1."""
    weighted = []
    for weight, p in zip(belief, grid):
        likelihood = p if flip == "H" else 1 - p
        weighted.append(weight * likelihood)
    total = sum(weighted)
    return [w / total for w in weighted]


flips = "HHTHHHTHHT"
a, b = 1, 1                                    # flat prior: Beta(1, 1)
grid = [(i + 0.5) / 200 for i in range(200)]   # candidate values for the chance of heads
belief = [1 / 200] * 200                       # the same flat prior, on the grid

for n, flip in enumerate(flips, start=1):
    a, b = update_counts(a, b, flip)
    belief = update_grid(belief, grid, flip)
    grid_mean = 0.0
    for weight, p in zip(belief, grid):
        grid_mean += weight * p
    print(f"flip {n:2d} {flip}: Beta({a}, {b})  mean {a / (a + b):.3f}  grid mean {grid_mean:.3f}")`,
      notes: [
        { line: 3, text: 'The entire conjugate update. A head adds one to a, a tail adds one to b.' },
        { line: 10, text: 'The likelihood of one flip under a candidate value p: p if it came up heads, 1 − p if tails.' },
        { line: 13, text: 'Dividing by the total is the rescaling step. The total itself is the probability of the evidence, the denominator in Bayes\' rule.' },
        { line: 27, text: 'The two means agree on every line: the counting shortcut is the general rule, worked out once with algebra.' },
      ],
    },
    javascript: {
      source: `// The shortcut for a coin: the belief Beta(a, b) gains one count.
function updateCounts(a, b, flip) {
  return flip === "H" ? [a + 1, b] : [a, b + 1];
}

// The general rule: multiply by the likelihood, then rescale to total 1.
function updateGrid(belief, grid, flip) {
  const weighted = [];
  let total = 0;
  for (let i = 0; i < grid.length; i++) {
    const likelihood = flip === "H" ? grid[i] : 1 - grid[i];
    weighted.push(belief[i] * likelihood);
    total += weighted[i];
  }
  return weighted.map((w) => w / total);
}

const flips = "HHTHHHTHHT";
let a = 1, b = 1;                                                   // flat prior: Beta(1, 1)
const grid = Array.from({ length: 200 }, (_, i) => (i + 0.5) / 200);   // candidate values
let belief = grid.map(() => 1 / 200);                               // the same flat prior, on the grid

for (let n = 1; n <= flips.length; n++) {
  const flip = flips[n - 1];
  [a, b] = updateCounts(a, b, flip);
  belief = updateGrid(belief, grid, flip);
  let gridMean = 0;
  for (let i = 0; i < grid.length; i++) gridMean += belief[i] * grid[i];
  console.log("flip " + String(n).padStart(2, " ") + " " + flip + ": Beta(" + a + ", " + b + ")  mean " +
    (a / (a + b)).toFixed(3) + "  grid mean " + gridMean.toFixed(3));
}`,
    },
    cpp: {
      source: `#include <cstdio>
#include <string>
#include <vector>

// The general rule: multiply by the likelihood, then rescale to total 1.
std::vector<double> update_grid(const std::vector<double>& belief, const std::vector<double>& grid, char flip) {
    std::vector<double> weighted(grid.size());
    double total = 0.0;
    for (std::size_t i = 0; i < grid.size(); ++i) {
        double likelihood = flip == 'H' ? grid[i] : 1 - grid[i];
        weighted[i] = belief[i] * likelihood;
        total += weighted[i];
    }
    for (double& w : weighted) w /= total;
    return weighted;
}

int main() {
    const std::string flips = "HHTHHHTHHT";
    int a = 1, b = 1;                           // flat prior: Beta(1, 1)
    std::vector<double> grid(200), belief(200, 1.0 / 200);
    for (int i = 0; i < 200; ++i) grid[i] = (i + 0.5) / 200;   // candidate values

    for (std::size_t n = 1; n <= flips.size(); ++n) {
        char flip = flips[n - 1];
        if (flip == 'H') a += 1; else b += 1;   // the shortcut for a coin
        belief = update_grid(belief, grid, flip);
        double grid_mean = 0.0;
        for (int i = 0; i < 200; ++i) {
            double term = belief[i] * grid[i];
            grid_mean += term;
        }
        std::printf("flip %2d %c: Beta(%d, %d)  mean %.3f  grid mean %.3f\\n",
                    static_cast<int>(n), flip, a, b, static_cast<double>(a) / (a + b), grid_mean);
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'With a conjugate prior, one update is a constant amount of work: one addition. The posterior after n observations costs O(n) time and needs only two numbers of memory. Outside the conjugate cases the rule is the same but the arithmetic is not free, and most of the effort in applied Bayesian statistics goes into carrying it out.',
    cases: [
      { case: 'Conjugate prior (this page)', time: 'O(1) per observation', when: 'The prior and posterior belong to the same family, so updating means updating a few parameters. Beta with coin flips is one such pair.' },
      { case: 'Grid of G candidate values', time: 'O(G) per observation', when: 'Works for any prior and likelihood with one unknown. With d unknowns and m values each, G = m^d, which is unaffordable beyond a few unknowns.' },
      { case: 'Sampling (Markov chain Monte Carlo)', time: 'Depends on the chain', when: 'Used when there are many unknowns and no formula. The cost is the number of samples needed for the chain to explore the posterior.' },
    ],
    space: 'O(1) for the conjugate update: the two parameters. A grid needs O(G). The page stores the list of flips only to display them.',
    memory: 'The posterior is a complete summary of everything seen so far, so the raw observations can be discarded as they are processed. That is what makes the rule suitable for data that arrives as a stream.',
    tradeoffs: 'Conjugate models are fast and exact but restrict the choice of prior and likelihood. Grids are general but collapse under the number of unknowns. Sampling handles realistic models at the price of approximation and computing time.',
    assumptions: [
      'The observations are independent given the unknown, and each has the same chance of heads.',
      'The prior is a Beta distribution and the likelihood is that of a coin flip (a Bernoulli trial).',
      'Arithmetic on the counts takes constant time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Small samples, where a sensible prior prevents wild conclusions from a few observations.',
      'Evidence arriving one piece at a time, with a belief needed at every moment.',
      'Problems where the uncertainty of the answer matters as much as the answer.',
      'Combining information from different sources in one consistent calculation.',
    ],
    struggles: [
      'Problems where no one can defend a prior, and the data are too few to overwhelm it.',
      'Models with many unknowns and no conjugate form, where the computation becomes the hard part.',
      'Situations the model did not foresee: the rule redistributes belief among the listed possibilities and cannot invent a new one.',
    ],
    misunderstandings: [
      "\"A positive result on an accurate test means I probably have the disease.\" It depends on how common the disease is. If 1 person in 100 has it and the test is positive for 90% of the sick and 10% of the healthy, then of 1000 people about 9 sick and 99 healthy test positive. A positive result means a chance of 9 in 108, about 8%.",
      "\"The prior is just bias, so the method is unscientific.\" Every method assumes something. This one states its assumption openly as a prior, and with enough data, people who started from different reasonable priors end up close together.",
      "\"The posterior mean is the true value.\" It is a best guess. The width of the curve says how far the truth could reasonably be from it.",
      "\"Updating once per observation and updating on all of them together could give different answers.\" They give the same posterior. The order of independent observations does not matter either.",
    ],
    pitfalls: [
      'Assigning a prior of exactly 0 or 1 to something that is merely very unlikely or very likely, which makes the belief immune to evidence.',
      'Treating correlated evidence as independent, which makes the posterior far too confident.',
      'Reporting only the posterior mean and discarding the uncertainty.',
    ],
    constraints: [
      'Real models rarely have conjugate priors, so practical work relies on numerical methods and on checking that they have converged.',
      'Results that depend strongly on the prior should be reported under several priors.',
    ],
    alternatives: [
      { name: 'Maximum likelihood estimation', when: 'There is plenty of data and no prior knowledge worth encoding. For the coin it gives the raw fraction of heads, with no pull toward a prior.' },
      { id: 'metropolis-hastings', name: 'Metropolis-Hastings', when: 'The posterior has no closed form. It draws samples from the posterior using only the product of prior and likelihood.' },
      { id: 'kalman-filter', name: 'Kalman Filter', when: 'The unknown changes over time and the noise is Gaussian. It is this update, alternated with a prediction step.' },
      { id: 'particle-filter', name: 'Particle Filter', when: 'The unknown changes over time and the beliefs are not Gaussian. It represents them by weighted random samples.' },
    ],
    comparison: {
      columns: ['', 'Bayesian updating', 'Maximum likelihood'],
      rows: [
        ['Answer', 'A distribution over the unknown', 'A single best-fitting value'],
        ['Uses prior knowledge', 'Yes, stated as a prior', 'No'],
        ['3 heads in 3 flips', 'Mean 0.8 with a flat prior', 'Estimate 1.0: the coin always lands heads'],
        ['With a great deal of data', 'Dominated by the data', 'The same answer, nearly'],
      ],
    },
  },

  applications: [
    { title: 'Interpreting diagnostic tests', status: 'established', text: 'The chance that a person with a positive result has the condition, the positive predictive value, is computed with Bayes\' rule from the test\'s error rates and the prevalence of the condition. It is why screening a low-risk population produces mostly false alarms.' },
    { title: 'Spam filtering', status: 'established', text: 'Naive Bayes filters estimate, for each word, how much more often it appears in spam than in legitimate mail, and combine the words of a message with Bayes\' rule to score it. The filter keeps learning as the user marks messages.' },
    { title: 'Tracking and navigation', status: 'established', text: 'Recursive Bayesian estimation alternates a prediction of how the state has moved with an update from a noisy measurement. The Kalman filter is the special case with linear motion and Gaussian noise.' },
    { title: 'Searching for lost objects', status: 'established', text: 'Bayesian search theory keeps a probability map of where a lost object may be and updates it after each unsuccessful search of an area. It was used in the search that located the wreckage of Air France Flight 447 in 2011.' },
    { title: 'Comparing two versions of a web page', status: 'illustrative', text: 'Each version\'s conversion rate can be given a Beta belief and updated with every visitor, exactly as the coin is here. The team can then ask how probable it is that one version is better than the other.' },
  ],

  connections: [
    { to: 'kalman-filter', type: 'advanced', why: 'The Kalman filter is Bayesian updating for a quantity that moves: a Gaussian prior, a Gaussian measurement, and a Gaussian posterior, repeated at every time step.' },
    { to: 'metropolis-hastings', type: 'advanced', why: 'Both work with a posterior proportional to prior times likelihood. Here the constant of proportionality has a formula; Metropolis-Hastings draws samples without ever needing it.' },
    { to: 'monte-carlo', type: 'related', why: 'Summaries of a posterior are averages over it. When they have no formula they are estimated by averaging over random samples.' },
    { to: 'particle-filter', type: 'advanced', why: 'A particle filter performs the same predict-and-update cycle with the belief stored as weighted samples, so it handles beliefs of any shape.' },
    { to: 'gradient-descent', type: 'related', why: 'When only the most plausible value is wanted and there is no formula, it is found by minimizing the negative log posterior, an optimization problem.' },
    { to: 'reservoir-sampling', type: 'related', why: 'Both process a stream one item at a time and keep a small summary that is correct at every moment: here two counts, there k items.' },
    { to: 'concept:bayes-theorem', type: 'prerequisite', why: 'The update is Bayes\' theorem applied repeatedly, with each posterior serving as the next prior.' },
    { to: 'concept:probability', type: 'prerequisite', why: 'Beliefs are represented as probabilities, and the rule follows from how conditional probability is defined.' },
    { to: 'concept:expectation', type: 'related', why: 'The posterior mean, the single best guess under squared error, is the expected value of the unknown under the posterior.' },
    { to: 'discipline:ai', type: 'application', why: 'Reasoning under uncertainty in AI is built on holding probabilities over hypotheses and updating them with this rule.' },
    { to: 'discipline:robotics', type: 'application', why: 'State estimation in robots is recursive Bayesian updating from sensor data.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'One person in 100 has a certain disease. A test is positive for 90% of people who have it and for 10% of people who do not. Someone tests positive. What is the chance they have the disease?',
      options: ['About 90%', 'About 50%', 'About 8%', 'About 1%'],
      answer: 2,
      explain: [
        '90% is the chance of a positive result given the disease. The question asks for the reverse: the chance of the disease given a positive result.',
        'The positive result raises the chance a great deal, but not that far, because healthy people vastly outnumber sick ones.',
        'Correct. Of 1000 people, 10 are sick and 9 of them test positive. Of the 990 healthy people, 99 test positive. So 9 of the 108 positives are sick: 9 / 108 is about 8.3%.',
        '1% was the chance before the test. A positive result is evidence, and it moves the chance from 1% to about 8%.',
      ],
    },
    {
      type: 'predict',
      q: 'You are almost sure a coin is fair: your prior is Beta(20, 20). Then you see 7 heads in 10 flips. What is the mean of your belief now?',
      options: ['0.70', '0.667', '0.54', '0.50'],
      answer: 2,
      explain: [
        '0.70 is the raw fraction of heads. It ignores the prior entirely.',
        '0.667 is the answer for a flat prior: (7 + 1) / (10 + 2). This prior is much stronger.',
        'Correct. The posterior is Beta(20 + 7, 20 + 3) = Beta(27, 23), with mean 27 / 50 = 0.54. Ten flips count for little against a prior worth forty.',
        '0.50 would mean the evidence was ignored. The belief does move, a little.',
      ],
      tryInput: { bias: 0.7, flips: 10, prior: 'strong', seed: 16 },
    },
    {
      type: 'debug',
      q: 'This update is meant to track a coin, but its estimate of the chance of heads always comes out too low. What is wrong?',
      code: `for flip in flips:
    if flip == "H":
        a += 1
    b += 1
mean = a / (a + b)`,
      options: ['a should start at 0', 'b is increased on every flip, heads included, because the else is missing', 'The mean should be a / b', 'The loop should stop at the first tail'],
      answer: 1,
      explain: [
        'The starting values are the prior. They are not the bug.',
        'Correct. A head should add to a only. Here every head is also counted as a tail, which drags the mean down.',
        'a / b is the odds of heads, not the mean of the belief.',
        'Every flip is evidence. Stopping early would throw evidence away.',
      ],
    },
    {
      type: 'choice',
      q: 'Two people watch the same coin. One sees the flips in the order H, H, T. The other is told them in the order T, H, H. They start with the same prior. How do their posteriors compare?',
      options: ['The one who saw the heads first believes more strongly in heads', 'The one who saw the tail first believes more strongly in tails', 'They are identical', 'It depends on the prior'],
      answer: 2,
      explain: [
        'First impressions weigh heavily on people, but not on the rule.',
        'The rule gives the tail the same weight wherever it appears.',
        'Correct. The posterior depends only on the counts: two heads and one tail in both cases.',
        'With the same prior and the same counts the posterior is the same, whatever that prior is.',
      ],
    },
    {
      type: 'challenge',
      title: 'Three coins in a bag',
      prompt: 'A bag holds three coins whose chances of heads are 0.3, 0.5 and 0.7. You draw one without looking and flip it repeatedly. Write a program that keeps a belief over the three coins, starting at one third each, and updates it after every flip by multiplying by the likelihood and rescaling. Print the belief after each of the flips H, H, T, H, H. Then answer: how many heads in a row are needed before the belief in the 0.7 coin first exceeds 90%?',
      hints: ['After one head the beliefs are proportional to 0.3, 0.5 and 0.7, so they are 0.2, 0.333 and 0.467.', 'After k heads in a row the beliefs are proportional to 0.3^k, 0.5^k and 0.7^k.'],
    },
  ],

  compare: {
    idea: 'Reweight every possibility by how well it explains the evidence, then rescale. For a coin with a Beta prior this is counting.',
    requires: 'A prior over the possibilities and a likelihood for the evidence. The result is exact for the stated prior and model.',
    sensitivity: 'With little data the answer depends strongly on the prior. With a lot of data it hardly depends on it.',
    memory: 'O(1) in the conjugate case: two counts.',
    difficulty: 'low',
    difficultyNote: 'The arithmetic is simple. Choosing the prior and the model, and resisting the urge to ignore base rates, is the hard part.',
    limits: 'Only as good as the prior and the model. Cannot assign belief to a possibility that was left out.',
    useWhen: 'Evidence arrives in pieces, data are limited, and the uncertainty of the conclusion matters.',
  },

  advanced: {
    history: 'The rule is named after Thomas Bayes, an English minister whose essay on the problem was found among his papers after his death in 1761. His friend Richard Price edited it and sent it to the Royal Society, which published it in 1763. The essay treats exactly the problem on this page: inferring an unknown chance from a number of successes and failures, starting from a flat prior. Pierre-Simon Laplace reached the same principle independently in a memoir of 1774 and developed it into a general method, including the formula (s + 1) / (n + 2) for the chance of a further success after s successes in n trials, now called the rule of succession. Through much of the twentieth century the approach was disputed by statisticians who objected to priors. It returned to wide use from about 1990, when Markov chain Monte Carlo made posteriors computable for realistic models.',
    derivation: 'Bayes\' rule for an unknown $\\theta$ and data $D$ is\n\n$$p(\\theta \\mid D) = \\frac{p(D \\mid \\theta)\\,p(\\theta)}{p(D)}, \\qquad p(D) = \\int p(D \\mid \\theta)\\,p(\\theta)\\,d\\theta.$$\n\nFor the coin take the prior $\\theta \\sim \\text{Beta}(a, b)$, with density $p(\\theta) = \\theta^{a-1}(1-\\theta)^{b-1} / B(a, b)$, where $B$ is the beta function. A sequence of flips with $h$ heads and $t$ tails has likelihood $\\theta^{h}(1-\\theta)^{t}$. Multiplying,\n\n$$p(\\theta \\mid D) \\propto \\theta^{a+h-1}(1-\\theta)^{b+t-1},$$\n\nwhich is the density of $\\text{Beta}(a + h,\\, b + t)$. The posterior mean can be written as a weighted average of the prior mean and the observed frequency:\n\n$$\\frac{a + h}{a + b + n} = w\\,\\frac{a}{a+b} + (1 - w)\\,\\frac{h}{n}, \\qquad w = \\frac{a + b}{a + b + n},$$\n\nwith $n = h + t$. The weight on the prior shrinks as data accumulate. The posterior variance is $\\frac{\\alpha\\beta}{(\\alpha+\\beta)^2(\\alpha+\\beta+1)}$ with $\\alpha = a + h$ and $\\beta = b + t$, which falls roughly like $1/n$.',
    proof: 'Sequential and batch updating agree. Let $D_1$ and $D_2$ be two sets of observations that are independent given $\\theta$. Updating on $D_1$ gives $p(\\theta \\mid D_1) \\propto p(D_1 \\mid \\theta)\\,p(\\theta)$. Using that as the prior for $D_2$ gives\n\n$$p(\\theta \\mid D_1, D_2) \\propto p(D_2 \\mid \\theta)\\,p(D_1 \\mid \\theta)\\,p(\\theta) = p(D_1, D_2 \\mid \\theta)\\,p(\\theta),$$\n\nwhich is the posterior from a single update on all the data. The product is symmetric in $D_1$ and $D_2$, so the order of the observations does not matter.',
    variants: [
      { name: 'Other conjugate pairs', text: 'A Gamma prior with Poisson counts, a Dirichlet prior with rolls of a many-sided die, and a Gaussian prior with Gaussian measurements all update by adjusting a few parameters.' },
      { name: 'Grid approximation', text: 'Evaluates prior times likelihood on a grid of candidate values and rescales. General but limited to a few unknowns.' },
      { name: 'Markov chain Monte Carlo', text: 'Draws samples from the posterior without computing its normalizing constant. The standard tool for models with many unknowns.' },
      { name: 'Variational inference', text: 'Approximates the posterior by the closest member of a simple family, turning inference into optimization.' },
      { name: 'Recursive filtering', text: 'For a state that changes over time, alternates a prediction step with a Bayesian update. Kalman and particle filters are examples.' },
    ],
    implementation: 'Multiply many small likelihoods in logarithms to avoid underflow: add log likelihoods and rescale at the end. In the conjugate case store only the parameters. Check sensitivity by rerunning with a different reasonable prior.',
    benchmarking: 'A Bayesian procedure is assessed by calibration: across many repetitions, intervals claimed to hold 95% of the belief should contain the truth about 95% of the time when the prior matches how the truth is generated. The tests of this lesson check a looser version of that property.',
    references: [
      { authors: 'T. Bayes (communicated by R. Price)', year: 1763, title: 'An essay towards solving a problem in the doctrine of chances', venue: 'Philosophical Transactions of the Royal Society of London 53, 370-418' },
      { authors: 'A. Gelman, J. B. Carlin, H. S. Stern, D. B. Dunson, A. Vehtari and D. B. Rubin', year: 2013, title: 'Bayesian Data Analysis (3rd edition)', venue: 'Chapman and Hall/CRC' },
      { authors: 'G. Gigerenzer and U. Hoffrage', year: 1995, title: 'How to improve Bayesian reasoning without instruction: frequency formats', venue: 'Psychological Review 102(4), 684-704' },
    ],
    furtherReading: [
      'S. B. McGrayne, *The Theory That Would Not Die* (Yale University Press, 2011), a history of the rule and the disputes over it.',
      'D. J. C. MacKay, *Information Theory, Inference, and Learning Algorithms* (Cambridge University Press, 2003), chapter 3.',
    ],
  },

  tests: [
    { name: 'posterior parameters equal the prior plus the counts', input: { bias: 0.7, flips: 40, prior: 'weak', seed: 16 },
      check: (r, c) => {
        const h = [...r.flips].filter((f) => f === 'H').length, tl = r.flips.length - h;
        return (r.flips.length === 40 && c.updates === 40 && r.a === 2 + h && r.b === 2 + tl && r.heads === h && r.tails === tl) || `got Beta(${r.a}, ${r.b}) from ${h} heads and ${tl} tails`;
      } },
    { name: 'the posterior mean is (a0 + heads) / (a0 + b0 + n), a weighted average of prior mean and frequency', input: { bias: 0.3, flips: 55, prior: 'strong', seed: 9 },
      check: (r) => {
        const n = r.heads + r.tails, w = 40 / (40 + n);
        const direct = (20 + r.heads) / (40 + n), blend = w * 0.5 + (1 - w) * (r.heads / n);
        return (Math.abs(r.mean - direct) < 1e-12 && Math.abs(r.mean - blend) < 1e-12 && r.mean === r.a / (r.a + r.b)) || `mean ${r.mean}, expected ${direct}`;
      } },
    { name: 'the worked example: H, H, T, H from a flat prior', input: { bias: 0.7, flips: 4, prior: 'uniform', seed: 16 },
      check: (r) => {
        const want = [1 / 2, 2 / 3, 3 / 4, 3 / 5, 4 / 6];
        if (r.flips !== 'HHTH') return `flips were ${r.flips}`;
        if (r.a !== 4 || r.b !== 2) return `posterior Beta(${r.a}, ${r.b})`;
        if (!(r.interval[0] > 0.25 && r.interval[0] < 0.35 && r.interval[1] > 0.9 && r.interval[1] < 0.97)) return `95% interval ${r.interval}`;
        return r.means.every((m, i) => Math.abs(m - want[i]) < 1e-12) || `means ${r.means}`;
      } },
    { name: 'quiz: Beta(20, 20) and 7 heads in 10 flips gives mean 0.54', input: { bias: 0.7, flips: 10, prior: 'strong', seed: 16 },
      check: (r) => (r.heads === 7 && r.a === 27 && r.b === 23 && Math.abs(r.mean - 0.54) < 1e-12) || `heads ${r.heads}, mean ${r.mean}` },
    { name: 'presets: the stubborn prior ends near 0.59 and the flat prior near 0.67 on the same flips', input: { bias: 0.7, flips: 40, prior: 'strong', seed: 16 },
      check: (r) => {
        const flat = run({ bias: 0.7, flips: 40, prior: 'uniform', seed: 16 }, QUIET);
        return (flat.flips === r.flips && f3(r.mean) === '0.588' && f3(flat.mean) === '0.667' && Math.abs(r.mean - 0.5) < Math.abs(flat.mean - 0.5)) || `strong ${r.mean}, flat ${flat.mean}`;
      } },
    { name: 'order of the flips does not matter, and batch equals sequential', input: { bias: 0.6, flips: 30, prior: 'weak', seed: 4 },
      check: (r) => {
        const reversed = updateAll(r.a0, r.b0, [...r.flips].reverse());
        const sorted = updateAll(r.a0, r.b0, [...r.flips].sort());
        return (reversed[0] === r.a && reversed[1] === r.b && sorted[0] === r.a && sorted[1] === r.b) || 'order changed the posterior';
      } },
    { name: 'the Beta density has area 1 and the interval holds 95% of it', input: { bias: 0.7, flips: 40, prior: 'uniform', seed: 16 },
      check: (r) => {
        const N = 20000;
        let area = 0, within = 0;
        for (let i = 0; i < N; i++) {
          const x = (i + 0.5) / N, d = betaPdf(x, r.a, r.b) / N;
          area += d;
          if (x >= r.interval[0] && x <= r.interval[1]) within += d;
        }
        return (Math.abs(area - 1) < 1e-6 && Math.abs(within - 0.95) < 0.01) || `area ${area}, inside the interval ${within}`;
      } },
    { name: 'the medical test: 1% base rate, 90% and 10% positive rates give 9/108', input: { bias: 0.5, flips: 1, prior: 'uniform', seed: 1 },
      check: () => {
        const p = bayesRule(0.01, 0.9, 0.1);
        return (Math.abs(p - 9 / 108) < 1e-12 && (100 * p).toFixed(1) === '8.3') || `got ${p}`;
      } },
    { name: 'calibration: the 95% interval covers the true chance in most of 400 runs', input: { bias: 0.7, flips: 60, prior: 'uniform', seed: 1 },
      check: () => {
        let covered = 0;
        for (let s = 1; s <= 400; s++) if (run({ bias: 0.7, flips: 60, prior: 'uniform', seed: 500 + s }, QUIET).covered) covered++;
        return (covered / 400 > 0.89 && covered / 400 <= 1) || `covered in ${covered} of 400 runs`;
      } },
    { name: 'all heads never gives certainty: mean is (n + 1) / (n + 2)', input: { bias: 0.95, flips: 12, prior: 'uniform', seed: 3 },
      check: () => {
        const [a, b] = updateAll(1, 1, 'HHHHHHHHHHHH');
        return (a === 13 && b === 1 && a / (a + b) < 1) || `Beta(${a}, ${b})`;
      } },
  ],
};
