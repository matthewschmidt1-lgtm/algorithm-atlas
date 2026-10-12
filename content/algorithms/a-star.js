import { gridInputs, makeGrid, neighbors4, manhattan, gridView } from '../../js/lib/grids.js';

const HEURISTICS = [
  { value: 'manhattan', label: 'Manhattan distance (admissible)' },
  { value: 'zero', label: 'Zero: no estimate (this is Dijkstra)' },
  { value: 'weighted', label: 'Manhattan × 2 (inadmissible)' },
];

// A binary min-heap of [f, h, order, cell] entries: lowest f first, then lowest h, then oldest.
function makeHeap() {
  const a = [];
  const before = (x, y) => (x[0] - y[0] || x[1] - y[1] || x[2] - y[2]) < 0;
  const swap = (i, j) => { const x = a[i]; a[i] = a[j]; a[j] = x; };
  return {
    get size() { return a.length; },
    entries: () => a,
    push(item) {
      a.push(item);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!before(a[i], a[p])) break;
        swap(i, p); i = p;
      }
    },
    pop() {
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < a.length && before(a[l], a[m])) m = l;
          if (r < a.length && before(a[r], a[m])) m = r;
          if (m === i) break;
          swap(i, m); i = m;
        }
      }
      return top;
    },
  };
}

function run(input, t) {
  const grid = makeGrid(input);
  const { rows, cols, walls, start, goal } = grid;
  const N = rows * cols;
  const mode = input.heuristic;
  const weight = mode === 'weighted' ? 2 : mode === 'zero' ? 0 : 1;
  const h = (i) => weight * manhattan(grid, i, goal);
  const g = new Array(N).fill(Infinity);     // steps taken on the best route found so far
  const parent = new Int32Array(N).fill(-1);
  const state = new Uint8Array(N);           // 0 unseen, 1 open, 2 closed
  const heap = makeHeap();
  let order = 0, expanded = 0, openCount = 0;
  let freeCells = 0;
  for (let i = 0; i < N; i++) if (!walls[i]) freeCells++;
  const hWords = mode === 'zero' ? 'always 0 here, so the score is just the steps taken' : mode === 'weighted' ? 'here twice the number of rows plus columns between the cell and the goal' : 'here the number of rows plus columns between the cell and the goal';
  const legend = [{ label: 'start', role: 'start' }, { label: 'goal', role: 'goal' }, { label: 'being explored', role: 'current' }, { label: 'open: waiting', role: 'frontier' }, { label: 'closed: explored', role: 'visited' }, { label: 'path', role: 'path' }, { label: 'wall', role: 'wall' }];

  const views = ({ current = -1, path = null } = {}) => {
    const onPath = path ? new Set(path) : null;
    const gv = gridView(grid, (i) => (onPath && onPath.has(i) ? 'path' : i === current ? 'current' : state[i] === 2 ? 'visited' : state[i] === 1 ? 'frontier' : undefined),
      { title: 'The number in a cell is its score: steps taken to reach it + estimated steps to the goal' });
    gv.labels = Array.from({ length: N }, (_, i) => (state[i] ? g[i] + h(i) : ''));
    gv.legend = legend;
    const live = heap.entries().filter((e) => state[e[3]] === 1 && e[0] - e[1] === g[e[3]]).sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
    const cells = live.slice(0, 10).map((e) => ({ t: e[0], sub: `${g[e[3]]}+${e[1]}`, role: 'frontier' }));
    if (live.length > 10) cells.push({ t: `+${live.length - 10}`, sub: 'more', role: 'dim' });
    return [gv, { kind: 'rows', title: 'Open set, lowest score first (steps taken + estimate)', rows: [{ label: 'Next up', cells }] }];
  };

  g[start] = 0;
  state[start] = 1; openCount = 1;
  heap.push([h(start), h(start), order++, start]);
  t.frame(() => ({ line: [1, 2], note: `Find a path from the start (dark) to the goal (brick red), moving up, down, left or right. Every cell A* knows about has a score: **g**, the steps taken to reach it, plus **h**, an estimate of the steps still to go (${hWords}). The start has g = 0 and h = ${h(start)}.`, views: views(), vars: { g: 0, h: h(start), f: h(start) } }));

  let found = false;
  while (heap.size) {
    const [f, hu, , u] = heap.pop();
    if (state[u] === 2 || f - hu !== g[u]) continue;   // a stale entry: this cell was reached more cheaply later
    state[u] = 2; openCount--;
    expanded++;
    t.count('nodes expanded');
    if (u === goal) { found = true; break; }
    let fresh = 0, improved = 0;
    for (const v of neighbors4(grid, u)) {
      if (state[v] === 2) continue;
      const cand = g[u] + 1;
      if (cand < g[v]) {
        if (state[v] === 1) improved++; else { fresh++; state[v] = 1; openCount++; }
        g[v] = cand;
        parent[v] = u;
        heap.push([cand + h(v), h(v), order++, v]);
      }
    }
    const gu = g[u];
    t.frame(() => ({ line: fresh || improved ? [4, 7, 8, 9, 10, 11, 12] : [4, 7, 8, 9],
      note: `Explore the open cell with the lowest score, **${f}** (${gu} ${gu === 1 ? 'step' : 'steps'} taken + ${hu} estimated to go), and close it. ${fresh ? `${fresh} of its neighbours ${fresh === 1 ? 'is' : 'are'} new and ${fresh === 1 ? 'joins' : 'join'} the open set.` : 'None of its neighbours is new.'}${improved ? ` ${improved} open ${improved === 1 ? 'neighbour gets' : 'neighbours get'} a shorter route through this cell.` : ''}`,
      views: views({ current: u }), vars: { g: gu, h: hu, f, open: openCount, closed: expanded } }));
  }

  const path = [];
  if (found) for (let v = goal; v !== -1; v = parent[v]) path.unshift(v);
  const cost = found ? g[goal] : Infinity;
  const verdict = mode === 'manhattan'
    ? 'This estimate never overestimates, so no shorter path exists.'
    : mode === 'zero'
      ? 'With no estimate the search spread evenly in every direction, which is exactly what Dijkstra\'s algorithm does. The path is still a shortest one.'
      : 'Doubling the estimate made the search hurry toward the goal. A doubled estimate can overestimate, so this path may be longer than the shortest one, though never more than twice as long.';
  t.frame(() => ({ line: found ? 6 : 13, note: found
    ? `The goal now has the lowest score in the open set, so the search stops. Following the "came from" links back gives a path of **${cost} steps**. A* closed ${expanded} of the ${freeCells} cells that are not walls. ${verdict}`
    : `The open set is empty and the goal was never reached, so no path exists. A* had to close all ${expanded} cells it could reach before it could be sure.`,
    views: views({ path: found ? path : null }), vars: { 'path length': found ? cost : 'none', closed: expanded } }));

  return { found, cost, path, expanded, heuristic: mode, grid: { rows, cols, walls: Array.from(walls), start, goal } };
}

