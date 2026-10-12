import { graphInputs, resolveGraph, adjacency, graphView } from '../../js/lib/graphs.js';

function run(input, t) {
  const graph = resolveGraph(input, { weighted: false });
  const ids = graph.nodes.map((n) => n.id);
  const start = ids[0];
  const adj = adjacency(graph);
  const disc = new Map();       // discovery time
  const fin = new Map();        // finish time
  const parent = new Map();
  const parentEdge = new Map();
  const edgeKind = new Map();   // edge index -> 'tree' | 'back' | 'forward' | 'cross'
  const stack = [];
  const order = [];
  const finishOrder = [];
  let clock = 0;
  let maxDepth = 0;
  const legend = [{ label: 'current (top of the stack)', role: 'current' }, { label: 'on the stack: started, not finished', role: 'frontier' }, { label: 'finished', role: 'done' }, { label: 'tree edge', role: 'tree' }, { label: 'edge to a node already discovered', role: 'rejected' }];

  const views = ({ edge } = {}) => {
    const top = stack[stack.length - 1];
    const g = graphView(graph, {
      nodeRole: (id) => (id === top ? 'current' : fin.has(id) ? 'done' : disc.has(id) ? 'frontier' : 'default'),
      nodeSub: (id) => (fin.has(id) ? `${disc.get(id)}/${fin.get(id)}` : disc.has(id) ? disc.get(id) : undefined),
      edgeRole: (e) => (e === edge ? 'active' : edgeKind.get(e) === 'tree' ? 'tree' : edgeKind.has(e) ? 'rejected' : 'default'),
    });
    g.legend = legend;
    const rows = { kind: 'rows', title: 'Stack (top on the right), discovery order and finish order', rows: [
      { label: 'Stack', cells: stack.map((id) => ({ t: id, sub: disc.get(id), role: id === top ? 'current' : 'frontier' })) },
      { label: 'Discovered', cells: order.map((id) => ({ t: id, sub: disc.get(id), role: fin.has(id) ? 'done' : 'default' })) },
      { label: 'Finished', cells: finishOrder.map((id) => ({ t: id, sub: fin.get(id), role: 'done' })) },
    ] };
    return [g, rows];
  };

  const enter = (u) => {
    disc.set(u, ++clock);
    order.push(u);
    stack.push(u);
    maxDepth = Math.max(maxDepth, stack.length);
  };

  const visit = (u) => {
    for (const { to: v, e } of adj.get(u)) {
      t.count('edges examined');
      if (!disc.has(v)) {
        parent.set(v, u);
        parentEdge.set(v, e);
        edgeKind.set(e, 'tree');
        enter(v);
        t.frame(() => ({ line: [7, 8, 9, 5], note: `${v} has not been discovered, so follow the edge from ${u} and go deeper. **${v}** is discovered at time ${disc.get(v)} and goes on top of the stack.`, views: views({ edge: e }), vars: { u, v, time: clock, depth: stack.length } }));
        visit(v);
        continue;
      }
      let note;
      if (!graph.directed && e === parentEdge.get(u)) {
        note = `The edge to ${v} is the one we arrived by. Nothing new there.`;
      } else if (!graph.directed && edgeKind.has(e)) {
        note = edgeKind.get(e) === 'tree'
          ? `${v} was explored through this edge and is already finished. Nothing new there.`
          : `${v} is already finished, and this edge was examined earlier from ${v}'s side. Nothing new there.`;
      } else {
        const kind = !fin.has(v) ? 'back' : disc.get(u) < disc.get(v) ? 'forward' : 'cross';
        edgeKind.set(e, kind);
        note = kind === 'back'
          ? `${v} was discovered earlier and is still on the stack, so this edge leads back to an ancestor of ${u}. It closes a **cycle**. Do not follow it.`
          : kind === 'forward'
            ? `${v} was discovered after ${u} and is already finished: it was reached earlier by a longer route below ${u}. Do not follow the edge again.`
            : `${v} was finished before ${u} was discovered, so it belongs to a branch explored earlier. Do not follow the edge.`;
      }
      t.frame(() => ({ line: [6, 10], note, views: views({ edge: e }), vars: { u, v, time: clock, depth: stack.length } }));
    }
    fin.set(u, ++clock);
    finishOrder.push(u);
    stack.pop();
    const p = parent.get(u);
    t.frame(() => ({ line: 11, note: `Every edge out of ${u} has been examined, so **${u}** is finished at time ${fin.get(u)}. ${p !== undefined ? `Take it off the stack and step back to ${p}.` : 'It was the start, so the stack is now empty.'}`, views: views(), vars: { u, time: clock, depth: stack.length } }));
  };

  enter(start);
  t.frame(() => ({ line: [1, 2, 5], note: `Start at **${start}**, discovered at time 1. The stack holds the nodes on the route from the start to where we are now. The numbers under a node are the time it was discovered and, later, the time it was finished.`, views: views(), vars: { start, time: clock, depth: 1 } }));
  visit(start);

  const kinds = { tree: 0, back: 0, forward: 0, cross: 0 };
  for (const k of edgeKind.values()) kinds[k]++;
  const missed = ids.filter((id) => !disc.has(id));
  const others = kinds.back + kinds.forward + kinds.cross;
  t.frame(() => ({ line: 2, note: `The search is over. The thick edges form a tree that reaches all ${order.length} discovered nodes. ${others === 0 ? 'Every edge that was examined is a tree edge.' : `The ${others} dashed ${others === 1 ? 'edge was' : 'edges were'} not followed, because ${others === 1 ? 'it' : 'each'} led to a node already discovered.`}${kinds.back ? ` ${kinds.back < others ? `${kinds.back} of them` : others === 1 ? 'It' : 'Each of them'} pointed back at a node that was still on the stack, which proves the graph contains a cycle.` : ''}${missed.length ? ` No route leads from ${start} to ${missed.join(', ')}.` : ''}`,
    views: views(), vars: { discovered: order.length, 'tree edges': kinds.tree, 'other edges': others } }));

  return {
    order, graph, start, finishOrder, maxDepth, kinds,
    hasCycle: kinds.back > 0,
    disc: Object.fromEntries(disc), fin: Object.fromEntries(fin), parent: Object.fromEntries(parent),
    edgeKinds: Object.fromEntries(edgeKind),
  };
}

