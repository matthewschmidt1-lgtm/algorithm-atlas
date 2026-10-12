import { searchInputs, resolveSearch } from '../../js/lib/arrays.js';
import { makeRng } from '../../js/lib/rng.js';

function run(input, t) {
  const resolved = resolveSearch(input);
  const array = resolved.array.slice();
  let target = resolved.target;
  const usingCustom = Array.isArray(input.custom) && input.custom.length > 0;
  if (input.shuffle) {
    // Shuffle the values but keep the target at the same position, so "first", "middle" and
    // "last" still mean what they say. Typed-in targets are left exactly as typed.
    const p = array.indexOf(target);
    makeRng((input.seed || 1) + 17).shuffle(array);
    if (p >= 0 && !usingCustom) target = array[p];
  }
  const n = array.length;
  let index = -1;

  const views = (i, found) => {
    const roles = {};
    for (let k = 0; k < i; k++) roles[k] = 'dim';
    if (i < n) roles[i] = found ? 'done' : 'compare';
    return [
      { kind: 'bars', values: array.slice(), roles, markers: i < n ? [{ index: i, label: 'i' }] : [],
        legend: [{ label: 'being checked', role: 'compare' }, { label: 'not checked yet', role: 'default' }, { label: 'match', role: 'done' }] },
      { kind: 'rows', rows: [
        { label: 'Looking for', cells: [{ t: target, role: 'target' }] },
        { label: 'Checked', cells: array.slice(0, found ? i + 1 : i).map((v, k) => ({ t: v, sub: k, role: found && k === i ? 'done' : 'dim' })) },
      ] },
    ];
  };

  t.frame(() => ({ line: [0, 1], note: `The list has ${n} values and we are looking for **${target}**. Linear search starts at the first position and checks one value at a time. It does not care what order the values are in. A bar fades once its value has been checked and rejected.`, views: views(-1, false), vars: { target, n } }));

  for (let i = 0; i < n; i++) {
    t.count('comparisons');
    if (array[i] === target) {
      index = i;
      t.frame(() => ({ line: [3, 4], note: `Position ${i} holds ${array[i]}. That is the target, so stop here. It took ${i + 1} ${i === 0 ? 'check' : 'checks'}.`, views: views(i, true), vars: { i, 'A[i]': array[i], target } }));
      break;
    }
    t.frame(() => ({ line: [2, 3], note: `Position ${i} holds ${array[i]}. That is not ${target}, so move on to the next position.`, views: views(i, false), vars: { i, 'A[i]': array[i], target } }));
  }

  if (index < 0) {
    t.frame(() => ({ line: 5, note: `Every one of the ${n} values has been checked and none of them is ${target}. Only now is it safe to say the target is **not in the list**.`, views: views(n, false), vars: { target, result: -1 } }));
  } else {
    t.frame(() => ({ line: 4, note: `Found **${target}** at position ${index}. The ${n - index - 1} ${n - index - 1 === 1 ? 'value' : 'values'} after it never had to be looked at.`, views: views(index, true), vars: { target, result: index } }));
  }
  return { index, array, target };
}

