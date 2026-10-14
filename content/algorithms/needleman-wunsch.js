import { makeRng } from '../../js/lib/rng.js';

const show = (ch) => (ch === ' ' ? '␣' : ch);
const num = (v) => (v < 0 ? `−${-v}` : String(v));
const signed = (v) => (v < 0 ? `−${-v}` : `+${v}`);
const sum = (base, delta) => `${num(base)} ${delta < 0 ? '−' : '+'} ${Math.abs(delta)} = ${num(base + delta)}`;
const COL_ROLE = { match: 'done', mismatch: 'compare', gap: 'alert' };
const plural = (k, word, many = `${word}s`) => `${k} ${k === 1 ? word : many}`;

function run(input, t) {
  const A = Array.from(String(input.a ?? '')), B = Array.from(String(input.b ?? ''));
  const m = A.length, n = B.length;
  const match = Number(input.match ?? 1), mismatch = Number(input.mismatch ?? -1), gap = Number(input.gap ?? -1);
  const S = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(null));
  const q = (arr, k) => (k === 0 ? 'nothing' : `"${arr.slice(0, k).join('')}"`);
  const tableLegend = [{ label: 'cell being filled', role: 'current' }, { label: 'the three cells it reads', role: 'compare' }, { label: 'traceback path', role: 'path' }];
  const tableView = (roles) => ({
    kind: 'table', corner: '', legend: tableLegend,
    title: 'Each cell: best score for lining up the letters down the side so far with the letters along the top so far',
    colLabels: ['∅', ...B.map(show)], rowLabels: ['∅', ...A.map(show)],
    cells: S.map((row) => row.map((v) => (v === null ? '' : num(v)))), roles,
  });
  const prefixView = (i, j) => ({
    kind: 'rows', title: 'The beginnings of the two sequences that this cell lines up',
    rows: [
      { label: 'First', cells: A.map((ch, k) => ({ t: show(ch), role: k === i - 1 ? 'current' : k < i ? 'visited' : 'dim' })) },
      { label: 'Second', cells: B.map((ch, k) => ({ t: show(ch), role: k === j - 1 ? 'current' : k < j ? 'visited' : 'dim' })) },
    ],
  });
  const params = { match: signed(match), mismatch: signed(mismatch), gap: signed(gap) };

  t.frame(() => ({ line: 0, note: `Line up **${q(A, m)}** against **${q(B, n)}** from end to end, inserting gaps where needed, to get the highest total score. A matching pair of letters scores ${signed(match)}, a mismatched pair ${signed(mismatch)}, and a letter opposite a gap ${signed(gap)}. The row and column marked ∅ stand for "no letters yet".`, views: [tableView({}), prefixView(0, 0)], vars: params }));

  S[0][0] = 0; t.count('cells filled');
  for (let i = 1; i <= m; i++) { S[i][0] = i * gap; t.count('cells filled'); }
  t.frame(() => ({ line: [1, 2], note: `First column: the first i letters of ${q(A, m)} lined up against nothing means i gaps, so the scores are multiples of ${num(gap)}, down to ${num(m * gap)}.`, views: [tableView(Object.fromEntries(S.map((_, i) => [`${i},0`, 'current']))), prefixView(m, 0)], vars: params }));
  for (let j = 1; j <= n; j++) { S[0][j] = j * gap; t.count('cells filled'); }
  t.frame(() => ({ line: [3, 4], note: `First row: the same for ${q(B, n)} against nothing. Each extra letter is one more gap, down to ${num(n * gap)}.`, views: [tableView(Object.fromEntries(S[0].map((_, j) => [`0,${j}`, 'current']))), prefixView(0, n)], vars: params }));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const same = A[i - 1] === B[j - 1];
      const p = same ? match : mismatch;
      const diag = S[i - 1][j - 1], up = S[i - 1][j], left = S[i][j - 1];
      const v = Math.max(diag + p, up + gap, left + gap);
      S[i][j] = v;
      t.count('cells filled');
      t.frame(() => ({ line: [...(same ? [7, 8] : [9, 10]), 11, 12, 13, 14],
        note: `Line up ${q(A, i)} with ${q(B, j)}. Pair **${show(A[i - 1])}** with **${show(B[j - 1])}**, a ${same ? 'match' : 'mismatch'}: diagonal ${sum(diag, p)}. Put ${show(A[i - 1])} opposite a gap: above ${sum(up, gap)}. Put ${show(B[j - 1])} opposite a gap: left ${sum(left, gap)}. The largest is **${num(v)}**.`,
        views: [tableView({ [`${i - 1},${j - 1}`]: 'compare', [`${i - 1},${j}`]: 'compare', [`${i},${j - 1}`]: 'compare', [`${i},${j}`]: 'current' }), prefixView(i, j)],
        vars: { i, j, 'a[i]': show(A[i - 1]), 'b[j]': show(B[j - 1]), 'S[i][j]': num(v) } }));
    }
  }

  // Traceback: from the bottom-right cell, step to a neighbour that explains the value.
  const steps = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = A[i - 1] === B[j - 1];
      const p = same ? match : mismatch;
      if (S[i][j] === S[i - 1][j - 1] + p) {
        steps.push({ type: same ? 'match' : 'mismatch', top: A[i - 1], bottom: B[j - 1], delta: p, i, j, pi: i - 1, pj: j - 1 });
        i--; j--;
        continue;
      }
    }
    if (i > 0 && S[i][j] === S[i - 1][j] + gap) {
      steps.push({ type: 'gap', top: A[i - 1], bottom: null, delta: gap, i, j, pi: i - 1, pj: j });
      i--;
    } else {
      steps.push({ type: 'gap', top: null, bottom: B[j - 1], delta: gap, i, j, pi: i, pj: j - 1 });
      j--;
    }
  }
  const columns = steps.slice().reverse();
  const score = S[m][n];
  const alignedA = columns.map((c) => (c.top === null ? '-' : c.top)).join('');
  const alignedB = columns.map((c) => (c.bottom === null ? '-' : c.bottom)).join('');
  const matches = columns.filter((c) => c.type === 'match').length;
  const mismatches = columns.filter((c) => c.type === 'mismatch').length;
  const gaps = columns.filter((c) => c.type === 'gap').length;

  const alignLegend = [{ label: 'match', role: 'done' }, { label: 'mismatch', role: 'compare' }, { label: 'gap', role: 'alert' }];
  const alignView = (known) => {
    const blank = columns.length - known;
    const cell = (text, k) => (k < blank ? { t: '', role: 'dim' } : { t: text, role: COL_ROLE[columns[k].type] });
    return { kind: 'rows', title: 'The alignment, read off the path from the end backwards', legend: alignLegend, rows: [
      { label: 'First', cells: columns.map((c, k) => cell(c.top === null ? '-' : show(c.top), k)) },
      { label: 'Second', cells: columns.map((c, k) => cell(c.bottom === null ? '-' : show(c.bottom), k)) },
      { label: 'Score', cells: columns.map((c, k) => cell(signed(c.delta), k)) },
    ] };
  };
  const pathRoles = (count, current) => {
    const roles = { [`${m},${n}`]: 'path' };
    for (let k = 0; k < count; k++) roles[`${steps[k].pi},${steps[k].pj}`] = 'path';
    if (current) roles[current] = 'current';
    return roles;
  };

  if (steps.length) {
    t.frame(() => ({ line: [15, 18], note: `The table is full. The bottom-right cell holds the best score for the whole sequences: **${num(score)}**. To see the alignment that earns it, walk back to the top-left corner, each time moving to a neighbour that explains the current value.`, views: [tableView(pathRoles(0, `${m},${n}`)), alignView(0)], vars: { i: m, j: n, score: num(score) } }));
  }
  steps.forEach((s, k) => {
    const v = S[s.i][s.j], prev = S[s.pi][s.pj];
    const note = s.type === 'gap'
      ? (s.bottom === null
        ? `The value ${num(v)} is the cell above (${num(prev)}) plus the gap score ${signed(gap)}: **${show(s.top)}** sits opposite a gap. Move up.`
        : `The value ${num(v)} is the cell to the left (${num(prev)}) plus the gap score ${signed(gap)}: **${show(s.bottom)}** sits opposite a gap. Move left.`)
      : `The value ${num(v)} is the diagonal cell (${num(prev)}) plus ${signed(s.delta)}: **${show(s.top)}** is paired with **${show(s.bottom)}**, a ${s.type}. Move diagonally.`;
    t.frame(() => ({ line: [19, 20, 21, 22], note, views: [tableView(pathRoles(k + 1, `${s.pi},${s.pj}`)), alignView(k + 1)], vars: { i: s.pi, j: s.pj, column: s.type } }));
  });
  t.frame(() => ({ line: 23, note: columns.length
    ? `The best global alignment scores **${num(score)}**: ${plural(matches, 'match', 'matches')} at ${signed(match)}, ${plural(mismatches, 'mismatch', 'mismatches')} at ${signed(mismatch)} and ${plural(gaps, 'gap')} at ${signed(gap)}. Other alignments may tie this score, but none beats it under these scores.`
    : `Both sequences are empty, so there is nothing to align and the score is **0**.`,
    views: [tableView(pathRoles(steps.length, null)), alignView(steps.length)], vars: { score: num(score), rows: m + 1, columns: n + 1 } }));

  return { score, rows: m + 1, cols: n + 1, a: A.join(''), b: B.join(''), alignedA, alignedB, columns: columns.map((c) => ({ type: c.type, top: c.top, bottom: c.bottom })), matches, mismatches, gaps, table: S, params: { match, mismatch, gap } };
}

