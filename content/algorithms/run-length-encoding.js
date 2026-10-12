// Run-length encoding. Bit-cost model used throughout this lesson:
//   input   8 bits per symbol (every character is treated as one byte)
//   output  16 bits per run: 8 bits for the count (1 to 255) plus 8 bits for the symbol

const COUNT_BITS = 8;
const SYMBOL_BITS = 8;
const PAIR_BITS = COUNT_BITS + SYMBOL_BITS;
const MAX_RUN = 255; // the largest count that fits in 8 bits

const show = (ch) => (ch === ' ' ? '␣' : ch);
// Symbols quoted inside notes pass through the inline-markup parser, so the few characters it reacts to are swapped for look-alikes.
const say = (ch) => ({ $: '＄', '*': '∗', '`': 'ˋ' }[ch] || show(ch));
const pairText = ([count, symbol]) => `${count}×${show(symbol)}`;

function checkText(text) {
  if (!text.length) throw new Error('Type at least one character to compress.');
  for (const ch of text) {
    if (ch.codePointAt(0) > 255) throw new Error(`This lesson counts every character as one 8-bit byte, so it accepts only basic Latin characters. Remove "${ch}" and run it again.`);
  }
}

function run(input, t) {
  const text = String(input.text ?? '');
  checkText(text);
  const maxRun = Math.max(1, Math.min(MAX_RUN, Math.floor(input.maxRun || MAX_RUN)));
  const n = text.length;
  const inputBits = SYMBOL_BITS * n;
  const runs = [];
  const legend = [
    { label: 'run being counted', role: 'active' },
    { label: 'symbol that ends the run', role: 'alert' },
    { label: 'already encoded', role: 'done' },
  ];

  const encodeViews = (i, count, stopper, fresh) => [{
    kind: 'rows', title: 'Encoding', legend,
    rows: [
      { label: 'Input', cells: [...text].map((ch, k) => ({ t: show(ch), role: k < i ? 'done' : k < i + count ? 'active' : k === stopper ? 'alert' : 'default' })) },
      { label: 'Output pairs', cells: runs.map((r, k) => ({ t: pairText(r), role: fresh && k === runs.length - 1 ? 'current' : 'done' })) },
      { label: 'Size', cells: [{ t: inputBits, sub: 'bits in' }, { t: runs.length * PAIR_BITS, sub: 'bits out so far' }] },
    ],
  }];

  t.frame(() => ({
    line: 0,
    note: `The input has ${n} symbols. At 8 bits each that is **${inputBits} bits**. Run-length encoding reads from left to right and replaces every run of one repeated symbol with a pair: how many, and of what. Each pair costs 16 bits here: 8 for the count and 8 for the symbol.`,
    views: encodeViews(0, 0, -1, false),
    vars: { 'input bits': inputBits },
  }));

  let i = 0;
  while (i < n) {
    const symbol = text[i];
    let count = 1;
    const start = i;
    t.frame(() => ({
      line: [4, 5],
      note: `Start a new run with **${say(symbol)}**. So far it is 1 symbol long.`,
      views: encodeViews(start, 1, -1, false),
      vars: { symbol: say(symbol), count: 1 },
    }));
    let reason = 'end';
    for (;;) {
      if (i + count >= n) { reason = 'end'; break; }
      if (count >= maxRun) { reason = 'full'; break; }
      t.count('comparisons');
      if (text[i + count] !== symbol) { reason = 'different'; break; }
      count++;
      const c = count;
      t.frame(() => ({
        line: [6, 7, 8],
        note: `The next symbol is also ${say(symbol)}, so the run grows to ${c}.`,
        views: encodeViews(start, c, -1, false),
        vars: { symbol: say(symbol), count: c },
      }));
    }
    runs.push([count, symbol]);
    t.count('runs');
    t.count('output bits', PAIR_BITS);
    const c = count;
    const stopper = reason === 'different' ? i + count : -1;
    const why = reason === 'different'
      ? `The next symbol is ${say(text[i + count])}, not ${say(symbol)}, so the run ends.`
      : reason === 'full'
        ? `The count has reached ${maxRun}, the largest number its field can hold, so this pair is closed and a new one will carry on.`
        : 'The input ends here, so the run ends too.';
    const verdict = c === 1
      ? 'That is 16 bits for a single symbol that took 8 bits before: a loss.'
      : c === 2 ? 'That is 16 bits for 2 symbols that took 16 bits before: no gain, no loss.'
        : `That is 16 bits for ${c} symbols that took ${c * SYMBOL_BITS} bits before.`;
    t.frame(() => ({
      line: 9,
      note: `${why} Write the pair **(${c}, ${say(symbol)})**. ${verdict}`,
      views: encodeViews(start, c, stopper, true),
      vars: { symbol: say(symbol), count: c },
    }));
    i += count;
  }

  const outputBits = runs.length * PAIR_BITS;

  // Decode, to show that nothing was lost.
  let decoded = '';
  const decodeViews = (k, added) => [{
    kind: 'rows', title: 'Decoding',
    legend: [{ label: 'pair being expanded, and the symbols it produced', role: 'current' }, { label: 'done', role: 'done' }],
    rows: [
      { label: 'Pairs', cells: runs.map((r, j) => ({ t: pairText(r), role: j < k ? 'done' : j === k ? 'current' : 'default' })) },
      { label: 'Decoded', cells: [...decoded].map((ch, j) => ({ t: show(ch), role: j >= decoded.length - added ? 'active' : 'done' })) },
    ],
  }];
  runs.forEach(([count, symbol], k) => {
    decoded += symbol.repeat(count);
    t.frame(() => ({
      line: [15, 16],
      note: `Decoding pair ${k + 1} of ${runs.length}: write ${say(symbol)} ${count === 1 ? 'once' : `${count} times`}.`,
      views: decodeViews(k, count),
      vars: { count, symbol: say(symbol), 'decoded so far': decoded.length },
    }));
  });
  if (decoded !== text) throw new Error('Internal error: the decoded text does not match the input.');

  const percent = Math.round((100 * outputBits) / inputBits);
  t.frame(() => ({
    line: 17,
    note: outputBits < inputBits
      ? `Done. ${runs.length} pairs take **${outputBits} bits**, down from ${inputBits}: ${percent}% of the original size. Decoding gave back the input exactly.`
      : outputBits === inputBits
        ? `Done. ${runs.length} pairs take **${outputBits} bits**, exactly the size of the input. The runs were too short to save anything. Decoding gave back the input exactly.`
        : `Done. ${runs.length} pairs take **${outputBits} bits**, more than the ${inputBits} bits of the input. The runs here are too short, so run-length encoding made the data **larger**. Decoding still gave back the input exactly.`,
    views: [{
      kind: 'rows', title: 'Result',
      rows: [
        { label: 'Input', cells: [...text].map((ch) => ({ t: show(ch), role: 'done' })) },
        { label: 'Output pairs', cells: runs.map((r) => ({ t: pairText(r), role: 'done' })) },
        { label: 'Size', cells: [{ t: inputBits, sub: 'bits in' }, { t: outputBits, sub: 'bits out', role: outputBits > inputBits ? 'alert' : 'done' }] },
      ],
    }],
    vars: { 'input bits': inputBits },
  }));

  return { text, runs, decoded, inputBits, outputBits, ratio: outputBits / inputBits };
}

