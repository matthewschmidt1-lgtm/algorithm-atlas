import { layoutTree } from '../../js/lib/graphs.js';

const METHODS = [
  { value: 'naive', label: 'Plain recursion (no memory)' },
  { value: 'memo', label: 'Recursion with a memo (top-down)' },
  { value: 'table', label: 'Table filled in order (bottom-up)' },
];
const TREE_MAX = 6;       // largest n whose whole call tree fits on screen
const NARRATE_DEPTH = 3;  // above TREE_MAX, only calls this close to the top get their own frames

// Screen positions for the call tree of plain recursion on n. Nodes are numbered in the
// order plain recursion calls them, so the run below can address a node without this layout.
function treeLayout(n) {
  let next = 0;
  const build = (k) => ({ id: next++, k, kids: k < 2 ? [] : [build(k - 1), build(k - 2)] });
  const root = build(n);
  const pos = layoutTree(root, (node) => node.kids);
  const nodes = [], edges = [];
  const walk = (node) => {
    const p = pos.get(node);
    nodes.push({ id: node.id, k: node.k, x: p.x, y: p.y });
    for (const kid of node.kids) { edges.push({ u: node.id, v: kid.id }); walk(kid); }
  };
  walk(root);
  return { nodes, edges };
}

const NODE_ROLE = { active: 'current', waiting: 'frontier', first: 'done', repeat: 'alert', hit: 'alert' };

function run(input, t) {
  const n = Math.max(0, Math.floor(Number(input.n) || 0));
  const method = input.method;
  // size[k]: how many calls plain recursion makes for fib(k). Used to number tree nodes.
  const size = [1, 1];
  for (let k = 2; k <= n; k++) size[k] = 1 + size[k - 1] + size[k - 2];
  const drawTree = method !== 'table' && n <= TREE_MAX;
  let layout = null;
  const status = new Map(), shown = new Map();
  const times = new Array(n + 1).fill(0);   // times[k]: how often fib(k) has been requested
  const known = new Array(n + 1).fill(null);
  let stackDepth = 0, maxStack = 0;

  const treeView = (legend) => {
    if (!layout) layout = treeLayout(n);
    return {
      kind: 'graph', aspect: 0.44, directed: false, legend,
      title: 'Call tree. Each circle is one request for fib(k), labelled with k. The number under it is the answer it returned.',
      nodes: layout.nodes.map((nd) => ({ id: nd.id, x: nd.x, y: nd.y, label: String(nd.k), role: NODE_ROLE[status.get(nd.id)] || 'dim', sub: shown.has(nd.id) ? shown.get(nd.id) : undefined })),
      edges: layout.edges.map((e) => {
        const s = status.get(e.v);
        return { u: e.u, v: e.v, role: !s ? 'dim' : s === 'active' || s === 'waiting' ? 'active' : s === 'repeat' ? 'rejected' : 'default' };
      }),
    };
  };
  const strip = (label, cell, title) => ({ kind: 'rows', title, rows: [{ label, cells: Array.from({ length: n + 1 }, (_, k) => cell(k)) }] });

  let value;

  if (method === 'naive') {
    const legend = [{ label: 'request being handled', role: 'current' }, { label: 'waiting for its two answers', role: 'frontier' }, { label: 'solved for the first time', role: 'done' }, { label: 'repeated work', role: 'alert' }, { label: 'not requested yet', role: 'dim' }];
    const views = () => {
      const counts = strip('Requests', (k) => ({ t: times[k], sub: `fib(${k})`, role: times[k] > 1 ? 'alert' : times[k] === 1 ? 'done' : 'default' }), 'How many times each subproblem has been requested so far');
      return drawTree ? [treeView(legend), counts] : [counts];
    };
    t.frame(() => ({ line: 0, note: `Find **fib(${n})** by plain recursion: to get fib(k), ask for fib(k − 1) and fib(k − 2), then add the two answers. Nothing is remembered between requests.${drawTree ? '' : ` The call tree for n = ${n} has ${size[n].toLocaleString('en-US')} requests, too many to draw, so only the first few levels are narrated and the rest are counted.`}`, views: views(), vars: { n } }));
    const fib = (k, id, depth) => {
      t.count('calls');
      const repeat = times[k] > 0;
      times[k]++;
      const narrate = drawTree || depth <= NARRATE_DEPTH;
      if (drawTree) status.set(id, 'active');
      stackDepth++; maxStack = Math.max(maxStack, stackDepth);
      if (k < 2) {
        if (drawTree) shown.set(id, k);
        if (narrate) t.frame(() => ({ line: 1, note: `fib(${k}) is a starting value: the answer is **${k}** with no further requests.${repeat ? ` This is request number ${times[k]} for fib(${k}).` : ''}`, views: views(), vars: { k, 'stack depth': stackDepth } }));
        if (drawTree) status.set(id, repeat ? 'repeat' : 'first');
        stackDepth--;
        return k;
      }
      if (narrate) t.frame(() => ({ line: [0, 2], note: repeat
        ? `**fib(${k})** is requested again. It was already worked out (the answer was ${known[k]}), but plain recursion kept no record, so all ${size[k].toLocaleString('en-US')} requests below this point are made again.`
        : `**fib(${k})** is requested. It cannot answer yet: it asks for fib(${k - 1}) first, then fib(${k - 2}).`, views: views(), vars: { k, 'stack depth': stackDepth } }));
      if (drawTree) status.set(id, 'waiting');
      const x = fib(k - 1, id + 1, depth + 1);
      const y = fib(k - 2, id + 1 + size[k - 1], depth + 1);
      t.count('additions');
      const v = x + y;
      known[k] = v;
      if (drawTree) { status.set(id, 'active'); shown.set(id, v); }
      if (narrate) t.frame(() => ({ line: [3, 4], note: `Both answers are back: fib(${k}) = fib(${k - 1}) + fib(${k - 2}) = ${x} + ${y} = **${v}**.${drawTree ? '' : ` Answering this one request took ${size[k].toLocaleString('en-US')} requests in total.`}`, views: views(), vars: { k, 'fib(k)': v, 'stack depth': stackDepth } }));
      if (drawTree) status.set(id, repeat ? 'repeat' : 'first');
      stackDepth--;
      return v;
    };
    value = fib(n, 0, 0);
    t.frame(() => ({ line: null, note: `fib(${n}) = **${value}**. Plain recursion made ${size[n].toLocaleString('en-US')} requests, yet only ${n + 1} different subproblems exist: fib(0) to fib(${n}). ${size[n] > n + 1 ? `The other ${(size[n] - n - 1).toLocaleString('en-US')} requests repeated work that had already been done.` : 'Nothing was repeated for an input this small.'}`, views: views(), vars: { n, 'fib(n)': value } }));
  } else if (method === 'memo') {
    const memo = new Map([[0, 0], [1, 1]]);
    let wrote = -1, read = -1;
    const legend = [{ label: 'request being handled', role: 'current' }, { label: 'waiting for its two answers', role: 'frontier' }, { label: 'computed once and stored', role: 'done' }, { label: 'answered from the memo, nothing below it is run', role: 'alert' }, { label: 'never requested (work saved)', role: 'dim' }];
    const views = () => {
      const row = strip('Memo', (k) => ({ t: memo.has(k) ? memo.get(k) : '?', sub: `fib(${k})`, role: k === wrote ? 'current' : k === read ? 'compare' : memo.has(k) ? 'done' : 'default' }), 'The memo: answers written down so far');
      return drawTree ? [treeView(legend), row] : [row];
    };
    t.frame(() => ({ line: 6, note: `Find **fib(${n})** by recursion with a memo, a record of answers already found. It starts with the two values we know: fib(0) = 0 and fib(1) = 1.${drawTree ? ' The faint tree is what plain recursion would do. Watch how little of it is needed.' : ''}`, views: views(), vars: { n } }));
    const fib = (k, id) => {
      t.count('calls');
      if (drawTree) status.set(id, 'active');
      stackDepth++; maxStack = Math.max(maxStack, stackDepth);
      if (memo.has(k)) {
        t.count('memo hits');
        const v = memo.get(k);
        read = k; wrote = -1;
        if (drawTree) shown.set(id, v);
        t.frame(() => ({ line: [8, 9], note: k < 2
          ? `fib(${k}) is one of the two starting values in the memo: **${v}**.`
          : `fib(${k}) is already in the memo: **${v}**. Return it at once. The ${(size[k] - 1).toLocaleString('en-US')} further requests that plain recursion would make from here never happen.`, views: views(), vars: { k, 'memo[k]': v, 'stack depth': stackDepth } }));
        if (drawTree) status.set(id, 'hit');
        stackDepth--;
        return v;
      }
      read = -1; wrote = -1;
      t.frame(() => ({ line: [7, 8, 10], note: `**fib(${k})** is not in the memo yet, so it has to be computed: ask for fib(${k - 1}) first, then fib(${k - 2}).`, views: views(), vars: { k, 'stack depth': stackDepth } }));
      if (drawTree) status.set(id, 'waiting');
      const x = fib(k - 1, id + 1);
      const y = fib(k - 2, id + 1 + size[k - 1]);
      t.count('additions');
      const v = x + y;
      memo.set(k, v);
      wrote = k; read = -1;
      if (drawTree) { status.set(id, 'active'); shown.set(id, v); }
      t.frame(() => ({ line: [11, 12, 13], note: `fib(${k}) = ${x} + ${y} = **${v}**. Write it in the memo so that it is never computed again.`, views: views(), vars: { k, 'fib(k)': v, 'stack depth': stackDepth } }));
      if (drawTree) status.set(id, 'first');
      stackDepth--;
      return v;
    };
    value = fib(n, 0);
    wrote = -1; read = -1;
    t.frame(() => ({ line: null, note: `fib(${n}) = **${value}**. With the memo, each subproblem was computed once: ${Math.max(0, n - 1)} additions and ${Math.max(1, 2 * n - 1)} requests, against ${size[n].toLocaleString('en-US')} requests for plain recursion.`, views: views(), vars: { n, 'fib(n)': value } }));
  } else {
    const T = new Array(n + 1).fill(null);
    let at = -1;
    const views = () => [strip('Table', (k) => ({ t: T[k] === null ? '' : T[k], sub: `fib(${k})`, role: k === at ? 'current' : at >= 2 && (k === at - 1 || k === at - 2) ? 'compare' : T[k] !== null ? 'done' : 'default' }), 'The table, filled from left to right')];
    T[0] = 0;
    if (n >= 1) T[1] = 1;
    t.frame(() => ({ line: [15, 16], note: `Find **fib(${n})** by filling a table from the small end. Start with the two values we know: fib(0) = 0${n >= 1 ? ' and fib(1) = 1' : ''}.`, views: views(), vars: { n },
    }));
    for (let i = 2; i <= n; i++) {
      t.count('additions');
      T[i] = T[i - 1] + T[i - 2];
      at = i;
      t.frame(() => ({ line: [17, 18], note: `fib(${i}) = fib(${i - 1}) + fib(${i - 2}) = ${T[i - 1]} + ${T[i - 2]} = **${T[i]}**. Both numbers were already in the table, so this costs one addition.`, views: views(), vars: { i, 'T[i]': T[i] } }));
    }
    at = -1;
    value = T[n];
    t.frame(() => ({ line: 19, note: `The last cell holds the answer: fib(${n}) = **${value}**. The table needed ${Math.max(0, n - 1)} additions and no recursion at all. Since each step reads only the two cells before it, two variables would do in place of the whole table.`, views: views(), vars: { n, 'fib(n)': value } }));
    return { n, value, method, table: T.slice(), distinct: n + 1 };
  }
  return { n, value, method, times: times.slice(), maxStack, distinct: n + 1 };
}