// Reference for the tests: which nodes can be reached, found by repeated sweeps over the edge list.
function reachable(graph, start) {
  const seen = new Set([start]);
  for (let k = 0; k < graph.nodes.length; k++) {
    for (const e of graph.edges) {
      if (seen.has(e.u)) seen.add(e.v);
      if (!graph.directed && seen.has(e.v)) seen.add(e.u);
    }
  }
  return seen;
}
const wellFormed = (r) => {
  const ref = reachable(r.graph, r.start);
  if (r.order.length !== ref.size || r.order.some((id) => !ref.has(id))) return 'the discovered nodes are not exactly the reachable ones';
  if (new Set(r.order).size !== r.order.length) return 'a node was discovered twice';
  // every pair of [discovery, finish] intervals must be nested or disjoint
  for (const a of r.order) for (const b of r.order) {
    if (a === b) continue;
    const [da, fa, db, fb] = [r.disc[a], r.fin[a], r.disc[b], r.fin[b]];
    if (da < db && db < fa && fa < fb) return `the intervals of ${a} and ${b} overlap without nesting`;
  }
  for (const [child, p] of Object.entries(r.parent)) {
    if (!(r.disc[p] < r.disc[child] && r.fin[child] < r.fin[p])) return `${child} is not explored entirely inside its parent ${p}`;
  }
  if (r.kinds.tree !== r.order.length - 1) return 'the tree should have one edge fewer than it has nodes';
  return true;
};

