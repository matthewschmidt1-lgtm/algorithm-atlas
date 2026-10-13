import { graphInputs, resolveGraph, adjacency, graphView } from '../../js/lib/graphs.js';

function run(input, t) {
  const graph = resolveGraph(input, { weighted: false });
  const ids = graph.nodes.map((n) => n.id);
  const start = ids[0];
  const adj = adjacency(graph);
  const dist = new Map();
  const parent = new Map();
  const parentEdge = new Map();
  const finished = new Set();
  const order = [];
  const queue = [];
  let head = 0;
  const legend = [{ label: 'being visited', role: 'current' }, { label: 'waiting in the queue', role: 'frontier' }, { label: 'visited', role: 'done' }, { label: 'edge that first reached a node', role: 'tree' }];

  const views = ({ current, edge, edgeRole, final } = {}) => {
    const treeEdges = new Set(parentEdge.values());
    const g = graphView(graph, {
      nodeRole: (id) => (id === current ? 'current' : finished.has(id) ? 'done' : dist.has(id) ? 'frontier' : 'default'),
      nodeSub: (id) => (dist.has(id) ? dist.get(id) : undefined),
      edgeRole: (e) => (e === edge ? edgeRole : treeEdges.has(e) ? 'tree' : final ? 'dim' : 'default'),
    });
    g.legend = legend;
    const rows = { kind: 'rows', title: 'Queue (front on the left) and visit order', rows: [
      { label: 'Queue', cells: queue.slice(head).map((id) => ({ t: id, sub: dist.get(id), role: 'frontier' })) },
      { label: 'Visited', cells: order.map((id) => ({ t: id, sub: dist.get(id), role: id === current ? 'current' : 'done' })) },
    ] };
    return [g, rows];
  };

  dist.set(start, 0);
  queue.push(start);
  t.frame(() => ({ line: [1, 2], note: `Start at **${start}**. It is 0 edges away from itself. Put it in the queue: the waiting line of nodes that have been found but not yet visited.`, views: views(), vars: { start } }));

  while (head < queue.length) {
    const u = queue[head++];
    order.push(u);
    const du = dist.get(u);
    t.frame(() => ({ line: 4, note: `Take **${u}** from the front of the queue. It is ${du} ${du === 1 ? 'edge' : 'edges'} from ${start}. Now look at each of its neighbours in turn.`, views: views({ current: u }), vars: { u, 'dist[u]': du } }));
    for (const { to: v, e } of adj.get(u)) {
      t.count('edges examined');
      const isNew = !dist.has(v);
      if (isNew) {
        dist.set(v, du + 1);
        parent.set(v, u);
        parentEdge.set(v, e);
        queue.push(v);
      }
      t.frame(() => ({ line: isNew ? [6, 7, 8, 9] : [5, 6],
        note: isNew
          ? `${v} has not been found before. It is one step beyond ${u}, so it is **${du + 1}** ${du + 1 === 1 ? 'edge' : 'edges'} from ${start}. Add it to the back of the queue.`
          : `${v} was already found, at distance ${dist.get(v)}. Reaching it again through ${u} cannot be shorter, so leave it alone.`,
        views: views({ current: u, edge: e, edgeRole: isNew ? 'active' : 'rejected' }), vars: { u, v, 'dist[v]': dist.get(v) } }));
    }
    finished.add(u);
  }

  const missed = ids.filter((id) => !dist.has(id));
  const far = Math.max(...dist.values());
  t.frame(() => ({ line: 10, note: `The queue is empty, so the search is over. The number under each node is the fewest edges needed to reach it from ${start}; the farthest is ${far} away. The thick edges show one shortest route to every node.${missed.length ? ` No route leads to ${missed.join(', ')}, so ${missed.length === 1 ? 'it was' : 'they were'} never found.` : ''}`,
    views: views({ final: true }), vars: { visited: order.length, farthest: far } }));

  return {
    order, graph, start,
    dist: Object.fromEntries(ids.map((id) => [id, dist.has(id) ? dist.get(id) : Infinity])),
    parent: Object.fromEntries(parent),
  };
}

// Reference for the tests: repeated relaxation over the edge list (no queue, shares no code with run).
function referenceDistances(graph, start) {
  const d = Object.fromEntries(graph.nodes.map((n) => [n.id, Infinity]));
  d[start] = 0;
  for (let k = 0; k < graph.nodes.length; k++) {
    for (const e of graph.edges) {
      if (d[e.u] + 1 < d[e.v]) d[e.v] = d[e.u] + 1;
      if (!graph.directed && d[e.v] + 1 < d[e.u]) d[e.u] = d[e.v] + 1;
    }
  }
  return d;
}
const matchesReference = (r) => {
  const ref = referenceDistances(r.graph, r.start);
  const bad = Object.keys(ref).find((k) => ref[k] !== r.dist[k]);
  if (bad) return `distance to ${bad} is ${r.dist[bad]}, reference says ${ref[bad]}`;
  if (new Set(r.order).size !== r.order.length) return 'a node was visited twice';
  if (r.order.length !== Object.values(ref).filter((x) => x < Infinity).length) return 'not every reachable node was visited';
  for (let i = 1; i < r.order.length; i++) if (r.dist[r.order[i]] < r.dist[r.order[i - 1]]) return 'nodes were not visited in order of distance';
  return true;
};

