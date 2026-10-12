import { makeRng } from './rng.js';

export const nodeId = (i) => (i < 26 ? String.fromCharCode(65 + i) : `N${i}`);

// Standard input fields for graph algorithms (spread into viz.inputs).
export function graphInputs({ nodes = 8, maxNodes = 14, density = 0.35, weighted = true } = {}) {
  const fields = [
    { id: 'nodes', type: 'range', label: 'Number of nodes', min: 4, max: maxNodes, step: 1, default: nodes },
    { id: 'density', type: 'range', label: 'Extra edges', min: 0, max: 1, step: 0.05, default: density,
      help: '0 gives a sparse, tree-like graph; 1 connects most nearby nodes.' },
    { id: 'seed', type: 'seed', label: 'Random seed', default: 3 },
    { id: 'edges', type: 'text', label: 'Or type your own edges', default: '', maxLength: 600,
      help: weighted ? 'Format: A-B:4, B-C:2 (letters are nodes, the number is the weight).' : 'Format: A-B, B-C (letters are nodes).' },
  ];
  return fields;
}

function circleLayout(ids) {
  const n = ids.length;
  return ids.map((id, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return { id, x: 0.5 + 0.42 * Math.cos(a), y: 0.5 + 0.42 * Math.sin(a) };
  });
}

// A connected, mostly planar-looking random graph: nodes scattered with a minimum
// separation, a spanning tree over nearest neighbours, then extra short edges by density.
export function makeGraph({ nodes = 8, density = 0.35, seed = 3, directed = false, weighted = true, maxWeight = 9, dag = false } = {}) {
  const rng = makeRng(seed * 7919 + nodes);
  const n = Math.max(2, Math.min(600, Math.floor(nodes)));
  const pts = [];
  const minDist = 0.82 / Math.sqrt(n);
  let guard = 0;
  while (pts.length < n && guard < 6000) {
    guard++;
    const p = { x: rng.float(0.06, 0.94), y: rng.float(0.08, 0.92) };
    const relax = guard > 3000 ? 0.6 : 1;
    if (pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > minDist * relax)) pts.push(p);
  }
  while (pts.length < n) pts.push({ x: rng.float(0.06, 0.94), y: rng.float(0.08, 0.92) });
  // left-to-right order gives stable labels and a natural topological order for DAGs
  pts.sort((p, q) => p.x - q.x || p.y - q.y);
  const ns = pts.map((p, i) => ({ id: nodeId(i), x: p.x, y: p.y }));
  const d = (i, j) => Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y);
  const key = (i, j) => (i < j ? `${i}-${j}` : `${j}-${i}`);
  const have = new Set();
  const edges = [];
  const add = (i, j) => {
    if (i === j || have.has(key(i, j))) return;
    have.add(key(i, j));
    let u = i, v = j;
    if (dag || directed) { if (dag ? u > v : rng.next() < 0.5) [u, v] = [v, u]; }
    const w = weighted ? Math.max(1, Math.round(d(i, j) * 14 + rng.float(-1.5, 1.5))) : 1;
    edges.push({ u: ns[u].id, v: ns[v].id, w: Math.min(maxWeight * 2, w) });
  };
  // spanning tree (Prim over Euclidean distance) guarantees connectivity
  const inTree = [0];
  const rest = new Set(ns.map((_, i) => i).slice(1));
  while (rest.size) {
    let best = null;
    for (const i of inTree) for (const j of rest) if (!best || d(i, j) < best.d) best = { i, j, d: d(i, j) };
    add(best.i, best.j);
    inTree.push(best.j);
    rest.delete(best.j);
  }
  // extra edges, shortest first
  const cand = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (!have.has(key(i, j))) cand.push({ i, j, d: d(i, j) });
  cand.sort((a, b) => a.d - b.d);
  const extra = Math.round(density * Math.min(cand.length, n * 1.4));
  for (let k = 0; k < extra; k++) add(cand[k].i, cand[k].j);
  return { nodes: ns, edges, directed: directed || dag, weighted };
}

