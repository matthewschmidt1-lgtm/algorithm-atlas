import { arrayInputs, resolveArray, isSorted, sameMultiset } from '../../js/lib/arrays.js';
import { makeRng } from '../../js/lib/rng.js';

const PIVOTS = [
  { value: 'last', label: 'Last element' },
  { value: 'median3', label: 'Median of three' },
  { value: 'random', label: 'Random element' },
];

function run(input, t) {
  const a = resolveArray(input);
  const original = a.slice();
  const n = a.length;
  const rng = makeRng((input.seed || 1) + 101);
  const fixed = new Set();
  let maxDepth = 0;

  const view = (roles = {}, markers = [], range) => {
    const all = {};
    for (const k of fixed) all[k] = 'sorted';
    Object.assign(all, roles);
    return [{ kind: 'bars', values: a.slice(), roles: all, markers, range,
      legend: [{ label: 'pivot', role: 'pivot' }, { label: 'being compared', role: 'compare' }, { label: 'swapped', role: 'swap' }, { label: 'final position', role: 'sorted' }] }];
  };
  const swap = (i, j) => { const x = a[i]; a[i] = a[j]; a[j] = x; t.count('writes', 2); };

  t.frame(() => ({ line: 0, note: `Start with ${n} values. Quick sort picks one value as a **pivot**, moves smaller values to its left and larger ones to its right, then repeats on each side.`, views: view() }));

  const choosePivot = (lo, hi) => {
    if (input.pivot === 'random') return rng.int(lo, hi);
    if (input.pivot === 'median3' && hi - lo >= 2) {
      const mid = lo + ((hi - lo) >> 1);
      const x = a[lo], y = a[mid], z = a[hi];
      t.count('comparisons', 3);
      if ((x <= y && y <= z) || (z <= y && y <= x)) return mid;
      if ((y <= x && x <= z) || (z <= x && x <= y)) return lo;
      return hi;
    }
    return hi;
  };

  const sort = (lo, hi, depth) => {
    if (lo > hi) return;
    maxDepth = Math.max(maxDepth, depth);
    if (lo === hi) {
      fixed.add(lo);
      t.frame(() => ({ line: 1, note: `The range holds a single value (${a[lo]}), so it is already in its final position.`, views: view({}, [], [lo, hi]), vars: { lo, hi, depth } }));
      return;
    }
    const pi = choosePivot(lo, hi);
    if (pi !== hi) {
      swap(pi, hi);
      t.frame(() => ({ line: 7, note: `Chose ${a[hi]} as the pivot and moved it to the end of the range so the scan can run uninterrupted.`, views: view({ [hi]: 'pivot', [pi]: 'swap' }, [], [lo, hi]), vars: { lo, hi, depth } }));
    }
    const pivot = a[hi];
    let i = lo;
    t.frame(() => ({ line: [7, 8], note: `Partition positions ${lo} to ${hi} around the pivot **${pivot}**. Marker \`i\` is where the next smaller value will go.`, views: view({ [hi]: 'pivot' }, [{ index: i, label: 'i' }], [lo, hi]), vars: { lo, hi, pivot, depth } }));
    for (let j = lo; j < hi; j++) {
      t.count('comparisons');
      const smaller = a[j] < pivot;
      t.frame(() => ({ line: 10, note: `Is ${a[j]} smaller than the pivot ${pivot}? ${smaller ? 'Yes, so it belongs on the left.' : 'No, so it stays on the right for now.'}`,
        views: view({ [hi]: 'pivot', [j]: 'compare' }, [{ index: i, label: 'i' }, { index: j, label: 'j' }], [lo, hi]), vars: { lo, hi, pivot, i, j, depth } }));
      if (smaller) {
        if (i !== j) {
          swap(i, j);
          t.frame(() => ({ line: 11, note: `Swap ${a[i]} into position ${i}, the end of the "smaller than pivot" group.`,
            views: view({ [hi]: 'pivot', [i]: 'swap', [j]: 'swap' }, [{ index: i, label: 'i' }, { index: j, label: 'j' }], [lo, hi]), vars: { lo, hi, pivot, i, j, depth } }));
        }
        i++;
      }
    }
    if (i !== hi) swap(i, hi);
    fixed.add(i);
    t.frame(() => ({ line: 13, note: `Drop the pivot ${pivot} into position ${i}. Everything to its left is smaller and everything to its right is at least as large, so it never moves again.`,
      views: view({ [i]: 'pivot' }, [{ index: i, label: 'p' }], [lo, hi]), vars: { lo, hi, pivot, p: i, depth } }));
    sort(lo, i - 1, depth + 1);
    sort(i + 1, hi, depth + 1);
  };

  sort(0, n - 1, 1);
  t.frame(() => ({ line: null, note: `Sorted. Every value has been a pivot or a single-element range exactly once.`, views: view() }));
  return { sorted: a, original, depth: maxDepth };
}

