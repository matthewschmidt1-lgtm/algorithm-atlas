import { arrayInputs, resolveArray, isSorted, sameMultiset } from '../../js/lib/arrays.js';

const LEGEND = [
  { label: 'left half', role: 'moss' },
  { label: 'right half', role: 'sage' },
  { label: 'compared, not taken', role: 'compare' },
  { label: 'being copied', role: 'active' },
  { label: 'already in the buffer', role: 'visited' },
  { label: 'sorted', role: 'sorted' },
];

function run(input, t) {
  const a = resolveArray(input);
  const original = a.slice();
  const n = a.length;
  const buf = new Array(n).fill(0);
  let levels = 0, merges = 0;
  let finished = false;

  // filled = [from, to): the part of the buffer that currently holds merged values.
  const view = ({ lo, mid, hi, roles = {}, markers = [], filled = null, bufRoles = {} } = {}) => {
    const all = {};
    if (finished) for (let k = 0; k < n; k++) all[k] = 'sorted';
    else if (mid !== undefined) {
      for (let k = lo; k <= mid; k++) all[k] = 'moss';
      for (let k = mid + 1; k <= hi; k++) all[k] = 'sage';
    }
    Object.assign(all, roles);
    const shown = buf.map((v, k) => (filled && k >= filled[0] && k < filled[1] ? v : null));
    return [{ kind: 'bars', values: a.slice(), roles: all, markers, range: !finished && lo !== undefined ? [lo, hi] : undefined,
      aux: { label: 'buffer', values: shown, roles: bufRoles }, legend: LEGEND }];
  };

  const merge = (lo, mid, hi, depth) => {
    merges++;
    let i = lo, j = mid + 1, k = lo;
    t.frame(() => ({ line: [5, 8], note: `Merge the two sorted halves: positions ${lo} to ${mid} (left) and ${mid + 1} to ${hi} (right). Marker \`i\` is the front of the left half and \`j\` is the front of the right half. The smaller front value is copied into the buffer each time.`,
      views: view({ lo, mid, hi, markers: [{ index: i, label: 'i' }, { index: j, label: 'j' }] }), vars: { lo, mid, hi, depth } }));
    const taken = (extra) => {
      const roles = {};
      for (let x = lo; x < i; x++) roles[x] = 'visited';
      for (let x = mid + 1; x < j; x++) roles[x] = 'visited';
      return Object.assign(roles, extra);
    };
    while (i <= mid && j <= hi) {
      t.count('comparisons');
      const left = a[i] <= a[j];
      const ci = i, cj = j, from = left ? i : j;
      buf[k] = a[from];
      t.count('writes');
      t.frame(() => ({ line: left ? [10, 11] : [10, 13],
        note: `Compare the front of each half: ${a[ci]} on the left and ${a[cj]} on the right. ${a[ci] === a[cj] ? 'They are equal, so take the left one, which keeps equal values in their original order.' : `${a[from]} is smaller.`} Copy ${a[from]} into the buffer.`,
        views: view({ lo, mid, hi, roles: taken({ [ci]: left ? 'active' : 'compare', [cj]: left ? 'compare' : 'active' }),
          markers: [{ index: ci, label: 'i' }, { index: cj, label: 'j' }], filled: [lo, k + 1], bufRoles: { [k]: 'active' } }),
        vars: { lo, mid, hi, i: ci, j: cj, k } }));
      if (left) i++; else j++;
      k++;
    }
    while (i <= mid) {
      buf[k] = a[i];
      t.count('writes');
      const ci = i;
      t.frame(() => ({ line: 15, note: `The right half is used up, so no comparison is needed. Copy ${a[ci]} from the left half into the buffer.`,
        views: view({ lo, mid, hi, roles: taken({ [ci]: 'active' }), markers: [{ index: ci, label: 'i' }], filled: [lo, k + 1], bufRoles: { [k]: 'active' } }),
        vars: { lo, mid, hi, i: ci, k } }));
      i++; k++;
    }
    while (j <= hi) {
      buf[k] = a[j];
      t.count('writes');
      const cj = j;
      t.frame(() => ({ line: 16, note: `The left half is used up, so no comparison is needed. Copy ${a[cj]} from the right half into the buffer.`,
        views: view({ lo, mid, hi, roles: taken({ [cj]: 'active' }), markers: [{ index: cj, label: 'j' }], filled: [lo, k + 1], bufRoles: { [k]: 'active' } }),
        vars: { lo, mid, hi, j: cj, k } }));
      j++; k++;
    }
    for (let x = lo; x <= hi; x++) a[x] = buf[x];
    t.count('writes', hi - lo + 1);
    const top = lo === 0 && hi === n - 1;
    t.frame(() => {
      const roles = {};
      for (let x = lo; x <= hi; x++) roles[x] = 'active';
      return { line: 17, note: `The buffer holds the ${hi - lo + 1} values in order. Copy them back into positions ${lo} to ${hi}. ${top ? 'That was the last merge.' : 'This range is now sorted and ready to be merged with its neighbour.'}`,
        views: view({ lo, hi, roles, filled: [lo, hi + 1] }), vars: { lo, mid, hi, depth } };
    });
  };

  const sort = (lo, hi, depth) => {
    levels = Math.max(levels, depth);
    if (lo >= hi) {
      t.frame(() => ({ line: 1, note: `Position ${lo} holds a single value, ${a[lo]}. One value is already in order, so there is nothing to do.`, views: view({ lo, hi }), vars: { lo, hi, depth } }));
      return;
    }
    const mid = lo + ((hi - lo) >> 1);
    t.frame(() => ({ line: 2, note: `Split positions ${lo} to ${hi} into a left half, ${lo} to ${mid}, and a right half, ${mid + 1} to ${hi}. Each half is sorted separately before the two are merged.`,
      views: view({ lo, hi, markers: [{ index: lo, label: 'lo' }, { index: mid, label: 'mid' }, { index: hi, label: 'hi' }] }), vars: { lo, mid, hi, depth } }));
    sort(lo, mid, depth + 1);
    sort(mid + 1, hi, depth + 1);
    merge(lo, mid, hi, depth);
  };

  t.frame(() => ({ line: 0, note: `Start with ${n} values. Merge sort splits the list in half again and again until every piece is a single value, then merges the pieces back together in order. The row underneath is the buffer that each merge writes into.`, views: view() }));
  if (n > 0) sort(0, n - 1, 0);
  finished = true;
  t.frame(() => ({ line: null, note: `Sorted. ${merges} ${merges === 1 ? 'merge was' : 'merges were'} needed, arranged in ${levels} ${levels === 1 ? 'level' : 'levels'}.`, views: view() }));
  return { sorted: a, original, levels, merges };
}

