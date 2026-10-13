import { makeRng } from '../../js/lib/rng.js';

const show = (ch) => (ch === ' ' ? '␣' : ch);

function run(input, t) {
  const A = Array.from(String(input.a ?? '')), B = Array.from(String(input.b ?? ''));
  const m = A.length, n = B.length;
  const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(null));
  const q = (arr, k) => (k === 0 ? 'nothing' : `"${arr.slice(0, k).join('')}"`);
  const tableLegend = [{ label: 'cell being filled', role: 'current' }, { label: 'cells it reads', role: 'compare' }, { label: 'traceback path', role: 'path' }];
  const tableView = (roles) => ({
    kind: 'table', corner: '', legend: tableLegend,
    title: 'Each cell: length of the longest common subsequence of the letters down the side so far and the letters along the top so far',
    colLabels: ['∅', ...B.map(show)], rowLabels: ['∅', ...A.map(show)],
    cells: L.map((row) => row.map((v) => (v === null ? '' : v))), roles,
  });
  const prefixView = (i, j) => ({
    kind: 'rows', title: 'The beginnings of the two strings that this cell compares',
    rows: [
      { label: 'First', cells: A.map((ch, k) => ({ t: show(ch), role: k === i - 1 ? 'current' : k < i ? 'visited' : 'dim' })) },
      { label: 'Second', cells: B.map((ch, k) => ({ t: show(ch), role: k === j - 1 ? 'current' : k < j ? 'visited' : 'dim' })) },
    ],
  });

  t.frame(() => ({ line: 0, note: `Find the longest list of letters that appears in both **${q(A, m)}** and **${q(B, n)}** in the same order, not necessarily side by side. The table has a row for each letter of the first string and a column for each letter of the second. The extra row and column marked ∅ stand for "no letters yet".`, views: [tableView({}), prefixView(0, 0)], vars: { m, n } }));

  for (let i = 0; i <= m; i++) { L[i][0] = 0; t.count('cells filled'); }
  for (let j = 1; j <= n; j++) { L[0][j] = 0; t.count('cells filled'); }
  t.frame(() => {
    const roles = {};
    for (let i = 0; i <= m; i++) roles[`${i},0`] = 'current';
    for (let j = 0; j <= n; j++) roles[`0,${j}`] = 'current';
    return { line: [1, 2, 3, 4], note: `With no letters taken from one of the strings, nothing can be shared, so the first row and the first column are all 0.`, views: [tableView(roles), prefixView(0, 0)], vars: { m, n } };
  });

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const same = A[i - 1] === B[j - 1];
      const diag = L[i - 1][j - 1], up = L[i - 1][j], left = L[i][j - 1];
      const v = same ? diag + 1 : Math.max(up, left);
      L[i][j] = v;
      t.count('cells filled');
      t.frame(() => ({ line: same ? [7, 8] : [9, 10, 11],
        note: same
          ? `Compare ${q(A, i)} with ${q(B, j)}. The last letters match (both **${show(A[i - 1])}**), so the shared list can end with that letter: take the diagonal cell (${diag}) and add 1 to get **${v}**.`
          : `Compare ${q(A, i)} with ${q(B, j)}. The last letters, **${show(A[i - 1])}** and **${show(B[j - 1])}**, differ, so at least one of them is left out. Leaving out ${show(A[i - 1])} gives the cell above (${up}). Leaving out ${show(B[j - 1])} gives the cell to the left (${left}). Take the larger: **${v}**.`,
        views: [tableView(same ? { [`${i - 1},${j - 1}`]: 'compare', [`${i},${j}`]: 'current' } : { [`${i - 1},${j}`]: 'compare', [`${i},${j - 1}`]: 'compare', [`${i},${j}`]: 'current' }), prefixView(i, j)],
        vars: { i, j, 'a[i]': show(A[i - 1]), 'b[j]': show(B[j - 1]), 'L[i][j]': v } }));
    }
  }

  // Traceback: collect one longest common subsequence, last letter first.
  const steps = [];
  const keptA = new Set(), keptB = new Set();
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (A[i - 1] === B[j - 1]) { steps.push({ move: 'keep', i, j, ch: A[i - 1] }); i--; j--; }
    else if (L[i - 1][j] >= L[i][j - 1]) { steps.push({ move: 'up', i, j }); i--; }
    else { steps.push({ move: 'left', i, j }); j--; }
  }
  const end = { i, j };
  const length = L[m][n];
  const lcs = steps.filter((s) => s.move === 'keep').map((s) => s.ch).reverse().join('');

  const diffLegend = [{ label: 'in the common subsequence', role: 'done' }, { label: 'only in the first string (delete)', role: 'alert' }, { label: 'only in the second string (insert)', role: 'active' }, { label: 'not decided yet', role: 'dim' }];
  const diffView = (known) => {
    // Positions at or beyond the traceback's current point have been decided.
    const at = known < steps.length ? steps[known] : end;
    const done = known === steps.length;
    const roleA = (k) => (keptA.has(k) ? 'done' : done || k >= at.i ? 'alert' : 'dim');
    const roleB = (k) => (keptB.has(k) ? 'done' : done || k >= at.j ? 'active' : 'dim');
    const kept = steps.slice(0, known).filter((s) => s.move === 'keep').map((s) => s.ch).reverse();
    return { kind: 'rows', title: 'What the traceback has decided so far', legend: diffLegend, rows: [
      { label: 'First', cells: A.map((ch, k) => ({ t: show(ch), role: roleA(k) })) },
      { label: 'Second', cells: B.map((ch, k) => ({ t: show(ch), role: roleB(k) })) },
      { label: 'Common', cells: kept.map((ch) => ({ t: show(ch), role: 'done' })) },
    ] };
  };
  const pathRoles = (count, current) => {
    const roles = { [`${m},${n}`]: 'path' };
    for (let k = 0; k < count; k++) {
      const s = steps[k];
      roles[s.move === 'keep' ? `${s.i - 1},${s.j - 1}` : s.move === 'up' ? `${s.i - 1},${s.j}` : `${s.i},${s.j - 1}`] = 'path';
    }
    if (current) roles[current] = 'current';
    return roles;
  };

  if (steps.length) {
    t.frame(() => ({ line: [12, 15], note: `The table is full. The bottom-right cell says the longest common subsequence has length **${length}**. To find its letters, walk back from that cell: on a match keep the letter and move diagonally, otherwise move towards the larger neighbour.`, views: [tableView(pathRoles(0, `${m},${n}`)), diffView(0)], vars: { i: m, j: n, length } }));
  }
  steps.forEach((s, k) => {
    if (s.move === 'keep') { keptA.add(s.i - 1); keptB.add(s.j - 1); }
    const next = s.move === 'keep' ? `${s.i - 1},${s.j - 1}` : s.move === 'up' ? `${s.i - 1},${s.j}` : `${s.i},${s.j - 1}`;
    const note = s.move === 'keep' ? `The letters at this cell match: **${show(s.ch)}** is part of the common subsequence. Keep it and move diagonally.`
      : s.move === 'up' ? `**${show(A[s.i - 1])}** and **${show(B[s.j - 1])}** differ. The cell above (${L[s.i - 1][s.j]}) is at least as large as the cell to the left (${L[s.i][s.j - 1]}), so move up: this ${show(A[s.i - 1])} of the first string is not used.`
      : `**${show(A[s.i - 1])}** and **${show(B[s.j - 1])}** differ. The cell to the left (${L[s.i][s.j - 1]}) is larger than the cell above (${L[s.i - 1][s.j]}), so move left: this ${show(B[s.j - 1])} of the second string is not used.`;
    t.frame(() => ({ line: s.move === 'keep' ? [16, 17, 18] : [16, 19, 20], note, views: [tableView(pathRoles(k + 1, next)), diffView(k + 1)], vars: { i: s.move === 'left' ? s.i : s.i - 1, j: s.move === 'up' ? s.j : s.j - 1, kept: steps.slice(0, k + 1).filter((x) => x.move === 'keep').length } }));
  });
  const indel = m + n - 2 * length;
  t.frame(() => ({ line: 21, note: length === 0
    ? `The two strings share no letters, so the longest common subsequence is empty, with length **0**. Turning one into the other by insertions and deletions alone takes all ${indel} letters.`
    : `A longest common subsequence is **"${lcs}"**, of length **${length}**. Everything outside it is the difference: ${m - length} letter${m - length === 1 ? '' : 's'} to delete from the first string and ${n - length} to insert from the second, ${indel} change${indel === 1 ? '' : 's'} in all.`,
    views: [tableView(pathRoles(steps.length, null)), diffView(steps.length)], vars: { length, rows: m + 1, columns: n + 1 } }));

  return { length, score: length, lcs, rows: m + 1, cols: n + 1, a: A.join(''), b: B.join(''), table: L, indelDistance: indel };
}

