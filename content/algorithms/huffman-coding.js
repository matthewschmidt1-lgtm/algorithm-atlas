import { layoutTree } from '../../js/lib/graphs.js';

// Huffman coding. Bit-cost model used throughout this lesson:
//   input   8 bits per symbol (every character is treated as one byte)
//   output  the sum of the code lengths of all symbols in the text
// The code table, which a real decoder also needs, is NOT counted. The lesson says so wherever a size is quoted.

const show = (ch) => (ch === ' ' ? '␣' : ch);
// Symbols quoted inside notes pass through the inline-markup parser, so the few characters it reacts to are swapped for look-alikes.
const say = (ch) => ({ $: '＄', '*': '∗', '`': 'ˋ' }[ch] || show(ch));

function checkText(text) {
  if (!text.length) throw new Error('Type at least one character to compress.');
  for (const ch of text) {
    if (ch.codePointAt(0) > 255) throw new Error(`This lesson counts every character as one 8-bit byte, so it accepts only basic Latin characters. Remove "${ch}" and run it again.`);
  }
}

function countSymbols(text) {
  const freq = new Map();
  for (const ch of text) freq.set(ch, (freq.get(ch) || 0) + 1);
  const symbols = [...freq.keys()].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
  return { freq, symbols };
}

// A binary min-heap of tree nodes ordered by weight, then by age (smaller id first), so that
// ties always break the same way. It reports its comparisons to the tracer.
function makeHeap(t) {
  const h = [];
  const less = (i, j) => { t.count('heap comparisons'); return h[i].weight < h[j].weight || (h[i].weight === h[j].weight && h[i].id < h[j].id); };
  const swap = (i, j) => { const x = h[i]; h[i] = h[j]; h[j] = x; };
  return {
    get size() { return h.length; },
    items: () => h.slice().sort((a, b) => a.weight - b.weight || a.id - b.id),
    push(node) {
      h.push(node);
      let i = h.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!less(i, p)) break;
        swap(i, p); i = p;
      }
    },
    pop() {
      const top = h[0];
      const last = h.pop();
      if (h.length) {
        h[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < h.length && less(l, m)) m = l;
          if (r < h.length && less(r, m)) m = r;
          if (m === i) break;
          swap(i, m); i = m;
        }
      }
      return top;
    },
  };
}

// The algorithm itself. `on` receives the moments worth drawing; with no hooks it just builds the tree.
function buildTree(symbols, freq, t, on = {}) {
  const nodes = [];
  const make = (weight, symbol, left, right) => {
    const node = { id: nodes.length, weight, symbol, left, right, parent: null, bit: '' };
    if (left) { left.parent = node; left.bit = '0'; right.parent = node; right.bit = '1'; }
    nodes.push(node);
    return node;
  };
  const Q = makeHeap(t);
  for (const s of symbols) Q.push(make(freq.get(s), s, null, null));
  if (on.start) on.start(nodes, Q);
  while (Q.size > 1) {
    const a = Q.pop();
    const b = Q.pop();
    if (on.take) on.take(a, b);
    const parent = make(a.weight + b.weight, null, a, b);
    t.count('merges');
    Q.push(parent);
    if (on.merge) on.merge(parent, a, b);
  }
  return { root: Q.pop(), nodes };
}

// Positions for the picture. The tree is built once more, silently, so that every node can sit
// in its final place from the first frame: leaves in a row at the bottom, each join one level higher.
const SILENT = { count() {}, frame() {} };
function treeLayout(symbols, freq) {
  const { root, nodes } = buildTree(symbols, freq, SILENT);
  const out = new Map();
  if (!root.left) { out.set(root.id, { x: 0.5, y: 0.5 }); return out; }
  const base = layoutTree(root, (nd) => (nd.left ? [nd.left, nd.right] : []));
  const heights = new Map();
  const height = (nd) => {
    if (!heights.has(nd.id)) heights.set(nd.id, nd.left ? 1 + Math.max(height(nd.left), height(nd.right)) : 0);
    return heights.get(nd.id);
  };
  const top = height(root);
  // With many symbols the leaves would overlap in one row, so they are staggered over two or three.
  const leaves = nodes.filter((nd) => !nd.left).sort((a, b) => base.get(a).x - base.get(b).x);
  const rows = leaves.length <= 14 ? 1 : leaves.length <= 28 ? 2 : 3;
  const step = 0.17;
  const band = (rows - 1) * step;
  leaves.forEach((nd, i) => out.set(nd.id, { x: base.get(nd).x, y: 0.92 - (i % rows) * step }));
  for (const nd of nodes) if (nd.left) out.set(nd.id, { x: base.get(nd).x, y: 0.92 - band - (0.84 - band) * (height(nd) / top) });
  out.rows = rows;
  return out;
}

const leavesOf = (nd) => (nd.left ? [...leavesOf(nd.left), ...leavesOf(nd.right)] : [nd.symbol]);
const shortName = (nd) => {
  const s = leavesOf(nd).map(show).join('');
  return s.length > 6 ? `${s.slice(0, 5)}…` : s;
};
const describe = (nd) => (nd.left ? `the subtree holding ${leavesOf(nd).map(say).join(', ')} (count ${nd.weight})` : `**${say(nd.symbol)}** (count ${nd.weight})`);
const f3 = (v) => v.toFixed(3);

function entropyBits(freq, n) {
  let h = 0;
  for (const c of freq.values()) h -= (c / n) * Math.log2(c / n);
  return h;
}

