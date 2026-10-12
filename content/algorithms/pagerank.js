import { graphInputs, resolveGraph, graphView } from '../../js/lib/graphs.js';

// The shared graph inputs, with the help text of the edge field rewritten for links.
const inputs = [
  ...graphInputs({ nodes: 7, density: 0.5, weighted: false }).map((f) => (f.id === 'edges'
    ? { ...f, help: 'Format: A>B, B>C. The arrow A>B means page A links to page B.' }
    : f)),
  { id: 'damping', type: 'range', label: 'Damping factor (d)', min: 0.5, max: 0.95, step: 0.05, default: 0.85,
    help: 'The share of a page\'s rank that follows its links. The rest is spread evenly over all pages.' },
  { id: 'tolerance', type: 'range', scale: 'log', label: 'Stop when the total change is below', min: 1e-8, max: 1e-2, default: 1e-4,
    help: 'Smaller values mean more rounds and more settled ranks. Logarithmic slider.' },
  { id: 'iterations', type: 'range', label: 'Maximum rounds', min: 5, max: 200, step: 5, default: 100 },
];

const f3 = (x) => x.toFixed(3);

function run(input, t) {
  const graph = resolveGraph(input, { directed: true, weighted: false });
  const ids = graph.nodes.map((nd) => nd.id);
  const N = ids.length;
  const d = input.damping, tol = input.tolerance, maxRounds = input.iterations;
  const out = new Map(ids.map((id) => [id, []]));          // id -> pages it links to
  const into = new Map(ids.map((id) => [id, []]));         // id -> [{ from, e }]
  graph.edges.forEach((ed, e) => { out.get(ed.u).push(ed.v); into.get(ed.v).push({ from: ed.u, e }); });
  const deadEnds = ids.filter((id) => out.get(id).length === 0);
  const isDeadEnd = new Set(deadEnds);
  const base = (1 - d) / N;

  let rank = new Map(ids.map((id) => [id, 1 / N]));
  const history = [];
  const legend = [{ label: 'page being recomputed, or biggest change this round', role: 'current' }, { label: 'incoming link being counted', role: 'active' }, ...(deadEnds.length ? [{ label: 'dead end: no outgoing links', role: 'special' }] : []), { label: 'highest rank', role: 'path' }];

  const views = ({ current = null, change = null, partial = null, final = false } = {}) => {
    const ranking = ids.slice().sort((a, b) => rank.get(b) - rank.get(a) || (a < b ? -1 : 1));
    const top = final ? ranking[0] : null;
    const g = graphView(graph, {
      nodeRole: (id) => (id === current ? 'current' : id === top ? 'path' : isDeadEnd.has(id) ? 'special' : 'default'),
      nodeSub: (id) => f3(rank.get(id)),
      edgeRole: (e) => (current !== null && partial && graph.edges[e].v === current ? 'active' : 'default'),
    });
    g.legend = legend;
    const rows = [{ label: 'Ranking', cells: ranking.map((id) => ({ t: id, sub: f3(rank.get(id)), role: id === top ? 'done' : id === current ? 'current' : 'default' })) }];
    if (partial) rows.push({ label: 'Next round', cells: ids.filter((id) => partial.has(id)).map((id) => ({ t: id, sub: f3(partial.get(id)), role: id === current ? 'current' : 'default' })) });
    if (change) rows.push({ label: 'Change', cells: ids.map((id) => ({ t: id, sub: `${change.get(id) >= 0 ? '+' : '−'}${Math.abs(change.get(id)).toFixed(4)}`, role: id === current ? 'current' : 'default' })) });
    return [g, { kind: 'rows', title: 'Pages from highest rank to lowest', rows }];
  };

  const pct = Math.round(d * 100);
  t.frame(() => ({ line: [1, 2], note: `Every page starts with the same rank, 1 ÷ ${N} = ${f3(1 / N)}. The ranks always add up to 1. In each round a page gives away all of its rank: ${pct}% is shared equally among the pages it links to, and the other ${100 - pct}% goes into a pool that is split equally among all ${N} pages.${deadEnds.length ? ` ${deadEnds.join(', ')} ${deadEnds.length === 1 ? 'is a dead end with no outgoing links, so all of its rank goes' : 'are dead ends with no outgoing links, so all of their rank goes'} into the pool.` : ''}`, views: views(), vars: { pages: N, d, 'basic share': f3(base) } }));

  let rounds = 0, delta = Infinity, converged = false;
  while (rounds < maxRounds && !converged) {
    rounds++;
    t.count('iterations');
    let deadRank = 0;
    for (const id of deadEnds) deadRank += rank.get(id);
    const next = new Map();
    const detailed = rounds === 1;
    for (const v of ids) {
      let incoming = deadRank / N;
      for (const { from } of into.get(v)) {
        t.count('link contributions');
        incoming += rank.get(from) / out.get(from).length;
      }
      const value = base + d * incoming;
      next.set(v, value);
      if (detailed) {
        const snapshot = new Map(next);
        const terms = into.get(v).map(({ from }) => `${f3(rank.get(from))}${out.get(from).length > 1 ? ` ÷ ${out.get(from).length}` : ''} from ${from}`);
        const dr = deadRank;
        t.frame(() => ({ line: [5, 6, 7], note: `**${v}** gets the basic share of ${f3(base)} that every page gets. ${terms.length ? `Its incoming links add ${d} × (${terms.join(' + ')}).` : 'No page links to it, so links add nothing.'}${deadEnds.length ? ` The dead-end rank adds ${d} × ${f3(dr)} ÷ ${N}.` : ''} Its rank for the next round is **${f3(value)}**.`,
          views: views({ current: v, partial: snapshot }), vars: { round: 1, page: v, 'new rank': f3(value) } }));
      }
    }
    delta = 0;
    const change = new Map();
    let mover = ids[0];
    for (const id of ids) {
      const c = next.get(id) - rank.get(id);
      change.set(id, c);
      delta += Math.abs(c);
      if (Math.abs(c) > Math.abs(change.get(mover))) mover = id;
    }
    const before = rank.get(mover);
    rank = next;
    if (history.length < 3) history.push(Object.fromEntries(rank));
    converged = delta < tol;
    const r = rounds, dl = delta;
    t.frame(() => ({ line: [8, 9], note: `${r === 1 ? 'Round 1 is complete: all the new ranks replace the old ones at once.' : `Round ${r}: every page recomputes its rank from the numbers of round ${r - 1}, all at once.`} In total the ranks moved by ${dl.toFixed(dl < 0.001 ? 6 : 4)}.${dl > 1e-12 ? ` The biggest change was at ${mover}, from ${f3(before)} to ${f3(rank.get(mover))}.` : ' Nothing changed at all.'}`,
      views: views({ current: dl > 1e-12 ? mover : null, change }), vars: { round: r, 'total change': dl.toExponential(2), tolerance: tol.toExponential(1) } }));
  }

  const order = ids.slice().sort((a, b) => rank.get(b) - rank.get(a) || (a < b ? -1 : 1));
  let sum = 0;
  for (const id of ids) sum += rank.get(id);
  t.frame(() => ({ line: 10, note: converged
    ? `After ${rounds} ${rounds === 1 ? 'round' : 'rounds'} the total change fell below the tolerance, so the ranks have settled. Another round would leave them almost exactly as they are. From highest to lowest: ${order.map((id) => `${id} (${f3(rank.get(id))})`).join(', ')}. They still add up to ${sum.toFixed(3)}.`
    : `The limit of ${maxRounds} rounds was reached while the ranks were still moving by ${delta.toExponential(1)} per round. The order so far, from highest to lowest: ${order.join(', ')}. Raise the limit or loosen the tolerance to let it finish.`,
    views: views({ final: true }), vars: { rounds, top: order[0], sum: sum.toFixed(3) } }));

  return { ranks: Object.fromEntries(rank), order, iterations: rounds, converged, delta, graph, damping: d, deadEnds, history };
}

