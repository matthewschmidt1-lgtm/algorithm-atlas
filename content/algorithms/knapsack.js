import { makeRng } from '../../js/lib/rng.js';

// Items come from the two typed lists if they are given, otherwise from the seed.
function resolveItems(input) {
  const ws = Array.isArray(input.weights) ? input.weights : [];
  const vs = Array.isArray(input.values) ? input.values : [];
  if (ws.length || vs.length) {
    if (ws.length !== vs.length) throw new Error(`Give one value for each weight. There are ${ws.length} weights and ${vs.length} values.`);
    if (ws.some((w) => !Number.isInteger(w) || w < 1)) throw new Error('Weights must be whole numbers of at least 1.');
    if (vs.some((v) => !Number.isInteger(v) || v < 0)) throw new Error('Values must be whole numbers, zero or more.');
    return { weights: ws.slice(), values: vs.slice() };
  }
  const n = Math.max(1, Math.floor(Number(input.items) || 1));
  const rng = makeRng(Math.floor(Number(input.seed) || 1) * 9973 + 7);
  const weights = [], values = [];
  for (let k = 0; k < n; k++) { weights.push(rng.int(1, 6)); values.push(rng.int(2, 15)); }
  return { weights, values };
}

// The tempting shortcut: best value per unit of weight first, taking whatever still fits.
function greedyByRatio(weights, values, capacity) {
  const order = weights.map((_, k) => k).sort((x, y) => values[y] / weights[y] - values[x] / weights[x] || x - y);
  let room = capacity, value = 0;
  const chosen = [];
  for (const k of order) if (weights[k] <= room) { room -= weights[k]; value += values[k]; chosen.push(k + 1); }
  return { value, chosen: chosen.sort((x, y) => x - y) };
}

const list = (xs) => (xs.length === 0 ? 'none' : xs.length === 1 ? String(xs[0]) : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

function run(input, t) {
  const { weights, values } = resolveItems(input);
  const n = weights.length;
  const W = Math.max(0, Math.floor(Number(input.capacity) || 0));
  const K = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(null));
  const taken = new Array(n).fill(null);   // null: undecided, true: taken, false: left behind

  const tableLegend = [{ label: 'cell being filled', role: 'current' }, { label: 'cells it reads: skip (above) and take (above, further left)', role: 'compare' }, { label: 'traceback path', role: 'path' }];
  const rowLabels = ['no items', ...weights.map((_, k) => (k === 0 ? 'item 1' : `items 1 to ${k + 1}`))];
  const tableView = (roles) => ({
    kind: 'table', corner: 'capacity', legend: tableLegend,
    title: 'Each cell: best total value using only the items named in its row, in a bag of the capacity at the top of its column',
    colLabels: Array.from({ length: W + 1 }, (_, c) => c), rowLabels,
    cells: K.map((row) => row.map((v) => (v === null ? '' : v))), roles,
  });
  const itemsView = (current) => {
    const role = (k) => (taken[k] === true ? 'done' : taken[k] === false ? 'dim' : k === current ? 'current' : current !== null && k < current ? 'visited' : 'default');
    return { kind: 'rows', title: 'The items', legend: [{ label: 'item being considered', role: 'current' }, { label: 'taken ✓', role: 'done' }, { label: 'left behind ✗', role: 'dim' }], rows: [
      { label: 'Item', cells: weights.map((_, k) => ({ t: k + 1, role: role(k) })) },
      { label: 'Weight', cells: weights.map((w, k) => ({ t: w, role: role(k) })) },
      { label: 'Value', cells: values.map((v, k) => ({ t: v, role: role(k) })) },
      { label: 'Taken', cells: taken.map((x, k) => ({ t: x === true ? '✓' : x === false ? '✗' : '?', role: role(k) })) },
    ] };
  };

  t.frame(() => ({ line: 0, note: `Choose from ${n} item${n === 1 ? '' : 's'} to get the most value into a bag that holds weight **${W}**. Each item is taken whole or left behind. The table has a row for each item and a column for each bag size from 0 to ${W}. A row allows its own item and all the items before it.`, views: [tableView({}), itemsView(null)], vars: { n, W } }));

  for (let c = 0; c <= W; c++) { K[0][c] = 0; t.count('cells filled'); }
  t.frame(() => ({ line: [1, 2], note: `Top row: with no items allowed, nothing can be packed, so the best value is 0 for every capacity.`, views: [tableView(Object.fromEntries(K[0].map((_, c) => [`0,${c}`, 'current']))), itemsView(null)], vars: { n, W } }));

  for (let i = 1; i <= n; i++) {
    const w = weights[i - 1], v = values[i - 1];
    for (let c = 0; c <= W; c++) {
      const skip = K[i - 1][c];
      const fits = w <= c;
      const rest = fits ? K[i - 1][c - w] : null;
      const take = fits ? v + rest : null;
      const best = fits ? Math.max(skip, take) : skip;
      K[i][c] = best;
      t.count('cells filled');
      t.frame(() => ({ line: fits ? [5, 8, 9, 10, 11, 12] : [5, 6, 7],
        note: fits
          ? `Items 1 to ${i}, capacity ${c}. Skip item ${i}: the cell above gives ${skip}. Take item ${i}: it uses ${w} of the capacity and leaves ${c - w}, where the row above has ${rest}, so ${v} + ${rest} = ${take}. ${take > skip ? 'Taking is better' : take === skip ? 'The two tie' : 'Skipping is better'}: **${best}**.`
          : `Items 1 to ${i}, capacity ${c}. Item ${i} weighs ${w}, more than ${c}, so it cannot go in. Copy the cell above: **${best}**.`,
        views: [tableView(fits ? { [`${i - 1},${c}`]: 'compare', [`${i - 1},${c - w}`]: 'compare', [`${i},${c}`]: 'current' } : { [`${i - 1},${c}`]: 'compare', [`${i},${c}`]: 'current' }), itemsView(i - 1)],
        vars: { i, c, 'w[i]': w, 'v[i]': v, 'K[i][c]': best } }));
    }
  }

  // Traceback: a value that differs from the cell above means the row's item was taken.
  const best = K[n][W];
  const path = [[n, W]];
  const chosen = [];
  let c = W;
  t.frame(() => ({ line: [13, 16], note: `The table is full. The bottom-right cell says the best value is **${best}**. To see which items earn it, walk up from that cell one row at a time: if a value differs from the cell above it, the row's item must have been taken.`, views: [tableView({ [`${n},${W}`]: 'current' }), itemsView(null)], vars: { c: W, best } }));
  for (let i = n; i >= 1; i--) {
    const here = K[i][c], above = K[i - 1][c];
    const took = here !== above;
    const from = c;
    if (took) { chosen.unshift(i); c -= weights[i - 1]; }
    taken[i - 1] = took;
    path.push([i - 1, c]);
    t.frame(() => {
      const roles = {};
      for (const [pi, pc] of path) roles[`${pi},${pc}`] = 'path';
      roles[`${i - 1},${c}`] = 'current';
      return { line: took ? [17, 18, 19, 20] : [17, 18],
        note: took
          ? `Row for items 1 to ${i}, capacity ${from}: the value ${here} differs from the cell above (${above}), so **item ${i} was taken**. It weighs ${weights[i - 1]}, which leaves capacity ${c}.`
          : `Row for items 1 to ${i}, capacity ${from}: the value ${here} is the same as the cell above, so item ${i} is not needed. Move up without changing the capacity.`,
        views: [tableView(roles), itemsView(null)], vars: { i, c, taken: list(chosen) } };
    });
  }
  const totalWeight = chosen.reduce((s, i) => s + weights[i - 1], 0);
  const greedy = greedyByRatio(weights, values, W);
  t.frame(() => {
    const roles = {};
    for (const [pi, pc] of path) roles[`${pi},${pc}`] = 'path';
    return { line: null, note: `The best load is worth **${best}**: ${chosen.length ? `item${chosen.length === 1 ? '' : 's'} ${list(chosen)}, with total weight ${totalWeight} of ${W}` : 'nothing fits'}. For comparison, grabbing the best value per unit of weight first would take ${greedy.chosen.length ? `item${greedy.chosen.length === 1 ? '' : 's'} ${list(greedy.chosen)}` : 'nothing'} for a value of ${greedy.value}${greedy.value < best ? ', which is worse' : ', the same on this input'}.`,
      views: [tableView(roles), itemsView(null)], vars: { best, weight: totalWeight, W } };
  });

  return { best, chosen, totalWeight, weights, values, capacity: W, rows: n + 1, cols: W + 1, table: K, greedyValue: greedy.value, greedyChosen: greedy.chosen };
}

