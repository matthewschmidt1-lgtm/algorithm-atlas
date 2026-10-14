import { graphInputs, resolveGraph, graphView } from '../../js/lib/graphs.js';

// The same shared inputs as Dijkstra's algorithm, with the edge help extended to one-way edges.
const inputs = graphInputs({ nodes: 8, density: 0.4, weighted: true }).map((f) => (f.id === 'edges'
  ? { ...f, help: 'Format: A-B:4, B-C:2 for two-way edges. Write A>B:-2 for a one-way edge, which may have a negative weight.' }
  : f));

const show = (d) => (d === Infinity ? '∞' : d === -Infinity ? '−∞' : String(d));

function run(input, t) {
  const graph = resolveGraph(input, { weighted: true });
  const ids = graph.nodes.map((n) => n.id);
  const n = ids.length;
  const source = ids[0], target = ids[n - 1];
  // The list that every pass scans. A two-way edge can be travelled in both directions, so it appears twice.
  const arcs = [];
  graph.edges.forEach((ed, e) => {
    arcs.push({ u: ed.u, v: ed.v, w: ed.w, e });
    if (!graph.directed) arcs.push({ u: ed.v, v: ed.u, w: ed.w, e });
  });
  const dist = new Map(ids.map((id) => [id, Infinity]));
  const prev = new Map();
  const prevEdge = new Map();
  const legend = [{ label: 'start of the edge being checked', role: 'current' }, { label: 'reached, may still improve', role: 'frontier' }, { label: 'edge gives a cheaper route', role: 'active' }, { label: 'edge gives no improvement', role: 'rejected' }, { label: 'final shortest route', role: 'path' }];

  let pass = 0;
  let stage = '';                     // shown in the title of the edge list
  let improvedThisPass = new Set();   // arc indices that lowered a distance in the current pass
  let changedNodes = new Set();
  let scanned = -1;                   // index of the last arc checked in the current pass

  const views = ({ arc = -1, better = false, done = null, pathNodes, pathEdges, cycleNodes, cycleEdges, affected } = {}) => {
    const a = arc >= 0 ? arcs[arc] : null;
    const g = graphView(graph, {
      nodeRole: (id) => {
        if (affected && affected.has(id)) return 'alert';
        if (pathNodes && pathNodes.has(id)) return 'path';
        if (a && id === a.u) return 'current';
        if (done === 'ok') return dist.get(id) < Infinity ? 'done' : 'default';
        return dist.get(id) < Infinity ? 'frontier' : 'default';
      },
      nodeSub: (id) => (affected && affected.has(id) ? '−∞' : show(dist.get(id))),
      edgeRole: (e) => {
        if (cycleEdges) return cycleEdges.has(e) ? 'rejected' : 'dim';
        if (pathEdges) return pathEdges.has(e) ? 'path' : 'dim';
        if (a && e === a.e) return better ? 'active' : 'rejected';
        return 'default';
      },
    });
    g.legend = cycleNodes ? legend.concat([{ label: 'on or after a negative cycle', role: 'alert' }]) : legend;
    const rows = { kind: 'rows', title: `Edge list, scanned in this order on every pass${stage ? ` (${stage})` : ''}`, rows: [
      { label: 'Edges', cells: arcs.map((x, i) => ({ t: `${x.u}→${x.v}`, sub: x.w, role: i === arc ? (better ? 'active' : 'rejected') : improvedThisPass.has(i) ? 'compare' : i <= scanned ? 'dim' : 'default' })) },
      { label: 'Distance', cells: ids.map((id) => ({ t: id, sub: affected && affected.has(id) ? '−∞' : show(dist.get(id)), role: affected && affected.has(id) ? 'alert' : changedNodes.has(id) ? 'compare' : dist.get(id) === Infinity ? 'dim' : done === 'ok' ? 'done' : 'default' })) },
    ] };
    return [g, rows];
  };

  dist.set(source, 0);
  t.frame(() => ({ line: [1, 2], note: `Every node starts at distance ∞ (not reached yet) except the source **${source}**, at distance 0. The algorithm will sweep through the whole edge list, up to ${n - 1} times, and take any improvement an edge offers.`, views: views(), vars: { source, target, 'max passes': n - 1 } }));

  let earlyExit = false;
  let lastChanged = 0;
  for (pass = 1; pass <= n - 1; pass++) {
    improvedThisPass = new Set();
    changedNodes = new Set();
    scanned = -1;
    stage = `pass ${pass}`;
    const p = pass, was = lastChanged;
    t.frame(() => ({ line: [3, 4], note: p === 1
      ? `**Pass 1.** Check every edge once, in the order listed below the graph.`
      : `Pass ${p - 1} lowered ${was} ${was === 1 ? 'distance' : 'distances'}, and a lower distance at one node may open cheaper routes beyond it. **Pass ${p}:** check every edge again.`, views: views(), vars: { pass: p } }));
    let changed = 0;
    for (let i = 0; i < arcs.length; i++) {
      const { u, v, w, e } = arcs[i];
      t.count('relaxations');
      const du = dist.get(u), old = dist.get(v);
      const cand = du + w;
      const better = cand < old;
      if (better) {
        dist.set(v, cand);
        prev.set(v, u);
        prevEdge.set(v, e);
        changed++;
        improvedThisPass.add(i);
        changedNodes.add(v);
      }
      scanned = i;
      t.frame(() => ({ line: better ? [5, 6, 7, 8, 9] : [5, 6],
        note: du === Infinity
          ? `Edge ${u} to ${v}: ${u} has not been reached yet, so this edge cannot help for now.`
          : better
            ? `Edge ${u} to ${v} costs ${w}. Reaching ${v} through ${u} costs ${du} + ${w < 0 ? `(${w})` : w} = **${cand}**, better than ${show(old)}. Lower ${v} to ${cand}.`
            : `Edge ${u} to ${v} costs ${w}. Going through ${u} would cost ${du} + ${w < 0 ? `(${w})` : w} = ${cand}, no better than ${show(old)}. Leave ${v} alone.`,
        views: views({ arc: i, better }), vars: { pass: p, u, v, 'dist[u] + w': show(cand), 'dist[v]': show(dist.get(v)) } }));
    }
    lastChanged = changed;
    if (!changed) { earlyExit = true; break; }
  }
  const passes = Math.min(pass, n - 1);
  stage = `finished after ${passes} ${passes === 1 ? 'pass' : 'passes'}`;

  // One more scan decides whether a negative cycle can be reached. It is needed only when the last pass still changed something.
  const flagged = new Set();
  let witness = null;
  if (!earlyExit) {
    for (const a of arcs) {
      t.count('relaxations');
      if (dist.get(a.u) + a.w < dist.get(a.v)) { flagged.add(a.v); if (!witness) witness = a; }
    }
  }

  if (!witness) {
    const path = [];
    const pathEdges = new Set();
    if (dist.get(target) < Infinity) {
      for (let v = target, guard = 0; v !== undefined && guard <= n; v = prev.get(v), guard++) { path.unshift(v); if (prevEdge.has(v)) pathEdges.add(prevEdge.get(v)); }
    }
    improvedThisPass = new Set(); changedNodes = new Set(); scanned = arcs.length;
    const why = earlyExit
      ? `Pass ${passes} changed nothing, so no edge can improve any distance and further passes would change nothing either. Stop early.`
      : `All ${n - 1} passes are done, and one extra scan of the edges found nothing left to improve.`;
    t.frame(() => ({ line: earlyExit ? 10 : 14, note: `${why} ${path.length
      ? `Following the "came from" links back from ${target} gives the shortest route ${path.join(' → ')}, with total cost **${dist.get(target)}**.`
      : `${target} was never reached, so there is no route to it from ${source}.`}`,
      views: views({ done: 'ok', pathNodes: new Set(path), pathEdges }), vars: { passes, source, target, cost: show(dist.get(target)) } }));
    return { dist: Object.fromEntries(dist), path, source, target, graph, passes, earlyExit, negativeCycle: null };
  }

  // A negative cycle: trace it through the "came from" links, starting from the edge that still improves.
  const back = new Map(prev), backEdge = new Map(prevEdge);
  back.set(witness.v, witness.u); backEdge.set(witness.v, witness.e);
  let x = witness.v;
  for (let i = 0; i < n && back.has(x); i++) x = back.get(x);
  const cycle = [];
  const cycleEdges = new Set();
  if (back.has(x)) {
    let y = x;
    do { cycle.unshift(y); cycleEdges.add(backEdge.get(y)); y = back.get(y); } while (y !== x && y !== undefined && cycle.length <= n);
  }
  let cycleWeight = 0;
  for (const id of cycle) cycleWeight += graph.edges[backEdge.get(id)].w;
  // Every node that can be reached from a node that still improves has no shortest distance at all.
  const affected = new Set(flagged);
  for (let grew = true; grew;) {
    grew = false;
    for (const a of arcs) if (affected.has(a.u) && !affected.has(a.v)) { affected.add(a.v); grew = true; }
  }
  const finalDist = Object.fromEntries(ids.map((id) => [id, affected.has(id) ? -Infinity : dist.get(id)]));
  improvedThisPass = new Set(); changedNodes = new Set(); scanned = arcs.length;
  const twoWay = !graph.directed && cycle.length === 2;
  t.frame(() => ({ line: [11, 12, 13], note: `All ${n - 1} passes are done, yet the edge ${witness.u} to ${witness.v} still offers an improvement. That can only happen when a loop of edges adds up to less than zero. Here ${cycle.concat(cycle[0]).join(' → ')} totals **${cycleWeight}**: a **negative cycle**. Each trip round it lowers the cost again, so ${[...affected].sort().join(', ')} ${affected.size === 1 ? 'has' : 'have'} no shortest distance (shown as −∞).${twoWay ? ' A two-way edge with a negative weight is a negative cycle by itself, because it can be walked back and forth. Use one-way edges such as A>B:-2 to explore negative weights.' : ''}`,
    views: views({ cycleNodes: new Set(cycle), cycleEdges, affected }), vars: { passes: n - 1, 'cycle weight': cycleWeight } }));
  return { dist: finalDist, path: [], source, target, graph, passes: n - 1, earlyExit: false, negativeCycle: cycle, cycleWeight, affected: [...affected].sort() };
}

