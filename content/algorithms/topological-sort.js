import { graphInputs, resolveGraph, adjacency, graphView } from '../../js/lib/graphs.js';

// The shared graph inputs, with the help text of the edge field rewritten for arrows.
const inputs = graphInputs({ nodes: 8, density: 0.4, weighted: false }).map((f) => (f.id === 'edges'
  ? { ...f, help: 'Format: A>B, B>C. The arrow A>B means A must come before B.' }
  : f));

function run(input, t) {
  const graph = resolveGraph(input, { dag: true, directed: true, weighted: false });
  const ids = graph.nodes.map((n) => n.id);
  const adj = adjacency(graph);
  const indeg = new Map(ids.map((id) => [id, 0]));
  const removed = new Set();     // indices of edges already taken away
  const placed = new Map();      // id -> position in the order (1-based)
  const order = [];
  const queue = [];
  let head = 0;
  let stuck = [];
  let cycle = [];
  const cycleEdges = new Set();
  const legend = [{ label: 'being placed', role: 'current' }, { label: 'ready: nothing left before it', role: 'frontier' }, { label: 'placed in the order', role: 'done' }, { label: 'arrow already removed', role: 'dim' }];

  const views = ({ current, edge, final } = {}) => {
    const waiting = new Set(queue.slice(head));
    const g = graphView(graph, {
      nodeRole: (id) => (id === current ? 'current' : stuck.includes(id) ? 'alert' : placed.has(id) ? 'done' : waiting.has(id) ? 'frontier' : 'default'),
      nodeSub: (id) => (final === 'ok' ? `#${placed.get(id)}` : placed.has(id) && id !== current ? undefined : indeg.get(id)),
      edgeRole: (e) => (final === 'ok' ? 'default' : cycleEdges.has(e) ? 'rejected' : e === edge ? 'active' : removed.has(e) ? 'dim' : 'default'),
    });
    g.legend = final === 'cycle' ? legend.concat([{ label: 'stuck: part of a cycle, or waiting on one', role: 'alert' }]) : legend;
    const rows = { kind: 'rows', title: 'Ready queue (front on the left) and the order so far', rows: [
      { label: 'Ready', cells: queue.slice(head).map((id) => ({ t: id, role: 'frontier' })) },
      { label: 'Order', cells: order.map((id, i) => ({ t: id, sub: i + 1, role: id === current ? 'current' : 'done' })) },
    ] };
    return [g, rows];
  };

  for (const e of graph.edges) indeg.set(e.v, indeg.get(e.v) + 1);
  t.frame(() => ({ line: 1, note: `An arrow from one node to another means the first must come before the second. Under each node is its **in-degree**: the number of arrows pointing into it, which is the number of nodes it is still waiting for.`, views: views(), vars: { nodes: ids.length, arrows: graph.edges.length } }));

  for (const id of ids) if (indeg.get(id) === 0) queue.push(id);
  t.frame(() => ({ line: [2, 3], note: queue.length
    ? `${queue.join(', ')} ${queue.length === 1 ? 'has' : 'have'} in-degree 0. Nothing has to come before ${queue.length === 1 ? 'it' : 'them'}, so ${queue.length === 1 ? 'it goes' : 'they go'} into the ready queue.`
    : 'No node has in-degree 0. Every node is waiting for some other node, so there is nowhere to begin.', views: views(), vars: { ready: queue.length } }));

  while (head < queue.length) {
    const u = queue[head++];
    order.push(u);
    placed.set(u, order.length);
    const out = adj.get(u);
    t.frame(() => ({ line: [5, 6], note: `Take **${u}** from the front of the ready queue and write it down as number ${order.length} in the order. ${out.length ? `Now remove the ${out.length === 1 ? 'arrow' : `${out.length} arrows`} leaving it.` : 'No arrows leave it, so there is nothing to remove.'}`, views: views({ current: u }), vars: { u, position: order.length } }));
    for (const { to: v, e } of out) {
      t.count('edges examined');
      const before = indeg.get(v);
      indeg.set(v, before - 1);
      removed.add(e);
      const ready = before - 1 === 0;
      if (ready) queue.push(v);
      t.frame(() => ({ line: ready ? [7, 8, 9] : [7, 8],
        note: `Remove the arrow from ${u} to ${v}. ${v} was waiting for ${before} ${before === 1 ? 'node' : 'nodes'} and now waits for ${before - 1}.${ready ? ` Nothing is left before **${v}**, so it joins the back of the ready queue.` : ' It is not ready yet.'}`,
        views: views({ current: u, edge: e }), vars: { u, v, 'indegree[v]': before - 1 } }));
    }
  }

  if (order.length === ids.length) {
    t.frame(() => ({ line: 11, note: `The ready queue is empty and all ${ids.length} nodes have been placed: ${order.join(', ')}. The label under each node is now its position in that order. Check any arrow: it points from a lower position to a higher one.`, views: views({ final: 'ok' }), vars: { placed: order.length } }));
  } else {
    stuck = ids.filter((id) => !placed.has(id));
    // Walk backwards along the remaining arrows until a node repeats: that closes a cycle.
    const into = new Map();
    graph.edges.forEach((ed, e) => { if (!removed.has(e) && !into.has(ed.v)) into.set(ed.v, { from: ed.u, e }); });
    const seenAt = new Map();
    const walk = [];
    let v = stuck[0];
    while (!seenAt.has(v)) { seenAt.set(v, walk.length); walk.push(v); v = into.get(v).from; }
    cycle = walk.slice(seenAt.get(v)).reverse();
    for (const id of cycle) cycleEdges.add(into.get(id).e);
    t.frame(() => ({ line: 10, note: `The ready queue is empty, but ${stuck.join(', ')} ${stuck.length === 1 ? 'has' : 'have'} not been placed. Each of them is still waiting for another. Following the dashed arrows, ${cycle.concat(cycle[0]).join(' → ')} goes round in a **cycle**, so no order can satisfy every arrow.`, views: views({ final: 'cycle' }), vars: { placed: order.length, stuck: stuck.length } }));
  }

  return { order, graph, hasCycle: order.length < ids.length, stuck, cycle };
}