// Independent reference for the tests: try every subset of the items.
function bruteForce(weights, values, capacity) {
  let best = 0;
  for (let mask = 0; mask < (1 << weights.length); mask++) {
    let w = 0, v = 0;
    for (let k = 0; k < weights.length; k++) if (mask & (1 << k)) { w += weights[k]; v += values[k]; }
    if (w <= capacity && v > best) best = v;
  }
  return best;
}
const matchesBrute = (r, c) => {
  const ref = bruteForce(r.weights, r.values, r.capacity);
  if (r.best !== ref) return `best value ${r.best}, brute force over all subsets says ${ref}`;
  const w = r.chosen.reduce((s, i) => s + r.weights[i - 1], 0), v = r.chosen.reduce((s, i) => s + r.values[i - 1], 0);
  if (new Set(r.chosen).size !== r.chosen.length) return 'an item was chosen twice';
  if (w > r.capacity || w !== r.totalWeight) return `the chosen items weigh ${w}, capacity is ${r.capacity}`;
  if (v !== r.best) return `the chosen items are worth ${v}, not the reported ${r.best}`;
  if (r.greedyValue > r.best) return 'greedy beat the reported optimum';
  if (c['cells filled'] !== r.rows * r.cols) return `filled ${c['cells filled']} cells in a ${r.rows} by ${r.cols} table`;
  return true;
};