// A directed path 0 → 1 → ... → n-1 with its edges listed in a chosen order, for the experiment.
function pathGraph(n, reversed) {
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `N${i}`, x: n > 1 ? i / (n - 1) : 0.5, y: 0.5 }));
  const edges = Array.from({ length: n - 1 }, (_, i) => ({ u: `N${i}`, v: `N${i + 1}`, w: 1 }));
  if (reversed) edges.reverse();
  return { nodes, edges, directed: true, weighted: true };
}

// Reference for the tests: Floyd-Warshall, which shares no code with the implementation above.
function referenceDistances(graph, source) {
  const ids = graph.nodes.map((nd) => nd.id);
  const d = new Map(ids.map((a) => [a, new Map(ids.map((b) => [b, a === b ? 0 : Infinity]))]));
  for (const e of graph.edges) {
    d.get(e.u).set(e.v, Math.min(d.get(e.u).get(e.v), e.w));
    if (!graph.directed) d.get(e.v).set(e.u, Math.min(d.get(e.v).get(e.u), e.w));
  }
  for (const k of ids) for (const i of ids) for (const j of ids) {
    const via = d.get(i).get(k) + d.get(k).get(j);
    if (via < d.get(i).get(j)) d.get(i).set(j, via);
  }
  return Object.fromEntries(d.get(source));
}
const matchesReference = (r) => {
  if (r.negativeCycle) return 'reported a negative cycle where there is none';
  const ref = referenceDistances(r.graph, r.source);
  const bad = Object.keys(ref).find((k) => ref[k] !== r.dist[k]);
  if (bad) return `distance to ${bad} is ${r.dist[bad]}, reference says ${ref[bad]}`;
  let cost = 0;
  for (let i = 1; i < r.path.length; i++) {
    const e = r.graph.edges.find((x) => (x.u === r.path[i - 1] && x.v === r.path[i]) || (!r.graph.directed && x.v === r.path[i - 1] && x.u === r.path[i]));
    if (!e) return 'the reported path uses an edge that does not exist';
    cost += e.w;
  }
  return r.path.length === 0 || cost === r.dist[r.target] || 'the reported path does not have the reported cost';
};

