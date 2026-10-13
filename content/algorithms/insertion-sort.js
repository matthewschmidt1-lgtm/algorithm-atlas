import { arrayInputs, resolveArray, isSorted, sameMultiset } from '../../js/lib/arrays.js';

const LEGEND = [
  { label: 'key being inserted', role: 'active' },
  { label: 'being compared', role: 'compare' },
  { label: 'shifted right', role: 'swap' },
  { label: 'in order so far', role: 'moss' },
  { label: 'sorted', role: 'sorted' },
];

function run(input, t) {
  const a = resolveArray(input);
  const original = a.slice();
  const n = a.length;
  let shifts = 0;
  let ordered = Math.min(1, n); // positions before this one are in order among themselves
  let finished = false;

  // While a key is held aside, the picture draws it above the gap where it would be dropped.
  const view = ({ gap = -1, key, roles = {}, markers = [] } = {}) => {
    const values = a.slice();
    if (gap >= 0) values[gap] = key;
    const all = {};
    for (let k = 0; k < n; k++) {
      if (finished) all[k] = 'sorted';
      else if (k < ordered) all[k] = 'moss';
    }
    Object.assign(all, roles);
    if (gap >= 0) all[gap] = 'active';
    return [{ kind: 'bars', values, roles: all, markers, range: !finished && ordered > 0 ? [0, ordered - 1] : undefined, legend: LEGEND }];
  };

  t.frame(() => ({ line: 0, note: `Start with ${n} values. Insertion sort grows an ordered group at the left. A single value is in order by definition, so the group starts as just the first value${n ? `, ${a[0]}` : ''}.`, views: view() }));

  for (let i = 1; i < n; i++) {
    const key = a[i];
    let j = i - 1;
    ordered = i + 1;
    t.frame(() => ({ line: [2, 3, 4], note: `Take the next value, **${key}**, as the key. The ${i === 1 ? 'value' : `${i} values`} to its left ${i === 1 ? 'is' : 'are'} already in order. Find where ${key} belongs among them, starting from the right.`,
      views: view({ gap: i, key, markers: [{ index: i, label: 'key' }] }), vars: { i, key } }));
    while (j >= 0) {
      t.count('comparisons');
      const larger = a[j] > key;
      t.frame(() => ({ line: 5,
        note: larger
          ? `Is ${a[j]} larger than the key ${key}? Yes, so ${a[j]} has to move right to make room.`
          : `Is ${a[j]} larger than the key ${key}? No${a[j] === key ? ', they are equal' : ''}. The key belongs just to the right of this ${a[j]}, so the search stops.`,
        views: view({ gap: j + 1, key, roles: { [j]: 'compare' }, markers: [{ index: j + 1, label: 'key' }, { index: j, label: 'j' }] }), vars: { i, j, key } }));
      if (!larger) break;
      a[j + 1] = a[j];
      t.count('writes');
      shifts++;
      j--;
      t.frame(() => ({ line: [6, 7], note: `Shift ${a[j + 2]} one place to the right. The gap for the key is now at position ${j + 1}.`,
        views: view({ gap: j + 1, key, roles: { [j + 2]: 'swap' }, markers: [{ index: j + 1, label: 'key' }] }), vars: { i, j, key } }));
    }
    a[j + 1] = key;
    t.count('writes');
    const moved = i - (j + 1);
    t.frame(() => ({ line: 8,
      note: `${moved === 0
        ? `${key} is not smaller than its left-hand neighbour, so it is written back where it was.`
        : j < 0
          ? `The gap has reached the front of the list, so ${key} is the smallest value so far. Write it into position 0.`
          : `Write ${key} into the gap at position ${j + 1}.`} The first ${i + 1} values are now in order.`,
      views: view({ gap: j + 1, key, markers: [{ index: j + 1, label: 'key' }] }), vars: { i, key, 'moved left by': moved } }));
  }
  finished = true;
  t.frame(() => ({ line: null, note: `Sorted. Every value has been inserted into the ordered group, using ${shifts} ${shifts === 1 ? 'shift' : 'shifts'} in total.`, views: view() }));
  return { sorted: a, original, shifts };
}

const inversions = (a) => {
  let count = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) count++;
  return count;
};
const harmonic = (n) => { let h = 0; for (let k = 1; k <= n; k++) h += 1 / k; return h; };

// Independent checks: the output is a sorted permutation, every shift removed exactly one inversion,
// and the comparisons stay within inversions + (n - 1).
const checkRun = (r, c) => {
  if (!isSorted(r.sorted) || !sameMultiset(r.sorted, r.original)) return 'output is not a sorted permutation of the input';
  const n = r.original.length, d = inversions(r.original);
  if (r.shifts !== d) return `made ${r.shifts} shifts but the input has ${d} inversions`;
  if ((c.writes || 0) !== d + Math.max(0, n - 1)) return `expected ${d + n - 1} writes, got ${c.writes}`;
  const comps = c.comparisons || 0;
  return (comps >= d && comps <= d + Math.max(0, n - 1)) || `comparisons ${comps} outside [${d}, ${d + n - 1}]`;
};