// Independent reference: Binet's closed form, exact after rounding for the small n used here.
const PHI = (1 + Math.sqrt(5)) / 2;
const binet = (n) => Math.round(Math.pow(PHI, n) / Math.sqrt(5));
// Calls made by plain recursion, from the recurrence C(n) = 1 + C(n-1) + C(n-2).
const naiveCalls = (n) => { let a = 1, b = 1; for (let i = 2; i <= n; i++) [a, b] = [b, 1 + a + b]; return n < 1 ? 1 : b; };

export default {
  meta: {
    id: 'fibonacci-dp',
    name: 'Fibonacci by Dynamic Programming',
    aliases: ['Fibonacci numbers', 'memoized Fibonacci', 'top-down dynamic programming', 'bottom-up dynamic programming', 'tabulation'],
    kind: 'algorithm',
    discipline: 'algorithms',
    alsoIn: [
      { id: 'mathematics', why: 'The Fibonacci recurrence is the standard first example of a sequence defined by its own earlier terms, and its growth rate is the golden ratio.' },
    ],
    subfield: 'Dynamic programming',
    family: 'One-dimensional recurrences',
    lab: 'dynamic-programming',
    summary: 'Computes Fibonacci numbers three ways to show the central move of dynamic programming: solve each subproblem once, store the answer, and reuse it.',
    difficulty: 'beginner',
    order: 300,
    paradigms: ['dynamic-programming'],
    randomized: false,
    approximate: false,
    time: { best: 'O(n) additions', average: 'O(n) additions', worst: 'O(n) additions with a memo or table; exponential without', class: 'linear' },
    space: { worst: 'O(n) for the memo or table; O(1) with two variables', class: 'linear' },
    tags: {
      problems: ['fibonacci numbers', 'avoid repeated work', 'speed up a slow recursive function', 'what is dynamic programming', 'remember answers already computed'],
      techniques: ['memoization', 'tabulation', 'recursion', 'recurrence'],
      applications: ['standard libraries', 'scientific computing', 'data processing'],
    },
    prerequisites: ['concept:recursion', 'concept:recurrence', 'concept:big-o'],
  },

  bigIdea: {
    simple: "Dynamic programming is a way to stop a computer doing the same work twice. The Fibonacci numbers make a good first example. They start 0, 1, and after that each number is the sum of the two before it: 0, 1, 1, 2, 3, 5, 8, 13. Suppose you want the thirtieth one. One way is to say: I need the two numbers before it. For each of those, I need the two before them, and so on down. That works, but it asks for the same small answers again and again, millions of times in all. A better way is to keep a notebook. The first time you work out an answer, write it down. The next time you need it, read it from the page. Better still, start from the small end and fill the page in order. Now about thirty short sums are enough. The same habit, solving each small problem once and reusing the answer, speeds up many harder problems.",
    what: 'This lesson computes the n-th Fibonacci number in three ways. Plain recursion follows the definition directly and repeats the same subproblems an exponential number of times. **Memoization** keeps the recursion but stores each answer the first time it is found. The **bottom-up** method drops the recursion and fills a table from the smallest subproblem upward. The last two are the two standard forms of dynamic programming.',
    why: 'Nobody needs dynamic programming to compute Fibonacci numbers: a loop with two variables does it. The example is used because it isolates one idea with nothing else in the way. The recursion is two lines long, the waste is easy to see in a picture, and the fix is one extra line.',
    when: 'Reach for a memo or a table when a problem breaks into smaller problems of the same kind and the same smaller problems turn up many times. If the subproblems never repeat, as in [merge sort](#/algorithm/merge-sort), a memo stores answers that are never read and only costs memory.',
    interesting: 'The number of requests plain recursion makes for the n-th Fibonacci number is itself almost a Fibonacci number: exactly twice the next one, minus one. The slowness of the method is measured by the very sequence it computes.',
    where: 'The pattern, not the sequence, is what gets used. Every table-filling lesson in this atlas ([longest common subsequence](#/algorithm/lcs), [edit distance](#/algorithm/edit-distance), [0/1 knapsack](#/algorithm/knapsack), [sequence alignment](#/algorithm/needleman-wunsch)) is this same move with a larger table and a choice in each cell. Many languages ship a ready-made memo, such as `functools.lru_cache` in Python.',
    analogy: {
      title: 'A notebook of answers',
      text: 'A pupil is asked the same long sum several times in one lesson. The first time, they work it out and write the answer in a notebook. Every later time, they read it off the page. The work is done once however often the question comes back. Bottom-up dynamic programming goes one step further: knowing which questions will come, the pupil works through them in order, easiest first, so that every answer needed is already on the page.',
      limits: 'A notebook only helps when the same question really does come back, and when its answer cannot change between askings. It also takes up space: the page has one line for every different question. And the notebook does not make any single sum faster. For very large Fibonacci numbers the sums themselves become long, and no amount of remembering changes that.',
    },
  },

  example: {
    setup: 'The Fibonacci numbers start 0, 1. After that, each one is the sum of the two before it: 0, 1, 1, 2, 3, 5, 8. Count positions from zero, so the number at position 6 is 8. Here are three ways to find it.',
    steps: [
      'Plain recursion. To find position 6, ask for positions 5 and 4. To find position 5, ask for positions 4 and 3. Position 4 has now been asked for twice, and each request starts again from nothing.',
      'Follow every request to the end and count them. There are 25 requests in all. Position 4 is worked out 2 times, position 3 is worked out 3 times, and position 2 is worked out 5 times.',
      'With a notebook. The first time an answer is found, write it down. Any later request for it is answered by reading the notebook. Now there are 11 requests and only 5 additions.',
      'With a table filled from the small end. Write 0 and 1. Then 0 + 1 = 1, 1 + 1 = 2, 1 + 2 = 3, 2 + 3 = 5, 3 + 5 = 8. That is 5 additions and no requests at all.',
    ],
    result: 'All three ways give 8. They differ only in how much work is repeated: 25 requests, then 11, then none. The gap widens quickly. For position 24, plain recursion makes 150,049 requests, while the table needs 23 additions.',
    tryInput: { n: 6, method: 'naive' },
  },

  terms: [
    { term: 'Fibonacci numbers', meaning: 'The list 0, 1, 1, 2, 3, 5, 8, 13 and so on, where each number after the first two is the sum of the two before it.' },
    { term: 'Recursion', meaning: 'Solving a problem by asking the same question about smaller cases, until the cases are small enough to answer directly.' },
    { term: 'Base case', meaning: 'A case small enough to answer directly, with no further questions. Here the base cases are positions 0 and 1.' },
    { term: 'Subproblem', meaning: 'One of the smaller questions a bigger question depends on. The number at position 4 is a subproblem of the number at position 6.' },
    { term: 'Overlapping subproblems', meaning: 'The situation where the same subproblem is needed in many different places.' },
    { term: 'Memoization', meaning: 'Writing down the answer to a subproblem the first time it is found, and reading it back whenever it is needed again.' },
    { term: 'Bottom-up', meaning: 'Solving the smallest subproblems first and working upward, so every answer is ready before it is needed.' },
    { term: 'Dynamic programming', meaning: 'Solving a problem by solving each of its subproblems once and reusing the stored answers.' },
  ],

  takeaway: 'If the same small question keeps coming back, answer it once, write the answer down, and look it up from then on.',

  viz: {
    describe: 'For plain recursion and for the memo, with n up to 6, a tree of circles shows every request for fib(k), labelled with k and with the returned value beneath. The request being handled is terracotta, requests waiting for their answers are ochre, first-time answers are forest green, and requests never made are faint. Brick red marks a request for something already solved: under plain recursion the whole subtree below it is brick red because it is all redone, while with the memo a single brick red circle sits on top of a faint subtree that is never run. Below the tree a strip of cells shows, for plain recursion, how many times each subproblem has been requested, and for the memo, which answers have been stored. The bottom-up method shows only the strip: a table filling from left to right, with the two cells being added in ochre.',
    inputs: [
      { id: 'n', type: 'range', label: 'Which Fibonacci number (n)', min: 0, max: 24, step: 1, default: 6,
        help: 'The call tree is drawn for n up to 6. Beyond that it has too many requests to fit, and they are counted without being drawn.' },
      { id: 'method', type: 'select', label: 'Method', options: METHODS, default: 'naive' },
    ],
    presets: [
      { label: 'Plain recursion, n = 6', values: { n: 6, method: 'naive' } },
      { label: 'Same n with a memo', values: { n: 6, method: 'memo' } },
      { label: 'Bottom-up table, n = 12', values: { n: 12, method: 'table' } },
      { label: 'Plain recursion, n = 20', values: { n: 20, method: 'naive' } },
    ],
    tryThis: [
      'Load "Plain recursion, n = 6" and step to the end. Count the forest green circles: there are 7, one for each of fib(0) to fib(6). Every brick red circle is work that had already been done. Then load "Same n with a memo" and see which parts of the faint tree are never touched.',
      'With plain recursion, raise n from 4 to 5 to 6 and read the "calls" counter each time: 9, 15, 25. Each new total is the sum of the previous two, plus one. Switch the method to the memo and repeat: 7, 9, 11.',
      'Load "Plain recursion, n = 20" and look at the strip of request counts. fib(1) alone is requested 6,765 times. Switch to the bottom-up table and the same answer takes 19 additions.',
    ],
    run,
    report: (r, c) => `fib(${r.n}) = ${r.value}\n${METHODS.find((m) => m.value === r.method).label}: ${(c.calls || 0).toLocaleString('en-US')} calls, ${(c.additions || 0).toLocaleString('en-US')} additions.\nDistinct subproblems: ${r.distinct} (fib(0) to fib(${r.n})).`,
    experiment: {
      title: 'Calls as n grows',
      note: 'Each point is a real run of this page\'s code, counting every call to the recursive function. The curves are the exact formulas, so the points should sit on them. The bottom-up table makes no calls at all and does n − 1 additions.',
      metric: 'calls',
      metricLabel: 'Calls to fib',
      sizeLabel: 'n',
      sizes: [4, 8, 12, 16, 20, 24],
      variants: [
        { id: 'naive', label: 'Plain recursion' },
        { id: 'memo', label: 'With a memo' },
      ],
      input: (n, variant) => ({ n, method: variant }),
      theory: [
        { label: '2·fib(n + 1) − 1', fn: (n) => naiveCalls(n), variant: 'naive' },
        { label: '2n − 1', fn: (n) => 2 * n - 1, variant: 'memo' },
      ],
    },
  },

  logic: {
    intuition: 'The definition fib(n) = fib(n − 1) + fib(n − 2) can be run as it stands, but the two requests are not independent: fib(n − 1) will itself need fib(n − 2). Followed blindly, the definition recomputes the same values in every branch. Yet there are only n + 1 different values to find, fib(0) to fib(n). Dynamic programming makes the work proportional to the number of different subproblems, not to the number of times they are requested.',
    steps: [
      'Write the answer in terms of smaller answers: fib(n) = fib(n − 1) + fib(n − 2), with fib(0) = 0 and fib(1) = 1. This is the recurrence.',
      'Notice that the same smaller answers are needed many times. This is what makes storing them worthwhile.',
      'Top-down (memoization): keep the recursion, but before computing fib(k) check a memo. If the answer is there, return it. If not, compute it, store it, and return it.',
      'Bottom-up (tabulation): order the subproblems so each one comes after everything it depends on. For Fibonacci that order is 0, 1, 2, up to n. Fill a table in that order with a loop.',
      'Read the final answer from the memo or the last table cell.',
      'Optionally shrink the storage. Each Fibonacci step reads only the previous two cells, so two variables can replace the table.',
    ],
    pseudocode: [
      'fibNaive(n):',
      '  if n < 2: return n',
      '  a ← fibNaive(n − 1)',
      '  b ← fibNaive(n − 2)',
      '  return a + b',
      '',
      'memo ← {0: 0, 1: 1}',
      'fibMemo(n):',
      '  if memo has n:',
      '    return memo[n]',
      '  a ← fibMemo(n − 1)',
      '  b ← fibMemo(n − 2)',
      '  memo[n] ← a + b',
      '  return memo[n]',
      '',
      'fibTable(n):',
      '  T[0] ← 0, T[1] ← 1',
      '  for i from 2 to n:',
      '    T[i] ← T[i − 1] + T[i − 2]',
      '  return T[n]',
    ],
    decisions: [
      { title: 'Top-down or bottom-up?', text: 'Both compute each subproblem once. Top-down keeps the shape of the recursive definition and only solves the subproblems that are actually reached, at the cost of a call stack as deep as n. Bottom-up needs you to work out a valid order yourself, but it is a plain loop with no recursion limit and it makes the memory use obvious.' },
      { title: 'What is the key of the memo?', text: 'Whatever fully identifies a subproblem. Here that is the single number k. In [edit distance](#/algorithm/edit-distance) it is a pair of positions, which is why that memo is a two-dimensional table.' },
      { title: 'How much to remember?', text: 'A full table is needed only if old entries are read again later, for example to trace back how an answer was built. Fibonacci reads just the last two entries, so everything older can be discarded.' },
    ],
    invariants: [
      'Bottom-up: before the step for `i`, cells `T[0]` to `T[i − 1]` hold the correct Fibonacci numbers.',
      'Top-down: every value stored in the memo is the correct Fibonacci number for its key, and a stored value is never changed.',
    ],
    edgeCases: [
      'n = 0 and n = 1 are the base cases and need no addition. A table version that writes `T[1]` without checking must not be given n = 0.',
      'Deep recursion: the memoized version still recurses n levels deep on its first descent. In Python, n of about a thousand exceeds the default recursion limit. The bottom-up loop has no such limit.',
      'Overflow: Fibonacci numbers outgrow fixed-size integers quickly. fib(92) is the largest that fits in a signed 64-bit integer, and fib(78) is the largest that a 64-bit floating-point number (every JavaScript number) holds exactly.',
      'Negative n is outside the definition used here.',
    ],
    correctness: 'By induction on i. `T[0]` and `T[1]` are correct by definition. If `T[i − 1]` and `T[i − 2]` are correct, then `T[i] = T[i − 1] + T[i − 2]` is correct because that is the recurrence. The memoized version computes the same values: it returns either a stored value, which was correct when stored, or the sum of two recursive results on smaller arguments, which are correct by the induction hypothesis. Storing an answer never changes what is returned, only how often the sum is recomputed.',
    mistakes: [
      'Creating the memo inside the function, so every call starts with an empty one and nothing is ever found in it.',
      'Checking the memo after making the recursive calls. The check has to come first, or the calls are still made.',
      'Filling the table in an order where a cell is read before it has been written.',
      'Calling the result "linear time" for huge n without noticing that the numbers being added have themselves grown to thousands of digits.',
    ],
  },

  code: {
    sample: {
      input: 'fib(20) by plain recursion and with a memo, counting calls; then the bottom-up table up to fib(10), and fib(90).',
      expected: 'naive:     fib(20) = 6765 after 21891 calls\nmemoized:  fib(20) = 6765 after 39 calls\nbottom-up: 0 1 1 2 3 5 8 13 21 34 55\nbottom-up: fib(90) = 2880067194370816120',
    },
    python: {
      source: `def fib_naive(n, count):
    count[0] += 1
    if n < 2:
        return n
    return fib_naive(n - 1, count) + fib_naive(n - 2, count)


def fib_memo(n, memo, count):
    count[0] += 1
    if n in memo:
        return memo[n]
    memo[n] = fib_memo(n - 1, memo, count) + fib_memo(n - 2, memo, count)
    return memo[n]


def fib_table(n):
    table = [0, 1]
    for i in range(2, n + 1):
        table.append(table[i - 1] + table[i - 2])
    return table


count = [0]
value = fib_naive(20, count)
print(f"naive:     fib(20) = {value} after {count[0]} calls")

count = [0]
value = fib_memo(20, {0: 0, 1: 1}, count)
print(f"memoized:  fib(20) = {value} after {count[0]} calls")

print("bottom-up: " + " ".join(str(x) for x in fib_table(10)))
print(f"bottom-up: fib(90) = {fib_table(90)[90]}")`,
      notes: [
        { line: 2, text: '`count` is a one-element list so that every recursive call updates the same counter.' },
        { line: 5, text: 'Two recursive calls and nothing remembered. `fib_naive(n - 1)` will compute `fib_naive(n - 2)` internally, and then the second call computes it all over again.' },
        { line: 10, text: 'The memo is checked before anything else. The starting memo `{0: 0, 1: 1}` makes the base cases ordinary lookups.' },
        { line: 12, text: 'Store the answer before returning it. This one line is the whole difference between 21,891 calls and 39.' },
        { line: 19, text: 'Both values being added are already in the table, because the loop visits the subproblems smallest first.' },
        { line: 32, text: 'Python integers grow as needed, so fib(90) is exact. The JavaScript version needs `BigInt` for the same result.' },
      ],
    },
    javascript: {
      source: `function fibNaive(n, count) {
  count.calls++;
  if (n < 2) return n;
  return fibNaive(n - 1, count) + fibNaive(n - 2, count);
}

function fibMemo(n, memo, count) {
  count.calls++;
  if (memo.has(n)) return memo.get(n);
  const value = fibMemo(n - 1, memo, count) + fibMemo(n - 2, memo, count);
  memo.set(n, value);
  return value;
}

// BigInt values, because fib(79) and beyond do not fit exactly in a JavaScript number.
function fibTable(n) {
  const table = [0n, 1n];
  for (let i = 2; i <= n; i++) table.push(table[i - 1] + table[i - 2]);
  return table;
}

let count = { calls: 0 };
let value = fibNaive(20, count);
console.log("naive:     fib(20) = " + value + " after " + count.calls + " calls");

count = { calls: 0 };
value = fibMemo(20, new Map([[0, 0], [1, 1]]), count);
console.log("memoized:  fib(20) = " + value + " after " + count.calls + " calls");

console.log("bottom-up: " + fibTable(10).join(" "));
console.log("bottom-up: fib(90) = " + fibTable(90)[90]);`,
    },
    cpp: {
      source: `#include <iostream>
#include <unordered_map>
#include <vector>

long long fibNaive(int n, long long& calls) {
    ++calls;
    if (n < 2) return n;
    return fibNaive(n - 1, calls) + fibNaive(n - 2, calls);
}

long long fibMemo(int n, std::unordered_map<int, long long>& memo, long long& calls) {
    ++calls;
    auto found = memo.find(n);
    if (found != memo.end()) return found->second;
    long long value = fibMemo(n - 1, memo, calls) + fibMemo(n - 2, memo, calls);
    memo[n] = value;
    return value;
}

// long long holds values up to fib(92). fib(93) would overflow.
std::vector<long long> fibTable(int n) {
    std::vector<long long> table = {0, 1};
    for (int i = 2; i <= n; ++i) table.push_back(table[i - 1] + table[i - 2]);
    return table;
}

int main() {
    long long calls = 0;
    long long value = fibNaive(20, calls);
    std::cout << "naive:     fib(20) = " << value << " after " << calls << " calls\\n";

    calls = 0;
    std::unordered_map<int, long long> memo = {{0, 0}, {1, 1}};
    value = fibMemo(20, memo, calls);
    std::cout << "memoized:  fib(20) = " << value << " after " << calls << " calls\\n";

    std::cout << "bottom-up:";
    for (long long x : fibTable(10)) std::cout << " " << x;
    std::cout << "\\n";
    std::cout << "bottom-up: fib(90) = " << fibTable(90)[90] << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Plain recursion makes exactly 2·fib(n + 1) − 1 calls, which grows like 1.618ⁿ: adding 1 to n multiplies the work by about 1.6. With a memo or a table, each of the n + 1 subproblems is computed once, so the work is n − 1 additions. That count is honest only while one addition is one step, which stops being true when the numbers get large.',
    cases: [
      { case: 'Plain recursion', time: 'Θ(φⁿ) calls, φ ≈ 1.618', when: 'No answers are stored. The number of calls is 2·fib(n + 1) − 1.' },
      { case: 'Memoized recursion', time: 'O(n) additions', when: 'Each subproblem is computed once: n − 1 additions and 2n − 1 calls.' },
      { case: 'Bottom-up table', time: 'O(n) additions', when: 'A loop from 2 to n. The same n − 1 additions, with no calls.' },
      { case: 'Exact big-number arithmetic', time: 'O(n²) bit operations', when: 'fib(n) has about 0.69 n bits, so the later additions each take time proportional to n. This applies to the memo and the table alike.' },
    ],
    space: 'The memo and the table hold n + 1 numbers. The memoized recursion also uses a call stack n deep. Keeping only the last two values reduces the bottom-up method to two numbers. Plain recursion stores no answers but still needs a call stack n deep.',
    memory: 'In exact arithmetic the stored numbers are not all the same size: fib(k) takes about 0.69 k bits, so a full table of exact values up to fib(n) takes space proportional to n², not n.',
    tradeoffs: 'Dynamic programming trades memory for time: a table of n + 1 answers buys the drop from exponential to linear work. For Fibonacci the memory can then be won back, because only the last two answers are ever read. Faster methods exist for this particular sequence: fast doubling and matrix powers need only O(log n) multiplications, though of very large numbers.',
    assumptions: [
      'The O(n) bounds count additions and treat each as one step. That holds while values fit in a machine word: up to fib(92) for signed 64-bit integers, and up to fib(78) for exact results in 64-bit floating point.',
      'For larger n with exact integers, adding two numbers of b bits costs time proportional to b, which gives the O(n²) bit-operation bound above.',
      'A memo lookup or table access is counted as constant time.',
      'The chart on this page counts function calls made by this implementation, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Any recursive definition in which the same subproblems recur. Storing answers reduces the work to one computation per distinct subproblem.',
      'Teaching: the whole method is visible in five lines, and the saving can be counted exactly.',
      'Recurrences that read a fixed number of earlier terms, where the table can be shrunk to a few variables.',
    ],
    struggles: [
      'Problems whose subproblems do not overlap. Divide-and-conquer algorithms such as merge sort gain nothing from a memo.',
      'Problems with too many distinct subproblems to store. The table is only as small as the number of different questions.',
      'Very large n in exact arithmetic, where the size of the numbers dominates the cost and methods using O(log n) multiplications are much faster.',
    ],
    pitfalls: [
      'Deep recursion in the memoized version overflowing the call stack for large n.',
      'Silent integer overflow in languages with fixed-size integers, and silent rounding in languages that use floating point for all numbers.',
      'A memo that is rebuilt on every call, or shared between problems whose answers differ.',
    ],
    misunderstandings: [
      '"Dynamic programming is a special kind of programming language or coding style." The name is historical. Richard Bellman used "programming" in the older sense of planning or scheduling. The technique is simply solving subproblems once and reusing the answers.',
      '"Memoization and dynamic programming are different things." Memoization is the top-down way of doing dynamic programming. Filling a table in order is the bottom-up way. They compute the same answers from the same recurrence.',
      '"Recursion is what makes the plain version slow." Recursion is not the problem. The memoized version is just as recursive and takes 39 calls where the plain one takes 21,891. Recomputing answers is the problem.',
      '"With a table, computing fib(n) always takes n steps." It takes n − 1 additions. Once the numbers no longer fit in a machine word, each addition takes longer, and the true cost grows like n².',
      '"Fibonacci shows everything about dynamic programming." It shows overlapping subproblems only. Most uses also involve choosing the best of several options in each cell, which Fibonacci does not have.',
    ],
    constraints: [
      'Default recursion limits (about 1,000 frames in CPython) cap the memoized version unless the limit is raised or the code is rewritten bottom-up.',
      'Fixed-width number types cap the range of exact answers: n up to 92 in signed 64-bit integers.',
    ],
    alternatives: [
      { name: 'Two-variable loop', when: 'You only need fib(n) itself. It is the bottom-up method with the table reduced to the last two values.' },
      { name: 'Fast doubling or matrix powers', when: 'n is very large. They use the identities for fib(2k) and fib(2k + 1) to reach fib(n) in O(log n) multiplications.' },
      { id: 'modular-exponentiation', name: 'Fast Modular Exponentiation', when: 'You need fib(n) modulo some number for huge n. The same repeated-squaring idea applies to powers of a 2 by 2 matrix.' },
      { name: 'Binet\'s closed formula', when: 'A floating-point estimate is enough. It is exact after rounding only for small n, because it relies on powers of an irrational number.' },
    ],
    comparison: {
      columns: ['', 'Plain recursion', 'Memoized (top-down)', 'Table (bottom-up)'],
      rows: [
        ['Calls for fib(n)', '2·fib(n + 1) − 1', '2n − 1', 'None'],
        ['Additions', 'fib(n + 1) − 1', 'n − 1', 'n − 1'],
        ['Stored answers', 'None', 'n + 1', 'n + 1, or 2 with two variables'],
        ['Call stack depth', 'n', 'n', 'None'],
        ['Order of subproblems', 'Decided by the recursion', 'Decided by the recursion', 'Chosen by the programmer'],
      ],
    },
  },

  applications: [
    { title: 'The first example in teaching dynamic programming', status: 'established', text: 'Textbooks and courses introduce memoization and tabulation with Fibonacci numbers because the recurrence is two lines long and the repeated work can be drawn as a tree.' },
    { title: 'Memoization as a library feature', status: 'established', text: 'Python\'s standard library provides `functools.lru_cache` and `functools.cache`, decorators that add a memo to any function of hashable arguments. The documentation for `lru_cache` uses a recursive Fibonacci function as one of its examples.' },
    { title: 'Fibonacci numbers in the analysis of other algorithms', status: 'established', text: 'The sequence appears where a quantity depends on its two predecessors. The worst inputs for the [Euclidean algorithm](#/algorithm/euclidean-algorithm) are consecutive Fibonacci numbers, a result due to Gabriel Lamé, and the fewest nodes an AVL tree of a given height can have follows a Fibonacci-like recurrence.' },
    { title: 'Counting problems with the same recurrence', status: 'illustrative', text: 'The number of ways to climb n stairs taking one or two steps at a time, and the number of ways to tile a 2 by n strip with dominoes, both satisfy the Fibonacci recurrence and are computed by the same table.' },
  ],

  connections: [
    { to: 'concept:recursion', type: 'prerequisite', why: 'The plain and memoized versions are recursive functions. Dynamic programming starts from a recursive definition and changes only how its answers are stored.' },
    { to: 'concept:recurrence', type: 'prerequisite', why: 'fib(n) = fib(n − 1) + fib(n − 2) is a recurrence, and so is the count of calls C(n) = C(n − 1) + C(n − 2) + 1 that explains why plain recursion is slow.' },
    { to: 'concept:overlapping-subproblems', type: 'prerequisite', why: 'Fibonacci is the smallest example of the property: n + 1 distinct subproblems, requested exponentially many times.' },
    { to: 'concept:memoization', type: 'related', why: 'The memoized version is memoization in its plainest form: check a store before computing, and write to it after.' },
    { to: 'concept:dynamic-programming', type: 'related', why: 'Both the memo and the table solve each subproblem once and reuse it, which is the defining move of the paradigm.' },
    { to: 'concept:optimal-substructure', type: 'advanced', why: 'Fibonacci has no choices to optimize. The next step in dynamic programming adds a minimum or maximum over options in each cell, which is valid only when best answers are built from best sub-answers.' },
    { to: 'lcs', type: 'advanced', why: 'The same fill-a-table-in-dependency-order method, with a two-dimensional table and a choice in each cell.' },
    { to: 'edit-distance', type: 'advanced', why: 'Each cell depends on three earlier cells where Fibonacci depends on two, and the table is filled in an order that guarantees those cells are ready.' },
    { to: 'knapsack', type: 'advanced', why: 'A table over items and capacities filled bottom-up. It shows what Fibonacci cannot: a decision in each cell.' },
    { to: 'needleman-wunsch', type: 'advanced', why: 'Sequence alignment in biology uses the same bottom-up table filling with a scoring rule in each cell.' },
    { to: 'bellman-ford', type: 'related', why: 'Bellman-Ford is bottom-up dynamic programming over the number of edges allowed on a path: round k reuses the distances stored in round k − 1.' },
    { to: 'dijkstra', type: 'related', why: 'Shortest distances satisfy a recurrence over neighbouring nodes. Dijkstra\'s algorithm works because it finds an order in which every value is final when first computed, which is the same requirement a bottom-up table places on its fill order.' },
    { to: 'huffman-coding', type: 'related', why: 'Symbol frequencies that follow the Fibonacci numbers give the most lopsided Huffman tree possible: each merged total stays just small enough to be picked again at the next step, so every merge adds one level.' },
    { to: 'backpropagation', type: 'related', why: 'Backpropagation computes each intermediate derivative once and reuses it for every weight that depends on it, the same store-and-reuse idea applied to the chain rule.' },
    { to: 'euclidean-algorithm', type: 'related', why: 'Consecutive Fibonacci numbers are the inputs that make the Euclidean algorithm take the most steps for their size.' },
    { to: 'modular-exponentiation', type: 'advanced', why: 'Repeated squaring of a 2 by 2 matrix reaches fib(n) in O(log n) multiplications, replacing the n-step table with a logarithmic number of doublings.' },
    { to: 'discipline:mathematics', type: 'application', why: 'Linear recurrences, their closed forms and their growth rates are a topic of discrete mathematics. The ratio of consecutive Fibonacci numbers tends to the golden ratio.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why does plain recursion take so long to compute fib(30)?',
      options: ['Recursive function calls are slow in every language', 'It computes the same subproblems over and over', 'The numbers involved are too large to add quickly', 'It has to sort the earlier Fibonacci numbers first'],
      answer: 1,
      explain: [
        'A call has some overhead, but the memoized version is just as recursive and is fast. The number of calls is what matters.',
        'Correct. There are only 31 different subproblems, but plain recursion makes 2,692,537 calls because it keeps no record of answers.',
        'fib(30) is 832,040, which any computer adds in one step. Number size matters only for much larger n.',
        'Nothing is sorted. Each value depends only on the two before it.',
      ],
    },
    {
      type: 'predict',
      q: 'Recursion with a memo is used to find fib(10). The memo starts with fib(0) and fib(1). How many calls to the function are made in total, counting the calls that are answered from the memo?',
      options: ['10', '19', '55', '177'],
      answer: 1,
      explain: [
        'There are 9 additions, and close to 10 values computed, but each computing call also makes a second call that is answered from the memo.',
        'Correct. The calls for fib(10) down to fib(2) each compute a value: 9 calls. Each of those makes one further call that the memo answers, and the deepest one makes two: 10 more. In general 2n − 1.',
        '55 is the value of fib(10), not the number of calls.',
        '177 is what plain recursion needs: 2·fib(11) − 1.',
      ],
      tryInput: { n: 10, method: 'memo' },
    },
    {
      type: 'debug',
      q: 'This function was meant to be memoized, but it is as slow as plain recursion. Which line is wrong?',
      code: `def fib(n):
    memo = {}
    if n in memo:
        return memo[n]
    if n < 2:
        return n
    memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]`,
      options: ['Line 2: a new, empty memo is created on every call', 'Line 3: the memo should be checked after the recursive calls', 'Line 5: the base case should be n < 1', 'Line 7: the result should not be stored'],
      answer: 0,
      explain: [
        'Correct. Each call builds its own empty dictionary, so the lookup on line 3 never succeeds. The memo must be created once, outside the function or passed in.',
        'Checking afterwards would make the recursive calls first, which defeats the purpose.',
        'n < 2 is right: both fib(0) and fib(1) are base cases.',
        'Storing the result is exactly what a memo needs. The trouble is that the store is thrown away.',
      ],
    },
    {
      type: 'choice',
      q: 'Merge sort also solves a problem by making two recursive calls. Why would adding a memo not speed it up?',
      options: ['Merge sort is already as fast as any algorithm can be', 'Its two subproblems are different halves of the list, so no subproblem is ever requested twice', 'A memo cannot store lists', 'Merge sort is not recursive'],
      answer: 1,
      explain: [
        'That is not the reason. A memo helps only when answers are reused.',
        'Correct. Memoization pays off only when subproblems overlap. Each merge sort call works on its own part of the list, so every stored answer would be read zero times.',
        'A memo can store any value. The problem is that nothing would ever be looked up.',
        'Merge sort is recursive. Recursion without overlap is called divide and conquer.',
      ],
    },
    {
      type: 'challenge',
      title: 'Two variables, then three steps',
      prompt: 'First rewrite the bottom-up method so that it keeps only two numbers and no table, and check that it prints the same fib(90). Then solve a new problem with the same method: in how many ways can you climb a staircase of n stairs if each move goes up 1, 2 or 3 stairs? Write the recurrence, decide the base cases, and fill a table. For n = 10 the answer is 274.',
      hints: ['For the first part, after each step the pair (previous, current) becomes (current, previous + current).', 'For the stairs, think about the last move. It was 1, 2 or 3 stairs, so ways(n) = ways(n − 1) + ways(n − 2) + ways(n − 3), with ways(0) = 1 because there is one way to climb no stairs: do nothing.'],
    },
  ],

  compare: {
    idea: 'Compute each Fibonacci number once, store it, and reuse it for the two numbers that depend on it.',
    requires: 'A non-negative whole number n. Exact results need integers large enough to hold fib(n).',
    sensitivity: 'None. The work depends only on n and on the method chosen.',
    memory: 'n + 1 stored values for the memo or table, or two values with the rolling version.',
    difficulty: 'low',
    difficultyNote: 'A few lines in any language. The lesson is in comparing the three versions.',
    limits: 'Linear only while additions are constant time. Deep recursion in the memoized version. Overflow in fixed-size integers beyond fib(92).',
    useWhen: 'You are learning dynamic programming, or need a model for turning a slow recursive definition into a table.',
  },

  advanced: {
    history: 'The sequence is named after Leonardo of Pisa, known as Fibonacci, who posed a problem about breeding rabbits in his book *Liber Abaci* in 1202. The same numbers had been described centuries earlier by Indian scholars studying the rhythms of Sanskrit verse. The term "dynamic programming" is due to Richard Bellman, who developed the method at the RAND Corporation in the 1950s and published a book of that title in 1957. In his autobiography he explains that he picked the name partly because it would sound acceptable to officials who distrusted mathematical research. The word "memoization" was coined by Donald Michie in 1968.',
    derivation: 'Let $C(n)$ be the number of calls plain recursion makes for $\\text{fib}(n)$. A base case is one call, and any other call adds the calls of its two children:\n\n$$C(0) = C(1) = 1, \\qquad C(n) = 1 + C(n-1) + C(n-2).$$\n\nPut $D(n) = C(n) + 1$. Then $D(n) = D(n-1) + D(n-2)$ with $D(0) = D(1) = 2$, which is the Fibonacci recurrence started from $2\\,\\text{fib}(1)$ and $2\\,\\text{fib}(2)$. So $D(n) = 2\\,\\text{fib}(n+1)$ and\n\n$$C(n) = 2\\,\\text{fib}(n+1) - 1.$$\n\nFor $n = 6$ this gives $2 \\cdot 13 - 1 = 25$, the count in the worked example.',
    proof: 'Growth rate. The closed form $\\text{fib}(n) = \\dfrac{\\varphi^n - \\psi^n}{\\sqrt{5}}$, with $\\varphi = \\frac{1+\\sqrt{5}}{2} \\approx 1.618$ and $\\psi = \\frac{1-\\sqrt{5}}{2} \\approx -0.618$, can be checked by induction: both $\\varphi$ and $\\psi$ satisfy $x^2 = x + 1$, so $\\varphi^n$ and $\\psi^n$ each satisfy the Fibonacci recurrence, and the formula gives $0$ and $1$ for $n = 0$ and $n = 1$. Since $|\\psi| < 1$, the second term vanishes and $\\text{fib}(n)$ is the nearest whole number to $\\varphi^n / \\sqrt{5}$. Together with the derivation above, plain recursion makes $\\Theta(\\varphi^n)$ calls.',
    complexityProof: 'With a memo, a call either finds its key (constant work) or computes it. Each key from 2 to $n$ is computed exactly once, because after the first computation it is in the memo. Each computing call makes two child calls, so there are $n - 1$ computing calls and at most $2(n-1) + 1 = 2n - 1$ calls in total. For exact arithmetic, $\\text{fib}(k)$ has about $k \\log_2 \\varphi \\approx 0.694\\,k$ bits, so the additions cost $\\sum_{k=2}^{n} O(k) = O(n^2)$ bit operations.',
    variants: [
      { name: 'Rolling variables', text: 'Keep only the last two values. Constant extra space, and the form most programs use in practice.' },
      { name: 'Fast doubling', text: 'Uses fib(2k) = fib(k)·(2·fib(k + 1) − fib(k)) and fib(2k + 1) = fib(k)² + fib(k + 1)² to halve n at each step, for O(log n) multiplications.' },
      { name: 'Matrix powers', text: 'The matrix with rows (1, 1) and (1, 0), raised to the n-th power by repeated squaring, contains fib(n). It generalizes to any linear recurrence with constant coefficients.' },
      { name: 'Other recurrences', text: 'The same table works for Lucas numbers, the three-term "tribonacci" recurrence and counting problems such as stair climbing, by changing the base cases or the number of earlier terms read.' },
    ],
    implementation: 'Prefer the bottom-up loop in production code: it has no recursion limit and its memory use is explicit. If you memoize, create the memo once and make sure the key captures every argument the answer depends on. Choose the number type deliberately: 64-bit integers up to fib(92), arbitrary-precision integers beyond.',
    benchmarking: 'Count calls or additions when comparing the three methods: the counts are exact and independent of machine and language. When timing large n, report whether arithmetic is fixed-width or arbitrary-precision, because the two regimes scale differently.',
    references: [
      { authors: 'R. Bellman', year: 1957, title: 'Dynamic Programming', venue: 'Princeton University Press' },
      { authors: 'D. Michie', year: 1968, title: '"Memo" functions and machine learning', venue: 'Nature 218, 19-22' },
      { authors: 'P. Singh', year: 1985, title: 'The so-called Fibonacci numbers in ancient and medieval India', venue: 'Historia Mathematica 12(3), 229-244' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Dynamic Programming".',
      'R. L. Graham, D. E. Knuth and O. Patashnik, *Concrete Mathematics*, chapter 6, section on Fibonacci numbers.',
      'R. Bellman, *Eye of the Hurricane: An Autobiography* (1984), for his account of how the method got its name.',
    ],
  },

  tests: [
    { name: 'plain recursion matches the closed formula and the call-count formula', input: { n: 15, method: 'naive' },
      check: (r, c) => (r.value === binet(15) && r.value === 610 && c.calls === 2 * binet(16) - 1) || `got fib(15) = ${r.value} in ${c.calls} calls` },
    { name: 'memoized recursion matches the closed formula with 2n - 1 calls', input: { n: 24, method: 'memo' },
      check: (r, c) => (r.value === binet(24) && r.value === 46368 && c.calls === 47 && c.additions === 23) || `got ${r.value}, ${c.calls} calls, ${c.additions} additions` },
    { name: 'bottom-up table satisfies Cassini\'s identity at every position', input: { n: 24, method: 'table' },
      check: (r, c) => {
        const T = r.table;
        if (T.length !== 25 || T[24] !== binet(24) || c.additions !== 23) return `table ends at ${T[T.length - 1]} after ${c.additions} additions`;
        for (let k = 1; k < 24; k++) if (T[k - 1] * T[k + 1] - T[k] * T[k] !== (k % 2 === 0 ? 1 : -1)) return `Cassini's identity fails at ${k}`;
        return true;
      } },
    { name: 'worked example, plain recursion: 25 calls and the quoted repeat counts', input: { n: 6, method: 'naive' },
      check: (r, c) => (r.value === 8 && c.calls === 25 && r.times[4] === 2 && r.times[3] === 3 && r.times[2] === 5) || `got ${r.value}, ${c.calls} calls, times ${r.times.join(',')}` },
    { name: 'worked example, memo: 11 calls and 5 additions', input: { n: 6, method: 'memo' },
      check: (r, c) => (r.value === 8 && c.calls === 11 && c.additions === 5) || `got ${c.calls} calls, ${c.additions} additions` },
    { name: 'worked example, table: 5 additions and no calls', input: { n: 6, method: 'table' },
      check: (r, c) => (r.value === 8 && c.additions === 5 && !c.calls) || `got ${c.additions} additions` },
    { name: 'plain recursion for n = 24 makes 150,049 calls', input: { n: 24, method: 'naive' },
      check: (r, c) => (r.value === 46368 && c.calls === 150049) || `got ${c.calls} calls` },
    { name: 'quiz: memo for n = 10 makes 19 calls; plain recursion would make 177', input: { n: 10, method: 'memo' },
      check: (r, c) => (r.value === 55 && c.calls === 19 && naiveCalls(10) === 177) || `got ${c.calls} calls` },
    { name: 'tryThis numbers: 9, 15, 25 calls and fib(1) requested 6,765 times for n = 20', input: { n: 20, method: 'naive' },
      check: (r, c) => (naiveCalls(4) === 9 && naiveCalls(5) === 15 && naiveCalls(6) === 25 && r.times[1] === 6765 && c.calls === 21891 && naiveCalls(30) === 2692537) || `fib(1) was requested ${r.times[1]} times` },
    { name: 'base cases n = 0 and n = 1', input: { n: 0, method: 'table' },
      check: (r, c) => (r.value === 0 && !c.additions) || `fib(0) gave ${r.value}` },
    { name: 'n = 1 with a memo is a single lookup', input: { n: 1, method: 'memo' },
      check: (r, c) => (r.value === 1 && c.calls === 1 && !c.additions) || `fib(1) gave ${r.value} in ${c.calls} calls` },
  ],
};
