import { arrayInputs, resolveArray, isSorted, sameMultiset } from '../../js/lib/arrays.js';

const LEGEND = [
  { label: 'smallest so far', role: 'special' },
  { label: 'being compared', role: 'compare' },
  { label: 'swapped', role: 'swap' },
  { label: 'final position', role: 'sorted' },
];

function run(input, t) {
  const a = resolveArray(input);
  const original = a.slice();
  const n = a.length;
  let done = 0; // positions before this one hold their final values
  let swaps = 0;

  const view = (roles = {}, markers = []) => {
    const all = {};
    for (let k = 0; k < done; k++) all[k] = 'sorted';
    Object.assign(all, roles);
    return [{ kind: 'bars', values: a.slice(), roles: all, markers, range: done < n ? [done, n - 1] : undefined, legend: LEGEND }];
  };
  const marks = (i, min, j) => {
    const m = [{ index: i, label: 'i' }, { index: min, label: 'min' }];
    if (j !== undefined) m.push({ index: j, label: 'j' });
    return m;
  };

  t.frame(() => ({ line: 0, note: `Start with ${n} values. Selection sort fills the positions from left to right. For each position it searches the unsorted part for the smallest value and swaps that value into place.`, views: view() }));

  for (let i = 0; i < n - 1; i++) {
    let min = i;
    t.frame(() => ({ line: [2, 3], note: `Round ${i + 1}: find the smallest value in positions ${i} to ${n - 1}. Begin by taking the first of them, ${a[i]}, as the smallest so far.`,
      views: view({ [i]: 'special' }, marks(i, min)), vars: { i, min } }));
    for (let j = i + 1; j < n; j++) {
      t.count('comparisons');
      const smaller = a[j] < a[min];
      t.frame(() => ({ line: 5,
        note: `Is ${a[j]} smaller than the smallest so far, ${a[min]}? ${smaller ? 'Yes.' : a[j] === a[min] ? 'No, they are equal, so keep the earlier one.' : `No, so ${a[min]} stays the smallest so far.`}`,
        views: view({ [min]: 'special', [j]: 'compare' }, marks(i, min, j)), vars: { i, j, min } }));
      if (smaller) {
        min = j;
        t.frame(() => ({ line: 6, note: `So ${a[min]}, at position ${min}, becomes the smallest so far.`,
          views: view({ [min]: 'special' }, marks(i, min, j)), vars: { i, j, min } }));
      }
    }
    if (min !== i) {
      const x = a[i]; a[i] = a[min]; a[min] = x;
      t.count('writes', 2);
      swaps++;
      done = i + 1;
      t.frame(() => ({ line: [7, 8], note: `The search is over: ${a[i]} is the smallest value left. Swap it with ${a[min]}, so that ${a[i]} lands at position ${i}. Every value still to its right is at least as large, so it will not move again.`,
        views: view({ [i]: 'swap', [min]: 'swap' }, [{ index: i, label: 'i' }, { index: min, label: 'min' }]), vars: { i, min } }));
    } else {
      done = i + 1;
      t.frame(() => ({ line: 7, note: `The search is over: ${a[i]} is the smallest value left, and it is already at position ${i}. No swap is needed.`,
        views: view({}, [{ index: i, label: 'i,min' }]), vars: { i, min } }));
    }
  }
  done = n;
  t.frame(() => ({ line: null, note: n > 1
    ? `Sorted with ${swaps} ${swaps === 1 ? 'swap' : 'swaps'}. The last value needed no round of its own: once every other position holds the right value, the one left over is the largest.`
    : 'A list of one value is already sorted.', views: view() }));
  return { sorted: a, original, swaps };
}

const sortedPermutation = (r, c) => {
  if (!isSorted(r.sorted) || !sameMultiset(r.sorted, r.original)) return 'output is not a sorted permutation of the input';
  const n = r.sorted.length;
  return (c.comparisons || 0) === (n * (n - 1)) / 2 || `expected exactly ${(n * (n - 1)) / 2} comparisons, got ${c.comparisons}`;
};