// "A-B:4, B-C:2" (or "A>B:4" for a directed edge). Throws user-facing errors.
export function parseEdges(text, { directed = false, weighted = true } = {}) {
  const parts = String(text).split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) throw new Error('No edges found.');
  const ids = [];
  const edges = [];
  let anyDirected = directed;
  for (const p of parts) {
    const m = p.match(/^([A-Za-z][A-Za-z0-9]{0,2})\s*(-|>|->)\s*([A-Za-z][A-Za-z0-9]{0,2})\s*(?::\s*(-?\d+(?:\.\d+)?))?$/);
    if (!m) throw new Error(`Could not read the edge "${p}". Use the form A-B:4.`);
    const u = m[1].toUpperCase(), v = m[3].toUpperCase();
    if (m[2] !== '-') anyDirected = true;
    const w = m[4] !== undefined ? Number(m[4]) : 1;
    for (const id of [u, v]) if (!ids.includes(id)) ids.push(id);
    edges.push({ u, v, w });
  }
  if (ids.length > 20) throw new Error('At most 20 nodes, please.');
  ids.sort();
  return { nodes: circleLayout(ids), edges, directed: anyDirected, weighted };
}

export function resolveGraph(input, opts = {}) {
  if (input.graph) return input.graph;
  if (typeof input.edges === 'string' && input.edges.trim()) return parseEdges(input.edges, opts);
  return makeGraph({ nodes: input.nodes, density: input.density, seed: input.seed, ...opts });
}

// Map id -> [{ to, w, e }] where e is the edge index. Undirected edges appear in both lists.
export function adjacency(graph) {
  const adj = new Map(graph.nodes.map((n) => [n.id, []]));
  graph.edges.forEach((ed, e) => {
    adj.get(ed.u).push({ to: ed.v, w: ed.w, e });
    if (!graph.directed) adj.get(ed.v).push({ to: ed.u, w: ed.w, e });
  });
  for (const list of adj.values()) list.sort((a, b) => (a.to < b.to ? -1 : 1));
  return adj;
}

// Build a `graph` view. nodeRole/nodeSub are functions of node id; edgeRole of edge index.
export function graphView(graph, { nodeRole = () => 'default', nodeSub = () => undefined, edgeRole = () => 'default', showWeights = graph.weighted !== false, title } = {}) {
  return {
    kind: 'graph',
    title,
    directed: !!graph.directed,
    nodes: graph.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, label: n.label ?? n.id, role: nodeRole(n.id) || 'default', sub: nodeSub(n.id) })),
    edges: graph.edges.map((e, i) => ({ u: e.u, v: e.v, w: showWeights ? e.w : undefined, role: edgeRole(i) || 'default' })),
  };
}

// Tidy positions for a rooted tree: x from in-order position, y from depth, both in [0,1].
// children(node) returns an array (use [left, right] with nulls for binary trees).
export function layoutTree(root, children) {
  const pos = new Map();
  let col = 0, maxDepth = 0;
  const walk = (node, depth) => {
    if (!node) return;
    const kids = (children(node) || []);
    const real = kids.filter(Boolean);
    maxDepth = Math.max(maxDepth, depth);
    if (!real.length) { pos.set(node, { col: col++, depth }); return; }
    const mid = Math.ceil(kids.length / 2);
    kids.slice(0, mid).forEach((k) => walk(k, depth + 1));
    const before = col;
    kids.slice(mid).forEach((k) => walk(k, depth + 1));
    const xs = real.map((k) => pos.get(k).col);
    const c = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : before;
    pos.set(node, { col: c, depth });
    if (real.length === 1) col = Math.max(col, c + 1);
  };
  walk(root, 0);
  const span = Math.max(1, col - 1);
  const out = new Map();
  for (const [node, p] of pos) {
    out.set(node, { x: col <= 1 ? 0.5 : 0.06 + 0.88 * (p.col / span), y: maxDepth === 0 ? 0.5 : 0.1 + 0.8 * (p.depth / maxDepth) });
  }
  return out;
}