export default {
  meta: {
    id: 'knapsack',
    name: '0/1 Knapsack',
    aliases: ['knapsack problem', '0-1 knapsack', 'binary knapsack', 'subset selection under a budget'],
    kind: 'algorithm',
    discipline: 'optimization',
    alsoIn: [
      { id: 'algorithms', why: 'It is the standard example of dynamic programming over a numeric budget and of a pseudo-polynomial running time.' },
    ],
    subfield: 'Combinatorial optimization',
    family: 'Packing and selection problems',
    lab: 'dynamic-programming',
    summary: 'Chooses the most valuable set of whole items that fits a weight limit, by filling a table over items and capacities and tracing back the choices.',
    difficulty: 'intermediate',
    order: 330,
    paradigms: ['dynamic-programming'],
    randomized: false,
    approximate: false,
    time: { best: 'O(nW)', average: 'O(nW)', worst: 'O(nW), pseudo-polynomial', class: 'pseudo-polynomial' },
    space: { worst: 'O(nW) with traceback; O(W) for the value alone', class: 'quadratic' },
    tags: {
      problems: ['pack the most value into a limited bag', 'choose items under a weight limit', 'select projects within a budget', 'best subset under a constraint', 'what to take when you cannot take everything'],
      techniques: ['table filling', 'take or skip decision', 'traceback', 'pseudo-polynomial time'],
      applications: ['logistics', 'finance', 'engineering design'],
    },
    prerequisites: ['fibonacci-dp', 'concept:dynamic-programming', 'concept:optimal-substructure', 'concept:big-o'],
  },

  bigIdea: {
    simple: "The knapsack problem is about choosing what to take when you cannot take everything. Picture a hiker with a bag that can hold only so much weight. Each thing she could pack has a weight and a value to her. Which things should go in the bag so that the total value is as high as possible and the bag is not too heavy? Each item is either taken whole or left behind. That is what the 0/1 in the name means. One tempting plan is to grab the items that give the most value for their weight. That plan can fail, because it may leave space that nothing else fits. Trying every possible selection always works, but the number of selections doubles with each extra item. The method here is smarter. It builds a grid of small questions: what is the best I can do with only the first few items and a smaller bag? Each answer comes from two answers already in the grid, one for leaving the newest item and one for taking it.",
    what: 'Given n items, each with a weight and a value, and a bag of capacity W, the 0/1 knapsack problem asks for the set of items with the largest total value whose total weight is at most W. The dynamic programming solution fills a table K in which K[i][c] is the best value achievable using only the first i items in a bag of capacity c. Each cell is the better of two options: skip item i, or take it and add the best value for the capacity that remains.',
    why: 'Many decisions have this shape: a fixed budget, a list of candidates that each have a cost and a benefit, and no way to take half a candidate. The problem is easy to state, the obvious shortcut gives wrong answers, and exhaustive search doubles with every item. That combination has made it a standard test case for optimization methods since the 1950s.',
    when: 'Use the table when weights and capacity are whole numbers and the capacity is small enough that a table of n × W cells is affordable. If the capacity is huge but the values are small, index the table by value. If items can be divided, the simple greedy rule is exact and far faster. If both capacity and values are large, use branch and bound or accept an approximation.',
    interesting: 'The running time O(nW) looks harmless and hides the whole difficulty of the problem. W is a number written in the input, and a number with one more digit is ten times larger. So the work can grow exponentially in the length of the input even though the formula has no exponent in it. This is why a problem with a simple table-filling algorithm is still NP-hard.',
    where: 'It appears on its own in budgeting, loading and selection problems, and more often as a piece of something larger: the method used to solve industrial cutting-stock problems calls a knapsack solver repeatedly, and integer programming solvers reason about each constraint as a knapsack.',
    analogy: {
      title: 'A packing notebook for every bag size',
      text: "Suppose you kept a notebook that says, for every bag size up to yours, the best load you could make from the items looked at so far. A new item arrives. For each bag size you now have an easy question. Leave the item, and the notebook's old answer stands. Take it, and you get its value plus the notebook's old answer for a bag that is smaller by the item's weight, which is the room left for everything else. Write down the better of the two. After the last item, the entry for your real bag is the answer.",
      limits: 'The notebook has one line per bag size, so it only works when weights are whole numbers and the capacity is not enormous. Real packing also involves shape and volume, and real items interact: a tent is worth little without its poles. The knapsack problem assumes one number for weight, one for value, and values that simply add up.',
    },
  },

  example: {
    setup: 'A bag can carry 5 kilograms. There are three items: a ring (1 kg, worth 6 coins), a vase (2 kg, worth 10) and a clock (3 kg, worth 12). Each is taken whole or left behind. Make a grid with a row for each item and a column for each bag size from 0 to 5 kg. A square holds the best total value for that bag size using the items in its row and the rows above.',
    steps: [
      'Start with a row of zeros for "no items". Then the ring row: the ring fits any bag of 1 kg or more, so the row reads 0, 6, 6, 6, 6, 6.',
      'Vase row. Each square has two options. Leave the vase: copy the square above. Take the vase: its 10 coins, plus the ring row\'s answer for a bag 2 kg smaller. For the 3 kg bag that is 6 against 10 + 6 = 16, so write 16. The whole row reads 0, 6, 10, 16, 16, 16.',
      'Clock row, up to 4 kg. The clock does not fit bags under 3 kg, so copy 0, 6, 10. For 3 kg: leave it (16) or take it (12 + 0 = 12), so 16. For 4 kg: leave it (16) or take it (12 + 6 = 18), so 18.',
      'Clock row, 5 kg bag. Leaving the clock gives the square above: 16. Taking it uses 3 kg and leaves 2 kg, where the vase row has 10, so 12 + 10 = 22. Write 22.',
      'Walk back to see what was packed. 22 differs from the 16 above it, so the clock was taken, leaving 2 kg. In the vase row the 2 kg square is 10, which differs from the 6 above it, so the vase was taken, leaving 0 kg. Nothing fits in 0 kg, so the ring stays behind.',
    ],
    result: 'The best load is the vase and the clock: 5 kg, worth 22 coins. The ring is worth the most per kilogram, yet the best load leaves it out. Grabbing the best value per kilogram first would pack the ring and the vase, worth 16, and then find that the clock no longer fits.',
    tryInput: { weights: [1, 2, 3], values: [6, 10, 12], capacity: 5 },
  },

  terms: [
    { term: 'Item', meaning: 'One thing that could go in the bag. It has a weight and a value.' },
    { term: 'Capacity', meaning: 'The most total weight the bag can hold.' },
    { term: '0/1', meaning: 'Each item is taken zero times or one time. It cannot be split, and it cannot be taken twice.' },
    { term: 'Subset', meaning: 'A selection of some of the items, possibly none or all of them.' },
    { term: 'Greedy', meaning: 'Making the choice that looks best right now and never revisiting it.' },
    { term: 'Subproblem', meaning: 'A smaller version of the question. Here: the best value using only the first few items and a smaller bag.' },
    { term: 'Traceback', meaning: 'Walking backwards through the finished table to recover which items make up the best value.' },
    { term: 'Pseudo-polynomial', meaning: 'A running time that depends on how big a number in the input is, not on how many digits it takes to write.' },
  ],

  takeaway: 'For each item ask one question, take it or leave it, and answer that question for every bag size using the answers already worked out for the items before it.',

  viz: {
    describe: 'A table with one row per item, plus a top row for "no items", and one column per capacity from 0 to W. Each cell holds the best total value using the items of its row and the rows above in a bag of that capacity. The cell being filled is terracotta. The cells it reads are ochre: the cell directly above (skip the item) and a cell in the row above further to the left (take the item). After the table is full, a forest green path climbs from the bottom-right cell to the top row, stepping left whenever an item was taken. Beneath the table, rows of cells list each item\'s number, weight and value, and a final row shows a tick for taken and a cross for left behind.',
    inputs: [
      { id: 'items', type: 'range', label: 'Number of items', min: 2, max: 8, step: 1, default: 5 },
      { id: 'capacity', type: 'range', label: 'Capacity (W)', min: 1, max: 16, step: 1, default: 10 },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 34, help: 'Generates weights from 1 to 6 and values from 2 to 15.' },
      { id: 'weights', type: 'list', label: 'Or type your own weights', default: [], maxLength: 8, min: 1, max: 16, integer: true, placeholder: 'e.g. 1, 3, 4, 5',
        help: 'Whole numbers. Leave both lists empty to use random items.' },
      { id: 'values', type: 'list', label: 'and their values', default: [], maxLength: 8, min: 0, max: 99, integer: true, placeholder: 'e.g. 1, 4, 5, 7' },
    ],
    presets: [
      { label: 'Random items', values: { items: 5, capacity: 10, seed: 34, weights: [], values: [] } },
      { label: 'Worked example: greedy goes wrong', values: { weights: [1, 2, 3], values: [6, 10, 12], capacity: 5 } },
      { label: 'Small fixed example', values: { weights: [1, 3, 4, 5], values: [1, 4, 5, 7], capacity: 7 } },
      { label: 'More items, larger bag', values: { items: 8, capacity: 16, seed: 9, weights: [], values: [] } },
    ],
    tryThis: [
      'Load "Worked example: greedy goes wrong" and step to the last row. Item 1 has the best value for its weight, yet at capacity 5 taking item 3 wins by 22 to 16, and the traceback leaves item 1 behind.',
      'Load "Random items" and raise the capacity one step at a time, watching the final value. It never goes down, and at capacity 16 every item fits, so the value stops at 49, the sum of all the values.',
      'Keep the capacity fixed and move the number of items from 2 to 8. Each new item adds one row of W + 1 cells. Then double the capacity instead and see the number of columns double. The work is rows times columns.',
    ],
    run,
    report: (r, c) => `Best value: ${r.best} with ${r.chosen.length ? `item${r.chosen.length === 1 ? '' : 's'} ${list(r.chosen)}` : 'no items'} (total weight ${r.totalWeight} of ${r.capacity}).\nGreedy by value per weight: ${r.greedyValue} (${r.greedyChosen.length ? `item${r.greedyChosen.length === 1 ? '' : 's'} ${list(r.greedyChosen)}` : 'no items'}).\nWeights: ${r.weights.join(', ')}   Values: ${r.values.join(', ')}\nTable: ${r.rows} rows by ${r.cols} columns, ${c['cells filled'] || 0} cells filled.`,
    experiment: {
      title: 'Cells filled as the capacity grows',
      note: 'Each point is a real run on random items with weights up to half the capacity. The number of items is held at 10 or 20 while the capacity doubles. The work doubles each time, although writing the capacity down takes only one more binary digit.',
      metric: 'cells filled',
      metricLabel: 'Cells filled',
      sizeLabel: 'Capacity (W)',
      sizes: [16, 32, 64, 128, 256, 512, 1024, 2048],
      variants: [
        { id: 'n10', label: '10 items' },
        { id: 'n20', label: '20 items' },
      ],
      input: (W, variant, seed) => {
        const n = variant === 'n20' ? 20 : 10;
        const rng = makeRng(seed * 131 + W);
        return { capacity: W, weights: Array.from({ length: n }, () => rng.int(1, Math.max(1, W / 2))), values: Array.from({ length: n }, () => rng.int(1, 99)) };
      },
      theory: [
        { label: '11 (W + 1)', fn: (W) => 11 * (W + 1), variant: 'n10' },
        { label: '21 (W + 1)', fn: (W) => 21 * (W + 1), variant: 'n20' },
      ],
    },
  },

  logic: {
    intuition: 'Consider the last item. Either the best load contains it or it does not. If it does not, the best load is simply the best load from the other items with the same bag. If it does, then the rest of the load must be the best possible use of the other items in the space that is left. Both cases are smaller problems of the same kind: fewer items, and the same or a smaller bag. There are only n + 1 possible item counts and W + 1 possible bag sizes, so all the smaller problems fit in a table.',
    steps: [
      'Number the items 1 to n, with weights w[i] and values v[i]. Make a table K with rows 0 to n and columns 0 to W. K[i][c] will be the best value using only items 1 to i in a bag of capacity c.',
      'Fill row 0 with zeros: with no items the value is 0 whatever the capacity.',
      'Fill the rows in order. For row i and capacity c, the "skip" option is K[i−1][c], the cell directly above.',
      'If item i fits (w[i] ≤ c), the "take" option is v[i] plus K[i−1][c − w[i]], the row above at the capacity that remains. Set K[i][c] to the larger of skip and take. If the item does not fit, K[i][c] is just the skip value.',
      'When the table is full, K[n][W] is the best total value.',
      'To recover the items, start at capacity c = W and go through the rows from n down to 1. If K[i][c] differs from K[i−1][c], item i was taken: record it and subtract w[i] from c.',
    ],
    pseudocode: [
      'knapsack(w, v, W):',
      '  for c from 0 to W:',
      '    K[0][c] ← 0',
      '  for i from 1 to n:',
      '    for c from 0 to W:',
      '      skip ← K[i−1][c]',
      '      if w[i] > c:',
      '        K[i][c] ← skip',
      '      else:',
      '        rest ← K[i−1][c−w[i]]',
      '        take ← v[i] + rest',
      '        K[i][c] ← larger of',
      '          skip and take',
      '  return K[n][W]',
      '',
      'chosenItems(K):',
      '  c ← W',
      '  for i from n down to 1:',
      '    if K[i][c] ≠ K[i−1][c]:',
      '      take item i',
      '      c ← c − w[i]',
    ],
    decisions: [
      { title: 'Why does the "take" option read the row above and not the same row?', text: 'The row above knows nothing about item i, so adding item i to one of its loads uses the item exactly once. Reading the same row would allow a load that already contains item i to receive it again. That solves a different problem, the unbounded knapsack, in which each item may be taken any number of times.' },
      { title: 'One row or the whole table?', text: 'Each row depends only on the row above, so a single array of W + 1 numbers is enough for the best value, provided the capacities are visited from W downward so that each read still sees the previous row. The full table is kept here because the traceback needs it.' },
      { title: 'Index the table by capacity or by value?', text: 'The table can be turned around: for each total value, store the smallest weight that achieves it. That table has as many columns as the sum of the values, which is the better choice when the capacity is huge and the values are small.' },
      { title: 'Which load on a tie?', text: 'Several loads can share the best value. The traceback here takes an item only when the table forces it to, which favours loads made of earlier items.' },
    ],
    invariants: [
      'After row i is filled, `K[i][c]` is the largest total value of any subset of items 1 to i whose total weight is at most c.',
      'Values never decrease from left to right along a row or from top to bottom down a column.',
      'During the traceback, the values of the items recorded so far plus `K[i][c]` always equals `K[n][W]`.',
    ],
    edgeCases: [
      'Capacity 0: nothing fits and the answer is 0.',
      'An item heavier than the whole capacity: it is never taken, and its row is a copy of the row above.',
      'All items fit together: the answer is the sum of all values, and the table was not really needed.',
      'Weights that are not whole numbers: the columns are capacities, so weights must be integers or be scaled to integers first, which can make W very large.',
      'Very large capacity: the table has W + 1 columns. A capacity of a billion means billions of cells per row, and another method is needed.',
      'Ties: more than one subset may reach the best value. The algorithm reports one.',
    ],
    correctness: 'By induction on i. Row 0 is correct because the only subset of no items is the empty one. Suppose row i − 1 is correct, and consider a best subset S of items 1 to i for capacity c. If S does not contain item i, it is a subset of items 1 to i − 1 of weight at most c, so its value is at most K[i−1][c], and that value is achievable. If S contains item i, then w[i] ≤ c, and S without item i is a subset of items 1 to i − 1 of weight at most c − w[i]. It must be a best such subset, because a better one plus item i would beat S. So the value of S is v[i] + K[i−1][c − w[i]]. The best subset is one of these two kinds, so its value is the larger of the two candidates, which is what the algorithm stores.',
    mistakes: [
      'Trusting the greedy rule (best value per weight first) for the 0/1 problem. It is only guaranteed when items can be split.',
      'In the one-row version, looping the capacity upward. An item then gets added to a load that already contains it.',
      'Allocating the table as n by W and forgetting the extra row for "no items" and the extra column for capacity 0.',
      'Calling O(nW) polynomial time. It is polynomial in the value of W, not in the size of the input.',
    ],
  },

  code: {
    sample: {
      input: 'Two small problems. Weights 1, 2, 3 with values 6, 10, 12 and capacity 5. Weights 1, 3, 4, 5 with values 1, 4, 5, 7 and capacity 7. For each: the best value, the items chosen, what the greedy rule would get, and the last row of the table.',
      expected: 'capacity 5: best value 22 with items 2 3; greedy gets 16\n  last row: 0 6 10 16 18 22\ncapacity 7: best value 9 with items 2 3; greedy gets 8\n  last row: 0 1 1 4 5 7 8 9',
    },
    python: {
      source: `def knapsack(weights, values, capacity):
    n = len(weights)
    K = [[0] * (capacity + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        w, v = weights[i - 1], values[i - 1]
        for c in range(capacity + 1):
            K[i][c] = K[i - 1][c]                  # skip item i
            if w <= c:                             # or take it, if it fits
                K[i][c] = max(K[i][c], v + K[i - 1][c - w])
    return K


def chosen_items(K, weights, capacity):
    taken = []
    c = capacity
    for i in range(len(weights), 0, -1):
        if K[i][c] != K[i - 1][c]:
            taken.append(i)
            c -= weights[i - 1]
    return taken[::-1]


def greedy_by_ratio(weights, values, capacity):
    order = sorted(range(len(weights)), key=lambda i: (-values[i] / weights[i], i))
    total, room = 0, capacity
    for i in order:
        if weights[i] <= room:
            total += values[i]
            room -= weights[i]
    return total


problems = [([1, 2, 3], [6, 10, 12], 5), ([1, 3, 4, 5], [1, 4, 5, 7], 7)]
for weights, values, capacity in problems:
    K = knapsack(weights, values, capacity)
    items = chosen_items(K, weights, capacity)
    print("capacity " + str(capacity) + ": best value " + str(K[-1][capacity])
          + " with items " + " ".join(str(i) for i in items)
          + "; greedy gets " + str(greedy_by_ratio(weights, values, capacity)))
    print("  last row: " + " ".join(str(x) for x in K[-1]))`,
      notes: [
        { line: 3, text: 'One extra row for "no items" and one extra column for capacity 0. Both start at zero and stay there.' },
        { line: 7, text: 'Skipping the item is always possible, so start from the cell above.' },
        { line: 9, text: 'Taking the item adds its value to the best load of the earlier items in the space left over. `K[i - 1]`, not `K[i]`, is what stops the item being used twice.' },
        { line: 17, text: 'If the value changed when item i became available, the best load for this capacity must contain item i.' },
        { line: 24, text: 'The greedy rule for comparison: sort by value per unit of weight and take whatever still fits. It is fast and, for whole items, sometimes wrong.' },
      ],
    },
    javascript: {
      source: `function knapsack(weights, values, capacity) {
  const n = weights.length;
  const K = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    const w = weights[i - 1], v = values[i - 1];
    for (let c = 0; c <= capacity; c++) {
      K[i][c] = K[i - 1][c];                       // skip item i
      if (w <= c) {                                // or take it, if it fits
        K[i][c] = Math.max(K[i][c], v + K[i - 1][c - w]);
      }
    }
  }
  return K;
}

function chosenItems(K, weights, capacity) {
  const taken = [];
  let c = capacity;
  for (let i = weights.length; i >= 1; i--) {
    if (K[i][c] !== K[i - 1][c]) {
      taken.push(i);
      c -= weights[i - 1];
    }
  }
  return taken.reverse();
}

function greedyByRatio(weights, values, capacity) {
  const order = weights.map((_, i) => i);
  order.sort((x, y) => values[y] / weights[y] - values[x] / weights[x] || x - y);
  let total = 0, room = capacity;
  for (const i of order) {
    if (weights[i] <= room) {
      total += values[i];
      room -= weights[i];
    }
  }
  return total;
}

const problems = [[[1, 2, 3], [6, 10, 12], 5], [[1, 3, 4, 5], [1, 4, 5, 7], 7]];
for (const [weights, values, capacity] of problems) {
  const K = knapsack(weights, values, capacity);
  const items = chosenItems(K, weights, capacity);
  console.log("capacity " + capacity + ": best value " + K[weights.length][capacity]
    + " with items " + items.join(" ")
    + "; greedy gets " + greedyByRatio(weights, values, capacity));
  console.log("  last row: " + K[weights.length].join(" "));
}`,
    },
    cpp: {
      source: `#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>

using Table = std::vector<std::vector<int>>;

Table knapsack(const std::vector<int>& weights, const std::vector<int>& values, int capacity) {
    int n = weights.size();
    Table K(n + 1, std::vector<int>(capacity + 1, 0));
    for (int i = 1; i <= n; ++i) {
        int w = weights[i - 1], v = values[i - 1];
        for (int c = 0; c <= capacity; ++c) {
            K[i][c] = K[i - 1][c];                       // skip item i
            if (w <= c) {                                // or take it, if it fits
                K[i][c] = std::max(K[i][c], v + K[i - 1][c - w]);
            }
        }
    }
    return K;
}

std::vector<int> chosenItems(const Table& K, const std::vector<int>& weights, int capacity) {
    std::vector<int> taken;
    int c = capacity;
    for (int i = weights.size(); i >= 1; --i) {
        if (K[i][c] != K[i - 1][c]) {
            taken.push_back(i);
            c -= weights[i - 1];
        }
    }
    std::reverse(taken.begin(), taken.end());
    return taken;
}

int greedyByRatio(const std::vector<int>& weights, const std::vector<int>& values, int capacity) {
    std::vector<int> order(weights.size());
    std::iota(order.begin(), order.end(), 0);
    std::stable_sort(order.begin(), order.end(), [&](int x, int y) {
        return values[x] * weights[y] > values[y] * weights[x];  // higher value per weight first
    });
    int total = 0, room = capacity;
    for (int i : order) {
        if (weights[i] <= room) {
            total += values[i];
            room -= weights[i];
        }
    }
    return total;
}

int main() {
    std::vector<std::vector<int>> allWeights = {{1, 2, 3}, {1, 3, 4, 5}};
    std::vector<std::vector<int>> allValues = {{6, 10, 12}, {1, 4, 5, 7}};
    std::vector<int> capacities = {5, 7};
    for (std::size_t p = 0; p < capacities.size(); ++p) {
        const auto& weights = allWeights[p];
        const auto& values = allValues[p];
        int capacity = capacities[p];
        Table K = knapsack(weights, values, capacity);
        std::cout << "capacity " << capacity << ": best value " << K[weights.size()][capacity] << " with items";
        for (int i : chosenItems(K, weights, capacity)) std::cout << " " << i;
        std::cout << "; greedy gets " << greedyByRatio(weights, values, capacity) << "\\n";
        std::cout << "  last row:";
        for (int x : K[weights.size()]) std::cout << " " << x;
        std::cout << "\\n";
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The table has (n + 1) × (W + 1) cells and each takes a constant amount of work, so the time is proportional to n × W. That looks polynomial, but W is a number in the input, not the length of the input. Writing W down takes only about log₂ W binary digits. Add one digit to W and the table doubles. Measured against the length of the input, the method is exponential. A running time of this kind is called **pseudo-polynomial**.',
    cases: [
      { case: 'Table over capacities (this lesson)', time: 'Θ(nW)', when: 'Every input. The whole table is filled whatever the items are.' },
      { case: 'Try every subset', time: 'O(2ⁿ · n)', when: 'Brute force. Usable up to roughly 20 or 25 items, and independent of W.' },
      { case: 'Meet in the middle', time: 'O(2^(n/2) · n)', when: 'Split the items into two halves, list the subsets of each, and combine. Horowitz and Sahni, 1974.' },
      { case: 'Fractional items (greedy)', time: 'O(n log n)', when: 'A different, easier problem in which items can be split. Sorting by value per weight is exact.' },
      { case: 'Approximation scheme', time: 'O(n³ / ε)', when: 'Rounding the values and using a value-indexed table gives a load worth at least (1 − ε) times the best, for any chosen ε.' },
    ],
    space: 'Θ(nW) for the full table, which the traceback uses. The best value alone needs one row of W + 1 numbers, updated from high capacities to low.',
    memory: 'The table is the limit in practice. Ten thousand items and a capacity of ten million would mean a hundred billion cells. Storing one bit per cell (taken or not) for the traceback, or using a divide-and-conquer reconstruction, reduces memory but not time.',
    tradeoffs: 'Dynamic programming gives an exact answer in time that depends on the capacity. Brute force and meet-in-the-middle are exact in time that depends only on the number of items. Branch and bound is exact and usually fast in practice but has no good worst-case guarantee. Approximation schemes trade a controlled loss of value for a guaranteed polynomial running time.',
    assumptions: [
      'Weights and the capacity are non-negative whole numbers. Values may be any non-negative numbers.',
      'Arithmetic on values and table lookups take constant time.',
      'The decision version of the problem ("is there a load of weight at most W worth at least V?") is NP-complete, so no algorithm is known whose running time is polynomial in the length of the input, and none exists unless P = NP.',
      'The chart on this page counts table cells written, including the row for no items and the column for capacity 0, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Exact answers when the capacity is moderate: thousands to millions, depending on memory.',
      'Answering many related questions at once. The last row holds the best value for every capacity up to W.',
      'Problems with added structure that fits the same table, such as counting the ways to reach a total.',
    ],
    struggles: [
      'Huge capacities, or weights that are not whole numbers and need a fine scale.',
      'Several constraints at once (weight and volume and cost). Each adds a dimension to the table.',
      'Items whose values depend on each other, which breaks the assumption that values add up.',
    ],
    pitfalls: [
      'Reusing an item by reading the current row, or by looping upward in the one-row version.',
      'Scaling fractional weights by a large factor and ending up with a table too big to store.',
      'Reporting only the best value when the user needed to know which items achieve it.',
    ],
    misunderstandings: [
      '"Take the items with the best value for their weight first." That rule is exact only if items can be split. With whole items it can leave unusable space: in the worked example it gets 16 where 22 is possible.',
      '"The algorithm runs in O(nW), which is polynomial, so the problem is easy." W is a number, and its size is exponential in the number of digits used to write it. The problem is NP-hard, and the table method does not contradict that.',
      '"NP-hard means it cannot be solved." It means no method is known that is fast on every instance as instances grow. Knapsack problems with thousands of items are solved exactly all the time, by this table when capacities are moderate and by branch and bound otherwise.',
      '"0/1 means the weights are 0 or 1." It means each item is used zero times or once.',
    ],
    constraints: [
      'Memory for the table usually runs out before time does.',
      'Real selection problems seldom have a single constraint. Practical solvers treat the single-constraint knapsack as a building block inside a larger integer program.',
    ],
    alternatives: [
      { name: 'Greedy by value per weight', when: 'Items can be divided (the fractional knapsack). It is then exact, and it is a useful upper bound for the 0/1 problem.' },
      { name: 'Brute force or meet in the middle', when: 'There are few items (up to about 40 with meet in the middle) and the capacity is too large for a table.' },
      { name: 'Branch and bound', when: 'Both the capacity and the values are large. It explores take-or-skip decisions and prunes with the fractional bound.' },
      { name: 'Approximation scheme (FPTAS)', when: 'A guaranteed near-best answer in polynomial time is acceptable.' },
      { id: 'simulated-annealing', name: 'Simulated Annealing', when: 'The real problem has extra constraints or interactions that no table captures, and a good answer without a guarantee is enough.' },
    ],
    comparison: {
      columns: ['', 'Table (this lesson)', 'Greedy by ratio', 'Brute force'],
      rows: [
        ['Exact for 0/1 items', 'Yes', 'No', 'Yes'],
        ['Exact for divisible items', 'Not applicable', 'Yes', 'Not applicable'],
        ['Time', 'O(nW)', 'O(n log n)', 'O(2ⁿ · n)'],
        ['Depends on capacity', 'Yes, linearly', 'No', 'No'],
        ['Needs whole-number weights', 'Yes', 'No', 'No'],
      ],
    },
  },

  applications: [
    { title: 'Cutting stock in manufacturing', status: 'established', text: 'When rolls of paper, steel or film must be cut into ordered widths with little waste, the standard method of Gilmore and Gomory builds cutting patterns one at a time. Finding each new pattern is a knapsack problem: choose the widths, each with a current "value", that best fill one roll.' },
    { title: 'Inside integer programming solvers', status: 'established', text: 'Each linear constraint of an integer program with yes-or-no variables is a knapsack constraint. Solvers use this to derive extra inequalities, called cover cuts, that tighten the problem before and during the search.' },
    { title: 'Capital budgeting and project selection', status: 'illustrative', text: 'A fixed budget and a list of candidate projects, each with a cost and an estimated return, has exactly the knapsack shape when projects are all-or-nothing. In practice the estimates are uncertain and projects interact, so the knapsack answer is a starting point for discussion, not a decision.' },
    { title: 'Loading and resource allocation', status: 'illustrative', text: 'Choosing which shipments go on a vehicle with a weight limit, which files fit on a storage device, or which tasks fit in a time slot are knapsack problems when there is a single limit and each candidate has a single benefit number.' },
  ],

  connections: [
    { to: 'fibonacci-dp', type: 'prerequisite', why: 'Both fill a table so that each entry is computed once from earlier entries. Knapsack adds a second index and a decision in every cell.' },
    { to: 'concept:dynamic-programming', type: 'prerequisite', why: 'The best value for a given set of items and capacity is built from stored best values for fewer items and smaller capacities.' },
    { to: 'concept:optimal-substructure', type: 'prerequisite', why: 'Removing an item from a best load leaves a best load for the remaining items and the remaining capacity. That is what makes the take-or-skip rule correct.' },
    { to: 'concept:overlapping-subproblems', type: 'prerequisite', why: 'Different sequences of take and skip decisions arrive at the same pair of item count and remaining capacity. The table solves each pair once.' },
    { to: 'concept:greedy', type: 'related', why: 'The greedy rule solves the fractional version exactly and fails on the 0/1 version. Knapsack is the standard example of a problem where a locally best choice is not globally best.' },
    { to: 'huffman-coding', type: 'related', why: 'Huffman coding is a problem where the greedy choice is provably optimal. Setting it beside knapsack shows that whether greedy works is a property of the problem, not of the method.' },
    { to: 'concept:np-hardness', type: 'advanced', why: 'The decision version is NP-complete. The O(nW) table does not contradict this, because W is exponential in the number of digits that encode it.' },
    { to: 'concept:approximation', type: 'advanced', why: 'Rounding the values and running a value-indexed table gives a load within any chosen fraction of the best in polynomial time, a fully polynomial-time approximation scheme.' },
    { to: 'concept:brute-force', type: 'same-problem', why: 'Trying all 2ⁿ subsets solves the same problem and is the reference the tests on this page compare against.' },
    { to: 'edit-distance', type: 'related', why: 'Both fill a two-dimensional table of best values, each cell from a few earlier cells, and then trace back through the table to recover the decisions.' },
    { to: 'lcs', type: 'related', why: 'The LCS table also chooses in each cell between using an element and skipping it, and its traceback reads the choices back the same way.' },
    { to: 'needleman-wunsch', type: 'related', why: 'Sequence alignment maximizes a total score over a table and recovers the optimal choices by traceback, as knapsack does over items and capacities.' },
    { to: 'bellman-ford', type: 'related', why: 'Both apply Bellman\'s principle stage by stage. Bellman-Ford allows one more edge per round; knapsack allows one more item per row.' },
    { to: 'dijkstra', type: 'related', why: 'Filling the table is a best-path computation in a layered graph with one layer per item and one node per capacity. The layers fix the order in which nodes can be finished, so a plain sweep replaces the priority queue that Dijkstra\'s algorithm uses to discover that order.' },
    { to: 'simplex', type: 'advanced', why: 'Allowing fractions of items turns the problem into a linear program. Its solution is the greedy fractional load, which gives the upper bound used by branch and bound.' },
    { to: 'discipline:finance', type: 'application', why: 'Selecting all-or-nothing investments under a fixed budget is a knapsack problem with costs as weights and expected returns as values.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'When the algorithm considers taking item i at capacity c, it adds v[i] to K[i − 1][c − w[i]], a cell in the row above. Why the row above and not the same row?',
      options: ['The same row has not been filled yet', 'The row above contains no loads that use item i, so the item is used at most once', 'The row above always holds larger values', 'It makes no difference; either row gives the same answer'],
      answer: 1,
      explain: [
        'The cells to the left in the same row have been filled. They are avoided for a different reason.',
        'Correct. A load from row i − 1 uses only items 1 to i − 1, so adding item i to it uses item i exactly once. That is the 0/1 rule.',
        'Values in a column never decrease going down, so the row above holds values that are the same or smaller.',
        'Reading the same row lets an item be added to a load that already has it. That solves the unbounded knapsack problem and gives a different, larger answer.',
      ],
    },
    {
      type: 'predict',
      q: 'Four items have weights 1, 3, 4, 5 and values 1, 4, 5, 7. The bag holds weight 7. What is the best total value?',
      options: ['8', '9', '10', '12'],
      answer: 1,
      explain: [
        '8 is what the greedy rule gets: item 4 has the best value per weight, and after taking it only item 1 still fits.',
        'Correct. Items 2 and 3 weigh 3 + 4 = 7 and are worth 4 + 5 = 9. No other selection that fits is worth more.',
        'No selection of weight at most 7 reaches 10. Items 3 and 4 would be worth 12 but weigh 9.',
        '12 needs items 3 and 4, which weigh 9. That is over the limit.',
      ],
      tryInput: { weights: [1, 3, 4, 5], values: [1, 4, 5, 7], capacity: 7 },
    },
    {
      type: 'debug',
      q: 'This space-saving version uses one row. For weights 1, 2, 3, values 6, 10, 12 and capacity 5 it returns 30, but the right answer is 22. What is wrong?',
      code: `def knapsack(weights, values, capacity):
    best = [0] * (capacity + 1)
    for w, v in zip(weights, values):
        for c in range(w, capacity + 1):
            best[c] = max(best[c], best[c - w] + v)
    return best[capacity]`,
      options: ['The array should have capacity + 2 entries', 'The inner loop runs upward, so best[c − w] may already include the current item; it should run from capacity down to w', 'max should be min', 'The items must be sorted by weight first'],
      answer: 1,
      explain: [
        'capacity + 1 entries cover capacities 0 to capacity, which is right.',
        'Correct. Going upward, best[c − w] has already been updated for this item, so the item can be added again and again. Here it takes the first item five times: 5 × 6 = 30. Looping downward makes every read see the previous item\'s row.',
        'The goal is the largest value, so max is right.',
        'The order of the items does not affect the result.',
      ],
    },
    {
      type: 'choice',
      q: 'The greedy rule sorts items by value per unit of weight and takes them in that order while they fit. When is it guaranteed to give the best total value?',
      options: ['Always', 'When items can be split, so that a fraction of the next item fills the remaining space', 'When all the weights are different', 'Never'],
      answer: 1,
      explain: [
        'Not for whole items. With weights 1, 2, 3, values 6, 10, 12 and capacity 5, greedy gets 16 and the best is 22.',
        'Correct. In the fractional knapsack problem the bag can always be filled exactly with the best remaining value per weight, and an exchange argument shows nothing beats that. With whole items, leftover space breaks the argument.',
        'Different weights do not help. The counterexample above has all weights different.',
        'It is exact for the fractional problem, and it is often close for the 0/1 problem. It just carries no guarantee there.',
      ],
    },
    {
      type: 'choice',
      q: 'The capacity is doubled from W to 2W and nothing else changes. What happens to the work done by the table method, and to the length of the input?',
      options: ['The work doubles, and the input grows by one binary digit', 'Both double', 'The work grows by one column, and the input doubles', 'Neither changes'],
      answer: 0,
      explain: [
        'Correct. The table gains W more columns in every row, while writing 2W takes just one more bit than writing W. That gap between the size of a number and the length of its name is what pseudo-polynomial means.',
        'The input does not double. A number twice as large is only one binary digit longer.',
        'It is the other way round: the table doubles and the input barely changes.',
        'The table has W + 1 columns, so it certainly changes.',
      ],
    },
    {
      type: 'challenge',
      title: 'When the capacity is huge',
      prompt: 'Suppose the capacity is 1,000,000,000 but there are only 20 items, each worth at most 50. A table with a billion columns is out of the question. Build a table indexed by value instead: let least[v] be the smallest total weight of any selection worth exactly v, using the items seen so far. Process the items one at a time, and at the end report the largest v whose least[v] is at most the capacity. Check your program against the capacity-indexed version on small inputs, such as weights 1, 3, 4, 5 with values 1, 4, 5, 7 and capacity 7, where both must give 9.',
      hints: ['The total value is at most 20 × 50 = 1,000, so the array has 1,001 entries. Start with least[0] = 0 and every other entry at infinity.', 'For each item, loop v downward from the maximum to the item\'s value, and set least[v] to the smaller of least[v] and least[v − value] + weight. The downward loop is what keeps each item to one use.'],
    },
  ],

  compare: {
    idea: 'Fill a table of best values over (items allowed, capacity); each cell is the better of skipping the item or taking it.',
    requires: 'Whole-number weights, a capacity small enough to fill in a table with one cell per item and unit of capacity, and values that simply add up.',
    sensitivity: 'None in running time: the whole table is filled. The capacity, not the items, decides the cost.',
    memory: 'O(nW) with traceback, O(W) for the best value alone.',
    difficulty: 'moderate',
    difficultyNote: 'The recurrence is two lines. Understanding why O(nW) is not polynomial takes longer.',
    limits: 'Impractical for very large capacities. It handles one limit only. It returns one best choice even when several tie.',
    useWhen: 'Each item is either taken whole or left, weights are whole numbers, and the capacity is moderate.',
  },

  advanced: {
    history: 'The table method is an application of the dynamic programming that Richard Bellman developed in the 1950s. George Dantzig discussed the knapsack problem by name in a 1957 paper and showed that taking items in order of value per unit of weight solves the version in which items can be divided. In 1972 Richard Karp included a form of the knapsack problem among the 21 problems he proved NP-complete. In 1974 Ellis Horowitz and Sartaj Sahni gave the meet-in-the-middle method, and in 1975 Oscar Ibarra and Chul Kim gave the first fully polynomial-time approximation scheme. In 1978 Ralph Merkle and Martin Hellman built one of the earliest public-key cryptosystems on a knapsack-type problem. Within a few years Adi Shamir showed how to break it, a reminder that a problem being hard in the worst case does not make every instance hard.',
    derivation: 'Let $K(i, c)$ be the largest total value of a subset of items $1, \\dots, i$ with total weight at most $c$. Then $K(0, c) = 0$ and, for $i \\ge 1$,\n\n$$K(i, c) = \\begin{cases} K(i-1,\\, c) & \\text{if } w_i > c \\\\ \\max\\bigl(K(i-1,\\, c),\\ v_i + K(i-1,\\, c - w_i)\\bigr) & \\text{otherwise.} \\end{cases}$$\n\nThe answer is $K(n, W)$. Replacing $K(i-1, c - w_i)$ by $K(i, c - w_i)$ in the second line gives the recurrence for the unbounded problem, in which an item may be used any number of times.',
    proof: 'Optimal substructure. Let $S$ be an optimal subset of items $1..i$ for capacity $c$. If $i \\notin S$, then $S$ is feasible for $(i-1, c)$, and it is optimal there, since any better subset would also be feasible for $(i, c)$. If $i \\in S$, then $S \\setminus \\{i\\}$ is feasible for $(i-1, c - w_i)$. If some $T$ were better for $(i-1, c - w_i)$, then $T \\cup \\{i\\}$ would be feasible for $(i, c)$ and worth more than $S$, a contradiction. Hence the value of $S$ equals one of the two candidates in the recurrence. Both candidates are values of feasible subsets, so the optimum is their maximum.\n\nWhy greedy works for divisible items. Order the items by $v_i / w_i$, largest first, and suppose an optimal fractional load takes less than it could of an item $a$ while taking some of an item $b$ with a smaller ratio. Moving a small weight $\\delta$ from $b$ to $a$ keeps the total weight the same and changes the value by $\\delta\\,(v_a / w_a - v_b / w_b) \\ge 0$. Repeating the exchange turns any optimal load into the greedy one without losing value. With whole items the exchange is not available, because $\\delta$ cannot be chosen freely.',
    complexityProof: 'The table has $(n+1)(W+1)$ cells and each is filled in constant time, so the algorithm takes $\\Theta(nW)$ time. The input, however, consists of $2n + 1$ numbers, and its length is about $L = \\sum_i (\\log_2 w_i + \\log_2 v_i) + \\log_2 W$ bits. Since $W$ can be as large as $2^{L}$, the running time $nW$ is not bounded by any polynomial in $L$. An algorithm whose running time is polynomial in the numeric values of the input, but not in its length, is called pseudo-polynomial. The decision version of knapsack is NP-complete: it is in NP because a proposed subset can be checked by adding up, and it contains subset sum (take $v_i = w_i$ and ask for value at least $W$) as a special case. Problems of this kind, NP-complete yet solvable in pseudo-polynomial time, are called weakly NP-complete.',
    variants: [
      { name: 'Fractional knapsack', text: 'Items can be divided. Solved exactly by the greedy rule in O(n log n) time.' },
      { name: 'Unbounded knapsack', text: 'Any number of copies of each item may be taken. The "take" option reads the current row instead of the row above.' },
      { name: 'Subset sum', text: 'The special case in which each value equals the weight: can a subset reach a given total exactly? The table holds true or false in each cell.' },
      { name: 'Value-indexed table', text: 'Stores the least weight for each achievable total value. Runs in O(n × total value), better when values are small and the capacity is large.' },
      { name: 'Approximation scheme', text: 'Divide every value by a scaling factor, round down, and solve with the value-indexed table. The answer is within a factor (1 − ε) of the best, in time polynomial in n and 1/ε.' },
      { name: 'Multiple constraints and multiple bags', text: 'Adding a second limit such as volume, or several bags, gives the multidimensional and multiple knapsack problems, which are harder both in theory and in practice.' },
    ],
    implementation: 'For the value alone, use one array and loop capacities downward. For the items as well, keep one bit per cell recording whether the item was taken, which is far smaller than a table of values. Skip columns that no combination of weights can reach when weights share a common divisor: divide everything by it first. For large instances, sort by value per weight and use branch and bound with the fractional load as the bound.',
    benchmarking: 'State the number of items, the capacity and the range of weights and values. Instances whose weights and values are strongly correlated are much harder for branch and bound than uncorrelated ones, while the table method takes the same time on both, so a benchmark on one family says little about the other.',
    references: [
      { authors: 'R. Bellman', year: 1957, title: 'Dynamic Programming', venue: 'Princeton University Press' },
      { authors: 'G. B. Dantzig', year: 1957, title: 'Discrete-variable extremum problems', venue: 'Operations Research 5(2), 266-288' },
      { authors: 'R. M. Karp', year: 1972, title: 'Reducibility among combinatorial problems', venue: 'In Complexity of Computer Computations, Plenum Press, 85-103' },
      { authors: 'E. Horowitz and S. Sahni', year: 1974, title: 'Computing partitions with applications to the knapsack problem', venue: 'Journal of the ACM 21(2), 277-292' },
      { authors: 'O. H. Ibarra and C. E. Kim', year: 1975, title: 'Fast approximation algorithms for the knapsack and sum of subset problems', venue: 'Journal of the ACM 22(4), 463-468' },
      { authors: 'P. C. Gilmore and R. E. Gomory', year: 1961, title: 'A linear programming approach to the cutting-stock problem', venue: 'Operations Research 9(6), 849-859' },
    ],
    furtherReading: [
      'H. Kellerer, U. Pferschy and D. Pisinger, *Knapsack Problems* (Springer, 2004).',
      'M. R. Garey and D. S. Johnson, *Computers and Intractability: A Guide to the Theory of NP-Completeness* (1979), for pseudo-polynomial time and strong NP-completeness.',
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Greedy Algorithms", for the contrast between the fractional and 0/1 problems.',
    ],
  },

  tests: [
    { name: 'default input matches brute force over all subsets, and greedy falls short', input: { items: 5, capacity: 10, seed: 34, weights: [], values: [] },
      check: (r, c) => (r.weights.join(',') === '5,1,3,3,4' && r.values.join(',') === '8,5,12,9,15' && r.best === 36 && r.chosen.join(',') === '3,4,5' && r.greedyValue === 32 ? matchesBrute(r, c) : `got ${r.best} with items ${r.chosen.join(',')} from weights ${r.weights.join(',')} and values ${r.values.join(',')}; greedy ${r.greedyValue}`) },
    { name: 'worked example: every cell of the table, the chosen items and the greedy value', input: { weights: [1, 2, 3], values: [6, 10, 12], capacity: 5 },
      check: (r, c) => (JSON.stringify(r.table) === '[[0,0,0,0,0,0],[0,6,6,6,6,6],[0,6,10,16,16,16],[0,6,10,16,18,22]]' && r.best === 22 && r.chosen.join(',') === '2,3' && r.totalWeight === 5 && r.greedyValue === 16 && r.greedyChosen.join(',') === '1,2' ? matchesBrute(r, c) : `got ${r.best} with items ${r.chosen.join(',')}, table ${JSON.stringify(r.table)}`) },
    { name: 'quiz: the small fixed example is 9 with items 2 and 3; greedy gets 8', input: { weights: [1, 3, 4, 5], values: [1, 4, 5, 7], capacity: 7 },
      check: (r, c) => (r.best === 9 && r.chosen.join(',') === '2,3' && r.greedyValue === 8 && r.table[4].join(' ') === '0 1 1 4 5 7 8 9' ? matchesBrute(r, c) : `got ${r.best}, greedy ${r.greedyValue}`) },
    { name: 'matches brute force on 8 random items', input: { items: 8, capacity: 16, seed: 9, weights: [], values: [] }, check: matchesBrute },
    { name: 'matches brute force on another seed with a tight bag', input: { items: 7, capacity: 6, seed: 37, weights: [], values: [] }, check: matchesBrute },
    { name: 'matches brute force with duplicate items and a zero value', input: { weights: [2, 2, 2, 3, 3, 7], values: [3, 3, 0, 5, 5, 11], capacity: 9 }, check: matchesBrute },
    { name: 'tryThis: at capacity 16 every default item fits and the value is 49', input: { items: 5, capacity: 16, seed: 34, weights: [], values: [] },
      check: (r, c) => (r.best === 49 && r.chosen.length === 5 && r.totalWeight === 16 ? matchesBrute(r, c) : `got ${r.best} with weight ${r.totalWeight}`) },
    { name: 'an item heavier than the bag is never taken', input: { weights: [9, 2], values: [50, 3], capacity: 5 },
      check: (r, c) => (r.best === 3 && r.chosen.join(',') === '2' ? matchesBrute(r, c) : `got ${r.best}`) },
    { name: 'table size is (n + 1)(W + 1)', input: { weights: [4, 5, 6], values: [1, 2, 3], capacity: 3 },
      check: (r, c) => (r.best === 0 && r.chosen.length === 0 && r.rows === 4 && r.cols === 4 && c['cells filled'] === 16) || `got ${r.best}, ${c['cells filled']} cells` },
  ],
};
