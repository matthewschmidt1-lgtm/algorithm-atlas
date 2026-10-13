import { graphInputs, resolveGraph } from '../../js/lib/graphs.js';
import { makeRng } from '../../js/lib/rng.js';

// The fixed weights. Every node holds two numbers, so each map is 2 by 2: row i says how the
// two incoming numbers enter outgoing number i. They were chosen by hand for the example.
const WEIGHTS = {
  compete: { self: [[0.5, 0], [0, 0.5]], nb: [[0.5, -0.5], [-0.5, 0.5]] },
  average: { self: [[0.5, 0], [0, 0.5]], nb: [[0.5, 0], [0, 0.5]] },
  neighbours: { self: [[0, 0], [0, 0]], nb: [[1, 0], [0, 1]] },
};
const DEFAULT_EDGES = 'A-B, A-C, B-C, C-D, D-E, D-F, E-F';
const DEFAULTS = { nodes: 6, density: 0.3, seed: 3, edges: DEFAULT_EDGES, features: 'one', weights: 'compete', combine: 'mean', rounds: 3 };

const f4 = (x) => (Math.abs(x) < 5e-5 ? '0' : String(Number(x.toFixed(4))).replace('-', '−'));
const f2 = (x) => (Math.abs(x) < 5e-3 ? '0' : String(Number(x.toFixed(2))).replace('-', '−'));
const pair = (v, f = f4) => `(${f(v[0])}, ${f(v[1])})`;
const names = (list) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
const WHICH = ['first', 'second'];

// "new first = ReLU(0.5 × own first + 0.5 × mean first − 0.5 × mean second)"
function formula(W, i, combine) {
  const parts = [[W.self[i][0], 'own first'], [W.self[i][1], 'own second'], [W.nb[i][0], `${combine} first`], [W.nb[i][1], `${combine} second`]].filter(([w]) => w !== 0);
  const text = parts.map(([w, name], k) => `${k === 0 ? (w < 0 ? '−' : '') : w < 0 ? ' − ' : ' + '}${Math.abs(w) === 1 ? '' : `${Math.abs(w)} × `}${name}`).join('');
  return `new ${WHICH[i]} = ReLU(${text || '0'})`;
}
// The same line with the actual numbers: "0.5 × 0 + 0.5 × 0.3333 − 0.5 × 0"
function arithmetic(W, i, own, m) {
  const parts = [[W.self[i][0], own[0]], [W.self[i][1], own[1]], [W.nb[i][0], m[0]], [W.nb[i][1], m[1]]].filter(([w]) => w !== 0);
  return parts.map(([w, x], k) => `${k === 0 ? (w < 0 ? '−' : '') : w < 0 ? ' − ' : ' + '}${Math.abs(w)} × ${f4(x)}`).join('') || '0';
}

function startFeatures(kind, ids, seed) {
  const rng = makeRng(seed * 7919 + 31);
  return ids.map((id, i) => {
    if (kind === 'same') return [1, 1];
    if (kind === 'random') return [rng.int(0, 2) / 2, rng.int(0, 2) / 2];
    if (i === 0) return [1, 0];
    if (kind === 'two' && i === ids.length - 1) return [0, 1];
    return [0, 0];
  });
}

// Positions for the picture: one column for each number of steps from the first node.
function layout(ids, nbrs, dist) {
  const reachable = ids.filter((id) => Number.isFinite(dist.get(id)));
  const far = Math.max(...reachable.map((id) => dist.get(id)));
  const cols = far + 1 + (reachable.length < ids.length ? 1 : 0);
  const layers = Array.from({ length: cols }, () => []);
  for (const id of ids) layers[Number.isFinite(dist.get(id)) ? dist.get(id) : far + 1].push(id);
  const pos = new Map();
  layers.forEach((layer, d) => {
    if (d > 0 && d <= far) {
      // put each node near the height of the neighbours it has in the column to its left
      const height = (id) => { const ys = nbrs.get(id).filter((u) => pos.has(u) && dist.get(u) === d - 1).map((u) => pos.get(u).y); return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0.5; };
      const h = new Map(layer.map((id) => [id, height(id)]));
      layer.sort((a, b) => h.get(a) - h.get(b) || ids.indexOf(a) - ids.indexOf(b));
    }
    layer.forEach((id, i) => pos.set(id, {
      x: (cols === 1 ? 0.5 : 0.06 + 0.88 * (d / (cols - 1))) + (layer.length > 2 ? (i % 2 ? 0.025 : -0.025) : 0),
      y: (i + 0.5) / layer.length,
    }));
  });
  return { pos, cols, tallest: Math.max(...layers.map((layer) => layer.length)) };
}

