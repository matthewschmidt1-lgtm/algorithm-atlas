import { makeRng } from '../../js/lib/rng.js';

const PATTERNS = [
  { value: 'random', label: 'Random unions and finds' },
  { value: 'chain', label: 'Join neighbours in a line, then find 0 twice' },
  { value: 'chain-sweep', label: 'Join neighbours in a line, then find every element' },
];

// "0-1, 2-3, ?0" means union(0, 1), union(2, 3), find(0).
function parseOps(text, n) {
  const parts = String(text).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 40) throw new Error('At most 40 operations, please.');
  const ops = [];
  const check = (x) => {
    if (x >= n) throw new Error(`Element ${x} does not exist. With ${n} elements they are numbered 0 to ${n - 1}.`);
    return x;
  };
  for (const p of parts) {
    let m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { ops.push({ type: 'union', a: check(Number(m[1])), b: check(Number(m[2])) }); continue; }
    m = p.match(/^\?\s*(\d+)$/);
    if (m) { ops.push({ type: 'find', a: check(Number(m[1])) }); continue; }
    throw new Error(`Could not read "${p}". Write 2-5 to join the sets of 2 and 5, or ?3 to find the root of 3.`);
  }
  return ops;
}

function makeOps(input, n) {
  const ops = [];
  if (input.pattern === 'chain' || input.pattern === 'chain-sweep') {
    for (let i = 0; i + 1 < n; i++) ops.push({ type: 'union', a: i, b: i + 1 });
    if (input.pattern === 'chain') ops.push({ type: 'find', a: 0 }, { type: 'find', a: 0 });
    else for (let i = 0; i < n; i++) ops.push({ type: 'find', a: i }); // the experiment's workload
    return ops;
  }
  const rng = makeRng((input.seed || 1) * 131 + n);
  const count = Math.max(1, Math.floor(input.operations));
  for (let k = 0; k < count; k++) {
    if (rng.next() < 0.75) {
      const a = rng.int(0, n - 1);
      let b = rng.int(0, n - 2);
      if (b >= a) b++;
      ops.push({ type: 'union', a, b });
    } else ops.push({ type: 'find', a: rng.int(0, n - 1) });
  }
  return ops;
}

// Positions for the forest. Every element gets its own column (children split left and right
// of their parent), and its row is its depth, so even a tall chain is drawn as a clear diagonal.
function layoutForest(parent) {
  const n = parent.length;
  const kids = Array.from({ length: n }, () => []);
  const roots = [];
  for (let i = 0; i < n; i++) (parent[i] === i ? roots : kids[parent[i]]).push(i);
  const col = new Array(n).fill(0), depth = new Array(n).fill(0);
  let next = 0, maxDepth = 0;
  const place = (v, d) => {
    depth[v] = d;
    maxDepth = Math.max(maxDepth, d);
    const half = Math.ceil(kids[v].length / 2);
    for (let i = 0; i < half; i++) place(kids[v][i], d + 1);
    col[v] = next++;
    for (let i = half; i < kids[v].length; i++) place(kids[v][i], d + 1);
  };
  roots.forEach((r) => place(r, 0));
  return Array.from({ length: n }, (_, i) => ({
    x: n === 1 ? 0.5 : 0.03 + 0.94 * (col[i] / (n - 1)),
    y: 0.1 + 0.8 * (depth[i] / Math.max(maxDepth, 2)),
  }));
}

function treeHeight(parent) {
  const n = parent.length;
  const depth = new Array(n).fill(-1);
  let best = 0;
  for (let i = 0; i < n; i++) {
    const stack = [];
    let x = i;
    while (depth[x] < 0 && parent[x] !== x) { stack.push(x); x = parent[x]; }
    let d = parent[x] === x ? 0 : depth[x];
    if (parent[x] === x) depth[x] = 0;
    while (stack.length) { d += 1; depth[stack.pop()] = d; }
    if (depth[i] > best) best = depth[i];
  }
  return best;
}

const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
const listOf = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

