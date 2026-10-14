import { makeRng } from '../../js/lib/rng.js';

// LZ77 with (offset, length, next symbol) triples. Bit-cost model used throughout this lesson:
//   input   8 bits per symbol (every character is treated as one byte)
//   output  one triple costs
//             bits(W)   for the offset   (W possible distances 1..W; meaningless when length is 0)
//           + bits(L)   for the length   (L possible lengths 0..L-1)
//           + 8         for the next symbol
//           where bits(c) is the number of bits needed to tell c values apart.
//   With the defaults W = 16 and L = 8 that is 4 + 3 + 8 = 15 bits per triple.

const show = (ch) => (ch === ' ' ? '␣' : ch);
// Symbols quoted inside notes pass through the inline-markup parser, so the few characters it reacts to are swapped for look-alikes.
const say = (s) => [...s].map((ch) => ({ $: '＄', '*': '∗', '`': 'ˋ' }[ch] || show(ch))).join('');
const tripleText = ([offset, length, next]) => `(${offset},${length},${show(next)})`;

function bitsFor(count) {
  let bits = 0;
  while (2 ** bits < count) bits++;
  return bits;
}

function checkText(text) {
  if (!text.length) throw new Error('Type at least one character to compress.');
  for (const ch of text) {
    if (ch.codePointAt(0) > 255) throw new Error(`This lesson counts every character as one 8-bit byte, so it accepts only basic Latin characters. Remove "${ch}" and run it again.`);
  }
}

function run(input, t) {
  const text = String(input.text ?? '');
  checkText(text);
  const W = Math.max(1, Math.floor(Number(input.window) || 16));
  const L = Math.max(2, Math.floor(Number(input.lookahead) || 8));
  const n = text.length;
  const offsetBits = bitsFor(W), lengthBits = bitsFor(L);
  const tripleBits = offsetBits + lengthBits + 8;
  const inputBits = 8 * n;
  const triples = [];
  const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;

  const legend = [
    { label: 'search window', role: 'moss' },
    { label: 'look-ahead buffer', role: 'ochre' },
    { label: 'match and its earlier copy', role: 'active' },
    { label: 'next symbol, sent as it is', role: 'alert' },
  ];

  // i: current position. match: { offset, length } being shown, or null. emitted: highlight the newest triple.
  const views = (i, match, emitted) => {
    const winStart = Math.max(0, i - W);
    const aheadEnd = Math.min(n, i + L);
    const len = match ? match.length : 0;
    const src = match && len ? i - match.offset : -1;
    const nextAt = emitted ? i + len : -1;
    const inSource = (k) => src >= 0 && k >= src && k < src + len;
    const inCopy = (k) => len > 0 && k >= i && k < i + len;
    return [{
      kind: 'rows', title: `Encoding with a window of ${W} and a look-ahead of ${L}`, legend,
      rows: [
        { label: 'Text', cells: [...text].map((ch, k) => ({ t: show(ch), role: k < winStart ? 'dim' : k < i ? 'moss' : k < aheadEnd ? 'ochre' : 'default' })) },
        { label: 'Search window', cells: [...text.slice(winStart, i)].map((ch, j) => {
          const k = winStart + j;
          return { t: show(ch), sub: i - k, role: inSource(k) ? 'active' : 'moss' };
        }) },
        { label: 'Look-ahead', cells: [...text.slice(i, aheadEnd)].map((ch, j) => {
          const k = i + j;
          return { t: show(ch), role: k === nextAt ? 'alert' : inCopy(k) ? 'active' : 'ochre' };
        }) },
        { label: 'Triples', cells: triples.map((tr, j) => ({ t: tripleText(tr), role: emitted && j === triples.length - 1 ? 'current' : 'done' })) },
      ],
    }];
  };

  t.frame(() => ({
    line: 0,
    note: `The text has ${n} symbols. At 8 bits each that is **${inputBits} bits**. LZ77 reads it from left to right. At each position it looks back through the last ${W} symbols, the **search window**, for a copy of what comes next, and writes a triple: how far back, how many symbols to copy, and the one symbol that follows. A triple costs ${offsetBits} + ${lengthBits} + 8 = **${tripleBits} bits** here.`,
    views: views(0, null, false),
    vars: { 'input bits': inputBits, 'bits per triple': tripleBits },
  }));

  let i = 0;
  while (i < n) {
    const pos = i;
    const maxLength = Math.min(L - 1, n - pos - 1);
    const reach = Math.min(W, pos);
    let bestOffset = 0, bestLength = 0;
    t.frame(() => ({
      line: [2, 3],
      note: pos === 0
        ? `Start at the first symbol, **${say(text[0])}**. Nothing has been read yet, so the search window is empty and there is nothing to copy from.`
        : `Now at symbol ${pos + 1}. The search window holds the last ${plural(reach, 'symbol')}, and the number under each one is how far back it is. Look for the longest stretch that starts in the window and matches the start of the look-ahead, **${say(text.slice(pos, Math.min(n, pos + L)))}**.`,
      views: views(pos, null, false),
      vars: { position: pos + 1 },
    }));
    for (let offset = 1; offset <= reach; offset++) {
      let length = 0;
      while (length < maxLength) {
        t.count('comparisons');
        if (text[pos - offset + length] !== text[pos + length]) break;
        length++;
      }
      if (length > bestLength) {
        bestOffset = offset; bestLength = length;
        const o = offset, m = length;
        t.frame(() => ({
          line: [4, 5, 6, 7],
          note: `Going back ${o}: ${plural(m, 'symbol')} match, **${say(text.slice(pos, pos + m))}**. That is the longest match found so far.${m > o ? ' The match is longer than the distance back, so it runs on into symbols that are themselves part of the copy.' : ''}`,
          views: views(pos, { offset: o, length: m }, false),
          vars: { position: pos + 1, offset: o, length: m },
        }));
      }
    }
    const next = text[pos + bestLength];
    triples.push([bestOffset, bestLength, next]);
    t.count('triples');
    t.count('output bits', tripleBits);
    const o = bestOffset, m = bestLength;
    const covered = m + 1;
    const stoppedBy = m > 0 && m === maxLength
      ? (m === L - 1 ? ` The match stops at ${m} because that is the largest length the triple can hold.` : ' The match stops one symbol before the end of the text, because every triple must finish with a real symbol.')
      : '';
    t.frame(() => ({
      line: 8,
      note: m === 0
        ? `${reach === 0 ? 'There is nothing to copy.' : `Nothing in the window starts with ${say(next)}.`} Write the triple **(0, 0, ${say(next)})**, which just carries the symbol itself. It spends ${tripleBits} bits on 1 symbol that took 8 bits before.`
        : `The longest match is ${plural(m, 'symbol')}, found ${o} back.${stoppedBy} The symbol after it is ${say(next)}. Write the triple **(${o}, ${m}, ${say(next)})**: ${tripleBits} bits for ${covered} symbols that took ${8 * covered} bits before.`,
      views: views(pos, { offset: o, length: m }, true),
      vars: { position: pos + 1, offset: o, length: m, next: say(next) },
    }));
    i += bestLength + 1;
  }

  const outputBits = triples.length * tripleBits;

  // Decode, to show that the triples are enough to rebuild the text.
  const out = [];
  triples.forEach(([offset, length, next], k) => {
    const from = out.length - offset;
    for (let j = 0; j < length; j++) out.push(out[out.length - offset]);
    out.push(next);
    const size = out.length;
    t.frame(() => ({
      line: [13, 14, 15],
      note: length === 0
        ? `Decoding triple ${k + 1} of ${triples.length}, (0, 0, ${say(next)}): nothing to copy, so just write ${say(next)}.`
        : `Decoding triple ${k + 1} of ${triples.length}, (${offset}, ${length}, ${say(next)}): go back ${offset}, copy ${plural(length, 'symbol')} one at a time, then write ${say(next)}.${length > offset ? ' The copy overtakes its own starting point. That works because each symbol is written before it is needed again.' : ''}`,
      views: [{
        kind: 'rows', title: 'Decoding',
        legend: [{ label: 'triple being decoded, and the symbols it copied', role: 'current' }, { label: 'earlier symbols it copied from', role: 'compare' }, { label: 'symbol carried by the triple', role: 'alert' }],
        rows: [
          { label: 'Triples', cells: triples.map((tr, j) => ({ t: tripleText(tr), role: j < k ? 'done' : j === k ? 'current' : 'default' })) },
          { label: 'Decoded', cells: out.slice(0, size).map((ch, j) => ({ t: show(ch), role: j === size - 1 ? 'alert' : j >= size - 1 - length ? 'active' : length > 0 && j >= from && j < from + length ? 'compare' : 'done' })) },
        ],
      }],
      vars: { 'decoded so far': size },
    }));
  });
  const decoded = out.join('');
  if (decoded !== text) throw new Error('Internal error: the decoded text does not match the input.');

  const percent = Math.round((100 * outputBits) / inputBits);
  t.frame(() => ({
    line: 16,
    note: outputBits < inputBits
      ? `Done. ${plural(triples.length, 'triple')} at ${tripleBits} bits each take **${outputBits} bits**, down from ${inputBits}: ${percent}% of the original size. Decoding gave back the text exactly.`
      : `Done. ${plural(triples.length, 'triple')} at ${tripleBits} bits each take **${outputBits} bits**, ${outputBits === inputBits ? 'the same as' : 'more than'} the ${inputBits} bits of the input. This text does not repeat itself enough within the window to pay for the triples. Decoding still gave back the text exactly.`,
    views: [{
      kind: 'rows', title: 'Result',
      rows: [
        { label: 'Text', cells: [...text].map((ch) => ({ t: show(ch), role: 'done' })) },
        { label: 'Triples', cells: triples.map((tr) => ({ t: tripleText(tr), role: 'done' })) },
        { label: 'Size', cells: [{ t: inputBits, sub: 'bits in' }, { t: outputBits, sub: 'bits out', role: outputBits > inputBits ? 'alert' : 'done' }] },
      ],
    }],
    vars: { 'input bits': inputBits, 'bits per triple': tripleBits },
  }));

  return { text, triples, decoded, inputBits, outputBits, window: W, lookahead: L, offsetBits, lengthBits, tripleBits, ratio: outputBits / inputBits };
}