export default {
  meta: {
    id: 'quick-sort',
    name: 'Quick Sort',
    aliases: ['quicksort', 'partition-exchange sort', 'Hoare sort'],
    kind: 'algorithm',
    discipline: 'algorithms',
    alsoIn: [],
    subfield: 'Sorting',
    family: 'Comparison sorts',
    lab: 'sorting-searching',
    compareGroup: 'sorting',
    year: 1961,
    authors: 'C. A. R. Hoare',
    summary: 'Sorts by partitioning around a pivot, then sorting each side. Fast in practice, in place, and quadratic only when pivots are chosen badly.',
    difficulty: 'intermediate',
    order: 140,
    paradigms: ['divide-and-conquer'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n²)', class: 'linearithmic' },
    space: { worst: 'O(n) stack, O(log n) expected', class: 'logarithmic' },
    tags: {
      problems: ['sort a list', 'put numbers in order', 'order items', 'arrange values ascending'],
      techniques: ['partitioning', 'pivot selection', 'recursion', 'in-place swapping'],
      applications: ['databases', 'standard libraries', 'data processing'],
    },
    prerequisites: ['concept:recursion', 'concept:array', 'concept:big-o', 'insertion-sort'],
  },

  bigIdea: {
    simple: "Quick sort is a way to put a list in order, like sorting a hand of playing cards from lowest to highest. It works by picking one item from the list and asking the same question of every other item: are you smaller or bigger than this one? Smaller items go to one side. Bigger items go to the other side. The item you picked is now sitting in exactly the right spot, and it never has to move again. Then you do the same thing inside each side. The groups keep getting smaller until each one holds a single item. At that point the whole list is in order. Computers sort lists all day long: names, prices, scores, search results. Quick sort matters because, on most lists, it gets the job done with very little work.",
    what: 'Quick sort puts a list in order by choosing one value, the **pivot**, and rearranging the list so that everything smaller sits to the pivot\'s left and everything larger to its right. The pivot is now exactly where it belongs. The same procedure is then applied to the left part and the right part, until every part has one value or none.',
    why: 'Tony Hoare devised it around 1960 while working on machine translation, where words had to be sorted before being looked up in a dictionary stored on magnetic tape. He needed a method that sorted in place, without the second copy of the data that merging requires, because memory was scarce.',
    when: 'Reach for quick sort when you need a fast general-purpose sort of data held in memory, order among equal items does not matter, and extra memory is limited. If you need a guaranteed worst case, or equal items must keep their original order, choose [merge sort](#/algorithm/merge-sort) or [heap sort](#/algorithm/heap-sort) instead.',
    interesting: 'Its worst case is as slow as bubble sort, yet it is typically the fastest comparison sort in practice. The difference between the two outcomes is nothing more than how the pivot is chosen, which makes it a clear lesson in average-case thinking and in the value of randomness.',
    where: 'Variants of quick sort are the default unstable sort in many standard libraries: C++ `std::sort` is usually introsort (quick sort that falls back to heap sort), and Java sorts arrays of primitives with a dual-pivot quick sort.',
    analogy: {
      title: 'Sorting a class by height with one volunteer',
      limits: "A class can shuffle around all at once, with everyone checking their height against the volunteer at the same moment. A computer running quick sort checks one item at a time. That is why we measure its work by counting comparisons. The picture also hides a risk: if the volunteer happens to be the shortest or tallest person every time, each round sorts out only one person, and the whole thing becomes slow.",
      text: 'Ask one student to stand still. Everyone shorter moves to their left, everyone taller to their right. That student is now standing in exactly the right place in the final line, even though neither group is sorted yet. Repeat inside each group with a new volunteer, and keep going until every group is a single person.',
    },
  },

  example: {
    setup: "Sort the five numbers 4, 7, 2, 9, 5. In each group, use the last number as the pivot. The pivot is the item that everything else in the group is compared against.",
    steps: [
      "The group is 4, 7, 2, 9, 5 and the pivot is 5. Compare each of the others with 5: 4 is smaller, 7 is bigger, 2 is smaller, 9 is bigger.",
      "Move the smaller numbers to the left and the bigger ones to the right, with the pivot between them: 4, 2, then 5, then 9, 7. The 5 is now in its final place.",
      "Look at the left group, 4, 2. Its pivot is 2. Since 4 is bigger than 2, it goes to the right of it. The group becomes 2, 4.",
      "Look at the right group, 9, 7. Its pivot is 7. Since 9 is bigger than 7, it goes to the right of it. The group becomes 7, 9.",
      "Every remaining group holds a single number, so there is nothing left to do.",
    ],
    result: "The list is now 2, 4, 5, 7, 9. It took 6 comparisons: 4 in the first round and 1 in each of the two small groups.",
    tryInput: { custom: [4, 7, 2, 9, 5], pivot: 'last' },
  },

  terms: [
    { term: "Pivot", meaning: "The item chosen in one round to compare all the others against." },
    { term: "Partition", meaning: "Splitting a group into two parts: the items smaller than the pivot, and the rest." },
    { term: "Comparison", meaning: "One question of the form: is this item smaller than that one? Counting comparisons is how we measure how much work a sort does." },
    { term: "Recursion", meaning: "Solving a problem by using the same method on smaller pieces of it, until the pieces are too small to need any work." },
    { term: "In place", meaning: "Rearranging the items inside the original list, without making a second copy of it." },
    { term: "Worst case", meaning: "The input that makes a method do the most work it could ever have to do." },
  ],

  takeaway: "Pick one item, put everything smaller on its left and everything bigger on its right, then do the same to each side.",

  viz: {
    describe: 'A row of bars, one per value. The pivot is drawn in dark ink, the value being compared in ochre, swapped values in brick red, and values in their final position in forest green. A shaded band shows the range currently being partitioned.',
    inputs: [
      ...arrayInputs({ size: 14 }),
      { id: 'pivot', type: 'select', label: 'Pivot choice', options: PIVOTS, default: 'last',
        help: 'How the pivot is picked from each range. This choice alone decides whether sorted input is fast or slow.' },
    ],
    presets: [
      { label: 'Random list', values: { order: 'random', pivot: 'last', custom: [] } },
      { label: 'Worst case: sorted + last pivot', values: { order: 'sorted', pivot: 'last', custom: [] } },
      { label: 'Same input, median of three', values: { order: 'sorted', pivot: 'median3', custom: [] } },
    ],
    tryThis: [
      'Load the "Worst case" preset and watch the shaded range shrink by only one bar per partition. Then switch the pivot choice to median of three on the same input and compare the comparison counts.',
      'Set the starting order to "Few distinct values". Every value equal to the pivot ends up on the right, so partitions become lopsided. This is why production sorts use three-way partitioning.',
      'Double the number of items from 16 to 32 on random input. The comparisons should slightly more than double, the signature of n log n growth.',
    ],
    run,
    report: (r, c) => `Sorted ${r.sorted.length} values with ${c.comparisons || 0} comparisons and ${c.writes || 0} array writes. Deepest recursion: ${r.depth}.\n[${r.sorted.join(', ')}]`,
    experiment: {
      title: 'Comparisons as the list grows',
      note: 'Each point is a real run of this page\'s implementation with the last element as pivot. Sorted input is the worst case for that pivot rule. The expected count, 2(n + 1)Hₙ − 4n, is close to 1.39 n log₂ n for large n; Hₙ is the sum 1 + 1/2 + ... + 1/n.',
      metric: 'comparisons',
      metricLabel: 'Comparisons',
      sizeLabel: 'Number of items (n)',
      sizes: [8, 16, 32, 64, 128, 256, 512],
      variants: [
        { id: 'random', label: 'Random order' },
        { id: 'sorted', label: 'Already sorted' },
      ],
      input: (n, variant, seed) => ({ size: n, order: variant, seed, pivot: 'last', custom: [] }),
      theory: [
        { label: '2(n + 1)Hₙ − 4n (expected, random order)', variant: 'random', expected: true,
          fn: (n) => { let h = 0; for (let k = 1; k <= n; k++) h += 1 / k; return 2 * (n + 1) * h - 4 * n; } },
        { label: 'n(n − 1) / 2 (worst case)', variant: 'sorted', fn: (n) => (n * (n - 1)) / 2 },
      ],
    },
  },

  logic: {
    intuition: 'Sorting is hard because every value\'s final position depends on every other value. Partitioning removes that dependence for one value at a time: after one pass, the pivot is final and the problem has split into two smaller problems that never need to interact again.',
    steps: [
      'If the range has zero or one value, it is already sorted. Stop.',
      'Choose a pivot from the range and move it to the end.',
      'Scan the range left to right, keeping a boundary `i`. Whenever the scanned value is smaller than the pivot, swap it to the boundary and advance the boundary.',
      'Swap the pivot from the end to the boundary. It is now in its final position `p`.',
      'Sort the values left of `p` with the same procedure.',
      'Sort the values right of `p` with the same procedure.',
    ],
    pseudocode: [
      'quicksort(A, lo, hi):',
      '  if lo >= hi: return',
      '  p ← partition(A, lo, hi)',
      '  quicksort(A, lo, p − 1)',
      '  quicksort(A, p + 1, hi)',
      '',
      'partition(A, lo, hi):',
      '  pivot ← A[hi]',
      '  i ← lo',
      '  for j from lo to hi − 1:',
      '    if A[j] < pivot:',
      '      swap A[i] and A[j]',
      '      i ← i + 1',
      '  swap A[i] and A[hi]',
      '  return i',
    ],
    decisions: [
      { title: 'Which value becomes the pivot?', text: 'The ideal pivot is the median, which splits the range in half. Finding the true median costs too much, so implementations approximate it: the last element (simple, but terrible on sorted data), the median of three sampled elements, or a random element.' },
      { title: 'Which partition scheme?', text: 'This lesson uses the Lomuto scheme (one scan, one boundary) because its invariant is easy to state. Hoare\'s original scheme scans inward from both ends and performs about a third as many swaps on average, but is easier to get subtly wrong.' },
      { title: 'Which side to recurse into first?', text: 'It does not affect correctness. Recursing into the smaller side first and looping on the larger keeps the call stack at O(log n) even in the worst case.' },
    ],
    invariants: [
      'During the partition scan, every value in `A[lo..i−1]` is smaller than the pivot, and every value in `A[i..j−1]` is greater than or equal to it.',
      'Once a pivot has been placed, it is in its final sorted position and is never touched again.',
    ],
    edgeCases: [
      'Empty or single-element ranges: the base case returns immediately.',
      'All values equal: with this scheme no value is smaller than the pivot, so every partition is maximally lopsided and the run is quadratic.',
      'Already sorted or reverse-sorted input with a first or last pivot: also quadratic.',
      'Very deep recursion on adversarial input can overflow the call stack unless the smaller side is handled first.',
    ],
    correctness: 'Partition is correct by its loop invariant: when the scan ends, `A[lo..i−1]` holds exactly the values smaller than the pivot and `A[i..hi−1]` the rest, so swapping the pivot into position `i` leaves smaller values on its left and larger-or-equal values on its right. Quick sort is then correct by induction on range size: ranges of size 0 or 1 are sorted; for a larger range, both sides are strictly smaller, so by the induction hypothesis they become sorted, and with the pivot between them the whole range is sorted.',
    mistakes: [
      'Recursing on `(lo, p)` instead of `(lo, p − 1)`. Including the pivot can prevent the range from shrinking and recurse forever.',
      'Using `<=` in the comparison with Hoare-style index movement, or mixing the two partition schemes\' boundary conventions.',
      'Always picking the first or last element as pivot and then feeding the function sorted data, which is common in real workloads.',
      'Assuming quick sort is stable. Equal values can change relative order during the long-distance swaps.',
    ],
  },

  code: {
    sample: {
      input: 'The list [29, 10, 14, 37, 13, 5, 31, 22]',
      expected: '5 10 13 14 22 29 31 37',
    },
    python: {
      source: `def partition(a, lo, hi):
    pivot = a[hi]
    i = lo
    for j in range(lo, hi):
        if a[j] < pivot:
            a[i], a[j] = a[j], a[i]
            i += 1
    a[i], a[hi] = a[hi], a[i]
    return i


def quicksort(a, lo=0, hi=None):
    if hi is None:
        hi = len(a) - 1
    if lo >= hi:
        return
    p = partition(a, lo, hi)
    quicksort(a, lo, p - 1)
    quicksort(a, p + 1, hi)


data = [29, 10, 14, 37, 13, 5, 31, 22]
quicksort(data)
print(" ".join(str(x) for x in data))`,
      notes: [
        { line: 2, text: 'The last element of the range is the pivot. Production code would first swap a better-chosen pivot into this position.' },
        { line: 5, text: 'The only comparison in the algorithm. Everything smaller than the pivot is swapped to the boundary `i`.' },
        { line: 8, text: 'The pivot moves from the end to the boundary, which is its final sorted position.' },
        { line: 18, text: 'The pivot at index `p` is excluded from both recursive calls. That is what guarantees progress.' },
      ],
    },
    javascript: {
      source: `function partition(a, lo, hi) {
  const pivot = a[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (a[j] < pivot) {
      [a[i], a[j]] = [a[j], a[i]];
      i++;
    }
  }
  [a[i], a[hi]] = [a[hi], a[i]];
  return i;
}

function quicksort(a, lo = 0, hi = a.length - 1) {
  if (lo >= hi) return;
  const p = partition(a, lo, hi);
  quicksort(a, lo, p - 1);
  quicksort(a, p + 1, hi);
}

const data = [29, 10, 14, 37, 13, 5, 31, 22];
quicksort(data);
console.log(data.join(" "));`,
    },
    cpp: {
      source: `#include <iostream>
#include <utility>
#include <vector>

int partition(std::vector<int>& a, int lo, int hi) {
    int pivot = a[hi];
    int i = lo;
    for (int j = lo; j < hi; ++j) {
        if (a[j] < pivot) {
            std::swap(a[i], a[j]);
            ++i;
        }
    }
    std::swap(a[i], a[hi]);
    return i;
}

void quicksort(std::vector<int>& a, int lo, int hi) {
    if (lo >= hi) return;
    int p = partition(a, lo, hi);
    quicksort(a, lo, p - 1);
    quicksort(a, p + 1, hi);
}

int main() {
    std::vector<int> data = {29, 10, 14, 37, 13, 5, 31, 22};
    quicksort(data, 0, static_cast<int>(data.size()) - 1);
    for (std::size_t k = 0; k < data.size(); ++k) {
        std::cout << data[k] << (k + 1 < data.size() ? " " : "\\n");
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Each partition does work proportional to the size of its range. If pivots split ranges roughly in half, there are about log₂ n levels of recursion and each level touches every value once, giving n log n. If every pivot is the smallest or largest value, there are n levels, giving n².',
    cases: [
      { case: 'Best', time: 'O(n log n)', when: 'Every pivot is the median of its range.' },
      { case: 'Average', time: 'O(n log n)', when: 'Pivots land at random ranks. The expected number of comparisons is about 1.39 n log₂ n.' },
      { case: 'Worst', time: 'O(n²)', when: 'Every pivot is an extreme value: for example sorted input with a last-element pivot, or all values equal with two-way partitioning.' },
    ],
    space: 'No auxiliary array is needed. The recursion stack holds O(log n) frames in expectation and O(n) in the worst case; recursing into the smaller side first bounds it at O(log n) always.',
    memory: 'Partitioning scans memory sequentially, which is friendly to CPU caches. This is a large part of why quick sort beats heap sort in practice despite the same average bound.',
    tradeoffs: 'Quick sort trades a guaranteed worst case for speed and low memory. Merge sort guarantees n log n and stability but needs O(n) extra space; heap sort guarantees n log n in place but jumps around memory. Hybrid sorts combine them.',
    assumptions: [
      'Comparing two values and swapping two values each take constant time.',
      'The average case assumes all orderings of distinct values are equally likely, or that the pivot is chosen at random.',
      'Counts on this page are comparisons performed by this implementation, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'General-purpose in-memory sorting where average speed matters most.',
      'Memory-constrained settings: it sorts in place.',
      'Large arrays of primitive values, where cache-friendly sequential scans pay off.',
    ],
    struggles: [
      'Inputs with many duplicate keys, unless three-way partitioning is used.',
      'Adversarial or already-ordered inputs when the pivot rule is naive.',
      'Situations that require stability, or a hard worst-case time guarantee.',
      'Linked lists and external (on-disk) data, where merge sort\'s sequential merging fits better.',
    ],
    misunderstandings: [
      "\"Quick sort is always the fastest way to sort.\" It is usually the fastest in practice. On unlucky inputs it is as slow as the simplest methods, and when the items are small whole numbers a counting sort can beat it.",
      "\"The pivot must be the middle value.\" Any item can be the pivot and the result will still be correct. A pivot close to the middle value only makes the sort faster.",
      "\"After one round, both sides are sorted.\" Only the pivot is in its final place. Each side still has to be sorted in the same way.",
    ],
    pitfalls: [
      'Naive pivot choice turning common inputs into the worst case.',
      'Unbounded recursion depth on adversarial input.',
      'Off-by-one errors at the partition boundaries that only appear with duplicate values.',
    ],
    constraints: [
      'Real libraries switch to insertion sort for small ranges (often below 16 to 32 elements) because its constant factors are lower.',
      'Libraries exposed to untrusted input guard against quadratic behaviour, typically by falling back to heap sort when recursion gets too deep (introsort).',
    ],
    alternatives: [
      { id: 'merge-sort', name: 'Merge Sort', when: 'You need stability, a guaranteed O(n log n), or are sorting linked lists or files.' },
      { id: 'heap-sort', name: 'Heap Sort', when: 'You need guaranteed O(n log n) with O(1) extra space and can accept slower typical speed.' },
      { id: 'insertion-sort', name: 'Insertion Sort', when: 'The list is tiny or already nearly sorted.' },
      { id: 'counting-sort', name: 'Counting Sort', when: 'Keys are small integers; non-comparison sorts can run in linear time.' },
    ],
    comparison: {
      columns: ['', 'Quick sort', 'Merge sort', 'Heap sort'],
      rows: [
        ['Worst-case time', 'O(n²)', 'O(n log n)', 'O(n log n)'],
        ['Average time', 'O(n log n)', 'O(n log n)', 'O(n log n)'],
        ['Extra space', 'O(log n) stack', 'O(n)', 'O(1)'],
        ['Stable', 'No', 'Yes', 'No'],
        ['Memory access pattern', 'Sequential scans', 'Sequential scans', 'Scattered'],
      ],
    },
  },

  applications: [
    { title: 'Standard library sort routines', status: 'established', text: 'C++ `std::sort` is typically implemented as introsort, which begins as quick sort and switches to heap sort if recursion grows too deep. Java sorts arrays of primitives with a dual-pivot quick sort.' },
    { title: 'Selection: finding the k-th smallest value', status: 'established', text: 'Quickselect reuses the partition step but recurses into only one side, finding a median or percentile in expected linear time. C++ `std::nth_element` is built on this idea.' },
    { title: 'Database query execution', status: 'established', text: 'In-memory sorts for ORDER BY and sort-merge joins commonly use quick sort variants for runs that fit in memory, with merging used once data exceeds it.' },
    { title: 'Teaching average-case and randomized analysis', status: 'established', text: 'Quick sort is the standard first example of an algorithm whose expected running time is far better than its worst case, and of using randomness to defeat bad inputs.' },
  ],

  connections: [
    { to: 'merge-sort', type: 'same-problem', why: 'Both are divide-and-conquer sorts. Merge sort splits trivially and does its work when combining; quick sort does its work when splitting and combines trivially.' },
    { to: 'insertion-sort', type: 'prerequisite', why: 'Practical quick sorts hand small ranges to insertion sort, and its simple invariant is the best preparation for the partition invariant.' },
    { to: 'heap-sort', type: 'related', why: 'Introsort pairs the two: quick sort for speed, heap sort as the fallback that guarantees O(n log n).' },
    { to: 'binary-search', type: 'related', why: 'Both discard part of the problem with each comparison against a chosen element; quick sort\'s recursion tree is a binary search tree built from its pivots.' },
    { to: 'concept:divide-and-conquer', type: 'prerequisite', why: 'Quick sort is the paradigm in its purest form: split, solve the parts independently, and need no combining step.' },
    { to: 'concept:randomization', type: 'advanced', why: 'Choosing the pivot at random makes the expected running time O(n log n) on every input, removing the adversary\'s ability to pick a bad one.' },
    { to: 'concept:recurrence', type: 'advanced', why: 'Its running time is described by the recurrence T(n) = T(k) + T(n − 1 − k) + O(n), whose solution depends entirely on how balanced k is.' },
    { to: 'discipline:statistics', type: 'application', why: 'Medians and quantiles are computed by quickselect, the one-sided version of this algorithm.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Immediately after one partition step finishes, what is guaranteed?',
      options: ['The whole range is sorted', 'The pivot is in its final sorted position', 'The left part is sorted', 'The smallest value is first'],
      answer: 1,
      explain: [
        'Not yet. Only the pivot is final; both sides may still be in any order.',
        'Correct. Everything smaller is on its left and everything else on its right, so no later step needs to move it.',
        'Partitioning only separates smaller from larger. It does not order the values within either side.',
        'The smallest value is somewhere in the left part, but not necessarily first.',
      ],
    },
    {
      type: 'predict',
      q: 'The list is already sorted and has 8 values. With the last element as pivot, how many comparisons will quick sort make?',
      options: ['8', '24', '28', '64'],
      answer: 2,
      explain: [
        'A single partition of 8 values already costs 7 comparisons, and there are many more partitions to come.',
        'About 24 is what a balanced n log₂ n run would give. Sorted input with a last-element pivot is not balanced.',
        'Correct. Each partition removes only the pivot, so the ranges have sizes 8, 7, ... 2, costing 7 + 6 + ... + 1 = 28 comparisons.',
        'n² overcounts. The exact worst case is n(n − 1) / 2.',
      ],
      tryInput: { size: 8, order: 'sorted', pivot: 'last', custom: [] },
    },
    {
      type: 'debug',
      q: 'This version sometimes never returns. Which line is wrong?',
      code: `def quicksort(a, lo, hi):
    if lo >= hi:
        return
    p = partition(a, lo, hi)
    quicksort(a, lo, p)
    quicksort(a, p + 1, hi)`,
      options: ['Line 2: the base case should be lo > hi', 'Line 5: the left call should stop at p − 1', 'Line 6: the right call should start at p', 'Line 4: partition should be called twice'],
      answer: 1,
      explain: [
        '`lo >= hi` is right: a one-element range needs no work either.',
        'Correct. If the pivot lands at `hi`, the call `quicksort(a, lo, p)` is the same range again, so the recursion never shrinks.',
        'Starting at `p` would include the pivot on the right and can also fail to shrink. `p + 1` is correct.',
        'One partition per call is all that is needed.',
      ],
    },
    {
      type: 'choice',
      q: 'Why do production sorts choose the pivot at random or by median of three rather than always taking the last element?',
      options: ['It makes the sort stable', 'It reduces memory use to O(1)', 'It makes the quadratic case unlikely on real-world inputs such as sorted data', 'It removes the need for recursion'],
      answer: 2,
      explain: [
        'Pivot choice does not affect stability; the long-distance swaps do.',
        'Memory use is governed by recursion depth, which pivot choice influences only indirectly.',
        'Correct. Sorted and nearly sorted inputs are common, and a fixed-position pivot turns them into the worst case.',
        'The algorithm remains recursive (or uses an explicit stack) whichever pivot rule is used.',
      ],
    },
    {
      type: 'challenge',
      title: 'Three-way partitioning',
      prompt: 'Modify `partition` so that it returns two indices and splits the range into three parts: smaller than, equal to, and larger than the pivot (the "Dutch national flag" scheme). Recurse only into the smaller and larger parts. Then sort a list in which every value is the same and confirm that the number of comparisons grows linearly rather than quadratically.',
      hints: ['Keep three boundaries: `lt`, `i` and `gt`.', 'When `A[i]` equals the pivot, just advance `i`; when it is larger, swap it with `A[gt]` and shrink `gt` without advancing `i`.'],
    },
  ],

  compare: {
    idea: 'Partition around a pivot, then sort each side independently.',
    requires: 'Any list whose items can be compared. It is always correct. Only its speed depends on the list.',
    sensitivity: 'High. Balanced pivots give n log n; extreme pivots (sorted data with a naive pivot, many duplicates) give n².',
    memory: 'In place. Recursion stack of O(log n) expected, O(n) worst case.',
    difficulty: 'moderate',
    difficultyNote: 'Short to write, but the partition boundaries are a classic source of off-by-one errors.',
    limits: 'Equal items may change their relative order. Without safeguards an unlucky list makes it very slow.',
    useWhen: 'The usual choice for sorting a list held in memory when equal items need not keep their order.',
  },

  advanced: {
    history: 'C. A. R. (Tony) Hoare developed the algorithm in 1959 to 1960 as a visiting student at Moscow State University, and published it as Algorithm 64 in Communications of the ACM in 1961, followed by a fuller analysis in The Computer Journal in 1962. Robert Sedgewick\'s 1975 doctoral thesis gave a detailed analysis of its many variants. The single-scan partition used in this lesson is attributed to Nico Lomuto and was popularized by Jon Bentley\'s *Programming Pearls*.',
    derivation: 'Let $C_n$ be the expected number of comparisons to sort $n$ distinct values when each rank is equally likely to be the pivot. One partition costs $n-1$ comparisons and leaves sides of size $k$ and $n-1-k$:\n\n$$C_n = (n-1) + \\frac{1}{n}\\sum_{k=0}^{n-1}\\left(C_k + C_{n-1-k}\\right) = (n-1) + \\frac{2}{n}\\sum_{k=0}^{n-1} C_k$$\n\nMultiplying by $n$, subtracting the same identity for $n-1$, and simplifying gives $nC_n = (n+1)C_{n-1} + 2(n-1)$. Dividing by $n(n+1)$ and telescoping yields\n\n$$C_n = 2(n+1)H_n - 4n \\approx 2n\\ln n \\approx 1.39\\,n\\log_2 n$$\n\nwhere $H_n$ is the $n$-th harmonic number.',
    proof: 'A shorter argument uses indicator variables. Let $z_1 < z_2 < \\dots < z_n$ be the values in sorted order. Two values $z_i$ and $z_j$ are compared only if one of them is chosen as a pivot before any value between them is, because such a pivot would separate them for good. Among the $j-i+1$ values from $z_i$ to $z_j$, each is equally likely to be chosen first, so the probability of a comparison is $\\frac{2}{j-i+1}$. By linearity of expectation,\n\n$$E[\\text{comparisons}] = \\sum_{i<j} \\frac{2}{j-i+1} < 2n\\,H_n = O(n\\log n).$$',
    complexityProof: 'Worst case: if every pivot is the largest value in its range, partition sizes are $n, n-1, \\dots, 2$ and the comparisons total $\\sum_{k=2}^{n}(k-1) = \\frac{n(n-1)}{2}$. No input can do worse, because each pair of values is compared at most once (one of them must be the pivot, and a pivot is never compared again).',
    variants: [
      { name: 'Hoare partition', text: 'Two indices move toward each other and swap out-of-place pairs. Fewer swaps than Lomuto and better behaviour with repeated values.' },
      { name: 'Three-way (Dutch national flag) partition', text: 'Groups values equal to the pivot in the middle so they are never revisited. Linear time when there are few distinct keys.' },
      { name: 'Introsort', text: 'Starts as quick sort and switches to heap sort when recursion depth exceeds a multiple of log n, giving an O(n log n) worst case.' },
      { name: 'Dual-pivot quick sort', text: 'Partitions into three ranges around two pivots. Used for primitive arrays in Java since version 7.' },
      { name: 'Quickselect', text: 'Recurse into only the side containing the k-th position to select an order statistic in expected linear time.' },
    ],
    implementation: 'Use insertion sort below a small cutoff. Choose the pivot by median of three or at random. Recurse into the smaller side and iterate on the larger to bound stack depth. Use a three-way partition if duplicate keys are likely.',
    benchmarking: 'Operation counts on this site are exact and repeatable. Wall-clock comparisons between sorting algorithms depend heavily on element type, cache behaviour, branch prediction and input distribution, so measure with your own data before drawing conclusions.',
    references: [
      { authors: 'C. A. R. Hoare', year: 1962, title: 'Quicksort', venue: 'The Computer Journal 5(1), 10-16' },
      { authors: 'C. A. R. Hoare', year: 1961, title: 'Algorithm 64: Quicksort', venue: 'Communications of the ACM 4(7), 321' },
      { authors: 'J. L. Bentley and M. D. McIlroy', year: 1993, title: 'Engineering a sort function', venue: 'Software: Practice and Experience 23(11), 1249-1265' },
      { authors: 'D. R. Musser', year: 1997, title: 'Introspective sorting and selection algorithms', venue: 'Software: Practice and Experience 27(8), 983-993' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Quicksort".',
      'R. Sedgewick and K. Wayne, *Algorithms* (4th edition), section 2.3.',
    ],
  },

  tests: [
    { name: 'sorts a random list', input: { size: 40, order: 'random', seed: 11, pivot: 'last' },
      check: (r) => (isSorted(r.sorted) && sameMultiset(r.sorted, r.original)) || 'output is not a sorted permutation of the input' },
    { name: 'sorts with every pivot rule', input: { size: 33, order: 'few', seed: 5, pivot: 'median3' },
      check: (r) => (isSorted(r.sorted) && sameMultiset(r.sorted, r.original)) || 'median-of-three run is wrong' },
    { name: 'random pivot sorts reversed input', input: { size: 25, order: 'reversed', seed: 2, pivot: 'random' },
      check: (r) => isSorted(r.sorted) || 'random-pivot run is wrong' },
    { name: 'sorted input with last pivot costs n(n-1)/2 comparisons', input: { size: 8, order: 'sorted', seed: 1, pivot: 'last' },
      check: (r, c) => c.comparisons === 28 || `expected 28 comparisons, got ${c.comparisons}` },
    { name: 'the worked example costs 6 comparisons', input: { custom: [4, 7, 2, 9, 5], pivot: 'last' },
      check: (r, c) => (c.comparisons === 6 && r.sorted.join(',') === '2,4,5,7,9') || `got ${c.comparisons} comparisons`},
    { name: 'handles custom input with duplicates and negatives', input: { custom: [3, -1, 3, 0, -7, 3], pivot: 'last' },
      check: (r) => r.sorted.join(',') === '-7,-1,0,3,3,3' || `got ${r.sorted.join(',')}` },
  ],
};
