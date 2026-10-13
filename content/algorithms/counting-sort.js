import { arrayInputs, resolveArray, isSorted, sameMultiset } from '../../js/lib/arrays.js';
import { makeRng } from '../../js/lib/rng.js';

const LEGEND = [
  { label: 'value being read or written', role: 'active' },
  { label: 'already handled', role: 'visited' },
  { label: 'sorted', role: 'sorted' },
];
const FULL_ROW = 20;      // up to this many keys, every count cell is drawn
const MAX_RANGE = 1e6;    // refuse count arrays larger than this

function run(input, t) {
  const a = resolveArray(input);
  const original = a.slice();
  const n = a.length;
  if (a.some((x) => !Number.isInteger(x))) {
    throw new Error('Counting sort needs whole-number keys, because every key is used as a position in the count array. Remove the fractions, or use a comparison sort.');
  }
  if (n === 0) {
    t.frame(() => ({ line: 0, note: 'The list is empty, so there is nothing to sort.', views: [{ kind: 'bars', values: [0], legend: LEGEND }] }));
    return { sorted: a, original, lo: 0, hi: 0, k: 0, counts: [], starts: [] };
  }

  // Find the key range. These are the only comparisons the algorithm makes.
  let lo = a[0], hi = a[0];
  for (let i = 1; i < n; i++) {
    t.count('comparisons', 2);
    if (a[i] < lo) lo = a[i];
    if (a[i] > hi) hi = a[i];
  }
  const k = hi - lo + 1;
  if (k > MAX_RANGE) throw new Error(`The keys span ${k} possible values. Counting sort would need a count array that large, which is exactly the situation it is not suited to.`);

  const C = new Array(k).fill(0);
  t.count('writes', k);
  const P = new Array(k).fill(null);
  const B = new Array(n).fill(null);
  let phase = 0; // 0 before counting, 1 counting, 2 positions, 3 placing, 4 done
  let handled = 0;

  // For the picture: one cell per key that occurs, and one shared cell for each run of unused keys
  // (every cell is drawn separately when the range is small).
  const present = new Set(a);
  const groups = [];
  if (t.record) {
    for (let v = lo; v <= hi;) {
      if (present.has(v) || k <= FULL_ROW) { groups.push([v, v]); v++; continue; }
      let w = v;
      while (w + 1 <= hi && !present.has(w + 1)) w++;
      groups.push([v, w]);
      v = w + 1;
    }
  }
  const condensed = k > FULL_ROW && present.size < k;
  const cellsFor = (arr, activeKey, role = 'active') => groups.map(([from, to]) => {
    const value = arr[from - lo];
    return { t: value === null ? '·' : value, sub: to > from ? `${from}..${to}` : from,
      role: from === activeKey ? role : present.has(from) ? 'default' : 'dim' };
  });
  const barHeight = (v) => (v === null ? null : lo < 0 ? v - lo : v);

  const views = ({ at = -1, key, out = -1, sortedAll = false } = {}) => {
    const roles = {};
    for (let i = 0; i < n; i++) {
      if (sortedAll) roles[i] = 'sorted';
      else if (i < handled) roles[i] = 'visited';
    }
    if (at >= 0) roles[at] = 'active';
    const bars = { kind: 'bars', values: a.slice(), roles, markers: at >= 0 ? [{ index: at, label: 'x' }] : [], legend: LEGEND,
      aux: { label: 'output B', values: B.map(barHeight), roles: out >= 0 ? { [out]: 'active' } : {} } };
    if (phase === 0) return [bars];
    const rows = [{ label: 'Count C', cells: cellsFor(C, phase <= 2 ? key : undefined, phase === 2 ? 'compare' : 'active') }];
    if (phase >= 2) rows.push({ label: 'Position P', cells: cellsFor(P, key) });
    return [bars, { kind: 'rows', title: `One cell for every possible key from ${lo} to ${hi} (${k} ${k === 1 ? 'cell' : 'cells'}); the small number is the key`, rows }];
  };

  t.frame(() => ({ line: 0, note: `Start with ${n} values. Counting sort will not compare them with each other to put them in order. It counts how many times each key occurs and uses the counts to work out where every value belongs.`, views: views() }));

  phase = 1;
  t.frame(() => ({ line: [1, 2, 3], note: `One pass over the list finds the smallest key, ${lo}, and the largest, ${hi}. The count array gets one cell for every whole number in that range: ${k} ${k === 1 ? 'cell' : 'cells'}, all starting at 0.${present.size < k ? ' Keys that never occur are drawn faint.' : ''}${condensed ? ' To save room in the picture, a run of unused keys is drawn as a single faint cell.' : ''}`,
    views: views(), vars: { lo, hi, k } }));

  // Pass 1: count the keys.
  for (let i = 0; i < n; i++) {
    const x = a[i];
    C[x - lo]++;
    t.count('writes');
    handled = i;
    t.frame(() => ({ line: [4, 5], note: `Read ${x}. Add 1 to the cell for key ${x}. That key has now been seen ${C[x - lo]} ${C[x - lo] === 1 ? 'time' : 'times'}.`,
      views: views({ at: i, key: x }), vars: { x, 'C[x − lo]': C[x - lo] } }));
  }
  handled = 0;
  const counts = C.slice();

  // Pass 2: turn counts into starting positions.
  phase = 2;
  let total = 0, unused = 0;
  for (let v = 0; v < k; v++) {
    P[v] = total;
    t.count('writes');
    const c = C[v], key = lo + v, first = total;
    total += c;
    if (c === 0) { unused++; continue; }
    const skipped = unused;
    unused = 0;
    t.frame(() => ({ line: [8, 9, 10],
      note: `Key ${key} occurs ${c} ${c === 1 ? 'time' : 'times'}, and ${first} ${first === 1 ? 'value is' : 'values are'} smaller. So ${c === 1 ? `the ${key} belongs` : `the first ${key} belongs`} at position ${first}${c === 2 ? `, and the second at position ${first + 1}` : c > 2 ? `, and the others follow up to position ${first + c - 1}` : ''}.${skipped ? ` The ${skipped} unused ${skipped === 1 ? 'key' : 'keys'} just before it got the same running total, ${first}.` : ''}`,
      views: views({ key }), vars: { v, key, 'C[v]': c, 'P[v]': first, total } }));
  }
  const starts = P.slice();

  // Pass 3: place every value at its position.
  phase = 3;
  for (let i = 0; i < n; i++) {
    const x = a[i], p = P[x - lo];
    B[p] = x;
    P[x - lo] = p + 1;
    t.count('writes', 2);
    handled = i;
    t.frame(() => ({ line: [11, 12, 13], note: `Read ${x}. The position cell for key ${x} says ${p}, so write ${x} to position ${p} of the output. Then advance that cell to ${p + 1}, ready for the next ${x}.`,
      views: views({ at: i, key: x, out: p }), vars: { x, 'P[x − lo]': p + 1 } }));
  }
  handled = n;
  for (let i = 0; i < n; i++) a[i] = B[i];
  t.count('writes', n);
  phase = 4;
  t.frame(() => ({ line: 14, note: 'Every value has been written to its place in the output. Copy the output back over the original list.', views: views({ sortedAll: true }) }));
  t.frame(() => ({ line: null, note: `Sorted. The only comparisons were the ${2 * (n - 1)} that found the smallest and largest key. The order itself came from counting: ${n} values and ${k} count ${k === 1 ? 'cell' : 'cells'}.`, views: views({ sortedAll: true }) }));
  return { sorted: a, original, lo, hi, k, counts, starts };
}

