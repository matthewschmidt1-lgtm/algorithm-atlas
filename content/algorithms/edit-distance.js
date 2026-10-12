import { makeRng } from '../../js/lib/rng.js';

const show = (ch) => (ch === ' ' ? '␣' : ch);
const OP_ROLE = { keep: 'done', substitute: 'compare', delete: 'alert', insert: 'active' };
const OP_MARK = { keep: '=', substitute: 'S', delete: 'D', insert: 'I' };

function run(input, t) {
  const A = Array.from(String(input.a ?? '')), B = Array.from(String(input.b ?? ''));
  const m = A.length, n = B.length;
  const D = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(null));
  const q = (arr, k) => (k === 0 ? 'nothing' : `"${arr.slice(0, k).join('')}"`);
  const tableLegend = [{ label: 'cell being filled', role: 'current' }, { label: 'the three cells it reads', role: 'compare' }, { label: 'traceback path', role: 'path' }];
  const tableView = (roles) => ({
    kind: 'table', corner: '', legend: tableLegend,
    title: 'Each cell: fewest edits to turn the letters down the side so far into the letters along the top so far',
    colLabels: ['∅', ...B.map(show)], rowLabels: ['∅', ...A.map(show)],
    cells: D.map((row) => row.map((v) => (v === null ? '' : v))), roles,
  });
  const prefixView = (i, j) => ({
    kind: 'rows', title: 'The beginnings of the two strings that this cell compares',
    rows: [
      { label: 'From', cells: A.map((ch, k) => ({ t: show(ch), role: k === i - 1 ? 'current' : k < i ? 'visited' : 'dim' })) },
      { label: 'To', cells: B.map((ch, k) => ({ t: show(ch), role: k === j - 1 ? 'current' : k < j ? 'visited' : 'dim' })) },
    ],
  });

  t.frame(() => ({ line: 0, note: `Turn **${q(A, m)}** into **${q(B, n)}** with the fewest single-letter edits: delete a letter, insert a letter, or substitute one letter for another. The table has a row for each letter of the first string and a column for each letter of the second. The extra row and column marked ∅ stand for "no letters yet".`, views: [tableView({}), prefixView(0, 0)], vars: { m, n } }));

  for (let i = 0; i <= m; i++) { D[i][0] = i; t.count('cells filled'); }
  t.frame(() => ({ line: [1, 2], note: `First column: turning the first i letters of ${q(A, m)} into nothing takes i deletions, so the column reads 0 to ${m}.`, views: [tableView(Object.fromEntries(D.map((_, i) => [`${i},0`, 'current']))), prefixView(m, 0)], vars: { m, n } }));
  for (let j = 1; j <= n; j++) { D[0][j] = j; t.count('cells filled'); }
  t.frame(() => ({ line: [3, 4], note: `First row: building the first j letters of ${q(B, n)} from nothing takes j insertions, so the row reads 0 to ${n}.`, views: [tableView(Object.fromEntries(D[0].map((_, j) => [`0,${j}`, 'current']))), prefixView(0, n)], vars: { m, n } }));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const same = A[i - 1] === B[j - 1];
      const cost = same ? 0 : 1;
      const diag = D[i - 1][j - 1], up = D[i - 1][j], left = D[i][j - 1];
      const v = Math.min(diag + cost, up + 1, left + 1);
      D[i][j] = v;
      t.count('cells filled');
      t.frame(() => ({ line: [same ? 7 : 8, 9, 10, 11, 12],
        note: `Turn ${q(A, i)} into ${q(B, j)}. The last letters, **${show(A[i - 1])}** and **${show(B[j - 1])}**, ${same ? 'match, so keeping the letter is free' : 'differ'}. Diagonal: ${diag} + ${cost} = ${diag + cost} (${same ? 'keep' : 'substitute'}). Above: ${up} + 1 = ${up + 1} (delete ${show(A[i - 1])}). Left: ${left} + 1 = ${left + 1} (insert ${show(B[j - 1])}). The smallest is **${v}**.`,
        views: [tableView({ [`${i - 1},${j - 1}`]: 'compare', [`${i - 1},${j}`]: 'compare', [`${i},${j - 1}`]: 'compare', [`${i},${j}`]: 'current' }), prefixView(i, j)],
        vars: { i, j, 'a[i]': show(A[i - 1]), 'b[j]': show(B[j - 1]), cost, 'D[i][j]': v } }));
    }
  }

  // Traceback: from the bottom-right cell, step to a neighbour that explains the value.
  const steps = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    const cost = i > 0 && j > 0 && A[i - 1] === B[j - 1] ? 0 : 1;
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + cost) {
      steps.push({ op: cost ? 'substitute' : 'keep', from: A[i - 1], to: B[j - 1], i, j, pi: i - 1, pj: j - 1 });
      i--; j--;
    } else if (i > 0 && D[i][j] === D[i - 1][j] + 1) {
      steps.push({ op: 'delete', from: A[i - 1], to: null, i, j, pi: i - 1, pj: j });
      i--;
    } else {
      steps.push({ op: 'insert', from: null, to: B[j - 1], i, j, pi: i, pj: j - 1 });
      j--;
    }
  }
  const script = steps.slice().reverse().map(({ op, from, to }) => ({ op, from, to }));
  const distance = D[m][n];

  const alignLegend = [{ label: '= keep (free)', role: 'done' }, { label: 'S substitute', role: 'compare' }, { label: 'D delete', role: 'alert' }, { label: 'I insert', role: 'active' }];
  const alignView = (known) => {
    // `known` steps have been traced so far; they are the last `known` columns of the alignment.
    const cols = steps.slice().reverse();
    const blank = cols.length - known;
    const cell = (text, k) => (k < blank ? { t: '', role: 'dim' } : { t: text, role: OP_ROLE[cols[k].op] });
    return { kind: 'rows', title: 'One cheapest edit script, read off the path from the end backwards', legend: alignLegend, rows: [
      { label: 'From', cells: cols.map((s, k) => cell(s.from === null ? '-' : show(s.from), k)) },
      { label: 'To', cells: cols.map((s, k) => cell(s.to === null ? '-' : show(s.to), k)) },
      { label: 'Edit', cells: cols.map((s, k) => cell(OP_MARK[s.op], k)) },
    ] };
  };
  const pathRoles = (count, current) => {
    const roles = { [`${m},${n}`]: 'path' };
    for (let k = 0; k < count; k++) roles[`${steps[k].pi},${steps[k].pj}`] = 'path';
    if (current) roles[current] = 'current';
    return roles;
  };

  if (steps.length) {
    t.frame(() => ({ line: [13, 16], note: `The table is full. The bottom-right cell says the edit distance is **${distance}**. To recover which edits achieve it, walk back from that cell to the top-left corner, each time moving to a neighbour that explains the current value.`, views: [tableView(pathRoles(0, `${m},${n}`)), alignView(0)], vars: { i: m, j: n, distance } }));
  }
  steps.forEach((s, k) => {
    const v = D[s.i][s.j], prev = D[s.pi][s.pj];
    const where = `At ${q(A, s.i)} into ${q(B, s.j)}, the value is ${v}.`;
    const note = s.op === 'keep' ? `${where} The letters match (**${show(s.from)}**) and the diagonal cell also holds ${prev}, so the letter is kept at no cost. Move diagonally.`
      : s.op === 'substitute' ? `${where} It is the diagonal cell (${prev}) plus 1: substitute **${show(s.from)}** with **${show(s.to)}**. Move diagonally.`
      : s.op === 'delete' ? `${where} It is the cell above (${prev}) plus 1: delete **${show(s.from)}**. Move up.`
      : `${where} It is the cell to the left (${prev}) plus 1: insert **${show(s.to)}**. Move left.`;
    t.frame(() => ({ line: [17, 18, 19, 20], note, views: [tableView(pathRoles(k + 1, `${s.pi},${s.pj}`)), alignView(k + 1)], vars: { i: s.pi, j: s.pj, edit: s.op } }));
  });
  const edits = script.filter((s) => s.op !== 'keep').map((s) => (s.op === 'substitute' ? `substitute ${show(s.from)} with ${show(s.to)}` : s.op === 'delete' ? `delete ${show(s.from)}` : `insert ${show(s.to)}`));
  t.frame(() => ({ line: 21, note: distance === 0
    ? `The two strings are identical, so the edit distance is **0** and every letter is kept.`
    : `The edit distance is **${distance}**. Reading the path from the top-left corner gives one way to do it in ${distance} edit${distance === 1 ? '' : 's'}: ${edits.join(', ')}. Other paths with the same total may exist, but none is shorter.`,
    views: [tableView(pathRoles(steps.length, null)), alignView(steps.length)], vars: { distance, rows: m + 1, columns: n + 1 } }));

  return { distance, score: distance, rows: m + 1, cols: n + 1, a: A.join(''), b: B.join(''), table: D, script, edits };
}