function run(input, t) {
  const n = Math.max(2, Math.floor(input.elements));
  const byRank = !!input.byRank, compress = !!input.compress;
  const usingOps = typeof input.ops === 'string' && input.ops.trim().length > 0;
  const ops = usingOps ? parseOps(input.ops, n) : makeOps(input, n);
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = new Array(n).fill(0);
  const log = [];
  const legend = [{ label: 'root: names its set', role: 'special' }, { label: 'named in this operation', role: 'frontier' }, { label: 'current step', role: 'current' }, { label: 'root found', role: 'path' }];

  // roles: element -> node role; edges: child -> role of its parent arrow; changed: parent entries just rewritten.
  const views = ({ roles = {}, edges = {}, changed = [] } = {}) => {
    const pos = layoutForest(parent);
    const forest = {
      kind: 'graph', title: 'The forest: each arrow points from an element to its parent', directed: true, aspect: 0.36, legend,
      nodes: parent.map((p, i) => ({ id: i, x: pos[i].x, y: pos[i].y, label: String(i), role: roles[i] || (p === i ? 'special' : 'default'), sub: byRank && p === i ? `rank ${rank[i]}` : undefined })),
      edges: parent.map((p, i) => (p === i ? null : { u: i, v: p, role: edges[i] || 'default' })).filter(Boolean),
    };
    const rows = [
      { label: 'Element', cells: parent.map((_, i) => ({ t: i, role: roles[i] && roles[i] !== 'special' ? roles[i] : undefined })) },
      { label: 'Parent', cells: parent.map((p, i) => ({ t: p, role: changed.includes(i) ? 'active' : p === i ? 'special' : undefined })) },
    ];
    if (byRank) rows.push({ label: 'Rank', cells: parent.map((p, i) => ({ t: p === i ? rank[i] : '·', role: p === i ? undefined : 'dim' })) });
    return [forest, { kind: 'rows', title: 'The same forest stored as an array', rows }];
  };

  // Follow parents from x to its root, recording a frame per step. `keep` holds roles to keep lit.
  const find = (x, keep) => {
    const path = [x];
    let root = x;
    if (parent[root] === root) {
      t.frame(() => ({ line: [1, 2, 8], note: `${x} is its own parent, so it is already the root of its set. No steps needed.`, views: views({ roles: { ...keep, [x]: 'path' } }), vars: { x, root, steps: 0 } }));
    }
    while (parent[root] !== root) {
      const from = root;
      root = parent[root];
      t.count('parent steps');
      path.push(root);
      t.frame(() => {
        const steps = path.length - 1;
        const atRoot = parent[root] === root;
        const roles = { ...keep };
        const edges = {};
        for (let k = 0; k < path.length; k++) {
          roles[path[k]] = 'frontier';
          if (k < path.length - 1) edges[path[k]] = 'active';
        }
        roles[root] = atRoot ? 'path' : 'current';
        return { line: atRoot ? [2, 3, 8] : [2, 3],
          note: atRoot
            ? `${from} is not a root, so step up to its parent, ${root}. ${root} is its own parent, which makes it the root of the set that contains ${x}. That took ${plural(steps, 'step')}.`
            : `${from} is not a root, so step up to its parent, ${root}.`,
          views: views({ roles, edges }), vars: { x, at: root, steps } };
      });
    }
    const steps = path.length - 1;
    if (compress) {
      const moved = [];
      let y = x;
      while (parent[y] !== root) {
        const next = parent[y];
        parent[y] = root;
        moved.push(y);
        y = next;
      }
      if (moved.length) {
        const edges = {};
        for (const m of moved) edges[m] = 'tree';
        t.frame(() => ({ line: [4, 5, 6, 7], note: `Path compression: ${listOf(moved)} ${moved.length === 1 ? 'was' : 'were'} more than one step from the root, so ${moved.length === 1 ? 'it now points' : 'they now point'} straight at ${root}. The next find from there will take a single step.`,
          views: views({ roles: { ...keep, [root]: 'path' }, edges, changed: moved }), vars: { x, root, 'pointers rewritten': moved.length } }));
      }
    }
    return { root, steps };
  };

  t.frame(() => ({ line: null, note: `There are ${n} elements, numbered 0 to ${n - 1}. Each starts alone in its own set, so each one is its own parent. An element that is its own parent is called a **root**, and the root is the name of its set.`, views: views(), vars: { sets: n } }));

  let sets = n;
  for (const op of ops) {
    if (op.type === 'find') {
      const a = op.a;
      t.frame(() => ({ line: 0, note: `**find(${a})**: which set is ${a} in? Follow parent arrows from ${a} until they reach a root.`, views: views({ roles: { [a]: 'frontier' } }), vars: { operation: `find(${a})` } }));
      const r = find(a, {});
      log.push({ type: 'find', a, root: r.root, steps: r.steps });
      continue;
    }
    const { a, b } = op;
    t.frame(() => ({ line: [10, 11], note: `**union(${a}, ${b})**: join the set that contains ${a} with the set that contains ${b}. First find the root of each.`, views: views({ roles: { [a]: 'frontier', [b]: 'frontier' } }), vars: { operation: `union(${a}, ${b})` } }));
    const fa = find(a, { [b]: 'frontier' });
    const fb = find(b, { [a]: 'frontier', [fa.root]: 'path' });
    let ra = fa.root, rb = fb.root;
    if (ra === rb) {
      log.push({ type: 'union', a, b, merged: false, steps: fa.steps + fb.steps });
      t.frame(() => ({ line: 12, note: `${a} and ${b} both lead to the root ${ra}, so they are already in the same set. Nothing changes.`, views: views({ roles: { [a]: 'frontier', [b]: 'frontier', [ra]: 'path' } }), vars: { operation: `union(${a}, ${b})`, 'root of both': ra } }));
      continue;
    }
    let why, lines = [15];
    if (byRank) {
      const swapped = rank[ra] > rank[rb];
      if (swapped) { const x = ra; ra = rb; rb = x; }
      const tie = rank[ra] === rank[rb];
      lines = (swapped ? [13, 14, 15] : [13, 15]).concat(tie ? [16, 17] : [16]);
      why = tie
        ? `The roots ${ra} and ${rb} both have rank ${rank[ra]}. Either could go on top; put ${ra} under ${rb}, and raise the rank of ${rb} to ${rank[rb] + 1} because its tree may now be one level taller.`
        : `Root ${ra} has rank ${rank[ra]} and root ${rb} has rank ${rank[rb]}. The root with the smaller rank goes underneath, so ${ra} now points to ${rb}. The taller tree does not get any taller.`;
      parent[ra] = rb;
      if (tie) rank[rb] += 1;
    } else {
      why = `The roots are ${ra} and ${rb}. Union by rank is off, so the first root always goes under the second, whatever the shapes of the trees: ${ra} now points to ${rb}.`;
      parent[ra] = rb;
    }
    t.count('links');
    sets -= 1;
    log.push({ type: 'union', a, b, merged: true, steps: fa.steps + fb.steps });
    const child = ra, top = rb, left = sets;
    t.frame(() => ({ line: lines, note: `${why} ${plural(left, 'set')} ${left === 1 ? 'remains' : 'remain'}.`, views: views({ roles: { [a]: 'frontier', [b]: 'frontier', [child]: 'current', [top]: 'path' }, edges: { [child]: 'active' }, changed: [child] }), vars: { operation: `union(${a}, ${b})`, sets: left } }));
  }

  const members = new Map();
  const rootOf = (x) => { while (parent[x] !== x) x = parent[x]; return x; };
  for (let i = 0; i < n; i++) { const r = rootOf(i); if (!members.has(r)) members.set(r, []); members.get(r).push(i); }
  const groups = [...members.values()];
  const height = treeHeight(parent);
  const totalSteps = log.reduce((s, o) => s + o.steps, 0);
  t.frame(() => ({ line: null, note: `Done. ${plural(groups.length, 'set')} ${groups.length === 1 ? 'remains' : 'remain'}: ${groups.map((g) => `{${g.join(', ')}}`).join(' ')}. The tallest tree has height ${height}, and all the finds together took ${plural(totalSteps, 'step')} up the trees.`, views: views(), vars: { sets: groups.length, 'tallest tree': height } }));

  return { parent: parent.slice(), rank: rank.slice(), sets: groups.length, groups, log, height, totalSteps };
}

// Independent reference for the tests: "quick-find", which relabels a whole set on every union
// and shares no code with the forest above.
const matchesReference = (r) => {
  const n = r.parent.length;
  const label = Array.from({ length: n }, (_, i) => i);
  for (const op of r.log) {
    if (op.type === 'union') {
      const la = label[op.a], lb = label[op.b];
      if ((la !== lb) !== op.merged) return `union(${op.a}, ${op.b}) reported merged=${op.merged}, reference disagrees`;
      if (la !== lb) for (let i = 0; i < n; i++) if (label[i] === la) label[i] = lb;
    } else if (label[op.root] !== label[op.a]) return `find(${op.a}) returned ${op.root}, which the reference puts in another set`;
  }
  const root = (x) => { while (r.parent[x] !== x) x = r.parent[x]; return x; };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if ((label[i] === label[j]) !== (root(i) === root(j))) return `elements ${i} and ${j} disagree with the reference`;
  }
  return new Set(label).size === r.sets || `reported ${r.sets} sets, reference has ${new Set(label).size}`;
};