// Independent check for the tests: every arrow must run from an earlier position to a later one.
const validOrder = (r) => {
  if (r.hasCycle) return 'reported a cycle in a graph that has none';
  const pos = new Map(r.order.map((id, i) => [id, i]));
  if (pos.size !== r.graph.nodes.length || r.order.length !== r.graph.nodes.length) return 'the order does not contain every node exactly once';
  const bad = r.graph.edges.find((e) => !(pos.get(e.u) < pos.get(e.v)));
  return bad ? `arrow ${bad.u} to ${bad.v} points backwards in the order` : true;
};
// Independent cycle test: repeatedly delete nodes with no outgoing arrows; whatever cannot be deleted contains a cycle.
const reallyHasCycle = (graph) => {
  const alive = new Set(graph.nodes.map((n) => n.id));
  for (let changed = true; changed;) {
    changed = false;
    for (const id of [...alive]) {
      if (!graph.edges.some((e) => e.u === id && alive.has(e.v))) { alive.delete(id); changed = true; }
    }
  }
  return alive.size > 0;
};

export default {
  meta: {
    id: 'topological-sort',
    name: 'Topological Sort (Kahn\'s Algorithm)',
    aliases: ['topological ordering', 'toposort', 'Kahn\'s algorithm', 'dependency ordering', 'dependency resolution'],
    kind: 'algorithm',
    discipline: 'graph-theory',
    alsoIn: [
      { id: 'algorithms', why: 'Dynamic programming over a graph of subproblems must solve them in a topological order of their dependencies.' },
      { id: 'deep-learning', why: 'A network\'s computation graph is evaluated in topological order, and gradients flow back in the reverse order.' },
    ],
    subfield: 'Directed acyclic graphs',
    family: 'Ordering',
    lab: 'graphs',
    year: 1962,
    authors: 'Arthur B. Kahn',
    summary: 'Orders the nodes of a directed graph so that every arrow points forward, by repeatedly taking a node that nothing else is waiting on. Reports a cycle if no order exists.',
    difficulty: 'intermediate',
    order: 220,
    paradigms: ['graph-search'],
    randomized: false,
    approximate: false,
    time: { best: 'O(V + E)', average: 'O(V + E)', worst: 'O(V + E)', class: 'linear' },
    space: { worst: 'O(V)', class: 'linear' },
    tags: {
      problems: ['order tasks with dependencies', 'what to do first', 'schedule jobs with prerequisites', 'detect circular dependencies', 'course prerequisites', 'build order'],
      techniques: ['in-degree counting', 'queue', 'directed acyclic graph'],
      applications: ['compilers', 'data processing', 'machine learning'],
    },
    prerequisites: ['bfs', 'concept:graph', 'concept:queue', 'concept:topological-order'],
  },

  bigIdea: {
    simple: "Topological sorting puts a set of jobs in an order that obeys every \"this before that\" rule. Think of getting dressed. Socks go on before shoes. Trousers go on before a belt. A shirt goes on before a jacket. No single rule gives you the whole order, but together they forbid many orders. Here is a way to find one that works. Look for a job that is waiting for nothing, and do it. Cross off every rule that starts with that job. Some other jobs may now be waiting for nothing, so they are ready too. Keep doing a ready job and crossing off its rules until every job is done. If you get stuck with jobs left over, the rules must go round in a circle, such as A before B and B before A. Then no order can work. Computers use this method to decide which files to build first and which spreadsheet cells to calculate first.",
    what: 'A topological sort takes a directed graph, a set of nodes joined by arrows, and lists the nodes so that every arrow points from an earlier node to a later one. Kahn\'s algorithm builds the list by repeatedly choosing a node with no incoming arrows, writing it down, and deleting its outgoing arrows. If it runs out of such nodes early, the graph contains a cycle and no such list exists.',
    why: 'Whenever some things depend on others, there is a question of what can be done first. Arthur Kahn published this method in 1962 for ordering the activities of large project networks of the kind used in PERT scheduling, where each activity can start only after others have finished.',
    when: 'Use it whenever you have "must come before" constraints and need one order that satisfies all of them, or need to know whether the constraints contradict each other. If the constraints have costs or durations and you want the best schedule, a topological order is the first step, not the whole answer.',
    interesting: 'The same loop both solves the problem and proves when it cannot be solved. If every node is placed, the list is a valid order. If some are left over, each is waiting on another left-over node, and following those waits backwards must eventually come round in a circle.',
    where: 'Build tools such as `make`, package installers, spreadsheet recalculation engines and workflow schedulers all order work this way. Python ships it in the standard library as `graphlib.TopologicalSorter`, and Unix has had a `tsort` command for decades.',
    analogy: {
      title: 'Choosing courses with prerequisites',
      text: 'A course catalogue lists which courses must be passed before others. To plan a degree, first write down any course with no prerequisites. Having "taken" it, cross it off the prerequisite lists of every other course. Some courses now have nothing left on their lists, so they become available. Keep picking an available course until the plan is complete. If two courses each list the other as a prerequisite, neither ever becomes available, and the catalogue has a mistake.',
      limits: 'A student can take several courses in the same term. The algorithm writes one line, a single course at a time, and when several are available it picks by an arbitrary rule. So the order it returns is one valid order among possibly many, and it says nothing about how to finish in the fewest terms. Real prerequisites can also be waived or satisfied in alternative ways. The algorithm treats every arrow as absolute.',
    },
  },

  example: {
    setup: "Baking a cake takes five jobs. B: buy the ingredients. H: heat the oven. M: mix the batter. O: bake it in the oven. I: ice the cake. Four rules apply: B before M, M before O, H before O, and O before I. Find an order for the jobs.",
    steps: [
      "Count how many jobs each one is waiting for. B and H wait for nothing. M waits for 1 job (B). O waits for 2 jobs (M and H). I waits for 1 job (O).",
      "B and H are ready. Take B and write it down. M was waiting only for B, so M becomes ready. The ready line is now H, M.",
      "Take H and write it down. O was waiting for 2 jobs and now waits for 1, so it is not ready yet.",
      "Take M and write it down. O now waits for nothing and becomes ready.",
      "Take O and write it down, which makes I ready. Take I and write it down. Every job has been placed.",
    ],
    result: "The order is B, H, M, O, I: buy, heat, mix, bake, ice. Every job comes after the jobs it depends on. The order H, B, M, O, I would be just as correct. A set of rules can allow several valid orders, and the method returns one of them.",
    tryInput: { edges: 'B>M, M>O, H>O, O>I' },
  },

  terms: [
    { term: "Directed graph", meaning: "A set of points joined by arrows. Each arrow has a direction, from one point to another." },
    { term: "Node", meaning: "One point in a graph. Here, one job or task." },
    { term: "Directed edge", meaning: "One arrow between two nodes. Here it means the node at the tail must come before the node at the head." },
    { term: "In-degree", meaning: "The number of arrows pointing into a node. Here, the number of things it is still waiting for." },
    { term: "Cycle", meaning: "A route that follows arrows and returns to where it started, such as A before B, B before C, C before A." },
    { term: "Directed acyclic graph (DAG)", meaning: "A directed graph with no cycles. Only these can be put in a topological order." },
    { term: "Topological order", meaning: "A list of all the nodes in which every arrow points from an earlier node to a later one." },
    { term: "Queue", meaning: "A waiting line: items join at the back and leave from the front." },
  ],

  takeaway: "Keep doing a job that is waiting for nothing, and if you get stuck with jobs left over, the rules contradict each other.",

  viz: {
    describe: 'A directed graph in which an arrow from one node to another means the first must come before the second. The number beneath each node is its remaining in-degree: how many arrows still point into it. Nodes in the ready queue are ochre, the node being placed is terracotta, and placed nodes are forest green. Arrows fade once they have been removed. Below the graph, two rows show the ready queue and the order built so far. If the graph has a cycle, the run ends with the stuck nodes in brick red and one cycle drawn with dashed arrows.',
    inputs,
    presets: [
      { label: 'Small graph', values: { nodes: 6, density: 0.3, seed: 3, edges: '' } },
      { label: 'Many dependencies', values: { nodes: 10, density: 0.9, seed: 8, edges: '' } },
      { label: 'Baking a cake', values: { edges: 'B>M, M>O, H>O, O>I' } },
      { label: 'A chain: only one valid order', values: { edges: 'D>C, C>B, B>A' } },
      { label: 'Contains a cycle', values: { edges: 'A>B, B>C, C>D, D>B, A>E' } },
    ],
    tryThis: [
      'Watch the number under a node with several incoming arrows. It drops by one each time a node before it is placed, and the node turns ochre (ready) at the moment it reaches 0.',
      'Load "Contains a cycle". The run places two nodes and then stops with three nodes stuck. Remove one arrow of the cycle, for example by deleting `D>B` from the edge list, and run it again.',
      'Load "Baking a cake" and then type the rules in a different order, or add the rule `H>B`. The answer changes when more than one order is valid, and becomes forced as you add rules.',
      'Set "Extra edges" to 0 and then to 1 on the same seed. More arrows mean fewer valid orders, but the work only grows by one step per arrow.',
    ],
    run,
    report: (r, c) => (r.hasCycle
      ? `No valid order exists. Placed ${r.order.length} of ${r.graph.nodes.length} nodes${r.order.length ? ` (${r.order.join(' → ')})` : ''} before getting stuck.\nA cycle: ${r.cycle.concat(r.cycle[0]).join(' → ')}\n${c['edges examined'] || 0} arrows removed.`
      : `A valid order: ${r.order.join(' → ')}\nAll ${r.graph.nodes.length} nodes placed, ${c['edges examined'] || 0} arrows removed (every arrow exactly once).`),
    experiment: {
      title: 'Arrows removed as the graph grows',
      note: 'Each point is a real run on a random directed acyclic graph. "Few dependencies" graphs have V − 1 arrows; "many dependencies" graphs have about 2.4 arrows per node. Every arrow is removed exactly once, so the count equals the number of arrows.',
      metric: 'edges examined',
      metricLabel: 'Arrows removed',
      sizeLabel: 'Number of nodes (V)',
      sizes: [8, 16, 32, 64, 128, 256],
      variants: [{ id: 'sparse', label: 'Few dependencies' }, { id: 'dense', label: 'Many dependencies' }],
      input: (n, variant, seed) => ({ nodes: n, density: variant === 'dense' ? 1 : 0, seed, edges: '' }),
      theory: [
        { label: 'V − 1', fn: (n) => n - 1, variant: 'sparse' },
        { label: 'proportional to V (scaled)', fn: (n) => n, scaled: true, variant: 'dense' },
      ],
    },
  },

  logic: {
    intuition: 'A node with no incoming arrows is waiting for nothing, so it is safe to put next. Once it is in the list, its outgoing arrows are satisfied whatever comes later, so they can be deleted. Deleting them may leave other nodes with no incoming arrows, and the argument repeats. A graph without cycles always has at least one such node, which is why the process cannot stall unless a cycle exists.',
    steps: [
      'For every node, count the arrows pointing into it. This is its in-degree.',
      'Put every node whose in-degree is 0 into a queue of ready nodes.',
      'Remove a node `u` from the front of the queue and append it to the output order.',
      'For each arrow from `u` to a node `v`, subtract 1 from the in-degree of `v`. If it reaches 0, add `v` to the back of the queue.',
      'Repeat steps 3 and 4 until the queue is empty.',
      'If the output contains every node, it is a topological order. If not, the nodes left over contain a cycle and no order exists.',
    ],
    pseudocode: [
      'topological_sort(G):',
      '  for each node v: indegree[v] ← number of arrows into v',
      '  Q ← queue of every node with indegree 0',
      '  order ← empty list',
      '  while Q is not empty:',
      '    u ← remove the node at the front of Q',
      '    append u to order',
      '    for each arrow (u, v):',
      '      indegree[v] ← indegree[v] − 1',
      '      if indegree[v] = 0: add v to the back of Q',
      '  if order has fewer nodes than G: report a cycle',
      '  return order',
    ],
    decisions: [
      { title: 'Which ready node goes next?', text: 'Any of them: every choice leads to a valid order. This page uses a first-in, first-out queue and starts it in alphabetical order, so results are repeatable. A stack works as well. A priority queue gives the alphabetically smallest valid order at the cost of a logarithmic factor.' },
      { title: 'Delete arrows, or just count them?', text: 'Nothing is deleted from the graph. Lowering the in-degree of the node at the head of an arrow has the same effect, and it leaves the graph intact for later use. The picture fades an arrow when its count has been taken.' },
      { title: 'In-degree counting or depth-first search?', text: 'The other standard method runs [depth-first search](#/algorithm/dfs) and lists the nodes in reverse order of finishing. Both take time proportional to nodes plus arrows. Kahn\'s method needs no recursion, detects cycles as a by-product, and extends naturally to "run everything that is ready in parallel". The depth-first method is convenient when a search is being done anyway.' },
    ],
    invariants: [
      'The in-degree stored for an unplaced node equals the number of its incoming arrows whose tail has not been placed yet.',
      'A node enters the queue only when every node that must come before it has been placed.',
      'Every arrow between two placed nodes points from the earlier to the later.',
    ],
    edgeCases: [
      'A graph with a cycle: none of the nodes on the cycle ever reaches in-degree 0, so the output is short. The algorithm reports this instead of returning a partial order.',
      'Nodes that come after a cycle get stuck too, even though they are not on it, because they wait on a node that is never placed.',
      'A graph with no arrows: every node is ready at the start, and any order is valid.',
      'An arrow from a node to itself is a cycle of length one.',
      'The same arrow listed twice is harmless as long as it is counted twice and removed twice.',
      'An undirected edge has no "before" and "after", so the problem is only defined for directed graphs.',
    ],
    correctness: 'Two things need showing. First, the output is valid: a node is placed only after its in-degree has reached 0, and each unit of in-degree is removed only when the node at the tail of that arrow is placed. So every node that points to it was placed earlier. Second, if the graph has no cycle, every node is placed. Suppose some nodes are left over when the queue empties. Each has in-degree above 0, and all arrows from placed nodes have been removed, so each left-over node has an arrow coming from another left-over node. Start anywhere among them and keep stepping backwards along such an arrow. There are finitely many nodes, so the walk must revisit one, which traces out a cycle. That contradicts the assumption. Conversely, if there is a cycle, no node on it can be the first to reach in-degree 0, because the node before it on the cycle has not been placed. So the output is short exactly when a cycle exists.',
    mistakes: [
      'Returning the output without checking that it contains every node, so a circular dependency produces a short list and no warning.',
      'Starting the queue with a single node of in-degree 0 instead of all of them.',
      'Counting in-degrees but treating the arrows as undirected when removing them.',
      'Assuming the result is the only valid order and comparing two runs by exact equality.',
      'Recomputing in-degrees from scratch after each placement, which turns a linear algorithm into a quadratic one.',
    ],
  },

  code: {
    sample: {
      input: 'Two sets of rules. The cake: buy before mix, mix before bake, heat before bake, bake before ice. A loop: a before b, b before c, c before d, d before b.',
      expected: 'cake: buy heat mix bake ice\nloop: cycle detected after placing 1 of 4',
    },
    python: {
      source: `from collections import deque


def topological_order(nodes, edges):
    successors = {v: [] for v in nodes}
    indegree = {v: 0 for v in nodes}
    for u, v in edges:
        successors[u].append(v)
        indegree[v] += 1
    queue = deque(v for v in nodes if indegree[v] == 0)
    order = []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in successors[u]:
            indegree[v] -= 1
            if indegree[v] == 0:
                queue.append(v)
    return order


def report(name, nodes, edges):
    order = topological_order(nodes, edges)
    if len(order) == len(nodes):
        print(name + ": " + " ".join(order))
    else:
        print(f"{name}: cycle detected after placing {len(order)} of {len(nodes)}")


report("cake", ["buy", "heat", "mix", "bake", "ice"],
       [("buy", "mix"), ("mix", "bake"), ("heat", "bake"), ("bake", "ice")])
report("loop", ["a", "b", "c", "d"],
       [("a", "b"), ("b", "c"), ("c", "d"), ("d", "b")])`,
      notes: [
        { line: 9, text: 'Each arrow adds one to the in-degree of the node it points to. After this loop, `indegree[v]` is the number of nodes that must come before `v`.' },
        { line: 10, text: 'Every node that is waiting for nothing starts in the queue, not just one of them.' },
        { line: 16, text: 'Placing `u` satisfies the arrow from `u` to `v`. Lowering the count stands in for deleting the arrow.' },
        { line: 24, text: 'The cycle check. Nodes on a cycle never reach in-degree 0, so they never enter the queue and the order comes out short.' },
      ],
    },
    javascript: {
      source: `function topologicalOrder(nodes, edges) {
  const successors = new Map(nodes.map((v) => [v, []]));
  const indegree = new Map(nodes.map((v) => [v, 0]));
  for (const [u, v] of edges) {
    successors.get(u).push(v);
    indegree.set(v, indegree.get(v) + 1);
  }
  const queue = nodes.filter((v) => indegree.get(v) === 0);
  const order = [];
  let head = 0;  // index of the front of the queue
  while (head < queue.length) {
    const u = queue[head++];
    order.push(u);
    for (const v of successors.get(u)) {
      indegree.set(v, indegree.get(v) - 1);
      if (indegree.get(v) === 0) queue.push(v);
    }
  }
  return order;
}

function report(name, nodes, edges) {
  const order = topologicalOrder(nodes, edges);
  if (order.length === nodes.length) {
    console.log(name + ": " + order.join(" "));
  } else {
    console.log(name + ": cycle detected after placing " + order.length + " of " + nodes.length);
  }
}

report("cake", ["buy", "heat", "mix", "bake", "ice"],
  [["buy", "mix"], ["mix", "bake"], ["heat", "bake"], ["bake", "ice"]]);
report("loop", ["a", "b", "c", "d"],
  [["a", "b"], ["b", "c"], ["c", "d"], ["d", "b"]]);`,
    },
    cpp: {
      source: `#include <iostream>
#include <queue>
#include <string>
#include <utility>
#include <vector>

// Nodes are numbered 0..n-1. Returns the nodes in topological order (short if there is a cycle).
std::vector<int> topologicalOrder(int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<std::vector<int>> successors(n);
    std::vector<int> indegree(n, 0);
    for (auto [u, v] : edges) {
        successors[u].push_back(v);
        ++indegree[v];
    }
    std::queue<int> queue;
    for (int v = 0; v < n; ++v) {
        if (indegree[v] == 0) queue.push(v);
    }
    std::vector<int> order;
    while (!queue.empty()) {
        int u = queue.front();
        queue.pop();
        order.push_back(u);
        for (int v : successors[u]) {
            if (--indegree[v] == 0) queue.push(v);
        }
    }
    return order;
}

void report(const std::string& name, const std::vector<std::string>& nodes,
            const std::vector<std::pair<int, int>>& edges) {
    int n = static_cast<int>(nodes.size());
    std::vector<int> order = topologicalOrder(n, edges);
    std::cout << name << ":";
    if (static_cast<int>(order.size()) == n) {
        for (int v : order) std::cout << " " << nodes[v];
    } else {
        std::cout << " cycle detected after placing " << order.size() << " of " << n;
    }
    std::cout << "\\n";
}

int main() {
    report("cake", {"buy", "heat", "mix", "bake", "ice"}, {{0, 2}, {2, 3}, {1, 3}, {3, 4}});
    report("loop", {"a", "b", "c", "d"}, {{0, 1}, {1, 2}, {2, 3}, {3, 1}});
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Counting in-degrees looks at every arrow once. After that, each node enters and leaves the queue at most once, and each arrow is "removed" exactly once, when the node at its tail is placed. The total work is proportional to the number of nodes plus the number of arrows.',
    cases: [
      { case: 'Any input', time: 'O(V + E)', when: 'With adjacency lists. The running time does not depend on the shape of the graph, and a cycle only makes the run end sooner.' },
      { case: 'Priority queue for the ready nodes', time: 'O((V + E) log V)', when: 'When a specific order is wanted, such as the alphabetically smallest valid one.' },
      { case: 'Adjacency matrix', time: 'O(V²)', when: 'Finding the arrows that leave a node means scanning a whole row.' },
    ],
    space: 'O(V) for the in-degree counts, the queue and the output, in addition to the graph itself.',
    memory: 'One integer per node and a queue that never holds more than V entries. The graph is read but not modified.',
    tradeoffs: 'Kahn\'s method and the depth-first method have the same asymptotic cost. Kahn\'s keeps an explicit set of ready nodes, which is exactly what a scheduler needs in order to dispatch work as soon as its prerequisites complete. The depth-first method needs no in-degree array and yields the order as a by-product of a traversal.',
    assumptions: [
      'The graph is stored as adjacency lists of outgoing arrows.',
      'Queue operations and in-degree updates take constant time.',
      'The chart on this page counts arrows removed by this implementation, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Ordering tasks, files, formulas or computations that depend on one another.',
      'Detecting circular dependencies and pointing at the nodes involved.',
      'Driving schedulers: the ready queue is exactly the set of tasks that may start now.',
    ],
    struggles: [
      'Graphs with cycles, where no answer exists. Something else must first break the cycles or merge each one into a single node.',
      'Choosing the best order among the many valid ones. Minimising total time, lateness or memory are different and usually much harder problems.',
      'Constraints that are preferences and not strict rules.',
    ],
    pitfalls: [
      'Forgetting the final check and silently returning a partial order.',
      'Writing tests that expect one particular order when several are valid.',
      'Pointing the arrows the wrong way round: "A depends on B" means the arrow goes from B to A.',
    ],
    misunderstandings: [
      "\"There is one correct order.\" Usually there are many. Any order in which every arrow points forward is correct, and different methods, or the same method with a different tie-breaking rule, return different ones.",
      "\"It sorts the nodes by some value.\" Nothing is compared by size. The order comes only from the arrows. The word \"sort\" here means arranging in a line.",
      "\"It works on any graph.\" It needs a directed graph with no cycles. With a cycle there is no valid order, and the right behaviour is to say so.",
    ],
    constraints: [
      'Real dependency graphs change while work is running, so build systems and schedulers recompute or update the order incrementally.',
      'When tasks run in parallel, the order of completion is not known in advance. Schedulers use the in-degree counting itself, decrementing counts as tasks finish, instead of a precomputed list.',
    ],
    alternatives: [
      { id: 'dfs', name: 'Depth-first search ordering', when: 'You are already running a depth-first search, or want the order as the reverse of finishing times.' },
      { name: 'Strongly connected components first', when: 'The graph may contain cycles and you want to order the groups of mutually dependent nodes instead of failing.' },
      { name: 'Critical path method', when: 'Tasks have durations and you need the earliest finish time and the tasks that cannot slip. It runs over a topological order.' },
    ],
    comparison: {
      columns: ['', 'Kahn\'s algorithm', 'Depth-first search ordering'],
      rows: [
        ['Idea', 'Repeatedly place a node with in-degree 0', 'List nodes in reverse order of finishing'],
        ['Time', 'O(V + E)', 'O(V + E)'],
        ['Extra memory', 'In-degree array and a queue', 'Marks and a recursion stack'],
        ['Cycle detection', 'Output is shorter than V', 'A back edge is found'],
        ['Builds the order', 'Front to back', 'Back to front'],
        ['Fits parallel scheduling', 'Directly: the queue is the ready set', 'Not directly'],
      ],
    },
  },

  applications: [
    { title: 'Build systems', status: 'established', text: 'A build tool such as `make` reads rules that say which files are made from which others. A file must be built after everything it is made from, so the tool processes the dependency graph in a topological order and reports an error when dependencies are circular.' },
    { title: 'Spreadsheet recalculation', status: 'established', text: 'When a cell changes, every formula that depends on it must be recalculated, and each formula only after the cells it reads. Spreadsheet engines keep a dependency graph and evaluate it in topological order. A formula that refers to itself through a chain of cells is reported as a circular reference.' },
    { title: 'Automatic differentiation', status: 'established', text: 'Deep learning frameworks record a computation as a directed acyclic graph of operations. Values are computed in a topological order, and gradients are propagated in the reverse of that order, so each operation receives its full gradient before passing it back.' },
    { title: 'Package installation', status: 'established', text: 'A package manager must install a library before the packages that need it. After choosing versions, it installs in a topological order of the dependency graph.' },
    { title: 'Workflow and data pipeline schedulers', status: 'established', text: 'Schedulers such as Apache Airflow describe a pipeline as a directed acyclic graph of tasks and start each task once the tasks before it have finished, which is Kahn\'s in-degree bookkeeping carried out as work completes.' },
    { title: 'Planning a degree', status: 'illustrative', text: 'Courses and their prerequisites form a directed graph. A topological order is a sequence in which the courses could be taken one at a time, and a cycle reveals an error in the catalogue.' },
  ],

  connections: [
    { to: 'dfs', type: 'same-problem', why: 'Reversing the order in which depth-first search finishes nodes also gives a topological order, because a node finishes only after everything it points to has finished.' },
    { to: 'bfs', type: 'prerequisite', why: 'Kahn\'s algorithm has the shape of breadth-first search: a queue of nodes, each processed once, each releasing neighbours. The difference is that a node is released by its last incoming arrow, not its first.' },
    { to: 'concept:topological-order', type: 'prerequisite', why: 'The algorithm constructs exactly this object: a linear order of the nodes compatible with every arrow.' },
    { to: 'concept:queue', type: 'prerequisite', why: 'The ready nodes wait in a queue. Any container would do for correctness; the choice only decides which valid order is produced.' },
    { to: 'concept:graph', type: 'prerequisite', why: 'Dependencies are modelled as a directed graph, and a valid order exists exactly when that graph has no cycle.' },
    { to: 'bellman-ford', type: 'advanced', why: 'On a directed acyclic graph, relaxing the edges once in topological order gives shortest paths in linear time, even with negative weights. The order replaces Bellman-Ford\'s repeated passes.' },
    { to: 'concept:dynamic-programming', type: 'application', why: 'A dynamic program fills in subproblems in an order where each depends only on earlier ones. That order is a topological order of the subproblem graph.' },
    { to: 'backpropagation', type: 'application', why: 'Backpropagation visits the operations of a network in reverse topological order, so each node\'s gradient is complete before it is passed to the nodes it depends on.' },
    { to: 'discipline:deep-learning', type: 'application', why: 'Frameworks execute a model\'s computation graph in dependency order, which is a topological order of its operations.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'During the run, a node\'s in-degree reaches 0. What does that tell you?',
      options: ['The node has no outgoing arrows', 'Every node that must come before it has already been placed', 'The node is part of a cycle', 'The node will be the last in the order'],
      answer: 1,
      explain: [
        'In-degree counts incoming arrows. A node with in-degree 0 may still have many outgoing ones.',
        'Correct. Each incoming arrow is removed when the node at its tail is placed, so a count of 0 means all of them have been.',
        'It is the opposite: a node on a cycle can never reach in-degree 0.',
        'It is ready to be placed next, not last.',
      ],
    },
    {
      type: 'predict',
      q: 'The rules are A>B, B>C, C>D, D>B and A>E. What does the algorithm do?',
      options: ['Returns the order A, B, C, D, E', 'Returns the order A, E, B, C, D', 'Places A and E, then reports a cycle', 'Reports a cycle without placing anything'],
      answer: 2,
      explain: [
        'B cannot be placed: it waits for D, which waits for C, which waits for B.',
        'B, C and D wait on each other in a circle, so none of them is ever ready.',
        'Correct. A is ready at the start, and placing it releases E. B still has an arrow from D, so the queue runs dry with B, C and D left over.',
        'A has no incoming arrows, so it is placed, and so is E after it.',
      ],
      tryInput: { edges: 'A>B, B>C, C>D, D>B, A>E' },
    },
    {
      type: 'debug',
      q: 'Given tasks with a circular dependency, this function returns a short list and no warning. What is missing?',
      code: `def topological_order(successors, indegree):
    queue = deque(v for v in successors if indegree[v] == 0)
    order = []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in successors[u]:
            indegree[v] -= 1
            if indegree[v] == 0:
                queue.append(v)
    return order`,
      options: ['The queue should be a stack', 'A check after the loop that `order` contains every node', 'The in-degree should be increased, not decreased', 'A node should be added to the queue when its in-degree reaches 1'],
      answer: 1,
      explain: [
        'A stack gives a different valid order on acyclic input and has the same flaw on cyclic input.',
        'Correct. Nodes on a cycle never enter the queue, so the loop ends early. Comparing `len(order)` with the number of nodes is the cycle test.',
        'Placing a node satisfies its outgoing arrows, so the counts must go down.',
        'A count of 1 means one node that must come first has not been placed yet.',
      ],
    },
    {
      type: 'choice',
      q: 'A graph has several valid topological orders. What decides which one Kahn\'s algorithm returns?',
      options: ['The weights on the arrows', 'The rule used to pick among the ready nodes', 'The number of nodes', 'Nothing: it returns all of them'],
      answer: 1,
      explain: [
        'The arrows carry no weights in this problem.',
        'Correct. Whenever more than one node is ready, any may go next. A queue, a stack and a priority queue each make a different choice, and each result is valid.',
        'The size of the graph does not select an order.',
        'It returns a single order. Listing every valid order is a much larger task.',
      ],
    },
    {
      type: 'challenge',
      title: 'How many rounds, if ready jobs run at the same time?',
      prompt: 'Suppose every job takes one day and any number of ready jobs can be done on the same day. Modify Kahn\'s algorithm to process the ready nodes in rounds: everything ready at the start of a day is done that day. Output the jobs done on each day and the total number of days. Then explain why the number of days equals the number of nodes on the longest chain of arrows in the graph.',
      hints: ['Process the queue one whole "generation" at a time: note its length at the start of the round and remove exactly that many nodes.', 'A node\'s day is one more than the latest day among the nodes that point to it.'],
    },
  ],

  compare: {
    idea: 'Repeatedly place a node with no remaining incoming arrows and remove its outgoing arrows.',
    requires: 'A set of rules of the form: this before that. It produces an order exactly when the rules contain no loop, and reports the loop otherwise.',
    sensitivity: 'None in cost: every arrow is handled once. Which valid order comes out depends on how ties among ready nodes are broken.',
    memory: 'O(V): one in-degree counter per node plus a queue.',
    difficulty: 'low',
    difficultyNote: 'Short and free of recursion. The detail that matters is the final check for left-over nodes.',
    limits: 'It returns one valid order, with no idea of a best one. If there is a loop it gives no order at all.',
    useWhen: 'Some things must come before others, and you need an order that respects that, or a check for a circular dependency.',
  },

  advanced: {
    history: 'Arthur B. Kahn published the in-degree method in 1962 in *Communications of the ACM*, motivated by the need to order the activities of very large PERT project networks on the computers of the time. The alternative based on depth-first search became standard after depth-first search itself was established as a general tool in the early 1970s. Donald Knuth gives a version of the in-degree method, with a careful treatment of its data structures, in the first volume of *The Art of Computer Programming*.',
    proof: 'Let $G$ be a directed graph with $V$ nodes and let $L$ be the list produced.\n\n**Soundness.** Suppose $(u, v)$ is an arrow and $v \\in L$. Node $v$ was appended after its counter reached $0$. The counter starts at the in-degree of $v$ and is decremented once per incoming arrow, when that arrow\'s tail is appended. So the tail $u$ was appended before $v$. Every arrow between listed nodes therefore points forward.\n\n**Completeness.** Suppose $G$ is acyclic but $|L| < V$. Let $R$ be the set of nodes not in $L$. When the queue is empty every $v \\in R$ has a positive counter, so it has an incoming arrow whose tail was never appended, that is, a predecessor in $R$. Choose $v_0 \\in R$ and build $v_0, v_1, v_2, \\dots$ where $v_{i+1} \\in R$ is a predecessor of $v_i$. Since $R$ is finite, some node repeats, and the arrows between the two occurrences form a directed cycle, contradicting acyclicity.\n\n**Cycle detection.** If $G$ has a directed cycle $C$, consider the first node of $C$ that would be appended. Its predecessor on $C$ has not been appended, so its counter is at least $1$ and it cannot have entered the queue. Hence no node of $C$ is ever appended and $|L| < V$. Together: $|L| = V$ if and only if $G$ is acyclic.',
    complexityProof: 'Computing in-degrees takes one pass over the arrows, $O(V + E)$. Each node enters the queue at most once, because its counter reaches $0$ at most once, and leaves at most once. When node $u$ leaves, the inner loop runs once per outgoing arrow of $u$. Summed over all nodes this is at most $E$ iterations, each $O(1)$. The total is $O(V + E)$.',
    variants: [
      { name: 'Depth-first search ordering', text: 'Run depth-first search from every undiscovered node and prepend each node to the list as it finishes. A back edge signals a cycle.' },
      { name: 'Lexicographically smallest order', text: 'Keep the ready nodes in a min-heap. Each step places the smallest ready node, giving the smallest valid order in dictionary order.' },
      { name: 'Layered (parallel) ordering', text: 'Process all currently ready nodes as one layer. The number of layers equals the length of the longest path, which is the minimum number of rounds when independent tasks run together.' },
      { name: 'Incremental topological ordering', text: 'Maintains a valid order while arrows are inserted one at a time, repairing only the affected part of the order.' },
      { name: 'Condensation', text: 'When cycles are allowed, contract each strongly connected component to a single node. The result is acyclic and can be ordered.' },
    ],
    implementation: 'Number the nodes and use flat arrays for in-degrees and for the queue; the output array can serve as the queue, since nodes are placed in the order they are dequeued. Always compare the output length with the node count. When reporting a cycle to a user, show an actual cycle, found by walking backwards among the left-over nodes, and not the whole left-over set, which may include nodes that merely depend on the cycle.',
    benchmarking: 'The cost is linear and input-independent, so timing mostly measures memory access patterns. Report nodes and arrows processed per second and the graph\'s layout in memory. For schedulers, the more useful measure is how well the chosen order or layering uses the available workers.',
    references: [
      { authors: 'A. B. Kahn', year: 1962, title: 'Topological sorting of large networks', venue: 'Communications of the ACM 5(11), 558-562' },
      { authors: 'D. E. Knuth', year: 1997, title: 'The Art of Computer Programming, Volume 1: Fundamental Algorithms (3rd edition), section 2.2.3', venue: 'Addison-Wesley' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Elementary Graph Algorithms", section on topological sort (the depth-first method).',
      'R. Sedgewick and K. Wayne, *Algorithms* (4th edition), section 4.2, "Directed Graphs".',
    ],
  },

  tests: [
    { name: 'every arrow points forward on a random DAG', input: { nodes: 12, density: 0.6, seed: 21, edges: '' }, check: validOrder },
    { name: 'valid on a sparse DAG, and every arrow is removed once', input: { nodes: 14, density: 0, seed: 4, edges: '' },
      check: (r, c) => (validOrder(r) === true && c['edges examined'] === r.graph.edges.length) || `${validOrder(r)}; removed ${c['edges examined']} of ${r.graph.edges.length}` },
    { name: 'the worked example', input: { edges: 'B>M, M>O, H>O, O>I' },
      check: (r) => (r.order.join('') === 'BHMOI' && validOrder(r) === true) || `got ${r.order.join('')}` },
    { name: 'a chain has only one valid order', input: { edges: 'D>C, C>B, B>A' },
      check: (r) => r.order.join('') === 'DCBA' || `got ${r.order.join('')}` },
    { name: 'the predicted cycle', input: { edges: 'A>B, B>C, C>D, D>B, A>E' },
      check: (r) => (r.hasCycle && r.order.join('') === 'AE' && r.stuck.join('') === 'BCD' && r.cycle.length === 3 && reallyHasCycle(r.graph)) || `order ${r.order.join('')}, stuck ${r.stuck.join('')}, cycle ${r.cycle.join('')}` },
    { name: 'the reported cycle follows real arrows', input: { edges: 'A>B, B>C, C>A, C>D, D>E' },
      check: (r) => {
        if (!r.hasCycle || r.order.length !== 0) return 'expected a cycle with nothing placed';
        const has = (u, v) => r.graph.edges.some((e) => e.u === u && e.v === v);
        return r.cycle.every((id, i) => has(id, r.cycle[(i + 1) % r.cycle.length])) || `reported cycle ${r.cycle.join('')} is not a cycle of the graph`;
      } },
    { name: 'a self-loop is a cycle', input: { edges: 'A>A, A>B' },
      check: (r) => (r.hasCycle && r.cycle.join('') === 'A') || 'A>A should be reported as a cycle' },
    { name: 'agrees with an independent cycle test on acyclic input', input: { nodes: 9, density: 1, seed: 2, edges: '' },
      check: (r) => (!r.hasCycle && !reallyHasCycle(r.graph)) || 'cycle reported on a DAG' },
  ],
};
