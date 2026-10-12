import { graphInputs, resolveGraph, adjacency, graphView } from '../../js/lib/graphs.js';

// A binary min-heap of [distance, nodeId] pairs that reports its comparisons to the tracer.
function makeHeap(t) {
  const h = [];
  const less = (i, j) => { t.count('heap comparisons'); return h[i][0] < h[j][0] || (h[i][0] === h[j][0] && h[i][1] < h[j][1]); };
  const swap = (i, j) => { const x = h[i]; h[i] = h[j]; h[j] = x; };
  return {
    get size() { return h.length; },
    items: () => h.slice().sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1)),
    push(item) {
      h.push(item);
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

function run(input, t) {
  const graph = resolveGraph(input, { weighted: true });
  if (graph.edges.some((e) => e.w < 0)) throw new Error('Dijkstra\'s algorithm requires non-negative edge weights. Remove the negative weight, or use Bellman-Ford.');
  const ids = graph.nodes.map((n) => n.id);
  const source = ids[0], target = ids[ids.length - 1];
  const adj = adjacency(graph);
  const dist = new Map(ids.map((id) => [id, Infinity]));
  const prev = new Map();
  const prevEdge = new Map();
  const settled = new Set();
  const order = [];
  const Q = makeHeap(t);
  const show = (d) => (d === Infinity ? '∞' : String(d));
  const legend = [{ label: 'current', role: 'current' }, { label: 'in the queue', role: 'frontier' }, { label: 'settled (final)', role: 'done' }, { label: 'shortest-path tree', role: 'tree' }];

  const views = ({ current, edge, edgeRole, pathNodes, pathEdges } = {}) => {
    const g = graphView(graph, {
      nodeRole: (id) => (pathNodes && pathNodes.has(id) ? 'path' : id === current ? 'current' : settled.has(id) ? 'done' : dist.get(id) < Infinity ? 'frontier' : 'default'),
      nodeSub: (id) => show(dist.get(id)),
      edgeRole: (e) => {
        if (pathEdges) return pathEdges.has(e) ? 'path' : 'dim';
        if (e === edge) return edgeRole || 'active';
        for (const [v, pe] of prevEdge) if (pe === e && settled.has(v)) return 'tree';
        return 'default';
      },
    });
    g.legend = legend;
    const queue = { kind: 'rows', title: 'Priority queue and settled order', rows: [
      { label: 'Queue', cells: Q.items().map(([d, id]) => ({ t: id, sub: d, role: settled.has(id) ? 'dim' : 'frontier' })) },
      { label: 'Settled', cells: order.map((id) => ({ t: id, sub: dist.get(id), role: 'done' })) },
    ] };
    return [g, queue];
  };

  dist.set(source, 0);
  Q.push([0, source]);
  t.count('heap operations');
  t.frame(() => ({ line: [1, 2, 3], note: `Every node starts at distance ∞ except the source **${source}**, which is at distance 0. The queue holds the nodes we know how to reach, closest first.`, views: views(), vars: { source, target } }));

  while (Q.size) {
    const [d, u] = Q.pop();
    t.count('heap operations');
    if (settled.has(u)) {
      t.frame(() => ({ line: [5, 6], note: `Took (${d}, ${u}) from the queue, but ${u} was already settled at distance ${dist.get(u)}. This is a stale entry, so skip it.`, views: views({ current: u }), vars: { u, d } }));
      continue;
    }
    settled.add(u);
    order.push(u);
    t.frame(() => ({ line: [5, 7], note: `**${u}** is the closest unsettled node, at distance ${d}. No shorter route to it can exist, so its distance is now final.`, views: views({ current: u }), vars: { u, 'dist[u]': d } }));
    for (const { to: v, w, e } of adj.get(u)) {
      t.count('relaxations');
      if (settled.has(v)) continue;
      const cand = d + w;
      const better = cand < dist.get(v);
      const old = dist.get(v);
      if (better) {
        dist.set(v, cand);
        prev.set(v, u);
        prevEdge.set(v, e);
        Q.push([cand, v]);
        t.count('heap operations');
      }
      t.frame(() => ({ line: better ? [9, 10, 11, 12] : [8, 9],
        note: better
          ? `Edge ${u} to ${v} costs ${w}. Reaching ${v} through ${u} costs ${d} + ${w} = **${cand}**, better than ${show(old)}. Update ${v} and add it to the queue.`
          : `Edge ${u} to ${v} costs ${w}. Going through ${u} would cost ${d} + ${w} = ${cand}, which is no better than ${show(old)}. Leave ${v} alone.`,
        views: views({ current: u, edge: e, edgeRole: better ? 'active' : 'rejected' }), vars: { u, v, 'dist[u] + w': cand, 'dist[v]': show(dist.get(v)) } }));
    }
  }

  const path = [];
  const pathEdges = new Set();
  if (dist.get(target) < Infinity) {
    for (let v = target; v !== undefined; v = prev.get(v)) { path.unshift(v); if (prevEdge.has(v)) pathEdges.add(prevEdge.get(v)); }
  }
  t.frame(() => ({ line: 13, note: path.length
    ? `The queue is empty, so every reachable node is settled. Following the "came from" links back from ${target} gives the shortest route ${path.join(' → ')} with total cost **${dist.get(target)}**.`
    : `The queue is empty. ${target} was never reached, so there is no route to it from ${source}.`,
    views: views({ pathNodes: new Set(path), pathEdges }), vars: { source, target, cost: show(dist.get(target)) } }));

  return { dist: Object.fromEntries(dist), path, source, target, order, graph };
}

// Reference answer for the tests: Bellman-Ford, which shares no code with the implementation above.
function referenceDistances(graph, source) {
  const d = Object.fromEntries(graph.nodes.map((n) => [n.id, Infinity]));
  d[source] = 0;
  for (let k = 0; k < graph.nodes.length; k++) {
    for (const e of graph.edges) {
      if (d[e.u] + e.w < d[e.v]) d[e.v] = d[e.u] + e.w;
      if (!graph.directed && d[e.v] + e.w < d[e.u]) d[e.u] = d[e.v] + e.w;
    }
  }
  return d;
}
const matchesReference = (r) => {
  const ref = referenceDistances(r.graph, r.source);
  const bad = Object.keys(ref).find((k) => ref[k] !== r.dist[k]);
  if (bad) return `distance to ${bad} is ${r.dist[bad]}, reference says ${ref[bad]}`;
  let cost = 0;
  for (let i = 1; i < r.path.length; i++) {
    const e = r.graph.edges.find((x) => (x.u === r.path[i - 1] && x.v === r.path[i]) || (x.v === r.path[i - 1] && x.u === r.path[i]));
    if (!e) return 'the reported path uses an edge that does not exist';
    cost += e.w;
  }
  return r.path.length === 0 || cost === r.dist[r.target] || 'the reported path does not have the reported cost';
};

export default {
  meta: {
    id: 'dijkstra',
    name: 'Dijkstra\'s Algorithm',
    aliases: ['Dijkstra', 'shortest path first', 'SPF', 'uniform-cost search', 'single-source shortest paths'],
    kind: 'algorithm',
    discipline: 'graph-theory',
    alsoIn: [
      { id: 'robotics', why: 'Planners run it on roadmaps and occupancy grids to find minimum-cost routes.' },
      { id: 'distributed-systems', why: 'Link-state routing protocols such as OSPF compute forwarding tables with it.' },
      { id: 'ai', why: 'Uniform-cost search, the baseline that A* improves on, is the same algorithm.' },
    ],
    subfield: 'Shortest paths',
    family: 'Single-source shortest paths',
    lab: 'graphs',
    compareGroup: 'shortest-path',
    year: 1959,
    authors: 'Edsger W. Dijkstra',
    summary: 'Finds the cheapest route from one node to every other node of a graph with non-negative edge weights by always expanding the closest unsettled node.',
    difficulty: 'intermediate',
    order: 240,
    paradigms: ['greedy', 'graph-search'],
    randomized: false,
    approximate: false,
    time: { best: 'O((V + E) log V)', average: 'O((V + E) log V)', worst: 'O((V + E) log V)', class: 'linearithmic' },
    space: { worst: 'O(V + E)', class: 'linear' },
    tags: {
      problems: ['shortest path', 'shortest route', 'cheapest route', 'fastest way between two places', 'minimum cost path', 'route planning'],
      techniques: ['priority queue', 'edge relaxation', 'greedy choice'],
      applications: ['navigation', 'networking', 'robotics', 'games', 'logistics'],
    },
    prerequisites: ['bfs', 'concept:graph', 'concept:priority-queue', 'concept:greedy'],
  },

  bigIdea: {
    simple: "Dijkstra's algorithm finds the cheapest way to get from one place to every other place on a map. Picture towns joined by roads, where each road has a cost, such as minutes of driving. You start at home, which costs nothing to reach. Then you look for the nearest town you have not finished with. Nothing closer is left, so you already know the cheapest way to get there. Mark that town as finished. Next, check each road leading out of it. If going through this town gives a cheaper way to reach a neighbour, write down the new, lower cost. Now repeat: pick the nearest unfinished town, finish it, update its neighbours. When every town is finished, you know the cheapest cost to reach each one, and the route that gets you there. Phones use this idea to plan journeys. The internet uses it to decide where to send data.",
    what: 'Given a network where every link has a cost, Dijkstra\'s algorithm finds the cheapest route from a starting node to every other node. It grows a region of "settled" nodes outward from the start, always absorbing the nearest node it has not yet settled.',
    why: 'Edsger Dijkstra designed it in 1956 to demonstrate a new computer, the ARMAC, to a general audience. He wanted a problem anyone could understand, and chose finding the shortest route between two cities on a road map of the Netherlands.',
    when: 'Use it when you need shortest paths from one source in a graph whose edge weights are all zero or positive. If some weights are negative, use [Bellman-Ford](#/algorithm/bellman-ford). If all edges cost the same, plain [breadth-first search](#/algorithm/bfs) is simpler and faster. If you only need one destination and can estimate remaining distance, [A*](#/algorithm/a-star) explores less.',
    interesting: 'It is a greedy algorithm that is provably optimal. It never reconsiders a settled node, yet it never needs to, and the reason is a single observation: with non-negative weights, a detour through a farther node cannot make a nearer node closer.',
    where: 'Internet routers running link-state protocols use it to compute forwarding tables. Navigation software builds on it with additional speedups, and games use it and its descendant A* for character movement.',
    analogy: {
      title: 'Water spreading through pipes',
      limits: "Real water flows down every pipe at once. The algorithm deals with one junction at a time, so it needs a waiting list to tell it which junction comes next. The picture also assumes every pipe has a real length. A road with a negative cost has no meaning for water, and it breaks the algorithm too.",
      text: 'Pour water into the source node of a network of pipes whose lengths equal the edge weights. The water front reaches each junction at a time equal to its shortest distance from the source, and it reaches junctions in order of that distance. Dijkstra\'s algorithm simulates the front: the priority queue always knows which junction the water will touch next.',
    },
  },

  example: {
    setup: "Four towns are joined by roads. A to B costs 4. A to C costs 1. C to B costs 2. B to D costs 5. Find the cheapest cost from A to every town.",
    steps: [
      "Start with A at cost 0. The cost of every other town is unknown, so write it as ∞ (infinity).",
      "Finish A. Its roads lead to B and C, so B now has cost 4 and C has cost 1.",
      "The nearest unfinished town is C, at cost 1. Finish C. Going through C, B costs 1 + 2 = 3. That beats 4, so B's cost drops to 3.",
      "The nearest unfinished town is now B, at cost 3. Finish B. Going through B, D costs 3 + 5 = 8.",
      "Only D is left, at cost 8. Finish D. Every town is finished.",
    ],
    result: "The cheapest costs from A are: C is 1, B is 3, D is 8. The cheapest route to D is A, C, B, D. The direct road from A to B was never used, because the detour through C is cheaper.",
    tryInput: { edges: 'A-B:4, A-C:1, C-B:2, B-D:5' },
  },

  terms: [
    { term: "Graph", meaning: "A set of points joined by links. A road map is a graph: the towns are the points and the roads are the links." },
    { term: "Node", meaning: "One point in a graph, such as a town on the map. Also called a vertex." },
    { term: "Edge", meaning: "One link between two nodes, such as a road between two towns." },
    { term: "Weight", meaning: "The cost attached to an edge, such as distance, time or price." },
    { term: "Shortest path", meaning: "The route between two nodes whose weights add up to the smallest total." },
    { term: "Settled", meaning: "A node whose cheapest cost is known for certain and will not change again." },
    { term: "Priority queue", meaning: "A waiting list that always hands back the item with the smallest value first." },
    { term: "Relaxing an edge", meaning: "Checking whether going through one node gives a cheaper way to reach its neighbour, and recording the lower cost if it does." },
  ],

  takeaway: "Always finish the nearest unfinished place next, and use it to improve your best guesses for its neighbours.",

  viz: {
    describe: 'A weighted graph. Each node shows its best known distance from the source beneath it. The node being processed is terracotta, nodes waiting in the priority queue are ochre, settled nodes are forest green, and the edges of the shortest-path tree are drawn thick. Below the graph, two rows list the priority queue contents and the order in which nodes were settled.',
    inputs: graphInputs({ nodes: 8, density: 0.4, weighted: true }),
    presets: [
      { label: 'Small graph', values: { nodes: 6, density: 0.35, seed: 3, edges: '' } },
      { label: 'Dense graph', values: { nodes: 10, density: 0.9, seed: 8, edges: '' } },
      { label: 'A tempting wrong turn', values: { edges: 'A-B:1, B-C:1, C-F:9, A-D:4, D-E:1, E-F:1' } },
    ],
    tryThis: [
      'Load "A tempting wrong turn". The first edges out of A are cheap toward B and C, but the best route to F goes through D. Watch the algorithm settle B and C first and still find the right answer.',
      'Type your own edges with one negative weight, for example `A-B:2, B-C:-3, A-C:1`. The algorithm refuses to run, because its central guarantee no longer holds.',
      'Raise "Extra edges" to 1 and watch the queue. More edges mean more distance updates, and stale queue entries start to appear.',
    ],
    run,
    report: (r, c) => `Distances from ${r.source}: ${Object.entries(r.dist).map(([k, v]) => `${k}=${v === Infinity ? '∞' : v}`).join(', ')}\nShortest route to ${r.target}: ${r.path.length ? r.path.join(' → ') + ` (cost ${r.dist[r.target]})` : 'unreachable'}\n${c.relaxations || 0} edge relaxations, ${c['heap operations'] || 0} priority-queue operations.`,
    experiment: {
      title: 'Priority-queue work as the graph grows',
      note: 'Each point is a real run on a random connected graph with roughly 1.5 edges per node. The curve is n log₂ n scaled to pass through the last measured point, to compare shapes.',
      metric: 'heap comparisons',
      metricLabel: 'Heap comparisons',
      sizeLabel: 'Number of nodes (V)',
      sizes: [8, 16, 32, 64, 128, 256],
      variants: [{ id: 'sparse', label: 'Sparse graph' }],
      input: (n, variant, seed) => ({ nodes: n, density: 0.4, seed, edges: '' }),
      theory: [{ label: 'n log₂ n (scaled)', fn: (n) => n * Math.log2(n), scaled: true }],
    },
  },

  logic: {
    intuition: 'Keep a best-known distance for every node. The unsettled node with the smallest best-known distance cannot be improved by any route through other unsettled nodes, because those are all at least as far away and edges cannot have negative cost. So that node\'s distance is final. Settle it, use its edges to improve its neighbours, and repeat.',
    steps: [
      'Set the distance of the source to 0 and of every other node to infinity. Put the source in a priority queue ordered by distance.',
      'Remove the node `u` with the smallest distance from the queue. If it was already settled, discard it and take the next.',
      'Mark `u` as settled. Its distance is now final.',
      'For each edge from `u` to a neighbour `v` with weight `w`, check whether `dist[u] + w` is smaller than `dist[v]`. If so, update `dist[v]`, record that `v` is reached from `u`, and add `v` to the queue with its new distance. This check is called **relaxing** the edge.',
      'Repeat from step 2 until the queue is empty.',
      'To recover a route, follow the recorded "reached from" links backwards from the destination to the source.',
    ],
    pseudocode: [
      'dijkstra(G, source):',
      '  for each node v: dist[v] ← ∞, prev[v] ← none',
      '  dist[source] ← 0',
      '  Q ← priority queue containing (0, source)',
      '  while Q is not empty:',
      '    (d, u) ← remove the smallest entry from Q',
      '    if u is settled: continue',
      '    mark u as settled',
      '    for each edge (u, v) with weight w:',
      '      if dist[u] + w < dist[v]:',
      '        dist[v] ← dist[u] + w',
      '        prev[v] ← u',
      '        insert (dist[v], v) into Q',
      '  return dist, prev',
    ],
    decisions: [
      { title: 'Which node to settle next?', text: 'Always the unsettled node with the smallest tentative distance. This greedy choice is the whole algorithm; the priority queue exists to make it fast.' },
      { title: 'Decrease-key or lazy deletion?', text: 'When a node\'s distance improves, a textbook heap updates its entry in place. This lesson, like most practical code, simply inserts a new entry and skips stale ones when they surface. The queue can hold up to E entries, but the code is shorter and usually faster.' },
      { title: 'Stop early?', text: 'If only one destination matters, the loop can stop as soon as that node is settled. The run on this page continues so that you can see the full shortest-path tree.' },
    ],
    invariants: [
      'For every settled node, `dist` is the true shortest distance from the source.',
      'For every unsettled node, `dist` is the length of the shortest route that passes only through settled nodes before its final edge.',
      'Nodes are settled in non-decreasing order of distance.',
    ],
    edgeCases: [
      'Negative edge weights break the guarantee: a node can be settled before a cheaper route through a negative edge is discovered.',
      'Unreachable nodes keep distance infinity and are never settled.',
      'Zero-weight edges are fine.',
      'Several shortest routes of equal cost: the algorithm returns one of them, decided by tie-breaking in the queue.',
      'Summing large weights can overflow fixed-width integers; do not initialize infinity to the maximum integer and then add to it.',
    ],
    correctness: 'Claim: when a node `u` is removed from the queue for the first time, `dist[u]` equals the true shortest distance. Suppose not, and let `u` be the first node for which it fails. Take a true shortest route to `u`, and let `y` be the first node on it that is not yet settled, with settled predecessor `x`. When `x` was settled its edges were relaxed, so `dist[y]` is at most the true distance to `y`. Because weights are non-negative, the true distance to `y` is at most the true distance to `u`, which is less than `dist[u]`. So `dist[y] < dist[u]`, and the queue would have produced `y` before `u`. That contradicts the choice of `u`.',
    mistakes: [
      'Running it on a graph with negative weights and trusting the result.',
      'Marking nodes as settled when they are inserted into the queue rather than when they are removed. That is correct for breadth-first search but wrong here.',
      'Forgetting to skip stale queue entries with lazy deletion, which wastes time re-relaxing edges.',
      'Using an unordered list for the queue on a large sparse graph, giving O(V²) when O((V + E) log V) was available.',
    ],
  },

  code: {
    sample: {
      input: 'An undirected graph with edges A-B:4, A-C:2, B-C:1, B-D:5, C-D:8, C-E:10, D-E:2, D-F:6, E-F:3. Shortest paths from A, and the route to F.',
      expected: 'A:0 B:3 C:2 D:8 E:10 F:13\nA -> C -> B -> D -> E -> F',
    },
    python: {
      source: `import heapq

def dijkstra(graph, source):
    dist = {v: float("inf") for v in graph}
    prev = {}
    dist[source] = 0
    queue = [(0, source)]
    settled = set()
    while queue:
        d, u = heapq.heappop(queue)
        if u in settled:
            continue
        settled.add(u)
        for v, w in graph[u]:
            if d + w < dist[v]:
                dist[v] = d + w
                prev[v] = u
                heapq.heappush(queue, (dist[v], v))
    return dist, prev


def path_to(prev, target):
    route = [target]
    while route[-1] in prev:
        route.append(prev[route[-1]])
    return route[::-1]


edges = [("A", "B", 4), ("A", "C", 2), ("B", "C", 1), ("B", "D", 5), ("C", "D", 8),
         ("C", "E", 10), ("D", "E", 2), ("D", "F", 6), ("E", "F", 3)]
graph = {}
for u, v, w in edges:
    graph.setdefault(u, []).append((v, w))
    graph.setdefault(v, []).append((u, w))

dist, prev = dijkstra(graph, "A")
print(" ".join(f"{v}:{dist[v]}" for v in sorted(graph)))
print(" -> ".join(path_to(prev, "F")))`,
      notes: [
        { line: 7, text: 'The queue holds (distance, node) pairs. Python\'s `heapq` keeps the smallest pair at the front.' },
        { line: 11, text: 'Lazy deletion: a node may appear in the queue several times with different distances. Only its first (smallest) appearance counts.' },
        { line: 15, text: 'Relaxation. `d` is the final distance to `u`, so `d + w` is the cost of reaching `v` through `u`.' },
        { line: 18, text: 'Instead of decreasing the key of an existing entry, push a fresh one. The older, larger entry becomes stale.' },
      ],
    },
    javascript: {
      source: `class MinHeap {
  constructor() { this.h = []; }
  get size() { return this.h.length; }
  push(item) {
    const h = this.h;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p][0] <= h[i][0]) break;
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
        if (l < h.length && h[l][0] < h[m][0]) m = l;
        if (r < h.length && h[r][0] < h[m][0]) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }
}

function dijkstra(graph, source) {
  const dist = new Map([...graph.keys()].map((v) => [v, Infinity]));
  const prev = new Map();
  const settled = new Set();
  const queue = new MinHeap();
  dist.set(source, 0);
  queue.push([0, source]);
  while (queue.size) {
    const [d, u] = queue.pop();
    if (settled.has(u)) continue;
    settled.add(u);
    for (const [v, w] of graph.get(u)) {
      if (d + w < dist.get(v)) {
        dist.set(v, d + w);
        prev.set(v, u);
        queue.push([d + w, v]);
      }
    }
  }
  return { dist, prev };
}

function pathTo(prev, target) {
  const route = [target];
  while (prev.has(route[0])) route.unshift(prev.get(route[0]));
  return route;
}

const edges = [["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5], ["C", "D", 8],
  ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3]];
const graph = new Map();
for (const [u, v, w] of edges) {
  if (!graph.has(u)) graph.set(u, []);
  if (!graph.has(v)) graph.set(v, []);
  graph.get(u).push([v, w]);
  graph.get(v).push([u, w]);
}

const { dist, prev } = dijkstra(graph, "A");
console.log([...graph.keys()].sort().map((v) => v + ":" + dist.get(v)).join(" "));
console.log(pathTo(prev, "F").join(" -> "));`,
    },
    cpp: {
      source: `#include <functional>
#include <iostream>
#include <limits>
#include <queue>
#include <string>
#include <utility>
#include <vector>

int main() {
    const int n = 6;  // nodes A..F are 0..5
    const int INF = std::numeric_limits<int>::max();
    std::vector<std::vector<std::pair<int, int>>> graph(n);
    auto add = [&](int u, int v, int w) {
        graph[u].push_back({v, w});
        graph[v].push_back({u, w});
    };
    add(0, 1, 4); add(0, 2, 2); add(1, 2, 1); add(1, 3, 5); add(2, 3, 8);
    add(2, 4, 10); add(3, 4, 2); add(3, 5, 6); add(4, 5, 3);

    std::vector<int> dist(n, INF), prev(n, -1);
    std::vector<bool> settled(n, false);
    using Entry = std::pair<int, int>;  // (distance, node)
    std::priority_queue<Entry, std::vector<Entry>, std::greater<Entry>> queue;
    dist[0] = 0;
    queue.push({0, 0});
    while (!queue.empty()) {
        auto [d, u] = queue.top();
        queue.pop();
        if (settled[u]) continue;
        settled[u] = true;
        for (auto [v, w] : graph[u]) {
            if (d + w < dist[v]) {
                dist[v] = d + w;
                prev[v] = u;
                queue.push({dist[v], v});
            }
        }
    }

    for (int v = 0; v < n; ++v) {
        std::cout << static_cast<char>('A' + v) << ":" << dist[v] << (v + 1 < n ? " " : "\\n");
    }
    std::vector<int> route;
    for (int v = 5; v != -1; v = prev[v]) route.insert(route.begin(), v);
    for (std::size_t i = 0; i < route.size(); ++i) {
        std::cout << static_cast<char>('A' + route[i]) << (i + 1 < route.size() ? " -> " : "\\n");
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Each node is settled once and each edge is relaxed once per direction. With a binary heap, each queue insertion or removal costs O(log V), and there are at most V + E of them, giving O((V + E) log V).',
    cases: [
      { case: 'Binary heap', time: 'O((V + E) log V)', when: 'The usual choice. Best for sparse graphs, where E is close to V.' },
      { case: 'Unsorted array', time: 'O(V²)', when: 'Dijkstra\'s original formulation. Better than a heap when the graph is dense (E close to V²).' },
      { case: 'Fibonacci heap', time: 'O(E + V log V)', when: 'Asymptotically the best comparison-based bound, but large constant factors make it rare in practice.' },
    ],
    space: 'O(V) for distances, predecessors and the settled set, plus the queue: O(V) with decrease-key or up to O(E) with lazy deletion. The graph itself takes O(V + E).',
    memory: 'On very large graphs such as continental road networks the queue and distance arrays fit easily; the cost is dominated by cache misses while chasing adjacency lists.',
    tradeoffs: 'Dijkstra explores in every direction equally. When there is a single destination and a good distance estimate, A* settles far fewer nodes. When the same graph is queried repeatedly, preprocessing methods answer queries orders of magnitude faster at the cost of memory and build time.',
    assumptions: [
      'All edge weights are non-negative.',
      'The graph is stored as adjacency lists, so a node\'s edges are found in time proportional to their number.',
      'Arithmetic on distances takes constant time.',
      'The chart on this page counts heap comparisons made by this implementation, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Single-source shortest paths on graphs with non-negative weights.',
      'Sparse graphs such as road maps and network topologies.',
      'As a subroutine: many other algorithms call it repeatedly.',
    ],
    struggles: [
      'Any graph with a negative edge weight: results can be wrong.',
      'A single far-away destination in a huge graph: it expands in all directions without guidance.',
      'Unweighted graphs, where breadth-first search gives the same answer without a priority queue.',
    ],
    misunderstandings: [
      "\"It finds the route with the fewest roads.\" It finds the route with the smallest total cost. A route with more roads can be cheaper than a direct one.",
      "\"It works on any graph.\" It needs every cost to be zero or more. With a negative cost it can return a wrong answer and give no warning.",
      "\"It gives one route to one destination.\" A single run gives the cheapest cost from the start to every node that can be reached.",
    ],
    pitfalls: [
      'Integer overflow when adding to an "infinity" sentinel.',
      'Comparing floating-point distances for exact equality.',
      'Treating a node as final when first seen instead of when removed from the queue.',
    ],
    constraints: [
      'Road networks change with traffic; production systems recompute or use time-dependent variants.',
      'Routing protocols must rerun the computation whenever link state changes, which bounds how large a single routing area can be.',
    ],
    alternatives: [
      { id: 'bfs', name: 'Breadth-First Search', when: 'Every edge has the same cost.' },
      { id: 'bellman-ford', name: 'Bellman-Ford', when: 'Some edges have negative weights, or you need to detect negative cycles.' },
      { id: 'a-star', name: 'A* Search', when: 'You want one destination and have an admissible estimate of remaining distance.' },
      { id: 'floyd-warshall', name: 'Floyd-Warshall', when: 'You need shortest paths between all pairs of nodes in a small dense graph.' },
    ],
    comparison: {
      columns: ['', 'Dijkstra', 'BFS', 'Bellman-Ford', 'A*'],
      rows: [
        ['Edge weights', 'Non-negative', 'All equal', 'Any (no negative cycle)', 'Non-negative'],
        ['Time', 'O((V + E) log V)', 'O(V + E)', 'O(V · E)', 'Depends on the heuristic'],
        ['Finds', 'All distances from source', 'All distances from source', 'All distances from source', 'One source-to-goal route'],
        ['Extra requirement', 'Priority queue', 'Queue', 'None', 'Admissible heuristic'],
      ],
    },
  },

  applications: [
    { title: 'Internet routing (OSPF and IS-IS)', status: 'established', text: 'Link-state routing protocols have every router learn the network topology and then run Dijkstra\'s algorithm, with itself as the source, to build its forwarding table. The protocol name OSPF stands for Open Shortest Path First.' },
    { title: 'Road navigation', status: 'established', text: 'Route planners are built on Dijkstra\'s algorithm. Because continental road graphs have tens of millions of nodes, production systems add goal direction (A*) and preprocessing techniques such as contraction hierarchies, which preserve its exact answers while exploring far less.' },
    { title: 'Robot path planning', status: 'established', text: 'A robot\'s map is often an occupancy grid or a roadmap graph with traversal costs. Dijkstra\'s algorithm, or A* on top of it, yields the minimum-cost path, and running it backwards from the goal yields a navigation function for every cell.' },
    { title: 'Least-cost paths in other networks', status: 'illustrative', text: 'Any problem that can be drawn as nodes and non-negative costs fits: cheapest chain of shipments in a logistics network, lowest-latency relay chain, or minimum-effort sequence of edits between states of a puzzle.' },
  ],

  connections: [
    { to: 'bfs', type: 'prerequisite', why: 'Breadth-first search is Dijkstra\'s algorithm when every edge costs 1. Replacing its plain queue with a priority queue is the only change needed to handle weights.' },
    { to: 'a-star', type: 'advanced', why: 'A* orders the queue by distance so far plus an estimate of distance remaining. With an estimate of zero it is exactly Dijkstra\'s algorithm.' },
    { to: 'bellman-ford', type: 'same-problem', why: 'Both relax edges until distances stop improving. Bellman-Ford relaxes every edge V − 1 times and so tolerates negative weights; Dijkstra relaxes each edge once by choosing the order cleverly.' },
    { to: 'heap-sort', type: 'related', why: 'Both are driven by the same binary heap: repeatedly remove the smallest remaining item.' },
    { to: 'kruskal', type: 'related', why: 'Both are greedy graph algorithms with exchange-style optimality proofs. Kruskal picks the cheapest edge overall; Dijkstra picks the closest node to the source.' },
    { to: 'concept:greedy', type: 'prerequisite', why: 'It commits to the locally best choice, the nearest unsettled node, and never revises it. Non-negative weights are what make that safe.' },
    { to: 'concept:relaxation', type: 'prerequisite', why: 'Its only operation on distances is relaxation: replace an estimate when a route through a neighbour is shorter.' },
    { to: 'concept:dynamic-programming', type: 'related', why: 'Shortest distances obey the optimal-substructure equation dist(v) = min over edges (u, v) of dist(u) + w. Dijkstra evaluates this recurrence in an order that makes each value final when first computed.' },
    { to: 'discipline:distributed-systems', type: 'application', why: 'Link-state routing has every router run this algorithm on a shared map of the network.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'At what moment is a node\'s distance guaranteed to be final?',
      options: ['When it is first inserted into the priority queue', 'When its distance is first updated', 'When it is removed from the priority queue for the first time', 'Only when the algorithm ends'],
      answer: 2,
      explain: [
        'A node can be inserted with one distance and later reached more cheaply through another node.',
        'The first update is only the first route found, not necessarily the best.',
        'Correct. Every other unsettled node is at least as far away, and non-negative edges cannot make a route through them shorter.',
        'Distances become final one node at a time, in increasing order, well before the end.',
      ],
    },
    {
      type: 'predict',
      q: 'In the graph A-B:1, B-C:1, C-F:9, A-D:4, D-E:1, E-F:1, starting from A, what is the shortest distance to F?',
      options: ['11', '6', '5', '7'],
      answer: 1,
      explain: [
        '11 is the cost of A, B, C, F. That route starts cheaply but ends with an expensive edge.',
        'Correct. A to D costs 4, D to E costs 1, and E to F costs 1.',
        'There is no route that cheap; count the edges on A, D, E, F again.',
        'Check the weights: 4 + 1 + 1.',
      ],
      tryInput: { edges: 'A-B:1, B-C:1, C-F:9, A-D:4, D-E:1, E-F:1' },
    },
    {
      type: 'debug',
      q: 'This version returns wrong distances on some graphs. What is the bug?',
      code: `while queue:
    d, u = heapq.heappop(queue)
    for v, w in graph[u]:
        if v not in seen and d + w < dist[v]:
            dist[v] = d + w
            seen.add(v)
            heapq.heappush(queue, (dist[v], v))`,
      options: ['It uses a heap instead of a list', 'It marks a node as seen when first reached, so later, cheaper routes to it are ignored', 'It should push (v, dist[v]) rather than (dist[v], v)', 'It never initializes dist'],
      answer: 1,
      explain: [
        'A heap is the right structure here.',
        'Correct. A node must stay open to improvement until it is removed from the queue. Marking on insertion is a breadth-first search habit that fails with weights.',
        'The distance must come first so the heap orders by distance.',
        'Initialization is not shown, but the visible bug is the early marking.',
      ],
    },
    {
      type: 'choice',
      q: 'Why does a negative edge weight break the algorithm?',
      options: ['Priority queues cannot store negative numbers', 'A settled node could later be reached more cheaply through an unsettled node', 'The graph becomes disconnected', 'Distances would overflow'],
      answer: 1,
      explain: [
        'Heaps order negative numbers without difficulty.',
        'Correct. The proof relies on "going through a farther node cannot help". A negative edge out of a farther node can make it help.',
        'Edge signs do not affect connectivity.',
        'Overflow is a separate, unrelated hazard.',
      ],
    },
    {
      type: 'challenge',
      title: 'Stop early, then go bidirectional',
      prompt: 'Change the implementation to stop as soon as the destination is settled, and count how many nodes it settles on a 20 by 20 grid graph from one corner to the opposite corner. Then implement bidirectional search: run one search forward from the source and one backward from the destination, alternating, and stop when the frontiers have met and no shorter connection is possible. Compare the number of settled nodes.',
      hints: ['Stopping when the two searches first touch is not sufficient; keep the best meeting cost seen so far.', 'You can stop when the sum of the two queues\' minimum keys is at least the best meeting cost.'],
    },
  ],

  compare: {
    idea: 'Settle nodes in order of distance from the source, relaxing each edge once.',
    requires: 'All edge weights must be non-negative. With that, the answer is exact.',
    sensitivity: 'Low. Work depends on the number of nodes and edges, not on the weights themselves.',
    memory: 'O(V) for distances plus a priority queue of up to O(E) entries.',
    difficulty: 'moderate',
    difficultyNote: 'Straightforward with a library priority queue; subtle if you implement decrease-key yourself.',
    limits: 'Fails with negative weights. Explores in all directions even when only one destination matters.',
    useWhen: 'Weights are non-negative and you want distances from one source to many nodes.',
  },

  advanced: {
    history: 'Dijkstra conceived the algorithm in 1956 at the Mathematical Centre in Amsterdam and published it three years later in a three-page paper that also contained a minimum spanning tree algorithm. By his own account he designed it in about twenty minutes, without pencil and paper, while sitting at a café. The original version scans an array for the minimum and runs in O(V²). The heap-based formulation came later, and in 1987 Fredman and Tarjan introduced Fibonacci heaps to obtain O(E + V log V).',
    proof: 'Let $\\delta(v)$ denote the true shortest distance from the source $s$ to $v$. We show by induction on the number of settled nodes that $\\text{dist}[u] = \\delta(u)$ when $u$ is settled.\n\nThe base case is $s$ with $\\text{dist}[s] = 0 = \\delta(s)$. For the step, suppose $u$ is about to be settled and $\\text{dist}[u] > \\delta(u)$. Consider a shortest path from $s$ to $u$ and let $(x, y)$ be its first edge leaving the settled set $S$. By the induction hypothesis $\\text{dist}[x] = \\delta(x)$, and $(x,y)$ was relaxed when $x$ was settled, so\n\n$$\\text{dist}[y] \\le \\delta(x) + w(x,y) = \\delta(y) \\le \\delta(u) < \\text{dist}[u].$$\n\nThe middle inequality holds because $y$ precedes $u$ on a shortest path and all weights are non-negative. But then $y$, not $u$, has the smallest tentative distance, a contradiction.',
    complexityProof: 'With lazy deletion, each successful relaxation inserts one entry, so at most $E$ entries (plus one for the source) are ever inserted and each is removed at most once. Every insertion or removal on a binary heap of at most $E$ entries costs $O(\\log E) = O(\\log V)$ since $E \\le V^2$. Scanning adjacency lists costs $O(V + E)$ in total. The sum is $O((V + E)\\log V)$.',
    variants: [
      { name: 'Uniform-cost search', text: 'The name used in AI for the same procedure when the graph is generated on the fly and the search stops at the first goal node settled.' },
      { name: 'Bidirectional Dijkstra', text: 'Searches forward from the source and backward from the target and joins the two, typically settling far fewer nodes.' },
      { name: 'Dial\'s algorithm', text: 'Replaces the heap with an array of buckets when weights are small integers, giving O(E + V·C) for maximum weight C.' },
      { name: 'Contraction hierarchies', text: 'Preprocess a road network by adding shortcut edges so that queries, still exact, settle only a few hundred nodes.' },
    ],
    implementation: 'Prefer adjacency arrays to pointer-based lists for cache locality. With lazy deletion, check the settled flag (or compare the popped distance with the stored one) before relaxing. Use 64-bit integers or check for overflow when weights are large.',
    benchmarking: 'When comparing against A* or bidirectional variants, report the number of settled nodes as well as time: it is independent of machine and language, and it is what the speedup techniques actually reduce.',
    references: [
      { authors: 'E. W. Dijkstra', year: 1959, title: 'A note on two problems in connexion with graphs', venue: 'Numerische Mathematik 1, 269-271' },
      { authors: 'M. L. Fredman and R. E. Tarjan', year: 1987, title: 'Fibonacci heaps and their uses in improved network optimization algorithms', venue: 'Journal of the ACM 34(3), 596-615' },
      { authors: 'T. J. Misa (interviewer) and P. L. Frana (editor)', year: 2010, title: 'An interview with Edsger W. Dijkstra', venue: 'Communications of the ACM 53(8), 41-47' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Single-Source Shortest Paths".',
      'J. Moy, *OSPF Version 2*, RFC 2328 (1998), section 16 describes the routing table calculation.',
    ],
  },

  tests: [
    { name: 'matches an independent Bellman-Ford on a random graph', input: { nodes: 12, density: 0.6, seed: 21, edges: '' }, check: matchesReference },
    { name: 'matches the reference on a sparse graph', input: { nodes: 9, density: 0, seed: 4, edges: '' }, check: matchesReference },
    { name: 'finds the non-greedy route', input: { edges: 'A-B:1, B-C:1, C-F:9, A-D:4, D-E:1, E-F:1' },
      check: (r) => (r.dist.F === 6 && r.path.join('') === 'ADEF') || `got distance ${r.dist.F} via ${r.path.join('')}` },
    { name: 'the worked example', input: { edges: 'A-B:4, A-C:1, C-B:2, B-D:5' },
      check: (r) => (r.dist.B === 3 && r.dist.C === 1 && r.dist.D === 8 && r.path.join('') === 'ACBD') || `got B=${r.dist.B} D=${r.dist.D} via ${r.path.join('')}` },
    { name: 'reports unreachable nodes', input: { edges: 'A-B:2, C-D:1' },
      check: (r) => (r.dist.D === Infinity && r.path.length === 0) || 'D should be unreachable' },
  ],
};