export default {
  meta: {
    id: 'linear-search',
    name: 'Linear Search',
    aliases: ['sequential search', 'linear scan', 'brute-force search'],
    kind: 'algorithm',
    discipline: 'algorithms',
    alsoIn: [],
    subfield: 'Searching',
    family: 'Sequential search',
    lab: 'sorting-searching',
    compareGroup: 'searching',
    summary: 'Finds a value by checking every item in turn. Works on any list in any order, and takes time proportional to the length of the list.',
    difficulty: 'beginner',
    order: 10,
    paradigms: ['brute-force'],
    randomized: false,
    approximate: false,
    time: { best: 'O(1)', average: 'O(n)', worst: 'O(n)', class: 'linear' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['find an item in a list', 'is this value in the list', 'search an unsorted list', 'look something up', 'find the position of a value'],
      techniques: ['sequential scan', 'equality comparison', 'early exit'],
      applications: ['standard libraries', 'databases', 'data processing'],
    },
    prerequisites: ['concept:array'],
  },

  bigIdea: {
    simple: "Linear search is the plainest way to find something: look at every item, one after another, until you see the one you want. Think of hunting for one sock in a drawer full of loose socks. You pick up a sock and check it. If it is the wrong one, you pick up the next. You stop when you find your sock, or when the drawer is empty. A computer does the same with a list. It starts at the first item and asks: is this the one? If not, it moves to the next item. If it reaches the end without a match, it reports that the item is not there. The method always works, and the list can be in any order. Its weakness is speed. A list twice as long can take twice as many checks. That is fine for a short list. It is too slow for a huge list that gets searched again and again.",
    what: 'Linear search finds a value in a list by comparing it with each element in turn, from the first to the last. It returns the position of the first match. If it reaches the end without one, it reports that the value is absent.',
    why: 'It is the search that needs nothing: no sorting, no extra memory, no preparation. Any collection that can be walked from start to end can be searched this way. That makes it the baseline every other search method is measured against.',
    when: 'Use it when the list is short, when it is unsorted and will be searched only a few times, or when the data can only be read front to back, as with a linked list or a stream. If the list is sorted and you can jump to any position, [binary search](#/algorithm/binary-search) needs far fewer comparisons. If you look up the same data many times by exact key, build a [hash table](#/algorithm/hash-table).',
    interesting: 'On an unsorted list, no method that inspects items one at a time can do better in the worst case. If it skips even one position, the target could have been sitting there. Every faster search first imposes some structure on the data, such as sorted order or hashing, and pays for that structure up front. Linear search is what you get when you pay nothing.',
    where: 'It is what `list.index` and the `in` operator do on a Python list, what `std::find` does in C++, and what `indexOf` and `includes` do on a JavaScript array. A database with no index on a column falls back on the same idea and scans the whole table.',
    analogy: {
      title: 'A name on an unsorted sign-up sheet',
      text: 'Someone hands you a sign-up sheet where people wrote their names in the order they arrived. To find out whether Priya signed up, you put your finger on the first line and read down, one name at a time. You stop at her name if you see it. If your finger reaches the bottom of the sheet, you know she is not on it.',
      limits: 'Your eye can take in several lines at a glance and may catch a familiar name before your finger gets there. The algorithm cannot. It examines exactly one item at a time, in order, and learns nothing about the items it has not reached. A person might also remember roughly where a name was written. Linear search remembers nothing between one search and the next.',
    },
  },

  example: {
    setup: 'Find the number 17 in this list of six numbers: 3, 8, 12, 17, 21, 30. Positions are counted from 0, as programmers usually do, so 3 is at position 0 and 30 is at position 5.',
    steps: [
      'Look at position 0. It holds 3. That is not 17, so move on.',
      'Look at position 1. It holds 8. That is not 17, so move on.',
      'Look at position 2. It holds 12. That is not 17, so move on.',
      'Look at position 3. It holds 17. That is the number we want, so stop.',
    ],
    result: 'The answer is position 3, found after 4 checks. The last two numbers were never looked at. Searching the same list for 20 would take all 6 checks and end with "not found", because the only way to be sure a number is absent is to look at every position. This list happens to be in order, but linear search made no use of that.',
    tryInput: { custom: [3, 8, 12, 17, 21, 30], target: 17, shuffle: false },
  },

  terms: [
    { term: 'List', meaning: 'A row of items stored one after another, each with a numbered position. Programmers often call it an array.' },
    { term: 'Index', meaning: 'The position number of an item in a list. Counting usually starts at 0, so the first item has index 0.' },
    { term: 'Target', meaning: 'The value you are trying to find.' },
    { term: 'Comparison', meaning: 'One check of the form: is this item equal to the target? Counting comparisons is how we measure the work a search does.' },
    { term: 'Worst case', meaning: 'The input that forces a method to do the most work it could ever have to do. For linear search, that is a target in the last position or not in the list at all.' },
    { term: 'Linear time', meaning: 'Work that grows in step with the size of the input: twice as many items, about twice as much work.' },
  ],

  takeaway: 'Check every item in turn until you find the one you want or run out of items.',

  viz: {
    describe: 'A row of bars, one per value in the list, with a marker under the position being checked. The bar being checked is ochre, bars not yet checked are grey, bars already checked and rejected are faded, and a match turns forest green. Below the bars, one strip shows the target value and another lists the values checked so far.',
    inputs: [
      // Seed 12 puts the default target at position 11, so the default run shows a scan of useful length.
      ...searchInputs({ size: 16 }).map((f) => (f.id === 'seed' ? { ...f, default: 12 } : f)),
      { id: 'shuffle', type: 'toggle', label: 'Shuffle the list first', default: false,
        help: 'Linear search does not need sorted data. The target stays at the same position, so the number of checks does not change.' },
    ],
    presets: [
      { label: 'Target somewhere in the list', values: { where: 'random', shuffle: false, custom: [] } },
      { label: 'Best case: target is first', values: { where: 'first', shuffle: false, custom: [] } },
      { label: 'Worst case: target is absent', values: { where: 'missing', shuffle: false, custom: [] } },
      { label: 'Unsorted list', values: { where: 'last', shuffle: true, custom: [] } },
    ],
    tryThis: [
      'Load "Worst case: target is absent" and note the number of comparisons. Then double the number of items. The comparisons double too, because every value has to be checked.',
      'Switch "Shuffle the list first" on and off with the same seed. The bars change order but the number of comparisons stays the same. Only the position of the target matters, never the order of the other values.',
      'Set "Search for" to the last value, then to a value that is not in the list. Both cost the same number of comparisons. Linear search cannot tell "it is at the very end" from "it is not here" until it gets to the end.',
    ],
    run,
    report: (r, c) => `${r.index >= 0 ? `Found ${r.target} at position ${r.index}` : `${r.target} is not in the list`} after ${c.comparisons || 0} of a possible ${r.array.length} comparisons.\n[${r.array.join(', ')}]`,
    experiment: {
      title: 'Comparisons as the list grows',
      note: 'Each point is a real run of this page\'s implementation. The three series differ only in where the target is: absent, in the middle position, or in the first position.',
      metric: 'comparisons',
      metricLabel: 'Comparisons',
      sizeLabel: 'Number of items (n)',
      sizes: [8, 16, 32, 64, 128, 256, 512, 1024],
      variants: [
        { id: 'missing', label: 'Target absent (worst case)' },
        { id: 'middle', label: 'Target in the middle' },
        { id: 'first', label: 'Target first (best case)' },
      ],
      input: (n, variant, seed) => ({ size: n, where: variant, seed, custom: [], shuffle: false }),
      theory: [
        { label: 'n', fn: (n) => n, variant: 'missing' },
        { label: 'n / 2', fn: (n) => n / 2, variant: 'middle' },
      ],
    },
  },

  logic: {
    intuition: 'If you know nothing about how a list is arranged, every position is equally likely to hold the target, and looking at one position tells you nothing about the others. So the only safe plan is to look at them all, and the only shortcut is to stop as soon as you see what you came for.',
    steps: [
      'Start at the first position of the list.',
      'Compare the value at the current position with the target.',
      'If they are equal, stop and return the current position.',
      'Otherwise move to the next position and repeat from step 2.',
      'If you run past the last position, the target is not in the list. Return a "not found" marker, by convention −1.',
    ],
    pseudocode: [
      'linear_search(A, target):',
      '  n ← length(A)',
      '  for i from 0 to n − 1:',
      '    if A[i] = target:',
      '      return i',
      '  return −1',
    ],
    decisions: [
      { title: 'What counts as a match?', text: 'This lesson tests for equality with a number. The same loop works with any yes-or-no test: the first negative value, the first record whose name starts with "Q", the first file larger than a megabyte. Library functions such as `find_if` take the test as a parameter.' },
      { title: 'First match, or all of them?', text: 'Returning at the first match is the usual contract and gives the early exit. If the list can hold duplicates and you need every occurrence, the loop must always run to the end, so there is no best case.' },
      { title: 'How to say "not found"?', text: 'Returning −1 is traditional because no valid position is negative. Some languages raise an error instead (`list.index` in Python) or return an optional value. Whatever the convention, the caller must check for it.' },
    ],
    invariants: [
      'Just before position `i` is examined, none of the values `A[0..i−1]` equals the target.',
    ],
    edgeCases: [
      'An empty list: the loop body never runs and the answer is "not found" after zero comparisons.',
      'Duplicates: the search returns the first occurrence and never sees the later ones.',
      'Target in the last position: this costs exactly as many comparisons as a target that is absent.',
      'Floating-point data: the special value NaN is not equal to itself, so an equality scan can never find it. Values that look equal after rounding may also differ in their last bits.',
    ],
    correctness: 'The loop keeps one fact true: before position `i` is examined, no earlier position holds the target. If the loop returns `i`, then `A[i]` equals the target and no earlier position does, so `i` is the first occurrence. If the loop finishes, the fact holds with `i` equal to the length of the list, which says that no position at all holds the target, so returning −1 is right. The loop always ends because `i` rises by one each time and the list is finite.',
    mistakes: [
      'Returning "not found" inside the loop, in an `else` branch. The function then gives up after checking only the first value.',
      'Loop bounds that are off by one: starting at 1 skips the first value, and stopping at `length − 1` exclusive skips the last.',
      'Using the result without checking for −1. In Python, `a[-1]` is a valid expression that silently returns the last element.',
      'Calling a linear search inside a loop over the same data, for example to test each item for a duplicate. Each call is cheap, but n calls of n steps is quadratic.',
    ],
  },

  code: {
    sample: {
      input: 'The unsorted list [21, 3, 30, 17, 8, 12], searched for 17 and then for 20.',
      expected: '17 found at index 3 after 4 comparisons\n20 not found after 6 comparisons',
    },
    python: {
      source: `def linear_search(a, target):
    comparisons = 0
    for i in range(len(a)):
        comparisons += 1
        if a[i] == target:
            return i, comparisons
    return -1, comparisons


data = [21, 3, 30, 17, 8, 12]
for target in (17, 20):
    index, comparisons = linear_search(data, target)
    if index >= 0:
        print(f"{target} found at index {index} after {comparisons} comparisons")
    else:
        print(f"{target} not found after {comparisons} comparisons")`,
      notes: [
        { line: 3, text: 'Visit every position from 0 to the last one. The list is not sorted and does not need to be.' },
        { line: 5, text: 'The only comparison in the algorithm. The counter above it exists just to show how much work was done.' },
        { line: 6, text: 'Early exit: return as soon as the target is seen. Nothing after this position is examined.' },
        { line: 7, text: 'This line is outside the loop. It is reached only after every value has been checked.' },
      ],
    },
    javascript: {
      source: `function linearSearch(a, target) {
  let comparisons = 0;
  for (let i = 0; i < a.length; i++) {
    comparisons++;
    if (a[i] === target) {
      return { index: i, comparisons };
    }
  }
  return { index: -1, comparisons };
}

const data = [21, 3, 30, 17, 8, 12];
for (const target of [17, 20]) {
  const { index, comparisons } = linearSearch(data, target);
  if (index >= 0) {
    console.log(target + " found at index " + index + " after " + comparisons + " comparisons");
  } else {
    console.log(target + " not found after " + comparisons + " comparisons");
  }
}`,
    },
    cpp: {
      source: `#include <iostream>
#include <vector>

int linear_search(const std::vector<int>& a, int target, int& comparisons) {
    comparisons = 0;
    for (int i = 0; i < static_cast<int>(a.size()); ++i) {
        ++comparisons;
        if (a[i] == target) {
            return i;
        }
    }
    return -1;
}

int main() {
    std::vector<int> data = {21, 3, 30, 17, 8, 12};
    for (int target : {17, 20}) {
        int comparisons = 0;
        int index = linear_search(data, target, comparisons);
        if (index >= 0) {
            std::cout << target << " found at index " << index << " after " << comparisons << " comparisons\\n";
        } else {
            std::cout << target << " not found after " << comparisons << " comparisons\\n";
        }
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The work is one comparison per value examined. The search examines values until it meets the target, so the cost is the position of the target plus one, or the full length of the list when the target is absent.',
    cases: [
      { case: 'Best', time: 'O(1)', when: 'The target is in the first position: one comparison.' },
      { case: 'Average', time: 'O(n)', when: 'The target is present and equally likely to be at any position: (n + 1) / 2 comparisons on average.' },
      { case: 'Worst', time: 'O(n)', when: 'The target is in the last position or absent: n comparisons.' },
    ],
    space: 'O(1). The search keeps one position counter and nothing else, whatever the size of the list.',
    memory: 'The scan reads memory in order, which is the pattern processors handle best. On short arrays this can make a linear scan as fast as cleverer methods in real time, even though it makes more comparisons. Where that stops being true depends on the machine and the data, so measure before relying on it.',
    tradeoffs: 'Linear search spends nothing on preparation and pays for it on every lookup. Sorting the list first costs O(n log n) once and then allows O(log n) lookups with binary search. Building a hash table costs O(n) time and extra memory and then allows expected O(1) lookups. Which is cheaper overall depends on how many lookups there will be.',
    assumptions: [
      'Comparing one list value with the target takes constant time. Comparing long strings or large records can cost more per comparison.',
      'The average case assumes the target is present and equally likely to be at each position. If some values are requested far more often than others, the average depends on where those values sit.',
      'Counts on this page are comparisons made by this implementation, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Short lists, where the cost of anything more elaborate is not repaid.',
      'Unsorted data that will be searched only once or a few times.',
      'Data that can only be read in order: linked lists, files, network streams.',
      'Searches by an arbitrary test rather than by an exact key, where sorting or hashing does not help.',
    ],
    struggles: [
      'Large lists that are searched often: every lookup pays the full linear cost again.',
      'Confirming that a value is absent, which always costs a full pass.',
      'Use as an inner step of another loop, where its cost is multiplied by the number of outer iterations.',
    ],
    pitfalls: [
      'Hidden linear searches. `x in some_list` looks like one cheap operation, and inside a loop it quietly becomes quadratic.',
      'Treating the "not found" marker as a real position.',
      'Giving up at the first mismatch because the "not found" return was written inside the loop.',
    ],
    misunderstandings: [
      '"Linear search needs the list to be sorted." It needs no order at all. That is its main advantage over binary search.',
      '"Linear search is a bad algorithm." It is the right choice for short or unsorted lists, and on unsorted data no method that looks at one item at a time has a better worst case.',
      '"On average it finds the target halfway, so the cost is half." That holds only when the target is present. Each search for a missing value costs the full length of the list.',
    ],
    constraints: [
      'Real programs often search by a property (the first user whose account is locked), not by a whole value. No index exists for most such questions, so a scan is the practical answer.',
      'When lookups by key become frequent, the fix is usually a different data structure, such as a hash table or a sorted index, and not a faster scan.',
    ],
    alternatives: [
      { id: 'binary-search', name: 'Binary Search', when: 'The list is sorted and any position can be read directly.' },
      { id: 'hash-table', name: 'Hash Table', when: 'The same collection is searched many times by exact key and extra memory is acceptable.' },
      { id: 'binary-search-tree', name: 'Binary Search Tree', when: 'Items are inserted and removed between searches and must stay in order.' },
    ],
    comparison: {
      columns: ['', 'Linear search', 'Binary search', 'Hash table lookup'],
      rows: [
        ['Needs', 'Nothing', 'Sorted list with direct access to any position', 'A table built in advance and a hash function'],
        ['Worst-case comparisons', 'n', '⌊log₂ n⌋ + 1', 'n (when many keys collide)'],
        ['Typical comparisons', 'About n / 2 when present', 'About log₂ n', 'A small constant at moderate load'],
        ['Extra memory', 'None', 'None', 'The table'],
        ['Works on a stream or linked list', 'Yes', 'No', 'Only after building the table'],
      ],
    },
  },

  applications: [
    { title: 'Standard library search functions', status: 'established', text: 'C++ `std::find`, Python `list.index` and the `in` operator on lists, and JavaScript `Array.prototype.indexOf` and `includes` are all linear scans. They are the default because they work on any sequence without preparation.' },
    { title: 'Database scans without an index', status: 'established', text: 'When a query filters on a column that has no index, the database reads every row and tests it. Query planners call this a sequential or full table scan, and adding an index is how it is avoided.' },
    { title: 'Scanning bytes and text', status: 'established', text: 'The C library function `memchr` finds a byte in a block of memory by scanning it from the start. Optimized versions test several bytes per machine instruction, but the method is still a linear scan.' },
    { title: 'Small lookup lists inside larger structures', status: 'illustrative', text: 'A structure that holds only a handful of entries, such as the options of a command or the keys in one small tree node, can be scanned in order more simply than it can be indexed.' },
  ],

  connections: [
    { to: 'binary-search', type: 'same-problem', why: 'Both find a value in a list. Binary search uses sorted order to discard half of the remaining values with each comparison, where linear search can discard only one.' },
    { to: 'hash-table', type: 'same-problem', why: 'A hash table computes where a key should be instead of scanning for it. When several keys land in the same place, it falls back on a short linear search from that spot.' },
    { to: 'concept:array', type: 'prerequisite', why: 'The algorithm is a walk over the positions of an array, reading each element once.' },
    { to: 'concept:brute-force', type: 'related', why: 'It is brute force in its simplest form: try every candidate and test each one.' },
    { to: 'concept:big-o', type: 'related', why: 'It is the standard first example of linear growth: the work is proportional to the input size.' },
    { to: 'concept:lower-bound', type: 'advanced', why: 'An adversary argument shows that searching an unstructured list needs n inspections in the worst case, so linear search is optimal for that problem.' },
    { to: 'grovers-search', type: 'advanced', why: 'Grover\'s algorithm solves the same unstructured search problem on a quantum computer with about √n queries, which is impossible for any classical method.' },
    { to: 'knn', type: 'application', why: 'The plain form of nearest-neighbour lookup is a linear scan that keeps the closest points seen so far instead of testing for equality.' },
    { to: 'discipline:machine-learning', type: 'application', why: 'Exact nearest-neighbour queries over stored examples are answered by scanning every example, the same loop with a distance in place of an equality test.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'A list holds 1,000 values in no particular order, and the value you want is not among them. How many comparisons does linear search make?',
      options: ['1', 'About 10', '500', '1,000'],
      answer: 3,
      explain: [
        'One comparison is the best case, when the target is in the first position.',
        'About 10 is what binary search would need, and binary search only works on a sorted list.',
        '500 is roughly the average when the target is present. An absent target gets no such discount.',
        'Correct. The search can only report "not found" after it has checked every value.',
      ],
    },
    {
      type: 'predict',
      q: 'The list has 12 values and the target is not in it. How many comparisons will the run show?',
      options: ['6', '11', '12', '13'],
      answer: 2,
      explain: [
        '6 would be about average for a target that is present. This one is absent.',
        'The last value must be checked too. Stopping one early could miss the target.',
        'Correct. One comparison for each of the 12 values, then the search reports that the target is absent.',
        'There are only 12 values, and each is compared once.',
      ],
      tryInput: { size: 12, where: 'missing', custom: [], shuffle: false },
    },
    {
      type: 'debug',
      q: 'This function reports "not found" for most targets that are in the list. Which line is wrong?',
      code: `def linear_search(a, target):
    for i in range(len(a)):
        if a[i] == target:
            return i
        else:
            return -1`,
      options: [
        'Line 2: the loop should start at 1',
        'Line 3: it should compare with `is` instead of `==`',
        'Lines 5 and 6: the "not found" return is inside the loop, so the function gives up after the first value',
        'Line 4: it should return `a[i]`',
      ],
      answer: 2,
      explain: [
        'Starting at 1 would skip the first value and introduce a second bug.',
        '`==` is the right test for equal values. `is` asks whether two names refer to the very same object.',
        'Correct. The function returns −1 as soon as the first value fails to match. `return -1` belongs after the loop, where it runs only when every value has been checked.',
        'The caller wants the position. It already knows the value it was looking for.',
      ],
    },
    {
      type: 'choice',
      q: 'Which situation is the best fit for linear search?',
      options: [
        'Looking up words in a sorted dictionary of 200,000 entries, millions of times a day',
        'Finding the first line that contains an error in a log file read once from start to end',
        'Checking 10 million customer ids against a list of 10 million blocked ids',
        'Finding a number in a sorted array held in memory',
      ],
      answer: 1,
      explain: [
        'The data is sorted and searched constantly, so binary search or a hash table repays its setup many times over.',
        'Correct. The data arrives in order, is read once, and the test is "contains an error", which no index is built for.',
        'A linear search per customer is 10 million times 10 million comparisons. A hash table of blocked ids makes each check cheap.',
        'Sorted data with direct access is exactly what binary search is for.',
      ],
    },
    {
      type: 'challenge',
      title: 'The sentinel trick',
      prompt: 'The loop in this lesson makes two tests per step: "is this the target?" and "have I run off the end?". Write a version that makes only the first test inside the loop. Append the target to the end of the list before searching, so the loop is guaranteed to stop, then decide afterwards whether the match is a real one. Count the tests each version makes on a list of 1,000 values and an absent target. Then restore the list to its original state.',
      hints: [
        'After the loop stops at position `i`, the target was really present only if `i` is less than the original length.',
        'Think about what must be true of the list for this trick to be allowed: it has to be writable, with room for one more item.',
      ],
    },
  ],

  compare: {
    idea: 'Check each value in turn until the target appears or the list ends.',
    requires: 'Nothing. The list may be in any order and only needs to be readable from start to end.',
    sensitivity: 'Depends only on where the target sits: 1 comparison if first, n if last or absent.',
    memory: 'O(1): a single position counter.',
    difficulty: 'low',
    difficultyNote: 'A single loop. The usual errors are loop bounds and the placement of the "not found" return.',
    limits: 'Every lookup costs time proportional to the list length, and proving absence always costs a full pass.',
    useWhen: 'The list is short, unsorted, read as a stream, or searched too rarely to justify sorting or indexing it.',
  },

  advanced: {
    history: 'Searching a collection item by item is as old as record keeping and has no named inventor. Donald Knuth begins the treatment of searching in *The Art of Computer Programming*, volume 3, with it, under the name sequential search (section 6.1), and analyses several refinements there, including the sentinel version. In 1985 Daniel Sleator and Robert Tarjan analysed lists that reorder themselves as they are searched and showed that the move-to-front rule is within a constant factor of the best possible rule, a result that helped establish the competitive analysis of online algorithms.',
    derivation: 'Suppose the target is present and equally likely to be at each of the $n$ positions. Finding it at position $i$ (counting from 1) costs $i$ comparisons, so the expected cost is\n\n$$E[C] = \\sum_{i=1}^{n} i \\cdot \\frac{1}{n} = \\frac{1}{n}\\cdot\\frac{n(n+1)}{2} = \\frac{n+1}{2}.$$\n\nIf the target is present only with probability $p$, an unsuccessful search costs $n$, and the expectation becomes\n\n$$E[C] = p\\,\\frac{n+1}{2} + (1-p)\\,n.$$\n\nWhen positions are not equally likely, with probability $p_i$ for position $i$, the expected cost is $\\sum_i i\\,p_i$. It is smallest when the most frequently requested values come first, which is the idea behind self-organizing lists.',
    proof: 'Lower bound for unstructured search. Consider any deterministic algorithm that learns about the list only by inspecting positions, and suppose that on some input it answers "not found" after inspecting fewer than $n$ positions. Let $j$ be a position it never inspected. Build a second list identical to the first except that position $j$ holds the target. The algorithm sees exactly the same values in the positions it inspects, so it behaves identically and again answers "not found", which is now wrong. Hence a correct algorithm must inspect all $n$ positions before reporting absence, and linear search, which inspects each position once, is optimal in the worst case.',
    complexityProof: 'The loop body runs once per position examined and does a constant amount of work. If the first occurrence of the target is at index $k$, the body runs $k + 1$ times. If the target is absent it runs $n$ times. The best case is therefore 1 comparison, the worst case is $n$, and the running time is $\\Theta(n)$ in the worst case with $O(1)$ extra space.',
    variants: [
      { name: 'Sentinel search', text: 'Place a copy of the target after the last element so the loop needs no separate end-of-list test. It saves one test per step at the cost of writing to the list.' },
      { name: 'Ordered sequential search', text: 'If the list is sorted, the scan can stop as soon as it passes the place where the target would be. This helps unsuccessful searches but is still linear.' },
      { name: 'Self-organizing list', text: 'After each successful search, move the found item to the front (or one step forward). Frequently requested items drift toward the start, lowering the average cost on skewed workloads.' },
      { name: 'Search by predicate', text: 'Replace the equality test with any yes-or-no test. This is `find_if` in C++ and `find` on JavaScript arrays.' },
      { name: 'Find all occurrences', text: 'Do not stop at the first match. The scan always visits every element, so best and worst cases coincide.' },
    ],
    implementation: 'Prefer the library routine: it is correct at the boundaries and often uses vector instructions. If lookups by key are frequent, change the data structure and do not tune the scan. When scanning records, test the cheapest field first.',
    benchmarking: 'Comparison counts are exact and repeatable. Wall-clock comparisons between a linear scan and binary search on small arrays depend on cache behaviour, branch prediction and element type, so the crossover size must be measured on the target machine with realistic data.',
    references: [
      { authors: 'D. E. Knuth', year: 1998, title: 'The Art of Computer Programming, Volume 3: Sorting and Searching (2nd edition), section 6.1', venue: 'Addison-Wesley' },
      { authors: 'D. D. Sleator and R. E. Tarjan', year: 1985, title: 'Amortized efficiency of list update and paging rules', venue: 'Communications of the ACM 28(2), 202-208' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*: linear search is used in the exercises of the opening chapters to introduce loop invariants and average-case analysis.',
      'J. Bentley, *Programming Pearls* (2nd edition), column 9, discusses tuning a sequential search, including the sentinel.',
    ],
  },

  tests: [
    { name: 'finds a present value at the position a reference lookup gives', input: { size: 40, where: 'random', seed: 11, custom: [] },
      check: (r, c) => (r.index >= 0 && r.index === r.array.indexOf(r.target) && c.comparisons === r.index + 1) || `index ${r.index}, comparisons ${c.comparisons}` },
    { name: 'an absent value costs n comparisons and returns -1', input: { size: 33, where: 'missing', seed: 5, custom: [] },
      check: (r, c) => (r.index === -1 && !r.array.includes(r.target) && c.comparisons === 33) || `index ${r.index}, comparisons ${c.comparisons}` },
    { name: 'the first value costs one comparison', input: { size: 20, where: 'first', seed: 3, custom: [] },
      check: (r, c) => (r.index === 0 && c.comparisons === 1) || `index ${r.index}, comparisons ${c.comparisons}` },
    { name: 'the worked example: 17 is at position 3 after 4 comparisons', input: { custom: [3, 8, 12, 17, 21, 30], target: 17, shuffle: false },
      check: (r, c) => (r.index === 3 && c.comparisons === 4) || `index ${r.index}, comparisons ${c.comparisons}` },
    { name: 'the worked example: 20 is absent after 6 comparisons', input: { custom: [3, 8, 12, 17, 21, 30], target: 20, shuffle: false },
      check: (r, c) => (r.index === -1 && c.comparisons === 6) || `index ${r.index}, comparisons ${c.comparisons}` },
    { name: 'the predict question: 12 values, absent target, 12 comparisons', input: { size: 12, where: 'missing', custom: [], shuffle: false },
      check: (r, c) => (r.index === -1 && c.comparisons === 12) || `comparisons ${c.comparisons}` },
    { name: 'shuffling changes the order but not the cost', input: { size: 30, where: 'last', seed: 9, custom: [], shuffle: true },
      check: (r, c) => {
        const sorted = r.array.slice().sort((a, b) => a - b);
        const shuffled = r.array.some((v, i) => v !== sorted[i]);
        return (shuffled && r.index === 29 && r.array[r.index] === r.target && c.comparisons === 30) || `index ${r.index}, comparisons ${c.comparisons}, shuffled ${shuffled}`;
      } },
  ],
};