export default {
  meta: {
    id: 'union-find',
    name: 'Union-Find (Disjoint Set Union)',
    aliases: ['disjoint set union', 'DSU', 'disjoint-set forest', 'merge-find set', 'union by rank', 'path compression'],
    kind: 'data-structure',
    discipline: 'algorithms',
    alsoIn: [
      { id: 'graph-theory', why: 'Kruskal\'s minimum spanning tree algorithm and incremental connectivity questions are answered with it.' },
    ],
    subfield: 'Data structures',
    family: 'Disjoint sets',
    lab: 'data-structures',
    year: 1964,
    authors: 'Bernard A. Galler and Michael J. Fischer',
    summary: 'Tracks which items belong to the same group as groups merge. Each group is a tree named by its root; two simple rules keep the trees almost flat.',
    difficulty: 'intermediate',
    order: 180,
    paradigms: ['incremental'],
    randomized: false,
    approximate: false,
    time: { best: 'O(1)', average: 'O(α(n)) amortized per operation', worst: 'O(log n) for a single operation', class: 'logarithmic' },
    space: { worst: 'O(n)', class: 'linear' },
    tags: {
      problems: ['are these two things connected', 'group items that belong together', 'merge groups', 'count connected components', 'detect a cycle when adding edges', 'track friend circles'],
      techniques: ['parent pointers', 'union by rank', 'path compression', 'amortized analysis'],
      applications: ['networking', 'image processing', 'compilers', 'scientific computing', 'games'],
    },
    prerequisites: ['concept:array', 'concept:tree', 'concept:connectivity'],
  },

  bigIdea: {
    simple: "Union-find keeps track of which things belong to the same group while groups keep merging. Picture a school where friend circles form over time. At first every student is alone. Whenever two students become friends, their two circles join into one. At any moment you may want to ask: are these two students in the same circle? Union-find answers that quickly. Each circle has one member who acts as its captain. Every other student remembers just one person in the circle, someone a step closer to the captain. To find your captain, you ask that person, who asks theirs, and so on, until the chain reaches the captain. Two students are in the same circle exactly when they reach the same captain. To merge two circles, one captain simply starts pointing to the other. Two small habits keep these chains short, so even with millions of students each question takes only a few steps.",
    what: 'Union-find stores a collection of items split into non-overlapping groups, called disjoint sets. It supports two operations. **Find** says which set an item is in, by returning that set\'s representative. **Union** merges two sets into one. Each set is stored as a tree in which every item points to a parent, and the root of the tree is the representative.',
    why: 'Many problems come down to one question asked over and over while the answer keeps changing: are these two things connected yet? Recomputing connectivity from scratch after every change is far too slow. Union-find answers each question, and absorbs each new connection, in an amount of time that is almost constant.',
    when: 'Use it when connections are only ever added, never removed, and you need to know at any moment whether two items are in the same group or how many groups there are. If you need the actual route between two items, use a graph search such as [breadth-first search](#/algorithm/bfs). If connections can also be deleted, union-find does not apply directly and a more elaborate dynamic connectivity structure is needed.',
    interesting: 'The naive version can degrade into a long chain where a single find walks through every item. Two rules of a line or two each fix this: attach the shorter tree under the taller one, and after every find, point everything you passed straight at the root. Together they make the cost per operation grow so slowly that, for any input a real computer could ever hold, it stays below a small constant. Proving that took more than ten years after the structure was introduced.',
    where: 'It is the cycle test inside [Kruskal\'s algorithm](#/algorithm/kruskal) for minimum spanning trees. Image-processing code uses it to label connected regions of pixels, compilers use it to merge types that must be equal, and physicists use it to simulate percolation.',
    analogy: {
      title: 'Companies that keep merging',
      text: "Every employee knows one thing: who their boss is. Nobody holds a list of who works for which company. To learn which company someone belongs to, follow the chain of bosses up to the one person with no boss, the chief executive. When two companies merge, one chief executive starts reporting to the other. Nothing else changes and nobody else is told, yet every chain that ended at the old chief executive now runs on to the new one. In that single change everyone below has joined the bigger company.",
      limits: 'In a real company the chain of bosses means something. Here the links are bookkeeping and nothing else: who points to whom says nothing about the items except which group they are in. That is why the structure is free to rearrange itself, pointing everyone it passes straight at the top, which no real organisation would do. Real companies can also split up again. Union-find cannot undo a merge.',
    },
  },

  example: {
    setup: 'There are six items, numbered 0 to 5. Each starts in a set of its own and is its own parent, so each is a root. Every root also keeps a number called its rank, which starts at 0 and is a limit on how tall its tree can be. Use both rules: the root with the smaller rank goes underneath, and a find repoints what it passes.',
    steps: [
      'Join 0 and 1. Both are roots with rank 0. It is a tie, so put 0 under 1, and raise the rank of 1 to 1. Now 0 points to 1.',
      'Join 2 and 3 in the same way. Now 2 points to 3, and 3 has rank 1.',
      'Join 1 and 3. Both are roots with rank 1, a tie again. Put 1 under 3 and raise the rank of 3 to 2. The set is now 0, 1, 2, 3 with root 3: 0 points to 1, while 1 and 2 point to 3.',
      'Find 0. Step from 0 up to 1, then from 1 up to 3. Since 3 is its own parent, it is the root: 2 steps. Because 0 was two steps away, it is now repointed straight at 3.',
      'Find 0 again. It points straight at 3 now, so this takes 1 step.',
    ],
    result: 'Items 0, 1, 2 and 3 all lead to root 3, so they are in one set. Items 4 and 5 are still alone, which makes three sets in all. Notice the second find: it was cheaper than the first because the first one tidied up as it went.',
    tryInput: { elements: 6, ops: '0-1, 2-3, 1-3, ?0, ?0', byRank: true, compress: true },
  },

  terms: [
    { term: 'Set', meaning: 'A group of items. In union-find every item belongs to exactly one set.' },
    { term: 'Disjoint', meaning: 'Not overlapping. Disjoint sets share no items.' },
    { term: 'Parent', meaning: 'The one other item that an item points to. Following parents leads toward the root.' },
    { term: 'Root', meaning: 'An item that is its own parent. Each set has exactly one, and it serves as the name of the set. Also called the representative.' },
    { term: 'Find', meaning: 'The operation that follows parents from an item up to its root, which tells you which set the item is in.' },
    { term: 'Union', meaning: 'The operation that merges two sets by making one root point to the other.' },
    { term: 'Rank', meaning: 'A number kept at each root that is never smaller than the height of its tree. It decides which root goes underneath in a union.' },
    { term: 'Path compression', meaning: 'After a find, repointing every item that was passed so that it points straight at the root.' },
    { term: 'Amortized cost', meaning: 'The average cost per operation over a whole sequence. A few operations may be slow as long as the total stays small.' },
  ],

  takeaway: 'Give every group one leader, have every member point toward that leader, and merge two groups by pointing one leader at the other.',

  viz: {
    describe: 'A forest of trees drawn with arrows from each element to its parent. Roots are outlined in dark ink and, when union by rank is on, show their rank beneath. Elements named in the current operation are ochre, the element being visited is terracotta, and a root that has been found is filled forest green. Below the forest, rows show the same structure as an array: element numbers, each element\'s parent, and the rank of each root.',
    inputs: [
      { id: 'elements', type: 'range', label: 'Number of elements', min: 4, max: 12, step: 1, default: 10 },
      { id: 'operations', type: 'range', label: 'Number of operations', min: 4, max: 30, step: 1, default: 12, help: 'Used by the random sequence.' },
      { id: 'pattern', type: 'select', label: 'Sequence of operations', options: PATTERNS, default: 'random' },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 4 },
      { id: 'byRank', type: 'toggle', label: 'Union by rank', default: true, help: 'Off: the first root always goes under the second.' },
      { id: 'compress', type: 'toggle', label: 'Path compression', default: true, help: 'Off: a find leaves the tree exactly as it found it.' },
      { id: 'ops', type: 'text', label: 'Or type your own operations', default: '', maxLength: 240,
        help: 'Format: 0-1, 2-3, ?0. A pair joins two sets; a question mark finds the root of an element.' },
    ],
    presets: [
      { label: 'Both rules on', values: { pattern: 'random', byRank: true, compress: true, ops: '' } },
      { label: 'Neither rule: a tall chain', values: { pattern: 'chain', byRank: false, compress: false, ops: '' } },
      { label: 'Chain with path compression only', values: { pattern: 'chain', byRank: false, compress: true, ops: '' } },
      { label: 'Chain with union by rank only', values: { pattern: 'chain', byRank: true, compress: false, ops: '' } },
      { label: 'Random sequence, neither rule', values: { pattern: 'random', byRank: false, compress: false, ops: '' } },
    ],
    tryThis: [
      'Load "Neither rule: a tall chain". Every union puts the old root under a new one, so the tree becomes a single line, and each find from element 0 walks its whole length. Note the "parent steps" counter at the end.',
      'Now load "Chain with path compression only". The same line forms, but the first find from 0 repoints everything it passes, and the second find takes one step. Compare the counter with the previous run.',
      'Load "Chain with union by rank only". The line never forms at all: every new element is attached directly under the existing root, because a single element always has the smaller rank.',
      'Load "Random sequence, neither rule" and press Randomize a few times, reading the height of the tallest tree in the last step each time. With a dozen elements, random unions seldom build anything as tall as the chain. The bad case needs an awkward order, which sorted or structured data can easily supply.',
    ],
    run,
    report: (r, c) => `${r.sets} ${r.sets === 1 ? 'set' : 'sets'}: ${r.groups.map((g) => `{${g.join(', ')}}`).join(' ')}\nparent = [${r.parent.join(', ')}]\nTallest tree: height ${r.height}. ${c['parent steps'] || 0} parent steps over ${r.log.length} operations, ${c.links || 0} of which merged two sets.`,
    experiment: {
      title: 'Steps up the trees on a worst-case sequence',
      note: 'Each point is a real run: join n elements into a line with n − 1 unions, then call find on every element once. This order is the worst case for the version with neither rule, where the finds walk n(n − 1)/2 steps in total. With both rules the same sequence costs 2n − 4. On this particular sequence either rule alone would also be enough; the near-constant bound for every sequence needs both.',
      metric: 'parent steps',
      metricLabel: 'Parent steps (all operations)',
      sizeLabel: 'Number of elements (n)',
      sizes: [8, 16, 32, 64, 128, 256, 512, 1024],
      variants: [
        { id: 'none', label: 'Neither rule' },
        { id: 'both', label: 'Union by rank and path compression' },
      ],
      input: (n, variant) => ({ elements: n, pattern: 'chain-sweep', byRank: variant === 'both', compress: variant === 'both', ops: '' }),
      theory: [
        { label: 'n(n − 1) / 2', fn: (n) => (n * (n - 1)) / 2, variant: 'none' },
        { label: '2n − 4', fn: (n) => 2 * n - 4, variant: 'both' },
      ],
    },
  },

  logic: {
    intuition: 'A set needs a name that all its members agree on. Storing the name in every member makes merging slow, because a merge would have to rewrite the name in every member of one set. So store only a pointer toward the name. A merge then changes one pointer, at the root. The price is that finding the name means walking up a chain of pointers, and the rest of the design is about keeping those chains short.',
    steps: [
      'Start with every element as its own parent. Each element is a root, and a set of one.',
      'To **find** the set of `x`, follow parent pointers from `x` until you reach an element that is its own parent. That root is the answer.',
      'Path compression: walk the same path a second time and set the parent of every element on it to the root.',
      'To **union** the sets of `a` and `b`, find both roots. If they are the same root, the two elements are already together and nothing changes.',
      'Union by rank: otherwise compare the ranks of the two roots and make the root with the smaller rank point to the other.',
      'If the two ranks were equal, the surviving root\'s tree may have grown one level, so add 1 to its rank.',
    ],
    pseudocode: [
      'find(x):',
      '  root ← x',
      '  while parent[root] ≠ root:',
      '    root ← parent[root]',
      '  while parent[x] ≠ root:',
      '    next ← parent[x]',
      '    parent[x] ← root',
      '    x ← next',
      '  return root',
      '',
      'union(a, b):',
      '  ra ← find(a);  rb ← find(b)',
      '  if ra = rb: return',
      '  if rank[ra] > rank[rb]:',
      '    swap ra and rb',
      '  parent[ra] ← rb',
      '  if rank[ra] = rank[rb]:',
      '    rank[rb] ← rank[rb] + 1',
    ],
    decisions: [
      { title: 'Which root goes underneath?', text: 'Attaching the tree of smaller rank under the other means the combined tree is no taller than the taller of the two, unless they tie. A tree can only reach rank r by merging two trees of rank r − 1, so a tree of rank r holds at least 2^r elements, and no tree is ever taller than log₂ n. Union by size, which puts the tree with fewer elements underneath, gives the same guarantee.' },
      { title: 'How to shorten paths?', text: 'Full path compression, used here, points every element on the find path directly at the root. Path halving and path splitting do a similar job in a single pass by pointing each element at its grandparent. All three have the same amortized bound.' },
      { title: 'Why keep rank instead of true height?', text: 'Path compression can make a tree shorter, and recomputing the true height would cost more than it saves. Rank is simply never decreased. It remains an upper limit on the height, and that is all the analysis needs.' },
    ],
    invariants: [
      'Following parent pointers from any element reaches a root after finitely many steps: the pointers never form a cycle.',
      'Two elements are in the same set if and only if they have the same root.',
      'With union by rank, the rank of a non-root is strictly smaller than the rank of its parent, and a root of rank r has at least 2^r elements in its tree.',
    ],
    edgeCases: [
      'Union of two elements already in the same set: both finds return the same root and no pointer may be changed. Linking a root to itself is harmless, but adding to its rank or decreasing a set counter here is a bug.',
      'Union of an element with itself: the same case, and it must also do nothing.',
      'A find on a root: zero steps, and nothing to compress.',
      'Very deep trees in the version with neither rule: a recursive find can overflow the call stack. The loop version in this lesson cannot.',
      'Removing a connection is not supported. Once two sets are merged, the structure has no record of which union joined them.',
    ],
    correctness: 'Initially each element is a root in a set by itself, so "same root" and "same set" agree. A union changes exactly one pointer: a root `ra` is pointed at a different root `rb`. Every element that used to reach `ra` now continues on to `rb`, and nothing else changes, so the two old sets become one set with root `rb` and all other sets are untouched. No cycle can appear, because `rb` was a root of a different tree and so did not lie below `ra`. Path compression changes pointers only from an element to the root it already led to, so no element\'s root changes. By induction over the operations, two elements share a root exactly when a sequence of unions has connected them.',
    mistakes: [
      'Linking the elements instead of their roots: `parent[a] = b` moves only `a` and whatever hangs below it, and leaves the rest of its old set behind.',
      'Comparing `parent[a]` with `parent[b]` to test whether two elements are together. Only the roots, `find(a)` and `find(b)`, can be compared.',
      'Increasing the rank on every union, not only on ties. Rank then stops being a tight limit on height and the guarantee is lost.',
      'Writing a recursive find without path compression or union by rank and running it on a long chain, which overflows the stack.',
      'Using rank values of non-roots. A rank is only meaningful while its element is a root.',
    ],
  },

  code: {
    sample: {
      input: 'Eight elements, 0 to 7, and the unions (0,1), (2,3), (1,3), (4,5), (6,7), (5,7), (2,1), then find(0) and two connectivity questions.',
      expected: 'union(0, 1): merged, sets left: 7\nunion(2, 3): merged, sets left: 6\nunion(1, 3): merged, sets left: 5\nunion(4, 5): merged, sets left: 4\nunion(6, 7): merged, sets left: 3\nunion(5, 7): merged, sets left: 2\nunion(2, 1): already together\nparent: 1 3 3 3 5 7 7 7\nfind(0) = 3\nparent: 3 3 3 3 5 7 7 7\n0 and 2 connected: yes\n0 and 4 connected: no',
    },
    python: {
      source: `def find(parent, x):
    root = x
    while parent[root] != root:
        root = parent[root]
    while parent[x] != root:
        nxt = parent[x]
        parent[x] = root
        x = nxt
    return root


def union(parent, rank, a, b):
    ra, rb = find(parent, a), find(parent, b)
    if ra == rb:
        return False
    if rank[ra] > rank[rb]:
        ra, rb = rb, ra
    parent[ra] = rb
    if rank[ra] == rank[rb]:
        rank[rb] += 1
    return True


n = 8
parent = list(range(n))
rank = [0] * n
sets = n
for a, b in [(0, 1), (2, 3), (1, 3), (4, 5), (6, 7), (5, 7), (2, 1)]:
    if union(parent, rank, a, b):
        sets -= 1
        print(f"union({a}, {b}): merged, sets left: {sets}")
    else:
        print(f"union({a}, {b}): already together")
print("parent: " + " ".join(str(p) for p in parent))
print("find(0) = " + str(find(parent, 0)))
print("parent: " + " ".join(str(p) for p in parent))
for a, b in [(0, 2), (0, 4)]:
    same = find(parent, a) == find(parent, b)
    print(f"{a} and {b} connected: " + ("yes" if same else "no"))`,
      notes: [
        { line: 3, text: 'First pass: climb from `x` to the root. An element is a root when it is its own parent.' },
        { line: 5, text: 'Second pass, path compression: every element on the path is pointed straight at the root.' },
        { line: 14, text: 'Same root means same set. Returning here, before any pointer or rank is touched, is essential.' },
        { line: 16, text: 'Union by rank: make sure `ra` is the root with the smaller rank, so it is the one that goes underneath.' },
        { line: 19, text: 'Only a tie can make the tree taller, so only a tie raises the rank.' },
      ],
    },
    javascript: {
      source: `function find(parent, x) {
  let root = x;
  while (parent[root] !== root) {
    root = parent[root];
  }
  while (parent[x] !== root) {
    const next = parent[x];
    parent[x] = root;
    x = next;
  }
  return root;
}

function union(parent, rank, a, b) {
  let ra = find(parent, a);
  let rb = find(parent, b);
  if (ra === rb) return false;
  if (rank[ra] > rank[rb]) {
    [ra, rb] = [rb, ra];
  }
  parent[ra] = rb;
  if (rank[ra] === rank[rb]) {
    rank[rb] += 1;
  }
  return true;
}

const n = 8;
const parent = Array.from({ length: n }, (_, i) => i);
const rank = new Array(n).fill(0);
let sets = n;
for (const [a, b] of [[0, 1], [2, 3], [1, 3], [4, 5], [6, 7], [5, 7], [2, 1]]) {
  if (union(parent, rank, a, b)) {
    sets -= 1;
    console.log("union(" + a + ", " + b + "): merged, sets left: " + sets);
  } else {
    console.log("union(" + a + ", " + b + "): already together");
  }
}
console.log("parent: " + parent.join(" "));
console.log("find(0) = " + find(parent, 0));
console.log("parent: " + parent.join(" "));
for (const [a, b] of [[0, 2], [0, 4]]) {
  const same = find(parent, a) === find(parent, b);
  console.log(a + " and " + b + " connected: " + (same ? "yes" : "no"));
}`,
    },
    cpp: {
      source: `#include <iostream>
#include <numeric>
#include <utility>
#include <vector>

int find(std::vector<int>& parent, int x) {
    int root = x;
    while (parent[root] != root) {
        root = parent[root];
    }
    while (parent[x] != root) {
        int next = parent[x];
        parent[x] = root;
        x = next;
    }
    return root;
}

bool unite(std::vector<int>& parent, std::vector<int>& rank, int a, int b) {
    int ra = find(parent, a);
    int rb = find(parent, b);
    if (ra == rb) return false;
    if (rank[ra] > rank[rb]) std::swap(ra, rb);
    parent[ra] = rb;
    if (rank[ra] == rank[rb]) rank[rb] += 1;
    return true;
}

void print_parents(const std::vector<int>& parent) {
    std::cout << "parent:";
    for (int p : parent) std::cout << " " << p;
    std::cout << "\\n";
}

int main() {
    const int n = 8;
    std::vector<int> parent(n), rank(n, 0);
    std::iota(parent.begin(), parent.end(), 0);
    int sets = n;
    std::vector<std::pair<int, int>> pairs = {{0, 1}, {2, 3}, {1, 3}, {4, 5}, {6, 7}, {5, 7}, {2, 1}};
    for (auto [a, b] : pairs) {
        if (unite(parent, rank, a, b)) {
            sets -= 1;
            std::cout << "union(" << a << ", " << b << "): merged, sets left: " << sets << "\\n";
        } else {
            std::cout << "union(" << a << ", " << b << "): already together\\n";
        }
    }
    print_parents(parent);
    std::cout << "find(0) = " << find(parent, 0) << "\\n";
    print_parents(parent);
    std::vector<std::pair<int, int>> questions = {{0, 2}, {0, 4}};
    for (auto [a, b] : questions) {
        bool same = find(parent, a) == find(parent, b);
        std::cout << a << " and " << b << " connected: " << (same ? "yes" : "no") << "\\n";
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'A find costs one step per level it climbs, so everything depends on how tall the trees are. With neither rule a tree can be a chain of n elements. Union by rank alone keeps every tree at height log₂ n or less. Adding path compression flattens trees as they are used, and the total cost of any m operations on n elements becomes O(m α(n)), where α is the inverse Ackermann function, a function that grows so slowly that it is at most 4 for any number of elements a real computer could ever hold.',
    cases: [
      { case: 'Union by rank and path compression', time: 'O(α(n)) amortized per operation', when: 'The version in this lesson. A single operation can still take O(log n); the bound is on the average over any sequence.' },
      { case: 'Union by rank only', time: 'O(log n) per operation, worst case', when: 'Trees never exceed height ⌊log₂ n⌋, and no find changes the structure.' },
      { case: 'Path compression only', time: 'O(log n) amortized per operation', when: 'Individual finds can be long, but each long find flattens the path it walked.' },
      { case: 'Neither rule', time: 'O(n) per find, worst case', when: 'Unions in an unlucky order build a chain, as the "tall chain" preset shows.' },
    ],
    space: 'O(n): one parent entry and one rank entry per element. Ranks never exceed log₂ n, so they fit in a few bits each.',
    memory: 'Both arrays are flat and indexed by element number, so the structure is compact. A find hops between unrelated array positions, which is unfriendly to caches on huge inputs, but path compression quickly makes most hops a single one.',
    tradeoffs: 'The speed comes from supporting very little. Union-find can merge sets and say whether two elements are together. It cannot split a set, list the members of a set without extra bookkeeping, or say how two elements are connected. Structures that support deletion of connections are much more complicated and slower.',
    assumptions: [
      'Elements are numbered 0 to n − 1, so parent and rank can be plain arrays. Other kinds of keys need a map from key to number first.',
      'The O(α(n)) bound is amortized: it bounds the total cost of a sequence of operations, not each operation separately.',
      'The bound requires both rules. Union by size may replace union by rank, and path halving or splitting may replace full compression.',
      'The chart on this page counts steps from an element to its parent during finds, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Connectivity questions asked while connections are being added one at a time.',
      'Counting groups: start a counter at n and subtract one on every union that actually merges.',
      'Processing edges in a fixed order and asking "would this edge close a cycle?", as Kruskal\'s algorithm does.',
      'Very large inputs: two integer arrays and a few lines of code handle hundreds of millions of elements.',
    ],
    struggles: [
      'Removing connections or splitting sets.',
      'Reporting the actual path that connects two elements.',
      'Listing all members of a set, unless member lists are maintained separately.',
      'Hard real-time settings that need a strict limit on every single operation, since the near-constant bound is only an average.',
    ],
    pitfalls: [
      'Linking elements instead of roots.',
      'Changing ranks or counters when the two elements were already in the same set.',
      'Deep recursion in a recursive find on a tall tree.',
      'Assuming the root of a set stays the same. After a union, a set\'s representative may be a different element.',
    ],
    misunderstandings: [
      '"The parent of an element is something it is directly connected to." The parent pointers are bookkeeping. After path compression an element usually points at a root it was never joined with directly.',
      '"With both rules, every operation takes constant time." The guarantee is about the total over many operations. One find can still climb about log₂ n levels; it then leaves the path flat for the finds that follow.',
      '"Rank is the height of the tree." Rank starts as the height and is never lowered, but path compression can make the tree shorter. Rank is an upper limit on height, not the height.',
      '"Union-find tells you how two items are connected." It tells you only whether they are in the same set. The route between them is not stored.',
    ],
    constraints: [
      'Real implementations usually store set sizes at the roots, because "how big is this group?" is a common question and size works as well as rank for deciding which root goes underneath.',
      'When keys are not small integers (names, coordinates, objects), a hash table is placed in front to turn each key into an index.',
    ],
    alternatives: [
      { id: 'bfs', name: 'Breadth-First Search', when: 'The graph is fixed and you need components once, or you need the actual path between two nodes.' },
      { id: 'dfs', name: 'Depth-First Search', when: 'The graph is fixed and you want all connected components in one linear-time pass.' },
      { name: 'Quick-find (label array)', when: 'There are very few unions and a great many finds: each find is a single array read, but each union rewrites up to n labels.' },
      { name: 'Dynamic connectivity structures', when: 'Connections must be deleted as well as added.' },
    ],
    comparison: {
      columns: ['', 'Union-find (both rules)', 'Quick-find label array', 'Re-run a graph search'],
      rows: [
        ['Are a and b together?', 'O(α(n)) amortized', 'O(1)', 'O(V + E) per question'],
        ['Add a connection', 'O(α(n)) amortized', 'O(n)', 'O(1), but answers must be recomputed'],
        ['Remove a connection', 'Not supported', 'Not supported', 'Supported'],
        ['Gives the path between a and b', 'No', 'No', 'Yes'],
        ['Memory', 'Two arrays of n', 'One array of n', 'The whole graph'],
      ],
    },
  },

  applications: [
    { title: 'Minimum spanning trees with Kruskal\'s algorithm', status: 'established', text: 'Kruskal\'s algorithm considers edges from cheapest to most expensive and keeps an edge only if its two ends are in different sets, then unions them. Union-find is what makes that cycle test fast enough for the sort to dominate the running time.' },
    { title: 'Labelling connected regions in images', status: 'established', text: 'The classic two-pass method scans the pixels once, gives provisional labels, and records in a union-find structure whenever two labels turn out to belong to the same region. A second pass replaces each label by its root.' },
    { title: 'Type inference by unification', status: 'established', text: 'When a compiler infers types, it repeatedly learns that two type variables must be equal. Implementations commonly keep type variables in a union-find structure, so "these are the same type" is a union and "what is this type?" is a find.' },
    { title: 'Percolation simulations', status: 'established', text: 'Physicists open sites of a grid at random and ask when a connected cluster first spans it. Union-find merges clusters as sites open, which is far faster than re-examining the whole grid after each change.' },
    { title: 'Generating mazes', status: 'illustrative', text: 'Start with every cell walled off, visit the walls in random order, and knock a wall down only if the cells on its two sides are in different sets. The result is a maze with exactly one route between any two cells.' },
  ],

  connections: [
    { to: 'kruskal', type: 'application', why: 'Kruskal\'s algorithm adds an edge only when its endpoints have different roots, then unions them. The correctness of the spanning tree rests on union-find\'s "same root means same component" invariant.' },
    { to: 'bfs', type: 'same-problem', why: 'Both can answer whether two nodes are connected. A search explores a fixed graph from scratch; union-find keeps the answer up to date as edges arrive.' },
    { to: 'dfs', type: 'same-problem', why: 'Depth-first search finds all connected components of a fixed graph in one pass. Union-find maintains the same partition incrementally.' },
    { to: 'hash-table', type: 'related', why: 'Both are array-based structures whose speed is stated on average, not per operation, and a hash table is the usual way to turn arbitrary keys into the integer indexes union-find needs.' },
    { to: 'concept:tree', type: 'prerequisite', why: 'Each set is a rooted tree stored only through parent pointers, and the cost of a find is the depth of the element in its tree.' },
    { to: 'concept:connectivity', type: 'prerequisite', why: 'The sets it maintains are exactly the connected components of the graph formed by the unions so far.' },
    { to: 'concept:amortized-analysis', type: 'advanced', why: 'Its headline bound is amortized: an expensive find pays for itself by flattening the path, which makes later operations cheaper.' },
    { to: 'concept:invariant', type: 'related', why: 'Everything follows from one invariant kept by every operation: two elements are in the same set exactly when they have the same root.' },
    { to: 'concept:spanning-tree', type: 'application', why: 'The unions that actually merge two sets form a spanning forest of the connections seen so far.' },
    { to: 'discipline:graph-theory', type: 'application', why: 'Incremental connectivity, cycle detection and minimum spanning trees all reduce to merging components and comparing their representatives.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'How do you test whether elements `a` and `b` are in the same set?',
      options: [
        'Check whether `parent[a]` equals `parent[b]`',
        'Check whether `find(a)` equals `find(b)`',
        'Check whether `a` equals `parent[b]` or `b` equals `parent[a]`',
        'Check whether `rank[a]` equals `rank[b]`',
      ],
      answer: 1,
      explain: [
        'Two elements of the same set can have different parents, for example a root and one of its children.',
        'Correct. Each set has exactly one root, so two elements are together exactly when following their parents leads to the same root.',
        'That only detects elements that point directly at each other, which is a small part of a set.',
        'Ranks say something about tree height. Roots of two unrelated sets often have equal ranks.',
      ],
    },
    {
      type: 'predict',
      q: 'Both rules are switched off and 8 elements are joined in a line: union(0, 1), union(1, 2), and so on up to union(6, 7). Each union puts the first root under the second. How many steps does find(0) then take to reach the root?',
      options: ['1', '3', '7', '8'],
      answer: 2,
      explain: [
        'One step is what you would get with union by rank, where every element hangs directly under one root.',
        '3 is log₂ 8, the limit that union by rank guarantees. With the rules off there is no such limit.',
        'Correct. Each union put the previous root under a new one, so the tree is a chain 0, 1, 2, up to 7, and element 0 is 7 steps from the root.',
        'There are 8 elements but only 7 arrows between them.',
      ],
      tryInput: { elements: 8, pattern: 'chain', byRank: false, compress: false, ops: '' },
    },
    {
      type: 'debug',
      q: 'After some unions with this code, elements that were in the same set are reported as separate. What is wrong?',
      code: `def union(parent, a, b):
    ra = find(parent, a)
    rb = find(parent, b)
    if ra != rb:
        parent[a] = rb`,
      options: [
        'Line 4: the test should be `ra == rb`',
        'Line 5: it must link the root, `parent[ra] = rb`, not the element `a`',
        'Line 2: `find` should not be called inside `union`',
        'Line 5: it should be `parent[rb] = a`',
      ],
      answer: 1,
      explain: [
        'If the roots are equal the elements are already together and nothing should happen. The test is right.',
        'Correct. Repointing `a` moves only `a` and the elements below it. The old root `ra` and everything else in that set are left behind as a separate set.',
        'Union must work on roots, and find is how it gets them.',
        'Pointing a root at a non-root element still merges the sets, though it makes the tree taller than necessary. It is not what causes sets to break apart here.',
      ],
    },
    {
      type: 'choice',
      q: 'Why does union by rank put the root with the smaller rank underneath?',
      options: [
        'So the combined tree is no taller than the taller of the two, unless they tie',
        'Because the root with the smaller rank has the smaller element number',
        'So that find never needs path compression',
        'Because the larger tree must always keep its original root for correctness',
      ],
      answer: 0,
      explain: [
        'Correct. Hanging the shorter tree under the taller root adds one level only to the shorter tree. The height grows only on a tie, which is why a tree of rank r must contain at least 2^r elements.',
        'Rank has nothing to do with element numbers.',
        'Union by rank limits height to log₂ n. Path compression is still what brings the cost down to nearly constant.',
        'Either root would give a correct structure. The choice affects speed only.',
      ],
    },
    {
      type: 'choice',
      q: 'With union by rank and path compression, what does the O(α(n)) bound promise?',
      options: [
        'Every single find finishes in at most 4 steps',
        'The total cost of any sequence of m operations is O(m α(n)), although one operation may cost more',
        'Trees never have height greater than 4',
        'The structure uses O(α(n)) memory',
      ],
      answer: 1,
      explain: [
        'A single find can climb up to about log₂ n levels. The bound is on the average, not on each operation.',
        'Correct. It is an amortized bound: slow operations are rare and each one flattens the tree for those that follow.',
        'Height is limited by log₂ n, not by 4. Compression makes most paths short without limiting the height directly.',
        'Memory is O(n): one parent and one rank per element.',
      ],
    },
    {
      type: 'challenge',
      title: 'Friend circles and their sizes',
      prompt: 'You are given n people and a list of friendships, each a pair of people. Report how many separate friend circles there are and the size of the largest one. Replace rank with a `size` array: a root\'s entry holds the number of people in its set, a union puts the smaller set under the larger one and adds the sizes, and a counter of circles drops by one on every union that really merges. Then add a function that answers "how many people are in the same circle as person x?".',
      hints: [
        'Initialize every size to 1 and the circle counter to n.',
        'Only a root\'s size is meaningful. Always go through `find` before reading it.',
        'Remember to do nothing at all when both people already have the same root.',
      ],
    },
  ],

  compare: {
    idea: 'Store each set as a tree of parent pointers and name the set by its root.',
    requires: 'Items numbered in advance, and connections that are only ever added, never removed.',
    sensitivity: 'Without the two rules, very sensitive to the order of unions. With both, almost none.',
    memory: 'O(n): a parent array and a rank array.',
    difficulty: 'low',
    difficultyNote: 'About twenty lines. The analysis of why it is so fast is among the hardest in the standard curriculum.',
    limits: 'It cannot split a group, remove a connection or tell you the route between two things. Its speed is an average over many operations, not a promise for each one.',
    useWhen: 'Groups only ever merge, and you need to know at any moment whether two things are in the same group.',
  },

  advanced: {
    history: 'Bernard Galler and Michael Fischer introduced the forest of parent pointers in 1964, in a paper on handling equivalence declarations in programming languages. Path compression came into use soon after. In 1973 Hopcroft and Ullman proved that weighted union with path compression takes O(m log* n) time, where log* is the iterated logarithm. Robert Tarjan\'s 1975 paper tightened this to O(m α(n)) and showed, with a matching lower bound for the algorithm, that the bound could not be improved to linear, which explains its title, "Efficiency of a good but not linear set union algorithm". In 1989 Fredman and Saks proved that no data structure for the problem can do better in the cell-probe model of computation, so the inverse Ackermann factor is inherent to the problem, not to this particular method. These analyses were stated for union by size; union by rank obeys the same bounds.',
    derivation: 'Why union by rank alone gives logarithmic height. Claim: a root of rank $r$ has at least $2^r$ elements in its tree. It holds at the start, when every tree has rank 0 and one element. A root\'s rank changes only when two roots of equal rank $r$ are linked, and the survivor then has rank $r+1$ and at least $2^r + 2^r = 2^{r+1}$ elements. When ranks differ, the survivor keeps its rank and only gains elements. Since no tree has more than $n$ elements, every rank satisfies\n\n$$2^r \\le n \\quad\\Longrightarrow\\quad r \\le \\lfloor \\log_2 n \\rfloor.$$\n\nWithout path compression the rank of a root equals the height of its tree, so every find takes at most $\\lfloor \\log_2 n \\rfloor$ steps. With path compression, rank is still an upper bound on height, so the same limit holds for any single find.',
    proof: 'A sketch of why compression helps so much, following the $O(m \\log^* n)$ argument. Two facts about ranks survive path compression: ranks strictly increase along every path toward the root, and at most $n/2^r$ elements ever have rank $r$. Group the possible ranks into blocks $\\{0\\}, \\{1\\}, \\{2\\}, \\{3,4\\}, \\{5,\\dots,16\\}, \\{17,\\dots,65536\\}, \\dots$, where each block ends at 2 raised to the end of the previous one. There are only $\\log^* n$ blocks. During a find, charge each step from $x$ to its parent as follows: if the parent is the root, or the parent\'s rank is in a higher block than the rank of $x$, charge the find itself, which happens at most $\\log^* n + 1$ times per find. Otherwise charge the element $x$. Each time $x$ is charged, compression gives it a new parent of strictly higher rank, so $x$ can be charged at most as many times as its block is wide before its parent\'s rank leaves the block for good. Summing the block widths against the bound $n/2^r$ on the number of elements of each rank gives $O(n)$ charges to elements per block, hence $O(n \\log^* n)$ in all, and a total of $O((m + n) \\log^* n)$. Tarjan\'s proof refines the blocks using the Ackermann function to reach $O(m\\,\\alpha(n))$.',
    complexityProof: 'The inverse Ackermann function $\\alpha(n)$ is the smallest $k$ for which a fast-growing function $A_k$ applied to 1 reaches at least $n$. The functions $A_k$ are built by repeated iteration, each one iterating the one before, so $A_4(1)$ is already far larger than the number of atoms in the observable universe, and $\\alpha(n) \\le 4$ for every $n$ of practical interest. Tarjan (1975) proved that $m \\ge n$ finds and $n - 1$ unions take $\\Theta(m\\,\\alpha(m, n))$ time in the worst case for the algorithm, and Fredman and Saks (1989) proved an $\\Omega(\\alpha(m, n))$ amortized lower bound per operation for any data structure in the cell-probe model.',
    variants: [
      { name: 'Union by size', text: 'Put the root with fewer elements underneath and keep element counts at the roots. Same guarantees as union by rank, and the sizes are useful in their own right.' },
      { name: 'Path halving and path splitting', text: 'One-pass alternatives to full compression: on the way up, point each element (or every other element) at its grandparent. Same amortized bound, no second pass.' },
      { name: 'Quick-find', text: 'Store the set label directly in every element. Find is one array read; union relabels a whole set in O(n).' },
      { name: 'Weighted union-find', text: 'Store on each pointer an offset relative to the parent, such as a difference in potential or a parity. Finds combine offsets along the path, which lets the structure answer questions like "how far apart are a and b?" within a set.' },
      { name: 'Union-find with rollback', text: 'Drop path compression, keep union by rank, and record each change on a stack so the most recent unions can be undone. Used in offline algorithms that explore and backtrack.' },
    ],
    implementation: 'Use flat integer arrays. Write find as a loop, or use path halving, to avoid deep recursion. Return a boolean from union so callers can count components or detect cycles. If you need set sizes, use union by size and drop the rank array. A common compact trick stores the negative size in the parent slot of each root, so one array serves both purposes.',
    benchmarking: 'Step counts depend strongly on the order of operations, so report the workload along with the numbers: random sequences usually produce much shallower trees than sorted or adversarial ones, even without the rules. With both rules on, differences between rank and size, or between full compression and halving, are small and machine-dependent.',
    references: [
      { authors: 'B. A. Galler and M. J. Fischer', year: 1964, title: 'An improved equivalence algorithm', venue: 'Communications of the ACM 7(5), 301-303' },
      { authors: 'J. E. Hopcroft and J. D. Ullman', year: 1973, title: 'Set merging algorithms', venue: 'SIAM Journal on Computing 2(4), 294-303' },
      { authors: 'R. E. Tarjan', year: 1975, title: 'Efficiency of a good but not linear set union algorithm', venue: 'Journal of the ACM 22(2), 215-225' },
      { authors: 'R. E. Tarjan and J. van Leeuwen', year: 1984, title: 'Worst-case analysis of set union algorithms', venue: 'Journal of the ACM 31(2), 245-281' },
      { authors: 'M. L. Fredman and M. E. Saks', year: 1989, title: 'The cell probe complexity of dynamic data structures', venue: 'Proceedings of the 21st Annual ACM Symposium on Theory of Computing (STOC)' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Data Structures for Disjoint Sets", gives a full proof of the inverse Ackermann bound.',
      'R. Sedgewick and K. Wayne, *Algorithms* (4th edition), section 1.5, develops quick-find, quick-union and the weighted versions step by step.',
    ],
  },

  tests: [
    { name: 'matches an independent quick-find reference with both rules', input: { elements: 12, operations: 30, seed: 21, pattern: 'random', byRank: true, compress: true, ops: '' }, check: matchesReference },
    { name: 'matches the reference with neither rule', input: { elements: 12, operations: 30, seed: 8, pattern: 'random', byRank: false, compress: false, ops: '' }, check: matchesReference },
    { name: 'matches the reference with path compression only', input: { elements: 11, operations: 28, seed: 5, pattern: 'random', byRank: false, compress: true, ops: '' }, check: matchesReference },
    { name: 'union by rank alone keeps height within log2 n', input: { elements: 12, operations: 30, seed: 13, pattern: 'random', byRank: true, compress: false, ops: '' },
      check: (r) => (matchesReference(r) === true && r.height <= Math.floor(Math.log2(12))) || `height ${r.height}` },
    { name: 'the worked example: finds of 0 take 2 steps and then 1', input: { elements: 6, ops: '0-1, 2-3, 1-3, ?0, ?0', byRank: true, compress: true },
      check: (r, c) => (r.parent.join(',') === '3,3,3,3,4,5' && r.rank[3] === 2 && r.log[3].steps === 2 && r.log[4].steps === 1 && r.sets === 3 && c['parent steps'] === 3) || `parent ${r.parent.join(',')}, steps ${r.log[3].steps} then ${r.log[4].steps}` },
    { name: 'the predict question: a naive chain of 8 puts element 0 seven steps from the root', input: { elements: 8, pattern: 'chain', byRank: false, compress: false, ops: '' },
      check: (r, c) => (r.height === 7 && r.log[7].steps === 7 && r.log[8].steps === 7 && c['parent steps'] === 14) || `height ${r.height}, steps ${r.log[7].steps}` },
    { name: 'path compression alone: second find on the chain takes one step', input: { elements: 8, pattern: 'chain', byRank: false, compress: true, ops: '' },
      check: (r, c) => (r.log[7].steps === 7 && r.log[8].steps === 1 && r.height === 1 && c['parent steps'] === 8) || `steps ${r.log[7].steps} then ${r.log[8].steps}, height ${r.height}` },
    { name: 'union by rank alone turns the chain into a star', input: { elements: 8, pattern: 'chain', byRank: true, compress: false, ops: '' },
      check: (r) => (r.height === 1 && r.sets === 1 && r.log[7].steps === 1) || `height ${r.height}` },
    { name: 'experiment formulas: n(n-1)/2 with neither rule', input: { elements: 12, pattern: 'chain-sweep', byRank: false, compress: false, ops: '' },
      check: (r, c) => c['parent steps'] === 66 || `got ${c['parent steps']}` },
    { name: 'experiment formulas: 2n-4 with both rules', input: { elements: 12, pattern: 'chain-sweep', byRank: true, compress: true, ops: '' },
      check: (r, c) => c['parent steps'] === 20 || `got ${c['parent steps']}` },
    { name: 'a union of two elements already together changes nothing', input: { elements: 4, ops: '0-1, 1-0, 0-0, ?1', byRank: true, compress: true },
      check: (r, c) => (r.sets === 3 && c.links === 1 && r.rank[1] === 1 && r.log[1].merged === false && r.log[2].merged === false) || `sets ${r.sets}, links ${c.links}` },
  ],
};
