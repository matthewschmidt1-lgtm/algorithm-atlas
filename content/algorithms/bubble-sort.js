import { arrayInputs, resolveArray, isSorted, sameMultiset } from '../../js/lib/arrays.js';

const LEGEND = [
  { label: 'being compared', role: 'compare' },
  { label: 'swapped', role: 'swap' },
  { label: 'final position', role: 'sorted' },
];

function run(input, t) {
  const a = resolveArray(input);
  const original = a.slice();
  const n = a.length;
  const earlyExit = input.earlyExit !== false;
  let sortedFrom = n; // positions from here to the end hold their final values
  let passes = 0, swaps = 0;

  const view = (roles = {}, markers = []) => {
    const all = {};
    for (let k = sortedFrom; k < n; k++) all[k] = 'sorted';
    Object.assign(all, roles);
    return [{ kind: 'bars', values: a.slice(), roles: all, markers, range: sortedFrom > 0 ? [0, sortedFrom - 1] : undefined, legend: LEGEND }];
  };

  t.frame(() => ({ line: 0, note: `Start with ${n} values. Bubble sort walks along the list comparing each value with its right-hand neighbour, and swaps the two whenever the larger one is on the left.`, views: view() }));

  let end = n - 1;
  while (end > 0) {
    passes++;
    let swapped = false;
    t.frame(() => ({ line: [2, 3], note: `Pass ${passes}: walk from the left through positions 0 to ${end}. Nothing has been swapped in this pass yet.`, views: view(), vars: { pass: passes, end, swapped } }));
    for (let j = 0; j < end; j++) {
      t.count('comparisons');
      const wrong = a[j] > a[j + 1];
      t.frame(() => ({ line: 5,
        note: wrong
          ? `Compare the neighbours ${a[j]} and ${a[j + 1]}. The larger one is on the left, so they are in the wrong order.`
          : a[j] === a[j + 1]
            ? `Compare the neighbours ${a[j]} and ${a[j + 1]}. They are equal, so leave them where they are.`
            : `Compare the neighbours ${a[j]} and ${a[j + 1]}. They are already in order, so leave them.`,
        views: view({ [j]: 'compare', [j + 1]: 'compare' }, [{ index: j, label: 'j' }]), vars: { pass: passes, end, j, swapped } }));
      if (wrong) {
        const x = a[j]; a[j] = a[j + 1]; a[j + 1] = x;
        t.count('writes', 2);
        swaps++;
        swapped = true;
        t.frame(() => ({ line: [6, 7], note: `Swap them. ${a[j + 1]} moves one place to the right, and the pass remembers that it made a swap.`,
          views: view({ [j]: 'swap', [j + 1]: 'swap' }, [{ index: j, label: 'j' }]), vars: { pass: passes, end, j, swapped } }));
      }
    }
    if (!swapped && earlyExit) {
      sortedFrom = 0;
      t.frame(() => ({ line: 8, note: `Pass ${passes} made no swaps. Every value is in order with its neighbour, so the whole list is sorted and the work stops early.`, views: view(), vars: { pass: passes, end, swapped } }));
      break;
    }
    sortedFrom = end;
    t.frame(() => ({ line: 9,
      note: `Pass ${passes} is finished. The largest value in the unsorted part, ${a[end]}, has been carried to position ${end}. Nothing to its left is larger, so it will not move again.${swapped ? '' : ' The pass made no swaps, but stopping early is switched off, so the passes continue.'}`,
      views: view(), vars: { pass: passes, end, swapped } }));
    end--;
  }
  sortedFrom = 0;
  t.frame(() => ({ line: null, note: `Sorted after ${passes} ${passes === 1 ? 'pass' : 'passes'} and ${swaps} ${swaps === 1 ? 'swap' : 'swaps'}.`, views: view() }));
  return { sorted: a, original, passes, swaps };
}

const sortedPermutation = (r) => (isSorted(r.sorted) && sameMultiset(r.sorted, r.original)) || 'output is not a sorted permutation of the input';

