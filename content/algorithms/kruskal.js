import { graphInputs, resolveGraph, graphView } from '../../js/lib/graphs.js';

function run(input, t) {
  const graph = resolveGraph(input, { weighted: true });
  if (graph.directed) throw new Error('A spanning tree is defined for graphs whose edges work in both directions. Write the edges without arrows, for example A-B:4.');
  const ids = graph.nodes.map((nd) => nd.id);
  const n = ids.length;

  // Inline union-find: parent links with path halving, and union by size.
  const parent = new Map(ids.map((id) => [id, id]));
  const size = new Map(ids.map((id) => [id, 1]));
  const find = (x) => {
    t.count('find operations');
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const rootOf = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x; };   // read-only, for the picture

  // A stable merge sort over edge indices, so that the comparisons can be counted.
  const sortEdges = (list) => {
    if (list.length < 2) return list;
    const mid = list.length >> 1;
    const a = sortEdges(list.slice(0, mid)), b = sortEdges(list.slice(mid));
    const out = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      t.count('comparisons');
      out.push(graph.edges[b[j]].w < graph.edges[a[i]].w ? b[j++] : a[i++]);
    }
    while (i < a.length) out.push(a[i++]);
    while (j < b.length) out.push(b[j++]);
    return out;
  };

  const status = new Map();     // edge index -> 'tree' | 'rejected'
  const tree = [];
  let weight = 0;
  let sorted = graph.edges.map((_, e) => e);
  let isSorted = false;
  const legend = [{ label: 'edge being examined', role: 'active' }, { label: 'accepted into the tree', role: 'tree' }, { label: 'rejected: would close a cycle', role: 'rejected' }];

  const views = ({ edge = -1, final = false } = {}) => {
    const groups = new Map();
    for (const id of ids) { const r = rootOf(id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(id); }
    const nameOf = new Map();
    for (const members of groups.values()) for (const id of members) nameOf.set(id, members[0]);
    const cur = edge >= 0 ? graph.edges[edge] : null;
    const touched = new Set();
    for (const e of tree) { touched.add(e.u); touched.add(e.v); }
    const g = graphView(graph, {
      nodeRole: (id) => (cur && (id === cur.u || id === cur.v) ? 'current' : touched.has(id) ? 'done' : 'default'),
      nodeSub: (id) => nameOf.get(id),
      edgeRole: (e) => (e === edge && !status.has(e) ? 'active' : status.get(e) || (final ? 'dim' : 'default')),
    });
    g.legend = legend;
    const rows = { kind: 'rows', title: isSorted ? 'Edges from lightest to heaviest, and the groups of connected nodes' : 'Edges as given, and the groups of connected nodes', rows: [
      { label: 'Edges', cells: sorted.map((e) => ({ t: `${graph.edges[e].u}-${graph.edges[e].v}`, sub: graph.edges[e].w, role: status.get(e) === 'tree' ? 'done' : status.get(e) === 'rejected' ? 'rejected' : e === edge ? 'active' : final ? 'dim' : 'default' })) },
      { label: 'Groups', cells: [...groups.values()].map((members) => ({ t: members.join(' '), role: cur && (members.includes(cur.u) || members.includes(cur.v)) ? 'current' : members.length > 1 ? 'done' : 'default' })) },
    ] };
    return [g, rows];
  };

  t.frame(() => ({ line: [0, 1], note: `The goal is to connect all ${n} nodes using edges of the smallest possible total weight. To begin, no edge has been chosen and every node is a group of its own. The letter under each node names its group.`, views: views(), vars: { nodes: n, edges: graph.edges.length } }));

  sorted = sortEdges(sorted);
  isSorted = true;
  t.frame(() => ({ line: 2, note: `Sort the ${graph.edges.length} edges from lightest to heaviest. They will be examined in exactly this order, and each one is either accepted or rejected for good. A rejected edge joins two nodes that are already connected, and they stay connected, so it can never be needed later.`, views: views(), vars: { edges: graph.edges.length } }));

  let examined = 0;
  for (const e of sorted) {
    if (tree.length === n - 1) break;
    const { u, v, w } = graph.edges[e];
    examined++;
    t.count('edges examined');
    const gu = ids.filter((id) => rootOf(id) === rootOf(u));
    const gv = ids.filter((id) => rootOf(id) === rootOf(v));
    t.frame(() => ({ line: [4, 5], note: `The lightest edge not yet examined is **${u}-${v}**, with weight ${w}. ${u} is in the group {${gu.join(', ')}}${gu.includes(v) ? `, and so is ${v}` : ` and ${v} is in the group {${gv.join(', ')}}`}.`, views: views({ edge: e }), vars: { edge: `${u}-${v}`, weight: w, 'tree weight': weight } }));
    const ru = find(u), rv = find(v);
    if (ru === rv) {
      status.set(e, 'rejected');
      t.frame(() => ({ line: 9, note: `${u} and ${v} are already connected through edges chosen earlier, so ${u}-${v} would close a cycle and connect nothing new. **Reject** it.`, views: views({ edge: e }), vars: { edge: `${u}-${v}`, weight: w, 'tree weight': weight } }));
      continue;
    }
    const [big, small] = size.get(ru) >= size.get(rv) ? [ru, rv] : [rv, ru];
    parent.set(small, big);
    size.set(big, size.get(big) + size.get(small));
    status.set(e, 'tree');
    tree.push({ u, v, w });
    weight += w;
    const count = tree.length, total = weight;
    t.frame(() => ({ line: [6, 7, 8], note: `The two ends are in different groups, so no chosen edge connects them yet. **Accept** ${u}-${v} and merge the two groups. Every edge still to come is at least as heavy, so nothing cheaper could join these groups later. The tree now has ${count} ${count === 1 ? 'edge' : 'edges'} with total weight ${total}.`, views: views({ edge: e }), vars: { edge: `${u}-${v}`, weight: w, 'tree weight': total, 'tree edges': count } }));
  }

  const groupCount = new Set(ids.map(rootOf)).size;
  const spanning = tree.length === n - 1;
  const left = graph.edges.length - examined;
  const rejected = examined - tree.length;
  t.frame(() => ({ line: 10, note: spanning
    ? `The tree has ${n - 1} edges, one fewer than the number of nodes, so every node is connected and the work is done. Its total weight is **${weight}**, and no other way of connecting all the nodes is lighter.${left ? ` ${left === 1 ? 'The one remaining edge was' : `The ${left} remaining edges were`} never examined: with everything already in one group, ${left === 1 ? 'it' : 'each'} could only close a cycle.` : ''}`
    : `Every edge has been examined, but the nodes still form ${groupCount} separate groups, because the graph itself is in ${groupCount} pieces. The accepted edges are the lightest way to connect the nodes inside each piece: a minimum spanning forest of total weight **${weight}**.`,
    views: views({ final: true }), vars: { 'tree weight': weight, accepted: tree.length, rejected } }));

  return { tree, weight, graph, spanning, groups: groupCount, examined, rejected };
}