// Independent bounds for the tests.
const log2ceil = (n) => Math.ceil(Math.log2(n));
const worstComparisons = (n) => (n <= 1 ? 0 : n * log2ceil(n) - 2 ** log2ceil(n) + 1);
const mergedSizes = (n) => (n <= 1 ? 0 : n + mergedSizes(Math.ceil(n / 2)) + mergedSizes(Math.floor(n / 2)));
const minComparisons = (n) => (n <= 1 ? 0 : Math.floor(n / 2) + minComparisons(Math.ceil(n / 2)) + minComparisons(Math.floor(n / 2)));

const checkRun = (r, c) => {
  if (!isSorted(r.sorted) || !sameMultiset(r.sorted, r.original)) return 'output is not a sorted permutation of the input';
  const n = r.original.length, comps = c.comparisons || 0;
  if (comps > worstComparisons(n)) return `${comps} comparisons exceed the worst-case bound ${worstComparisons(n)}`;
  if (comps < minComparisons(n)) return `${comps} comparisons are below the best-case bound ${minComparisons(n)}`;
  if ((c.writes || 0) !== 2 * mergedSizes(n)) return `expected ${2 * mergedSizes(n)} writes, got ${c.writes}`;
  return r.levels === (n <= 1 ? 0 : log2ceil(n)) || `expected ${log2ceil(n)} levels, got ${r.levels}`;
};