export default {
  meta: {
    id: 'bellman-ford',
    name: 'Bellman-Ford Algorithm',
    aliases: ['Bellman-Ford', 'Bellman-Ford-Moore', 'negative-weight shortest paths', 'negative cycle detection', 'distance-vector routing'],
    kind: 'algorithm',
    discipline: 'graph-theory',
    alsoIn: [
      { id: 'distributed-systems', why: 'Distance-vector routing protocols such as RIP are this algorithm run by routers that only talk to their neighbours.' },
    ],
    subfield: 'Shortest paths',
    family: 'Single-source shortest paths',
    lab: 'graphs',
    compareGroup: 'shortest-path',
    year: 1958,
    authors: 'Richard Bellman and Lester R. Ford Jr.',
    summary: 'Finds cheapest routes from one node by sweeping over every edge up to V − 1 times. Slower than Dijkstra, but it allows negative weights and detects negative cycles.',
    difficulty: 'intermediate',
    order: 250,
    paradigms: ['dynamic-programming', 'iterative-refinement'],
    randomized: false,
    approximate: false,
    time: { best: 'O(E)', average: 'O(V · E)', worst: 'O(V · E)', class: 'quadratic' },
    space: { worst: 'O(V)', class: 'linear' },
    tags: {
      problems: ['shortest path', 'cheapest route', 'shortest path with negative weights', 'detect a negative cycle', 'route planning when some steps earn money back'],
      techniques: ['edge relaxation', 'repeated passes', 'dynamic programming'],
      applications: ['networking', 'distributed systems', 'finance', 'logistics'],
    },
    prerequisites: ['dijkstra', 'concept:graph', 'concept:shortest-path', 'concept:relaxation'],
  },

  bigIdea: {
    simple: "The Bellman-Ford algorithm finds the cheapest route from one place to every other place on a map. It still works when some roads have a negative cost, meaning that travelling the road earns you something back. Picture a delivery driver. Most roads cost fuel, but one road has a paying job on it. The method is patient. Write zero next to the start and \"unknown\" next to every other place. Then go through the whole list of roads. For each road, ask one question: does taking this road reach its far end more cheaply than the best known so far? If it does, write down the lower cost. One sweep through the list is not enough, because a new low cost in one place can lead to new low costs further on. So sweep again, until a whole sweep changes nothing. If the costs never stop falling, some loop of roads pays you every time you drive round it. Then no cheapest route exists to any place that can be reached by way of that loop, and the method says so.",
    what: 'Given a network where every link has a cost, which may be negative, the Bellman-Ford algorithm finds the cheapest route from a starting node to every other node. It does this by checking every edge, over and over, and lowering a node\'s cost whenever an edge offers a cheaper way to reach it. It also reports when the question has no answer because a cycle of negative total cost can be reached.',
    why: 'Dijkstra\'s algorithm is faster, but it relies on a promise that no edge has a negative cost. Many real problems break that promise: an edge can represent a gain, a refund, or a constraint that subtracts. Bellman-Ford makes no such assumption, and its rule is simple enough for every node to apply on its own with only its neighbours\' numbers, which is how early computer networks worked out their routes.',
    when: 'Use it when edge weights can be negative, when you need to know whether a negative cycle exists, or when each node can only see its own neighbours. When all weights are zero or positive and the whole graph is in one place, [Dijkstra\'s algorithm](#/algorithm/dijkstra) gives the same answers with much less work.',
    interesting: 'The algorithm never decides which node is "finished". It keeps correcting every estimate until nothing changes. That makes it slower than Dijkstra but harder to fool, and it gives the proof an unusual shape: after k passes, every estimate is at least as good as the best route with k edges.',
    where: 'The routing protocol RIP has routers run it by exchanging tables of distances with their neighbours. It is the standard way to solve systems of "difference" constraints in scheduling and layout. Other algorithms use it as a first step, for example to remove negative weights so that Dijkstra\'s algorithm can take over.',
    analogy: {
      title: 'Towns passing on news of a cheaper route',
      text: 'Every town keeps a signpost showing the cheapest known cost of reaching it from the capital. Once a day, each town tells its neighbours: "you can be reached through me for my cost plus the road between us." A town that hears a better offer than its signpost shows repaints the sign. News of a cheap route spreads one road further each day. If the map has V towns, any sensible route uses at most V − 1 roads, so after V − 1 days every signpost is right.',
      limits: 'In the story every town speaks at the same moment, and news moves exactly one road per day. The algorithm on this page checks roads one at a time in a fixed order and uses each new number immediately, so in one pass good news can travel along several roads if they happen to be listed in a helpful order. That is why it often finishes early. The story also has no ending when a loop of roads pays out: the towns would repaint their signs for ever. The algorithm stops after V − 1 passes and uses one more scan to detect the loop.',
    },
  },

  example: {
    setup: "Four towns are joined by one-way roads. A to C costs 2. C to D costs 1. A to B costs 5. B to C costs −4: this road pays you 4 instead of charging you. Find the cheapest cost from A to every town. Check the roads in the order just listed, and keep making passes until nothing changes.",
    steps: [
      "Start with A at cost 0. The other towns are unknown, written as ∞ (infinity).",
      "Pass 1. A to C: C becomes 0 + 2 = 2. C to D: D becomes 2 + 1 = 3. A to B: B becomes 0 + 5 = 5. B to C: 5 − 4 = 1, which beats 2, so C drops to 1.",
      "Pass 2. A to C offers 2, no better than 1. C to D: 1 + 1 = 2, which beats 3, so D drops to 2. A to B and B to C offer nothing new.",
      "Pass 3. No road offers an improvement. A full pass with no change means the costs are final, so stop.",
    ],
    result: "The cheapest costs from A are: B is 5, C is 1 and D is 2. The cheapest route to D is A, B, C, D. Notice that D was first given the cost 3, using the obvious route A, C, D, and was corrected in the next pass once the news about the paying road reached C. An algorithm that had declared C finished at cost 2 would have got D wrong.",
    tryInput: { edges: 'A>C:2, C>D:1, A>B:5, B>C:-4' },
  },

  terms: [
    { term: "Graph", meaning: "A set of points joined by links. A road map is a graph: the towns are the points and the roads are the links." },
    { term: "Node", meaning: "One point in a graph, such as a town. Also called a vertex." },
    { term: "Edge", meaning: "One link between two nodes, such as a road. A one-way edge can only be travelled in its direction." },
    { term: "Weight", meaning: "The cost attached to an edge. A negative weight means that using the edge gives something back." },
    { term: "Shortest path", meaning: "The route between two nodes whose weights add up to the smallest total." },
    { term: "Relaxing an edge", meaning: "Checking whether going along this edge gives a cheaper way to reach the node at its far end, and writing down the lower cost if it does." },
    { term: "Pass", meaning: "One sweep through the complete list of edges, relaxing each of them once." },
    { term: "Negative cycle", meaning: "A loop of edges whose weights add up to less than zero. Going round it again and again makes the total cost as low as you like." },
  ],

  takeaway: "Check every road again and again, taking any improvement on offer, until a whole round changes nothing.",

  viz: {
    describe: 'A weighted graph. Each node shows its best known distance from the source beneath it, or ∞ if it has not been reached. Reached nodes are ochre. The edge being checked is terracotta when it gives a cheaper route and dashed brick red when it does not, and the node at its start is highlighted. Below the graph, the first row is the edge list in the order it is scanned on every pass. Edges already checked in the current pass are faded, and those that lowered a distance are ochre. The second row lists the current distances, with those lowered in the current pass in ochre. At the end the shortest route to the last node is drawn thick, or, if a negative cycle exists, the cycle is drawn dashed and the affected nodes turn brick red with distance −∞.',
    inputs,
    presets: [
      { label: 'Same graph as Dijkstra', values: { nodes: 8, density: 0.4, seed: 3, edges: '' } },
      { label: 'Small graph', values: { nodes: 6, density: 0.35, seed: 3, edges: '' } },
      { label: 'A negative edge that pays off', values: { edges: 'A>C:2, C>D:1, A>B:5, B>C:-4' } },
      { label: 'Unlucky edge order', values: { edges: 'D>E:1, C>D:1, B>C:1, A>B:1' } },
      { label: 'Lucky edge order', values: { edges: 'A>B:1, B>C:1, C>D:1, D>E:1' } },
      { label: 'Negative cycle', values: { edges: 'A>B:1, B>C:2, C>D:-4, D>B:1, C>E:3' } },
    ],
    tryThis: [
      { ask: 'Load "Unlucky edge order" and then "Lucky edge order". It is the same chain of four roads, listed from the far end backwards in one and from the start in the other. Both runs find the same distances. How many passes will each one need?',
        reveal: 'The unlucky order needs all 4 passes plus the final check, 20 relaxations in all. Listed from the far end backwards, each pass can extend the known region by only one node. The lucky order needs 2 passes and 8 relaxations: the first pass does everything, and the second confirms that nothing changes.' },
      { ask: 'Load "A negative edge that pays off". D is set to 3 in pass 1 and corrected to 2 in pass 2, and the run takes 3 passes. Now type the same four roads in another order: `A>B:5, B>C:-4, A>C:2, C>D:1`. How many passes will it take, and will D ever hold the wrong value 3?',
        reveal: 'Two passes, and D is never 3. With A>B and B>C checked first, C is already down to 1 when C>D is reached, so D gets 2 straight away and pass 2 only confirms it: 8 relaxations in place of 12. The wrong first value came from the order of the list, and the repeated passes exist to repair whatever the order gets wrong. Dijkstra\'s algorithm has no second pass. It would have declared C final at cost 2 before the edge from B was seen, which is why it refuses negative weights.' },
      { ask: 'Load "Negative cycle". The loop B, C, D, B totals 2 − 4 + 1 = −1, and the run ends with no distance for B, C, D or E. Now change `C>D:-4` to `C>D:-3`, which makes the loop total exactly zero. Will the run still report a cycle, and what will it say about E?',
        reveal: 'No cycle is reported. The run stops after 2 passes and 10 relaxations, with E at distance 6 by the route A → B → C → E. A loop that totals zero can be walked for nothing, but it never lowers a cost, so the distances settle. Only a loop that totals less than zero keeps every pass busy. With −4 the run uses all 4 passes, and the final check still finds an edge that improves.' },
      { ask: 'Load "Same graph as Dijkstra". Dijkstra\'s algorithm finds these distances with 22 edge relaxations. Bellman-Ford will find the same distances. Will it need fewer relaxations, the same number, or more?',
        reveal: 'More: 44, exactly twice as many. The graph has 11 two-way edges, which makes 22 one-way entries in the edge list, and Bellman-Ford scans the whole list on every pass. Here it needs 2 passes, one that finds every distance and one that changes nothing. Dijkstra relaxes each entry once. And two passes is a lucky case: the limit for a graph of 8 nodes is 7.' },
    ],
    run,
    report: (r, c) => (r.negativeCycle
      ? `A negative cycle can be reached from ${r.source}: ${r.negativeCycle.concat(r.negativeCycle[0]).join(' → ')} (total ${r.cycleWeight}).\nNo shortest distance exists for: ${r.affected.join(', ')}.\nDistances that are still valid: ${Object.entries(r.dist).filter(([, v]) => v !== -Infinity).map(([k, v]) => `${k}=${show(v)}`).join(', ') || 'none'}\n${c.relaxations || 0} edge relaxations in ${r.passes} passes plus the final check.`
      : `Distances from ${r.source}: ${Object.entries(r.dist).map(([k, v]) => `${k}=${show(v)}`).join(', ')}\nShortest route to ${r.target}: ${r.path.length ? r.path.join(' → ') + ` (cost ${r.dist[r.target]})` : 'unreachable'}\n${c.relaxations || 0} edge relaxations in ${r.passes} ${r.passes === 1 ? 'pass' : 'passes'}${r.earlyExit ? ' (stopped early: the last pass changed nothing)' : ' plus the final check'}.`),
    experiment: {
      title: 'Relaxations as the graph grows, and why edge order matters',
      note: 'Each point is a real run. "Chain, worst order" and "chain, best order" are the same one-way chain of V nodes, with its edges listed from the far end backwards or from the source forwards. "Random graph" is a connected two-way graph with about 1.5 edges per node. The two curves are exact counts for the chains.',
      metric: 'relaxations',
      metricLabel: 'Edge relaxations',
      sizeLabel: 'Number of nodes (V)',
      sizes: [8, 16, 32, 64, 128, 256],
      variants: [
        { id: 'worst', label: 'Chain, worst edge order' },
        { id: 'random', label: 'Random graph' },
        { id: 'best', label: 'Chain, best edge order' },
      ],
      input: (n, variant, seed) => (variant === 'random'
        ? { nodes: n, density: 0.4, seed, edges: '' }
        : { graph: pathGraph(n, variant === 'worst'), edges: '' }),
      theory: [
        { label: 'V(V − 1): every pass is needed', fn: (n) => n * (n - 1), variant: 'worst' },
        { label: '2(V − 1): one pass to solve, one to confirm', fn: (n) => 2 * (n - 1), variant: 'best' },
      ],
    },
  },

  logic: {
    intuition: 'A cheapest route with k edges is a cheapest route with k − 1 edges plus one more edge. So if every estimate is already as good as the best route with k − 1 edges, one sweep over all edges makes every estimate as good as the best route with k edges. A route that never repeats a node has at most V − 1 edges, and when there is no negative cycle a cheapest route never needs to repeat a node. So V − 1 sweeps are enough. If a sweep after that still finds an improvement, a negative cycle must be responsible.',
    steps: [
      'Set the distance of the source to 0 and of every other node to infinity.',
      'Make a pass: for every edge from `u` to `v` with weight `w`, check whether `dist[u] + w` is smaller than `dist[v]`. If it is, lower `dist[v]` to that value and record that `v` is now reached from `u`. This check is called **relaxing** the edge.',
      'If the pass lowered no distance, stop. The distances are final.',
      'Otherwise make another pass, up to V − 1 passes in total, where V is the number of nodes.',
      'If the last allowed pass still changed something, scan the edges once more. If any edge can still be relaxed, report a negative cycle.',
      'To recover a route, follow the recorded "reached from" links backwards from the destination to the source.',
    ],
    pseudocode: [
      'bellman_ford(G, source):',
      '  for each node v: dist[v] ← ∞, prev[v] ← none',
      '  dist[source] ← 0',
      '  repeat V − 1 times:',
      '    changed ← false',
      '    for each edge (u, v) with weight w:',
      '      if dist[u] + w < dist[v]:',
      '        dist[v] ← dist[u] + w',
      '        prev[v] ← u',
      '        changed ← true',
      '    if not changed: return dist, prev',
      '  for each edge (u, v) with weight w:',
      '    if dist[u] + w < dist[v]:',
      '      report a negative cycle',
      '  return dist, prev',
    ],
    decisions: [
      { title: 'In what order are the edges scanned?', text: 'Any fixed order is correct. The order changes how many passes are needed: if edges happen to be listed in the order they appear along shortest routes, one pass is enough. This page scans them in the order they were typed or generated.' },
      { title: 'Stop early?', text: 'Yes. A pass that changes nothing proves that no edge can be relaxed, so every later pass would also change nothing. The early exit never changes the answer and often saves most of the work.' },
      { title: 'How are two-way edges handled?', text: 'A two-way edge is two one-way edges, one in each direction, and both are relaxed in every pass. This has a consequence: a two-way edge with a negative weight is a negative cycle on its own, because walking it there and back has negative total cost. Negative weights only make sense on one-way edges.' },
      { title: 'What to report when a negative cycle is found?', text: 'The simplest answer is "no solution". This page goes one step further. Nodes that cannot be reached from the cycle still have correct distances, so it keeps those and marks every node the cycle can reach as −∞.' },
    ],
    invariants: [
      'Every finite `dist[v]` is the total weight of some real route from the source to `v`, so it is never below the true shortest distance when one exists.',
      'After k passes, `dist[v]` is no greater than the cost of the cheapest route from the source to `v` that uses at most k edges.',
      'Distances only ever decrease.',
    ],
    edgeCases: [
      'A negative cycle that can be reached from the source: distances for the nodes it can reach are not defined. The algorithm detects this and reports it.',
      'A negative cycle that cannot be reached from the source does no harm and is not reported.',
      'A two-way edge with a negative weight is itself a negative cycle.',
      'Unreachable nodes keep distance infinity. In languages without a real infinity, an edge leaving an unreached node must be skipped, or "infinity minus 3" will look like an improvement.',
      'A cycle whose total is exactly zero is harmless: going round it changes nothing.',
      'A single node, or a graph with no edges: no pass changes anything and the source alone has distance 0.',
    ],
    correctness: 'Suppose no negative cycle can be reached from the source. Take any node `v` that can be reached, and a shortest route to it, `source = v0, v1, ..., vk = v`. It can be chosen to visit no node twice, since removing a loop of zero or positive total never makes it longer, so `k` is at most V − 1. Before the first pass `dist[v0]` is 0, which is correct. During pass 1 the edge from `v0` to `v1` is relaxed, so afterwards `dist[v1]` is correct. During pass 2 the edge from `v1` to `v2` is relaxed with `dist[v1]` already correct, so `dist[v2]` becomes correct, and so on. After pass `k`, `dist[v]` is correct. Estimates can never drop below the true distance, because each is the cost of a real route. So after V − 1 passes every distance is exact. For detection: if a negative cycle can be reached, suppose no edge on it could be relaxed. Then for each edge on the cycle, `dist[v]` is at most `dist[u] + w`. Adding these inequalities round the cycle, the distances cancel and what remains says the cycle\'s total weight is at least zero, a contradiction. So some edge can still be relaxed, and the final scan finds it.',
    mistakes: [
      'Relaxing edges out of unreached nodes when infinity is represented by a large number, so that "infinity plus a negative weight" passes for a real distance.',
      'Making V passes or V − 2 passes instead of V − 1, or forgetting the final scan and so never detecting negative cycles.',
      'Assuming a negative cycle anywhere in the graph spoils every distance. Only nodes that the cycle can reach are affected.',
      'Entering a negative weight on a two-way edge and being surprised by a negative cycle.',
      'Using it on a large graph with non-negative weights, where Dijkstra\'s algorithm would be far faster.',
    ],
  },

  code: {
    sample: {
      input: 'A directed graph with edges A>B:4, A>C:2, C>B:-1, B>D:3, C>D:5, D>E:-2, B>E:4, and two nodes F and G that cannot be reached from A, joined by F>G:-5. Shortest paths from A and the route to E. Then the same graph with the edge D>C:-3 added, which creates a negative cycle.',
      expected: 'A:0 B:1 C:2 D:4 E:2 F:none G:none\nA -> C -> B -> D -> E\nafter adding D>C:-3: negative cycle',
    },
    breakIt: [
      { change: 'Use a large number for infinity in place of the real one: set `INF` to 1000000000, written `10**9` in Python and `1e9` in JavaScript. F and G still cannot be reached from A. What will the first line say about them?',
        find: { python: 'INF = float("inf")', javascript: 'const INF = Infinity;' },
        replace: { python: 'INF = 10**9', javascript: 'const INF = 1e9;' },
        reveal: 'It prints "A:0 B:1 C:2 D:4 E:2 F:none G:999999995". G cannot be reached, yet it now has a distance. The edge from F to G has weight −5, and 1000000000 − 5 is smaller than 1000000000, so "not reached, minus 5" passed for an improvement. With a real infinity this cannot happen, because infinity plus any weight is still infinity. With a stand-in number, every edge that leaves an unreached node has to be skipped. The C++ version already uses a stand-in, and its test `dist[e.u] != INF` is that guard.' },
      { change: 'Remove the final scan: where the loop after the passes finds an edge that still improves, make it do nothing, so the function always returns its distances. What will the last line say about the graph with D>C:-3 added?',
        find: { python: 'return None, None  # a negative cycle can be reached', javascript: 'return null;  // a negative cycle can be reached' },
        replace: { python: 'break', javascript: 'break;' },
        reveal: 'It prints "after adding D>C:-3: no negative cycle". The cycle is there: C to B to D and back to C totals −1 + 3 − 3 = −1. The passes ran, the distances of B, C and D dropped on every one of them, and the function returned whatever numbers it had reached when the passes ran out. Those numbers are not distances. The final scan is the only thing that tells a finished answer from an interrupted one.' },
      { change: 'Make the edge between C and B two-way: next to the entry from C to B, add an entry from B to C with the same weight, −1. What will the first line of output be?',
        find: { python: '("C", "B", -1),', javascript: '["C", "B", -1],' },
        replace: { python: '("C", "B", -1), ("B", "C", -1),', javascript: '["C", "B", -1], ["B", "C", -1],' },
        reveal: 'There is none. The program stops with an error before it prints anything: "TypeError: \'NoneType\' object is not subscriptable" in Python, "TypeError: Cannot read properties of null (reading \'dist\')" in JavaScript. A two-way edge of weight −1 can be walked there and back for −2, as often as you like, so it is a negative cycle all on its own. The function said so by returning no distances, and the code that prints the first line was not expecting that. The C++ version ignores the false that its function returns, then never finishes: it follows the "came from" links round the loop for ever. Check for a negative cycle before you use the distances.' },
    ],
    python: {
      source: `INF = float("inf")


def bellman_ford(nodes, edges, source):
    dist = {v: INF for v in nodes}
    prev = {}
    dist[source] = 0
    for _ in range(len(nodes) - 1):
        changed = False
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u
                changed = True
        if not changed:
            return dist, prev
    for u, v, w in edges:
        if dist[u] + w < dist[v]:
            return None, None  # a negative cycle can be reached
    return dist, prev


def path_to(prev, target):
    route = [target]
    while route[-1] in prev:
        route.append(prev[route[-1]])
    return route[::-1]


nodes = ["A", "B", "C", "D", "E", "F", "G"]  # nothing leads from A to F or G
edges = [("A", "B", 4), ("A", "C", 2), ("C", "B", -1), ("B", "D", 3),
         ("C", "D", 5), ("D", "E", -2), ("B", "E", 4), ("F", "G", -5)]

dist, prev = bellman_ford(nodes, edges, "A")
print(" ".join(f"{v}:{dist[v] if dist[v] < INF else 'none'}" for v in nodes))
print(" -> ".join(path_to(prev, "E")))

dist, prev = bellman_ford(nodes, edges + [("D", "C", -3)], "A")
print("after adding D>C:-3: " + ("negative cycle" if dist is None else "no negative cycle"))`,
      notes: [
        { line: 8, text: 'At most V − 1 passes. A route that repeats no node has at most V − 1 edges, and each pass gets at least one more edge of every shortest route right.' },
        { line: 11, text: 'Relaxation. Python\'s floating-point infinity behaves correctly here: infinity plus any weight is still infinity, which is never less than anything.' },
        { line: 15, text: 'Early exit. If a whole pass changed nothing, no later pass can change anything either.' },
        { line: 18, text: 'After V − 1 passes nothing should be improvable. If something is, the improvement comes from going round a negative cycle.' },
      ],
    },
    javascript: {
      source: `const INF = Infinity;

function bellmanFord(nodes, edges, source) {
  const dist = new Map(nodes.map((v) => [v, INF]));
  const prev = new Map();
  dist.set(source, 0);
  for (let pass = 1; pass <= nodes.length - 1; pass++) {
    let changed = false;
    for (const [u, v, w] of edges) {
      if (dist.get(u) + w < dist.get(v)) {
        dist.set(v, dist.get(u) + w);
        prev.set(v, u);
        changed = true;
      }
    }
    if (!changed) return { dist, prev };
  }
  for (const [u, v, w] of edges) {
    if (dist.get(u) + w < dist.get(v)) return null;  // a negative cycle can be reached
  }
  return { dist, prev };
}

function pathTo(prev, target) {
  const route = [target];
  while (prev.has(route[0])) route.unshift(prev.get(route[0]));
  return route;
}

const nodes = ["A", "B", "C", "D", "E", "F", "G"];  // nothing leads from A to F or G
const edges = [["A", "B", 4], ["A", "C", 2], ["C", "B", -1], ["B", "D", 3],
  ["C", "D", 5], ["D", "E", -2], ["B", "E", 4], ["F", "G", -5]];

const result = bellmanFord(nodes, edges, "A");
const show = (d) => (d < INF ? String(d) : "none");
console.log(nodes.map((v) => v + ":" + show(result.dist.get(v))).join(" "));
console.log(pathTo(result.prev, "E").join(" -> "));

const second = bellmanFord(nodes, edges.concat([["D", "C", -3]]), "A");
console.log("after adding D>C:-3: " + (second === null ? "negative cycle" : "no negative cycle"));`,
    },
    cpp: {
      source: `#include <iostream>
#include <limits>
#include <string>
#include <vector>

struct Edge { int u, v, w; };
const int INF = std::numeric_limits<int>::max();

// Returns false if a negative cycle can be reached from the source.
bool bellmanFord(int n, const std::vector<Edge>& edges, int source,
                 std::vector<int>& dist, std::vector<int>& prev) {
    dist.assign(n, INF);
    prev.assign(n, -1);
    dist[source] = 0;
    for (int pass = 1; pass <= n - 1; ++pass) {
        bool changed = false;
        for (const Edge& e : edges) {
            if (dist[e.u] != INF && dist[e.u] + e.w < dist[e.v]) {
                dist[e.v] = dist[e.u] + e.w;
                prev[e.v] = e.u;
                changed = true;
            }
        }
        if (!changed) return true;
    }
    for (const Edge& e : edges) {
        if (dist[e.u] != INF && dist[e.u] + e.w < dist[e.v]) return false;
    }
    return true;
}

int main() {
    const int n = 7;  // nodes A..G are 0..6; nothing leads from A to F or G
    std::vector<Edge> edges = {{0, 1, 4}, {0, 2, 2}, {2, 1, -1}, {1, 3, 3},
                               {2, 3, 5}, {3, 4, -2}, {1, 4, 4}, {5, 6, -5}};
    std::vector<int> dist, prev;
    bellmanFord(n, edges, 0, dist, prev);
    for (int v = 0; v < n; ++v) {
        std::string shown = dist[v] == INF ? "none" : std::to_string(dist[v]);
        std::cout << static_cast<char>('A' + v) << ":" << shown << (v + 1 < n ? " " : "\\n");
    }
    std::vector<int> route;
    for (int v = 4; v != -1; v = prev[v]) route.insert(route.begin(), v);
    for (std::size_t i = 0; i < route.size(); ++i) {
        std::cout << static_cast<char>('A' + route[i]) << (i + 1 < route.size() ? " -> " : "\\n");
    }

    edges.push_back({3, 2, -3});
    bool ok = bellmanFord(n, edges, 0, dist, prev);
    std::cout << "after adding D>C:-3: " << (ok ? "no negative cycle" : "negative cycle") << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'One pass relaxes every edge once, which costs time proportional to E. At most V − 1 passes are made, plus one final scan, giving O(V · E) in the worst case. With the early exit, the algorithm stops after the first pass that changes nothing, which is often far sooner than V − 1 passes.',
    cases: [
      { case: 'Best', time: 'O(E)', when: 'The edges are scanned in a helpful order, so the first pass finds every distance and the second confirms that nothing changes.' },
      { case: 'Worst', time: 'O(V · E)', when: 'Some shortest route has V − 1 edges and they are scanned in the reverse of their order along the route, or a negative cycle keeps every pass busy.' },
      { case: 'Dense graph', time: 'O(V³)', when: 'When E is close to V², the worst case is cubic in the number of nodes.' },
      { case: 'Directed acyclic graph', time: 'O(V + E)', when: 'Not this algorithm, but worth knowing: if edges are relaxed once in topological order, a single pass is always enough, even with negative weights.' },
    ],
    space: 'O(V) for the distance and predecessor of each node. The edges are read as a plain list; no adjacency structure or priority queue is needed.',
    memory: 'A pass reads the edge list from start to end, which is friendly to caches and easy to run in parallel or on a graphics processor. This simplicity is one reason it is still used on hardware where a priority queue is awkward.',
    tradeoffs: 'Compared with Dijkstra\'s O((V + E) log V), Bellman-Ford gives up speed for generality: it accepts negative weights, detects negative cycles, needs no priority queue, and can run with each node knowing only its neighbours. If weights are non-negative and the graph is available in one place, that generality buys nothing.',
    assumptions: [
      'No negative cycle can be reached from the source, for the distances to be defined. The algorithm checks this assumption itself.',
      'Arithmetic on distances takes constant time and does not overflow.',
      'The bound counts one relaxation per directed edge per pass. A two-way edge counts as two.',
      'The chart on this page counts relaxations made by this implementation, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'Graphs with negative edge weights.',
      'Detecting negative cycles and identifying the nodes they affect.',
      'Distributed settings where each node knows only its neighbours.',
      'As a building block: reweighting graphs for Johnson\'s all-pairs algorithm, and solving systems of difference constraints.',
    ],
    struggles: [
      'Large graphs with non-negative weights, where it does far more work than Dijkstra\'s algorithm.',
      'Dense graphs: the worst case grows with the cube of the number of nodes.',
      'Two-way graphs with negative weights, which always contain a negative cycle.',
    ],
    pitfalls: [
      'Overflow or false improvements when a large number stands in for infinity.',
      'Treating "a negative cycle exists somewhere" as "all distances are invalid", or the reverse.',
      'In the distributed form, slow convergence after a link fails, known as the count-to-infinity problem.',
    ],
    misunderstandings: [
      "\"It always needs V − 1 passes.\" That is only the upper limit. It can stop as soon as one full pass changes nothing, which often happens after a few passes.",
      "\"Negative costs break every shortest-route method.\" They break Dijkstra's algorithm. Bellman-Ford handles negative costs correctly, as long as no loop has a negative total.",
      "\"With a negative loop, it returns the cheapest route that avoids the loop.\" No cheapest route exists for the places the loop can reach, since another trip round always lowers the cost. The algorithm reports the loop. It does not search for a best route that visits each node once, which is a different and far harder problem.",
    ],
    constraints: [
      'Routing protocols built on it limit the largest distance allowed, so that bad news about a failed link stops circulating. RIP treats a distance of 16 hops as unreachable.',
      'Real networks change while the computation runs, so distributed versions add rules such as split horizon to avoid routing loops.',
    ],
    alternatives: [
      { id: 'dijkstra', name: 'Dijkstra\'s Algorithm', when: 'All edge weights are zero or positive. It is much faster.' },
      { id: 'bfs', name: 'Breadth-First Search', when: 'Every edge has the same cost.' },
      { id: 'topological-sort', name: 'Relaxation in topological order', when: 'The graph has no directed cycles. One pass in topological order suffices, negative weights included.' },
      { id: 'floyd-warshall', name: 'Floyd-Warshall', when: 'You need shortest paths between all pairs of nodes in a small dense graph, with negative weights allowed.' },
      { name: 'Queue-based Bellman-Ford (SPFA)', when: 'You want the same guarantees but usually far fewer relaxations, by rescanning only the edges that leave nodes whose distance changed.' },
    ],
    comparison: {
      columns: ['', 'Bellman-Ford', 'Dijkstra', 'BFS'],
      rows: [
        ['Edge weights', 'Any, if no negative cycle', 'Non-negative', 'All equal'],
        ['Time', 'O(V · E)', 'O((V + E) log V)', 'O(V + E)'],
        ['Detects negative cycles', 'Yes', 'No', 'Not applicable'],
        ['Data structure', 'A list of edges', 'Priority queue', 'Queue'],
        ['A node\'s distance is final', 'Only when the run ends', 'When it leaves the queue', 'When it is first found'],
        ['Works with only local knowledge', 'Yes', 'No, needs the whole graph', 'No'],
      ],
    },
  },

  applications: [
    { title: 'Distance-vector routing', status: 'established', text: 'In the Routing Information Protocol (RIP), each router keeps a table of its distance to every destination and periodically sends it to its neighbours. A router that hears of a shorter route through a neighbour updates its table. This is Bellman-Ford with the relaxations carried out by the routers themselves. The first routing algorithm of the ARPANET worked the same way.' },
    { title: 'Systems of difference constraints', status: 'established', text: 'A set of requirements of the form "x_j − x_i is at most c" can be drawn as a graph with one edge per requirement. Shortest distances from an added source node give a solution, and a negative cycle proves that the requirements contradict each other. Scheduling with minimum and maximum gaps between events is solved this way.' },
    { title: 'Reweighting for all-pairs shortest paths', status: 'established', text: 'Johnson\'s algorithm runs Bellman-Ford once to compute a value for each node, uses those values to shift every edge weight to zero or above without changing which routes are shortest, and then runs Dijkstra\'s algorithm from every node.' },
    { title: 'Minimum-cost flow', status: 'established', text: 'Algorithms that send flow through a network at least cost work on a residual graph in which reversing a shipment has a negative cost. They use Bellman-Ford to find cheapest augmenting routes or negative cycles to cancel.' },
    { title: 'Spotting an arbitrage loop', status: 'illustrative', text: 'Take currencies as nodes and give the edge from one currency to another the weight minus the logarithm of the exchange rate. A cycle with negative total weight is then a sequence of exchanges that ends with more money than it began with. This is a textbook exercise in modelling. Real markets add fees, delays and limited volumes that the simple graph ignores.' },
  ],

  connections: [
    { to: 'dijkstra', type: 'same-problem', why: 'Both relax edges until distances stop improving. Dijkstra relaxes each edge once by choosing the order cleverly, which is only safe with non-negative weights. Bellman-Ford relaxes every edge up to V − 1 times and needs no such assumption.' },
    { to: 'bfs', type: 'related', why: 'After k passes Bellman-Ford knows the best routes of at most k edges, just as breadth-first search knows all nodes within k edges after k layers. Both grow the solution by one edge per round.' },
    { to: 'topological-sort', type: 'related', why: 'The number of passes depends on the order in which edges are scanned. On a graph without directed cycles, scanning in topological order gets every distance right in one pass.' },
    { to: 'floyd-warshall', type: 'advanced', why: 'Floyd-Warshall applies the same relaxation idea to every pair of nodes at once, building up the set of allowed intermediate nodes instead of the number of edges.' },
    { to: 'concept:relaxation', type: 'prerequisite', why: 'Its only operation on distances is relaxation: replace an estimate when a route through a neighbour is cheaper.' },
    { to: 'concept:dynamic-programming', type: 'prerequisite', why: 'It computes the cheapest route using at most k edges from the cheapest routes using at most k − 1 edges. Bellman introduced it as an example of dynamic programming.' },
    { to: 'concept:shortest-path', type: 'prerequisite', why: 'It solves the single-source shortest-path problem in its most general form, including the case where the problem has no solution.' },
    { to: 'concept:optimal-substructure', type: 'related', why: 'Every piece of a shortest route is itself a shortest route between its endpoints, which is what allows estimates to be improved one edge at a time.' },
    { to: 'discipline:distributed-systems', type: 'application', why: 'Distance-vector routing is this algorithm run across a network, with each router relaxing the edges to its own neighbours.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why are V − 1 passes always enough when there is no negative cycle?',
      options: ['Because there are V − 1 edges in every graph', 'Because a shortest route never needs to visit a node twice, so it has at most V − 1 edges, and each pass gets one more of its edges right', 'Because each pass settles exactly one node', 'Because the distances are sorted after V − 1 passes'],
      answer: 1,
      explain: [
        'A graph can have far more than V − 1 edges. The limit is on the length of one route, not the size of the graph.',
        'Correct. Without negative cycles, repeating a node never helps. A route through V nodes has V − 1 edges, and pass k fixes the k-th edge of every shortest route at the latest.',
        'A pass can fix many nodes or none. Nothing is marked as settled in this algorithm.',
        'Nothing is sorted. The passes propagate improvements along routes.',
      ],
    },
    {
      type: 'predict',
      q: 'The one-way roads are A>B:2, A>C:4, C>D:1, D>C:-2, D>E:3 and B>E:7. What does the algorithm report for the distance from A to E?',
      options: ['9', '8', 'No shortest distance: a negative cycle can be reached', 'E is unreachable'],
      answer: 2,
      explain: [
        '9 is the cost of A, B, E, which stays clear of the loop. But E can also be reached through C and D, and that way can be made as cheap as you like.',
        '8 is the cost of A, C, D, E with no trip round the loop. One trip round C, D, C first gives 7, a second gives 6, and it never stops.',
        'The loop C, D, C totals 1 − 2 = −1. E can be reached from D, so its cost can be pushed as low as you like. A and B keep their distances, 0 and 2, because the loop cannot reach them.',
        'E can be reached, through B and through D.',
      ],
      tryInput: { edges: 'A>B:2, A>C:4, C>D:1, D>C:-2, D>E:3, B>E:7' },
      check: (r) => (!!r.negativeCycle && r.cycleWeight === -1 && [...r.negativeCycle].sort().join('') === 'CD' && r.dist.E === -Infinity && r.dist.A === 0 && r.dist.B === 2) || `cycle ${r.negativeCycle && r.negativeCycle.join('')}, E=${r.dist.E}, B=${r.dist.B}`,
    },
    {
      type: 'debug',
      q: 'This version uses a large number for infinity. On a graph where node X cannot be reached and has an edge X>Y with weight −5, it reports a distance of 999999995 for Y, which also cannot be reached. What is wrong?',
      code: `INF = 10**9
dist = {v: INF for v in nodes}
dist[source] = 0
for _ in range(len(nodes) - 1):
    for u, v, w in edges:
        if dist[u] + w < dist[v]:
            dist[v] = dist[u] + w`,
      options: ['The loop should run len(nodes) times', 'It relaxes edges that leave unreached nodes, and INF − 5 is smaller than INF', 'The comparison should be <=', 'INF is too small'],
      answer: 1,
      explain: [
        'V − 1 passes is the right number.',
        'Correct. With a finite stand-in for infinity, "unreached plus a negative weight" looks like an improvement. Skip the edge when `dist[u]` is INF.',
        'Using <= would only cause pointless updates and could prevent the early exit.',
        'Any finite stand-in has this problem. A larger one risks overflow as well.',
      ],
    },
    {
      type: 'choice',
      q: 'A road network has 100,000 junctions and no negative costs. Which algorithm should compute routes from one junction, and why?',
      options: ['Bellman-Ford, because it is more general', 'Dijkstra, because with non-negative weights it gives the same answers with far fewer relaxations', 'Bellman-Ford, because it detects negative cycles', 'Either: they do the same amount of work'],
      answer: 1,
      explain: [
        'Generality that is not needed costs time. Bellman-Ford may relax every edge thousands of times here.',
        'Correct. Dijkstra relaxes each edge once. Bellman-Ford\'s advantages only matter when weights can be negative or the graph cannot be seen in one place.',
        'There are no negative weights, so there can be no negative cycle to detect.',
        'Their worst cases differ by roughly a factor of V divided by log V.',
      ],
    },
    {
      type: 'challenge',
      title: 'Only recheck what changed',
      prompt: 'A pass wastes time on edges that leave nodes whose distance did not change. Write a version that keeps a queue of nodes whose distance was lowered. Take a node from the queue, relax only the edges leaving it, and add any node whose distance drops (if it is not already waiting). Count relaxations, one for every edge you check, and compare with the plain version on three presets of this page: "Unlucky edge order", "Lucky edge order" and "A negative edge that pays off". Then add negative-cycle detection: decide how your version can tell that it will never stop, and try it on the preset "Negative cycle".',
      expect: 'The queue version needs 4 relaxations on "Unlucky edge order", 4 on "Lucky edge order" and 5 on "A negative edge that pays off", where the plain version on this page needs 20, 8 and 12. The distances are the same: E is 4 on both chains, and B, C and D are 5, 1 and 2 on the third. The order of the edge list no longer matters, because a node is rechecked only when its own distance has dropped. On "Negative cycle" a version with no detection never stops. One that counts how often each node enters the queue, and gives up when a node enters for the fifth time in this graph of five nodes, stops after 17 relaxations with B as the node that went over.',
      hints: ['Keep a flag per node saying whether it is currently in the queue.', 'Count how many times each node has entered the queue. In a graph without negative cycles, no node needs to enter more than V − 1 times.'],
    },
  ],

  compare: {
    idea: 'Relax every edge, pass after pass, until nothing improves or V − 1 passes have been made.',
    requires: 'A network with a cost on each link. Any costs are allowed. The answer is exact unless there is a loop that gets cheaper every time round, and then it reports the loop.',
    sensitivity: 'High. The work depends on the order in which edges are scanned and on how many edges shortest routes have, from one pass to V − 1.',
    memory: 'O(V) for distances and predecessors, plus the edge list.',
    difficulty: 'low',
    difficultyNote: 'Two nested loops. The subtleties are the stand-in for infinity and what to report when a negative cycle exists.',
    limits: 'Slower than Dijkstra\'s algorithm: it checks every link once for each place in the network. Where an ever-cheaper loop can be reached, there is no answer to give.',
    useWhen: 'Some steps have a negative cost, you need to detect a loop that keeps getting cheaper, or each place knows only its neighbours.',
  },

  advanced: {
    history: 'Lester Ford Jr. described the method in a 1956 RAND Corporation paper on network flow, and Richard Bellman published it in 1958 in a short paper that treated routing as a dynamic programming problem. Edward F. Moore presented a closely related method in 1957, published in 1959, so the name Bellman-Ford-Moore is also used. Alfonso Shimbel had described the same computation in 1955. The distributed form became the first routing algorithm of the ARPANET and later the basis of the Routing Information Protocol. For decades O(V · E) remained the best known bound for general negative weights; in 2022 Bernstein, Nanongkai and Wulff-Nilsen gave a randomized algorithm that runs in near-linear time when the weights are integers.',
    derivation: 'Let $d_k(v)$ be the weight of a cheapest walk from the source $s$ to $v$ that uses at most $k$ edges, with $d_k(v) = \\infty$ if there is none. Then $d_0(s) = 0$, $d_0(v) = \\infty$ for $v \\ne s$, and\n\n$$d_k(v) = \\min\\Bigl(d_{k-1}(v),\\ \\min_{(u,v) \\in E}\\bigl(d_{k-1}(u) + w(u,v)\\bigr)\\Bigr).$$\n\nThis is a dynamic program over the number of edges, and filling it in row by row needs two arrays. Bellman-Ford keeps a single array and updates it in place. Using a value from the current pass instead of the previous one can only make an estimate smaller, and every estimate is still the weight of a real walk, so the in-place version satisfies $\\text{dist}[v] \\le d_k(v)$ after pass $k$ and may converge sooner.',
    proof: 'Write $\\delta(v)$ for the true shortest distance.\n\n**Lower bound.** Every finite $\\text{dist}[v]$ equals the weight of some walk from $s$ to $v$, by induction on the number of relaxations. So if no negative cycle is reachable, $\\text{dist}[v] \\ge \\delta(v)$ at all times.\n\n**Upper bound.** After pass $k$, $\\text{dist}[v] \\le d_k(v)$. This holds for $k = 0$. If it holds for $k - 1$, then during pass $k$ each edge $(u, v)$ is relaxed when $\\text{dist}[u] \\le d_{k-1}(u)$, so afterwards $\\text{dist}[v] \\le d_{k-1}(u) + w(u, v)$ for every edge into $v$; together with monotonicity this gives $\\text{dist}[v] \\le d_k(v)$.\n\n**Exactness.** With no reachable negative cycle, some shortest walk to each reachable $v$ is a simple path, with at most $V - 1$ edges, so $d_{V-1}(v) = \\delta(v)$ and the two bounds meet after $V - 1$ passes.\n\n**Detection.** If the distances are exact, then $\\delta(v) \\le \\delta(u) + w(u, v)$ for every edge and nothing can be relaxed. Conversely let $c_0, c_1, \\dots, c_m = c_0$ be a reachable cycle of negative weight and suppose no edge of it can be relaxed: $\\text{dist}[c_i] \\le \\text{dist}[c_{i-1}] + w(c_{i-1}, c_i)$ for all $i$. All these distances are finite. Summing over $i$, the distance terms cancel and leave $0 \\le \\sum_i w(c_{i-1}, c_i) < 0$, a contradiction.\n\n**Early exit.** If a pass changes nothing, then no edge can be relaxed, so the state is a fixed point and equals the state after $V - 1$ passes.',
    complexityProof: 'Each pass performs one comparison and at most one update per directed edge, $O(E)$ in total. There are at most $V - 1$ passes and one final scan, so the running time is $O(V \\cdot E)$. The bound is reached on a directed path of $V$ nodes whose edges are listed from the far end backwards: pass $k$ can only fix the node at distance $k$, so all $V - 1$ passes do work, for exactly $(V - 1)^2$ relaxations plus $V - 1$ in the final scan, which is $V(V - 1)$. The experiment on this page measures exactly this.',
    variants: [
      { name: 'Queue-based Bellman-Ford (SPFA)', text: 'Keeps a queue of nodes whose distance changed and relaxes only their outgoing edges. Same worst case, usually much faster in practice. Moore\'s 1959 method has this form.' },
      { name: 'Yen\'s improvement', text: 'Splits the edges into those that go forward and those that go backward in a fixed numbering of the nodes and relaxes each group in a matching order, roughly halving the number of passes needed.' },
      { name: 'Distance-vector routing', text: 'The distributed, asynchronous form: each node relaxes the edges to its neighbours whenever it receives their distance tables.' },
      { name: 'Johnson\'s algorithm', text: 'One Bellman-Ford run produces node potentials that make all weights non-negative, after which Dijkstra\'s algorithm is run from every node to get all-pairs shortest paths.' },
      { name: 'Shortest paths in a DAG', text: 'With edges relaxed in topological order, one pass is always sufficient.' },
    ],
    implementation: 'Store the edges in a flat array and scan it; no adjacency lists are needed. Guard relaxations with a test that the tail has been reached, unless the number type has a true infinity. Keep the early exit. To print a negative cycle, start from a node relaxed in the final scan, follow predecessor links V times to be sure of standing on the cycle, and then walk round it once.',
    benchmarking: 'Report the number of passes as well as the number of relaxations, and say how the edge order was chosen, since the same graph can take one pass or V − 1. Comparisons with Dijkstra\'s algorithm should use the same graphs with non-negative weights and count relaxations for both.',
    references: [
      { authors: 'R. Bellman', year: 1958, title: 'On a routing problem', venue: 'Quarterly of Applied Mathematics 16(1), 87-90' },
      { authors: 'L. R. Ford Jr.', year: 1956, title: 'Network flow theory', venue: 'RAND Corporation, Paper P-923' },
      { authors: 'E. F. Moore', year: 1959, title: 'The shortest path through a maze', venue: 'Proceedings of the International Symposium on the Theory of Switching, Harvard University Press' },
      { authors: 'C. Hedrick', year: 1988, title: 'Routing Information Protocol', venue: 'RFC 1058, Internet Engineering Task Force' },
      { authors: 'A. Bernstein, D. Nanongkai and C. Wulff-Nilsen', year: 2022, title: 'Negative-weight single-source shortest paths in near-linear time', venue: 'IEEE 63rd Annual Symposium on Foundations of Computer Science (FOCS)' },
    ],
    furtherReading: [
      'T. H. Cormen, C. E. Leiserson, R. L. Rivest and C. Stein, *Introduction to Algorithms*, chapter "Single-Source Shortest Paths", sections on the Bellman-Ford algorithm and on difference constraints.',
      'R. Sedgewick and K. Wayne, *Algorithms* (4th edition), section 4.4, "Shortest Paths".',
    ],
  },

  tests: [
    { name: 'matches an independent Floyd-Warshall on a random graph', input: { nodes: 12, density: 0.6, seed: 21, edges: '' }, check: matchesReference },
    { name: 'matches the reference on a sparse graph', input: { nodes: 9, density: 0, seed: 4, edges: '' }, check: matchesReference },
    { name: 'matches the reference on a directed graph with negative edges', input: { edges: 'A>B:4, A>C:2, C>B:-1, B>D:3, C>D:5, D>E:-2, B>E:4' },
      check: (r) => (matchesReference(r) === true && r.dist.E === 2 && r.path.join('') === 'ACBDE') || `${matchesReference(r)}; E=${r.dist.E} via ${r.path.join('')}` },
    { name: 'the worked example', input: { edges: 'A>C:2, C>D:1, A>B:5, B>C:-4' },
      check: (r, c) => (r.dist.B === 5 && r.dist.C === 1 && r.dist.D === 2 && r.path.join('') === 'ABCD' && r.passes === 3 && r.earlyExit && c.relaxations === 12) || `got C=${r.dist.C} D=${r.dist.D} via ${r.path.join('')} in ${r.passes} passes, ${c.relaxations} relaxations` },
    { name: 'a negative cycle that the source can reach is reported', input: { edges: 'A>B:1, B>C:2, C>D:-4, D>B:1, C>E:3' },
      check: (r) => (r.negativeCycle && r.cycleWeight === -1 && [...r.negativeCycle].sort().join('') === 'BCD' && r.dist.E === -Infinity && r.dist.A === 0 && r.path.length === 0) || `cycle ${r.negativeCycle && r.negativeCycle.join('')}, weight ${r.cycleWeight}, E=${r.dist.E}` },
    { name: 'a zero-weight cycle is not reported', input: { edges: 'A>B:1, B>C:2, C>D:-3, D>B:1, C>E:3' },
      check: (r) => (!r.negativeCycle && r.dist.E === 6 && matchesReference(r) === true) || `E=${r.dist.E}` },
    { name: 'nodes the negative cycle cannot reach keep correct distances', input: { edges: 'A>B:3, A>C:1, C>D:-2, D>C:1, B>E:2' },
      check: (r) => (r.negativeCycle && r.dist.B === 3 && r.dist.E === 5 && r.dist.C === -Infinity && r.dist.D === -Infinity) || `B=${r.dist.B} E=${r.dist.E} C=${r.dist.C}` },
    { name: 'edge order decides the number of passes', input: { edges: 'D>E:1, C>D:1, B>C:1, A>B:1' },
      check: (r, c) => (r.dist.E === 4 && r.passes === 4 && !r.earlyExit && c.relaxations === 20) || `passes ${r.passes}, relaxations ${c.relaxations}` },
    { name: 'the lucky order needs one pass plus a confirming pass', input: { edges: 'A>B:1, B>C:1, C>D:1, D>E:1' },
      check: (r, c) => (r.dist.E === 4 && r.passes === 2 && r.earlyExit && c.relaxations === 8) || `passes ${r.passes}, relaxations ${c.relaxations}` },
    { name: 'a two-way negative edge is a negative cycle', input: { edges: 'A-B:-1, B-C:2' },
      check: (r) => (r.negativeCycle && r.negativeCycle.length === 2) || 'expected a two-node negative cycle' },
    { name: 'reports unreachable nodes', input: { edges: 'A-B:2, C-D:1' },
      check: (r) => (r.dist.D === Infinity && r.path.length === 0 && !r.negativeCycle) || 'D should be unreachable' },
  ],
};
