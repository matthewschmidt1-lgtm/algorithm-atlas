import { makeRng } from '../../js/lib/rng.js';

const QUIET = { record: false, count() {}, frame() {} };
const f3 = (v) => v.toFixed(3);
// Expected number of replacements: each item i > k replaces something with probability k / i.
const expectedReplacements = (n, k) => { let s = 0; for (let i = k + 1; i <= n; i++) s += k / i; return s; };

function run(input, t) {
  const n = Math.floor(Number(input.n)), k = Math.floor(Number(input.k));
  if (!(n >= 1)) throw new Error('The stream needs at least one item.');
  if (!(k >= 1)) throw new Error('The reservoir needs room for at least one item.');
  const rng = makeRng(input.seed);
  const keepLog = n <= 2000;
  const reservoir = [];
  const log = [];
  let replacements = 0, draws = 0;
  t.count('replacements', 0);
  t.count('random draws', 0);

  const legend = [
    { label: 'item just kept', role: 'current' }, { label: 'item just passed over', role: 'rejected' },
    { label: 'in the reservoir', role: 'done' }, { label: 'draws that mean "keep"', role: 'compare' },
  ];
  // i: items seen so far; step: what happened to item i ({ j, slot, kept }) or null.
  const views = (i, step) => {
    const inRes = new Set(reservoir);
    const stream = [];
    for (let item = 1; item <= i; item++) {
      const role = step && item === i ? (step.kept ? 'current' : 'rejected') : inRes.has(item) ? 'done' : 'dim';
      stream.push({ t: item, role });
    }
    if (i < n) stream.push({ t: '…', role: 'faint' });
    const slots = Array.from({ length: k }, (_, s) => ({
      t: reservoir[s] === undefined ? '' : reservoir[s], sub: `slot ${s + 1}`,
      role: step && step.kept && step.slot === s ? 'current' : reservoir[s] === undefined ? 'default' : 'done',
    }));
    const draw = step && step.j
      ? Array.from({ length: i }, (_, d) => ({ t: d + 1, role: d + 1 === step.j ? (step.kept ? 'current' : 'rejected') : d + 1 <= k ? 'compare' : 'default' }))
      : [{ t: i === 0 ? 'nothing drawn yet' : i <= k ? 'no draw needed while there is room' : 'finished', role: 'faint' }];
    return [{ kind: 'rows', rows: [
      { label: 'Stream so far', cells: stream },
      { label: 'Reservoir', cells: slots },
      { label: step && step.j ? `Draw 1 to ${i}` : 'Draw', cells: draw },
    ], legend }];
  };

  t.frame(() => ({ line: [0, 1, 2], note: `The reservoir has room for ${k} ${k === 1 ? 'item' : 'items'}. Items will arrive one at a time, and the algorithm is not told how many there will be. The goal: whenever the stream stops, every item seen should have had the same chance of being in the reservoir.`, views: views(0, null), vars: { k, i: 0 } }));

  for (let i = 1; i <= n; i++) {
    const item = i;                      // items are numbered in order of arrival
    if (i <= k) {
      reservoir.push(item);
      if (keepLog) log.push({ i, j: null, kept: true, slot: i - 1, evicted: null });
      t.frame(() => ({ line: [3, 4, 5, 6], note: `Item ${item} arrives. The reservoir still has room, so it goes straight into slot ${i}. So far every item has been kept, a chance of 1 each.`, views: views(i, { kept: true, slot: i - 1 }), vars: { i, 'chance each item is held': '1' } }));
      continue;
    }
    const j = rng.int(1, i);
    draws++;
    t.count('random draws');
    const kept = j <= k;
    let evicted = null;
    if (kept) {
      evicted = reservoir[j - 1];
      reservoir[j - 1] = item;
      replacements++;
      t.count('replacements');
    }
    if (keepLog) log.push({ i, j, kept, slot: kept ? j - 1 : null, evicted });
    t.frame(() => ({ line: kept ? [3, 4, 7, 8, 9, 10] : [3, 4, 7, 8, 9],
      note: kept
        ? `Item ${item} arrives. It should be kept with a chance of ${k} in ${i}, so draw a whole number from 1 to ${i}: **${j}**. That is at most ${k}, so item ${item} replaces the item in slot ${j}, which was item ${evicted}. Each of the ${i} items seen so far now has the same chance, ${k}/${i}, of being in the reservoir.`
        : `Item ${item} arrives. It should be kept with a chance of ${k} in ${i}, so draw a whole number from 1 to ${i}: **${j}**. That is more than ${k}, so item ${item} is passed over and the reservoir stays as it is. Each of the ${i} items seen so far still has the same chance, ${k}/${i}, of being in the reservoir.`,
      views: views(i, { j, kept, slot: j - 1 }), vars: { i, j, 'chance each item is held': `${k}/${i} = ${f3(k / i)}` } }));
  }

  const final = reservoir.slice();
  t.frame(() => ({ line: 11,
    note: n <= k
      ? `The stream ended after ${n} ${n === 1 ? 'item' : 'items'}, no more than the reservoir can hold. The sample is the whole stream: ${final.join(', ')}.`
      : `The stream ended after ${n} items. The reservoir holds items ${final.join(', ')}. Each of the ${n} items had the same chance, ${k}/${n} = ${f3(k / n)}, of being here, although nobody knew the stream would stop at ${n}.`,
    views: views(n, null), vars: { n, k } }));

  return { reservoir: final, n, k, replacements, draws, log };
}