function run(input, t) {
  const text = String(input.text ?? '');
  checkText(text);
  const n = text.length;
  const inputBits = 8 * n;
  const { freq, symbols } = countSymbols(text);
  const k = symbols.length;
  const codes = new Map();
  let nodes = [];
  let Q = null;
  let layout = null;
  const at = (id) => { if (!layout) layout = treeLayout(symbols, freq); return layout.get(id); };
  const aspect = () => { at(0); return layout.rows > 1 ? 0.6 : k === 1 ? 0.34 : 0.5; };

  const buildLegend = [{ label: 'waiting in the queue', role: 'frontier' }, { label: 'being joined now', role: 'current' }, { label: 'already joined into a subtree', role: 'done' }];
  const treeLegend = [{ label: 'path being followed', role: 'current' }, { label: 'finished tree', role: 'done' }];

  const treeView = ({ title, current = new Set(), path = new Set(), building = false, bits = false } = {}) => ({
    kind: 'graph', title, directed: false, aspect: aspect(),
    nodes: nodes.map((nd) => ({
      id: nd.id, x: at(nd.id).x, y: at(nd.id).y,
      label: nd.left ? String(nd.weight) : `${show(nd.symbol)}:${nd.weight}`,
      sub: !nd.left && codes.has(nd.symbol) ? codes.get(nd.symbol) : undefined,
      role: current.has(nd.id) ? 'current' : building && !nd.parent ? 'frontier' : 'done',
    })),
    edges: nodes.filter((nd) => nd.parent).map((nd) => ({ u: nd.parent.id, v: nd.id, w: bits ? nd.bit : undefined, role: path.has(nd.id) ? 'active' : 'tree' })),
    legend: building ? buildLegend : treeLegend,
  });
  const queueRow = () => ({ label: 'Queue', cells: Q.items().map((nd) => ({ t: shortName(nd), sub: nd.weight, role: 'frontier' })) });
  const tableRow = (latest) => ({
    label: 'Code table',
    cells: symbols.filter((s) => codes.has(s)).sort((a, b) => codes.get(a).length - codes.get(b).length || freq.get(b) - freq.get(a) || (a < b ? -1 : 1))
      .map((s) => ({ t: `${show(s)} → ${codes.get(s)}`, sub: `used ${freq.get(s)}×`, role: s === latest ? 'current' : 'done' })),
  });
  const textCells = (upTo, cur) => [...text].map((ch, i) => ({ t: show(ch), role: i === cur ? 'current' : i < upTo ? 'done' : 'default' }));

  t.frame(() => ({
    line: 0,
    note: `The text has ${n} symbols. Stored the plain way, at 8 bits each, it takes **${inputBits} bits**. Huffman coding gives every symbol its own code made of 0s and 1s, and makes the codes short for the symbols that appear most.`,
    views: [{ kind: 'rows', title: 'The text', rows: [{ label: 'Text', cells: textCells(0, -1) }] }],
    vars: { symbols: n, 'input bits': inputBits },
  }));

  const commonest = symbols.slice().sort((a, b) => freq.get(b) - freq.get(a))[0];
  t.frame(() => ({
    line: 1,
    note: `Count how often each symbol occurs. There ${k === 1 ? 'is 1 kind of symbol' : `are ${k} different symbols`}. The most common is **${say(commonest)}**, which appears ${freq.get(commonest)} ${freq.get(commonest) === 1 ? 'time' : 'times'}.`,
    views: [{ kind: 'rows', title: 'Counting', rows: [
      { label: 'Text', cells: textCells(n, -1) },
      { label: 'Counts', cells: symbols.map((s) => ({ t: show(s), sub: freq.get(s), role: 'frontier' })) },
    ] }],
    vars: { 'different symbols': k },
  }));

  const built = buildTree(symbols, freq, t, {
    start(liveNodes, liveQueue) {
      nodes = liveNodes; Q = liveQueue;
      t.frame(() => ({
        line: 2,
        note: k === 1
          ? `Each symbol becomes a leaf labelled with its count. Here there is only one leaf, so there is nothing to join.`
          : `Each symbol becomes a leaf labelled with its count. All ${k} leaves go into a **priority queue**: a waiting list that always hands back the smallest count first. When two counts are equal, the one that entered the queue earlier comes out first.`,
        views: [treeView({ title: 'Forest of subtrees', building: true }), { kind: 'rows', title: 'Priority queue, smallest first', rows: [queueRow()] }],
        vars: { 'queue size': Q.size },
      }));
    },
    take(a, b) {
      t.frame(() => ({
        line: [3, 4, 5],
        note: `Take the two smallest out of the queue: ${describe(a)} and ${describe(b)}. They are the rarest things left, so they should sit deepest in the tree and get the longest codes.`,
        views: [treeView({ title: 'Forest of subtrees', building: true, current: new Set([a.id, b.id]) }), { kind: 'rows', title: 'Priority queue, smallest first', rows: [
          { label: 'Taken out', cells: [a, b].map((nd) => ({ t: shortName(nd), sub: nd.weight, role: 'current' })) }, queueRow()] }],
        vars: { a: a.weight, b: b.weight, 'queue size': Q.size },
      }));
    },
    merge(parent, a, b) {
      t.frame(() => ({
        line: 6,
        note: `Join them under a new node with count ${a.weight} + ${b.weight} = **${parent.weight}**, and put that node into the queue. Every symbol beneath it is now one step further from the top, so its code will be one bit longer.`,
        views: [treeView({ title: 'Forest of subtrees', building: true, current: new Set([parent.id]) }), { kind: 'rows', title: 'Priority queue, smallest first', rows: [
          { label: 'Queue', cells: Q.items().map((nd) => ({ t: shortName(nd), sub: nd.weight, role: nd === parent ? 'current' : 'frontier' })) }] }],
        vars: { 'new count': parent.weight, 'queue size': Q.size },
      }));
    },
  });
  const root = built.root;
  nodes = built.nodes;

  t.frame(() => ({
    line: 7,
    note: k === 1
      ? 'The single leaf is the whole tree.'
      : `One node is left. It is the **root** of the finished tree, and its count, ${root.weight}, is the length of the text. Next, every branch gets a label: 0 for a left branch and 1 for a right branch.`,
    views: [treeView({ title: 'Code tree', bits: true }), { kind: 'rows', title: 'Code table', rows: [tableRow(null)] }],
    vars: { root: root.weight },
  }));

  // Read the codes off the tree: left branch 0, right branch 1.
  const pathTo = (nd) => { const ids = new Set(); for (let x = nd; x.parent; x = x.parent) ids.add(x.id); return ids; };
  const assign = (nd, code) => {
    if (!nd.left) {
      const final = code || '0';
      codes.set(nd.symbol, final);
      const f = freq.get(nd.symbol);
      t.frame(() => ({
        line: [10, 11, 12],
        note: code
          ? `Walk from the root down to **${say(nd.symbol)}** and write down the branch labels: its code is **${final}**, ${final.length} ${final.length === 1 ? 'bit' : 'bits'} long. It appears ${f} ${f === 1 ? 'time' : 'times'}, so it will cost ${f} × ${final.length} = ${f * final.length} bits.`
          : `A tree with a single leaf has no branches, so the walk gives an empty code, and an empty code cannot be written down. Give **${say(nd.symbol)}** the 1-bit code **0** instead. It appears ${f} ${f === 1 ? 'time' : 'times'}, so it will cost ${f} bits.`,
        views: [treeView({ title: 'Code tree', bits: true, current: new Set([nd.id]), path: pathTo(nd) }), { kind: 'rows', title: 'Code table', rows: [tableRow(nd.symbol)] }],
        vars: { symbol: say(nd.symbol), code: final },
      }));
      return;
    }
    assign(nd.left, `${code}0`);
    assign(nd.right, `${code}1`);
  };
  assign(root, '');

  // Encode.
  const pieces = [];
  let outputBits = 0;
  const leafOf = new Map(nodes.filter((nd) => !nd.left).map((nd) => [nd.symbol, nd]));
  [...text].forEach((ch, i) => {
    const code = codes.get(ch);
    pieces.push(code);
    outputBits += code.length;
    t.count('output bits', code.length);
    const soFar = outputBits;
    t.frame(() => ({
      line: 15,
      note: `Encoding symbol ${i + 1} of ${n}: write **${code}** for ${say(ch)}. That makes ${soFar} ${soFar === 1 ? 'bit' : 'bits'} so far, where the plain form would have used ${8 * (i + 1)}.`,
      views: [treeView({ title: 'Code tree', bits: true, current: new Set([leafOf.get(ch).id]), path: pathTo(leafOf.get(ch)) }), { kind: 'rows', title: 'Encoding', rows: [
        tableRow(ch),
        { label: 'Text', cells: textCells(i, i) },
        { label: 'Encoded', cells: pieces.map((c, j) => ({ t: c, role: j === i ? 'current' : 'done' })) },
      ] }],
      vars: { 'plain bits so far': 8 * (i + 1) },
    }));
  });
  const encoded = pieces.join('');

  // Decode by walking the tree, to show that the bits can be split back into symbols without separators.
  let decoded = '';
  let node = root;
  let walked = [];
  let start = 0;
  for (let pos = 0; pos < encoded.length; pos++) {
    if (node.left) node = encoded[pos] === '0' ? node.left : node.right;
    walked.push(node.id);
    if (!node.left) {
      decoded += node.symbol;
      const leaf = node, ids = new Set(walked), bitsRead = encoded.slice(start, pos + 1), count = decoded.length;
      t.frame(() => ({
        line: [19, 20, 21],
        note: `Decoding: start at the root and follow the next bits, **${bitsRead}**. They lead to a leaf, so write **${say(leaf.symbol)}** and return to the root.${count === 1 ? ' No marker is needed between codes, because no code is the beginning of another.' : ''}`,
        views: [treeView({ title: 'Code tree', bits: true, current: new Set([leaf.id]), path: ids }), { kind: 'rows', title: 'Decoding', rows: [
          { label: 'Bits', cells: pieces.map((c, j) => ({ t: c, role: j === count - 1 ? 'current' : j < count ? 'done' : 'default' })) },
          { label: 'Decoded', cells: [...decoded].map((ch, j) => ({ t: show(ch), role: j === count - 1 ? 'current' : 'done' })) },
        ] }],
        vars: { 'bits read': pos + 1, 'symbols decoded': count },
      }));
      node = root; walked = []; start = pos + 1;
    }
  }
  if (decoded !== text) throw new Error('Internal error: the decoded text does not match the input.');

  const entropy = entropyBits(freq, n);
  const average = outputBits / n;
  t.frame(() => ({
    line: null,
    note: `Done. The ${n} symbols take **${outputBits} bits** instead of ${inputBits}, an average of ${f3(average)} bits per symbol, and decoding gave back the text exactly. The entropy of this text is ${f3(entropy)} bits per symbol: no code that handles one symbol at a time can average less.${k === 1 ? ' With a single kind of symbol the entropy is 0, but each symbol still needs a whole bit.' : ''} The code table, which a decoder also needs, is not counted in these numbers.`,
    views: [treeView({ title: 'Code tree', bits: true }), { kind: 'rows', title: 'Result', rows: [
      tableRow(null),
      { label: 'Size', cells: [{ t: inputBits, sub: 'bits in' }, { t: outputBits, sub: 'bits out', role: 'done' }] },
    ] }],
    vars: { 'input bits': inputBits, 'average bits per symbol': f3(average), 'entropy per symbol': f3(entropy) },
  }));

  return {
    text, inputBits, outputBits, encoded, decoded, entropy, averageLength: average, distinct: k,
    codes: Object.fromEntries(codes), counts: Object.fromEntries(freq),
  };
}