// Reference for the tests: a plain breadth-first search with its own neighbour code.
function bfsLength(gr) {
  const dist = new Map([[gr.start, 0]]);
  const queue = [gr.start];
  for (let k = 0; k < queue.length; k++) {
    const u = queue[k];
    const r = Math.floor(u / gr.cols), c = u % gr.cols;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= gr.rows || nc < 0 || nc >= gr.cols) continue;
      const v = nr * gr.cols + nc;
      if (gr.walls[v] || dist.has(v)) continue;
      dist.set(v, dist.get(u) + 1);
      queue.push(v);
    }
  }
  return dist.has(gr.goal) ? dist.get(gr.goal) : Infinity;
}
const validPath = (r) => {
  const gr = r.grid;
  if (r.path[0] !== gr.start || r.path[r.path.length - 1] !== gr.goal) return 'the path does not run from start to goal';
  if (r.path.length - 1 !== r.cost) return 'the path length does not match the reported cost';
  for (let i = 0; i < r.path.length; i++) {
    if (gr.walls[r.path[i]]) return 'the path passes through a wall';
    if (i && Math.abs(Math.floor(r.path[i] / gr.cols) - Math.floor(r.path[i - 1] / gr.cols)) + Math.abs((r.path[i] % gr.cols) - (r.path[i - 1] % gr.cols)) !== 1) return 'the path jumps between cells that are not neighbours';
  }
  return true;
};
const optimal = (r) => {
  const best = bfsLength(r.grid);
  if (!r.found) return best === Infinity || 'reported no path, but breadth-first search finds one';
  const ok = validPath(r);
  if (ok !== true) return ok;
  return r.cost === best || `path has ${r.cost} steps, breadth-first search finds ${best}`;
};