export default {
  meta: {
    id: 'bfs',
    name: 'Breadth-First Search',
    aliases: ['BFS', 'breadth first search', 'level-order traversal', 'Lee algorithm', 'flood fill'],
    kind: 'algorithm',
    discipline: 'graph-theory',
    alsoIn: [
      { id: 'ai', why: 'It is the basic uninformed search: explore a space of states level by level until a goal state appears.' },
      { id: 'algorithms', why: 'It is the standard example of a queue at work, and many other algorithms use it as a building block.' },
    ],
    subfield: 'Graph traversal',
    family: 'Traversal',
    lab: 'graphs',
    compareGroup: 'traversal',
    summary: 'Explores a graph outward from a start node one layer at a time, which finds the route with the fewest edges to every node it can reach.',
    difficulty: 'beginner',
    order: 200,
    paradigms: ['graph-search'],
    randomized: false,
    approximate: false,
    time: { best: 'O(V + E)', average: 'O(V + E)', worst: 'O(V + E)', class: 'linear' },
    space: { worst: 'O(V)', class: 'linear' },
    tags: {
      problems: ['explore a network', 'fewest steps between two points', 'shortest route in a maze', 'degrees of separation', 'find everything connected to a starting point', 'shortest path in an unweighted graph'],
      techniques: ['queue', 'level by level', 'visited set'],
      applications: ['navigation', 'networking', 'games', 'search engines', 'robotics'],
    },
    prerequisites: ['concept:graph', 'concept:queue'],
  },

  bigIdea: {
    simple: "Breadth-first search is a way to explore a network of connected things, one layer at a time. Think of a rumour spreading through a school. On day one, a single student knows it. On day two, all of that student's friends know. On day three, the friends of those friends know, and so on. Breadth-first search explores in the same order. It starts at one point. It visits everything one step away, then everything two steps away, then three. To keep that order straight, it uses a waiting line. Each newly found point joins the back of the line, and the next point to explore always comes from the front. Because it works outward in layers, the first time it reaches a point, it has found a route there with the fewest possible steps. That is why it can find the shortest way through a maze, or the smallest number of introductions that connect two people.",
    what: 'Breadth-first search (BFS) visits every node that can be reached from a starting node, in order of how many edges away it is. A node is a point in the network and an edge is a link between two points. BFS also records, for each node, the fewest edges needed to reach it and the node it was reached from.',
    why: 'Two questions come up constantly with networks: what can be reached from here, and how few steps does it take? BFS answers both in a single pass that looks at each node and each edge a fixed number of times. Edward F. Moore described it in 1959 as a way to find the shortest path through a maze.',
    when: 'Use it to find routes with the fewest edges, to list everything connected to a starting point, or to process a network level by level. If edges have different costs, the fewest edges is no longer the cheapest route, and you need [Dijkstra\'s algorithm](#/algorithm/dijkstra). If you only need to know whether something is reachable, or want to explore one branch to its end before trying another, [depth-first search](#/algorithm/dfs) uses the same amount of work and often less memory.',
    interesting: 'The whole behaviour comes from one choice of data structure. Keep the nodes waiting to be explored in a queue (first in, first out) and you get layers and shortest routes. Swap the queue for a stack (last in, first out) and the same loop becomes depth-first search, which dives down one branch at a time.',
    where: 'Web crawlers, the garbage collectors that reclaim unused memory in some programming languages, puzzle solvers, and peer-to-peer networks all use it. It is also the kernel of the Graph500 benchmark, which ranks supercomputers by how fast they traverse very large graphs.',
    analogy: {
      title: 'Ripples from a stone dropped in a pond',
      text: "Drop a stone into still water and a ring spreads outward. Everything inside the ring has been reached and nothing beyond it has. The ring reaches nearby points first and distant points later, and it never skips ahead. In breadth-first search the waiting line plays the part of the ring. The points in the line are the outer edge of what has been found so far, and exploring from the front of the line pushes that edge outward one step at a time.",
      limits: "A ripple touches every point on a ring at the same moment. The algorithm visits one point at a time, taking them in the order of the line. A ripple also travels real distance, while the search only counts steps: a long road and a short road each count as one. When the lengths matter, the picture is still right but the algorithm must change to Dijkstra's.",
    },
  },

  example: {
    setup: "Five places are joined by paths: A to B, A to C, B to D, C to D, and D to E. Starting from A, find the fewest paths you must walk to reach each place. Neighbours are checked in alphabetical order.",
    steps: [
      "Start at A, which is 0 steps away. The waiting line holds only A.",
      "Visit A. Its neighbours B and C are new, so each is 1 step away. The line is now B, C.",
      "Visit B, the front of the line. Its neighbour A is already known. Its neighbour D is new, so D is 2 steps away. The line is now C, D.",
      "Visit C. Its neighbours A and D are both already known, so nothing changes. The line is now D.",
      "Visit D. Its neighbour E is new, so E is 3 steps away. Then visit E, which has no new neighbours. The line is empty.",
    ],
    result: "The places were visited in the order A, B, C, D, E. The step counts are B 1, C 1, D 2 and E 3. Notice that D was found through B, and when C pointed at D a moment later nothing changed: the first time a place is found is always by a shortest route.",
    tryInput: { edges: 'A-B, A-C, B-D, C-D, D-E' },
  },

  terms: [
    { term: "Graph", meaning: "A set of points joined by links. A map of friendships is a graph: the people are the points and the friendships are the links." },
    { term: "Node", meaning: "One point in a graph, such as one person or one place. Also called a vertex." },
    { term: "Edge", meaning: "One link between two nodes, such as a path between two places." },
    { term: "Neighbour", meaning: "A node joined to the current node by a single edge." },
    { term: "Queue", meaning: "A waiting line. New items join at the back, and items leave from the front, so the first one in is the first one out." },
    { term: "Visit", meaning: "To take a node from the queue and look at all of its neighbours." },
    { term: "Distance", meaning: "In this lesson, the smallest number of edges on any route between two nodes." },
    { term: "Traversal", meaning: "A methodical way of visiting every node that can be reached, without visiting any node twice." },
  ],

  takeaway: "Explore everything one step away before anything two steps away, and the first route you find to each place is a shortest one.",

  viz: {
    describe: 'A graph whose edges all count as one step. The number beneath each node is the fewest edges from the start node, shown once the node has been found. The node being visited is terracotta, nodes waiting in the queue are ochre, and visited nodes are forest green. Thick green edges are the ones that first reached each node. Below the graph, two rows list the queue from front to back and the order in which nodes were visited.',
    inputs: graphInputs({ nodes: 8, density: 0.35, weighted: false }),
    presets: [
      { label: 'Small graph', values: { nodes: 6, density: 0.3, seed: 3, edges: '' } },
      { label: 'Tree-like graph', values: { nodes: 10, density: 0, seed: 5, edges: '' } },
      { label: 'Dense graph', values: { nodes: 10, density: 0.9, seed: 8, edges: '' } },
      { label: 'Two routes to E', values: { edges: 'A-B, B-C, C-D, D-E, A-F, F-E' } },
    ],
    tryThis: [
      'Watch the numbers under the nodes in the "Visited" row. They never go down: every node at distance 1 is visited before any node at distance 2. Step through and find the moment the first distance-2 node is visited.',
      'Load "Two routes to E". One route from A to E has four edges and the other has two. Predict which edge will first reach E, then watch. The search cannot be fooled by the long way round.',
      'Type the edges `A-B, C-D`. Nodes C and D are never found, because no route leads to them from A. To explore a whole graph that is in several pieces, you would restart the search from each node not yet found.',
      'Raise "Extra edges" to 1. More and more edge checks end with "already found". Every edge still gets examined twice, once from each end.',
    ],
    run,
    report: (r, c) => `Visit order from ${r.start}: ${r.order.join(' → ')}\nFewest edges from ${r.start}: ${Object.entries(r.dist).map(([k, v]) => `${k}=${v === Infinity ? 'unreachable' : v}`).join(', ')}\n${c['edges examined'] || 0} edges examined.`,
    experiment: {
      title: 'Edges examined as the graph grows',
      note: 'Each point is a real run on a random connected graph. "Tree-like" graphs have exactly V − 1 edges; "well connected" graphs have about 2.4 edges per node. In an undirected graph every edge is examined twice, once from each end, so the count is exactly 2E.',
      metric: 'edges examined',
      metricLabel: 'Edges examined',
      sizeLabel: 'Number of nodes (V)',
      sizes: [8, 16, 32, 64, 128, 256],
      variants: [{ id: 'sparse', label: 'Tree-like graph' }, { id: 'dense', label: 'Well connected graph' }],
      input: (n, variant, seed) => ({ nodes: n, density: variant === 'dense' ? 1 : 0, seed, edges: '' }),
      theory: [
        { label: '2(V − 1), twice the edges of a tree', fn: (n) => 2 * (n - 1), variant: 'sparse' },
        { label: 'proportional to V (scaled)', fn: (n) => n, scaled: true, variant: 'dense' },
      ],
    },
  },

  logic: {
    intuition: 'Nodes leave the queue in the order they entered it. The start enters first, then its neighbours, then their neighbours. So every node at distance 1 leaves the queue before any node at distance 2, and so on outward. A node is marked as found the moment it is first seen, which means the first route to reach it wins, and that route came from the nearest layer that could reach it.',
    steps: [
      'Mark the start node as found, give it distance 0, and put it in a queue.',
      'Remove the node `u` at the front of the queue. This is the visit.',
      'Look at each neighbour `v` of `u`. If `v` has not been found, mark it as found, set its distance to one more than the distance of `u`, record that it was reached from `u`, and add it to the back of the queue.',
      'If `v` has already been found, do nothing.',
      'Repeat from step 2 until the queue is empty.',
      'To recover a shortest route to any node, follow the "reached from" links backwards to the start.',
    ],
    pseudocode: [
      'bfs(G, start):',
      '  mark start as found;  dist[start] ← 0',
      '  Q ← queue containing start',
      '  while Q is not empty:',
      '    u ← remove the node at the front of Q',
      '    for each neighbour v of u:',
      '      if v is not found:',
      '        mark v as found',
      '        dist[v] ← dist[u] + 1;  parent[v] ← u',
      '        add v to the back of Q',
      '  return dist, parent',
    ],
    decisions: [
      { title: 'Mark a node when it is found, or when it is visited?', text: 'When it is found, at the moment it joins the queue. If you wait until it leaves the queue, a node that is still waiting can be found again by another neighbour, join the queue a second time, and have its distance overwritten.' },
      { title: 'In what order are neighbours checked?', text: 'Any order gives correct distances. Different orders can give a different visit order within a layer and a different (equally short) route. This page checks neighbours alphabetically so that runs are repeatable.' },
      { title: 'Stop early?', text: 'If you want one destination, you can stop as soon as it is found: its distance is already final. The run on this page continues so that you can see every layer.' },
    ],
    invariants: [
      'The distances of the nodes in the queue, read from front to back, never decrease, and the last differs from the first by at most 1.',
      'Every node that has been found has its final, correct distance.',
      'Each node enters the queue at most once.',
    ],
    edgeCases: [
      'Nodes with no route from the start are never found. Their distance stays undefined (reported as unreachable).',
      'A graph with a single node: the start is visited and the search ends.',
      'Cycles are harmless, because a node that has been found is never added again.',
      'Directed edges are followed only in their direction, so a node can be reachable in one direction and not the other.',
      'Several shortest routes of equal length: the search reports one of them, decided by the order in which neighbours are checked.',
    ],
    correctness: 'Claim: when a node is found, its recorded distance is the fewest edges from the start. The argument goes layer by layer. The start is correct at distance 0. Suppose every node at true distance `k` is found with distance `k`, and all of them enter the queue before any node at a greater distance. A node `v` at true distance `k + 1` has at least one neighbour at distance `k`. The first such neighbour to be visited finds `v` and gives it distance `k + 1`. No node at a smaller distance is a neighbour of `v`, or `v` would be closer than `k + 1`, so nothing found it earlier. And since the layer-`k` nodes are visited before any layer-`k + 1` node, all of layer `k + 1` joins the queue before anything farther out.',
    mistakes: [
      'Marking nodes as found only when they leave the queue, which lets the same node be queued several times.',
      'Using a stack, or removing from the wrong end of a list, which turns the search into a depth-first one and loses the shortest-route guarantee.',
      'Removing the front of an array-backed list with an operation that shifts every remaining item, which makes each removal slow and the whole search quadratic.',
      'Using it on a graph whose edges have different costs and calling the result the cheapest route.',
    ],
  },

  code: {
    sample: {
      input: 'An undirected graph with edges A-D, A-E, B-D, B-E, C-E, B-F, C-F, F-G. The visit order from A, the distance to every node, and a shortest route to G.',
      expected: 'order: A D E B C F G\ndistance: A:0 B:2 C:2 D:1 E:1 F:3 G:4\npath to G: A -> D -> B -> F -> G',
    },
    python: {
      source: `from collections import deque


def bfs(graph, start):
    dist = {start: 0}
    parent = {}
    order = []
    queue = deque([start])
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in graph[u]:
            if v not in dist:
                dist[v] = dist[u] + 1
                parent[v] = u
                queue.append(v)
    return order, dist, parent


def path_to(parent, target):
    route = [target]
    while route[-1] in parent:
        route.append(parent[route[-1]])
    return route[::-1]


edges = [("A", "D"), ("A", "E"), ("B", "D"), ("B", "E"),
         ("C", "E"), ("B", "F"), ("C", "F"), ("F", "G")]
graph = {}
for u, v in edges:
    graph.setdefault(u, []).append(v)
    graph.setdefault(v, []).append(u)
for u in graph:
    graph[u].sort()

order, dist, parent = bfs(graph, "A")
print("order: " + " ".join(order))
print("distance: " + " ".join(f"{v}:{dist[v]}" for v in sorted(dist)))
print("path to G: " + " -> ".join(path_to(parent, "G")))`,
      notes: [
        { line: 5, text: 'The dictionary `dist` does two jobs. Its values are the distances, and its keys are the set of nodes found so far.' },
        { line: 10, text: '`popleft` removes from the front of the queue in constant time. A plain list would need `pop(0)`, which shifts every remaining item.' },
        { line: 13, text: 'The test and the three lines after it run at most once per node, at the moment the node is first found.' },
        { line: 16, text: 'New nodes join at the back. Front out, back in: that is what makes the search go layer by layer.' },
      ],
    },
    javascript: {
      source: `function bfs(graph, start) {
  const dist = new Map([[start, 0]]);
  const parent = new Map();
  const order = [];
  const queue = [start];
  let head = 0;  // index of the front of the queue
  while (head < queue.length) {
    const u = queue[head++];
    order.push(u);
    for (const v of graph.get(u)) {
      if (!dist.has(v)) {
        dist.set(v, dist.get(u) + 1);
        parent.set(v, u);
        queue.push(v);
      }
    }
  }
  return { order, dist, parent };
}

function pathTo(parent, target) {
  const route = [target];
  while (parent.has(route[0])) route.unshift(parent.get(route[0]));
  return route;
}

const edges = [["A", "D"], ["A", "E"], ["B", "D"], ["B", "E"],
  ["C", "E"], ["B", "F"], ["C", "F"], ["F", "G"]];
const graph = new Map();
for (const [u, v] of edges) {
  if (!graph.has(u)) graph.set(u, []);
  if (!graph.has(v)) graph.set(v, []);
  graph.get(u).push(v);
  graph.get(v).push(u);
}
for (const list of graph.values()) list.sort();

const { order, dist, parent } = bfs(graph, "A");
console.log("order: " + order.join(" "));
console.log("distance: " + [...dist.keys()].sort().map((v) => v + ":" + dist.get(v)).join(" "));
console.log("path to G: " + pathTo(parent, "G").join(" -> "));`,
    },
    cpp: {
      source: `#include <algorithm>
#include <iostream>
#include <queue>
#include <utility>
#include <vector>

int main() {
    const int n = 7;  // nodes A..G are 0..6
    std::vector<std::pair<int, int>> edges = {
        {0, 3}, {0, 4}, {1, 3}, {1, 4}, {2, 4}, {1, 5}, {2, 5}, {5, 6}};
    std::vector<std::vector<int>> graph(n);
    for (auto [u, v] : edges) {
        graph[u].push_back(v);
        graph[v].push_back(u);
    }
    for (auto& list : graph) std::sort(list.begin(), list.end());

    std::vector<int> dist(n, -1), parent(n, -1), order;
    std::queue<int> queue;
    dist[0] = 0;
    queue.push(0);
    while (!queue.empty()) {
        int u = queue.front();
        queue.pop();
        order.push_back(u);
        for (int v : graph[u]) {
            if (dist[v] == -1) {
                dist[v] = dist[u] + 1;
                parent[v] = u;
                queue.push(v);
            }
        }
    }

    auto name = [](int v) { return static_cast<char>('A' + v); };
    std::cout << "order:";
    for (int v : order) std::cout << " " << name(v);
    std::cout << "\\ndistance:";
    for (int v = 0; v < n; ++v) std::cout << " " << name(v) << ":" << dist[v];
    std::vector<int> route;
    for (int v = 6; v != -1; v = parent[v]) route.insert(route.begin(), v);
    std::cout << "\\npath to G: ";
    for (std::size_t i = 0; i < route.size(); ++i) {
        std::cout << name(route[i]) << (i + 1 < route.size() ? " -> " : "\\n");
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Each node enters the queue once and leaves it once. When a node is visited, each of its edges is examined once. Over the whole run that is every edge once in a directed graph, or twice (once from each end) in an undirected one. The total is proportional to the number of nodes plus the number of edges.',
    cases: [
      { case: 'Adjacency lists', time: 'O(V + E)', when: 'The usual representation: each node stores a list of its neighbours. Every node and every edge is handled a constant number of times.' },
      { case: 'Adjacency matrix', time: 'O(V²)', when: 'Finding the neighbours of a node means scanning a whole row of the matrix, whether or not the edges exist.' },
      { case: 'Stopping at a target', time: 'O(V + E) worst case', when: 'Often far less in practice, because the search stops once the target is found. The work is bounded by the nodes and edges within the target\'s distance.' },
    ],
    space: 'O(V) for the found marks, the distances, the parent links and the queue. In the worst case the queue holds nearly every node at once, for example when the start is joined directly to all the others.',
    memory: 'The queue holds a whole layer at a time. In graphs where layers grow quickly, such as a search tree where every state has `b` successors, a layer at depth `d` has about `b` to the power `d` entries. Memory, not time, is usually what stops breadth-first search on such problems.',
    tradeoffs: 'Breadth-first search buys shortest routes at the price of remembering an entire layer. Depth-first search remembers only the branch it is on, but its routes can be far longer than necessary. Iterative deepening repeats depth-limited depth-first searches to get shortest routes with small memory, paying with repeated work.',
    assumptions: [
      'The graph is stored as adjacency lists, so the neighbours of a node are found in time proportional to their number.',
      'Checking and setting the "found" mark of a node takes constant time.',
      'Adding to the back of the queue and removing from the front each take constant time.',
      'The chart on this page counts edge examinations made by this implementation, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Finding routes with the fewest edges when every edge counts the same.',
      'Finding everything reachable from a starting point.',
      'Problems where the answer is likely to be close to the start.',
      'Processing a graph level by level, for example printing a tree one row at a time.',
    ],
    struggles: [
      'Graphs whose edges have different costs: the route with the fewest edges may not be the cheapest.',
      'Very wide search spaces, where a single layer can be too large to hold in memory.',
      'Goals that lie deep in the graph, where depth-first search may reach one sooner with far less memory.',
    ],
    pitfalls: [
      'Marking nodes late (on removal from the queue) and so queueing the same node many times.',
      'An inefficient queue: removing the first element of an array one at a time.',
      'Forgetting that a graph may be in several pieces, so one search does not visit everything.',
    ],
    misunderstandings: [
      "\"It finds the shortest route on any map.\" It finds the route with the fewest edges. If roads have different lengths, a route with more roads can be shorter, and breadth-first search will not find it.",
      "\"It always visits every node.\" It visits every node that can be reached from the start. Nodes in a separate piece of the graph are never seen.",
      "\"The order neighbours are checked in changes the distances.\" It can change which shortest route is reported and the visit order inside a layer. The distances are always the same.",
    ],
    constraints: [
      'Graphs too large for one machine are traversed layer by layer in parallel, with each layer split across many processors.',
      'State spaces in puzzles and planning are usually generated on demand, and the set of found states, not the queue, becomes the memory bottleneck.',
    ],
    alternatives: [
      { id: 'dfs', name: 'Depth-First Search', when: 'You only need reachability, cycle detection or an ordering, and want memory proportional to the depth of the search.' },
      { id: 'dijkstra', name: 'Dijkstra\'s Algorithm', when: 'Edges have different non-negative costs.' },
      { id: 'a-star', name: 'A* Search', when: 'You want one destination and can estimate the remaining distance to it.' },
      { name: 'Iterative deepening depth-first search', when: 'You need fewest-step routes in a search space too wide to hold one layer in memory.' },
    ],
    comparison: {
      columns: ['', 'Breadth-first search', 'Depth-first search', 'Dijkstra'],
      rows: [
        ['Waiting nodes kept in', 'Queue', 'Stack (or recursion)', 'Priority queue'],
        ['Visits nodes in order of', 'Edges from the start', 'Depth along one branch', 'Cost from the start'],
        ['Shortest routes', 'Yes, by number of edges', 'No', 'Yes, by total cost'],
        ['Time', 'O(V + E)', 'O(V + E)', 'O((V + E) log V)'],
        ['Memory beyond the graph', 'O(V), a whole layer', 'O(V), one branch', 'O(V)'],
      ],
    },
  },

  applications: [
    { title: 'Garbage collection', status: 'established', text: 'Cheney\'s copying collector, published in 1970, finds the objects a program can still reach by a breadth-first traversal of the pointers between them. It uses the region the objects are copied into as its queue, so it needs no extra memory for the traversal.' },
    { title: 'Web crawling', status: 'established', text: 'A crawler treats pages as nodes and links as edges. Following links in breadth-first order from a set of starting pages is a standard crawling strategy, because pages a few links from well-known sites tend to be found early.' },
    { title: 'Benchmarking supercomputers', status: 'established', text: 'The Graph500 list ranks machines by how many edges per second they traverse while running breadth-first search on a very large synthetic graph.' },
    { title: 'Wire routing on circuit boards', status: 'established', text: 'Lee\'s 1961 algorithm routes a wire between two pins on a grid by expanding a wave of cells outward from one pin until it reaches the other. It is breadth-first search on the grid, and it finds a shortest connection if one exists.' },
    { title: 'Fewest moves in a puzzle', status: 'illustrative', text: 'Treat every arrangement of a sliding puzzle as a node and every legal move as an edge. Breadth-first search from the starting arrangement reaches the solved arrangement by a solution with the fewest possible moves.' },
    { title: 'Degrees of separation', status: 'illustrative', text: 'In a network of acquaintances, the number of introductions needed to connect two people is the breadth-first distance between them.' },
  ],

  connections: [
    { to: 'dfs', type: 'same-problem', why: 'Both visit every reachable node once and examine every edge. They differ only in which found node is explored next: the oldest (a queue) or the newest (a stack).' },
    { to: 'dijkstra', type: 'advanced', why: 'Dijkstra\'s algorithm is breadth-first search with the queue replaced by a priority queue ordered by cost. When every edge costs 1, the two visit nodes in the same order of distance.' },
    { to: 'a-star', type: 'advanced', why: 'A* also expands a frontier outward from the start, but orders it by steps taken plus an estimate of steps remaining, so it grows toward the goal instead of evenly in every direction.' },
    { to: 'topological-sort', type: 'related', why: 'Kahn\'s algorithm has the same shape: a queue of nodes that are ready, each processed once, each releasing its neighbours.' },
    { to: 'union-find', type: 'same-problem', why: 'Both can answer whether two nodes are connected. A search answers for a fixed graph; union-find keeps answering as edges are added.' },
    { to: 'concept:queue', type: 'prerequisite', why: 'First in, first out is the entire reason nodes are visited in order of distance.' },
    { to: 'concept:graph', type: 'prerequisite', why: 'The algorithm is defined on nodes and edges and nothing else.' },
    { to: 'concept:shortest-path', type: 'related', why: 'It solves the shortest-path problem in the special case where every edge has the same cost.' },
    { to: 'concept:state-space', type: 'application', why: 'Puzzles and planning problems become graph searches once each possible situation is treated as a node and each move as an edge.' },
    { to: 'discipline:ai', type: 'application', why: 'It is the reference uninformed search strategy: complete, and optimal when every action costs the same.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'What makes breadth-first search visit nodes in order of their distance from the start?',
      options: ['It sorts the nodes by distance before starting', 'It keeps found nodes in a queue, so the earliest found is visited first', 'It always follows the most recently found edge', 'It visits nodes in alphabetical order'],
      answer: 1,
      explain: [
        'The distances are not known in advance. They are what the search computes.',
        'Correct. Nearer nodes are found earlier, and a queue hands nodes back in the order they arrived.',
        'Following the newest discovery first is depth-first search, which runs down one branch.',
        'Alphabetical order is only how this page breaks ties among the neighbours of one node.',
      ],
    },
    {
      type: 'predict',
      q: 'In the graph A-B, B-C, C-D, D-E, A-F, F-E, starting from A and checking neighbours alphabetically, in what order are the nodes visited?',
      options: ['A, B, C, D, E, F', 'A, B, F, C, E, D', 'A, F, E, D, C, B', 'A, B, F, E, C, D'],
      answer: 1,
      explain: [
        'That follows one branch to its end, which is what depth-first search does.',
        'Correct. B and F are one edge away. Then C (found from B) and E (found from F) are two away, and D is three away.',
        'That also follows a single branch. Breadth-first search finishes each layer before going deeper.',
        'The layers are right but the order inside layer two is not. B was visited before F, so C joined the queue before E.',
      ],
      tryInput: { edges: 'A-B, B-C, C-D, D-E, A-F, F-E' },
    },
    {
      type: 'debug',
      q: 'On the triangle A-B, A-C, B-C starting from A, this version reports that C is 2 edges away. The right answer is 1. What is wrong?',
      code: `while queue:
    u = queue.popleft()
    seen.add(u)
    for v in graph[u]:
        if v not in seen:
            dist[v] = dist[u] + 1
            queue.append(v)`,
      options: ['It should remove from the back of the queue', 'It marks a node as seen only when it leaves the queue, so a node that is still waiting can be found again and its distance overwritten', 'It should add 2 instead of 1', 'It never visits the start node'],
      answer: 1,
      explain: [
        'Removing from the back would make it a depth-first search and would not fix the distances.',
        'Correct. While B is being visited, C is waiting in the queue but not yet in `seen`, so B "finds" it again and sets its distance to 2. Mark nodes when they are added to the queue.',
        'Each edge is one step, so adding 1 is right.',
        'The start node is in the queue at the beginning and is visited first.',
      ],
    },
    {
      type: 'choice',
      q: 'A road map has roads of different lengths. Why can breadth-first search report a route that is not the shortest?',
      options: ['It cannot handle maps with cycles', 'It counts roads, not kilometres, so it prefers one long road to two short ones', 'It only works on directed graphs', 'It stops before visiting every town'],
      answer: 1,
      explain: [
        'Cycles are no problem, because found nodes are never queued again.',
        'Correct. Every edge counts as one step. When edges have different costs, the fewest steps and the lowest total cost can be different routes.',
        'It works on both directed and undirected graphs.',
        'It visits every town that can be reached.',
      ],
    },
    {
      type: 'challenge',
      title: 'Can the graph be coloured with two colours?',
      prompt: 'A graph is called bipartite if its nodes can be coloured with two colours so that every edge joins nodes of different colours. Modify breadth-first search to decide whether a graph is bipartite, and to print the colouring when it is. Test it on a square (A-B, B-C, C-D, D-A), which is bipartite, and a triangle, which is not. Make sure it also handles graphs in several pieces.',
      hints: ['Colour each node by whether its distance from the start is even or odd.', 'The colouring fails exactly when some edge joins two nodes with the same colour. You can detect this in the "already found" branch.'],
    },
  ],

  compare: {
    idea: 'Visit nodes in order of their number of edges from the start, using a queue.',
    requires: 'Any network, with one-way or two-way links. Distances are exact when each link counts as one step.',
    sensitivity: 'Low. The work is the same for any connected graph with the same number of nodes and edges.',
    memory: 'O(V). The queue can hold an entire layer of the graph at once.',
    difficulty: 'low',
    difficultyNote: 'A dozen lines. The one thing to get right is marking nodes when they are found, not when they are visited.',
    limits: 'It ignores costs on the links. Memory use grows with how many places are the same distance away.',
    useWhen: 'You want the route with the fewest steps, or everything that can be reached, and every step counts the same.',
  },

  advanced: {
    history: 'Edward F. Moore presented the method in 1957 and published it in 1959 as a way to find the shortest path through a maze. C. Y. Lee independently described the same wave-expansion idea in 1961 for routing wires on circuit boards, and in electronic design it is still known as the Lee algorithm. The name "breadth-first" contrasts it with depth-first search, which was studied systematically in the early 1970s.',
    proof: 'Let $\\delta(v)$ be the fewest edges on any path from the start $s$ to $v$. We show $\\text{dist}[v] = \\delta(v)$ for every reachable $v$.\n\n**Upper bound.** Whenever $\\text{dist}[v]$ is set to $\\text{dist}[u] + 1$ there is an edge $(u, v)$, so by induction a path of that length exists and $\\text{dist}[v] \\ge \\delta(v)$.\n\n**Queue order.** If the queue holds $v_1, \\dots, v_r$ from front to back, then $\\text{dist}[v_1] \\le \\dots \\le \\text{dist}[v_r] \\le \\text{dist}[v_1] + 1$. Removing $v_1$ keeps this true, and any node added while visiting $v_1$ gets $\\text{dist}[v_1] + 1$, which is at least every value in the queue and at most one more than the new front. So nodes leave the queue in non-decreasing order of $\\text{dist}$.\n\n**Equality.** Suppose some node has $\\text{dist}[v] > \\delta(v)$, and choose such a $v$ with $\\delta(v)$ smallest. Let $u$ be the node before $v$ on a shortest path, so $\\delta(u) = \\delta(v) - 1$ and, by the choice of $v$, $\\text{dist}[u] = \\delta(u)$. Then $\\text{dist}[v] > \\text{dist}[u] + 1$. When $u$ is visited, $v$ is either not yet found, in which case it gets $\\text{dist}[u] + 1$, or already found from a node that left the queue no later than $u$, in which case $\\text{dist}[v] \\le \\text{dist}[u] + 1$. Both contradict the inequality.',
    complexityProof: 'A node is marked as found before it is queued, and marked nodes are never queued again, so there are at most $V$ insertions and $V$ removals, each $O(1)$. The inner loop for a node $u$ runs once per entry in its adjacency list. Summed over all visited nodes this is at most $\\sum_u \\deg(u)$, which equals $E$ for a directed graph and $2E$ for an undirected one. The total is $O(V + E)$.',
    variants: [
      { name: 'Multi-source BFS', text: 'Start with several nodes in the queue at distance 0. Each node ends up with its distance to the nearest source.' },
      { name: 'Bidirectional BFS', text: 'Search forward from the start and backward from the target at once, and stop when the two frontiers meet. With branching factor b and distance d, each side explores about b^(d/2) nodes instead of b^d.' },
      { name: '0-1 BFS', text: 'When every edge costs 0 or 1, a double-ended queue gives shortest paths in linear time: push to the front after a 0-cost edge and to the back after a 1-cost edge.' },
      { name: 'Direction-optimizing BFS', text: 'When the frontier is large, switch from "each frontier node checks its neighbours" to "each unfound node looks for a parent in the frontier". This skips most edge checks on graphs with small diameter.' },
      { name: 'Iterative deepening', text: 'Run depth-limited depth-first searches with limits 0, 1, 2 and so on. Like breadth-first search it finds a goal at the smallest possible depth, but it stores only one branch at a time and pays for that by repeating the shallow levels.' },
    ],
    implementation: 'Use a real queue: a ring buffer, a deque, or an array with a moving head index. For graphs with integer node ids, store the found marks and distances in flat arrays. A layer-at-a-time version that swaps a "current" and a "next" array is easy to parallelise and makes the layer number available without storing distances.',
    benchmarking: 'Report traversed edges per second together with the graph\'s size and degree distribution. Performance depends heavily on how scattered the memory accesses are, so the same code can differ by an order of magnitude between a grid-like graph and a social network of the same size.',
    references: [
      { authors: 'E. F. Moore', year: 1959, title: 'The shortest path through a maze', venue: 'Proceedings of the International Symposium on the Theory of Switching, Harvard University Press' },
      { authors: 'C. Y. Lee', year: 1961, title: 'An algorithm for path connections and its applications', venue: 'IRE Transactions on Electronic Computers EC-10(3), 346-365' },
      { authors: 'C. J. Cheney', year: 1970, title: 'A nonrecursive list compacting algorithm', venue: 'Communications of the ACM 13(11), 677-678' },
      { authors: 'S. Beamer, K. Asanović and D. Patterson', year: 2012, title: 'Direction-optimizing breadth-first search', venue: 'Proceedings of the International Conference on High Performance Computing, Networking, Storage and Analysis (SC \'12)' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Elementary Graph Algorithms", section on breadth-first search.',
      'S. Russell and P. Norvig, *Artificial Intelligence: A Modern Approach*, chapter on solving problems by searching.',
    ],
  },

  tests: [
    { name: 'distances match an independent relaxation on a random graph', input: { nodes: 12, density: 0.6, seed: 21, edges: '' }, check: matchesReference },
    { name: 'distances match the reference on a tree-like graph', input: { nodes: 14, density: 0, seed: 4, edges: '' }, check: matchesReference },
    { name: 'an undirected graph has every edge examined exactly twice', input: { nodes: 10, density: 0.5, seed: 9, edges: '' },
      check: (r, c) => c['edges examined'] === 2 * r.graph.edges.length || `examined ${c['edges examined']} for ${r.graph.edges.length} edges` },
    { name: 'the worked example', input: { edges: 'A-B, A-C, B-D, C-D, D-E' },
      check: (r) => (r.order.join('') === 'ABCDE' && r.dist.B === 1 && r.dist.C === 1 && r.dist.D === 2 && r.dist.E === 3 && r.parent.D === 'B') || `got order ${r.order.join('')} with D=${r.dist.D}, E=${r.dist.E}, parent of D ${r.parent.D}` },
    { name: 'the predicted visit order', input: { edges: 'A-B, B-C, C-D, D-E, A-F, F-E' },
      check: (r) => (r.order.join('') === 'ABFCED' && r.dist.E === 2 && r.parent.E === 'F') || `got ${r.order.join('')}` },
    { name: 'nodes in another piece of the graph are never found', input: { edges: 'A-B, C-D' },
      check: (r) => (r.order.join('') === 'AB' && r.dist.C === Infinity && r.dist.D === Infinity) || 'C and D should be unreachable' },
    { name: 'directed edges are followed one way only', input: { edges: 'A>B, C>B, C>A' },
      check: (r) => (r.order.join('') === 'AB' && r.dist.C === Infinity) || `got ${r.order.join('')}` },
  ],
};