/* ---- independent references for the tests ---- */

// Optimal total cost by the textbook definition, without a heap: sort, join the two smallest, repeat.
function referenceCost(text) {
  const counts = {};
  for (const ch of text) counts[ch] = (counts[ch] || 0) + 1;
  const w = Object.values(counts);
  if (w.length === 1) return text.length;
  let cost = 0;
  while (w.length > 1) {
    w.sort((a, b) => a - b);
    const s = w.shift() + w.shift();
    cost += s;
    w.push(s);
  }
  return cost;
}
// Decode with a lookup table instead of the tree.
function tableDecode(bits, codes) {
  const inverse = new Map(Object.entries(codes).map(([s, c]) => [c, s]));
  let cur = '', out = '';
  for (const b of bits) { cur += b; if (inverse.has(cur)) { out += inverse.get(cur); cur = ''; } }
  return cur === '' ? out : null;
}
function sound(r) {
  const list = Object.values(r.codes);
  if (list.some((a, i) => list.some((b, j) => i !== j && b.startsWith(a)))) return 'the code is not prefix-free';
  if (r.decoded !== r.text) return 'tree decoding did not return the input';
  if (tableDecode(r.encoded, r.codes) !== r.text) return 'table decoding did not return the input';
  if (r.inputBits !== 8 * r.text.length) return 'inputBits is not 8 × length';
  if (r.outputBits !== r.encoded.length) return 'outputBits is not the number of encoded bits';
  if (r.outputBits !== referenceCost(r.text)) return `total ${r.outputBits} bits, but the optimal cost is ${referenceCost(r.text)}`;
  if (r.distinct >= 2) {
    const kraft = list.reduce((s, c) => s + 2 ** -c.length, 0);
    if (Math.abs(kraft - 1) > 1e-12) return `Kraft sum is ${kraft}, expected 1 for a full tree`;
    let h = 0;
    for (const c of Object.values(r.counts)) h -= (c / r.text.length) * Math.log2(c / r.text.length);
    if (Math.abs(h - r.entropy) > 1e-9) return 'reported entropy is wrong';
    const avg = r.outputBits / r.text.length;
    if (!(h <= avg + 1e-9 && avg < h + 1)) return `average length ${avg} is outside [H, H + 1) for H = ${h}`;
  }
  return true;
}

// Experiment input: 200 symbols from A, B, C, D, where A takes the given percentage and the rest is shared evenly.
function skewCounts(share) {
  const a = Math.round((200 * share) / 100);
  const rest = 200 - a;
  const b = Math.ceil(rest / 3);
  const c = Math.ceil((rest - b) / 2);
  return [a, b, c, rest - b - c];
}
const skewText = (share) => skewCounts(share).map((c, i) => 'ABCD'[i].repeat(c)).join('');
const skewEntropy = (share) => skewCounts(share).filter((c) => c > 0).reduce((h, c) => h - (c / 200) * Math.log2(c / 200), 0);