// Independent reference for the tests: the recursive definition, worked from the front of
// the strings, with no table. Exponential time, so only for short strings.
function bruteDistance(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (a[0] === b[0]) return bruteDistance(a.slice(1), b.slice(1));
  return 1 + Math.min(bruteDistance(a.slice(1), b), bruteDistance(a, b.slice(1)), bruteDistance(a.slice(1), b.slice(1)));
}
// Apply a reported script to `a` and count the edits that cost something.
function replay(r) {
  let out = '', pos = 0, paid = 0;
  const A = Array.from(r.a);
  for (const s of r.script) {
    if (s.op === 'keep') { if (A[pos] !== s.from || s.from !== s.to) return 'a "keep" step does not match the string'; out += A[pos++]; }
    else if (s.op === 'substitute') { if (A[pos] !== s.from || s.from === s.to) return 'a "substitute" step does not match the string'; out += s.to; pos++; paid++; }
    else if (s.op === 'delete') { if (A[pos] !== s.from) return 'a "delete" step does not match the string'; pos++; paid++; }
    else { out += s.to; paid++; }
  }
  if (pos !== A.length || out !== r.b) return `the script turns "${r.a}" into "${out}", not "${r.b}"`;
  return paid === r.distance || `the script uses ${paid} edits but the reported distance is ${r.distance}`;
}
const silent = { count() {}, frame() {} };
const matchesBrute = (r, c) => {
  const ref = bruteDistance(r.a, r.b);
  if (r.distance !== ref) return `distance ${r.distance}, brute force says ${ref}`;
  if (c['cells filled'] !== r.rows * r.cols) return `filled ${c['cells filled']} cells in a ${r.rows} by ${r.cols} table`;
  return replay(r);
};

