import { makeRng } from '../../js/lib/rng.js';

// One sample contributes 4 (inside) or 0 (outside), so its standard deviation is sqrt(π(4 − π)) ≈ 1.642.
const SPREAD = Math.sqrt(Math.PI * (4 - Math.PI));
const typicalError = (n) => SPREAD / Math.sqrt(n);
const f2 = (v) => v.toFixed(2);
const f4 = (v) => v.toFixed(4);
const QUIET = { record: false, count() {}, frame() {} };

const ARC = Array.from({ length: 61 }, (_, i) => [Math.cos((i / 60) * Math.PI / 2), Math.sin((i / 60) * Math.PI / 2)]);

function run(input, t) {
  const n = Math.floor(Number(input.samples));
  if (!(n >= 1)) throw new Error('Throw at least one point.');
  const rng = makeRng(input.seed);
  const picture = t.record !== false;           // count-only runs keep no per-point data
  const inPts = [], outPts = [], estimates = [], first = [];
  let inside = 0;

  const bandKs = Array.from({ length: 80 }, (_, i) => Math.max(1, n * ((i + 1) / 80) ** 2));
  const upper = bandKs.map((k) => [k, Math.PI + typicalError(k)]);
  const lower = bandKs.map((k) => [k, Math.PI - typicalError(k)]);

  const views = (k, cur) => {
    const layers = [
      { type: 'polygon', points: [[0, 0], ...ARC], role: 'forest', fill: true, width: 1.5 },
      { type: 'points', points: outPts.slice(), role: 'ochre', r: n > 1500 ? 1.8 : 2.6 },
      { type: 'points', points: inPts.slice(), role: 'forest', r: n > 1500 ? 1.8 : 2.6 },
    ];
    if (cur) layers.push({ type: 'points', points: [cur], role: 'current', r: 5, ring: true });
    return [
      { kind: 'scene', title: 'Random points in the unit square', x: [0, 1], y: [0, 1], equal: true, aspect: 0.6, axes: { xLabel: 'x', yLabel: 'y' }, layers,
        legend: [{ label: 'inside the quarter circle', role: 'forest' }, { label: 'outside', role: 'ochre' }, { label: 'newest point', role: 'current' }] },
      { kind: 'scene', title: 'Estimate of π after each point', x: [0, Math.max(n, 2)], y: [2.6, 3.7], aspect: 0.2, axes: { xLabel: 'points thrown' },
        layers: [
          { type: 'band', upper, lower, role: 'sage' },
          { type: 'line', points: [[0, Math.PI], [Math.max(n, 2), Math.PI]], role: 'ink', width: 1.4, dash: true },
          { type: 'line', points: estimates.slice(0, k), role: 'terracotta', width: 2 },
          ...(k === 1 ? [{ type: 'points', points: [estimates[0]], role: 'terracotta', r: 3 }] : []),
        ],
        legend: [{ label: 'running estimate', role: 'terracotta' }, { label: 'true value of π', role: 'ink' }, { label: 'typical size of the error, shrinking as points are added', role: 'sage' }] },
    ];
  };

  t.frame(() => ({ line: [0, 1], note: `The square has side 1, so its area is 1. The shaded quarter circle has radius 1, so its area is π/4, about 0.785. A point thrown at random into the square lands in the shaded part with exactly that chance. So 4 × (the fraction of points inside) is an estimate of π.`, views: views(0, null), vars: { n, inside: 0 } }));

  // Narrate the first 20 points one at a time, then in batches so long runs stay watchable.
  const single = Math.min(n, 20);
  const batch = Math.max(1, Math.ceil((n - single) / 180));
  let batchStart = single + 1, batchIn = 0;

  for (let k = 1; k <= n; k++) {
    const x = rng.next(), y = rng.next();
    t.count('samples');
    const hit = x * x + y * y <= 1;
    if (hit) inside++;
    if (picture) {
      (hit ? inPts : outPts).push([x, y]);
      estimates.push([k, (4 * inside) / k]);
      if (k <= 10) first.push({ x, y, hit });
    }
    const est = (4 * inside) / k, have = inside;
    if (k <= single) {
      t.frame(() => ({ line: hit ? [3, 4, 5, 6] : [3, 4, 5],
        note: `Point ${k} landed at (${f2(x)}, ${f2(y)}). Its distance from the corner is ${f2(Math.hypot(x, y))}, which is ${hit ? 'at most 1, so it is **inside** the quarter circle' : 'more than 1, so it is **outside**'}. So far ${have} of ${k} points are inside: 4 × ${have} / ${k} = **${f4(est)}**.`,
        views: views(k, [x, y]), vars: { points: k, inside: have, estimate: f4(est) } }));
    } else {
      if (hit) batchIn++;
      if ((k - single) % batch === 0 || k === n) {
        const from = batchStart, got = batchIn, size = k - batchStart + 1;
        t.frame(() => ({ line: [2, 3, 4, 5, 6],
          note: size === 1
            ? `Point ${k} landed ${hit ? 'inside' : 'outside'}. In total ${have} of ${k} points are inside, so the estimate is 4 × ${have} / ${k} = **${f4(est)}**.`
            : `Threw points ${from} to ${k}: ${got} of these ${size} landed inside. In total ${have} of ${k} points are inside, so the estimate is 4 × ${have} / ${k} = **${f4(est)}**.`,
          views: views(k, [x, y]), vars: { points: k, inside: have, estimate: f4(est) } }));
        batchStart = k + 1; batchIn = 0;
      }
    }
  }

  const estimate = (4 * inside) / n;
  const error = Math.abs(estimate - Math.PI);
  t.frame(() => ({ line: 7,
    note: `All ${n} points are thrown. ${inside} landed inside, so the estimate of π is 4 × ${inside} / ${n} = **${f4(estimate)}**. The true value is 3.1416, so this run is off by ${f4(error)}. With ${n} points an error of about ${f4(typicalError(n))} is typical. Four times as many points would halve that.`,
    views: views(n, null), vars: { points: n, inside, estimate: f4(estimate), error: f4(error) } }));

  return { estimate, inside, samples: n, error, typicalError: typicalError(n), first };
}