export default {
  meta: {
    id: 'huffman-coding',
    name: 'Huffman Coding',
    aliases: ['Huffman code', 'Huffman tree', 'minimum-redundancy code', 'Huffman encoding'],
    kind: 'algorithm',
    discipline: 'information-theory',
    alsoIn: [
      { id: 'algorithms', why: 'It is a standard example of a greedy algorithm, with a priority queue choosing what to join next.' },
    ],
    subfield: 'Entropy coding',
    family: 'Prefix codes',
    lab: 'compression',
    compareGroup: 'lossless-compression',
    year: 1952,
    authors: 'David A. Huffman',
    summary: 'Builds the best symbol-by-symbol code for a text by repeatedly joining the two rarest symbols into a tree, so common symbols get short codes.',
    difficulty: 'intermediate',
    order: 810,
    paradigms: ['greedy'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n + k log k)', average: 'O(n + k log k)', worst: 'O(n + k log k)', class: 'linearithmic' },
    space: { worst: 'O(k) for the tree and queue', class: 'linear' },
    tags: {
      problems: ['compress files', 'make data smaller', 'shortest code for a message', 'variable-length codes', 'encode text in fewer bits', 'give frequent letters shorter codes'],
      techniques: ['greedy choice', 'priority queue', 'binary tree', 'prefix code', 'entropy coding'],
      applications: ['data compression', 'image processing', 'networking', 'signal processing'],
    },
    prerequisites: ['concept:tree', 'concept:priority-queue', 'concept:greedy', 'concept:prefix-code'],
  },

  bigIdea: {
    simple: 'Huffman coding is a way to write a message using as few 0s and 1s as possible. A computer stores every letter as a pattern of 0s and 1s, and normally every letter gets a pattern of the same length. That is wasteful, because some letters turn up far more often than others. In English, e is everywhere and z is rare. Huffman coding gives short patterns to the common letters and longer patterns to the rare ones. Morse code does something similar: the letter e is a single dot. There is one more requirement. The patterns must be chosen so that the message can be read back without any gaps between letters. For that, no pattern may be the beginning of another pattern. Huffman coding finds such a set by tying the two rarest letters together, treating the pair as one, and repeating until everything is joined into a single tree. For that message, no other set of patterns of this kind is shorter.',
    what: 'Huffman coding turns the symbol counts of a text into a binary tree, and the tree into a code. Each symbol sits at a leaf. Its code is the list of left and right turns on the way down from the root, written as 0s and 1s. Frequent symbols end up near the root with short codes, and rare symbols end up deep with long ones.',
    why: 'Fixed-length codes spend the same number of bits on every symbol however common it is. In 1951 David Huffman, then a student in Robert Fano\'s information theory course at MIT, was offered a term paper in place of the final exam: find the most efficient binary code. The methods known at the time built the tree from the top down and were not always optimal. Huffman built it from the bottom up and proved that this cannot be beaten by any code that assigns a whole number of bits to each symbol.',
    when: 'Use it when symbols have clearly unequal frequencies and you want a fast, simple, exactly reversible code. It works best as the last stage after another method has done the modelling, as in DEFLATE, where [LZ77](#/algorithm/lz77) first removes repeated phrases. If one symbol is overwhelmingly common, arithmetic coding does better, because Huffman coding can never spend less than one bit on a symbol.',
    interesting: 'The algorithm is greedy: it makes the locally obvious choice, joining the two rarest items, and never reconsiders. Greedy methods usually give only approximate answers. Here the result is provably optimal, and the proof is short enough to follow in a few minutes.',
    where: 'Huffman codes are the final stage of DEFLATE, the method inside gzip, zip and PNG files. Baseline JPEG uses them for its image coefficients, MP3 uses them for its quantized audio values, and HTTP/2 uses a fixed Huffman code to shorten header text.',
    analogy: {
      title: 'Morse code, with the gaps removed',
      text: 'Morse code gives the commonest English letters the shortest signals: E is one dot and T is one dash, while Q is dash dash dot dash. A telegraph operator therefore sends fewer signals for ordinary text than a code with equal-length letters would need. Huffman coding follows the same principle, short for common and long for rare, and works out the best lengths from actual counts.',
      limits: 'Morse code cannot be read as an unbroken stream. One dot is E, and it is also the start of A (dot dash), so the operator must leave a silence between letters. That silence is a third signal. A Huffman code needs no silences, because no code is the beginning of another. Morse code was also fixed once for all English text, while a Huffman code is computed for one particular set of counts and is only the best code for those counts.',
    },
  },

  example: {
    setup: 'Encode the nine letters ABACABADA. A bit is a single 0 or 1. Start by counting: A appears 5 times, B appears 2 times, C once and D once. A plain code for four letters gives each one 2 bits, which makes 18 bits in total.',
    steps: [
      'Find the two smallest counts: C (1) and D (1). Join them under a new node whose count is 1 + 1 = 2.',
      'Now there are three things waiting: A (5), B (2) and the C-D node (2). The two smallest are B and the C-D node. Join them under a new node with count 2 + 2 = 4.',
      'Two things are left: A (5) and the node with count 4. Join them under the top node, with count 9. The tree is finished.',
      'Label every left branch 0 and every right branch 1, and read each letter\'s code on the way down from the top. A is 1. B is 00. C is 010. D is 011.',
      'Replace each letter of ABACABADA with its code: 1, 00, 1, 010, 1, 00, 1, 011, 1.',
    ],
    result: 'The encoded message is 100101010010111, which is 15 bits instead of 18. A appears five times and costs only 1 bit each time. C and D cost 3 bits each, but they appear once. The bits can be split back into letters in only one way, because no code is the beginning of another.',
    tryInput: { text: 'ABACABADA' },
  },

  terms: [
    { term: 'Bit', meaning: 'A single 0 or 1, the smallest unit of storage.' },
    { term: 'Symbol', meaning: 'One item of the data, such as a letter of a text.' },
    { term: 'Code', meaning: 'The pattern of bits that stands for one symbol.' },
    { term: 'Frequency', meaning: 'How many times a symbol appears in the text. Also called its count or weight.' },
    { term: 'Prefix code', meaning: 'A set of codes in which no code is the beginning of another, so a stream of bits can be split into symbols in only one way.' },
    { term: 'Tree', meaning: 'A branching structure with one node at the top, the root, and nodes with nothing below them, the leaves. Here every leaf holds one symbol.' },
    { term: 'Priority queue', meaning: 'A waiting list that always hands back the item with the smallest value first.' },
    { term: 'Greedy algorithm', meaning: 'A method that always takes the choice that looks best right now and never goes back on it.' },
    { term: 'Entropy', meaning: 'A number, measured in bits per symbol, that says how unpredictable the symbols are. No lossless code can average fewer bits than this.' },
  ],

  takeaway: 'Give common symbols short codes and rare symbols long ones, by joining the two rarest again and again until one tree is left.',

  viz: {
    describe: 'A tree drawn as a graph. Each leaf is labelled with a symbol and its count, such as e:4, and sits in a row at the bottom. Nodes waiting in the priority queue are ochre, the nodes being joined are terracotta, and nodes already joined into a subtree are forest green. As pairs are joined, new nodes labelled with the combined count appear above them until a single root remains. Branches are then labelled 0 and 1 and each leaf shows its code beneath it. Under the tree, strips of cells show the priority queue during building, then the code table, the encoded bits and the decoded text.',
    inputs: [
      { id: 'text', type: 'text', label: 'Text to compress', default: 'she sells sea shells', maxLength: 60,
        help: 'Up to 60 characters. Each one counts as 8 bits in the input. Spaces are shown as ␣.' },
    ],
    presets: [
      { label: 'A short phrase', values: { text: 'she sells sea shells' } },
      { label: 'The worked example', values: { text: 'ABACABADA' } },
      { label: 'Equal counts: no symbol is favoured', values: { text: 'ABCDEFGH' } },
      { label: 'One symbol dominates', values: { text: 'AAAAAAAAAAAAAAAAAAAAAAAABBCD' } },
      { label: 'Only one kind of symbol', values: { text: 'aaaaaaaa' } },
      { label: 'Many different symbols', values: { text: 'the quick brown fox jumps over the lazy dog' } },
    ],
    tryThis: [
      'Load "Equal counts: no symbol is favoured". Every code comes out 3 bits long, exactly what a fixed-length code for 8 symbols would use. Huffman coding gains nothing when all symbols are equally common. Now change one letter so that another appears twice and see which codes change length.',
      'Load "One symbol dominates" and read the last step. A costs 1 bit, the least any symbol can cost, yet the entropy is well under 1 bit per symbol. That gap is the price of using a whole number of bits for each symbol.',
      'Type a sentence of your own and, before running it, guess which symbol will get the shortest code. In English sentences it is often the space.',
    ],
    run,
    report: (r, c) => `${r.distinct} different ${r.distinct === 1 ? 'symbol' : 'symbols'} in ${r.text.length}.\nInput:  ${r.text.length} × 8 bits = ${r.inputBits} bits\nOutput: ${r.outputBits} bits (sum of the code lengths; the code table is not counted)\nAverage ${f3(r.averageLength)} bits per symbol. Entropy of this text: ${f3(r.entropy)} bits per symbol.\nCodes: ${Object.entries(r.codes).sort((a, b) => a[1].length - b[1].length || (a[0] < b[0] ? -1 : 1)).map(([s, code]) => `${show(s)}=${code}`).join('  ')}\nEncoded: ${r.encoded}\n${c['heap comparisons'] || 0} priority-queue comparisons, ${c.merges || 0} joins.`,
    experiment: {
      title: 'Output size as one symbol becomes more common',
      note: 'Each point is a real run on 200 symbols drawn from A, B, C and D. A takes the stated share and the other three split the rest evenly. The lower curve is the entropy of that text times 200, the limit for any lossless code that treats symbols independently. Huffman coding follows it closely at first, then flattens out, because it cannot spend less than one bit on a symbol.',
      metric: 'output bits',
      metricLabel: 'Output bits for 200 symbols',
      sizeLabel: 'Share of the text taken by the most common symbol (%)',
      sizes: [25, 40, 55, 70, 80, 90, 95],
      variants: [{ id: 'skew', label: 'Huffman code' }],
      input: (share) => ({ text: skewText(share) }),
      theory: [
        { label: 'entropy × 200 (lower limit)', fn: (share) => 200 * skewEntropy(share) },
        { label: 'fixed 2 bits per symbol', fn: () => 400 },
      ],
    },
  },

  logic: {
    intuition: 'In a code tree, the depth of a leaf is the length of its code. To make the total short, rare symbols should be deep and common symbols shallow. The two rarest symbols can safely be made the deepest pair of all, hanging from the same parent. Once that is decided, the pair behaves like a single symbol whose count is the sum of the two, and the same question can be asked again about a problem that is one symbol smaller.',
    steps: [
      'Count how many times each symbol occurs in the text.',
      'Make a leaf for every symbol, labelled with its count, and put all the leaves into a priority queue ordered by count.',
      'Remove the two nodes with the smallest counts. Make a new node whose children are those two and whose count is their sum. Put the new node into the queue.',
      'Repeat step 3 until one node is left. That node is the root of the code tree.',
      'Walk the tree from the root. Going left adds a 0 to the code and going right adds a 1. When you reach a leaf, the bits collected on the way are the code for its symbol.',
      'To encode, replace every symbol of the text with its code. To decode, start at the root, follow one branch per bit, write the symbol when you reach a leaf, and start again from the root.',
    ],
    pseudocode: [
      'huffman(text):',
      '  count how often each symbol occurs',
      '  Q ← priority queue of one leaf per symbol',
      '  while Q holds more than one node:',
      '    a ← remove the smallest from Q',
      '    b ← remove the smallest from Q',
      '    insert node(a, b) with count a.count + b.count',
      '  root ← the node left in Q',
      '  assign(root, "")',
      '',
      'assign(node, code):',
      '  if node is a leaf: its symbol gets this code',
      '  else: assign(node.left, code + "0")',
      '        assign(node.right, code + "1")',
      '',
      'encode(text): write the code of each symbol in turn',
      '',
      'decode(bits):',
      '  node ← root',
      '  for each bit:',
      '    node ← node.left if bit = 0, else node.right',
      '    if node is a leaf: output its symbol; node ← root',
    ],
    decisions: [
      { title: 'Which two nodes to join?', text: 'Always the two with the smallest counts. This single greedy rule is the whole algorithm, and the priority queue exists to apply it quickly.' },
      { title: 'How are ties broken?', text: 'Any rule gives an optimal code, though different rules give different trees and sometimes different code lengths for individual symbols. This lesson takes the node that entered the queue first, with leaves entering in character order, so every run and every code sample produces the same tree.' },
      { title: 'Which child is 0?', text: 'It does not matter for the size. Here the first node removed becomes the left child and gets 0. Swapping 0 and 1 at any node gives another code with exactly the same lengths.' },
      { title: 'How does the decoder learn the code?', text: 'It must be told. Either the counts or the code lengths are sent ahead of the data, or both sides agree on a fixed table in advance. Sizes on this page leave that cost out, and for a short text it can be larger than the saving.' },
    ],
    invariants: [
      'The counts of the nodes in the queue always add up to the length of the text.',
      'Each node in the queue is the root of a subtree that is an optimal code tree for the symbols beneath it.',
      'Counts of newly created nodes never decrease from one join to the next.',
    ],
    edgeCases: [
      'Only one distinct symbol: the tree is a single leaf and its natural code is empty. An empty code cannot be transmitted, so the symbol is given the 1-bit code 0. This is the one case where the average length (1 bit) is not below entropy plus one (0 + 1).',
      'Two distinct symbols: each gets one bit whatever their counts are.',
      'All counts equal and the number of symbols a power of two: the tree is perfectly balanced and the code is an ordinary fixed-length code.',
      'Counts that grow like the Fibonacci numbers give the most lopsided tree, with a longest code of k − 1 bits for k symbols.',
      'Empty text: there is nothing to encode. The player on this page asks for at least one character.',
    ],
    correctness: 'The code is prefix-free because symbols sit only at leaves: the path to one leaf cannot pass through another leaf, so no code is the start of another. Optimality rests on two facts. First, some optimal tree has the two rarest symbols as siblings at the greatest depth, since swapping them into the deepest positions cannot increase the total cost. Second, replacing those siblings by one combined symbol changes the total cost by exactly the sum of their counts, whatever the rest of the tree looks like. So an optimal tree for the smaller problem, with the pair hung beneath the combined symbol, is optimal for the larger one. Induction on the number of symbols finishes the argument. The full proof is in the deeper section.',
    mistakes: [
      'Giving the new node the larger of the two counts instead of their sum.',
      'Using a queue that hands back the largest count first, which builds the worst tree instead of the best.',
      'Forgetting the single-symbol case and producing an empty code.',
      'Comparing tree nodes directly when two counts are equal, which in many languages is an error or gives an order that changes from run to run. Add an explicit tie-breaker.',
      'Reporting the compressed size without the code table, and then being surprised that small files do not shrink.',
    ],
  },

  code: {
    sample: {
      input: 'The text "she sells sea shells". Print each symbol with its count and code, the total size, and the text decoded from the bits.',
      expected: "' ' x3 -> 110\n'a' x1 -> 1110\n'e' x4 -> 00\n'h' x2 -> 1111\n'l' x4 -> 01\n's' x6 -> 10\n49 bits instead of 160\nshe sells sea shells",
    },
    python: {
      source: `import heapq
from collections import Counter


class Node:
    def __init__(self, count, symbol=None, left=None, right=None):
        self.count, self.symbol, self.left, self.right = count, symbol, left, right


def build_tree(text):
    counts = Counter(text)
    # Queue entries are (count, age, node). The age breaks ties, so nodes are never compared.
    queue = [(counts[s], age, Node(counts[s], s)) for age, s in enumerate(sorted(counts))]
    heapq.heapify(queue)
    age = len(queue)
    while len(queue) > 1:
        count_a, _, a = heapq.heappop(queue)
        count_b, _, b = heapq.heappop(queue)
        heapq.heappush(queue, (count_a + count_b, age, Node(count_a + count_b, None, a, b)))
        age += 1
    return queue[0][2]


def assign(node, code, table):
    if node.left is None:
        table[node.symbol] = code or "0"  # a lone symbol still needs one bit
    else:
        assign(node.left, code + "0", table)
        assign(node.right, code + "1", table)


def decode(bits, root):
    out, node = [], root
    for bit in bits:
        if node.left is not None:
            node = node.left if bit == "0" else node.right
        if node.left is None:
            out.append(node.symbol)
            node = root
    return "".join(out)


text = "she sells sea shells"
root = build_tree(text)
table = {}
assign(root, "", table)
bits = "".join(table[s] for s in text)
for s in sorted(table):
    print(f"'{s}' x{text.count(s)} -> {table[s]}")
print(f"{len(bits)} bits instead of {8 * len(text)}")
print(decode(bits, root))`,
      notes: [
        { line: 13, text: 'One leaf per symbol. Each queue entry carries an age so that equal counts are ordered by who entered first, and Python never has to compare two Node objects.' },
        { line: 17, text: 'The greedy step: the two smallest counts come out of the heap.' },
        { line: 19, text: 'They go back in as one node whose count is the sum. The loop ends when a single node, the root, is left.' },
        { line: 26, text: 'A leaf\'s code is the path that led to it. The `or "0"` handles a text with only one kind of symbol.' },
        { line: 36, text: 'Decoding needs no separators. Follow one branch per bit, and a leaf marks the end of a code.' },
      ],
    },
    javascript: {
      source: `class MinHeap {
  constructor() { this.h = []; }
  get size() { return this.h.length; }
  less(i, j) {
    const a = this.h[i], b = this.h[j];
    return a.count < b.count || (a.count === b.count && a.age < b.age);
  }
  push(item) {
    const h = this.h;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  }
  pop() {
    const h = this.h;
    const top = h[0];
    const last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        let m = i;
        const l = 2 * i + 1, r = l + 1;
        if (l < h.length && this.less(l, m)) m = l;
        if (r < h.length && this.less(r, m)) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }
}

function buildTree(text) {
  const counts = new Map();
  for (const s of text) counts.set(s, (counts.get(s) || 0) + 1);
  const queue = new MinHeap();
  let age = 0;
  for (const s of [...counts.keys()].sort()) {
    queue.push({ count: counts.get(s), age: age++, symbol: s, left: null, right: null });
  }
  while (queue.size > 1) {
    const a = queue.pop();
    const b = queue.pop();
    queue.push({ count: a.count + b.count, age: age++, symbol: null, left: a, right: b });
  }
  return { root: queue.pop(), counts };
}

function assign(node, code, table) {
  if (node.left === null) {
    table.set(node.symbol, code || "0"); // a lone symbol still needs one bit
  } else {
    assign(node.left, code + "0", table);
    assign(node.right, code + "1", table);
  }
}

function decode(bits, root) {
  let out = "";
  let node = root;
  for (const bit of bits) {
    if (node.left !== null) node = bit === "0" ? node.left : node.right;
    if (node.left === null) {
      out += node.symbol;
      node = root;
    }
  }
  return out;
}

const text = "she sells sea shells";
const { root, counts } = buildTree(text);
const table = new Map();
assign(root, "", table);
const bits = [...text].map((s) => table.get(s)).join("");
for (const s of [...table.keys()].sort()) {
  console.log("'" + s + "' x" + counts.get(s) + " -> " + table.get(s));
}
console.log(bits.length + " bits instead of " + 8 * text.length);
console.log(decode(bits, root));`,
    },
    cpp: {
      source: `#include <functional>
#include <iostream>
#include <map>
#include <queue>
#include <string>
#include <tuple>
#include <vector>

struct Node {
    int count;
    char symbol;
    int left, right;  // indices into the node list, or -1 for a leaf
};

std::vector<Node> nodes;

int buildTree(const std::map<char, int>& counts) {
    using Entry = std::tuple<int, int, int>;  // (count, age, node index)
    std::priority_queue<Entry, std::vector<Entry>, std::greater<Entry>> queue;
    int age = 0;
    for (const auto& [symbol, count] : counts) {
        nodes.push_back({count, symbol, -1, -1});
        queue.push({count, age++, static_cast<int>(nodes.size()) - 1});
    }
    while (queue.size() > 1) {
        auto [countA, ageA, a] = queue.top(); queue.pop();
        auto [countB, ageB, b] = queue.top(); queue.pop();
        nodes.push_back({countA + countB, 0, a, b});
        queue.push({countA + countB, age++, static_cast<int>(nodes.size()) - 1});
    }
    return std::get<2>(queue.top());
}

void assign(int node, const std::string& code, std::map<char, std::string>& table) {
    if (nodes[node].left == -1) {
        table[nodes[node].symbol] = code.empty() ? "0" : code;  // a lone symbol still needs one bit
    } else {
        assign(nodes[node].left, code + "0", table);
        assign(nodes[node].right, code + "1", table);
    }
}

std::string decode(const std::string& bits, int root) {
    std::string out;
    int node = root;
    for (char bit : bits) {
        if (nodes[node].left != -1) node = bit == '0' ? nodes[node].left : nodes[node].right;
        if (nodes[node].left == -1) {
            out += nodes[node].symbol;
            node = root;
        }
    }
    return out;
}

int main() {
    const std::string text = "she sells sea shells";
    std::map<char, int> counts;  // std::map keeps symbols in character order
    for (char s : text) ++counts[s];
    int root = buildTree(counts);
    std::map<char, std::string> table;
    assign(root, "", table);
    std::string bits;
    for (char s : text) bits += table[s];
    for (const auto& [symbol, code] : table) {
        std::cout << "'" << symbol << "' x" << counts[symbol] << " -> " << code << "\\n";
    }
    std::cout << bits.size() << " bits instead of " << 8 * text.size() << "\\n";
    std::cout << decode(bits, root) << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Let n be the length of the text and k the number of distinct symbols. Counting takes one pass over the text. Building the tree performs k − 1 joins, and each join does three priority-queue operations that cost O(log k). Encoding and decoding each handle the text once more. For ordinary data k is small and fixed (at most 256 for bytes), so the whole method is linear in n in practice.',
    cases: [
      { case: 'Counting symbols', time: 'O(n)', when: 'One pass over the text.' },
      { case: 'Building the tree', time: 'O(k log k)', when: 'k − 1 joins with a binary heap. If the counts are already sorted, two plain queues do it in O(k).' },
      { case: 'Encoding or decoding', time: 'O(n) table lookups, O(B) bit operations', when: 'B is the number of output bits, between n and n(k − 1).' },
      { case: 'Output size', time: 'between H·n and (H + 1)·n bits', when: 'H is the entropy of the symbol counts in bits per symbol, and there are at least two distinct symbols.' },
    ],
    space: 'O(k): a tree with k leaves and k − 1 internal nodes, a queue of at most k entries and a table of k codes. The encoded output is separate.',
    memory: 'Production decoders do not walk a tree bit by bit. They look up several bits at once in a table, which is much faster and friendlier to the processor cache. The tree in this lesson is the clearest form, not the fastest.',
    tradeoffs: 'Huffman coding is fast and simple but can only spend a whole number of bits per symbol, and it needs the counts before it starts, which means two passes or a table agreed in advance. Arithmetic coding and asymmetric numeral systems get closer to the entropy at the cost of more computation per symbol.',
    assumptions: [
      'Each input symbol occupies 8 bits. The output size is the sum of the code lengths over the text.',
      'The code table is not counted in the output size. A real file must also carry the table, or the two sides must share one in advance.',
      'Comparing two counts takes constant time, and the priority queue is a binary heap.',
      'The entropy bound treats symbols as independent draws with the observed frequencies. Methods that exploit context, such as a preceding LZ77 stage, can go below it.',
    ],
  },

  tradeoffs: {
    excels: [
      'Data whose symbols have clearly unequal frequencies.',
      'As the final entropy-coding stage after a modelling stage such as LZ77 or a transform.',
      'Settings that need very fast decoding with simple, table-driven code.',
    ],
    struggles: [
      'Sources where one symbol has probability close to 1: each symbol still costs at least one bit.',
      'Symbols that are all about equally common, where it reduces to a fixed-length code.',
      'Short messages, where the code table costs more than the bits saved.',
      'Data whose statistics change along the way, unless the code is rebuilt for each block.',
    ],
    pitfalls: [
      'Ignoring the cost of sending the code table.',
      'Non-deterministic tie-breaking, which makes encoder and decoder build different trees from the same counts.',
      'Very long codes for very rare symbols, which break decoders that assume a maximum code length.',
    ],
    misunderstandings: [
      '"Huffman coding is the best possible compression." It is the best code that gives each symbol its own whole number of bits. Methods that code several symbols together, or use fractions of a bit, can do better.',
      '"The code for a text is unique." Ties and the choice of which branch is 0 give many different Huffman codes for the same counts. All of them have the same total length.',
      '"A shorter code means a symbol is more important." It only means the symbol is more frequent in this text.',
      '"It always shrinks the data." With the code table included, a short or evenly spread text can come out larger than it went in.',
    ],
    constraints: [
      'File formats limit the longest code (15 bits in DEFLATE), so encoders use a length-limited variant of the algorithm.',
      'Formats send only the code lengths and rebuild the codes by a fixed rule, which keeps the table small.',
    ],
    alternatives: [
      { id: 'run-length-encoding', name: 'Run-Length Encoding', when: 'The redundancy is long runs of one symbol, not uneven frequencies.' },
      { id: 'lz77', name: 'LZ77', when: 'The redundancy is repeated phrases. The two are usually combined, with Huffman coding applied to the LZ77 output.' },
      { name: 'Arithmetic coding', when: 'You need to get closer to the entropy, especially when some symbols are very probable, and can afford more work per symbol.' },
      { name: 'Fixed-length code', when: 'All symbols are about equally common, or random access to individual symbols matters more than size.' },
    ],
    comparison: {
      columns: ['', 'Huffman coding', 'Fixed-length code', 'Arithmetic coding'],
      rows: [
        ['Bits per symbol', 'A whole number, at least 1', 'The same for every symbol', 'Can be a fraction'],
        ['Average length', 'Between H and H + 1', '⌈log₂ k⌉', 'Close to H for long messages'],
        ['Needs symbol statistics', 'Yes', 'No', 'Yes'],
        ['Decoding speed', 'Very fast with tables', 'Fastest', 'Slower'],
      ],
    },
  },

  applications: [
    { title: 'DEFLATE: gzip, zip and PNG', status: 'established', text: 'DEFLATE first finds repeated strings with LZ77-style matching and then Huffman-codes the resulting literals, match lengths and distances. Each block can carry its own code tables, sent as lists of code lengths.' },
    { title: 'JPEG image compression', status: 'established', text: 'Baseline JPEG transforms and quantizes blocks of pixels and then Huffman-codes the results, pairing each non-zero value with the run of zeros before it.' },
    { title: 'MP3 audio', status: 'established', text: 'MPEG-1 Layer III quantizes frequency values and codes them with a set of predefined Huffman tables.' },
    { title: 'HTTP/2 header compression', status: 'established', text: 'The HPACK format used by HTTP/2 shortens header text with one fixed Huffman code, built from header frequencies measured in advance, so no table has to be sent.' },
    { title: 'Merging sorted files in the cheapest order', status: 'illustrative', text: 'If merging two files costs the sum of their sizes, the cheapest order in which to merge many files is found by the same rule: always merge the two smallest. The total cost is the same sum that Huffman coding minimizes.' },
  ],

  connections: [
    { to: 'concept:priority-queue', type: 'prerequisite', why: 'Every step asks for the two smallest counts among those remaining, which is exactly the operation a priority queue provides.' },
    { to: 'concept:greedy', type: 'prerequisite', why: 'It commits to joining the two rarest nodes and never revisits the choice. An exchange argument shows that this local choice is always part of some optimal tree.' },
    { to: 'concept:prefix-code', type: 'prerequisite', why: 'Placing symbols only at the leaves of a binary tree is what guarantees that no code is the beginning of another.' },
    { to: 'concept:tree', type: 'prerequisite', why: 'The code is a binary tree: depth is code length, and the path from the root spells the code.' },
    { to: 'concept:entropy', type: 'advanced', why: 'Entropy is the lower limit on the average code length. Huffman coding comes within one bit per symbol of it.' },
    { to: 'lz77', type: 'related', why: 'They remove different kinds of redundancy, repeated phrases and uneven frequencies, and DEFLATE chains them: LZ77 output is Huffman-coded.' },
    { to: 'run-length-encoding', type: 'same-problem', why: 'Both are lossless compressors. Run-length encoding exploits equal neighbours, Huffman coding exploits unequal frequencies, and fax and JPEG apply one after the other.' },
    { to: 'kruskal', type: 'related', why: 'Both are greedy algorithms that repeatedly take the smallest remaining item and merge two pieces of a forest, and both are proved optimal by an exchange argument.' },
    { to: 'heap-sort', type: 'related', why: 'Both are driven by a binary heap that repeatedly gives up its smallest element.' },
    { to: 'discipline:distributed-systems', type: 'application', why: 'Network protocols such as HTTP/2 use Huffman codes to send fewer bytes between machines.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why must no code be the beginning of another code?',
      options: ['So that all codes have the same length', 'So that a stream of bits can be split into symbols in only one way, without separators', 'So that the tree stays balanced', 'So that common symbols get short codes'],
      answer: 1,
      explain: [
        'The codes deliberately have different lengths.',
        'Correct. If A were 1 and B were 10, the bits 10 could be B or A followed by something else. With a prefix code, the first leaf you reach is the only possible reading.',
        'Huffman trees are usually far from balanced, and that is intended.',
        'Short codes for common symbols come from the joining rule, not from the prefix property.',
      ],
    },
    {
      type: 'predict',
      q: 'The text ABCDEFGH has eight different symbols, each appearing once. How many bits will its Huffman encoding take (not counting the code table)?',
      options: ['8', '16', '24', '64'],
      answer: 2,
      explain: [
        '8 bits would be one bit per symbol, but one bit can only tell two symbols apart.',
        '16 bits would be two bits per symbol, enough for only four different symbols.',
        'Correct. With equal counts the tree is perfectly balanced, every code is 3 bits long, and 8 × 3 = 24. That is exactly a fixed-length code for eight symbols.',
        '64 bits is the size of the plain 8-bit input.',
      ],
      tryInput: { text: 'ABCDEFGH' },
    },
    {
      type: 'debug',
      q: 'This loop builds a tree, but the codes it produces are not optimal. Which line is wrong?',
      code: `while len(queue) > 1:
    count_a, _, a = heapq.heappop(queue)
    count_b, _, b = heapq.heappop(queue)
    parent = Node(max(count_a, count_b), None, a, b)
    heapq.heappush(queue, (parent.count, age, parent))
    age += 1`,
      options: ['Line 1: the loop should run while the queue is not empty', 'Line 3: only one node should be removed per round', 'Line 4: the new node must have the sum of the two counts, not the larger one', 'Line 6: age should not change'],
      answer: 2,
      explain: [
        'Stopping with one node left is right. That node is the root.',
        'Two nodes are joined per round, so two must be removed.',
        'Correct. A joined node stands for all the symbols beneath it, so its count is the sum. With `max` it looks rarer than it is and gets pushed too deep.',
        'The age must keep increasing so that ties break the same way every time.',
      ],
    },
    {
      type: 'choice',
      q: 'A text is 99 percent the letter A, and the rest is the letter B. Its entropy is about 0.08 bits per symbol. How many bits per symbol will a Huffman code use?',
      options: ['About 0.08', 'About 0.5', 'Exactly 1', '8'],
      answer: 2,
      explain: [
        'That would need a fraction of a bit per symbol, which a Huffman code cannot do.',
        'There is no half-bit code. Every symbol costs at least one whole bit.',
        'Correct. With two symbols each one gets a 1-bit code, so the text costs 1 bit per symbol, more than ten times its entropy. Arithmetic coding, or coding runs of A as single symbols, closes this gap.',
        '8 bits per symbol is the plain input. A code for two symbols never needs more than 1 bit each.',
      ],
    },
    {
      type: 'challenge',
      title: 'Canonical codes: send only the lengths',
      prompt: 'A decoder does not need the tree, only the code length of every symbol. Write a function that takes the code lengths produced by Huffman\'s algorithm and assigns codes by this rule: sort symbols by length and then by character, give the first symbol a code of all zeros, and for each next symbol add 1 to the previous code and append zeros if the length grew. Show that the result is prefix-free and has the same total size, then encode and decode a text using only the list of lengths.',
      hints: [
        'Treat the code as a number: next = (previous + 1) shifted left by the increase in length.',
        'The total size depends only on the lengths, and the lengths have not changed.',
      ],
    },
  ],

  compare: {
    idea: 'Join the two rarest symbols repeatedly to build a tree whose leaf depths are the code lengths.',
    requires: 'A count of how often each symbol appears, made beforehand. Whoever unpacks the data needs the code table too.',
    sensitivity: 'Moderate. Output size follows the entropy of the symbol counts, but never drops below 1 bit per symbol.',
    memory: 'O(k) for k distinct symbols: the tree, the queue and the code table.',
    difficulty: 'moderate',
    difficultyNote: 'The tree building is short. Bit-level input and output and a compact table format take more care.',
    limits: 'Every symbol costs at least one whole bit. It ignores the order of symbols and what came before. Sending the table can outweigh the saving on short texts.',
    useWhen: 'Some symbols are much more common than others and you want quick, simple compression that restores the text exactly.',
  },

  advanced: {
    history: 'Claude Shannon\'s 1948 paper established entropy as the limit of lossless compression. Shannon and Robert Fano each described a way to build variable-length codes. Fano\'s method splits the symbols into two groups of nearly equal total frequency, from the top down, and is close to optimal but not always optimal. In 1951 Fano gave his MIT class the choice of a final exam or a term paper on finding the most efficient binary code. David Huffman, one of the students, found the bottom-up construction and its proof of optimality, and published it in 1952. The method became a standard component of later formats, including the fax standards, JPEG and DEFLATE.',
    derivation: 'Let symbol $i$ have probability $p_i$ and code length $\\ell_i$, so the average length is $L = \\sum_i p_i \\ell_i$ and the entropy is $H = -\\sum_i p_i \\log_2 p_i$. The lengths of any prefix code satisfy the Kraft inequality $\\sum_i 2^{-\\ell_i} \\le 1$, and any lengths that satisfy it can be realized by a prefix code.\n\n**Lower bound.** Write $q_i = 2^{-\\ell_i}$. Then\n\n$$L - H = \\sum_i p_i \\log_2 \\frac{p_i}{q_i} \\;\\ge\\; -\\log_2 \\sum_i q_i \\;\\ge\\; 0,$$\n\nwhere the first inequality is the log-sum inequality and the second is Kraft. So $L \\ge H$ for every prefix code.\n\n**Upper bound.** The lengths $\\ell_i = \\lceil \\log_2 (1/p_i) \\rceil$ satisfy the Kraft inequality, so a prefix code with those lengths exists, and its average length is less than $\\sum_i p_i (\\log_2 (1/p_i) + 1) = H + 1$. Huffman\'s code is optimal, so it is at least as short. Together, for two or more symbols,\n\n$$H \\le L_{\\text{Huffman}} < H + 1.$$',
    proof: 'Let the cost of a tree be $\\sum_i f_i\\,\\ell_i$, where $f_i$ is the count of symbol $i$ and $\\ell_i$ its depth.\n\n**Exchange lemma.** Let $x$ and $y$ be two symbols with the smallest counts. Some optimal tree has $x$ and $y$ as siblings at maximum depth. Take any optimal tree. It is full (every internal node has two children), since a node with one child could be removed to shorten codes. So a deepest leaf $a$ has a sibling leaf $b$. Swapping $x$ with $a$ changes the cost by $(f_a - f_x)(\\ell_x - \\ell_a) \\le 0$, because $f_x \\le f_a$ and $\\ell_x \\le \\ell_a$. The same holds for $y$ and $b$. The tree after both swaps is still optimal.\n\n**Reduction lemma.** Replace $x$ and $y$ by one symbol $z$ with $f_z = f_x + f_y$. Hanging $x$ and $y$ beneath $z$ turns any tree $T\'$ for the reduced alphabet into a tree $T$ for the original with $\\text{cost}(T) = \\text{cost}(T\') + f_x + f_y$. The added term does not depend on $T\'$, so $T$ is cheapest among trees with $x$ and $y$ as siblings exactly when $T\'$ is optimal.\n\n**Induction.** For two symbols the algorithm is trivially optimal. For more, it joins $x$ and $y$ and then, by the induction hypothesis, builds an optimal tree for the reduced alphabet. By the reduction lemma the result is the best tree with $x$ and $y$ as siblings, and by the exchange lemma such a tree is optimal overall.',
    complexityProof: 'The queue starts with $k$ nodes and each round removes two and inserts one, so there are exactly $k - 1$ rounds and $3(k-1)$ heap operations on at most $k$ entries, each $O(\\log k)$. Counting is $O(n)$ and writing the output is proportional to its length. The longest possible code has $k - 1$ bits, reached when each join combines the running subtree with one new leaf, which happens for counts growing at least as fast as the Fibonacci numbers.',
    variants: [
      { name: 'Canonical Huffman codes', text: 'Keep the code lengths but reassign the bit patterns by a fixed rule, so that only the lengths need to be transmitted. DEFLATE and JPEG store their tables this way.' },
      { name: 'Length-limited Huffman codes', text: 'Find the best code subject to a maximum code length. The package-merge algorithm of Larmore and Hirschberg solves this exactly.' },
      { name: 'Adaptive Huffman coding', text: 'Update the tree as each symbol arrives, so that encoder and decoder stay in step and no table is sent. Algorithms are due to Faller, Gallager, Knuth and Vitter.' },
      { name: 'n-ary Huffman codes', text: 'Join the n smallest nodes at each step to build a code over an alphabet of n code symbols instead of two.' },
      { name: 'Arithmetic coding and asymmetric numeral systems', text: 'Not Huffman codes, but the usual replacements when whole bits per symbol are too coarse. They encode the entire message as one number.' },
    ],
    implementation: 'Use a deterministic tie-breaker. Store code lengths, not the tree, and derive canonical codes from them. Decode with a lookup table indexed by the next several bits. Limit the maximum code length to what the table can hold. Handle the one-symbol and empty inputs explicitly.',
    benchmarking: 'Report compressed size including the table. Compare the average code length against the entropy of the symbol counts to see how much of the possible gain was realized, and against a context-aware compressor to see how much redundancy symbol counts alone miss.',
    references: [
      { authors: 'D. A. Huffman', year: 1952, title: 'A method for the construction of minimum-redundancy codes', venue: 'Proceedings of the IRE 40(9), 1098-1101' },
      { authors: 'C. E. Shannon', year: 1948, title: 'A mathematical theory of communication', venue: 'Bell System Technical Journal 27(3), 379-423 and 27(4), 623-656' },
      { authors: 'P. Deutsch', year: 1996, title: 'DEFLATE Compressed Data Format Specification version 1.3', venue: 'RFC 1951, Internet Engineering Task Force' },
    ],
    furtherReading: [
      'T. M. Cover and J. A. Thomas, *Elements of Information Theory*, chapter "Data Compression".',
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, section "Huffman codes" in the chapter on greedy algorithms.',
      'K. Sayood, *Introduction to Data Compression*, chapter "Huffman Coding".',
    ],
  },

  tests: [
    { name: 'default input: prefix-free, optimal, round trip, entropy bound', input: {}, check: sound },
    { name: 'the worked example: 15 bits and the quoted codes', input: { text: 'ABACABADA' },
      check: (r) => (sound(r) === true && r.outputBits === 15 && r.encoded === '100101010010111' && r.codes.A === '1' && r.codes.B === '00' && r.codes.C === '010' && r.codes.D === '011') || `got ${r.outputBits} bits, ${JSON.stringify(r.codes)}` },
    { name: 'the code sample text: 49 bits', input: { text: 'she sells sea shells' },
      check: (r) => (sound(r) === true && r.outputBits === 49 && r.inputBits === 160 && r.codes.s === '10' && r.codes[' '] === '110') || `got ${r.outputBits} bits` },
    { name: 'eight equally common symbols all get 3 bits', input: { text: 'ABCDEFGH' },
      check: (r) => (sound(r) === true && r.outputBits === 24 && Object.values(r.codes).every((c) => c.length === 3)) || `got ${r.outputBits} bits` },
    { name: 'a single distinct symbol gets the 1-bit code 0', input: { text: 'aaaaaaaa' },
      check: (r) => (sound(r) === true && r.codes.a === '0' && r.outputBits === 8 && r.entropy === 0 && r.decoded === 'aaaaaaaa') || `got ${JSON.stringify(r.codes)}` },
    { name: 'two symbols get one bit each', input: { text: 'abbbbbbb' },
      check: (r) => (sound(r) === true && r.outputBits === 8) || `got ${r.outputBits} bits` },
    { name: 'a dominant symbol costs one bit, far above the entropy', input: { text: 'AAAAAAAAAAAAAAAAAAAAAAAABBCD' },
      check: (r) => (sound(r) === true && r.codes.A.length === 1 && r.entropy < 0.9 && r.averageLength >= 1) || `average ${r.averageLength}, entropy ${r.entropy}` },
    { name: 'a pangram with many symbols is still sound', input: { text: 'the quick brown fox jumps over the lazy dog' }, check: sound },
    { name: 'digits, punctuation and markup characters', input: { text: '$1.50 * 2 = $3.00 `ok`' }, check: sound },
  ],
};