/* ---- independent checks for the tests ---- */

// A separate decoder, written with string slicing instead of an array.
function referenceDecode(triples) {
  let s = '';
  for (const [offset, length, next] of triples) {
    for (let j = 0; j < length; j++) s += s[s.length - offset];
    s += next;
  }
  return s;
}
// Checks every triple against the definition: it must describe a real match, and no distance in the window may give a longer one.
function sound(r) {
  const { text, triples, window: W, lookahead: L } = r;
  if (r.decoded !== text) return 'decoding did not return the input';
  if (referenceDecode(triples) !== text) return 'the reference decoder did not return the input';
  if (r.inputBits !== 8 * text.length) return 'inputBits is not 8 × length';
  const cost = bitsFor(W) + bitsFor(L) + 8;
  if (r.tripleBits !== cost || r.outputBits !== triples.length * cost) return 'outputBits does not follow the stated cost model';
  let i = 0;
  for (const [offset, length, next] of triples) {
    if (length > L - 1 || offset > Math.min(W, i) || (length === 0) !== (offset === 0)) return `triple (${offset},${length},${next}) at position ${i} is out of range`;
    if (text[i + length] !== next) return `triple at position ${i} carries the wrong next symbol`;
    const cap = Math.min(L - 1, text.length - i - 1);
    const matchAt = (d) => { let m = 0; while (m < cap && text[i - d + m] === text[i + m]) m++; return m; };
    if (offset && matchAt(offset) < length) return `triple at position ${i} claims a match that is not there`;
    for (let d = 1; d <= Math.min(W, i); d++) {
      const m = matchAt(d);
      if (m > length) return `a longer match (${m} at distance ${d}) exists at position ${i}`;
      if (m === length && length > 0 && d < offset) return `a nearer match of the same length exists at position ${i}`;
    }
    i += length + 1;
  }
  return i === text.length || 'the triples do not cover the text exactly';
}
const triplesOf = (r) => r.triples.map(([o, m, s]) => `${o},${m},${s}`).join(' ');

// Experiment inputs: a passage that repeats its phrases, and random letters of the same length.
const PASSAGE = 'The tide comes in and the tide goes out. When the tide comes in, the boats rise with the water, '
  + 'and when the tide goes out, the boats rest on the sand. The fishermen watch the water and wait for the tide. '
  + 'They mend the nets while the boats rest, and they sail when the water returns. Day after day the tide comes in '
  + 'and the tide goes out, and the fishermen and the boats and the nets follow the water.';
function randomLetters(length, seed) {
  const rng = makeRng(seed + 77);
  const letters = 'abcdefghijklmnopqrstuvwxyz ';
  let s = '';
  for (let k = 0; k < length; k++) s += letters[rng.int(0, letters.length - 1)];
  return s;
}