function run(input, t) {
  const graph = resolveGraph(input, { directed: false, weighted: false });
  if (graph.directed) throw new Error('This demonstration passes messages both ways along every edge. Write each edge with a dash, as in A-B.');
  const ids = graph.nodes.map((nd) => nd.id);
  const rounds = Math.max(1, Math.round(input.rounds));
  const W = WEIGHTS[input.weights] || WEIGHTS.compete;
  const combine = input.combine === 'sum' ? 'sum' : 'mean';
  const rank = new Map(ids.map((id, i) => [id, i]));
  const sets = new Map(ids.map((id) => [id, new Set()]));
  for (const e of graph.edges) { sets.get(e.u).add(e.v); sets.get(e.v).add(e.u); }
  const nbrs = new Map(ids.map((id) => [id, [...sets.get(id)].sort((a, b) => rank.get(a) - rank.get(b))]));
  const first = input.featureMap ? ids.map((id) => input.featureMap[id].slice()) : startFeatures(input.features, ids, input.seed);
  const source = ids[0];

  // Steps from the first node to every other, by breadth-first search. Used for the picture
  // and the commentary. The computation below never looks at it.
  const dist = new Map(ids.map((id) => [id, Infinity]));
  dist.set(source, 0);
  for (let queue = [source], i = 0; i < queue.length; i++) {
    for (const u of nbrs.get(queue[i])) if (dist.get(u) === Infinity) { dist.set(u, dist.get(queue[i]) + 1); queue.push(u); }
  }

  let h = new Map(ids.map((id, i) => [id, first[i]]));
  const history = [Object.fromEntries(h)];
  let placed = null;
  const legend = [{ label: 'node being updated', role: 'current' }, { label: 'neighbours being read', role: 'compare' }, { label: `the numbers ${source} started with can have reached here`, role: 'done' }];
  const tableLegend = [{ label: 'value being worked out', role: 'current' }, { label: 'values being read', role: 'compare' }, { label: 'its own last value', role: 'special' }, { label: `can depend on what ${source} started with`, role: 'done' }];
  const ruleTitle = `${formula(W, 0, combine)};  ${formula(W, 1, combine)}`;

  // done: rounds finished. node: the one being updated. reading: true while it gathers. next: values set aside this round.
  const views = ({ done, node = null, reading = false, next = null }) => {
    if (!placed) placed = layout(ids, nbrs, dist);
    const fmt = placed.cols > 5 || ids.length > 9 ? f2 : f4;
    const around = node !== null ? new Set(nbrs.get(node)) : new Set();
    const g = {
      kind: 'graph', directed: false, aspect: Math.min(0.58, 0.26 + 0.05 * placed.tallest),
      title: `Nodes in columns by their number of steps from ${source}. Under each node: its two numbers after ${done === 0 ? 'the start' : `round ${done}`}`,
      nodes: ids.map((id) => ({ id, label: id, x: placed.pos.get(id).x, y: placed.pos.get(id).y, sub: pair(h.get(id), fmt),
        role: id === node ? 'current' : reading && around.has(id) ? 'compare' : dist.get(id) <= done ? 'done' : 'default' })),
      edges: graph.edges.map((e) => ({ u: e.u, v: e.v, role: reading && (e.u === node || e.v === node) ? 'active' : 'default' })),
      legend,
    };
    const roles = {};
    const cells = ids.map((id, r) => {
      const row = [Number.isFinite(dist.get(id)) ? dist.get(id) : 'no path'];
      for (let k = 0; k <= rounds; k++) {
        const value = k <= done ? history[k][id] : k === done + 1 && next && next.has(id) ? next.get(id) : null;
        row.push(value ? pair(value).replace(' ', '\u00a0') : '');   // a pair should not break across two lines
        if (value && dist.get(id) <= k) roles[`${r},${k + 1}`] = 'done';
      }
      if (node !== null && around.has(id)) roles[`${r},${done + 1}`] = 'compare';
      if (id === node) { if (!reading) roles[`${r},${done + 1}`] = 'special'; roles[`${r},${done + 2}`] = 'current'; }
      return row;
    });
    return [g, { kind: 'table', title: ruleTitle, corner: 'node', rowLabels: ids, colLabels: [`steps from ${source}`, 'start', ...Array.from({ length: rounds }, (_, k) => `round ${k + 1}`)], cells, roles, legend: tableLegend }];
  };

  const marked = ids.filter((id, i) => first[i][0] !== 0 || first[i][1] !== 0);
  const startText = input.featureMap ? 'The starting numbers were supplied with the graph.'
    : input.features === 'same' ? 'Every node starts with the same two numbers, (1, 1).'
      : input.features === 'random' ? 'Each node starts with two numbers drawn from 0, 0.5 and 1 using the seed.'
        : `${names(marked.map((id) => `${id} starts with ${pair(h.get(id))}`))}, and every other node with (0, 0).`;
  t.frame(() => ({ line: 0,
    note: `A graph of ${ids.length} nodes and ${graph.edges.length} edges. Every node holds two numbers. ${startText} In each round every node will do three things: ${combine === 'mean' ? 'take the mean of' : 'add up'} its neighbours' numbers, mix the result with its own numbers using the rule above the table, and replace any negative result by 0. That last step is the activation, called ReLU. The weights in the rule are fixed and were chosen by hand to keep the arithmetic easy. Nothing here was learned from data: this is the forward calculation of a graph neural network, not a trained model. The nodes are drawn in columns by how many steps they are from ${source}.`,
    views: views({ done: 0 }), vars: { nodes: ids.length, edges: graph.edges.length, rounds, combine } }));

  for (let k = 1; k <= rounds; k++) {
    const next = new Map();
    for (const v of ids) {
      const list = nbrs.get(v), own = h.get(v);
      const m = [0, 0];
      for (const u of list) { m[0] += h.get(u)[0]; m[1] += h.get(u)[1]; t.count('messages'); }
      const totals = m.slice();
      if (combine === 'mean' && list.length) { m[0] /= list.length; m[1] /= list.length; }
      const opening = k === 1 && v === ids[0];
      t.frame(() => ({ line: [2, 3],
        note: !list.length ? `Round ${k}, node **${v}**. ${v} has no neighbours, so there is nothing to read and its ${combine} is taken to be (0, 0).`
          : `Round ${k}, node **${v}**. ${v} reads the numbers that its ${list.length === 1 ? 'only neighbour' : 'neighbours'} ${names(list)} held ${k === 1 ? 'at the start' : `after round ${k - 1}`}: ${names(list.map((u) => pair(h.get(u))))}. ${combine === 'mean'
            ? (list.length === 1 ? `With one neighbour the mean is just that pair: **${pair(m)}**.` : `Their mean, number by number, is ${f4(totals[0])} ÷ ${list.length} and ${f4(totals[1])} ÷ ${list.length}: **${pair(m)}**.`)
            : `Added up, number by number, they give **${pair(m)}**.`} ${opening
            ? `${combine === 'mean' ? 'A mean' : 'A sum'} comes out the same whatever order the neighbours are read in. That matters because the neighbours of a node have no natural order.`
            : `${v} reads only its direct neighbours, so nothing from further away can reach it in this round except through what they already hold.`}`,
        views: views({ done: k - 1, node: v, reading: true, next: new Map(next) }),
        vars: { round: k, node: v, neighbours: list.join(' ') || 'none', [combine]: pair(m) } }));

      const z = [0, 0];
      for (let i = 0; i < 2; i++) z[i] = W.self[i][0] * own[0] + W.self[i][1] * own[1] + W.nb[i][0] * m[0] + W.nb[i][1] * m[1];
      const value = [Math.max(0, z[0]), Math.max(0, z[1])];
      next.set(v, value);
      t.count('node updates');
      t.frame(() => ({ line: [4, 5],
        note: `${v} mixes its own numbers ${pair(own)} with the ${combine} ${pair(m)}. ${[0, 1].map((i) => `${i ? 'Second' : 'First'}: ${arithmetic(W, i, own, m)} = ${f4(z[i])}${z[i] < -5e-5 ? ', which is below zero, so ReLU replaces it with 0' : ''}.`).join(' ')} The value of ${v} for the next round is **${pair(value)}**. ${opening
          ? 'It is set aside for now. The other nodes still read the old value until the round ends, so that every node works from the same round.'
          : v === ids[ids.length - 1] ? `${v} is the last node, so the round is complete.`
            : `It is set aside until the round ends, so the nodes still to come read ${pair(own)} for ${v}.`}`,
        views: views({ done: k - 1, node: v, next: new Map(next) }),
        vars: { round: k, node: v, [combine]: pair(m), 'before ReLU': pair(z), 'new value': pair(value) } }));
    }
    const before = h;
    h = next;
    history.push(Object.fromEntries(h));
    const within = ids.filter((id) => dist.get(id) <= k), fresh = ids.filter((id) => dist.get(id) === k), beyond = ids.filter((id) => dist.get(id) > k);
    t.frame(() => ({ line: 6,
      note: `Round ${k} is finished, and every node switches to its new value at the same moment. The numbers ${source} started with can now have affected the ${within.length === 1 ? 'node' : 'nodes'} within ${k} ${k === 1 ? 'step' : 'steps'} of ${source}: ${names(within)}. ${fresh.length
        ? `${names(fresh)} ${fresh.length === 1 ? 'is' : 'are'} exactly ${k} ${k === 1 ? 'step' : 'steps'} away and joined in this round${fresh.length <= 3 ? `: ${fresh.map((id) => `${id} went from ${pair(before.get(id))} to ${pair(h.get(id))}`).join(', ')}` : ''}.`
        : `No node is exactly ${k} steps away, so the set did not grow.`} ${beyond.length
        ? `${names(beyond)} ${beyond.length === 1 ? 'is' : 'are'} ${beyond.every((id) => dist.get(id) === Infinity) ? `not joined to ${source} by any path` : 'further away'}. ${beyond.length === 1 ? 'Its value is' : 'Their values are'} exactly what ${beyond.length === 1 ? 'it' : 'they'} would be if ${source} had started with any other numbers, because a value moves along one edge per round and no faster.`
        : `Every node that ${source} can reach has now been reached.`}`,
      views: views({ done: k }), vars: { round: k, [`within ${k} of ${source}`]: within.join(' ') } }));
  }

  t.frame(() => ({ line: 7,
    note: `After ${rounds} ${rounds === 1 ? 'round' : 'rounds'} the values are ${names(ids.map((id) => `${id} ${pair(h.get(id))}`))}. Each one depends only on the starting numbers of nodes at most ${rounds} ${rounds === 1 ? 'step' : 'steps'} away. This was a forward calculation with weights chosen by hand, and it does nothing useful on purpose. In a trained graph neural network the same rounds run with weights found from examples, so that the final numbers can be read as an answer, such as a label for each node.`,
    views: views({ done: rounds }), vars: { rounds, nodes: ids.length } }));

  return { graph, ids, source, rounds, combine, weights: W, neighbours: Object.fromEntries(nbrs), dist: Object.fromEntries(dist), history, final: history[rounds] };
}

/* ---- independent references for the tests (they share no code with run) ---- */
// The same forward pass written with whole matrices: H ← ReLU(H · W_selfᵀ + P · H · W_nbᵀ),
// where P is the adjacency matrix, with each row divided by its degree for the mean.
function denseForward(r) {
  const n = r.ids.length, at = new Map(r.ids.map((id, i) => [id, i]));
  const A = r.ids.map(() => new Array(n).fill(0));
  for (const e of r.graph.edges) { A[at.get(e.u)][at.get(e.v)] = 1; A[at.get(e.v)][at.get(e.u)] = 1; }
  const P = A.map((row) => { const deg = row.reduce((a, b) => a + b, 0); const scale = r.combine === 'mean' ? (deg ? 1 / deg : 0) : 1; return row.map((a) => a * scale); });
  let H = r.ids.map((id) => r.history[0][id].slice());
  const out = [H];
  for (let k = 0; k < r.rounds; k++) {
    const M = P.map((row) => [0, 1].map((j) => row.reduce((s, p, u) => s + p * H[u][j], 0)));
    H = H.map((own, v) => [0, 1].map((i) => Math.max(0, r.weights.self[i][0] * own[0] + r.weights.self[i][1] * own[1] + r.weights.nb[i][0] * M[v][0] + r.weights.nb[i][1] * M[v][1])));
    out.push(H);
  }
  return out;
}
const matchesDense = (r, eps = 1e-12) => {
  const ref = denseForward(r);
  for (let k = 0; k <= r.rounds; k++) for (let v = 0; v < r.ids.length; v++) for (const j of [0, 1]) {
    if (!(Math.abs(ref[k][v][j] - r.history[k][r.ids[v]][j]) <= eps)) return `round ${k}, node ${r.ids[v]}: ${r.history[k][r.ids[v]][j]} against ${ref[k][v][j]}`;
  }
  return true;
};
// Fewest steps between every pair of nodes, by the Floyd-Warshall method (not the search used in run).
function allSteps(r) {
  const D = Object.fromEntries(r.ids.map((a) => [a, Object.fromEntries(r.ids.map((b) => [b, a === b ? 0 : Infinity]))]));
  for (const e of r.graph.edges) if (e.u !== e.v) { D[e.u][e.v] = 1; D[e.v][e.u] = 1; }
  for (const m of r.ids) for (const a of r.ids) for (const b of r.ids) if (D[a][m] + D[m][b] < D[a][b]) D[a][b] = D[a][m] + D[m][b];
  return D;
}
const samePair = (a, b) => a[0] === b[0] && a[1] === b[1];
const QUIET = { count() {}, frame() {} };
const circle = (n, edges) => ({ nodes: Array.from({ length: n }, (_, i) => ({ id: `N${i}`, x: 0.5 + 0.42 * Math.cos((2 * Math.PI * i) / n), y: 0.5 + 0.42 * Math.sin((2 * Math.PI * i) / n) })), edges, directed: false, weighted: false });
const ringGraph = (n) => circle(n, Array.from({ length: n }, (_, i) => ({ u: `N${i}`, v: `N${(i + 1) % n}`, w: 1 })));
const completeGraph = (n) => { const edges = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push({ u: `N${i}`, v: `N${j}`, w: 1 }); return circle(n, edges); };

const inputs = [
  ...graphInputs({ nodes: DEFAULTS.nodes, density: DEFAULTS.density, weighted: false }).map((f) => (f.id === 'edges'
    ? { ...f, default: DEFAULT_EDGES, label: 'Edges (clear this field to get a random graph)', help: 'Format: A-B, B-C. Letters are nodes, and a dash joins two of them. The first node in alphabetical order is the one whose influence is tracked.' }
    : f)),
  { id: 'features', type: 'select', label: 'Starting numbers', default: DEFAULTS.features, options: [
    { value: 'one', label: 'One marked node: the first holds (1, 0), the rest (0, 0)' },
    { value: 'two', label: 'Two marked nodes: the first holds (1, 0), the last (0, 1)' },
    { value: 'same', label: 'Every node holds (1, 1)' },
    { value: 'random', label: 'Random: each number is 0, 0.5 or 1 (uses the seed)' },
  ] },
  { id: 'weights', type: 'select', label: 'Fixed weights', default: DEFAULTS.weights, options: [
    { value: 'compete', label: 'Compete: the two numbers push against each other' },
    { value: 'average', label: 'Average: half own value, half neighbours' },
    { value: 'neighbours', label: 'Neighbours only: the node ignores its own value' },
  ] },
  { id: 'combine', type: 'select', label: 'How a node combines its neighbours', default: DEFAULTS.combine, options: [
    { value: 'mean', label: 'Mean of the neighbours' },
    { value: 'sum', label: 'Sum of the neighbours' },
  ] },
  { id: 'rounds', type: 'range', label: 'Rounds of message passing', min: 1, max: 8, step: 1, default: DEFAULTS.rounds },
];