// Reference for the tests: Prim's algorithm on an adjacency matrix, restarted in every piece of the graph.
function referenceWeight(graph) {
  const ids = graph.nodes.map((nd) => nd.id);
  const cost = new Map(ids.map((a) => [a, new Map()]));
  for (const e of graph.edges) {
    if (e.u === e.v) continue;
    const old = cost.get(e.u).get(e.v);
    if (old === undefined || e.w < old) { cost.get(e.u).set(e.v, e.w); cost.get(e.v).set(e.u, e.w); }
  }
  const inTree = new Set();
  const best = new Map(ids.map((id) => [id, Infinity]));
  let total = 0, pieces = 0;
  while (inTree.size < ids.length) {
    let pick = null;
    for (const id of ids) if (!inTree.has(id) && (pick === null || best.get(id) < best.get(pick))) pick = id;
    if (best.get(pick) === Infinity) pieces++; else total += best.get(pick);
    inTree.add(pick);
    for (const [other, w] of cost.get(pick)) if (!inTree.has(other) && w < best.get(other)) best.set(other, w);
  }
  return { total, pieces };
}
const matchesPrim = (r) => {
  const ref = referenceWeight(r.graph);
  if (r.weight !== ref.total) return `total weight ${r.weight}, but Prim's algorithm finds ${ref.total}`;
  if (r.groups !== ref.pieces) return `ended with ${r.groups} groups, but the graph has ${ref.pieces} pieces`;
  if (r.tree.length !== r.graph.nodes.length - ref.pieces) return 'wrong number of edges for a spanning forest';
  // the chosen edges must connect each piece: flood through tree edges only
  const seen = new Set();
  let comps = 0;
  for (const nd of r.graph.nodes) {
    if (seen.has(nd.id)) continue;
    comps++;
    const stack = [nd.id];
    seen.add(nd.id);
    while (stack.length) {
      const x = stack.pop();
      for (const e of r.tree) {
        const y = e.u === x ? e.v : e.v === x ? e.u : null;
        if (y !== null && !seen.has(y)) { seen.add(y); stack.push(y); }
      }
    }
  }
  return comps === ref.pieces || 'the chosen edges do not connect the graph';
};

