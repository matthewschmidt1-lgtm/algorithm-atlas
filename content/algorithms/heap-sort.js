import { arrayInputs, resolveArray, isSorted, sameMultiset } from '../../js/lib/arrays.js';
import { layoutTree } from '../../js/lib/graphs.js';

const LEGEND = [
  { label: 'value being sifted down', role: 'active' },
  { label: 'child being compared', role: 'compare' },
  { label: 'swapped', role: 'swap' },
  { label: 'final position', role: 'sorted' },
];
const TREE_MAX = 31; // five levels: the most that stays readable as a tree

function run(input, t) {
  const a = resolveArray(input);
  const original = a.slice();
  const n = a.length;
  let heapSize = n;
  let comparisons = 0;
  const compare = () => { comparisons++; t.count('comparisons'); };
  const swap = (i, j) => { const x = a[i]; a[i] = a[j]; a[j] = x; t.count('writes', 2); };

  // Tree positions for array indices 0..shown-1. layoutTree treats a falsy node as "no child",
  // so nodes are numbered from 1 here and converted back to array indices below.
  const shown = Math.min(n, TREE_MAX);
  const pos = shown && t.record
    ? layoutTree(1, (k) => [2 * k <= shown ? 2 * k : null, 2 * k + 1 <= shown ? 2 * k + 1 : null])
    : new Map();
  const treeTitle = n > TREE_MAX
    ? `The heap as a tree (first ${TREE_MAX} of ${n} positions; small numbers are array positions)`
    : 'The same array read as a tree (small numbers are array positions)';

  const views = (roles = {}, markers = [], edges = {}) => {
    const barRoles = {};
    for (let k = heapSize; k < n; k++) barRoles[k] = 'sorted';
    Object.assign(barRoles, roles);
    const out = [{ kind: 'bars', values: a.slice(), roles: barRoles, markers, range: heapSize > 0 ? [0, heapSize - 1] : undefined, legend: LEGEND }];
    if (shown) {
      const nodes = [], links = [];
      for (let k = 1; k <= shown; k++) {
        const idx = k - 1, p = pos.get(k);
        nodes.push({ id: idx, x: p.x, y: p.y, label: String(a[idx]), sub: idx, role: roles[idx] || (idx >= heapSize ? 'done' : 'default') });
        if (k > 1) links.push({ u: (k >> 1) - 1, v: idx, role: idx >= heapSize ? 'dim' : edges[idx] || 'default' });
      }
      out.push({ kind: 'graph', title: treeTitle, aspect: shown > 15 ? 0.55 : shown > 7 ? 0.42 : 0.34, directed: false, nodes, edges: links });
    }
    return out;
  };

  // Move the value at position i down until it is at least as large as its children.
  const siftDown = (i, size) => {
    while (2 * i + 1 < size) {
      const l = 2 * i + 1, r = l + 1;
      let c = l;
      if (r < size) {
        compare();
        if (a[r] > a[l]) c = r;
        const at = i, pick = c;
        t.frame(() => ({ line: pick === r ? [10, 11, 12] : [10, 11],
          note: `${a[at]} at position ${at} has two children, ${a[l]} and ${a[r]}. ${a[l] === a[r] ? 'They are equal, so use the left one' : `The larger is ${a[pick]}`}. Only the larger child could take the place of its parent, so it is the one to check.`,
          views: views({ [at]: 'active', [l]: 'compare', [r]: 'compare' }, [{ index: at, label: 'i' }, { index: pick, label: 'c' }], { [l]: 'active', [r]: 'active' }),
          vars: { i: at, c: pick, 'heap size': size } }));
      }
      compare();
      const ok = a[i] >= a[c];
      const at = i, child = c, only = r >= size;
      t.frame(() => ({ line: 13,
        note: `Is ${a[at]} at least as large as its ${only ? 'only' : 'larger'} child, ${a[child]}? ${ok ? `Yes. The heap rule holds here, so ${a[at]} stays at position ${at}.` : 'No, so the two must swap.'}`,
        views: views({ [at]: 'active', [child]: 'compare' }, [{ index: at, label: 'i' }, { index: child, label: 'c' }], { [child]: 'active' }),
        vars: { i: at, c: child, 'heap size': size } }));
      if (ok) return;
      swap(i, c);
      i = c;
      t.frame(() => ({ line: [14, 15],
        note: `Swap them. ${a[at]} moves up to position ${at} and ${a[child]} moves down to position ${child}.${2 * child + 1 >= size ? ` Position ${child} has no children inside the heap, so ${a[child]} stops here.` : ''}`,
        views: views({ [at]: 'swap', [child]: 'swap' }, [{ index: child, label: 'i' }], { [child]: 'active' }),
        vars: { i: child, 'heap size': size } }));
    }
  };

  t.frame(() => ({ line: 0, note: `Start with ${n} values. The tree below is only another way to read the array: the children of position i are at positions 2i + 1 and 2i + 2. Heap sort first rearranges the values so that every parent is at least as large as its children.`, views: views() }));

  for (let i = (n >> 1) - 1; i >= 0; i--) {
    t.frame(() => ({ line: [2, 3], note: `Build the heap from the bottom up. Position ${i} holds ${a[i]}. Everything below it already obeys the heap rule, so sift ${a[i]} down until it is at least as large as its children.`,
      views: views({ [i]: 'active' }, [{ index: i, label: 'i' }]), vars: { i, 'heap size': n } }));
    siftDown(i, n);
  }
  const heap = a.slice();
  const buildComparisons = comparisons;
  if (n > 1) {
    t.frame(() => ({ line: 4, note: `The heap is built with ${buildComparisons} comparisons. Every parent is at least as large as its children, so the largest value, ${a[0]}, is at the root. From here on: move the root to the end, shrink the heap by one, repair it, and repeat.`, views: views({}, [{ index: 0, label: 'root' }]), vars: { 'heap size': n } }));
  }

  for (let end = n - 1; end >= 1; end--) {
    swap(0, end);
    heapSize = end;
    t.frame(() => ({ line: [4, 5], note: `The root, ${a[end]}, is the largest value in the heap. Swap it with ${a[0]}, the last value in the heap. Nothing left in the heap is larger, so ${a[end]} is now in its final position, and the heap shrinks to ${end} ${end === 1 ? 'value' : 'values'}.${end > 1 ? ` The new root, ${a[0]}, may be too small for its place and is sifted down next.` : ''}`,
      views: views({ 0: 'swap', [end]: 'swap' }, [{ index: 0, label: 'root' }, { index: end, label: 'end' }]), vars: { end, 'heap size': end } }));
    siftDown(0, end);
  }
  heapSize = 0;
  t.frame(() => ({ line: null, note: n > 1 ? `Sorted. The one value left in the heap was the smallest, so it was already in place.` : 'A list of one value is already sorted.', views: views() }));
  return { sorted: a, original, heap, buildComparisons };
}