export default {
  meta: {
    id: 'bubble-sort',
    name: 'Bubble Sort',
    aliases: ['sinking sort', 'exchange sort', 'sorting by exchange'],
    kind: 'algorithm',
    discipline: 'algorithms',
    alsoIn: [],
    subfield: 'Sorting',
    family: 'Comparison sorts',
    lab: 'sorting-searching',
    compareGroup: 'sorting',
    summary: 'Sorts by repeatedly swapping neighbours that are out of order. Simple to follow and quadratic in general, but it finishes in one pass on a list that is already sorted.',
    difficulty: 'beginner',
    order: 100,
    paradigms: ['brute-force', 'incremental'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', class: 'quadratic' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['sort a list', 'put numbers in order', 'order items', 'arrange values ascending', 'check whether a list is sorted'],
      techniques: ['adjacent swaps', 'repeated passes', 'early exit', 'in-place swapping'],
      applications: ['data processing'],
    },
    prerequisites: ['concept:array', 'concept:big-o'],
  },

  bigIdea: {
    simple: "Bubble sort is a way to put a list in order, such as arranging numbers from smallest to largest. It may be the simplest method there is. Look at the first two items. If they are in the wrong order, swap them. Then look at the second and third items and do the same. Keep going until you reach the end of the list. That is one pass. During a pass, the biggest item gets carried all the way to the end, a little like a bubble rising to the top of a glass. Now make another pass, and the next biggest item settles beside it. Repeat until a whole pass goes by without a single swap. That means every item is in order with its neighbour, so the list is sorted. Bubble sort is easy to follow but slow on long lists. People learn it first, and then learn why other methods are faster.",
    what: 'Bubble sort puts a list in order using one move only: compare two neighbouring values and swap them if the larger one is on the left. It sweeps through the list doing this to every neighbouring pair, and repeats the sweep until one full pass makes no swaps. Each pass carries the largest remaining value to the end of the unsorted part.',
    why: 'It is the shortest sorting method to state, and its behaviour can be checked by hand on a few numbers. That makes it a good first place to practise the questions asked of every algorithm: why does it finish, why is the answer right, and how does the work grow as the input grows?',
    when: 'For real work, almost never. On small or nearly sorted lists [insertion sort](#/algorithm/insertion-sort) does the same job with fewer operations, and on long lists [merge sort](#/algorithm/merge-sort) or [quick sort](#/algorithm/quick-sort) are far faster. Use bubble sort to learn, to explain sorting to someone else, or when a single pass that checks for sortedness and fixes one small slip is all you need.',
    interesting: 'The number of swaps is fixed by the input, not by any cleverness in the method. Each swap of two neighbours repairs exactly one pair of values that was out of order, so bubble sort makes exactly as many swaps as there are such pairs. Any sort that only ever swaps neighbours is stuck with the same count, which is why faster sorts move values over long distances.',
    where: 'Mostly in classrooms and textbooks. Its parallel relative, odd-even transposition sort, is studied in parallel computing because all of its comparisons within one round can happen at the same time.',
    analogy: {
      title: 'A row of people trading places by height',
      text: "People stand in a row in any order. Starting at the left, each person compares heights with the neighbour on their right, and the two trade places if the taller one is on the left. Now follow two people. The tallest person wins every comparison, so a single walk along the row carries them all the way to the right-hand end. The shortest person, if they start at the right-hand end, is less lucky: each walk gives them one trade, so they move only one place to the left per walk. That slow traveller is why a row can need many walks. When a whole walk happens with nobody trading places, the row is in height order.",
      limits: "In a real row, many pairs could trade places at the same moment, and anyone can glance along the row and see who is badly out of place. Bubble sort checks one pair at a time and never looks further than the next neighbour.",
    },
  },

  example: {
    setup: 'Sort the five numbers 5, 1, 4, 2, 8 from smallest to largest. A pass means walking through the list from the left, comparing each number with its right-hand neighbour.',
    steps: [
      'Pass 1, first pair: 5 and 1 are in the wrong order, so swap them. The list is 1, 5, 4, 2, 8.',
      'Pass 1 continues: 5 and 4 swap, then 5 and 2 swap, giving 1, 4, 2, 5, 8. The last pair, 5 and 8, is in order. That pass made 4 comparisons and 3 swaps, and the 8 at the end is now final.',
      'Pass 2 looks at the first four numbers only. 1 and 4 are in order. 4 and 2 swap, giving 1, 2, 4, 5, 8. 4 and 5 are in order. That is 3 comparisons and 1 swap.',
      'Pass 3 looks at the first three numbers. 1 and 2 are in order, and so are 2 and 4. That is 2 comparisons and no swaps.',
      'A pass with no swaps means every number is in order with its neighbour, so stop.',
    ],
    result: 'The list is 1, 2, 4, 5, 8 after 9 comparisons and 4 swaps. Notice that the list was already sorted at the end of pass 2. Bubble sort could not know that until pass 3 came back with nothing to swap.',
    tryInput: { custom: [5, 1, 4, 2, 8], earlyExit: true },
  },

  terms: [
    { term: 'Sorting', meaning: 'Rearranging a list so that its items are in order, for example from smallest to largest.' },
    { term: 'Comparison', meaning: 'One question of the form: is this item larger than that one? Counting comparisons is how we measure how much work a sort does.' },
    { term: 'Swap', meaning: 'Exchanging the positions of two items.' },
    { term: 'Pass', meaning: 'One walk along the list from left to right, comparing each item with its right-hand neighbour.' },
    { term: 'Inversion', meaning: 'A pair of items that are in the wrong order relative to each other, wherever they sit in the list.' },
    { term: 'Stable', meaning: 'A sort is stable if items of equal value come out in the same order they went in.' },
    { term: 'In place', meaning: 'Rearranging the items inside the original list, without making a second copy of it.' },
  ],

  takeaway: 'Keep swapping neighbours that are in the wrong order, and stop when a whole pass needs no swaps.',

  viz: {
    describe: 'A row of bars, one per value. The two neighbours being compared are ochre, a pair that has just been swapped is brick red, and values that have reached their final position at the right-hand end are forest green. A shaded band covers the part of the list that is still unsorted, and it shrinks by one bar after each pass.',
    inputs: [
      ...arrayInputs({ size: 10 }),
      { id: 'earlyExit', type: 'toggle', label: 'Stop when a pass makes no swaps', default: true,
        help: 'The early exit. Switch it off to see how many comparisons it saves.' },
    ],
    presets: [
      { label: 'Random list', values: { order: 'random', custom: [], earlyExit: true } },
      { label: 'Already sorted', values: { order: 'sorted', custom: [], earlyExit: true } },
      { label: 'One large value at the front', values: { custom: [8, 1, 2, 3, 4, 5, 6, 7], earlyExit: true } },
      { label: 'One small value at the end', values: { custom: [2, 3, 4, 5, 6, 7, 8, 1], earlyExit: true } },
    ],
    tryThis: [
      'Load "One large value at the front" and then "One small value at the end". Both lists need exactly 7 swaps, but the first is finished after 13 comparisons and the second needs 28. Watch how far the out-of-place value travels in each pass.',
      'Load "Already sorted" and note the comparison count. Then switch off "Stop when a pass makes no swaps" and run the same list again. The answer is the same, and the wasted comparisons are the cost of not checking.',
      'Set the starting order to "Reversed". Every comparison now leads to a swap. This is the most work bubble sort can ever do on a list of that length.',
    ],
    run,
    report: (r, c) => `Sorted ${r.sorted.length} values in ${r.passes} ${r.passes === 1 ? 'pass' : 'passes'} with ${c.comparisons || 0} comparisons and ${r.swaps} swaps (${c.writes || 0} array writes).\n[${r.sorted.join(', ')}]`,
    experiment: {
      title: 'Comparisons as the list grows',
      note: 'Each point is a real run of this page\'s implementation, with the early exit switched on. A random list needs nearly every pass. A list that is already sorted needs one.',
      metric: 'comparisons',
      metricLabel: 'Comparisons',
      sizeLabel: 'Number of items (n)',
      sizes: [8, 16, 32, 64, 128, 256, 512],
      variants: [
        { id: 'random', label: 'Random order' },
        { id: 'sorted', label: 'Already sorted' },
      ],
      input: (n, variant, seed) => ({ size: n, order: variant, seed, earlyExit: true, custom: [] }),
      theory: [
        { label: 'n(n − 1)/2 (most possible)', fn: (n) => (n * (n - 1)) / 2, variant: 'random' },
        { label: 'n − 1 (a single pass)', fn: (n) => n - 1, variant: 'sorted' },
      ],
    },
  },

  logic: {
    intuition: 'A list is sorted exactly when every value is no larger than its right-hand neighbour. Bubble sort attacks that condition directly: it finds a neighbouring pair that breaks it and swaps the pair. Each swap removes one out-of-order pair and creates none, so the swapping has to run out. When a full pass finds nothing to swap, the condition holds everywhere.',
    steps: [
      'Let `end` be the last position of the list. Everything after `end` is already final.',
      'Start a pass: remember that no swap has happened yet.',
      'Walk `j` from the first position to `end − 1`. Compare `A[j]` with `A[j + 1]`, and swap them if `A[j]` is larger.',
      'If the pass made no swaps, the list is sorted. Stop.',
      'Otherwise the largest value of the unsorted part is now at `end`. Move `end` one position to the left and start another pass.',
      'Stop when `end` reaches the first position, because a single value is always in order.',
    ],
    pseudocode: [
      'bubble_sort(A):',
      '  end ← length(A) − 1',
      '  while end > 0:',
      '    swapped ← false',
      '    for j from 0 to end − 1:',
      '      if A[j] > A[j + 1]:',
      '        swap A[j] and A[j + 1]',
      '        swapped ← true',
      '    if not swapped: stop',
      '    end ← end − 1',
    ],
    decisions: [
      { title: 'Swap when greater, or when greater or equal?', text: 'Swap only when the left value is strictly greater. Equal values then never pass each other, which is what makes bubble sort stable. Using "greater or equal" still sorts, but it throws stability away and makes swaps that achieve nothing.' },
      { title: 'How far should each pass go?', text: 'After the first pass the largest value is at the end, after the second the two largest are, and so on. Each pass can therefore stop one position earlier than the last. This halves the comparisons in the worst case and costs one line.' },
      { title: 'When can it stop?', text: 'As soon as a pass makes no swaps. Without this check, bubble sort does the same number of comparisons on every input. With it, a sorted list costs a single pass.' },
    ],
    invariants: [
      'After `k` passes, the last `k` positions hold the `k` largest values in sorted order, and they never change again.',
      'A swap exchanges two neighbours that are out of order, so it reduces the number of inversions by exactly one.',
      'If a pass makes no swaps, then `A[j] ≤ A[j + 1]` for every `j` in the unsorted part.',
    ],
    edgeCases: [
      'An empty list or a single value: the loop never runs and nothing is compared.',
      'An already sorted list: one pass of n − 1 comparisons, no swaps, then the early exit.',
      'A reversed list of distinct values: every comparison causes a swap, n(n − 1)/2 of each.',
      'Equal values: they are never swapped with each other, so they keep their original order.',
      'One small value at the far right: it moves left by only one position per pass, so nearly every pass is needed even though the list looks almost sorted.',
    ],
    correctness: 'Consider one pass over positions `0` to `end`. As `j` advances, `A[j]` is always the largest value seen so far in the pass, because any larger value met on the way takes over the role and any smaller neighbour is swapped behind it. So when the pass ends, the largest value of `A[0..end]` sits at `end`. By induction, after `k` passes the last `k` positions hold the `k` largest values in order, and after n − 1 passes the whole list is sorted. The early exit is also safe: a pass with no swaps has checked that every neighbouring pair in the unsorted part is in order, and that part is followed by values that are all at least as large.',
    mistakes: [
      'Letting `j` run all the way to `end`, so that `A[j + 1]` reads one position past the list.',
      'Setting `swapped` to false once before the loop instead of at the start of every pass. The sort still works, but the early exit can no longer fire after the first swap.',
      'Using `>=` in the comparison, which makes the sort unstable.',
      'Assuming a list that looks nearly sorted will be quick. That depends on which values are out of place and in which direction they must travel.',
    ],
  },

  code: {
    sample: {
      input: 'The list [29, 10, 14, 37, 13, 5, 31, 22]. Prints the sorted list and the number of passes used.',
      expected: '5 10 13 14 22 29 31 37\npasses: 6',
    },
    python: {
      source: `def bubble_sort(a):
    end = len(a) - 1
    passes = 0
    while end > 0:
        passes += 1
        swapped = False
        for j in range(end):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True
        if not swapped:
            break
        end -= 1
    return passes


data = [29, 10, 14, 37, 13, 5, 31, 22]
passes = bubble_sort(data)
print(" ".join(str(x) for x in data))
print("passes:", passes)`,
      notes: [
        { line: 2, text: '`end` is the last position that is still unsorted. Everything to its right is final.' },
        { line: 6, text: 'The flag is reset at the start of every pass. Resetting it only once, before the loop, is a common bug.' },
        { line: 8, text: 'The only comparison in the algorithm. The strict `>` keeps equal values in their original order.' },
        { line: 11, text: 'The early exit: a pass without a swap proves the list is sorted.' },
        { line: 13, text: 'The pass just finished put the largest remaining value at `end`, so the next pass can stop one position sooner.' },
      ],
    },
    javascript: {
      source: `function bubbleSort(a) {
  let end = a.length - 1;
  let passes = 0;
  while (end > 0) {
    passes++;
    let swapped = false;
    for (let j = 0; j < end; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
      }
    }
    if (!swapped) break;
    end--;
  }
  return passes;
}

const data = [29, 10, 14, 37, 13, 5, 31, 22];
const passes = bubbleSort(data);
console.log(data.join(" "));
console.log("passes: " + passes);`,
    },
    cpp: {
      source: `#include <iostream>
#include <utility>
#include <vector>

int bubbleSort(std::vector<int>& a) {
    int end = static_cast<int>(a.size()) - 1;
    int passes = 0;
    while (end > 0) {
        ++passes;
        bool swapped = false;
        for (int j = 0; j < end; ++j) {
            if (a[j] > a[j + 1]) {
                std::swap(a[j], a[j + 1]);
                swapped = true;
            }
        }
        if (!swapped) break;
        --end;
    }
    return passes;
}

int main() {
    std::vector<int> data = {29, 10, 14, 37, 13, 5, 31, 22};
    int passes = bubbleSort(data);
    for (std::size_t k = 0; k < data.size(); ++k) {
        std::cout << data[k] << (k + 1 < data.size() ? " " : "\\n");
    }
    std::cout << "passes: " << passes << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'A pass over an unsorted part of m values makes m − 1 comparisons. In the worst case there are n − 1 passes over parts of size n, n − 1, ..., 2, which adds up to n(n − 1)/2 comparisons. Doubling the length of the list roughly quadruples the work.',
    cases: [
      { case: 'Best', time: 'O(n)', when: 'The list is already sorted. One pass of n − 1 comparisons makes no swaps and the early exit fires.' },
      { case: 'Average', time: 'O(n²)', when: 'Values in random order. Nearly every pass is needed, and a list of n distinct values in random order holds n(n − 1)/4 inversions on average, each costing one swap.' },
      { case: 'Worst', time: 'O(n²)', when: 'The list is in reverse order: n(n − 1)/2 comparisons and the same number of swaps.' },
    ],
    space: 'O(1). The sort rearranges the list in place and needs only a few variables: the pass boundary, the loop index, the flag and one temporary value for swapping.',
    memory: 'It reads and writes neighbouring positions in order, which suits processor caches well. That does not rescue it: the number of comparisons and writes is too large for the access pattern to matter.',
    tradeoffs: 'Bubble sort buys simplicity, stability and constant extra memory at the price of quadratic time. Insertion sort offers the same three properties with fewer comparisons and writes on typical inputs, which is why it is the quadratic sort actually used in practice.',
    assumptions: [
      'Comparing two values and swapping two values each take constant time.',
      'The best case assumes the early exit is implemented. Without it, every input costs n(n − 1)/2 comparisons.',
      'The average case assumes distinct values with every ordering equally likely.',
      'Counts on this page are comparisons and array writes performed by this implementation, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Teaching: every step is a comparison of two neighbours, so the whole run can be followed by hand.',
      'Lists that are already sorted or have only large values slightly too far left: one or two passes finish the job.',
      'Situations where only neighbouring items can be exchanged.',
    ],
    struggles: [
      'Any list of more than a few dozen values in no particular order.',
      'Reversed or nearly reversed input, which needs the maximum number of swaps.',
      'Lists with a small value near the right-hand end, which moves left by one position per pass.',
      'Data where writes are expensive, because it performs far more of them than selection sort.',
    ],
    pitfalls: [
      'Leaving out the early exit and then claiming a linear best case.',
      'Running the inner loop over the whole list on every pass instead of stopping at the sorted tail.',
      'Reading `A[j + 1]` one position past the end of the list.',
    ],
    misunderstandings: [
      '"Bubble sort is fine for small lists." It works, but insertion sort is just as short to write and typically does less work on the same list, so there is little reason to choose bubble sort.',
      '"The early exit makes it fast on nearly sorted lists." Only on some of them. A single small value at the far end still forces almost every pass, because it can move left by just one position per pass.',
      '"After each pass the list is closer to sorted everywhere." The guarantee is narrower: one more value has reached its final position at the right-hand end. The rest may still be in any order.',
      '"It compares every pair of values." It only ever compares neighbours. Two values that start far apart are compared only if swaps bring them next to each other.',
    ],
    constraints: [
      'Because each swap removes exactly one inversion, no arrangement of the loops can make a neighbour-swapping sort faster than quadratic on average.',
    ],
    alternatives: [
      { id: 'insertion-sort', name: 'Insertion Sort', when: 'You want a simple, stable, in-place sort for small or nearly sorted lists. It is better than bubble sort at the same job.' },
      { id: 'selection-sort', name: 'Selection Sort', when: 'Writes are costly: it makes at most n − 1 swaps.' },
      { id: 'merge-sort', name: 'Merge Sort', when: 'The list is long and you need a stable sort with guaranteed O(n log n) time.' },
      { id: 'quick-sort', name: 'Quick Sort', when: 'The list is long, memory is tight and stability does not matter.' },
    ],
    comparison: {
      columns: ['', 'Bubble sort', 'Selection sort', 'Insertion sort'],
      rows: [
        ['Comparisons, sorted input', 'n − 1', 'n(n − 1)/2', 'n − 1'],
        ['Comparisons, worst case', 'n(n − 1)/2', 'n(n − 1)/2', 'n(n − 1)/2'],
        ['Element moves, worst case', 'n(n − 1)/2 swaps', 'n − 1 swaps', 'n(n − 1)/2 shifts'],
        ['Stable', 'Yes', 'No', 'Yes'],
        ['Extra space', 'O(1)', 'O(1)', 'O(1)'],
      ],
    },
  },

  applications: [
    { title: 'A first algorithm to analyse', status: 'established', text: 'Introductory courses and textbooks use bubble sort to introduce loops over arrays, swapping, loop invariants and counting operations, because each step is small enough to check by hand.' },
    { title: 'Parallel sorting by neighbour exchange', status: 'established', text: 'Odd-even transposition sort applies bubble sort\'s compare-and-swap to all odd-positioned pairs at once, then to all even-positioned pairs, and repeats. It is a standard example in the study of parallel algorithms and sorting networks.' },
    { title: 'Checking that a list is sorted', status: 'illustrative', text: 'A single pass with no swaps is a complete test of sortedness. If the pass does find one neighbouring pair out of order, it repairs it on the way.' },
    { title: 'Repairing a list that changes slightly', status: 'illustrative', text: 'When a sorted list is disturbed a little between uses, for example objects ordered by distance that each move a small amount, one or two passes can restore the order. Insertion sort handles the same situation at least as well.' },
  ],

  connections: [
    { to: 'insertion-sort', type: 'same-problem', why: 'Both remove inversions one at a time by moving values past their neighbours, so both make the same number of element moves on a given input. Insertion sort usually reaches the same result with fewer comparisons.' },
    { to: 'selection-sort', type: 'same-problem', why: 'Both fix one more final position per pass. Bubble sort carries the largest value there with many swaps; selection sort finds it first and moves it with one.' },
    { to: 'quick-sort', type: 'advanced', why: 'Both sort by exchanging pairs that are out of order. Quick sort exchanges values that are far apart, so one swap can remove many inversions instead of one.' },
    { to: 'merge-sort', type: 'advanced', why: 'Merging two sorted runs moves a value past many others in one step, which is how merge sort escapes the one-inversion-per-move limit that binds bubble sort.' },
    { to: 'concept:invariant', type: 'prerequisite', why: 'Its correctness rests on one loop invariant: after k passes the last k positions hold the k largest values in order.' },
    { to: 'concept:stability', type: 'related', why: 'Swapping only strictly out-of-order neighbours means equal values never pass each other, which is the definition of a stable sort.' },
    { to: 'concept:in-place', type: 'related', why: 'It rearranges the list using swaps alone and needs no second copy of the data.' },
    { to: 'concept:comparison-model', type: 'related', why: 'It learns about the input only by comparing pairs of values, so it is bound by the limits that apply to all comparison sorts.' },
    { to: 'discipline:distributed-systems', type: 'application', why: 'Its parallel form, odd-even transposition sort, needs only exchanges between neighbouring processors, the simplest communication pattern a line of machines can have.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'After the first pass of bubble sort over a list, what is guaranteed?',
      options: ['The smallest value is in the first position', 'The largest value is in the last position', 'The list is sorted', 'The first half of the list is sorted'],
      answer: 1,
      explain: [
        'A small value moves left by at most one position per pass, so it may still be far from the front.',
        'Correct. Once the pass meets the largest value it carries it along through every later comparison, all the way to the end.',
        'One pass is enough only for some inputs, such as a sorted list or one large value out of place.',
        'A pass makes no promise about the front of the list. Only the last position is certain.',
      ],
    },
    {
      type: 'predict',
      q: 'The list is 6, 5, 4, 3, 2, 1. How many comparisons will bubble sort make before it finishes?',
      options: ['5', '15', '30', '36'],
      answer: 1,
      explain: [
        '5 is the cost of the first pass alone. That pass moves only the 6 into place.',
        'Correct. The passes cover 6, 5, 4, 3 and 2 values, costing 5 + 4 + 3 + 2 + 1 = 15 comparisons, and every one of them causes a swap.',
        '30 is the number of array writes: 15 swaps, each writing two positions.',
        '36 is n × n. Each pass is one comparison shorter than the last, so the total is n(n − 1)/2.',
      ],
      tryInput: { custom: [6, 5, 4, 3, 2, 1], earlyExit: true },
    },
    {
      type: 'debug',
      q: 'This version sorts correctly, but on the list 2, 1, 3, 4, 5, 6 it runs every pass instead of stopping after the second. Which line is at fault?',
      code: `def bubble_sort(a):
    end = len(a) - 1
    swapped = False
    while end > 0:
        for j in range(end):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True
        if not swapped:
            break
        end -= 1`,
      options: ['Line 3: the flag must be reset inside the while loop, at the start of each pass', 'Line 5: the range should be end + 1', 'Line 6: the comparison should be >=', 'Line 11: end should not shrink'],
      answer: 0,
      explain: [
        'Correct. The first pass sets the flag to true and nothing ever sets it back, so the test on line 9 can never succeed again.',
        'That would read `a[j + 1]` one position past the unsorted part, and past the end of the list on the first pass.',
        'That would swap equal values, losing stability and making the early exit even less likely.',
        'Shrinking `end` is correct: the value at `end` is final after each pass.',
      ],
    },
    {
      type: 'choice',
      q: 'A list has exactly 3 pairs of values that are out of order relative to each other. How many swaps will bubble sort make?',
      options: ['Exactly 3', 'At most 3, possibly fewer', 'At least 3, possibly more', 'It depends on the length of the list'],
      answer: 0,
      explain: [
        'Correct. Each swap of two out-of-order neighbours fixes that one pair and changes no other pair, so the number of swaps equals the number of inversions.',
        'A swap can never fix more than one pair, because the two values involved keep their order relative to everything else.',
        'Bubble sort never swaps a pair that is already in order, so it cannot create extra work for itself.',
        'The length affects the number of comparisons. The number of swaps depends only on the inversions.',
      ],
    },
    {
      type: 'challenge',
      title: 'Cocktail shaker sort',
      prompt: 'Change bubble sort so that passes alternate direction: one pass left to right carrying the largest value to the right end, then one pass right to left carrying the smallest value to the left end. Shrink the unsorted part from both sides. Count comparisons on the list 2, 3, 4, 5, 6, 7, 8, 1, where plain bubble sort needs 28, and explain the difference.',
      hints: ['Keep two boundaries, `lo` and `hi`, and stop when they meet or when a pass in either direction makes no swaps.', 'The backward pass compares `A[j − 1]` with `A[j]` while `j` walks down from `hi` to `lo + 1`.'],
    },
  ],

  compare: {
    idea: 'Swap neighbours that are out of order, pass after pass, until a pass makes no swaps.',
    requires: 'Any list whose items can be compared. It is always correct. Only its speed depends on the list.',
    sensitivity: 'High. A sorted list costs n − 1 comparisons; a reversed list costs n(n − 1)/2 comparisons and as many swaps.',
    memory: 'In place. A few variables of extra space.',
    difficulty: 'low',
    difficultyNote: 'Two nested loops and a flag. The usual slips are the loop bound and forgetting to reset the flag.',
    limits: 'Very slow on long lists: doubling the list makes it about four times slower. Insertion sort beats it on almost every list.',
    useWhen: 'You are learning or teaching, or one pass to confirm a list is in order and repair it lightly is enough.',
  },

  advanced: {
    history: 'The method is old enough that it has no single inventor on record. Edward Friend described it in a 1956 paper on sorting with electronic computers, where it is called sorting by exchange. According to Owen Astrachan\'s survey of the literature, the earliest use of the name "bubble sort" that he could find is in Kenneth Iverson\'s 1962 book *A Programming Language*. Knuth\'s verdict in *The Art of Computer Programming* is that the method has little to recommend it beyond its name and some interesting mathematical questions.',
    derivation: 'Call a pair of positions $i < j$ an *inversion* if $A[i] > A[j]$. Swapping two neighbours that are out of order removes that one inversion and leaves every other pair in the same relative order, so the number of swaps bubble sort makes equals the number of inversions in the input.\n\nFor $n$ distinct values in random order, each of the $\\binom{n}{2}$ pairs is inverted with probability $\\tfrac12$, so by linearity of expectation\n\n$$E[\\text{swaps}] = \\frac{1}{2}\\binom{n}{2} = \\frac{n(n-1)}{4}.$$\n\nThe maximum, $\\binom{n}{2} = \\frac{n(n-1)}{2}$, occurs when every pair is inverted, which is the reversed list.',
    proof: 'Claim: after pass $k$, positions $n-k, \\dots, n-1$ hold the $k$ largest values in ascending order. For $k = 0$ there is nothing to show. Assume the claim after pass $k-1$ and consider pass $k$, which scans positions $0$ to $n-k$. Inside the scan, after the comparison at index $j$, the value at $j+1$ is the maximum of $A[0..j+1]$: this holds for $j = 0$, and each later comparison either keeps the larger right-hand value or swaps the larger left-hand value forward. When the scan ends, position $n-k$ holds the maximum of the unsorted part, which is the $k$-th largest value overall. That proves the claim, and with $k = n-1$ the whole list is sorted.\n\nEarly exit: if a pass makes no swaps then $A[j] \\le A[j+1]$ for every $j$ it examined, so the unsorted part is in order, and by the claim every value after it is at least as large.',
    complexityProof: 'Pass $k$ makes $n - k$ comparisons. With at most $n - 1$ passes the total is at most $\\sum_{k=1}^{n-1} (n-k) = \\frac{n(n-1)}{2}$. The reversed list of distinct values attains this bound, because every comparison finds an inversion and so no pass is free of swaps. On sorted input the first pass makes $n-1$ comparisons and no swaps, and the algorithm stops.',
    variants: [
      { name: 'Cocktail shaker sort', text: 'Alternates left-to-right and right-to-left passes, so small values near the right end travel as quickly as large values near the left end. Still quadratic.' },
      { name: 'Last-swap boundary', text: 'Instead of shrinking the unsorted part by one, shrink it to the position of the last swap in the pass. Everything beyond that point was found to be in order.' },
      { name: 'Comb sort', text: 'Compares values a fixed gap apart and shrinks the gap each pass, finishing with gap 1. Long-distance swaps remove many inversions early.' },
      { name: 'Odd-even transposition sort', text: 'Alternates between comparing all pairs that start at even positions and all pairs that start at odd positions. The comparisons within one round are independent, so they can run in parallel.' },
    ],
    implementation: 'If you must write it, include both refinements: stop each pass before the sorted tail, and exit when a pass makes no swaps. Keep the comparison strict so the sort stays stable. In almost every practical setting, write insertion sort instead.',
    benchmarking: 'Operation counts on this site are exact and repeatable. In timed tests on random input bubble sort is usually the slowest of the three simple quadratic sorts. It also performs the most array writes of the three.',
    references: [
      { authors: 'D. E. Knuth', year: 1998, title: 'The Art of Computer Programming, Volume 3: Sorting and Searching (2nd edition), section 5.2.2', venue: 'Addison-Wesley' },
      { authors: 'E. H. Friend', year: 1956, title: 'Sorting on electronic computer systems', venue: 'Journal of the ACM 3(3), 134-168' },
      { authors: 'O. Astrachan', year: 2003, title: 'Bubble sort: an archaeological algorithmic analysis', venue: 'Proceedings of the 34th SIGCSE Technical Symposium on Computer Science Education' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, problem "Correctness of bubblesort" in the chapter "Getting Started".',
      'R. Sedgewick and K. Wayne, *Algorithms* (4th edition), section 2.1, for the elementary sorts that are preferred in practice.',
    ],
  },

  tests: [
    { name: 'sorts a random list', input: { size: 40, order: 'random', seed: 11 }, check: sortedPermutation },
    { name: 'sorts a list with few distinct values', input: { size: 33, order: 'few', seed: 5 }, check: sortedPermutation },
    { name: 'sorts a nearly sorted list with the early exit off', input: { size: 20, order: 'nearly', seed: 3, earlyExit: false }, check: sortedPermutation },
    { name: 'the worked example costs 9 comparisons and 4 swaps in 3 passes', input: { custom: [5, 1, 4, 2, 8], earlyExit: true },
      check: (r, c) => (c.comparisons === 9 && r.swaps === 4 && c.writes === 8 && r.passes === 3 && r.sorted.join(',') === '1,2,4,5,8') || `got ${c.comparisons} comparisons, ${r.swaps} swaps, ${r.passes} passes` },
    { name: 'without the early exit the worked example costs n(n-1)/2 = 10 comparisons', input: { custom: [5, 1, 4, 2, 8], earlyExit: false },
      check: (r, c) => c.comparisons === 10 || `got ${c.comparisons} comparisons` },
    { name: 'a reversed list of 6 costs 15 comparisons and 15 swaps', input: { custom: [6, 5, 4, 3, 2, 1], earlyExit: true },
      check: (r, c) => (c.comparisons === 15 && r.swaps === 15 && c.writes === 30) || `got ${c.comparisons} comparisons and ${r.swaps} swaps` },
    { name: 'sorted input costs n - 1 comparisons and no writes', input: { size: 8, order: 'sorted', seed: 1, earlyExit: true },
      check: (r, c) => (c.comparisons === 7 && !c.writes && r.passes === 1) || `got ${c.comparisons} comparisons and ${c.writes} writes` },
    { name: 'one large value at the front: 13 comparisons, 7 swaps', input: { custom: [8, 1, 2, 3, 4, 5, 6, 7], earlyExit: true },
      check: (r, c) => (c.comparisons === 13 && r.swaps === 7) || `got ${c.comparisons} comparisons and ${r.swaps} swaps` },
    { name: 'one small value at the end: 28 comparisons, 7 swaps', input: { custom: [2, 3, 4, 5, 6, 7, 8, 1], earlyExit: true },
      check: (r, c) => (c.comparisons === 28 && r.swaps === 7) || `got ${c.comparisons} comparisons and ${r.swaps} swaps` },
    { name: 'handles duplicates and negatives', input: { custom: [3, -1, 3, 0, -7, 3] },
      check: (r) => r.sorted.join(',') === '-7,-1,0,3,3,3' || `got ${r.sorted.join(',')}` },
    { name: 'a single value needs no comparisons', input: { custom: [42] },
      check: (r, c) => (r.sorted.join(',') === '42' && !c.comparisons) || 'a one-element list should cost nothing' },
  ],
};