export default {
  meta: {
    id: 'kruskal',
    name: 'Kruskal\'s Algorithm',
    aliases: ['Kruskal', 'minimum spanning tree', 'MST', 'minimum-weight spanning tree', 'minimum spanning forest'],
    kind: 'algorithm',
    discipline: 'graph-theory',
    alsoIn: [
      { id: 'algorithms', why: 'It is the standard example of a greedy algorithm that is provably optimal, and the main use of the union-find data structure.' },
      { id: 'machine-learning', why: 'Stopping it before the last few merges gives single-linkage clustering, which groups data points by their nearest neighbours.' },
    ],
    subfield: 'Spanning trees',
    family: 'Minimum spanning tree',
    lab: 'graphs',
    year: 1956,
    authors: 'Joseph B. Kruskal',
    summary: 'Builds the cheapest set of edges that connects every node, by taking edges from lightest to heaviest and skipping any that would close a cycle.',
    difficulty: 'intermediate',
    order: 270,
    paradigms: ['greedy'],
    randomized: false,
    approximate: false,
    time: { best: 'O(E log E)', average: 'O(E log E)', worst: 'O(E log E)', class: 'linearithmic' },
    space: { worst: 'O(V + E)', class: 'linear' },
    tags: {
      problems: ['minimum spanning tree', 'cheapest way to connect everything', 'connect all points with the least cable', 'network design', 'group nearby points into clusters'],
      techniques: ['sorting edges', 'greedy choice', 'union-find', 'cycle detection'],
      applications: ['networking', 'machine learning', 'image processing', 'logistics', 'engineering design'],
    },
    prerequisites: ['union-find', 'concept:graph', 'concept:spanning-tree', 'concept:greedy'],
  },

  bigIdea: {
    simple: "Kruskal's algorithm finds the cheapest way to connect a set of places so that you can get from any one of them to any other. Imagine several villages with no roads between them. An engineer has a list of roads that could be built, each with a price. The villages want everyone to be able to reach everyone else, for the least money in total. The method is short. Sort the list from the cheapest road to the most expensive. Go down the list one road at a time. If a road joins two villages that cannot yet reach each other, build it. If they can already reach each other, even by a roundabout route, skip it, because it would cost money and connect nothing new. Stop when all the villages are linked. The surprise is that this works. Always taking the cheapest useful road, with no planning ahead, gives the cheapest possible network.",
    what: 'Given a graph whose edges have weights, Kruskal\'s algorithm finds a minimum spanning tree: a set of edges that connects every node, contains no cycle, and has the smallest possible total weight. It considers the edges in order of increasing weight and keeps each one unless its two ends are already connected by edges it kept earlier.',
    why: 'Connecting things costs money, and the cheapest way to connect everything is a question that arises for cables, pipes, roads and circuits. Otakar Borůvka first studied it in 1926 for an electricity network in Moravia. Joseph Kruskal\'s 1956 method is the easiest of the classical solutions to state, and it shows that a simple greedy rule can be exactly right.',
    when: 'Use it when you need the lightest set of edges that keeps a graph connected, especially when the graph is sparse or the edges are already sorted or easy to sort. It also suits problems that are really about merging groups, such as clustering. It is not a shortest-route algorithm: for the cheapest route between two nodes use [Dijkstra\'s algorithm](#/algorithm/dijkstra).',
    interesting: 'Greedy rules usually fail: grabbing the best-looking option now tends to cost more later. Here the greedy rule is provably optimal, and the reason is a property of cuts. Split the nodes into any two sets, and the lightest edge running between the sets is always safe to use. Kruskal\'s algorithm never does anything except pick such an edge.',
    where: 'It is used in the design of networks, in clustering data, and in computer vision, where a well-known image segmentation method processes the edges between neighbouring pixels in Kruskal\'s order. It is also a building block of approximation algorithms for the travelling salesman problem.',
    analogy: {
      title: 'Islands and bridges',
      text: 'Picture a group of islands and a price list of bridges that could be built between pairs of them. Build the cheapest bridge first. Two islands joined by a bridge count as one landmass from then on. Keep taking the next cheapest bridge on the list. If it would join two different landmasses, build it. If both of its ends are on the same landmass, it is a waste of money, so cross it off. When only one landmass is left, you are done.',
      limits: 'The network this produces is the cheapest to build, not the most convenient to travel. Two neighbouring islands may end up connected only by a long route through several others. The picture also hides how the algorithm knows whether two islands are on the same landmass. Checking that quickly, many thousands of times, needs a data structure of its own, called union-find. And real engineers can do things the list does not allow, such as building a junction in open water. The algorithm only chooses among the edges it is given.',
    },
  },

  example: {
    setup: "Four villages, A, B, C and D, need to be connected. Five roads could be built: A to B for 1, B to C for 2, A to C for 3, C to D for 4, and A to D for 5. Find the cheapest set of roads that links all four.",
    steps: [
      "Sort the roads by price: A-B (1), B-C (2), A-C (3), C-D (4), A-D (5).",
      "A-B costs 1. A and B are not connected yet, so build it. Now A and B form one group.",
      "B-C costs 2. C is not in the group of A and B, so build it. Now A, B and C form one group.",
      "A-C costs 3. A and C can already reach each other through B, so skip it. It would add cost and connect nothing new.",
      "C-D costs 4. D is not connected to anything yet, so build it. All four villages are now in one group, so stop.",
    ],
    result: "The roads built are A-B, B-C and C-D, for a total of 1 + 2 + 4 = 7. Four villages needed three roads: always one fewer than the number of places. The last road on the list, A-D, was never looked at, because the work was already finished.",
    tryInput: { edges: 'A-B:1, B-C:2, A-C:3, C-D:4, A-D:5' },
  },

  terms: [
    { term: "Graph", meaning: "A set of points joined by links. Here the points are places and the links are possible connections between them." },
    { term: "Node", meaning: "One point in a graph, such as a village. Also called a vertex." },
    { term: "Edge", meaning: "One link between two nodes, such as a possible road." },
    { term: "Weight", meaning: "The cost attached to an edge, such as its price or length." },
    { term: "Cycle", meaning: "A route that leaves a node and comes back to it without reusing an edge. A loop." },
    { term: "Tree", meaning: "A set of edges that connects its nodes with no cycle. Between any two nodes of a tree there is exactly one route." },
    { term: "Spanning tree", meaning: "A tree that reaches every node of the graph. It always has one edge fewer than there are nodes." },
    { term: "Minimum spanning tree", meaning: "A spanning tree whose weights add up to the smallest possible total." },
    { term: "Greedy", meaning: "Describes a method that always takes the best-looking option available right now and never goes back on it." },
  ],

  takeaway: "Take the cheapest connection that joins two things not yet joined, again and again, and you get the cheapest way to connect everything.",

  viz: {
    describe: 'A weighted graph. The edge being examined is terracotta. Edges accepted into the tree are thick forest green, and rejected edges are dashed brick red. The letter beneath each node names the group of connected nodes it belongs to, which is the alphabetically first node of that group. Below the graph, the first row lists every edge from lightest to heaviest and colours each one as it is accepted or rejected. The second row shows the current groups.',
    inputs: graphInputs({ nodes: 8, density: 0.6, weighted: true }),
    presets: [
      { label: 'Small graph', values: { nodes: 6, density: 0.5, seed: 3, edges: '' } },
      { label: 'Dense graph', values: { nodes: 10, density: 1, seed: 8, edges: '' } },
      { label: 'Four villages', values: { edges: 'A-B:1, B-C:2, A-C:3, C-D:4, A-D:5' } },
      { label: 'Equal weights: several answers', values: { edges: 'A-B:1, B-C:1, C-D:1, D-A:1, A-C:2' } },
      { label: 'Two separate pieces', values: { edges: 'A-B:3, B-C:1, A-C:2, D-E:4, E-F:1, D-F:5' } },
    ],
    tryThis: [
      'Watch the "Groups" row. Every accepted edge merges two groups into one, so the number of groups falls by exactly one each time. With V nodes it takes V − 1 accepted edges to reach a single group.',
      'Each time an edge is rejected, find the route in thick green edges that already connects its two ends. That route plus the rejected edge would form a cycle, and no edge on that cycle is heavier than the rejected one.',
      'Load "Equal weights: several answers". Four edges tie at weight 1 and any three of them make a minimum spanning tree. The algorithm takes the first three in the list. The total weight is the same whichever three are chosen.',
      'Load "Two separate pieces". No edge joins the two halves, so the run ends with two groups. The result is the cheapest tree inside each piece.',
    ],
    run,
    report: (r, c) => `${r.spanning ? 'Minimum spanning tree' : `Minimum spanning forest (${r.groups} pieces)`}: ${r.tree.map((e) => `${e.u}-${e.v} (${e.w})`).join(', ')}\nTotal weight: ${r.weight}\n${r.examined} of ${r.graph.edges.length} edges examined: ${r.tree.length} accepted, ${r.rejected} rejected. Sorting took ${c.comparisons || 0} comparisons.`,
    experiment: {
      title: 'Sorting comparisons as the graph grows',
      note: 'Each point is a real run on a random connected graph. Sorting the edges is the dominant cost of Kruskal\'s algorithm, so the chart counts the comparisons made by the merge sort used on this page. The curve is E log₂ E for the denser graphs, scaled to pass through the last measured point.',
      metric: 'comparisons',
      metricLabel: 'Comparisons while sorting the edges',
      sizeLabel: 'Number of nodes (V)',
      sizes: [8, 16, 32, 64, 128, 256],
      variants: [{ id: 'dense', label: 'About 2.4 edges per node' }, { id: 'sparse', label: 'About 1.4 edges per node' }],
      input: (n, variant, seed) => ({ nodes: n, density: variant === 'dense' ? 1 : 0.3, seed, edges: '' }),
      theory: [{ label: 'E log₂ E (scaled)', fn: (n) => 2.4 * n * Math.log2(2.4 * n), scaled: true, variant: 'dense' }],
    },
  },

  logic: {
    intuition: 'Think of the chosen edges as growing a forest: a collection of separate trees that slowly merge. An edge between two different trees joins them into a bigger tree. An edge inside one tree would close a loop, and a loop always contains an edge that can be removed without disconnecting anything. Because edges arrive in order of weight, the edge that would close the loop is at least as heavy as every other edge on it, so it is the right one to leave out.',
    steps: [
      'Put every node in a group of its own.',
      'Sort the edges by weight, lightest first.',
      'Take the next edge in sorted order and look up which group each of its ends belongs to.',
      'If the ends are in different groups, accept the edge and merge the two groups into one.',
      'If the ends are in the same group, reject the edge: its ends are already connected, so it would close a cycle.',
      'Repeat from step 3 until V − 1 edges have been accepted, or the edges run out.',
    ],
    pseudocode: [
      'kruskal(G):',
      '  put every node in a group of its own',
      '  sort the edges of G by weight, lightest first',
      '  T ← empty set of edges',
      '  for each edge (u, v) in sorted order:',
      '    if find(u) ≠ find(v):',
      '      add (u, v) to T',
      '      union(u, v)',
      '      if T has V − 1 edges: stop',
      '    otherwise: skip (u, v), it would close a cycle',
      '  return T',
    ],
    decisions: [
      { title: 'How to tell whether two nodes are already connected?', text: 'Searching the tree for a route each time would be far too slow. The algorithm keeps the groups in a [union-find](#/algorithm/union-find) structure, where `find(x)` returns a representative of the group of `x` and `union` merges two groups. Both take almost constant time.' },
      { title: 'How are ties between equal weights broken?', text: 'Any order among equal weights gives a minimum spanning tree, though possibly a different one. This page keeps equal edges in the order they were given, which makes runs repeatable. If all weights are different, the minimum spanning tree is unique.' },
      { title: 'Stop early?', text: 'Yes. Once V − 1 edges have been accepted, everything is in one group and every remaining edge would be rejected. A graph in several pieces never reaches V − 1, so the loop must also end when the edges run out.' },
      { title: 'Sort everything up front?', text: 'Sorting is the simplest choice and the one used here. When only a small share of the edges will be needed, a heap that hands out edges in order on demand avoids sorting the rest.' },
    ],
    invariants: [
      'The accepted edges never contain a cycle: they always form a forest.',
      'Two nodes are in the same group exactly when the accepted edges connect them.',
      'The accepted edges are always contained in some minimum spanning tree of the graph.',
      'Every rejected edge is a heaviest edge on a cycle formed with edges accepted before it.',
    ],
    edgeCases: [
      'A graph in several pieces has no spanning tree. The algorithm returns a minimum spanning forest: a minimum spanning tree of each piece.',
      'Equal weights: the tree returned depends on the order of the tied edges, but its total weight does not.',
      'Negative weights are handled without any change. Only the order of the weights matters.',
      'An edge from a node to itself is always rejected, since both ends are in the same group.',
      'Several edges between the same two nodes: the lightest may be accepted and the others are rejected.',
      'Directed edges: the problem is defined for undirected graphs. The directed version needs a different algorithm.',
    ],
    correctness: 'The argument rests on the **cut property**. Divide the nodes into two sets in any way. Among the edges with one end in each set, a lightest one belongs to some minimum spanning tree. To see why, take any minimum spanning tree that does not use that edge and add the edge to it. This closes a cycle, and the cycle must cross between the two sets at some other edge too. That other edge is at least as heavy, so removing it gives a spanning tree that is no heavier and uses the lightest crossing edge. Now look at the moment Kruskal\'s algorithm accepts an edge between `u` and `v`. Take the group containing `u` as one set and all other nodes as the other. No accepted edge crosses between them. And no lighter edge crosses between them either: a lighter crossing edge would have been examined earlier, found its ends in different groups, and been accepted, which would have merged it into the group. So the accepted edge is a lightest edge across this division, and by the cut property it is safe to add. Repeating the argument, the accepted edges always sit inside some minimum spanning tree. When the algorithm ends on a connected graph they form a spanning tree themselves, so they are one.',
    mistakes: [
      'Testing for a cycle by asking whether both ends have been "used" already. Two ends can each belong to a different partial tree; what matters is whether they are in the same group.',
      'Forgetting to merge the groups after accepting an edge, so later cycle tests give wrong answers.',
      'Expecting the route between two nodes inside the minimum spanning tree to be the shortest route between them in the graph.',
      'Assuming the result is a spanning tree without checking that V − 1 edges were accepted. On a disconnected graph it is only a forest.',
      'Implementing the group lookup naively, by relabelling every node of a group on each merge, which makes the merging step quadratic.',
    ],
  },

  code: {
    sample: {
      input: 'An undirected graph with edges A-B:4, A-C:2, B-C:1, B-D:5, C-D:8, C-E:10, D-E:2, D-F:6, E-F:3 (the same graph as in the Dijkstra lesson). Each decision in order, then the total weight of the minimum spanning tree.',
      expected: 'accept B-C 1\naccept A-C 2\naccept D-E 2\naccept E-F 3\nreject A-B 4\naccept B-D 5\ntotal weight 13',
    },
    python: {
      source: `def find(parent, x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]  # path halving: point to the grandparent
        x = parent[x]
    return x


def kruskal(nodes, edges):
    parent = {v: v for v in nodes}
    size = {v: 1 for v in nodes}
    tree = []
    for u, v, w in sorted(edges, key=lambda edge: edge[2]):
        root_u, root_v = find(parent, u), find(parent, v)
        if root_u == root_v:
            print(f"reject {u}-{v} {w}")
            continue
        if size[root_u] < size[root_v]:
            root_u, root_v = root_v, root_u
        parent[root_v] = root_u
        size[root_u] += size[root_v]
        tree.append((u, v, w))
        print(f"accept {u}-{v} {w}")
        if len(tree) == len(nodes) - 1:
            break
    return tree


nodes = ["A", "B", "C", "D", "E", "F"]
edges = [("A", "B", 4), ("A", "C", 2), ("B", "C", 1), ("B", "D", 5), ("C", "D", 8),
         ("C", "E", 10), ("D", "E", 2), ("D", "F", 6), ("E", "F", 3)]

tree = kruskal(nodes, edges)
print("total weight", sum(w for _, _, w in tree))`,
      notes: [
        { line: 3, text: 'While walking up to the representative of the group, each node is re-pointed to its grandparent. This keeps later lookups short.' },
        { line: 12, text: 'Python\'s sort is stable, so edges of equal weight stay in the order they were listed. Sorting is the most expensive step of the whole algorithm.' },
        { line: 14, text: 'The same representative means the two ends are already connected by accepted edges. Adding this edge would close a cycle.' },
        { line: 19, text: 'Merging two groups is one assignment: the representative of the smaller group is pointed at the representative of the larger.' },
        { line: 23, text: 'A spanning tree of V nodes has exactly V − 1 edges, so the loop can stop as soon as that many are accepted.' },
      ],
    },
    javascript: {
      source: `function find(parent, x) {
  while (parent.get(x) !== x) {
    parent.set(x, parent.get(parent.get(x)));  // path halving: point to the grandparent
    x = parent.get(x);
  }
  return x;
}

function kruskal(nodes, edges) {
  const parent = new Map(nodes.map((v) => [v, v]));
  const size = new Map(nodes.map((v) => [v, 1]));
  const tree = [];
  const sorted = edges.slice().sort((a, b) => a[2] - b[2]);  // stable: ties keep their order
  for (const [u, v, w] of sorted) {
    let rootU = find(parent, u), rootV = find(parent, v);
    if (rootU === rootV) {
      console.log("reject " + u + "-" + v + " " + w);
      continue;
    }
    if (size.get(rootU) < size.get(rootV)) [rootU, rootV] = [rootV, rootU];
    parent.set(rootV, rootU);
    size.set(rootU, size.get(rootU) + size.get(rootV));
    tree.push([u, v, w]);
    console.log("accept " + u + "-" + v + " " + w);
    if (tree.length === nodes.length - 1) break;
  }
  return tree;
}

const nodes = ["A", "B", "C", "D", "E", "F"];
const edges = [["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5], ["C", "D", 8],
  ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3]];

const tree = kruskal(nodes, edges);
console.log("total weight " + tree.reduce((sum, edge) => sum + edge[2], 0));`,
    },
    cpp: {
      source: `#include <algorithm>
#include <iostream>
#include <utility>
#include <vector>

struct Edge { int u, v, w; };

int find(std::vector<int>& parent, int x) {
    while (parent[x] != x) {
        parent[x] = parent[parent[x]];  // path halving: point to the grandparent
        x = parent[x];
    }
    return x;
}

int main() {
    const int n = 6;  // nodes A..F are 0..5
    std::vector<Edge> edges = {{0, 1, 4}, {0, 2, 2}, {1, 2, 1}, {1, 3, 5}, {2, 3, 8},
                               {2, 4, 10}, {3, 4, 2}, {3, 5, 6}, {4, 5, 3}};
    std::stable_sort(edges.begin(), edges.end(),
                     [](const Edge& a, const Edge& b) { return a.w < b.w; });

    std::vector<int> parent(n), size(n, 1);
    for (int v = 0; v < n; ++v) parent[v] = v;
    auto name = [](int v) { return static_cast<char>('A' + v); };

    int accepted = 0, total = 0;
    for (const Edge& e : edges) {
        int rootU = find(parent, e.u), rootV = find(parent, e.v);
        if (rootU == rootV) {
            std::cout << "reject " << name(e.u) << "-" << name(e.v) << " " << e.w << "\\n";
            continue;
        }
        if (size[rootU] < size[rootV]) std::swap(rootU, rootV);
        parent[rootV] = rootU;
        size[rootU] += size[rootV];
        ++accepted;
        total += e.w;
        std::cout << "accept " << name(e.u) << "-" << name(e.v) << " " << e.w << "\\n";
        if (accepted == n - 1) break;
    }
    std::cout << "total weight " << total << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Sorting E edges costs O(E log E). After that, each edge needs two group lookups and at most one merge, and with a good union-find structure all of those together cost barely more than O(E). So sorting dominates, and the total is O(E log E), which is the same as O(E log V) because E is at most V².',
    cases: [
      { case: 'Comparison sort', time: 'O(E log E)', when: 'The general case. The time is the same for every input of a given size, apart from the early stop.' },
      { case: 'Edges already sorted', time: 'O(E α(V))', when: 'Only the union-find work remains. α is the inverse Ackermann function, which is below 5 for any input that could ever be stored.' },
      { case: 'Small integer weights', time: 'O(E α(V))', when: 'The edges can be sorted in linear time by counting or radix sort, so again only the union-find work remains.' },
    ],
    space: 'O(V) for the union-find structure and the tree, plus O(E) for the sorted list of edges.',
    memory: 'The algorithm works on a flat list of edges and never needs adjacency lists, which makes it convenient when a graph arrives as a file of edges. Very large edge lists can be sorted on disk and then streamed through the union-find structure, which needs only O(V) memory.',
    tradeoffs: 'Kruskal\'s algorithm looks at the whole graph through its sorted edge list, so it suits sparse graphs and edge lists. Prim\'s algorithm grows one tree from a starting node using a priority queue of neighbouring edges, and with an adjacency matrix it runs in O(V²), which is better on dense graphs where E is close to V².',
    assumptions: [
      'Comparing two weights takes constant time.',
      'The union-find structure uses both union by size (or rank) and path compression or halving. With only one of the two, each operation costs O(log V).',
      'The bound O(E log E) = O(E log V) uses the fact that E is at most V², so log E is at most 2 log V.',
      'The chart on this page counts comparisons made by this page\'s merge sort, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Sparse graphs, and graphs given as a list of edges.',
      'Situations where the edges are already sorted or can be sorted in linear time.',
      'Problems that are naturally about merging groups: clustering, connected regions, and percolation.',
      'Disconnected graphs, where it yields a minimum spanning forest with no special handling.',
    ],
    struggles: [
      'Dense graphs, where sorting close to V² edges costs more than Prim\'s algorithm with a simple array.',
      'Graphs whose edges are not stored anywhere but computed on demand, such as distances between all pairs of points.',
      'Graphs that change over time: adding or removing an edge means maintaining the tree by other techniques.',
    ],
    pitfalls: [
      'A naive connectivity test that makes the algorithm quadratic or worse.',
      'Treating the minimum spanning tree as a shortest-path tree.',
      'Not noticing that the input graph is disconnected.',
    ],
    misunderstandings: [
      "\"The minimum spanning tree gives the shortest route between any two nodes.\" It gives the cheapest way to connect everything at once. The route between two particular nodes inside the tree can be much longer than the best route in the full graph.",
      "\"There is only one minimum spanning tree.\" When several edges have equal weights there can be many. All of them have the same total weight.",
      "\"Greedy methods are only approximations.\" Often they are, but not here. For this problem the greedy choice is proved to give an exact optimum.",
    ],
    constraints: [
      'Real network design has requirements a spanning tree ignores: a tree has no redundancy, so a single failed link disconnects it.',
      'When new junction points may be added, the cheapest network is a Steiner tree, which can be lighter than the minimum spanning tree and is much harder to compute.',
    ],
    alternatives: [
      { id: 'prim', name: 'Prim\'s Algorithm', when: 'The graph is dense, or is stored as adjacency lists and you want to grow the tree from one node.' },
      { name: 'Borůvka\'s algorithm', when: 'You want to work in parallel: in each round every group picks its lightest outgoing edge at the same time.' },
      { id: 'union-find', name: 'Union-Find alone', when: 'You only need to know which nodes are connected, and the weights do not matter.' },
      { id: 'dijkstra', name: 'Dijkstra\'s Algorithm', when: 'You want cheapest routes from one node, not the cheapest network overall.' },
    ],
    comparison: {
      columns: ['', 'Kruskal', 'Prim', 'Borůvka'],
      rows: [
        ['Grows', 'A forest that merges', 'One tree from a start node', 'All groups at once, in rounds'],
        ['Main data structure', 'Sorted edges and union-find', 'Priority queue', 'Union-find or labels'],
        ['Time', 'O(E log E)', 'O(E log V), or O(V²) with an array', 'O(E log V)'],
        ['Best suited to', 'Sparse graphs, edge lists', 'Dense graphs', 'Parallel and distributed settings'],
        ['Disconnected graphs', 'Gives a forest directly', 'Needs a restart in each piece', 'Gives a forest directly'],
      ],
    },
  },

  applications: [
    { title: 'Designing networks', status: 'established', text: 'The minimum spanning tree problem began as a practical question: Borůvka formulated it in 1926 to plan an economical electricity network for Moravia. The same model applies to laying cable, pipe or track when the aim is to connect every site at the least construction cost.' },
    { title: 'Single-linkage clustering', status: 'established', text: 'Treat data points as nodes and the distances between them as edge weights. Running Kruskal\'s algorithm and stopping when k groups remain produces the single-linkage clustering into k clusters. The order in which groups merge is the clustering hierarchy.' },
    { title: 'Image segmentation', status: 'established', text: 'The graph-based segmentation method of Felzenszwalb and Huttenlocher makes each pixel a node, weights edges between neighbouring pixels by how different they look, and processes the edges in increasing order with union-find, merging regions when the difference across an edge is small compared with the variation inside them.' },
    { title: 'Approximating the travelling salesman problem', status: 'established', text: 'When distances obey the triangle inequality, walking round a minimum spanning tree and skipping repeated stops gives a tour at most twice the optimal length. Christofides\' algorithm starts from a minimum spanning tree as well.' },
    { title: 'Generating mazes', status: 'illustrative', text: 'Give every wall between two cells of a grid a random weight and run Kruskal\'s algorithm, removing a wall whenever it separates two cells that are not yet connected. The result is a maze with exactly one route between any two cells.' },
  ],

  connections: [
    { to: 'union-find', type: 'prerequisite', why: 'Kruskal\'s algorithm is only fast because union-find can answer "are these two nodes already connected?" and merge two groups in almost constant time.' },
    { to: 'prim', type: 'same-problem', why: 'Both build a minimum spanning tree by repeatedly adding a lightest edge across a cut. Kruskal chooses the cut implicitly from the globally lightest edge; Prim always uses the cut between its one tree and the rest.' },
    { to: 'dijkstra', type: 'related', why: 'Both are greedy graph algorithms proved correct by an exchange argument. Dijkstra picks the closest node to a source and yields shortest routes; Kruskal picks the lightest safe edge and yields the cheapest connection.' },
    { to: 'heap-sort', type: 'related', why: 'The algorithm needs the edges in increasing order. A heap can hand them out one at a time, so that when the tree is finished early the remaining edges never have to be fully sorted.' },
    { to: 'merge-sort', type: 'prerequisite', why: 'Sorting the edges is the dominant cost, and the bound O(E log E) is the bound of the sort.' },
    { to: 'concept:greedy', type: 'prerequisite', why: 'It commits to the lightest acceptable edge at every step and never revises a decision. The cut property is what makes that safe.' },
    { to: 'concept:spanning-tree', type: 'prerequisite', why: 'The output is a spanning tree, and the reasoning uses two facts about trees: V − 1 edges, and exactly one route between any two nodes.' },
    { to: 'concept:connectivity', type: 'related', why: 'At every moment the groups are the connected components of the graph formed by the accepted edges.' },
    { to: 'k-means', type: 'related', why: 'Stopped early, Kruskal\'s algorithm is single-linkage clustering. Both group data points, but k-means measures closeness to a centre while single linkage follows chains of near neighbours.' },
    { to: 'discipline:computer-vision', type: 'application', why: 'Graph-based image segmentation merges neighbouring pixels into regions in Kruskal\'s order of increasing edge weight.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why does the algorithm reject an edge whose two ends are in the same group?',
      options: ['The edge is too heavy', 'Its ends are already connected, so it would close a cycle and connect nothing new', 'The group is already full', 'Edges inside a group are counted twice'],
      answer: 1,
      explain: [
        'Weight alone never causes a rejection. A heavy edge is accepted if it joins two separate groups.',
        'Correct. A spanning tree has no cycles, and the edge would add weight without improving connectivity. No edge on the cycle it would close is heavier than it.',
        'Groups have no size limit. They keep merging until one remains.',
        'Each edge is examined exactly once.',
      ],
    },
    {
      type: 'predict',
      q: 'The edges are A-B:1, B-C:2, A-C:3, C-D:4, B-D:5, D-E:6 and C-E:7. How many edges does the algorithm reject before the tree is complete?',
      options: ['0', '1', '2', '3'],
      answer: 2,
      explain: [
        'A-C comes third in sorted order, when A and C are already joined through B.',
        'A-C is rejected, but so is B-D, whose ends are joined through C by then.',
        'Correct. A-C and B-D are rejected. The tree A-B, B-C, C-D, D-E has four edges and total weight 13.',
        'C-E would be rejected too if it were examined, but the tree is complete after D-E, so the algorithm stops first.',
      ],
      tryInput: { edges: 'A-B:1, B-C:2, A-C:3, C-D:4, B-D:5, D-E:6, C-E:7' },
    },
    {
      type: 'debug',
      q: 'On the edges A-B:1, C-D:2, B-C:3 this version returns only two edges and leaves the graph disconnected. What is wrong?',
      code: `in_tree = set()
tree = []
for u, v, w in sorted(edges, key=lambda e: e[2]):
    if u in in_tree and v in in_tree:
        continue
    tree.append((u, v, w))
    in_tree.update([u, v])`,
      options: ['The edges are sorted in the wrong direction', 'It rejects an edge when both ends have been used, even if they lie in two separate partial trees', 'It should use a stack', 'It accepts too many edges'],
      answer: 1,
      explain: [
        'Lightest first is the correct order.',
        'Correct. After A-B and C-D, the nodes B and C have both been "used", but they are in different groups. B-C is the edge that joins them and must be accepted. Track groups, not a single set.',
        'No stack is involved in Kruskal\'s algorithm.',
        'It accepts too few: the edge that is needed gets skipped.',
      ],
    },
    {
      type: 'choice',
      q: 'In a minimum spanning tree, is the route between two nodes always the shortest route between them in the original graph?',
      options: ['Yes, that is what "minimum" means', 'No. The tree minimises the total weight of all its edges, not the length of any one route', 'Yes, if all weights are different', 'Only if the graph is a grid'],
      answer: 1,
      explain: [
        '"Minimum" refers to the sum of the tree\'s edges.',
        'Correct. A direct edge may be left out because the two nodes were already connected more cheaply overall, leaving a long way round inside the tree.',
        'Distinct weights make the tree unique. They do not make its routes shortest.',
        'The shape of the graph does not change this.',
      ],
    },
    {
      type: 'challenge',
      title: 'Stop early to find clusters',
      prompt: 'Scatter 30 points in the plane in three loose clumps. Build the complete graph on them, using the straight-line distance between two points as the edge weight, and run Kruskal\'s algorithm, but stop when exactly three groups remain. Print the groups. Then move one point so that it sits midway between two clumps and see what happens. Explain the result in terms of which edges are accepted first.',
      hints: ['Stop when the number of accepted edges reaches the number of points minus 3.', 'This is single-linkage clustering. A chain of close points can link two clumps that are far apart overall.'],
    },
  ],

  compare: {
    idea: 'Add edges in order of increasing weight, skipping any whose ends are already connected.',
    requires: 'An undirected graph with comparable edge weights. Exact: the result is always a minimum spanning tree (or forest).',
    sensitivity: 'Low. The cost is set by the number of edges. The input can only shorten the run by letting it stop early.',
    memory: 'O(V + E): the edge list and a union-find structure.',
    difficulty: 'moderate',
    difficultyNote: 'The loop is a few lines. The care goes into the union-find structure that makes the cycle test fast.',
    limits: 'Must sort all edges. Not a shortest-path method. A tree has no redundancy.',
    useWhen: 'You need the cheapest set of edges that connects everything, especially on sparse graphs or edge lists.',
  },

  advanced: {
    history: 'The minimum spanning tree problem was first solved by Otakar Borůvka in 1926, in connection with the electrification of Moravia. Vojtěch Jarník published a different method in 1930, which Robert Prim rediscovered in 1957 and Edsger Dijkstra in 1959. Joseph Kruskal published the algorithm described here in 1956, in a three-page paper in the *Proceedings of the American Mathematical Society*. Its efficiency depends on the union-find structure, whose near-linear running time was established by Robert Tarjan in 1975. Later work brought the cost of finding a minimum spanning tree close to linear: Karger, Klein and Tarjan gave a randomized algorithm with linear expected time in 1995, and Chazelle a deterministic one within an inverse-Ackermann factor of linear in 2000.',
    proof: 'Let $G = (V, E)$ be connected with weights $w$. A **cut** is a partition of $V$ into $S$ and $V \\setminus S$; an edge **crosses** it if it has one end in each part.\n\n**Cut property.** Let $F$ be a set of edges contained in some minimum spanning tree $T$, and let $(S, V \\setminus S)$ be a cut that no edge of $F$ crosses. If $e$ is a lightest edge crossing the cut, then $F \\cup \\{e\\}$ is contained in some minimum spanning tree.\n\n*Proof.* If $e \\in T$ there is nothing to show. Otherwise $T \\cup \\{e\\}$ contains exactly one cycle, and that cycle crosses the cut an even number of times, so it contains another crossing edge $e\'$. Since no edge of $F$ crosses the cut, $e\' \\notin F$, and since $e$ is lightest, $w(e) \\le w(e\')$. Then $T\' = T \\setminus \\{e\'\\} \\cup \\{e\\}$ is a spanning tree with $w(T\') \\le w(T)$, so it is a minimum spanning tree, and it contains $F \\cup \\{e\\}$.\n\n**Kruskal\'s algorithm.** We show by induction that the accepted set $F$ is always contained in a minimum spanning tree. Initially $F = \\emptyset$. Suppose the algorithm accepts $e = (u, v)$, and let $S$ be the group of $u$ just before. Groups are the connected components of $(V, F)$, so no edge of $F$ crosses $(S, V \\setminus S)$, and $e$ crosses it because $v \\notin S$. Suppose some crossing edge $e\'$ had $w(e\') < w(e)$. It was examined before $e$. Its ends are in different groups now, and groups only ever merge, so they were in different groups then, and $e\'$ would have been accepted, putting both ends in one group: a contradiction. So $e$ is a lightest crossing edge and the cut property applies.\n\n**Termination.** If $G$ is connected and $F$ had more than one group at the end, some edge of $G$ would join two groups and would have been accepted when examined. So $F$ is a spanning tree contained in a minimum spanning tree, hence equal to it.',
    complexityProof: 'Sorting takes $O(E \\log E)$ comparisons. The loop performs at most $2E$ find operations and $V - 1$ unions. With union by size and path compression, a sequence of $m$ operations on $n$ elements takes $O(m\\,\\alpha(n))$ time, where $\\alpha$ is the inverse Ackermann function, so the loop costs $O(E\\,\\alpha(V))$. The total is $O(E \\log E + E\\,\\alpha(V)) = O(E \\log E)$. Since $E \\le V^2$, $\\log E \\le 2\\log V$, so this is also $O(E \\log V)$.',
    variants: [
      { name: 'Prim\'s (Jarník\'s) algorithm', text: 'Grows a single tree from a start node, always adding the lightest edge that leaves the tree.' },
      { name: 'Borůvka\'s algorithm', text: 'In each round every group selects its lightest outgoing edge and all selected edges are added at once. The number of groups at least halves per round.' },
      { name: 'Filter-Kruskal', text: 'Partitions the edges around a pivot weight as quicksort does, solves the light half first, and discards heavy edges whose ends are already connected before sorting them.' },
      { name: 'Maximum spanning tree', text: 'Sort from heaviest to lightest. The same proof applies with the inequalities reversed.' },
      { name: 'Single-linkage clustering', text: 'Stop when k groups remain. The groups are the clusters.' },
    ],
    implementation: 'Store edges as (weight, u, v) records in a flat array and sort it. Use integer node ids so that the union-find arrays are plain arrays. Implement both union by size and path compression or halving. Stop after V − 1 acceptances, and check that count to detect a disconnected input. If weights are small integers, a counting or radix sort removes the logarithmic factor.',
    benchmarking: 'Time the sort and the union-find loop separately: on most inputs the sort accounts for nearly all of the time. Compare with Prim\'s algorithm across a range of densities, since the better choice changes as E approaches V².',
    references: [
      { authors: 'J. B. Kruskal', year: 1956, title: 'On the shortest spanning subtree of a graph and the traveling salesman problem', venue: 'Proceedings of the American Mathematical Society 7(1), 48-50' },
      { authors: 'R. E. Tarjan', year: 1975, title: 'Efficiency of a good but not linear set union algorithm', venue: 'Journal of the ACM 22(2), 215-225' },
      { authors: 'R. L. Graham and P. Hell', year: 1985, title: 'On the history of the minimum spanning tree problem', venue: 'Annals of the History of Computing 7(1), 43-57' },
      { authors: 'P. F. Felzenszwalb and D. P. Huttenlocher', year: 2004, title: 'Efficient graph-based image segmentation', venue: 'International Journal of Computer Vision 59(2), 167-181' },
      { authors: 'D. R. Karger, P. N. Klein and R. E. Tarjan', year: 1995, title: 'A randomized linear-time algorithm to find minimum spanning trees', venue: 'Journal of the ACM 42(2), 321-328' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Minimum Spanning Trees".',
      'R. Sedgewick and K. Wayne, *Algorithms* (4th edition), section 4.3, "Minimum Spanning Trees".',
    ],
  },

  tests: [
    { name: 'total weight matches an independent Prim on a random graph', input: { nodes: 12, density: 0.8, seed: 21, edges: '' }, check: matchesPrim },
    { name: 'matches Prim on a dense graph', input: { nodes: 14, density: 1, seed: 6, edges: '' }, check: matchesPrim },
    { name: 'a tree-like graph keeps every edge', input: { nodes: 9, density: 0, seed: 4, edges: '' },
      check: (r) => (matchesPrim(r) === true && r.tree.length === r.graph.edges.length && r.rejected === 0) || `${matchesPrim(r)}; rejected ${r.rejected}` },
    { name: 'the worked example', input: { edges: 'A-B:1, B-C:2, A-C:3, C-D:4, A-D:5' },
      check: (r) => (r.weight === 7 && r.tree.map((e) => e.u + e.v).join(' ') === 'AB BC CD' && r.examined === 4 && r.rejected === 1) || `weight ${r.weight}, tree ${r.tree.map((e) => e.u + e.v).join(' ')}, examined ${r.examined}` },
    { name: 'the predicted run rejects two edges', input: { edges: 'A-B:1, B-C:2, A-C:3, C-D:4, B-D:5, D-E:6, C-E:7' },
      check: (r) => (r.rejected === 2 && r.weight === 13 && r.examined === 6 && matchesPrim(r) === true) || `rejected ${r.rejected}, weight ${r.weight}, examined ${r.examined}` },
    { name: 'ties give the same total weight as Prim', input: { edges: 'A-B:1, B-C:1, C-D:1, D-A:1, A-C:2' },
      check: (r) => (r.weight === 3 && matchesPrim(r) === true) || `weight ${r.weight}` },
    { name: 'a disconnected graph gives a minimum spanning forest', input: { edges: 'A-B:3, B-C:1, A-C:2, D-E:4, E-F:1, D-F:5' },
      check: (r) => (!r.spanning && r.groups === 2 && r.weight === 8 && matchesPrim(r) === true) || `groups ${r.groups}, weight ${r.weight}` },
    { name: 'negative weights are handled', input: { edges: 'A-B:-2, B-C:4, A-C:-1, C-D:3, B-D:-5' },
      check: (r) => (r.weight === -8 && matchesPrim(r) === true) || `weight ${r.weight}` },
  ],
};