export default {
  meta: {
    id: 'graph-neural-network',
    name: 'Graph Neural Networks',
    aliases: ['GNN', 'message passing neural network', 'MPNN', 'graph convolutional network', 'GCN', 'message passing', 'neighbourhood aggregation', 'graph network'],
    kind: 'architecture',
    discipline: 'deep-learning',
    alsoIn: [
      { id: 'graph-theory', why: 'The computation runs along the edges of a graph, and what a node can learn in k rounds is decided by which nodes lie within k steps of it.' },
      { id: 'machine-learning', why: 'It is the standard way to learn from data that comes as items and the links between them, where a table of independent rows would throw the links away.' },
    ],
    subfield: 'Learning on graphs',
    family: 'Message passing networks',
    lab: 'neural-networks',
    summary: 'Lets every node of a graph repeatedly mix its own numbers with a summary of its neighbours\' numbers, using one shared set of weights, so each round carries information one edge further.',
    difficulty: 'advanced',
    order: 654,
    paradigms: ['iterative-refinement'],
    randomized: false,
    approximate: false,
    time: { best: 'O(K · (V + E))', average: 'O(K · (V + E))', worst: 'O(K · (E · d + V · d²)) for K rounds and d numbers per node', class: 'linear' },
    space: { worst: 'O(V · d) for the node values', class: 'linear' },
    tags: {
      problems: ['learn from data shaped like a network', 'predict something about each member of a network', 'predict the properties of a molecule', 'let neighbours in a network share what they know', 'recommend things using who is connected to whom', 'sort the members of a social network into groups'],
      techniques: ['message passing', 'neighbourhood aggregation', 'weight sharing', 'ReLU activation', 'permutation equivariance'],
      applications: ['machine learning', 'bioinformatics', 'navigation', 'scientific computing'],
    },
    prerequisites: ['backpropagation', 'pagerank', 'convolution', 'concept:graph', 'concept:neural-network', 'concept:activation-function', 'concept:matrix'],
  },

  bigIdea: {
    simple: "Some things are best described as a network: people and their friendships, towns and the roads between them, atoms and the bonds that hold a molecule together. A network like this is called a graph. Each thing is a node, and each link is an edge. A graph neural network is a way for a computer to work out something about each node by letting the nodes talk to their neighbours. Every node starts with a few numbers that describe it. Then comes a round of message passing. Each node collects its neighbours' numbers, averages them, and mixes that average with its own numbers by a fixed recipe. All the nodes do this at the same moment, and all of them use the same recipe. After one round a node knows something about its neighbours. After two rounds it knows something about its neighbours' neighbours, because its neighbours had already listened. The recipe contains adjustable numbers called weights. Training means trying many examples and nudging the weights until the final numbers give good answers.",
    when: 'Use one when the data is a set of things with links between them and the links matter for the answer: atoms and bonds, users and the items they chose, road segments and the junctions that join them. The prediction can be about each node, about each edge or about the whole graph. It is the wrong tool when the items are unrelated rows of a table, since there are then no edges to pass messages along. On data that already has a fixed arrangement, such as the pixel grid of an image or the order of words in a sentence, models built for that arrangement are the usual choice.',
    interesting: 'The same few weights are used at every node, so a network trained on small graphs can be run on a graph of any size or shape. And nothing in the calculation looks at the names of the nodes or the order of a node\'s neighbours. Shuffle the labels and the answers move with them, unchanged. That is built into the arithmetic and does not have to be learned. On a pixel grid the idea is close kin to convolution, the sliding weighted sum used on images. The difference is that a grid has a left and a right, so a kernel can give each neighbour its own weight, while the neighbours of a node in a graph come in no order and must all be treated alike.',
    analogy: {
      title: 'News passed between neighbours',
      text: 'Picture a village in which each household talks only to the houses next door. Once a day, at the same hour, every household asks its neighbours what they wrote in their notebooks yesterday, averages what it hears, and writes a new entry that mixes that average with its own last entry. News from next door arrives in one day. News from two doors away takes two days, because it first has to be written into the notebook in between. After a week, each notebook reflects everything within seven houses.',
      limits: 'Villagers remember who told them what and can ask follow-up questions. A node only gets an average, so it cannot tell which neighbour said what, or even how many neighbours it has. Every household here follows the identical recipe, and the recipe is arithmetic, not judgement. Real gossip also keeps travelling for as long as people talk, while a graph neural network runs a small fixed number of rounds, so news from far away never arrives at all. And in this picture nobody chose the recipe for a purpose. In a real network the recipe is found by training.',
    },
  },

  example: {
    setup: "Four nodes stand in a line, A, B, C and D, each joined to the next. Every node holds two numbers. A starts with (1, 0) and the others with (0, 0). The recipe for a round is the same for every node. The new first number is half of the node's own first number, plus half of the neighbours' average first number, minus half of their average second number. The new second number is the same with first and second swapped. Any result below zero is replaced by 0. Everyone works from the old numbers, and all the nodes switch to their new numbers together at the end of the round.",
    steps: [
      "Round 1, node A. Its only neighbour is B, which holds (0, 0), so the average is (0, 0). First number: half of 1 is 0.5, and the average adds nothing. A becomes (0.5, 0).",
      "Round 1, node B. Its neighbours are A with (1, 0) and C with (0, 0). Their average is (0.5, 0). First number: half of 0, plus half of 0.5, is 0.25. Second number: half of 0, minus half of 0.5, is −0.25. That is below zero, so it becomes 0. B becomes (0.25, 0).",
      "Round 1, nodes C and D. C reads B and D, which both still show (0, 0), because B's new value does not count until the round is over. D reads C. Both stay at (0, 0).",
      "Round 2, node C. Its neighbours now show B (0.25, 0) and D (0, 0). Their average is (0.125, 0). First number: half of 0, plus half of 0.125, is 0.0625. C becomes (0.0625, 0).",
      "Round 2, the rest. A reads B: 0.25 + 0.125 = 0.375. B reads A and C, average (0.25, 0): 0.125 + 0.125 = 0.25. D reads C, which still shows (0, 0), and stays at (0, 0).",
    ],
    result: "After two rounds the nodes hold A (0.375, 0), B (0.25, 0), C (0.0625, 0) and D (0, 0). C is two steps from A, and A's number reached it after exactly two rounds. D is three steps away and has heard nothing yet. One more round would reach it.",
    tryInput: { ...DEFAULTS, edges: 'A-B, B-C, C-D', rounds: 2 },
  },

  terms: [
    { term: "Graph", meaning: "A set of things and the links between them. Also called a network." },
    { term: "Node", meaning: "One of the things in a graph, such as a person, a town or an atom." },
    { term: "Edge", meaning: "A link between two nodes, such as a friendship, a road or a chemical bond." },
    { term: "Neighbours", meaning: "The nodes joined to a given node by a single edge." },
    { term: "Features", meaning: "The numbers a node holds. They start as a description of the node and are rewritten every round." },
    { term: "Message passing", meaning: "One round in which every node reads its neighbours' numbers and updates its own." },
    { term: "Mean", meaning: "The average: add the values up and divide by how many there are." },
    { term: "Weights", meaning: "The adjustable numbers in the recipe that say how much each incoming number counts. The same weights are used at every node." },
    { term: "Activation", meaning: "A simple rule applied to each number after the mixing. The one used here, called ReLU, replaces any negative number by 0 and leaves the rest alone." },
    { term: "Layer", meaning: "One round of message passing inside a trained network. A network with three layers runs three rounds, each with its own weights." },
    { term: "Training", meaning: "Adjusting the weights, little by little, until the network's final numbers give good answers on examples whose answers are known." },
  ],

  takeaway: "Each round, every node mixes its own numbers with its neighbours' numbers by one shared recipe, so after k rounds a node knows about everything within k steps and nothing beyond.",

  viz: {
    describe: 'A graph drawn in columns: the first node on the left, then the nodes one step from it, then two steps, and so on. Under each node are the two numbers it currently holds. The node being updated is terracotta, the neighbours it is reading are ochre with the edges to them highlighted, and nodes that the first node\'s starting numbers can have reached are green. Below the graph a table has one row per node and one column per round. It fills in column by column, and each new cell is worked out from cells in the column before it. The cell being worked out is terracotta, the cells being read are ochre, the node\'s own last value is outlined in dark ink, and cells that can depend on the first node\'s starting numbers are green, which makes a staircase as the rounds go by. The rule with its fixed weights is written above the table.',
    inputs,
    presets: [
      { label: 'One marked node, three rounds', values: { ...DEFAULTS } },
      { label: 'Worked example: four nodes in a line', values: { ...DEFAULTS, edges: 'A-B, B-C, C-D', rounds: 2 } },
      { label: 'Two marked nodes: which is nearer?', values: { ...DEFAULTS, features: 'two' } },
      { label: 'Many rounds make the nodes alike', values: { ...DEFAULTS, features: 'two', weights: 'average', rounds: 8 } },
      { label: 'Every node starts the same', values: { ...DEFAULTS, features: 'same', weights: 'average', rounds: 2 } },
      { label: 'Neighbours only: a node forgets itself', values: { ...DEFAULTS, edges: 'A-B, B-C, C-D, D-E', weights: 'neighbours' } },
      { label: 'A random graph', values: { ...DEFAULTS, edges: '', nodes: 9, density: 0.3, seed: 3 } },
    ],
    tryThis: [
      'Run the default and watch the row for D in the table. D is two steps from A. Its value is (0, 0) at the start and after round 1, and (0.0278, 0) after round 2. E and F, three steps away, stay at (0, 0) until round 3. Then lower the number of rounds to 2: E and F end at (0, 0), and no choice of weights could change that.',
      'Load "Two marked nodes: which is nearer?". A carries a mark in its first number and F a mark in its second. With the "compete" weights, a neighbour\'s first number pushes a node\'s second number down, and the other way round. After three rounds A, B and C have a positive first number and a second number of 0, and D, E and F the reverse. These hand-picked weights make each node side with the nearer mark. A trained network would have to find weights like that for itself.',
      'Load "Many rounds make the nodes alike". After round 1 the first numbers run from 0 to 0.5. After round 8 they run only from 0.0594 to 0.2265, and they keep closing in as rounds are added. Repeated averaging washes out the differences between nodes. This is called over-smoothing, and it is one reason practical networks use few rounds.',
      'Load "Every node starts the same". With the mean, every node ends each round with (1, 1): a node with two neighbours and a node with three cannot be told apart. Switch "How a node combines its neighbours" to the sum. Now C and D, which have three neighbours, pull ahead of the others. The sum can count neighbours and the mean cannot.',
      'Load "Neighbours only: a node forgets itself". After round 1, A holds (0, 0): it has thrown away its own mark and kept only what B had. In round 2 half of the mark comes back to A, but only because B hands it back. Without a term for its own value, a node keeps nothing of its own from one round to the next. This is why the rule normally includes the node\'s own value.',
    ],
    run,
    report: (r, c) => `${r.rounds} ${r.rounds === 1 ? 'round' : 'rounds'} of message passing on ${r.ids.length} nodes, combining neighbours by their ${r.combine}.\nFinal values: ${r.ids.map((id) => `${id} ${pair(r.final[id])}`).join(', ')}\n${c.messages || 0} neighbour values read and ${c['node updates'] || 0} node updates.\nThis is a forward calculation with fixed, hand-chosen weights. Nothing was trained.`,
    experiment: {
      title: 'Neighbour values read as the graph grows',
      note: 'Each point is a real run of three rounds, counting every time a node reads one neighbour\'s value. In a ring each node has two neighbours. In a complete graph every node is joined to every other. The curves are exact counts, two readings per edge per round, and are not fitted. The work follows the number of edges, not the number of nodes.',
      metric: 'messages',
      metricLabel: 'Neighbour values read in three rounds',
      sizeLabel: 'Number of nodes (n)',
      sizes: [8, 16, 32, 64, 128],
      variants: [{ id: 'ring', label: 'Ring: n edges' }, { id: 'complete', label: 'Complete graph: n(n − 1)/2 edges' }],
      input: (n, variant, seed) => ({ ...DEFAULTS, edges: '', graph: variant === 'complete' ? completeGraph(n) : ringGraph(n), features: 'random', seed, rounds: 3 }),
      theory: [
        { label: '3 × 2n', fn: (n) => 6 * n, variant: 'ring' },
        { label: '3 × n(n − 1)', fn: (n) => 3 * n * (n - 1), variant: 'complete' },
      ],
    },
  },

  logic: {
    intuition: 'A node cannot see the whole graph. It sees itself and its direct neighbours. But its neighbours are doing the same thing at the same time, so by the end of one round each neighbour\'s value already contains something of that neighbour\'s own surroundings. In the second round, reading a neighbour means reading a summary of what lies behind it. Every round pushes the edge of what a node can know one step further out. The weights decide what is kept and what is thrown away in each mixing. Training chooses them so that, after the last round, the numbers at each node are the ones the task needs.',
    steps: [
      'Give every node its starting numbers, its features.',
      'For each node, gather the current numbers of its neighbours and combine them into one summary. Here the summary is their mean.',
      'Multiply the node\'s own numbers by one fixed table of weights and the summary by another, and add the two results.',
      'Apply the activation to each number: replace anything below zero by 0.',
      'When every node has a new value, replace all the old values at once. That is one round.',
      'Repeat for a fixed number of rounds. The final numbers at each node are the output.',
    ],
    pseudocode: [
      'message_passing(graph, h, rounds):',
      '  repeat rounds times:',
      '    for each node v:',
      '      m ← mean of h[u] over the neighbours u of v',
      '      z ← W_self · h[v] + W_nb · m',
      '      next[v] ← ReLU(z)',
      '    h ← next',
      '  return h',
    ],
    decisions: [
      { title: 'How should a node combine its neighbours?', text: 'With something that gives the same answer whatever order the neighbours come in, and that works for any number of them: a mean, a sum or a maximum. The choice matters. A mean cannot tell how many neighbours there are, and a sum can. This page uses the mean and offers the sum for comparison.' },
      { title: 'Where do the weights come from?', text: 'On this page they are fixed numbers chosen so that the arithmetic can be followed by hand. In a real graph neural network they start as random numbers and are adjusted by [backpropagation](#/algorithm/backpropagation) and gradient descent, using graphs for which the right answers are known. Nothing on this page is trained.' },
      { title: 'Why do all nodes switch at once?', text: 'So that every node in a round reads values from the same earlier round. If a node used a neighbour\'s new value straight away, the result would depend on the order in which the nodes were visited, and information could travel several steps in one round along that order.' },
      { title: 'Should a node include its own value?', text: 'Usually yes. Without the term for the node\'s own value, a node forgets what it held as soon as it listens. Some designs treat the node as one of its own neighbours instead, which has a similar effect.' },
      { title: 'How many rounds?', text: 'Enough for the information a node needs to reach it, and no more. Each round widens the view by one step, but repeated averaging also makes nodes more alike. Networks in practice often use two or three rounds.' },
      { title: 'Is there a bias?', text: 'Layers in practice usually add a fixed number, a bias, before the activation. It is left out here, so that a node which has heard nothing stays at exactly zero and the arrival of information is easy to see.' },
    ],
    invariants: [
      'After k rounds, the value at a node depends only on the starting numbers of nodes at most k steps away from it.',
      'Renaming the nodes, or listing them or their edges in a different order, renames the outputs in the same way and changes no number.',
      'During a round, every node reads only values from the end of the previous round.',
    ],
    edgeCases: [
      'A node with no neighbours has nothing to average. Its summary is taken to be zero, so it only ever sees its own value.',
      'Two parts of a graph with no path between them never exchange anything, however many rounds are run.',
      'If every node starts with the same numbers, has at least one neighbour, and combines its neighbours by their mean, every node holds the same value after every round, whatever the shape of the graph.',
      'An edge from a node to itself makes the node one of its own neighbours.',
      'With more rounds than the longest shortest path in the graph, every node can depend on every other, and further rounds only mix the values more.',
      'A ring of six nodes and two separate triangles cannot be told apart when all nodes start alike: every node has two neighbours that look exactly like itself, in both graphs.',
    ],
    correctness: 'There is no single right answer for the forward calculation to reach, so the useful claims are about its structure. First, locality. The new value of a node is computed from its own value and its neighbours\' values, and from nothing else. So after one round it depends only on nodes at most one step away. Suppose that after k − 1 rounds every value depends only on nodes within k − 1 steps. In round k a node reads itself and its neighbours, each of which depends on nodes within k − 1 steps of itself, and all of those are within k steps of the reader. So the claim holds for every k. Second, relabelling. The rule never uses the name of a node, and the mean of a set of values does not depend on the order in which they are added. So the value computed for a node depends only on the shape of the graph around it and the starting numbers found there, and renaming the nodes just renames the results. Both properties are checked by tests on this page. Whether the final numbers mean anything is a separate matter that depends entirely on the weights, and so on training.',
    mistakes: [
      'Overwriting a node\'s value in the middle of a round, so that nodes visited later read a mixture of old and new values.',
      'Combining neighbours in a way that depends on their order, for instance by joining their numbers end to end. The result then changes when the same graph is stored differently.',
      'Dividing by the number of neighbours for a node that has none.',
      'Adding more and more rounds in the hope of a wider view, and ending with nodes that can no longer be told apart.',
      'Storing an edge in one direction only, so that messages flow one way along a link that was meant to work both ways.',
      'Taking the output of an untrained network, or of a demonstration like this one, as if it meant something.',
    ],
  },

  code: {
    sample: {
      input: 'Six nodes forming two triangles, A-B-C and D-E-F, joined by the edge C-D. A starts with (1, 0) and every other node with (0, 0). Three rounds with the fixed "compete" weights and the mean of the neighbours. The last line follows D, which is two steps from A.',
      expected: 'start:   A(1.0000,0.0000) B(0.0000,0.0000) C(0.0000,0.0000) D(0.0000,0.0000) E(0.0000,0.0000) F(0.0000,0.0000)\nround 1: A(0.5000,0.0000) B(0.2500,0.0000) C(0.1667,0.0000) D(0.0000,0.0000) E(0.0000,0.0000) F(0.0000,0.0000)\nround 2: A(0.3542,0.0000) B(0.2917,0.0000) C(0.2083,0.0000) D(0.0278,0.0000) E(0.0000,0.0000) F(0.0000,0.0000)\nround 3: A(0.3021,0.0000) B(0.2865,0.0000) C(0.2164,0.0000) D(0.0486,0.0000) E(0.0069,0.0000) F(0.0069,0.0000)\nfirst number of D, round by round: 0.0000 0.0000 0.0278 0.0486',
    },
    python: {
      source: `NODES = ["A", "B", "C", "D", "E", "F"]
EDGES = [("A", "B"), ("A", "C"), ("B", "C"), ("C", "D"), ("D", "E"), ("D", "F"), ("E", "F")]
W_SELF = [[0.5, 0.0], [0.0, 0.5]]    # how a node's own two numbers enter its new numbers
W_NB = [[0.5, -0.5], [-0.5, 0.5]]    # how the mean of its neighbours' numbers enters
ROUNDS = 3

neighbours = {v: [] for v in NODES}
for a, b in EDGES:
    neighbours[a].append(b)
    neighbours[b].append(a)


def one_round(h):
    """Every node reads its neighbours' current values. All nodes switch together."""
    new_h = {}
    for v in NODES:
        mean = [0.0, 0.0]
        for u in neighbours[v]:
            mean[0] += h[u][0]
            mean[1] += h[u][1]
        mean = [mean[0] / len(neighbours[v]), mean[1] / len(neighbours[v])]
        value = []
        for i in range(2):
            z = 0.0
            for j in range(2):
                z += W_SELF[i][j] * h[v][j]
                z += W_NB[i][j] * mean[j]
            value.append(max(0.0, z))    # ReLU: a negative number becomes 0
        new_h[v] = value
    return new_h


def show(label, h):
    print(label + " " + " ".join(f"{v}({h[v][0]:.4f},{h[v][1]:.4f})" for v in NODES))


h = {v: [0.0, 0.0] for v in NODES}
h["A"] = [1.0, 0.0]
d_first = [h["D"][0]]
show("start:  ", h)
for k in range(1, ROUNDS + 1):
    h = one_round(h)
    d_first.append(h["D"][0])
    show(f"round {k}:", h)
print("first number of D, round by round: " + " ".join(f"{x:.4f}" for x in d_first))`,
      notes: [
        { line: 3, text: 'The weights are fixed numbers written into the program. Nothing in this program learns. A trained network would arrive at its weights by backpropagation.' },
        { line: 15, text: 'New values go into a separate dictionary. Every node in this round reads `h`, the values from the end of the previous round.' },
        { line: 21, text: 'The mean of the neighbours, number by number. It is the same whatever order the neighbours were stored in.' },
        { line: 26, text: 'The linear map: each new number is a weighted sum of the node\'s own two numbers and the two numbers of the mean.' },
        { line: 28, text: 'The activation. Without it, any number of rounds would collapse into a single weighted sum of the starting numbers.' },
      ],
    },
    javascript: {
      source: `const NODES = ["A", "B", "C", "D", "E", "F"];
const EDGES = [["A", "B"], ["A", "C"], ["B", "C"], ["C", "D"], ["D", "E"], ["D", "F"], ["E", "F"]];
const W_SELF = [[0.5, 0.0], [0.0, 0.5]];    // how a node's own two numbers enter its new numbers
const W_NB = [[0.5, -0.5], [-0.5, 0.5]];    // how the mean of its neighbours' numbers enters
const ROUNDS = 3;

const neighbours = {};
for (const v of NODES) neighbours[v] = [];
for (const [a, b] of EDGES) {
  neighbours[a].push(b);
  neighbours[b].push(a);
}

// Every node reads its neighbours' current values. All nodes switch together.
function oneRound(h) {
  const newH = {};
  for (const v of NODES) {
    const mean = [0, 0];
    for (const u of neighbours[v]) {
      mean[0] += h[u][0];
      mean[1] += h[u][1];
    }
    mean[0] /= neighbours[v].length;
    mean[1] /= neighbours[v].length;
    const value = [];
    for (let i = 0; i < 2; i++) {
      let z = 0;
      for (let j = 0; j < 2; j++) {
        z += W_SELF[i][j] * h[v][j];
        z += W_NB[i][j] * mean[j];
      }
      value.push(Math.max(0, z));    // ReLU: a negative number becomes 0
    }
    newH[v] = value;
  }
  return newH;
}

function show(label, h) {
  console.log(label + " " + NODES.map((v) => v + "(" + h[v][0].toFixed(4) + "," + h[v][1].toFixed(4) + ")").join(" "));
}

let h = {};
for (const v of NODES) h[v] = [0, 0];
h.A = [1, 0];
const dFirst = [h.D[0]];
show("start:  ", h);
for (let k = 1; k <= ROUNDS; k++) {
  h = oneRound(h);
  dFirst.push(h.D[0]);
  show("round " + k + ":", h);
}
console.log("first number of D, round by round: " + dFirst.map((x) => x.toFixed(4)).join(" "));`,
    },
    cpp: {
      source: `#include <algorithm>
#include <array>
#include <cstdio>
#include <vector>

using Pair = std::array<double, 2>;

const int N = 6;    // nodes A..F are 0..5
const int EDGES[7][2] = {{0, 1}, {0, 2}, {1, 2}, {2, 3}, {3, 4}, {3, 5}, {4, 5}};
const double W_SELF[2][2] = {{0.5, 0.0}, {0.0, 0.5}};    // how a node's own two numbers enter its new numbers
const double W_NB[2][2] = {{0.5, -0.5}, {-0.5, 0.5}};    // how the mean of its neighbours' numbers enters
const int ROUNDS = 3;

// Every node reads its neighbours' current values. All nodes switch together.
std::vector<Pair> one_round(const std::vector<Pair>& h, const std::vector<std::vector<int>>& neighbours) {
    std::vector<Pair> new_h(N);
    for (int v = 0; v < N; ++v) {
        Pair mean = {0.0, 0.0};
        for (int u : neighbours[v]) {
            mean[0] += h[u][0];
            mean[1] += h[u][1];
        }
        mean[0] /= neighbours[v].size();
        mean[1] /= neighbours[v].size();
        for (int i = 0; i < 2; ++i) {
            double z = 0.0;
            for (int j = 0; j < 2; ++j) {
                const double own_part = W_SELF[i][j] * h[v][j];
                z += own_part;
                const double neighbour_part = W_NB[i][j] * mean[j];
                z += neighbour_part;
            }
            new_h[v][i] = std::max(0.0, z);    // ReLU: a negative number becomes 0
        }
    }
    return new_h;
}

void show(const char* label, const std::vector<Pair>& h) {
    std::printf("%s", label);
    for (int v = 0; v < N; ++v) std::printf(" %c(%.4f,%.4f)", 'A' + v, h[v][0], h[v][1]);
    std::printf("\\n");
}

int main() {
    std::vector<std::vector<int>> neighbours(N);
    for (const auto& e : EDGES) {
        neighbours[e[0]].push_back(e[1]);
        neighbours[e[1]].push_back(e[0]);
    }
    std::vector<Pair> h(N, Pair{0.0, 0.0});
    h[0] = {1.0, 0.0};
    std::vector<double> d_first = {h[3][0]};
    show("start:  ", h);
    for (int k = 1; k <= ROUNDS; ++k) {
        h = one_round(h, neighbours);
        d_first.push_back(h[3][0]);
        char label[16];
        std::snprintf(label, sizeof label, "round %d:", k);
        show(label, h);
    }
    std::printf("first number of D, round by round:");
    for (double x : d_first) std::printf(" %.4f", x);
    std::printf("\\n");
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'In one round every node reads each of its neighbours once, which is two readings per edge, and then does one small fixed calculation. So a round costs time proportional to the number of nodes plus the number of edges, and K rounds cost K times that. With d numbers per node, each reading handles d numbers and each node update multiplies by a d by d table of weights.',
    cases: [
      { case: 'One round', time: 'O(E · d + V · d²)', when: 'Always. Two readings of d numbers per edge, and two d by d tables of weights applied at every node.' },
      { case: 'K rounds', time: 'O(K · (E · d + V · d²))', when: 'The forward calculation of a network with K layers. It does not depend on what the numbers are.' },
      { case: 'Sparse graph', time: 'O(K · V · d²)', when: 'Each node has only a few neighbours, as in a road network or a molecule, so the number of edges is a small multiple of the number of nodes.' },
      { case: 'Dense graph', time: 'O(K · V² · d)', when: 'Most pairs of nodes are joined and there are more nodes than numbers per node, so reading along the edges dominates.' },
    ],
    space: 'O(V · d) for the current values and the next ones, in addition to the graph itself. Training also has to keep the values from every round for the backward pass, which makes it O(K · V · d).',
    memory: 'For very large graphs the difficulty is that the neighbours of a node, and their neighbours, quickly add up to a large part of the graph. Training on a small batch of nodes can then need the values of a huge number of others, which is why practical systems sample a limited number of neighbours per node.',
    tradeoffs: 'More rounds let information travel further, at a cost that grows in step with the number of rounds, and with the risk that node values become too alike to be useful. More numbers per node let a node carry more information, at a cost that grows with the square of that number in every update.',
    assumptions: [
      'The graph is stored so that the neighbours of a node can be listed directly.',
      'd is the number of values held per node. It is 2 on this page and often tens or hundreds in practice.',
      'The bounds are for the forward calculation. Training costs a constant factor more per pass, and how many passes training needs has no general answer.',
      'The chart counts how often a node reads a neighbour\'s value in the implementation on this page. It shows how the work follows the number of edges, and says nothing about running time on real hardware.',
    ],
  },

  tradeoffs: {
    struggles: [
      'Answers that depend on nodes far apart. Reaching a node k steps away needs k rounds, and the influence of any one distant node becomes very faint on the way.',
      'Many rounds. Repeated averaging makes the values at different nodes more and more alike, a problem known as over-smoothing.',
      'Telling certain graphs apart. Message passing with nodes that start alike gives the same result on a six-node ring as on two triangles.',
      'Very large graphs with highly connected nodes, where the surroundings of one node can take in a large part of the whole graph.',
      'Graphs with no useful starting numbers at the nodes. The network then has only the pattern of connections to go on.',
    ],
    pitfalls: [
      'Leaking answers. If the links of a graph already encode the thing to be predicted, a network can look far better in testing than it will be on new data.',
      'Splitting one graph into training and test nodes without noticing that the test nodes are neighbours of the training nodes.',
      'Comparing a graph neural network only with other graph neural networks. A plain model that ignores the edges is sometimes just as good, and should be tried first.',
    ],
    misunderstandings: [
      "\"A graph neural network sees the whole graph at once.\" Each node sees only as far as the number of rounds. With three rounds, a node four steps away might as well not exist.",
      "\"More rounds always give a better result.\" Each round widens the view and also blurs it. Past a small number of rounds, node values start to look the same and accuracy often falls.",
      "\"The demonstration on this page is a trained model.\" It is a forward calculation with weights picked by hand. It shows how values move through a graph. It does not show a network that has learned anything.",
      "\"The order in which the nodes are numbered affects the answer.\" It does not. Relabel the nodes and each one gets exactly the value it had before under its new name.",
      "\"A node knows which neighbour told it what.\" With a mean or a sum it does not. All the neighbours are blended into one summary before the node sees them.",
    ],
    constraints: [
      'Real graphs change: users join, roads close. A deployed system has to recompute node values or update them as the graph changes.',
      'Graphs with billions of edges do not fit on one machine, so training relies on sampling neighbourhoods and on distributed storage.',
      'A prediction about a whole graph, such as a molecule, needs a further step that combines all the node values into one, again in a way that ignores order.',
    ],
    alternatives: [
      { name: 'A plain neural network on each node\'s own features', when: 'The links add little. This is the baseline to beat, and it is far simpler.' },
      { name: 'Label propagation', when: 'A few nodes have known labels, neighbours tend to share labels, and you want a method with nothing to train.' },
      { id: 'pagerank', name: 'PageRank', when: 'You want a single importance score for each node from the links alone, with a fixed rule and no training data.' },
      { name: 'Random-walk embeddings such as DeepWalk and node2vec', when: 'You want a list of numbers for each node that reflects its position in one fixed graph, and the nodes have no features of their own.' },
      { name: 'Graph attention networks', when: 'Some neighbours should count for more than others, and the network should learn which.' },
      { id: 'convolution', name: 'Convolution', when: 'The data lies on a regular grid, such as an image, where every item has the same arrangement of neighbours.' },
    ],
    comparison: {
      columns: ['', 'Graph neural network', 'PageRank', 'Convolution on an image'],
      rows: [
        ['Neighbours of an item', 'Whatever the graph says, in no order', 'The nodes that link to it', 'The pixels around it, each in a known position'],
        ['Rule for one round', 'Learned weights, shared by all nodes', 'One fixed formula', 'Fixed or learned weights, one per neighbour position'],
        ['Number of rounds', 'A few, fixed in advance', 'Until the values settle', 'One per layer'],
        ['Each item holds', 'A list of numbers', 'One number', 'One or more numbers'],
        ['Needs training data', 'Yes', 'No', 'Only if the weights are learned'],
      ],
    },
  },

  applications: [
    { title: 'Predicting properties of molecules', status: 'established', text: 'A molecule is a graph of atoms joined by bonds. Gilmer and colleagues at Google showed in 2017 that message passing networks predict quantum-chemical properties of small molecules accurately, and a network of this kind was used by Stokes and colleagues in 2020 to pick out a compound, which they named halicin, that turned out to kill bacteria.' },
    { title: 'Recommending items', status: 'established', text: 'Users and the items they interact with form a graph. Pinterest described PinSage in 2018, a graph neural network trained on a graph of billions of nodes and used to recommend pins to its users.' },
    { title: 'Estimating travel times', status: 'established', text: 'A road network is a graph of segments joined at junctions. In 2021 researchers at DeepMind and Google described a graph neural network used in Google Maps to estimate how long routes will take.' },
    { title: 'Weather forecasting', status: 'established', text: 'GraphCast, published by Google DeepMind in 2023, represents the atmosphere on a mesh of points covering the globe and passes messages along the edges of that mesh to forecast the weather days ahead.' },
    { title: 'Spotting rings of fraudulent accounts', status: 'illustrative', text: 'Accounts that share devices, addresses or payment details can be linked into a graph. An account that looks ordinary by itself may look suspicious once its numbers have been mixed with those of the accounts around it.' },
  ],

  connections: [
    { to: 'pagerank', type: 'prerequisite', why: 'PageRank updates every node from its neighbours, round after round, with one fixed formula. A graph neural network keeps the rounds and replaces the fixed formula by weights that are learned, and lets each node hold several numbers instead of one.' },
    { to: 'backpropagation', type: 'prerequisite', why: 'The rounds of a graph neural network are layers, and its weights are found by backpropagation: the error at the output is sent back through every round to say how each weight should change.' },
    { to: 'convolution', type: 'prerequisite', why: 'Convolution combines each pixel with the pixels around it using shared weights. A graph neural network carries the same idea to graphs, where a node may have any number of neighbours in no particular order, so it combines them with a mean or a sum.' },
    { to: 'bfs', type: 'related', why: 'After k rounds of message passing, the nodes whose starting values can affect a given node are exactly those that breadth-first search reaches from it in k layers. Both spread outward one edge at a time.' },
    { to: 'perceptron', type: 'related', why: 'A perceptron takes a weighted sum of its inputs and applies a simple function. Every node of a graph neural network does the same in every round, with inputs that are its own numbers and a summary of its neighbours\' numbers.' },
    { to: 'k-means', type: 'related', why: 'A graph neural network turns each node into a list of numbers that reflects its surroundings. k-means can then group nodes whose lists are close, which is one way of finding communities in a graph.' },
    { to: 'concept:graph', type: 'prerequisite', why: 'A graph neural network computes along the edges of a graph, so the graph is both its input and the wiring of the calculation.' },
    { to: 'concept:activation-function', type: 'prerequisite', why: 'The activation applied at every node is what stops many rounds of message passing from collapsing into a single weighted sum of the starting values.' },
    { to: 'attention', type: 'advanced', why: 'Attention lets a node weigh its neighbours unequally and learn the weighting. A transformer can be read as message passing on a graph in which every item is joined to every other.' },
    { to: 'discipline:graph-theory', type: 'related', why: 'Which graphs a message passing network can tell apart is a question about graph structure, tied to a classical test for whether two graphs have the same shape.' },
    { to: 'discipline:biology', type: 'application', why: 'Molecules and proteins are graphs of atoms and bonds, and graph neural networks are used to predict how candidate drugs will behave before they are made.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'A graph neural network runs three rounds of message passing. Which starting values can affect the final value at node X?',
      options: ['Only X\'s own', 'Those of X and its direct neighbours', 'Those of every node at most three steps from X', 'Those of every node in the graph'],
      answer: 2,
      explain: [
        'That would be true with no rounds at all. Each round lets in values from one step further away.',
        'That is the reach after one round.',
        'Each round carries information along one edge, so three rounds reach three steps and no further.',
        'Only if no node is more than three steps from X. In a larger graph the distant nodes have no effect.',
      ],
    },
    {
      type: 'predict',
      q: 'Five nodes stand in a line: A-B-C-D-E. Only A starts with a non-zero number, (1, 0). After two rounds with the default weights, which nodes have a first number above zero?',
      options: ['Only A', 'A and B', 'A, B and C', 'All five'],
      answer: 2,
      explain: [
        'A keeps part of its own value, but it also passes some to B in the first round.',
        'B hears from A in round 1, and in round 2 C hears from B.',
        'B is one step from A and C is two. D and E are three and four steps away, and two rounds cannot reach them.',
        'Information moves one edge per round. E is four edges from A and would need four rounds.',
      ],
      tryInput: { ...DEFAULTS, edges: 'A-B, B-C, C-D, D-E', rounds: 2 },
    },
    {
      type: 'debug',
      q: 'This round of message passing gives different results when the same graph is stored with its nodes in a different order. What is wrong?',
      code: `def one_round(h, neighbours):
    for v in nodes:
        m = mean([h[u] for u in neighbours[v]])
        h[v] = relu(mix(h[v], m))
    return h`,
      options: ['The mean should be a sum', 'Each new value is written straight into h, so nodes visited later read values from this round instead of the last one', 'relu should be applied before the mean', 'The loop should visit the neighbours in sorted order'],
      answer: 1,
      explain: [
        'Either is a valid choice, and neither depends on the order of the nodes.',
        'Write the new values into a separate table and swap at the end of the round. Then every node reads the same round, whatever order they are visited in.',
        'The order of the mean and the activation is a design choice. It does not make the result depend on node order.',
        'A mean gives the same answer in any order. The trouble is in the order of the nodes, not of the neighbours.',
      ],
    },
    {
      type: 'choice',
      q: 'Why does a node combine its neighbours with a mean or a sum, instead of feeding their numbers one after another into a table of weights with a separate column for each neighbour?',
      options: ['A mean is faster to compute', 'Neighbours come in no fixed order and in varying numbers, so the rule must give the same answer for any order and work for any count', 'A table of weights cannot hold negative numbers', 'Because the activation requires it'],
      answer: 1,
      explain: [
        'Speed is not the reason. The other scheme would not be well defined at all.',
        'A separate column per neighbour needs a first neighbour, a second, and so on, and the same number of them at every node. A graph offers neither.',
        'Weights can be any numbers.',
        'The activation works on whatever numbers it is given.',
      ],
    },
    {
      type: 'challenge',
      title: 'Two graphs it cannot tell apart',
      prompt: 'Run the demonstration on a ring of six nodes (A-B, B-C, C-D, D-E, E-F, F-A) and then on two separate triangles (A-B, B-C, C-A, D-E, E-F, F-D), each time with every node starting at (1, 1). Try the mean and the sum, and any of the weight sets. The final values are identical in the two graphs. Explain why no number of rounds and no choice of weights can separate them. Then find a starting feature you could give each node that would let message passing tell the two graphs apart.',
      hints: ['In both graphs every node has exactly two neighbours, and to begin with every neighbour looks the same as every other node.', 'If all nodes hold the same value before a round and all have the same number of neighbours, they all hold the same value after it.', 'A feature that depends on something further than the direct neighbours would do it, for instance whether the node lies on a triangle.'],
    },
  ],

  compare: {
    idea: 'Every node repeatedly mixes its own numbers with a summary of its neighbours\' numbers, using one shared set of weights.',
    requires: 'Data that comes as things with links between them, and a few starting numbers that describe each thing. To give useful answers it also needs many examples with known answers to learn its weights from.',
    sensitivity: 'High. Results depend on the number of rounds, on how neighbours are combined and on the training data. Too many rounds make the nodes indistinguishable.',
    memory: 'O(V · d) for the node values, plus the graph. More when training.',
    difficulty: 'high',
    difficultyNote: 'One round is a few lines. Training one well, on large graphs, without leaking answers through the links, is where the difficulty lies.',
    limits: 'Each round carries news only one link further, so things that are far apart barely influence each other. With many rounds all the nodes start to look alike. Some networks with different shapes cannot be told apart at all.',
    useWhen: 'The links between things matter for the answer: who is connected to whom, which atoms are bonded, which roads meet.',
  },

  advanced: {
    history: 'Neural networks that work on trees and other structured data were studied in the 1990s. The name "graph neural network" was introduced by Marco Gori, Gabriele Monfardini and Franco Scarselli in 2005, and the model was set out in full by Scarselli and colleagues in a 2009 paper. In those early models the rounds were repeated until the node values settled. The approach became widely used after 2016, when Thomas Kipf and Max Welling proposed the graph convolutional network, a simple layer with a fixed, small number of rounds that worked well for classifying the nodes of citation networks. In 2017 Justin Gilmer and colleagues showed that many models then in use were cases of one scheme, which they called message passing neural networks, and William Hamilton, Rex Ying and Jure Leskovec introduced GraphSAGE, which made training practical on very large graphs by sampling neighbours. In 2019 Keyulu Xu and colleagues related the ability of these networks to tell graphs apart to the Weisfeiler-Leman test, a classical procedure for checking whether two graphs might have the same shape.',
    derivation: 'Write $h_v^{(k)}$ for the vector of numbers at node $v$ after round $k$, and $N(v)$ for its neighbours. The rule on this page is\n\n$$h_v^{(k+1)} = \\operatorname{ReLU}\\!\\left(W_{\\text{self}}\\, h_v^{(k)} + W_{\\text{nb}} \\cdot \\frac{1}{|N(v)|} \\sum_{u \\in N(v)} h_u^{(k)}\\right).$$\n\nThis is the form of a GraphSAGE layer with the mean aggregator, without a bias, without sampling of neighbours and without the normalization that GraphSAGE applies to each vector afterwards. A trained network would use different weight matrices in each round.\n\n**Matrix form.** Stack the node vectors as the rows of a matrix $H$, let $A$ be the adjacency matrix and $D$ the diagonal matrix of degrees. Then one round is\n\n$$H^{(k+1)} = \\operatorname{ReLU}\\!\\left(H^{(k)} W_{\\text{self}}^\\top + D^{-1} A\\, H^{(k)} W_{\\text{nb}}^\\top\\right).$$\n\nThe graph convolutional network of Kipf and Welling is the close relative $H^{(k+1)} = \\sigma(\\hat D^{-1/2} \\hat A \\hat D^{-1/2} H^{(k)} W)$ with $\\hat A = A + I$: each node is made its own neighbour, the averaging is symmetric, and one weight matrix serves both terms.\n\n**The general scheme.** Gilmer and colleagues write a round as $m_v = \\sum_{u \\in N(v)} M(h_v, h_u, e_{uv})$ followed by $h_v\' = U(h_v, m_v)$, where $M$ and $U$ are learned functions and $e_{uv}$ are features of the edge. The rule above takes $M$ to be the neighbour\'s vector divided by the degree and $U$ to be a linear map followed by ReLU.\n\n**Averaging makes nodes alike.** With the "average" weights and non-negative starting values the activation never acts, and a round is $H^{(k+1)} = \\tfrac{1}{2}(I + D^{-1}A)\\,H^{(k)}$. The matrix $\\tfrac{1}{2}(I + D^{-1}A)$ is the transition matrix of a lazy random walk on the graph. On a connected graph its powers converge to a matrix whose rows are all equal to the stationary distribution $\\pi_u = \\deg(u) / 2|E|$. So every node\'s value converges to the same vector, $\\sum_u \\pi_u h_u^{(0)}$: the degree-weighted average of the starting values. A test on this page checks that limit on the default graph.',
    proof: '**Locality.** Claim: $h_v^{(k)}$ is a function of the starting vectors $h_u^{(0)}$ of nodes $u$ with $\\operatorname{dist}(u, v) \\le k$ only. For $k = 0$ it is $h_v^{(0)}$ itself. If the claim holds for $k$, then $h_v^{(k+1)}$ is a function of $h_v^{(k)}$ and of $h_u^{(k)}$ for $u \\in N(v)$. Each of these depends only on starting vectors within distance $k$ of $v$ or of a neighbour of $v$, and every such node is within distance $k + 1$ of $v$.\n\n**Relabelling.** Let $P$ be a permutation matrix. Relabelling the nodes replaces $H$ by $PH$, $A$ by $PAP^\\top$ and $D$ by $PDP^\\top$. Then\n\n$$(PDP^\\top)^{-1}(PAP^\\top)(PH) = P D^{-1} A H,$$\n\nbecause $P^\\top P = I$. Multiplying on the right by a weight matrix and applying ReLU entry by entry both commute with the row permutation $P$. So one round maps $PH$ to $P$ times what it maps $H$ to, and by induction the same holds for any number of rounds. The outputs are permuted exactly as the nodes were. This property is called permutation equivariance.',
    complexityProof: 'In one round, node $v$ reads $|N(v)|$ vectors of length $d$, and $\\sum_v |N(v)| = 2|E|$, so gathering costs $O(|E|\\,d)$. Each node then applies two $d \\times d$ matrices and an activation, $O(d^2)$ per node and $O(|V|\\,d^2)$ in all. $K$ rounds cost $O(K(|E|\\,d + |V|\\,d^2))$. The experiment counts the readings: $2|E|$ per round, which is $2n$ for a ring of $n$ nodes and $n(n - 1)$ for a complete graph.',
    variants: [
      { name: 'Graph convolutional network (GCN)', text: 'Adds each node to its own neighbours, averages with a symmetric normalization, and uses a single weight matrix per layer.' },
      { name: 'GraphSAGE', text: 'Keeps separate treatment of a node\'s own value and its neighbours\' summary, and samples a fixed number of neighbours so that very large graphs can be trained on.' },
      { name: 'Graph attention network (GAT)', text: 'Replaces the plain mean by a weighted mean whose weights are computed from the two nodes\' values, so that a node can attend more to some neighbours than to others.' },
      { name: 'Graph isomorphism network (GIN)', text: 'Combines neighbours by a sum followed by a small neural network, which makes message passing as discriminating as it can be.' },
      { name: 'Edge features and edge updates', text: 'Messages can depend on numbers attached to the edge, such as the type of a chemical bond, and edges can hold values that are updated too.' },
      { name: 'Readout', text: 'For a prediction about a whole graph, the final node values are combined, by a sum or a mean, into one vector that is passed to an ordinary network.' },
    ],
    implementation: 'Store the graph as a list of edges or as a sparse matrix, and compute a round as a gather over the edges followed by one matrix multiplication for all nodes together. Keep the previous values intact until the round is complete. Guard the division for nodes without neighbours. When training, check that relabelling the nodes of an input leaves the loss unchanged. If it does not, something in the code depends on node order.',
    benchmarking: 'Report the number of rounds, the size of the node vectors, how neighbours are combined and how the data was split, since all of them move the results. Always include a baseline that ignores the edges. Repeat training with several random seeds, because differences between methods are often smaller than the spread between runs.',
    references: [
      { authors: 'F. Scarselli, M. Gori, A. C. Tsoi, M. Hagenbuchner and G. Monfardini', year: 2009, title: 'The graph neural network model', venue: 'IEEE Transactions on Neural Networks 20(1), 61-80' },
      { authors: 'T. N. Kipf and M. Welling', year: 2017, title: 'Semi-supervised classification with graph convolutional networks', venue: 'International Conference on Learning Representations (ICLR)' },
      { authors: 'J. Gilmer, S. S. Schoenholz, P. F. Riley, O. Vinyals and G. E. Dahl', year: 2017, title: 'Neural message passing for quantum chemistry', venue: 'Proceedings of the 34th International Conference on Machine Learning (ICML)' },
      { authors: 'W. L. Hamilton, R. Ying and J. Leskovec', year: 2017, title: 'Inductive representation learning on large graphs', venue: 'Advances in Neural Information Processing Systems 30' },
      { authors: 'K. Xu, W. Hu, J. Leskovec and S. Jegelka', year: 2019, title: 'How powerful are graph neural networks?', venue: 'International Conference on Learning Representations (ICLR)' },
      { authors: 'R. Ying, R. He, K. Chen, P. Eksombatchai, W. L. Hamilton and J. Leskovec', year: 2018, title: 'Graph convolutional neural networks for web-scale recommender systems', venue: 'Proceedings of the 24th ACM SIGKDD International Conference on Knowledge Discovery and Data Mining' },
    ],
    furtherReading: [
      'W. L. Hamilton, *Graph Representation Learning*, Morgan and Claypool (2020).',
      'B. Sanchez-Lengeling, E. Reif, A. Pearce and A. B. Wiltschko, "A Gentle Introduction to Graph Neural Networks", *Distill* (2021).',
      'M. M. Bronstein, J. Bruna, T. Cohen and P. Veličković, "Geometric Deep Learning: Grids, Groups, Graphs, Geodesics, and Gauges" (2021).',
    ],
  },

  tests: [
    { name: 'the default run matches an independent computation with whole matrices', input: { ...DEFAULTS },
      check: (r, c) => (matchesDense(r) === true && c.messages === 2 * 7 * 3 && c['node updates'] === 18) || `${matchesDense(r)}; ${c.messages} messages, ${c['node updates']} updates` },
    { name: 'random graphs, every weight set and both ways of combining also match it', input: { ...DEFAULTS, edges: '', nodes: 11, density: 0.4, seed: 12, features: 'random', rounds: 5 },
      check: (r) => {
        if (matchesDense(r) !== true) return matchesDense(r);
        for (const weights of Object.keys(WEIGHTS)) for (const combine of ['mean', 'sum']) for (const seed of [1, 2, 3]) {
          const fm = {};
          const rng = makeRng(seed * 13 + 5);
          const base = run({ ...DEFAULTS, edges: '', nodes: 8 + seed, density: 0.3, seed, features: 'random', weights, combine, rounds: 4 }, QUIET);
          for (const id of base.ids) fm[id] = [rng.float(-1, 1), rng.float(-1, 1)];   // negative values too, so that ReLU has work to do
          const got = run({ ...DEFAULTS, graph: base.graph, featureMap: fm, weights, combine, rounds: 4 }, QUIET);
          const ok = matchesDense(got);
          if (ok !== true) return `${weights}, ${combine}, seed ${seed}: ${ok}`;
          if (weights === 'compete' && !got.ids.some((id) => got.history[1][id].includes(0))) return 'ReLU never acted, so the test is weaker than intended';
        }
        return true;
      } },
    { name: 'relabelling the nodes relabels the outputs and changes nothing else', input: { ...DEFAULTS, edges: '', nodes: 10, density: 0.35, seed: 7, features: 'random', rounds: 4 },
      check: (r) => {
        const n = r.ids.length;
        const rename = new Map(r.ids.map((id, i) => [id, `P${(i * 7 + 3) % n}`]));
        if (new Set(rename.values()).size !== n) return 'the renaming is not one to one';
        // New names, nodes listed in reverse, edges listed in reverse and written the other way round.
        const graph = { nodes: r.graph.nodes.map((nd) => ({ ...nd, id: rename.get(nd.id) })).reverse(), edges: r.graph.edges.map((e) => ({ u: rename.get(e.v), v: rename.get(e.u), w: 1 })).reverse(), directed: false, weighted: false };
        const featureMap = Object.fromEntries(r.ids.map((id) => [rename.get(id), r.history[0][id]]));
        const p = run({ ...DEFAULTS, graph, featureMap, rounds: 4 }, QUIET);
        if (Object.keys(p.final).length !== n) return 'the relabelled run has a different number of nodes';
        for (let k = 0; k <= 4; k++) for (const id of r.ids) for (const j of [0, 1]) {
          if (!(Math.abs(p.history[k][rename.get(id)][j] - r.history[k][id][j]) <= 1e-12)) return `round ${k}: ${id} holds ${r.history[k][id][j]} but its renamed copy holds ${p.history[k][rename.get(id)][j]}`;
        }
        return r.ids.some((id) => r.final[id][0] !== r.final[r.ids[0]][0]) || 'all nodes ended alike, so the test shows nothing';
      } },
    { name: 'a value after k rounds depends only on nodes within k steps: changing a node further away changes nothing', input: { ...DEFAULTS, edges: 'A-B, B-C, C-D, D-E, E-F, F-G, G-H, C-I, I-J, E-K, K-L, G-M, J-L', seed: 9, features: 'random', rounds: 4 },
      check: (r) => {
        const D = allSteps(r);
        let farPairs = 0, nearChanges = 0;
        for (const u of r.ids) {
          const featureMap = { ...r.history[0], [u]: [r.history[0][u][0] + 1, r.history[0][u][1] + 0.75] };
          const p = run({ ...DEFAULTS, graph: r.graph, featureMap, rounds: 4 }, QUIET);
          for (let k = 0; k <= 4; k++) for (const v of r.ids) {
            const same = samePair(p.history[k][v], r.history[k][v]);
            if (D[u][v] > k) { if (k === 4) farPairs++; if (!same) return `changing ${u} altered ${v} after ${k} rounds, although they are ${D[u][v]} steps apart`; }
            else if (!same) nearChanges++;
          }
        }
        return (farPairs >= 30 && nearChanges > 100) || `only ${farPairs} pairs are more than 4 steps apart, and ${nearChanges} nearby values changed: the test is too weak`;
      } },
    { name: 'the bound is tight on the default graph: A reaches D in round 2 and E and F in round 3, not sooner', input: { ...DEFAULTS },
      check: (r) => {
        const p = run({ ...DEFAULTS, featureMap: { ...r.history[0], A: [3, 0.5] } }, QUIET);
        const moved = (k, id) => !samePair(p.history[k][id], r.history[k][id]);
        const ok = moved(1, 'B') && moved(1, 'C') && !moved(1, 'D') && moved(2, 'D') && !moved(2, 'E') && !moved(2, 'F') && moved(3, 'E') && moved(3, 'F');
        return (ok && r.dist.D === 2 && r.dist.E === 3 && r.dist.F === 3) || 'the change at A arrived too early or too late somewhere';
      } },
    { name: 'the numbers quoted for the default run', input: { ...DEFAULTS },
      check: (r) => {
        const row = (k) => r.ids.map((id) => pair(r.history[k][id])).join(' ');
        const want = ['(1, 0) (0, 0) (0, 0) (0, 0) (0, 0) (0, 0)', '(0.5, 0) (0.25, 0) (0.1667, 0) (0, 0) (0, 0) (0, 0)', '(0.3542, 0) (0.2917, 0) (0.2083, 0) (0.0278, 0) (0, 0) (0, 0)', '(0.3021, 0) (0.2865, 0) (0.2164, 0) (0.0486, 0) (0.0069, 0) (0.0069, 0)'];
        const bad = want.findIndex((w, k) => row(k) !== w);
        const two = run({ ...DEFAULTS, rounds: 2 }, QUIET).final;
        return (bad === -1 && samePair(r.history[1].D, [0, 0]) && samePair(two.E, [0, 0]) && samePair(two.F, [0, 0])) || `round ${bad}: ${row(bad)}`;
      } },
    { name: 'the worked example: four nodes in a line, two rounds', input: { ...DEFAULTS, edges: 'A-B, B-C, C-D', rounds: 2 },
      check: (r) => {
        const one = r.ids.map((id) => r.history[1][id].join('/')).join(' '), two = r.ids.map((id) => r.final[id].join('/')).join(' ');
        return (one === '0.5/0 0.25/0 0/0 0/0' && two === '0.375/0 0.25/0 0.0625/0 0/0' && r.dist.C === 2 && r.dist.D === 3) || `round 1: ${one}; round 2: ${two}`;
      } },
    { name: 'the predicted answer: on a line of five, two rounds reach A, B and C only', input: { ...DEFAULTS, edges: 'A-B, B-C, C-D, D-E', rounds: 2 },
      check: (r) => (r.ids.map((id) => (r.final[id][0] > 0 ? id : '')).join('') === 'ABC' && samePair(r.final.D, [0, 0]) && samePair(r.final.E, [0, 0])) || `final ${JSON.stringify(r.final)}` },
    { name: 'two marked nodes: each node sides with the nearer mark', input: { ...DEFAULTS, features: 'two' },
      check: (r) => {
        const side = r.ids.map((id) => (r.final[id][0] > 0 && r.final[id][1] === 0 ? 'a' : r.final[id][1] > 0 && r.final[id][0] === 0 ? 'f' : '?')).join('');
        return (side === 'aaafff' && matchesDense(r) === true) || `sides ${side}`;
      } },
    { name: 'equal starting values: the mean cannot tell nodes apart, the sum can', input: { ...DEFAULTS, features: 'same', weights: 'average', rounds: 2 },
      check: (r) => {
        if (!r.ids.every((id) => samePair(r.final[id], [1, 1]))) return `with the mean: ${JSON.stringify(r.final)}`;
        const s = run({ ...DEFAULTS, features: 'same', weights: 'average', combine: 'sum', rounds: 2 }, QUIET).final;
        return (s.C[0] === 3.5 && s.D[0] === 3.5 && ['A', 'B', 'E', 'F'].every((id) => s[id][0] === 2.5)) || `with the sum: ${JSON.stringify(s)}`;
      } },
    { name: 'a ring of six and two triangles give identical values when all nodes start alike', input: { ...DEFAULTS, edges: 'A-B, B-C, C-D, D-E, E-F, F-A', features: 'same', combine: 'sum' },
      check: (r) => {
        for (const weights of Object.keys(WEIGHTS)) for (const combine of ['mean', 'sum']) {
          const ring = run({ ...DEFAULTS, edges: 'A-B, B-C, C-D, D-E, E-F, F-A', features: 'same', weights, combine }, QUIET).final;
          const tri = run({ ...DEFAULTS, edges: 'A-B, B-C, C-A, D-E, E-F, F-D', features: 'same', weights, combine }, QUIET).final;
          if (!Object.keys(ring).every((id) => samePair(ring[id], ring.A) && samePair(tri[id], ring.A))) return `${weights}, ${combine}: the two graphs differ`;
        }
        return samePair(r.final.A, r.final.D) || 'nodes of the ring differ';
      } },
    { name: 'averaging for many rounds: the spread quoted in Try this, and the degree-weighted limit', input: { ...DEFAULTS, features: 'two', weights: 'average', rounds: 8 },
      check: (r) => {
        const firsts = (k) => r.ids.map((id) => r.history[k][id][0]);
        const lo8 = Math.min(...firsts(8)), hi8 = Math.max(...firsts(8));
        if (!(Math.min(...firsts(1)) === 0 && Math.max(...firsts(1)) === 0.5 && f4(lo8) === '0.0594' && f4(hi8) === '0.2265')) return `after round 8 the first numbers run from ${lo8} to ${hi8}`;
        // Degrees are 2, 2, 3, 3, 2, 2 (total 14), so both numbers tend to 2/14 at every node.
        const far = run({ ...DEFAULTS, features: 'two', weights: 'average', rounds: 400 }, QUIET).final;
        return r.ids.every((id) => Math.abs(far[id][0] - 1 / 7) < 1e-9 && Math.abs(far[id][1] - 1 / 7) < 1e-9) || `limit ${JSON.stringify(far)}`;
      } },
    { name: 'with neighbours only, a node forgets its own value', input: { ...DEFAULTS, edges: 'A-B, B-C, C-D, D-E', weights: 'neighbours' },
      check: (r) => (samePair(r.history[1].A, [0, 0]) && samePair(r.history[1].B, [0.5, 0]) && samePair(r.history[2].A, [0.5, 0]) && samePair(r.history[2].B, [0, 0]) && matchesDense(r) === true) || `after round 1: ${JSON.stringify(r.history[1])}` },
    { name: 'a node with no neighbours and a repeated edge are handled', input: { ...DEFAULTS, graph: { nodes: ['A', 'B', 'C'].map((id, i) => ({ id, x: 0.2 + 0.3 * i, y: 0.5 })), edges: [{ u: 'A', v: 'B', w: 1 }, { u: 'B', v: 'A', w: 1 }], directed: false, weighted: false }, featureMap: { A: [1, 0], B: [0, 2], C: [4, 4] }, weights: 'average', rounds: 2 },
      check: (r, c) => (matchesDense(r) === true && samePair(r.final.C, [1, 1]) && samePair(r.history[1].A, [0.5, 1]) && r.neighbours.B.join('') === 'A' && r.dist.C === Infinity && c.messages === 4) || `final ${JSON.stringify(r.final)}, ${c.messages} messages` },
  ],
};