// Independent references for the tests. None of them uses a table.
const isSubsequence = (s, text) => { let k = 0; for (const ch of text) if (k < s.length && ch === s[k]) k++; return k === s.length; };
// Longest common subsequence length by trying every subset of the letters of a.
function bruteLcs(a, b) {
  const A = Array.from(a), B = Array.from(b);
  let best = 0;
  for (let mask = 0; mask < (1 << A.length); mask++) {
    const pick = A.filter((_, k) => mask & (1 << k));
    if (pick.length > best && isSubsequence(pick, B)) best = pick.length;
  }
  return best;
}
// Fewest insertions and deletions turning a into b, straight from the definition.
function bruteIndel(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (a[0] === b[0]) return bruteIndel(a.slice(1), b.slice(1));
  return 1 + Math.min(bruteIndel(a.slice(1), b), bruteIndel(a, b.slice(1)));
}
const matchesBrute = (r, c) => {
  const ref = bruteLcs(r.a, r.b);
  if (r.length !== ref) return `length ${r.length}, brute force says ${ref}`;
  if (Array.from(r.lcs).length !== r.length) return `reported "${r.lcs}" does not have length ${r.length}`;
  if (!isSubsequence(Array.from(r.lcs), Array.from(r.a)) || !isSubsequence(Array.from(r.lcs), Array.from(r.b))) return `"${r.lcs}" is not a subsequence of both strings`;
  if (c['cells filled'] !== r.rows * r.cols) return `filled ${c['cells filled']} cells in a ${r.rows} by ${r.cols} table`;
  return true;
};
const identityHolds = (r) => {
  const d = bruteIndel(Array.from(r.a), Array.from(r.b));
  const viaLcs = Array.from(r.a).length + Array.from(r.b).length - 2 * r.length;
  return (d === viaLcs && r.indelDistance === d) || `insert/delete distance is ${d}, but |a| + |b| - 2 LCS gives ${viaLcs}`;
};