export default {
  meta: {
    id: 'edit-distance',
    name: 'Edit Distance (Levenshtein)',
    aliases: ['Levenshtein distance', 'Wagner-Fischer algorithm', 'string edit distance', 'string-to-string correction'],
    kind: 'algorithm',
    discipline: 'nlp',
    alsoIn: [
      { id: 'biology', why: 'Comparing DNA and protein sequences is the same table with biological scores in place of unit costs.' },
      { id: 'algorithms', why: 'It is one of the standard two-dimensional dynamic programming problems, taught alongside longest common subsequence.' },
    ],
    subfield: 'String similarity',
    family: 'Sequence comparison',
    lab: 'dynamic-programming',
    compareGroup: 'sequence-comparison',
    year: 1965,
    authors: 'Vladimir Levenshtein',
    summary: 'Counts the fewest single-character insertions, deletions and substitutions that turn one string into another, by filling a table over all pairs of prefixes.',
    difficulty: 'intermediate',
    order: 320,
    paradigms: ['dynamic-programming'],
    randomized: false,
    approximate: false,
    time: { best: 'O(mn)', average: 'O(mn)', worst: 'O(mn)', class: 'quadratic' },
    space: { worst: 'O(mn) with traceback; O(min(m, n)) for the distance alone', class: 'quadratic' },
    tags: {
      problems: ['how similar are two words', 'spelling correction', 'did you mean', 'fuzzy string matching', 'fewest changes between two strings', 'compare two texts'],
      techniques: ['table filling', 'traceback', 'prefix subproblems', 'memoization'],
      applications: ['natural language', 'search engines', 'bioinformatics', 'data processing'],
    },
    prerequisites: ['fibonacci-dp', 'concept:dynamic-programming', 'concept:recurrence', 'concept:optimal-substructure', 'concept:matrix'],
  },

  bigIdea: {
    simple: "Edit distance measures how different two pieces of text are. It counts the fewest small changes needed to turn one into the other. A small change means adding one letter, removing one letter, or swapping one letter for another. To turn CAT into CART you add an R, so the distance is 1. Spelling checkers use this idea. When you mistype a word, they look for real words that are only a change or two away from what you typed. Finding the fewest changes sounds hard, because there are so many ways to edit a word. The method here avoids trying them all. It starts with the easiest questions, about the first letter or two of each word. Then it works up to longer and longer beginnings of the two words, writing each answer in a grid. Each new answer needs only three answers already in the grid. The last square filled in is the distance between the whole words.",
    what: 'The Levenshtein distance between two strings is the smallest number of single-character insertions, deletions and substitutions that turns the first into the second. The Wagner-Fischer algorithm computes it by filling a table with one row per character of the first string and one column per character of the second. Cell (i, j) holds the distance between the first i characters of one and the first j characters of the other.',
    why: 'Vladimir Levenshtein defined the distance in 1965 while studying codes that could recover from lost, added or flipped symbols in a transmission. The same question, how many small errors separate two sequences, turned out to matter for typing mistakes, for speech, and for DNA.',
    when: 'Use it when you need a number for how far apart two strings are and all three kinds of edit are plausible. If only insertions and deletions make sense, as when comparing versions of a file, the [longest common subsequence](#/algorithm/lcs) is the better fit. If different edits should cost different amounts, as in biology, use [Needleman-Wunsch](#/algorithm/needleman-wunsch), which is the same table with adjustable scores.',
    interesting: 'The number of ways to edit one word into another is astronomically large, yet the table has only (m + 1) × (n + 1) cells and each is filled by looking at three neighbours. This works because every way of editing must end in one of only three ways, so the best way overall is the best of three smaller problems.',
    where: 'Spelling correction, approximate search ("did you mean"), measuring the accuracy of speech recognizers and optical character recognition, record matching in messy databases, and, with different costs, the alignment of biological sequences.',
    analogy: {
      title: 'Crossing a city grid with tolls',
      text: 'Picture a grid of streets. You start at the top-left corner and must reach the bottom-right. Moving one block down means deleting a letter. Moving one block right means inserting a letter. Both cost one coin. You can also cut diagonally across a block: that is free if the two letters at that block match, and costs one coin if they differ. The edit distance is the fewest coins for the whole trip. The cheapest way to reach any corner is the cheapest of the three ways to arrive there, from above, from the left, or diagonally, so you can work out every corner in turn by sweeping across the grid.',
      limits: 'In this city every street is one-way: down, right, or diagonally down and right. That is why one sweep, row by row, is enough. On a real map with two-way streets you would need a method such as Dijkstra\'s algorithm. The picture also makes every toll one coin. Real typing errors are not all equally likely, and plain edit distance does not know that.',
    },
  },

  example: {
    setup: 'Turn the word TEA into the word EAT. One edit deletes a letter, inserts a letter, or swaps one letter for another. Draw a grid with T, E, A down the side and E, A, T along the top. Add one extra row and one extra column at the start for "no letters yet". Each square will hold the fewest edits to turn the letters down the side so far into the letters along the top so far.',
    steps: [
      'Fill the extra row and column first. Turning T, TE, TEA into nothing takes 1, 2, 3 deletions. Building E, EA, EAT from nothing takes 1, 2, 3 insertions.',
      'Square for T into E. The letters differ. Look at three neighbours: diagonal 0, above 1, left 1. The smallest is 0, and one more edit (swap T for E) gives 1.',
      'Square for TE into E. The last letters match, E and E, so copy the diagonal square, which is T into nothing: 1.',
      'Square for TEA into EA. The last letters match, A and A, so copy the diagonal square, TE into E: 1.',
      'Last square, TEA into EAT. A and T differ. The neighbours are: diagonal 2, above 3, left 1. The smallest is 1, and one more edit gives 2.',
    ],
    result: 'The distance is 2. Following the squares back shows how: delete the T at the front of TEA to get EA, then insert a T at the end to get EAT. Swapping each of the three letters would have taken 3 edits, so the obvious way is not always the shortest.',
    tryInput: { a: 'tea', b: 'eat' },
  },

  terms: [
    { term: 'String', meaning: 'A sequence of characters, such as a word, a sentence or a stretch of DNA.' },
    { term: 'Edit', meaning: 'One small change to a string: insert one character, delete one character, or substitute one character for another.' },
    { term: 'Edit distance', meaning: 'The smallest number of edits that turns one string into another. Also called Levenshtein distance.' },
    { term: 'Prefix', meaning: 'The beginning of a string, up to some position. The prefixes of TEA are T, TE and TEA, plus the empty prefix with no letters.' },
    { term: 'Subproblem', meaning: 'A smaller version of the question. Here each subproblem asks for the distance between a prefix of one string and a prefix of the other.' },
    { term: 'Table', meaning: 'A grid with one cell for every subproblem, filled in an order that makes each answer available before it is needed.' },
    { term: 'Traceback', meaning: 'Walking backwards through the finished table to recover which edits produced the answer.' },
    { term: 'Edit script', meaning: 'The list of edits, in order, that turns the first string into the second.' },
  ],

  takeaway: 'To compare two words, compare all their beginnings first, shortest to longest, and build each answer from the three answers just before it.',

  viz: {
    describe: 'A table with the first string down the left side and the second string along the top, plus a row and column marked with an empty-set sign for "no letters yet". Each cell holds the fewest edits between the two prefixes it stands for. The cell being filled is terracotta and the three cells it reads (above, left and diagonal) are ochre. After the table is full, a forest green path runs from the bottom-right cell back to the top-left. Beneath the table, two rows of letter cells show the prefixes being compared, and at the end they show the two strings lined up with a third row marking each column as keep, substitute, delete or insert.',
    inputs: [
      { id: 'a', type: 'text', label: 'From (first string)', default: 'kitten', maxLength: 14, help: 'Up to 14 characters. Upper and lower case count as different letters.' },
      { id: 'b', type: 'text', label: 'To (second string)', default: 'sitting', maxLength: 14 },
    ],
    presets: [
      { label: 'kitten to sitting', values: { a: 'kitten', b: 'sitting' } },
      { label: 'Worked example: tea to eat', values: { a: 'tea', b: 'eat' } },
      { label: 'Two letters swapped', values: { a: 'recieve', b: 'receive' } },
      { label: 'sunday to saturday', values: { a: 'sunday', b: 'saturday' } },
      { label: 'Nothing in common', values: { a: 'abc', b: 'xyz' } },
    ],
    tryThis: [
      'Load "Two letters swapped". A person sees one mistake, but the distance is 2, because plain edit distance has no single edit for swapping neighbours. The Damerau variant adds one.',
      'Type the same word in both boxes. Every diagonal cell is 0 and the path runs straight down the diagonal. Now change one letter in the middle and watch the diagonal values below that point rise to 1.',
      'Clear the second box completely. The table collapses to a single column and the distance is the length of the first string: delete everything.',
      'Swap the two strings (sitting to kitten). The distance stays 3, but every insert becomes a delete and the path is mirrored.',
    ],
    run,
    report: (r, c) => `Edit distance from "${r.a}" to "${r.b}": ${r.distance}\nTable: ${r.rows} rows by ${r.cols} columns, ${c['cells filled'] || 0} cells filled.\nOne cheapest edit script: ${r.edits.length ? r.edits.join(', ') : 'no edits needed'}.`,
    experiment: {
      title: 'Cells filled as the strings grow',
      note: 'Each point is a real run on random strings over the letters a, c, g, t. In one series both strings have length n. In the other the second string stays at 8 characters. The work is the size of the table, whatever the letters are.',
      metric: 'cells filled',
      metricLabel: 'Cells filled',
      sizeLabel: 'Length of the first string (n)',
      sizes: [4, 8, 16, 32, 64, 128, 256],
      variants: [
        { id: 'square', label: 'Both strings have length n' },
        { id: 'fixed', label: 'Second string fixed at 8 characters' },
      ],
      input: (n, variant, seed) => {
        const rng = makeRng(seed * 31 + n);
        const word = (len) => Array.from({ length: len }, () => 'acgt'[rng.int(0, 3)]).join('');
        return { a: word(n), b: word(variant === 'fixed' ? 8 : n) };
      },
      theory: [
        { label: '(n + 1)²', fn: (n) => (n + 1) * (n + 1), variant: 'square' },
        { label: '9 (n + 1)', fn: (n) => 9 * (n + 1), variant: 'fixed' },
      ],
    },
  },

  logic: {
    intuition: 'Look only at the ends of the two strings. However the first string is turned into the second, the last thing that happens falls into one of three cases: the last character of the first string is deleted, the last character of the second string is inserted, or the two last characters are paired up (kept if equal, substituted if not). In each case what remains is the same problem on shorter strings. So the answer for two prefixes is the best of three answers for slightly shorter prefixes, and all those answers fit in a table.',
    steps: [
      'Let m and n be the lengths of the strings a and b. Make a table D with rows 0 to m and columns 0 to n. D[i][j] will be the distance between the first i characters of a and the first j characters of b. The pseudocode numbers characters from 1, so a[i] is the i-th character.',
      'Fill column 0 with 0, 1, up to m: turning i characters into nothing takes i deletions. Fill row 0 with 0, 1, up to n: building j characters from nothing takes j insertions.',
      'Visit the remaining cells row by row. For cell (i, j), set `cost` to 0 if the i-th character of a equals the j-th character of b, and 1 otherwise.',
      'Set D[i][j] to the smallest of three values. The diagonal cell D[i−1][j−1] plus `cost` means keep or substitute. The cell above, D[i−1][j], plus 1 means delete a[i]. The cell to the left, D[i][j−1], plus 1 means insert b[j].',
      'When the table is full, D[m][n] is the edit distance.',
      'To recover the edits, start at (m, n) and repeatedly step to a neighbour whose value explains the current one, until reaching (0, 0). Reverse the steps to get the edit script.',
    ],
    pseudocode: [
      'editDistance(a, b):',
      '  for i from 0 to m:',
      '    D[i][0] ← i',
      '  for j from 0 to n:',
      '    D[0][j] ← j',
      '  for i from 1 to m:',
      '    for j from 1 to n:',
      '      if a[i] = b[j]: cost ← 0',
      '      else: cost ← 1',
      '      D[i][j] ← min(',
      '        D[i−1][j−1] + cost,',
      '        D[i−1][j] + 1,',
      '        D[i][j−1] + 1)',
      '  return D[m][n]',
      '',
      'traceback(D):',
      '  (i, j) ← (m, n)',
      '  while (i, j) ≠ (0, 0):',
      '    step to a neighbour',
      '      that explains D[i][j]',
      '    record that edit',
      '  return edits, reversed',
    ],
    decisions: [
      { title: 'What does one cell mean?', text: 'A cell is a pair of prefixes. This is the design choice that makes the method work: prefixes of prefixes are again prefixes, so every subproblem that can arise is already a cell of the table.' },
      { title: 'In what order are cells filled?', text: 'Any order in which the cell above, the cell to the left and the diagonal cell are filled first. Row by row is the usual choice. Column by column, or along anti-diagonals, is equally valid.' },
      { title: 'Which path does the traceback take when there is a tie?', text: 'Several neighbours can explain the same value, and each choice gives a different edit script of the same length. This page prefers the diagonal, then up, then left. The distance does not depend on the choice.' },
      { title: 'Keep the whole table?', text: 'The distance needs only the previous row, so memory can drop to one row. The traceback needs the whole table, unless Hirschberg\'s divide-and-conquer method is used to rebuild the path in linear space.' },
    ],
    invariants: [
      'After a cell is filled, `D[i][j]` equals the edit distance between the first i characters of a and the first j characters of b.',
      'Neighbouring cells differ by at most 1, horizontally, vertically and diagonally.',
      'During the traceback, the edits recorded so far cost exactly `D[m][n] − D[i][j]`.',
    ],
    edgeCases: [
      'One or both strings empty: the distance is the length of the other string, read directly from the border.',
      'Identical strings: distance 0, and the path follows the main diagonal.',
      'Strings with no characters in common: the distance is the length of the longer string.',
      'Case and accents: "A" and "a" are different characters unless you normalize the text first.',
      'Characters that occupy several code units (many emoji, some accented letters): comparing code units instead of whole characters gives a distance that is too large.',
    ],
    correctness: 'By induction on i + j. The border is correct because the only way to turn i characters into none is to delete them all, and likewise for insertions. For an interior cell, take any cheapest edit script from the first i characters of a to the first j characters of b, and look at what happens to the last characters. Either a[i] is deleted, and the rest is a cheapest script for (i − 1, j). Or b[j] is inserted, and the rest is a cheapest script for (i, j − 1). Or a[i] is matched with b[j], at cost 0 or 1, and the rest is a cheapest script for (i − 1, j − 1). In each case the rest must itself be cheapest, or swapping in a cheaper one would improve the whole. So the true distance is one of the three candidates, and since each candidate is achievable, it is their minimum.',
    mistakes: [
      'Leaving the first row and column at zero. Leading insertions and deletions then look free, and the result is no longer the distance between the whole strings.',
      'Off-by-one indexing: the table has m + 1 rows, so cell (i, j) compares `a[i − 1]` with `b[j − 1]` in zero-based code.',
      'Adding the substitution cost when the characters are equal.',
      'Keeping only one row to save memory and then trying to trace back the edits, which needs the whole table.',
    ],
  },

  code: {
    sample: {
      input: 'The pairs (kitten, sitting) and (tea, eat): the distance, then the edits that cost something.',
      expected: 'kitten -> sitting: 3\n  substitute k with s\n  substitute e with i\n  insert g\ntea -> eat: 2\n  delete t\n  insert t',
    },
    python: {
      source: `def edit_table(a, b):
    m, n = len(a), len(b)
    D = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        D[i][0] = i
    for j in range(n + 1):
        D[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            D[i][j] = min(D[i - 1][j - 1] + cost,  # keep or substitute
                          D[i - 1][j] + 1,         # delete a[i-1]
                          D[i][j - 1] + 1)         # insert b[j-1]
    return D


def edit_script(a, b, D):
    i, j = len(a), len(b)
    edits = []
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            cost = 0 if a[i - 1] == b[j - 1] else 1
            if D[i][j] == D[i - 1][j - 1] + cost:
                if cost == 1:
                    edits.append("substitute " + a[i - 1] + " with " + b[j - 1])
                i, j = i - 1, j - 1
                continue
        if i > 0 and D[i][j] == D[i - 1][j] + 1:
            edits.append("delete " + a[i - 1])
            i -= 1
        else:
            edits.append("insert " + b[j - 1])
            j -= 1
    return edits[::-1]


for a, b in [("kitten", "sitting"), ("tea", "eat")]:
    D = edit_table(a, b)
    print(a + " -> " + b + ": " + str(D[len(a)][len(b)]))
    for edit in edit_script(a, b, D):
        print("  " + edit)`,
      notes: [
        { line: 5, text: 'The border. Turning the first i characters into nothing takes i deletions. Without these two loops the answers are wrong.' },
        { line: 10, text: 'Python strings are indexed from 0, so row i of the table belongs to character `a[i - 1]`.' },
        { line: 11, text: 'The whole algorithm: the smallest of three neighbours, each with the cost of the edit that leads from it.' },
        { line: 23, text: 'Traceback asks the question in reverse: which neighbour, plus the cost of its edit, gives the value in this cell?' },
        { line: 34, text: 'The walk runs from the end of the strings to the start, so the edits are reversed before returning.' },
      ],
    },
    javascript: {
      source: `function editTable(a, b) {
  const m = a.length, n = b.length;
  const D = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) D[i][0] = i;
  for (let j = 0; j <= n; j++) D[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      D[i][j] = Math.min(D[i - 1][j - 1] + cost,  // keep or substitute
                         D[i - 1][j] + 1,         // delete a[i-1]
                         D[i][j - 1] + 1);        // insert b[j-1]
    }
  }
  return D;
}

function editScript(a, b, D) {
  let i = a.length, j = b.length;
  const edits = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      if (D[i][j] === D[i - 1][j - 1] + cost) {
        if (cost === 1) edits.push("substitute " + a[i - 1] + " with " + b[j - 1]);
        i--; j--;
        continue;
      }
    }
    if (i > 0 && D[i][j] === D[i - 1][j] + 1) {
      edits.push("delete " + a[i - 1]);
      i--;
    } else {
      edits.push("insert " + b[j - 1]);
      j--;
    }
  }
  return edits.reverse();
}

for (const [a, b] of [["kitten", "sitting"], ["tea", "eat"]]) {
  const D = editTable(a, b);
  console.log(a + " -> " + b + ": " + D[a.length][b.length]);
  for (const edit of editScript(a, b, D)) console.log("  " + edit);
}`,
    },
    cpp: {
      source: `#include <algorithm>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

using Table = std::vector<std::vector<int>>;

Table editTable(const std::string& a, const std::string& b) {
    int m = a.size(), n = b.size();
    Table D(m + 1, std::vector<int>(n + 1, 0));
    for (int i = 0; i <= m; ++i) D[i][0] = i;
    for (int j = 0; j <= n; ++j) D[0][j] = j;
    for (int i = 1; i <= m; ++i) {
        for (int j = 1; j <= n; ++j) {
            int cost = a[i - 1] == b[j - 1] ? 0 : 1;
            D[i][j] = std::min({D[i - 1][j - 1] + cost,  // keep or substitute
                                D[i - 1][j] + 1,         // delete a[i-1]
                                D[i][j - 1] + 1});       // insert b[j-1]
        }
    }
    return D;
}

std::vector<std::string> editScript(const std::string& a, const std::string& b, const Table& D) {
    int i = a.size(), j = b.size();
    std::vector<std::string> edits;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0) {
            int cost = a[i - 1] == b[j - 1] ? 0 : 1;
            if (D[i][j] == D[i - 1][j - 1] + cost) {
                if (cost == 1) edits.push_back(std::string("substitute ") + a[i - 1] + " with " + b[j - 1]);
                --i; --j;
                continue;
            }
        }
        if (i > 0 && D[i][j] == D[i - 1][j] + 1) {
            edits.push_back(std::string("delete ") + a[i - 1]);
            --i;
        } else {
            edits.push_back(std::string("insert ") + b[j - 1]);
            --j;
        }
    }
    std::reverse(edits.begin(), edits.end());
    return edits;
}

int main() {
    std::vector<std::pair<std::string, std::string>> pairs = {{"kitten", "sitting"}, {"tea", "eat"}};
    for (const auto& [a, b] : pairs) {
        Table D = editTable(a, b);
        std::cout << a << " -> " << b << ": " << D[a.size()][b.size()] << "\\n";
        for (const std::string& edit : editScript(a, b, D)) std::cout << "  " << edit << "\\n";
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The table has (m + 1) × (n + 1) cells and each is filled with a constant amount of work: one character comparison and a minimum of three numbers. So the time is proportional to m × n whatever the strings contain. There is no lucky input: identical strings fill exactly as many cells as unrelated ones.',
    cases: [
      { case: 'Every input', time: 'Θ(mn)', when: 'The full table is always filled. Best, average and worst cases are the same.' },
      { case: 'Distance at most k', time: 'O(k · min(m, n))', when: 'A variant that fills only a diagonal band of width 2k + 1, used when you only care whether the strings are within k edits.' },
      { case: 'Traceback', time: 'O(m + n)', when: 'Each step moves at least one row up or one column left.' },
    ],
    space: 'The full table takes Θ(mn) cells and is needed for a simple traceback. If only the distance is wanted, two rows are enough, or one row and one saved value: O(min(m, n)) after putting the shorter string along the top.',
    memory: 'For long inputs the table, not the time, is the first limit. Two strings of 100,000 characters would need a table of ten billion cells. Linear-space methods and banded tables exist for this reason.',
    tradeoffs: 'The table buys certainty: an exact answer and an explicit edit script, at quadratic cost. Banded and bit-parallel versions are much faster when the strings are similar or short. Searching a large dictionary one word at a time is slow, so spell checkers combine the distance with an index that rules out most words first.',
    assumptions: [
      'Comparing two characters takes constant time.',
      'Every insertion, deletion and substitution costs 1.',
      'The strings are held in memory and can be indexed by position.',
      'The chart on this page counts table cells written, including the first row and column, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Short strings such as words, names, codes and identifiers.',
      'Cases where an explanation is wanted as well as a number: the traceback says exactly what changed.',
      'As a building block: the same table handles weighted edits, alignment and approximate search with small changes.',
    ],
    struggles: [
      'Long texts: quadratic time and memory become prohibitive for documents or whole genomes.',
      'Transposed letters, which people see as one mistake but which cost 2.',
      'Meaning. "big" and "large" are far apart and "cat" and "cut" are close. The distance measures spelling, not sense.',
      'Comparing one string against millions of candidates without an index.',
    ],
    pitfalls: [
      'Forgetting the border row and column, or indexing the strings and the table with the same index.',
      'Comparing strings of very different lengths without normalizing: a distance of 3 means something different for 4-letter words than for 40-letter sentences.',
      'Counting bytes or code units when the text contains multi-unit characters.',
    ],
    misunderstandings: [
      '"Edit distance counts the letters that differ, position by position." That is Hamming distance, and it only works for strings of equal length. Edit distance also allows insertions and deletions, so TEA and EAT are 2 apart although all three positions differ.',
      '"The algorithm tries every way of editing the string." It never lists edit scripts. It solves (m + 1) × (n + 1) small problems once each, and every script is covered because each one must end in one of three ways.',
      '"The path found is the way to edit the string." It is one cheapest way. There can be several, and which one is reported depends on how ties are broken.',
      '"A smaller distance always means more similar." Only between strings of comparable length. Many systems divide by the longer length to get a ratio.',
    ],
    constraints: [
      'Interactive features such as search suggestions must answer in a few milliseconds, which rules out running the full table against every dictionary word. Real systems use tries, automata or n-gram indexes to cut down the candidates.',
      'Unicode text should be normalized before comparison, so that the same visible character is always the same sequence of code points.',
    ],
    alternatives: [
      { id: 'lcs', name: 'Longest Common Subsequence', when: 'Only insertions and deletions make sense, as in comparing versions of a file.' },
      { id: 'needleman-wunsch', name: 'Needleman-Wunsch Alignment', when: 'Edits should have different scores, as with biological sequences.' },
      { name: 'Hamming distance', when: 'The strings always have equal length and only substitutions can occur. It needs one pass and no table.' },
      { name: 'Damerau-Levenshtein distance', when: 'Swapping two adjacent characters should count as a single edit, as in typing errors.' },
    ],
    comparison: {
      columns: ['', 'Edit distance', 'LCS', 'Needleman-Wunsch', 'Hamming distance'],
      rows: [
        ['Allowed changes', 'Insert, delete, substitute', 'Insert, delete', 'Gap, match, mismatch', 'Substitute only'],
        ['Costs', 'All 1', 'All 1', 'Chosen by the user', 'All 1'],
        ['Goal', 'Minimize edits', 'Maximize shared characters', 'Maximize score', 'Count differing positions'],
        ['Time', 'O(mn)', 'O(mn)', 'O(mn)', 'O(n)'],
        ['Unequal lengths', 'Yes', 'Yes', 'Yes', 'No'],
      ],
    },
  },

  applications: [
    { title: 'Spelling correction', status: 'established', text: 'A spelling corrector proposes dictionary words within a small edit distance of the word typed, usually ranked by how common each candidate is. Fred Damerau\'s 1964 study found that about 80 percent of the misspellings in his data were a single insertion, deletion, substitution or swap of adjacent letters.' },
    { title: 'Scoring speech recognition', status: 'established', text: 'Word error rate, the standard measure of speech recognizer accuracy, is an edit distance computed over words instead of characters: substitutions, deletions and insertions divided by the number of words in the reference transcript.' },
    { title: 'Approximate search', status: 'established', text: 'Search systems offer fuzzy matching that accepts terms within one or two edits of the query, so that a misspelled query still finds the intended documents. They do it with automata and indexes built around the same distance.' },
    { title: 'Biological sequence comparison', status: 'established', text: 'Aligning DNA or protein sequences uses the same table with scores that depend on which symbols are paired and on how gaps are penalized. See [Needleman-Wunsch](#/algorithm/needleman-wunsch).' },
    { title: 'Matching records in messy data', status: 'illustrative', text: 'When two lists of names or addresses were typed by different people, entries that are a few edits apart can be flagged as probable duplicates for a person to review.' },
  ],

  connections: [
    { to: 'fibonacci-dp', type: 'prerequisite', why: 'Both fill a table so that each entry is computed once from earlier entries. Fibonacci reads two earlier cells in one dimension; edit distance reads three in two dimensions and adds a choice.' },
    { to: 'concept:dynamic-programming', type: 'prerequisite', why: 'The table over pairs of prefixes is the standard two-dimensional example of the paradigm.' },
    { to: 'concept:optimal-substructure', type: 'prerequisite', why: 'A cheapest edit script, with its last step removed, is a cheapest script for the shorter prefixes. That is why taking the minimum of three neighbours is enough.' },
    { to: 'concept:overlapping-subproblems', type: 'prerequisite', why: 'The plain recursion reaches the same pair of prefixes along exponentially many routes. The table computes each pair once.' },
    { to: 'concept:matrix', type: 'prerequisite', why: 'The subproblems are indexed by two positions, so the natural store is a two-dimensional array.' },
    { to: 'lcs', type: 'same-problem', why: 'With substitutions forbidden, the edit distance equals the two lengths added together minus twice the length of the longest common subsequence. The two tables are filled in the same order from the same three neighbours.' },
    { to: 'needleman-wunsch', type: 'variant', why: 'Global alignment is the same recurrence with a score for each match, mismatch and gap in place of unit costs, and a maximum in place of the minimum.' },
    { to: 'dijkstra', type: 'related', why: 'Edit distance is a shortest path from the top-left to the bottom-right corner of a grid graph with edge weights 0 and 1. Because every edge points down or right, a row-by-row sweep visits the nodes in a valid order and no priority queue is needed.' },
    { to: 'bellman-ford', type: 'related', why: 'Both compute shortest paths by a recurrence over smaller subproblems. Bellman-Ford must repeat its passes because its graph may have cycles; the edit grid has none, so one pass is enough.' },
    { to: 'backpropagation', type: 'related', why: 'Both make a forward pass that stores intermediate values and a backward pass that reads them: the traceback walks the stored table to recover the edits, and backpropagation walks the stored activations to assign each weight its share of the error.' },
    { to: 'huffman-coding', type: 'related', why: 'Huffman coding reaches an optimal answer greedily, never revisiting a choice. For edit distance no such rule is known: pairing the first equal letters you meet can block a better pairing later, which is why every pair of prefixes is considered.' },
    { to: 'knapsack', type: 'related', why: 'Another two-dimensional table in which each cell is the best of a few earlier cells, followed by a traceback to recover the choices.' },
    { to: 'viterbi', type: 'advanced', why: 'The Viterbi algorithm fills a table of best scores over positions and states and traces back the best path, the same pattern applied to probabilistic sequence models.' },
    { to: 'discipline:biology', type: 'application', why: 'Mutations change sequences by substitution, insertion and deletion, so the evolutionary difference between two sequences is estimated with an edit-distance table using biological scores.' },
    { to: 'discipline:information-theory', type: 'application', why: 'Levenshtein introduced the distance to describe codes that can correct insertions and deletions as well as substitutions of symbols.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'In the table for turning string a into string b, what does the cell in row i and column j hold?',
      options: ['1 if the i-th character of a equals the j-th character of b, otherwise 0', 'The fewest edits to turn the first i characters of a into the first j characters of b', 'The number of characters the two strings share up to those positions', 'The fewest edits to turn the last i characters of a into the last j characters of b'],
      answer: 1,
      explain: [
        'The comparison of two characters is used to compute the cell, but it is not what the cell stores.',
        'Correct. Each cell answers the whole question for a pair of prefixes, which is why the bottom-right cell is the final answer.',
        'That describes the longest common subsequence table, a close relative.',
        'A table over suffixes would also work, but it would be filled from the bottom-right. This one is over prefixes.',
      ],
    },
    {
      type: 'predict',
      q: 'What is the edit distance from "flaw" to "lawn"?',
      options: ['1', '2', '3', '4'],
      answer: 1,
      explain: [
        'One edit cannot do it. The strings have the same length, so a single edit would have to be a substitution, and they differ in every position.',
        'Correct. Delete the f to get "law", then insert n at the end. The middle three letters are kept.',
        'There is a shorter way than three edits: notice that "law" appears in both words.',
        'Four is the position-by-position count, substituting every letter. Insertions and deletions do better.',
      ],
      tryInput: { a: 'flaw', b: 'lawn' },
    },
    {
      type: 'debug',
      q: 'This function returns 0 for ("abc", "") and answers that are too small in general. What is missing?',
      code: `def distance(a, b):
    m, n = len(a), len(b)
    D = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            D[i][j] = min(D[i - 1][j - 1] + cost,
                          D[i - 1][j] + 1,
                          D[i][j - 1] + 1)
    return D[m][n]`,
      options: ['The first row and column are never set to 0, 1, 2 and so on', 'The loops should start at 0', 'The cost should be 2 when the characters differ', 'min should be max'],
      answer: 0,
      explain: [
        'Correct. With the border left at zero, deleting or inserting leading characters appears to be free, so every value is too small.',
        'Starting at 0 would read D[-1], which in Python silently wraps to the last row.',
        'A substitution costs 1 in Levenshtein distance.',
        'The distance is the fewest edits, so the minimum is right.',
      ],
    },
    {
      type: 'choice',
      q: 'You need only the distance between two strings of 50,000 characters each, not the edit script. What is the main thing to change?',
      options: ['Use recursion without a table', 'Keep only the previous row of the table', 'Sort both strings first', 'Stop as soon as two characters differ'],
      answer: 1,
      explain: [
        'Without a table the recursion revisits the same subproblems exponentially often.',
        'Correct. Each row depends only on the row above, so two rows of 50,001 numbers replace a table of 2.5 billion cells. The time is still quadratic.',
        'Sorting destroys the order of the characters, which is exactly what the distance measures.',
        'A difference at one position says little: one insertion early on shifts every later character.',
      ],
    },
    {
      type: 'challenge',
      title: 'One row, then swaps',
      prompt: 'First rewrite the distance function to use a single row of n + 1 numbers plus one saved value for the diagonal, and check that it still returns 3 for kitten and sitting. Then extend the full-table version so that swapping two adjacent characters costs 1: when a[i] = b[j − 1] and a[i − 1] = b[j], also consider D[i − 2][j − 2] + 1. With that rule, "recieve" to "receive" should be distance 1.',
      hints: ['In the one-row version, before overwriting position j, save its old value: it is the diagonal for position j + 1.', 'The swap rule gives what is known as the optimal string alignment distance, a restricted form of Damerau-Levenshtein distance.'],
    },
  ],

  compare: {
    idea: 'Fill a table of distances between all pairs of prefixes; each cell is the minimum over three neighbours.',
    requires: 'Two strings. Every insertion, deletion and substitution costs 1.',
    sensitivity: 'None. The whole table is filled whatever the strings contain.',
    memory: 'O(mn) for the table with traceback, O(min(m, n)) for the distance alone.',
    difficulty: 'moderate',
    difficultyNote: 'Ten lines of code, but the border and the off-by-one between table and string indices need care.',
    limits: 'Quadratic time and memory. Treats all edits as equally likely and counts a swap of neighbours as two edits.',
    useWhen: 'You need an exact count of single-character edits between two short strings.',
  },

  advanced: {
    history: 'Vladimir Levenshtein defined the distance in a 1965 paper on error-correcting codes, published in English translation in 1966. Fred Damerau had studied single-error spelling mistakes, including transpositions, in 1964. The table-filling algorithm is usually credited to Robert Wagner and Michael Fischer, whose 1974 paper named the "string-to-string correction problem", but essentially the same method was found independently several times in different fields, among them by T. K. Vintsyuk in 1968 for speech recognition and by Saul Needleman and Christian Wunsch in 1970 for protein sequences. In 2015 Arturs Backurs and Piotr Indyk showed that a substantially faster exact algorithm, one running in time n to a power below 2, would contradict the Strong Exponential Time Hypothesis, a widely believed conjecture.',
    derivation: 'Write $d(i, j)$ for the distance between the first $i$ characters of $a$ and the first $j$ characters of $b$. The base cases are $d(i, 0) = i$ and $d(0, j) = j$. For $i, j \\ge 1$:\n\n$$d(i, j) = \\min \\begin{cases} d(i-1,\\, j-1) + [a_i \\ne b_j] \\\\ d(i-1,\\, j) + 1 \\\\ d(i,\\, j-1) + 1 \\end{cases}$$\n\nwhere $[a_i \\ne b_j]$ is 1 if the characters differ and 0 if they are equal. The three lines correspond to pairing $a_i$ with $b_j$, deleting $a_i$, and inserting $b_j$.',
    proof: 'Think of an edit script as an alignment: write the two strings one above the other, inserting gap symbols so that each column pairs a character with a character, a character with a gap, or a gap with a character. The cost is the number of columns that are not a pair of equal characters. An optimal alignment of the prefixes $a_{1..i}$ and $b_{1..j}$ has a last column of one of three kinds: $(a_i, b_j)$, $(a_i, \\text{gap})$ or $(\\text{gap}, b_j)$. Removing that column leaves an alignment of the shorter prefixes, which must itself be optimal, since otherwise replacing it by a better one would lower the total. Hence $d(i,j)$ is at least the minimum of the three candidates. It is at most that minimum because each candidate is realized by extending an optimal smaller alignment with one column. Edit distance is also a metric: it is zero only for equal strings, symmetric because every edit can be undone by one edit, and it satisfies the triangle inequality because scripts can be chained.',
    complexityProof: 'There are $(m+1)(n+1)$ cells. Each border cell is written in constant time and each interior cell needs one comparison and a minimum of three sums, so the total is $\\Theta(mn)$. The traceback moves from $(m, n)$ to $(0, 0)$, decreasing $i + j$ by 1 or 2 per step, so it takes at most $m + n$ steps.',
    variants: [
      { name: 'Damerau-Levenshtein distance', text: 'Adds the transposition of two adjacent characters as a single edit.' },
      { name: 'Weighted edit distance', text: 'Gives each edit its own cost, for example cheaper substitutions between keys that are neighbours on a keyboard. The recurrence is unchanged.' },
      { name: 'Banded computation', text: 'Fills only the cells within k of the main diagonal, which is enough to decide whether the distance is at most k. Described by Esko Ukkonen in 1985.' },
      { name: 'Bit-parallel computation', text: 'Gene Myers\'s 1999 algorithm encodes a column of the table in machine words and updates it with a few bitwise operations.' },
      { name: 'Linear-space traceback', text: 'Hirschberg\'s divide-and-conquer method recovers an optimal script using only two rows at a time, at about twice the running time.' },
      { name: 'Approximate substring search', text: 'Setting the first row to zero lets a match start anywhere in the text, turning the table into a search for places where a pattern occurs with few errors.' },
    ],
    implementation: 'Put the shorter string along the top to minimize row length. If you need only a yes or no answer for "within k edits", use a band and stop early when a whole row exceeds k. Strip any common prefix and suffix first: they never contribute to the distance. Compare characters, not bytes, and normalize Unicode before comparing.',
    benchmarking: 'Cells filled is a machine-independent measure for the plain algorithm. When comparing against banded or bit-parallel versions, report string length and the actual distance, because the faster methods depend strongly on how similar the inputs are.',
    references: [
      { authors: 'V. I. Levenshtein', year: 1966, title: 'Binary codes capable of correcting deletions, insertions, and reversals', venue: 'Soviet Physics Doklady 10(8), 707-710 (translation of the 1965 Russian original)' },
      { authors: 'R. A. Wagner and M. J. Fischer', year: 1974, title: 'The string-to-string correction problem', venue: 'Journal of the ACM 21(1), 168-173' },
      { authors: 'F. J. Damerau', year: 1964, title: 'A technique for computer detection and correction of spelling errors', venue: 'Communications of the ACM 7(3), 171-176' },
      { authors: 'G. Navarro', year: 2001, title: 'A guided tour to approximate string matching', venue: 'ACM Computing Surveys 33(1), 31-88' },
      { authors: 'A. Backurs and P. Indyk', year: 2015, title: 'Edit distance cannot be computed in strongly subquadratic time (unless SETH is false)', venue: 'Proceedings of the 47th ACM Symposium on Theory of Computing (STOC)' },
    ],
    furtherReading: [
      'D. Jurafsky and J. H. Martin, *Speech and Language Processing*, chapter 2, section on minimum edit distance.',
      'D. Gusfield, *Algorithms on Strings, Trees, and Sequences* (1997), part III.',
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Dynamic Programming", problem on edit distance.',
    ],
  },

  tests: [
    { name: 'kitten to sitting is 3 and the script replays correctly', input: { a: 'kitten', b: 'sitting' },
      check: (r, c) => (r.distance === 3 && r.edits.join('; ') === 'substitute k with s; substitute e with i; insert g' && matchesBrute(r, c) === true) || `got ${r.distance}: ${r.edits.join('; ')}` },
    { name: 'worked example: tea to eat, every cell of the table', input: { a: 'tea', b: 'eat' },
      check: (r) => (r.distance === 2 && JSON.stringify(r.table) === '[[0,1,2,3],[1,1,2,2],[2,1,2,3],[3,2,1,2]]' && r.edits.join('; ') === 'delete t; insert t') || `got table ${JSON.stringify(r.table)} and edits ${r.edits.join('; ')}` },
    { name: 'matches brute-force recursion: sunday to saturday', input: { a: 'sunday', b: 'saturday' },
      check: (r, c) => (r.distance === 3 ? matchesBrute(r, c) : `expected 3, got ${r.distance}`) },
    { name: 'matches brute-force recursion: strings with repeated letters', input: { a: 'abbabab', b: 'babbaa' }, check: matchesBrute },
    { name: 'matches brute-force recursion: nothing in common', input: { a: 'abc', b: 'xyzw' },
      check: (r, c) => (r.distance === 4 ? matchesBrute(r, c) : `expected 4, got ${r.distance}`) },
    { name: 'symmetric: swapping the strings gives the same distance', input: { a: 'intention', b: 'execution' },
      check: (r) => { const back = run({ a: r.b, b: r.a }, silent); return (r.distance === 5 && back.distance === 5) || `forward ${r.distance}, backward ${back.distance}`; } },
    { name: 'preset: two swapped letters cost 2', input: { a: 'recieve', b: 'receive' },
      check: (r, c) => (r.distance === 2 ? matchesBrute(r, c) : `expected 2, got ${r.distance}`) },
    { name: 'quiz: flaw to lawn is 2', input: { a: 'flaw', b: 'lawn' },
      check: (r) => (r.distance === 2 && r.edits.join('; ') === 'delete f; insert n') || `got ${r.distance}: ${r.edits.join('; ')}` },
    { name: 'empty second string: delete everything', input: { a: 'abc', b: '' },
      check: (r, c) => (r.distance === 3 && r.rows === 4 && r.cols === 1 && c['cells filled'] === 4 && replay(r) === true) || `got ${r.distance}` },
    { name: 'both strings empty', input: { a: '', b: '' },
      check: (r, c) => (r.distance === 0 && c['cells filled'] === 1) || `got ${r.distance}` },
    { name: 'identical strings: distance 0 and (m + 1)(n + 1) cells', input: { a: 'banana', b: 'banana' },
      check: (r, c) => (r.distance === 0 && c['cells filled'] === 49 && r.script.every((s) => s.op === 'keep')) || `got ${r.distance}` },
  ],
};