// Independent reference for the tests: let the regular-expression engine find the runs.
const referenceRuns = (text) => (text.match(/(.)\1*/gs) || []).map((s) => `${s.length}${s[0]}`).join('|');
const sameAsReference = (r) => {
  const got = r.runs.map(([c, s]) => `${c}${s}`).join('|');
  if (got !== referenceRuns(r.text)) return `runs ${got} differ from the reference ${referenceRuns(r.text)}`;
  if (r.decoded !== r.text) return 'decoding did not return the input';
  if (r.inputBits !== 8 * r.text.length || r.outputBits !== 16 * r.runs.length) return 'bit counts do not follow the stated cost model';
  return true;
};

const alternatingRuns = (len, total = 512) => {
  let s = '';
  for (let k = 0; s.length < total; k++) s += (k % 2 ? 'B' : 'A').repeat(Math.min(len, total - s.length));
  return s;
};

export default {
  meta: {
    id: 'run-length-encoding',
    name: 'Run-Length Encoding',
    aliases: ['RLE', 'run length coding', 'run-length compression'],
    kind: 'algorithm',
    discipline: 'information-theory',
    alsoIn: [
      { id: 'computer-graphics', why: 'Simple image formats store each row of pixels as runs of one colour.' },
    ],
    subfield: 'Run-length methods',
    family: 'Lossless compression',
    lab: 'compression',
    compareGroup: 'lossless-compression',
    summary: 'Replaces each run of a repeated symbol with a count and the symbol. Shrinks data with long runs and makes data without runs larger.',
    difficulty: 'beginner',
    order: 800,
    paradigms: ['incremental'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n)', average: 'O(n)', worst: 'O(n)', class: 'linear' },
    space: { worst: 'O(1) working memory; the output can be up to twice the input', class: 'constant' },
    tags: {
      problems: ['compress files', 'make data smaller', 'store repeated values compactly', 'compress a simple image'],
      techniques: ['run counting', 'single pass', 'lossless compression'],
      applications: ['data compression', 'image processing', 'computer graphics'],
    },
    prerequisites: ['concept:array'],
  },

  bigIdea: {
    simple: 'Run-length encoding is a way to write repeated things in less space. Suppose you are reading a row of floor tiles aloud to a friend: white, white, white, white, white, white, black, black. You would soon stop naming each tile. You would say "six white, then two black" instead. That is the whole idea. A run is a stretch of the same thing repeated, with nothing else in between. Run-length encoding replaces every run with two pieces of information: how many, and of what. Your friend can rebuild the row exactly, tile for tile, so nothing is lost. This saves a lot of space when the data has long runs, like a drawing with large areas of one colour. It does not help with ordinary writing, where a letter is rarely followed by the same letter. There it makes things longer, because every single letter now needs its own count.',
    what: 'Run-length encoding (RLE) rewrites data as a list of pairs. Each pair says "this symbol, repeated this many times", so `WWWWWWBB` becomes (6, W), (2, B). Decoding writes each symbol out the stated number of times and gets the original back exactly. A method with that property is called **lossless**.',
    why: 'It is the simplest idea in compression and it costs almost nothing to run: one pass over the data, no tables, a single counter in memory. That made it practical on very limited hardware, and it is still used as one stage inside larger methods. A fax machine, for example, sends each scanned line of a page as the lengths of its alternating white and black runs.',
    when: 'Use it when you know the data has long runs: scanned black-and-white pages, icons and drawings with flat colour, tables that are mostly zeros. Do not use it as a general-purpose compressor. In text and in photographs the runs are short, and the output is larger than the input. [LZ77](#/algorithm/lz77) handles repeated phrases that are not next to each other, and [Huffman coding](#/algorithm/huffman-coding) handles symbols that are common but scattered.',
    interesting: 'Run-length encoding can make data bigger. That is not a defect of this one method. No lossless compressor can shrink every input, because there are more possible inputs of a given length than there are shorter outputs to give them. Every compressor is a bet about what the data looks like. This one makes its bet in plain view: it bets on runs.',
    where: 'Fax transmission, the PackBits scheme used in TIFF images, the run-length modes of the BMP and PCX image formats, and the runs of zero values inside a JPEG file all use run-length encoding, usually followed by a second coding stage.',
    analogy: {
      title: 'A knitting pattern',
      text: 'A knitting pattern does not list every stitch. It says "knit 6, purl 2, knit 6". The knitter reads a count and a kind of stitch, and produces exactly the row the designer meant. Run-length encoding writes data the same way: a count, then the thing to repeat.',
      limits: 'A designer chooses rows with long repeats. Data does not cooperate like that. A row that switched between knit and purl on every stitch would be longer as a pattern than as a plain list, and that is exactly what happens to ordinary text. The picture also hides a cost. A person reads "6" without thinking about the room it takes, but in a file the count occupies space of its own: 8 bits for every run in this lesson.',
    },
  },

  example: {
    setup: 'Encode the ten letters AAAABBBCCD. A bit is a single 0 or 1, the smallest unit of computer storage. In this lesson every letter of the input takes 8 bits, so the input is 80 bits. Every pair in the output takes 16 bits: 8 for the count and 8 for the letter.',
    steps: [
      'Read A. The next three letters are also A, and then comes a B. The run is 4 long, so write the pair (4, A).',
      'Read B. Two more B follow, and then comes a C. Write (3, B).',
      'Read C. One more C follows, and then comes a D. Write (2, C).',
      'Read D. The text ends, so this run is only 1 long. Write (1, D).',
      'To decode, read the pairs in order and write each letter the stated number of times: AAAA, then BBB, then CC, then D.',
    ],
    result: 'The output is (4, A), (3, B), (2, C), (1, D). That is 4 pairs, or 64 bits instead of 80. Look at the last pair: it spends 16 bits on one letter that took 8 bits before. A run of one always costs more than it saves.',
    tryInput: { text: 'AAAABBBCCD' },
  },

  terms: [
    { term: 'Symbol', meaning: 'One item of the data: a letter of a text, or one pixel of an image.' },
    { term: 'Bit', meaning: 'A single 0 or 1, the smallest unit of storage. Sizes in this lesson are counted in bits.' },
    { term: 'Run', meaning: 'A stretch of the same symbol repeated, with nothing else in between.' },
    { term: 'Run length', meaning: 'How many symbols a run contains.' },
    { term: 'Encode', meaning: 'To rewrite data in another form, here as a list of (count, symbol) pairs.' },
    { term: 'Decode', meaning: 'To turn the encoded form back into the original data.' },
    { term: 'Lossless', meaning: 'Describes compression where decoding gives back the original exactly, with nothing changed or missing.' },
  ],

  takeaway: 'Instead of repeating a symbol, say how many times it repeats, and expect this to pay off only when the repeats are long.',

  viz: {
    describe: 'Three strips of cells. The top strip is the input text, one symbol per cell: the run being counted is terracotta, the symbol that ends it is brick red, and symbols already encoded are forest green. The middle strip collects the output pairs, each written as a count, a multiplication sign and a symbol. The bottom strip compares the size of the input with the size of the output so far, in bits. After encoding, the pairs are decoded one by one into a second strip to show that the input comes back exactly.',
    inputs: [
      { id: 'text', type: 'text', label: 'Text to compress', default: 'WWWWWWBBBBWWWWWWWWBB', maxLength: 60,
        help: 'Up to 60 characters. Each one counts as 8 bits. Spaces are shown as ␣.' },
    ],
    presets: [
      { label: 'Long runs', values: { text: 'WWWWWWBBBBWWWWWWWWBB' } },
      { label: 'No runs: the output doubles', values: { text: 'ABCDEFGHIJ' } },
      { label: 'Runs of two: break even', values: { text: 'AABBCCDDEE' } },
      { label: 'Ordinary words', values: { text: 'she sells sea shells' } },
      { label: 'One long run', values: { text: 'A'.repeat(40) } },
    ],
    tryThis: [
      'Load "No runs: the output doubles" and compare the two numbers in the Size row at the last step. Then retype the text so that two neighbouring letters match, and see which pair absorbs them.',
      'Load "Runs of two: break even". Every pair costs 16 bits and replaces exactly 16 bits. Add one more letter to any run and watch the output fall below the input.',
      'Type a sentence of your own. Before running it, count the runs: the output will be 16 bits times that count. Ordinary sentences have almost as many runs as letters.',
    ],
    run,
    report: (r) => `${r.runs.length} ${r.runs.length === 1 ? 'run' : 'runs'} in ${r.text.length} symbols.\nInput:  ${r.text.length} × 8 bits = ${r.inputBits} bits\nOutput: ${r.runs.length} × 16 bits = ${r.outputBits} bits (${Math.round(100 * r.ratio)}% of the input)\nPairs: ${r.runs.map(pairText).join(' ')}\nDecoded: "${r.decoded}" (identical to the input)`,
    experiment: {
      title: 'Output size as the runs get longer',
      note: 'Each point is a real run of this page\'s encoder on 512 symbols made of alternating runs of A and B, all of the given length. The input always costs 4,096 bits. The output costs 16 bits per run, so it is twice the input for runs of one, equal to it for runs of two, and smaller after that.',
      metric: 'output bits',
      metricLabel: 'Output bits',
      sizeLabel: 'Length of every run (symbols)',
      sizes: [1, 2, 4, 8, 16, 32, 64],
      variants: [{ id: 'alternating', label: 'Run-length encoded output' }],
      input: (len) => ({ text: alternatingRuns(len) }),
      theory: [
        { label: '16 × 512 ÷ run length', fn: (len) => (16 * 512) / len },
        { label: 'input size (4,096 bits)', fn: () => 4096 },
      ],
    },
  },

  logic: {
    intuition: 'Storing a symbol that repeats is wasteful, because after the first one the rest carry no news. The only new fact is where the repetition stops. Run-length encoding records exactly that: it walks along the data, counts until the symbol changes, and writes the count next to one copy of the symbol.',
    steps: [
      'Start at the first symbol of the input.',
      'Remember the symbol at the current position and set a counter to 1.',
      'Look at the next symbol. While it is the same as the remembered one, and the counter has not reached its largest value, add 1 to the counter and look one further.',
      'Write the pair (counter, symbol) to the output.',
      'Jump forward past the run just counted. If any input is left, go back to step 2.',
      'To decode, read the pairs in order and write each symbol as many times as its count says.',
    ],
    pseudocode: [
      'encode(text):',
      '  runs ← empty list',
      '  i ← 0',
      '  while i < length(text):',
      '    symbol ← text[i]',
      '    count ← 1',
      '    while i + count < length(text)',
      '        and text[i + count] = symbol and count < 255:',
      '      count ← count + 1',
      '    append (count, symbol) to runs',
      '    i ← i + count',
      '  return runs',
      '',
      'decode(runs):',
      '  text ← empty',
      '  for each (count, symbol) in runs:',
      '    append symbol to text, count times',
      '  return text',
    ],
    decisions: [
      { title: 'How many bits for the count?', text: 'This lesson gives the count 8 bits, so one pair can describe a run of up to 255 symbols. A wider count handles longer runs in one pair but makes every pair more expensive, including the pairs for runs of one. The right width depends on how long the runs in your data usually are.' },
      { title: 'What happens when a run is longer than the count can hold?', text: 'The run is split. A run of 300 W becomes (255, W) followed by (45, W). The decoder needs no special rule: it writes 255 and then 45 more.' },
      { title: 'How to stop data without runs from doubling?', text: 'Practical formats add a second kind of record that means "the next k symbols are stored as they are". Stretches without repeats then cost a little over 8 bits per symbol instead of 16. PackBits works this way. This lesson leaves it out so that the basic method stays visible.' },
      { title: 'What counts as a symbol?', text: 'Anything of fixed size: a byte, a pixel, a single bit. When the symbols are single bits, as in a black-and-white scan, the two values must alternate, so the output can store the run lengths alone and leave the symbols out.' },
    ],
    invariants: [
      'The pairs written so far decode to exactly the part of the input that has already been read.',
      'Every count is at least 1 and at most 255.',
      'Two neighbouring pairs hold the same symbol only when the first of them is full, with a count of 255.',
    ],
    edgeCases: [
      'Empty input: there are no runs, so the output is empty. The player on this page asks for at least one character.',
      'No two neighbouring symbols are equal: every run has length 1 and the output is twice the size of the input.',
      'A run longer than 255 is split into several pairs with the same symbol.',
      'The last run has no different symbol after it. The encoder must still write it when the input ends.',
      'If the output is written as text such as `3A`, digits inside the data make it ambiguous: `112` could be eleven 2s or a 1 followed by a 2. Fixed-size binary fields, as counted in this lesson, avoid the problem.',
    ],
    correctness: 'Split the input into its maximal runs $r_1, r_2, \\dots, r_k$, so that the input is their concatenation. The outer loop handles one run per pass: the inner loop advances exactly while the symbol stays the same, so the pair it writes describes $r_j$ (or the first 255 symbols of it, in which case the next pass starts inside the same run and describes the rest). The decoder expands each pair to the same symbols in the same order. By induction on the number of pairs, the decoded text equals the input read so far, and when the input is exhausted it equals the whole input.',
    mistakes: [
      'Forgetting the last run. A loop that writes a pair only when the symbol changes never writes the final one, because nothing follows it.',
      'Letting the count overflow its field. A run of 256 stored in 8 bits wraps around to 0 and the decoder loses those symbols.',
      'Reading one position past the end of the input when comparing with the next symbol.',
      'Assuming the output is smaller and allocating a buffer the size of the input. The worst case is twice the input.',
    ],
  },

  code: {
    sample: {
      input: 'Two texts: "WWWWWWBBBBWWWWWWWWBB", which has long runs, and "ABCDEFGH", which has none. For each, print the pairs, the sizes under this lesson\'s cost model, and whether decoding returns the original.',
      expected: '6W 4B 8W 2B\n160 bits -> 64 bits\nround trip ok\n1A 1B 1C 1D 1E 1F 1G 1H\n64 bits -> 128 bits\nround trip ok',
    },
    python: {
      source: `MAX_RUN = 255  # the largest count that fits in 8 bits


def encode(text):
    runs = []
    i = 0
    while i < len(text):
        symbol = text[i]
        count = 1
        while i + count < len(text) and text[i + count] == symbol and count < MAX_RUN:
            count += 1
        runs.append((count, symbol))
        i += count
    return runs


def decode(runs):
    return "".join(symbol * count for count, symbol in runs)


for text in ["WWWWWWBBBBWWWWWWWWBB", "ABCDEFGH"]:
    runs = encode(text)
    print(" ".join(f"{count}{symbol}" for count, symbol in runs))
    print(f"{8 * len(text)} bits -> {16 * len(runs)} bits")
    print("round trip ok" if decode(runs) == text else "round trip FAILED")`,
      notes: [
        { line: 10, text: 'The inner loop extends the run. It stops at the end of the text, at a different symbol, or when the count is full.' },
        { line: 12, text: 'This line runs once per run, including the last one. Writing the pair here, after the inner loop, is what avoids the classic bug of losing the final run.' },
        { line: 13, text: 'Jump over the whole run. Every symbol is visited once, so the running time is linear in the length of the text.' },
        { line: 24, text: 'The cost model of this lesson: 8 bits per input symbol, and 16 bits per pair (8 for the count, 8 for the symbol).' },
      ],
    },
    javascript: {
      source: `const MAX_RUN = 255; // the largest count that fits in 8 bits

function encode(text) {
  const runs = [];
  let i = 0;
  while (i < text.length) {
    const symbol = text[i];
    let count = 1;
    while (i + count < text.length && text[i + count] === symbol && count < MAX_RUN) {
      count++;
    }
    runs.push([count, symbol]);
    i += count;
  }
  return runs;
}

function decode(runs) {
  return runs.map(([count, symbol]) => symbol.repeat(count)).join("");
}

for (const text of ["WWWWWWBBBBWWWWWWWWBB", "ABCDEFGH"]) {
  const runs = encode(text);
  console.log(runs.map(([count, symbol]) => count + symbol).join(" "));
  console.log(8 * text.length + " bits -> " + 16 * runs.length + " bits");
  console.log(decode(runs) === text ? "round trip ok" : "round trip FAILED");
}`,
    },
    cpp: {
      source: `#include <iostream>
#include <string>
#include <utility>
#include <vector>

const int MAX_RUN = 255;  // the largest count that fits in 8 bits

std::vector<std::pair<int, char>> encode(const std::string& text) {
    std::vector<std::pair<int, char>> runs;
    std::size_t i = 0;
    while (i < text.size()) {
        char symbol = text[i];
        int count = 1;
        while (i + count < text.size() && text[i + count] == symbol && count < MAX_RUN) {
            ++count;
        }
        runs.push_back({count, symbol});
        i += count;
    }
    return runs;
}

std::string decode(const std::vector<std::pair<int, char>>& runs) {
    std::string text;
    for (const auto& [count, symbol] : runs) text.append(count, symbol);
    return text;
}

int main() {
    for (const std::string text : {"WWWWWWBBBBWWWWWWWWBB", "ABCDEFGH"}) {
        auto runs = encode(text);
        for (std::size_t k = 0; k < runs.size(); ++k) {
            std::cout << runs[k].first << runs[k].second << (k + 1 < runs.size() ? " " : "\\n");
        }
        std::cout << 8 * text.size() << " bits -> " << 16 * runs.size() << " bits\\n";
        std::cout << (decode(runs) == text ? "round trip ok" : "round trip FAILED") << "\\n";
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The encoder looks at every symbol once and does a constant amount of work for it, so the time grows in direct proportion to the length of the input. The interesting quantity is not time but output size, and that depends on the number of runs, not on the length.',
    cases: [
      { case: 'Time, every input', time: 'O(n)', when: 'One pass. Each symbol is compared with its neighbour once.' },
      { case: 'Output size, best', time: '16 × ⌈n / 255⌉ bits', when: 'The whole input is one symbol repeated. A pair covers up to 255 symbols.' },
      { case: 'Output size, worst', time: '16n bits (twice the input)', when: 'No symbol equals its neighbour, so every run has length 1.' },
      { case: 'Output size, in general', time: '16r bits', when: 'r is the number of runs. The output is smaller than the input exactly when the average run is longer than 2 symbols.' },
    ],
    space: 'O(1) working memory: the current symbol and a counter. The output is written as it is produced and needs up to twice the space of the input.',
    memory: 'Both directions work as streams. Neither the encoder nor the decoder has to hold the whole input, which is why the method suited fax machines and other simple hardware.',
    tradeoffs: 'Run-length encoding buys speed and simplicity by looking for only one kind of redundancy. It finds nothing in data where symbols are unevenly frequent but scattered, or where whole phrases repeat at a distance. Entropy coders and dictionary coders find those, at a higher cost in time, memory and code.',
    assumptions: [
      'Each input symbol occupies 8 bits, and each output pair occupies 16 bits: an 8-bit count (1 to 255) and an 8-bit symbol. Other field widths change the constants, not the shape.',
      'Comparing two symbols and writing a pair take constant time.',
      'Sizes on this page come from that cost model. No header, file format overhead or end marker is counted.',
    ],
  },

  tradeoffs: {
    excels: [
      'Data with long runs: black-and-white scans, flat-colour drawings, masks, tables that are mostly zeros.',
      'Very small or slow devices, where one counter and one pass are all that is affordable.',
      'As a cheap first or middle stage in a pipeline whose other stages create long runs.',
    ],
    struggles: [
      'Natural-language text, where equal neighbours are rare.',
      'Photographs and audio, where neighbouring values are close but seldom exactly equal.',
      'Repetition at a distance, such as a word that returns every few lines. Run-length encoding only sees neighbours.',
    ],
    pitfalls: [
      'Expansion on unsuitable data, up to a factor of two with the plain scheme.',
      'Count overflow when a run is longer than the count field allows.',
      'A text output format in which counts and data digits cannot be told apart.',
    ],
    misunderstandings: [
      '"Compression always makes data smaller." Run-length encoding doubles the size of data without runs, and every lossless method must make some inputs larger.',
      '"Run-length encoding removes all repetition." It only removes repetition between immediate neighbours. In the text ABABABAB the pattern AB repeats four times, and run-length encoding sees eight runs of one.',
      '"Something must be lost if the output is smaller." Nothing is lost. Decoding the pairs gives back the input exactly, symbol for symbol.',
    ],
    constraints: [
      'Real formats bound the worst case with literal records for stretches without repeats.',
      'Run lengths are usually passed on to a second coder, because some lengths are far more common than others.',
    ],
    alternatives: [
      { id: 'lz77', name: 'LZ77', when: 'The data repeats phrases at a distance. LZ77 can also copy from one symbol back, which reproduces a run, so it covers this case too.' },
      { id: 'huffman-coding', name: 'Huffman Coding', when: 'Some symbols are much more common than others but do not sit next to each other.' },
      { name: 'PackBits', when: 'You want run-length encoding with a bounded worst case. It mixes repeat records with literal records.' },
    ],
    comparison: {
      columns: ['', 'Run-length encoding', 'Huffman coding', 'LZ77'],
      rows: [
        ['Redundancy it removes', 'Equal neighbours', 'Uneven symbol frequencies', 'Repeated substrings within a window'],
        ['Passes over the data', 'One', 'Two (count, then encode)', 'One, with a search at each step'],
        ['Working memory', 'A counter', 'A tree with one leaf per distinct symbol', 'The sliding window'],
        ['Worst case in this atlas\'s cost models', 'Twice the input', 'At most the size of the input, plus a code table', 'Larger than the input when nothing repeats'],
      ],
    },
  },

  applications: [
    { title: 'Fax transmission', status: 'established', text: 'The Group 3 fax standard (ITU-T T.4) describes each scanned line as alternating runs of white and black pixels and sends the run lengths with a fixed table of variable-length codes. A typed page is mostly long white runs, which is why this works well.' },
    { title: 'Simple image formats', status: 'established', text: 'BMP has run-length modes for 4-bit and 8-bit images, PCX stores rows of pixels as runs, and TIFF offers PackBits, a byte-oriented run-length scheme first used by Apple\'s MacPaint.' },
    { title: 'Zero runs inside JPEG', status: 'established', text: 'After a JPEG encoder transforms and quantizes a block of pixels, most of the resulting values are zero. The encoder stores each non-zero value together with the number of zeros that came before it, and then Huffman-codes those combinations.' },
    { title: 'Mostly empty grids', status: 'illustrative', text: 'A tile map for a game, a spreadsheet column with one repeated value, or a mask marking which pixels belong to an object can all be stored as runs when long stretches are identical.' },
  ],

  connections: [
    { to: 'lz77', type: 'advanced', why: 'LZ77 replaces a repeat with a pointer back to an earlier copy. A run is the special case where the copy starts one symbol back, so LZ77 does everything run-length encoding does and more.' },
    { to: 'huffman-coding', type: 'same-problem', why: 'Both are lossless compressors and are often chained: run-length encoding turns runs into counts, and Huffman coding then gives the most common counts the shortest codes. Fax and JPEG both do this.' },
    { to: 'concept:array', type: 'prerequisite', why: 'The algorithm is a single left-to-right scan over a sequence, comparing each element with the one after it.' },
    { to: 'concept:entropy', type: 'advanced', why: 'Entropy measures how many bits per symbol a source really needs. Run-length encoding approaches that limit only for sources dominated by long runs.' },
    { to: 'concept:invariant', type: 'related', why: 'Its correctness rests on one loop invariant: the pairs written so far decode to the input read so far.' },
    { to: 'discipline:computer-graphics', type: 'application', why: 'Rows of pixels in flat-colour images are long runs, which several image formats store as counts.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'With 8 bits per input symbol and 16 bits per pair, when is the output smaller than the input?',
      options: ['Always', 'When the input has more than 16 symbols', 'When the runs are longer than 2 symbols on average', 'When the input uses only two different symbols'],
      answer: 2,
      explain: [
        'Not always. Data without runs comes out twice as large.',
        'Length alone does not matter. A long text with no repeated neighbours still doubles.',
        'Correct. A pair costs as much as 2 input symbols, so it saves space only when it stands for more than 2.',
        'Two symbols can still alternate, as in ABABAB, which gives runs of one.',
      ],
    },
    {
      type: 'predict',
      q: 'The text ABABABAB is 8 symbols, or 64 bits. How many bits will the run-length encoded output take?',
      options: ['16', '32', '64', '128'],
      answer: 3,
      explain: [
        '16 bits would be one pair. The text is not one run.',
        '32 bits would be two pairs. That would need a method that notices the repeated pattern AB, which this one does not.',
        '64 bits would be four pairs. Count the runs again: each letter differs from the one before it.',
        'Correct. No letter equals its neighbour, so there are 8 runs of length 1, and 8 pairs at 16 bits each is 128 bits: twice the input.',
      ],
      tryInput: { text: 'ABABABAB' },
    },
    {
      type: 'debug',
      q: 'This encoder returns the wrong answer for almost every input. For "AAB" it returns [(2, "A")]. What is wrong?',
      code: `def encode(text):
    runs = []
    count = 1
    for i in range(1, len(text)):
        if text[i] == text[i - 1]:
            count += 1
        else:
            runs.append((count, text[i - 1]))
            count = 1
    return runs`,
      options: ['The loop should start at 0', 'The final run is never written, because a pair is only appended when the symbol changes', 'count should be reset to 0, not 1', 'It should compare text[i] with text[i + 1]'],
      answer: 1,
      explain: [
        'Starting at 1 is right here: position 0 has no earlier symbol to compare with.',
        'Correct. After the loop, the last run is still held in `count`. One more `runs.append((count, text[-1]))` is needed before returning (for non-empty text).',
        'The symbol that broke the run is itself the first symbol of the next run, so the count restarts at 1.',
        'Comparing with the next symbol would read past the end and would not fix the missing final run.',
      ],
    },
    {
      type: 'choice',
      q: 'Which of these would run-length encoding compress best?',
      options: ['A page of a novel', 'A photograph of a forest', 'A scanned page with a few lines of black text on white paper', 'A list of random numbers'],
      answer: 2,
      explain: [
        'Letters in prose rarely repeat immediately, so nearly every run has length 1.',
        'Neighbouring pixels in a photograph are similar but seldom identical, so runs are short.',
        'Correct. Most of every scan line is unbroken white, which gives very long runs.',
        'Random data has no structure to exploit. Equal neighbours occur only by chance.',
      ],
    },
    {
      type: 'challenge',
      title: 'Bound the worst case',
      prompt: 'Extend the encoder with a second kind of record so that data without runs grows only slightly. Use one header byte: a value from 0 to 127 means "the next header + 1 bytes are literal data", and a value from 129 to 255 means "repeat the next byte 257 − header times". Write the matching decoder, check the round trip on several texts, and work out the largest possible output for an input of n bytes.',
      hints: [
        'Only start a repeat record for runs of 3 or more. A run of 2 is cheaper left inside a literal record.',
        'A literal record holds at most 128 bytes, so the worst case adds one header byte for every 128 bytes of input.',
      ],
    },
  ],

  compare: {
    idea: 'Replace each run of one repeated symbol with a count and the symbol.',
    requires: 'Nothing. It is always correct. It only pays off when equal symbols sit next to each other.',
    sensitivity: 'Very high. Output size is 16 bits per run in this model: tiny for long runs, double the input for none.',
    memory: 'A single counter. Works as a stream.',
    difficulty: 'low',
    difficultyNote: 'A dozen lines. The usual bug is forgetting to write the last run.',
    limits: 'Sees only immediate neighbours. Expands data without runs.',
    useWhen: 'The data is known to contain long runs, or speed and simplicity matter more than the best ratio.',
  },

  advanced: {
    history: 'Run-length coding has no single inventor. In the 1960s it was studied as a way to reduce the bandwidth of television pictures, and in 1966 Solomon Golomb described variable-length codes designed for run lengths. It reached everyday use through fax: the Group 3 standard adopted in 1980 codes each scan line as run lengths. Early personal-computer image formats such as PCX, and the PackBits scheme of Apple\'s MacPaint, used byte-oriented variants.',
    derivation: 'Let the input have $n$ symbols of $s$ bits each, grouped into $r$ runs, and let the count field have $b$ bits. The input costs $ns$ bits and the output costs $r(b + s)$ bits, so the output is smaller exactly when\n\n$$\\frac{n}{r} > \\frac{b + s}{s}.$$\n\nThe left side is the average run length. With $b = s = 8$, as in this lesson, the threshold is 2. A wider count field raises the threshold, and a narrower one lowers it but forces long runs to be split, since one pair then covers at most $2^b - 1$ symbols.',
    proof: 'No lossless compressor can make every input smaller. There are $2^n$ different bit strings of length $n$, but only $2^0 + 2^1 + \\dots + 2^{n-1} = 2^n - 1$ bit strings that are shorter. A lossless encoder must give different outputs to different inputs, or the decoder could not tell them apart. So at least one input of length $n$ cannot be given a shorter output. The same counting shows that if some inputs shrink, others must grow. Run-length encoding is a clear instance: inputs with long runs shrink and inputs without runs double.',
    complexityProof: 'The index $i$ only moves forward, by the length of the run just counted, and the inner loop performs one comparison per symbol of that run plus at most one failed comparison. The total number of symbol comparisons is therefore at most $n$, and the number of pairs written is the number of runs, at most $n$. Time is $\\Theta(n)$ and the output is at most $n(b + s)$ bits.',
    variants: [
      { name: 'PackBits', text: 'A header byte announces either a literal stretch of up to 128 bytes or a repeat of one byte up to 128 times. Data without runs grows by one byte in every 128 instead of doubling.' },
      { name: 'Run lengths only', text: 'For two-valued data such as a black-and-white scan, the symbols alternate, so only the lengths are stored. Fax coding works this way.' },
      { name: 'Run-length plus entropy coding', text: 'Run lengths are not equally likely, so they are passed to a Huffman or Golomb coder. Fax uses a fixed Huffman-style table, and JPEG Huffman-codes zero-run lengths together with the value that follows.' },
      { name: 'Escape-based run-length encoding', text: 'Symbols are copied through unchanged, and a reserved marker value introduces a (count, symbol) record only where a run is long enough to be worth it.' },
    ],
    implementation: 'Choose the count width from measurements of your data. Split runs that exceed it. Size the output buffer for the worst case, or use a literal-record variant that bounds it. When the result will be entropy-coded afterwards, emit run lengths in a form that keeps common lengths as distinct symbols.',
    benchmarking: 'Report the compression ratio together with a description of the data, because the ratio says more about the data than about the encoder. Test on inputs with no runs as well as inputs with long ones, and check the round trip on every test.',
    references: [
      { authors: 'S. W. Golomb', year: 1966, title: 'Run-length encodings', venue: 'IEEE Transactions on Information Theory 12(3), 399-401' },
      { authors: 'A. H. Robinson and C. Cherry', year: 1967, title: 'Results of a prototype television bandwidth compression scheme', venue: 'Proceedings of the IEEE 55(3), 356-364' },
      { authors: 'R. Hunter and A. H. Robinson', year: 1980, title: 'International digital facsimile coding standards', venue: 'Proceedings of the IEEE 68(7), 854-867' },
    ],
    furtherReading: [
      'K. Sayood, *Introduction to Data Compression*, the chapters on run-length coding and facsimile encoding.',
      'D. Salomon, *Data Compression: The Complete Reference*, the chapter on run-length encoding.',
    ],
  },

  tests: [
    { name: 'default input matches a regular-expression reference and round-trips', input: {}, check: sameAsReference },
    { name: 'the worked example: 80 bits become 64', input: { text: 'AAAABBBCCD' },
      check: (r) => (r.inputBits === 80 && r.outputBits === 64 && r.runs.map(([c, s]) => `${c}${s}`).join(' ') === '4A 3B 2C 1D') || `got ${r.inputBits} -> ${r.outputBits}` },
    { name: 'text without runs doubles in size', input: { text: 'ABABABAB' },
      check: (r) => (r.inputBits === 64 && r.outputBits === 128 && r.runs.length === 8 && r.decoded === 'ABABABAB') || `got ${r.outputBits} bits` },
    { name: 'runs of two break even', input: { text: 'AABBCCDDEE' },
      check: (r) => (r.inputBits === 80 && r.outputBits === 80) || `got ${r.inputBits} -> ${r.outputBits}` },
    { name: 'ordinary words expand and still round-trip', input: { text: 'she sells sea shells' },
      check: (r) => (sameAsReference(r) === true && r.inputBits === 160 && r.outputBits === 288) || `got ${r.outputBits} bits` },
    { name: 'a run longer than the count limit is split', input: { text: 'AAAAAAAAAAB', maxRun: 4 },
      check: (r) => (r.runs.map(([c, s]) => `${c}${s}`).join(' ') === '4A 4A 2A 1B' && r.decoded === r.text) || `got ${r.runs.join(' ')}` },
    { name: 'digits, spaces and a run of one', input: { text: '11  22 3' },
      check: (r) => (sameAsReference(r) === true && r.runs.length === 5) || 'digits or spaces were mishandled' },
    { name: 'one long run costs one pair', input: { text: 'A'.repeat(40) },
      check: (r) => (r.outputBits === 16 && r.inputBits === 320 && r.decoded.length === 40) || `got ${r.outputBits} bits` },
  ],
};