export default {
  meta: {
    id: 'insertion-sort',
    name: 'Insertion Sort',
    aliases: ['straight insertion', 'insertion sorting', 'card sort'],
    kind: 'algorithm',
    discipline: 'algorithms',
    alsoIn: [],
    subfield: 'Sorting',
    family: 'Comparison sorts',
    lab: 'sorting-searching',
    compareGroup: 'sorting',
    summary: 'Sorts by inserting each value into place among those already in order. Quadratic in general, close to linear on nearly sorted input, and the finisher inside hybrid sorts.',
    difficulty: 'beginner',
    order: 120,
    paradigms: ['incremental'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', class: 'quadratic' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['sort a list', 'put numbers in order', 'sort a hand of cards', 'keep a list sorted as items arrive', 'sort a nearly sorted list'],
      techniques: ['shifting', 'incremental insertion', 'adaptive sorting', 'small-range cutoff'],
      applications: ['standard libraries', 'data processing'],
    },
    prerequisites: ['concept:array', 'concept:big-o', 'concept:invariant'],
  },

  bigIdea: {
    simple: "Insertion sort is a way to put a list in order, and it is how most people sort a hand of playing cards. Pick up the cards one at a time. The first card is in order by itself. Take the second card and put it before or after the first, whichever is right. Take the third card and slide it into the right place among the first two. Carry on like this. Each new card goes into its correct place among the cards you already hold, so the cards in your hand are always in order. When there are no cards left to pick up, the whole hand is sorted. This method is quick when the list is short. It is very quick when the list is almost in order already, because each item is then close to where it belongs. On a long, jumbled list it is slow, because items have to travel a long way.",
    what: 'Insertion sort keeps an ordered group at the left of the list and grows it by one value at a time. It takes the next value, called the key, and compares it with the values in the ordered group from right to left. Every value larger than the key is shifted one place to the right, and the key is written into the gap that opens up.',
    why: 'It does an amount of work that matches how disordered the input is. A list that is already sorted costs one comparison per value. A list with a few values out of place costs a little more. That property, together with very low overhead, is why fast library sorts hand their small pieces to insertion sort.',
    when: 'Use it for short lists (a few dozen items at most), for lists that are already nearly sorted, and when items arrive one at a time and the list must stay sorted throughout. For long lists in no particular order use [merge sort](#/algorithm/merge-sort), [quick sort](#/algorithm/quick-sort) or [heap sort](#/algorithm/heap-sort). In practice those sorts usually call insertion sort themselves once their pieces become small.',
    interesting: 'It has the worst growth rate of the well-known sorts and is still part of the fastest ones. Its running time is n plus the number of out-of-order pairs in the input, so it ranges smoothly from linear on sorted data to quadratic on reversed data. Almost no other sort gets that for free.',
    where: 'Inside the standard library sorts of many languages. Python\'s built-in sort, Timsort, uses a form of insertion sort to build its short runs, and typical implementations of C++ `std::sort` finish small ranges with it.',
    analogy: {
      title: 'Sorting a hand of cards',
      text: 'You hold a few cards in your left hand, already in order. You pick up one more card with your right hand, look along the held cards from the right until you find one that is not larger, and slide the new card in just after it. Your left hand is in order again, with one more card. Repeat until the table is empty.',
      limits: 'With real cards, opening a gap is a single motion of the fingers. In a list stored in a computer, there is no free space between items: every larger value has to be copied one place to the right, one at a time, and that copying is where most of the time goes. A person also finds the place at a glance, while the algorithm compares one card after another.',
    },
  },

  example: {
    setup: 'Sort the five numbers 5, 2, 4, 6, 1 from smallest to largest. The first number, 5, starts as an ordered group of one. Each step takes the next number, called the key, and inserts it into the group.',
    steps: [
      'The key is 2. Compare it with 5: 5 is larger, so shift 5 one place to the right. The front of the list has been reached, so write 2 there. The list is 2, 5, 4, 6, 1.',
      'The key is 4. 5 is larger, so shift it right. 2 is not larger, so stop and write 4 after the 2. The list is 2, 4, 5, 6, 1.',
      'The key is 6. Compare it with 5: 5 is not larger, so 6 stays where it is. That took one comparison and no shifts.',
      'The key is 1. Each of 6, 5, 4 and 2 is larger, so each is shifted one place to the right. Write 1 at the front. The list is 1, 2, 4, 5, 6.',
    ],
    result: 'The list is 1, 2, 4, 5, 6 after 8 comparisons and 6 shifts. The 6 was already in a good place and cost a single comparison. The 1 was as far from its place as it could be and cost four comparisons and four shifts.',
    tryInput: { custom: [5, 2, 4, 6, 1] },
  },

  terms: [
    { term: 'Sorting', meaning: 'Rearranging a list so that its items are in order, for example from smallest to largest.' },
    { term: 'Key', meaning: 'The item currently being inserted. It is held aside while larger items are moved out of its way.' },
    { term: 'Comparison', meaning: 'One question of the form: is this item larger than the key? Counting comparisons is one way to measure the work a sort does.' },
    { term: 'Shift', meaning: 'Copying an item one position to the right to open a gap for the key.' },
    { term: 'Inversion', meaning: 'A pair of items that are in the wrong order relative to each other, wherever they sit in the list.' },
    { term: 'Adaptive', meaning: 'A sort is adaptive if it does less work when its input is already partly in order.' },
    { term: 'Stable', meaning: 'A sort is stable if items of equal value come out in the same order they went in.' },
    { term: 'Hybrid sort', meaning: 'A sort that combines two or more methods, using each where it is strongest.' },
  ],

  takeaway: 'Take each item in turn and slide it left into its place among the items already in order.',

  viz: {
    describe: 'A row of bars, one per value. The key being inserted is terracotta and carries the marker "key". The algorithm holds the key aside, and the picture draws it above the gap where it would be dropped. The value being compared with the key is ochre, a value that has just been shifted right is brick red, and the group at the left that is in order so far is moss green inside a shaded band. When the run ends every bar turns forest green.',
    inputs: arrayInputs({ size: 10 }),
    presets: [
      { label: 'Random list', values: { order: 'random', custom: [] } },
      { label: 'Nearly sorted', values: { order: 'nearly', custom: [] } },
      { label: 'Already sorted', values: { order: 'sorted', custom: [] } },
      { label: 'Reversed: worst case', values: { order: 'reversed', custom: [] } },
    ],
    tryThis: [
      'Load "Already sorted", then "Nearly sorted", then "Random list", and compare the comparison counts. With 10 items a sorted list costs exactly 9 comparisons. The count rises with the amount of disorder, not with the length alone.',
      'Load "Reversed: worst case". Every key has to travel all the way to the front, so every comparison is followed by a shift.',
      'Type the values 2, 3, 4, 5, 6, 7, 8, 1. One value is far from home, and it costs 7 shifts. Then try 8, 1, 2, 3, 4, 5, 6, 7, which also needs 7 shifts, one for each key. Insertion sort does not care in which direction the misplaced value has to travel.',
    ],
    run,
    report: (r, c) => `Sorted ${r.sorted.length} values with ${c.comparisons || 0} comparisons and ${r.shifts} shifts (${c.writes || 0} array writes).\n[${r.sorted.join(', ')}]`,
    experiment: {
      title: 'Comparisons as the list grows, for three kinds of input',
      note: 'Each point is a real run of this page\'s implementation. "Nearly sorted" is a sorted list in which about one neighbouring pair in ten has been swapped. Sorted and nearly sorted input grow in a straight line. Random input grows with the square of the length.',
      metric: 'comparisons',
      metricLabel: 'Comparisons',
      sizeLabel: 'Number of items (n)',
      sizes: [8, 16, 32, 64, 128, 256, 512],
      variants: [
        { id: 'random', label: 'Random order' },
        { id: 'nearly', label: 'Nearly sorted' },
        { id: 'sorted', label: 'Already sorted' },
      ],
      input: (n, variant, seed) => ({ size: n, order: variant, seed, custom: [] }),
      theory: [
        { label: 'about n²/4 (expected, random order)', fn: (n) => (n * (n - 1)) / 4 + n - harmonic(n), variant: 'random', expected: true },
        { label: 'n − 1 (already sorted)', fn: (n) => n - 1, variant: 'sorted' },
      ],
    },
  },

  logic: {
    intuition: 'If the first i values are already in order, adding one more value is a small problem: find its place and make room. The values larger than the new one form an unbroken block at the right-hand end of the ordered group, so one right-to-left walk both finds the place and makes the room.',
    steps: [
      'Treat the first value as an ordered group of size one.',
      'Take the next value and remember it as `key`.',
      'Walk left through the ordered group. While the value at `j` is larger than `key`, copy it one position to the right.',
      'Stop at the first value that is not larger than `key`, or at the front of the list.',
      'Write `key` into the gap. The ordered group is now one value longer.',
      'Repeat from step 2 until every value has been inserted.',
    ],
    pseudocode: [
      'insertion_sort(A):',
      '  n ← length(A)',
      '  for i from 1 to n − 1:',
      '    key ← A[i]',
      '    j ← i − 1',
      '    while j ≥ 0 and A[j] > key:',
      '      A[j + 1] ← A[j]',
      '      j ← j − 1',
      '    A[j + 1] ← key',
    ],
    decisions: [
      { title: 'Shift or swap?', text: 'Hold the key aside and shift the larger values, then write the key once. Swapping the key leftward one neighbour at a time gives the same result with about twice as many writes.' },
      { title: 'Stop at "larger" or at "larger or equal"?', text: 'Shift only values strictly larger than the key. The key then lands to the right of any equal value that came before it, which keeps the sort stable.' },
      { title: 'Search from the right or use binary search?', text: 'Searching from the right costs one comparison per shift, which is what makes sorted input cost only n − 1 comparisons. Binary search finds the place in about log₂ i comparisons, but the shifts still have to be made, so the running time stays quadratic.' },
      { title: 'Where does it stop being the right tool?', text: 'Library sorts switch to insertion sort when a range falls below a small cutoff, usually a few dozen items or fewer, depending on the implementation. Above that, the quadratic growth outweighs the low overhead.' },
    ],
    invariants: [
      'At the start of each round, `A[0..i−1]` holds the first `i` input values in sorted order.',
      'During the inner loop, every value in `A[j+2..i]` is larger than `key`, and position `j + 1` is free to be overwritten.',
      'Each shift removes exactly one inversion from the list, and no step creates one.',
    ],
    edgeCases: [
      'An empty list or a single value: the outer loop never runs.',
      'An already sorted list: one comparison per key, no shifts.',
      'A reversed list of distinct values: key number i is compared with and shifted past all i values before it, n(n − 1)/2 of each in total.',
      'Equal values: a key stops to the right of an equal value, so the original order of equal values is kept.',
      'The key is smaller than everything before it: the loop ends because `j` runs off the front, not because a comparison fails. Forgetting that case reads outside the list.',
    ],
    correctness: 'Use the invariant that before round `i` the prefix `A[0..i−1]` is sorted and contains exactly the first `i` input values. It holds for `i = 1`. In round `i`, the inner loop moves every prefix value larger than `key` one place to the right, keeping their order, and stops at position `j` where `A[j] ≤ key` or `j = −1`. Writing `key` at `j + 1` puts it after all values not larger than it and before all values larger than it, so `A[0..i]` is sorted and contains the first `i + 1` input values. When `i` reaches the length of the list, the prefix is the whole list.',
    mistakes: [
      'Not saving `A[i]` in `key` before shifting. The first shift overwrites `A[i]`, and the value being inserted is lost.',
      'Testing `A[j] > key` before `j ≥ 0`. At the front of the list this reads position −1, which is an error in some languages and silently reads the last element in Python.',
      'Using `≥` in the comparison, which moves the key past equal values and makes the sort unstable.',
      'Writing the key to `A[j]` instead of `A[j + 1]` after the loop.',
    ],
  },

  code: {
    sample: {
      input: 'The list [29, 10, 14, 37, 13, 5, 31, 22]. Prints the sorted list and the number of shifts used.',
      expected: '5 10 13 14 22 29 31 37\nshifts: 14',
    },
    python: {
      source: `def insertion_sort(a):
    shifts = 0
    for i in range(1, len(a)):
        key = a[i]
        j = i - 1
        while j >= 0 and a[j] > key:
            a[j + 1] = a[j]
            shifts += 1
            j -= 1
        a[j + 1] = key
    return shifts


data = [29, 10, 14, 37, 13, 5, 31, 22]
shifts = insertion_sort(data)
print(" ".join(str(x) for x in data))
print("shifts:", shifts)`,
      notes: [
        { line: 4, text: 'The key is copied out first. The shifts below will overwrite position `i`.' },
        { line: 6, text: 'Both tests matter, in this order: stop at the front of the list, or at the first value that is not larger than the key.' },
        { line: 7, text: 'A shift copies one value a single place to the right. The list briefly holds that value twice; the copy on the left is the gap.' },
        { line: 10, text: 'The key is written exactly once per round, into the gap the shifts left behind.' },
      ],
    },
    javascript: {
      source: `function insertionSort(a) {
  let shifts = 0;
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j];
      shifts++;
      j--;
    }
    a[j + 1] = key;
  }
  return shifts;
}

const data = [29, 10, 14, 37, 13, 5, 31, 22];
const shifts = insertionSort(data);
console.log(data.join(" "));
console.log("shifts: " + shifts);`,
    },
    cpp: {
      source: `#include <iostream>
#include <vector>

int insertionSort(std::vector<int>& a) {
    int shifts = 0;
    for (int i = 1; i < static_cast<int>(a.size()); ++i) {
        int key = a[i];
        int j = i - 1;
        while (j >= 0 && a[j] > key) {
            a[j + 1] = a[j];
            ++shifts;
            --j;
        }
        a[j + 1] = key;
    }
    return shifts;
}

int main() {
    std::vector<int> data = {29, 10, 14, 37, 13, 5, 31, 22};
    int shifts = insertionSort(data);
    for (std::size_t k = 0; k < data.size(); ++k) {
        std::cout << data[k] << (k + 1 < data.size() ? " " : "\\n");
    }
    std::cout << "shifts: " << shifts << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Each shift removes one inversion, so the number of shifts equals the number of inversions in the input, call it d. Each key also needs at most one comparison that does not lead to a shift. The total work is therefore proportional to n + d. A sorted list has d = 0. A reversed list has d = n(n − 1)/2.',
    cases: [
      { case: 'Best', time: 'O(n)', when: 'The list is already sorted: n − 1 comparisons and no shifts.' },
      { case: 'Nearly sorted', time: 'O(n + d)', when: 'The list has d inversions. If every value is within k positions of its final place, d is at most n·k, so the time is O(n·k).' },
      { case: 'Average', time: 'O(n²)', when: 'Distinct values in random order have n(n − 1)/4 inversions on average, so about n²/4 comparisons and shifts.' },
      { case: 'Worst', time: 'O(n²)', when: 'The list is in reverse order: n(n − 1)/2 comparisons and the same number of shifts.' },
    ],
    space: 'O(1). The key, two indices, and nothing else. The list is rearranged in place.',
    memory: 'The inner loop reads and writes a contiguous run of positions, one after another, with a very simple loop body. On short ranges that fit in a processor cache this is about as cheap as sorting gets, which is the reason for its role in hybrid sorts.',
    tradeoffs: 'Insertion sort gives stability, constant extra memory, low overhead and sensitivity to existing order, and pays with quadratic growth on disordered input. Merge sort and quick sort reverse the bargain: higher overhead per item, far better growth. Hybrid sorts take both by switching between them according to range size.',
    assumptions: [
      'Comparing two values and copying a value each take constant time.',
      'The list is an array, so a value can only move by being copied. In a linked list insertion needs no shifting, but finding the place still takes a walk.',
      'The average case assumes distinct values with every ordering equally likely.',
      'Counts on this page are comparisons and array writes performed by this implementation, not wall-clock time. An array write is counted for every shift and for every placement of a key, including a key that is written back where it was.',
    ],
  },

  tradeoffs: {
    excels: [
      'Short lists, where its low overhead beats sorts with better growth rates.',
      'Nearly sorted lists, where its cost is close to linear.',
      'Online use: items arrive one at a time and each is inserted into an already sorted list.',
      'Tasks that need a stable, in-place sort.',
    ],
    struggles: [
      'Long lists in random or reversed order, where the shifts add up to quadratic time.',
      'Data in which a single write is very expensive, because a key far from its place causes many shifts.',
      'Lists where a few values are very far from their final positions: each such value costs a number of shifts equal to the distance it travels.',
    ],
    pitfalls: [
      'Losing the key by shifting before saving it.',
      'Reading before the start of the list when the key is the smallest value so far.',
      'Using it alone on a large input because it "worked fine in testing" on small ones.',
    ],
    misunderstandings: [
      '"A quadratic sort is never the right choice." On ranges of a dozen or so items, insertion sort is typically faster than quick sort or merge sort, which is why those sorts call it for their small pieces.',
      '"Finding the place with binary search makes it fast." Binary search cuts the comparisons, but every larger value must still be shifted one place, so the number of writes and the overall growth stay the same.',
      '"Nearly sorted means only a few values are out of place." What matters is the number of out-of-order pairs. One value at the wrong end of a long list creates as many of those as the list is long.',
      '"After i rounds the first i values are final." They are in order among themselves, but a later, smaller key can still push all of them to the right.',
    ],
    constraints: [
      'The cutoff below which hybrid sorts switch to insertion sort is tuned by measurement and differs between libraries, element types and machines.',
      'Every shift removes only one inversion, so no version that moves values one position at a time can beat quadratic time on random input. Shellsort gets around this by first sorting values that are far apart.',
    ],
    alternatives: [
      { id: 'merge-sort', name: 'Merge Sort', when: 'The list is long and you still need a stable sort.' },
      { id: 'quick-sort', name: 'Quick Sort', when: 'The list is long, memory is tight and stability does not matter.' },
      { id: 'selection-sort', name: 'Selection Sort', when: 'The list is short and writes are much more expensive than comparisons.' },
      { id: 'bubble-sort', name: 'Bubble Sort', when: 'Only for study. It removes the same inversions with more comparisons and more writes.' },
      { name: 'Shellsort', when: 'You want an in-place sort that is simple like insertion sort but much faster on medium-sized lists.' },
    ],
    comparison: {
      columns: ['', 'Insertion sort', 'Selection sort', 'Bubble sort'],
      rows: [
        ['Comparisons, sorted input', 'n − 1', 'n(n − 1)/2', 'n − 1'],
        ['Comparisons, random input', 'about n²/4', 'n(n − 1)/2', 'close to n²/2'],
        ['Element moves, worst case', 'n(n − 1)/2 shifts', 'n − 1 swaps', 'n(n − 1)/2 swaps'],
        ['Adapts to existing order', 'Yes', 'No', 'Partly'],
        ['Stable', 'Yes', 'No', 'Yes'],
      ],
    },
  },

  applications: [
    { title: 'The small-range finisher in library sorts', status: 'established', text: 'Quick sort and merge sort spend most of their calls on very small ranges, where their overhead dominates. Production implementations, including the introsort behind typical C++ `std::sort`, stop dividing below a small cutoff and sort those ranges with insertion sort.' },
    { title: 'Building runs in Timsort', status: 'established', text: 'Timsort, the built-in sort of Python and the sort Java uses for arrays of objects, looks for stretches of the input that are already in order. When such a run is too short, it extends it with a binary insertion sort before merging runs together.' },
    { title: 'Keeping a list sorted as items arrive', status: 'illustrative', text: 'A scoreboard, a list of upcoming appointments or a small ordered buffer receives one new item at a time. Inserting it into the existing order is one round of insertion sort.' },
    { title: 'Re-sorting data that changes a little', status: 'illustrative', text: 'When a sorted list is updated slightly, for example timestamps that arrive a few positions out of order, the number of inversions is small and insertion sort repairs the order in close to linear time.' },
  ],

  connections: [
    { to: 'quick-sort', type: 'advanced', why: 'Practical quick sorts stop recursing on small ranges and finish them with insertion sort, pairing a good growth rate with low overhead where each is strongest.' },
    { to: 'merge-sort', type: 'advanced', why: 'Timsort is merge sort applied to runs that insertion sort has built or extended. Both sorts are stable, so their combination is too.' },
    { to: 'bubble-sort', type: 'same-problem', why: 'Both remove inversions one at a time by moving a value past a neighbour, so both make the same number of element moves on a given input. Insertion sort usually needs fewer comparisons, and it writes once per move where a swap writes twice.' },
    { to: 'selection-sort', type: 'same-problem', why: 'Both grow a sorted group one position at a time. Insertion sort searches the sorted group for the right place; selection sort searches the unsorted part for the right value.' },
    { to: 'binary-search', type: 'related', why: 'The ordered group can be searched by repeated halving to find the insertion point in about log₂ i comparisons. The shifts remain, so only the comparison count improves.' },
    { to: 'concept:invariant', type: 'prerequisite', why: 'Its correctness is the textbook loop invariant: before each round, the prefix is sorted and contains the values it started with.' },
    { to: 'concept:stability', type: 'related', why: 'A key stops as soon as it meets a value that is not larger, so equal values never pass each other.' },
    { to: 'concept:in-place', type: 'related', why: 'It sorts within the original array, holding only one value aside at a time.' },
    { to: 'discipline:statistics', type: 'application', why: 'The number of shifts equals the number of inversions in the input, the same count of discordant pairs that Kendall\'s rank correlation is built on.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Insertion sort has just finished inserting the fourth value of a long list. What is guaranteed about the first four positions?',
      options: ['They hold the four smallest values of the whole list', 'They hold the first four input values, in sorted order', 'They are in their final positions', 'Nothing yet'],
      answer: 1,
      explain: [
        'That is what selection sort guarantees. Insertion sort has not looked at the rest of the list yet.',
        'Correct. The ordered group contains exactly the values inserted so far, arranged in order among themselves.',
        'A smaller value later in the list will push them to the right when it is inserted.',
        'The loop invariant gives a definite guarantee after every round.',
      ],
    },
    {
      type: 'predict',
      q: 'The list is 1, 2, 4, 3, 5, 6, 7, 8. One neighbouring pair is out of order. How many comparisons will insertion sort make?',
      options: ['7', '8', '14', '28'],
      answer: 1,
      explain: [
        '7 would be the cost if the list were fully sorted: one comparison for each of the seven keys.',
        'Correct. Each of the seven keys costs one comparison that stops the search, and the key 3 costs one extra comparison for the single shift it needs.',
        'Doubling is too much. Only the one out-of-order pair costs anything extra.',
        '28 is the worst case for eight values, reached only by a reversed list.',
      ],
      tryInput: { custom: [1, 2, 4, 3, 5, 6, 7, 8] },
    },
    {
      type: 'debug',
      q: 'On the list 2, 3, 1 this version returns 2, 3, 3. What is wrong?',
      code: `def insertion_sort(a):
    for i in range(1, len(a)):
        j = i - 1
        while j >= 0 and a[j] > a[i]:
            a[j + 1] = a[j]
            j -= 1
        a[j + 1] = a[i]`,
      options: ['The outer loop should start at 0', 'The value a[i] is never saved, so the first shift overwrites it', 'The comparison should be a[j] >= a[i]', 'The last line should write to a[j]'],
      answer: 1,
      explain: [
        'Starting at 1 is right: the first value is already an ordered group of one.',
        'Correct. When `j` is `i − 1`, the shift writes to `a[i]`. From then on `a[i]` holds the shifted value, not the key. Copy the key into a variable before the loop.',
        'That would only make the sort unstable. It would not bring the lost value back.',
        'After the loop, `j` is one position to the left of the gap, so `j + 1` is the correct place.',
      ],
    },
    {
      type: 'choice',
      q: 'Why do fast library sorts hand small ranges to insertion sort?',
      options: ['Insertion sort has a better growth rate than quick sort', 'On a handful of items its simple loop does less total work than the bookkeeping of a divide-and-conquer sort', 'It uses less memory than any other sort', 'Small ranges are always already sorted'],
      answer: 1,
      explain: [
        'Its growth rate is worse: quadratic against n log n. Growth rate describes large inputs, not small ones.',
        'Correct. For a few items, n² is a small number, and insertion sort has almost no overhead per step. The better growth rate only pays off once ranges are larger.',
        'Several sorts use constant extra memory. That is not what separates it from the others here.',
        'They are in arbitrary order. They are simply short.',
      ],
    },
    {
      type: 'challenge',
      title: 'Binary insertion sort',
      prompt: 'Replace the right-to-left search with a binary search over the ordered group to find where the key belongs, then shift the larger values and write the key. Take care to keep the sort stable when the key equals values already in the group. Count comparisons and shifts separately on a reversed list of 64 distinct values and on a sorted list of 64 values, and compare with plain insertion sort.',
      hints: ['To stay stable, search for the first position whose value is strictly greater than the key.', 'Look closely at the sorted input. Plain insertion sort needs 63 comparisons there. Does the binary version need more or fewer?'],
    },
  ],

  compare: {
    idea: 'Insert each value into its place among the values already in order.',
    requires: 'Any list with a consistent ordering. Always correct; only speed depends on the input.',
    sensitivity: 'Very high, in a useful way. Cost is n plus the number of inversions: linear on sorted input, quadratic on reversed input.',
    memory: 'In place. One held value and two indices.',
    difficulty: 'low',
    difficultyNote: 'A short loop. The details that matter are saving the key first and checking the index before the comparison.',
    limits: 'Quadratic time on long disordered lists.',
    useWhen: 'The list is short or nearly sorted, or items must be added to a sorted list one at a time.',
  },

  advanced: {
    history: 'Insertion sort has no recorded inventor. It is the way many people sort a hand of cards. In 1959 Donald Shell published a generalization, now called Shellsort, that runs insertion sort on values a fixed gap apart and shrinks the gap, which lets values far from home move quickly. The use of insertion sort as the finisher for small ranges inside quick sort was studied in detail by Robert Sedgewick in the 1970s and is described in Bentley and McIlroy\'s 1993 account of engineering a library sort.',
    derivation: 'Let $d$ be the number of inversions of the input: pairs $i < j$ with $A[i] > A[j]$. A shift copies a value that is larger than the key from the left of the gap to the right of it, which removes the inversion between that value and the key and changes no other pair. The algorithm ends with no inversions, so\n\n$$\\text{shifts} = d.$$\n\nIn each of the $n-1$ rounds, every comparison except possibly the last is followed by a shift. So\n\n$$d \\le \\text{comparisons} \\le d + (n-1).$$\n\nThe last comparison of a round is missing exactly when the key is smaller than everything before it. For $n$ distinct values in random order, $E[d] = \\frac{n(n-1)}{4}$, and the expected number of keys that are new minima is $H_n - 1$, where $H_n = 1 + \\frac12 + \\dots + \\frac1n$. That gives\n\n$$E[\\text{comparisons}] = \\frac{n(n-1)}{4} + n - H_n.$$',
    proof: 'Invariant $P(i)$: before the round with index $i$, $A[0..i-1]$ is sorted and is a rearrangement of the first $i$ input values. $P(1)$ holds because one value is sorted. Assume $P(i)$ and let $k$ be the key. The inner loop keeps the property that $A[j+2..i]$ holds, in order, the prefix values greater than $k$ that have been examined, each moved one place right. It stops with $j = -1$ or $A[j] \\le k$. Because the prefix was sorted, every value in $A[0..j]$ is at most $k$ and every value in $A[j+2..i]$ is greater than $k$. Writing $k$ at $j+1$ makes $A[0..i]$ sorted, and it holds the first $i+1$ input values, which is $P(i+1)$. $P(n)$ says the whole list is sorted.\n\nStability: a key never moves past a value that is equal to it, because the loop continues only while $A[j] > k$.',
    complexityProof: 'From the derivation, the running time is $\\Theta(n + d)$. Since $0 \\le d \\le \\binom{n}{2}$, the best case is $\\Theta(n)$, attained by sorted input, and the worst case is $\\Theta(n^2)$, attained by reversed input, where round $i$ makes $i$ comparisons and $i$ shifts for a total of $\\sum_{i=1}^{n-1} i = \\frac{n(n-1)}{2}$ of each.',
    variants: [
      { name: 'Binary insertion sort', text: 'Finds the insertion point by binary search. Comparisons drop to O(n log n) in the worst case; shifts are unchanged. Useful when comparisons are much more expensive than moves.' },
      { name: 'Shellsort', text: 'Runs insertion sort on interleaved sublists of values a gap apart, for a decreasing sequence of gaps ending in 1. The early passes remove many inversions per move.' },
      { name: 'Insertion sort with a sentinel', text: 'First moves the smallest value to the front. The inner loop then needs no index test, because the scan always stops at the sentinel.' },
      { name: 'Insertion into a linked list', text: 'No shifting is needed, only pointer changes, but finding the place still takes a linear walk, so the time remains quadratic.' },
    ],
    implementation: 'Hold the key in a local variable and shift rather than swap. Test the index before the comparison. Keep the comparison strict for stability. As a small-range finisher, call it on each small range directly instead of making one pass over the whole array at the end, so that the data being sorted is still in the cache.',
    benchmarking: 'Operation counts on this site are exact and repeatable. When timing insertion sort against other sorts, test several input sizes and several kinds of order: its ranking changes completely between 10 items and 10,000, and between random and nearly sorted data.',
    references: [
      { authors: 'D. E. Knuth', year: 1998, title: 'The Art of Computer Programming, Volume 3: Sorting and Searching (2nd edition), section 5.2.1', venue: 'Addison-Wesley' },
      { authors: 'D. L. Shell', year: 1959, title: 'A high-speed sorting procedure', venue: 'Communications of the ACM 2(7), 30-32' },
      { authors: 'J. L. Bentley and M. D. McIlroy', year: 1993, title: 'Engineering a sort function', venue: 'Software: Practice and Experience 23(11), 1249-1265' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Getting Started", which uses insertion sort to introduce loop invariants and running-time analysis.',
      'R. Sedgewick and K. Wayne, *Algorithms* (4th edition), section 2.1.',
    ],
  },

  tests: [
    { name: 'sorts a random list; shifts equal inversions', input: { size: 40, order: 'random', seed: 11 }, check: checkRun },
    { name: 'sorts a list with few distinct values', input: { size: 33, order: 'few', seed: 5 }, check: checkRun },
    { name: 'sorts a nearly sorted list in close to n comparisons', input: { size: 60, order: 'nearly', seed: 9 },
      check: (r, c) => { const ok = checkRun(r, c); return ok !== true ? ok : c.comparisons <= 59 + 6 || `expected at most 65 comparisons, got ${c.comparisons}`; } },
    { name: 'the worked example costs 8 comparisons and 6 shifts', input: { custom: [5, 2, 4, 6, 1] },
      check: (r, c) => (c.comparisons === 8 && r.shifts === 6 && c.writes === 10 && r.sorted.join(',') === '1,2,4,5,6') || `got ${c.comparisons} comparisons, ${r.shifts} shifts, ${c.writes} writes` },
    { name: 'one swapped neighbouring pair in 8 values costs 8 comparisons', input: { custom: [1, 2, 4, 3, 5, 6, 7, 8] },
      check: (r, c) => (c.comparisons === 8 && r.shifts === 1) || `got ${c.comparisons} comparisons and ${r.shifts} shifts` },
    { name: 'sorted input of 10 costs 9 comparisons and no shifts', input: { size: 10, order: 'sorted', seed: 7 },
      check: (r, c) => (c.comparisons === 9 && r.shifts === 0) || `got ${c.comparisons} comparisons and ${r.shifts} shifts` },
    { name: 'a reversed list of 6 costs 15 comparisons and 15 shifts', input: { custom: [6, 5, 4, 3, 2, 1] },
      check: (r, c) => (c.comparisons === 15 && r.shifts === 15) || `got ${c.comparisons} comparisons and ${r.shifts} shifts` },
    { name: 'a misplaced value costs 7 shifts in either direction', input: { custom: [2, 3, 4, 5, 6, 7, 8, 1] },
      check: (r) => r.shifts === 7 || `got ${r.shifts} shifts` },
    { name: 'a large value at the front also costs 7 shifts', input: { custom: [8, 1, 2, 3, 4, 5, 6, 7] },
      check: (r) => r.shifts === 7 || `got ${r.shifts} shifts` },
    { name: 'handles duplicates and negatives', input: { custom: [3, -1, 3, 0, -7, 3] },
      check: (r, c) => (r.sorted.join(',') === '-7,-1,0,3,3,3' && checkRun(r, c) === true) || `got ${r.sorted.join(',')}` },
    { name: 'a single value needs no comparisons', input: { custom: [42] },
      check: (r, c) => (r.sorted.join(',') === '42' && !c.comparisons) || 'a one-element list should cost nothing' },
  ],
};