export default {
  meta: {
    id: 'lcs',
    name: 'Longest Common Subsequence',
    aliases: ['LCS', 'longest common subsequence problem', 'diff', 'common subsequence'],
    kind: 'algorithm',
    discipline: 'nlp',
    alsoIn: [
      { id: 'biology', why: 'The letters two DNA or protein sequences share in order is the simplest measure of their similarity, and the starting point for scored alignment.' },
      { id: 'algorithms', why: 'It is a standard textbook example of two-dimensional dynamic programming with traceback.' },
    ],
    subfield: 'String similarity',
    family: 'Sequence comparison',
    lab: 'dynamic-programming',
    compareGroup: 'sequence-comparison',
    summary: 'Finds the longest sequence of characters that appears in two strings in the same order, by filling a table over all pairs of prefixes and tracing back.',
    difficulty: 'intermediate',
    order: 310,
    paradigms: ['dynamic-programming'],
    randomized: false,
    approximate: false,
    time: { best: 'O(mn)', average: 'O(mn)', worst: 'O(mn)', class: 'quadratic' },
    space: { worst: 'O(mn) with traceback; O(min(m, n)) for the length alone', class: 'quadratic' },
    tags: {
      problems: ['what do two texts have in common', 'compare two versions of a file', 'show what changed', 'diff two documents', 'longest shared sequence'],
      techniques: ['table filling', 'traceback', 'prefix subproblems'],
      applications: ['natural language', 'bioinformatics', 'data processing', 'compilers'],
    },
    prerequisites: ['fibonacci-dp', 'concept:dynamic-programming', 'concept:recurrence', 'concept:optimal-substructure', 'concept:matrix'],
  },

  bigIdea: {
    simple: "The longest common subsequence is the longest list of letters that appears in two pieces of text in the same order. The letters do not have to sit next to each other. Take STONE and LONGEST. Cross out letters from each word until what is left is the same in both. The most you can keep is ONE. That shared part is what the two texts have in common, and everything outside it is what changed. This is how a computer shows the difference between two versions of a document. It finds the lines that both versions share, in order, and marks the rest as removed or added. Trying every way of crossing out letters would take far too long. So the method fills in a grid. Each square answers the question for the first few letters of each word, using the answers in the squares beside it. The last square gives the answer for the whole words.",
    what: 'A **subsequence** of a string is what remains after deleting any of its characters without reordering the rest. The longest common subsequence (LCS) of two strings is the longest string that is a subsequence of both. The algorithm fills a table in which cell (i, j) holds the LCS length of the first i characters of one string and the first j characters of the other, then walks back through the table to read off the characters.',
    why: 'Comparing two sequences is mostly a matter of deciding which parts correspond. The LCS is the largest set of characters that can be paired up without any crossing pairs. Once that pairing is known, everything unpaired is the difference, which is exactly what a file comparison tool needs to report.',
    when: 'Use it when the only sensible changes are insertions and deletions, as with lines of a file, or when you want to know what two sequences share and not just how far apart they are. If replacing one character by another should count as a single change, use [edit distance](#/algorithm/edit-distance). If matches and gaps need different scores, use [Needleman-Wunsch](#/algorithm/needleman-wunsch).',
    interesting: 'The LCS and the edit distance are two views of one table. If only insertions and deletions are allowed, the distance between two strings is the sum of their lengths minus twice the LCS length. Maximizing what is shared and minimizing what is changed are the same problem.',
    where: 'File comparison tools such as `diff` and the comparison views of version control systems, three-way merging, evaluation of machine-written summaries (the ROUGE-L score), and as the simplest form of biological sequence alignment.',
    analogy: {
      title: 'Two playlists with songs in common',
      text: 'Two friends each have a playlist. They want to listen together to as many songs as possible, playing them in an order that respects both lists. Each may skip songs, but neither may go backwards. The longest such run of shared songs is the longest common subsequence of the two playlists. The songs skipped on one list are deletions, and the songs skipped on the other are insertions.',
      limits: 'A playlist rarely contains the same song twice, and without repeats the problem is easier. Text repeats letters constantly, and each copy could be paired with any copy in the other string. The choice matters, because pairing one letter rules out pairings that would cross it. That is why the table is needed. Also, there is often more than one longest common subsequence, and the algorithm reports just one of them.',
    },
  },

  example: {
    setup: 'Find the longest common subsequence of TEA and EAT: the longest list of letters found in both words in the same order, not necessarily side by side. Draw a grid with T, E, A down the side and E, A, T along the top. Add an extra row and column of zeros at the start for "no letters yet". Each square will hold the length of the longest shared list for the letters so far.',
    steps: [
      'Row for T. T against E: different, so take the larger of the square above (0) and the square to the left (0), which is 0. T against A: 0 again. T against T: a match, so take the diagonal square (0) and add 1, giving 1.',
      'Row for E. E against E: a match, diagonal 0 plus 1 is 1. E against A: different, the larger of above (0) and left (1) is 1. E against T: different, the larger of above (1) and left (1) is 1.',
      'Row for A. A against E: different, the larger of above (1) and left (0) is 1. A against A: a match, diagonal 1 plus 1 is 2. A against T: different, the larger of above (1) and left (2) is 2.',
      'The bottom-right square says 2. To find the letters, walk back from it. A and T differ and the square to the left is larger, so move left. Now A and A match: keep A and move diagonally. Then E and E match: keep E.',
    ],
    result: 'The longest common subsequence is EA, with length 2. Everything outside it is the difference: delete the T at the front of TEA and insert a T at the end. That is 3 + 3 − 2 × 2 = 2 changes, the same number the edit distance lesson finds for this pair.',
    tryInput: { a: 'tea', b: 'eat' },
  },

  terms: [
    { term: 'String', meaning: 'A sequence of characters, such as a word, a line of text or a stretch of DNA.' },
    { term: 'Subsequence', meaning: 'What is left of a string after crossing out any of its characters and keeping the rest in order. ACE is a subsequence of ABCDE.' },
    { term: 'Substring', meaning: 'A run of characters that sit next to each other in a string. BCD is a substring of ABCDE, and ACE is not.' },
    { term: 'Common subsequence', meaning: 'A string that is a subsequence of both of two given strings.' },
    { term: 'Prefix', meaning: 'The beginning of a string, up to some position.' },
    { term: 'Table', meaning: 'A grid with one cell for every pair of prefixes, filled so that each answer is ready before it is needed.' },
    { term: 'Traceback', meaning: 'Walking backwards through the finished table to recover the letters of the answer, not just its length.' },
    { term: 'Diff', meaning: 'A listing of what was removed and what was added between two versions of a text.' },
  ],

  takeaway: 'What two texts share, in order, is found by comparing all their beginnings first: on a match extend the shared part by one, otherwise carry forward the better of two smaller answers.',

  viz: {
    describe: 'A table with the first string down the left side and the second string along the top, plus a row and column of zeros marked with an empty-set sign. Each cell holds the length of the longest common subsequence of the two prefixes it stands for. The cell being filled is terracotta and the cells it reads are ochre: the diagonal cell on a match, the cells above and to the left otherwise. After the table is full, a forest green path runs back from the bottom-right cell. Beneath the table, the two strings are shown as rows of letters. During the traceback the letters of the common subsequence turn forest green, letters only in the first string turn brick red, and letters only in the second turn terracotta.',
    inputs: [
      { id: 'a', type: 'text', label: 'First string', default: 'stone', maxLength: 14, help: 'Up to 14 characters. Upper and lower case count as different letters.' },
      { id: 'b', type: 'text', label: 'Second string', default: 'longest', maxLength: 14 },
    ],
    presets: [
      { label: 'stone and longest', values: { a: 'stone', b: 'longest' } },
      { label: 'Worked example: tea and eat', values: { a: 'tea', b: 'eat' } },
      { label: 'Not next to each other', values: { a: 'ace', b: 'abcde' } },
      { label: 'Textbook example', values: { a: 'ABCBDAB', b: 'BDCABA' } },
      { label: 'sunday and saturday', values: { a: 'sunday', b: 'saturday' } },
      { label: 'Nothing in common', values: { a: 'abc', b: 'xyz' } },
    ],
    tryThis: [
      'Load "Not next to each other". All of "ace" is found inside "abcde" although its letters are separated there. A subsequence may skip letters. A substring may not.',
      'Load "Textbook example" and step through the traceback. The answer shown is BCBA, but BDAB and BCAB are also common subsequences of length 4. Ties in the table are where the alternatives branch off.',
      'Load "sunday and saturday". The common subsequence has 5 letters, so insertions and deletions alone need 6 + 8 − 2 × 5 = 4 changes. The edit distance lesson gets 3 for the same pair, because it may substitute one letter for another.',
      'Type "character" as the first string and the same word backwards, "retcarahc", as the second. The result has length 5. Comparing a word with its own reverse always gives the length of the longest subsequence of the word that reads the same in both directions, here "carac".',
    ],
    run,
    report: (r, c) => `Longest common subsequence of "${r.a}" and "${r.b}": "${r.lcs}" (length ${r.length})\nTable: ${r.rows} rows by ${r.cols} columns, ${c['cells filled'] || 0} cells filled.\nInsertions and deletions needed to turn the first into the second: ${r.indelDistance}.`,
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
    intuition: 'Look at the last character of each string. If they are equal, some longest common subsequence ends with that character, paired with itself, so the answer is one more than the answer for both strings with their last characters removed. If they differ, they cannot both be the end of the common subsequence, so at least one of them can be dropped: the answer is the better of dropping the last character of the first string or of the second. Either way the problem shrinks to prefixes, and every pair of prefixes fits in a table.',
    steps: [
      'Let m and n be the lengths of the strings a and b. Make a table L with rows 0 to m and columns 0 to n. L[i][j] will be the LCS length of the first i characters of a and the first j characters of b. The pseudocode numbers characters from 1.',
      'Set row 0 and column 0 to zero: an empty prefix shares nothing with anything.',
      'Visit the remaining cells row by row. Each cell looks at up to three neighbours: the diagonal cell L[i−1][j−1], the cell above L[i−1][j], and the cell to the left L[i][j−1]. If a[i] equals b[j], set L[i][j] to the diagonal cell plus 1.',
      'Otherwise set L[i][j] to the larger of the cell above and the cell to the left.',
      'When the table is full, L[m][n] is the length of the longest common subsequence.',
      'To recover the characters, start at (m, n). If the two characters there match, record the character and move diagonally. Otherwise move to whichever of the cell above and the cell to the left is larger. Stop at row 0 or column 0 and reverse what was recorded.',
    ],
    pseudocode: [
      'lcs(a, b):',
      '  for i from 0 to m:',
      '    L[i][0] ← 0',
      '  for j from 0 to n:',
      '    L[0][j] ← 0',
      '  for i from 1 to m:',
      '    for j from 1 to n:',
      '      if a[i] = b[j]:',
      '        L[i][j] ← diagonal + 1',
      '      else:',
      '        L[i][j] ← larger of',
      '          above and left',
      '  return L[m][n]',
      '',
      'traceback(L):',
      '  (i, j) ← (m, n)',
      '  while i > 0 and j > 0:',
      '    if a[i] = b[j]:',
      '      keep a[i], go diagonally',
      '    else: go up or left,',
      '      to the larger cell',
      '  return kept, reversed',
    ],
    decisions: [
      { title: 'On a match, why not also check the cells above and to the left?', text: 'It is never necessary. Pairing two equal last characters is always at least as good as leaving one of them out, so the diagonal plus 1 is already the maximum.' },
      { title: 'Which way on a tie?', text: 'When the cell above and the cell to the left are equal, either move leads to a longest common subsequence, possibly a different one. This page moves up. Diff tools make this choice carefully, because it decides which of several equally short diffs the user sees.' },
      { title: 'Characters or lines?', text: 'The algorithm only needs to test two items for equality. File comparison tools apply it to whole lines, treating each line as one symbol, which is why they report changed lines and not changed letters.' },
      { title: 'Keep the whole table?', text: 'The length needs only the previous row. The traceback needs the whole table, unless Hirschberg\'s divide-and-conquer method is used to recover the subsequence in linear space.' },
    ],
    invariants: [
      'After a cell is filled, `L[i][j]` is the LCS length of the first i characters of a and the first j characters of b.',
      'Values never decrease along a row or down a column, and neighbouring cells differ by at most 1.',
      'During the traceback, the letters kept so far plus `L[i][j]` always equals `L[m][n]`.',
    ],
    edgeCases: [
      'An empty string: the LCS is empty and only the border is filled.',
      'Identical strings: the LCS is the whole string and the path follows the diagonal.',
      'No characters in common: every cell is 0.',
      'Many repeated characters: there can be exponentially many different longest common subsequences. The algorithm returns one.',
      'Case and whitespace: "A" and "a" differ unless the text is normalized first. Diff tools offer options to ignore case or spacing for this reason.',
    ],
    correctness: 'By induction on i + j. Let X and Y be the two prefixes and Z a longest common subsequence of them. If the last characters of X and Y are equal, Z can be assumed to end with that character paired with itself: if Z did not use both last characters, the pairing could be changed to use them without making Z shorter. Removing that character leaves a longest common subsequence of the two shorter prefixes, so the length is the diagonal value plus 1. If the last characters differ, Z cannot end with both, so Z is a common subsequence of X without its last character and Y, or of X and Y without its last character. It is therefore no longer than the larger of the two neighbouring values, and each of those values is achieved by some common subsequence of X and Y.',
    mistakes: [
      'Confusing subsequence with substring. The longest common substring needs a different recurrence, in which a mismatch resets the cell to 0.',
      'Indexing the strings with the table index: cell (i, j) compares `a[i − 1]` and `b[j − 1]` in zero-based code.',
      'Tracing back by comparing table values only, without checking that the characters match before moving diagonally.',
      'Forgetting to reverse the collected characters, which are found last to first.',
    ],
  },

  code: {
    sample: {
      input: 'Three pairs of strings: (stone, longest), (ABCBDAB, BDCABA) and (sunday, saturday). For each, one longest common subsequence, its length, and the number of insertions and deletions separating the pair.',
      expected: 'stone / longest: one, length 3, 6 insertions and deletions apart\nABCBDAB / BDCABA: BCBA, length 4, 5 insertions and deletions apart\nsunday / saturday: suday, length 5, 4 insertions and deletions apart',
    },
    python: {
      source: `def lcs_table(a, b):
    m, n = len(a), len(b)
    L = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                L[i][j] = L[i - 1][j - 1] + 1
            else:
                L[i][j] = max(L[i - 1][j], L[i][j - 1])
    return L


def lcs_string(a, b, L):
    i, j = len(a), len(b)
    kept = []
    while i > 0 and j > 0:
        if a[i - 1] == b[j - 1]:
            kept.append(a[i - 1])
            i, j = i - 1, j - 1
        elif L[i - 1][j] >= L[i][j - 1]:
            i -= 1
        else:
            j -= 1
    return "".join(reversed(kept))


for a, b in [("stone", "longest"), ("ABCBDAB", "BDCABA"), ("sunday", "saturday")]:
    L = lcs_table(a, b)
    length = L[len(a)][len(b)]
    changes = len(a) + len(b) - 2 * length
    print(a + " / " + b + ": " + lcs_string(a, b, L) + ", length " + str(length)
          + ", " + str(changes) + " insertions and deletions apart")`,
      notes: [
        { line: 3, text: 'Creating the table full of zeros also sets the first row and column, which must be 0.' },
        { line: 7, text: 'A match extends the best answer for the two shorter prefixes by one character.' },
        { line: 9, text: 'On a mismatch at least one of the two last characters is unused, so carry forward the better of the two neighbouring answers.' },
        { line: 17, text: 'The traceback tests the characters, not the numbers, to decide whether this cell contributed a letter.' },
        { line: 30, text: 'The identity that links LCS to edit distance: every character outside the common subsequence is one deletion or one insertion.' },
      ],
    },
    javascript: {
      source: `function lcsTable(a, b) {
  const m = a.length, n = b.length;
  const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        L[i][j] = L[i - 1][j - 1] + 1;
      } else {
        L[i][j] = Math.max(L[i - 1][j], L[i][j - 1]);
      }
    }
  }
  return L;
}

function lcsString(a, b, L) {
  let i = a.length, j = b.length;
  const kept = [];
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      kept.push(a[i - 1]);
      i--; j--;
    } else if (L[i - 1][j] >= L[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return kept.reverse().join("");
}

for (const [a, b] of [["stone", "longest"], ["ABCBDAB", "BDCABA"], ["sunday", "saturday"]]) {
  const L = lcsTable(a, b);
  const length = L[a.length][b.length];
  const changes = a.length + b.length - 2 * length;
  console.log(a + " / " + b + ": " + lcsString(a, b, L) + ", length " + length
    + ", " + changes + " insertions and deletions apart");
}`,
    },
    cpp: {
      source: `#include <algorithm>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

using Table = std::vector<std::vector<int>>;

Table lcsTable(const std::string& a, const std::string& b) {
    int m = a.size(), n = b.size();
    Table L(m + 1, std::vector<int>(n + 1, 0));
    for (int i = 1; i <= m; ++i) {
        for (int j = 1; j <= n; ++j) {
            if (a[i - 1] == b[j - 1]) {
                L[i][j] = L[i - 1][j - 1] + 1;
            } else {
                L[i][j] = std::max(L[i - 1][j], L[i][j - 1]);
            }
        }
    }
    return L;
}

std::string lcsString(const std::string& a, const std::string& b, const Table& L) {
    int i = a.size(), j = b.size();
    std::string kept;
    while (i > 0 && j > 0) {
        if (a[i - 1] == b[j - 1]) {
            kept.push_back(a[i - 1]);
            --i; --j;
        } else if (L[i - 1][j] >= L[i][j - 1]) {
            --i;
        } else {
            --j;
        }
    }
    std::reverse(kept.begin(), kept.end());
    return kept;
}

int main() {
    std::vector<std::pair<std::string, std::string>> pairs = {
        {"stone", "longest"}, {"ABCBDAB", "BDCABA"}, {"sunday", "saturday"}};
    for (const auto& [a, b] : pairs) {
        Table L = lcsTable(a, b);
        int length = L[a.size()][b.size()];
        int changes = static_cast<int>(a.size() + b.size()) - 2 * length;
        std::cout << a << " / " << b << ": " << lcsString(a, b, L) << ", length " << length
                  << ", " << changes << " insertions and deletions apart\\n";
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The table has (m + 1) × (n + 1) cells and each takes one comparison and at most one maximum of two numbers. The time is proportional to m × n for every input. The traceback adds at most m + n steps.',
    cases: [
      { case: 'Every input', time: 'Θ(mn)', when: 'The whole table is filled regardless of the content of the strings.' },
      { case: 'Traceback', time: 'O(m + n)', when: 'Each step moves at least one row up or one column left.' },
      { case: 'Similar inputs, different algorithm', time: 'O((m + n) D)', when: 'Myers\'s algorithm, where D is the number of insertions and deletions separating the inputs. This is what most diff tools run, because versions of a file are usually close.' },
    ],
    space: 'Θ(mn) for the full table, which the simple traceback needs. The length alone needs two rows, O(min(m, n)). Hirschberg\'s method recovers the subsequence itself in O(m + n) space.',
    memory: 'Comparing two files of 100,000 lines each with the plain table would need ten billion cells. Practical tools avoid ever building it, either by working in linear space or by exploring only the part of the table near the diagonal.',
    tradeoffs: 'The full table is simple and gives the answer for every pair of prefixes at once, at quadratic cost. Algorithms tuned for similar inputs are far faster on the typical diff workload but no better in the worst case. Under a widely believed conjecture in complexity theory, no algorithm is substantially faster than quadratic on all inputs.',
    assumptions: [
      'Testing two characters (or two lines) for equality takes constant time. Diff tools usually hash each line first so that this holds.',
      'The strings are in memory and can be indexed by position.',
      'The chart on this page counts table cells written, including the first row and column, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Showing what changed between two versions when changes are insertions and deletions of whole items.',
      'Any pair of sequences whose items can only be tested for equality: characters, lines, words, tokens.',
      'Explaining its answer: the traceback gives the exact pairing of positions.',
    ],
    struggles: [
      'Long, unrelated inputs, where the quadratic table is too large and too slow.',
      'Changes that are really substitutions or moves. A changed word shows up as one deletion plus one insertion, and a moved block as a deletion in one place and an insertion in another.',
      'More than two sequences. The table gains a dimension for each, and for an unbounded number of sequences the problem is NP-hard.',
    ],
    pitfalls: [
      'Reporting "the" LCS when there are several. Different tie-breaking gives different, equally valid answers.',
      'Running character-level LCS on long texts when line-level or word-level comparison was wanted.',
      'Using LCS length as a similarity score without dividing by the string lengths.',
    ],
    misunderstandings: [
      '"The common letters have to be next to each other." That is the longest common substring, a different problem. A subsequence may skip letters as long as the order is kept.',
      '"There is one longest common subsequence." There can be many of the same length. ABCBDAB and BDCABA have three: BCBA, BDAB and BCAB.',
      '"LCS and edit distance measure different things." With only insertions and deletions allowed they are the same measurement: the distance is the two lengths added together minus twice the LCS length.',
      '"A diff tool tells you what the author did." It reports a shortest list of insertions and deletions that explains the two versions. The author may have made the change in a completely different way.',
    ],
    constraints: [
      'Diff tools must respond quickly on large files, so they use algorithms whose cost depends on the size of the difference, and some fall back to heuristics when the difference is large.',
      'Readable output matters as much as minimal output. Tools post-process a diff to align it with line and block boundaries.',
    ],
    alternatives: [
      { id: 'edit-distance', name: 'Edit Distance (Levenshtein)', when: 'Replacing one character by another should count as one change.' },
      { id: 'needleman-wunsch', name: 'Needleman-Wunsch Alignment', when: 'Matches, mismatches and gaps should have different scores, as in biology.' },
      { name: 'Myers\'s O(ND) diff algorithm', when: 'The two inputs are similar, as with successive versions of a file. It computes the same result much faster in that case.' },
      { name: 'Longest common substring', when: 'The shared part must be contiguous.' },
    ],
    comparison: {
      columns: ['', 'LCS', 'Edit distance', 'Needleman-Wunsch'],
      rows: [
        ['Optimizes', 'Most characters shared', 'Fewest edits', 'Highest alignment score'],
        ['Substitution', 'Not allowed (delete + insert)', 'One edit', 'Scored as a mismatch'],
        ['Cell rule', 'Match: diagonal + 1. Else: max of up, left', 'Min of three neighbours plus cost', 'Max of three neighbours plus score'],
        ['Border', 'All zeros', '0, 1, 2, ...', 'Multiples of the gap score'],
        ['Time and space', 'O(mn)', 'O(mn)', 'O(mn)'],
      ],
    },
  },

  applications: [
    { title: 'File comparison (diff)', status: 'established', text: 'The Unix `diff` program, written by James Hunt and Douglas McIlroy in the 1970s, compares two files by finding a longest common subsequence of their lines and reporting the lines outside it. Current tools, including GNU diff and Git, use Eugene Myers\'s 1986 algorithm, which solves the same problem faster when the files are similar.' },
    { title: 'Version control and merging', status: 'established', text: 'Version control systems store and display changes as diffs, and a three-way merge compares each of two edited versions with their common ancestor to decide which changes can be combined automatically.' },
    { title: 'Scoring machine-written summaries', status: 'established', text: 'The ROUGE-L measure, widely used to evaluate automatic summarization, scores a generated summary by the length of its longest common subsequence of words with a reference summary.' },
    { title: 'Comparing biological sequences', status: 'established', text: 'The LCS of two DNA or protein sequences is alignment in its simplest form: score 1 for a match and 0 for everything else. Practical tools use richer scoring, as in [Needleman-Wunsch](#/algorithm/needleman-wunsch).' },
    { title: 'Spotting reused text', status: 'illustrative', text: 'A long common subsequence of words between two documents, relative to their lengths, suggests that one was derived from the other even if words were inserted or removed along the way.' },
  ],

  connections: [
    { to: 'fibonacci-dp', type: 'prerequisite', why: 'Both store each subproblem\'s answer once and build later answers from earlier ones. LCS extends the idea to a two-dimensional table with a decision in each cell.' },
    { to: 'concept:dynamic-programming', type: 'prerequisite', why: 'The table over pairs of prefixes, filled in an order that respects dependencies, is the paradigm in its standard two-dimensional form.' },
    { to: 'concept:optimal-substructure', type: 'prerequisite', why: 'A longest common subsequence with its last character removed is a longest common subsequence of shorter prefixes. That is what justifies building answers from neighbouring cells.' },
    { to: 'concept:overlapping-subproblems', type: 'prerequisite', why: 'The recursive definition reaches the same pair of prefixes by many routes. The table computes each pair once.' },
    { to: 'concept:recurrence', type: 'prerequisite', why: 'The cell rule is a recurrence in two indices, with the zero border as its base case.' },
    { to: 'edit-distance', type: 'same-problem', why: 'With substitutions forbidden, edit distance equals the two lengths added together minus twice the LCS length. Both tables are filled from the same three neighbours in the same order.' },
    { to: 'needleman-wunsch', type: 'variant', why: 'Global alignment with score 1 for a match and 0 for mismatches and gaps has the LCS length as its optimal score. Needleman-Wunsch generalizes the scoring.' },
    { to: 'dijkstra', type: 'related', why: 'The LCS is a best path through a grid graph in which diagonal edges at matching characters are worth 1. Both algorithms finish nodes in an order that makes each value final when it is computed. Dijkstra needs a priority queue to discover that order; in the grid, row order is known in advance.' },
    { to: 'bellman-ford', type: 'related', why: 'Both apply Bellman\'s principle that a best solution is built from best solutions to smaller problems. Bellman-Ford grows paths by one edge per round; the LCS table grows prefixes by one character per row or column.' },
    { to: 'knapsack', type: 'related', why: 'Another table where each cell is the better of "use this item" and "skip it", followed by a traceback that reads the decisions back out.' },
    { to: 'huffman-coding', type: 'related', why: 'Diffs and compression both shrink data by exploiting what is already known: a diff stores only what differs from an earlier version, and a code stores common symbols in fewer bits.' },
    { to: 'discipline:biology', type: 'application', why: 'Related genes and proteins keep long common subsequences after mutations insert, delete and change individual symbols, so shared order is evidence of shared ancestry.' },
    { to: 'discipline:nlp', type: 'application', why: 'Word-level LCS underlies evaluation measures for generated text and tools that align two versions of a sentence.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Which of these is a subsequence of "ABCDE" but not a substring of it?',
      options: ['BCD', 'ACE', 'EDC', 'ABCDE'],
      answer: 1,
      explain: [
        'BCD is a substring: its letters are next to each other. Every substring is also a subsequence, so this does not fit "but not a substring".',
        'Correct. A, C and E appear in that order, but with letters skipped between them.',
        'EDC has the letters in the wrong order, so it is neither.',
        'The whole string is both a substring and a subsequence of itself.',
      ],
    },
    {
      type: 'predict',
      q: 'How long is the longest common subsequence of "sunday" and "saturday"?',
      options: ['3', '4', '5', '6'],
      answer: 2,
      explain: [
        'There is a longer one. Try starting with the s and ending with "day".',
        'Close. "sday" has 4 letters, but one more letter fits.',
        'Correct. "suday" appears in both in order: s, then u, then d, a, y.',
        'Six would need all of "sunday" to appear inside "saturday", but saturday has no n.',
      ],
      tryInput: { a: 'sunday', b: 'saturday' },
    },
    {
      type: 'debug',
      q: 'This traceback sometimes returns a string that is too short, or keeps letters that do not match. Which line is wrong?',
      code: `def lcs_string(a, b, L):
    i, j = len(a), len(b)
    kept = []
    while i > 0 and j > 0:
        if L[i][j] == L[i - 1][j - 1] + 1:
            kept.append(a[i - 1])
            i, j = i - 1, j - 1
        elif L[i - 1][j] >= L[i][j - 1]:
            i -= 1
        else:
            j -= 1
    return "".join(reversed(kept))`,
      options: ['Line 4: the loop should continue until both i and j are 0', 'Line 5: it should test whether a[i - 1] equals b[j - 1]', 'Line 8: it should use > in place of >=', 'Line 12: the letters should not be reversed'],
      answer: 1,
      explain: [
        'Once i or j reaches 0 the remaining value is 0 and no more letters can be found, so stopping there is right.',
        'Correct. A cell can be one more than its diagonal neighbour without the two characters matching, because the value may have come from above or from the left. The characters themselves must be compared.',
        'Either comparison is valid. It only changes which of several longest common subsequences is returned.',
        'The letters are collected last to first, so they do need reversing.',
      ],
    },
    {
      type: 'choice',
      q: 'Two strings have lengths 10 and 12, and their longest common subsequence has length 7. Using only insertions and deletions, how many changes turn the first into the second?',
      options: ['5', '7', '8', '15'],
      answer: 2,
      explain: [
        '5 is 12 − 7, which counts only the insertions.',
        '7 is the number of characters kept, not the number changed.',
        'Correct. Delete the 10 − 7 = 3 characters of the first string outside the common subsequence, and insert the 12 − 7 = 5 characters of the second: 10 + 12 − 2 × 7 = 8.',
        '15 is 10 + 12 − 7. The common subsequence has to be subtracted once for each string.',
      ],
    },
    {
      type: 'challenge',
      title: 'Build a tiny diff',
      prompt: 'Write a program that takes two lists of lines and prints a diff: each line prefixed with a space if it is in the longest common subsequence, with "-" if it is only in the first list, and with "+" if it is only in the second. Use the LCS table on lines instead of characters. Then make the function that computes only the length use two rows of the table instead of the whole thing.',
      hints: ['Extend the traceback: moving up emits a "-" line, moving left emits a "+" line, and moving diagonally emits an unchanged line. Do not stop when one index reaches 0; emit the remaining lines of the other list.', 'For the two-row version, the row for i depends only on the row for i − 1, so swap two arrays after each row.'],
    },
  ],

  compare: {
    idea: 'Fill a table of LCS lengths for all pairs of prefixes: diagonal plus 1 on a match, otherwise the larger of the cells above and to the left.',
    requires: 'Two sequences whose items can be tested for being the same.',
    sensitivity: 'None. The whole table is filled whatever the strings contain.',
    memory: 'O(mn) for the table with traceback, O(min(m, n)) for the length alone.',
    difficulty: 'moderate',
    difficultyNote: 'The recurrence is short. The traceback and its tie-breaking are where care is needed.',
    limits: 'Slow and memory-hungry on long inputs: twice the length means four times the work. It has no idea of a replaced item or a moved block. It returns one answer when there may be several.',
    useWhen: 'You want to know what two sequences have in common, in order, or to show what was added and removed between two versions.',
  },

  advanced: {
    history: 'The table-filling method for comparing two strings was published by Robert Wagner and Michael Fischer in 1974, in a paper on string correction that also pointed out its use for finding a longest common subsequence. In 1975 Daniel Hirschberg showed how to recover the subsequence using only linear space. The Unix `diff` program of James Hunt and Douglas McIlroy, described in a 1976 Bell Laboratories report, made the problem part of everyday programming. Hunt and Thomas Szymanski published a faster method for inputs with few matching pairs in 1977, and in 1986 Eugene Myers gave the algorithm, with running time proportional to the size of the difference, that most diff tools use today. In 2015 Amir Abboud, Arturs Backurs and Virginia Vassilevska Williams, and independently Karl Bringmann and Marvin Künnemann, showed that an algorithm substantially faster than quadratic on all inputs would contradict the Strong Exponential Time Hypothesis.',
    derivation: 'Write $\\ell(i, j)$ for the LCS length of $a_{1..i}$ and $b_{1..j}$. Then $\\ell(i, 0) = \\ell(0, j) = 0$ and, for $i, j \\ge 1$,\n\n$$\\ell(i, j) = \\begin{cases} \\ell(i-1,\\, j-1) + 1 & \\text{if } a_i = b_j \\\\ \\max\\bigl(\\ell(i-1,\\, j),\\ \\ell(i,\\, j-1)\\bigr) & \\text{otherwise.} \\end{cases}$$\n\nThe link to edit distance: let $d(i,j)$ be the fewest insertions and deletions turning $a_{1..i}$ into $b_{1..j}$. Every character of $a$ outside a common subsequence is deleted and every character of $b$ outside it is inserted, so a common subsequence of length $k$ gives a script of $i + j - 2k$ operations, and conversely the characters untouched by a script form a common subsequence. Minimizing operations is therefore the same as maximizing $k$:\n\n$$d(m, n) = m + n - 2\\,\\ell(m, n).$$',
    proof: 'Let $Z = z_1 \\dots z_k$ be a longest common subsequence of $X = a_{1..i}$ and $Y = b_{1..j}$.\n\nCase $a_i = b_j$. Then $z_k = a_i$: otherwise $Z$ followed by $a_i$ would be a longer common subsequence. Moreover $z_1 \\dots z_{k-1}$ is a common subsequence of $a_{1..i-1}$ and $b_{1..j-1}$, and it is a longest one, since a longer one extended by $a_i$ would beat $Z$. So $\\ell(i,j) = \\ell(i-1,j-1) + 1$.\n\nCase $a_i \\ne b_j$. Then $z_k$ differs from at least one of $a_i$, $b_j$. If $z_k \\ne a_i$, $Z$ is a common subsequence of $a_{1..i-1}$ and $Y$, so $k \\le \\ell(i-1, j)$. If $z_k \\ne b_j$, likewise $k \\le \\ell(i, j-1)$. Both neighbouring values are lengths of common subsequences of $X$ and $Y$, so neither exceeds $k$. Hence $\\ell(i,j)$ is their maximum.',
    complexityProof: 'There are $(m+1)(n+1)$ cells, each filled with a constant number of operations, giving $\\Theta(mn)$ time. The traceback decreases $i + j$ by at least 1 per step and stops when either index reaches 0, so it takes at most $m + n$ steps.',
    variants: [
      { name: 'Linear-space LCS (Hirschberg)', text: 'Splits the first string in half, finds where an optimal path crosses the middle row using two one-row passes, and recurses on the two halves. Linear space and still O(mn) time.' },
      { name: 'Myers\'s O(ND) algorithm', text: 'Searches outward from the main diagonal by number of differences D, stopping as soon as the end is reached. Very fast when the inputs are similar.' },
      { name: 'Hunt-Szymanski', text: 'Works from the list of matching position pairs, running in O((r + n) log n) time for r matching pairs. Fast when few positions match, as with lines of text.' },
      { name: 'Longest common substring', text: 'Requires the shared part to be contiguous. The table resets to 0 on a mismatch and the answer is the largest cell anywhere.' },
      { name: 'Longest increasing subsequence', text: 'The LCS of a sequence of distinct numbers and its sorted copy is its longest increasing subsequence.' },
      { name: 'Several sequences', text: 'With k sequences the table has k dimensions. For an arbitrary number of sequences the problem is NP-hard, as David Maier showed in 1978.' },
    ],
    implementation: 'Strip the common prefix and suffix before building the table: for versions of a file this often removes most of the input. Compare hashed lines, not raw text, and intern equal lines to small integers. Put the shorter sequence along the top. If memory is a concern, use Hirschberg\'s method or Myers\'s algorithm in its linear-space form.',
    benchmarking: 'Report both input lengths and the size of the difference. Algorithms tuned for diffs can be hundreds of times faster than the plain table on similar inputs and no faster on unrelated ones, so a benchmark on one kind of input says little about the other.',
    references: [
      { authors: 'R. A. Wagner and M. J. Fischer', year: 1974, title: 'The string-to-string correction problem', venue: 'Journal of the ACM 21(1), 168-173' },
      { authors: 'D. S. Hirschberg', year: 1975, title: 'A linear space algorithm for computing maximal common subsequences', venue: 'Communications of the ACM 18(6), 341-343' },
      { authors: 'J. W. Hunt and M. D. McIlroy', year: 1976, title: 'An algorithm for differential file comparison', venue: 'Computing Science Technical Report 41, Bell Laboratories' },
      { authors: 'J. W. Hunt and T. G. Szymanski', year: 1977, title: 'A fast algorithm for computing longest common subsequences', venue: 'Communications of the ACM 20(5), 350-353' },
      { authors: 'E. W. Myers', year: 1986, title: 'An O(ND) difference algorithm and its variations', venue: 'Algorithmica 1, 251-266' },
      { authors: 'A. Abboud, A. Backurs and V. Vassilevska Williams', year: 2015, title: 'Tight hardness results for LCS and other sequence similarity measures', venue: 'IEEE 56th Annual Symposium on Foundations of Computer Science (FOCS)' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Dynamic Programming", section "Longest common subsequence". The source of the ABCBDAB and BDCABA example.',
      'D. Gusfield, *Algorithms on Strings, Trees, and Sequences* (1997), chapters 11 and 12.',
      'C.-Y. Lin, "ROUGE: A package for automatic evaluation of summaries" (2004), for the LCS-based ROUGE-L measure.',
    ],
  },

  tests: [
    { name: 'default: stone and longest share "one"', input: { a: 'stone', b: 'longest' },
      check: (r, c) => (r.lcs === 'one' && r.length === 3 ? matchesBrute(r, c) : `got "${r.lcs}"`) },
    { name: 'worked example: tea and eat, every cell of the table', input: { a: 'tea', b: 'eat' },
      check: (r) => (r.lcs === 'ea' && r.length === 2 && r.indelDistance === 2 && JSON.stringify(r.table) === '[[0,0,0,0],[0,0,0,1],[0,1,1,1],[0,1,2,2]]') || `got "${r.lcs}" and table ${JSON.stringify(r.table)}` },
    { name: 'textbook example matches brute force over all subsets', input: { a: 'ABCBDAB', b: 'BDCABA' },
      check: (r, c) => (r.length === 4 && r.lcs === 'BCBA' && ['BDAB', 'BCAB'].every((s) => isSubsequence(Array.from(s), Array.from(r.a)) && isSubsequence(Array.from(s), Array.from(r.b))) ? matchesBrute(r, c) : `got "${r.lcs}" of length ${r.length}`) },
    { name: 'matches brute force on strings with many repeats', input: { a: 'abbabaab', b: 'babbaba' }, check: matchesBrute },
    { name: 'identity: insert/delete distance = |a| + |b| - 2 LCS (independent recursion)', input: { a: 'sunday', b: 'saturday' },
      check: (r) => (r.length === 5 && r.lcs === 'suday' && r.indelDistance === 4 ? identityHolds(r) : `got "${r.lcs}", distance ${r.indelDistance}`) },
    { name: 'identity holds on a second pair', input: { a: 'kitten', b: 'sitting' },
      check: (r, c) => (matchesBrute(r, c) === true ? identityHolds(r) : matchesBrute(r, c)) },
    { name: 'identity holds on the default pair (6 changes)', input: { a: 'stone', b: 'longest' },
      check: (r) => (r.indelDistance === 6 ? identityHolds(r) : `got ${r.indelDistance}`) },
    { name: 'a subsequence need not be contiguous', input: { a: 'ace', b: 'abcde' },
      check: (r) => (r.lcs === 'ace' && r.length === 3) || `got "${r.lcs}"` },
    { name: 'tryThis: a word against its reverse gives its longest palindromic subsequence length', input: { a: 'character', b: 'retcarahc' },
      check: (r) => (r.length === 5 && r.lcs === 'carac') || `got "${r.lcs}"` },
    { name: 'nothing in common', input: { a: 'abc', b: 'xyz' },
      check: (r, c) => (r.length === 0 && r.lcs === '' && r.indelDistance === 6 && c['cells filled'] === 16) || `got "${r.lcs}"` },
    { name: 'empty string', input: { a: '', b: 'abc' },
      check: (r, c) => (r.length === 0 && r.rows === 1 && r.cols === 4 && c['cells filled'] === 4) || `got length ${r.length}` },
    { name: 'identical strings', input: { a: 'banana', b: 'banana' },
      check: (r, c) => (r.lcs === 'banana' && r.indelDistance === 0 && c['cells filled'] === 49) || `got "${r.lcs}"` },
  ],
};
