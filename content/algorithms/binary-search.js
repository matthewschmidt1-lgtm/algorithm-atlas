import { searchInputs, resolveSearch } from '../../js/lib/arrays.js';

function run(input, t) {
  const { array, target } = resolveSearch(input);
  const n = array.length;
  const probes = [];
  let lo = 0, hi = n - 1, index = -1;

  // mid: the probed position; verdict: its role; discard: [from, to], the positions this probe rules out.
  const views = ({ mid = null, verdict = 'compare', discard = null } = {}) => {
    const roles = {};
    for (let k = 0; k < n; k++) if (k < lo || k > hi) roles[k] = 'dim';
    if (discard) for (let k = discard[0]; k <= discard[1]; k++) roles[k] = 'rejected';
    if (mid !== null) roles[mid] = verdict;
    const markers = [];
    if (lo >= 0 && lo < n) markers.push({ index: lo, label: 'lo' });
    if (mid !== null) markers.push({ index: mid, label: 'mid' });
    if (hi >= 0 && hi < n) markers.push({ index: hi, label: 'hi' });
    return [
      { kind: 'bars', values: array.slice(), roles, markers, range: lo <= hi ? [lo, hi] : undefined,
        legend: [{ label: 'could still hold the target', role: 'default' }, { label: 'middle value, being checked', role: 'compare' }, { label: 'ruled out by this check', role: 'rejected' }, { label: 'match', role: 'done' }] },
      { kind: 'rows', rows: [
        { label: 'Looking for', cells: [{ t: target, role: 'target' }] },
        { label: 'Checked', cells: probes.map((p) => ({ t: array[p], sub: p, role: array[p] === target ? 'done' : 'dim' })) },
      ] },
    ];
  };

  t.frame(() => ({ line: 1, note: `The list has ${n} values in increasing order and we are looking for **${target}**. Every position from \`lo\` = 0 to \`hi\` = ${n - 1} could still hold it. Bars fade once they have been ruled out.`, views: views(), vars: { target, lo, hi } }));

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const size = hi - lo + 1;
    t.frame(() => ({ line: [2, 3], note: `Positions ${lo} to ${hi} are still possible: ${size} ${size === 1 ? 'value' : 'values'}. The middle of that range is position ${mid}.`, views: views({ mid }), vars: { target, lo, mid, hi } }));
    t.count('comparisons');
    probes.push(mid);
    const v = array[mid];
    if (v === target) {
      index = mid;
      t.frame(() => ({ line: [4, 5], note: `Position ${mid} holds ${v}. That is the target, so stop. It took ${probes.length} ${probes.length === 1 ? 'check' : 'checks'}.`, views: views({ mid, verdict: 'done' }), vars: { target, lo, mid, hi, 'A[mid]': v } }));
      break;
    }
    if (v < target) {
      const from = lo, gone = mid - lo + 1;
      t.frame(() => ({ line: [6, 7], note: `Position ${mid} holds ${v}, which is smaller than ${target}. The list is sorted, so everything to the left of ${v} is smaller still. Positions ${from} to ${mid} are ruled out: ${gone} ${gone === 1 ? 'value' : 'values'} at once.`, views: views({ mid, verdict: 'rejected', discard: [from, mid] }), vars: { target, lo, mid, hi, 'A[mid]': v } }));
      lo = mid + 1;
    } else {
      const to = hi, gone = hi - mid + 1;
      t.frame(() => ({ line: [8, 9], note: `Position ${mid} holds ${v}, which is larger than ${target}. The list is sorted, so everything to the right of ${v} is larger still. Positions ${mid} to ${to} are ruled out: ${gone} ${gone === 1 ? 'value' : 'values'} at once.`, views: views({ mid, verdict: 'rejected', discard: [mid, to] }), vars: { target, lo, mid, hi, 'A[mid]': v } }));
      hi = mid - 1;
    }
  }

  if (index < 0) {
    t.frame(() => ({ line: 10, note: `\`lo\` is now ${lo} and \`hi\` is ${hi}. \`lo\` has passed \`hi\`, so no positions are left. **${target} is not in the list**, and it took only ${probes.length} ${probes.length === 1 ? 'check' : 'checks'} to be sure.`, views: views(), vars: { target, lo, hi, result: -1 } }));
  } else {
    t.frame(() => ({ line: 5, note: `Found **${target}** at position ${index} after checking ${probes.length} of the ${n} values. The other ${n - probes.length} were never looked at.`, views: views({ mid: index, verdict: 'done' }), vars: { target, result: index } }));
  }
  return { index, array, target, probes };
}

const worstCase = (n) => Math.floor(Math.log2(n)) + 1;