// How often each item ends up in the reservoir across many seeds.
function inclusionRates(n, k, seeds) {
  const counts = new Array(n).fill(0);
  for (let s = 1; s <= seeds; s++) for (const item of run({ n, k, seed: 7000 + s }, QUIET).reservoir) counts[item - 1]++;
  return counts.map((c) => c / seeds);
}

export default {
  meta: {
    id: 'reservoir-sampling',
    name: 'Reservoir Sampling',
    aliases: ['Algorithm R', 'stream sampling', 'random sample from a stream', 'sampling without replacement in one pass'],
    kind: 'algorithm',
    discipline: 'statistics',
    alsoIn: [
      { id: 'distributed-systems', why: 'Logs, traces and event streams are too large to store, so systems keep a fixed-size uniform sample of them as they flow past.' },
      { id: 'algorithms', why: 'It is a standard example of a streaming algorithm: one pass, a fixed amount of memory, and a guarantee that holds at every moment.' },
    ],
    subfield: 'Sampling',
    family: 'Streaming sampling',
    lab: 'probability-statistics',
    summary: 'Keeps a uniform random sample of k items from a stream of unknown length, in one pass and with memory for only k items.',
    difficulty: 'intermediate',
    order: 720,
    paradigms: ['randomized-sampling'],
    randomized: true,
    approximate: false,
    time: { best: 'O(n)', average: 'O(n)', worst: 'O(n)', class: 'linear' },
    space: { worst: 'O(k)', class: 'other' },
    tags: {
      problems: ['pick random items from a stream', 'sample a file too big for memory', 'choose a random line from a file', 'fair sample when the total is unknown', 'sample log entries'],
      techniques: ['random replacement', 'single pass', 'streaming', 'uniform sampling'],
      applications: ['data processing', 'databases', 'distributed systems', 'statistics', 'machine learning'],
    },
    prerequisites: ['concept:probability', 'concept:sampling', 'concept:randomization', 'concept:invariant'],
  },

  bigIdea: {
    simple: "Reservoir sampling picks a fair random handful from a stream of things when you do not know how long the stream will be. Imagine watching a parade with room in your notebook for only three names. Marchers pass one at a time, and nobody will tell you how many are coming. You want every marcher to have the same chance of ending up in your notebook. Writing down the first three would be unfair to everyone after them. Here is the trick. Write down the first three. When the fourth marcher passes, give them a three in four chance of replacing a name chosen at random from your notebook. Give the fifth marcher a three in five chance, the sixth a three in six chance, and so on. Later marchers are less likely to get in. But earlier names have faced more chances of being pushed out. The two effects balance exactly. Whenever the parade ends, every marcher has had the same chance.",
    what: 'Reservoir sampling keeps a random sample of k items from a sequence that it reads once, from start to finish, without knowing its length in advance. It stores only the k items of the current sample, called the reservoir. After any number of items, the reservoir is a uniform random sample of everything read so far: every item has the same probability of being in it, and every group of k items is equally likely.',
    why: 'The obvious way to sample is to count the items, pick k random positions, and fetch them. That fails when the data is a live stream that cannot be rewound, when it is too large to store, or when it has no known end. Reservoir sampling needs none of those things. It makes one decision per item, on the spot, and never looks back.',
    when: 'Use it when items arrive one at a time and you need a fixed-size uniform sample at the end, or at any point along the way. If the whole collection is in memory and its size is known, shuffling it or picking k random positions directly is simpler. If items should be sampled in proportion to a weight, use a weighted variant.',
    interesting: 'The correctness argument is one line of arithmetic repeated. An item already in the reservoir survives the arrival of item i with probability (i − 1)/i. Multiply that by its chance of being there before, k/(i − 1), and the result is k/i: exactly the chance the new item was given. So fairness after i − 1 items implies fairness after i items, forever.',
    where: 'Database systems use it to gather the row samples from which they estimate statistics, monitoring systems use it to keep a bounded sample of events, and it is the standard way to pick a random line from a file in a single pass.',
    analogy: {
      title: 'Choosing one song from the radio',
      text: 'You decide to remember one song from tonight\'s radio show, chosen fairly, without knowing how many songs will play. Remember the first song. When the second plays, flip a coin to decide whether to switch to it. When the third plays, switch with a chance of one in three. For the tenth song, one in ten. At whatever moment the show ends, each song that played has had the same chance of being the one you remember.',
      limits: "This is the case of a sample of one. Keeping several items needs the extra step of choosing which held item to replace. A person also cannot produce honest one-in-ten chances in their head, while a program uses a random number generator. And a fair chance is not the same as a representative result: a sample of one song says little about the whole show.",
    },
  },

  example: {
    setup: "Keep a sample of 2 from a stream of items numbered 1, 2, 3 and so on in the order they arrive. The reservoir has two slots. For each item after the second, draw a random whole number between 1 and the item's position. If the number is 1 or 2, the new item replaces the item in that slot. Otherwise the new item is passed over.",
    steps: [
      "Items 1 and 2 arrive. There is room, so they fill slots 1 and 2. The reservoir is [1, 2].",
      "Item 3 arrives. Draw a number from 1 to 3: it comes up 2. That is a slot number, so item 3 replaces the item in slot 2. The reservoir is [1, 3].",
      "Item 4 arrives. Draw from 1 to 4: it comes up 1. Item 4 replaces the item in slot 1. The reservoir is [4, 3].",
      "Item 5 arrives. Draw from 1 to 5: it comes up 3. There is no slot 3, so item 5 is passed over.",
      "Item 6 arrives. Draw from 1 to 6: it comes up 6. Item 6 is passed over too.",
    ],
    result: "The stream ends and the sample is items 4 and 3. Item 5 had a 2 in 5 chance of getting in, and item 6 a 2 in 6 chance. Items 1 and 2 got in for free but then had to survive four draws that could have removed them. Worked out exactly, every one of the six items had the same 2 in 6 chance of being in the final sample.",
    tryInput: { n: 6, k: 2, seed: 1 },
  },

  terms: [
    { term: "Stream", meaning: "A sequence of items that arrive one at a time and cannot be revisited once they have passed." },
    { term: "Sample", meaning: "A small group of items chosen from a larger collection to stand for it." },
    { term: "Uniform", meaning: "Fair in the strict sense: every item has exactly the same chance of being chosen." },
    { term: "Reservoir", meaning: "The fixed number of slots that hold the current sample while the stream goes by." },
    { term: "Single pass", meaning: "Reading the data once, from beginning to end, without going back." },
    { term: "Invariant", meaning: "A statement that is true before and after every step of an algorithm. Here: every item seen so far is equally likely to be in the reservoir." },
  ],

  takeaway: "Keep the first k items, then let the i-th item replace a random one of them with chance k in i, and the sample stays fair however long the stream runs.",

  viz: {
    describe: 'Three rows of cells. The first row shows the stream so far: items now in the reservoir are forest green, items no longer or never held are dimmed, and the item just handled is terracotta if it was kept or brick if it was passed over. The second row shows the reservoir slots and their contents, with a slot that was just overwritten in terracotta. The third row shows the random draw for the current item: the whole numbers from 1 to the item\'s position, with the first k (the draws that mean "keep") in ochre and the number actually drawn highlighted.',
    inputs: [
      { id: 'n', type: 'range', label: 'Stream length (hidden from the algorithm)', min: 1, max: 60, step: 1, default: 20 },
      { id: 'k', type: 'range', label: 'Reservoir size (k)', min: 1, max: 10, step: 1, default: 4 },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 3 },
    ],
    presets: [
      { label: 'Two of six, by hand', values: { n: 6, k: 2, seed: 1 } },
      { label: 'Four of twenty', values: { n: 20, k: 4, seed: 3 } },
      { label: 'One item from a long stream', values: { n: 40, k: 1, seed: 12 } },
      { label: 'Stream shorter than the reservoir', values: { n: 3, k: 5, seed: 3 } },
      { label: 'Long stream', values: { n: 60, k: 5, seed: 3 } },
    ],
    tryThis: [
      'Load "Four of twenty" and watch the third row. The ochre cells are the draws that keep the new item. Their number stays at 4 while the row grows longer, so each new item is less likely to get in than the one before.',
      'Load "Long stream" and count the replacements in the second half of the stream compared with the first half. Replacements become rare, which is why faster versions of the algorithm skip ahead instead of drawing a number for every item.',
      'Keep "Four of twenty" and press Randomize on the seed ten times, noting the final reservoir each time. Early and late items both turn up. No position in the stream is favoured.',
      'Load "One item from a long stream". With a single slot, item i takes over with chance 1 in i. The held item changes often at first and then very rarely.',
    ],
    run,
    report: (r, c) => `Kept ${r.reservoir.length} of ${r.n} items: ${r.reservoir.join(', ')}.\n${r.n > r.k ? `Each item had the same chance of being kept: ${r.k}/${r.n} = ${f3(r.k / r.n)}.` : 'The stream was no longer than the reservoir, so every item was kept.'}\n${c['random draws'] || 0} random draws, ${c.replacements || 0} replacements (${expectedReplacements(r.n, r.k).toFixed(1)} expected on average).`,
    experiment: {
      title: 'Replacements as the stream grows',
      note: 'Each point is one real run with a reservoir of 10. The algorithm draws a random number for every item after the tenth, but it writes to the reservoir only when the draw is 10 or less. The curve is the exact expected number of writes, 10 × (1/11 + 1/12 + … + 1/n), which grows like 10 × ln(n/10). Single runs scatter around it.',
      metric: 'replacements',
      metricLabel: 'Replacements in the reservoir',
      sizeLabel: 'Stream length (n)',
      sizes: [20, 50, 100, 200, 500, 1000, 2000, 5000],
      variants: [{ id: 'k10', label: 'Reservoir of 10' }],
      input: (n, variant, seed) => ({ n, k: 10, seed }),
      theory: [{ label: 'expected: 10 × (H(n) − H(10))', fn: (n) => expectedReplacements(n, 10) }],
    },
  },

  logic: {
    intuition: 'Suppose the sample is fair after i − 1 items: each has chance k/(i − 1) of being held. Now item i arrives. For the sample to be fair over i items, the new item must be held with chance k/i, so admit it with exactly that chance. If it is admitted it must push something out, and pushing out a slot chosen uniformly at random treats all the held items alike. Each earlier item then keeps its place with chance (i − 1)/i, and k/(i − 1) × (i − 1)/i = k/i. Everyone is level again.',
    steps: [
      'Put the first k items of the stream straight into the reservoir.',
      'For each later item, let i be its position in the stream, counting from 1.',
      'Draw a random whole number j, uniformly from 1 to i.',
      'If j is at most k, overwrite slot j of the reservoir with the new item. This happens with probability k/i, and the slot is uniformly random.',
      'Otherwise leave the reservoir unchanged and let the item go.',
      'When the stream ends, or at any time before, the reservoir is a uniform random sample of the items seen.',
    ],
    pseudocode: [
      'reservoir_sample(stream, k):',
      '  reservoir ← empty list',
      '  i ← 0',
      '  for each item in stream:',
      '    i ← i + 1',
      '    if i ≤ k:',
      '      append item to reservoir',
      '    else:',
      '      j ← random whole number from 1 to i',
      '      if j ≤ k:',
      '        reservoir[j] ← item',
      '  return reservoir',
    ],
    decisions: [
      { title: 'One draw or two?', text: 'A single draw j from 1 to i does both jobs. The event j ≤ k has probability k/i and decides whether the item is admitted. Given that it is, j is uniform over 1 to k and names the slot to overwrite. Drawing an admission coin and then a separate slot number is equally correct and uses twice the randomness.' },
      { title: 'Draw for every item, or skip ahead?', text: 'Algorithm R, shown here, draws one random number per item. Late in a long stream almost every draw says "pass over". Vitter\'s Algorithm Z and Li\'s Algorithm L instead draw how many items to skip before the next replacement, which cuts the number of random draws from about n to about k log(n/k).' },
      { title: 'What if the items have weights?', text: 'Then uniform sampling is the wrong goal. A weighted reservoir method gives each item a random key that depends on its weight and keeps the k items with the largest keys.' },
    ],
    invariants: [
      'After i items have been read, with i ≥ k, the reservoir holds exactly k distinct items from the first i.',
      'After i items, each of them is in the reservoir with probability k/i.',
      'After i items, every set of k items out of the first i is equally likely to be the reservoir.',
    ],
    edgeCases: [
      'A stream shorter than k: the reservoir is never full and simply contains the whole stream.',
      'k = 1: the algorithm keeps a single item and replaces it with the i-th item with probability 1/i.',
      'An empty stream gives an empty sample.',
      'Positions inside the reservoir are not random in the way membership is. Item 1, for example, can only ever sit in slot 1. If a random order is needed, shuffle the reservoir at the end.',
      'Extremely long streams need a random number generator that can produce uniform values up to i without bias, and a counter wide enough for i.',
    ],
    correctness: 'By induction on the number of items read. After k items every item is in the reservoir, with probability 1 = k/k. Assume that after i − 1 items each is present with probability k/(i − 1). Item i enters with probability k/i. An earlier item that is present stays unless item i enters and the slot chosen is its own, which has probability (k/i) × (1/k) = 1/i. So it is present afterwards with probability k/(i − 1) × (1 − 1/i) = k/i. The same argument applied to sets shows that all groups of k items are equally likely, so the sample is uniform and not merely fair to each item separately.',
    mistakes: [
      'Drawing j from 1 to k instead of 1 to i, so every new item is admitted and the sample is dominated by the most recent items.',
      'Drawing j from 1 to n using the final length. If n is known there are simpler methods, and if it is not, the code cannot run.',
      'Starting the count at 0 in one place and 1 in another, which shifts the admission chance to k/(i + 1) or k/(i − 1).',
      'Admitting the new item with the right chance but always overwriting the same slot, or the oldest item, which breaks uniformity over sets.',
      'Using a random number generator whose range is smaller than the stream length.',
    ],
  },

  code: {
    sample: {
      input: 'Keep 5 of the numbers 1 to 1000 in one pass. Then check fairness: sample 3 of 10 items 20,000 times and count how often each item is kept (6000 expected each).',
      expected: '5 of 1000: 42 883 144 866 132\ntimes each of 10 items was kept: 5901 6049 5994 6022 6174 5934 6043 5895 6019 5969',
    },
    python: {
      source: `class Lcg:
    """A small random number generator (Park-Miller). Integer arithmetic only,
    so it produces the same numbers in every language."""

    def __init__(self, seed):
        self.state = seed

    def randint(self, low, high):
        self.state = self.state * 48271 % 2147483647
        return low + self.state % (high - low + 1)


def reservoir_sample(stream, k, rng):
    reservoir = []
    i = 0
    for item in stream:
        i += 1
        if i <= k:
            reservoir.append(item)
        else:
            j = rng.randint(1, i)
            if j <= k:
                reservoir[j - 1] = item
    return reservoir


rng = Lcg(2024)
sample = reservoir_sample(range(1, 1001), 5, rng)
print("5 of 1000: " + " ".join(str(item) for item in sample))

counts = [0] * 10
for trial in range(20000):
    for item in reservoir_sample(range(1, 11), 3, rng):
        counts[item - 1] += 1
print("times each of 10 items was kept: " + " ".join(str(c) for c in counts))`,
      notes: [
        { line: 10, text: 'Taking a remainder maps the generator\'s state onto low..high. The tiny unevenness this introduces is far below anything visible here; production code uses a library function that removes it.' },
        { line: 16, text: 'The loop reads the stream once and never asks how long it is. `range` could be replaced by a file, a socket or a generator.' },
        { line: 21, text: 'One draw from 1 to i. It is at most k with probability k/i, the chance the new item deserves.' },
        { line: 23, text: 'Given that j is at most k, it is uniform over the k slots, so the same number chooses which held item to replace. The list is 0-based, hence j − 1.' },
      ],
    },
    javascript: {
      source: `// A small random number generator (Park-Miller). Integer arithmetic only,
// so it produces the same numbers in every language.
class Lcg {
  constructor(seed) { this.state = seed; }
  randint(low, high) {
    this.state = (this.state * 48271) % 2147483647;
    return low + (this.state % (high - low + 1));
  }
}

function* numbers(from, to) {
  for (let x = from; x <= to; x++) yield x;
}

function reservoirSample(stream, k, rng) {
  const reservoir = [];
  let i = 0;
  for (const item of stream) {
    i += 1;
    if (i <= k) {
      reservoir.push(item);
    } else {
      const j = rng.randint(1, i);
      if (j <= k) reservoir[j - 1] = item;
    }
  }
  return reservoir;
}

const rng = new Lcg(2024);
console.log("5 of 1000: " + reservoirSample(numbers(1, 1000), 5, rng).join(" "));

const counts = new Array(10).fill(0);
for (let trial = 0; trial < 20000; trial++) {
  for (const item of reservoirSample(numbers(1, 10), 3, rng)) counts[item - 1] += 1;
}
console.log("times each of 10 items was kept: " + counts.join(" "));`,
    },
    cpp: {
      source: `#include <cstdio>
#include <vector>

// A small random number generator (Park-Miller). Integer arithmetic only,
// so it produces the same numbers in every language.
struct Lcg {
    long long state;
    int randint(int low, int high) {
        state = state * 48271 % 2147483647;
        return low + static_cast<int>(state % (high - low + 1));
    }
};

// Reads the numbers 1..n as a stream: each is seen once, in order.
std::vector<int> reservoir_sample(int n, int k, Lcg& rng) {
    std::vector<int> reservoir;
    int i = 0;
    for (int item = 1; item <= n; ++item) {
        i += 1;
        if (i <= k) {
            reservoir.push_back(item);
        } else {
            int j = rng.randint(1, i);
            if (j <= k) reservoir[j - 1] = item;
        }
    }
    return reservoir;
}

int main() {
    Lcg rng{2024};
    std::printf("5 of 1000:");
    for (int item : reservoir_sample(1000, 5, rng)) std::printf(" %d", item);
    std::printf("\\n");

    std::vector<int> counts(10, 0);
    for (int trial = 0; trial < 20000; ++trial) {
        for (int item : reservoir_sample(10, 3, rng)) counts[item - 1] += 1;
    }
    std::printf("times each of 10 items was kept:");
    for (int c : counts) std::printf(" %d", c);
    std::printf("\\n");
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Algorithm R does a constant amount of work per item: one random draw and at most one write. A stream of n items costs O(n) time and n − k random draws. Memory is O(k) regardless of n. The reservoir itself changes only about k ln(n/k) times, which is what the experiment on this page measures.',
    cases: [
      { case: 'Algorithm R (this page)', time: 'O(n)', when: 'Always: one draw per item after the first k.' },
      { case: 'Expected replacements', time: 'k (H(n) − H(k)) ≈ k ln(n/k)', when: 'H(n) is the harmonic number 1 + 1/2 + … + 1/n. Item i causes a write with probability k/i.' },
      { case: 'Skip-based algorithms (Z, L)', time: 'O(k (1 + log(n/k))) expected random draws and writes', when: 'When skipping an item is much cheaper than examining it, for example when seeking past records in a file. Every item must still pass by.' },
    ],
    space: 'O(k): the reservoir and a counter. Nothing else about the stream is remembered.',
    memory: 'Because the memory needed does not grow with the stream, the method works on streams of any length, including ones that never end. The reservoir can be read at any moment and is a valid sample of everything up to that moment.',
    tradeoffs: 'Algorithm R is as simple as a sampling method can be and spends one random number per item. The skip-based algorithms are harder to implement correctly and pay off only on long streams where generating random numbers or touching items is the bottleneck.',
    assumptions: [
      'Drawing a uniform random whole number from 1 to i takes constant time and is exactly uniform.',
      'Items are read in a single pass and each can be copied into the reservoir in constant time.',
      'The expected number of replacements is an average over the random draws; a single run differs from it.',
    ],
  },

  tradeoffs: {
    excels: [
      'Streams whose length is unknown or unbounded.',
      'Data too large to hold in memory or too expensive to read twice.',
      'Situations where a valid sample may be requested at any time.',
    ],
    struggles: [
      'Samples that should favour some items, such as recent ones or heavy ones: plain reservoir sampling treats all alike.',
      'Sampling from several streams on different machines, which needs a method for merging reservoirs with the right weights.',
      'Very long streams read at high speed, where one random draw per item becomes the bottleneck and a skip-based method is needed.',
    ],
    misunderstandings: [
      "\"Later items are less likely to be picked.\" Later items are less likely to get in, but earlier items have had more chances to be thrown out. The two effects cancel exactly, and every item ends with the same chance.",
      "\"You need to know how long the stream is.\" The rule for item i uses only i, the number of items seen so far. That is the whole point of the method.",
      "\"Keeping every hundredth item gives the same thing.\" That sample grows with the stream, depends on the order of the items, and can line up with patterns in the data. A reservoir sample has a fixed size and no such blind spots.",
      "\"The sample is representative.\" It is fair, which is different. A small fair sample can still, by chance, miss an important group.",
    ],
    pitfalls: [
      'Off-by-one errors between 0-based slots and the 1-based count of items seen.',
      'Random number functions with an exclusive upper bound, used as if it were inclusive.',
      'Treating the order of items inside the reservoir as random.',
    ],
    constraints: [
      'In a distributed system each machine can keep its own reservoir together with a count of items seen; merging must take those counts into account.',
      'Systems that want a sample of recent data use variants that age items out, since the plain method samples from the entire history.',
    ],
    alternatives: [
      { name: 'Shuffle and take the first k (Fisher-Yates)', when: 'All the items fit in memory. Reservoir sampling is this shuffle with only the first k positions stored.' },
      { name: 'Choose k random positions directly', when: 'The length is known and items can be fetched by position.' },
      { name: 'Keep each item independently with probability p', when: 'A sample whose size varies is acceptable. Each decision is independent, which is convenient across machines.' },
      { name: 'Weighted reservoir sampling', when: 'Items should be chosen with probability related to a weight.' },
    ],
    comparison: {
      columns: ['', 'Reservoir sampling', 'Shuffle, take k', 'Keep each with probability p'],
      rows: [
        ['Needs the length', 'No', 'Yes', 'No, but p must be chosen in advance'],
        ['Memory', 'k items', 'All n items', 'About p × n items'],
        ['Sample size', 'Exactly k', 'Exactly k', 'Random, around p × n'],
        ['Passes over the data', 'One', 'One, with everything stored', 'One'],
      ],
    },
  },

  applications: [
    { title: 'Statistics for database query planning', status: 'established', text: 'To estimate how values are distributed in a table without reading all of it, PostgreSQL\'s ANALYZE command collects a random sample of rows with a reservoir algorithm taken from Vitter\'s paper, and the query planner works from statistics computed on that sample.' },
    { title: 'A random line from a file', status: 'established', text: 'The reservoir of size one is the classic one-pass answer: keep the first line, and replace it with line i with probability 1/i. It needs no line count and no index, so it works on piped input.' },
    { title: 'Sampling logs and event streams', status: 'illustrative', text: 'A service that handles millions of requests cannot keep every log record for inspection. A reservoir gives a bounded, unbiased sample of the requests in a time window, whatever the traffic turns out to be.' },
    { title: 'Sampling training examples', status: 'illustrative', text: 'When a dataset is too large to load, one pass with a reservoir yields a uniform subset to inspect, to tune on, or to hold back for evaluation.' },
  ],

  connections: [
    { to: 'monte-carlo', type: 'related', why: 'Monte Carlo estimates are averages over fair random samples. Reservoir sampling is one way to obtain a fair sample when the data arrive as a stream.' },
    { to: 'quick-sort', type: 'related', why: 'Both use random choices to make a guarantee independent of the order of the input: a random pivot protects quick sort from bad orderings, and random replacement makes the sample indifferent to where an item sits in the stream.' },
    { to: 'metropolis-hastings', type: 'related', why: 'Both admit a candidate with a probability calculated so that the result has exactly the intended distribution: uniform over the stream here, a target density there.' },
    { to: 'bayesian-updating', type: 'related', why: 'Both process a stream one item at a time and hold a small state that is correct at every moment, so the stream itself can be forgotten.' },
    { to: 'concept:probability', type: 'prerequisite', why: 'The algorithm is designed by choosing probabilities, k/i for admission and 1/k for the slot, so that their product comes out equal for every item.' },
    { to: 'concept:sampling', type: 'prerequisite', why: 'The goal is a simple random sample: every subset of size k equally likely.' },
    { to: 'concept:invariant', type: 'prerequisite', why: 'Correctness is an invariant kept by every step: after i items, each is held with probability k/i.' },
    { to: 'concept:randomization', type: 'prerequisite', why: 'No deterministic one-pass rule can be fair to every position of a stream of unknown length; random choices make it possible.' },
    { to: 'discipline:distributed-systems', type: 'application', why: 'Bounded-memory uniform samples of unbounded event streams are a building block of monitoring and tracing systems.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'The reservoir holds 4 items. The 10th item of the stream arrives. With what probability does it enter the reservoir?',
      options: ['1/10', '4/10', '1/4', '4/6'],
      answer: 1,
      explain: [
        '1/10 would be right for a reservoir of one. Here four of the ten possible draws admit the item.',
        'Correct. The draw is uniform from 1 to 10, and the item enters when the draw is 1, 2, 3 or 4.',
        '1/4 is the chance that a particular slot is the one overwritten, given that the item enters.',
        'The chance depends on how many items have been seen, 10, not on how many were passed over.',
      ],
    },
    {
      type: 'predict',
      q: 'The reservoir has room for 5 items, but the stream ends after only 3. What does the reservoir contain?',
      options: ['Nothing, because the reservoir never filled', 'A random 2 of the 3 items', 'All 3 items', '3 items and 2 repeats'],
      answer: 2,
      explain: [
        'Items enter the reservoir as they arrive. Nothing waits for it to be full.',
        'No item is ever removed while there is still room.',
        'Correct. Each of the first k items goes straight in. With fewer than k items the sample is the whole stream, and no random number is drawn.',
        'Slots that were never filled stay empty. Items are not duplicated.',
      ],
      tryInput: { n: 3, k: 5, seed: 3 },
    },
    {
      type: 'debug',
      q: 'This version returns samples that almost always consist of items from the very end of the stream. What is wrong?',
      code: `for item in stream:
    i += 1
    if i <= k:
        reservoir.append(item)
    else:
        j = rng.randint(1, k)
        if j <= k:
            reservoir[j - 1] = item`,
      options: ['The draw should be from 1 to i, not from 1 to k', 'The test should be j < k', 'i should start at 1', 'It should append instead of overwrite'],
      answer: 0,
      explain: [
        'Correct. A draw from 1 to k is always at most k, so every item is admitted and old items are quickly flushed out. Drawing from 1 to i admits item i with probability k/i.',
        'Changing the comparison would only make slot k unreachable. The draw would still never reject an item.',
        'Where the count starts is not the issue: it is incremented before use, so the first item has i = 1.',
        'Appending would let the reservoir grow without limit.',
      ],
    },
    {
      type: 'choice',
      q: 'Why not simply keep each item with probability k/n, where n is the length of the stream?',
      options: ['That would be biased toward early items', 'It needs n in advance, and the number of items kept would vary from run to run', 'It uses more random numbers', 'It cannot be done in one pass'],
      answer: 1,
      explain: [
        'Independent decisions with the same probability are fair to every position.',
        'Correct. With an unknown length there is no n to use, and even with n known the sample size would be random, k only on average.',
        'It uses one random number per item, about the same as Algorithm R.',
        'It is a one-pass method. Its problems are the ones in the correct answer.',
      ],
    },
    {
      type: 'challenge',
      title: 'Sampling with weights',
      prompt: 'Each item now comes with a positive weight, and heavier items should be more likely to be sampled. Implement the method of Efraimidis and Spirakis: give each item the key u^(1/w), where u is a fresh uniform random number between 0 and 1 and w is the item\'s weight, and keep the k items with the largest keys. Test it with k = 1 on three items of weights 1, 2 and 7 over many runs, and check that they are chosen about 10%, 20% and 70% of the time.',
      hints: ['A min-heap of size k, ordered by key, lets you compare each new key with the smallest key currently held.', 'With all weights equal, the method reduces to keeping the k largest of n uniform random numbers, which is a uniform sample.'],
    },
  ],

  compare: {
    idea: 'Admit the i-th item with probability k/i and let it overwrite a uniformly random slot.',
    requires: 'One pass over the data and a source of uniform random numbers. The sample is exactly uniform; nothing is approximated.',
    sensitivity: 'None to the order or content of the stream. The result depends only on the random draws.',
    memory: 'O(k): the sample and a counter.',
    difficulty: 'low',
    difficultyNote: 'A dozen lines. The care goes into the off-by-one details and the proof.',
    limits: 'Uniform samples only, from the whole history. One random draw per item in its basic form.',
    useWhen: 'You need a fixed-size fair sample from a stream of unknown length.',
  },

  advanced: {
    history: 'Donald Knuth presents the basic method in the second volume of *The Art of Computer Programming* as Algorithm R and credits it to Alan Waterman. In 1985 Jeffrey Vitter analysed reservoir methods as a class and introduced Algorithm Z, which decides how many records to skip instead of testing each one, reducing the expected number of random draws to O(k(1 + log(n/k))). Kim-Hung Li gave a simpler algorithm with the same bound, Algorithm L, in 1994. Efraimidis and Spirakis published a reservoir method for weighted sampling in 2006.',
    proof: 'Claim: for every $i \\ge k$, after $i$ items every $k$-subset $S$ of $\\{1, \\dots, i\\}$ is the reservoir with probability $1/\\binom{i}{k}$.\n\nBase case $i = k$: the reservoir is $\\{1, \\dots, k\\}$ with probability 1, and $\\binom{k}{k} = 1$.\n\nStep: assume the claim for $i - 1$. Let $S$ be a $k$-subset of $\\{1, \\dots, i\\}$.\n\nIf $i \\notin S$, then $S$ was the reservoir before and item $i$ was rejected, with probability\n\n$$\\frac{1}{\\binom{i-1}{k}} \\cdot \\frac{i - k}{i} = \\frac{1}{\\binom{i}{k}}.$$\n\nIf $i \\in S$, the previous reservoir was $(S \\setminus \\{i\\}) \\cup \\{x\\}$ for one of the $i - k$ items $x \\le i - 1$ outside $S$, item $i$ was admitted, and it overwrote the slot holding $x$. The probability is\n\n$$(i - k) \\cdot \\frac{1}{\\binom{i-1}{k}} \\cdot \\frac{k}{i} \\cdot \\frac{1}{k} = \\frac{i-k}{i} \\cdot \\frac{1}{\\binom{i-1}{k}} = \\frac{1}{\\binom{i}{k}}.$$\n\nBoth cases use the identity $\\binom{i}{k} = \\frac{i}{i-k}\\binom{i-1}{k}$. Summing over the $\\binom{i-1}{k-1}$ subsets that contain a given item gives its inclusion probability, $k/i$.',
    complexityProof: 'Let $R$ be the number of replacements. Item $i > k$ causes one with probability $k/i$, so by linearity of expectation\n\n$$\\mathbb{E}[R] = \\sum_{i=k+1}^{n} \\frac{k}{i} = k\\,(H_n - H_k) \\approx k \\ln\\frac{n}{k}.$$\n\nAlgorithm R still performs $n - k$ random draws. The skip-based algorithms draw the gap to the next replacement directly from its distribution, so their number of draws is proportional to $\\mathbb{E}[R]$ instead of $n$.',
    variants: [
      { name: 'Algorithm Z (Vitter)', text: 'Generates the number of records to skip before the next replacement, using rejection sampling, so that most records are never examined.' },
      { name: 'Algorithm L (Li)', text: 'A shorter skip-based method built on the observation that the reservoir can be seen as the k items with the smallest random tags.' },
      { name: 'Weighted reservoir sampling (A-Res)', text: 'Assigns item i the key u^(1/w) for a uniform random u and weight w, and keeps the k largest keys.' },
      { name: 'Distributed and mergeable reservoirs', text: 'Give every item an independent uniform random tag and keep the k smallest tags. Two such reservoirs merge by keeping the k smallest tags of their union.' },
      { name: 'Sampling with a bias to recent items', text: 'Variants that let old items decay, for streams where the recent past matters more than the whole history.' },
    ],
    implementation: 'Use a library routine that returns an unbiased whole number in a range, and check whether its upper bound is inclusive. Keep the count of items seen in a 64-bit integer. If the order of the sample matters, shuffle the reservoir before returning it. To sample from a file, the reservoir can hold byte offsets instead of the records themselves.',
    benchmarking: 'Test uniformity statistically: run many times on a short stream and compare how often each item, and each pair of items, is selected with the expected frequencies, using a chi-squared test or generous fixed tolerances. Checking only single items can miss errors in how the slot to overwrite is chosen.',
    references: [
      { authors: 'J. S. Vitter', year: 1985, title: 'Random sampling with a reservoir', venue: 'ACM Transactions on Mathematical Software 11(1), 37-57' },
      { authors: 'K.-H. Li', year: 1994, title: 'Reservoir-sampling algorithms of time complexity O(n(1 + log(N/n)))', venue: 'ACM Transactions on Mathematical Software 20(4), 481-493' },
      { authors: 'P. S. Efraimidis and P. G. Spirakis', year: 2006, title: 'Weighted random sampling with a reservoir', venue: 'Information Processing Letters 97(5), 181-185' },
      { authors: 'D. E. Knuth', year: 1997, title: 'The Art of Computer Programming, Volume 2: Seminumerical Algorithms (3rd edition), section 3.4.2', venue: 'Addison-Wesley' },
    ],
    furtherReading: [
      'D. E. Knuth, *The Art of Computer Programming*, Volume 2, section 3.4.2, "Random sampling and shuffling".',
      'The PostgreSQL source file `src/backend/utils/misc/sampling.c`, a production implementation of reservoir sampling with skips.',
    ],
  },

  tests: [
    { name: 'the reservoir holds k distinct items of the stream, and counters match the log', input: { n: 40, k: 6, seed: 11 },
      check: (r, c) => {
        if (r.reservoir.length !== 6 || new Set(r.reservoir).size !== 6) return `reservoir ${r.reservoir}`;
        if (r.reservoir.some((x) => !Number.isInteger(x) || x < 1 || x > 40)) return 'an item is not from the stream';
        const kept = r.log.filter((e) => e.j !== null && e.kept).length;
        return (c['random draws'] === 34 && c.replacements === kept && r.replacements === kept) || `draws ${c['random draws']}, replacements ${c.replacements}, log says ${kept}`;
      } },
    { name: 'replaying the log by hand gives the same reservoir, and item i enters exactly when j ≤ k', input: { n: 30, k: 3, seed: 5 },
      check: (r) => {
        const res = [];
        for (const e of r.log) {
          if (e.j === null) res.push(e.i);
          else {
            if (e.j < 1 || e.j > e.i || e.kept !== (e.j <= 3)) return `bad draw at item ${e.i}: j = ${e.j}`;
            if (e.kept) { if (res[e.j - 1] !== e.evicted) return `wrong eviction at item ${e.i}`; res[e.j - 1] = e.i; }
          }
        }
        return res.join() === r.reservoir.join() || `replay gives ${res}, run gave ${r.reservoir}`;
      } },
    { name: 'uniformity: over 6000 seeds each of 20 items is kept about 4/20 of the time', input: { n: 20, k: 4, seed: 1 },
      check: () => {
        const rates = inclusionRates(20, 4, 6000);
        const worst = Math.max(...rates.map((p) => Math.abs(p - 0.2)));
        return worst < 0.03 || `largest deviation from 0.2 was ${worst.toFixed(4)}`;
      } },
    { name: 'invariant: after i items each is held with probability k/i (i = 3, 5, 8, 13)', input: { n: 13, k: 3, seed: 1 },
      check: () => {
        for (const i of [3, 5, 8, 13]) {
          const rates = inclusionRates(i, 3, 6000);
          const worst = Math.max(...rates.map((p) => Math.abs(p - 3 / i)));
          if (worst > 0.035) return `after ${i} items the largest deviation from ${(3 / i).toFixed(3)} was ${worst.toFixed(4)}`;
        }
        return true;
      } },
    { name: 'every pair is equally likely: 2 of 5 over 10000 seeds gives each of the 10 pairs about 10%', input: { n: 5, k: 2, seed: 1 },
      check: () => {
        const counts = {};
        for (let s = 1; s <= 10000; s++) {
          const key = run({ n: 5, k: 2, seed: 90000 + s }, QUIET).reservoir.slice().sort((a, b) => a - b).join('-');
          counts[key] = (counts[key] || 0) + 1;
        }
        const keys = Object.keys(counts);
        if (keys.length !== 10) return `saw ${keys.length} distinct pairs`;
        const worst = Math.max(...keys.map((key) => Math.abs(counts[key] / 10000 - 0.1)));
        return worst < 0.02 || `largest deviation from 0.1 was ${worst.toFixed(4)}`;
      } },
    { name: 'average replacements over 2000 seeds match k (H(n) − H(k))', input: { n: 200, k: 10, seed: 1 },
      check: () => {
        let sum = 0;
        for (let s = 1; s <= 2000; s++) sum += run({ n: 200, k: 10, seed: 300 + s }, QUIET).replacements;
        const mean = sum / 2000, want = expectedReplacements(200, 10);
        return Math.abs(mean - want) < 0.6 || `mean ${mean.toFixed(2)}, expected ${want.toFixed(2)}`;
      } },
    { name: 'quiz: a stream shorter than the reservoir is kept whole, with no random draws', input: { n: 3, k: 5, seed: 3 },
      check: (r, c) => (r.reservoir.join() === '1,2,3' && c['random draws'] === 0 && c.replacements === 0) || `reservoir ${r.reservoir}` },
    { name: 'the worked example: 2 of 6 with seed 1', input: { n: 6, k: 2, seed: 1 },
      check: (r) => (r.log.slice(2).map((e) => e.j).join() === '2,1,3,6' && r.log[2].evicted === 2 && r.log[3].evicted === 1 && r.reservoir.join() === '4,3') || `draws ${r.log.map((e) => e.j).join(',')}, reservoir ${r.reservoir}` },
  ],
};