const isMaxHeap = (h) => h.every((v, i) => i === 0 || h[(i - 1) >> 1] >= v);

const checkRun = (r, c) => {
  if (!isSorted(r.sorted) || !sameMultiset(r.sorted, r.original)) return 'output is not a sorted permutation of the input';
  if (!isMaxHeap(r.heap) || !sameMultiset(r.heap, r.original)) return 'the array after the build phase is not a max-heap of the input';
  const n = r.original.length;
  if (r.buildComparisons > 2 * n) return `building the heap took ${r.buildComparisons} comparisons, more than 2n = ${2 * n}`;
  const limit = n > 1 ? 2 * n * Math.floor(Math.log2(n)) + 2 * n : 0;
  return (c.comparisons || 0) <= limit || `${c.comparisons} comparisons exceed 2n⌊log₂ n⌋ + 2n = ${limit}`;
};

export default {
  meta: {
    id: 'heap-sort',
    name: 'Heap Sort',
    aliases: ['heapsort', 'treesort', 'sorting with a binary heap'],
    kind: 'algorithm',
    discipline: 'algorithms',
    alsoIn: [],
    subfield: 'Sorting',
    family: 'Comparison sorts',
    lab: 'sorting-searching',
    compareGroup: 'sorting',
    year: 1964,
    authors: 'J. W. J. Williams',
    summary: 'Sorts by arranging the array as a max-heap, then repeatedly moving the largest value to the end and repairing the heap. In place, with a guaranteed O(n log n).',
    difficulty: 'intermediate',
    order: 150,
    paradigms: ['incremental'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', class: 'linearithmic' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['sort a list', 'put numbers in order', 'sort without extra memory', 'find the largest items', 'sort with a guaranteed time'],
      techniques: ['binary heap', 'sift down', 'heap construction', 'in-place swapping', 'selection'],
      applications: ['operating systems', 'standard libraries', 'data processing'],
    },
    prerequisites: ['concept:array', 'concept:tree', 'concept:heap', 'concept:big-o', 'selection-sort'],
  },

  bigIdea: {
    simple: "Heap sort is a way to put a list in order by picking out the biggest item again and again. Finding the biggest item in a jumbled list is slow, because you have to look at every item. Heap sort avoids that by first arranging the items in a pattern called a heap. Picture a chart like a family tree. One item sits at the top, two sit below it, two below each of those, and so on. The rule is that every item is at least as big as the two items directly below it. With that rule, the biggest item is always at the top. Heap sort takes the top item and puts it at the back of the list, where it belongs. Then it repairs the chart, which takes only a few steps, because only one path from top to bottom needs fixing. Now the next biggest item is at the top. Take it, repair, and repeat until nothing is left.",
    what: 'Heap sort works in two phases. First it rearranges the array into a **max-heap**: an order in which the value at every position is at least as large as the values at its two child positions. Then it repeatedly swaps the first value, which is the largest, with the last value of the heap, shrinks the heap by one, and restores the heap order by sifting the new first value down. The sorted values accumulate at the end of the array.',
    why: 'It is the answer to a specific question: can a sort guarantee n log n time on every input without using a second array? Merge sort gives the guarantee but needs a buffer. Quick sort needs no buffer but has a quadratic worst case. Heap sort has both properties at once, and the heap it is built on turned out to be useful far beyond sorting.',
    when: 'Use heap sort when memory is tight and a worst-case guarantee matters more than typical speed, for example in system code that must not be slowed down by a hostile input. If typical speed matters most, use [quick sort](#/algorithm/quick-sort). If equal items must keep their order, use [merge sort](#/algorithm/merge-sort). If you only need the few largest items, a heap gives them to you without sorting everything.',
    interesting: 'The tree is never built. It exists only as arithmetic on array positions: the children of position i are at 2i + 1 and 2i + 2. And building the heap, which looks as if it should cost n log n, costs only about n, because most positions are near the bottom of the tree and have almost nowhere to fall.',
    where: 'As the safety net inside introsort, the algorithm behind typical C++ `std::sort`, which switches from quick sort to heap sort when recursion gets too deep. The Linux kernel\'s general-purpose sort routine is a heap sort. The heap itself is the usual implementation of a priority queue.',
    analogy: {
      title: 'Finding the runner-up in a knockout tournament',
      text: 'After a knockout tournament everyone knows the champion. To find the second-best player there is no need to play the whole tournament again: the runner-up must be someone the champion beat, and that is only one player per round. A heap works in a similar way. Once the largest value has been taken from the top, the heap is repaired by following a single path from top to bottom, comparing with the two values below at each level, and that brings the next largest to the top. For a thousand values that is about ten levels, not a thousand checks.',
      limits: 'A tournament bracket writes every player at the bottom and copies winners upward, so names appear several times. A heap stores each value once and promises less: only that a parent is at least as large as its children. Two values on different branches are in no known order. A heap also needs no bracket drawn anywhere. It is just the list itself, read with a rule that says which positions count as children of which.',
    },
  },

  example: {
    setup: 'Sort the five numbers 4, 10, 3, 5, 1. Read the list as a tree: 4 is at the top, 10 and 3 are its children, and 5 and 1 are the children of 10. A heap is an arrangement in which every parent is at least as large as its children.',
    steps: [
      'Build the heap, starting with the last parent and working back to the top. The parent 10 is larger than its children 5 and 1, so it stays.',
      'The top value 4 is smaller than its larger child, 10, so swap them. Now 4 sits above 5 and 1, and it is smaller than 5, so swap again. The list is 10, 5, 3, 4, 1 and it is a heap. The largest value is at the top.',
      'Swap the top, 10, with the last value of the heap, 1. The 10 is now in its final place and the heap is the first four values: 1, 5, 3, 4. Repair it by sifting the 1 down: swap it with 5, then with 4. The list is 5, 4, 3, 1, then 10.',
      'Swap the top, 5, with the last value of the heap, 1, and sift the 1 down past the 4. The list is 4, 1, 3, then 5, 10.',
      'Swap the top, 4, with the last value of the heap, 3. The 3 is larger than its child 1, so it stays. Then swap 3 with 1. The heap has one value left, so stop.',
    ],
    result: 'The list is 1, 3, 4, 5, 10 after 12 comparisons: 6 to build the heap and 6 to empty it. Each repair followed one path down the tree and never looked at the rest.',
    tryInput: { custom: [4, 10, 3, 5, 1] },
  },

  terms: [
    { term: 'Sorting', meaning: 'Rearranging a list so that its items are in order, for example from smallest to largest.' },
    { term: 'Tree', meaning: 'An arrangement in which one item is at the top and every other item hangs below exactly one other item, called its parent.' },
    { term: 'Parent and child', meaning: 'In a tree, a parent is the item directly above another item, and that other item is its child. In a heap stored in a list, the children of position i are at positions 2i + 1 and 2i + 2.' },
    { term: 'Heap', meaning: 'A tree-shaped ordering in which every parent is at least as large as its children. The largest item is always at the top.' },
    { term: 'Root', meaning: 'The item at the top of a tree. In a heap stored in a list it is the first item.' },
    { term: 'Sift down', meaning: 'Repairing a heap by swapping an item that is too small with its larger child, again and again, until it is at least as large as both children.' },
    { term: 'In place', meaning: 'Rearranging the items inside the original list, without making a second copy of it.' },
  ],

  takeaway: 'Arrange the list so the largest item is always on top, then keep taking the top item and repairing the arrangement.',

  viz: {
    describe: 'Two pictures of the same data. On top, a row of bars, one per value, with a shaded band over the part of the array that is still a heap. Below, the same values drawn as a binary tree, each node showing its value with its array position underneath. The value being sifted down is terracotta, the child or children it is compared with are ochre, a pair that has just been swapped is brick red, and values that have reached their final position at the end of the array are forest green in both pictures.',
    inputs: arrayInputs({ size: 10 }),
    presets: [
      { label: 'Random list', values: { order: 'random', custom: [] } },
      { label: 'Already sorted', values: { order: 'sorted', custom: [] } },
      { label: 'Reversed: already a heap', values: { order: 'reversed', custom: [] } },
      { label: 'Worked example', values: { custom: [4, 10, 3, 5, 1] } },
    ],
    tryThis: [
      'Load "Reversed: already a heap". A list in descending order already obeys the heap rule, so the build phase makes no swaps at all. Then load "Already sorted" and watch the build phase move almost every value. Neither input makes the whole sort much cheaper or dearer.',
      'Pick any swap in the tree and find the same two bars in the array. The positions are always i and either 2i + 1 or 2i + 2. Notice how far apart those bars are when i is large.',
      'Raise the number of items to 31 and step through the build phase only. Count how many values move more than one level. Most positions are near the bottom of the tree, which is why building the heap costs about n comparisons, not n log n.',
    ],
    run,
    report: (r, c) => `Sorted ${r.sorted.length} values with ${c.comparisons || 0} comparisons (${r.buildComparisons} of them to build the heap) and ${c.writes || 0} array writes.\nHeap after the build phase: [${r.heap.join(', ')}]\nSorted: [${r.sorted.join(', ')}]`,
    experiment: {
      title: 'Comparisons as the list grows',
      note: 'Each point is a real run of this page\'s implementation. Random and already sorted input cost nearly the same, because heap sort destroys any existing order when it builds the heap. Both stay under the bound 2n log₂ n.',
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
        { label: '2n log₂ n (upper bound)', fn: (n) => 2 * n * Math.log2(n) },
        { label: 'n log₂ n (for scale)', fn: (n) => n * Math.log2(n), reference: true },
      ],
    },
  },

  logic: {
    intuition: 'Selection sort finds the largest remaining value by scanning everything, n steps each time. A heap keeps just enough order to make that search unnecessary: the largest value is always at the root, and after it is removed the damage is confined to one root-to-leaf path of about log₂ n positions. Heap sort is selection sort with that better way of finding the next value.',
    steps: [
      'Read the array as a binary tree: position 0 is the root, and the children of position `i` are positions `2i + 1` and `2i + 2`.',
      'Build a max-heap. Go through the parents from the last one, at position `⌊n/2⌋ − 1`, back to the root, and sift each one down.',
      'To sift a value down: find its larger child. If the value is at least as large as that child, stop. Otherwise swap the two and continue from the child\'s position.',
      'Now the largest value is at position 0. Swap it with the last value of the heap. It is in its final position.',
      'Shrink the heap by one, so the value just placed is no longer part of it, and sift the new root down.',
      'Repeat steps 4 and 5 until the heap holds a single value.',
    ],
    pseudocode: [
      'heap_sort(A):',
      '  n ← length(A)',
      '  for i ← ⌊n/2⌋ − 1 down to 0:',
      '    sift_down(A, i, n)',
      '  for end ← n − 1 down to 1:',
      '    swap A[0] and A[end]',
      '    sift_down(A, 0, end)',
      '',
      'sift_down(A, i, n):',
      '  while 2i + 1 < n:',
      '    c ← 2i + 1, r ← 2i + 2',
      '    if r < n and A[r] > A[c]:',
      '      c ← r',
      '    if A[i] ≥ A[c]: return',
      '    swap A[i] and A[c]',
      '    i ← c',
    ],
    decisions: [
      { title: 'Max-heap or min-heap?', text: 'A max-heap, so that each extracted value can be swapped into the position the shrinking heap has just given up at the end of the array. A min-heap would deliver values in ascending order but would need somewhere else to put them.' },
      { title: 'How to build the heap?', text: 'Bottom-up, by sifting down every parent from the last to the first. This is Floyd\'s construction and costs O(n). The alternative, inserting the values one at a time and sifting each up, costs O(n log n) in the worst case.' },
      { title: 'Which child to compare with?', text: 'The larger one. If the parent is at least as large as its larger child, it is at least as large as both. If they swap, the larger child becomes the parent of the smaller one, which keeps the heap rule on that side.' },
      { title: 'Where does the tree start?', text: 'This lesson numbers positions from 0, so children are at `2i + 1` and `2i + 2` and the parent of `i` is at `⌊(i − 1)/2⌋`. Numbering from 1 gives the tidier `2i`, `2i + 1` and `⌊i/2⌋`, which is the form many textbooks use.' },
    ],
    invariants: [
      'During the build phase, every position greater than `i` is the root of a valid heap.',
      'During the extraction phase, `A[0..end]` is a max-heap, and `A[end+1..n−1]` holds the largest values of the array in sorted order.',
      'Inside `sift_down`, the heap rule holds everywhere in the heap except possibly between position `i` and its children.',
    ],
    edgeCases: [
      'An empty list or a single value: both loops do nothing.',
      'A parent with only one child, which happens at most once in a heap: the test `r < n` skips the comparison between children.',
      'Equal values: `A[i] ≥ A[c]` stops the sift as soon as possible. A list of all-equal values is sorted in linear time.',
      'A list in descending order is already a max-heap, so the build phase makes no swaps. The extraction phase still does its full work.',
      'Equal values can come out in a different order from the one they went in: the swaps between the root and the end of the heap jump over everything in between.',
    ],
    correctness: 'First, `sift_down` is correct: if both subtrees below position `i` are heaps, then after the call the whole subtree rooted at `i` is a heap. Each iteration either finds the value at least as large as its larger child, in which case the heap rule holds at `i` and held everywhere below, or swaps it with that child, which fixes the rule at `i` and may break it only at the child\'s position, one level down. Second, the build loop is correct by induction from the bottom: leaves are heaps of one value, and when position `i` is processed both of its subtrees have already been made heaps. So after the loop the whole array is a heap. Third, in the extraction loop the root of a heap is its largest value. Swapping it to position `end` puts the largest remaining value just before the values already placed, all of which are at least as large. The swap leaves two valid subtrees under a possibly wrong root, which one `sift_down` repairs.',
    mistakes: [
      'Building the heap by sifting down from position 0 upward. A value can only be sifted correctly once both subtrees below it are heaps, so the loop must run from the last parent back to the root.',
      'Forgetting to check that the right child exists before reading it.',
      'Passing the full array length to `sift_down` during extraction, which lets it swap values back out of the sorted tail.',
      'Mixing the 0-based and 1-based child formulas.',
      'Comparing the parent with the left child only.',
    ],
  },

  code: {
    sample: {
      input: 'The list [29, 10, 14, 37, 13, 5, 31, 22]. Prints the array after the heap has been built, then the sorted list.',
      expected: 'heap:   37 29 31 22 13 5 14 10\nsorted: 5 10 13 14 22 29 31 37',
    },
    python: {
      source: `def sift_down(a, i, n):
    while 2 * i + 1 < n:
        c = 2 * i + 1
        r = c + 1
        if r < n and a[r] > a[c]:
            c = r
        if a[i] >= a[c]:
            return
        a[i], a[c] = a[c], a[i]
        i = c


def build_heap(a):
    n = len(a)
    for i in range(n // 2 - 1, -1, -1):
        sift_down(a, i, n)


def heap_sort(a):
    build_heap(a)
    for end in range(len(a) - 1, 0, -1):
        a[0], a[end] = a[end], a[0]
        sift_down(a, 0, end)


data = [29, 10, 14, 37, 13, 5, 31, 22]
heap = list(data)
build_heap(heap)
print("heap:  ", " ".join(str(x) for x in heap))
heap_sort(data)
print("sorted:", " ".join(str(x) for x in data))`,
      notes: [
        { line: 2, text: 'The loop continues while position `i` has at least a left child inside the heap of size `n`.' },
        { line: 5, text: 'Pick the larger child. The test `r < n` comes first, so the right child is only read if it exists.' },
        { line: 7, text: 'If the value is at least as large as its larger child, the heap rule holds and the sift is over.' },
        { line: 15, text: 'Positions from `n // 2` onward have no children. The loop starts at the last parent and works back to the root.' },
        { line: 22, text: 'The root is the largest value in the heap. It is swapped into the position the heap is about to give up.' },
        { line: 23, text: 'The heap now has `end` values. Passing `end` as the size keeps the sorted tail out of reach.' },
      ],
    },
    javascript: {
      source: `function siftDown(a, i, n) {
  while (2 * i + 1 < n) {
    let c = 2 * i + 1;
    const r = c + 1;
    if (r < n && a[r] > a[c]) c = r;
    if (a[i] >= a[c]) return;
    [a[i], a[c]] = [a[c], a[i]];
    i = c;
  }
}

function buildHeap(a) {
  const n = a.length;
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    siftDown(a, i, n);
  }
}

function heapSort(a) {
  buildHeap(a);
  for (let end = a.length - 1; end > 0; end--) {
    [a[0], a[end]] = [a[end], a[0]];
    siftDown(a, 0, end);
  }
}

const data = [29, 10, 14, 37, 13, 5, 31, 22];
const heap = data.slice();
buildHeap(heap);
console.log("heap:   " + heap.join(" "));
heapSort(data);
console.log("sorted: " + data.join(" "));`,
    },
    cpp: {
      source: `#include <iostream>
#include <utility>
#include <vector>

void siftDown(std::vector<int>& a, int i, int n) {
    while (2 * i + 1 < n) {
        int c = 2 * i + 1;
        int r = c + 1;
        if (r < n && a[r] > a[c]) c = r;
        if (a[i] >= a[c]) return;
        std::swap(a[i], a[c]);
        i = c;
    }
}

void buildHeap(std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    for (int i = n / 2 - 1; i >= 0; --i) {
        siftDown(a, i, n);
    }
}

void heapSort(std::vector<int>& a) {
    buildHeap(a);
    for (int end = static_cast<int>(a.size()) - 1; end > 0; --end) {
        std::swap(a[0], a[end]);
        siftDown(a, 0, end);
    }
}

void print(const char* label, const std::vector<int>& a) {
    std::cout << label;
    for (std::size_t k = 0; k < a.size(); ++k) {
        std::cout << " " << a[k];
    }
    std::cout << "\\n";
}

int main() {
    std::vector<int> data = {29, 10, 14, 37, 13, 5, 31, 22};
    std::vector<int> heap = data;
    buildHeap(heap);
    print("heap:  ", heap);
    heapSort(data);
    print("sorted:", data);
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'A heap of n values has about log₂ n levels. Sifting a value down costs at most two comparisons per level: one to pick the larger child and one to compare with it. Building the heap costs fewer than 2n comparisons in total. Each of the n − 1 extractions then sifts one value down at most log₂ n levels, for at most 2n log₂ n comparisons.',
    cases: [
      { case: 'Best', time: 'O(n log n)', when: 'Distinct values in any order. Existing order does not help, because the build phase rearranges the array into a heap regardless. Only a list of all-equal values is faster: O(n).' },
      { case: 'Average', time: 'O(n log n)', when: 'Random order. About 2n log₂ n comparisons, roughly twice as many as merge sort.' },
      { case: 'Worst', time: 'O(n log n)', when: 'Any order. No input can push it beyond 2n log₂ n comparisons plus the linear build.' },
    ],
    space: 'O(1). The heap lives in the array being sorted, and sifting needs only a few index variables. There is no recursion and no buffer.',
    memory: 'Each step of a sift jumps from position i to position 2i + 1 or 2i + 2. Near the root those are neighbours, but lower down they are far apart, so on a large array almost every step touches a different region of memory. This poor locality is the main reason heap sort is slower in practice than quick sort and merge sort, even though all three are O(n log n).',
    tradeoffs: 'Heap sort is the only one of the three standard O(n log n) sorts that is both in place and immune to bad inputs. It pays with roughly twice the comparisons of merge sort, scattered memory access, no stability and no benefit from existing order.',
    assumptions: [
      'Comparing two values and swapping two values each take constant time.',
      'The array allows constant-time access to any position. Heap sort is unsuitable for linked lists.',
      'The O(n) bound for building the heap is for the bottom-up construction used here.',
      'Counts on this page are comparisons and array writes performed by this implementation, not wall-clock time. Because of cache effects, heap sort\'s wall-clock time is worse than its counts suggest.',
    ],
  },

  tradeoffs: {
    excels: [
      'Sorting in place with a hard O(n log n) guarantee.',
      'Environments with little memory or no room for recursion, such as embedded and kernel code.',
      'As a fallback that rescues quick sort from its quadratic worst case.',
      'Producing only the largest k values: stop after k extractions.',
    ],
    struggles: [
      'Raw speed on large arrays, because of scattered memory access.',
      'Nearly sorted input, where insertion sort or a run-aware merge sort finish in close to linear time and heap sort does its full work.',
      'Anything that needs a stable sort.',
      'Linked lists and data on disk, where jumping between distant positions is expensive.',
    ],
    pitfalls: [
      'Building the heap in the wrong direction.',
      'Reading a right child that lies outside the heap.',
      'Letting the heap size passed to the sift include the sorted tail.',
    ],
    misunderstandings: [
      '"A heap is a sorted list." It is only partly ordered. The largest value is first, but the rest of the array is not in order, and two values on different branches may be in either order.',
      '"The tree is a separate data structure that needs memory." There are no nodes and no links. The tree is a way of reading positions in the one array: the children of position i are at 2i + 1 and 2i + 2.',
      '"Same growth rate as quick sort, so the same speed." Both are n log n on average, but heap sort makes more comparisons and uses memory in a scattered pattern, so it is usually noticeably slower in practice.',
      '"Building the heap costs n log n, like the rest." Building bottom-up costs about n, because half the positions are leaves that never move and most of the others can fall only a level or two.',
    ],
    constraints: [
      'Libraries that use heap sort usually use it only as a fallback, after detecting that quick sort is behaving badly on the current input.',
      'Heap sort is hard to parallelize: every extraction goes through the root.',
    ],
    alternatives: [
      { id: 'quick-sort', name: 'Quick Sort', when: 'Typical speed matters more than a worst-case guarantee.' },
      { id: 'merge-sort', name: 'Merge Sort', when: 'You need stability, or the data is a linked list or on disk, and can afford O(n) extra space.' },
      { id: 'insertion-sort', name: 'Insertion Sort', when: 'The list is short or nearly sorted.' },
      { id: 'selection-sort', name: 'Selection Sort', when: 'The list is tiny and simplicity matters. It follows the same plan without the heap.' },
    ],
    comparison: {
      columns: ['', 'Heap sort', 'Quick sort', 'Merge sort'],
      rows: [
        ['Worst-case time', 'O(n log n)', 'O(n²)', 'O(n log n)'],
        ['Average time', 'O(n log n)', 'O(n log n)', 'O(n log n)'],
        ['Extra space', 'O(1)', 'O(log n) stack', 'O(n)'],
        ['Stable', 'No', 'No', 'Yes'],
        ['Memory access pattern', 'Scattered', 'Sequential scans', 'Sequential scans'],
        ['Helped by existing order', 'No', 'Depends on pivot rule', 'Only in run-aware variants'],
      ],
    },
  },

  applications: [
    { title: 'The fallback in introsort', status: 'established', text: 'Introsort, the algorithm behind typical implementations of C++ `std::sort`, starts as quick sort and switches to heap sort when the recursion depth shows that partitioning is going badly. The switch gives the whole sort an O(n log n) worst case.' },
    { title: 'Sorting inside an operating system kernel', status: 'established', text: 'The Linux kernel\'s general-purpose sort function is a heap sort. The method suits kernel code, which has a small stack, should not need a buffer to sort, and must not be slowed to quadratic time by data that someone else chooses.' },
    { title: 'Priority queues', status: 'established', text: 'The heap that drives this sort is the standard implementation of a priority queue: insert an item, or remove the largest (or smallest), in O(log n). Dijkstra\'s shortest-path algorithm, Huffman coding and event-driven simulations all depend on it.' },
    { title: 'The largest k of n items', status: 'established', text: 'A heap delivers the largest items one at a time, so the top k can be had without sorting the rest. Library routines for partial sorting and for "k largest" queries are commonly built on heaps.' },
  ],

  connections: [
    { to: 'selection-sort', type: 'prerequisite', why: 'Both repeatedly select the largest remaining value and swap it to the end of the unsorted part. Heap sort replaces the linear scan with a heap, cutting each selection from O(n) to O(log n).' },
    { to: 'quick-sort', type: 'same-problem', why: 'Both sort in place. Introsort pairs them: quick sort for typical speed, heap sort as the fallback that guarantees O(n log n).' },
    { to: 'merge-sort', type: 'same-problem', why: 'Both guarantee O(n log n) on every input. Merge sort spends O(n) memory and keeps stability; heap sort spends none and loses it.' },
    { to: 'dijkstra', type: 'application', why: 'Dijkstra\'s algorithm is driven by the same structure: a binary heap that repeatedly hands back the smallest remaining item.' },
    { to: 'huffman-coding', type: 'application', why: 'Huffman\'s construction repeatedly removes the two smallest weights from a heap and inserts their sum, the same remove-and-repair cycle as the extraction phase.' },
    { to: 'concept:heap', type: 'prerequisite', why: 'The algorithm is two uses of one operation on a heap, sift down: first to establish the heap order, then to restore it after each removal.' },
    { to: 'concept:priority-queue', type: 'related', why: 'Heap sort is what you get by inserting every value into a priority queue and removing them all, with the queue stored inside the array being sorted.' },
    { to: 'concept:in-place', type: 'related', why: 'The heap and the sorted output share the one array, with a moving boundary between them, so no second array is needed.' },
    { to: 'concept:invariant', type: 'prerequisite', why: 'Its correctness is carried by one invariant: the front of the array is a max-heap and the back holds the largest values in sorted order.' },
    { to: 'discipline:graph-theory', type: 'application', why: 'Shortest-path and minimum-spanning-tree algorithms repeatedly need the cheapest remaining item, which a binary heap supplies in logarithmic time.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'A heap is stored in an array with positions numbered from 0. Where are the children of the value at position 3?',
      options: ['Positions 4 and 5', 'Positions 6 and 7', 'Positions 7 and 8', 'Positions 8 and 9'],
      answer: 2,
      explain: [
        'Positions 4 and 5 are the next positions in the array, but they are the children of positions 1 and 2.',
        '6 and 7 would be right with positions numbered from 1, where the children of i are 2i and 2i + 1.',
        'Correct. With positions numbered from 0 the children of i are at 2i + 1 and 2i + 2, which gives 7 and 8.',
        'No position has 8 and 9 as its children. Position 3 has 7 and 8, and position 4 has 9 and 10.',
      ],
    },
    {
      type: 'predict',
      q: 'The list is 4, 10, 3, 5, 1. What does the array look like when the build phase has finished and the first extraction is about to start?',
      options: ['10, 5, 3, 4, 1', '10, 4, 3, 5, 1', '10, 5, 4, 3, 1', '1, 3, 4, 5, 10'],
      answer: 0,
      explain: [
        'Correct. The 10 passes its check. The 4 at the root is swapped with 10, then with 5. Every parent is now at least as large as its children: 10 over 5 and 3, and 5 over 4 and 1.',
        'This stops one swap too early. The 4 would sit above the 5, which breaks the heap rule.',
        'That is the list sorted in descending order. It is a valid heap, but it is not the one the build phase produces from this input. A heap is only partly ordered.',
        'That is the final sorted list, not the heap.',
      ],
      tryInput: { custom: [4, 10, 3, 5, 1] },
    },
    {
      type: 'debug',
      q: 'With a correct `sift_down`, this version turns 1, 2, 3, 4 into 1, 2, 4, 3. Which line is wrong?',
      code: `def heap_sort(a):
    n = len(a)
    for i in range(n // 2):
        sift_down(a, i, n)
    for end in range(n - 1, 0, -1):
        a[0], a[end] = a[end], a[0]
        sift_down(a, 0, end)`,
      options: ['Line 3: the build loop must run from the last parent back to position 0', 'Line 5: the loop should stop at 1, not 0', 'Line 6: the swap should come after the sift', 'Line 7: the heap size should be end + 1'],
      answer: 0,
      explain: [
        'Correct. Sifting position 0 first compares it with children whose own subtrees are not yet heaps. A larger value deeper down, here the 4, never gets the chance to rise to the root. Use `range(n // 2 - 1, -1, -1)`.',
        '`range(n - 1, 0, -1)` already stops at 1. A heap of one value needs no extraction.',
        'The root must be moved out first. The sift then repairs the heap that is left.',
        'After the swap, position `end` holds a sorted value and must stay outside the heap, so the size is `end`.',
      ],
    },
    {
      type: 'choice',
      q: 'Why does building the heap bottom-up cost only about n comparisons, when each sift can travel up to log₂ n levels?',
      options: ['Because half of the sifts are skipped at random', 'Because most positions are near the bottom of the tree, where a value can fall only a level or two', 'Because the array is already nearly a heap', 'Because comparisons during the build phase are not counted'],
      answer: 1,
      explain: [
        'Nothing is random or skipped. Every parent is sifted.',
        'Correct. Half the positions are leaves and are never sifted, a quarter can fall one level, an eighth two levels, and so on. The total number of levels fallen is less than n.',
        'The bound holds for every input, including ones that are far from being a heap.',
        'They are counted. There are simply fewer of them than the rough estimate suggests.',
      ],
    },
    {
      type: 'challenge',
      title: 'The k largest with a small heap',
      prompt: 'Write a function that returns the k largest of n values using a heap that never holds more than k values. Keep a min-heap of the k largest values seen so far. For each new value, compare it with the root, and if it is larger, replace the root and sift down. Count comparisons for n = 1000 and k = 10, and compare with sorting all 1000 values.',
      hints: ['A min-heap is the same code with the comparisons reversed. Its root is the smallest of the k values kept, which is the one a newcomer has to beat.', 'Most new values lose to the root and cost a single comparison.'],
    },
  ],

  compare: {
    idea: 'Keep the unsorted values in a heap and repeatedly move its largest value to the end.',
    requires: 'A list where you can jump to any position, and items that can be compared. It is always correct.',
    sensitivity: 'Low. O(n log n) comparisons on every input, and existing order does not help.',
    memory: 'In place. No buffer and no recursion.',
    difficulty: 'moderate',
    difficultyNote: 'The sift is short, but the index arithmetic and the direction of the build loop are easy to get wrong.',
    limits: 'Equal items may change their relative order. In practice it is slower than quick sort, because it jumps around in memory.',
    useWhen: 'You need a sort that is never slow, whatever the list, and that uses no extra memory.',
  },

  advanced: {
    history: 'J. W. J. Williams published heapsort in 1964 as Algorithm 232 in Communications of the ACM, and with it introduced the heap as a data structure. Later the same year Robert W. Floyd published Algorithm 245, Treesort 3, which builds the heap bottom-up in linear time. That construction is the one used on this page and in most textbooks. In 1997 David Musser combined quick sort with a heap sort fallback under the name introsort, which gave heap sort its most common role today.',
    derivation: 'Cost of the build phase. Define the height of a position as the number of levels between it and the deepest leaf below it. A heap of $n$ values has at most $\\lceil n/2^{h+1} \\rceil$ positions of height $h$, and sifting down from height $h$ takes at most $h$ steps of two comparisons each. So the number of steps is at most\n\n$$\\sum_{h=0}^{\\lfloor \\log_2 n \\rfloor} h \\left\\lceil \\frac{n}{2^{h+1}} \\right\\rceil = O\\!\\left(n \\sum_{h \\ge 0} \\frac{h}{2^{h+1}}\\right) = O(n),$$\n\nbecause $\\sum_{h \\ge 0} h/2^{h+1} = 1$. A sharper count shows the sum of the heights of all positions is less than $n$, so the build phase uses fewer than $2n$ comparisons.\n\nCost of the extraction phase. When the heap holds $m$ values a sift from the root takes at most $\\lfloor \\log_2 m \\rfloor$ steps, so the phase uses at most\n\n$$\\sum_{m=1}^{n-1} 2\\lfloor \\log_2 m \\rfloor \\le 2n\\log_2 n$$\n\ncomparisons.',
    proof: 'Sift-down lemma: if the subtrees rooted at the children of position $i$ are max-heaps (within the first $m$ positions), then after `sift_down(A, i, m)` the subtree rooted at $i$ is a max-heap. Proof by induction on the height of $i$. If $A[i]$ is at least its larger child, the heap rule holds at $i$ and nothing changes. Otherwise the larger child $A[c]$ is swapped up. It is at least as large as the other child and, being the root of a heap, as everything below $c$, so the rule holds at $i$. The subtree at $c$ now has a new root above two unchanged heaps, and the lemma applies to it at smaller height.\n\nBuild: positions $\\lfloor n/2 \\rfloor$ and beyond are leaves, hence heaps. Processing $i = \\lfloor n/2 \\rfloor - 1, \\dots, 0$ in that order, both children of $i$ have larger indices and are already roots of heaps, so by the lemma $i$ becomes one too.\n\nExtraction: assume $A[0..end]$ is a max-heap and $A[end+1..n-1]$ holds the $n-1-end$ largest values in ascending order. $A[0]$ is the maximum of the heap, so swapping it to position $end$ extends the sorted tail by the correct value. The children of position 0 still root heaps within $A[0..end-1]$, so `sift_down(A, 0, end)` restores the heap. At $end = 0$ the whole array is sorted.',
    complexityProof: 'Combining the two phases, heap sort uses at most $2n + 2n\\log_2 n = O(n \\log n)$ comparisons and at most as many swaps as sift steps plus $n-1$, on every input. By the comparison lower bound of $\\lceil \\log_2 n! \\rceil = \\Omega(n\\log n)$ this is optimal up to a constant factor. Extra space is $O(1)$: a constant number of indices and one temporary for swapping.',
    variants: [
      { name: 'Bottom-up heap sort', text: 'Sifts the new root all the way to a leaf along the path of larger children, using one comparison per level, then moves it back up to its place. Because a value taken from the bottom of the heap usually belongs near the bottom, this cuts the comparisons to roughly n log₂ n.' },
      { name: 'Heap construction by insertion', text: 'Williams\'s original way to build the heap: add the values one at a time, sifting each up. O(n log n) in the worst case, against O(n) for Floyd\'s bottom-up method.' },
      { name: 'd-ary heap sort', text: 'Gives every position d children instead of two. The tree is shallower, which reduces swaps and can improve cache behaviour, at the cost of more comparisons per level.' },
      { name: 'Smoothsort', text: 'Dijkstra\'s variant, built on a different heap shape, that approaches O(n) on input that is already nearly sorted while keeping the O(n log n) worst case.' },
      { name: 'Introsort', text: 'Quick sort that monitors its own recursion depth and hands the range to heap sort if the depth exceeds a multiple of log n.' },
    ],
    implementation: 'Write the sift as a loop, not a recursion. Instead of swapping at every level, hold the sifted value aside, move children up into the gap, and write the value once at the end, which halves the writes. Take care with the heap size passed during extraction. For large arrays, measure before choosing heap sort: its cache behaviour makes it slower than its comparison count predicts.',
    benchmarking: 'Operation counts on this site are exact and repeatable, but they flatter heap sort. Counting comparisons and writes ignores the cost of cache misses, which dominates on arrays much larger than the processor cache. When timing sorts, include array sizes well beyond the cache size.',
    references: [
      { authors: 'J. W. J. Williams', year: 1964, title: 'Algorithm 232: Heapsort', venue: 'Communications of the ACM 7(6), 347-348' },
      { authors: 'R. W. Floyd', year: 1964, title: 'Algorithm 245: Treesort 3', venue: 'Communications of the ACM 7(12), 701' },
      { authors: 'D. E. Knuth', year: 1998, title: 'The Art of Computer Programming, Volume 3: Sorting and Searching (2nd edition), section 5.2.3', venue: 'Addison-Wesley' },
      { authors: 'D. R. Musser', year: 1997, title: 'Introspective sorting and selection algorithms', venue: 'Software: Practice and Experience 27(8), 983-993' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Heapsort".',
      'R. Sedgewick and K. Wayne, *Algorithms* (4th edition), section 2.4.',
    ],
  },

  tests: [
    { name: 'sorts a random list; the build phase yields a max-heap', input: { size: 40, order: 'random', seed: 11 }, check: checkRun },
    { name: 'sorts a list with few distinct values', input: { size: 33, order: 'few', seed: 5 }, check: checkRun },
    { name: 'sorts a sorted list of maximum size', input: { size: 64, order: 'sorted', seed: 2 }, check: checkRun },
    { name: 'sorts a nearly sorted list', input: { size: 31, order: 'nearly', seed: 4 }, check: checkRun },
    { name: 'the worked example: heap 10,5,3,4,1 after 6 comparisons, 12 in total', input: { custom: [4, 10, 3, 5, 1] },
      check: (r, c) => (r.heap.join(',') === '10,5,3,4,1' && r.buildComparisons === 6 && c.comparisons === 12 && c.writes === 18 && r.sorted.join(',') === '1,3,4,5,10') || `heap ${r.heap.join(',')}, ${r.buildComparisons} build comparisons, ${c.comparisons} total, ${c.writes} writes` },
    { name: 'a descending list is already a heap: the build phase makes no swaps', input: { custom: [7, 6, 5, 4, 3, 2, 1] },
      check: (r, c) => (r.heap.join(',') === '7,6,5,4,3,2,1' && r.buildComparisons === 6 && checkRun(r, c) === true) || `heap ${r.heap.join(',')}, ${r.buildComparisons} build comparisons` },
    { name: 'a generated reversed list is a heap before the build phase', input: { size: 10, order: 'reversed', seed: 7 },
      check: (r) => r.heap.join(',') === r.original.join(',') || 'the build phase changed a descending list' },
    { name: 'all-equal values never swap during a sift', input: { custom: [5, 5, 5, 5, 5, 5, 5, 5] },
      check: (r, c) => (c.writes === 14 && c.comparisons === 18) || `got ${c.comparisons} comparisons and ${c.writes} writes` },
    { name: 'handles duplicates and negatives', input: { custom: [3, -1, 3, 0, -7, 3] },
      check: (r, c) => (r.sorted.join(',') === '-7,-1,0,3,3,3' && checkRun(r, c) === true) || `got ${r.sorted.join(',')}` },
    { name: 'a single value needs no comparisons', input: { custom: [42] },
      check: (r, c) => (r.sorted.join(',') === '42' && !c.comparisons && !c.writes) || 'a one-element list should cost nothing' },
  ],
};