export default {
  meta: {
    id: 'binary-search',
    name: 'Binary Search',
    aliases: ['half-interval search', 'logarithmic search', 'binary chop', 'bisection search'],
    kind: 'algorithm',
    discipline: 'algorithms',
    alsoIn: [
      { id: 'mathematics', why: 'It is the bisection method on a discrete domain: keep halving an interval that is known to contain the answer.' },
    ],
    subfield: 'Searching',
    family: 'Interval-halving search',
    lab: 'sorting-searching',
    compareGroup: 'searching',
    summary: 'Finds a value in a sorted list by checking the middle item and discarding the half that cannot contain it, repeating until the value is found or nothing is left.',
    difficulty: 'beginner',
    order: 20,
    paradigms: ['divide-and-conquer'],
    randomized: false,
    approximate: false,
    time: { best: 'O(1)', average: 'O(log n)', worst: 'O(log n)', class: 'logarithmic' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['find an item in a sorted list', 'look up a word in a dictionary', 'search sorted data fast', 'find where a value belongs', 'guess a number with higher or lower'],
      techniques: ['halving the search range', 'loop invariant', 'midpoint'],
      applications: ['standard libraries', 'databases', 'search engines', 'scientific computing'],
    },
    prerequisites: ['linear-search', 'concept:array'],
  },

  bigIdea: {
    simple: "Binary search finds an item in a sorted list by cutting the list in half again and again. You already know the idea. To find a word in a paper dictionary, you do not start at page one. You open the book near the middle and look at a word. If your word comes later in the alphabet, you can ignore the whole first half. If it comes earlier, you can ignore the second half. Then you do the same with the half that is left. Each look throws away half of the remaining pages, so the pile shrinks very fast. A list of a thousand items needs about ten looks. A list of a million needs only about twenty. There is one firm condition: the list must already be in order. If it is not, a look at the middle tells you nothing about which half to keep, and the method can give wrong answers.",
    what: 'Binary search finds a target value in a sorted list. It keeps a range of positions that could still hold the target, looks at the value in the middle of that range, and uses the sorted order to discard the half where the target cannot be. It stops when the middle value is the target or the range is empty.',
    why: 'Checking items one by one takes time proportional to the length of the list. When the list is sorted, that work is wasteful, because a single comparison with the middle value says something about half of the list at once. Binary search turns that observation into a method whose cost grows with the number of times the list can be halved, not with its length.',
    when: 'Use it when the data is sorted and any position can be read directly, as in an array. If the data is unsorted and searched rarely, a plain [linear search](#/algorithm/linear-search) is simpler than sorting first. If you only ever ask "is this exact key present?", a [hash table](#/algorithm/hash-table) is usually faster still. Binary search keeps one advantage over hashing: it can also answer "what is the nearest value?" and "where would this value go?".',
    interesting: 'The idea fits in a sentence, yet correct code is hard to write. The boundaries of the range are easy to get wrong by one, and a midpoint formula that looks obviously right, `(lo + hi) / 2`, sat unnoticed in widely used library code for years before anyone found that it breaks on very large arrays.',
    where: 'It is in the standard library of nearly every language: `bisect` in Python, `std::lower_bound` in C++, `Arrays.binarySearch` in Java. The `git bisect` command uses the same halving to find which commit introduced a bug, and database indexes are built on a many-way version of the idea.',
    analogy: {
      title: 'The higher-or-lower guessing game',
      text: 'A friend picks a whole number from 1 to 100 and answers each guess with "higher", "lower" or "correct". Guess 50. If the answer is "higher", the number is somewhere from 51 to 100, so guess the middle of that range. Keep guessing the middle of whatever range is left. Each answer removes half of the remaining numbers, and seven guesses are always enough, whatever number was picked.',
      limits: 'In the game the number is always there. A list might not contain the target, so the search must also notice when the range has shrunk to nothing. The game also uses every number from 1 to 100 with no gaps. A real list has gaps, so binary search halves the range of positions, not the range of values, and looks at whatever value sits in the middle position. Last, your friend can answer about any guess at once. A computer needs to be able to jump straight to any position, which an array allows and a chain of linked items does not.',
    },
  },

  example: {
    setup: 'Find the number 16 in this sorted list of seven numbers: 2, 5, 8, 12, 16, 23, 38. Positions are counted from 0, so 2 is at position 0 and 38 is at position 6.',
    steps: [
      'All seven positions, 0 to 6, could hold 16. The middle one is position 3, which holds 12. Since 12 is smaller than 16, the target can only be to the right. Positions 0 to 3 are ruled out.',
      'Positions 4 to 6 are left. The middle one is position 5, which holds 23. Since 23 is bigger than 16, the target can only be to the left. Positions 5 and 6 are ruled out.',
      'Only position 4 is left. It holds 16. That is the target.',
    ],
    result: 'The answer is position 4, found after looking at just 3 values: 12, then 23, then 16. Checking one by one from the left would have taken 5 looks. The gap grows quickly with the size of the list: for a million sorted values, binary search needs at most 20 looks.',
    tryInput: { custom: [2, 5, 8, 12, 16, 23, 38], target: 16 },
  },

  terms: [
    { term: 'Sorted', meaning: 'Arranged in order, here from smallest to largest. Binary search only works on a sorted list.' },
    { term: 'Index', meaning: 'The position number of an item in a list. Counting usually starts at 0.' },
    { term: 'Target', meaning: 'The value you are trying to find.' },
    { term: 'Search range', meaning: 'The stretch of positions that could still hold the target. It starts as the whole list and shrinks with every check.' },
    { term: 'Midpoint', meaning: 'The position in the middle of the search range. It is the one position binary search looks at in each round.' },
    { term: 'Probe', meaning: 'One look at one position of the list. Counting probes is how we measure the work a search does.' },
    { term: 'Logarithm', meaning: 'The number of times you can halve a number before you get down to 1. For a thousand it is about 10, and for a million about 20.' },
    { term: 'Integer overflow', meaning: 'What happens when a calculation produces a number too big for the fixed amount of memory set aside to store it. The stored result is wrong.' },
  ],

  takeaway: 'Look at the middle of a sorted list, throw away the half that cannot hold what you want, and repeat with the half that is left.',

  viz: {
    describe: 'A row of bars rising from left to right, one per value in the sorted list. Markers under the bars show lo and hi, the ends of the range that could still hold the target, and mid, the position being checked. The middle bar is ochre, the half ruled out by the current check is brick red, bars ruled out earlier are faded, and a match is forest green. Below, one strip shows the target and another lists the values checked so far.',
    inputs: searchInputs({ size: 20 }),
    presets: [
      { label: 'Target in the list', values: { where: 'random', custom: [] } },
      { label: 'Best case: the middle value', values: { where: 'middle', custom: [] } },
      { label: 'Worst case: target is absent', values: { where: 'missing', custom: [] } },
      { label: 'Larger list: 63 values', values: { size: 63, where: 'missing', custom: [] } },
    ],
    tryThis: [
      'Set the number of items to 15 and search for a value that is not in the list: the run makes 4 checks. Now try 31 items, then 63. Each time the list roughly doubles, the number of checks rises by exactly one.',
      'Set "Search for" to the first value. Linear search would find it in one comparison, but binary search takes one of its longest routes. Binary search wins in the worst case and on average, not on every single input.',
      'Type your own values `10, 20, 30, 40, 50` and set the target to 35. Watch `lo` move past `hi`. That crossing is how the search knows the value is absent.',
    ],
    run,
    report: (r, c) => `${r.index >= 0 ? `Found ${r.target} at position ${r.index}` : `${r.target} is not in the list`} after ${c.comparisons || 0} ${c.comparisons === 1 ? 'check' : 'checks'}. The worst case for ${r.array.length} values is ${worstCase(r.array.length)}.\nPositions checked: ${r.probes.join(', ')}`,
    experiment: {
      title: 'Checks as the list grows',
      note: 'Each point is a real run of this page\'s implementation. Sizes are one less than a power of two, where a search for an absent value always makes exactly log₂(n + 1) checks. For contrast, linear search would need n: 8,191 checks at the largest size.',
      metric: 'comparisons',
      metricLabel: 'Values checked',
      sizeLabel: 'Number of items (n)',
      sizes: [7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191],
      variants: [
        { id: 'missing', label: 'Target absent (worst case)' },
        { id: 'middle', label: 'Target is the middle value (best case)' },
      ],
      input: (n, variant, seed) => ({ size: n, where: variant, seed, custom: [] }),
      theory: [
        { label: 'log₂(n + 1)', fn: (n) => Math.log2(n + 1), variant: 'missing' },
      ],
    },
  },

  logic: {
    intuition: 'In a sorted list, one value tells you about many. If the middle value is too small, so is everything before it. If it is too large, so is everything after it. Either way a single comparison removes half of the candidates, and a quantity that halves at every step reaches zero very quickly.',
    steps: [
      'Set `lo` to the first position and `hi` to the last. The target, if present, lies between them.',
      'If `lo` is greater than `hi`, the range is empty. Stop: the target is not in the list.',
      'Compute the middle position `mid` of the range.',
      'If the value at `mid` equals the target, stop and return `mid`.',
      'If the value at `mid` is smaller than the target, the target can only be to the right. Set `lo` to `mid + 1`.',
      'Otherwise the target can only be to the left. Set `hi` to `mid − 1`. Repeat from step 2.',
    ],
    pseudocode: [
      'binary_search(A, target):',
      '  lo ← 0;  hi ← length(A) − 1',
      '  while lo ≤ hi:',
      '    mid ← lo + ⌊(hi − lo) / 2⌋',
      '    if A[mid] = target:',
      '      return mid',
      '    if A[mid] < target:',
      '      lo ← mid + 1',
      '    else:',
      '      hi ← mid − 1',
      '  return −1',
    ],
    decisions: [
      { title: 'How to compute the midpoint?', text: 'The obvious formula is `(lo + hi) / 2`. In languages with fixed-size integers, such as C, C++ and Java, the sum `lo + hi` can exceed the largest value an integer can hold when the array has more than about a billion elements, and the result is garbage. `lo + (hi − lo) / 2` gives the same midpoint without ever forming a number larger than `hi`. Python integers grow as needed, so the bug cannot occur there, but the safe form is a good habit in every language.' },
      { title: 'Closed or half-open range?', text: 'This lesson uses a closed range: both `lo` and `hi` are positions that could hold the target, the loop runs while `lo ≤ hi`, and the updates are `mid + 1` and `mid − 1`. The other common convention makes `hi` one past the end: the loop runs while `lo < hi` and the left-hand update is `hi = mid`. Both are correct. Mixing pieces of the two is the classic source of off-by-one bugs.' },
      { title: 'Stop at any match, or find the first one?', text: 'With duplicates, the version here returns whichever matching position it happens to probe. Library routines such as `bisect_left` and `std::lower_bound` instead keep narrowing until they reach the first position whose value is not less than the target, which also says where a missing value would be inserted.' },
    ],
    invariants: [
      'If the target is in the list at all, its position `p` satisfies `lo ≤ p ≤ hi`.',
      'Every value at a position before `lo` is smaller than the target, and every value at a position after `hi` is larger.',
      'The size of the range, `hi − lo + 1`, shrinks by at least half on every pass that does not find the target.',
    ],
    edgeCases: [
      'An empty list: `hi` starts at −1, the loop never runs, and the result is "not found".',
      'A single value: one probe decides it.',
      'A target smaller than every value or larger than every value: the range collapses at one end of the list.',
      'Duplicates: some matching position is returned, not necessarily the first.',
      'An unsorted list: the search still terminates and returns something, but the answer may be wrong. Nothing in the algorithm detects this.',
    ],
    correctness: 'The loop maintains the invariant that the target, if present, lies at a position between `lo` and `hi` inclusive. It holds at the start because the range is the whole list. Suppose it holds and `A[mid] < target`. Because the list is sorted, every position up to `mid` holds a value smaller than the target, so the target cannot be there and setting `lo` to `mid + 1` keeps the invariant. The other case is symmetric. If the loop returns `mid`, then `A[mid]` equals the target. If it exits because `lo > hi`, the range is empty, and by the invariant the target is nowhere in the list. The loop must end because the range shrinks by at least one position on every pass: `mid` itself is always excluded.',
    mistakes: [
      'Writing `while lo < hi` with a closed range. The loop then stops while one candidate is still unchecked, and targets at that position are reported missing.',
      'Updating with `lo = mid` or `hi = mid` in the closed-range version. When the range has two values the midpoint equals `lo`, nothing changes, and the loop never ends.',
      'Computing the midpoint as `(lo + hi) / 2` in a language with fixed-size integers. It works in every small test and fails on very large arrays.',
      'Running it on data that is not sorted, or that is sorted by a different rule than the one used for comparison (for example sorted ignoring case, compared with case).',
    ],
  },

  code: {
    sample: {
      input: 'The sorted list [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], searched for 23 and then for 7.',
      expected: '23 found at index 5 after 3 probes\n7 not found after 3 probes',
    },
    python: {
      source: `def binary_search(a, target):
    lo, hi = 0, len(a) - 1
    probes = 0
    while lo <= hi:
        mid = lo + (hi - lo) // 2
        probes += 1
        if a[mid] == target:
            return mid, probes
        if a[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1, probes


data = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
for target in (23, 7):
    index, probes = binary_search(data, target)
    if index >= 0:
        print(f"{target} found at index {index} after {probes} probes")
    else:
        print(f"{target} not found after {probes} probes")`,
      notes: [
        { line: 2, text: 'A closed range: both `lo` and `hi` are positions that could still hold the target.' },
        { line: 4, text: '`<=`, not `<`. When `lo` equals `hi` there is still one candidate left to check.' },
        { line: 5, text: 'The overflow-safe midpoint. Python integers cannot overflow, but this form is correct in every language.' },
        { line: 10, text: '`mid + 1`, not `mid`: position `mid` has just been checked, so it leaves the range. This is what guarantees the loop ends.' },
      ],
    },
    javascript: {
      source: `function binarySearch(a, target) {
  let lo = 0;
  let hi = a.length - 1;
  let probes = 0;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    probes++;
    if (a[mid] === target) {
      return { index: mid, probes };
    }
    if (a[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return { index: -1, probes };
}

const data = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
for (const target of [23, 7]) {
  const { index, probes } = binarySearch(data, target);
  if (index >= 0) {
    console.log(target + " found at index " + index + " after " + probes + " probes");
  } else {
    console.log(target + " not found after " + probes + " probes");
  }
}`,
    },
    cpp: {
      source: `#include <iostream>
#include <vector>

int binary_search(const std::vector<int>& a, int target, int& probes) {
    int lo = 0;
    int hi = static_cast<int>(a.size()) - 1;
    probes = 0;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;  // never (lo + hi) / 2: the sum can overflow
        ++probes;
        if (a[mid] == target) {
            return mid;
        }
        if (a[mid] < target) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return -1;
}

int main() {
    std::vector<int> data = {2, 5, 8, 12, 16, 23, 38, 56, 72, 91};
    for (int target : {23, 7}) {
        int probes = 0;
        int index = binary_search(data, target, probes);
        if (index >= 0) {
            std::cout << target << " found at index " << index << " after " << probes << " probes\\n";
        } else {
            std::cout << target << " not found after " << probes << " probes\\n";
        }
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Each probe that misses cuts the number of candidate positions at least in half. Starting from n candidates, the range is empty after at most ⌊log₂ n⌋ + 1 probes. That is 10 probes for a thousand values, 20 for a million and 30 for a billion.',
    cases: [
      { case: 'Best', time: 'O(1)', when: 'The target is the first middle value: one probe.' },
      { case: 'Average', time: 'O(log n)', when: 'The target is present and equally likely to be at any position: about log₂ n − 1 probes.' },
      { case: 'Worst', time: 'O(log n)', when: 'The target is absent, or is found only when the range has shrunk to one position: at most ⌊log₂ n⌋ + 1 probes.' },
    ],
    space: 'O(1) for the loop version used here: two or three position variables. A recursive version uses O(log n) stack frames unless the language removes tail calls.',
    memory: 'The probes jump around the array: the first lands in the middle, the second a quarter of the way from one end, and so on. On arrays much larger than the processor cache, each of the early probes is likely to be a cache miss. For small arrays a simple scan can be as fast in real time. Structures such as B-trees keep the halving idea while reading memory in larger, more cache-friendly blocks.',
    tradeoffs: 'The speed has to be paid for in advance: the list must be sorted, which costs O(n log n), and it must stay sorted. Inserting into the middle of a sorted array means shifting everything after it, O(n) per insertion. Binary search suits data that is sorted once and then queried many times.',
    assumptions: [
      'The list is sorted by the same ordering that the comparisons use.',
      'Any position can be read in constant time (an array, not a linked list).',
      'Comparing a list value with the target takes constant time.',
      'A probe is counted once, as a single three-way comparison (smaller, equal or larger). Code that tests equality and order separately makes up to two comparisons per probe.',
      'The average case assumes the target is present and equally likely to be at each position.',
    ],
  },

  tradeoffs: {
    excels: [
      'Large sorted arrays that are searched many times.',
      'Questions about order as well as presence: the nearest value, the first value at least x, how many values fall in a range.',
      'Any problem with a yes-or-no test that switches from "no" to "yes" exactly once along an ordered range.',
    ],
    struggles: [
      'Unsorted data: it must be sorted first, and the answer is unreliable otherwise.',
      'Data that changes often: keeping an array sorted makes each insertion and deletion linear.',
      'Linked lists and streams, where reaching the middle position is itself a linear walk.',
      'Very small lists, where the bookkeeping buys nothing over a scan.',
    ],
    pitfalls: [
      'Off-by-one errors in the loop condition and the range updates.',
      'Integer overflow in `(lo + hi) / 2` on very large arrays.',
      'Expecting the first of several equal values when the code returns any match.',
      'Sorting with one comparison rule and searching with another.',
    ],
    misunderstandings: [
      '"Binary search works on any list." It needs a sorted list. On unsorted data it runs without complaint and may report that a value is missing when it is there.',
      '"It is always faster than checking one by one." It makes fewer comparisons in the worst case and on average. For a target near the front of the list, or for a list of a few items, a simple scan can finish sooner.',
      '"It is easy to code because the idea is simple." The idea is simple. The boundary details are subtle enough that experienced programmers routinely get them wrong on the first attempt.',
      '"Halving means it looks at half the list." It looks at one value per round and discards half of what remains. The total number of values examined is about log₂ n, not n / 2.',
    ],
    constraints: [
      'Use the library routine where one exists. It has had its boundary cases tested far more thoroughly than a fresh hand-written loop.',
      'When data must be both searched and updated, practical systems use search trees or B-trees, which keep order under insertion without shifting whole arrays.',
    ],
    alternatives: [
      { id: 'linear-search', name: 'Linear Search', when: 'The list is unsorted, very short, or can only be read front to back.' },
      { id: 'hash-table', name: 'Hash Table', when: 'Only exact-match lookups are needed and expected constant time matters more than order.' },
      { id: 'binary-search-tree', name: 'Binary Search Tree', when: 'The collection changes between searches and must stay ordered.' },
      { name: 'Interpolation search', when: 'Keys are numbers spread roughly evenly, so a good guess at the position beats the midpoint.' },
    ],
    comparison: {
      columns: ['', 'Binary search', 'Linear search', 'Hash table lookup'],
      rows: [
        ['Needs', 'Sorted array', 'Nothing', 'A table built in advance and a hash function'],
        ['Worst-case probes', '⌊log₂ n⌋ + 1', 'n', 'n (when many keys collide)'],
        ['Probes for a million items', 'At most 20', 'Up to 1,000,000', 'A few, typically'],
        ['Finds nearest value or insertion point', 'Yes', 'Only by scanning everything', 'No'],
        ['Cost of adding an item', 'O(n) to keep the array sorted', 'O(1) at the end', 'Expected O(1)'],
      ],
    },
  },

  applications: [
    { title: 'Standard library search routines', status: 'established', text: 'Python\'s `bisect` module, C++ `std::lower_bound` and `std::binary_search`, and Java\'s `Arrays.binarySearch` are binary searches over sorted sequences. Most also report where a missing value would be inserted.' },
    { title: 'Finding the commit that broke something', status: 'established', text: '`git bisect` asks you to mark one commit as good and a later one as bad, then repeatedly checks out the commit halfway between. Each answer halves the suspects, so a bug hidden among a thousand commits is located in about ten tests.' },
    { title: 'Database indexes', status: 'established', text: 'A B-tree index is the many-way relative of binary search. Each node holds sorted keys that split the remaining key range into several parts, so reading one node rules out most of the remaining data.' },
    { title: 'Searching for the smallest value that works', status: 'illustrative', text: 'Many planning questions have the form "what is the smallest capacity, budget or time limit for which this is possible?". If a larger value always works whenever a smaller one does, binary search over the candidate values finds the threshold with few feasibility tests.' },
  ],

  connections: [
    { to: 'linear-search', type: 'same-problem', why: 'Both find a value in a list. Linear search rules out one position per comparison; binary search uses sorted order to rule out half of the remaining positions.' },
    { to: 'bisection-method', type: 'variant', why: 'Bisection is the same procedure on a continuous interval: test the midpoint and keep the half that must contain the root. Binary search is its discrete form, and it ends exactly instead of approaching a limit.' },
    { to: 'hash-table', type: 'same-problem', why: 'Both answer "is this key present?". Hashing gets expected constant time by giving up order; binary search keeps order and pays a logarithm.' },
    { to: 'binary-search-tree', type: 'advanced', why: 'A binary search tree stores the midpoint decisions as links, so the same halving search works on data that changes.' },
    { to: 'merge-sort', type: 'related', why: 'Sorting is the preparation binary search depends on, and both halve the problem: a list of n items can be halved only about log₂ n times.' },
    { to: 'concept:invariant', type: 'prerequisite', why: 'The algorithm is correct because one statement stays true on every pass: the target, if present, lies between `lo` and `hi`.' },
    { to: 'concept:divide-and-conquer', type: 'related', why: 'It splits the problem in half like divide and conquer, but only one half ever needs solving, which is why the cost is logarithmic.' },
    { to: 'concept:lower-bound', type: 'advanced', why: 'A decision-tree argument shows that no search based on comparisons can beat ⌊log₂ n⌋ + 1 in the worst case, so binary search is optimal in that model.' },
    { to: 'concept:big-o', type: 'related', why: 'It is the standard example of logarithmic growth: doubling the input adds one step.' },
    { to: 'discipline:mathematics', type: 'application', why: 'Root finding by bisection and binary search rest on the same fact: an interval that is halved repeatedly while still containing the answer pins the answer down.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why must the list be sorted for binary search to work?',
      options: [
        'Sorted lists use less memory',
        'So that one comparison with the middle value says which half the target cannot be in',
        'Because the middle position cannot be computed otherwise',
        'It does not need to be; sorting only makes it faster',
      ],
      answer: 1,
      explain: [
        'Sorting rearranges values. It does not change how much memory they take.',
        'Correct. If the middle value is too small, sorted order guarantees everything before it is too small as well. Without that guarantee, nothing can be discarded.',
        'The middle position depends only on `lo` and `hi`, not on the values.',
        'On unsorted data binary search can discard the half that holds the target and wrongly report it missing.',
      ],
    },
    {
      type: 'predict',
      q: 'The sorted list has 15 values and the target is not in it. How many values will binary search check before it reports "not found"?',
      options: ['15', '8', '4', '3'],
      answer: 2,
      explain: [
        '15 is what linear search needs. Binary search never looks at most of the list.',
        '8 is half the list. Binary search discards half per check; it does not check half.',
        'Correct. The range shrinks from 15 to 7 to 3 to 1 to 0, with one check at each size.',
        'After 3 checks one candidate position is still left, and it has to be checked too.',
      ],
      tryInput: { size: 15, where: 'missing', custom: [] },
    },
    {
      type: 'debug',
      q: 'This version sometimes reports that a value is missing when it is in the list. For example, it fails to find 2 in [2, 5, 8]. What is the fix?',
      code: `def binary_search(a, target):
    lo, hi = 0, len(a) - 1
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if a[mid] == target:
            return mid
        if a[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`,
      options: [
        'Line 3: the condition should be `lo <= hi`',
        'Line 4: the midpoint should round up instead of down',
        'Line 8: it should be `lo = mid`',
        'Line 2: `hi` should start at `len(a)`',
      ],
      answer: 0,
      explain: [
        'Correct. `hi` is a position that can still hold the target, so when `lo` equals `hi` one candidate remains. With `<` the loop exits before checking it. Here the range becomes just position 0, and the loop stops without looking at it.',
        'Rounding up changes which value is probed, but the loop would still exit with one candidate unchecked.',
        '`lo = mid` keeps a position that has already been ruled out. When the range has two values the loop would then never end.',
        'Starting `hi` one past the end is a valid convention, but then the update on line 10 must also change to `hi = mid`. Changing one line and not the other leaves a different bug.',
      ],
    },
    {
      type: 'choice',
      q: 'In a language where integers are 32 bits and the largest is 2,147,483,647, a huge array is being searched with `lo` = 1,500,000,000 and `hi` = 2,000,000,000. What does `mid = (lo + hi) / 2` compute?',
      options: [
        '1,750,000,000, as intended',
        'A wrong value, because `lo + hi` is 3,500,000,000 and does not fit in the integer',
        'It always raises an error that stops the program',
        '0, because the division rounds down',
      ],
      answer: 1,
      explain: [
        'That is the intended midpoint, but the sum has to be formed first and it is too large to store.',
        'Correct. The sum overflows. In Java it wraps around to a negative number and the array access fails; in C and C++ the behaviour is undefined. Writing `lo + (hi - lo) / 2` avoids forming the large sum.',
        'Most languages with fixed-size integers do not check for overflow. That is why this bug stayed hidden for so long.',
        'Rounding is not the issue. The sum itself cannot be represented.',
      ],
    },
    {
      type: 'challenge',
      title: 'Find the first position that is not too small',
      prompt: 'Write `lower_bound(a, target)`: it returns the first position whose value is greater than or equal to the target, or the length of the list if there is none. Unlike the search in this lesson it never stops early at a match, so on a list with duplicates it returns the first of them, and for a missing value it returns the place where that value would be inserted. Test it on [1, 3, 3, 3, 7] with targets 3, 4, 0 and 9. The answers should be 1, 4, 0 and 5.',
      hints: [
        'Use a half-open range: `lo = 0`, `hi = len(a)`, and loop while `lo < hi`.',
        'If `a[mid] < target`, the answer is to the right of `mid`. Otherwise `mid` itself might be the answer, so keep it in the range with `hi = mid`.',
        'State the invariant before you write the loop: everything before `lo` is smaller than the target, and everything from `hi` onward is not.',
      ],
    },
  ],

  compare: {
    idea: 'Check the middle of the remaining range and discard the half that cannot hold the target.',
    requires: 'A list sorted by the comparison in use, with direct access to any position. On unsorted data the answer is unreliable.',
    sensitivity: 'Low. Between 1 and ⌊log₂ n⌋ + 1 probes whatever the values are.',
    memory: 'O(1): two or three position variables.',
    difficulty: 'moderate',
    difficultyNote: 'A dozen lines, but the loop condition, the range updates and the midpoint formula are each a classic source of bugs.',
    limits: 'Useless on unsorted data, and keeping an array sorted makes insertions slow.',
    useWhen: 'The data is sorted once and searched many times, or you need the nearest value or insertion point.',
  },

  advanced: {
    history: 'John Mauchly described the method in 1946, in the Moore School Lectures on computer design. According to Donald Knuth\'s account in *The Art of Computer Programming*, the early published versions worked only for particular list lengths, and more than a decade passed before one appeared that was correct for every length. Jon Bentley later reported in *Programming Pearls* that when he asked professional programmers to write a binary search, most of the versions they handed in contained bugs. In 2006 Joshua Bloch disclosed that the binary search in the Java standard library, which followed the version in Bentley\'s book, computed its midpoint as `(low + high) / 2` and so failed on arrays of more than about a billion elements. The bug had gone unnoticed for roughly nine years.',
    derivation: 'Let $m = hi - lo + 1$ be the number of candidate positions before a probe. If the probe misses and the search goes left, $mid - lo = \\lfloor (m-1)/2 \\rfloor$ candidates remain. If it goes right, $hi - mid = \\lceil (m-1)/2 \\rceil = \\lfloor m/2 \\rfloor$ remain. Either way at most $\\lfloor m/2 \\rfloor$ candidates survive, so after $k$ missed probes at most $\\lfloor n/2^k \\rfloor$ are left. That is zero as soon as $2^k > n$, which first happens at\n\n$$k = \\lfloor \\log_2 n \\rfloor + 1.$$\n\nFor the average, take $n = 2^k - 1$, where the probes form a perfectly balanced tree: 1 position is found by the first probe, 2 by the second, and $2^{d-1}$ by the $d$-th. A successful search for a position chosen uniformly at random therefore costs\n\n$$\\frac{1}{n}\\sum_{d=1}^{k} d\\,2^{d-1} = \\frac{(k-1)2^k + 1}{2^k - 1} \\approx k - 1 = \\log_2(n+1) - 1,$$\n\nonly about one probe fewer than the worst case, because half of all positions sit at the deepest level.',
    proof: 'Optimality in the comparison model. Any search algorithm that learns about the list only by comparing the target with list values can be drawn as a tree. Each node is a probe of some position; the outcome "equal" ends the search there, and the outcomes "smaller" and "larger" lead to at most two further probes. To be able to return every one of the $n$ positions, the tree needs at least $n$ nodes. A binary tree in which every root-to-node path has at most $h$ nodes contains at most $2^h - 1$ nodes, so\n\n$$2^h - 1 \\ge n \\quad\\Longrightarrow\\quad h \\ge \\lceil \\log_2(n+1) \\rceil = \\lfloor \\log_2 n \\rfloor + 1.$$\n\nSome input therefore forces at least $\\lfloor \\log_2 n \\rfloor + 1$ probes on any such algorithm. Binary search never uses more, so it is worst-case optimal among comparison-based searches.',
    complexityProof: 'Each pass of the loop does constant work and one probe. By the derivation, the loop runs at most $\\lfloor \\log_2 n \\rfloor + 1$ times, so the running time is $O(\\log n)$, and the lower bound above shows the worst case is $\\Theta(\\log n)$. The loop version stores only `lo`, `hi` and `mid`, so the extra space is $O(1)$.',
    variants: [
      { name: 'Lower bound and upper bound', text: 'Return the first position whose value is not less than the target (or the first that is greater). These give insertion points, handle duplicates precisely, and are what most libraries provide.' },
      { name: 'Exponential (galloping) search', text: 'When the list has no known end, or the target is expected near the front, probe positions 1, 2, 4, 8 and so on until the target is passed, then binary search inside the last interval.' },
      { name: 'Interpolation search', text: 'Guess the position from the target\'s value, as you would open a dictionary near the back for a word starting with "w". On evenly spread keys it averages about log log n probes; on badly skewed keys it can degrade to linear.' },
      { name: 'Binary search on the answer', text: 'Search over candidate answers instead of list positions, using a yes-or-no feasibility test that changes from "no" to "yes" once. The list never needs to exist in memory.' },
      { name: 'Bisection on real numbers', text: 'The continuous form, covered in the [bisection method](#/algorithm/bisection-method): halve an interval on which a function changes sign until it is as narrow as required.' },
    ],
    implementation: 'Prefer the library routine. If you must write it, choose one range convention and state the invariant in a comment before writing the loop. Compute the midpoint as `lo + (hi - lo) / 2`. Test the empty list, one element, two elements, a target below the minimum, above the maximum, and every position in a small list.',
    benchmarking: 'Probe counts are exact and repeatable. In real time, binary search on large arrays is dominated by cache misses and hard-to-predict branches, so its speed relative to a scan or a cache-friendly layout depends on array size and hardware. Measure with realistic sizes before choosing.',
    references: [
      { authors: 'D. E. Knuth', year: 1998, title: 'The Art of Computer Programming, Volume 3: Sorting and Searching (2nd edition), section 6.2.1', venue: 'Addison-Wesley' },
      { authors: 'J. Bentley', year: 2000, title: 'Programming Pearls (2nd edition), column 4: Writing Correct Programs', venue: 'Addison-Wesley' },
      { authors: 'J. Bloch', year: 2006, title: 'Extra, Extra - Read All About It: Nearly All Binary Searches and Mergesorts are Broken', venue: 'Google Research Blog' },
      { authors: 'Y. Perl, A. Itai and H. Avni', year: 1978, title: 'Interpolation search: a log log N search', venue: 'Communications of the ACM 21(7), 550-553' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*: binary search appears in the exercises on divide and conquer and on loop invariants.',
      'R. Sedgewick and K. Wayne, *Algorithms* (4th edition), sections 1.1 and 3.1.',
    ],
  },

  tests: [
    { name: 'finds a present value at the position a reference lookup gives', input: { size: 50, where: 'random', seed: 11, custom: [] },
      check: (r, c) => (r.index >= 0 && r.index === r.array.indexOf(r.target) && c.comparisons <= worstCase(50)) || `index ${r.index}, comparisons ${c.comparisons}` },
    { name: 'reports an absent value as -1 within the worst-case bound', input: { size: 37, where: 'missing', seed: 5, custom: [] },
      check: (r, c) => (r.index === -1 && !r.array.includes(r.target) && c.comparisons <= worstCase(37)) || `index ${r.index}, comparisons ${c.comparisons}` },
    { name: 'finds the first and smallest value', input: { size: 20, where: 'first', seed: 3, custom: [] },
      check: (r, c) => (r.index === 0 && c.comparisons === 4) || `index ${r.index}, comparisons ${c.comparisons}` },
    { name: 'finds the last and largest value', input: { size: 64, where: 'last', seed: 8, custom: [] },
      check: (r, c) => (r.index === 63 && c.comparisons === 7) || `index ${r.index}, comparisons ${c.comparisons}` },
    { name: 'the middle value is found with one probe', input: { size: 31, where: 'middle', seed: 2, custom: [] },
      check: (r, c) => (r.index === 15 && c.comparisons === 1) || `index ${r.index}, comparisons ${c.comparisons}` },
    { name: 'the worked example: 16 is at position 4 after probing 12, 23, 16', input: { custom: [2, 5, 8, 12, 16, 23, 38], target: 16 },
      check: (r, c) => (r.index === 4 && c.comparisons === 3 && r.probes.join(',') === '3,5,4') || `index ${r.index}, probes ${r.probes.join(',')}` },
    { name: 'the predict question: 15 values, absent target, 4 checks', input: { size: 15, where: 'missing', custom: [] },
      check: (r, c) => (r.index === -1 && c.comparisons === 4) || `comparisons ${c.comparisons}` },
    { name: '31 and 63 values with an absent target take 5 and 6 checks', input: { size: 63, where: 'missing', seed: 4, custom: [] },
      check: (r, c) => (r.index === -1 && c.comparisons === 6) || `comparisons ${c.comparisons}` },
    { name: 'the try-this case: 35 is absent from 10..50 after two probes', input: { custom: [10, 20, 30, 40, 50], target: 35 },
      check: (r, c) => (r.index === -1 && c.comparisons === 2) || `index ${r.index}, comparisons ${c.comparisons}` },
    { name: 'a single value, present and absent', input: { custom: [5], target: 7 },
      check: (r, c) => (r.index === -1 && c.comparisons === 1) || `index ${r.index}, comparisons ${c.comparisons}` },
    { name: 'the sample in the code section: 23 at index 5 in three probes', input: { custom: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], target: 23 },
      check: (r, c) => (r.index === 5 && c.comparisons === 3) || `index ${r.index}, comparisons ${c.comparisons}` },
  ],
};