export default {
  meta: {
    id: 'merge-sort',
    name: 'Merge Sort',
    aliases: ['mergesort', 'top-down merge sort', 'two-way merge sort'],
    kind: 'algorithm',
    discipline: 'algorithms',
    alsoIn: [],
    subfield: 'Sorting',
    family: 'Comparison sorts',
    lab: 'sorting-searching',
    compareGroup: 'sorting',
    year: 1945,
    authors: 'John von Neumann',
    summary: 'Sorts by splitting the list in half, sorting each half, and merging the two sorted halves. Stable, guaranteed O(n log n), at the cost of O(n) extra memory.',
    difficulty: 'intermediate',
    order: 130,
    paradigms: ['divide-and-conquer'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', class: 'linearithmic' },
    space: { worst: 'O(n)', class: 'linear' },
    tags: {
      problems: ['sort a list', 'put numbers in order', 'sort a large file', 'sort records without disturbing ties', 'combine two sorted lists', 'count inversions'],
      techniques: ['merging', 'recursion', 'auxiliary buffer', 'stable sorting'],
      applications: ['standard libraries', 'databases', 'data processing', 'distributed systems'],
    },
    prerequisites: ['concept:recursion', 'concept:divide-and-conquer', 'concept:array', 'concept:big-o', 'insertion-sort'],
  },

  bigIdea: {
    simple: "Merge sort is a way to put a list in order by splitting one big job into smaller jobs. It rests on one easy trick. Suppose you have two piles of cards, and each pile is already in order. You can combine them into a single ordered pile quickly. Look at the top card of each pile, take the smaller one, and repeat until both piles are gone. That is called merging. Merge sort uses this trick again and again. Cut the list in half. Cut each half in half, and keep cutting until every piece is a single item. A single item is already in order. Now merge the pieces in pairs to make ordered pieces of two. Merge those to make ordered pieces of four, and carry on until one ordered list remains. Merge sort does about the same amount of work whatever order the list starts in, so no input can catch it out.",
    what: 'Merge sort splits the list into two halves, sorts each half by the same method, and then merges the two sorted halves into one. Merging walks along both halves at once, repeatedly copying the smaller of the two front values into a spare buffer. Halves of one value need no sorting, which is where the splitting stops.',
    why: 'Merging two sorted lists is cheap: one pass, at most one comparison per value. Merge sort turns that into a full sorting method with a running time that is the same, to within a factor of two, for every input. It reads and writes data strictly in sequence, which made it the natural method for the tape drives of early computers and keeps it the natural method for data on disk today.',
    when: 'Choose merge sort when you need a guaranteed running time, when equal items must keep their original order, when the data is a linked list, or when it is too large to fit in memory. If extra memory is tight and stability does not matter, [quick sort](#/algorithm/quick-sort) or [heap sort](#/algorithm/heap-sort) sort in place. For very short lists, [insertion sort](#/algorithm/insertion-sort) is faster.',
    interesting: 'All the comparing happens while putting pieces back together. The splitting is only arithmetic on positions and looks at no values at all. [Quick sort](#/algorithm/quick-sort) is the mirror image: it does all its comparing while splitting, and putting the pieces back together costs nothing.',
    where: 'Python\'s built-in sort and Java\'s sort for arrays of objects are Timsort, a merge sort that takes advantage of stretches already in order. Database systems and command-line sorting tools use merging to sort files larger than memory.',
    analogy: {
      title: 'Two sorted stacks of exam papers',
      text: 'Two teachers each hold a stack of exam papers sorted by student name. To combine them, they look at the top paper of each stack, move whichever name comes first onto a new stack, and repeat. Nobody ever looks below the top of a stack, and the new stack comes out fully sorted. If the original stacks were not sorted, each teacher could split theirs in two, hand the halves to helpers, and merge what comes back.',
      limits: 'The desk in this picture has room for a third stack. A computer has to set that room aside: merge sort needs spare memory as large as the list it is sorting. The helpers in the picture also work at the same time, while the algorithm on this page finishes one half completely before it starts the other. And the picture stops at a few helpers, where the algorithm keeps splitting all the way down to single papers.',
    },
  },

  example: {
    setup: 'Sort the four numbers 5, 2, 4, 1 from smallest to largest. To merge two ordered groups, compare their front numbers and take the smaller, until both groups are used up.',
    steps: [
      'Split the list into a left half, 5, 2, and a right half, 4, 1. Work on the left half first.',
      'Split 5, 2 into 5 and 2. A single number is already in order. Merge them: compare 5 with 2, take the 2, then take the 5 that is left. The left half is now 2, 5. That took 1 comparison.',
      'Do the same to the right half: split 4, 1 into 4 and 1, compare them, take the 1 and then the 4. The right half is now 1, 4. That took 1 comparison.',
      'Merge 2, 5 with 1, 4. Compare the fronts 2 and 1: take 1. Compare 2 and 4: take 2. Compare 5 and 4: take 4. The right half is used up, so take the 5 without comparing. That took 3 comparisons.',
    ],
    result: 'The list is 1, 2, 4, 5 after 5 comparisons. Each number was copied into a merged group twice, once for each level of merging. Doubling the length of the list adds one more level.',
    tryInput: { custom: [5, 2, 4, 1] },
  },

  terms: [
    { term: 'Sorting', meaning: 'Rearranging a list so that its items are in order, for example from smallest to largest.' },
    { term: 'Merge', meaning: 'Combining two lists that are each already in order into one ordered list, by repeatedly taking the smaller of their two front items.' },
    { term: 'Comparison', meaning: 'One question of the form: is this item no larger than that one? Counting comparisons is how we measure the work a sort does.' },
    { term: 'Recursion', meaning: 'Solving a problem by using the same method on smaller pieces of it, until the pieces are too small to need any work.' },
    { term: 'Divide and conquer', meaning: 'A way of designing methods: split the problem into parts, solve each part, then combine the answers.' },
    { term: 'Buffer', meaning: 'Spare memory used as working space. Merge sort writes each merged result into a buffer before copying it back.' },
    { term: 'Stable', meaning: 'A sort is stable if items of equal value come out in the same order they went in.' },
  ],

  takeaway: 'Split the list in half, sort each half the same way, then merge the two sorted halves by always taking the smaller front item.',

  viz: {
    describe: 'A row of bars, one per value, with a second, shorter row underneath for the buffer. A shaded band marks the range being worked on. During a merge the left half is moss green and the right half is sage. Of the two front values being compared, the one that is taken is terracotta and the other is ochre, and the taken value appears in the buffer. Values already copied to the buffer turn pale. When the buffer is copied back the whole range is terracotta, and at the end every bar is forest green.',
    inputs: arrayInputs({ size: 12 }),
    presets: [
      { label: 'Random list', values: { order: 'random', custom: [] } },
      { label: 'Already sorted', values: { order: 'sorted', custom: [] } },
      { label: 'Sorted, 8 values', values: { custom: [1, 2, 3, 4, 5, 6, 7, 8] } },
      { label: 'Worst case, 8 values', values: { custom: [1, 5, 3, 7, 2, 6, 4, 8] } },
    ],
    tryThis: [
      'Load "Sorted, 8 values" and then "Worst case, 8 values". The first costs 12 comparisons and the second 17, the most any list of 8 can cost. The array writes are 48 both times. Compare that narrow range with what a reversed list does to bubble sort or insertion sort.',
      'Watch one merge closely. Count how often a value is copied to the buffer without a comparison. That happens only after one half is used up, and it is the entire reason some inputs are cheaper than others.',
      'Set the number of items to 16, then 32, with any starting order. The array writes go from 128 to 320: a little more than double, because doubling the list adds one more level of merging.',
    ],
    run,
    report: (r, c) => `Sorted ${r.sorted.length} values with ${c.comparisons || 0} comparisons and ${c.writes || 0} array writes (half into the buffer, half back), in ${r.merges} merges over ${r.levels} levels.\n[${r.sorted.join(', ')}]`,
    experiment: {
      title: 'Comparisons as the list grows',
      note: 'Each point is a real run of this page\'s implementation. Random input lands just under the worst-case curve. Already sorted input is the best case, because one half of every merge is used up as early as possible. The two differ by less than a factor of two at every size.',
      metric: 'comparisons',
      metricLabel: 'Comparisons',
      sizeLabel: 'Number of items (n)',
      sizes: [8, 16, 32, 64, 128, 256, 512],
      variants: [
        { id: 'random', label: 'Random order' },
        { id: 'sorted', label: 'Already sorted' },
      ],
      input: (n, variant, seed) => ({ size: n, order: variant, seed, custom: [] }),
      theory: [
        { label: 'n log₂ n − n + 1 (worst case)', fn: (n) => n * Math.log2(n) - n + 1, variant: 'random' },
        { label: '(n/2) log₂ n (best case)', fn: (n) => (n / 2) * Math.log2(n), variant: 'sorted' },
      ],
    },
  },

  logic: {
    intuition: 'Two sorted lists can be combined in a single pass, because the smallest value not yet taken must be at the front of one of them. So if both halves of a list were sorted, one cheap pass would finish the job. Sorting each half is the same problem at half the size, and halving can only be repeated about log₂ n times before the pieces are single values.',
    steps: [
      'If the range holds zero or one value, it is already sorted. Stop.',
      'Find the middle of the range and split it into a left half and a right half.',
      'Sort the left half with the same procedure.',
      'Sort the right half with the same procedure.',
      'Merge: keep a marker at the front of each half. Compare the two marked values, copy the smaller into the buffer and advance its marker. On a tie, take the value from the left half.',
      'When one half is used up, copy what remains of the other half into the buffer.',
      'Copy the buffer back over the range.',
    ],
    pseudocode: [
      'merge_sort(A, lo, hi):',
      '  if lo ≥ hi: return',
      '  mid ← ⌊(lo + hi) / 2⌋',
      '  merge_sort(A, lo, mid)',
      '  merge_sort(A, mid + 1, hi)',
      '  merge(A, lo, mid, hi)',
      '',
      'merge(A, lo, mid, hi):',
      '  i ← lo, j ← mid + 1, k ← lo',
      '  while i ≤ mid and j ≤ hi:',
      '    if A[i] ≤ A[j]:',
      '      B[k] ← A[i], i ← i + 1',
      '    else:',
      '      B[k] ← A[j], j ← j + 1',
      '    k ← k + 1',
      '  copy rest of A[i..mid] to B',
      '  copy rest of A[j..hi] to B',
      '  copy B[lo..hi] into A',
    ],
    decisions: [
      { title: 'Which value wins a tie?', text: 'The one from the left half. Everything in the left half came before everything in the right half in the original list, so taking from the left on a tie keeps equal values in their original order. Writing `<` instead of `≤` silently makes the sort unstable.' },
      { title: 'Top-down or bottom-up?', text: 'This lesson splits recursively from the top. The bottom-up form skips the recursion: merge neighbouring runs of length 1, then 2, then 4, and so on. Both do the same merges on a list whose length is a power of two.' },
      { title: 'Where does the merged output go?', text: 'Into a second array of the same length, allocated once and reused by every merge. Merging in place without a buffer is possible, but the known methods are intricate and slower in practice.' },
      { title: 'When to stop splitting?', text: 'In principle at single values. Practical versions stop at small ranges and sort those with insertion sort, which has less overhead on a handful of items.' },
    ],
    invariants: [
      'When `merge` is called, `A[lo..mid]` and `A[mid+1..hi]` are each sorted.',
      'During the merge, `B[lo..k−1]` holds the `k − lo` smallest values of the range in sorted order, and they are exactly the values to the left of `i` and of `j`.',
      'Every value in `B[lo..k−1]` is less than or equal to every value not yet taken.',
    ],
    edgeCases: [
      'An empty list or a single value: the base case returns at once.',
      'An odd number of values: the halves differ in length by one, and nothing else changes.',
      'Equal values: ties are taken from the left half, so the sort is stable.',
      'Already sorted or reversed input: one half is used up after the fewest possible comparisons, which is the best case, not a special case.',
      'Computing the middle as `(lo + hi) / 2` can overflow fixed-width integers on very large arrays. `lo + (hi − lo) / 2` avoids that.',
    ],
    correctness: 'By induction on the size of the range. A range of zero or one value is sorted. For a larger range, both halves are strictly smaller, so by the induction hypothesis each is sorted after its recursive call. The merge then maintains this invariant: the values copied so far are the smallest values of the range, in order. The next value copied is the smaller of the two fronts, and each front is the smallest remaining value of its own sorted half, so it is the smallest remaining value overall. When one half is empty, the rest of the other half is already in order and no smaller than anything copied. So the buffer ends up holding the whole range in sorted order, and copying it back sorts the range.',
    mistakes: [
      'Recursing on `(lo, mid)` and `(mid, hi)` with inclusive bounds. The second call never shrinks a two-value range, so the recursion never ends.',
      'Forgetting to copy the leftover values after the main loop. The result then loses the tail of one half.',
      'Using `<` where `≤` belongs, which takes from the right half on ties and breaks stability.',
      'Allocating a new buffer inside every call to `merge`. It works, but it spends more time on memory management than on sorting.',
    ],
  },

  code: {
    sample: {
      input: 'The list [29, 10, 14, 37, 13, 5, 31, 22]',
      expected: '5 10 13 14 22 29 31 37',
    },
    python: {
      source: `def merge(a, lo, mid, hi, buf):
    i, j, k = lo, mid + 1, lo
    while i <= mid and j <= hi:
        if a[i] <= a[j]:
            buf[k] = a[i]
            i += 1
        else:
            buf[k] = a[j]
            j += 1
        k += 1
    while i <= mid:
        buf[k] = a[i]
        i += 1
        k += 1
    while j <= hi:
        buf[k] = a[j]
        j += 1
        k += 1
    for k in range(lo, hi + 1):
        a[k] = buf[k]


def merge_sort(a, lo, hi, buf):
    if lo >= hi:
        return
    mid = (lo + hi) // 2
    merge_sort(a, lo, mid, buf)
    merge_sort(a, mid + 1, hi, buf)
    merge(a, lo, mid, hi, buf)


data = [29, 10, 14, 37, 13, 5, 31, 22]
merge_sort(data, 0, len(data) - 1, [0] * len(data))
print(" ".join(str(x) for x in data))`,
      notes: [
        { line: 4, text: 'The only comparison in the algorithm. The `<=` takes the left value on a tie, which is what makes the sort stable.' },
        { line: 11, text: 'At most one of these two loops does anything: once one half is used up, the rest of the other is copied without comparing.' },
        { line: 19, text: 'The merged values are copied back so that the caller finds the range sorted in the original list.' },
        { line: 28, text: 'The right half starts at `mid + 1`. Starting it at `mid` would make a two-value range call itself forever.' },
        { line: 33, text: 'One buffer, the same length as the list, is created once and shared by every merge.' },
      ],
    },
    javascript: {
      source: `function merge(a, lo, mid, hi, buf) {
  let i = lo, j = mid + 1, k = lo;
  while (i <= mid && j <= hi) {
    if (a[i] <= a[j]) {
      buf[k] = a[i];
      i++;
    } else {
      buf[k] = a[j];
      j++;
    }
    k++;
  }
  while (i <= mid) buf[k++] = a[i++];
  while (j <= hi) buf[k++] = a[j++];
  for (k = lo; k <= hi; k++) a[k] = buf[k];
}

function mergeSort(a, lo, hi, buf) {
  if (lo >= hi) return;
  const mid = lo + Math.floor((hi - lo) / 2);
  mergeSort(a, lo, mid, buf);
  mergeSort(a, mid + 1, hi, buf);
  merge(a, lo, mid, hi, buf);
}

const data = [29, 10, 14, 37, 13, 5, 31, 22];
mergeSort(data, 0, data.length - 1, new Array(data.length).fill(0));
console.log(data.join(" "));`,
    },
    cpp: {
      source: `#include <iostream>
#include <vector>

void merge(std::vector<int>& a, int lo, int mid, int hi, std::vector<int>& buf) {
    int i = lo, j = mid + 1, k = lo;
    while (i <= mid && j <= hi) {
        if (a[i] <= a[j]) {
            buf[k] = a[i];
            ++i;
        } else {
            buf[k] = a[j];
            ++j;
        }
        ++k;
    }
    while (i <= mid) buf[k++] = a[i++];
    while (j <= hi) buf[k++] = a[j++];
    for (k = lo; k <= hi; ++k) a[k] = buf[k];
}

void mergeSort(std::vector<int>& a, int lo, int hi, std::vector<int>& buf) {
    if (lo >= hi) return;
    int mid = lo + (hi - lo) / 2;
    mergeSort(a, lo, mid, buf);
    mergeSort(a, mid + 1, hi, buf);
    merge(a, lo, mid, hi, buf);
}

int main() {
    std::vector<int> data = {29, 10, 14, 37, 13, 5, 31, 22};
    std::vector<int> buf(data.size());
    mergeSort(data, 0, static_cast<int>(data.size()) - 1, buf);
    for (std::size_t k = 0; k < data.size(); ++k) {
        std::cout << data[k] << (k + 1 < data.size() ? " " : "\\n");
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Halving a list of n values down to single values takes about log₂ n rounds of splitting, so there are about log₂ n levels of merging. Every value is copied once per level, and each copy costs at most one comparison. That gives at most n log₂ n comparisons and exactly the same amount of copying on every input.',
    cases: [
      { case: 'Best', time: 'O(n log n)', when: 'In every merge one half is used up as early as possible, as with sorted or reversed input. About (n/2) log₂ n comparisons.' },
      { case: 'Average', time: 'O(n log n)', when: 'Random order. Slightly fewer comparisons than the worst case.' },
      { case: 'Worst', time: 'O(n log n)', when: 'Every merge alternates between its halves to the end. Exactly n log₂ n − n + 1 comparisons when n is a power of two.' },
    ],
    space: 'O(n) for the buffer, plus O(log n) for the recursion stack. The buffer is the main cost of choosing merge sort over an in-place sort.',
    memory: 'Each merge reads two runs front to back and writes one run front to back. Sequential access suits processor caches, disks and network streams, and it is all a linked list can offer. The price is that every value is moved at every level, whether or not it needed to move.',
    tradeoffs: 'Merge sort trades memory for guarantees. Compared with quick sort it uses a buffer of n values and typically moves more data, but it cannot be driven to quadratic time and it is stable. Compared with heap sort it uses more memory but is stable and accesses memory in order. It also makes close to the fewest comparisons any comparison sort can, which matters when comparing two items is expensive.',
    assumptions: [
      'Comparing two values and copying a value each take constant time.',
      'A buffer of n values is available.',
      'The exact comparison counts quoted are for lists whose length is a power of two. For other lengths the worst case is n⌈log₂ n⌉ − 2^⌈log₂ n⌉ + 1.',
      'Array writes on this page count both the copy into the buffer and the copy back, so each merge of m values costs 2m writes.',
    ],
  },

  tradeoffs: {
    excels: [
      'Workloads that need a guaranteed O(n log n) whatever the input.',
      'Stable sorting, for example sorting records by one field while keeping an earlier order among ties.',
      'Linked lists and data on disk or tape, where only sequential access is cheap.',
      'Items that are expensive to compare, because it makes few comparisons.',
      'Parallel sorting: the two halves are independent and can be sorted at the same time.',
    ],
    struggles: [
      'Memory-constrained settings, because of the buffer of n values.',
      'Short lists, where the overhead of recursion and copying outweighs its good growth rate.',
      'Arrays of small values such as integers, where quick sort usually wins on real hardware because it moves less data.',
    ],
    pitfalls: [
      'Off-by-one errors in the split that make a range fail to shrink.',
      'Dropping the leftover values of one half after the main merge loop.',
      'Breaking stability with a strict comparison.',
      'Allocating a fresh buffer for every merge.',
    ],
    misunderstandings: [
      '"The splitting is what sorts the list." Splitting only chooses positions and compares nothing. Every comparison happens during merging.',
      '"Merge sort works inside the original list, so it needs no extra memory." Each merge writes its output somewhere else first. The standard version needs spare room for as many values as the list holds.',
      '"It finishes quickly on a list that is already sorted." It saves at most half of the comparisons and none of the copying. The plain version cannot notice that the list is sorted. Natural merge sort and Timsort are variants that can.',
      '"Merge sort is slower than quick sort." Often true for arrays of numbers, and often false when comparisons are costly or the data is nearly ordered. Neither is faster in every setting.',
    ],
    constraints: [
      'Library versions switch to insertion sort for small ranges and often skip a merge entirely when the last value of the left half is no larger than the first value of the right half.',
      'For data larger than memory, the merge step is generalized to combine many sorted runs at once, to reduce the number of passes over the data.',
    ],
    alternatives: [
      { id: 'quick-sort', name: 'Quick Sort', when: 'You are sorting arrays in memory, extra space is limited and stability is not needed.' },
      { id: 'heap-sort', name: 'Heap Sort', when: 'You need guaranteed O(n log n) with O(1) extra space and do not need stability.' },
      { id: 'insertion-sort', name: 'Insertion Sort', when: 'The list is short or already nearly sorted.' },
      { id: 'counting-sort', name: 'Counting Sort', when: 'The keys are integers from a small range. It is stable and runs in linear time.' },
    ],
    comparison: {
      columns: ['', 'Merge sort', 'Quick sort', 'Heap sort'],
      rows: [
        ['Worst-case time', 'O(n log n)', 'O(n²)', 'O(n log n)'],
        ['Average time', 'O(n log n)', 'O(n log n)', 'O(n log n)'],
        ['Extra space', 'O(n)', 'O(log n) stack', 'O(1)'],
        ['Stable', 'Yes', 'No', 'No'],
        ['Memory access pattern', 'Sequential scans', 'Sequential scans', 'Scattered'],
        ['Works on linked lists and files', 'Yes', 'Poorly', 'No'],
      ],
    },
  },

  applications: [
    { title: 'Stable library sorts', status: 'established', text: 'Timsort, designed by Tim Peters for Python in 2002 and later adopted by Java for arrays of objects, is a merge sort that detects runs already in order and merges them. C++ `std::stable_sort` is typically a merge sort as well.' },
    { title: 'Sorting data larger than memory', status: 'established', text: 'External sorting reads as much data as fits in memory, sorts it, and writes it out as a sorted run. The runs are then merged, many at a time, using only sequential reads and writes. Database systems sort large tables this way.' },
    { title: 'Sorting linked lists', status: 'established', text: 'Merging relinks nodes instead of copying them, so a linked list can be merge sorted with no buffer at all and without the random access that quick sort and heap sort depend on.' },
    { title: 'Counting inversions', status: 'established', text: 'A small change to the merge step counts the pairs of values that are out of order in O(n log n) time, instead of the O(n²) of checking every pair. Rank statistics such as Kendall\'s tau are computed this way on large samples.' },
  ],

  connections: [
    { to: 'quick-sort', type: 'same-problem', why: 'Both are divide-and-conquer sorts. Merge sort splits trivially and does its work when combining; quick sort does its work when splitting and combines trivially.' },
    { to: 'heap-sort', type: 'same-problem', why: 'Both guarantee O(n log n) comparisons on every input. Merge sort pays for that with a buffer and stays stable; heap sort pays nothing in memory and gives up stability.' },
    { to: 'insertion-sort', type: 'prerequisite', why: 'Practical merge sorts hand small ranges to insertion sort, and Timsort uses it to build the runs that merging then combines.' },
    { to: 'binary-search', type: 'related', why: 'Both rely on halving. A range of n values can be halved only about log₂ n times, which bounds the steps of binary search and the levels of merge sort alike.' },
    { to: 'concept:divide-and-conquer', type: 'prerequisite', why: 'Merge sort is the standard first example of the paradigm: split into two half-sized problems, solve each, and combine the answers in linear time.' },
    { to: 'concept:recurrence', type: 'advanced', why: 'Its running time satisfies T(n) = 2T(n/2) + n, the recurrence whose solution n log n is the model for analysing divide-and-conquer algorithms.' },
    { to: 'concept:stability', type: 'related', why: 'Taking the left value on ties means equal values never cross, so a merge of two stable halves is stable.' },
    { to: 'concept:lower-bound', type: 'advanced', why: 'No comparison sort can use fewer than about n log₂ n − 1.44n comparisons in the worst case. Merge sort\'s worst case is within a fraction of n of that bound.' },
    { to: 'discipline:distributed-systems', type: 'application', why: 'Sorted runs produced on separate disks or machines are combined by merging, which needs only one sequential pass over each run.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'In merge sort, when are values compared with each other?',
      options: ['Only while splitting the list', 'Only while merging', 'During both splitting and merging', 'Only at the single-value base case'],
      answer: 1,
      explain: [
        'Splitting computes a middle position. It never looks at the values.',
        'Correct. Every comparison is between the front values of two sorted halves during a merge.',
        'Splitting is pure index arithmetic, so all the comparisons belong to merging.',
        'A single value has nothing to be compared with.',
      ],
    },
    {
      type: 'predict',
      q: 'The list 1, 2, 3, 4, 5, 6, 7, 8 is already sorted. How many comparisons will merge sort make?',
      options: ['7', '12', '17', '28'],
      answer: 1,
      explain: [
        '7 is what a sort that checks neighbours once would need. Merge sort cannot notice that the list is sorted, so it still performs every merge.',
        'Correct. There are four merges of 1 + 1 values costing 1 comparison each, two merges of 2 + 2 costing 2 each, and one merge of 4 + 4 costing 4. In each the left half runs out first.',
        '17 is the worst case for eight values, reached when every merge alternates between its halves to the end.',
        '28 is the cost of comparing every pair, which is what the quadratic sorts do in their worst case.',
      ],
      tryInput: { custom: [1, 2, 3, 4, 5, 6, 7, 8] },
    },
    {
      type: 'debug',
      q: 'This version never returns when given a list of two values. Which line is wrong?',
      code: `def merge_sort(a, lo, hi, buf):
    if lo >= hi:
        return
    mid = (lo + hi) // 2
    merge_sort(a, lo, mid, buf)
    merge_sort(a, mid, hi, buf)
    merge(a, lo, mid, hi, buf)`,
      options: ['Line 2: the base case should be lo > hi', 'Line 4: mid should be rounded up', 'Line 6: the right half should start at mid + 1', 'Line 7: merge should be called before the recursive calls'],
      answer: 2,
      explain: [
        'A one-value range needs no work either, so `lo >= hi` is the right test.',
        'Rounding up would move the fault to line 5: the call on `(lo, mid)` would then be the whole range again.',
        'Correct. With `lo = 0` and `hi = 1`, `mid` is 0, so line 6 calls `merge_sort(a, 0, 1, buf)`: the same range again, forever.',
        'Merging before the halves are sorted would merge unsorted data and give a wrong result.',
      ],
    },
    {
      type: 'choice',
      q: 'A list has 16 values. How many levels of merging does merge sort need, and how many values does each level copy into the buffer?',
      options: ['16 levels, 1 value each', '4 levels, 16 values each', '8 levels, 2 values each', '2 levels, 8 values each'],
      answer: 1,
      explain: [
        'That would be 16 copies in total, far too few. Every value is copied at every level.',
        'Correct. Sixteen can be halved four times (16, 8, 4, 2, 1), so there are four levels, and each level merges all 16 values. That is the n log₂ n in the running time.',
        'There are 8 merges at the lowest level, but they all belong to one level.',
        'Two levels would only build sorted runs of four values.',
      ],
    },
    {
      type: 'challenge',
      title: 'Count inversions while sorting',
      prompt: 'An inversion is a pair of positions i < j whose values are out of order. Bubble sort and insertion sort each move a value once per inversion, which is why they are quadratic. Modify the merge step so that merge sort returns the number of inversions in its input. Check your answer against a brute-force count over all pairs on a few random lists, and confirm that the reversed list of 8 distinct values has 28.',
      hints: ['Inversions inside the left half and inside the right half are counted by the recursive calls. Only pairs with one value in each half are left.', 'When the merge takes a value from the right half, every value still waiting in the left half is larger than it. How many are there?'],
    },
  ],

  compare: {
    idea: 'Sort each half, then merge the two sorted halves.',
    requires: 'Any list whose items can be compared, plus spare room for a copy of the list. It is always correct.',
    sensitivity: 'Low. Between about (n/2) log₂ n and n log₂ n comparisons, and the same number of writes on every input.',
    memory: 'O(n) buffer plus an O(log n) recursion stack.',
    difficulty: 'moderate',
    difficultyNote: 'The idea is simple. The index arithmetic of the split and the leftover values in the merge are where bugs hide.',
    limits: 'It needs spare memory as large as the list. It is no faster on a list already in order unless adapted.',
    useWhen: 'Equal items must keep their order, the running time must be dependable, or the data sits in a file too big for memory.',
  },

  advanced: {
    history: 'Merge sort is one of the first sorting methods designed for a stored-program computer. According to Donald Knuth, John von Neumann wrote a merge sorting program for the EDVAC in 1945, and Knuth\'s 1970 article on that manuscript calls it von Neumann\'s first computer program. Merging itself was already familiar from punched-card equipment. Because merging needs only sequential access, it dominated the era of magnetic tape, and a large part of the sorting chapter of *The Art of Computer Programming* is devoted to tape merging patterns. In 2002 Tim Peters wrote Timsort, a merge sort tuned for partly ordered data, for Python.',
    derivation: 'Let $T(n)$ be the number of comparisons in the worst case. A merge of $n$ values makes at most $n-1$ comparisons, because each comparison copies one value and the last value is copied without one. So, for $n$ a power of two,\n\n$$T(n) = 2\\,T(n/2) + (n - 1), \\qquad T(1) = 0.$$\n\nUnrolling the recurrence, level $\\ell$ (counting from the top, starting at 0) has $2^\\ell$ merges of $n/2^\\ell$ values each and costs $n - 2^\\ell$. Summing over the $\\log_2 n$ levels:\n\n$$T(n) = \\sum_{\\ell=0}^{\\log_2 n - 1} \\left(n - 2^\\ell\\right) = n\\log_2 n - (n - 1) = n\\log_2 n - n + 1.$$\n\nIn the best case a merge of two halves of $n/2$ values makes $n/2$ comparisons, giving $\\tfrac{n}{2}\\log_2 n$ in total.',
    proof: 'Correctness of the merge. Let $L = A[lo..mid]$ and $R = A[mid+1..hi]$ be sorted. Invariant: $B[lo..k-1]$ contains the $k - lo$ smallest values of $L \\cup R$ in sorted order, namely $L$ before index $i$ and $R$ before index $j$. Initially it is empty. At each step the smallest value not yet copied is $A[i]$ or $A[j]$, since each is the minimum of what remains of its own sorted half; the algorithm copies the smaller, which is at least as large as everything already in $B$. When one half is exhausted the remainder of the other is sorted and is copied in order. So at the end $B[lo..hi]$ is $L \\cup R$ sorted.\n\nStability. If $A[i] = A[j]$ the value from $L$ is copied first, and every value of $L$ preceded every value of $R$ in the input to the merge. By induction on the range size, equal values keep their original relative order.\n\nCorrectness of the sort then follows by strong induction on $hi - lo$.',
    complexityProof: 'Any comparison sort can be drawn as a binary decision tree with at least $n!$ leaves, one for each possible ordering of the input, so its worst case needs at least $\\lceil \\log_2 n! \\rceil$ comparisons. By Stirling\'s approximation $\\log_2 n! = n\\log_2 n - n\\log_2 e + O(\\log n) \\approx n\\log_2 n - 1.44\\,n$. Merge sort\'s worst case, $n\\log_2 n - n + 1$ for powers of two, exceeds this by about $0.44\\,n$, so it is optimal up to a lower-order term. Its total running time is $\\Theta(n\\log n)$ in every case, because the copying alone is $2n$ writes per level over $\\lceil \\log_2 n \\rceil$ levels.',
    variants: [
      { name: 'Bottom-up merge sort', text: 'Merges runs of length 1, 2, 4, and so on in passes over the whole array, with no recursion.' },
      { name: 'Natural merge sort', text: 'Starts from the runs that already exist in the input instead of from single values, so sorted input costs one pass.' },
      { name: 'Timsort', text: 'A natural merge sort that extends short runs with insertion sort, keeps run lengths balanced with a stack, and speeds up merges in which one run keeps winning.' },
      { name: 'Multiway (k-way) merge', text: 'Merges many runs at once, choosing the smallest front value with a heap or tournament tree. The standard tool for external sorting.' },
      { name: 'Parallel merge sort', text: 'Sorts the two halves on different processors. With a parallel merge step the whole sort scales well across cores.' },
    ],
    implementation: 'Allocate the buffer once. Switch to insertion sort below a small cutoff. Before merging, test whether `A[mid] ≤ A[mid + 1]` and skip the merge if so, which makes sorted input linear. The copy back can be avoided by alternating the roles of the two arrays at each level of the recursion.',
    benchmarking: 'Operation counts on this site are exact and repeatable. In timed comparisons with quick sort, the outcome depends on the cost of a comparison relative to a move, on the element size, and on how ordered the input is, so report those conditions with any result.',
    references: [
      { authors: 'D. E. Knuth', year: 1998, title: 'The Art of Computer Programming, Volume 3: Sorting and Searching (2nd edition), section 5.2.4', venue: 'Addison-Wesley' },
      { authors: 'D. E. Knuth', year: 1970, title: 'Von Neumann\'s first computer program', venue: 'ACM Computing Surveys 2(4), 247-260' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Getting Started", section on designing algorithms.',
      'R. Sedgewick and K. Wayne, *Algorithms* (4th edition), section 2.2.',
    ],
  },

  tests: [
    { name: 'sorts a random list within the comparison bounds', input: { size: 40, order: 'random', seed: 11 }, check: checkRun },
    { name: 'sorts a list with few distinct values', input: { size: 33, order: 'few', seed: 5 }, check: checkRun },
    { name: 'sorts a reversed list of odd length', input: { size: 25, order: 'reversed', seed: 2 }, check: checkRun },
    { name: 'the worked example costs 5 comparisons', input: { custom: [5, 2, 4, 1] },
      check: (r, c) => (c.comparisons === 5 && c.writes === 16 && r.levels === 2 && r.sorted.join(',') === '1,2,4,5') || `got ${c.comparisons} comparisons and ${c.writes} writes` },
    { name: 'a sorted list of 8 costs 12 comparisons and 48 writes', input: { custom: [1, 2, 3, 4, 5, 6, 7, 8] },
      check: (r, c) => (c.comparisons === 12 && c.writes === 48) || `got ${c.comparisons} comparisons and ${c.writes} writes` },
    { name: 'the worst case for 8 values costs 17 comparisons and 48 writes', input: { custom: [1, 5, 3, 7, 2, 6, 4, 8] },
      check: (r, c) => (c.comparisons === 17 && c.writes === 48 && checkRun(r, c) === true) || `got ${c.comparisons} comparisons and ${c.writes} writes` },
    { name: '16 values: 4 levels and 128 writes', input: { size: 16, order: 'random', seed: 7 },
      check: (r, c) => (r.levels === 4 && c.writes === 128) || `got ${r.levels} levels and ${c.writes} writes` },
    { name: '32 values: 5 levels and 320 writes', input: { size: 32, order: 'nearly', seed: 7 },
      check: (r, c) => (r.levels === 5 && c.writes === 320) || `got ${r.levels} levels and ${c.writes} writes` },
    { name: 'handles duplicates and negatives', input: { custom: [3, -1, 3, 0, -7, 3] },
      check: (r, c) => (r.sorted.join(',') === '-7,-1,0,3,3,3' && checkRun(r, c) === true) || `got ${r.sorted.join(',')}` },
    { name: 'a single value needs no comparisons', input: { custom: [42] },
      check: (r, c) => (r.sorted.join(',') === '42' && !c.comparisons && !c.writes) || 'a one-element list should cost nothing' },
  ],
};