// Keys spread over a wide range, for the experiment.
const wideList = (n, seed, top) => { const rng = makeRng(seed + 17); return Array.from({ length: n }, () => rng.int(1, top)); };

const checkRun = (r, c) => {
  if (!isSorted(r.sorted) || !sameMultiset(r.sorted, r.original)) return 'output is not a sorted permutation of the input';
  const n = r.original.length;
  const k = Math.max(...r.original) - Math.min(...r.original) + 1;
  if (r.k !== k) return `expected a key range of ${k}, got ${r.k}`;
  if ((c.comparisons || 0) !== 2 * (n - 1)) return `expected ${2 * (n - 1)} comparisons (range scan only), got ${c.comparisons}`;
  if (r.counts.reduce((s, x) => s + x, 0) !== n) return 'the counts do not add up to n';
  return (c.writes || 0) === 4 * n + 2 * k || `expected 4n + 2k = ${4 * n + 2 * k} writes, got ${c.writes}`;
};

export default {
  meta: {
    id: 'counting-sort',
    name: 'Counting Sort',
    aliases: ['distribution counting', 'key-indexed counting', 'histogram sort'],
    kind: 'algorithm',
    discipline: 'algorithms',
    alsoIn: [],
    subfield: 'Sorting',
    family: 'Non-comparison sorts',
    lab: 'sorting-searching',
    compareGroup: 'sorting',
    year: 1954,
    authors: 'Harold H. Seward',
    summary: 'Sorts whole-number keys by counting how often each occurs and computing every position directly. Linear time when the key range is small; wasteful when it is large.',
    difficulty: 'intermediate',
    order: 160,
    paradigms: ['incremental'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n + k)', average: 'O(n + k)', worst: 'O(n + k)', class: 'linear' },
    space: { worst: 'O(n + k)', class: 'linear' },
    tags: {
      problems: ['sort a list', 'sort whole numbers', 'sort exam marks', 'sort by a small integer key', 'sort faster than n log n', 'count how often each value occurs'],
      techniques: ['counting', 'running totals', 'key as array index', 'stable distribution'],
      applications: ['data processing', 'image processing', 'databases', 'bioinformatics'],
    },
    prerequisites: ['concept:array', 'concept:big-o', 'concept:comparison-model', 'merge-sort'],
  },

  bigIdea: {
    simple: "Counting sort puts a list in order without asking which of two items is bigger. It works when the items are whole numbers from a small range, such as exam marks from 0 to 100. Imagine sorting a big pile of exam papers by mark. Draw a tally chart with one row for each possible mark. Go through the pile once and add a tally for each paper. Now you know how many papers got each mark. From that you can work out where every group belongs in the finished pile. If three papers scored 0 and five scored 1, then the papers that scored 2 must start at the ninth place. Go through the pile a second time and put each paper straight into its place. This is very fast when the range of marks is small. It is wasteful when the range is huge, because the chart needs a row for every possible value, whether or not any paper has it.",
    what: 'Counting sort sorts items whose keys are whole numbers in a known range. It makes one pass to count how many times each key occurs, turns the counts into the position where each key\'s group starts, and then makes a second pass that writes every item directly to its final position. The time taken is proportional to the number of items plus the number of possible keys.',
    why: 'Every sort that works by comparing items needs on the order of n log n comparisons, and that is a proven limit. Counting sort shows that the limit belongs to the method, not to the problem. When keys are small whole numbers, a key can be used as a position in an array, and that single step delivers more information than a yes-or-no comparison ever can.',
    when: 'Use it when the keys are whole numbers (or can be mapped to them) and the number of possible keys, k, is not much larger than the number of items, n. If k is far larger than n, the count array dominates both time and memory, and a comparison sort such as [merge sort](#/algorithm/merge-sort) or [quick sort](#/algorithm/quick-sort) is the better choice. For large whole-number keys, radix sort applies counting sort to one digit at a time.',
    interesting: 'In the placement pass, nothing is searched for and nothing is shifted. Each item is read once and written once, straight to the position where it will stay. The cost has moved from the items to the keys: the algorithm spends a step on every possible key value, including the ones that never appear.',
    where: 'As the inner step of radix sort, which sorts large integers and fixed-length strings one digit or character at a time. The same counting pass, without the sorting, is how a histogram of an image or a table of letter frequencies is built.',
    analogy: {
      title: 'Pigeonholes in a sorting office',
      text: 'A sorting office has a wall of pigeonholes, one for each delivery district, arranged in order. A clerk picks up each letter, reads its district number, and drops it into that pigeonhole. No letter is ever held up against another letter. When the sack is empty, walking along the wall from the first hole to the last collects the letters in district order.',
      limits: 'A pigeonhole can hold any number of letters, but a block of computer memory cannot stretch. That is why counting sort makes a counting pass first: it has to know how much room each key needs before it writes anything. The picture also depends on the wall being a sensible size. A hole for each of a hundred districts is fine. A hole for every possible phone number would fill the building with empty holes, and walking past them all would take longer than sorting the letters any other way.',
    },
  },

  example: {
    setup: 'Sort the six numbers 3, 1, 3, 2, 1, 3. The number an item is sorted by is called its key. Here the keys run from 1 to 3, so three counters are enough. Positions in the output are numbered from 0, as computers number them.',
    steps: [
      'Find the smallest and largest key: 1 and 3. Set up one counter for each of the keys 1, 2 and 3, all at zero.',
      'Read the list once and count. The key 1 occurs 2 times, the key 2 occurs 1 time, and the key 3 occurs 3 times.',
      'Work out where each group starts. The 1s start at position 0. The 2s start after the two 1s, at position 2. The 3s start after the two 1s and the one 2, at position 3.',
      'Read the list again from the left and place each number. The first 3 goes to position 3, and the next 3 will go to position 4. The 1 goes to position 0. The second 3 goes to position 4. The 2 goes to position 2. The second 1 goes to position 1. The last 3 goes to position 5.',
    ],
    result: 'The output is 1, 1, 2, 3, 3, 3. The list was read and each number written straight to its final place, and no two numbers were compared to decide which comes first. The only comparing was the search for the smallest and largest key in the first step.',
    tryInput: { custom: [3, 1, 3, 2, 1, 3] },
  },

  terms: [
    { term: 'Sorting', meaning: 'Rearranging a list so that its items are in order, for example from smallest to largest.' },
    { term: 'Key', meaning: 'The value an item is sorted by. An exam paper might be sorted by its mark, so the mark is the key.' },
    { term: 'Key range', meaning: 'How many different keys are possible, from the smallest to the largest. It is usually written k.' },
    { term: 'Count array', meaning: 'A row of counters, one for each possible key, that records how many times that key occurs.' },
    { term: 'Running total', meaning: 'A sum that is updated as you go along a row of numbers. Here it gives the position where each key\'s group starts.' },
    { term: 'Comparison sort', meaning: 'A sort that learns about the order of items only by asking which of two items is larger. Counting sort is not one.' },
    { term: 'Stable', meaning: 'A sort is stable if items with equal keys come out in the same order they went in.' },
  ],

  takeaway: 'Count how many of each value there are, work out where each group starts, and put every item straight into its place.',

  viz: {
    describe: 'On top, a row of bars for the input list, with a second, shorter row underneath for the output. Below that, the count array is drawn as a strip of cells, one for each possible key, with the key written small under each cell. A second strip of position cells appears once the counts are complete. The value being read and the cells and output position it affects are terracotta. Input values that have already been handled turn pale green. Cells for keys that never occur are faint, and when the key range is large a run of such cells is drawn as one faint cell labelled with the range of keys it stands for. With negative keys, the output bars are measured from the smallest key.',
    inputs: arrayInputs({ size: 12 }),
    presets: [
      { label: 'Random list', values: { order: 'random', custom: [] } },
      { label: 'Marks from 1 to 6', values: { custom: [3, 6, 1, 4, 3, 5, 2, 6, 3, 1, 5, 3] } },
      { label: 'Negative keys', values: { custom: [2, -3, 0, -1, 2, -3, 1, 0] } },
      { label: 'Three values, wide range', values: { custom: [500, 1, 999] } },
    ],
    tryThis: [
      'Load "Marks from 1 to 6" and watch the third pass. Each value is written once, directly to a position worked out from the counts. Check that the two 6s keep their original left-to-right order in the output: that is what stable means.',
      'Load "Three values, wide range". Sorting three values costs 2010 array writes, because the count and position arrays each have 999 cells and almost all of them belong to keys that never occur. Then load "Marks from 1 to 6", which sorts four times as many values with 60 writes.',
      'Set the starting order to "Few distinct values" and raise the number of items to 64. The key range does not grow with the list, so each extra item costs just four more array writes. The comparison counter shows only the 126 comparisons used to find the smallest and largest key.',
    ],
    run,
    report: (r, c) => `Sorted ${r.sorted.length} values with keys from ${r.lo} to ${r.hi} (k = ${r.k}).\n${c.comparisons || 0} comparisons, all of them to find the key range, and ${c.writes || 0} array writes (4n + 2k).\n[${r.sorted.join(', ')}]`,
    experiment: {
      title: 'Array writes as the list grows, for a narrow and a wide key range',
      note: 'Each point is a real run of this page\'s implementation on random keys. Both lines rise by four writes per item. The wide range starts about 10,000 writes higher, the price of two arrays with a cell for every possible key. Counting sort makes no comparisons while sorting, so writes are the fair measure of its work.',
      metric: 'writes',
      metricLabel: 'Array writes',
      sizeLabel: 'Number of items (n)',
      sizes: [8, 16, 32, 64, 128, 256, 512],
      variants: [
        { id: 'narrow', label: 'Keys from 1 to 99' },
        { id: 'wide', label: 'Keys from 1 to 5,000' },
      ],
      input: (n, variant, seed) => (variant === 'wide'
        ? { custom: wideList(n, seed, 5000) }
        : { size: n, order: 'random', seed, custom: [] }),
      theory: [
        { label: '4n + 2k with k = 99 (upper limit)', fn: (n) => 4 * n + 198, variant: 'narrow' },
        { label: '4n + 2k with k = 5,000 (upper limit)', fn: (n) => 4 * n + 10000, variant: 'wide' },
      ],
    },
  },

  logic: {
    intuition: 'If you know how many items have a key smaller than 7, you know exactly where the first 7 goes: right after them. Counting gives that number for every key at once. Sorting then needs no searching, because each item\'s position can be read from a table indexed by its key.',
    steps: [
      'Find the smallest key `lo` and the largest key `hi`. The number of possible keys is `k = hi − lo + 1`.',
      'Create a count array `C` of `k` zeros. Key `x` uses cell `x − lo`, so the smallest key uses cell 0. This offset is what makes negative keys work.',
      'Read every item and add 1 to the cell for its key.',
      'Walk along the count array keeping a running total. Before adding each count, record the total so far as that key\'s starting position in `P`. The starting position of a key is the number of items with smaller keys.',
      'Read the items again in their original order. Write each one to the output at its key\'s current position, then advance that position by 1.',
      'Copy the output back over the original list.',
    ],
    pseudocode: [
      'counting_sort(A):',
      '  lo ← min(A), hi ← max(A)',
      '  k ← hi − lo + 1',
      '  C ← array of k zeros',
      '  for each x in A:',
      '    C[x − lo] ← C[x − lo] + 1',
      '  P ← array of k positions',
      '  total ← 0',
      '  for v from 0 to k − 1:',
      '    P[v] ← total',
      '    total ← total + C[v]',
      '  for each x in A, in order:',
      '    B[P[x − lo]] ← x',
      '    P[x − lo] ← P[x − lo] + 1',
      '  copy B into A',
    ],
    decisions: [
      { title: 'Where does the key range come from?', text: 'Sometimes it is known in advance: a byte is 0 to 255, an exam mark 0 to 100. Then no comparisons are needed at all. This lesson does not assume that, so it scans the list for the smallest and largest key first, at a cost of 2(n − 1) comparisons.' },
      { title: 'Rebuild the values, or move the items?', text: 'For bare numbers you could simply write each key back as many times as it was counted. Real data usually carries more than a key: a record has a name attached to its mark. So the general algorithm moves the original items, which requires knowing each one\'s position. That is what the position array is for.' },
      { title: 'Why read the items in their original order?', text: 'Items with the same key are written to consecutive positions in the order they are read. Reading left to right therefore keeps equal keys in their original order, which makes the sort stable. Radix sort depends on this.' },
      { title: 'One array or two?', text: 'This lesson keeps the counts in `C` and the positions in a separate array `P`, so that both can be seen. Many implementations overwrite the counts with the positions and save an array of k cells.' },
    ],
    invariants: [
      'After the counting pass, `C[v]` is the number of items whose key is `lo + v`.',
      'After the running-total pass, `P[v]` is the number of items whose key is smaller than `lo + v`.',
      'During the placement pass, `P[v]` is the output position where the next item with key `lo + v` belongs, and the items already placed with that key occupy the positions just before it, in their original order.',
    ],
    edgeCases: [
      'Negative keys: subtracting `lo` maps the smallest key to cell 0, whatever its sign.',
      'All keys equal: the count array has a single cell and every item keeps its place.',
      'A single item or an empty list: there is nothing to count or move.',
      'Keys that are not whole numbers: there is no cell for 2.5. The run on this page stops with an error. Such data needs a comparison sort, or a mapping to whole numbers that preserves order.',
      'A key range far larger than the list: the result is still correct, but nearly all the time and memory go on cells for keys that never occur.',
    ],
    correctness: 'After the counting pass `C[v]` holds the number of items with key `lo + v`. The running-total pass sets `P[v]` to the sum of all counts for smaller keys, which is the number of items that must come before the first item with that key in sorted order. So the items with key `lo + v` belong exactly in output positions `P[v]` to `P[v] + C[v] − 1`. The placement pass writes each item to its key\'s current position and advances it, so the items with a given key fill that block from left to right, in the order they are read. Blocks for different keys do not overlap and together cover every output position, so the output is sorted. Because items with equal keys are placed in reading order, the sort is stable.',
    mistakes: [
      'Using a key directly as an index without subtracting the minimum. Negative keys then fall outside the array or, in Python, silently count from the far end.',
      'Sizing the count array as `hi − lo` instead of `hi − lo + 1`, which leaves no cell for the largest key.',
      'Combining cumulative counts with a left-to-right placement pass, or start positions with a right-to-left one. Each convention needs its own direction to stay stable.',
      'Applying it to keys with a huge range, such as 64-bit identifiers, and running out of memory.',
      'Calling it "sorting in O(n)" without mentioning k.',
    ],
  },

  code: {
    sample: {
      input: 'The list [4, -2, 3, 0, 4, 1, -2, 4]. Prints the count for each key from -2 to 4, then the sorted list.',
      expected: 'counts: 2 0 1 1 0 1 3\nsorted: -2 -2 0 1 3 4 4 4',
    },
    python: {
      source: `def counting_sort(a):
    lo, hi = min(a), max(a)
    k = hi - lo + 1
    count = [0] * k
    for x in a:
        count[x - lo] += 1
    position = [0] * k
    total = 0
    for v in range(k):
        position[v] = total
        total += count[v]
    out = [0] * len(a)
    for x in a:
        out[position[x - lo]] = x
        position[x - lo] += 1
    a[:] = out
    return count


data = [4, -2, 3, 0, 4, 1, -2, 4]
count = counting_sort(data)
print("counts:", " ".join(str(c) for c in count))
print("sorted:", " ".join(str(x) for x in data))`,
      notes: [
        { line: 2, text: 'Finding the range is the only place where keys are compared. If the range is known in advance, this line disappears.' },
        { line: 6, text: 'The key, shifted by `lo`, is used as an index. This is the step no comparison sort can make.' },
        { line: 10, text: 'The running total before key `lo + v` is the number of smaller items, which is where that key\'s block starts.' },
        { line: 14, text: 'Each item is written once, straight to its final position.' },
        { line: 15, text: 'Advancing the position means the next item with the same key lands just after this one, which keeps equal keys in their original order.' },
      ],
    },
    javascript: {
      source: `function countingSort(a) {
  const lo = Math.min(...a);
  const hi = Math.max(...a);
  const k = hi - lo + 1;
  const count = new Array(k).fill(0);
  for (const x of a) {
    count[x - lo]++;
  }
  const position = new Array(k).fill(0);
  let total = 0;
  for (let v = 0; v < k; v++) {
    position[v] = total;
    total += count[v];
  }
  const out = new Array(a.length);
  for (const x of a) {
    out[position[x - lo]] = x;
    position[x - lo]++;
  }
  for (let i = 0; i < a.length; i++) a[i] = out[i];
  return count;
}

const data = [4, -2, 3, 0, 4, 1, -2, 4];
const count = countingSort(data);
console.log("counts: " + count.join(" "));
console.log("sorted: " + data.join(" "));`,
    },
    cpp: {
      source: `#include <algorithm>
#include <iostream>
#include <vector>

std::vector<int> countingSort(std::vector<int>& a) {
    int lo = *std::min_element(a.begin(), a.end());
    int hi = *std::max_element(a.begin(), a.end());
    int k = hi - lo + 1;
    std::vector<int> count(k, 0);
    for (int x : a) {
        ++count[x - lo];
    }
    std::vector<int> position(k, 0);
    int total = 0;
    for (int v = 0; v < k; ++v) {
        position[v] = total;
        total += count[v];
    }
    std::vector<int> out(a.size());
    for (int x : a) {
        out[position[x - lo]] = x;
        ++position[x - lo];
    }
    a = out;
    return count;
}

void print(const char* label, const std::vector<int>& values) {
    std::cout << label;
    for (int v : values) {
        std::cout << " " << v;
    }
    std::cout << "\\n";
}

int main() {
    std::vector<int> data = {4, -2, 3, 0, 4, 1, -2, 4};
    std::vector<int> count = countingSort(data);
    print("counts:", count);
    print("sorted:", data);
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The list is read a fixed number of times, which costs time proportional to n. The count and position arrays are each set up and walked once, which costs time proportional to k, the number of possible keys. The total is O(n + k). When k is no larger than a constant multiple of n, that is linear in n.',
    cases: [
      { case: 'Every input', time: 'O(n + k)', when: 'The work depends on how many items there are and how wide the key range is, never on the order the items start in.' },
      { case: 'Small range', time: 'O(n)', when: 'k is at most proportional to n, for example a million exam marks between 0 and 100.' },
      { case: 'Wide range', time: 'O(k)', when: 'k is much larger than n, for example a hundred values spread between 0 and a billion. The count array dominates.' },
    ],
    space: 'O(n + k): an output array of n items, plus the count array of k cells (and, in this lesson\'s version, a position array of k more).',
    memory: 'The passes over the input are sequential, but the writes into the count array and the output land wherever the keys send them. With a small k these arrays fit in the processor cache and the scattered access is cheap. With a large k each access can miss the cache, which is one reason radix sort implementations typically work on digits of about 8 to 11 bits at a time.',
    tradeoffs: 'Counting sort exchanges generality for speed. It gives up the ability to sort anything that can be compared, and in return sorts small whole-number keys in linear time. It also exchanges memory for time: O(n + k) extra space, where heap sort needs none. Its cost is governed by the key range, which a comparison sort does not care about at all.',
    assumptions: [
      'Keys are whole numbers, or can be mapped to whole numbers in a way that preserves their order.',
      'Any cell of an array can be read or written in constant time, given its index. This is the ability the comparison model leaves out.',
      'k is the number of possible keys between the smallest and largest that occur, hi − lo + 1, not the number of distinct keys present.',
      'Array writes on this page count every write to the count, position and output arrays and the copy back, including setting the k count cells to zero: 4n + 2k in total. The comparison counter records only the 2(n − 1) comparisons that find the key range.',
    ],
  },

  tradeoffs: {
    excels: [
      'Many items with keys from a small range: marks, ages, bytes, days of the year, small category codes.',
      'Lists with heavy duplication, where a comparison sort still pays n log n.',
      'As the stable pass inside radix sort.',
      'Workloads where a predictable running time matters: the cost depends only on n and k.',
    ],
    struggles: [
      'Keys spread over a range much larger than the number of items.',
      'Keys that are not whole numbers: fractions, long strings, or anything ordered only by a comparison function.',
      'Memory-constrained settings, since it needs an output array and a count array.',
    ],
    pitfalls: [
      'Forgetting the offset for negative or large keys.',
      'Describing the running time as O(n) and overlooking k.',
      'Breaking stability by pairing the wrong placement direction with the wrong kind of running total.',
      'Allocating the count array from untrusted data without checking how large the range is.',
    ],
    misunderstandings: [
      '"Sorting cannot be done faster than n log n." That limit is proved for sorts that work only by comparing items. Counting sort uses keys as positions in an array, which the proof does not cover, so the limit does not apply to it.',
      '"Counting sort is always linear, so it is always the fastest." Its time is n plus k. Sorting three numbers that range from 1 to 999 takes about two thousand steps here, nearly all spent on counters for numbers that are not in the list.',
      '"It just counts the values and prints them back out." That works for bare numbers. To sort records by a key, the records themselves have to be moved, which is why the algorithm computes a position for each one.',
      '"It makes no comparisons at all." It makes none while sorting. Finding the smallest and largest key, when they are not known beforehand, does compare keys, a linear number of times.',
    ],
    constraints: [
      'Because the count array is indexed by key, its size must be bounded before it is allocated. Production code either knows the range from the data type or falls back to another sort when the range is too large.',
      'For large integers or strings, counting sort is applied to one digit or character at a time (radix sort) so that k stays small.',
    ],
    alternatives: [
      { id: 'radix-sort', name: 'Radix Sort', when: 'Keys are whole numbers or fixed-length strings with a range too large to count directly. It runs counting sort once per digit.' },
      { id: 'merge-sort', name: 'Merge Sort', when: 'Keys can only be compared, or their range is huge, and you need a stable sort.' },
      { id: 'quick-sort', name: 'Quick Sort', when: 'Keys can only be compared and you want a fast in-place sort.' },
      { name: 'Bucket sort', when: 'Keys are numbers spread fairly evenly over a range, including fractions. Items are distributed into ranges of keys and each range is sorted separately.' },
    ],
    comparison: {
      columns: ['', 'Counting sort', 'Merge sort', 'Quick sort'],
      rows: [
        ['Time', 'O(n + k)', 'O(n log n)', 'O(n log n) average'],
        ['Works on', 'Whole-number keys in a small range', 'Anything comparable', 'Anything comparable'],
        ['Extra space', 'O(n + k)', 'O(n)', 'O(log n) stack'],
        ['Stable', 'Yes', 'Yes', 'No'],
        ['Cost depends on', 'n and the key range', 'n', 'n and pivot luck'],
      ],
    },
  },

  applications: [
    { title: 'The inner step of radix sort', status: 'established', text: 'Least-significant-digit radix sort sorts by the last digit, then the next, and so on, using a stable counting sort for each digit. With digits of one byte, k is 256 however large the keys are. The stability of counting sort is what keeps the earlier passes from being undone.' },
    { title: 'Sorting strings by character', status: 'established', text: 'Textbook string sorts use the same key-indexed counting on one character position at a time, since an alphabet is a small range of keys.' },
    { title: 'Histograms', status: 'established', text: 'The counting pass alone is a histogram. Counting how many pixels of an image have each of 256 brightness levels, and then taking running totals, is the first half of counting sort and the basis of histogram equalization in image processing.' },
    { title: 'Records with a small integer key', status: 'illustrative', text: 'Sorting a large table of people by age, of orders by day of the month, or of exam papers by mark fits the method well: millions of items, at most a few hundred possible keys.' },
  ],

  connections: [
    { to: 'radix-sort', type: 'advanced', why: 'Radix sort is counting sort applied to one digit at a time. It keeps k small for large keys, and relies on the stability of each counting pass.' },
    { to: 'merge-sort', type: 'same-problem', why: 'Both are stable sorts that write into a second array. Merge sort decides positions by comparing items; counting sort computes them from the keys.' },
    { to: 'quick-sort', type: 'same-problem', why: 'Quick sort is the usual general-purpose choice. Counting sort beats it when keys are small whole numbers, and cannot be used at all when they are not.' },
    { to: 'hash-table', type: 'related', why: 'Both turn a key into an array index to avoid searching. Counting sort uses the key itself as the index, which preserves order but needs a cell for every possible key; a hash table compresses the keys and gives up their order.' },
    { to: 'concept:comparison-model', type: 'prerequisite', why: 'Counting sort is defined by what it does outside this model: it indexes an array by a key instead of comparing two keys.' },
    { to: 'concept:lower-bound', type: 'advanced', why: 'The n log n lower bound counts the yes-or-no answers needed to tell n! orderings apart. Counting sort is the standard example of why a lower bound holds only for the operations it was proved for.' },
    { to: 'concept:stability', type: 'related', why: 'Equal keys are placed in the order they are read, so their original order survives. Multi-pass sorts such as radix sort are correct only because of this.' },
    { to: 'concept:array', type: 'prerequisite', why: 'The method depends on constant-time access to any cell of an array given its index.' },
    { to: 'discipline:computer-vision', type: 'application', why: 'An image histogram is the count array of the pixel values, and its running totals are the cumulative histogram used to adjust contrast.' },
    { to: 'discipline:information-theory', type: 'related', why: 'A comparison yields at most one bit of information. Reading a key and using it as an index distinguishes among k possibilities in one step, which is how counting sort gathers enough information in linear time.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Comparison sorts cannot beat n log n comparisons in the worst case. Why is counting sort not bound by that limit?',
      options: ['It is bound by it, but its constant factor is smaller', 'It uses each key as an array index, an operation the proof of the limit does not cover', 'It only works on lists that are already nearly sorted', 'It compares several keys at the same time'],
      answer: 1,
      explain: [
        'Its running time is O(n + k), which for small k grows more slowly than n log n. That is a different growth rate, not a smaller constant.',
        'Correct. The limit is proved for algorithms that learn about the input only through comparisons, one yes-or-no answer at a time. Indexing an array by a key is outside that model.',
        'The starting order makes no difference to counting sort.',
        'It does not order keys by comparing them at all. The speed comes from indexing, not from parallel comparisons.',
      ],
    },
    {
      type: 'predict',
      q: 'The list is 3, 1, 3, 2, 1, 3. When the counting pass has finished, what do the count cells for the keys 1, 2 and 3 hold?',
      options: ['2, 1, 3', '0, 2, 3', '1, 1, 1', '2, 3, 6'],
      answer: 0,
      explain: [
        'Correct. There are two 1s, one 2 and three 3s.',
        'Those are the starting positions computed in the next pass: the 1s start at 0, the 2s at 2 and the 3s at 3.',
        'That would record only whether each key occurs. The count array records how many times.',
        'Those are cumulative counts: how many items have a key less than or equal to each key. Some versions of the algorithm use them, but they are not the plain counts.',
      ],
      tryInput: { custom: [3, 1, 3, 2, 1, 3] },
    },
    {
      type: 'debug',
      q: 'For the list 2, -1, 0 this Python function returns 0, 2, 2. What went wrong?',
      code: `def counting_sort(a):
    hi = max(a)
    count = [0] * (hi + 1)
    for x in a:
        count[x] += 1
    out = []
    for value in range(hi + 1):
        out.extend([value] * count[value])
    return out`,
      options: ['The count array is one cell too short', 'The key -1 is used directly as an index, and Python reads count[-1] as the last cell', 'The loop on line 7 should run backwards', 'extend should be append'],
      answer: 1,
      explain: [
        '`hi + 1` cells cover the keys 0 to `hi` correctly. The trouble is the key below 0.',
        'Correct. `count[-1]` is the cell for key 2, so the -1 is counted as a second 2. Subtract the smallest key from every index, and size the array as `hi - lo + 1`.',
        'Running forwards is right for ascending order. Direction is not the fault.',
        '`extend` adds each copy of the value as its own item, which is what is wanted.',
      ],
    },
    {
      type: 'choice',
      q: 'Which of these is the worst fit for counting sort?',
      options: ['Ten million exam marks between 0 and 100', 'One thousand 64-bit account numbers', 'Every byte of a large file', 'A million ages in years'],
      answer: 1,
      explain: [
        'This is close to ideal: a huge n and a k of 101.',
        'Correct. The keys could be anywhere in a range of about 18 billion billion values, so the count array would be absurdly large for a thousand items. Use radix sort or a comparison sort.',
        'A byte has only 256 possible values, so k is tiny however large the file.',
        'Ages span little more than a hundred values, so k is small.',
      ],
    },
    {
      type: 'challenge',
      title: 'Build radix sort from counting sort',
      prompt: 'Write a function that sorts non-negative whole numbers of up to 9 decimal digits by running a stable counting sort once per digit, starting with the last digit. Each pass uses the current digit (0 to 9) as the key and moves the whole numbers. Sort a few thousand random numbers and check the result. Then replace the placement pass with one that is not stable, and find the smallest input on which the result is wrong.',
      hints: ['The digit of x at place value 10^d is (x // 10^d) % 10.', 'Each pass must leave numbers with the same digit in the order the previous pass put them. That is the only thing connecting the passes.'],
    },
  ],

  compare: {
    idea: 'Count how often each key occurs, then write every item directly to the position the counts imply.',
    requires: 'Values that are whole numbers from a small range, small enough to keep one counter for each possible value.',
    sensitivity: 'None to the order of the input. Entirely dependent on the key range k: time and memory are O(n + k).',
    memory: 'O(n + k): an output array plus one counter per possible key.',
    difficulty: 'low',
    difficultyNote: 'Three simple loops. The care goes into the offset for the smallest key and into keeping the placement stable.',
    limits: 'Useless for things that can only be compared, such as names. Impractical when the range of values is far larger than the number of items.',
    useWhen: 'There are many items but few possible values, such as exam marks out of 100.',
  },

  advanced: {
    history: 'Donald Knuth describes the method under the name distribution counting and credits it to Harold H. Seward in 1954, along with the idea of using it as the per-digit step of radix sort on a computer. Sorting by distributing items into classes is older than electronic computers: punched-card sorting machines sorted a deck one column at a time.',
    derivation: 'Why comparisons need $n\\log n$ and counting does not. A comparison sort learns about its input only through yes-or-no answers. To be correct it must behave differently on each of the $n!$ possible orderings of $n$ distinct keys, and $c$ answers can distinguish at most $2^c$ cases, so\n\n$$2^c \\ge n! \\quad\\Longrightarrow\\quad c \\ge \\log_2 n! \\approx n\\log_2 n - 1.44\\,n.$$\n\nCounting sort reads a key $x$ and executes $C[x - lo] \\leftarrow C[x - lo] + 1$. That one step selects among $k$ different cells, so it has $k$ possible outcomes instead of two, and is worth up to $\\log_2 k$ bits. Across $n$ keys that is up to $n\\log_2 k$ bits, enough to determine the sorted order, obtained in $O(n)$ steps. The bound is not broken. It was proved for a model of computation that counting sort does not stay inside.',
    proof: 'Let $c_v$ be the number of items with key $lo + v$. After the second pass $P[v] = \\sum_{u < v} c_u$, the number of items with a smaller key. In sorted order the items with key $lo + v$ must occupy positions $P[v], \\dots, P[v] + c_v - 1$.\n\nInvariant of the placement pass: after $m$ items have been read, for every $v$ the items read so far with key $lo + v$ occupy positions $P_0[v], \\dots, P[v] - 1$ of $B$ in the order they were read, where $P_0$ is the initial value. Reading the next item with key $lo + v$ writes it to $P[v]$ and increments $P[v]$, which preserves the invariant. At the end $P[v] = P_0[v] + c_v$, so each block is exactly full, the blocks are disjoint and cover $0, \\dots, n-1$, and $B$ is sorted. Equal keys appear in reading order, so the sort is stable.',
    complexityProof: 'Finding the range reads $n$ keys. Creating and zeroing $C$ takes $k$ steps. The counting pass takes $n$ steps, the running-total pass $k$, the placement pass $n$, and the copy back $n$. Every step is a constant amount of work, so the total is $\\Theta(n + k)$ on every input. The implementation on this page performs exactly $4n + 2k$ array writes and $2(n-1)$ comparisons. Extra space is $n$ cells for $B$ and $2k$ for $C$ and $P$.',
    variants: [
      { name: 'Cumulative counts, placed from the right', text: 'The textbook form in Cormen, Leiserson, Rivest and Stein: make `C[v]` the number of keys less than or equal to `v`, then scan the input from right to left, decrementing before each placement. It is stable for the same reason.' },
      { name: 'Counts overwritten by positions', text: 'Store the starting positions in the count array itself. Saves k cells of memory at the cost of losing the counts.' },
      { name: 'Rebuilding from counts', text: 'For bare integers with no attached data, write each key back as many times as it was counted. No output array or position array is needed.' },
      { name: 'Radix sort', text: 'Apply a stable counting sort to each digit in turn, from least significant to most. Sorts n keys of d digits in O(d(n + k)), where k is the number of possible digit values.' },
      { name: 'Bucket sort', text: 'Distribute items into a fixed number of key ranges instead of one cell per key, then sort within each range. Handles fractional keys and expects them to be spread evenly.' },
    ],
    implementation: 'Check the range before allocating: if `hi − lo` is large compared with n, use another sort. Reuse the count array between calls when sorting many small batches. When the item type carries data beyond the key, move whole items in the placement pass and keep the pass in input order to preserve stability.',
    benchmarking: 'Operation counts on this site are exact and repeatable. When timing counting sort against comparison sorts, vary k as well as n. With k small enough for the count array to stay in the processor cache it is very hard to beat. As k grows past the cache size its advantage shrinks, and well before k reaches n log n it has usually disappeared.',
    references: [
      { authors: 'D. E. Knuth', year: 1998, title: 'The Art of Computer Programming, Volume 3: Sorting and Searching (2nd edition), section 5.2', venue: 'Addison-Wesley' },
      { authors: 'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein', year: 2009, title: 'Introduction to Algorithms (3rd edition), chapter 8, "Sorting in Linear Time"', venue: 'MIT Press' },
    ],
    furtherReading: [
      'R. Sedgewick and K. Wayne, *Algorithms* (4th edition), section 5.1, which develops string sorts from key-indexed counting.',
    ],
  },

  tests: [
    { name: 'sorts a random list with 4n + 2k writes and only range-scan comparisons', input: { size: 40, order: 'random', seed: 11 }, check: checkRun },
    { name: 'sorts a list with few distinct values', input: { size: 33, order: 'few', seed: 5 }, check: checkRun },
    { name: 'sorts a reversed list', input: { size: 25, order: 'reversed', seed: 2 }, check: checkRun },
    { name: 'the worked example: counts 2,1,3 and start positions 0,2,3', input: { custom: [3, 1, 3, 2, 1, 3] },
      check: (r, c) => (r.counts.join(',') === '2,1,3' && r.starts.join(',') === '0,2,3' && r.sorted.join(',') === '1,1,2,3,3,3' && c.comparisons === 10 && c.writes === 30) || `counts ${r.counts.join(',')}, starts ${r.starts.join(',')}, ${c.comparisons} comparisons, ${c.writes} writes` },
    { name: 'negative keys are offset by the minimum', input: { custom: [3, -1, 3, 0, -7, 3] },
      check: (r, c) => (r.sorted.join(',') === '-7,-1,0,3,3,3' && r.lo === -7 && r.k === 11 && checkRun(r, c) === true) || `got ${r.sorted.join(',')} with k = ${r.k}` },
    { name: 'the code sample input gives counts 2,0,1,1,0,1,3', input: { custom: [4, -2, 3, 0, 4, 1, -2, 4] },
      check: (r) => (r.counts.join(',') === '2,0,1,1,0,1,3' && r.sorted.join(',') === '-2,-2,0,1,3,4,4,4') || `counts ${r.counts.join(',')}` },
    { name: 'three values over a range of 999 cost 2010 writes', input: { custom: [500, 1, 999] },
      check: (r, c) => (r.k === 999 && c.writes === 2010 && r.sorted.join(',') === '1,500,999') || `k = ${r.k}, ${c.writes} writes` },
    { name: 'the marks preset costs 60 writes', input: { custom: [3, 6, 1, 4, 3, 5, 2, 6, 3, 1, 5, 3] },
      check: (r, c) => (r.k === 6 && c.writes === 60 && checkRun(r, c) === true) || `k = ${r.k}, ${c.writes} writes` },
    { name: '64 values use 126 comparisons, all in the range scan', input: { size: 64, order: 'few', seed: 7 },
      check: (r, c) => (c.comparisons === 126 && checkRun(r, c) === true) || `got ${c.comparisons} comparisons` },
    { name: 'all-equal keys need a single count cell', input: { custom: [5, 5, 5, 5] },
      check: (r, c) => (r.k === 1 && r.counts.join(',') === '4' && c.writes === 18) || `k = ${r.k}, ${c.writes} writes` },
    { name: 'a single value', input: { custom: [42] },
      check: (r, c) => (r.sorted.join(',') === '42' && !c.comparisons) || 'a one-element list should need no comparisons' },
  ],
};