export default {
  meta: {
    id: 'selection-sort',
    name: 'Selection Sort',
    aliases: ['straight selection sort', 'selection sorting', 'min sort'],
    kind: 'algorithm',
    discipline: 'algorithms',
    alsoIn: [],
    subfield: 'Sorting',
    family: 'Comparison sorts',
    lab: 'sorting-searching',
    compareGroup: 'sorting',
    summary: 'Sorts by repeatedly finding the smallest remaining value and swapping it into place. Always n(n − 1)/2 comparisons, but never more than n − 1 swaps.',
    difficulty: 'beginner',
    order: 110,
    paradigms: ['brute-force', 'incremental'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n²)', average: 'O(n²)', worst: 'O(n²)', class: 'quadratic' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['sort a list', 'put numbers in order', 'order items', 'find the smallest items', 'sort with few moves'],
      techniques: ['minimum search', 'in-place swapping', 'repeated selection'],
      applications: ['data processing'],
    },
    prerequisites: ['concept:array', 'concept:big-o', 'linear-search'],
  },

  bigIdea: {
    simple: "Selection sort is a way to put a list in order, such as arranging numbers from smallest to largest. It works the way many people tidy a shelf. Look through the whole list and find the smallest item. Move it to the front by trading places with whatever was there. That first spot is now finished. Next, look through the rest of the list and find the smallest item that is left. Trade it into the second spot. Keep going, one spot at a time, until every spot holds the right item. To find the smallest item, the method checks every remaining item in turn and remembers the smallest it has seen so far. It does all of that checking even when the list was already in order, so it is slow on long lists. Its strength is that it moves items very rarely: at most one trade for each spot.",
    what: 'Selection sort divides the list into a sorted part on the left and an unsorted part on the right. In each round it scans the unsorted part for its smallest value, swaps that value with the first unsorted position, and so grows the sorted part by one. After n − 1 rounds the list is in order.',
    why: 'It is one of the most direct answers to the question "how would you sort by hand?", and it separates two costs that other simple sorts mix together: looking at values and moving them. Selection sort looks a great deal and moves almost nothing, which makes it a clear example of why the right measure of cost depends on what is expensive.',
    when: 'Use it when the list is short and moving an item costs much more than comparing two items, or when you only need the few smallest items in order and can stop after that many rounds. For general sorting of short lists, [insertion sort](#/algorithm/insertion-sort) is usually better, and for long lists use [merge sort](#/algorithm/merge-sort), [quick sort](#/algorithm/quick-sort) or [heap sort](#/algorithm/heap-sort).',
    interesting: 'Selection sort does exactly the same number of comparisons on every list of a given length, sorted or not. In return, when all the values are different it makes the smallest number of swaps that any swapping method could make on that list. [Heap sort](#/algorithm/heap-sort) keeps the same plan, select the next extreme value and move it into place, but finds that value much faster.',
    where: 'In teaching, and in small routines where simplicity and a low number of writes matter more than speed. Its idea lives on inside heap sort, which is widely used.',
    analogy: {
      title: 'Lining up books by height',
      text: 'To arrange a shelf of books from shortest to tallest, run your finger along the whole shelf and find the shortest book. Swap it with the book at the left-hand end. Then run your finger along the rest of the shelf, find the shortest of those, and swap it into the second place. Each sweep fixes one more book, and no book that has been fixed is ever touched again.',
      limits: 'A person can spot the shortest book on a shelf at a glance. A computer cannot glance: it has to look at every remaining book, one at a time, remembering the shortest it has seen so far, and it must do so on every sweep. A person would also remember which books were nearly the shortest. Selection sort forgets everything it learned in a sweep except the one winner, and starts the next sweep from nothing.',
    },
  },

  example: {
    setup: 'Sort the five numbers 5, 3, 8, 1, 4 from smallest to largest. In each round, search the numbers that are not yet in place for the smallest one, by comparing each with the smallest seen so far.',
    steps: [
      'Round 1 searches all five numbers. Start with 5 as the smallest so far. 3 is smaller, so remember 3. 8 is not smaller. 1 is smaller, so remember 1. 4 is not smaller. That took 4 comparisons. Swap 1 with the first number: 1, 3, 8, 5, 4.',
      'Round 2 searches 3, 8, 5, 4. Start with 3. None of 8, 5 or 4 is smaller, so 3 is already in the right place and nothing is swapped. That took 3 comparisons.',
      'Round 3 searches 8, 5, 4. Start with 8. 5 is smaller, so remember 5. 4 is smaller still, so remember 4. That took 2 comparisons. Swap 4 with 8: 1, 3, 4, 5, 8.',
      'Round 4 searches 5, 8. Start with 5. 8 is not smaller, so nothing is swapped. That took 1 comparison.',
      'One number is left, and it must be the largest, so it is already in place.',
    ],
    result: 'The list is 1, 3, 4, 5, 8 after 4 + 3 + 2 + 1 = 10 comparisons and only 2 swaps. Any list of five numbers costs the same 10 comparisons. Only the number of swaps depends on the starting order.',
    tryInput: { custom: [5, 3, 8, 1, 4] },
  },

  terms: [
    { term: 'Sorting', meaning: 'Rearranging a list so that its items are in order, for example from smallest to largest.' },
    { term: 'Comparison', meaning: 'One question of the form: is this item smaller than that one? Counting comparisons is one way to measure how much work a sort does.' },
    { term: 'Minimum', meaning: 'The smallest value in a group.' },
    { term: 'Swap', meaning: 'Exchanging the positions of two items.' },
    { term: 'Sorted part', meaning: 'The positions at the left of the list that already hold their final values.' },
    { term: 'In place', meaning: 'Rearranging the items inside the original list, without making a second copy of it.' },
    { term: 'Stable', meaning: 'A sort is stable if items of equal value come out in the same order they went in. Selection sort, as usually written, is not.' },
  ],

  takeaway: 'Find the smallest item that is left, swap it into the next free spot, and repeat.',

  viz: {
    describe: 'A row of bars, one per value. The smallest value found so far in the current search is drawn in dark ink and carries the marker "min". The value being compared against it is ochre, a pair that has just been swapped is brick red, and values in their final position at the left are forest green. A shaded band covers the unsorted part of the list.',
    inputs: arrayInputs({ size: 10 }),
    presets: [
      { label: 'Random list', values: { order: 'random', custom: [] } },
      { label: 'Already sorted', values: { order: 'sorted', custom: [] } },
      { label: 'Rotated by one: most swaps', values: { custom: [2, 3, 4, 5, 6, 7, 8, 1] } },
      { label: 'Reversed: few swaps', values: { custom: [8, 7, 6, 5, 4, 3, 2, 1] } },
    ],
    tryThis: [
      'Load "Already sorted" and watch the comparison counter. Then load "Random list". With 10 items both runs make exactly 45 comparisons. Only the number of writes differs.',
      'Load "Rotated by one" and then "Reversed". Both have 8 items, so both cost 28 comparisons. The first needs 7 swaps, the most possible. The second looks worse but needs only 4, because each swap puts two values in their final positions.',
      'Follow the "min" marker through one round. Count how many times it moves. It moves only when a new smallest value is found, which happens less and less often as the search goes on.',
    ],
    run,
    report: (r, c) => `Sorted ${r.sorted.length} values with ${c.comparisons || 0} comparisons and ${r.swaps} swaps (${c.writes || 0} array writes).\n[${r.sorted.join(', ')}]`,
    experiment: {
      title: 'Comparisons as the list grows',
      note: 'Each point is a real run of this page\'s implementation. The two measured series lie exactly on top of each other and on the curve n(n − 1)/2, because selection sort makes the same comparisons whatever order the values start in.',
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
        { label: 'n(n − 1)/2 (every input)', fn: (n) => (n * (n - 1)) / 2 },
      ],
    },
  },

  logic: {
    intuition: 'The smallest value of the whole list belongs in the first position. Once it is there, the problem is the same problem again on a list that is one shorter. So sorting reduces to a task that is easy to get right: find the minimum of a range by looking at every value in it once.',
    steps: [
      'Let `i` be the first position. Everything to the left of `i` is sorted and final.',
      'Assume the smallest unsorted value is at `i`. Call its position `min`.',
      'Scan `j` over every position to the right of `i`. Whenever `A[j]` is smaller than `A[min]`, set `min` to `j`.',
      'When the scan ends, `min` is the position of the smallest unsorted value. If it is not already at `i`, swap `A[i]` and `A[min]`.',
      'Move `i` one position to the right and repeat from step 2.',
      'Stop when `i` reaches the last position. The one value left is the largest and is already in place.',
    ],
    pseudocode: [
      'selection_sort(A):',
      '  n ← length(A)',
      '  for i from 0 to n − 2:',
      '    min ← i',
      '    for j from i + 1 to n − 1:',
      '      if A[j] < A[min]:',
      '        min ← j',
      '    if min ≠ i:',
      '      swap A[i] and A[min]',
    ],
    decisions: [
      { title: 'Remember the position or the value?', text: 'The position. The swap at the end of the round needs to know where the minimum is, and the value can always be read from the position.' },
      { title: 'Strictly smaller, or smaller or equal?', text: 'Strictly smaller, so that among equal values the leftmost is chosen. This does not make the sort stable, because the swap can still carry the value at `i` past an equal value, but it avoids pointless changes of `min`.' },
      { title: 'Swap even when the minimum is already in place?', text: 'This lesson skips the swap when `min` equals `i`. Swapping a value with itself is harmless, but skipping it makes the write count honest: at most n − 1 swaps, and none at all on a sorted list.' },
      { title: 'Select the minimum or the maximum?', text: 'Either works. Selecting the maximum and placing it at the right-hand end is the mirror image, and it is the form that heap sort uses.' },
    ],
    invariants: [
      'At the start of round `i`, positions `0` to `i − 1` hold the `i` smallest values of the list in sorted order.',
      'During the scan, `A[min]` is the smallest value among positions `i` to `j − 1`.',
      'A value in the sorted part is never read or written again.',
    ],
    edgeCases: [
      'An empty list or a single value: the outer loop never runs.',
      'An already sorted list: every round finds `min = i`, so there are no swaps, but all n(n − 1)/2 comparisons are still made.',
      'A reversed list of distinct values: only ⌊n/2⌋ swaps, because each swap puts both values in their final positions.',
      'Equal values: the result is sorted, but two equal values may come out in the opposite order from the one they went in.',
    ],
    correctness: 'The inner loop is a minimum search. Before it starts, `A[min]` is trivially the smallest of the one value examined. Each step compares the next value with `A[min]` and keeps the smaller, so when the loop ends `A[min]` is the smallest value in positions `i` to `n − 1`. For the outer loop, assume positions `0` to `i − 1` hold the `i` smallest values in order. Every unsorted value is at least as large as all of them, so the smallest unsorted value is the next in sorted order, and swapping it into position `i` extends the sorted part by one. After round `n − 2` the first `n − 1` positions hold the `n − 1` smallest values in order, which forces the remaining value to be the largest.',
    mistakes: [
      'Comparing `A[j]` with `A[i]` instead of `A[min]`. The scan then finds the last value smaller than `A[i]`, not the smallest value.',
      'Swapping inside the inner loop every time a smaller value is seen. The result is still sorted, but the main advantage, very few writes, is lost.',
      'Starting the inner loop at `i` instead of `i + 1`, which compares a value with itself.',
      'Assuming the sort is stable because it "only swaps when necessary".',
    ],
  },

  code: {
    sample: {
      input: 'The list [29, 10, 14, 37, 13, 5, 31, 22]. Prints the sorted list and the number of swaps used.',
      expected: '5 10 13 14 22 29 31 37\nswaps: 4',
    },
    python: {
      source: `def selection_sort(a):
    n = len(a)
    swaps = 0
    for i in range(n - 1):
        min_index = i
        for j in range(i + 1, n):
            if a[j] < a[min_index]:
                min_index = j
        if min_index != i:
            a[i], a[min_index] = a[min_index], a[i]
            swaps += 1
    return swaps


data = [29, 10, 14, 37, 13, 5, 31, 22]
swaps = selection_sort(data)
print(" ".join(str(x) for x in data))
print("swaps:", swaps)`,
      notes: [
        { line: 4, text: 'The outer loop stops one short of the end. When every other position is right, the last one must be too.' },
        { line: 5, text: 'Each round starts by assuming the first unsorted value is the smallest.' },
        { line: 7, text: 'The only comparison in the algorithm. It always compares against the smallest value found so far, not against `a[i]`.' },
        { line: 9, text: 'At most one swap per round, and none when the minimum is already in place.' },
      ],
    },
    javascript: {
      source: `function selectionSort(a) {
  const n = a.length;
  let swaps = 0;
  for (let i = 0; i < n - 1; i++) {
    let minIndex = i;
    for (let j = i + 1; j < n; j++) {
      if (a[j] < a[minIndex]) {
        minIndex = j;
      }
    }
    if (minIndex !== i) {
      [a[i], a[minIndex]] = [a[minIndex], a[i]];
      swaps++;
    }
  }
  return swaps;
}

const data = [29, 10, 14, 37, 13, 5, 31, 22];
const swaps = selectionSort(data);
console.log(data.join(" "));
console.log("swaps: " + swaps);`,
    },
    cpp: {
      source: `#include <iostream>
#include <utility>
#include <vector>

int selectionSort(std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    int swaps = 0;
    for (int i = 0; i < n - 1; ++i) {
        int minIndex = i;
        for (int j = i + 1; j < n; ++j) {
            if (a[j] < a[minIndex]) {
                minIndex = j;
            }
        }
        if (minIndex != i) {
            std::swap(a[i], a[minIndex]);
            ++swaps;
        }
    }
    return swaps;
}

int main() {
    std::vector<int> data = {29, 10, 14, 37, 13, 5, 31, 22};
    int swaps = selectionSort(data);
    for (std::size_t k = 0; k < data.size(); ++k) {
        std::cout << data[k] << (k + 1 < data.size() ? " " : "\\n");
    }
    std::cout << "swaps: " << swaps << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Round i scans the n − 1 − i values to the right of position i, one comparison each. Over all rounds that is (n − 1) + (n − 2) + ... + 1 = n(n − 1)/2 comparisons, whatever the input. Doubling the length of the list roughly quadruples the comparisons. The number of swaps is at most n − 1.',
    cases: [
      { case: 'Best', time: 'O(n²)', when: 'Already sorted input. No swaps are made, but every comparison still is.' },
      { case: 'Average', time: 'O(n²)', when: 'Any order. The comparison count does not depend on the values at all.' },
      { case: 'Worst', time: 'O(n²)', when: 'Any order. The most swaps, n − 1, occur for inputs such as a sorted list rotated by one position.' },
    ],
    space: 'O(1). Two loop indices, the position of the minimum and one temporary value for swapping.',
    memory: 'The inner loop reads the unsorted part from left to right, which is friendly to processor caches. Writes are rare: at most two per round.',
    tradeoffs: 'Selection sort minimizes writes and ignores everything else. Insertion sort does the opposite: it can finish a nearly sorted list in close to n comparisons, but it may shift values many times. Heap sort keeps selection sort\'s plan and replaces the linear search for the extreme value with a heap, cutting the total to O(n log n).',
    assumptions: [
      'Comparing two values and swapping two values each take constant time.',
      'The comparison count n(n − 1)/2 is exact for this implementation on every input of length n.',
      'The swap bound n − 1 assumes the swap is skipped when the minimum is already in place.',
      'Counts on this page are comparisons and array writes performed by this implementation, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Short lists where writing an item is far more costly than comparing two.',
      'Finding only the k smallest items in order: stop after k rounds.',
      'Settings where a predictable, input-independent number of comparisons is useful.',
    ],
    struggles: [
      'Long lists: the comparison count grows with the square of the length.',
      'Sorted or nearly sorted input, where it gains nothing from the existing order.',
      'Any task that needs equal items to keep their original order.',
    ],
    pitfalls: [
      'Comparing against `A[i]` instead of the smallest value found so far.',
      'Swapping during the scan instead of once at the end of the round.',
      'Relying on it to keep equal records in their original order.',
    ],
    misunderstandings: [
      '"It is faster on a list that is already sorted." It makes no swaps on a sorted list, but it performs exactly the same comparisons as on any other list of that length.',
      '"Few swaps means it is fast." The swaps are few, but the searching is not. The comparisons grow with the square of the list length, and they are what makes it slow.',
      '"Selection sort is stable." Not in its usual form. Sorting 2, 2, 1 swaps the first 2 with the 1, which carries that 2 behind the other one.',
      '"It is the same as bubble sort with fewer swaps." They share the idea of fixing one position per round, but bubble sort only compares neighbours and can stop early. Selection sort compares each value with a remembered minimum and can never stop early.',
    ],
    constraints: [
      'A stable version exists: instead of swapping, shift the values between `i` and `min` one place to the right and insert the minimum at `i`. That costs many more writes, which gives up the reason for choosing selection sort.',
    ],
    alternatives: [
      { id: 'insertion-sort', name: 'Insertion Sort', when: 'The list is short or nearly sorted and writes are not unusually expensive. It is stable and adapts to existing order.' },
      { id: 'heap-sort', name: 'Heap Sort', when: 'You like the select-and-place plan but the list is long. A heap finds each extreme value in O(log n).' },
      { id: 'bubble-sort', name: 'Bubble Sort', when: 'Only for study. It can stop early on sorted input, but it writes far more.' },
      { id: 'quick-sort', name: 'Quick Sort', when: 'You need a fast general-purpose in-place sort.' },
    ],
    comparison: {
      columns: ['', 'Selection sort', 'Insertion sort', 'Bubble sort'],
      rows: [
        ['Comparisons, sorted input', 'n(n − 1)/2', 'n − 1', 'n − 1'],
        ['Comparisons, worst case', 'n(n − 1)/2', 'n(n − 1)/2', 'n(n − 1)/2'],
        ['Element moves, worst case', 'n − 1 swaps', 'n(n − 1)/2 shifts', 'n(n − 1)/2 swaps'],
        ['Adapts to existing order', 'No', 'Yes', 'Partly'],
        ['Stable', 'No', 'Yes', 'Yes'],
      ],
    },
  },

  applications: [
    { title: 'A first lesson in separating costs', status: 'established', text: 'Introductory courses and textbooks present selection sort next to insertion sort to show that "work" is not one number: the two make very different trade-offs between comparisons and element moves.' },
    { title: 'The plan behind heap sort', status: 'established', text: 'Heap sort is selection sort with a better search. It also repeatedly selects an extreme value and swaps it to the end of the unsorted part, but a heap finds that value in logarithmic time.' },
    { title: 'The first few items of a list', status: 'illustrative', text: 'To show the five cheapest of forty offers in order, five rounds of selection sort are enough, at a cost of about 5 × 40 comparisons. Stopping early is possible because each round fixes one position for good.' },
    { title: 'Sorting when moves are expensive', status: 'illustrative', text: 'If each item is large, or each write wears out the storage a little, a method that looks at items often but moves each of them rarely can be the cheaper choice for a short list.' },
  ],

  connections: [
    { to: 'heap-sort', type: 'advanced', why: 'Both repeatedly select the extreme value of the unsorted part and swap it into its final position. Heap sort organizes the unsorted part as a heap so that each selection costs O(log n) instead of O(n).' },
    { to: 'insertion-sort', type: 'same-problem', why: 'Both grow a sorted part one position at a time. Selection sort searches the unsorted part for the right value; insertion sort searches the sorted part for the right place.' },
    { to: 'bubble-sort', type: 'same-problem', why: 'Both fix one extreme value per round. Bubble sort carries it into place with a chain of neighbour swaps; selection sort finds it first and moves it with one swap.' },
    { to: 'linear-search', type: 'prerequisite', why: 'The inner loop is a linear scan that keeps the best candidate seen so far, the same pattern as searching an unsorted list.' },
    { to: 'quick-sort', type: 'advanced', why: 'Both place one value in its final position per step. Quick sort\'s partition also sorts every other value into the correct side, so its subproblems shrink by half instead of by one.' },
    { to: 'concept:invariant', type: 'prerequisite', why: 'Two nested invariants prove it correct: the left part is sorted and final, and `min` marks the smallest value scanned so far.' },
    { to: 'concept:in-place', type: 'related', why: 'It sorts inside the original array using swaps and a constant number of variables.' },
    { to: 'concept:stability', type: 'related', why: 'Its long-distance swap can carry a value past an equal one, the standard example of how a sort loses stability.' },
    { to: 'concept:priority-queue', type: 'advanced', why: 'Repeatedly removing the smallest remaining item is exactly what a priority queue does. Selection sort is the version with an unsorted array as the queue.' },
    { to: 'discipline:mathematics', type: 'application', why: 'For distinct values, the swaps it performs break the input permutation into its cycles, using the fewest transpositions that can sort it.' },
  ],

  quiz: [
    {
      type: 'predict',
      q: 'The list 1, 2, 3, 4, 5, 6 is already sorted. How many comparisons will selection sort make?',
      options: ['0', '5', '15', '36'],
      answer: 2,
      explain: [
        'It makes 0 swaps, but it cannot know the list is sorted without searching each unsorted part.',
        '5 is the cost of the first round alone. Four more rounds follow.',
        'Correct. The rounds cost 5 + 4 + 3 + 2 + 1 = 15 comparisons, the same as for any list of six values.',
        '36 is n × n. Each round is one comparison shorter than the last, so the total is n(n − 1)/2.',
      ],
      tryInput: { custom: [1, 2, 3, 4, 5, 6] },
    },
    {
      type: 'choice',
      q: 'What is the largest number of swaps selection sort can make on a list of 8 values?',
      options: ['4', '7', '8', '28'],
      answer: 1,
      explain: [
        '4 is what a reversed list of 8 distinct values needs. Other inputs need more.',
        'Correct. There are 7 rounds and each makes at most one swap. A sorted list rotated by one position, such as 2, 3, 4, 5, 6, 7, 8, 1, needs all 7.',
        'There are only n − 1 = 7 rounds, because the last value falls into place by itself.',
        '28 is the number of comparisons, not swaps.',
      ],
    },
    {
      type: 'debug',
      q: 'On the list 3, 1, 2 this version returns 2, 1, 3. Which line is wrong?',
      code: `def selection_sort(a):
    n = len(a)
    for i in range(n - 1):
        min_index = i
        for j in range(i + 1, n):
            if a[j] < a[i]:
                min_index = j
        if min_index != i:
            a[i], a[min_index] = a[min_index], a[i]`,
      options: ['Line 3: the outer loop should run to n', 'Line 5: the inner loop should start at i', 'Line 6: it should compare a[j] with a[min_index]', 'Line 8: the swap should always happen'],
      answer: 2,
      explain: [
        'Stopping at n − 1 is right: the last value is in place once all the others are.',
        'Starting at `i` would only add a useless comparison of a value with itself.',
        'Correct. Comparing with `a[i]` remembers the last value smaller than `a[i]`, here the 2, instead of the smallest value, the 1.',
        'Swapping a value with itself changes nothing, so making the swap unconditional would not fix the result.',
      ],
    },
    {
      type: 'choice',
      q: 'Two records have the same key: 2a comes before 2b in the list 2a, 2b, 1. In what order does selection sort leave them?',
      options: ['1, 2a, 2b, because equal keys are never swapped', '1, 2b, 2a, because the first swap moves 2a to the end', 'It depends on the random seed', 'The sort fails on equal keys'],
      answer: 1,
      explain: [
        'The two equal keys are never swapped with each other, but 2a is swapped with the 1, and that jump carries it past 2b.',
        'Correct. Round 1 finds the 1 at the end and swaps it with 2a, giving 1, 2b, 2a. The equal keys have changed order, so the sort is not stable.',
        'Selection sort uses no randomness. The same input always gives the same result.',
        'The output is correctly sorted by key. Only the order among equal keys is disturbed.',
      ],
    },
    {
      type: 'challenge',
      title: 'A stable selection sort',
      prompt: 'Rewrite selection sort so that it is stable. Instead of swapping `A[i]` with `A[min]`, take the minimum out, shift every value between `i` and `min − 1` one place to the right, and put the minimum at `i`. Sort a list of (key, label) pairs by key to check that equal keys keep their order. Then count array writes on a reversed list of 16 values and compare with the swap version.',
      hints: ['Save `A[min]` in a variable before shifting, and shift from the right so nothing is overwritten.', 'The comparison count does not change. Think about what the new write count has in common with insertion sort.'],
    },
  ],

  compare: {
    idea: 'Find the smallest remaining value and swap it into the next position.',
    requires: 'Any list whose items can be compared. It is always correct.',
    sensitivity: 'None for comparisons: always n(n − 1)/2. Swaps vary from 0 to n − 1 with the input.',
    memory: 'In place. A few variables of extra space.',
    difficulty: 'low',
    difficultyNote: 'Two nested loops. The one thing to get right is comparing against the minimum so far.',
    limits: 'Very slow on long lists, even ones already in order: doubling the list makes it about four times slower. Equal items may change their relative order.',
    useWhen: 'The list is short and moving an item is expensive, or you only need the first few items in order.',
  },

  advanced: {
    history: 'Selection sort has no recorded inventor. It is a method people arrive at without being taught. Donald Knuth treats it as "straight selection" in the section of *The Art of Computer Programming* on sorting by selection, the same section that develops tree selection and heapsort as its faster descendants.',
    derivation: 'Round $i$ (for $i = 0, \\dots, n-2$) compares each of the $n-1-i$ values to the right of position $i$ with the current minimum, so\n\n$$\\text{comparisons} = \\sum_{i=0}^{n-2} (n-1-i) = \\frac{n(n-1)}{2}$$\n\non every input.\n\nFor swaps, suppose the values are distinct and view the input as a permutation that sends each position to the position its value belongs in. A swap in round $i$ puts the correct value at position $i$, which splits the cycle containing $i$ into a fixed point and a shorter cycle. Positions that are already fixed points cost nothing. So a permutation with $c$ cycles is sorted with exactly $n - c$ swaps. Any single swap changes the number of cycles by exactly one, so no method that sorts by swapping can use fewer than $n - c$. A random permutation has $H_n = 1 + \\tfrac12 + \\dots + \\tfrac1n$ cycles on average, so the expected number of swaps is $n - H_n$.',
    proof: 'Outer invariant: at the start of round $i$, $A[0..i-1]$ holds the $i$ smallest values in ascending order. It is true for $i = 0$. In round $i$ the inner loop maintains that $A[\\textit{min}]$ is the minimum of $A[i..j-1]$, so at its end $A[\\textit{min}]$ is the minimum of $A[i..n-1]$. Every value in the unsorted part is at least as large as every value in the sorted part, so this minimum is the $(i+1)$-th smallest value overall. Swapping it into position $i$ restores the invariant for $i+1$. After round $n-2$ the first $n-1$ positions hold the $n-1$ smallest values in order, so the value at position $n-1$ is the largest.',
    complexityProof: 'The loop bounds do not depend on the data, so the number of comparisons is the same for every input of length $n$: exactly $\\frac{n(n-1)}{2} = \\Theta(n^2)$. Each of the $n-1$ rounds performs at most one swap, giving at most $n-1$ swaps and $2(n-1)$ array writes. The rotated list $2, 3, \\dots, n, 1$ is a single cycle of length $n$ and attains the bound.',
    variants: [
      { name: 'Double-ended selection sort', text: 'Finds both the minimum and the maximum in each scan and places one at each end, halving the number of rounds. The number of comparisons stays quadratic.' },
      { name: 'Stable selection sort', text: 'Inserts the minimum at position `i` by shifting the values in between, instead of swapping. Stable, but with as many writes as insertion sort.' },
      { name: 'Heap sort', text: 'Keeps the unsorted part in a heap, so that the next extreme value is found in O(log n) rather than O(n).' },
      { name: 'Cycle sort', text: 'Follows each cycle of the permutation and writes every value directly into its final position, which minimizes the number of array writes rather than the number of swaps.' },
    ],
    implementation: 'Track the index of the minimum, not its value, and skip the swap when the minimum is already in place. To get only the k smallest values in order, stop the outer loop after k rounds. If stability matters, use insertion sort instead of patching selection sort.',
    benchmarking: 'Operation counts on this site are exact and repeatable. In timed tests selection sort often beats bubble sort because it writes so little, and usually loses to insertion sort on inputs with any existing order. When comparing, report comparisons and writes separately: this algorithm is at one extreme of that trade-off.',
    references: [
      { authors: 'D. E. Knuth', year: 1998, title: 'The Art of Computer Programming, Volume 3: Sorting and Searching (2nd edition), section 5.2.3', venue: 'Addison-Wesley' },
      { authors: 'R. Sedgewick and K. Wayne', year: 2011, title: 'Algorithms (4th edition), section 2.1', venue: 'Addison-Wesley' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, the selection sort exercise in the chapter "Getting Started".',
    ],
  },

  tests: [
    { name: 'sorts a random list with exactly n(n-1)/2 comparisons', input: { size: 40, order: 'random', seed: 11 }, check: sortedPermutation },
    { name: 'sorts a list with few distinct values', input: { size: 33, order: 'few', seed: 5 }, check: sortedPermutation },
    { name: 'sorts a reversed list', input: { size: 25, order: 'reversed', seed: 2 }, check: sortedPermutation },
    { name: 'never makes more than n - 1 swaps', input: { size: 50, order: 'random', seed: 23 },
      check: (r, c) => (r.swaps <= 49 && c.writes === 2 * r.swaps) || `made ${r.swaps} swaps and ${c.writes} writes` },
    { name: 'the worked example costs 10 comparisons and 2 swaps', input: { custom: [5, 3, 8, 1, 4] },
      check: (r, c) => (c.comparisons === 10 && r.swaps === 2 && c.writes === 4 && r.sorted.join(',') === '1,3,4,5,8') || `got ${c.comparisons} comparisons and ${r.swaps} swaps` },
    { name: 'a sorted list of 6 still costs 15 comparisons and makes no writes', input: { custom: [1, 2, 3, 4, 5, 6] },
      check: (r, c) => (c.comparisons === 15 && r.swaps === 0 && !c.writes) || `got ${c.comparisons} comparisons and ${r.swaps} swaps` },
    { name: 'generated sorted and random lists of 10 both cost 45 comparisons', input: { size: 10, order: 'sorted', seed: 7 },
      check: (r, c) => c.comparisons === 45 || `got ${c.comparisons} comparisons` },
    { name: 'a list rotated by one needs n - 1 = 7 swaps and 28 comparisons', input: { custom: [2, 3, 4, 5, 6, 7, 8, 1] },
      check: (r, c) => (r.swaps === 7 && c.comparisons === 28) || `got ${r.swaps} swaps and ${c.comparisons} comparisons` },
    { name: 'a reversed list of 8 needs only 4 swaps', input: { custom: [8, 7, 6, 5, 4, 3, 2, 1] },
      check: (r, c) => (r.swaps === 4 && c.comparisons === 28) || `got ${r.swaps} swaps and ${c.comparisons} comparisons` },
    { name: 'handles duplicates and negatives', input: { custom: [3, -1, 3, 0, -7, 3] },
      check: (r) => r.sorted.join(',') === '-7,-1,0,3,3,3' || `got ${r.sorted.join(',')}` },
    { name: 'a single value needs no comparisons', input: { custom: [42] },
      check: (r, c) => (r.sorted.join(',') === '42' && !c.comparisons) || 'a one-element list should cost nothing' },
  ],
};