// Root-mean-square error of the estimate over many seeds, used by the scaling tests.
function rmsError(n, seeds) {
  let sum = 0;
  for (let s = 1; s <= seeds; s++) {
    const r = run({ samples: n, seed: 1000 + s }, QUIET);
    sum += (r.estimate - Math.PI) ** 2;
  }
  return Math.sqrt(sum / seeds);
}

export default {
  meta: {
    id: 'monte-carlo',
    name: 'Monte Carlo Estimation',
    aliases: ['Monte Carlo method', 'Monte Carlo simulation', 'Monte Carlo integration', 'estimating pi with random points', 'random sampling'],
    kind: 'algorithm',
    discipline: 'statistics',
    alsoIn: [
      { id: 'finance', why: 'The price of a financial contract is an expected payoff over uncertain futures, and simulation is a standard way to estimate it.' },
      { id: 'physics', why: 'The method was developed at Los Alamos to follow neutrons through matter, and it remains a basic tool of statistical and particle physics.' },
      { id: 'computer-graphics', why: 'Path tracing computes the light reaching each pixel by Monte Carlo integration over the paths light can take.' },
    ],
    subfield: 'Simulation',
    family: 'Monte Carlo methods',
    lab: 'probability-statistics',
    year: 1949,
    authors: 'Nicholas Metropolis and Stanislaw Ulam',
    summary: 'Estimates a quantity by drawing random samples and averaging, here the value of π from random points in a square. The error shrinks like 1/√n.',
    difficulty: 'beginner',
    order: 700,
    paradigms: ['randomized-sampling'],
    randomized: true,
    approximate: true,
    time: { best: 'O(n)', average: 'O(n)', worst: 'O(n)', class: 'linear' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['estimate pi with random numbers', 'estimate an area', 'estimate an average by simulation', 'compute an integral', 'work out the odds by trying many random cases', 'risk analysis'],
      techniques: ['random sampling', 'averaging', 'simulation', 'law of large numbers'],
      applications: ['statistics', 'finance', 'computer graphics', 'scientific computing', 'games'],
    },
    prerequisites: ['concept:probability', 'concept:expectation', 'concept:sampling', 'concept:law-of-large-numbers'],
  },

  bigIdea: {
    simple: "Monte Carlo estimation answers a hard question by trying random cases and counting. Suppose you want to know the area of an oddly shaped pond in a square field. Measuring it directly is difficult. Instead, throw a thousand pebbles into the field without aiming, so they land everywhere equally often. Then count how many splashed. If about three in every ten pebbles hit the water, the pond covers about three tenths of the field. No geometry was needed, only counting. More pebbles give a better answer, though the improvement is slow. To get an answer ten times closer, you need about a hundred times as many pebbles. Computers are good at this, because they can produce millions of random numbers in a second. Scientists use the same trick when a problem has too many possibilities to work through one by one, such as how light bounces around a room, or what a risky investment might be worth next year.",
    what: 'Monte Carlo estimation computes a number by drawing random samples and averaging what it sees. The example on this page throws random points into a square and counts the fraction that land inside a quarter circle. That fraction estimates the area of the quarter circle, which is π/4, so four times the fraction estimates π.',
    why: 'Many quantities are averages over more possibilities than anyone can list: every path a neutron might take, every future of a market, every route of a light ray. A random sample of those possibilities gives an estimate of the average, together with a measure of how far off it is likely to be. The size of that error depends on the number of samples and not on how many dimensions the problem has.',
    when: 'Use it when the quantity you want can be written as an average or an area, when you can generate random cases cheaply, and when an exact formula or a grid of evenly spaced points is out of reach, typically because the problem has many variables. For a smooth function of one or two variables, a standard numerical integration rule is far more accurate for the same work. When random cases cannot be drawn directly, [Metropolis-Hastings](#/algorithm/metropolis-hastings) produces them with a random walk.',
    interesting: 'The error shrinks in proportion to 1/√n, where n is the number of samples. That is slow: a hundred times the work for one more correct digit. But the same rule holds in two dimensions or two thousand. Methods based on evenly spaced grids need a number of points that multiplies with every added dimension, so beyond a handful of dimensions the slow, steady method wins.',
    where: 'Physicists simulate particles with it, film and game renderers use it to compute lighting, banks use it to value contracts and measure risk, and statisticians use it to evaluate models that have no closed-form answer.',
    analogy: {
      title: 'An opinion poll',
      text: 'To learn what a country of millions thinks, a pollster does not ask everyone. They ask about a thousand people chosen at random and report the fraction who said yes. The answer is usually within a few percentage points of the truth, and the size of the country hardly matters: what matters is the size of the sample. Monte Carlo estimation polls the possibilities of a mathematical problem in the same way.',
      limits: "A pollster's hard problem is reaching a fair sample of people, and people can refuse or change their minds. A computer has neither difficulty with points in a square. Its difficulties are different. Its random numbers come from a formula and only imitate chance. And for many real problems, drawing fair samples is itself hard, which is why more advanced sampling methods exist.",
    },
  },

  example: {
    setup: "Estimate π from five random points. Each point has two coordinates between 0 and 1, so it lies in a square of side 1. A point is inside the quarter circle when the square of its first coordinate plus the square of its second is at most 1.",
    steps: [
      "Point 1 is (0.69, 0.77). 0.69 × 0.69 = 0.476 and 0.77 × 0.77 = 0.593. The sum is 1.069, more than 1, so it is outside.",
      "Point 2 is (0.22, 0.62). 0.048 + 0.384 = 0.432, so it is inside.",
      "Point 3 is (0.09, 0.59). 0.008 + 0.348 = 0.356, so it is inside.",
      "Point 4 is (0.72, 0.46). 0.518 + 0.212 = 0.730, so it is inside.",
      "Point 5 is (0.91, 0.23). 0.828 + 0.053 = 0.881, so it is inside.",
    ],
    result: "Four of the five points are inside, so the estimate is 4 × 4 / 5 = 3.2. The true value is about 3.14. Five points can only ever give 0, 0.8, 1.6, 2.4, 3.2 or 4, so landing this close took some luck. A reliable answer needs many more points.",
    tryInput: { samples: 5, seed: 5 },
  },

  terms: [
    { term: "Random sample", meaning: "One case picked by chance, such as one point thrown into the square. A good sample has no preference for any part of the square." },
    { term: "Estimate", meaning: "A calculated guess at a number you cannot measure exactly, such as 3.2 for the value of π." },
    { term: "Error", meaning: "The distance between an estimate and the true value." },
    { term: "Seed", meaning: "A starting number for the computer's random number formula. The same seed always produces the same sequence of points." },
    { term: "Law of large numbers", meaning: "The fact that the average of many independent random samples settles ever closer to the true average." },
    { term: "Standard error", meaning: "The typical size of the error for a given number of samples. Some runs do better and some do worse." },
    { term: "Dimension", meaning: "The number of separate values needed to describe one case. A point in a square needs two. A path of light with ten bounces needs many more." },
  ],

  takeaway: "When you cannot work out an answer, try many random cases and count: the fraction that succeed is your estimate, and it sharpens slowly as the cases pile up.",

  viz: {
    describe: 'A unit square with a shaded quarter circle of radius 1 in its lower left corner. Random points appear one after another: points inside the quarter circle are forest green, points outside are ochre, and the newest point is terracotta with a ring. A second, smaller chart plots the running estimate of π against the number of points thrown, with a dashed line at the true value and a sage band showing the typical size of the error, which narrows as points are added.',
    inputs: [
      { id: 'samples', type: 'range', label: 'Number of points (n)', min: 5, max: 4000, step: 5, default: 400,
        help: 'The first 20 points are shown one at a time, the rest in batches.' },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 12 },
    ],
    presets: [
      { label: 'Five points by hand', values: { samples: 5, seed: 5 } },
      { label: '100 points', values: { samples: 100, seed: 12 } },
      { label: '400 points', values: { samples: 400, seed: 12 } },
      { label: '1600 points', values: { samples: 1600, seed: 12 } },
      { label: '4000 points', values: { samples: 4000, seed: 12 } },
    ],
    tryThis: [
      'Keep 400 points and press Randomize on the seed several times. The estimate changes from run to run, usually by less than 0.1 either way. That spread is the error you should expect at this sample size.',
      'Load "100 points", then "400 points", then "1600 points", and read the typical error in the output panel each time: about 0.164, then 0.082, then 0.041. Each step uses four times as many points and halves the error, and the sage band at the right-hand end of the lower chart is half as wide.',
      'Load "4000 points" and watch the lower chart. The estimate swings wildly at first and then settles, but it never stops wobbling. It tends to stay within about twice the width of the band.',
    ],
    run,
    report: (r, c) => `Estimate of π: ${f4(r.estimate)} from ${r.samples} points (${r.inside} inside the quarter circle).\nError in this run: ${f4(r.error)}. Typical error at this sample size: about ${f4(r.typicalError)}.\n${c.samples || 0} random points drawn.`,
    experiment: {
      title: 'Work as the number of points grows',
      note: 'Each point is a real run. The work is exactly one random point per sample, so the cost grows in a straight line. The error does not appear on this chart: it falls only as 1/√n, so a tenfold increase in work buys roughly a threefold reduction in error. The tests of this lesson measure that scaling over many seeds.',
      metric: 'samples',
      metricLabel: 'Random points drawn',
      sizeLabel: 'Number of points (n)',
      sizes: [100, 300, 1000, 3000, 10000, 30000, 100000],
      variants: [{ id: 'uniform', label: 'Uniform random points' }],
      input: (n, variant, seed) => ({ samples: n, seed }),
      theory: [{ label: 'n', fn: (n) => n }],
    },
  },

  logic: {
    intuition: 'The chance that a random point lands in a region equals the fraction of the square that the region covers. So counting how often points land there measures its area. Each point is a tiny, very noisy measurement that says either "inside" or "outside". Averaging many of them cancels most of the noise, because the errors of independent samples do not all point the same way.',
    steps: [
      'Describe the quantity as an average. Here: the area of the quarter circle is the chance that a uniformly random point of the unit square satisfies x² + y² ≤ 1.',
      'Draw a random point: two independent random numbers between 0 and 1.',
      'Test the point and add 1 to a counter if it is inside.',
      'Repeat steps 2 and 3 for n points.',
      'Report the fraction inside as the estimate of the area, and multiply by 4 for π.',
      'Report an error bar as well. The standard error of the estimate is its spread divided by √n, and the spread can be estimated from the same samples.',
    ],
    pseudocode: [
      'estimate_pi(n):',
      '  inside ← 0',
      '  repeat n times:',
      '    x ← random number between 0 and 1',
      '    y ← random number between 0 and 1',
      '    if x² + y² ≤ 1:',
      '      inside ← inside + 1',
      '  return 4 × inside / n',
    ],
    decisions: [
      { title: 'How many samples?', text: 'Decide from the accuracy you need. The standard error is σ/√n, where σ is the standard deviation of a single sample\'s contribution. For this problem σ is about 1.64, so 400 points give a typical error near 0.08 and 40,000 points give about 0.008. Each extra decimal digit costs a hundred times more samples.' },
      { title: 'What to sample from?', text: 'The samples must come from the distribution the average is defined over. Here that is the uniform distribution on the square, which is easy. When some regions matter far more than others, sampling them more often and correcting with weights (importance sampling) reduces the error for the same n.' },
      { title: 'Which random number generator?', text: 'A pseudo-random generator with a seed makes a run repeatable, which matters for debugging and for scientific reproducibility. A poor generator with visible patterns can bias the answer, so use a well-tested one.' },
    ],
    invariants: [
      'After k points, `inside` equals the number of the first k points that satisfy x² + y² ≤ 1, and the running estimate is 4 × inside / k.',
      'The estimate is unbiased at every k: averaged over all possible random sequences it equals π exactly.',
    ],
    edgeCases: [
      'Very small n: with 5 points the only possible estimates are 0, 0.8, 1.6, 2.4, 3.2 and 4.',
      'Points exactly on the arc have probability zero in exact arithmetic, so whether the test uses ≤ or < does not matter.',
      'Rare events: if the region covers a tiny fraction of the sampling box, almost every sample misses and the relative error is huge. A ball inside a cube in 10 dimensions covers only about 0.25 percent of the cube.',
      'Quantities with infinite variance: the 1/√n rule requires a finite variance. Without it the average may still converge, but more slowly and erratically.',
      'Correlated samples, for example from a poor generator or from a Markov chain, carry less information than n independent ones.',
    ],
    correctness: 'Each point is inside with probability p = π/4, independently of the others. By the law of large numbers the fraction inside converges to p as n grows, so 4 × fraction converges to π. The estimate is unbiased for every n, because the expected value of the fraction is exactly p. The central limit theorem adds a rate: for large n the error is approximately normal with standard deviation √(π(4 − π)/n), about 1.64/√n. The guarantee is statistical. Any single run can be unlucky, and no number of samples makes the answer certain.',
    mistakes: [
      'Drawing the random point once, outside the loop, so every trial tests the same point.',
      'Using the same random number for both coordinates, which puts every point on the diagonal.',
      'Reporting an estimate without its standard error, so nobody can tell whether three digits or none are trustworthy.',
      'Expecting the error to halve when the sample size doubles. It takes four times as many samples.',
      'Reusing one seed for runs that are supposed to be independent, then averaging identical results.',
    ],
  },

  code: {
    sample: {
      input: 'Estimate π from 100, 10,000 and 1,000,000 random points, using a small generator that behaves identically in every language (seed 2024).',
      expected: 'n=    100: pi is about 3.3200 (error 0.1784)\nn=  10000: pi is about 3.1532 (error 0.0116)\nn=1000000: pi is about 3.1406 (error 0.0010)',
    },
    python: {
      source: `class Lcg:
    """A small random number generator (Park-Miller). Integer arithmetic only,
    so it produces the same numbers in every language."""

    def __init__(self, seed):
        self.state = seed

    def uniform(self):
        self.state = self.state * 48271 % 2147483647
        return self.state / 2147483647


def estimate_pi(n, rng):
    inside = 0
    for _ in range(n):
        x = rng.uniform()
        y = rng.uniform()
        if x * x + y * y <= 1.0:
            inside += 1
    return 4 * inside / n


PI = 3.141592653589793
for n in [100, 10000, 1000000]:
    estimate = estimate_pi(n, Lcg(2024))
    print(f"n={n:7d}: pi is about {estimate:.4f} (error {abs(estimate - PI):.4f})")`,
      notes: [
        { line: 9, text: 'One step of the generator: multiply, take the remainder. Dividing by the modulus on the next line turns the state into a number between 0 and 1.' },
        { line: 18, text: 'The test for "inside the quarter circle". No square root is needed, because the distance is at most 1 exactly when its square is.' },
        { line: 20, text: 'The fraction inside estimates the area π/4, so multiply by 4.' },
        { line: 24, text: 'Each run uses 100 times as many points as the one before. On average that divides the error by 10, though a single run can do better or worse than average.' },
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
}

function estimatePi(n, rng) {
  let inside = 0;
  for (let i = 0; i < n; i++) {
    const x = rng.uniform();
    const y = rng.uniform();
    if (x * x + y * y <= 1.0) inside += 1;
  }
  return (4 * inside) / n;
}

for (const n of [100, 10000, 1000000]) {
  const estimate = estimatePi(n, new Lcg(2024));
  const error = Math.abs(estimate - Math.PI);
  console.log("n=" + String(n).padStart(7, " ") + ": pi is about " + estimate.toFixed(4) + " (error " + error.toFixed(4) + ")");
}`,
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
};

double estimate_pi(int n, Lcg rng) {
    int inside = 0;
    for (int i = 0; i < n; ++i) {
        double x = rng.uniform();
        double y = rng.uniform();
        if (x * x + y * y <= 1.0) inside += 1;
    }
    return 4.0 * inside / n;
}

int main() {
    const double PI = 3.141592653589793;
    const int sizes[] = {100, 10000, 1000000};
    for (int n : sizes) {
        double estimate = estimate_pi(n, Lcg{2024});
        std::printf("n=%7d: pi is about %.4f (error %.4f)\\n", n, estimate, std::fabs(estimate - PI));
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The work is one sample per point, so time grows in a straight line with n and memory does not grow at all. The interesting cost is the exchange rate between work and accuracy: the standard error is σ/√n, so reaching an error of ε takes about (σ/ε)² samples.',
    cases: [
      { case: 'n samples', time: 'O(n)', when: 'Always. Each sample costs one draw and one test. For other problems, replace "one test" by the cost of evaluating one random case.' },
      { case: 'Target error ε', time: 'O(σ²/ε²) samples', when: 'σ is the standard deviation of one sample\'s contribution. Halving ε multiplies the work by four, in any number of dimensions.' },
      { case: 'Grid rule in d dimensions, for comparison', time: 'About (1/ε)^(d/2) points for the trapezoid rule', when: 'A rule whose error falls like 1/m² in one dimension, with m points per axis, needs m^d points in d dimensions. Monte Carlo needs fewer once d is larger than 4.' },
    ],
    space: 'O(1): a counter and the generator state. The page stores the points only in order to draw them.',
    memory: 'Samples are used once and discarded, so the method runs in constant memory however long it runs. Independent runs can be spread across many machines and their counts added, as long as each machine uses a different random stream.',
    tradeoffs: 'Monte Carlo is slow but indifferent to dimension and to how irregular the problem is. Deterministic quadrature is much faster for smooth, low-dimensional integrals. Variance reduction techniques and low-discrepancy (quasi-Monte Carlo) sequences sit in between: they keep the generality and improve the constant or the rate.',
    assumptions: [
      'Samples are independent and drawn from the intended distribution.',
      'The quantity being averaged has a finite variance σ².',
      'The 1/√n rate does not depend on dimension, but σ does depend on the problem and can grow with dimension, as it does for rare events.',
      '"Error" means the standard error, a typical size. It is a statement about probability and not a guaranteed bound.',
      'The comparison with grid rules assumes a smooth integrand and the trapezoid rule; higher-order rules shift the break-even dimension upward.',
    ],
  },

  tradeoffs: {
    excels: [
      'Problems with many variables, where grids are impossible.',
      'Irregular regions and integrands that are only available as a program to run.',
      'Settings where a rough answer with an honest error bar is enough.',
      'Parallel hardware: samples are independent, so the work splits cleanly.',
    ],
    struggles: [
      'High accuracy: each extra digit costs a hundred times more samples.',
      'Rare events, where almost no sample lands in the region that matters.',
      'Smooth one-dimensional or two-dimensional integrals, where classical rules are far more efficient.',
      'Distributions that cannot be sampled directly.',
    ],
    misunderstandings: [
      "\"Twice as many samples gives twice the accuracy.\" The error falls with the square root of the sample count. Twice the samples improves it by a factor of about 1.4. Twice the accuracy needs four times the samples.",
      "\"With enough samples the answer is exact.\" The error keeps shrinking but never reaches zero, and every statement about it is a statement about probability.",
      "\"It is a good way to compute π.\" It is a clear demonstration and a poor method. A million points give about three correct decimals. Series designed for π give many digits from every term.",
      "\"Random means unrepeatable.\" Computer random numbers come from a formula. The same seed reproduces the same run exactly, which is what makes results checkable.",
    ],
    pitfalls: [
      'A weak or badly seeded generator, especially many parallel streams started from nearby seeds without a generator designed for that.',
      'Quoting more digits than the standard error supports.',
      'Stopping a run at a moment when the estimate happens to look good. Decide the sample size in advance.',
    ],
    constraints: [
      'In practice the cost per sample dominates: one sample may be a full physical simulation or the tracing of one light path.',
      'Production systems rarely use plain sampling. They add importance sampling, stratification or control variates to cut the variance.',
    ],
    alternatives: [
      { name: 'Numerical quadrature (trapezoid, Simpson, Gaussian rules)', when: 'The integrand is smooth and has one to three variables. The error falls much faster than 1/√n.' },
      { name: 'Quasi-Monte Carlo', when: 'The integrand is reasonably smooth and the dimension is moderate. Evenly spread, deterministic point sets can approach an error rate of 1/n.' },
      { id: 'metropolis-hastings', name: 'Metropolis-Hastings', when: 'You cannot draw independent samples from the distribution, only evaluate its density up to a constant.' },
      { id: 'binomial-option-pricing', name: 'Binomial Option Pricing', when: 'The uncertain quantity can be modelled as a small tree of up and down moves that can be enumerated exactly.' },
    ],
    comparison: {
      columns: ['', 'Monte Carlo', 'Grid quadrature', 'Quasi-Monte Carlo'],
      rows: [
        ['Points used', 'Random', 'Evenly spaced on every axis', 'Deterministic, evenly spread sequences'],
        ['Error with n points', 'About σ/√n in any dimension', 'About n^(−2/d) for the trapezoid rule', 'Close to 1/n for smooth integrands'],
        ['Error estimate', 'From the sample variance', 'From comparing grid sizes', 'Harder; often by randomizing the sequence'],
        ['Best for', 'Many variables, rough integrands', 'Few variables, smooth integrands', 'Moderate dimension, smooth integrands'],
      ],
    },
  },

  applications: [
    { title: 'Neutron transport', status: 'established', text: 'The method was developed at Los Alamos in the late 1940s to follow the random histories of individual neutrons through fissile material: how far each travels, whether it scatters, is absorbed or causes fission. Particle transport codes still work this way.' },
    { title: 'Path tracing in rendering', status: 'established', text: 'The brightness of a pixel is an integral over every path light can take from the lamps to the camera. Path tracers estimate it by following random paths and averaging. The grain visible in an unfinished render is Monte Carlo error, and it fades as 1/√n.' },
    { title: 'Pricing by simulation', status: 'established', text: 'The value of a derivative contract is an expected payoff. Simulating many random price paths and averaging the discounted payoffs has been a standard valuation method since Phelim Boyle introduced it for options in 1977.' },
    { title: 'Evaluating Bayesian models', status: 'established', text: 'Averages over a posterior distribution rarely have formulas. Statistical software draws samples from the posterior, usually with Markov chain methods, and reports Monte Carlo averages of them.' },
    { title: 'Project and risk estimates', status: 'illustrative', text: 'If each task in a plan has an uncertain duration, simulating the whole plan thousands of times gives a distribution of finish dates and not just one guess.' },
  ],

  connections: [
    { to: 'metropolis-hastings', type: 'advanced', why: 'Both estimate averages from random samples. Metropolis-Hastings supplies the samples when the distribution cannot be drawn from directly, at the price of samples that are correlated.' },
    { to: 'bayesian-updating', type: 'application', why: 'A posterior distribution is summarized by averages over it. When those have no formula they are estimated by Monte Carlo.' },
    { to: 'reservoir-sampling', type: 'related', why: 'Both rest on drawing fair random samples. Reservoir sampling makes sure every item of a stream has the same chance of being picked; Monte Carlo then averages over whatever sample it is given.' },
    { to: 'simulated-annealing', type: 'related', why: 'Both spend random draws to explore a space too large to enumerate. Annealing uses them to search for a minimum, Monte Carlo to estimate an average.' },
    { to: 'rrt', type: 'related', why: 'Both replace a grid over a space by random samples of it, for the same reason: the number of grid cells explodes as dimensions are added.' },
    { to: 'ddpm', type: 'related', why: 'A diffusion model is trained on a Monte Carlo estimate of its loss, using randomly drawn noise levels and noise samples, and it generates images by a chain of random draws.' },
    { to: 'particle-filter', type: 'advanced', why: 'A particle filter represents a belief about a hidden state by a cloud of random samples and reweights them as measurements arrive: Monte Carlo applied step by step in time.' },
    { to: 'binomial-option-pricing', type: 'same-problem', why: 'Both compute an expected payoff over uncertain price paths. The binomial tree enumerates a simplified set of paths exactly; Monte Carlo samples from the full set.' },
    { to: 'concept:law-of-large-numbers', type: 'prerequisite', why: 'The method works because the average of independent samples converges to the expected value.' },
    { to: 'concept:expectation', type: 'prerequisite', why: 'Every Monte Carlo estimate is an estimate of an expected value. Areas and probabilities are special cases.' },
    { to: 'concept:simulation', type: 'related', why: 'Running a random model many times and tallying the outcomes is Monte Carlo estimation of that model\'s averages.' },
    { to: 'discipline:physics', type: 'application', why: 'Particle transport and statistical mechanics average over random histories or configurations.' },
    { to: 'discipline:computer-graphics', type: 'application', why: 'Physically based rendering estimates the light transport integral by sampling random paths.' },
    { to: 'discipline:finance', type: 'application', why: 'Prices and risk measures are expectations over simulated market scenarios.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why is the fraction of points inside the quarter circle multiplied by 4?',
      options: ['Because each point has four neighbours', 'Because the fraction estimates the area π/4 of the quarter circle', 'Because the square has four sides', 'To correct for points that land outside'],
      answer: 1,
      explain: [
        'Points are independent of each other; neighbours play no part.',
        'Correct. A quarter circle of radius 1 has area π/4, and the square has area 1, so the fraction inside estimates π/4.',
        'The number of sides is a coincidence. With a full circle inside a square of side 2 the factor is still 4, because the ratio of areas is still π/4.',
        'Points outside are not an error to be corrected. They are half of the measurement.',
      ],
    },
    {
      type: 'predict',
      q: 'With 500 points the typical error of the estimate is about 0.073. How many points are needed to bring the typical error down to about half of that?',
      options: ['1000', '2000', '5000', '250000'],
      answer: 1,
      explain: [
        'Doubling the points divides the error by √2, about 1.4, giving roughly 0.052.',
        'Correct. The error falls like 1/√n, so halving it needs four times as many points. The output panel reports a typical error of about 0.037 for 2000 points.',
        'Ten times the points divides the error by about 3.2. That is more than was asked for.',
        'Squaring the sample count is far more than needed. It would divide the error by about 22.',
      ],
      tryInput: { samples: 2000, seed: 12 },
    },
    {
      type: 'debug',
      q: 'This program prints either 0.0 or 4.0, whatever value of n is used. What is wrong?',
      code: `inside = 0
x, y = rng.uniform(), rng.uniform()
for _ in range(n):
    if x * x + y * y <= 1.0:
        inside += 1
print(4 * inside / n)`,
      options: ['The test should use < and not <=', 'The point is drawn once, before the loop, so every trial tests the same point', 'It should divide by inside and not by n', 'The loop should run n + 1 times'],
      answer: 1,
      explain: [
        'A point exactly on the arc is so unlikely that the choice between < and <= makes no measurable difference.',
        'Correct. All n trials see the same point, so either all of them count or none do. The two draws belong inside the loop.',
        'Dividing by n is right: the estimate is the fraction of all points that are inside.',
        'The number of trials is correct. The trials themselves are not independent.',
      ],
    },
    {
      type: 'choice',
      q: 'A team must average a quantity over 30 uncertain inputs. Why would they choose Monte Carlo over a grid with 10 values per input?',
      options: ['Monte Carlo is exact and the grid is not', 'The grid would need 10³⁰ evaluations, while the Monte Carlo error depends on the number of samples and not on the 30', 'Random numbers are faster to generate than grid points', 'Grids cannot be used with more than three inputs'],
      answer: 1,
      explain: [
        'Monte Carlo is never exact. Its strength is elsewhere.',
        'Correct. A full grid multiplies by 10 for every input. The Monte Carlo standard error is σ/√n whatever the number of inputs.',
        'Generating the points is cheap either way. The number of evaluations is what differs.',
        'Grids work in any dimension in principle. They become unaffordable, which is a different thing.',
      ],
    },
    {
      type: 'challenge',
      title: 'Measure the error, then shrink it',
      prompt: 'Run the estimator 200 times with different seeds at n = 1000 and compute the root-mean-square error. Compare it with the prediction 1.64/√n. Then change the estimator to stratified sampling: divide the square into a 32 by 32 grid of cells and draw one random point in each cell (1024 points). Measure the error again over 200 runs and explain why it is smaller.',
      hints: ['The cells that lie entirely inside or entirely outside the quarter circle contribute no randomness at all.', 'Only the cells cut by the arc are uncertain, and there are at most 63 of them out of 1024.'],
    },
  ],

  compare: {
    idea: 'Average over random samples; the fraction of random points inside a region estimates its area.',
    requires: 'A way to draw fair random samples of the situation. The answer is approximate, with a margin of error that can be estimated.',
    sensitivity: 'Low sensitivity to dimension and to irregular shapes. High sensitivity to rare events and to the quality of the random numbers.',
    memory: 'O(1): a running count.',
    difficulty: 'low',
    difficultyNote: 'A loop and a counter. The skill lies in knowing how much to trust the answer.',
    limits: 'Slow to sharpen: one more digit of accuracy takes a hundred times the work. It is never exact.',
    useWhen: 'The quantity is an average over many uncertain things, and an answer with a stated margin of error is acceptable.',
  },

  advanced: {
    history: 'Estimating a number by a random experiment is older than computers: in the eighteenth century Buffon showed that the chance of a dropped needle crossing a ruled line involves π. The modern method dates from 1946 at Los Alamos. Stanislaw Ulam, thinking about the chance of winning a game of solitaire, realized that playing many random games and counting would be easier than combinatorial analysis, and that the same idea applied to neutron diffusion. John von Neumann worked out how to run such calculations on the ENIAC, the first general-purpose electronic computer. Nicholas Metropolis suggested the name, after the casino in Monaco. Metropolis and Ulam described the method in an open journal paper in 1949.',
    derivation: 'Let $X_1, \\dots, X_n$ be independent indicators with $X_i = 1$ if point $i$ lands inside the quarter circle. Each has $P(X_i = 1) = p = \\pi/4$. The estimator is\n\n$$\\hat\\pi_n = \\frac{4}{n}\\sum_{i=1}^{n} X_i, \\qquad \\mathbb{E}[\\hat\\pi_n] = 4p = \\pi.$$\n\nThe variance of one indicator is $p(1-p)$, and variances of independent terms add, so\n\n$$\\operatorname{Var}(\\hat\\pi_n) = \\frac{16\\,p(1-p)}{n} = \\frac{\\pi(4-\\pi)}{n}, \\qquad \\text{standard error} = \\sqrt{\\frac{\\pi(4-\\pi)}{n}} \\approx \\frac{1.64}{\\sqrt{n}}.$$\n\nNothing in this argument used the fact that the points are two-dimensional. For a general integral $I = \\int f(x)\\,p(x)\\,dx$ estimated by $\\frac{1}{n}\\sum f(X_i)$ with $X_i \\sim p$, the same steps give a standard error of $\\sigma_f/\\sqrt{n}$, where $\\sigma_f^2 = \\operatorname{Var}_p(f)$, in any number of dimensions.',
    proof: 'Convergence follows from the strong law of large numbers: since the $X_i$ are independent and identically distributed with finite mean $p$, $\\frac{1}{n}\\sum X_i \\to p$ with probability 1, hence $\\hat\\pi_n \\to \\pi$. The rate follows from the central limit theorem: $\\sqrt{n}\\,(\\hat\\pi_n - \\pi)$ converges in distribution to a normal variable with mean 0 and variance $\\pi(4-\\pi)$. So for large $n$ the estimate lies within two standard errors of $\\pi$ about 95 percent of the time.',
    complexityProof: 'To make the standard error at most $\\varepsilon$ requires $\\sigma/\\sqrt{n} \\le \\varepsilon$, that is $n \\ge \\sigma^2/\\varepsilon^2$. Compare a product trapezoid rule with $m$ points per axis in $d$ dimensions: it uses $n = m^d$ points and has error of order $m^{-2} = n^{-2/d}$ for a smooth integrand. The Monte Carlo rate $n^{-1/2}$ is better whenever $2/d < 1/2$, that is for $d > 4$.',
    variants: [
      { name: 'Importance sampling', text: 'Draws samples from a distribution concentrated where the integrand is large and reweights them. A good choice can reduce the variance by orders of magnitude; a bad one can make it infinite.' },
      { name: 'Stratified sampling', text: 'Splits the domain into cells and samples each one, which removes the variation between cells from the error.' },
      { name: 'Control variates and antithetic variates', text: 'Use a correlated quantity with a known average, or deliberately negatively correlated pairs of samples, to cancel part of the noise.' },
      { name: 'Quasi-Monte Carlo', text: 'Replaces random points by low-discrepancy sequences such as Sobol or Halton points, which fill space more evenly than random points do.' },
      { name: 'Markov chain Monte Carlo', text: 'Generates dependent samples from a distribution that cannot be sampled directly, by running a suitably designed random walk.' },
    ],
    implementation: 'Accumulate the sum and the sum of squares of the sampled values so that the standard error can be reported with the estimate. Use a well-tested generator and, for parallel runs, a generator that provides independent streams. For reproducible science, record the seed and the generator.',
    benchmarking: 'Compare methods by the variance achieved per unit of computing time, not by sample count alone: a variance reduction technique that halves the variance but triples the cost per sample is a loss. Estimate the error from repeated independent runs, as the tests of this lesson do.',
    references: [
      { authors: 'N. Metropolis and S. Ulam', year: 1949, title: 'The Monte Carlo method', venue: 'Journal of the American Statistical Association 44(247), 335-341' },
      { authors: 'N. Metropolis', year: 1987, title: 'The beginning of the Monte Carlo method', venue: 'Los Alamos Science, Special Issue 15' },
      { authors: 'P. P. Boyle', year: 1977, title: 'Options: a Monte Carlo approach', venue: 'Journal of Financial Economics 4(3), 323-338' },
      { authors: 'J. T. Kajiya', year: 1986, title: 'The rendering equation', venue: 'Computer Graphics (Proceedings of SIGGRAPH 86) 20(4)' },
      { authors: 'C. P. Robert and G. Casella', year: 2004, title: 'Monte Carlo Statistical Methods (2nd edition)', venue: 'Springer' },
    ],
    furtherReading: [
      'R. Eckhardt, "Stan Ulam, John von Neumann, and the Monte Carlo method", *Los Alamos Science*, Special Issue 15 (1987).',
      'A. B. Owen, *Monte Carlo Theory, Methods and Examples*, a textbook the author makes available online.',
    ],
  },

  tests: [
    { name: 'the worked example: five points, four inside, estimate 3.2', input: { samples: 5, seed: 5 },
      check: (r) => {
        const want = [[0.69, 0.77, false], [0.22, 0.62, true], [0.09, 0.59, true], [0.72, 0.46, true], [0.91, 0.23, true]];
        const bad = want.findIndex(([x, y, hit], i) => f2(r.first[i].x) !== f2(x) || f2(r.first[i].y) !== f2(y) || r.first[i].hit !== hit);
        if (bad >= 0) return `point ${bad + 1} is (${f2(r.first[bad].x)}, ${f2(r.first[bad].y)})`;
        return (r.inside === 4 && Math.abs(r.estimate - 3.2) < 1e-12) || `got ${r.inside} inside, estimate ${r.estimate}`;
      } },
    { name: 'the estimate equals 4 × inside / n and is near π for 4000 points', input: { samples: 4000, seed: 12 },
      check: (r, c) => (c.samples === 4000 && r.estimate === (4 * r.inside) / 4000 && r.error < 5 * typicalError(4000)) || `estimate ${r.estimate}, error ${r.error}` },
    { name: 'error shrinks like 1/√n: 100 times the points gives about a tenth of the error', input: { samples: 100, seed: 1 },
      check: () => {
        const ratio = rmsError(100, 80) / rmsError(10000, 80);
        return (ratio > 7 && ratio < 14) || `RMS error ratio was ${ratio.toFixed(2)}, expected about 10`;
      } },
    { name: 'RMS error over 300 seeds matches √(π(4 − π)/n)', input: { samples: 1000, seed: 1 },
      check: () => {
        const measured = rmsError(1000, 300), predicted = typicalError(1000);
        return Math.abs(measured / predicted - 1) < 0.2 || `measured ${measured.toFixed(4)}, predicted ${predicted.toFixed(4)}`;
      } },
    { name: 'quiz and presets: typical error at 2000 points is half that at 500; 0.164, 0.082, 0.041 at 100, 400, 1600', input: { samples: 2000, seed: 12 },
      check: (r) => (Math.abs(r.typicalError - typicalError(500) / 2) < 1e-12 && f4(typicalError(500)) === '0.0734' && f4(r.typicalError) === '0.0367'
        && typicalError(100).toFixed(3) === '0.164' && typicalError(400).toFixed(3) === '0.082' && typicalError(1600).toFixed(3) === '0.041') || `typical error ${r.typicalError}` },
    { name: 'the same seed reproduces the same run, and one point gives 0 or 4', input: { samples: 400, seed: 77 },
      check: (r) => {
        const again = run({ samples: 400, seed: 77 }, QUIET);
        if (again.estimate !== r.estimate) return 'two runs with the same seed disagree';
        const one = run({ samples: 1, seed: 3 }, QUIET);
        return one.estimate === 0 || one.estimate === 4 || `one point gave ${one.estimate}`;
      } },
  ],
};