// Reference for the tests, sharing no code with run: build the full N by N matrix, then
// (a) apply it once to the result, and (b) solve the linear system directly by elimination.
function googleMatrix(graph, d) {
  const ids = graph.nodes.map((nd) => nd.id);
  const N = ids.length;
  const idx = new Map(ids.map((id, i) => [id, i]));
  const links = ids.map(() => []);
  for (const e of graph.edges) links[idx.get(e.u)].push(idx.get(e.v));
  const G = ids.map(() => new Array(N).fill((1 - d) / N));
  for (let j = 0; j < N; j++) {
    if (!links[j].length) for (let i = 0; i < N; i++) G[i][j] += d / N;
    else for (const i of links[j]) G[i][j] += d / links[j].length;
  }
  return { G, ids, N };
}
const isFixedPoint = (r, eps = 1e-6) => {
  const { G, ids, N } = googleMatrix(r.graph, r.damping);
  const x = ids.map((id) => r.ranks[id]);
  const sum = x.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) return `ranks sum to ${sum}, not 1`;
  if (x.some((v) => !(v > 0))) return 'every rank should be positive';
  for (let i = 0; i < N; i++) {
    let y = 0;
    for (let j = 0; j < N; j++) y += G[i][j] * x[j];
    if (Math.abs(y - x[i]) > eps) return `one more step moves ${ids[i]} from ${x[i]} to ${y}`;
  }
  return true;
};
const matchesDirectSolve = (r, eps = 1e-6) => {
  // (I − G + J) x = 1, where J is the all-ones matrix, has the stationary vector as its unique solution.
  const { G, ids, N } = googleMatrix(r.graph, r.damping);
  const A = G.map((row, i) => row.map((g, j) => (i === j ? 1 : 0) - g + 1).concat([1]));
  for (let c = 0; c < N; c++) {
    let p = c;
    for (let i = c + 1; i < N; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    [A[c], A[p]] = [A[p], A[c]];
    for (let i = 0; i < N; i++) {
      if (i === c) continue;
      const m = A[i][c] / A[c][c];
      for (let k = c; k <= N; k++) A[i][k] -= m * A[c][k];
    }
  }
  const bad = ids.find((id, i) => Math.abs(A[i][N] / A[i][i] - r.ranks[id]) > eps);
  return bad ? `rank of ${bad} is ${r.ranks[bad]}, direct solution differs` : true;
};

export default {
  meta: {
    id: 'pagerank',
    name: 'PageRank',
    aliases: ['Page rank', 'random surfer model', 'link analysis', 'power iteration on the Google matrix'],
    kind: 'algorithm',
    discipline: 'graph-theory',
    alsoIn: [
      { id: 'distributed-systems', why: 'It is a classic iterative workload for cluster computing systems, which run each round across many machines.' },
      { id: 'mathematics', why: 'The ranks are the dominant eigenvector of a stochastic matrix, and the method is power iteration.' },
    ],
    subfield: 'Network analysis',
    family: 'Centrality measures',
    lab: 'graphs',
    year: 1998,
    authors: 'Larry Page and Sergey Brin',
    summary: 'Scores each node of a directed graph by how much rank flows into it from the nodes that link to it, repeating the calculation until the scores stop changing.',
    difficulty: 'intermediate',
    order: 280,
    paradigms: ['iterative-refinement'],
    randomized: false,
    approximate: true,
    time: { best: 'O(V + E) per round', average: 'O(k (V + E)) for k rounds', worst: 'O((V + E) log(1/ε) / log(1/d))', class: 'iterative' },
    space: { worst: 'O(V)', class: 'linear' },
    tags: {
      problems: ['rank web pages', 'find the most important nodes in a network', 'which page is most important', 'measure influence in a network', 'rank by links'],
      techniques: ['power iteration', 'random walk', 'damping factor', 'Markov chain'],
      applications: ['search engines', 'data processing', 'distributed systems', 'natural language'],
    },
    prerequisites: ['concept:graph', 'concept:probability', 'concept:markov-chain', 'concept:convergence'],
  },

  bigIdea: {
    simple: "PageRank is a way to measure how important each page is in a web of pages that link to one another. It was created to help a search engine decide which results to show first. The idea is that a link is a kind of vote. A page that many others link to is probably worth reading. But the votes are not equal. A link from an important page counts for more than a link from a page nobody visits. That sounds like a circle: to score one page, you need the scores of the others. The way out is to start by giving every page the same score. Then let each page share its score out along its links, and repeat. After enough rounds the scores stop changing. Another way to picture it is a bored reader who clicks links at random for ever, and now and then jumps to a random page. A page's score is the share of time that reader spends on it.",
    what: 'PageRank assigns every node of a directed graph a number between 0 and 1, with all the numbers adding up to 1. A node\'s rank is high if nodes with high rank link to it. The ranks are found by starting with equal values and repeatedly passing each node\'s rank along its outgoing links, with a small fixed share spread evenly over all nodes, until the values settle.',
    why: 'In the 1990s search engines ranked pages mainly by the words on them, which was easy to manipulate and said little about quality. Larry Page and Sergey Brin, then graduate students at Stanford, proposed using the link structure of the web itself as evidence: a link is a judgement by one author that another page is worth visiting. PageRank was the central idea of the search engine they built, Google.',
    when: 'Use it to rank the nodes of any directed network by a notion of importance that depends on who points at whom: web pages, papers that cite each other, accounts that follow each other. It is not a measure of content or quality in itself, and it needs the whole link graph. For rankings relative to a particular starting point, use the personalized variant.',
    interesting: 'The definition is circular, yet it has exactly one answer, and the simplest possible method finds it: guess, apply the rule, repeat. The mathematics guarantees more than that. Each round shrinks the remaining error by at least the damping factor, so the number of rounds needed does not depend on how large the graph is.',
    where: 'It was the founding idea of the Google search engine. Search ranking today combines a great many signals, and the details are not public, so PageRank should not be thought of as "how search works" now. Its variants are used widely outside search: for ranking scientific journals, suggesting connections in social networks, and picking out key sentences in a text.',
    analogy: {
      title: 'The random surfer',
      text: 'Imagine someone browsing with no purpose at all. On each page they usually click one of its links, chosen at random. Now and then, with a fixed probability, they get bored and jump to a page picked at random from the whole web. Follow this surfer for a very long time and count the visits. The share of time spent on each page is its PageRank. Pages with many links pointing at them are visited often, and so are pages linked from those.',
      limits: 'Real readers do not click at random. They read, search, follow some links far more than others, and use bookmarks. PageRank is not a measurement of traffic. It is a score computed from the links alone, and it knows nothing about what a page says or whether it is any good. The random jump is not a claim about behaviour either. It is there for a mathematical reason: without it, dead ends and closed loops of pages would trap the surfer, and the scores would not settle to a single sensible answer.',
    },
  },

  example: {
    setup: "Three web pages link to each other. A links to B and to C. B links to C. C links to A. Imagine 120 people browsing, 40 on each page. Every minute, half the people on each page click one of its links, split evenly between the links. The other half get bored and jump to a page chosen at random, so of the 60 people who jump, 20 land on each page.",
    steps: [
      "First minute, the jumpers: 60 people jump, and 20 land on each of A, B and C.",
      "First minute, the clickers. 20 leave A: 10 go to B and 10 go to C. 20 leave B, all to C. 20 leave C, all to A.",
      "Add them up. A has 20 + 20 = 40. B has 20 + 10 = 30. C has 20 + 10 + 20 = 50. The total is still 120.",
      "Second minute, the same rule with the new numbers. The clickers: 20 leave A (10 to B, 10 to C), 15 leave B (to C) and 25 leave C (to A). So A has 20 + 25 = 45, B has 20 + 10 = 30, and C has 20 + 10 + 15 = 45.",
      "Keep going and the numbers settle, at about 43 people on A, 31 on B and 46 on C. From then on a minute of clicking and jumping leaves every count the same.",
    ],
    result: "The rank of a page is its share of the crowd once the numbers have settled: about 0.36 for A, 0.26 for B and 0.38 for C. C comes first because two pages link to it. A is a close second with only one link, because that link comes from C, which passes on everything it has. B gets half of what A passes on and comes last. Here half the crowd follows links each minute. The usual setting is 85 percent.",
    tryInput: { edges: 'A>B, A>C, B>C, C>A', damping: 0.5 },
  },

  terms: [
    { term: "Directed graph", meaning: "A set of points joined by arrows. Here the points are pages and an arrow from one page to another is a link." },
    { term: "Node", meaning: "One point in a graph. Here, one page." },
    { term: "Link", meaning: "An arrow from one page to another. It counts for the page it points to, not the page it leaves." },
    { term: "Rank", meaning: "A page's score: a number between 0 and 1. The ranks of all the pages add up to 1." },
    { term: "Damping factor", meaning: "The share of the time the imaginary reader follows a link instead of jumping to a random page. It is usually set to 0.85." },
    { term: "Dead end", meaning: "A page with no outgoing links. Also called a dangling node." },
    { term: "Iteration", meaning: "One round of recalculating every page's rank from the ranks of the previous round." },
    { term: "Converge", meaning: "To settle down: the numbers change less and less each round and approach a fixed answer." },
  ],

  takeaway: "A page is important if important pages link to it, and you can find every page's score by sharing scores along the links again and again until they stop changing.",

  viz: {
    describe: 'A directed graph of pages and links. The number beneath each page is its current rank, to three decimal places. Pages with no outgoing links, called dead ends, are outlined in dark ink. In the first round each page is highlighted in turn while its incoming links are drawn in terracotta. In later rounds the page whose rank changed most is highlighted. Below the graph, the pages are listed from highest rank to lowest, with a second row showing how much each rank changed in the latest round. At the end the highest-ranked page is filled forest green.',
    inputs,
    presets: [
      { label: 'Small web', values: { nodes: 7, density: 0.5, seed: 3, edges: '', damping: 0.85 } },
      { label: 'Larger web', values: { nodes: 12, density: 0.6, seed: 8, edges: '', damping: 0.85 } },
      { label: 'Three pages (worked example)', values: { edges: 'A>B, A>C, B>C, C>A', damping: 0.5 } },
      { label: 'One good link beats two', values: { edges: 'A>C, B>C, C>D', damping: 0.85 } },
      { label: 'A pair that only link to each other', values: { edges: 'A>B, B>C, C>D, D>C', damping: 0.85 } },
      { label: 'Hub and spokes (slow to settle)', values: { edges: 'B>A, C>A, D>A, E>A, A>B', damping: 0.85 } },
    ],
    tryThis: [
      'Load "One good link beats two". Two pages link to C and only one links to D, yet D finishes first. C has a single outgoing link, so it hands its whole rank to D. Then add the link `C>A` to the list and watch D lose half of what C was giving it.',
      'Load "A pair that only link to each other". C and D pass rank back and forth and never give any away through links. Lower the damping factor from 0.85 to 0.5 and their combined share falls, because more rank is taken from every page and spread evenly.',
      'Load "Hub and spokes" and watch the "Change" row. The signs flip every round as rank sloshes between A and B, and the size of the change shrinks by a factor of about 0.85 each time. That factor is the damping factor.',
      'Move the tolerance slider toward smaller values and note the number of rounds. Each extra factor of ten in precision costs about the same number of additional rounds.',
    ],
    run,
    report: (r, c) => `${r.converged ? `Converged after ${r.iterations} rounds` : `Stopped at the limit of ${r.iterations} rounds`} (last total change ${r.delta.toExponential(2)}), damping factor ${r.damping}.\nRanks, highest first: ${r.order.map((id) => `${id}=${r.ranks[id].toFixed(4)}`).join(', ')}\nSum of ranks: ${Object.values(r.ranks).reduce((a, b) => a + b, 0).toFixed(6)}. ${r.deadEnds.length ? `Dead ends (rank redistributed evenly): ${r.deadEnds.join(', ')}.` : 'No dead ends.'} ${c['link contributions'] || 0} link contributions added up.`,
    experiment: {
      title: 'Rounds to converge as the damping factor rises',
      note: 'Each point is a real run on a random 12-page web, stopped when the total change in a round falls below one millionth. The curve is not fitted: it is the guaranteed upper limit log(tolerance ÷ 2) ÷ log(d), which follows from the fact that every round shrinks the change by at least the factor d. Measured runs lie on or below it.',
      metric: 'iterations',
      metricLabel: 'Rounds until the ranks settle',
      sizeLabel: 'Damping factor (d)',
      sizes: [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95],
      variants: [{ id: 'web', label: 'Random 12-page web' }],
      input: (dampingValue, variant, seed) => ({ nodes: 12, density: 0.5, seed, edges: '', damping: dampingValue, tolerance: 1e-6, iterations: 5000 }),
      theory: [{ label: 'upper limit: log(tolerance ÷ 2) ÷ log(d)', fn: (dampingValue) => Math.ceil(Math.log(1e-6 / 2) / Math.log(dampingValue)) }],
    },
  },

  logic: {
    intuition: 'Treat rank as a fixed amount of something that flows. Each round, every page pours out what it has: most of it along its links, in equal parts, and the rest into a common pool that is shared by all pages. A page that many well-supplied pages point to receives a lot. The amounts stop changing when, for every page, what flows in equals what flows out. That balance is the answer, and it does not depend on where you started.',
    steps: [
      'Give every one of the N pages the rank 1/N.',
      'Add up the rank held by dead ends, pages with no outgoing links. That rank will be spread equally over all pages.',
      'For each page, add up what it receives: from each page linking to it, that page\'s rank divided by its number of outgoing links, plus an equal 1/N share of the dead-end rank.',
      'Set the page\'s new rank to (1 − d)/N plus d times the amount received, where d is the damping factor.',
      'When every page has a new rank, replace all the old ranks at once.',
      'Measure the total change. If it is below the tolerance, stop. Otherwise repeat from step 2.',
    ],
    pseudocode: [
      'pagerank(G, d, tolerance):',
      '  N ← number of pages',
      '  for each page v: rank[v] ← 1 / N',
      '  repeat:',
      '    D ← sum of rank[u] over pages u with no outgoing links',
      '    for each page v:',
      '      received ← D / N + sum over links (u, v) of rank[u] / outdegree(u)',
      '      next[v] ← (1 − d) / N + d · received',
      '    change ← sum over v of |next[v] − rank[v]|',
      '    rank ← next',
      '  until change < tolerance',
    ],
    decisions: [
      { title: 'What should the damping factor be?', text: 'The original papers used 0.85, and that remains the conventional choice. A value near 1 follows the link structure more faithfully but converges slowly and lets closed groups of pages hoard rank. A low value converges fast but flattens the ranking toward equal scores.' },
      { title: 'What happens to the rank of a dead end?', text: 'A page with no outgoing links has nowhere to send its rank. If nothing is done, that rank disappears each round and the total drains away. This page uses the standard remedy: a dead end is treated as if it linked to every page, so its rank is spread uniformly. That keeps the total at exactly 1.' },
      { title: 'Update all at once, or one page at a time?', text: 'Here every new rank is computed from the previous round\'s values and they are swapped in together. This is the power method, and it is the form analysed below. Using each new value as soon as it is available (the Gauss-Seidel style) usually converges in fewer rounds but is harder to run in parallel.' },
      { title: 'When to stop?', text: 'This page stops when the sum of the absolute changes over all pages falls below a tolerance, or at a round limit. For ranking purposes, the order of the pages usually stabilises long before the values do.' },
    ],
    invariants: [
      'The ranks are all positive and add up to 1 after every round.',
      'The total change in a round is at most d times the total change in the round before.',
      'Every page has rank at least (1 − d)/N.',
    ],
    edgeCases: [
      'Dead ends: handled by spreading their rank uniformly. Ignoring them makes the ranks sum to less than 1.',
      'A group of pages that link only among themselves would absorb all the rank if d were 1. The damping factor limits how much they can hold.',
      'A page with no incoming links gets only the basic share and its part of the dead-end rank.',
      'Two pages that link only to each other make the ranks oscillate from round to round. With d below 1 the oscillation dies away.',
      'A page that links to itself keeps part of its own rank. Real systems usually ignore self-links.',
      'A graph with no links at all: every page is a dead end and all ranks stay at 1/N.',
    ],
    correctness: 'One round is a fixed rule that turns one list of ranks into another. The rule keeps the total at 1, because every page gives away exactly what it has. Now take any two different lists that each add up to 1, apply the rule to both, and compare the results. The evenly spread part, (1 − d)/N for each page, is identical in both and cancels. What is left is d times the difference carried along the links, and passing amounts along links can cancel differences but never enlarge them. So the two results are closer together than the two lists were, by at least the factor d. A rule that always pulls any two inputs closer by a fixed factor has exactly one list that it leaves unchanged, and repeated application approaches that list from any start. That unchanged list is the PageRank. After k rounds the distance from it is at most d to the power k times the starting distance.',
    mistakes: [
      'Forgetting dead ends, so that rank leaks away and the totals no longer add up to 1.',
      'Updating ranks in place while still reading them for the same round, and then comparing results with a reference that updates all at once.',
      'Dividing a page\'s rank by its number of incoming links instead of its number of outgoing links.',
      'Treating the scores as probabilities of relevance to a query. They depend only on the link structure.',
      'Comparing raw scores between graphs of different sizes. The scores sum to 1, so they shrink as the graph grows.',
    ],
  },

  code: {
    sample: {
      input: 'Five pages: A links to B and C, B links to C, C links to A, D links to C and E, and E has no outgoing links (a dead end). Damping factor 0.85, stopping when the total change in a round is below 0.000001.',
      expected: 'rounds: 28\nA:0.3502 B:0.1884 C:0.3654 D:0.0396 E:0.0564\nsum: 1.0000\nranking: C A B E D',
    },
    python: {
      source: `def pagerank(links, d=0.85, tolerance=1e-6, max_rounds=1000):
    pages = sorted(links)
    n = len(pages)
    rank = {p: 1 / n for p in pages}
    rounds = 0
    while rounds < max_rounds:
        rounds += 1
        dead_end_rank = 0.0
        for p in pages:
            if not links[p]:
                dead_end_rank += rank[p]
        received = {p: dead_end_rank / n for p in pages}
        for p in pages:
            for q in links[p]:
                received[q] += rank[p] / len(links[p])
        change = 0.0
        new_rank = {}
        for p in pages:
            new_rank[p] = (1 - d) / n + d * received[p]
            change += abs(new_rank[p] - rank[p])
        rank = new_rank
        if change < tolerance:
            break
    return rank, rounds


links = {"A": ["B", "C"], "B": ["C"], "C": ["A"], "D": ["C", "E"], "E": []}
rank, rounds = pagerank(links)
total = 0.0
for p in sorted(rank):
    total += rank[p]
print("rounds:", rounds)
print(" ".join(f"{p}:{rank[p]:.4f}" for p in sorted(rank)))
print(f"sum: {total:.4f}")
print("ranking: " + " ".join(sorted(rank, key=lambda p: -rank[p])))`,
      notes: [
        { line: 4, text: 'Every page starts with an equal share. The starting point does not affect the answer, only how many rounds are needed.' },
        { line: 11, text: 'Rank held by pages with no outgoing links is collected here. On the next line it is spread equally over all pages, so that none is lost.' },
        { line: 15, text: 'A page divides its rank equally among the pages it links to. One of many links from a page is worth less than its only link.' },
        { line: 19, text: 'The update rule. Every page gets the basic share (1 − d)/n, plus the damping factor times what it received.' },
        { line: 22, text: 'Stop when a whole round moved the ranks by less than the tolerance in total.' },
      ],
    },
    javascript: {
      source: `function pagerank(links, d = 0.85, tolerance = 1e-6, maxRounds = 1000) {
  const pages = Object.keys(links).sort();
  const n = pages.length;
  let rank = {};
  for (const p of pages) rank[p] = 1 / n;
  let rounds = 0;
  while (rounds < maxRounds) {
    rounds += 1;
    let deadEndRank = 0;
    for (const p of pages) {
      if (links[p].length === 0) deadEndRank += rank[p];
    }
    const received = {};
    for (const p of pages) received[p] = deadEndRank / n;
    for (const p of pages) {
      for (const q of links[p]) received[q] += rank[p] / links[p].length;
    }
    let change = 0;
    const newRank = {};
    for (const p of pages) {
      newRank[p] = (1 - d) / n + d * received[p];
      change += Math.abs(newRank[p] - rank[p]);
    }
    rank = newRank;
    if (change < tolerance) break;
  }
  return { rank, rounds };
}

const links = { A: ["B", "C"], B: ["C"], C: ["A"], D: ["C", "E"], E: [] };
const { rank, rounds } = pagerank(links);
const pages = Object.keys(rank).sort();
let total = 0;
for (const p of pages) total += rank[p];
console.log("rounds: " + rounds);
console.log(pages.map((p) => p + ":" + rank[p].toFixed(4)).join(" "));
console.log("sum: " + total.toFixed(4));
console.log("ranking: " + pages.slice().sort((a, b) => rank[b] - rank[a]).join(" "));`,
    },
    cpp: {
      source: `#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

int main() {
    // Pages A..E are 0..4. links[p] lists the pages that p links to.
    const std::vector<std::vector<int>> links = {{1, 2}, {2}, {0}, {2, 4}, {}};
    const int n = static_cast<int>(links.size());
    const double d = 0.85, tolerance = 1e-6;

    std::vector<double> rank(n, 1.0 / n);
    int rounds = 0;
    while (rounds < 1000) {
        ++rounds;
        double deadEndRank = 0.0;
        for (int p = 0; p < n; ++p) {
            if (links[p].empty()) deadEndRank += rank[p];
        }
        std::vector<double> received(n, deadEndRank / n);
        for (int p = 0; p < n; ++p) {
            for (int q : links[p]) received[q] += rank[p] / links[p].size();
        }
        double change = 0.0;
        std::vector<double> newRank(n);
        for (int p = 0; p < n; ++p) {
            const double fromLinks = d * received[p];
            newRank[p] = (1 - d) / n + fromLinks;
            change += std::fabs(newRank[p] - rank[p]);
        }
        rank = newRank;
        if (change < tolerance) break;
    }

    double total = 0.0;
    for (double r : rank) total += r;
    std::printf("rounds: %d\\n", rounds);
    for (int p = 0; p < n; ++p) std::printf("%c:%.4f%s", 'A' + p, rank[p], p + 1 < n ? " " : "\\n");
    std::printf("sum: %.4f\\n", total);

    std::vector<int> order(n);
    for (int p = 0; p < n; ++p) order[p] = p;
    std::stable_sort(order.begin(), order.end(), [&](int a, int b) { return rank[a] > rank[b]; });
    std::printf("ranking:");
    for (int p : order) std::printf(" %c", 'A' + p);
    std::printf("\\n");
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'One round looks at every page and every link once, so it costs time proportional to V + E. The number of rounds depends on the damping factor and the precision wanted, not on the size of the graph: each round shrinks the remaining error by at least the factor d, so reaching a tolerance ε takes about log(1/ε) ÷ log(1/d) rounds.',
    cases: [
      { case: 'One round', time: 'O(V + E)', when: 'Always. Each link contributes one addition.' },
      { case: 'To tolerance ε', time: 'O((V + E) · log(1/ε) / log(1/d))', when: 'An upper bound for any graph. With d = 0.85, each factor of ten in precision costs about 14 rounds.' },
      { case: 'Favourable graphs', time: 'Fewer rounds', when: 'The bound is the worst case. Many graphs converge faster, because their structure mixes rank more quickly than the bound assumes.' },
      { case: 'Damping factor near 1', time: 'Many rounds', when: 'The number of rounds grows roughly like 1 / (1 − d) as d approaches 1.' },
    ],
    space: 'O(V) for two lists of ranks, the current one and the next, in addition to the graph itself.',
    memory: 'For web-scale graphs the link structure does not fit in one machine\'s memory, and the two rank vectors alone are large. The computation is then split across many machines, each holding part of the graph and exchanging rank contributions every round.',
    tradeoffs: 'Power iteration is slow to converge compared with more refined numerical methods, but each round is one pass over the links and needs almost no extra memory, which is what matters on huge sparse graphs. Solving the equivalent linear system directly gives the exact answer but costs O(V³) and is only practical for small graphs.',
    assumptions: [
      'The damping factor d is strictly less than 1. With d = 1 the method may not converge, and the answer may not be unique.',
      'Error is measured as the sum of absolute differences between rank vectors.',
      'Dead ends are handled by uniform redistribution, as on this page. Other conventions give slightly different numbers.',
      'The chart on this page counts rounds on one small random graph per point. It illustrates the dependence on d and is not a general benchmark.',
    ],
  },

  tradeoffs: {
    excels: [
      'Ranking nodes of very large sparse directed graphs using structure alone.',
      'Settings where a global, query-independent score is useful as one input among several.',
      'Parallel and distributed computation: a round is a simple pass over the links.',
    ],
    struggles: [
      'Telling good content from bad: it sees links, not meaning.',
      'New pages, which have had no time to attract links.',
      'Deliberate manipulation: groups of pages built to link to each other in order to raise a target\'s score.',
      'Questions about importance relative to a topic or a user, which need the personalized variant.',
    ],
    pitfalls: [
      'Mishandled dead ends, giving ranks that do not sum to 1.',
      'Stopping after a fixed small number of rounds on a graph that converges slowly.',
      'Reading small differences between scores as meaningful when they are within the stopping tolerance.',
    ],
    misunderstandings: [
      "\"The page with the most incoming links has the highest rank.\" What counts is the rank of the pages that link to you and how many other links they have. One link from an important page that links to little else can outweigh many links from minor pages.",
      "\"PageRank is how search engines rank results today.\" It was the founding idea of one search engine in 1998. Modern ranking combines many signals, the details are not public, and a link score is at most one ingredient.",
      "\"The random surfer describes how people browse.\" It is a mathematical device that defines the score and guarantees that the calculation settles. It was never meant as a model of real behaviour.",
    ],
    constraints: [
      'The web changes constantly, so ranks must be recomputed or updated incrementally.',
      'At web scale a single round touches billions of links and has to be distributed over many machines.',
      'Because rank can be manufactured with artificial links, real systems combine link scores with defences against manipulation.',
    ],
    alternatives: [
      { name: 'In-degree (count incoming links)', when: 'You want the simplest possible measure and do not mind that every link counts the same.' },
      { name: 'HITS (hubs and authorities)', when: 'You want two scores per page, one for being a good source and one for being a good list of sources, computed on a subgraph for one query.' },
      { name: 'Personalized PageRank', when: 'You want importance relative to a chosen page or set of pages. The random jump always returns there instead of to a uniformly random page.' },
      { name: 'Direct linear solve', when: 'The graph is small and you want the exact stationary vector in one step.' },
      { id: 'bfs', name: 'Breadth-First Search', when: 'You only need to know what is reachable and how far away it is, not how important it is.' },
    ],
    comparison: {
      columns: ['', 'PageRank', 'In-degree', 'HITS'],
      rows: [
        ['A link counts', 'In proportion to the linking page\'s rank, divided among its links', 'Equally, always', 'In proportion to the linking page\'s hub score'],
        ['Scores per page', 'One', 'One', 'Two: hub and authority'],
        ['Depends on a query', 'No', 'No', 'Yes, in its original form'],
        ['Cost', 'Several passes over the links', 'One pass', 'Several passes over a subgraph'],
        ['Guaranteed unique answer', 'Yes, for d below 1', 'Yes', 'Not always'],
      ],
    },
  },

  applications: [
    { title: 'Web search (historically)', status: 'established', text: 'PageRank was introduced as the link-analysis component of the original Google search engine, described by Brin and Page in 1998, where it was combined with text matching to order results. How heavily any present-day search engine relies on it is not public.' },
    { title: 'Benchmark workload for graph processing systems', status: 'established', text: 'Systems for processing large graphs on clusters, such as Pregel and the graph libraries built on Apache Spark, use PageRank as a standard example and benchmark, because it is simple, iterative, and exercises every edge on every round.' },
    { title: 'Ranking journals and papers', status: 'established', text: 'Citation networks have the same shape as the web: a citation is a link. The Eigenfactor score ranks scientific journals with a PageRank-style calculation on the journal citation graph.' },
    { title: 'Extracting key sentences and keywords', status: 'established', text: 'TextRank builds a graph whose nodes are the sentences or words of a document, joined when they are similar or occur close together, and runs PageRank on it. The highest-ranked nodes are returned as a summary or as keywords.' },
    { title: 'Suggesting connections', status: 'illustrative', text: 'In a social network, running personalized PageRank from one person\'s account scores other accounts by how strongly they are connected to it through chains of links. High-scoring accounts that the person does not yet follow are natural suggestions.' },
  ],

  connections: [
    { to: 'concept:markov-chain', type: 'prerequisite', why: 'The random surfer is a Markov chain on the pages, and the PageRank vector is its stationary distribution: the long-run share of time spent in each state.' },
    { to: 'concept:linear-algebra', type: 'prerequisite', why: 'The ranks form the eigenvector with eigenvalue 1 of the matrix that describes one round, and the algorithm is power iteration on that matrix.' },
    { to: 'concept:convergence', type: 'prerequisite', why: 'The method does not compute the answer in a fixed number of steps. It produces a sequence that approaches the answer at a known rate.' },
    { to: 'metropolis-hastings', type: 'related', why: 'Both rest on a Markov chain that settles to a stationary distribution. PageRank computes the stationary distribution of a given chain; Metropolis-Hastings designs a chain whose stationary distribution is the one you want.' },
    { to: 'gradient-descent', type: 'related', why: 'Both repeat a simple update until the change falls below a tolerance, and both converge geometrically at a rate set by one number: the damping factor here, the conditioning of the problem there.' },
    { to: 'bfs', type: 'related', why: 'One round of PageRank pushes rank one link further, just as one layer of breadth-first search pushes the frontier one link further. Both are a pass over all edges.' },
    { to: 'monte-carlo', type: 'related', why: 'The ranks can also be estimated by simulating many random surfers and counting where they are, which trades exactness for simplicity.' },
    { to: 'graph-neural-network', type: 'advanced', why: 'Graph neural networks also update each node from its neighbours\' values over several rounds. PageRank is the special case with one fixed, linear update rule.' },
    { to: 'discipline:distributed-systems', type: 'application', why: 'It is the standard example of an iterative graph computation spread over a cluster, with each machine passing rank contributions along the links it holds.' },
    { to: 'discipline:mathematics', type: 'related', why: 'Its existence, uniqueness and convergence follow from the Perron-Frobenius theory of positive matrices.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'What does a damping factor of 0.85 mean?',
      options: ['85% of the pages are ignored', 'At each step the imaginary surfer follows a link with probability 0.85 and jumps to a random page otherwise', 'The calculation stops when it is 85% finished', 'Each rank is multiplied by 0.85 at the end'],
      answer: 1,
      explain: [
        'No page is ignored. Every page takes part in every round.',
        'Correct. Equivalently, 85% of each page\'s rank flows along its links and 15% is spread evenly over all pages.',
        'Stopping is controlled by the tolerance, not the damping factor.',
        'The damping factor is used inside every round, not as a final adjustment.',
      ],
    },
    {
      type: 'predict',
      q: 'Four pages have the links A>C, B>C and C>D. Two pages link to C and only one links to D. Which page ends with the highest rank?',
      options: ['A', 'C, because it has the most incoming links', 'D', 'C and D tie'],
      answer: 2,
      explain: [
        'Nothing links to A, so it receives only the basic share and its part of the dead-end rank.',
        'C does collect rank from A and B, but it does not keep it: each round it passes everything on.',
        'Correct. C has a single outgoing link, so D receives the whole of what C passes on, on top of its own basic share. D ends near 0.41 and C near 0.34.',
        'They are close but not equal. D gets everything C can give, plus the same basic share C gets.',
      ],
      tryInput: { edges: 'A>C, B>C, C>D', damping: 0.85 },
    },
    {
      type: 'debug',
      q: 'On a graph where some pages have no outgoing links, the ranks from this round add up to less than 1, and the total shrinks further every round. What is missing?',
      code: `for v in pages:
    new_rank[v] = (1 - d) / n
for u in pages:
    for v in links[u]:
        new_rank[v] += d * rank[u] / len(links[u])`,
      options: ['The ranks should be divided by n at the end', 'The rank held by pages with no outgoing links is never passed on, so it is lost', 'The damping factor should be applied twice', 'The loop should run over the links in reverse'],
      answer: 1,
      explain: [
        'Rescaling afterwards hides the symptom but gives different numbers from the standard definition.',
        'Correct. A dead end contributes nothing in the inner loop. Its rank must be redistributed, for example by adding d × (total dead-end rank) / n to every page.',
        'Applying the damping factor twice would lose even more rank.',
        'The order in which links are visited does not change the sums.',
      ],
    },
    {
      type: 'choice',
      q: 'Page X has a high rank and links to 200 other pages. Page Y has a moderate rank and links to only one page, Z. Which statement is true?',
      options: ['A link from X is always worth more than a link from Y', 'Each page X links to receives only 1/200 of the rank X passes on, so the single link from Y may be worth more to Z', 'Links from X and Y are worth the same', 'Y passes on nothing because it has too few links'],
      answer: 1,
      explain: [
        'X\'s rank is divided among all 200 of its links, so each one carries a small amount.',
        'Correct. What a link is worth is the linking page\'s rank divided by its number of outgoing links.',
        'A link\'s worth depends on both the rank and the number of outgoing links of the page it comes from.',
        'A page with one link passes its entire link share to that one page.',
      ],
    },
    {
      type: 'challenge',
      title: 'Rank relative to one page',
      prompt: 'Change the algorithm so that the random jump always lands on one chosen page instead of a uniformly random one: replace the (1 − d)/N term by (1 − d) for the chosen page and 0 for the others, and send the dead-end rank there too. This is personalized PageRank. Run it on a graph of your choice from two different chosen pages and compare the rankings with each other and with ordinary PageRank. What does a high score now mean?',
      hints: ['The ranks should still add up to 1. Check that first.', 'A high score now means "easy to reach from the chosen page by following links", so pages near it rise and distant ones fall.'],
    },
  ],

  compare: {
    idea: 'Repeatedly pass each node\'s rank along its outgoing links, with a small share spread evenly, until the ranks settle.',
    requires: 'A directed graph and a damping factor below 1. The result is approximate, to within the stopping tolerance.',
    sensitivity: 'Moderate. The number of rounds depends on the damping factor and tolerance. The ranking itself can shift when d changes or a few links are added.',
    memory: 'O(V): two vectors of ranks, besides the graph.',
    difficulty: 'low',
    difficultyNote: 'A few lines of arithmetic per round. The care goes into dead ends and into knowing what the score does and does not mean.',
    limits: 'Sees only link structure. Open to manipulation by artificial links. Converges slowly when d is close to 1.',
    useWhen: 'You want a global importance score for the nodes of a large directed network.',
  },

  advanced: {
    history: 'Larry Page and Sergey Brin developed PageRank at Stanford University as part of a research project on web search. It was described in their 1998 paper on the Google search engine and, with Rajeev Motwani and Terry Winograd, in a 1999 Stanford technical report. The idea of scoring the nodes of a network by the scores of the nodes pointing at them was not new: related measures had been proposed for social networks and for citation analysis decades earlier, and Jon Kleinberg\'s HITS algorithm, which also ranks web pages from link structure, dates from the same period. What PageRank added was a formulation, with the random jump, that is well defined on any graph and cheap to compute at the scale of the web.',
    derivation: 'Number the pages $1, \\dots, N$. Let $S$ be the $N \\times N$ matrix with $S_{ij} = 1/\\text{out}(j)$ if page $j$ links to page $i$, $S_{ij} = 1/N$ for every $i$ if $j$ is a dead end, and $0$ otherwise. Every column of $S$ sums to 1. One round of the algorithm is\n\n$$r\' = d\\,S\\,r + \\frac{1 - d}{N}\\,\\mathbf{1},$$\n\nwhere $\\mathbf{1}$ is the vector of ones. For any $r$ whose entries sum to 1 this equals $G r$ with\n\n$$G = d\\,S + \\frac{1 - d}{N}\\,\\mathbf{1}\\mathbf{1}^\\top,$$\n\nsometimes called the Google matrix. $G$ is the transition matrix of the random surfer: with probability $d$ follow a link (or, at a dead end, go anywhere), and with probability $1 - d$ jump to a uniformly random page. The PageRank vector is the solution of $r = G r$ with entries summing to 1, that is, the stationary distribution of this Markov chain and the eigenvector of $G$ for eigenvalue 1. Rearranged, it is also the solution of the linear system\n\n$$(I - d\\,S)\\,r = \\frac{1 - d}{N}\\,\\mathbf{1}.$$',
    proof: '**Contraction.** Let $x$ and $y$ be vectors whose entries each sum to 1. Then $\\mathbf{1}^\\top (x - y) = 0$, so the jump term cancels and $G x - G y = d\\,S (x - y)$. Because the columns of $S$ are non-negative and sum to 1, $\\lVert S z \\rVert_1 \\le \\lVert z \\rVert_1$ for every $z$. Hence\n\n$$\\lVert G x - G y \\rVert_1 \\le d\\,\\lVert x - y \\rVert_1.$$\n\n**Existence and uniqueness.** $G$ maps the set of non-negative vectors summing to 1 into itself and contracts distances on it by the factor $d < 1$. By the contraction mapping theorem it has exactly one fixed point $r^*$ in that set. Every entry of $r^*$ is at least $(1 - d)/N > 0$.\n\n**Convergence.** With $r_k = G^k r_0$, the inequality gives $\\lVert r_k - r^* \\rVert_1 \\le d^k \\lVert r_0 - r^* \\rVert_1 \\le 2 d^k$. The same argument applied to successive iterates gives $\\lVert r_{k+1} - r_k \\rVert_1 \\le d\\,\\lVert r_k - r_{k-1} \\rVert_1$, and from the uniform start $\\lVert r_1 - r_0 \\rVert_1 \\le 2d$, so the change in round $k$ is at most $2 d^k$. This is the bound plotted in the experiment.\n\n**Stopping error.** If the algorithm stops when $\\lVert r_{k+1} - r_k \\rVert_1 < \\varepsilon$, then $\\lVert r_{k+1} - r^* \\rVert_1 \\le \\frac{d}{1 - d}\\,\\varepsilon$, by summing the geometric series of later changes.',
    complexityProof: 'A round computes one sum over the dead ends, one addition per link, and a constant amount of work per page: $O(V + E)$. The change in round $k$ is at most $2d^k$, which is below $\\varepsilon$ once $k \\ge \\log(\\varepsilon / 2) / \\log d$. So the number of rounds is $O(\\log(1/\\varepsilon) / \\log(1/d))$, independent of the size of the graph, and the total cost is $O((V + E)\\,\\log(1/\\varepsilon) / \\log(1/d))$. Since $\\log(1/d) \\approx 1 - d$ for $d$ near 1, the number of rounds grows like $1/(1 - d)$.',
    variants: [
      { name: 'Personalized PageRank', text: 'The random jump goes to a chosen page or set of pages instead of a uniformly random one. Scores then measure closeness to that set.' },
      { name: 'Topic-sensitive PageRank', text: 'Precompute several personalized vectors, one per topic, and combine them according to the topic of the query.' },
      { name: 'Weighted links', text: 'Rank is divided among outgoing links in proportion to link weights instead of equally.' },
      { name: 'Gauss-Seidel and extrapolation methods', text: 'Use newly computed values within the same round, or combine successive iterates, to converge in fewer rounds.' },
      { name: 'Monte Carlo estimation', text: 'Simulate many short random walks and count visits. Useful when only the top-ranked pages or one page\'s neighbourhood is needed.' },
      { name: 'HITS', text: 'Kleinberg\'s algorithm assigns each page a hub score and an authority score that reinforce each other, computed by a similar iteration.' },
    ],
    implementation: 'Store the graph as lists of outgoing links and push contributions forward, as in the code samples, or as lists of incoming links and pull them. Keep two rank arrays and swap them. Accumulate the dead-end rank in one pass and add its share to every page. Use double precision, and check after each round that the ranks sum to 1 to within rounding error; a drifting sum is the first sign of a bug.',
    benchmarking: 'Report the damping factor, the stopping rule and the convention for dead ends, since all three change the numbers. Measure time per round and rounds to tolerance separately. When comparing systems, fix the number of rounds, because different stopping rules make total times incomparable.',
    references: [
      { authors: 'S. Brin and L. Page', year: 1998, title: 'The anatomy of a large-scale hypertextual Web search engine', venue: 'Computer Networks and ISDN Systems 30(1-7), 107-117' },
      { authors: 'L. Page, S. Brin, R. Motwani and T. Winograd', year: 1999, title: 'The PageRank citation ranking: bringing order to the web', venue: 'Stanford InfoLab, Technical Report 1999-66' },
      { authors: 'J. M. Kleinberg', year: 1999, title: 'Authoritative sources in a hyperlinked environment', venue: 'Journal of the ACM 46(5), 604-632' },
      { authors: 'A. N. Langville and C. D. Meyer', year: 2006, title: 'Google\'s PageRank and Beyond: The Science of Search Engine Rankings', venue: 'Princeton University Press' },
      { authors: 'G. Malewicz, M. H. Austern, A. J. C. Bik, J. C. Dehnert, I. Horn, N. Leiser and G. Czajkowski', year: 2010, title: 'Pregel: a system for large-scale graph processing', venue: 'Proceedings of the ACM SIGMOD International Conference on Management of Data' },
      { authors: 'R. Mihalcea and P. Tarau', year: 2004, title: 'TextRank: bringing order into texts', venue: 'Proceedings of the Conference on Empirical Methods in Natural Language Processing (EMNLP)' },
    ],
    furtherReading: [
      'A. N. Langville and C. D. Meyer, "Deeper inside PageRank", *Internet Mathematics* 1(3), 2004.',
      'J. Leskovec, A. Rajaraman and J. D. Ullman, *Mining of Massive Datasets*, chapter "Link Analysis".',
    ],
  },

  tests: [
    { name: 'ranks sum to 1 and the result is a fixed point of an independent matrix step', input: { nodes: 10, density: 0.6, seed: 21, edges: '', damping: 0.85, tolerance: 1e-8, iterations: 200 },
      check: (r) => (r.converged && isFixedPoint(r) === true) || `converged ${r.converged}; ${isFixedPoint(r)}` },
    { name: 'agrees with a direct solution by Gaussian elimination', input: { nodes: 9, density: 0.4, seed: 5, edges: '', damping: 0.7, tolerance: 1e-8, iterations: 200 },
      check: (r) => (matchesDirectSolve(r) === true && isFixedPoint(r) === true) || `${matchesDirectSolve(r)}; ${isFixedPoint(r)}` },
    { name: 'a graph with dead ends still sums to 1 and matches the direct solution', input: { edges: 'A>C, B>C, C>D, E>A, E>F', damping: 0.85, tolerance: 1e-8, iterations: 200 },
      check: (r) => (r.deadEnds.join('') === 'DF' && isFixedPoint(r) === true && matchesDirectSolve(r) === true) || `dead ends ${r.deadEnds.join('')}; ${isFixedPoint(r)}; ${matchesDirectSolve(r)}` },
    { name: 'a symmetric cycle gives equal ranks immediately', input: { edges: 'A>B, B>C, C>A', damping: 0.85, tolerance: 1e-8, iterations: 200 },
      check: (r) => (r.iterations === 1 && Object.values(r.ranks).every((v) => Math.abs(v - 1 / 3) < 1e-12)) || `rounds ${r.iterations}, ranks ${JSON.stringify(r.ranks)}` },
    { name: 'the worked example: 40/30/50, then 45/30/45, settling near 43/31/46 out of 120', input: { edges: 'A>B, A>C, B>C, C>A', damping: 0.5, tolerance: 1e-8, iterations: 200 },
      check: (r) => {
        const near = (x, y) => Math.abs(x - y) < 1e-9;
        const [h1, h2] = r.history;
        if (!(near(h1.A * 120, 40) && near(h1.B * 120, 30) && near(h1.C * 120, 50))) return `round 1 gave ${JSON.stringify(h1)}`;
        if (!(near(h2.A * 120, 45) && near(h2.B * 120, 30) && near(h2.C * 120, 45))) return `round 2 gave ${JSON.stringify(h2)}`;
        return (Math.round(r.ranks.A * 120) === 43 && Math.round(r.ranks.B * 120) === 31 && Math.round(r.ranks.C * 120) === 46 && r.order.join('') === 'CAB'
          && r.ranks.A.toFixed(2) === '0.36' && r.ranks.B.toFixed(2) === '0.26' && r.ranks.C.toFixed(2) === '0.38') || `settled at ${JSON.stringify(r.ranks)}`;
      } },
    { name: 'the predicted winner: one good link beats two', input: { edges: 'A>C, B>C, C>D', damping: 0.85 },
      check: (r) => (r.order[0] === 'D' && r.order[1] === 'C' && r.ranks.D.toFixed(2) === '0.41' && r.ranks.C.toFixed(2) === '0.34') || `order ${r.order.join('')}, D=${r.ranks.D}, C=${r.ranks.C}` },
    { name: 'a single link with a dead end has the closed-form answer', input: { edges: 'A>B', damping: 0.85, tolerance: 1e-8, iterations: 200 },
      check: (r) => (Math.abs(r.ranks.A - 0.5 / 1.425) < 1e-6 && Math.abs(r.ranks.A + r.ranks.B - 1) < 1e-12) || `A=${r.ranks.A}` },
    { name: 'stops at the round limit and says so', input: { edges: 'B>A, C>A, D>A, E>A, A>B', damping: 0.95, tolerance: 1e-8, iterations: 5 },
      check: (r) => (!r.converged && r.iterations === 5 && Math.abs(Object.values(r.ranks).reduce((a, b) => a + b, 0) - 1) < 1e-12) || `converged ${r.converged} after ${r.iterations}` },
  ],
};
