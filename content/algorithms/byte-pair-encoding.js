import { makeRng } from '../../js/lib/rng.js';

// Byte-pair encoding as it is used to build a tokenizer's vocabulary.
//   The training text is split into words at spaces. Each word starts as its single characters
//   followed by the end-of-word marker "_". Pairs are counted inside words only, so no token
//   ever spans two words.
//   Tie-break: among pairs with the same highest count, the one met first when reading the
//   current tokens from left to right is merged. Every part of this lesson uses that rule.

const MARK = '_';
// Tokens quoted inside notes pass through the inline-markup parser, so the few characters it reacts to are swapped for look-alikes.
const say = (s) => String(s).replace(/[$*`]/g, (c) => ({ $: '＄', '*': '∗', '`': 'ˋ' }[c]));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const listOf = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

const startTokens = (word) => [...word, MARK];
const sizeOf = (words) => words.reduce((n, w) => n + w.length, 0);

// Count every adjacent pair of tokens inside the words. A Map keeps its entries in the order
// they were first added, and the tie-break relies on that order.
function countPairs(words) {
  const counts = new Map();
  let total = 0;
  for (const w of words) {
    for (let i = 0; i + 1 < w.length; i++) {
      const key = `${w[i]} ${w[i + 1]}`;   // a token never contains a space, so this key is unambiguous
      const entry = counts.get(key);
      if (entry) entry.count++;
      else counts.set(key, { a: w[i], b: w[i + 1], count: 1 });
      total++;
    }
  }
  return { counts, total };
}

// The most frequent pair. A later pair must be strictly more frequent to replace an earlier one.
function pickBest(counts) {
  let best = null;
  for (const entry of counts.values()) if (!best || entry.count > best.count) best = entry;
  return best;
}

// Replace each a followed by b with the single token a + b, scanning left to right.
function mergeWord(w, a, b) {
  const out = [];
  let hits = 0;
  for (let i = 0; i < w.length;) {
    if (i + 1 < w.length && w[i] === a && w[i + 1] === b) { out.push(a + b); i += 2; hits++; }
    else { out.push(w[i]); i++; }
  }
  return { out, hits };
}

// How often the pair is counted inside one word (overlapping copies included, as in countPairs).
const occurrences = (w, a, b) => { let n = 0; for (let i = 0; i + 1 < w.length; i++) if (w[i] === a && w[i + 1] === b) n++; return n; };

const SHOWN_PAIRS = 28;

function run(input, t) {
  const text = String(input.text ?? '').trim();
  const newWord = String(input.word ?? '').trim();
  const wanted = Math.max(0, Math.round(Number(input.merges) || 0));
  if (!text) throw new Error('Type some training text: one or more words separated by spaces.');
  if (!newWord) throw new Error('Type one word to split into tokens.');
  if (/\s/.test(newWord)) throw new Error('The word to split must be a single word with no spaces in it.');
  if (text.includes(MARK) || newWord.includes(MARK)) throw new Error('This page uses the underscore _ to mark the end of a word, so the text itself cannot contain one. Remove it and run again.');

  const source = text.split(/\s+/);
  const normalized = source.join(' ');
  let words = source.map(startTokens);
  const initial = words.map((w) => w.slice());
  const startSize = sizeOf(words);

  // One display row per different word, in order of first appearance. Every copy of a word is
  // always split the same way, so the first copy stands for all of them.
  const distinct = [];
  const seen = new Map();
  source.forEach((word, at) => {
    if (seen.has(word)) seen.get(word).count++;
    else { const d = { word, at, count: 1 }; seen.set(word, d); distinct.push(d); }
  });

  const base = [];
  for (const w of initial) for (const s of w) if (!base.includes(s)) base.push(s);
  const vocabulary = new Set(base);
  const merges = [];
  const rounds = [];

  const corpusLegend = [{ label: 'pair chosen for merging', role: 'compare' }, { label: 'token just created', role: 'current' }, { label: 'end-of-word marker', role: 'dim' }];
  const cellsFor = (tokens, mark) => {
    const roles = new Array(tokens.length).fill(null);
    if (mark && mark.pair) {
      for (let i = 0; i + 1 < tokens.length;) {
        if (tokens[i] === mark.pair[0] && tokens[i + 1] === mark.pair[1]) { roles[i] = mark.role; roles[i + 1] = mark.role; i += 2; } else i++;
      }
    }
    return tokens.map((tok, i) => ({ t: tok, role: roles[i] || (mark && mark.token === tok ? mark.role : tok === MARK ? 'dim' : mark && mark.all ? mark.all : 'default') }));
  };
  const corpus = (mark) => ({
    kind: 'rows', title: `The training text as tokens: ${plural(sizeOf(words), 'token', 'tokens')}`, legend: mark && mark.all ? [{ label: 'end-of-word marker', role: 'dim' }] : corpusLegend,
    rows: distinct.map((d) => ({ label: d.count === 1 ? 'once' : `${d.count} times`, cells: cellsFor(words[d.at], mark) })),
  });
  const pairCells = (counts, best) => {
    let entries = [...counts.values()];
    if (entries.length > SHOWN_PAIRS) {
      const floor = entries.map((e) => e.count).sort((x, y) => y - x)[SHOWN_PAIRS - 1];
      let room = SHOWN_PAIRS - entries.filter((e) => e.count > floor).length;
      entries = entries.filter((e) => e.count > floor || (e.count === floor && room-- > 0));
    }
    return entries.map((e) => ({ t: `${e.a} + ${e.b}`, sub: e.count, role: best && e === best ? 'current' : best && e.count === best.count ? 'compare' : 'default' }));
  };
  const mergeCells = (fresh, state) => merges.map((m, i) => ({ t: `${m.a} + ${m.b}`, sub: `rule ${i + 1}`, role: state ? state(i) : i === fresh ? 'current' : 'done' }));
  const ledger = (counts, best, fresh) => ({
    kind: 'rows', title: counts && counts.size > SHOWN_PAIRS ? `Pair counts (the ${SHOWN_PAIRS} highest of ${counts.size}, in the order first met) and the merge list` : 'Pair counts, in the order first met, and the merge list',
    legend: [{ label: 'highest count: merged next', role: 'current' }, { label: 'tied for the highest count', role: 'compare' }, { label: 'rule already learned', role: 'done' }],
    rows: [
      { label: 'Pair counts', cells: counts ? pairCells(counts, best) : [] },
      { label: 'Merge list', cells: mergeCells(fresh) },
    ],
  });

  t.count('tokens in the text', startSize);
  t.frame(() => ({
    line: [0, 1],
    note: `The training text has ${plural(source.length, 'word', 'words')}${distinct.length < source.length ? `, ${distinct.length} of them different. A word that appears several times is drawn once, with the number of copies beside it` : ''}. Each word is split into single characters, and the marker **${MARK}** is put at its end, so that the end of a word can later become part of a token. That makes **${startSize} tokens**. The starting vocabulary is the ${plural(base.length - 1, 'different character', 'different characters')} plus the marker: ${base.length} entries.`,
    views: [corpus(null), ledger(null, null, -1)],
    vars: { vocabulary: vocabulary.size, 'merges asked for': wanted },
  }));

  let stoppedEarly = false;
  for (let k = 1; k <= wanted; k++) {
    const { counts, total } = countPairs(words);
    t.count('pairs counted', total);
    if (!counts.size) {
      stoppedEarly = true;
      t.frame(() => ({
        line: [3, 4],
        note: `Round ${k}. Every word is now a single token, so no two tokens stand next to each other inside a word and there is nothing to count. Learning stops after ${plural(merges.length, 'merge', 'merges')}, although ${wanted} were asked for.`,
        views: [corpus({ all: 'done' }), ledger(null, null, -1)],
        vars: { round: k, vocabulary: vocabulary.size },
      }));
      break;
    }
    const kinds = counts.size;
    t.frame(() => ({
      line: 3,
      note: `Round ${k}. Count every pair of tokens that stand next to each other inside a word. A word with several copies counts once per copy. Pairs are not counted across the gap between two words, which is why no token will ever span two words. That is ${plural(total, 'pair', 'pairs')} counted, of ${plural(kinds, 'kind', 'different kinds')}.`,
      views: [corpus(null), ledger(counts, null, -1)],
      vars: { round: k, 'pairs counted this round': total, 'different pairs': kinds },
    }));

    const best = pickBest(counts);
    const tied = [...counts.values()].filter((e) => e.count === best.count);
    const where = distinct.map((d) => ({ d, n: occurrences(words[d.at], best.a, best.b) })).filter((x) => x.n > 0);
    const whereText = where.slice(0, 4).map(({ d, n }) => `${n} in ${say(d.word)}${d.count > 1 ? `, which appears ${d.count} times, so ${n * d.count}` : ''}`).join('; ') + (where.length > 4 ? '; and the rest in other words' : '');
    const name = `**${say(best.a)} + ${say(best.b)}**`;
    t.frame(() => ({
      line: 5,
      note: (tied.length === 1
        ? `The most frequent pair is ${name}, counted ${plural(best.count, 'time', 'times')} (${whereText}). No other pair is counted as often.`
        : `${tied.length} pairs share the highest count, ${best.count}: ${listOf(tied.slice(0, 6).map((e) => `${say(e.a)} + ${say(e.b)}`))}${tied.length > 6 ? ' and others' : ''}. The rule for ties on this page: take the pair that is met first when reading the tokens from left to right. That is ${name} (${whereText}).`)
        + (best.count === 1 ? ' Every remaining pair occurs only once, so from here on a merge just glues one particular word together. It finds nothing that words have in common.' : ' It is chosen because it is the commonest: one new token can stand in for it in the most places.'),
      views: [corpus({ pair: [best.a, best.b], role: 'compare' }), ledger(counts, best, -1)],
      vars: { round: k, pair: `${say(best.a)} + ${say(best.b)}`, count: best.count, 'tied pairs': tied.length },
    }));

    const before = sizeOf(words);
    let hits = 0;
    words = words.map((w) => { const r = mergeWord(w, best.a, best.b); hits += r.hits; return r.out; });
    const after = sizeOf(words);
    const token = best.a + best.b;
    const isNew = !vocabulary.has(token);
    vocabulary.add(token);
    merges.push({ a: best.a, b: best.b, token, count: best.count });
    rounds.push({ counts: [...counts.values()].map((e) => [e.a, e.b, e.count]), total, pair: [best.a, best.b], count: best.count, tied: tied.length, hits, before, after });
    t.count('merges');
    t.count('tokens in the text', -hits);
    t.frame(() => ({
      line: [6, 7],
      note: `Merge: wherever ${say(best.a)} is followed by ${say(best.b)}, the two become the single token **${say(token)}**. That happens ${plural(hits, 'time', 'times')}, and each replacement turns two tokens into one, so the text goes from ${before} tokens to **${after}**.`
        + (hits < best.count ? ` The pair was counted ${best.count} times, but some of those copies overlap and share a token, so only ${hits} could be replaced.` : '')
        + ` The rule "${say(best.a)} + ${say(best.b)}" becomes number ${merges.length} in the merge list. ${isNew ? `${say(token)} joins the vocabulary, which now has ${vocabulary.size} entries.` : `${say(token)} was already in the vocabulary, built another way, so the vocabulary stays at ${vocabulary.size} entries.`}`,
      views: [corpus({ token, role: 'current' }), ledger(null, null, merges.length - 1)],
      vars: { round: k, 'new token': say(token), replacements: hits, vocabulary: vocabulary.size },
    }));
  }
  const final = words.map((w) => w.slice());
  const finalSize = sizeOf(final);

  /* ---- split a word using only the merge list ---- */
  let wt = startTokens(newWord);
  const inTraining = seen.has(newWord);
  const unknown = [...new Set([...newWord])].filter((ch) => !base.includes(ch));
  const wordView = (hl) => ({
    kind: 'rows', title: `Splitting "${newWord}" with the merge list`,
    legend: unknown.length ? [{ label: 'character never seen in the training text', role: 'alert' }, { label: 'token just created', role: 'current' }] : [{ label: 'token just created', role: 'current' }, { label: 'end-of-word marker', role: 'dim' }],
    rows: [{ label: 'Tokens', cells: wt.map((tok) => ({ t: tok, role: hl && tok === hl.token ? hl.role : unknown.includes(tok) ? 'alert' : tok === MARK ? 'dim' : hl && hl.all ? hl.all : 'default' })) }],
  });
  const rulesView = (state) => ({
    kind: 'rows', title: 'The merge list, replayed in the order it was learned',
    legend: [{ label: 'rule being tried', role: 'current' }, { label: 'rule that applied', role: 'done' }, { label: 'rule that did not apply', role: 'dim' }],
    rows: [{ label: 'Merge list', cells: mergeCells(-1, state) }],
  });
  const applied = [];
  const stateAt = (now) => (i) => (i === now ? 'current' : i > now ? 'default' : applied[i] ? 'done' : 'dim');
  t.frame(() => ({
    line: [9, 10],
    note: `Now split a word using only the merge list: **${say(newWord)}**${inTraining ? ', which was in the training text' : ', which was not in the training text'}. Start the same way as before: single characters, then the marker. That is ${wt.length} tokens.`
      + (unknown.length ? ` ${unknown.length === 1 ? `The character ${say(unknown[0])} never appeared` : `The characters ${listOf(unknown.map(say))} never appeared`} in the training text, so ${unknown.length === 1 ? 'it is' : 'they are'} not in the vocabulary and no rule can involve ${unknown.length === 1 ? 'it' : 'them'}. A real tokenizer has to plan for this: either by keeping a special "unknown" token, or by starting from all 256 possible byte values so that nothing can be unknown.` : '')
      + (merges.length ? '' : ' The merge list is empty, so the word stays as single characters.'),
    views: [wordView(null), rulesView(stateAt(-1))],
    vars: { word: say(newWord), 'tokens in the word': wt.length },
  }));
  merges.forEach((m, i) => {
    const r = mergeWord(wt, m.a, m.b);
    const was = wt.length;
    applied.push(r.hits > 0);
    if (r.hits) wt = r.out;
    const now = wt.slice();
    t.frame(() => ({
      line: [11, 12],
      note: r.hits
        ? `Rule ${i + 1}, ${say(m.a)} + ${say(m.b)}: the word contains ${say(m.a)} followed by ${say(m.b)}${r.hits > 1 ? ` in ${r.hits} places` : ''}, so ${r.hits > 1 ? 'they are' : 'it is'} merged into **${say(m.token)}**. The word goes from ${was} tokens to ${now.length}: ${now.map(say).join(' ')}.`
        : `Rule ${i + 1}, ${say(m.a)} + ${say(m.b)}: the word has no ${say(m.a)} followed by ${say(m.b)}, so nothing changes.${i === 0 && merges.length > 1 ? ' The rules must be tried in the order they were learned, because later rules are built from tokens that earlier rules create.' : ''}`,
      views: [wordView(r.hits ? { token: m.token, role: 'current' } : null), rulesView(stateAt(i))],
      vars: { word: say(newWord), rule: i + 1, 'tokens in the word': now.length },
    }));
  });
  const wordTokens = wt.slice();

  // Undo the merges on the training text, last rule first, and check that nothing was lost.
  let undone = final.map((w) => w.slice());
  for (let i = merges.length - 1; i >= 0; i--) {
    const m = merges[i];
    undone = undone.map((w) => w.flatMap((tok) => (tok === m.token ? [m.a, m.b] : [tok])));
  }
  const decoded = final.map((w) => w.join('')).join('').split(MARK).slice(0, -1).join(' ');
  const restored = undone.every((w, i) => w.length === initial[i].length && w.every((tok, j) => tok === initial[i][j]));
  if (!restored || decoded !== normalized) throw new Error('Internal error: undoing the merges did not give back the training text.');

  const pieces = wordTokens.map(say).join(' + ');
  t.frame(() => ({
    line: [8, 13],
    note: `Done. **${say(newWord)}** becomes ${plural(wordTokens.length, 'token', 'tokens')}: ${pieces}.${!inTraining && !unknown.length && wordTokens.length < newWord.length + 1 ? ' The word was never in the training text, yet it is built from pieces learned from other words.' : ''} The training text went from ${startSize} tokens to ${finalSize} with ${plural(merges.length, 'merge', 'merges')}, and the vocabulary grew from ${base.length} entries to ${vocabulary.size}. As a check, the merges were undone on the training text, last rule first: every token split back into its two parts until only single characters and markers were left, and they spell the original text exactly. Nothing is lost by tokenising.`,
    views: [wordView({ all: 'done' }), corpus({ all: 'done' })],
    vars: { 'tokens in the word': wordTokens.length, vocabulary: vocabulary.size },
  }));

  return {
    text: normalized, words: source, initial, final, startSize, finalSize, base, vocabulary: [...vocabulary],
    merges: merges.map((m) => [m.a, m.b]), rounds, stoppedEarly, wanted,
    word: newWord, wordTokens, unknown, inTraining, decoded,
  };
}

/* ---- independent references for the tests ---- */

// The same method written a different way: each word is one string with spaces between its
// tokens, pairs are found by splitting, and a merge is a regular-expression replacement.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function referenceCounts(lines) {
  const counts = {};
  const order = [];
  for (const line of lines) {
    const parts = line.split(' ');
    for (let i = 1; i < parts.length; i++) {
      const key = `${parts[i - 1]} ${parts[i]}`;
      if (!(key in counts)) { counts[key] = 0; order.push(key); }
      counts[key]++;
    }
  }
  return { counts, order };
}
const referenceMerge = (lines, a, b) => {
  const re = new RegExp(`(?<![^ ])${escapeRe(a)} ${escapeRe(b)}(?![^ ])`, 'g');
  return lines.map((line) => line.replace(re, () => a + b));
};
const tokensIn = (lines) => lines.reduce((n, line) => n + line.split(' ').length, 0);

function countsAgree(r) {
  let lines = r.words.map((w) => [...w, MARK].join(' '));
  if (tokensIn(lines) !== r.startSize) return `start size ${r.startSize}, reference says ${tokensIn(lines)}`;
  for (let k = 0; k < r.rounds.length; k++) {
    const round = r.rounds[k];
    const ref = referenceCounts(lines);
    if (round.counts.length !== ref.order.length) return `round ${k + 1}: ${round.counts.length} different pairs reported, reference finds ${ref.order.length}`;
    for (const [a, b, c] of round.counts) if (ref.counts[`${a} ${b}`] !== c) return `round ${k + 1}: pair "${a} ${b}" reported ${c} times, reference counts ${ref.counts[`${a} ${b}`]}`;
    const top = Math.max(...ref.order.map((key) => ref.counts[key]));
    const first = ref.order.find((key) => ref.counts[key] === top);
    if (first !== `${round.pair[0]} ${round.pair[1]}` || round.count !== top) return `round ${k + 1}: merged "${round.pair.join(' ')}", but the first pair with the highest count is "${first}"`;
    if (round.before !== tokensIn(lines)) return `round ${k + 1}: token count before the merge is wrong`;
    lines = referenceMerge(lines, round.pair[0], round.pair[1]);
    if (round.after !== tokensIn(lines)) return `round ${k + 1}: ${round.after} tokens reported after the merge, reference has ${tokensIn(lines)}`;
  }
  const mine = r.final.map((w) => w.join(' '));
  return mine.every((line, i) => line === lines[i]) || 'the final tokens differ from the reference';
}

function undoRestores(r) {
  let cur = r.final.map((w) => w.slice());
  for (let i = r.merges.length - 1; i >= 0; i--) {
    const [a, b] = r.merges[i];
    cur = cur.map((w) => { const out = []; for (const tok of w) { if (tok === a + b) out.push(a, b); else out.push(tok); } return out; });
  }
  const chars = r.words.map((w) => [...w, MARK]);
  if (JSON.stringify(cur) !== JSON.stringify(chars)) return 'undoing the merges did not give back the single characters';
  const glued = r.final.flat().join('');
  if (glued.split(MARK).slice(0, -1).join(' ') !== r.text || r.decoded !== r.text) return 'gluing the tokens together did not give back the text';
  return true;
}

function neverRises(r) {
  let size = r.startSize;
  for (const [k, round] of r.rounds.entries()) {
    if (round.before !== size) return `round ${k + 1} starts from ${round.before} tokens, expected ${size}`;
    if (round.after > round.before) return `round ${k + 1}: the token count rose from ${round.before} to ${round.after}`;
    if (round.before - round.after !== round.hits) return `round ${k + 1}: ${round.hits} replacements but the count fell by ${round.before - round.after}`;
    if (round.hits < 1 || round.hits > round.count) return `round ${k + 1}: ${round.hits} replacements for a pair counted ${round.count} times`;
    size = round.after;
  }
  return size === r.finalSize || 'the final size does not follow from the rounds';
}

// A different way to split a word: keep merging whichever pair present has the earliest rule.
function rankTokenise(word, merges) {
  const rank = new Map();
  merges.forEach(([a, b], i) => { if (!rank.has(`${a} ${b}`)) rank.set(`${a} ${b}`, i); });
  let w = [...word, MARK];
  for (;;) {
    let best = -1;
    for (let i = 0; i + 1 < w.length; i++) {
      const rk = rank.get(`${w[i]} ${w[i + 1]}`);
      if (rk !== undefined && (best < 0 || rk < best)) best = rk;
    }
    if (best < 0) return w;
    const [a, b] = merges[best];
    const out = [];
    for (let i = 0; i < w.length;) { if (i + 1 < w.length && w[i] === a && w[i + 1] === b) { out.push(a + b); i += 2; } else { out.push(w[i]); i++; } }
    w = out;
  }
}
const all = (...checks) => (r, c) => { for (const check of checks) { const v = check(r, c); if (v !== true) return v; } return true; };
const sound = all(countsAgree, undoRestores, neverRises, (r) => r.wordTokens.join('') === r.word + MARK || 'the tokens of the new word do not spell the word',
  (r) => r.wordTokens.join(' ') === rankTokenise(r.word, r.merges).join(' ') || `the word was split as ${r.wordTokens.join(' ')}, the reference gives ${rankTokenise(r.word, r.merges).join(' ')}`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const DEFAULTS = { text: 'slow slow slower fastest fastest oldest', merges: 6, word: 'slowest' };
const SENTENCE = 'the cat sat on the mat and the rat sat on the cat';
const QUIET = { count() {}, frame() {} };

// Experiment text: a paragraph written for this page, with the endings and stems repeated on purpose.
const PARAGRAPH = 'the slow boat was slower than the fast boat and the fastest boat was faster than the rest the old boat was the slowest and the oldest of the boats the new boat was newer and faster than the old boat but the newest boat was not the fastest';
const PARAGRAPH_WORDS = PARAGRAPH.split(' ').length;
const PARAGRAPH_START = PARAGRAPH.split(' ').reduce((n, w) => n + w.length + 1, 0);
const shuffledParagraph = (seed) => { const rng = makeRng(seed); return PARAGRAPH.split(' ').map((w) => rng.shuffle([...w]).join('')).join(' '); };

export default {
  meta: {
    id: 'byte-pair-encoding',
    name: 'Byte-Pair Encoding',
    aliases: ['BPE', 'tokenization', 'tokenizer', 'subword tokenization', 'byte pair encoding', 'subword units'],
    kind: 'algorithm',
    discipline: 'nlp',
    alsoIn: [
      { id: 'deep-learning', why: 'Many large language models, including the GPT family, read and write text as tokens from a byte-pair vocabulary, so it fixes what the network\'s inputs and outputs are.' },
      { id: 'information-theory', why: 'It began as a data compression method: a repeated pair of bytes is replaced by a single unused byte, and a table records the replacement.' },
    ],
    subfield: 'Tokenization',
    family: 'Subword vocabularies',
    lab: 'compression',
    year: 1994,
    authors: 'Philip Gage',
    summary: 'Builds a vocabulary of word pieces by repeatedly merging the most frequent adjacent pair of tokens in a text, then splits new text by replaying the same merges.',
    difficulty: 'intermediate',
    order: 830,
    paradigms: ['greedy'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n) when no merge is made', average: 'O(n · m)', worst: 'O(n · m)', class: 'quadratic' },
    space: { worst: 'O(n + m)', class: 'linear' },
    tags: {
      problems: ['split text into pieces a language model can read', 'how does a chatbot break words into tokens', 'handle a word never seen before', 'build a vocabulary from text', 'why do language models count tokens instead of words', 'make data smaller'],
      techniques: ['pair counting', 'greedy merging', 'merge list', 'subword units', 'dictionary coding'],
      applications: ['natural language', 'machine learning', 'data compression'],
    },
    prerequisites: ['concept:greedy', 'concept:array', 'concept:hashing'],
  },

  bigIdea: {
    simple: 'Byte-pair encoding is a way to chop text into pieces that a computer can treat as single units. Whole words make poor pieces. There are too many of them, and new ones keep turning up. Single letters make poor pieces too. There are only a few, but every text becomes a very long string of them. Byte-pair encoding finds pieces in between. It starts with the text split into single letters. Then it looks for the two neighbouring pieces that occur together most often, such as t next to h, and glues them into one new piece, th. It writes that rule down and looks again. After many rounds the common words have become single pieces. Rarer words are built from a few familiar chunks, the way slowest is slow plus est. Any new word can then be split by replaying the same rules in the same order. The pieces are called tokens. Language models, including the ones behind chatbots, read and write text as tokens made in this way or a similar one.',
    when: 'Use it when a model needs text as a sequence of items from a fixed list, and the text can contain any word at all: names, typing mistakes, other languages, computer code. The number of merges is the one setting, and it trades two costs against each other. Few merges give a small vocabulary and long token sequences. Many merges give short sequences and a large vocabulary, most of whose entries are rarely used. It is the wrong tool when you only want a file to be smaller: [LZ77](#/algorithm/lz77) followed by [Huffman coding](#/algorithm/huffman-coding) does that far better.',
    interesting: 'The method knows nothing about language. It only counts. Yet on English text the pieces it finds often look like stems and endings, because those are the strings that repeat. The same procedure works unchanged on any language, on computer code and on raw bytes, which is a large part of why it was adopted. It also means the pieces are sometimes odd: a split can fall in the middle of a syllable, and the same word can be split differently with and without a capital letter.',
    analogy: {
      title: 'Inventing shorthand as you go',
      text: 'Someone copying out a long document by hand notices that they keep writing the same two marks side by side. They invent one new mark for the pair and note it in a legend at the top of the page: "this mark means t then h". Later they notice the new mark often sits next to e, so they invent another mark for that, defined in terms of the first. The legend grows one line at a time, and each line may use marks defined above it. Anyone holding the legend can copy out new documents in the same shorthand, and can expand the shorthand back into the original letters.',
      limits: 'A person would invent shorthand for units that mean something. Byte-pair encoding follows the counts wherever they lead, so its pieces can cut across meaning. A person might also revise the legend later. Here a rule, once made, is never reconsidered, and the legend depends entirely on the one text it was built from. And when two pairs are equally common a person would use judgment, while the method needs a fixed tie rule so that everyone who repeats the work gets the same legend.',
    },
  },

  example: {
    setup: 'Learn two merges from the three-word text "ha ha hat", then use them to split the word "aha". A token is one piece of text that is treated as a unit. At the start every letter is its own token, and a marker, written _, is added at the end of each word. So the text starts as h a _ and h a _ and h a t _, which is 10 tokens.',
    steps: [
      'Count the neighbouring pairs inside each word. The pair h then a appears 3 times, once in each word. The pair a then _ appears 2 times. The pairs a then t, and t then _, appear once each.',
      'The commonest pair is h then a, so glue it into one token, ha. The text is now ha _ and ha _ and ha t _. Three replacements each saved one token: 10 − 3 = 7 tokens.',
      'Count again. The pair ha then _ appears 2 times. The pairs ha then t, and t then _, appear once each.',
      'The commonest pair is ha then _, so glue it into the token ha_. The text is now ha_ and ha_ and ha t _. Two replacements: 7 − 2 = 5 tokens. The merge list reads: first h + a, then ha + _.',
      'Now split "aha". Start with a h a _. Rule 1 finds h followed by a and glues them: a ha _. Rule 2 finds ha followed by _ and glues them: a ha_.',
    ],
    result: 'The word "aha" becomes 2 tokens: a and ha_. It was never in the training text, but it could still be split, using a piece learned from "ha". Notice that the rules were applied in the order they were learned. Rule 2 needs the token ha, and that token exists only after rule 1 has run.',
    tryInput: { text: 'ha ha hat', merges: 2, word: 'aha' },
  },

  terms: [
    { term: 'Token', meaning: 'One piece of text that is treated as a single unit: a letter, a chunk of a word, or a whole word.' },
    { term: 'Vocabulary', meaning: 'The complete list of tokens that are allowed. A language model can read and write nothing else.' },
    { term: 'Pair', meaning: 'Two tokens that stand next to each other in the text, in a particular order.' },
    { term: 'Merge', meaning: 'Gluing every copy of one pair into a single new token. Also the name for the rule that says which pair was glued.' },
    { term: 'Merge list', meaning: 'All the merge rules in the order they were learned. It is the whole result of training, and replaying it splits any new text.' },
    { term: 'End-of-word marker', meaning: 'An extra symbol put after the last letter of every word, written _ on this page, so that a token can record that it sits at the end of a word.' },
    { term: 'Tie', meaning: 'Two or more pairs with the same highest count. A fixed rule must say which one wins.' },
    { term: 'Subword', meaning: 'A token that is longer than a letter and shorter than a word, such as "est".' },
    { term: 'Tokenizer', meaning: 'A program that turns text into tokens using a fixed vocabulary, and tokens back into text.' },
  ],

  takeaway: 'Keep gluing together the two neighbouring pieces that occur most often, remember the order you did it in, and replay those steps to split any new text.',

  viz: {
    describe: 'Strips of labelled cells. The upper strip shows the training text as tokens, one row for each different word, with the number of copies of that word at the left. The end-of-word marker is drawn faintly. When a pair is chosen its cells turn ochre, and when it has been merged the new token is terracotta. The lower strip lists every pair with its count, in the order the pairs are first met, with the highest count in terracotta and any ties in ochre, and below that the merge list as it grows, in forest green. In the second half the upper strip shows one new word being split, and the lower strip shows the merge list being replayed: the rule being tried is terracotta, rules that applied are green, and rules that did not apply are faint. A character that never appeared in the training text is brick red.',
    inputs: [
      { id: 'text', type: 'text', label: 'Training text', default: DEFAULTS.text, maxLength: 120,
        help: 'Words separated by spaces, up to 120 characters. Capital and small letters count as different characters. The underscore is reserved for the end-of-word marker.' },
      { id: 'merges', type: 'range', label: 'Number of merges', min: 0, max: 30, step: 1, default: DEFAULTS.merges,
        help: 'How many rules to learn. Learning stops sooner if every word has become a single token.' },
      { id: 'word', type: 'text', label: 'Word to split', default: DEFAULTS.word, maxLength: 20 },
    ],
    presets: [
      { label: 'Shared stems and endings', values: { ...DEFAULTS } },
      { label: 'The worked example', values: { text: 'ha ha hat', merges: 2, word: 'aha' } },
      { label: 'A sentence', values: { text: SENTENCE, merges: 9, word: 'that' } },
      { label: 'A letter never seen in training', values: { ...DEFAULTS, word: 'quickest' } },
      { label: 'Overlapping pairs', values: { text: 'aaaa', merges: 1, word: 'aaa' } },
      { label: 'Merge until nothing is left', values: { ...DEFAULTS, merges: 30 } },
    ],
    tryThis: [
      'Run the default text and stop at round 2. Five pairs are tied with a count of 3. Check the tie rule yourself: read the tokens from the top row, left to right, and find which of the five you meet first.',
      'Change the word to split from "slowest" to "slower", then to "oldest". "slower" was in the training text and still comes out as several tokens, because 6 merges were not enough to build it. Raise the number of merges and watch it shrink to one token at 13.',
      'Load "A letter never seen in training". The word "quickest" keeps its ending as the token est_, but q, u, i, c and k stay as single characters that the vocabulary does not contain. No number of merges can fix that. Only different training text can.',
      'Load "Merge until nothing is left". From round 11 on, every pair occurs only once, and learning stops by itself after 16 merges with each training word a single token. The vocabulary has memorised the text. Now try the word "slowest" against it: the pieces slow and est_ are still what it finds.',
      'Load "Overlapping pairs". The word aaaa contains the pair a + a three times, but the copies share letters, so only two replacements are possible and the text falls from 5 tokens to 3, not to 2.',
    ],
    run,
    report: (r, c) => `Training text: ${plural(r.words.length, 'word', 'words')}, ${r.startSize} tokens at the start (single characters plus one end marker per word).\nMerges learned (${r.merges.length}${r.stoppedEarly ? `, fewer than the ${r.wanted} asked for because no pairs were left` : ''}):\n${r.merges.map(([a, b], i) => `  ${i + 1}. ${a} + ${b} → ${a + b}   (counted ${r.rounds[i].count}, ${r.rounds[i].before} → ${r.rounds[i].after} tokens)`).join('\n') || '  none'}\nTokens after merging: ${r.finalSize}. Vocabulary: ${r.base.length} starting symbols, ${r.vocabulary.length} in all.\n"${r.word}" → ${r.wordTokens.join(' ')}   (${plural(r.wordTokens.length, 'token', 'tokens')}${r.unknown.length ? `; not in the vocabulary: ${r.unknown.join(' ')}` : ''})\n${(c['pairs counted'] || 0).toLocaleString('en-US')} pairs counted in all. Ties go to the pair met first, reading left to right.`,
    experiment: {
      title: 'Tokens left as the number of merges grows',
      note: `Each point is a real run on a ${PARAGRAPH_WORDS}-word paragraph written for this page, which starts as ${PARAGRAPH_START} tokens. The first merges remove many tokens each, because the commonest pairs are very common. Later merges remove fewer and fewer. The second series is the same paragraph with the letters shuffled inside every word: the same letters, but far less repetition for the method to find. The upper line is the most that could be left, since every merge removes at least one token. The lower line is the number of words, which is as short as the text can get, because no token spans two words.`,
      metric: 'tokens in the text',
      metricLabel: 'Tokens in the training text',
      sizeLabel: 'Number of merges',
      sizes: [0, 5, 10, 20, 40, 80],
      variants: [
        { id: 'text', label: 'The paragraph' },
        { id: 'shuffled', label: 'Letters shuffled inside each word' },
      ],
      input: (m, variant, seed) => ({ text: variant === 'shuffled' ? shuffledParagraph(seed) : PARAGRAPH, merges: m, word: 'slowest' }),
      theory: [
        { label: 'start − merges (never below the number of words)', fn: (m) => Math.max(PARAGRAPH_WORDS, PARAGRAPH_START - m), variant: 'shuffled' },
        { label: 'number of words', fn: () => PARAGRAPH_WORDS, variant: 'text' },
      ],
    },
  },

  logic: {
    intuition: 'A pair of tokens that keeps turning up side by side is carrying less information than it seems to: once you have seen the first, the second is no surprise. Giving the pair a name of its own shortens the text everywhere at once, at the cost of one more entry in the vocabulary. After the merge the text is different, so the counts are different, and the new token can itself become half of the next commonest pair. That is how single letters grow into stems, endings and whole words. The procedure is greedy: each round takes the pair that is commonest right now and never goes back. The merge list is all that needs to be kept. Because each rule only glues two existing tokens together, replaying the rules in order on any text reproduces the same decisions, and splitting every token back into its two parts undoes them.',
    steps: [
      'Split the training text into words. Write each word as its single characters followed by the end-of-word marker.',
      'Count how often each pair of neighbouring tokens occurs, looking inside words only.',
      'Pick the pair with the highest count. If several are tied, pick the one met first when reading the tokens from left to right.',
      'Replace every copy of that pair with one new token made by joining the two, scanning each word from left to right. Add the rule to the end of the merge list.',
      'Repeat from step 2 until the chosen number of merges has been made, or no pairs are left.',
      'To split new text, write each word as characters plus the marker, then apply every rule in the merge list, in the order learned.',
    ],
    pseudocode: [
      'learn(text, merges):',
      '  write each word as its characters followed by _',
      '  repeat merges times:',
      '    count every adjacent pair of tokens inside the words',
      '    if there are no pairs: stop',
      '    best ← the pair with the highest count (first met wins a tie)',
      '    replace every best pair, left to right, by one joined token',
      '    append best to the merge list',
      '  return the merge list',
      'split(word, merge list):',
      '  tokens ← the characters of word followed by _',
      '  for each pair in the merge list, in the order learned:',
      '    replace every such pair in tokens by its joined token',
      '  return tokens',
    ],
    decisions: [
      { title: 'How are ties broken?', text: 'Some rule is needed, because ties are common, and the choice changes the vocabulary. On this page the tied pair that is met first when reading the current tokens from left to right wins. The demonstration, the pseudocode and all three code samples use that rule. Other implementations use other rules, such as alphabetical order, and some leave it to the order in which a hash table happens to list its entries, so two tools can learn different merges from the same text.' },
      { title: 'Why mark the end of a word?', text: 'Without a marker the tokens "est" in "fastest" and "est" in "estimate" would be the same token, and it would be impossible to tell from a list of tokens where one word stops and the next begins. With the marker, est_ means "est at the end of a word", and gluing the tokens together and turning each marker into a space gives the text back. Other tokenizers mark the start of a word instead, or treat the space as an ordinary character attached to the word that follows it.' },
      { title: 'Why not merge across words?', text: 'Counting pairs inside words only keeps tokens from spanning two words, which keeps the vocabulary reusable: "the" is useful everywhere, while "the cat" is not. It also lets an implementation work on a list of different words with their counts, which is far shorter than the text.' },
      { title: 'How many merges?', text: 'This is the one setting, chosen in advance, and it fixes the vocabulary size: the starting symbols plus at most one token per merge. Published language-model vocabularies mostly hold tens of thousands of tokens, and some hold a few hundred thousand.' },
      { title: 'Characters or bytes?', text: 'This page starts from the characters that occur in the training text, so a character that does not occur there cannot be represented. Byte-level versions start instead from the 256 possible byte values. Every text in a computer is a sequence of bytes, so nothing is ever outside the vocabulary.' },
    ],
    invariants: [
      'Gluing the tokens of a word together, in order, always spells the word followed by the marker. A merge joins two neighbours and changes nothing else.',
      'The number of tokens never rises. Each merge lowers it by the number of replacements made, which is at least 1.',
      'Every token longer than one character is the two halves of some rule in the merge list, joined.',
      'All copies of the same word are split in the same way at every moment, because the same rules are applied to the same characters.',
    ],
    edgeCases: [
      'Overlapping copies of a pair: in a a a the pair a + a is counted twice, but replacing the first copy uses up the middle a, so only one replacement is made. The count overstates the saving.',
      'Every pair occurring once: a merge then joins part of one particular word and finds nothing shared. Many implementations stop when the best count falls below 2.',
      'More merges asked for than the text can supply: once every word is a single token there are no pairs left, and learning stops.',
      'A character in new text that never occurred in the training text: no rule mentions it. It needs an "unknown" token, or a byte-level starting vocabulary.',
      'A one-letter word: it starts as the letter and the marker, which is one pair, and can still be merged.',
      'The same token built two ways, for example abc from a + bc and from ab + c: both rules are kept, and the vocabulary gains one entry, not two.',
    ],
    correctness: 'There are two things to be right about. The first is that nothing is lost. Each merge replaces two neighbouring tokens by the token whose text is the two joined, so the text spelled by the tokens never changes. Splitting a token back into the two halves named by its rule reverses one merge, and doing that for every rule from last to first reaches single characters, because the halves of a rule existed before the rule was made and so are undone later. The second is that new text is split consistently. Splitting applies the rules in the order they were learned, which is the order in which training applied them to its own text, so a word that occurs in the training text is split exactly as it was at the end of training. What the method does not promise is the best vocabulary. Taking the commonest pair at every step is a greedy choice, and a different sequence of merges can sometimes describe the same text in fewer tokens with a vocabulary of the same size. Finding the best sequence is a far harder search, and in practice the greedy answer is what is used.',
    mistakes: [
      'After replacing a pair, moving on by one token and not two. The second half of the pair is then copied again and the text grows.',
      'Applying the rules to new text in some other order, such as longest first or alphabetical. Later rules depend on tokens that earlier rules create.',
      'Counting pairs across the boundary between two words when the design says tokens must stay inside words.',
      'Leaving ties to the order of a hash table. The result can then change between runs, machines or library versions.',
      'Training one vocabulary and splitting with another. A model trained on one set of tokens cannot read tokens from a different merge list.',
      'Forgetting that capital letters, accents and leading spaces are different characters, so "The", "the" and " the" can each be split differently.',
    ],
  },

  code: {
    sample: {
      input: 'Learn 6 merges from the text "slow slow slower fastest fastest oldest", printing each rule with the count of its pair and the number of tokens left. Then split the words "slowest" and "faster" with the learned rules. Ties go to the pair met first, reading left to right.',
      expected: 'start: 40 tokens\nmerge 1: s + t -> st (count 5, 35 tokens left)\nmerge 2: s + l -> sl (count 3, 32 tokens left)\nmerge 3: sl + o -> slo (count 3, 29 tokens left)\nmerge 4: slo + w -> slow (count 3, 26 tokens left)\nmerge 5: e + st -> est (count 3, 23 tokens left)\nmerge 6: est + _ -> est_ (count 3, 20 tokens left)\nslowest -> slow est_\nfaster -> f a st e r _',
    },
    python: {
      source: `TEXT = "slow slow slower fastest fastest oldest"
MERGES = 6


def count_pairs(words):
    """Count every adjacent pair of tokens inside the words."""
    counts = {}
    for word in words:
        for a, b in zip(word, word[1:]):
            counts[(a, b)] = counts.get((a, b), 0) + 1
    return counts


def merge_pair(word, a, b):
    """Replace each a followed by b with the single token a + b, left to right."""
    out = []
    i = 0
    while i < len(word):
        if i + 1 < len(word) and word[i] == a and word[i + 1] == b:
            out.append(a + b)
            i += 2
        else:
            out.append(word[i])
            i += 1
    return out


def learn(text, merges):
    words = [list(w) + ["_"] for w in text.split()]
    print(f"start: {sum(len(w) for w in words)} tokens")
    rules = []
    for step in range(1, merges + 1):
        counts = count_pairs(words)
        if not counts:
            break
        best = max(counts, key=counts.get)
        a, b = best
        words = [merge_pair(w, a, b) for w in words]
        rules.append(best)
        left = sum(len(w) for w in words)
        print(f"merge {step}: {a} + {b} -> {a + b} (count {counts[best]}, {left} tokens left)")
    return rules


def split(word, rules):
    tokens = list(word) + ["_"]
    for a, b in rules:
        tokens = merge_pair(tokens, a, b)
    return tokens


rules = learn(TEXT, MERGES)
for word in ["slowest", "faster"]:
    print(f"{word} -> {' '.join(split(word, rules))}")`,
      notes: [
        { line: 9, text: 'Pairs are counted inside one word at a time. `zip(word, word[1:])` walks over each token together with its right-hand neighbour.' },
        { line: 21, text: 'After a replacement, skip two tokens, not one. Otherwise the second half of the pair would be copied again.' },
        { line: 29, text: 'Every word starts as its characters followed by the end-of-word marker.' },
        { line: 36, text: 'The tie rule. A Python dictionary lists its keys in the order they were first added, and `max` returns the first of several equal maxima, so the tied pair met first wins.' },
        { line: 47, text: 'Splitting new text replays the rules in the order they were learned. No counting is needed.' },
      ],
    },
    javascript: {
      source: `const TEXT = "slow slow slower fastest fastest oldest";
const MERGES = 6;

// Count every adjacent pair of tokens inside the words.
// A Map lists its entries in the order they were first added.
function countPairs(words) {
  const counts = new Map();
  for (const word of words) {
    for (let i = 0; i + 1 < word.length; i++) {
      const key = word[i] + " " + word[i + 1];
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

// Replace each a followed by b with the single token a + b, left to right.
function mergePair(word, a, b) {
  const out = [];
  let i = 0;
  while (i < word.length) {
    if (i + 1 < word.length && word[i] === a && word[i + 1] === b) {
      out.push(a + b);
      i += 2;
    } else {
      out.push(word[i]);
      i += 1;
    }
  }
  return out;
}

const sizeOf = (words) => words.reduce((n, w) => n + w.length, 0);

function learn(text, merges) {
  let words = text.split(" ").map((w) => [...w, "_"]);
  console.log("start: " + sizeOf(words) + " tokens");
  const rules = [];
  for (let step = 1; step <= merges; step++) {
    const counts = countPairs(words);
    if (counts.size === 0) break;
    let best = null;
    for (const [key, count] of counts) {
      // Strictly more, so the tied pair met first wins.
      if (best === null || count > counts.get(best)) best = key;
    }
    const [a, b] = best.split(" ");
    words = words.map((w) => mergePair(w, a, b));
    rules.push([a, b]);
    console.log("merge " + step + ": " + a + " + " + b + " -> " + a + b +
      " (count " + counts.get(best) + ", " + sizeOf(words) + " tokens left)");
  }
  return rules;
}

function split(word, rules) {
  let tokens = [...word, "_"];
  for (const [a, b] of rules) tokens = mergePair(tokens, a, b);
  return tokens;
}

const rules = learn(TEXT, MERGES);
for (const word of ["slowest", "faster"]) {
  console.log(word + " -> " + split(word, rules).join(" "));
}`,
    },
    cpp: {
      source: `#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

using Word = std::vector<std::string>;
using Pair = std::pair<std::string, std::string>;

Word to_tokens(const std::string& word) {
    Word tokens;
    for (char c : word) tokens.push_back(std::string(1, c));
    tokens.push_back("_");
    return tokens;
}

// Replace each a followed by b with the single token a + b, left to right.
Word merge_pair(const Word& word, const Pair& p) {
    Word out;
    std::size_t i = 0;
    while (i < word.size()) {
        if (i + 1 < word.size() && word[i] == p.first && word[i + 1] == p.second) {
            out.push_back(p.first + p.second);
            i += 2;
        } else {
            out.push_back(word[i]);
            i += 1;
        }
    }
    return out;
}

std::size_t size_of(const std::vector<Word>& words) {
    std::size_t n = 0;
    for (const Word& w : words) n += w.size();
    return n;
}

std::vector<Pair> learn(const std::string& text, int merges) {
    std::vector<Word> words;
    std::istringstream in(text);
    for (std::string w; in >> w;) words.push_back(to_tokens(w));
    std::cout << "start: " << size_of(words) << " tokens\\n";
    std::vector<Pair> rules;
    for (int step = 1; step <= merges; ++step) {
        std::map<Pair, int> counts;
        std::vector<Pair> met;  // the pairs in the order first met, for the tie rule
        for (const Word& w : words) {
            for (std::size_t i = 0; i + 1 < w.size(); ++i) {
                Pair p(w[i], w[i + 1]);
                if (counts[p]++ == 0) met.push_back(p);
            }
        }
        if (met.empty()) break;
        Pair best = met[0];
        for (const Pair& p : met) {
            if (counts[p] > counts[best]) best = p;  // strictly more, so the first met wins a tie
        }
        for (Word& w : words) w = merge_pair(w, best);
        rules.push_back(best);
        std::cout << "merge " << step << ": " << best.first << " + " << best.second << " -> "
                  << best.first + best.second << " (count " << counts[best] << ", "
                  << size_of(words) << " tokens left)\\n";
    }
    return rules;
}

Word split(const std::string& word, const std::vector<Pair>& rules) {
    Word tokens = to_tokens(word);
    for (const Pair& p : rules) tokens = merge_pair(tokens, p);
    return tokens;
}

int main() {
    std::vector<Pair> rules = learn("slow slow slower fastest fastest oldest", 6);
    for (const std::string word : {"slowest", "faster"}) {
        std::cout << word << " ->";
        for (const std::string& token : split(word, rules)) std::cout << " " << token;
        std::cout << "\\n";
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The version on this page recounts every pair before every merge. With n tokens in the training text and m merges that is O(n · m): each round reads the text once to count and once more to replace. Splitting one new word of L characters by replaying the whole list costs O(m · L).',
    cases: [
      { case: 'Learning, recounting each round', time: 'O(n · m)', when: 'What the demonstration and the code samples do. Simple, and fine for small texts.' },
      { case: 'Learning, updating counts in place', time: 'Work per merge proportional to the places the pair occurs', when: 'Practical trainers keep the pair counts between rounds and adjust only the pairs next to each replacement, with a priority queue to find the commonest pair.' },
      { case: 'Splitting one word', time: 'O(m · L) by replaying every rule', when: 'Practical tokenizers look only at the pairs present in the word and merge the one with the earliest rule, and they remember the result for each word they have already split.' },
    ],
    space: 'O(n) for the text as tokens and for the table of pair counts, which has at most one entry per pair in the text, plus O(m) for the merge list.',
    memory: 'Working on the list of different words with their counts, instead of the running text, cuts the memory and the time sharply, because a large text repeats a small number of words very often.',
    tradeoffs: 'The number of merges trades vocabulary size against sequence length. Every merge adds at most one entry to the vocabulary and removes at least one token from the training text, and the saving per merge shrinks as the common pairs are used up. The chart shows that curve on a real run.',
    assumptions: [
      'n is the number of tokens in the training text at the start: its characters plus one marker per word. m is the number of merges.',
      'Looking up and updating a pair count takes constant time, as it does on average with a hash table.',
      'Comparing or joining two tokens is counted as one step. Tokens are short, but joining strings is not strictly constant time.',
      'The chart counts tokens left in the training text, not running time.',
    ],
  },

  tradeoffs: {
    struggles: [
      'Text unlike the training text. A vocabulary learned from English splits another language, or a rare technical word, into many tiny pieces.',
      'Tasks that depend on the letters inside a word, such as spelling, counting letters or arithmetic on long numbers. A model that receives one token for a whole word is never shown its letters.',
      'Languages written without spaces between words. Splitting on spaces first does not work there, and tokenizers for them treat the text differently.',
      'Meaningful units. The pieces come from counts, so a split can fall inside a syllable or separate a stem from the wrong ending.',
    ],
    pitfalls: [
      'The number of tokens in a text is not the number of words. A rough figure often quoted for English is about four characters per token, but it varies widely with the text and the tokenizer.',
      'Small changes to the input, such as a leading space or a capital letter, can change the tokens completely.',
      'A vocabulary is fixed once a model has been trained with it. Changing the merge list afterwards means the model sees tokens it has never learned.',
      'Two implementations with different tie rules or different text clean-up give different vocabularies from the same text.',
    ],
    misunderstandings: [
      '"A token is a word." Sometimes. Common words usually become one token, but a rare word is several tokens, and a token can also be a single letter, a piece of punctuation or part of a number.',
      '"The tokenizer understands the language." It only counts neighbouring pairs. The stems and endings it finds are there because they repeat, not because anything knows what they mean.',
      '"Tokenising loses information." It does not. Gluing the tokens back together gives the original text exactly, and a test on this page checks that.',
      '"The tokenizer is part of the neural network and is learned with it." The merge list is built first, by counting, and then frozen. The network is trained afterwards on the tokens it produces.',
      '"Byte-pair encoding always picks the best possible vocabulary." It is greedy. It takes the commonest pair at each step, which is a good rule but is not guaranteed to give the fewest tokens.',
    ],
    constraints: [
      'Real tokenizers clean up and pre-split the text before any pair is counted, for example at spaces and punctuation, and those choices matter as much as the merging.',
      'Special tokens, such as one that marks the end of a document, are added to the vocabulary by hand and are never produced by merging.',
    ],
    alternatives: [
      { name: 'Whole words', when: 'The vocabulary of the task is small and closed. Any word outside the list becomes "unknown".' },
      { name: 'Single characters or bytes', when: 'Nothing may ever be unknown and long sequences are affordable. The sequences are several times longer than with subwords.' },
      { name: 'WordPiece', when: 'You are working with a model built on it, such as BERT. It grows a vocabulary by merging too, but chooses each merge by how much it improves a statistical model of the text, not by the raw count.' },
      { name: 'Unigram language model tokenization', when: 'You want the split of a word chosen by probability. It starts from a large set of candidate pieces and prunes it, and can offer several ways to split the same word.' },
      { id: 'lz77', name: 'LZ77 with Huffman coding', when: 'The goal is a smaller file, not a vocabulary for a model.' },
    ],
    comparison: {
      columns: ['', 'Whole words', 'Byte-pair encoding', 'Characters or bytes'],
      rows: [
        ['Vocabulary size', 'Very large, and never complete', 'Chosen in advance', 'Small and fixed'],
        ['Tokens per sentence', 'Fewest', 'In between', 'Most'],
        ['A word never seen before', 'Becomes "unknown"', 'Is spelled from smaller pieces', 'Is spelled letter by letter'],
        ['Needs training text', 'To list the words', 'To learn the merges', 'No'],
      ],
    },
  },

  applications: [
    { title: 'Tokenizers of the GPT models', status: 'established', text: 'OpenAI\'s first GPT model used a byte-pair vocabulary built with 40,000 merges, and GPT-2 used a byte-level version with a vocabulary of 50,257 tokens. The company publishes its tokenizers in an open-source library, tiktoken, which describes itself as a byte-pair encoding tokenizer.' },
    { title: 'Neural machine translation', status: 'established', text: 'Rico Sennrich, Barry Haddow and Alexandra Birch introduced byte-pair encoding to translation in 2016, so that a system with a fixed vocabulary could still read and produce rare words, names and compounds by spelling them from pieces. The original transformer used it for its English-German experiments.' },
    { title: 'Data compression', status: 'established', text: 'Philip Gage\'s 1994 method, the origin of the name, compresses a block of data by replacing its commonest pair of bytes with a byte value that is not used anywhere in the block, and repeating. Its decompression routine is short and fast.' },
    { title: 'Limits and prices stated in tokens', status: 'established', text: 'Services that offer language models state how much text a model can take in, and usually what a request costs, in tokens. How a text is split therefore decides how much of it fits and what it costs.' },
    { title: 'Sequences that are not natural language', status: 'illustrative', text: 'Because the method only counts neighbouring symbols, it can build a vocabulary for any sequence of symbols: computer code, musical notes written as text, or the letters of a DNA sequence.' },
  ],

  connections: [
    { to: 'concept:greedy', type: 'prerequisite', why: 'Byte-pair encoding is a greedy method: every round merges the pair that is commonest at that moment and never reconsiders an earlier merge.' },
    { to: 'huffman-coding', type: 'related', why: 'Huffman coding and byte-pair encoding are both greedy, both driven by counts, and both build their result from the bottom up by repeated joining. Huffman coding joins the two rarest symbols to decide code lengths, and byte-pair encoding joins the commonest neighbouring pair to make a new symbol.' },
    { to: 'lz77', type: 'related', why: 'LZ77 and byte-pair encoding both shorten text by reusing repeated strings. LZ77 points back to an earlier copy inside the text, while byte-pair encoding gives a repeated pair a name in a table that is kept apart from the text.' },
    { to: 'run-length-encoding', type: 'related', why: 'Run-length encoding replaces a run of one repeated symbol by a count. Byte-pair encoding replaces any repeated pair of symbols, and by doing so again and again it captures repeated strings of any length.' },
    { to: 'hash-table', type: 'related', why: 'Each round of byte-pair encoding counts pairs, and a hash table keyed by the pair is the usual way to keep those counts, giving one lookup per pair read.' },
    { to: 'attention', type: 'advanced', why: 'Byte-pair encoding turns text into a sequence of tokens, and attention is the step in a transformer that lets each of those tokens draw on the others. The merge list is fixed before the transformer is trained.' },
    { to: 'backpropagation', type: 'related', why: 'Every token in a byte-pair vocabulary is given its own list of weights inside a language model, and backpropagation is what trains those weights. The merges themselves are found by counting, with no gradients involved.' },
    { to: 'viterbi', type: 'related', why: 'A unigram tokenizer, the main alternative to byte-pair encoding, uses the Viterbi algorithm to find the most probable way to split a word. Byte-pair encoding replays its merge list instead and considers only one split.' },
    { to: 'concept:hashing', type: 'related', why: 'Counting how often each pair occurs in byte-pair encoding is a lookup-and-update job, which hashing makes fast.' },
    { to: 'discipline:deep-learning', type: 'application', why: 'Language models are trained on token sequences, and byte-pair encoding is one of the standard ways to produce them.' },
    { to: 'discipline:information-theory', type: 'related', why: 'Byte-pair encoding began as a compression method, and it works for the same reason all compression works: a pair that is predictable can be written more briefly.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'In each round of learning, which pair of tokens is merged?',
      options: ['The pair that makes the longest new token', 'The neighbouring pair that occurs most often in the training text', 'The two most common single tokens, wherever they are', 'A pair chosen at random'],
      answer: 1,
      explain: [
        'Length plays no part. A long pair that occurs once is a poor choice, because merging it saves a single token.',
        'Only the count of the pair matters, and the two tokens must stand next to each other. Ties are settled by a fixed rule.',
        'Two tokens can each be common without ever standing next to each other. The count that matters is the count of the pair.',
        'The method is deterministic. The same text, the same number of merges and the same tie rule always give the same merge list.',
      ],
    },
    {
      type: 'predict',
      q: 'The training text is the single word aaaa. With the end marker it is 5 tokens: a a a a _. The pair a + a is counted 3 times. After that pair is merged once through the text, how many tokens are left?',
      options: ['2', '3', '4', '5'],
      answer: 1,
      explain: [
        'That would need three replacements, but the three copies of the pair overlap. Replacing the first copy uses up two of the letters.',
        'Scanning from the left, the first two letters become aa, then the next two become aa, and the marker is left: aa aa _. Two replacements, so 5 − 2 = 3.',
        'Two replacements are made, not one. After the first, the scan carries on and finds the pair again in the third and fourth letters.',
        'The pair does occur, so the merge changes the text.',
      ],
      tryInput: { text: 'aaaa', merges: 1, word: 'aaa' },
    },
    {
      type: 'predict',
      q: 'Six merges are learned from "slow slow slower fastest fastest oldest". The word "slowest" is not in that text. How is it split?',
      options: ['s l o w e s t _ (single characters, because the word is unknown)', 'slow est_', 'slowest_', 'sl ow est _'],
      answer: 1,
      explain: [
        'Splitting does not look a word up. It replays the merge rules on the characters, and several rules apply here.',
        'The rules build slow from the first four letters, as they did for "slow" and "slower", and est_ from the ending, as they did for "fastest" and "oldest".',
        'That token would need a rule joining slow and est_, and those two never stood next to each other in the training text.',
        'The rules for sl, slo and slow all apply in turn, so the stem ends up as one token.',
      ],
      tryInput: { ...DEFAULTS },
    },
    {
      type: 'debug',
      q: 'After this function is used for a merge, the text has more characters than before. What is wrong?',
      code: `def merge_pair(word, a, b):
    out = []
    i = 0
    while i < len(word):
        if i + 1 < len(word) and word[i] == a and word[i + 1] == b:
            out.append(a + b)
        else:
            out.append(word[i])
        i += 1
    return out`,
      options: ['The test should compare word[i] with b and word[i + 1] with a', 'After a replacement the index must move on by 2, so that the second half of the pair is not copied again', 'out should start as a copy of word', 'The loop should stop at len(word) − 1'],
      answer: 1,
      explain: [
        'The pair is ordered: a first, then b. The test is right.',
        'With word = [a, b] the function returns [ab, b]: the b has been written twice. Skipping two tokens after a replacement fixes it.',
        'out is built from nothing, one token at a time. Starting from a copy would double everything.',
        'The last token must still be copied when it is not part of a pair. The guard i + 1 < len(word) already prevents reading past the end.',
      ],
    },
    {
      type: 'choice',
      q: 'Why must the merge rules be applied to new text in the order they were learned?',
      options: ['Because earlier rules are more important', 'Because a later rule can be built from a token that only an earlier rule creates', 'Because the rules are sorted alphabetically', 'It makes no difference. Any order gives the same tokens'],
      answer: 1,
      explain: [
        'Importance is not the reason. The reason is that the rules depend on one another.',
        'The rule "ha + _" can only fire once "h + a" has produced the token ha. Run in another order, it would find nothing to merge.',
        'They are in the order training found them, which is by count at the time, not alphabetical.',
        'Order matters. Applying "e + st" before "s + t" finds no st token and does nothing.',
      ],
    },
    {
      type: 'challenge',
      title: 'Stop recounting everything',
      prompt: 'The sample program counts every pair again before every merge. Rewrite it to work on a table of the different words with their counts, and to keep the pair counts between rounds: when a pair is merged inside a word, subtract that word\'s old pairs from the table and add its new ones, and leave every other word alone. Check that your version learns exactly the same merge list as the sample on a text of a few thousand words, ties included.',
      hints: ['Keep, for each pair, the set of words that contain it, so that a merge visits only those words.', 'The tie rule on this page depends on the order in which pairs are first met in the current tokens. The simplest way to keep the same answers is to break ties by that position, which you can recompute for the tied pairs only.'],
    },
  ],

  compare: {
    idea: 'Count neighbouring pairs of tokens, merge the commonest pair into a new token, repeat, and keep the ordered list of merges for splitting new text.',
    requires: 'A sample of the kind of text you will handle later, and a decision on how many pieces you want in the end. The same list of rules must then be used every time.',
    sensitivity: 'Deterministic once the tie rule is fixed. The pieces it finds depend entirely on the training text and on the number of merges.',
    memory: 'The text as tokens, a table of pair counts and the merge list: O(n + m).',
    difficulty: 'low',
    difficultyNote: 'The basic loop is a dozen lines. A fast version that updates the counts in place takes real care.',
    limits: 'The pieces come from counting, not from meaning, so a word can be cut in odd places. Text unlike the sample breaks into many small pieces. Once a language model has been trained on one set of pieces, the set cannot be changed.',
    useWhen: 'You need to cut text into pieces from a fixed list for a language model: few enough pieces to list, yet able to spell any word.',
  },

  advanced: {
    history: 'Philip Gage described byte-pair encoding in 1994, in an article in The C Users Journal, as a simple compression method: find the commonest pair of adjacent bytes, replace every copy by a byte value that does not occur in the data, record the replacement in a table, and repeat. In 2016 Rico Sennrich, Barry Haddow and Alexandra Birch adapted it to a different purpose. Neural translation systems of the time had a fixed vocabulary of whole words and could not handle words outside it. Their paper applied the same merging to characters, kept the merged pairs as a vocabulary of subword units, and showed that translation of rare words improved. The transformer paper of 2017 used byte-pair encoding for its English-German experiments, and OpenAI\'s GPT models adopted it, with GPT-2 in 2019 moving to bytes as the starting symbols so that any text could be represented.',
    derivation: 'A way to see why the commonest pair is the natural choice. Let the text have $N$ tokens and let a pair $(a, b)$ occur $c$ times without overlapping. Merging it leaves $N - c$ tokens and adds one entry to the vocabulary. So among all single merges, the one with the largest $c$ shortens the text most. That is the greedy step.\n\nThere is also a reading in terms of probability. Under a model that picks every token independently, with probability equal to its share of the text, a text is described well when its tokens really are close to independent. A pair that occurs far more often than its two halves would by chance is a place where that assumption fails, and merging the pair removes the failure. Byte-pair encoding uses the raw count $c$ as its score. WordPiece, as it is usually described, uses a score closer to this probability argument, which favours pairs that are frequent relative to their parts.\n\nThe greedy step is not optimal over several merges. Choosing a pair changes which pairs exist afterwards, and a slightly less common pair now can open the way to much larger savings later. The method accepts this for the sake of a procedure that is simple, fast and fully determined by its tie rule.',
    proof: '**Claim.** After any number of merges, undoing the rules from last to first returns every word to its single characters followed by the marker.\n\n**Proof.** Write $s(x)$ for the string spelled by token $x$. A merge of the pair $(a, b)$ replaces two neighbouring tokens by one token $y$ with $s(y) = s(a)s(b)$, so the string spelled by a word never changes. Now undo rule $k$, which made the string $s(a_k)s(b_k)$: every token spelling that string is split into $a_k$ and $b_k$. Both halves existed before rule $k$ was learned. If a half is longer than one character, some rule with a smaller number made it, and that rule is undone later. So after rules $k, k-1, \\ldots, 1$ have been undone, no token longer than one character can remain: each such token is the product of some rule, and when its earliest rule was undone it was split. The tokens left are single characters, they still spell the same string, and so they are the original characters in the original order. $\\blacksquare$',
    complexityProof: 'One round of the simple version reads every token once to count pairs and once to replace, so it costs time proportional to the current number of tokens, which is at most $n$. With $m$ rounds the total is $O(n \\cdot m)$. The token count falls by at least one per round, so the true total is at most $n + (n-1) + \\cdots + (n-m+1)$, which is still $O(n \\cdot m)$ when $m$ is small beside $n$. Since each round removes at least one token and a word cannot shrink below one token, at most $n - w$ merges are possible for a text of $w$ words.',
    variants: [
      { name: 'Byte-level byte-pair encoding', text: 'Starts from the 256 byte values instead of characters, so every possible text can be tokenised. GPT-2 introduced this for language models and RoBERTa uses it as well.' },
      { name: 'WordPiece', text: 'Used by BERT. It also grows a vocabulary by merging, but picks merges that most improve the likelihood of the training text under a simple language model. When splitting, it takes the longest piece in the vocabulary that matches at each position.' },
      { name: 'Unigram language model', text: 'Introduced by Taku Kudo in 2018. It starts with many candidate pieces, gives each a probability, and repeatedly removes the pieces whose loss hurts the likelihood least. A word is split into its most probable sequence of pieces.' },
      { name: 'SentencePiece', text: 'A tokenizer library by Taku Kudo and John Richardson that implements both byte-pair encoding and the unigram method directly on raw text. It treats the space as an ordinary symbol, so no separate word-splitting step is needed and languages without spaces are handled the same way.' },
      { name: 'Re-Pair', text: 'A compression method by Jesper Larsson and Alistair Moffat built on the same step: replace the commonest pair by a new symbol until no pair repeats. It is studied as a way of building a small grammar for a text.' },
    ],
    implementation: 'Work on a table of different words and their counts, not on the running text. Keep the pair counts between rounds and, for each pair, the words that contain it, so that a merge touches only those words. Find the commonest pair with a priority queue, and decide on a tie rule that does not depend on hash-table order. For splitting, give every rule its position in the merge list as a rank, repeatedly merge the pair in the word with the smallest rank, and cache the result per word. Decide early how text is cleaned and pre-split, and store that decision with the merge list, because the two together define the tokenizer.',
    benchmarking: 'A tokenizer is judged on two kinds of number. One is speed, in megabytes or tokens per second, for training and for splitting. The other is what it does to the text: the average number of tokens per word or per character on held-out text, and how that changes with the vocabulary size. Always measure on text that was not used for training, since the training text itself is split unusually well. Correctness is checked, not measured: splitting and gluing back must return the input exactly, for every input.',
    references: [
      { authors: 'P. Gage', year: 1994, title: 'A New Algorithm for Data Compression', venue: 'The C Users Journal' },
      { authors: 'R. Sennrich, B. Haddow and A. Birch', year: 2016, title: 'Neural Machine Translation of Rare Words with Subword Units', venue: 'Proceedings of the 54th Annual Meeting of the Association for Computational Linguistics (ACL)' },
      { authors: 'A. Radford, J. Wu, R. Child, D. Luan, D. Amodei and I. Sutskever', year: 2019, title: 'Language Models are Unsupervised Multitask Learners', venue: 'OpenAI technical report' },
      { authors: 'T. Kudo and J. Richardson', year: 2018, title: 'SentencePiece: A simple and language independent subword tokenizer and detokenizer for Neural Text Processing', venue: 'Proceedings of EMNLP 2018: System Demonstrations' },
      { authors: 'T. Kudo', year: 2018, title: 'Subword Regularization: Improving Neural Network Translation Models with Multiple Subword Candidates', venue: 'Proceedings of the 56th Annual Meeting of the Association for Computational Linguistics (ACL)' },
      { authors: 'N. J. Larsson and A. Moffat', year: 2000, title: 'Off-line dictionary-based compression', venue: 'Proceedings of the IEEE' },
    ],
    furtherReading: [
      'D. Jurafsky and J. H. Martin, *Speech and Language Processing* (3rd edition draft), the chapter that covers tokenization.',
      'The source code of OpenAI\'s tiktoken library, which includes an educational module that shows byte-pair encoding step by step.',
    ],
  },

  tests: [
    { name: 'pair counts match an independent count at every merge, on the default text', input: {}, check: sound },
    { name: 'the same on a sentence with nine merges', input: { text: SENTENCE, merges: 9, word: 'that' }, check: sound },
    { name: 'the same on a longer text with twenty merges', input: { text: PARAGRAPH.slice(0, 118), merges: 20, word: 'boathouse' }, check: sound },
    { name: 'the same when merging runs until no pairs are left', input: { ...DEFAULTS, merges: 30 }, check: sound },
    { name: 'the same with overlapping pairs and repeated letters', input: { text: 'aaaa aaa banana bandana', merges: 12, word: 'bananas' }, check: sound },
    { name: 'undoing the merges in reverse order returns the original text', input: { text: 'the  cat sat on   the mat', merges: 14, word: 'chat' },
      check: all(undoRestores, (r) => r.text === 'the cat sat on the mat' || 'runs of spaces were not treated as one') },
    { name: 'the number of tokens never rises after a merge', input: { text: SENTENCE, merges: 30, word: 'rat' },
      check: all(neverRises, (r) => (r.finalSize === r.words.length && r.stoppedEarly) || `finished with ${r.finalSize} tokens for ${r.words.length} words`) },
    { name: 'the default run learns the six merges shown in the code sample', input: {},
      check: (r, c) => (same(r.merges, [['s', 't'], ['s', 'l'], ['sl', 'o'], ['slo', 'w'], ['e', 'st'], ['est', '_']]) && same(r.rounds.map((x) => x.count), [5, 3, 3, 3, 3, 3])
        && same(r.rounds.map((x) => x.after), [35, 32, 29, 26, 23, 20]) && r.startSize === 40 && r.rounds[1].tied === 5 && same(r.wordTokens, ['slow', 'est_']) && !r.inTraining
        && c.merges === 6 && c['tokens in the text'] === 20 && c['pairs counted'] === r.rounds.reduce((s, x) => s + x.total, 0)) || `merges ${JSON.stringify(r.merges)}, word ${r.wordTokens.join(' ')}` },
    { name: 'a tie goes to the pair met first, reading left to right', input: { text: 'ab cd ab cd', merges: 1, word: 'ab' },
      check: (r) => (same(r.merges, [['a', 'b']]) && r.rounds[0].tied === 4 && same(run({ text: 'cd ab cd ab', merges: 1, word: 'ab' }, QUIET).merges, [['c', 'd']])) || `merged ${JSON.stringify(r.merges)}` },
    { name: 'the worked example by hand', input: { text: 'ha ha hat', merges: 2, word: 'aha' },
      check: (r) => (r.startSize === 10 && same(r.rounds[0].counts, [['h', 'a', 3], ['a', '_', 2], ['a', 't', 1], ['t', '_', 1]]) && same(r.rounds[1].counts, [['ha', '_', 2], ['ha', 't', 1], ['t', '_', 1]])
        && same(r.merges, [['h', 'a'], ['ha', '_']]) && same(r.rounds.map((x) => [x.before, x.hits, x.after]), [[10, 3, 7], [7, 2, 5]]) && same(r.final, [['ha_'], ['ha_'], ['ha', 't', '_']])
        && same(r.wordTokens, ['a', 'ha_'])) || `rounds ${JSON.stringify(r.rounds)}` },
    { name: 'overlapping copies: aaaa counts the pair 3 times and replaces it twice', input: { text: 'aaaa', merges: 1, word: 'aaa' },
      check: (r) => (r.rounds[0].count === 3 && r.rounds[0].hits === 2 && r.startSize === 5 && r.finalSize === 3 && same(r.final, [['aa', 'aa', '_']]) && same(r.wordTokens, ['aa', 'a', '_'])) || JSON.stringify(r.rounds) },
    { name: 'letters never seen in training are reported and left as single characters', input: { ...DEFAULTS, word: 'quickest' },
      check: (r) => (same(r.unknown, ['q', 'u', 'i', 'c', 'k']) && same(r.wordTokens, ['q', 'u', 'i', 'c', 'k', 'est_'])) || r.wordTokens.join(' ') },
    { name: 'merging until nothing is left stops after 16 merges, with pairs occurring once from round 11', input: { ...DEFAULTS, merges: 30 },
      check: (r) => (r.merges.length === 16 && r.stoppedEarly && r.finalSize === 6 && r.rounds[9].count === 2 && r.rounds[10].count === 1 && same(r.wordTokens, ['slow', 'est_'])
        && same(run({ ...DEFAULTS, merges: 12, word: 'slower' }, QUIET).wordTokens, ['slower', '_']) && same(run({ ...DEFAULTS, merges: 13, word: 'slower' }, QUIET).wordTokens, ['slower_'])
        && run({ ...DEFAULTS, word: 'slower' }, QUIET).wordTokens.length === 4) || `${r.merges.length} merges, counts ${r.rounds.map((x) => x.count).join(' ')}` },
    { name: 'the sentence preset splits "that" into th and at_', input: { text: SENTENCE, merges: 9, word: 'that' },
      check: (r) => (same(r.wordTokens, ['th', 'at_']) && r.startSize === 50 && r.finalSize === 18) || r.wordTokens.join(' ') },
    { name: 'with no merges the word stays as single characters', input: { ...DEFAULTS, merges: 0 },
      check: (r, c) => (r.merges.length === 0 && r.finalSize === r.startSize && same(r.wordTokens, [...'slowest', '_']) && c['tokens in the text'] === 40 && !c.merges) || r.wordTokens.join(' ') },
    { name: 'the experiment paragraph: bounds on the tokens left hold at every size', input: {},
      check: () => {
        for (const m of [0, 5, 10, 20, 40, 80]) {
          for (const text of [PARAGRAPH, shuffledParagraph(7)]) {
            const r = run({ text, merges: m, word: 'slowest' }, QUIET);
            if (r.startSize !== PARAGRAPH_START || r.words.length !== PARAGRAPH_WORDS) return 'the paragraph constants are wrong';
            if (r.finalSize > Math.max(PARAGRAPH_WORDS, PARAGRAPH_START - m) || r.finalSize < PARAGRAPH_WORDS) return `${m} merges leave ${r.finalSize} tokens, outside the stated bounds`;
            if (undoRestores(r) !== true || neverRises(r) !== true) return 'a property failed on the paragraph';
          }
        }
        return true;
      } },
  ],
};