// Independent references for the tests. None of them uses a table.
// Best global alignment score straight from the definition, working from the front.
function bruteScore(a, b, p) {
  if (!a.length) return b.length * p.gap;
  if (!b.length) return a.length * p.gap;
  const pair = a[0] === b[0] ? p.match : p.mismatch;
  return Math.max(pair + bruteScore(a.slice(1), b.slice(1), p), p.gap + bruteScore(a.slice(1), b, p), p.gap + bruteScore(a, b.slice(1), p));
}
const isSubsequence = (s, text) => { let k = 0; for (const ch of text) if (k < s.length && ch === s[k]) k++; return k === s.length; };
function bruteLcs(a, b) {
  const A = Array.from(a), B = Array.from(b);
  let best = 0;
  for (let mask = 0; mask < (1 << A.length); mask++) {
    const pick = A.filter((_, k) => mask & (1 << k));
    if (pick.length > best && isSubsequence(pick, B)) best = pick.length;
  }
  return best;
}
// Check that the reported alignment is a real alignment of the inputs and earns the reported score.
function alignmentIsConsistent(r) {
  const top = Array.from(r.alignedA), bottom = Array.from(r.alignedB);
  if (top.length !== bottom.length) return 'the two aligned rows have different lengths';
  if (top.filter((ch) => ch !== '-').join('') !== r.a || bottom.filter((ch) => ch !== '-').join('') !== r.b) return 'removing the gaps does not give back the inputs';
  let total = 0;
  for (let k = 0; k < top.length; k++) {
    if (top[k] === '-' && bottom[k] === '-') return 'a column has a gap in both rows';
    total += top[k] === '-' || bottom[k] === '-' ? r.params.gap : top[k] === bottom[k] ? r.params.match : r.params.mismatch;
  }
  return total === r.score || `the alignment adds up to ${total}, but the reported score is ${r.score}`;
}
const matchesBrute = (r, c) => {
  const ref = bruteScore(Array.from(r.a), Array.from(r.b), r.params);
  if (r.score !== ref) return `score ${r.score}, brute force says ${ref}`;
  if (c['cells filled'] !== r.rows * r.cols) return `filled ${c['cells filled']} cells in a ${r.rows} by ${r.cols} table`;
  return alignmentIsConsistent(r);
};