export default {
  meta: {
    id: 'a-star',
    name: 'A* Search',
    aliases: ['A star', 'A-star', 'A* pathfinding', 'best-first search with f = g + h', 'heuristic search'],
    kind: 'algorithm',
    discipline: 'ai',
    alsoIn: [
      { id: 'robotics', why: 'It plans routes for mobile robots across grids and roadmaps, the purpose it was invented for.' },
      { id: 'graph-theory', why: 'It is a shortest-path algorithm: Dijkstra\'s algorithm with the queue reordered by a lower bound on the remaining distance.' },
    ],
    subfield: 'Search',
    family: 'Informed (heuristic) search',
    lab: 'graphs',
    year: 1968,
    authors: 'Peter Hart, Nils Nilsson and Bertram Raphael',
    summary: 'Finds a cheapest path to a goal by always exploring the position with the lowest total of cost so far plus estimated cost to go.',
    difficulty: 'intermediate',
    order: 260,
    paradigms: ['graph-search'],
    randomized: false,
    approximate: false,
    time: { best: 'O(d) with a perfect estimate', average: 'Depends on the heuristic', worst: 'O((V + E) log V)', class: 'linearithmic' },
    space: { worst: 'O(V)', class: 'linear' },
    tags: {
      problems: ['shortest path to a goal', 'pathfinding', 'find a route around obstacles', 'how do game characters find their way', 'route planning', 'solve a sliding puzzle'],
      techniques: ['heuristic', 'priority queue', 'best-first search', 'admissible estimate'],
      applications: ['games', 'robotics', 'navigation', 'logistics'],
    },
    prerequisites: ['dijkstra', 'bfs', 'concept:heuristic', 'concept:priority-queue', 'concept:shortest-path'],
  },

  bigIdea: {
    simple: "A* (say \"A star\") is a way to find the shortest route to a goal without wasting time searching in the wrong directions. Imagine crossing a city on foot toward a tall tower you can see in the distance. At every street corner you could ask two things. How far have I walked to get here? And how far does it still look to the tower? Add the two numbers, and you have a guess at the length of a whole trip through that corner. A* keeps a list of corners it could explore next, and it always picks the one with the smallest total. Corners that lead away from the tower get large totals, so they wait at the bottom of the list. Many are never explored at all. If the \"how far does it look\" guess never says the goal is farther than it really is, the route A* finds is truly the shortest. Video games use it to move characters, and robots use it to plan their paths.",
    what: 'A* finds a cheapest path from a start to a goal. For each position it knows about, it adds the cost of the best route found so far to an estimate of the cost still to come, and it always explores the position where that sum is smallest. The estimate is called a heuristic. With a heuristic that never overestimates, the path A* returns is a cheapest one.',
    why: 'Searching outward evenly in every direction, as Dijkstra\'s algorithm does, finds the answer but spends most of its effort on places that lead away from the goal. A* was developed at the Stanford Research Institute in the late 1960s to plan routes for Shakey, an early mobile robot. The aim was to use knowledge about where the goal lies to cut down the search without losing the guarantee of a shortest path.',
    when: 'Use it when you want a path to one known goal and can cheaply estimate the remaining cost, as on maps, grids and many puzzles. If you need distances to every node, or have no useful estimate, use [Dijkstra\'s algorithm](#/algorithm/dijkstra). If every step costs the same and the space is small, plain [breadth-first search](#/algorithm/bfs) is simpler.',
    interesting: 'One setting turns it into three different algorithms. With an estimate of zero it is exactly Dijkstra\'s algorithm. With an accurate estimate that never overestimates, it explores far less and is still exact. With an estimate that is too large, it runs faster still but can return a path that is not the shortest. The quality of the estimate is the whole story.',
    where: 'Pathfinding in video games is the best-known use. Robots plan with it and with variants that repair a plan when the map changes. It also solves puzzles such as the 15-puzzle, where the "map" is the set of all arrangements of the tiles.',
    analogy: {
      title: 'Walking toward a landmark you can see',
      text: 'You are crossing an unfamiliar town toward a tower visible above the rooftops. The straight-line distance to the tower is an estimate of how far you still have to go. Streets may force detours, so the real walk is at least that long, never shorter. At each corner, the distance walked so far plus the straight-line distance remaining is the best case for any route through that corner. A* always continues from the corner with the best such total.',
      limits: 'A walker stands in one place and must walk back to try a different street. A* does not walk. It keeps a list of every corner it could continue from and jumps to whichever is most promising, at no cost. The picture also assumes your eye judges the distance correctly. If your estimate is too high, A* may settle for a route that is not the shortest. And if you cannot see the tower at all, the estimate is useless and A* has to search in every direction.',
    },
  },

  example: {
    setup: "A robot stands on a grid of squares. The goal is 5 squares to its right, with nothing in the way. The robot can step up, down, left or right. Give each square a score made of two numbers: the steps taken to reach it, and the steps that would remain if nothing were in the way (count the squares across plus the squares up or down). Always explore the unexplored square with the lowest score.",
    steps: [
      "The start has taken 0 steps and is 5 from the goal. Its score is 0 + 5 = 5.",
      "Look at its four neighbours. The one on the right: 1 step taken, 4 to go, score 5. The ones above, below and on the left: 1 step taken, 6 to go, score 7.",
      "The lowest score is 5, so explore the square on the right. The square to its right has 2 steps taken and 3 to go: score 5 again. Its neighbours above and below score 2 + 5 = 7.",
      "Keep choosing a square with score 5. Each time it is the next square toward the goal. The squares with score 7 stay on the waiting list.",
      "After five steps the goal itself has the lowest score, 5 + 0 = 5. It is chosen, and the search stops.",
    ],
    result: "The path is 5 steps long, and only 6 squares were explored: the start, the four squares in between, and the goal. On the same grid of 6 rows and 8 columns, a search with no estimate explores 31 squares before it reaches the goal. Both find a 5-step path. The estimate did not change the answer. It changed how much work was needed to find it.",
    tryInput: { rows: 6, cols: 8, density: 0, toggles: [], heuristic: 'manhattan' },
  },

  terms: [
    { term: "Path", meaning: "A sequence of steps from one position to another." },
    { term: "Cost so far (g)", meaning: "The length of the best route found so far from the start to a position." },
    { term: "Heuristic (h)", meaning: "A quick estimate of the cost still to go from a position to the goal. It is a rule of thumb, not a measurement." },
    { term: "Score (f)", meaning: "Cost so far plus the heuristic: an estimate of the total length of a path through this position." },
    { term: "Manhattan distance", meaning: "The number of rows plus the number of columns between two cells: the distance when you can only move along the grid, like streets in a city." },
    { term: "Open set", meaning: "The positions that have been reached but not yet explored. Also called the frontier." },
    { term: "Closed set", meaning: "The positions that have already been explored." },
    { term: "Admissible", meaning: "Describes a heuristic that never overestimates: its guess is always less than or equal to the true remaining cost." },
  ],

  takeaway: "Always explore the place where steps taken plus a careful guess of steps remaining is smallest, and you reach the goal by a shortest path without searching everywhere.",

  viz: {
    describe: 'A grid world with walls. The start cell is dark and the goal is brick red. Cells in the open set, reached but not yet explored, are ochre. Closed cells, already explored, are pale green, and the cell being explored is terracotta. Each reached cell shows its score: steps taken plus the estimated steps to the goal. A row beneath the grid lists the lowest scores in the open set. At the end the path found is drawn in forest green. Click any cell to add or remove a wall.',
    inputs: [
      ...gridInputs({ rows: 14, cols: 24, density: 0.28 }),
      { id: 'heuristic', type: 'select', label: 'Heuristic (estimate of steps to the goal)', options: HEURISTICS, default: 'manhattan',
        help: 'Manhattan distance never overestimates on this grid. Zero gives no guidance. Doubling the Manhattan distance overestimates: faster, but the path may not be the shortest.' },
    ],
    presets: [
      { label: 'Scattered walls', values: { rows: 14, cols: 24, density: 0.28, seed: 5, toggles: [], heuristic: 'manhattan' } },
      { label: 'Same grid, no estimate (Dijkstra)', values: { rows: 14, cols: 24, density: 0.28, seed: 5, toggles: [], heuristic: 'zero' } },
      { label: 'Same grid, estimate doubled', values: { rows: 14, cols: 24, density: 0.28, seed: 5, toggles: [], heuristic: 'weighted' } },
      { label: 'Open field', values: { rows: 12, cols: 24, density: 0, seed: 5, toggles: [], heuristic: 'manhattan' } },
      { label: 'Goal walled off', values: { rows: 8, cols: 14, density: 0, seed: 5, toggles: [54, 82, 67, 69], heuristic: 'manhattan' } },
    ],
    tryThis: [
      'Run the three "scattered walls" presets one after another. They use the same grid. Compare the path length and the number of closed cells: the Manhattan estimate and the zero estimate both find a 29-step path, with 94 and 191 cells closed. The doubled estimate closes only 50 cells but returns a 31-step path.',
      'Load "Open field" and switch between the three heuristics. With the Manhattan estimate the search walks straight to the goal. With no estimate it grows as a diamond in all directions.',
      'On any grid, click cells to build a wall across the straight line to the goal, leaving a gap far above it. Watch the open set pile up against the wall before the search finds the gap. The estimate knows nothing about walls, and this is the price.',
      'Load "Goal walled off". There is no path, and A* cannot know that until it has closed every cell it can reach. Remove one of the four walls round the goal and run it again.',
    ],
    run,
    report: (r, c) => `${r.found ? `Path found: ${r.cost} steps.` : 'No path exists.'} ${c['nodes expanded'] || 0} cells explored (closed).\nHeuristic: ${r.heuristic === 'manhattan' ? 'Manhattan distance. Admissible, so the path is a shortest one.' : r.heuristic === 'zero' ? 'zero. A* behaves as Dijkstra\'s algorithm; the path is a shortest one.' : 'Manhattan × 2. Not admissible, so the path may be up to twice the shortest length.'}`,
    experiment: {
      title: 'Cells explored as the grid grows',
      note: 'Each point is a real run on a square grid with one cell in five walled, from the left edge to the right edge. The three series use the same grids and differ only in the heuristic. With no estimate the search covers most of the grid; the curve is side² scaled to the last point of that series. On the rare grid where the goal is cut off, every reachable cell is explored whatever the heuristic.',
      metric: 'nodes expanded',
      metricLabel: 'Cells explored',
      sizeLabel: 'Grid side length (cells)',
      sizes: [8, 12, 16, 24, 32, 48, 64],
      variants: [
        { id: 'zero', label: 'No estimate (Dijkstra)' },
        { id: 'manhattan', label: 'Manhattan distance' },
        { id: 'weighted', label: 'Manhattan × 2 (path may be longer)' },
      ],
      input: (n, variant, seed) => ({ rows: n, cols: n, density: 0.2, seed, toggles: [], heuristic: variant }),
      theory: [{ label: 'proportional to side² (scaled)', fn: (n) => n * n, scaled: true, variant: 'zero' }],
    },
  },

  logic: {
    intuition: 'For any position `n`, `g(n)` is what it cost to get there and `h(n)` guesses what it will cost to finish. If `h` never overestimates, then `f(n) = g(n) + h(n)` never overestimates the cost of the best path through `n`. So when the goal comes up as the lowest-scoring position, every other open position is promising a total at least as large, and none of them can lead to anything cheaper. Until that moment, low scores keep the search pointed at the goal and high scores keep it from wandering.',
    steps: [
      'Give the start `g = 0` and put it in the open set with score `f = h(start)`.',
      'Remove the position `n` with the lowest score `f` from the open set. If it is the goal, stop: follow the "came from" links back to read off the path.',
      'Otherwise move `n` to the closed set.',
      'For each neighbour `m` of `n` that is not closed, compute the cost of reaching it through `n`: `g(n)` plus the cost of the step.',
      'If that is lower than the best `g(m)` known so far, record it, remember that `m` is reached from `n`, and put `m` in the open set with score `g(m) + h(m)`.',
      'Repeat from step 2. If the open set becomes empty, no path exists.',
    ],
    pseudocode: [
      'a_star(start, goal, h):',
      '  g[start] ← 0',
      '  open ← priority queue containing start with score h(start)',
      '  while open is not empty:',
      '    n ← remove the entry with the lowest score f = g + h',
      '    if n is closed: continue',
      '    if n = goal: return the path back through parent',
      '    mark n as closed',
      '    for each neighbour m of n that is not closed:',
      '      if g[n] + cost(n, m) < g[m]:',
      '        g[m] ← g[n] + cost(n, m)',
      '        parent[m] ← n',
      '        insert m into open with score g[m] + h(m)',
      '  return "no path"',
    ],
    decisions: [
      { title: 'Which heuristic?', text: 'It should be cheap to compute, never overestimate, and be as large as it can be within that limit. On a grid with four-way movement and unit steps, Manhattan distance is exact when there are no walls and too low when there are, so it qualifies. A larger admissible heuristic explores fewer cells. An estimate of zero is admissible but gives no guidance.' },
      { title: 'How are ties broken?', text: 'On an open grid a great many cells share the same score. This page prefers the entry with the smaller `h`, the one that has come farthest, and then the older entry. Without that preference A* is still correct but explores many more cells of equal score.' },
      { title: 'Reopen closed cells?', text: 'This page never does. With a consistent heuristic, such as Manhattan distance or zero, a cell\'s cost is already optimal when it is closed, so nothing is lost. With the doubled estimate, which is not consistent, never reopening keeps the search fast and still guarantees a path at most twice the optimal length, but not an optimal one.' },
      { title: 'Deliberately overestimate?', text: 'Multiplying an admissible heuristic by a factor w above 1 is called weighted A*. It trades optimality for speed in a controlled way: the path costs at most w times the optimum. Games and robots often accept that trade.' },
    ],
    invariants: [
      'For every reached cell, `g` is the length of a real path from the start, so it is never below the true shortest distance.',
      'With a consistent heuristic, the scores of the cells that are closed never decrease over time.',
      'With a consistent heuristic, when a cell is closed its `g` is the true shortest distance from the start.',
      'Until the goal is closed, some cell of every shortest path is in the open set.',
    ],
    edgeCases: [
      'No path exists: the open set empties only after every reachable cell has been closed. The heuristic cannot prove that the goal is cut off.',
      'The heuristic is zero everywhere: A* becomes Dijkstra\'s algorithm, and on a grid with unit steps it explores in the same order of distance as breadth-first search.',
      'The heuristic overestimates: the search may stop at a path that is not the shortest.',
      'Steps with different costs: the heuristic must be scaled to the cheapest possible step, or it will overestimate.',
      'Diagonal moves allowed: Manhattan distance overestimates, because one diagonal step covers a row and a column. A different heuristic is needed.',
      'Several shortest paths: A* returns one of them, decided by the tie-breaking rule.',
    ],
    correctness: 'Suppose the heuristic is admissible: for every cell it is at most the true remaining cost. Let the true shortest path cost be C. Claim: A* never returns a path costing more than C, provided a cell may be given a better route whenever one is found. Suppose it is about to stop at the goal with `g(goal)` greater than C. Take a real shortest path. Some cell `n` on it is still in the open set with `g(n)` equal to its true distance: the first cell on that path that has not yet been closed with its correct cost. Its score is `g(n) + h(n)`, and since `h(n)` does not exceed the true remaining cost, that score is at most C. The goal has score `g(goal) + 0`, which is more than C. So `n` would have been taken from the open set before the goal, a contradiction. The claim needs one extra condition when closed cells are never reopened: the heuristic must be consistent, meaning it never drops by more than the cost of a step between neighbouring cells. Then each cell already has its true distance when it is closed, so no better route to a closed cell can turn up later.',
    mistakes: [
      'Stopping when the goal is first added to the open set. The first route to reach the goal is not always the cheapest; the search must continue until the goal is removed from the open set.',
      'Using a heuristic that overestimates without realising it, for example squared straight-line distance, or Manhattan distance when diagonal moves are allowed.',
      'Ignoring a cheaper route to a cell that is already in the open set.',
      'Measuring the heuristic and the step costs in different units, such as distance for one and travel time for the other.',
      'Claiming optimal paths while using an inconsistent heuristic and never reopening closed cells.',
    ],
  },

  code: {
    sample: {
      input: 'A 7 by 12 map with a few walls (#), from S to G. The search is run with three heuristics: Manhattan distance, zero, and Manhattan distance doubled. The last lines draw the path found with Manhattan distance.',
      expected: 'Manhattan: 13 steps, 20 cells explored\nzero: 13 steps, 76 cells explored\nManhattan x2: 15 steps, 17 cells explored\n............\n............\n.....#......\nS*#..#*****G\n.******.....\n...........#\n..........#.',
    },
    python: {
      source: `import heapq

GRID = [
    "............",
    "............",
    ".....#......",
    "S.#..#.....G",
    "............",
    "...........#",
    "..........#.",
]
ROWS, COLS = len(GRID), len(GRID[0])


def find(mark):
    for r, row in enumerate(GRID):
        if mark in row:
            return (r, row.index(mark))


def a_star(start, goal, weight):
    def h(cell):
        return weight * (abs(cell[0] - goal[0]) + abs(cell[1] - goal[1]))

    g = {start: 0}
    parent = {}
    closed = set()
    open_heap = [(h(start), h(start), 0, start)]
    pushed = 1
    while open_heap:
        _, _, _, cell = heapq.heappop(open_heap)
        if cell in closed:
            continue
        closed.add(cell)
        if cell == goal:
            break
        r, c = cell
        for nxt in ((r - 1, c), (r, c + 1), (r + 1, c), (r, c - 1)):
            if not (0 <= nxt[0] < ROWS and 0 <= nxt[1] < COLS):
                continue
            if GRID[nxt[0]][nxt[1]] == "#" or nxt in closed:
                continue
            if g[cell] + 1 < g.get(nxt, float("inf")):
                g[nxt] = g[cell] + 1
                parent[nxt] = cell
                heapq.heappush(open_heap, (g[nxt] + h(nxt), h(nxt), pushed, nxt))
                pushed += 1
    path = [goal]
    while path[-1] in parent:
        path.append(parent[path[-1]])
    return path[::-1], len(closed)


start, goal = find("S"), find("G")
for name, weight in (("Manhattan", 1), ("zero", 0), ("Manhattan x2", 2)):
    path, explored = a_star(start, goal, weight)
    print(f"{name}: {len(path) - 1} steps, {explored} cells explored")

path, _ = a_star(start, goal, 1)
for r in range(ROWS):
    print("".join("*" if (r, c) in path[1:-1] else GRID[r][c] for c in range(COLS)))`,
      notes: [
        { line: 23, text: 'The heuristic. With `weight` 1 it is the Manhattan distance, which never overestimates here. With 0 the search has no guidance, and with 2 it overestimates.' },
        { line: 28, text: 'Each entry is (f, h, order, cell). The heap returns the lowest f. Ties go to the lower h, the cell that has come farthest, and then to the older entry.' },
        { line: 32, text: 'A cell can be in the heap more than once, with different scores. Only its first, lowest-scoring appearance counts; later ones are skipped here.' },
        { line: 35, text: 'The search ends when the goal is taken out of the heap, not when it is first put in. Only then is its cost known to be final.' },
        { line: 43, text: 'A cheaper route to a neighbour has been found, either because it is new or because this route beats the old one.' },
      ],
    },
    javascript: {
      source: `const GRID = [
  "............",
  "............",
  ".....#......",
  "S.#..#.....G",
  "............",
  "...........#",
  "..........#.",
];
const ROWS = GRID.length, COLS = GRID[0].length;

// A min-heap of [f, h, order, cell] entries, compared field by field.
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  less(i, j) {
    const x = this.a[i], y = this.a[j];
    return (x[0] - y[0] || x[1] - y[1] || x[2] - y[2]) < 0;
  }
  swap(i, j) { [this.a[i], this.a[j]] = [this.a[j], this.a[i]]; }
  push(item) {
    this.a.push(item);
    let i = this.a.length - 1;
    while (i > 0 && this.less(i, (i - 1) >> 1)) {
      this.swap(i, (i - 1) >> 1);
      i = (i - 1) >> 1;
    }
  }
  pop() {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        let m = i;
        const l = 2 * i + 1, r = l + 1;
        if (l < this.a.length && this.less(l, m)) m = l;
        if (r < this.a.length && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
}

function find(mark) {
  for (let r = 0; r < ROWS; r++) {
    if (GRID[r].includes(mark)) return r * COLS + GRID[r].indexOf(mark);
  }
}

function aStar(start, goal, weight) {
  const row = (cell) => Math.floor(cell / COLS), col = (cell) => cell % COLS;
  const h = (cell) => weight * (Math.abs(row(cell) - row(goal)) + Math.abs(col(cell) - col(goal)));
  const g = new Map([[start, 0]]);
  const parent = new Map();
  const closed = new Set();
  const open = new MinHeap();
  open.push([h(start), h(start), 0, start]);
  let pushed = 1;
  while (open.size) {
    const cell = open.pop()[3];
    if (closed.has(cell)) continue;
    closed.add(cell);
    if (cell === goal) break;
    const r = row(cell), c = col(cell);
    for (const [nr, nc] of [[r - 1, c], [r, c + 1], [r + 1, c], [r, c - 1]]) {
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const next = nr * COLS + nc;
      if (GRID[nr][nc] === "#" || closed.has(next)) continue;
      if (g.get(cell) + 1 < (g.has(next) ? g.get(next) : Infinity)) {
        g.set(next, g.get(cell) + 1);
        parent.set(next, cell);
        open.push([g.get(next) + h(next), h(next), pushed, next]);
        pushed += 1;
      }
    }
  }
  const path = [goal];
  while (parent.has(path[0])) path.unshift(parent.get(path[0]));
  return { path, explored: closed.size };
}

const start = find("S"), goal = find("G");
for (const [name, weight] of [["Manhattan", 1], ["zero", 0], ["Manhattan x2", 2]]) {
  const { path, explored } = aStar(start, goal, weight);
  console.log(name + ": " + (path.length - 1) + " steps, " + explored + " cells explored");
}

const inner = new Set(aStar(start, goal, 1).path.slice(1, -1));
for (let r = 0; r < ROWS; r++) {
  let line = "";
  for (let c = 0; c < COLS; c++) line += inner.has(r * COLS + c) ? "*" : GRID[r][c];
  console.log(line);
}`,
    },
    cpp: {
      source: `#include <cstdlib>
#include <functional>
#include <iostream>
#include <queue>
#include <string>
#include <tuple>
#include <utility>
#include <vector>

const std::vector<std::string> GRID = {
    "............",
    "............",
    ".....#......",
    "S.#..#.....G",
    "............",
    "...........#",
    "..........#.",
};
const int ROWS = static_cast<int>(GRID.size());
const int COLS = static_cast<int>(GRID[0].size());

int find(char mark) {
    for (int r = 0; r < ROWS; ++r) {
        std::size_t c = GRID[r].find(mark);
        if (c != std::string::npos) return r * COLS + static_cast<int>(c);
    }
    return -1;
}

// Returns the path from start to goal and sets explored to the number of closed cells.
std::vector<int> aStar(int start, int goal, int weight, int& explored) {
    auto h = [&](int cell) {
        return weight * (std::abs(cell / COLS - goal / COLS) + std::abs(cell % COLS - goal % COLS));
    };
    const int INF = 1 << 30;
    std::vector<int> g(ROWS * COLS, INF), parent(ROWS * COLS, -1);
    std::vector<bool> closed(ROWS * COLS, false);
    using Entry = std::tuple<int, int, int, int>;  // (f, h, order, cell)
    std::priority_queue<Entry, std::vector<Entry>, std::greater<Entry>> open;
    g[start] = 0;
    open.push({h(start), h(start), 0, start});
    int pushed = 1;
    explored = 0;
    while (!open.empty()) {
        int cell = std::get<3>(open.top());
        open.pop();
        if (closed[cell]) continue;
        closed[cell] = true;
        ++explored;
        if (cell == goal) break;
        int r = cell / COLS, c = cell % COLS;
        const std::pair<int, int> steps[4] = {{r - 1, c}, {r, c + 1}, {r + 1, c}, {r, c - 1}};
        for (auto [nr, nc] : steps) {
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            int next = nr * COLS + nc;
            if (GRID[nr][nc] == '#' || closed[next]) continue;
            if (g[cell] + 1 < g[next]) {
                g[next] = g[cell] + 1;
                parent[next] = cell;
                open.push({g[next] + h(next), h(next), pushed++, next});
            }
        }
    }
    std::vector<int> path;
    for (int v = goal; v != -1; v = parent[v]) path.insert(path.begin(), v);
    return path;
}

int main() {
    int start = find('S'), goal = find('G'), explored = 0;
    const std::pair<std::string, int> runs[3] = {{"Manhattan", 1}, {"zero", 0}, {"Manhattan x2", 2}};
    for (const auto& [name, weight] : runs) {
        std::vector<int> path = aStar(start, goal, weight, explored);
        std::cout << name << ": " << path.size() - 1 << " steps, " << explored << " cells explored\\n";
    }
    std::vector<int> path = aStar(start, goal, 1, explored);
    std::vector<std::string> picture = GRID;
    for (std::size_t i = 1; i + 1 < path.size(); ++i) picture[path[i] / COLS][path[i] % COLS] = '*';
    for (const auto& line : picture) std::cout << line << "\\n";
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The cost of A* is the number of positions it explores times the cost of handling one, and the first number depends almost entirely on the heuristic. With a perfect estimate it explores only the positions on a shortest path. With an estimate of zero it explores everything closer than the goal, as Dijkstra\'s algorithm does. Real heuristics fall in between.',
    cases: [
      { case: 'Perfect heuristic', time: 'O(d) positions explored', when: 'The estimate equals the true remaining cost and ties are broken toward the goal. Only the d positions along one shortest path are explored.' },
      { case: 'Consistent heuristic, explicit graph', time: 'O((V + E) log V)', when: 'Each position is closed at most once, and each queue operation on a binary heap costs O(log V). This is Dijkstra\'s bound; a good heuristic makes the part of the graph actually touched much smaller.' },
      { case: 'Zero heuristic', time: 'Same as Dijkstra', when: 'Every position closer to the start than the goal is explored.' },
      { case: 'Search tree with branching factor b', time: 'O(b^d) in the worst case', when: 'When positions are generated on demand, as in puzzles, and the heuristic is weak, the number explored can grow exponentially with the solution length d.' },
    ],
    space: 'O(V): every position reached is stored, in the open set or the closed set, together with its cost and parent. On an explicit grid that is at most the number of cells.',
    memory: 'In large implicit search spaces, memory runs out before time does, because A* keeps every position it has generated. Iterative-deepening A* trades repeated work for memory proportional to the path length.',
    tradeoffs: 'A stronger heuristic explores fewer positions but may cost more to compute at each one. An inflated heuristic explores fewer still, at the cost of a bounded loss in path quality. Preprocessing a map to obtain better estimates moves work from query time to setup time.',
    assumptions: [
      'Step costs are non-negative.',
      'The heuristic takes constant time to evaluate.',
      'The O((V + E) log V) bound assumes a consistent heuristic, so that no position is closed more than once.',
      'Optimality of the returned path assumes an admissible heuristic, and, in this implementation which never reopens closed cells, a consistent one.',
      'The chart on this page counts closed cells for this implementation and tie-breaking rule on random grids. It is an illustration, not a general benchmark.',
    ],
  },

  tradeoffs: {
    excels: [
      'Finding a path to a single known goal when a good estimate of remaining cost is available.',
      'Maps and grids, where straight-line or Manhattan distance is a natural admissible heuristic.',
      'Puzzles and planning problems with informative heuristics.',
    ],
    struggles: [
      'Problems with no useful heuristic, where it does the same work as Dijkstra\'s algorithm.',
      'Very large search spaces, where storing every reached position exhausts memory.',
      'Obstacles that the heuristic cannot see, such as a long wall or a dead end facing the goal. The search fills the pocket before it finds the way round.',
      'Many goals or all-pairs queries, where the estimate toward one goal does not help with the others.',
    ],
    pitfalls: [
      'A heuristic that is silently inadmissible, giving paths that are slightly too long with no error.',
      'Poor tie-breaking on grids, which multiplies the number of explored cells without changing the answer.',
      'Expensive heuristics evaluated at every generated position.',
    ],
    misunderstandings: [
      "\"A* always finds the shortest path.\" Only if its estimate never overestimates. With an estimate that is too high, it can return a longer path and give no warning.",
      "\"The estimate has to be accurate.\" It only has to be optimistic. An estimate of zero still gives a shortest path. A more accurate one gives the same path with less searching.",
      "\"A* heads straight for the goal.\" It prefers cells that look promising, but it will back up and explore elsewhere whenever the promising direction turns out to be blocked. That willingness to back up is what separates it from a greedy search, which can be led into a dead end.",
    ],
    constraints: [
      'Games often accept slightly longer paths in exchange for speed, by inflating the heuristic or searching a coarser map first.',
      'Robots that discover obstacles as they move use incremental variants that repair the previous search instead of starting again.',
      'On continental road networks, plain A* with straight-line distance gives only modest savings; practical systems rely on preprocessing.',
    ],
    alternatives: [
      { id: 'dijkstra', name: 'Dijkstra\'s Algorithm', when: 'You need distances to every node, or you have no heuristic.' },
      { id: 'bfs', name: 'Breadth-First Search', when: 'Every step costs the same and the space is small enough to search exhaustively.' },
      { id: 'rrt', name: 'Rapidly-Exploring Random Tree (RRT)', when: 'The space is continuous and high-dimensional, such as a robot arm\'s joint angles, where a grid would be far too large.' },
      { name: 'Iterative-deepening A* (IDA*)', when: 'Memory is the limiting factor and positions can be regenerated cheaply.' },
      { name: 'Greedy best-first search', when: 'Any path will do and speed matters more than length. It orders by the estimate alone and gives no guarantee on path quality.' },
    ],
    comparison: {
      columns: ['', 'A*', 'Dijkstra', 'Greedy best-first', 'BFS'],
      rows: [
        ['Orders the open set by', 'g + h', 'g', 'h', 'Order of discovery'],
        ['Shortest path guaranteed', 'With an admissible heuristic', 'Yes', 'No', 'Yes, if all steps cost the same'],
        ['Uses knowledge of the goal', 'Yes', 'No', 'Yes', 'No'],
        ['Typical exploration', 'A band around the best paths', 'Everything nearer than the goal', 'A narrow track toward the goal', 'Everything nearer than the goal'],
      ],
    },
  },

  applications: [
    { title: 'Pathfinding in video games', status: 'established', text: 'Characters in games find routes across tile maps and navigation meshes with A* and its variants. Game developers often inflate the heuristic or plan on a coarse map first, accepting slightly longer paths to stay within the time available in each frame.' },
    { title: 'Mobile robot navigation', status: 'established', text: 'A* was created to plan routes for the robot Shakey. Robots today plan over grids and roadmaps with it and with incremental descendants such as D* Lite, which update an existing plan when sensors reveal a new obstacle.' },
    { title: 'Solving combinatorial puzzles', status: 'established', text: 'For puzzles such as the 15-puzzle, each arrangement is a position and each move a step. With an admissible heuristic such as the total Manhattan distance of the tiles from their places, A* and its memory-saving variant IDA* find solutions with the fewest moves.' },
    { title: 'Route planning on road maps', status: 'illustrative', text: 'Straight-line distance divided by the top speed is an admissible estimate of travel time, so A* can direct a route search toward the destination. Production navigation systems use more elaborate methods built on precomputed information about the road network.' },
  ],

  connections: [
    { to: 'dijkstra', type: 'prerequisite', why: 'A* is Dijkstra\'s algorithm with the queue ordered by cost so far plus a lower bound on cost to go. With a bound of zero the two are identical.' },
    { to: 'bfs', type: 'prerequisite', why: 'Both grow a frontier from the start. Breadth-first search expands it evenly; A* expands it where the estimated total is lowest.' },
    { to: 'bellman-ford', type: 'same-problem', why: 'Both compute shortest paths by lowering cost estimates along edges. Bellman-Ford handles negative weights by repeating every relaxation; A* assumes non-negative costs and uses a heuristic to avoid most relaxations altogether.' },
    { to: 'rrt', type: 'same-problem', why: 'Both plan a path from a start to a goal. A* searches a fixed grid or graph and can guarantee a shortest path on it; RRT samples a continuous space and gives up that guarantee to cope with many dimensions.' },
    { to: 'heap-sort', type: 'related', why: 'The open set is a priority queue, normally the same binary heap that heap sort is built on: repeatedly remove the smallest remaining item.' },
    { to: 'concept:heuristic', type: 'prerequisite', why: 'The algorithm\'s speed and its guarantee both come from the properties of one estimating function.' },
    { to: 'concept:priority-queue', type: 'prerequisite', why: 'Each step needs the open position with the lowest score, which is exactly what a priority queue provides.' },
    { to: 'concept:state-space', type: 'related', why: 'A* does not need a map. Any problem whose situations and moves form a graph, such as a puzzle, can be searched the same way.' },
    { to: 'discipline:robotics', type: 'application', why: 'Motion planners search grids and roadmaps of a robot\'s surroundings for a cheapest collision-free route.' },
    { to: 'discipline:graph-theory', type: 'related', why: 'With a consistent heuristic it is Dijkstra\'s algorithm run on the same graph with adjusted edge weights, so the theory of shortest paths applies directly.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'What does it mean for a heuristic to be admissible?',
      options: ['It is always exactly right', 'It never overestimates the true remaining cost', 'It never underestimates the true remaining cost', 'It is zero at the start'],
      answer: 1,
      explain: [
        'An exact heuristic is admissible, but exactness is not required and is rarely available.',
        'Correct. An admissible heuristic is optimistic: its guess is at most the real cost. That is what lets A* stop at the goal with confidence.',
        'That is the opposite. A heuristic that can overshoot may hide the best path behind a high score.',
        'It must be zero at the goal, not the start.',
      ],
    },
    {
      type: 'predict',
      q: 'On an empty grid of 6 rows and 8 columns, A* with the Manhattan estimate explores 6 cells and finds a 5-step path. What happens with the estimate set to zero?',
      options: ['Same path length, same 6 cells explored', 'Same path length, about five times as many cells explored', 'A shorter path, because the search is more thorough', 'A longer path, because there is no guidance'],
      answer: 1,
      explain: [
        'Without an estimate nothing tells the search which way the goal lies, so it cannot stay on the straight line.',
        'Correct. It explores 31 cells, spreading in every direction until the goal is reached. The path is still 5 steps: a zero estimate is admissible.',
        'The 5-step path is already the shortest possible. More searching cannot improve on it.',
        'A zero estimate never overestimates, so the path is still a shortest one. Only the amount of work changes.',
      ],
      tryInput: { rows: 6, cols: 8, density: 0, toggles: [], heuristic: 'zero' },
    },
    {
      type: 'debug',
      q: 'On a grid with four-way movement, A* with this heuristic runs quickly but sometimes returns a path that is not the shortest. Why?',
      code: `def heuristic(cell, goal):
    dr = cell[0] - goal[0]
    dc = cell[1] - goal[1]
    return dr * dr + dc * dc`,
      options: ['It should return a negative number', 'It overestimates: a goal 3 cells to the right is 3 steps away, but this returns 9', 'It is too slow to compute', 'It ignores walls'],
      answer: 1,
      explain: [
        'A heuristic is an estimate of a cost, so it is never negative.',
        'Correct. The squared distance grows much faster than the number of steps, so the heuristic is not admissible. Use `abs(dr) + abs(dc)`.',
        'It is two multiplications and an addition. Speed is not the problem.',
        'Every practical heuristic ignores walls. Ignoring obstacles makes an estimate too low, which is allowed.',
      ],
    },
    {
      type: 'choice',
      q: 'Why is it wrong to stop the search as soon as the goal is first added to the open set?',
      options: ['The goal might be a wall', 'The first route to reach the goal may not be the cheapest; a cheaper one may still be waiting in the open set', 'The open set might be empty', 'The heuristic of the goal is not known yet'],
      answer: 1,
      explain: [
        'Walls are never added to the open set.',
        'Correct. The goal\'s cost is final only when it has the lowest score in the open set. Until then another open cell could lead to it more cheaply.',
        'If the goal was just added, the open set is not empty.',
        'The heuristic of the goal is zero.',
      ],
    },
    {
      type: 'challenge',
      title: 'Allow diagonal moves',
      prompt: 'Extend the search so the robot can also move diagonally, at a cost of 1.414 (the square root of 2) per diagonal step and 1 per straight step. First keep the Manhattan heuristic and find a grid on which the returned path is not the cheapest. Then design a heuristic that is admissible for eight-way movement and as large as possible, and confirm that the path is optimal again by comparing with the zero heuristic.',
      hints: ['With diagonal steps, covering 3 rows and 3 columns costs about 4.24, but Manhattan distance says 6.', 'Take as many diagonal steps as the smaller of the row and column differences, and straight steps for the rest. This is known as the octile distance.'],
    },
  ],

  compare: {
    idea: 'Explore positions in order of cost so far plus an optimistic estimate of cost to go.',
    requires: 'Non-negative step costs and a heuristic. The path is optimal if the heuristic is admissible (and consistent, when closed positions are never reopened).',
    sensitivity: 'High. The number of positions explored ranges from the path length to the whole reachable space, depending on the heuristic, the obstacles and the tie-breaking rule.',
    memory: 'O(V): every position reached is kept, with its cost and parent.',
    difficulty: 'moderate',
    difficultyNote: 'The loop is Dijkstra\'s with one extra term. The difficulty lies in choosing a heuristic and knowing what it guarantees.',
    limits: 'No better than Dijkstra without a good heuristic. Memory-hungry. Not optimal if the heuristic overestimates.',
    useWhen: 'You need one path to one goal and can estimate the remaining cost without overestimating.',
  },

  advanced: {
    history: 'Peter Hart, Nils Nilsson and Bertram Raphael of the Stanford Research Institute published A* in 1968, in work connected with the mobile robot Shakey. Their paper gave the algorithm, the admissibility condition under which it returns an optimal path, and a consistency condition used in analysing how few nodes it needs to expand. Ira Pohl studied weighting the heuristic in 1970. In 1985 Rina Dechter and Judea Pearl gave a detailed account of the sense in which A* makes the best possible use of its heuristic, and Richard Korf introduced iterative-deepening A*, which needs memory only proportional to the path length.',
    derivation: 'Write $c(n, m)$ for the cost of the step from $n$ to $m$ and $h^*(n)$ for the true cheapest cost from $n$ to the goal.\n\n- $h$ is **admissible** if $h(n) \\le h^*(n)$ for every $n$.\n- $h$ is **consistent** (or monotone) if $h(\\text{goal}) = 0$ and $h(n) \\le c(n, m) + h(m)$ for every step from $n$ to $m$.\n\nConsistency implies admissibility: along a cheapest path $n = n_0, n_1, \\dots, n_k = \\text{goal}$, adding the inequalities gives $h(n) \\le \\sum_i c(n_{i-1}, n_i) + h(\\text{goal}) = h^*(n)$. The converse is false.\n\nNow define adjusted step costs\n\n$$c\'(n, m) = c(n, m) + h(m) - h(n).$$\n\nConsistency says exactly that $c\'(n, m) \\ge 0$. For any path from the start $s$ to a node $n$, the adjusted costs telescope to the original cost plus $h(n) - h(s)$. So ordering the open set by $f(n) = g(n) + h(n)$ is the same as ordering by adjusted distance from the start, up to the constant $h(s)$. **A\\* with a consistent heuristic is Dijkstra\'s algorithm on the adjusted costs.** Everything known about Dijkstra\'s algorithm carries over: scores are closed in non-decreasing order, a node\'s cost is final when it is closed, and no node needs to be closed twice.\n\nOn a grid with four-way unit steps, the Manhattan distance changes by exactly 1 between neighbouring cells, so it is consistent. Twice the Manhattan distance can drop by 2 across a step of cost 1, so it is neither consistent nor admissible.',
    proof: '**Optimality with an admissible heuristic.** Let $C^*$ be the cost of a cheapest path, and suppose the version of A* that updates a node whenever a cheaper route to it is found (reopening it if it was closed) selects the goal with $g(\\text{goal}) > C^*$. Fix a cheapest path $P$. Before the goal is selected, some node of $P$ is in the open set with its true cost: let $n$ be the first node on $P$ that has not been closed with $g(n) = g^*(n)$. Its predecessor on $P$ was closed with the correct cost, and at that moment $n$ was given $g(n) = g^*(n)$ and placed in the open set. Then\n\n$$f(n) = g^*(n) + h(n) \\le g^*(n) + h^*(n) = C^* < g(\\text{goal}) = f(\\text{goal}),$$\n\nso $n$ would have been selected before the goal, a contradiction.\n\n**No reopening with a consistent heuristic.** By the derivation above, the search is Dijkstra\'s algorithm on non-negative adjusted costs, so $g(n) = g^*(n)$ when $n$ is first closed and no cheaper route to a closed node can appear. An implementation that never reopens closed nodes is then optimal.\n\n**Admissible but not consistent.** Without reopening, a node can be closed with a cost that is too high, and the returned path can be suboptimal even though the heuristic never overestimates. Optimality then requires reopening.\n\n**Weighted heuristic.** If $h$ is consistent and the search uses $w \\cdot h$ with $w \\ge 1$, the path returned costs at most $w \\cdot C^*$, and this remains true when closed nodes are never reopened.',
    complexityProof: 'With a consistent heuristic each node is closed at most once, each edge is examined at most once from each closed endpoint, and each improvement inserts one heap entry. That gives at most $V$ removals that close a node, at most $E$ insertions, and $O(\\log V)$ per heap operation, for $O((V + E)\\log V)$ in total, the same as Dijkstra\'s algorithm. The saving is in which nodes are touched: Writing $f^*(n) = g^*(n) + h(n)$, A* closes every node with $f^*(n) < C^*$, some nodes with $f^*(n) = C^*$ depending on how ties are broken, and no node with $f^*(n) > C^*$. A larger admissible $h$ raises $f^*$ and so shrinks the first set.',
    variants: [
      { name: 'Weighted A*', text: 'Uses f = g + w·h with w above 1. Explores fewer nodes and returns a path costing at most w times the optimum.' },
      { name: 'Iterative-deepening A* (IDA*)', text: 'Runs a series of depth-first searches, each cut off at a threshold on f that rises from one search to the next. Uses memory proportional to the path length.' },
      { name: 'Greedy best-first search', text: 'Orders the open set by h alone. Often fast, but with no guarantee on path cost.' },
      { name: 'Bidirectional A*', text: 'Searches from the start and from the goal at once. Making the two searches meet correctly is subtle.' },
      { name: 'D* and D* Lite', text: 'Incremental versions for robots: when the map changes, they repair the previous solution instead of searching again from nothing.' },
      { name: 'Jump point search', text: 'A technique for uniform-cost grids that skips over runs of cells whose exploration would be symmetric, without losing optimality.' },
      { name: 'Landmark heuristics (ALT)', text: 'Precompute distances to a few landmark nodes and use the triangle inequality to obtain much stronger admissible estimates on road networks.' },
    ],
    implementation: 'Store costs, parents and open or closed flags in flat arrays indexed by cell. With a binary heap, insert a fresh entry when a cost improves and skip stale entries when they surface. Break ties toward smaller h. Keep the heuristic and the step costs in the same units, and test admissibility by comparing path costs against a run with the zero heuristic.',
    benchmarking: 'Report nodes expanded as well as time, and state the heuristic and the tie-breaking rule, since both change the count by large factors. Compare path costs with those of an exact method on the same instances whenever a heuristic is not known to be admissible.',
    references: [
      { authors: 'P. E. Hart, N. J. Nilsson and B. Raphael', year: 1968, title: 'A formal basis for the heuristic determination of minimum cost paths', venue: 'IEEE Transactions on Systems Science and Cybernetics 4(2), 100-107' },
      { authors: 'I. Pohl', year: 1970, title: 'Heuristic search viewed as path finding in a graph', venue: 'Artificial Intelligence 1(3-4), 193-204' },
      { authors: 'R. Dechter and J. Pearl', year: 1985, title: 'Generalized best-first search strategies and the optimality of A*', venue: 'Journal of the ACM 32(3), 505-536' },
      { authors: 'R. E. Korf', year: 1985, title: 'Depth-first iterative-deepening: an optimal admissible tree search', venue: 'Artificial Intelligence 27(1), 97-109' },
      { authors: 'M. Likhachev, G. Gordon and S. Thrun', year: 2003, title: 'ARA*: Anytime A* with provable bounds on sub-optimality', venue: 'Advances in Neural Information Processing Systems 16' },
    ],
    furtherReading: [
      'S. Russell and P. Norvig, *Artificial Intelligence: A Modern Approach*, chapter on solving problems by searching, sections on informed search and heuristic functions.',
      'J. Pearl, *Heuristics: Intelligent Search Strategies for Computer Problem Solving* (Addison-Wesley, 1984).',
    ],
  },

  tests: [
    { name: 'Manhattan heuristic matches a breadth-first shortest length', input: { rows: 14, cols: 24, density: 0.28, seed: 5, toggles: [], heuristic: 'manhattan' },
      check: (r, c) => (optimal(r) === true && r.cost === 29 && c['nodes expanded'] === 94) || `${optimal(r)}; cost ${r.cost}, explored ${c['nodes expanded']}` },
    { name: 'zero heuristic matches a breadth-first shortest length', input: { rows: 14, cols: 24, density: 0.28, seed: 5, toggles: [], heuristic: 'zero' },
      check: (r, c) => (optimal(r) === true && r.cost === 29 && c['nodes expanded'] === 191) || `${optimal(r)}; cost ${r.cost}, explored ${c['nodes expanded']}` },
    { name: 'the doubled heuristic is faster, longer here, and within twice the optimum', input: { rows: 14, cols: 24, density: 0.28, seed: 5, toggles: [], heuristic: 'weighted' },
      check: (r, c) => (validPath(r) === true && r.cost === 31 && c['nodes expanded'] === 50 && r.cost <= 2 * bfsLength(r.grid)) || `cost ${r.cost}, explored ${c['nodes expanded']}` },
    { name: 'optimal on other grids with both admissible heuristics', input: { rows: 20, cols: 30, density: 0.3, seed: 9, toggles: [], heuristic: 'manhattan' }, check: optimal },
    { name: 'optimal on a dense grid with the zero heuristic', input: { rows: 16, cols: 28, density: 0.35, seed: 14, toggles: [], heuristic: 'zero' }, check: optimal },
    { name: 'the doubled heuristic stays within twice the optimum on another grid', input: { rows: 20, cols: 30, density: 0.3, seed: 9, toggles: [], heuristic: 'weighted' },
      check: (r) => (!r.found && bfsLength(r.grid) === Infinity) || (validPath(r) === true && r.cost <= 2 * bfsLength(r.grid)) || `cost ${r.cost} against optimum ${bfsLength(r.grid)}` },
    { name: 'the worked example: 6 cells explored on an open 6 by 8 grid', input: { rows: 6, cols: 8, density: 0, toggles: [], heuristic: 'manhattan' },
      check: (r, c) => (r.cost === 5 && c['nodes expanded'] === 6) || `cost ${r.cost}, explored ${c['nodes expanded']}` },
    { name: 'the predicted zero-heuristic run explores 31 cells', input: { rows: 6, cols: 8, density: 0, toggles: [], heuristic: 'zero' },
      check: (r, c) => (r.cost === 5 && c['nodes expanded'] === 31) || `cost ${r.cost}, explored ${c['nodes expanded']}` },
    { name: 'an unreachable goal is handled', input: { rows: 8, cols: 14, density: 0, seed: 5, toggles: [54, 82, 67, 69], heuristic: 'manhattan' },
      check: (r, c) => (!r.found && r.path.length === 0 && bfsLength(r.grid) === Infinity && c['nodes expanded'] === 8 * 14 - 5) || `found ${r.found}, explored ${c['nodes expanded']}` },
    { name: 'a random grid whose goal is cut off agrees with breadth-first search', input: { rows: 14, cols: 24, density: 0.28, seed: 1, toggles: [], heuristic: 'manhattan' },
      check: (r) => (!r.found && bfsLength(r.grid) === Infinity) || 'expected no path on this grid' },
  ],
};