export default {
  meta: {
    id: 'lz77',
    name: 'LZ77 Compression',
    aliases: ['LZ77', 'Lempel-Ziv 1977', 'LZ1', 'sliding window compression', 'Lempel-Ziv'],
    kind: 'algorithm',
    discipline: 'information-theory',
    alsoIn: [
      { id: 'algorithms', why: 'Finding the longest earlier match quickly is a string-searching problem, solved in practice with hash tables or suffix structures.' },
    ],
    subfield: 'Dictionary compression',
    family: 'Lempel-Ziv methods',
    lab: 'compression',
    compareGroup: 'lossless-compression',
    year: 1977,
    authors: 'Jacob Ziv and Abraham Lempel',
    summary: 'Replaces a repeated stretch of text with a pointer back to an earlier copy: how far back to go and how many symbols to copy.',
    difficulty: 'intermediate',
    order: 820,
    paradigms: ['greedy', 'incremental'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n · W / L)', average: 'O(n · W)', worst: 'O(n · W)', class: 'linear' },
    space: { worst: 'O(W + L), independent of the text length', class: 'constant' },
    tags: {
      problems: ['compress files', 'make data smaller', 'remove repeated text', 'zip a file', 'find repeated substrings'],
      techniques: ['sliding window', 'longest match', 'back-references', 'dictionary coding', 'lossless compression'],
      applications: ['data compression', 'networking', 'image processing', 'operating systems'],
    },
    prerequisites: ['run-length-encoding', 'concept:array', 'concept:greedy'],
  },

  bigIdea: {
    simple: "LZ77 is a way to make a text shorter by not writing the same thing twice. Think about how people write. Words and phrases come back again and again. LZ77 takes advantage of that. It reads the text from start to finish. At each point it looks back over the last stretch it has read and asks: have I seen what comes next before? If so, it does not write those letters again. It writes a short note instead: go back this far, and copy this many letters. If not, it writes the letter as it is. Someone holding the notes can rebuild the whole text, because every note points to something already rebuilt. The more a text repeats itself, the shorter it gets. A text with no repeats gets longer, because each note takes up room too.",
    what: 'LZ77 compresses a sequence by replacing repeated substrings with references to an earlier occurrence. It keeps a **sliding window** of the most recent symbols. At each step it finds the longest string in that window that matches what comes next and emits a triple (offset, length, next symbol): go back *offset* symbols, copy *length* of them, then append the next symbol.',
    why: 'Run-length encoding only notices a symbol repeated beside itself, and Huffman coding only notices that some symbols are common. Real data repeats whole words, phrases and structures at a distance. In 1977 Jacob Ziv and Abraham Lempel showed that a compressor does not need to be told the statistics of its source in advance: by pointing back into the data already seen, it adapts to whatever repetition is there.',
    when: 'Use an LZ77-family compressor as the general-purpose choice for text, program code, structured data and anything else that repeats substrings. Use [run-length encoding](#/algorithm/run-length-encoding) when the only redundancy is long runs and simplicity matters. Follow LZ77 with [Huffman coding](#/algorithm/huffman-coding) to squeeze the triples themselves, which is exactly what DEFLATE does.',
    interesting: 'The decoder never searches. All the expensive work of finding matches happens once, in the encoder, and decoding is nothing more than copying. A copy may even overlap itself: "go back 1, copy 6" turns one `a` into seven, because each copied symbol is in place before it is needed as a source.',
    where: 'DEFLATE, the format inside gzip, zip and PNG files, combines LZ77-style matching with Huffman coding. Later compressors such as LZ4, Brotli, Zstandard and the LZMA method of 7-Zip are members of the same family with different trade-offs between speed and size.',
    analogy: {
      title: 'A song sheet that says "repeat chorus"',
      text: 'A printed song does not spell out the chorus after every verse. It prints the chorus once and afterwards writes "repeat chorus". The singer looks back up the page, finds the words and sings them again. LZ77 writes that kind of instruction for every repeat it can find: look back this far, and copy this much.',
      limits: 'A songwriter knows where the chorus is and gives it a name. LZ77 has no names. It can only point backwards by distance, and only as far as its window reaches, so a phrase that returns after a long gap is not found. It also matches exact symbols only: a chorus with one changed word is copied up to the change and no further. And every instruction costs bits, so copying one or two letters usually costs more than writing them out.',
    },
  },

  example: {
    setup: 'Encode the nine letters ABABCABAB. The search window is the last 16 letters read and the look-ahead buffer is the next 8. A bit is a single 0 or 1. Each input letter takes 8 bits, so the input is 72 bits. Each triple (how far back, how many to copy, next letter) takes 15 bits here: 4 for the distance, 3 for the count and 8 for the letter.',
    steps: [
      'At the first letter, A, nothing has been read, so nothing can be copied. Write (0, 0, A). The same happens at B, which has not appeared before: write (0, 0, B).',
      'The text read so far is AB, and what comes next is ABCABAB. Going back 2 letters finds AB, which matches the first 2 letters ahead. The third letter ahead is C, which breaks the match.',
      'Write (2, 2, C): go back 2, copy 2 letters, then add C. Those 15 bits stand for the three letters ABC. Five letters are now done: ABABC.',
      'What comes next is ABAB. Going back 5 letters finds ABAB. Only 3 letters may be copied, because the triple must end with a real letter. Write (5, 3, B): go back 5, copy ABA, then add B.',
      'To decode, carry out the triples in order: A, then B, then copy AB and add C, then copy ABA and add B.',
    ],
    result: 'The output is (0, 0, A), (0, 0, B), (2, 2, C), (5, 3, B). That is 4 triples, or 60 bits instead of 72. The first two triples each spent 15 bits on a single letter. The saving came only from the two triples that copied.',
    tryInput: { text: 'ABABCABAB', window: 16, lookahead: 8 },
  },

  terms: [
    { term: 'Symbol', meaning: 'One item of the data, such as a letter of a text or a byte of a file.' },
    { term: 'Bit', meaning: 'A single 0 or 1, the smallest unit of storage.' },
    { term: 'Search window', meaning: 'The most recent symbols already read, which the encoder is allowed to copy from. Also called the sliding window, because it moves along with the reading position.' },
    { term: 'Look-ahead buffer', meaning: 'The next few symbols waiting to be encoded.' },
    { term: 'Match', meaning: 'A stretch that starts in the search window and is identical to the start of the look-ahead buffer.' },
    { term: 'Offset', meaning: 'How many symbols back from the current position a match starts.' },
    { term: 'Triple', meaning: 'One unit of output: an offset, a length, and the symbol that comes after the copied stretch.' },
    { term: 'Literal', meaning: 'A symbol sent as itself, not as part of a copy.' },
    { term: 'Lossless', meaning: 'Describes compression where decoding gives back the original exactly.' },
  ],

  takeaway: 'When something you are about to write has appeared recently, point back to it and say how much to copy instead of writing it again.',

  viz: {
    describe: 'Strips of cells. The top strip is the whole text: symbols that have slid out of the search window are faint, the search window is moss green, the look-ahead buffer is ochre and symbols not yet reached are plain. The second strip repeats the search window with the distance back written under each symbol, and the third repeats the look-ahead buffer. The longest match and the earlier copy it matches are terracotta, and the symbol that follows the match is brick red. The last strip collects the triples written so far. After encoding, the triples are decoded one at a time into a second strip to show that the text comes back exactly.',
    inputs: [
      { id: 'text', type: 'text', label: 'Text to compress', default: 'a banana and a bandana and a banana', maxLength: 60,
        help: 'Up to 60 characters. Each one counts as 8 bits in the input. Spaces are shown as ␣.' },
      { id: 'window', type: 'range', label: 'Search window (symbols)', min: 2, max: 32, step: 1, default: 16,
        help: 'How far back a copy may start. A larger window finds more matches, but the offset in every triple needs more bits.' },
      { id: 'lookahead', type: 'range', label: 'Look-ahead buffer (symbols)', min: 2, max: 16, step: 1, default: 8,
        help: 'A match can be at most one symbol shorter than this.' },
    ],
    presets: [
      { label: 'Repeated phrases', values: { text: 'a banana and a bandana and a banana', window: 16, lookahead: 8 } },
      { label: 'The worked example', values: { text: 'ABABCABAB', window: 16, lookahead: 8 } },
      { label: 'A copy that overlaps itself', values: { text: 'abcabcabcabcabcabc', window: 16, lookahead: 8 } },
      { label: 'Same phrases, window too small', values: { text: 'a banana and a bandana and a banana', window: 4, lookahead: 8 } },
      { label: 'An ordinary sentence: no gain', values: { text: 'the rain in spain stays mainly in the plain', window: 16, lookahead: 8 } },
      { label: 'Nothing repeats: the output grows', values: { text: 'sphinx of black quartz, judge my vow', window: 16, lookahead: 8 } },
    ],
    tryThis: [
      { ask: 'Load "Repeated phrases" and step until the text read so far is `a banana and a band`. What comes next, `ana and a banana`, begins with a stretch that has been written before. How many symbols will the next triple stand for? Then load "Same phrases, window too small", where the window is 4. How many symbols will the triple at that same position cover?',
        reveal: 'Eight, then three. With a window of 16 the triple is (14, 7, ␣): go back 14, copy the 7 symbols `ana and`, then add a space. One triple of 15 bits replaces 64 bits of text. With a window of 4 the earlier copy has slid out of reach. The best the encoder can find is (3, 2, a), and the whole text takes 17 triples and 221 bits instead of 11 triples and 165 bits.' },
      { ask: 'Load "A copy that overlaps itself": `abc` written six times. The first three symbols have to be written out one at a time. After that only `abc` has been read, and 15 symbols remain. How many symbols can the next triple copy from just 3 back?',
        reveal: 'Seven. The triple is (3, 7, b), although only 3 symbols existed when the copy began. The copy runs one symbol at a time, so symbols written a moment ago become the source for the next ones. It stops at 7 because a look-ahead buffer of 8 allows a match of at most 7. One more triple, (3, 6, c), finishes the text: 5 triples and 75 bits instead of 144. Step through the decoding to watch the copy feed itself.' },
      { ask: 'Load "An ordinary sentence: no gain", which comes out at 360 bits, larger than its 344-bit input. Raise the search window to 32, so the encoder can reach twice as far back. Each triple then costs 16 bits instead of 15. Will the total go up or down?',
        reveal: 'Up, to 384 bits. The wider window does find a copy the smaller one could not reach, a single symbol from 19 back, but the count stays at 24 triples and every one of them now costs a bit more. A larger window only pays when the extra reach finds long matches.' },
    ],
    run,
    report: (r, c) => `${r.triples.length} ${r.triples.length === 1 ? 'triple' : 'triples'} for ${r.text.length} symbols (window ${r.window}, look-ahead ${r.lookahead}).\nInput:  ${r.text.length} × 8 bits = ${r.inputBits} bits\nOutput: ${r.triples.length} × ${r.tripleBits} bits = ${r.outputBits} bits (${Math.round(100 * r.ratio)}% of the input)\nA triple costs ${r.offsetBits} bits for the offset + ${r.lengthBits} for the length + 8 for the next symbol.\nTriples: ${r.triples.map(tripleText).join(' ')}\n${c.comparisons || 0} symbol comparisons while searching. Decoded text is identical to the input.`,
    experiment: {
      title: 'Output size as the search window grows',
      note: `Each point is a real run of this page's encoder on ${PASSAGE.length} symbols with a look-ahead buffer of 16. "Repetitive prose" is a short passage about tides that reuses its phrases. "Random letters" has nothing to find. A larger window reaches more earlier copies, but each doubling adds one bit to every triple, so the prose curve falls, levels off and finally turns up again. Random letters only get more expensive.`,
      metric: 'output bits',
      metricLabel: 'Output bits',
      sizeLabel: 'Search window (symbols)',
      sizes: [4, 8, 16, 32, 64, 128, 256, 512],
      variants: [
        { id: 'prose', label: 'Repetitive prose' },
        { id: 'random', label: 'Random letters' },
      ],
      input: (w, variant, seed) => ({ text: variant === 'random' ? randomLetters(PASSAGE.length, seed) : PASSAGE, window: w, lookahead: 16 }),
      theory: [{ label: `input size (${8 * PASSAGE.length} bits)`, fn: () => 8 * PASSAGE.length, reference: true }],
    },
  },

  logic: {
    intuition: 'The text already read is a free dictionary that the decoder also has, since it has rebuilt exactly the same text. So the encoder never needs to send a string that appeared recently. It only needs to say where the earlier copy is and how long it is. The longer the match, the more symbols one fixed-size triple replaces.',
    steps: [
      'Keep a position in the text. Everything before it has been encoded. The last W symbols before it are the search window, and the next L symbols are the look-ahead buffer.',
      'For every distance back from 1 to W, count how many symbols starting there agree with the symbols starting at the position. Stop counting at L − 1, and always leave at least one symbol of the text unmatched.',
      'Keep the longest match found. If two distances give the same length, keep the nearer one.',
      'Emit the triple (offset, length, next symbol), where the next symbol is the one right after the match. If nothing matched, the triple is (0, 0, symbol).',
      'Move the position forward by length + 1 and repeat until the text is used up.',
      'To decode, process the triples in order: copy length symbols, one at a time, from offset symbols back in the output, then append the next symbol.',
    ],
    pseudocode: [
      'lz77_encode(text, W, L):',
      '  i ← 0',
      '  while i < length(text):',
      '    (offset, length) ← (0, 0)',
      '    for d from 1 to min(W, i):',
      '      m ← number of symbols on which text[i − d …]',
      '          and text[i …] agree, capped at L − 1',
      '      if m > length: (offset, length) ← (d, m)',
      '    emit (offset, length, text[i + length])',
      '    i ← i + length + 1',
      '',
      'lz77_decode(triples):',
      '  out ← empty',
      '  for each (offset, length, next) in triples:',
      '    repeat length times: append out[end − offset]',
      '    append next to out',
      '  return out',
    ],
    decisions: [
      { title: 'How large a window?', text: 'A larger window finds more and longer matches, but offsets need more bits and the search takes longer. This lesson uses 16 by default so that everything fits on screen. DEFLATE uses 32,768.' },
      { title: 'Which match to take?', text: 'This lesson takes the longest match available at the current position, and the nearest one among equals. That greedy rule is simple but not always the best overall: sometimes a shorter match now allows a much longer one at the next position. Production encoders look one step ahead before committing.' },
      { title: 'What if nothing matches?', text: 'The original scheme still emits a full triple, (0, 0, symbol), which costs more than the symbol did. Later variants add a one-bit flag in front of each item saying whether a plain symbol or a pointer follows, so that symbols without a match cost 9 bits instead of a whole triple.' },
      { title: 'How is the triple written in bits?', text: 'Here each field has a fixed width: enough bits for W different offsets, enough for L different lengths, and 8 for the symbol. Real formats feed offsets and lengths to an entropy coder such as Huffman coding, because small values are much more common than large ones.' },
    ],
    invariants: [
      'The triples emitted so far decode to exactly the text before the current position.',
      'Every offset is at most the number of symbols already encoded, and at most W. Every length is at most L − 1.',
      'Each triple advances the position by at least one symbol, so the encoder always finishes.',
    ],
    edgeCases: [
      'The first symbol can never be copied, so the first triple is always (0, 0, symbol).',
      'A match may be longer than its offset. The copy then overlaps its own output, which is why the decoder must copy one symbol at a time, front to back.',
      'A match that reaches the end of the text is shortened by one, because the triple needs a real next symbol.',
      'A match longer than L − 1 is cut there and continued by the next triple.',
      'Text without repeats inside the window produces one triple per symbol, and the output is larger than the input.',
    ],
    correctness: 'Decoding is correct by induction on the triples. Suppose the output so far equals the text before position $i$. The encoder chose offset $d$ and length $m$ such that $\\text{text}[i + j] = \\text{text}[i - d + j]$ for $0 \\le j < m$. The decoder appends symbols one at a time, and the $j$-th symbol it appends is the one $d$ places before the end of its current output, which is position $i + j - d$. For $j < d$ that position holds original text by the induction hypothesis. For $j \\ge d$ it holds a symbol appended earlier in this same copy, which by the same argument already equals the text. So after the copy and the explicit next symbol, the output equals the text before position $i + m + 1$.',
    mistakes: [
      'Copying a match as one block with a routine that assumes source and destination do not overlap. Overlapping matches then come out wrong.',
      'Letting a match run to the very end of the text and then reading a next symbol that does not exist.',
      'Measuring the offset from the start of the window instead of back from the current position, or mixing the two conventions between encoder and decoder.',
      'Counting only the number of triples and concluding the data shrank. Each triple is larger than a symbol, so size must be compared in bits.',
    ],
  },

  code: {
    sample: {
      input: 'The text "a banana and a bandana and a banana" with a search window of 16 and a look-ahead buffer of 8. Print the triples, the size under this lesson\'s cost model, and the decoded text.',
      expected: "(0,0,'a') (0,0,' ') (0,0,'b') (3,1,'n') (2,3,' ') (4,2,'d') (4,2,' ') (13,3,'d') (14,7,' ') (14,5,'a') (2,1,'a')\n11 triples x 15 bits = 165 bits instead of 280\na banana and a bandana and a banana",
    },
    breakIt: [
      { change: 'In `decode`, copy each match as one block: take the `length` symbols that start `offset` back in the output so far and append them all at once. In Python that is `start = len(out) - offset` followed by `out.extend(out[start:start + length])`. Will the text still come back whole?',
        find: { python: '        for _ in range(length):\n            out.append(out[-offset])', javascript: 'for (let k = 0; k < length; k++) out.push(out[out.length - offset]);' },
        replace: { python: '        start = len(out) - offset\n        out.extend(out[start:start + length])', javascript: 'out.push(...out.slice(out.length - offset, out.length - offset + length));' },
        reveal: 'No. The triples and the bit count are unchanged, but the last line now begins "a banan nad n" where it should begin "a banana and a". The trouble starts at the fifth triple, (2, 3, ␣): copy 3 symbols from 2 back. Only 2 symbols exist there when the copy begins, so the block copy delivers "an" where "ana" was meant. The output is then one symbol short, and every later triple counts back from the wrong place. Python and JavaScript print the same line.' },
      { change: 'In `encode`, remove the `- 1` from the second limit on the match length, so that a match may run all the way to the last symbol of the text. What will the last triple be?',
        find: { python: 'len(text) - i - 1)', javascript: 'text.length - i - 1);' },
        replace: { python: 'len(text) - i)', javascript: 'text.length - i);' },
        reveal: 'The last match now takes both of the final symbols, "na", and leaves nothing to be the next symbol of the triple, so the encoder reads past the end of the text. Python stops with "IndexError: string index out of range" and prints nothing at all. JavaScript reads `undefined` there and carries on: the last triple prints as (2,2,\'undefined\'), and the decoded text still looks right, but only because joining the output turns `undefined` into nothing.' },
      { change: 'In `decode`, read the offset as a position counted from the start of the output instead of back from its end: copy from `out[offset]`. The encoder is unchanged. What will the decoded text look like?',
        find: { python: 'out.append(out[-offset])', javascript: 'out.push(out[out.length - offset]);' },
        replace: { python: 'out.append(out[offset])', javascript: 'out.push(out[offset]);' },
        reveal: 'The first two lines are unchanged, because the encoder is. Python then stops with "IndexError: list index out of range". The fourth triple, (3, 1, n), asks for position 3 of an output that holds only positions 0 to 2. JavaScript reads `undefined` there and carries on, and its last line begins "a bnbbb nndnn nnnd" and then trails off into spaces. An offset is a distance back from the end of the output. Read as a position from the start, it points at unrelated symbols or at nothing.' },
    ],
    python: {
      source: `WINDOW = 16     # how far back a copy may start
LOOKAHEAD = 8   # a match is at most LOOKAHEAD - 1 symbols long


def bits_for(count):
    """Bits needed to tell count different values apart."""
    bits = 0
    while (1 << bits) < count:
        bits += 1
    return bits


def encode(text):
    triples = []
    i = 0
    while i < len(text):
        best_offset, best_length = 0, 0
        max_length = min(LOOKAHEAD - 1, len(text) - i - 1)
        for offset in range(1, min(WINDOW, i) + 1):
            length = 0
            while length < max_length and text[i - offset + length] == text[i + length]:
                length += 1
            if length > best_length:
                best_offset, best_length = offset, length
        triples.append((best_offset, best_length, text[i + best_length]))
        i += best_length + 1
    return triples


def decode(triples):
    out = []
    for offset, length, symbol in triples:
        for _ in range(length):
            out.append(out[-offset])
        out.append(symbol)
    return "".join(out)


text = "a banana and a bandana and a banana"
triples = encode(text)
print(" ".join(f"({offset},{length},'{symbol}')" for offset, length, symbol in triples))
cost = bits_for(WINDOW) + bits_for(LOOKAHEAD) + 8
print(f"{len(triples)} triples x {cost} bits = {len(triples) * cost} bits instead of {8 * len(text)}")
print(decode(triples))`,
      notes: [
        { line: 18, text: 'Two limits on a match: the length field holds at most LOOKAHEAD - 1, and one symbol of text must be left over to be the "next symbol" of the triple.' },
        { line: 21, text: 'The index `i - offset + length` may reach or pass `i`. That is the overlapping case, and it is allowed: the comparison simply continues into the look-ahead.' },
        { line: 23, text: 'A strict `>` keeps the first, nearest offset when several give the same length.' },
        { line: 34, text: 'Copying one symbol at a time is what makes overlapping matches work. `out[-offset]` may be a symbol appended by the previous turn of this same loop.' },
        { line: 42, text: 'The cost model of this lesson: 4 bits for one of 16 offsets, 3 bits for one of 8 lengths, 8 bits for the symbol.' },
      ],
    },
    javascript: {
      source: `const WINDOW = 16;    // how far back a copy may start
const LOOKAHEAD = 8;  // a match is at most LOOKAHEAD - 1 symbols long

// Bits needed to tell count different values apart.
function bitsFor(count) {
  let bits = 0;
  while ((1 << bits) < count) bits++;
  return bits;
}

function encode(text) {
  const triples = [];
  let i = 0;
  while (i < text.length) {
    let bestOffset = 0, bestLength = 0;
    const maxLength = Math.min(LOOKAHEAD - 1, text.length - i - 1);
    for (let offset = 1; offset <= Math.min(WINDOW, i); offset++) {
      let length = 0;
      while (length < maxLength && text[i - offset + length] === text[i + length]) {
        length++;
      }
      if (length > bestLength) {
        bestOffset = offset;
        bestLength = length;
      }
    }
    triples.push([bestOffset, bestLength, text[i + bestLength]]);
    i += bestLength + 1;
  }
  return triples;
}

function decode(triples) {
  const out = [];
  for (const [offset, length, symbol] of triples) {
    for (let k = 0; k < length; k++) out.push(out[out.length - offset]);
    out.push(symbol);
  }
  return out.join("");
}

const text = "a banana and a bandana and a banana";
const triples = encode(text);
console.log(triples.map(([offset, length, symbol]) => "(" + offset + "," + length + ",'" + symbol + "')").join(" "));
const cost = bitsFor(WINDOW) + bitsFor(LOOKAHEAD) + 8;
console.log(triples.length + " triples x " + cost + " bits = " + triples.length * cost + " bits instead of " + 8 * text.length);
console.log(decode(triples));`,
    },
    cpp: {
      source: `#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

const int WINDOW = 16;    // how far back a copy may start
const int LOOKAHEAD = 8;  // a match is at most LOOKAHEAD - 1 symbols long

struct Triple {
    int offset, length;
    char symbol;
};

// Bits needed to tell count different values apart.
int bitsFor(int count) {
    int bits = 0;
    while ((1 << bits) < count) ++bits;
    return bits;
}

std::vector<Triple> encode(const std::string& text) {
    std::vector<Triple> triples;
    const int n = static_cast<int>(text.size());
    int i = 0;
    while (i < n) {
        int bestOffset = 0, bestLength = 0;
        const int maxLength = std::min(LOOKAHEAD - 1, n - i - 1);
        for (int offset = 1; offset <= std::min(WINDOW, i); ++offset) {
            int length = 0;
            while (length < maxLength && text[i - offset + length] == text[i + length]) {
                ++length;
            }
            if (length > bestLength) {
                bestOffset = offset;
                bestLength = length;
            }
        }
        triples.push_back({bestOffset, bestLength, text[i + bestLength]});
        i += bestLength + 1;
    }
    return triples;
}

std::string decode(const std::vector<Triple>& triples) {
    std::string out;
    for (const Triple& t : triples) {
        for (int k = 0; k < t.length; ++k) out += out[out.size() - t.offset];
        out += t.symbol;
    }
    return out;
}

int main() {
    const std::string text = "a banana and a bandana and a banana";
    const std::vector<Triple> triples = encode(text);
    for (std::size_t k = 0; k < triples.size(); ++k) {
        const Triple& t = triples[k];
        std::cout << "(" << t.offset << "," << t.length << ",'" << t.symbol << "')" << (k + 1 < triples.size() ? " " : "\\n");
    }
    const int cost = bitsFor(WINDOW) + bitsFor(LOOKAHEAD) + 8;
    std::cout << triples.size() << " triples x " << cost << " bits = " << triples.size() * cost
              << " bits instead of " << 8 * text.size() << "\\n";
    std::cout << decode(triples) << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'For each position where a triple starts, the encoder tries every distance in the window and, for each, compares symbols until they differ. That comes to at most W comparisons for every symbol of the text, so with the window size W held fixed the time grows in proportion to the length of the text. The constant is large, though: the straightforward search shown here is the slow part of every LZ77 compressor, and real ones replace it with a hash table. Decoding does no searching at all.',
    cases: [
      { case: 'Encoding, this page\'s search', time: 'At most n · W comparisons', when: 'Every distance in the window is tried for every triple. A triple that covers m + 1 symbols costs at most W × (m + 1) comparisons.' },
      { case: 'Encoding, long matches everywhere', time: 'About n · W / L comparisons', when: 'Each triple covers L symbols and most candidate distances fail on their first symbol.' },
      { case: 'Decoding', time: 'O(n)', when: 'One copy or append per output symbol.' },
      { case: 'Output size', time: 'Between about n / L triples and n triples', when: 'The best case copies L − 1 symbols with every triple. The worst case finds no match anywhere.' },
    ],
    space: 'O(W + L): the encoder needs the search window and the look-ahead buffer, and the decoder needs only the last W symbols of its output. Neither depends on the length of the text.',
    memory: 'Because both sides keep just the recent past, LZ77 works on streams of unlimited length. The window size is the knob that trades memory and search time for compression.',
    tradeoffs: 'A larger window and a more thorough search give smaller output and slower encoding. Decoding speed is hardly affected, which suits data that is compressed once and read many times. Compared with Huffman coding alone, LZ77 captures repeated phrases that symbol counts cannot see, but its fixed-width triples waste bits unless an entropy coder follows.',
    assumptions: [
      'Each input symbol occupies 8 bits. A triple occupies bits(W) + bits(L) + 8 bits, where bits(c) is the number of bits needed to distinguish c values: 4 + 3 + 8 = 15 with the default W = 16 and L = 8.',
      'The offset is one of W distances (1 to W) and is ignored when the length is 0. The length is one of L values (0 to L − 1).',
      'Time is counted in symbol comparisons made by the exhaustive search on this page, with W treated as a fixed parameter. Hash-based match finders do far fewer.',
      'No header, end marker or entropy coding of the triples is counted.',
    ],
  },

  tradeoffs: {
    excels: [
      'Text, source code, markup and structured records, which repeat words and phrases.',
      'Data that is compressed once and decompressed often, since decoding is only copying.',
      'Streams of unknown length, because memory use is fixed by the window.',
    ],
    struggles: [
      'Short inputs, where there has not yet been anything to point back to.',
      'Data with no exact repeats: random data, already compressed data, encrypted data.',
      'Repeats that are farther apart than the window.',
      'Near-repeats. One changed symbol ends a match.',
    ],
    pitfalls: [
      'Using a block copy for overlapping matches.',
      'Mishandling the end of the input when a match reaches it.',
      'An encoder that is far too slow because it searches the whole window naively on large data.',
    ],
    misunderstandings: [
      '"LZ77 builds a dictionary of words." It keeps no separate dictionary. The text already processed is the dictionary, and entries are named by how far back they are.',
      '"A pointer can only copy text that is already there." A match may be longer than its offset. The copy then reads symbols it has just written, which is how a short pattern is expanded into a long repetition.',
      '"Fewer triples than symbols means the data shrank." A triple is bigger than a symbol, 15 bits against 8 in this lesson, so the triples must cover almost two symbols each on average just to break even.',
      '"A bigger window is always better." It finds more matches, but every offset then needs more bits, and the search takes longer.',
    ],
    constraints: [
      'Formats fix the window size so that a decoder knows how much history to keep: 32,768 bytes in DEFLATE.',
      'Practical encoders ignore matches shorter than about 3 symbols, since a pointer costs more than two or three literals.',
    ],
    alternatives: [
      { id: 'run-length-encoding', name: 'Run-Length Encoding', when: 'The data is dominated by long runs of one symbol and you want the simplest possible coder.' },
      { id: 'huffman-coding', name: 'Huffman Coding', when: 'Symbols are unevenly frequent but do not form repeated strings. Usually applied after LZ77, not in its place.' },
      { name: 'LZSS', when: 'You want the same idea without wasting a full triple on unmatched symbols. A flag bit marks each item as a literal or a pointer.' },
      { name: 'LZ78 and LZW', when: 'You prefer an explicit dictionary of phrases that grows as the data is read, with no sliding window.' },
    ],
    comparison: {
      columns: ['', 'LZ77', 'Run-length encoding', 'Huffman coding'],
      rows: [
        ['Redundancy it removes', 'Repeated substrings within a window', 'Equal neighbours', 'Uneven symbol frequencies'],
        ['Output unit', 'Pointer plus next symbol', 'Count plus symbol', 'One variable-length code per symbol'],
        ['Encoder work', 'Searches the window at every step', 'One comparison per symbol', 'Counts symbols, then builds a tree'],
        ['Decoder work', 'Copying only', 'Copying only', 'Walking a tree or table'],
        ['Needs a table sent ahead', 'No', 'No', 'Yes'],
      ],
    },
  },

  applications: [
    { title: 'DEFLATE: gzip, zip and PNG', status: 'established', text: 'DEFLATE finds repeated strings up to 32,768 bytes back, with match lengths from 3 to 258, and then Huffman-codes the literals, lengths and distances. It is the compression method of the gzip and zlib formats, the usual method in zip archives, and the one PNG images use.' },
    { title: 'Web traffic', status: 'established', text: 'Web servers commonly compress pages, scripts and style sheets before sending them, using gzip or the newer Brotli and Zstandard formats. All three are built on LZ77-style matching followed by entropy coding.' },
    { title: 'Fast compression in storage and databases', status: 'established', text: 'LZ4 and Snappy are byte-oriented LZ77 variants that skip the entropy-coding stage in exchange for very high speed. File systems and databases use them to compress blocks of data on the fly.' },
    { title: 'Storing a file as changes to an older version', status: 'illustrative', text: 'If the window is allowed to reach into a previous version of a file, the new version can be written mostly as copies from the old one plus a few new symbols. Delta compression tools are built on this idea.' },
  ],

  connections: [
    { to: 'run-length-encoding', type: 'prerequisite', why: 'A run is the special case of a match with offset 1. LZ77 extends "repeat the previous symbol" to "repeat any earlier stretch".' },
    { to: 'huffman-coding', type: 'related', why: 'They remove different redundancy and are chained in DEFLATE: LZ77 turns repeated strings into pointers, and Huffman coding then shortens the common pointers and literals.' },
    { to: 'edit-distance', type: 'related', why: 'Both describe one string in terms of another using copies and inserted symbols. Edit distance counts the fewest changes between two strings, and LZ77 describes a text as copies from its own past plus literal symbols.' },
    { to: 'hash-table', type: 'advanced', why: 'Practical encoders find candidate matches by hashing the next few symbols and looking up earlier positions with the same hash, instead of scanning the whole window.' },
    { to: 'concept:greedy', type: 'prerequisite', why: 'The encoder takes the longest match available now and never reconsiders. Unlike in Huffman coding, this greedy choice is not always optimal.' },
    { to: 'concept:entropy', type: 'advanced', why: 'Without being told the statistics of the source, sliding-window Lempel-Ziv coding approaches the entropy rate of a stationary ergodic source as the window grows.' },
    { to: 'byte-pair-encoding', type: 'related', why: 'Both shorten text by reusing repeated substrings. Byte-pair encoding gives frequent pairs new names in a table, and LZ77 points back to an earlier occurrence.' },
    { to: 'discipline:distributed-systems', type: 'application', why: 'Network protocols and storage systems compress data with LZ77-family formats to send and store fewer bytes.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'What does the triple (5, 3, x) tell the decoder to do?',
      options: ['Write x five times, then skip 3', 'Go back 5 symbols, copy 3 symbols from there, then write x', 'Go back 3 symbols, copy 5 symbols, then write x', 'Replace symbol 5 with 3 copies of x'],
      answer: 1,
      explain: [
        'That would be a run-length instruction. An LZ77 triple points back into text already written.',
        'Correct. The first number is the distance back, the second is how many symbols to copy, and the third is the symbol that follows the copy.',
        'The order is distance first, then length.',
        'Nothing already written is ever replaced. The decoder only appends.',
      ],
    },
    {
      type: 'predict',
      q: 'The text aaaaaaaaaaaa is twelve copies of a. With the default window of 16 and look-ahead of 8, how many triples will LZ77 write?',
      options: ['12', '6', '3', '2'],
      answer: 2,
      explain: [
        'Twelve triples would mean nothing was ever copied. From the second a onwards there is an earlier a to copy from.',
        'Six would mean each triple copied one symbol and added one. A match can be much longer than its offset, because a copy may overlap itself.',
        'The first a has nothing before it: (0, 0, a). Then (1, 7, a) goes back 1 and copies 7, the longest match a look-ahead of 8 allows, and the ninth a is its next symbol. Three symbols are left, and (1, 2, a) covers them.',
        'Two triples would need the second one to copy 10 symbols. With a look-ahead buffer of 8 a match is at most 7 symbols long, so (0, 0, a) and (1, 7, a) cover only 9 of the 12.',
      ],
      tryInput: { text: 'aaaaaaaaaaaa', window: 16, lookahead: 8 },
      check: (r) => (r.triples.length === 3 && triplesOf(r) === '0,0,a 1,7,a 1,2,a' && r.outputBits === 45) || `got ${triplesOf(r)}`,
    },
    {
      type: 'debug',
      q: 'This decoder works on most inputs but garbles "aaaaaaaa", whose triples are (0, 0, a), (1, 6, a). What is wrong?',
      code: `def decode(triples):
    out = ""
    for offset, length, symbol in triples:
        start = len(out) - offset
        out += out[start:start + length]
        out += symbol
    return out`,
      options: ['start should be len(out) + offset', 'The slice copies only symbols that already exist, so an overlapping match comes out too short', 'symbol should be added before the copy', 'It should loop over the triples in reverse'],
      answer: 1,
      explain: [
        'The copy source is behind the end of the output, so subtracting the offset is right.',
        'Correct. With offset 1 and length 6 the slice finds only one existing symbol. The copy must go one symbol at a time, so that each new symbol can serve as a source for the next.',
        'The next symbol comes after the copied stretch in the original text.',
        'Triples must be processed in the order they were written, because each one depends on the output of those before it.',
      ],
    },
    {
      type: 'choice',
      q: 'With 15 bits per triple and 8 bits per input symbol, a text of 40 symbols is encoded as 24 triples. What happened to its size?',
      options: ['It shrank, because 24 is less than 40', 'It stayed the same', 'It grew from 320 bits to 360 bits', 'It cannot be known without the text'],
      answer: 2,
      explain: [
        'Triples and symbols are different sizes, so their counts cannot be compared directly.',
        'It would stay the same only if the two totals in bits were equal.',
        'Correct. 40 × 8 = 320 bits in, 24 × 15 = 360 bits out. Each triple has to cover almost two symbols on average before anything is saved.',
        'The two counts and the two unit costs are all that is needed.',
      ],
    },
    {
      type: 'challenge',
      title: 'Stop paying a full triple for a lone symbol',
      prompt: 'Change the output format to the LZSS scheme. Each item starts with one flag bit. Flag 0 is followed by a plain 8-bit symbol (9 bits in all). Flag 1 is followed by an offset and a length with no next symbol, so a match may now run to the last symbol of the text. Keep the search as it is, with a match of at most 7 symbols. Emit a pointer only when the match is long enough to be cheaper than writing the symbols as literals. Work out that minimum length for a window of 16 and a look-ahead of 8, then compare the output size with this lesson\'s triples on the six presets, starting with "Repeated phrases".',
      expect: 'A pointer costs 1 + 4 + 3 = 8 bits and a literal costs 9, so a match of a single symbol is already worth taking. On "Repeated phrases" a correct encoder writes 5 literals and 10 pointers: 5 × 9 + 10 × 8 = 125 bits, against 165 bits for the triples and 280 for the plain text. The other five presets give 43 bits for the worked example (60 as triples), 51 for the overlapping copy (75), 195 for the window of 4, where a pointer costs only 6 bits (221), 273 for the ordinary sentence (360) and 317 for the text where nothing repeats (435). That last text is 288 bits plain, so it still grows.',
      hints: [
        'A pointer costs 1 + 4 + 3 = 8 bits with these settings, and a literal costs 9. So even a match of length 1 is worth taking here. With DEFLATE-sized windows the threshold is 3.',
        'The decoder reads the flag first and then knows how many bits the item has.',
      ],
    },
  ],

  compare: {
    idea: 'Replace a repeated substring with a pointer to an earlier copy inside a sliding window.',
    requires: 'Nothing in advance: no counts and no table. It only saves space when stretches of data repeat within its window.',
    sensitivity: 'High. Repetitive text shrinks well. Short or patternless input grows, since every triple costs more than a symbol.',
    memory: 'The window and the look-ahead buffer, whatever the length of the text.',
    difficulty: 'moderate',
    difficultyNote: 'The idea is short. Overlapping copies, the end of the input and a fast match search are where the care goes.',
    limits: 'It cannot see a repeat that is further back than its window, or one that is nearly but not exactly the same. In this plain form its output wastes bits unless a second stage packs it.',
    useWhen: 'The data repeats phrases, especially if it will be unpacked more often than packed.',
  },

  advanced: {
    history: 'Jacob Ziv and Abraham Lempel published the sliding-window method in 1977 and a second method, which builds an explicit dictionary of phrases, in 1978. The two are known as LZ77 and LZ78. In 1982 James Storer and Thomas Szymanski described the variant now called LZSS, which marks each output item as a literal or a pointer. Terry Welch\'s 1984 refinement of LZ78, called LZW, was used in the GIF image format and the Unix compress program. Phil Katz combined LZ77-style matching with Huffman coding in the DEFLATE format, later specified in RFC 1951, and it became the method behind zip, gzip and PNG.',
    derivation: 'Let a triple cost $c = b_W + b_L + s$ bits, with $b_W = \\lceil \\log_2 W \\rceil$, $b_L = \\lceil \\log_2 L \\rceil$ and $s = 8$ bits per symbol. A triple with match length $m$ replaces $m + 1$ symbols, which cost $s(m + 1)$ bits. It saves space when\n\n$$s(m + 1) > c \\quad\\Longleftrightarrow\\quad m > \\frac{b_W + b_L}{s}.$$\n\nWith $W = 16$ and $L = 8$ the right side is $7/8$, so any triple with a match of at least 1 symbol saves a bit (16 bits replaced by 15), and each triple without a match loses 7 bits. Over the whole text with $T$ triples, the output is $cT$ bits against $sn$ bits of input, so compression needs an average of more than $c/s$ symbols per triple: 1.875 here. Doubling $W$ adds one bit to every triple, which is why the size curve in the experiment turns upward once the window is larger than the repetition it can exploit.',
    proof: 'The decoder reproduces the input for every input, including overlapping matches. Let $x$ be the text and suppose the decoder\'s output equals $x[0..i)$ before a triple $(d, m, a)$ that the encoder emitted at position $i$. By construction $x[i + j] = x[i + j - d]$ for $0 \\le j < m$ and $a = x[i + m]$. Claim: after appending $j$ symbols of the copy, the output equals $x[0..i + j)$. It holds for $j = 0$. If it holds for $j < m$, the next appended symbol is the one $d$ places from the end, namely $x[i + j - d]$, which is defined because $d \\le i$ and equals $x[i + j]$. So the claim holds for $j + 1$. After $m$ steps and the final append of $a$, the output equals $x[0..i + m + 1)$, which is where the encoder\'s next triple begins.',
    complexityProof: 'Consider one triple with match length $m$. For each of at most $W$ distances the encoder compares symbols until the first disagreement or until the cap is reached. No distance matches more than $m$ symbols, since $m$ is the longest match, so each distance costs at most $m + 1$ comparisons and the triple costs at most $W(m + 1)$. The triple consumes $m + 1$ symbols, and all triples together consume exactly $n$, so the total is at most $nW$ comparisons. The look-ahead size $L$ does not appear in the bound. It limits $m$, and with it how many symbols one triple can cover. The decoder appends each of the $n$ output symbols exactly once.',
    variants: [
      { name: 'LZSS', text: 'A flag bit says whether a literal or an (offset, length) pair follows, and short matches are sent as literals. Most practical formats descend from this form.' },
      { name: 'DEFLATE', text: 'LZSS-style matching in a 32,768-byte window with lengths 3 to 258, followed by Huffman coding of literals, lengths and distances.' },
      { name: 'LZ78 and LZW', text: 'Build a numbered dictionary of phrases as the data is read and emit dictionary indices. There is no window and no offsets.' },
      { name: 'LZ4 and Snappy', text: 'Byte-aligned LZ77 formats with a single fast hash lookup per position and no entropy coding, designed for speed.' },
      { name: 'LZMA, Brotli and Zstandard', text: 'Much larger windows, more careful match selection and stronger entropy coders than DEFLATE, for better ratios.' },
      { name: 'Lazy and optimal parsing', text: 'Before committing to a match, check whether starting one symbol later gives a longer one, or search for the cheapest sequence of matches for a whole block.' },
    ],
    implementation: 'Index the window with a hash of the next three or four symbols and follow a chain of earlier positions with the same hash, with a cap on the chain length. Keep the window in a circular buffer. Copy matches forwards, one unit at a time, or with a routine that is explicitly safe for overlap. Emit literals for matches too short to pay for a pointer.',
    benchmarking: 'Report compression ratio, compression speed and decompression speed together, on a public corpus, with the window size and effort level stated. Ratios on tiny inputs are not meaningful, because the window is still empty for most of the input.',
    references: [
      { authors: 'J. Ziv and A. Lempel', year: 1977, title: 'A universal algorithm for sequential data compression', venue: 'IEEE Transactions on Information Theory 23(3), 337-343' },
      { authors: 'J. Ziv and A. Lempel', year: 1978, title: 'Compression of individual sequences via variable-rate coding', venue: 'IEEE Transactions on Information Theory 24(5), 530-536' },
      { authors: 'J. A. Storer and T. G. Szymanski', year: 1982, title: 'Data compression via textual substitution', venue: 'Journal of the ACM 29(4), 928-951' },
      { authors: 'A. D. Wyner and J. Ziv', year: 1994, title: 'The sliding-window Lempel-Ziv algorithm is asymptotically optimal', venue: 'Proceedings of the IEEE 82(6), 872-877' },
      { authors: 'P. Deutsch', year: 1996, title: 'DEFLATE Compressed Data Format Specification version 1.3', venue: 'RFC 1951, Internet Engineering Task Force' },
    ],
    furtherReading: [
      'K. Sayood, *Introduction to Data Compression*, chapter "Dictionary Techniques".',
      'D. Salomon, *Data Compression: The Complete Reference*, the chapter on dictionary methods.',
      'T. M. Cover and J. A. Thomas, *Elements of Information Theory*, the section on Lempel-Ziv coding.',
    ],
  },

  tests: [
    { name: 'default input: every triple is a longest match and the text round-trips', input: {}, check: sound },
    { name: 'the code sample: 11 triples, 165 bits instead of 280', input: { text: 'a banana and a bandana and a banana', window: 16, lookahead: 8 },
      check: (r) => (r.triples.length === 11 && r.outputBits === 165 && r.inputBits === 280 && triplesOf(r) === '0,0,a 0,0,  0,0,b 3,1,n 2,3,  4,2,d 4,2,  13,3,d 14,7,  14,5,a 2,1,a') || `got ${triplesOf(r)}` },
    { name: 'the worked example: four triples, 60 bits instead of 72', input: { text: 'ABABCABAB', window: 16, lookahead: 8 },
      check: (r) => (sound(r) === true && triplesOf(r) === '0,0,A 0,0,B 2,2,C 5,3,B' && r.inputBits === 72 && r.outputBits === 60 && r.tripleBits === 15) || `got ${triplesOf(r)}, ${r.outputBits} bits` },
    { name: 'a run is copied by an overlapping match', input: { text: 'aaaaaaaa', window: 16, lookahead: 8 },
      check: (r) => (sound(r) === true && triplesOf(r) === '0,0,a 1,6,a' && r.outputBits === 30) || `got ${triplesOf(r)}` },
    { name: 'overlap with a longer period', input: { text: 'abcabcabcabcabcabc', window: 16, lookahead: 8 },
      check: (r) => (sound(r) === true && triplesOf(r) === '0,0,a 0,0,b 0,0,c 3,7,b 3,6,c') || `got ${triplesOf(r)}` },
    { name: 'a small window loses the distant copies', input: { text: 'a banana and a bandana and a banana', window: 4, lookahead: 8 },
      check: (r) => (sound(r) === true && r.triples.length === 17 && r.tripleBits === 13 && r.outputBits === 221) || `got ${r.triples.length} triples, ${r.outputBits} bits` },
    { name: 'an ordinary sentence expands', input: { text: 'the rain in spain stays mainly in the plain', window: 16, lookahead: 8 },
      check: (r) => (sound(r) === true && r.inputBits === 344 && r.outputBits === 360) || `got ${r.outputBits} bits` },
    { name: 'text without repeats costs one triple per symbol', input: { text: 'ABCDEFGH', window: 16, lookahead: 8 },
      check: (r) => (sound(r) === true && r.triples.length === 8 && r.outputBits === 120) || `got ${r.outputBits} bits` },
    { name: 'odd window and look-ahead sizes, single symbol', input: { text: 'x', window: 5, lookahead: 3 },
      check: (r) => (sound(r) === true && triplesOf(r) === '0,0,x' && r.tripleBits === 3 + 2 + 8) || `got ${triplesOf(r)} at ${r.tripleBits} bits` },
    { name: 'things to try: a window of 32 keeps 24 triples at 16 bits each, 384 bits', input: { text: 'the rain in spain stays mainly in the plain', window: 32, lookahead: 8 },
      check: (r) => (sound(r) === true && r.triples.length === 24 && r.tripleBits === 16 && r.outputBits === 384 && r.triples.some(([o, m, x]) => o === 19 && m === 1 && x === 'a') && r.triples.every(([o]) => o <= 16 || o === 19)) || `got ${triplesOf(r)}, ${r.outputBits} bits` },
    { name: 'things to try: the ninth triple of the default text is (14,7,space), and a window of 4 finds (3,2,a) there', input: { text: 'a banana and a bandana and a banana', window: 4, lookahead: 8 },
      check: (r) => { const covered = (k) => r.triples.slice(0, k).reduce((sum, [, m]) => sum + m + 1, 0); return (covered(10) === 19 && r.triples[10].join(',') === '3,2,a') || `got ${triplesOf(r)}`; } },
    { name: 'things to try: three abc are followed by (3,7,b) and (3,6,c), 75 bits', input: { text: 'abcabcabcabcabcabc', window: 16, lookahead: 8 },
      check: (r) => (r.triples.length === 5 && r.outputBits === 75 && r.inputBits === 144) || `got ${r.outputBits} bits` },
    { name: 'spaces, digits and markup characters', input: { text: '$1 $1 $1 * `a` * `a` 1001001', window: 12, lookahead: 6 }, check: sound },
  ],
};