export default {
  meta: {
    id: 'needleman-wunsch',
    name: 'Needleman-Wunsch Alignment',
    aliases: ['global sequence alignment', 'global alignment', 'Needleman-Wunsch algorithm', 'pairwise alignment'],
    kind: 'algorithm',
    discipline: 'biology',
    alsoIn: [
      { id: 'nlp', why: 'Lining up two word sequences end to end, for example a transcript against a reference, is the same computation with words in place of nucleotides.' },
    ],
    subfield: 'Bioinformatics',
    family: 'Sequence comparison',
    lab: 'dynamic-programming',
    compareGroup: 'sequence-comparison',
    year: 1970,
    authors: 'Saul B. Needleman and Christian D. Wunsch',
    summary: 'Finds the highest-scoring end-to-end alignment of two sequences, given scores for matches, mismatches and gaps, by filling a table and tracing back.',
    difficulty: 'intermediate',
    order: 340,
    paradigms: ['dynamic-programming'],
    randomized: false,
    approximate: false,
    time: { best: 'O(mn)', average: 'O(mn)', worst: 'O(mn)', class: 'quadratic' },
    space: { worst: 'O(mn) with traceback; O(min(m, n)) for the score alone', class: 'quadratic' },
    tags: {
      problems: ['compare two DNA sequences', 'align two protein sequences', 'line up two sequences', 'how similar are two genes', 'global alignment'],
      techniques: ['table filling', 'traceback', 'scoring scheme', 'gap penalty'],
      applications: ['bioinformatics', 'natural language', 'scientific computing'],
    },
    prerequisites: ['edit-distance', 'lcs', 'concept:dynamic-programming', 'concept:optimal-substructure', 'concept:matrix'],
  },

  bigIdea: {
    simple: "Needleman-Wunsch lines up two sequences of letters so that as many letters as possible match. Biologists use it to compare DNA or proteins from different living things. DNA can be written as a long string of four letters: A, C, G and T. Over millions of years, copies of the same gene drift apart. A letter changes here. A few letters go missing there. To see what two versions still share, you write one above the other and slide parts along, leaving gaps where letters were lost. Each matching pair of letters earns points. Each mismatched pair and each gap costs points. The best line-up is the one with the highest total. There are far too many line-ups to try them all. So the method fills in a grid. It works out the best score for the first few letters of each sequence, then for a few more, until the last square holds the best score for the whole thing. Walking back through the grid shows the line-up itself.",
    what: 'An **alignment** writes two sequences one above the other, with gap symbols inserted so that the rows have equal length. Each column is a match, a mismatch, or a letter opposite a gap, and each kind of column has a score. The Needleman-Wunsch algorithm finds an alignment of the two whole sequences with the highest possible total. Cell (i, j) of its table holds the best score for aligning the first i letters of one sequence with the first j letters of the other.',
    why: 'Saul Needleman and Christian Wunsch published the method in 1970 to give biologists a systematic way to search for similarities between two proteins. A procedure that provably finds the best alignment under a stated scoring rule makes comparisons repeatable, and makes it possible to ask how good the best alignment of two unrelated sequences would be.',
    when: 'Use it when two sequences are expected to correspond over their whole length, such as two versions of the same gene, and you can say how matches, mismatches and gaps should be scored. If only a region of each is related, use the local variant, Smith-Waterman. If every change should simply cost 1, this is [edit distance](#/algorithm/edit-distance), and if only matches count it is the [longest common subsequence](#/algorithm/lcs).',
    interesting: 'The scores are a model, and the alignment is only as meaningful as the model. Change the gap score from −1 to −3 on the same two sequences and the best alignment changes shape: gaps disappear and mismatches take their place. The algorithm guarantees the best score for the numbers it is given. It cannot tell you whether those numbers describe biology.',
    where: 'Global alignment programs in bioinformatics, such as `needle` in the EMBOSS suite. It is also the pairwise step inside programs that align many sequences at once, and the same computation lines up word sequences when a speech recognizer\'s output is scored against a reference transcript.',
    analogy: {
      title: 'Two worn copies of the same manuscript',
      text: "Two scribes copied the same text by hand, generations apart. Words were changed and whole lines were dropped. To compare the copies, you lay them side by side and slide lines down, leaving a blank wherever one copy seems to have lost something. An identical pair of lines is good, a differing pair is suspicious, and a blank is a loss. The arrangement you settle on is your best account of what the copyists did. Lining up two genes is the same exercise, with letters for lines and inheritance for the scribes.",
      limits: "A scholar comparing manuscripts uses meaning and judgement. The algorithm only adds up fixed scores, and the alignment with the best score is not guaranteed to be what actually happened. It also insists on lining up both sequences from the first letter to the last. If only a passage is shared, forcing the rest into line gives a misleading picture.",
    },
  },

  example: {
    setup: 'Line up GAT against GT. A matching pair of letters scores +1. A mismatched pair scores −1. A letter opposite a gap scores −1. Draw a grid with G, A, T down the side and G, T along the top, plus an extra row and column at the start for "no letters yet". Each square will hold the best score for lining up the letters so far.',
    steps: [
      'Fill the extra row and column. Letters lined up against nothing are all gaps, so the top row reads 0, −1, −2 and the first column reads 0, −1, −2, −3.',
      'Square for G against G. Pairing them is a match: the diagonal square (0) plus 1 is 1. Coming from above or from the left would mean a gap: −1 − 1 = −2 either way. The best is 1.',
      'Square for GA against G. Pairing A with G is a mismatch: diagonal −1 − 1 = −2. Putting A opposite a gap: the square above (1) minus 1 is 0. From the left: −2 − 1 = −3. The best is 0.',
      'The other squares are filled the same way. The last one is GAT against GT. T and T match: the diagonal square (0) plus 1 is 1. From above: 0 − 1 = −1. From the left: −1 − 1 = −2. The best is 1.',
      'Walk back from the last square. Its 1 came from the diagonal: T is paired with T. That square\'s 0 came from above: A sits opposite a gap. That square\'s 1 came from the diagonal: G is paired with G.',
    ],
    result: 'The best alignment writes GAT above G-T, where the dash is a gap. It scores +1 − 1 + 1 = 1. Putting the gap at the end instead, GAT above GT-, would pair A with T and score 1 − 1 − 1 = −1.',
    tryInput: { a: 'GAT', b: 'GT', match: 1, mismatch: -1, gap: -1 },
  },

  terms: [
    { term: 'Sequence', meaning: 'An ordered list of symbols. DNA is a sequence over the four letters A, C, G and T, and a protein is a sequence over twenty amino acid letters.' },
    { term: 'Alignment', meaning: 'Two sequences written one above the other, with gaps inserted so that related letters sit in the same column.' },
    { term: 'Gap', meaning: 'A blank in one row of an alignment, written as a dash. It stands for a letter that was inserted in one sequence or deleted from the other.' },
    { term: 'Match and mismatch', meaning: 'A column where the two letters are the same, or different.' },
    { term: 'Scoring scheme', meaning: 'The numbers awarded for a match, a mismatch and a gap. They express how likely each kind of change is taken to be.' },
    { term: 'Global alignment', meaning: 'An alignment that covers both sequences from their first letter to their last.' },
    { term: 'Local alignment', meaning: 'An alignment of the best-matching stretch of each sequence, ignoring the rest.' },
    { term: 'Traceback', meaning: 'Walking backwards through the finished table to recover the alignment that earned the best score.' },
  ],

  takeaway: 'Score every way two sequences can begin, shortest beginnings first, and the best line-up of the whole sequences falls out of the last square of the grid.',

  viz: {
    describe: 'A table with the first sequence down the left side and the second along the top, plus a row and column marked with an empty-set sign for "no letters yet". Each cell holds the best alignment score for the two prefixes it stands for, and scores can be negative. The cell being filled is terracotta and the three cells it reads (above, left and diagonal) are ochre. After the table is full, a forest green path runs from the bottom-right cell back to the top-left. Beneath the table, two rows of letter cells show the prefixes being lined up, and at the end they show the two sequences aligned with dashes for gaps, with a third row giving the score of each column: forest green for a match, ochre for a mismatch, brick red for a gap.',
    inputs: [
      { id: 'a', type: 'text', label: 'First sequence', default: 'GATTACA', maxLength: 14, help: 'Up to 14 characters. Any letters work, not only A, C, G and T.' },
      { id: 'b', type: 'text', label: 'Second sequence', default: 'GCATGCG', maxLength: 14 },
      { id: 'match', type: 'range', label: 'Match score', min: 0, max: 5, step: 1, default: 1 },
      { id: 'mismatch', type: 'range', label: 'Mismatch score', min: -5, max: 0, step: 1, default: -1 },
      { id: 'gap', type: 'range', label: 'Gap score (per position)', min: -5, max: 0, step: 1, default: -1,
        help: 'Added once for every letter that sits opposite a gap. This is a linear gap penalty.' },
    ],
    presets: [
      { label: 'Two DNA fragments', values: { a: 'GATTACA', b: 'GCATGCG', match: 1, mismatch: -1, gap: -1 } },
      { label: 'Worked example: GAT and GT', values: { a: 'GAT', b: 'GT', match: 1, mismatch: -1, gap: -1 } },
      { label: 'Same fragments, costly gaps', values: { a: 'GATTACA', b: 'GCATGCG', match: 1, mismatch: -1, gap: -3 } },
      { label: 'Scores that count matches only', values: { a: 'GATTACA', b: 'GCATGCG', match: 1, mismatch: 0, gap: 0 } },
      { label: 'Scores that give edit distance', values: { a: 'GATTACA', b: 'GCATGCG', match: 0, mismatch: -1, gap: -1 } },
    ],
    tryThis: [
      { ask: 'Load "Two DNA fragments" and note the alignment at the end: it has two gaps and scores 0. Then load "Same fragments, costly gaps", where a gap costs 3 instead of 1. How many gaps will the best alignment have now?',
        reveal: 'None. The best alignment sets GATTACA straight above GCATGCG and accepts 4 mismatches against 3 matches, for a score of −1. The old alignment, with its 4 matches, 2 mismatches and 2 gaps, would now score 4 − 2 − 6 = −4. The sequences did not change. Only the scoring did.' },
      { ask: 'Load "Scores that count matches only": a match scores 1, and mismatches and gaps are free. The best score is then the largest number of letters that can be lined up as matches. How many will that be for GATTACA and GCATGCG?',
        reveal: '4. Matched letters keep their order in both sequences, so with these scores the best score is the length of the longest common subsequence. The alignment shown is the same G-ATTACA above GCA-TGCG as with the default scores, and its 4 matches are that subsequence.' },
      { ask: 'Load "Scores that give edit distance": a match scores 0, and every mismatch and every gap scores −1. The best score can no longer be positive. What will it be, and what is it counting?',
        reveal: '−4. Each mismatch is a substitution and each gap is an insertion or a deletion, so the score is the edit distance between the two fragments with a minus sign. Here the best alignment has 4 mismatches and no gaps. Maximizing this score and minimizing the number of edits are the same thing.' },
      { ask: 'Type `ACGT` as the first sequence and `TTACGTTT` as the second, with match +1, mismatch −1 and gap −1. All of ACGT sits in one piece inside the longer sequence. What will the best score be?',
        input: { a: 'ACGT', b: 'TTACGTTT', match: 1, mismatch: -1, gap: -1 },
        reveal: '0. The four matches earn 4, and the four letters of the longer sequence that are left without a partner cost 4 as gaps. Global alignment must account for every letter of both sequences. The page shows --ACG--T above TTACGTTT. Keeping ACGT in one piece scores the same, so the traceback is free to choose. Local alignment was invented for this case.' },
    ],
    run,
    report: (r, c) => `Best global alignment score: ${num(r.score)}   (match ${signed(r.params.match)}, mismatch ${signed(r.params.mismatch)}, gap ${signed(r.params.gap)})\n  ${r.alignedA}\n  ${r.alignedB}\n${plural(r.matches, 'match', 'matches')}, ${plural(r.mismatches, 'mismatch', 'mismatches')}, ${plural(r.gaps, 'gap')}. Table: ${r.rows} rows by ${r.cols} columns, ${c['cells filled'] || 0} cells filled.`,
    experiment: {
      title: 'Cells filled as the sequences grow',
      note: 'Each point is a real run on random sequences over the letters A, C, G, T with the default scores. In one series both sequences have length n. In the other the second stays at 8 letters. The work is the size of the table, whatever the letters or scores are.',
      metric: 'cells filled',
      metricLabel: 'Cells filled',
      sizeLabel: 'Length of the first sequence (n)',
      sizes: [4, 8, 16, 32, 64, 128, 256],
      variants: [
        { id: 'square', label: 'Both sequences have length n' },
        { id: 'fixed', label: 'Second sequence fixed at 8 letters' },
      ],
      input: (n, variant, seed) => {
        const rng = makeRng(seed * 31 + n);
        const word = (len) => Array.from({ length: len }, () => 'ACGT'[rng.int(0, 3)]).join('');
        return { a: word(n), b: word(variant === 'fixed' ? 8 : n), match: 1, mismatch: -1, gap: -1 };
      },
      theory: [
        { label: '(n + 1)²', fn: (n) => (n + 1) * (n + 1), variant: 'square' },
        { label: '9 (n + 1)', fn: (n) => 9 * (n + 1), variant: 'fixed' },
      ],
    },
  },

  logic: {
    intuition: 'Look at the last column of an alignment. It is one of three things: the last letters of both sequences paired together, the last letter of the first sequence opposite a gap, or the last letter of the second sequence opposite a gap. Whatever it is, the columns before it form an alignment of shorter prefixes, and that shorter alignment must itself be the best one possible, or the whole could be improved. So the best score for two prefixes is the best of three options, each built from a best score for slightly shorter prefixes.',
    steps: [
      'Choose the scores: `match` for a pair of equal letters, `mismatch` for a pair of different letters, and `gap` for a letter opposite a gap. Usually `match` is positive and the other two are negative.',
      'Let m and n be the lengths of the sequences a and b. Make a table S with rows 0 to m and columns 0 to n. S[i][j] will be the best score for aligning the first i letters of a with the first j letters of b. The pseudocode numbers letters from 1.',
      'Fill the border: S[i][0] = i × gap and S[0][j] = j × gap, because a prefix aligned with nothing is all gaps.',
      'Visit the remaining cells row by row. Let p be `match` if a[i] equals b[j], and `mismatch` otherwise. Set S[i][j] to the largest of: the diagonal cell plus p, the cell above plus `gap`, and the cell to the left plus `gap`.',
      'When the table is full, S[m][n] is the best global alignment score.',
      'To recover the alignment, start at (m, n) and repeatedly step to a neighbour whose value explains the current one. A diagonal step emits a pair of letters, a step up emits a letter of a over a gap, and a step left emits a gap over a letter of b. Stop at (0, 0) and reverse the columns.',
    ],
    pseudocode: [
      'needlemanWunsch(a, b):',
      '  for i from 0 to m:',
      '    S[i][0] ← i × gap',
      '  for j from 0 to n:',
      '    S[0][j] ← j × gap',
      '  for i from 1 to m:',
      '    for j from 1 to n:',
      '      if a[i] = b[j]:',
      '        p ← match',
      '      else:',
      '        p ← mismatch',
      '      S[i][j] ← max(',
      '        S[i−1][j−1] + p,',
      '        S[i−1][j] + gap,',
      '        S[i][j−1] + gap)',
      '  return S[m][n]',
      '',
      'traceback(S):',
      '  (i, j) ← (m, n)',
      '  while (i, j) ≠ (0, 0):',
      '    step to a neighbour',
      '      that explains S[i][j]',
      '    record that column',
      '  return columns, reversed',
    ],
    decisions: [
      { title: 'How should matches and mismatches be scored?', text: 'This page uses one number for every match and one for every mismatch. Real protein alignment uses a substitution matrix, such as the PAM and BLOSUM families, which gives each pair of amino acids its own score based on how often that substitution is observed in related proteins.' },
      { title: 'How should gaps be scored?', text: 'This page charges the same amount for every gap position, a linear gap penalty. Biological insertions and deletions often involve several letters at once, so practical tools use an affine penalty: a larger cost to open a gap and a smaller one to extend it. That needs three tables in place of one.' },
      { title: 'Global or local?', text: 'Needleman-Wunsch aligns the whole of both sequences. If they share only a region, the Smith-Waterman variant finds the best-scoring pair of substrings by never letting a cell fall below zero and starting the traceback from the largest cell.' },
      { title: 'Which alignment on a tie?', text: 'Several alignments can share the best score. This page prefers the diagonal, then up, then left. Tools that report alignments usually document their rule, because it affects where gaps are placed.' },
    ],
    invariants: [
      'After a cell is filled, `S[i][j]` is the highest score of any alignment of the first i letters of a with the first j letters of b.',
      'During the traceback, the columns recorded so far score exactly `S[m][n] − S[i][j]`.',
    ],
    edgeCases: [
      'One sequence empty: the only alignment is all gaps, and the score is the other length times the gap score.',
      'Identical sequences: with a positive match score the best alignment is the diagonal, scoring the length times the match score.',
      'A gap score of 0: leading and trailing gaps become free, and with a mismatch score of 0 as well the result is the longest common subsequence.',
      'A mismatch score below twice the gap score: a mismatch is never chosen, because two gaps achieve the same pairing-off more cheaply.',
      'Scores that are not whole numbers: the traceback compares values for equality, which is unreliable in floating point. Use integers or store the choice made in each cell.',
    ],
    correctness: 'By induction on i + j. A prefix aligned with the empty prefix can only be all gaps, so the border is correct. For an interior cell, consider a best alignment of the first i letters of a with the first j letters of b. Its last column is (a[i], b[j]), (a[i], gap) or (gap, b[j]). The columns before it align prefixes of lengths (i − 1, j − 1), (i − 1, j) or (i, j − 1), and their score must be the best possible for those prefixes: if a better alignment of them existed, attaching the same last column would beat the alignment we started with. So the best score equals one of the three candidates. Every candidate is the score of a real alignment, so none can exceed the best, and the maximum of the three is exactly it.',
    mistakes: [
      'Mixing sign conventions: storing the gap penalty as a positive number and then adding it, which rewards gaps.',
      'Leaving the border at zero. That makes gaps at the start free and silently computes a different kind of alignment.',
      'Taking the minimum, as in edit distance, when the scores are similarities to be maximized.',
      'Reading the result as proof of relatedness. Any two sequences have a best alignment. Whether its score is significant is a separate statistical question.',
    ],
  },

  code: {
    sample: {
      input: 'The pairs (GATTACA, GCATGCG), (GAT, GT) and (ACGT, TTACGT) with match +1, mismatch −1 and gap −1: the best score, then the two aligned rows.',
      expected: 'GATTACA / GCATGCG: score 0\n  G-ATTACA\n  GCA-TGCG\nGAT / GT: score 1\n  GAT\n  G-T\nACGT / TTACGT: score 2\n  --ACGT\n  TTACGT',
    },
    breakIt: [
      { change: 'Store the gap penalty as a positive number: at the top, change the third score from −1 to 1, and leave the rest of the code adding `GAP` as before. What will the alignment of GATTACA and GCATGCG look like?',
        find: { python: 'MATCH, MISMATCH, GAP = 1, -1, -1', javascript: 'const MATCH = 1, MISMATCH = -1, GAP = -1;' },
        replace: { python: 'MATCH, MISMATCH, GAP = 1, -1, 1', javascript: 'const MATCH = 1, MISMATCH = -1, GAP = 1;' },
        reveal: 'It prints "GATTACA / GCATGCG: score 14", with -------GATTACA above GCATGCG-------. No letter is paired with another. All 14 letters sit opposite gaps, and each gap now adds 1. The other two pairs go the same way, with scores 5 and 10. The code adds `GAP` wherever a gap is used, so a positive value rewards gaps: two letters set against gaps earn 2, more than the 1 they would earn as a match. Store the penalty as a negative number and add it, or as a positive number and subtract it, but never one of each.' },
      { change: 'In the border, leave the top row at zero: change `S[0][j] = j * GAP` to `S[0][j] = 0`. Which of the three scores will be wrong?',
        find: { python: 'S[0][j] = j * GAP', javascript: 'S[0][j] = j * GAP;' },
        replace: { python: 'S[0][j] = 0', javascript: 'S[0][j] = 0;' },
        reveal: 'The third. It prints "ACGT / TTACGT: score 4" above the same alignment as before, --ACGT over TTACGT. That alignment has four matches and two gaps, which add up to 2, not 4. With the top row at zero, gaps at the start of the first sequence are free, so the table is no longer scoring a global alignment. The first two pairs are unchanged, because their best alignments do not begin with such a gap. That is how this mistake stays hidden.' },
      { change: 'In the function that fills the table, take the smallest of the three options instead of the largest, as edit distance does. What will the score for GAT and GT be?',
        find: { python: 'S[i][j] = max(', javascript: 'S[i][j] = Math.max(' },
        replace: { python: 'S[i][j] = min(', javascript: 'S[i][j] = Math.min(' },
        reveal: 'It prints "GAT / GT: score -5", with --GAT above GT---. These scores are similarities, so the minimum finds the worst alignment there is: every letter opposite a gap, at −1 each. The other pairs come out at −14 and −10 in the same way. Edit distance takes the minimum because it counts costs. Whether to take the smallest or the largest depends on whether a large number is bad or good.' },
    ],
    python: {
      source: `MATCH, MISMATCH, GAP = 1, -1, -1


def score_table(a, b):
    m, n = len(a), len(b)
    S = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        S[i][0] = i * GAP
    for j in range(1, n + 1):
        S[0][j] = j * GAP
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            pair = MATCH if a[i - 1] == b[j - 1] else MISMATCH
            S[i][j] = max(S[i - 1][j - 1] + pair,  # align a[i-1] with b[j-1]
                          S[i - 1][j] + GAP,       # a[i-1] against a gap
                          S[i][j - 1] + GAP)       # b[j-1] against a gap
    return S


def traceback(a, b, S):
    i, j = len(a), len(b)
    top, bottom = [], []
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            pair = MATCH if a[i - 1] == b[j - 1] else MISMATCH
            if S[i][j] == S[i - 1][j - 1] + pair:
                top.append(a[i - 1])
                bottom.append(b[j - 1])
                i, j = i - 1, j - 1
                continue
        if i > 0 and S[i][j] == S[i - 1][j] + GAP:
            top.append(a[i - 1])
            bottom.append("-")
            i -= 1
        else:
            top.append("-")
            bottom.append(b[j - 1])
            j -= 1
    return "".join(reversed(top)), "".join(reversed(bottom))


for a, b in [("GATTACA", "GCATGCG"), ("GAT", "GT"), ("ACGT", "TTACGT")]:
    S = score_table(a, b)
    top, bottom = traceback(a, b, S)
    print(a + " / " + b + ": score " + str(S[len(a)][len(b)]))
    print("  " + top)
    print("  " + bottom)`,
      notes: [
        { line: 1, text: 'The scoring scheme. All three numbers are added, so penalties are negative.' },
        { line: 8, text: 'The border: i letters aligned with nothing are i gaps.' },
        { line: 14, text: 'The same three neighbours as edit distance, but with scores added and the maximum taken.' },
        { line: 26, text: 'Traceback re-derives which of the three options produced this cell by checking the arithmetic.' },
        { line: 33, text: 'A step up consumes a letter of the first sequence and writes a gap in the second row.' },
      ],
    },
    javascript: {
      source: `const MATCH = 1, MISMATCH = -1, GAP = -1;

function scoreTable(a, b) {
  const m = a.length, n = b.length;
  const S = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) S[i][0] = i * GAP;
  for (let j = 1; j <= n; j++) S[0][j] = j * GAP;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const pair = a[i - 1] === b[j - 1] ? MATCH : MISMATCH;
      S[i][j] = Math.max(S[i - 1][j - 1] + pair,  // align a[i-1] with b[j-1]
                         S[i - 1][j] + GAP,       // a[i-1] against a gap
                         S[i][j - 1] + GAP);      // b[j-1] against a gap
    }
  }
  return S;
}

function traceback(a, b, S) {
  let i = a.length, j = b.length;
  const top = [], bottom = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const pair = a[i - 1] === b[j - 1] ? MATCH : MISMATCH;
      if (S[i][j] === S[i - 1][j - 1] + pair) {
        top.push(a[i - 1]);
        bottom.push(b[j - 1]);
        i--; j--;
        continue;
      }
    }
    if (i > 0 && S[i][j] === S[i - 1][j] + GAP) {
      top.push(a[i - 1]);
      bottom.push("-");
      i--;
    } else {
      top.push("-");
      bottom.push(b[j - 1]);
      j--;
    }
  }
  return [top.reverse().join(""), bottom.reverse().join("")];
}

for (const [a, b] of [["GATTACA", "GCATGCG"], ["GAT", "GT"], ["ACGT", "TTACGT"]]) {
  const S = scoreTable(a, b);
  const [top, bottom] = traceback(a, b, S);
  console.log(a + " / " + b + ": score " + S[a.length][b.length]);
  console.log("  " + top);
  console.log("  " + bottom);
}`,
    },
    cpp: {
      source: `#include <algorithm>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

const int MATCH = 1, MISMATCH = -1, GAP = -1;
using Table = std::vector<std::vector<int>>;

Table scoreTable(const std::string& a, const std::string& b) {
    int m = a.size(), n = b.size();
    Table S(m + 1, std::vector<int>(n + 1, 0));
    for (int i = 1; i <= m; ++i) S[i][0] = i * GAP;
    for (int j = 1; j <= n; ++j) S[0][j] = j * GAP;
    for (int i = 1; i <= m; ++i) {
        for (int j = 1; j <= n; ++j) {
            int pair = a[i - 1] == b[j - 1] ? MATCH : MISMATCH;
            S[i][j] = std::max({S[i - 1][j - 1] + pair,  // align a[i-1] with b[j-1]
                                S[i - 1][j] + GAP,       // a[i-1] against a gap
                                S[i][j - 1] + GAP});     // b[j-1] against a gap
        }
    }
    return S;
}

std::pair<std::string, std::string> traceback(const std::string& a, const std::string& b, const Table& S) {
    int i = a.size(), j = b.size();
    std::string top, bottom;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0) {
            int pair = a[i - 1] == b[j - 1] ? MATCH : MISMATCH;
            if (S[i][j] == S[i - 1][j - 1] + pair) {
                top.push_back(a[i - 1]);
                bottom.push_back(b[j - 1]);
                --i; --j;
                continue;
            }
        }
        if (i > 0 && S[i][j] == S[i - 1][j] + GAP) {
            top.push_back(a[i - 1]);
            bottom.push_back('-');
            --i;
        } else {
            top.push_back('-');
            bottom.push_back(b[j - 1]);
            --j;
        }
    }
    std::reverse(top.begin(), top.end());
    std::reverse(bottom.begin(), bottom.end());
    return {top, bottom};
}

int main() {
    std::vector<std::pair<std::string, std::string>> pairs = {{"GATTACA", "GCATGCG"}, {"GAT", "GT"}, {"ACGT", "TTACGT"}};
    for (const auto& [a, b] : pairs) {
        Table S = scoreTable(a, b);
        auto [top, bottom] = traceback(a, b, S);
        std::cout << a << " / " << b << ": score " << S[a.size()][b.size()] << "\\n";
        std::cout << "  " << top << "\\n";
        std::cout << "  " << bottom << "\\n";
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The table has (m + 1) × (n + 1) cells and each needs one comparison, three additions and a maximum of three numbers. The time is proportional to m × n for every input and every choice of scores. The traceback adds at most m + n steps.',
    cases: [
      { case: 'Every input', time: 'Θ(mn)', when: 'The whole table is filled regardless of the sequences or the scores.' },
      { case: 'Traceback', time: 'O(m + n)', when: 'Each step moves at least one row up or one column left.' },
      { case: 'Affine gap penalties', time: 'O(mn)', when: 'Gotoh\'s method keeps three tables in place of one, tripling the work per cell but not changing the growth rate.' },
    ],
    space: 'Θ(mn) for the full table, which the simple traceback needs. The score alone needs two rows. The alignment itself can be recovered in O(m + n) space with Hirschberg\'s divide-and-conquer technique, at about twice the running time.',
    memory: 'Memory is the practical limit. Two sequences of a million letters each would need a table of a trillion cells, which is why whole-genome comparison uses linear-space or heuristic methods and not the plain table.',
    tradeoffs: 'The method is exact for its scoring scheme and quadratic in cost. Searching a database of millions of sequences this way is too slow, so database search tools use fast heuristics to find promising candidates and reserve exact dynamic programming for those.',
    assumptions: [
      'Looking up the score of a pair of letters takes constant time.',
      'Gaps are scored linearly: the same amount for every gap position.',
      'Scores are whole numbers, so the equality tests in the traceback are exact.',
      'The chart on this page counts table cells written, including the first row and column, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Two sequences of similar length that are related along their whole extent.',
      'Situations that need a provably optimal alignment under an explicit scoring rule.',
      'As a component: progressive multiple alignment and many comparison pipelines call a pairwise global aligner repeatedly.',
    ],
    struggles: [
      'Sequences that share only a domain or a short region. Global alignment spreads gaps across the unrelated parts.',
      'Very long sequences, because of quadratic memory and time.',
      'Sequences with rearranged, duplicated or reversed segments. An alignment keeps both sequences in order and cannot express a rearrangement.',
      'Database search, where one query must be compared with millions of sequences.',
    ],
    pitfalls: [
      'Choosing scores arbitrarily and then reading biological meaning into the result.',
      'Using a linear gap penalty where an affine one is appropriate, which scatters many single-letter gaps through the alignment.',
      'Reporting a single alignment when many tie for the best score.',
    ],
    misunderstandings: [
      '"The algorithm finds the true evolutionary history of the sequences." It finds the highest-scoring alignment under the scores it was given. Different scores give different alignments, and none is guaranteed to be what happened.',
      '"A high score proves the sequences are related." A score has to be compared with what unrelated sequences of the same length and composition would get. That is a statistical question the algorithm does not answer.',
      '"Global and local alignment differ only in name." They answer different questions. Global alignment accounts for every letter of both sequences. Local alignment reports only the best-matching region and ignores the rest.',
      '"It is a different algorithm from edit distance." It is the same table and the same three neighbours. With match 0, mismatch −1 and gap −1, the best score is exactly the edit distance with a minus sign.',
    ],
    constraints: [
      'Protein alignment needs a 20 by 20 substitution matrix and affine gap penalties to give biologically sensible results.',
      'Sequencing produces data at a scale where exact quadratic alignment is reserved for the final step, after indexing or heuristics have narrowed the candidates.',
    ],
    alternatives: [
      { name: 'Smith-Waterman (local alignment)', when: 'Only part of each sequence is expected to be related. Published in 1981 as a modification of this algorithm.' },
      { id: 'edit-distance', name: 'Edit Distance (Levenshtein)', when: 'Every insertion, deletion and substitution should cost exactly 1 and you want the count of changes.' },
      { id: 'lcs', name: 'Longest Common Subsequence', when: 'Only matches matter and mismatches and gaps should be free.' },
      { name: 'Heuristic database search (for example BLAST)', when: 'One sequence must be compared with a very large collection and speed matters more than a guarantee of optimality.' },
    ],
    comparison: {
      columns: ['', 'Needleman-Wunsch', 'Smith-Waterman', 'Edit distance', 'LCS'],
      rows: [
        ['Aligns', 'Whole sequences', 'Best-matching regions', 'Whole strings', 'Whole strings'],
        ['Objective', 'Maximize score', 'Maximize score', 'Minimize edits', 'Maximize matches'],
        ['Border', 'Multiples of the gap score', 'Zeros', '0, 1, 2, ...', 'Zeros'],
        ['Cell floor', 'None', 'Never below 0', 'None', 'None'],
        ['Traceback starts at', 'Bottom-right cell', 'Largest cell', 'Bottom-right cell', 'Bottom-right cell'],
      ],
    },
  },

  applications: [
    { title: 'Global alignment of genes and proteins', status: 'established', text: 'Bioinformatics toolkits provide Needleman-Wunsch as their standard global aligner. The `needle` program in the EMBOSS suite, for example, aligns two sequences along their entire length with this algorithm, using a substitution matrix and affine gap penalties.' },
    { title: 'A step inside multiple sequence alignment', status: 'established', text: 'Programs that align many sequences at once commonly work progressively: they align the most similar pair first, then align further sequences or groups to the growing result. Each of those steps is a global alignment by dynamic programming.' },
    { title: 'Local alignment and database search', status: 'established', text: 'The Smith-Waterman algorithm, a direct modification of Needleman-Wunsch, finds the best-matching regions of two sequences. Database search tools such as BLAST use heuristics to approximate it quickly across very large collections.' },
    { title: 'Scoring speech recognition output', status: 'established', text: 'To count a recognizer\'s errors, its output is aligned word by word against a reference transcript by dynamic programming, and the substitutions, insertions and deletions in the alignment are counted. This is global alignment with words as the symbols.' },
    { title: 'Lining up other ordered records', status: 'illustrative', text: 'Any two sequences that should correspond end to end can be aligned this way, for example two recordings of the same events with some entries missing from each, given sensible scores for agreement and for a missing entry.' },
  ],

  connections: [
    { to: 'edit-distance', type: 'prerequisite', why: 'The same table over pairs of prefixes with the same three neighbours. Edit distance fixes every cost at 1 and minimizes; alignment lets the scores vary and maximizes.' },
    { to: 'lcs', type: 'prerequisite', why: 'With match 1 and mismatch and gap 0, the optimal alignment score is the length of the longest common subsequence.' },
    { to: 'fibonacci-dp', type: 'prerequisite', why: 'Both fill a table so that every entry is computed once from entries already known. Alignment adds a second dimension and a choice among three options.' },
    { to: 'concept:dynamic-programming', type: 'prerequisite', why: 'The best alignment of two sequences is built from best alignments of their prefixes, each computed once and stored in the table.' },
    { to: 'concept:optimal-substructure', type: 'prerequisite', why: 'Removing the last column of a best alignment leaves a best alignment of shorter prefixes. This is the property that makes the cell rule correct.' },
    { to: 'concept:matrix', type: 'prerequisite', why: 'Subproblems are indexed by a position in each sequence, so the scores are stored in a two-dimensional array, and substitution scores in another.' },
    { to: 'dijkstra', type: 'related', why: 'An alignment is a path from the top-left to the bottom-right of a grid graph whose edges carry the scores. Because the grid has no cycles, a row-by-row sweep finds the best path without a priority queue.' },
    { to: 'bellman-ford', type: 'related', why: 'Both rest on the principle Richard Bellman stated for dynamic programming: the best route to a point is the best route to one of its neighbours plus one more step. Bellman-Ford applies it to graphs that may have cycles, alignment to a grid that has none.' },
    { to: 'backpropagation', type: 'related', why: 'Each has a forward pass that stores intermediate results and a backward pass that reads them. The traceback recovers which choices produced the best score; backpropagation recovers how much each weight contributed to the error.' },
    { to: 'knapsack', type: 'related', why: 'Another table of best values with a traceback that recovers the decisions behind the best total.' },
    { to: 'viterbi', type: 'advanced', why: 'Hidden Markov models for sequence alignment replace fixed scores with probabilities, and the Viterbi algorithm fills the corresponding table in the same order.' },
    { to: 'discipline:biology', type: 'application', why: 'Sequence alignment is the basic operation of comparative genomics: it identifies which positions of two genes or proteins correspond.' },
    { to: 'discipline:nlp', type: 'application', why: 'Aligning word sequences end to end is how transcripts and translations are compared with references.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'With gap score −2, what does the first column of the table contain, from the top down, and why?',
      options: ['All zeros, because nothing has been aligned yet', '0, −2, −4, −6 and so on, because i letters aligned with nothing are i gaps', '0, 1, 2, 3 and so on, as in edit distance', 'The match score repeated, because each letter matches itself'],
      answer: 1,
      explain: [
        'Zeros would make gaps at the start free. That is a different kind of alignment, not a global one.',
        'Correct. Cell (i, 0) is the best score for the first i letters of the first sequence against none of the second, and the only alignment is all gaps.',
        'Edit distance counts edits as positive costs. Here gaps add a negative score.',
        'No letter of the second sequence is available in column 0, so nothing can match.',
      ],
    },
    {
      type: 'predict',
      q: 'Align CAT with CGT using match +1, mismatch −3 and gap −1. What is the best global alignment score?',
      options: ['−1', '0', '1', '2'],
      answer: 1,
      explain: [
        '−1 is what you get by pairing A with G: 1 − 3 + 1. There is a better way to handle that position.',
        'Pairing A with G would cost 3. It is cheaper to put A opposite a gap and G opposite a gap, at 1 each: 1 − 1 − 1 + 1 = 0.',
        '1 would be the score if the mismatch cost only 1. Here it costs 3.',
        'Only C and T can match, which gives at most 2 before the middle letters are paid for.',
      ],
      tryInput: { a: 'CAT', b: 'CGT', match: 1, mismatch: -3, gap: -1 },
      check: (r) => (r.score === 0 && r.gaps === 2 && r.matches === 2 && r.mismatches === 0) || `got score ${r.score} with ${r.gaps} gaps and ${r.mismatches} mismatches`,
    },
    {
      type: 'debug',
      q: 'The alignments this code produces consist almost entirely of gaps, and their scores are suspiciously high. What is wrong?',
      code: `MATCH, MISMATCH, GAP = 1, -1, 2   # gap penalty of 2

def score_table(a, b):
    m, n = len(a), len(b)
    S = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        S[i][0] = i * GAP
    for j in range(1, n + 1):
        S[0][j] = j * GAP
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            pair = MATCH if a[i - 1] == b[j - 1] else MISMATCH
            S[i][j] = max(S[i - 1][j - 1] + pair,
                          S[i - 1][j] + GAP,
                          S[i][j - 1] + GAP)
    return S`,
      options: ['The gap penalty is stored as a positive number and then added, so every gap raises the score', 'The border should be all zeros', 'max should be min', 'The match score should be larger than the gap penalty'],
      answer: 0,
      explain: [
        'Correct. The code adds GAP everywhere, so GAP must be −2, or the code must subtract it. As written, a gap is worth more than a match.',
        'A zero border would not fix the main loop, which still rewards gaps.',
        'Alignment scores are similarities, so the maximum is right once the signs are consistent.',
        'The relative sizes are a modelling choice. The bug is the sign.',
      ],
    },
    {
      type: 'choice',
      q: 'A short gene fragment of 30 letters is known to occur somewhere inside a sequence of 5,000 letters. Why is plain Needleman-Wunsch a poor fit, and what is used instead?',
      options: ['It is too slow for 5,000 letters; nothing else works either', 'It must align every letter of both sequences, so it pays for about 4,970 gaps; local alignment (Smith-Waterman) finds just the matching region', 'It cannot handle sequences of different lengths; pad the shorter one', 'It only works on proteins; use edit distance for DNA'],
      answer: 1,
      explain: [
        'A table of 31 by 5,001 cells is small. Speed is not the problem here.',
        'Correct. A global alignment accounts for both sequences end to end. Local alignment lets the score restart at zero and reports only the best-matching stretch.',
        'Different lengths are fine. The difference is made up by gaps, which is exactly the trouble in this case.',
        'The algorithm works on any symbols for which pair scores are defined.',
      ],
    },
    {
      type: 'challenge',
      title: 'From global to local',
      prompt: 'Turn the global aligner into Smith-Waterman local alignment. Three changes are needed: set the whole border to 0, add 0 as a fourth option in the maximum for every cell, and start the traceback from the largest cell in the table, stopping when it reaches a cell holding 0. Test it on ACGT against TTACGTTT with match +2, mismatch −1 and gap −2, and compare the local score with the global score for the same input. Then try GATTACA against GCATGCG with the same scores.',
      expect: 'For ACGT against TTACGTTT the largest cell holds 8, and the traceback from it gives ACGT above ACGT: four matches at 2 each and nothing else. The global score for the same input is 0, because the four matches are cancelled by four gaps at −2 each. For GATTACA against GCATGCG the best local score is 4, while the global score is 2. Two cells hold that 4, one ending the shared AT and one ending the shared CA, so either two-letter alignment is a correct answer.',
      hints: ['Keep track of the position of the maximum while filling the table.', 'The 0 option means "start a fresh alignment here". That is why a local alignment score can never be negative.'],
    },
  ],

  compare: {
    idea: 'Fill a table of best alignment scores for all pairs of prefixes; each cell is the maximum over three neighbours plus a match, mismatch or gap score.',
    requires: 'Two sequences, and a score for a match, a mismatch and a gap.',
    sensitivity: 'Running time: none. The alignment itself is highly sensitive to the scores chosen.',
    memory: 'O(mn) for the table with traceback, O(min(m, n)) for the score alone.',
    difficulty: 'moderate',
    difficultyNote: 'The table is as simple as edit distance. Choosing meaningful scores is the hard part.',
    limits: 'Slow and memory-hungry on long sequences: twice the length means four times the work. It lines the two up from end to end even if only part is related. Its simple gap score is a crude picture of real insertions and deletions.',
    useWhen: 'Two sequences are related along their whole length, and you can say how to score a match, a mismatch and a gap.',
  },

  advanced: {
    history: 'Saul Needleman and Christian Wunsch published the method in 1970 as a way to search for similarities between the amino acid sequences of two proteins. The recurrence in their paper is more general than the one taught today and, implemented directly, takes cubic time. The quadratic form with a fixed score per gap position came from later work, including a 1972 paper by David Sankoff. The same table-filling idea was reached independently in other fields around the same time, by T. K. Vintsyuk in 1968 for speech recognition and by Robert Wagner and Michael Fischer in 1974 for string correction. In 1981 Temple Smith and Michael Waterman modified the algorithm to find local alignments, and in 1982 Osamu Gotoh showed how to handle affine gap penalties in quadratic time.',
    derivation: 'Let $s(x, y)$ be the score of pairing letters $x$ and $y$ (here `match` if they are equal and `mismatch` otherwise) and $g$ the gap score. Write $S(i, j)$ for the best score of aligning $a_{1..i}$ with $b_{1..j}$. Then $S(i, 0) = i\\,g$, $S(0, j) = j\\,g$, and for $i, j \\ge 1$:\n\n$$S(i, j) = \\max \\begin{cases} S(i-1,\\, j-1) + s(a_i, b_j) \\\\ S(i-1,\\, j) + g \\\\ S(i,\\, j-1) + g \\end{cases}$$\n\nSetting $s = 0$ for a match, $s = -1$ for a mismatch and $g = -1$ gives $S(m, n) = -d(a, b)$, where $d$ is the Levenshtein distance. Setting $s = 1$ for a match and $s = 0$, $g = 0$ otherwise gives the length of the longest common subsequence.',
    proof: 'Every alignment of $a_{1..i}$ with $b_{1..j}$, for $i, j \\ge 1$, ends in exactly one of the columns $(a_i, b_j)$, $(a_i, -)$, $(-, b_j)$. Deleting the last column gives an alignment of $a_{1..i-1}$ with $b_{1..j-1}$, of $a_{1..i-1}$ with $b_{1..j}$, or of $a_{1..i}$ with $b_{1..j-1}$, and this is a bijection between alignments ending in a given column and alignments of the corresponding shorter prefixes. The score is additive over columns, so the best alignment ending in a given column has score equal to that column\'s score plus the best score for the shorter prefixes. Taking the maximum over the three possible last columns gives the recurrence. Correctness of the table follows by induction on $i + j$.',
    complexityProof: 'There are $(m+1)(n+1)$ cells, each computed with a constant number of operations, so the fill takes $\\Theta(mn)$ time and space. The traceback decreases $i + j$ by at least 1 per step, so it takes at most $m + n$ steps.',
    variants: [
      { name: 'Smith-Waterman (local alignment)', text: 'Border of zeros, a floor of zero in every cell, and traceback from the largest cell. Finds the best-scoring pair of substrings.' },
      { name: 'Affine gap penalties (Gotoh)', text: 'A gap of length k costs an opening penalty plus k times an extension penalty. Three tables track whether the alignment currently ends in a pair, a gap in one sequence, or a gap in the other.' },
      { name: 'Substitution matrices', text: 'Replaces the two numbers `match` and `mismatch` with a table of scores for every pair of symbols, such as the PAM and BLOSUM matrices for amino acids.' },
      { name: 'Semi-global alignment', text: 'Makes gaps at the ends of one or both sequences free, for fitting a short sequence into a long one or finding overlaps between fragments.' },
      { name: 'Linear-space alignment', text: 'Hirschberg\'s divide-and-conquer technique, adapted to alignment by Myers and Miller, recovers an optimal alignment using memory proportional to the shorter sequence.' },
      { name: 'Banded alignment', text: 'Fills only cells near the main diagonal when the sequences are known to be similar, reducing the work to the band width times the length.' },
    ],
    implementation: 'Use integer scores so that the traceback\'s equality tests are exact, or store a direction per cell while filling. Put the shorter sequence along the columns. For long sequences use a linear-space method or a band. Production aligners vectorize the inner loop with SIMD instructions.',
    benchmarking: 'Cell updates per second is the customary speed measure for alignment kernels, since the work per cell is constant. When comparing alignment quality, state the scoring scheme: scores from different schemes are not comparable.',
    references: [
      { authors: 'S. B. Needleman and C. D. Wunsch', year: 1970, title: 'A general method applicable to the search for similarities in the amino acid sequence of two proteins', venue: 'Journal of Molecular Biology 48(3), 443-453' },
      { authors: 'T. F. Smith and M. S. Waterman', year: 1981, title: 'Identification of common molecular subsequences', venue: 'Journal of Molecular Biology 147(1), 195-197' },
      { authors: 'O. Gotoh', year: 1982, title: 'An improved algorithm for matching biological sequences', venue: 'Journal of Molecular Biology 162(3), 705-708' },
      { authors: 'D. Sankoff', year: 1972, title: 'Matching sequences under deletion/insertion constraints', venue: 'Proceedings of the National Academy of Sciences 69(1), 4-6' },
      { authors: 'E. W. Myers and W. Miller', year: 1988, title: 'Optimal alignments in linear space', venue: 'Computer Applications in the Biosciences 4(1), 11-17' },
    ],
    furtherReading: [
      'R. Durbin, S. Eddy, A. Krogh and G. Mitchison, *Biological Sequence Analysis* (1998), chapter 2, "Pairwise alignment".',
      'D. Gusfield, *Algorithms on Strings, Trees, and Sequences* (1997), part III.',
      'N. C. Jones and P. A. Pevzner, *An Introduction to Bioinformatics Algorithms* (2004), chapter 6.',
    ],
  },

  tests: [
    { name: 'default input: score 0, and the alignment is consistent and matches brute force', input: { a: 'GATTACA', b: 'GCATGCG', match: 1, mismatch: -1, gap: -1 },
      check: (r, c) => (r.score === 0 && r.alignedA === 'G-ATTACA' && r.alignedB === 'GCA-TGCG' && r.gaps === 2 ? matchesBrute(r, c) : `got ${r.score}: ${r.alignedA} / ${r.alignedB}`) },
    { name: 'worked example: GAT and GT, every cell of the table', input: { a: 'GAT', b: 'GT', match: 1, mismatch: -1, gap: -1 },
      check: (r) => (r.score === 1 && r.alignedA === 'GAT' && r.alignedB === 'G-T' && JSON.stringify(r.table) === '[[0,-1,-2],[-1,1,0],[-2,0,0],[-3,-1,1]]') || `got ${r.alignedA} / ${r.alignedB}, table ${JSON.stringify(r.table)}` },
    { name: 'matches brute force with other scores', input: { a: 'ACGTAC', b: 'AGTTC', match: 2, mismatch: -1, gap: -2 }, check: matchesBrute },
    { name: 'matches brute force when gaps are costly', input: { a: 'GATTACA', b: 'GCATGCG', match: 1, mismatch: -1, gap: -3 },
      check: (r, c) => (r.gaps === 0 && r.mismatches === 4 && r.score === -1 ? matchesBrute(r, c) : `got score ${r.score} with ${r.gaps} gaps and ${r.mismatches} mismatches`) },
    { name: 'identity: match 1, mismatch 0, gap 0 gives the LCS length (brute force over subsets)', input: { a: 'GATTACA', b: 'GCATGCG', match: 1, mismatch: 0, gap: 0 },
      check: (r) => (r.score === bruteLcs(r.a, r.b) && r.score === 4 && alignmentIsConsistent(r) === true) || `score ${r.score}, LCS length ${bruteLcs(r.a, r.b)}` },
    { name: 'identity: match 0, mismatch -1, gap -1 gives minus the edit distance', input: { a: 'GATTACA', b: 'GCATGCG', match: 0, mismatch: -1, gap: -1 },
      check: (r, c) => (r.score === -4 ? matchesBrute(r, c) : `got ${r.score}`) },
    { name: 'edit-distance identity on kitten and sitting', input: { a: 'kitten', b: 'sitting', match: 0, mismatch: -1, gap: -1 },
      check: (r, c) => (r.score === -3 ? matchesBrute(r, c) : `got ${r.score}`) },
    { name: 'quiz: CAT and CGT with mismatch -3 prefer two gaps', input: { a: 'CAT', b: 'CGT', match: 1, mismatch: -3, gap: -1 },
      check: (r, c) => (r.score === 0 && r.gaps === 2 && r.matches === 2 && r.mismatches === 0 ? matchesBrute(r, c) : `got score ${r.score} with ${r.gaps} gaps`) },
    { name: 'tryThis: a short sequence inside a long one pays for the overhang', input: { a: 'ACGT', b: 'TTACGTTT', match: 1, mismatch: -1, gap: -1 },
      check: (r, c) => (r.gaps === 4 && r.matches === 4 && r.score === 0 ? matchesBrute(r, c) : `got score ${r.score} with ${r.gaps} gaps`) },
    { name: 'challenge numbers: global score of ACGT and TTACGTTT with +2, -1, -2 is 0', input: { a: 'ACGT', b: 'TTACGTTT', match: 2, mismatch: -1, gap: -2 },
      check: (r, c) => (r.score === 0 ? matchesBrute(r, c) : `got ${r.score}`) },
    { name: 'code sample: ACGT and TTACGT score 2 with two leading gaps', input: { a: 'ACGT', b: 'TTACGT', match: 1, mismatch: -1, gap: -1 },
      check: (r, c) => (r.score === 2 && r.alignedA === '--ACGT' && r.alignedB === 'TTACGT' ? matchesBrute(r, c) : `got ${r.score}: ${r.alignedA} / ${r.alignedB}`) },
    { name: 'things to try: the alignments the reveals quote', input: { a: 'ACGT', b: 'TTACGTTT', match: 1, mismatch: -1, gap: -1 },
      check: (r) => {
        const silent = { count() {}, frame() {} };
        const lcsScores = run({ a: 'GATTACA', b: 'GCATGCG', match: 1, mismatch: 0, gap: 0 }, silent);
        const editScores = run({ a: 'GATTACA', b: 'GCATGCG', match: 0, mismatch: -1, gap: -1 }, silent);
        const challenge = run({ a: 'GATTACA', b: 'GCATGCG', match: 2, mismatch: -1, gap: -2 }, silent);
        return (r.alignedA === '--ACG--T' && r.alignedB === 'TTACGTTT' && lcsScores.alignedA === 'G-ATTACA' && lcsScores.alignedB === 'GCA-TGCG' && lcsScores.matches === 4
          && editScores.score === -4 && editScores.mismatches === 4 && editScores.gaps === 0 && challenge.score === 2) || `got ${r.alignedA} / ${r.alignedB}`;
      } },
    { name: 'one empty sequence: all gaps', input: { a: '', b: 'ACG', match: 1, mismatch: -1, gap: -2 },
      check: (r, c) => (r.score === -6 && r.alignedA === '---' && r.alignedB === 'ACG' && c['cells filled'] === 4) || `got ${r.score}` },
    { name: 'identical sequences align on the diagonal', input: { a: 'ACGTACGT', b: 'ACGTACGT', match: 2, mismatch: -1, gap: -1 },
      check: (r, c) => (r.score === 16 && r.gaps === 0 && r.mismatches === 0 && c['cells filled'] === 81) || `got ${r.score}` },
  ],
};