export default {
  meta: {
    id: 'dfs',
    name: 'Depth-First Search',
    aliases: ['DFS', 'depth first search', 'backtracking search', 'Trémaux\'s algorithm'],
    kind: 'algorithm',
    discipline: 'graph-theory',
    alsoIn: [
      { id: 'ai', why: 'Backtracking search, used for puzzles and constraint problems, is depth-first search over partial solutions.' },
      { id: 'algorithms', why: 'Its discovery and finish times are the basis of linear-time algorithms for cycles, ordering and connectivity.' },
    ],
    subfield: 'Graph traversal',
    family: 'Traversal',
    lab: 'graphs',
    compareGroup: 'traversal',
    summary: 'Explores a graph by following one route as far as it goes, then backing up to the most recent node that still has an untried edge.',
    difficulty: 'beginner',
    order: 210,
    paradigms: ['graph-search'],
    randomized: false,
    approximate: false,
    time: { best: 'O(V + E)', average: 'O(V + E)', worst: 'O(V + E)', class: 'linear' },
    space: { worst: 'O(V)', class: 'linear' },
    tags: {
      problems: ['explore a maze', 'explore a network', 'find a loop in a network', 'detect a cycle', 'find everything connected to a starting point', 'solve a puzzle by trial and error'],
      techniques: ['stack', 'recursion', 'backtracking', 'discovery and finish times'],
      applications: ['compilers', 'games', 'operating systems'],
    },
    prerequisites: ['concept:graph', 'concept:stack', 'concept:recursion'],
  },

  bigIdea: {
    simple: "Depth-first search is a way to explore a network of connected places. It follows one route as far as it goes before trying another. Think of exploring a maze. You walk forward, and at every junction you take a passage you have not tried yet. You keep going until you reach a dead end or a place you have already been. Then you walk back to the last junction that still has an untried passage, and take it. To avoid going round in circles, you mark each place the first time you step into it. To find your way back, you remember the route you came by. When you have backed all the way out to the start and no untried passage is left, you have visited every place that can be reached. Computers use this method to solve puzzles, to find loops in a network, and to work out which jobs must be done before others.",
    what: 'Depth-first search (DFS) visits every node that can be reached from a starting node. From each node it moves to a neighbour it has not discovered yet, and keeps going deeper. When a node has no undiscovered neighbours left, the search backs up to the node it came from and continues there. A node is a point in the network and an edge is a link between two points.',
    why: 'It needs to remember very little: only the route from the start to the current node. And the order in which it starts and finishes nodes reveals the structure of the graph. Whether there is a cycle, which nodes must come before others, and which groups of nodes are tightly connected can all be read off from one depth-first pass.',
    when: 'Use it when you need to know what is reachable, whether a cycle exists, or a valid order for dependent tasks, and when you are searching a large space of possibilities where storing a whole layer is too expensive. Do not use it to find shortest routes: for those, use [breadth-first search](#/algorithm/bfs) when all edges count the same, or [Dijkstra\'s algorithm](#/algorithm/dijkstra) when they have costs.',
    interesting: 'Give every node two timestamps, one when it is discovered and one when it is finished. For any two nodes, the two time spans are either completely separate or one sits entirely inside the other, like properly matched brackets. That one fact is the reason so many graph problems can be solved in a single depth-first pass.',
    where: 'Compilers use it to analyse the flow of control in a program. Puzzle and constraint solvers use it as backtracking search. Garbage collectors use it to mark the objects a program can still reach, and dependency tools use it to order tasks and to report circular dependencies.',
    analogy: {
      title: 'Exploring a maze with a ball of string',
      text: 'Tie one end of a string at the entrance and unwind it as you walk. Put a chalk mark on every junction you enter. At each junction, take any passage whose far end is unmarked. When every passage leads somewhere marked, wind the string back to the previous junction and try again from there. The string is the stack: it always traces the route from the entrance to where you stand. The chalk marks are the record of discovered nodes.',
      limits: 'A person in a maze can see down a corridor and guess which way looks promising. The algorithm has no such sense: it tries passages in whatever order they are listed. The string shows a way back to the entrance, not the shortest way. A place right next to the entrance may be reached only at the end of a long winding route. And a walker spends real effort winding the string back, while the computer returns to the previous junction in one step.',
    },
  },

  example: {
    setup: "Five places are joined by paths: A to B, A to C, B to D, C to D, and D to E. Start at A and try neighbours in alphabetical order. Keep a list of the places on your current route, in order. That list is called the stack.",
    steps: [
      "Start at A. Its first neighbour, B, is new, so walk to B. The stack is A, B.",
      "From B, the neighbour A is where you came from. The next neighbour, D, is new, so walk to D. The stack is A, B, D.",
      "From D, the neighbour B is where you came from. The next neighbour, C, is new, so walk to C. The stack is A, B, D, C.",
      "From C, both neighbours are already known: A is at the bottom of the stack, and D is where you came from. C is finished. Step back to D.",
      "From D, the last neighbour, E, is new. Walk to E, find nothing new there, and step back. Now D is finished, then B. Back at A, the neighbour C is already known, so A is finished and the stack is empty.",
    ],
    result: "The places were discovered in the order A, B, D, C, E. Breadth-first search on the same map visits them as A, B, C, D, E. Notice that depth-first search reached C by a route three paths long, although C is right next to A. It finds a route to every place, but not the shortest one. Notice also that from C it saw A still on the stack: that is how it knows the map contains a loop.",
    tryInput: { edges: 'A-B, A-C, B-D, C-D, D-E' },
  },

  terms: [
    { term: "Graph", meaning: "A set of points joined by links. A maze is a graph: the junctions are the points and the passages are the links." },
    { term: "Node", meaning: "One point in a graph, such as one junction. Also called a vertex." },
    { term: "Edge", meaning: "One link between two nodes, such as a passage between two junctions." },
    { term: "Stack", meaning: "A pile where you can only add to the top and take from the top, so the last item added is the first to leave." },
    { term: "Discovered", meaning: "A node is discovered the first time the search steps onto it." },
    { term: "Finished", meaning: "A node is finished when every edge leaving it has been examined and the search steps back from it for good." },
    { term: "Backtrack", meaning: "To step back to the previous node on the route because the current one has nothing new to offer." },
    { term: "Cycle", meaning: "A route that follows edges and returns to the node where it began. A loop." },
    { term: "Tree edge", meaning: "An edge the search followed to discover a new node. Together the tree edges form a tree rooted at the start." },
  ],

  takeaway: "Go as far as you can along one route, and when you are stuck, step back to the last place that still had an untried way out.",

  viz: {
    describe: 'A graph being explored depth first. The current node, at the top of the stack, is terracotta. Other nodes on the stack are ochre and finished nodes are forest green. Under each node is its discovery time, joined by its finish time once it is finished. Thick green edges are tree edges, which were followed to discover a new node. Dashed edges led to a node already discovered and were not followed. Below the graph, three rows show the stack, the order of discovery and the order of finishing.',
    inputs: graphInputs({ nodes: 8, density: 0.35, weighted: false }),
    presets: [
      { label: 'Small graph', values: { nodes: 6, density: 0.3, seed: 3, edges: '' } },
      { label: 'Tree-like graph (no cycles)', values: { nodes: 10, density: 0, seed: 5, edges: '' } },
      { label: 'Dense graph', values: { nodes: 10, density: 0.9, seed: 8, edges: '' } },
      { label: 'Directed, with a cycle', values: { edges: 'A>B, B>C, C>A, C>D, A>D' } },
      { label: 'Directed, no cycle', values: { edges: 'A>B, A>C, B>D, C>D, A>D' } },
    ],
    tryThis: [
      'Watch the "Stack" row. It always holds the route from the start to the current node, and it grows and shrinks only at its right-hand end. Compare it with the queue in the breadth-first search lesson, which grows at one end and shrinks at the other.',
      'Load "Tree-like graph (no cycles)". No dashed edges appear. Then raise "Extra edges" a little. Every extra edge adds one dashed edge, and each dashed edge closes a cycle.',
      'Load "Directed, with a cycle" and find the step where an edge points at a node still on the stack. Then load "Directed, no cycle": edges still lead to nodes already discovered, but only to finished ones, never to one on the stack.',
      'Run the default graph here and in the breadth-first search lesson. Both examine the same number of edges. Only the order of discovery differs.',
    ],
    run,
    report: (r, c) => `Discovery order from ${r.start}: ${r.order.join(' → ')}\nFinish order: ${r.finishOrder.join(' → ')}\nDiscovery/finish times: ${r.order.map((id) => `${id}=${r.disc[id]}/${r.fin[id]}`).join(', ')}\n${r.kinds.tree} tree edges, ${r.kinds.back + r.kinds.forward + r.kinds.cross} other edges. ${r.hasCycle ? 'The graph contains a cycle.' : 'No cycle was found among the nodes reached.'}\n${c['edges examined'] || 0} edges examined. Deepest stack: ${r.maxDepth}.`,
    experiment: {
      title: 'Edges examined as the graph grows',
      note: 'Each point is a real run on a random connected graph. "Tree-like" graphs have exactly V − 1 edges; "well connected" graphs have about 2.4 edges per node. Every edge of an undirected graph is examined twice, once from each end, exactly as in breadth-first search.',
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
    intuition: 'Always continue from the most recently discovered node that still has an unexamined edge. That single rule makes the search run down one branch to its end before it looks at any other. The nodes that have been started but not finished always form one chain from the start to the current node, and that chain is the stack. When the search is written as a function that calls itself, the chain is kept for you by the chain of unfinished calls.',
    steps: [
      'Set a clock to 0. Call the visit procedure on the start node.',
      'To visit a node `u`: advance the clock and record it as the discovery time of `u`.',
      'Look at each neighbour `v` of `u` in turn. If `v` has not been discovered, record that `v` was reached from `u` and visit `v` straight away, before looking at the next neighbour of `u`.',
      'If `v` has already been discovered, do not go there. If `v` is not yet finished, the edge leads back to an ancestor and closes a cycle.',
      'When every neighbour of `u` has been looked at, advance the clock and record it as the finish time of `u`. Return to the node that `u` was reached from.',
    ],
    pseudocode: [
      'dfs(G, start):',
      '  time ← 0',
      '  visit(start)',
      '',
      'visit(u):',
      '  time ← time + 1;  discovered[u] ← time',
      '  for each neighbour v of u:',
      '    if v is not discovered:',
      '      parent[v] ← u',
      '      visit(v)',
      '    otherwise: do not follow (u, v)',
      '  time ← time + 1;  finished[u] ← time',
    ],
    decisions: [
      { title: 'Recursion or an explicit stack?', text: 'The recursive form is shorter and makes finish times easy to record, so this lesson uses it. On very deep graphs the recursion can exhaust the call stack. The fix is an explicit stack that stores, for each node on it, how far through its neighbours the search has got.' },
      { title: 'One start node, or all of them?', text: 'A search from one start discovers only what that node can reach. This page does that, so it can be compared directly with breadth-first search. To cover a whole graph, repeat the search from every node that is still undiscovered. The result is a forest of trees instead of one tree.' },
      { title: 'What to do with edges that are not followed?', text: 'In an undirected graph they always lead to an ancestor on the stack, and are called back edges. In a directed graph they can also lead to a finished node, either a descendant reached earlier (a forward edge) or a node in another branch (a cross edge). Only a back edge means a cycle.' },
      { title: 'In what order are neighbours tried?', text: 'Any order gives a valid depth-first search, but the tree and the timestamps depend on it. This page tries neighbours alphabetically so that runs are repeatable.' },
    ],
    invariants: [
      'The stack holds exactly the nodes that are discovered but not finished, and they form a path of tree edges from the start to the current node.',
      'A node is finished only after every node discovered from it is finished.',
      'For any two nodes, their discovery-to-finish time spans are either disjoint or nested.',
    ],
    edgeCases: [
      'Nodes with no route from the start are never discovered by a single search.',
      'A graph with one node: it is discovered at time 1 and finished at time 2.',
      'In an undirected graph, the edge back to the parent is the edge the search arrived by. It must not be reported as a cycle.',
      'Two separate edges between the same pair of nodes do form a cycle in an undirected graph. Tracking the edge used, and not just the parent node, handles this correctly.',
      'A long path-shaped graph makes the recursion as deep as the number of nodes, which can overflow the call stack in the recursive form.',
    ],
    correctness: 'Claim: the search discovers exactly the nodes that can be reached from the start. It only ever moves along edges, so everything it discovers is reachable. For the other direction, suppose some reachable node is never discovered. Take a path from the start to it, and let `v` be the first undiscovered node on that path, with `u` just before it. Then `u` was discovered, and before `u` finished the search looked at every neighbour of `u`, including `v`. At that moment `v` was either already discovered or was discovered on the spot. Either way `v` is discovered, which contradicts the assumption. The search ends because each node is discovered at most once and each edge is looked at at most once from each end.',
    mistakes: [
      'Marking a node as discovered only after its neighbours have been explored. On any cycle the recursion then never ends.',
      'In an undirected graph, treating the edge back to the parent as proof of a cycle.',
      'Expecting the route to a node in the depth-first tree to be a shortest route.',
      'Converting to an explicit stack by pushing all neighbours at once and marking them on the push. The result visits every node, but the order is no longer a depth-first order and the finish times are lost.',
      'Relying on deep recursion in a language with a small default call stack.',
    ],
  },

  code: {
    sample: {
      input: 'An undirected graph with edges A-D, A-E, B-D, B-E, C-E, B-F, C-F, F-G. The discovery order from A, the discovery/finish times of every node, and the back edges found.',
      expected: 'order: A D B E C F G\ntimes: A:1/14 B:3/12 C:5/10 D:2/13 E:4/11 F:6/9 G:7/8\nback edges: E-A F-B',
    },
    python: {
      source: `def dfs(graph, start):
    discovered, finished = {}, {}
    parent = {start: None}
    order, back_edges = [], []
    clock = 0

    def visit(u):
        nonlocal clock
        clock += 1
        discovered[u] = clock
        order.append(u)
        for v in graph[u]:
            if v not in discovered:
                parent[v] = u
                visit(v)
            elif v not in finished and v != parent[u]:
                back_edges.append(u + "-" + v)
        clock += 1
        finished[u] = clock

    visit(start)
    return order, discovered, finished, back_edges


edges = [("A", "D"), ("A", "E"), ("B", "D"), ("B", "E"),
         ("C", "E"), ("B", "F"), ("C", "F"), ("F", "G")]
graph = {}
for u, v in edges:
    graph.setdefault(u, []).append(v)
    graph.setdefault(v, []).append(u)
for u in graph:
    graph[u].sort()

order, discovered, finished, back_edges = dfs(graph, "A")
print("order: " + " ".join(order))
print("times: " + " ".join(f"{v}:{discovered[v]}/{finished[v]}" for v in sorted(graph)))
print("back edges: " + " ".join(back_edges))`,
      notes: [
        { line: 10, text: 'The node is marked as discovered before any of its neighbours are explored. That is what stops the search from running round a cycle for ever.' },
        { line: 15, text: 'The recursive call explores everything reachable through `v` before the loop moves on to the next neighbour of `u`. This is the "depth first" in the name.' },
        { line: 16, text: 'A discovered neighbour that is not finished is still on the stack, so it is an ancestor. Unless it is the parent we just came from, the edge closes a cycle.' },
        { line: 19, text: 'The finish time is recorded after the loop, when nothing more can be discovered from `u`.' },
      ],
    },
    javascript: {
      source: `function dfs(graph, start) {
  const discovered = new Map();
  const finished = new Map();
  const parent = new Map([[start, null]]);
  const order = [];
  const backEdges = [];
  let clock = 0;

  function visit(u) {
    clock += 1;
    discovered.set(u, clock);
    order.push(u);
    for (const v of graph.get(u)) {
      if (!discovered.has(v)) {
        parent.set(v, u);
        visit(v);
      } else if (!finished.has(v) && v !== parent.get(u)) {
        backEdges.push(u + "-" + v);
      }
    }
    clock += 1;
    finished.set(u, clock);
  }

  visit(start);
  return { order, discovered, finished, backEdges };
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

const { order, discovered, finished, backEdges } = dfs(graph, "A");
const names = [...graph.keys()].sort();
console.log("order: " + order.join(" "));
console.log("times: " + names.map((v) => v + ":" + discovered.get(v) + "/" + finished.get(v)).join(" "));
console.log("back edges: " + backEdges.join(" "));`,
    },
    cpp: {
      source: `#include <algorithm>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

const int N = 7;  // nodes A..G are 0..6
std::vector<std::vector<int>> graph(N);
std::vector<int> discovered(N, 0), finished(N, 0), parent(N, -1), order;
std::vector<std::string> backEdges;
int timer = 0;

char name(int v) { return static_cast<char>('A' + v); }

void visit(int u) {
    discovered[u] = ++timer;
    order.push_back(u);
    for (int v : graph[u]) {
        if (discovered[v] == 0) {
            parent[v] = u;
            visit(v);
        } else if (finished[v] == 0 && v != parent[u]) {
            backEdges.push_back(std::string(1, name(u)) + "-" + name(v));
        }
    }
    finished[u] = ++timer;
}

int main() {
    std::vector<std::pair<int, int>> edges = {
        {0, 3}, {0, 4}, {1, 3}, {1, 4}, {2, 4}, {1, 5}, {2, 5}, {5, 6}};
    for (auto [u, v] : edges) {
        graph[u].push_back(v);
        graph[v].push_back(u);
    }
    for (auto& list : graph) std::sort(list.begin(), list.end());

    visit(0);
    std::cout << "order:";
    for (int v : order) std::cout << " " << name(v);
    std::cout << "\\ntimes:";
    for (int v = 0; v < N; ++v) std::cout << " " << name(v) << ":" << discovered[v] << "/" << finished[v];
    std::cout << "\\nback edges:";
    for (const auto& e : backEdges) std::cout << " " << e;
    std::cout << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Each node is discovered once and finished once. When a node is visited, each of its edges is examined once. Over the whole run that is every edge once in a directed graph, or twice (once from each end) in an undirected one. The total is proportional to the number of nodes plus the number of edges, the same as breadth-first search.',
    cases: [
      { case: 'Adjacency lists', time: 'O(V + E)', when: 'The usual representation: each node stores a list of its neighbours.' },
      { case: 'Adjacency matrix', time: 'O(V²)', when: 'Listing the neighbours of a node means scanning a whole row of the matrix.' },
      { case: 'Search tree generated on demand', time: 'O(b^m)', when: 'In backtracking search over a tree with branching factor b and maximum depth m, where states are not remembered, the worst case explores the whole tree.' },
    ],
    space: 'O(V) for the discovered marks and timestamps. The stack holds one entry per node on the current route, which is at most V and is often far smaller.',
    memory: 'When the graph is a search tree generated on demand and visited states are not stored, the only memory used is the current route: at most the depth of the tree times the branching factor. This is the reason backtracking solvers can search spaces far too large to hold in memory.',
    tradeoffs: 'Depth-first search trades the shortest-route guarantee for a small memory footprint and for the timestamps that expose a graph\'s structure. Breadth-first search gives shortest routes but must hold a whole layer. On infinite or very deep search spaces, depth-first search can run down one branch without ever returning, which is why depth limits and iterative deepening exist.',
    assumptions: [
      'The graph is stored as adjacency lists, so the neighbours of a node are found in time proportional to their number.',
      'Checking and setting the "discovered" mark of a node takes constant time.',
      'The bound on memory counts the stack as O(V); the recursive form uses the language\'s call stack for this.',
      'The chart on this page counts edge examinations made by this implementation, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Questions about structure: cycles, ordering of dependencies, connected pieces, bridges and articulation points.',
      'Searching huge spaces of possibilities with little memory, as in backtracking.',
      'Problems where any solution will do and solutions lie deep in the search space.',
    ],
    struggles: [
      'Shortest routes: the first route it finds to a node can be much longer than necessary.',
      'Infinite or extremely deep search spaces, where it can follow one branch for ever.',
      'Graphs shaped like long paths, where the recursive form can overflow the call stack.',
    ],
    pitfalls: [
      'Stack overflow from deep recursion.',
      'Reporting the parent edge of an undirected graph as a cycle.',
      'Assuming one search covers a graph that is in several pieces, or a directed graph where the start cannot reach everything.',
    ],
    misunderstandings: [
      "\"It finds the shortest route to each node.\" It finds a route to each node it can reach. That route can be far longer than the shortest one.",
      "\"Depth-first search does less work than breadth-first search.\" On the same graph, both look at every reachable node once and every edge the same number of times. They differ in order and in memory, not in total work.",
      "\"Every edge it does not follow means there is a cycle.\" That is true for undirected graphs. In a directed graph, only an edge to a node still on the stack means a cycle. An edge to a finished node does not.",
    ],
    constraints: [
      'Production code that may meet deep graphs uses an explicit stack, because the call stack is a fixed and often small resource.',
      'Depth-first search is hard to run in parallel: the order of discovery depends on finishing one branch before starting the next.',
    ],
    alternatives: [
      { id: 'bfs', name: 'Breadth-First Search', when: 'You need routes with the fewest edges, or the answer is likely to be near the start.' },
      { id: 'topological-sort', name: 'Topological Sort (Kahn\'s Algorithm)', when: 'You want an ordering of dependent tasks without recursion, built from in-degree counts.' },
      { id: 'union-find', name: 'Union-Find', when: 'You only need to know which nodes are connected, and edges arrive one at a time.' },
      { name: 'Iterative deepening depth-first search', when: 'You want the small memory of depth-first search and the fewest-step guarantee of breadth-first search.' },
    ],
    comparison: {
      columns: ['', 'Depth-first search', 'Breadth-first search'],
      rows: [
        ['Next node to explore', 'Most recently discovered', 'Earliest discovered'],
        ['Waiting nodes kept in', 'Stack (or recursion)', 'Queue'],
        ['Time', 'O(V + E)', 'O(V + E)'],
        ['Memory beyond the graph', 'One route at a time', 'A whole layer at a time'],
        ['Shortest routes', 'No', 'Yes, by number of edges'],
        ['Extra information produced', 'Discovery and finish times, edge types', 'Distances in edges'],
      ],
    },
  },

  applications: [
    { title: 'Strongly connected components', status: 'established', text: 'Tarjan\'s 1972 algorithm finds every group of nodes in a directed graph that can all reach one another, in a single depth-first pass. Compilers, model checkers and tools that analyse dependencies rely on it.' },
    { title: 'Backtracking solvers', status: 'established', text: 'Solvers for Sudoku, the N-queens puzzle and Boolean satisfiability build a solution one choice at a time and undo the latest choice when they reach a contradiction. That is depth-first search over partial solutions. The DPLL procedure used in satisfiability solvers has this structure.' },
    { title: 'Garbage collection', status: 'established', text: 'The mark phase of a mark-and-sweep collector starts from the variables a program can access directly and follows pointers to mark every reachable object, commonly depth first with an explicit stack.' },
    { title: 'Ordering and checking dependencies', status: 'established', text: 'Listing nodes in reverse order of finish time gives a valid order for tasks that depend on each other, and a back edge reports a circular dependency. Build tools and package managers perform this kind of check.' },
    { title: 'Maze generation', status: 'illustrative', text: 'Start with a grid of walled-off cells, walk depth first to random unvisited neighbours, and knock down the wall each time you move. The tree edges become the corridors of a maze with exactly one route between any two cells.' },
  ],

  connections: [
    { to: 'bfs', type: 'same-problem', why: 'Both visit every reachable node once and examine every edge. Breadth-first search explores the earliest discovered node next; depth-first search explores the latest.' },
    { to: 'topological-sort', type: 'application', why: 'On a graph with no cycles, the reverse of the depth-first finish order is a topological order: a node finishes only after everything it points to has finished.' },
    { to: 'concept:stack', type: 'prerequisite', why: 'Last in, first out is exactly the rule "continue from the most recently discovered node".' },
    { to: 'concept:recursion', type: 'prerequisite', why: 'Visiting a node means visiting each undiscovered neighbour by the same procedure, and the call stack remembers the way back.' },
    { to: 'concept:backtracking', type: 'related', why: 'Backtracking is depth-first search on a tree of partial solutions that is generated as the search goes.' },
    { to: 'concept:connectivity', type: 'application', why: 'One search from a node discovers exactly its connected piece of an undirected graph, and the timestamps identify bridges and strongly connected components.' },
    { to: 'concept:graph', type: 'prerequisite', why: 'The algorithm is defined on nodes and edges and nothing else.' },
    { to: 'union-find', type: 'same-problem', why: 'Both can find the connected pieces of an undirected graph. A search needs the whole graph in advance; union-find handles edges that arrive one by one.' },
    { to: 'dijkstra', type: 'related', why: 'Both are the same generic search with a different rule for which waiting node comes next: the newest for depth-first search, the cheapest for Dijkstra.' },
    { to: 'discipline:ai', type: 'application', why: 'Constraint solvers and game-tree search explore possibilities depth first, because only the current line of reasoning has to be stored.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'A depth-first search of a directed graph examines an edge that leads to a node which is discovered but not finished. What does that prove?',
      options: ['The graph is disconnected', 'The graph contains a cycle', 'The search has made a mistake', 'That node is unreachable from the start'],
      answer: 1,
      explain: [
        'It says nothing about disconnection. The node at the far end has been reached.',
        'Correct. A node that is discovered but not finished is on the stack, so there is a route from it down to the current node. The edge leads straight back, closing a loop.',
        'This is normal behaviour. The edge is simply not followed.',
        'The node was discovered, so it is reachable.',
      ],
    },
    {
      type: 'predict',
      q: 'In the graph A-B, B-C, C-D, D-E, A-F, F-E, starting from A and trying neighbours alphabetically, in what order are the nodes discovered?',
      options: ['A, B, F, C, E, D', 'A, B, C, D, E, F', 'A, F, E, D, C, B', 'A, B, C, F, E, D'],
      answer: 1,
      explain: [
        'That is the breadth-first order: both neighbours of A before anything deeper.',
        'Correct. From A the search goes to B and keeps going, through C, D and E, and reaches F last even though F is a neighbour of A.',
        'That would be the order if neighbours were tried in reverse alphabetical order, starting with F.',
        'After C, the only undiscovered neighbour is D, so the search cannot jump to F.',
      ],
      tryInput: { edges: 'A-B, B-C, C-D, D-E, A-F, F-E' },
    },
    {
      type: 'debug',
      q: 'On the graph with the single undirected edge A-B, this function never returns. What is wrong?',
      code: `def visit(u):
    for v in graph[u]:
        if v not in seen:
            visit(v)
    seen.add(u)`,
      options: ['It should use a queue', 'It marks a node as seen only after exploring its neighbours, so the search bounces between A and B for ever', 'It should check `u not in seen`', 'It needs a return value'],
      answer: 1,
      explain: [
        'A queue would make it a breadth-first search. The bug is elsewhere.',
        'Correct. `visit(A)` calls `visit(B)` before A is in `seen`, so B calls `visit(A)` again, and so on. Move `seen.add(u)` to the first line.',
        'Checking `u` inside the loop over its own neighbours would not stop the repeated calls.',
        'The search works by marking nodes, not by returning values.',
      ],
    },
    {
      type: 'choice',
      q: 'Depth-first and breadth-first search are run on the same connected undirected graph. Which statement is true?',
      options: ['Depth-first search examines fewer edges', 'Both examine every edge the same number of times, but in a different order', 'Breadth-first search discovers more nodes', 'Only depth-first search can tell whether the graph is connected'],
      answer: 1,
      explain: [
        'Neither can skip an edge: an unexamined edge might lead to an undiscovered node.',
        'Correct. Each looks at every edge once from each end. What differs is the order of discovery and how much has to be remembered along the way.',
        'Both discover exactly the nodes reachable from the start.',
        'Either search discovers every node of a connected graph, so either can test for it.',
      ],
    },
    {
      type: 'challenge',
      title: 'Remove the recursion',
      prompt: 'Rewrite the search with an explicit stack so that it produces exactly the same discovery times, finish times and back edges as the recursive version, on any graph. Then run both on a path of 100,000 nodes (0-1, 1-2, 2-3 and so on) and observe which one survives.',
      hints: ['Each stack entry needs a node and a position in that node\'s neighbour list, so that you can resume where you left off.', 'Look at the entry on top without removing it. Pop it, and record the finish time, only when its neighbour list is used up.'],
    },
  ],

  compare: {
    idea: 'Follow one route as deep as it goes, then back up to the latest node with an untried edge.',
    requires: 'Any graph, directed or undirected. Discovers exactly what the start can reach.',
    sensitivity: 'Low for total work, which depends only on the number of nodes and edges. The order of discovery depends on the order in which neighbours are listed.',
    memory: 'O(V) for marks, plus a stack as deep as the longest route followed.',
    difficulty: 'low',
    difficultyNote: 'A few lines when written recursively. The care goes into what you do with the timestamps.',
    limits: 'Routes are not shortest. Deep recursion can overflow the call stack.',
    useWhen: 'You need reachability, cycle detection or a dependency order, or memory is too tight for breadth-first search.',
  },

  advanced: {
    history: 'A depth-first strategy for solving mazes is credited to Charles Pierre Trémaux in the nineteenth century, and was described by Édouard Lucas in his *Récréations mathématiques* in 1882. Its standing as a general tool for graph algorithms comes from the early 1970s. Robert Tarjan\'s 1972 paper used it to find strongly connected components and biconnected components in linear time, and John Hopcroft and Tarjan applied it to further problems, including a linear-time test of whether a graph can be drawn in the plane without crossings. The two shared the 1986 Turing Award for their work on the design and analysis of algorithms and data structures.',
    proof: '**Nesting of time spans.** Write $d[u]$ and $f[u]$ for the discovery and finish times of $u$. For any two nodes $u$ and $v$, the intervals $[d[u], f[u]]$ and $[d[v], f[v]]$ are either disjoint or one contains the other. Suppose $d[u] < d[v]$. If $d[v] < f[u]$, then $v$ was discovered while $u$ was on the stack, so $v$ was pushed above $u$ and must be popped, that is finished, before $u$: hence $f[v] < f[u]$ and the interval of $v$ lies inside that of $u$. Otherwise $f[u] < d[v]$ and the intervals are disjoint.\n\n**Cycles.** A directed graph has a cycle exactly when a depth-first search that covers it finds a back edge. If $(u, v)$ is a back edge, $v$ is an ancestor of $u$ in the tree, and the tree path from $v$ to $u$ plus the edge $(u, v)$ is a cycle. Conversely, given a cycle, let $v$ be its first node to be discovered and $(u, v)$ the cycle edge entering $v$. At time $d[v]$ the rest of the cycle is undiscovered and reachable from $v$, so $u$ becomes a descendant of $v$ and is explored while $v$ is on the stack. When $(u, v)$ is examined, $v$ is discovered and unfinished: a back edge.\n\n**Undirected graphs.** If an edge $\\{u, v\\}$ is first examined from $u$ and $v$ is already discovered, then $v$ cannot be finished, because finishing $v$ would have examined the edge from its side first. So $v$ is on the stack and the edge is a back edge. Every edge is therefore a tree edge or a back edge.',
    complexityProof: 'The procedure `visit` is called once per discovered node, because a node is marked before the call and marked nodes are never visited again. The loop inside `visit(u)` runs once per entry of the adjacency list of $u$. Summing over all nodes gives $\\sum_u \\deg(u)$, which is $E$ for a directed graph and $2E$ for an undirected one. With $O(1)$ work per call outside the loop, the total is $O(V + E)$.',
    variants: [
      { name: 'Iterative DFS', text: 'Replaces recursion with an explicit stack of (node, next-neighbour position) pairs. Same output, no risk of call-stack overflow.' },
      { name: 'Depth-limited and iterative deepening search', text: 'Stop descending at a fixed depth, and repeat with larger limits. This finds a shallowest solution with memory proportional to the depth.' },
      { name: 'Tarjan\'s strongly connected components', text: 'Tracks, for each node, the earliest node on the stack that its subtree can reach. A node that can reach nothing earlier than itself is the root of a component.' },
      { name: 'Bridges and articulation points', text: 'The same "earliest reachable" value identifies edges and nodes whose removal would disconnect an undirected graph.' },
      { name: 'Backtracking with pruning', text: 'Depth-first search over partial solutions that abandons a branch as soon as a constraint is violated.' },
    ],
    implementation: 'Mark a node as discovered before exploring from it. Store marks and timestamps in flat arrays indexed by node number. If the input can be deep, write the iterative form from the start. In an undirected graph, skip the parent by remembering the edge you arrived by, so that parallel edges are still detected as cycles.',
    benchmarking: 'Count nodes discovered and edges examined, which do not depend on the machine. When comparing recursive and iterative forms by time, use deep and shallow graphs both: recursion overhead and cache behaviour depend strongly on the depth of the search.',
    references: [
      { authors: 'R. E. Tarjan', year: 1972, title: 'Depth-first search and linear graph algorithms', venue: 'SIAM Journal on Computing 1(2), 146-160' },
      { authors: 'J. E. Hopcroft and R. E. Tarjan', year: 1973, title: 'Algorithm 447: Efficient algorithms for graph manipulation', venue: 'Communications of the ACM 16(6), 372-378' },
      { authors: 'J. E. Hopcroft and R. E. Tarjan', year: 1974, title: 'Efficient planarity testing', venue: 'Journal of the ACM 21(4), 549-568' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Elementary Graph Algorithms", sections on depth-first search, topological sort and strongly connected components.',
      'R. Sedgewick and K. Wayne, *Algorithms* (4th edition), chapter 4, "Graphs".',
    ],
  },

  tests: [
    { name: 'discovers exactly the reachable nodes with properly nested times', input: { nodes: 12, density: 0.6, seed: 21, edges: '' }, check: wellFormed },
    { name: 'well formed on a tree-like graph, with no cycle reported', input: { nodes: 14, density: 0, seed: 4, edges: '' },
      check: (r) => (wellFormed(r) === true && !r.hasCycle && r.kinds.back === 0) || `${wellFormed(r)}; back edges ${r.kinds.back}` },
    { name: 'an undirected graph has every edge examined twice and E - V + 1 back edges', input: { nodes: 10, density: 0.5, seed: 9, edges: '' },
      check: (r, c) => (c['edges examined'] === 2 * r.graph.edges.length && r.kinds.back === r.graph.edges.length - r.graph.nodes.length + 1 && r.kinds.forward + r.kinds.cross === 0) || `examined ${c['edges examined']}, back ${r.kinds.back}` },
    { name: 'the worked example', input: { edges: 'A-B, A-C, B-D, C-D, D-E' },
      check: (r) => (r.order.join('') === 'ABDCE' && r.finishOrder.join('') === 'CEDBA' && r.disc.C === 4 && r.fin.C === 5 && r.fin.A === 10 && r.hasCycle) || `got ${r.order.join('')} / ${r.finishOrder.join('')}` },
    { name: 'the predicted discovery order', input: { edges: 'A-B, B-C, C-D, D-E, A-F, F-E' },
      check: (r) => (r.order.join('') === 'ABCDEF' && r.hasCycle) || `got ${r.order.join('')}` },
    { name: 'a directed cycle is reported', input: { edges: 'A>B, B>C, C>A, C>D, A>D' },
      check: (r) => (r.hasCycle && r.kinds.back === 1 && wellFormed(r) === true) || `back edges ${r.kinds.back}` },
    { name: 'a directed graph without a cycle has forward or cross edges but no back edge', input: { edges: 'A>B, A>C, B>D, C>D, A>D' },
      check: (r) => (!r.hasCycle && r.kinds.tree === 3 && r.kinds.cross === 1 && r.kinds.forward === 1) || `kinds ${JSON.stringify(r.kinds)}` },
    { name: 'nodes in another piece of the graph are not discovered', input: { edges: 'A-B, C-D' },
      check: (r) => r.order.join('') === 'AB' || `got ${r.order.join('')}` },
  ],
};
