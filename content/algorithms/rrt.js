import { makeRng } from '../../js/lib/rng.js';

const SIZE = 10;                        // the world is the square from (0, 0) to (10, 10)
const START = [1, 1], GOAL = [9, 9];
const LAYOUTS = {
  walls: { label: 'Two walls', rects: [{ x: 3, y: 0, w: 0.4, h: 5.5 }, { x: 6.4, y: 4.5, w: 0.4, h: 5.5 }] },
  scattered: { label: 'Scattered boxes', rects: [
    { x: 2.2, y: 2.5, w: 1.4, h: 1.4 }, { x: 4.5, y: 0.8, w: 1.2, h: 2.2 }, { x: 4.2, y: 4.6, w: 1.6, h: 1.2 }, { x: 1.2, y: 6.2, w: 1.6, h: 1.3 },
    { x: 6.6, y: 2.6, w: 1.3, h: 1.6 }, { x: 6.8, y: 6.2, w: 1.2, h: 1.6 }, { x: 3.8, y: 7.4, w: 1.5, h: 1.2 }] },
  passage: { label: 'Narrow passage', rects: [{ x: 4.5, y: 0, w: 1, h: 4.75 }, { x: 4.5, y: 5.25, w: 1, h: 4.75 }] },
  open: { label: 'Open space', rects: [] },
  sealed: { label: 'Goal walled in (no path exists)', rects: [{ x: 7.6, y: 7.6, w: 2.4, h: 0.3 }, { x: 7.6, y: 7.6, w: 0.3, h: 2.4 }] },
};
const QUIET = { record: false, count() {}, frame() {} };
const f2 = (v) => v.toFixed(2);
const pt = (p) => `(${f2(p[0])}, ${f2(p[1])})`;
const dist = (ax, ay, bx, by) => Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));

// Does any part of the segment from A to B lie in the rectangle? (Slab test: clip the segment
// against the x-range and the y-range of the rectangle and see whether anything is left.)
function segmentHitsRect(ax, ay, bx, by, r) {
  let enter = 0, leave = 1;
  const dx = bx - ax, dy = by - ay;
  if (dx === 0) { if (ax < r.x || ax > r.x + r.w) return false; } else {
    const t1 = (r.x - ax) / dx, t2 = (r.x + r.w - ax) / dx;
    enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2));
    if (enter > leave) return false;
  }
  if (dy === 0) { if (ay < r.y || ay > r.y + r.h) return false; } else {
    const t1 = (r.y - ay) / dy, t2 = (r.y + r.h - ay) / dy;
    enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2));
    if (enter > leave) return false;
  }
  return true;
}
const pointInRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

function run(input, t) {
  const layout = LAYOUTS[input.layout];
  if (!layout) throw new Error('Unknown obstacle layout.');
  const rects = layout.rects;
  const step = Number(input.step);
  if (!(step > 0)) throw new Error('The step size must be positive.');
  const bias = Number(input.bias);
  if (!(bias >= 0 && bias <= 1)) throw new Error('The goal bias must be between 0 and 1.');
  const forced = Array.isArray(input.samples) && input.samples.length ? input.samples : null;   // tests only: targets given in advance
  const limit = forced ? forced.length : Math.floor(Number(input.maxIter));
  if (!(limit >= 1)) throw new Error('Allow at least one iteration.');
  const rng = makeRng(input.seed);
  const blocked = (ax, ay, bx, by) => { t.count('collision checks'); for (const r of rects) if (segmentHitsRect(ax, ay, bx, by, r)) return true; return false; };

  const nodes = [{ x: START[0], y: START[1], parent: -1 }];
  const edges = [];
  const log = [];
  let found = false, iterations = 0, rejected = 0;
  t.count('distance computations', 0);
  t.count('collision checks', 0);

  const legend = [
    { label: 'obstacle', role: 'wall' }, { label: 'tree', role: 'moss' }, { label: 'random target', role: 'ochre' },
    { label: 'nearest node', role: 'ink' }, { label: 'new branch', role: 'current' }, { label: 'rejected branch', role: 'rejected' },
    { label: 'goal, with a circle one step wide', role: 'goal' }, { label: 'path found', role: 'path' },
  ];
  // it: { target, near, new, ok } for the iteration being shown, or null. path: list of points at the end.
  const views = (it, path) => {
    const layers = rects.map((r) => ({ type: 'rect', x: r.x, y: r.y, w: r.w, h: r.h, role: 'wall' }));
    layers.push({ type: 'circle', c: GOAL, r: step, role: 'goal', alpha: 0.45, width: 1.2 });
    layers.push({ type: 'segments', segments: edges.slice(), role: 'moss', width: 1.5, alpha: path ? 0.55 : 1 });
    layers.push({ type: 'points', points: nodes.map((n) => [n.x, n.y]), role: 'moss', r: 2, alpha: path ? 0.55 : 1 });
    if (it) {
      layers.push({ type: 'segments', segments: [[it.near[0], it.near[1], it.target[0], it.target[1]]], role: 'ochre', width: 1, dash: [3, 5], alpha: 0.8 });
      layers.push({ type: 'points', points: [it.target], role: 'ochre', r: 5, hollow: true });
      layers.push({ type: 'segments', segments: [[it.near[0], it.near[1], it.new[0], it.new[1]]], role: it.ok ? 'current' : 'rejected', width: 2.6, dash: it.ok ? null : [4, 4] });
      layers.push({ type: 'points', points: [it.new], role: it.ok ? 'current' : 'rejected', r: 4.5 });
      layers.push({ type: 'points', points: [it.near], role: 'ink', r: 4, ring: true });
    }
    if (path && path.length) layers.push({ type: 'line', points: path, role: 'path', width: 3.5 });
    layers.push({ type: 'points', points: [{ x: START[0], y: START[1], label: 'start' }], role: 'start', r: 5.5 });
    layers.push({ type: 'points', points: [{ x: GOAL[0], y: GOAL[1], label: 'goal' }], role: 'goal', r: 5.5 });
    return [{ kind: 'scene', title: `${layout.label}: the tree after ${iterations} ${iterations === 1 ? 'iteration' : 'iterations'}`, x: [0, SIZE], y: [0, SIZE], equal: true, aspect: 0.72, axes: { xLabel: 'x', yLabel: 'y' }, layers, legend }];
  };

  t.frame(() => ({ line: [0, 1], note: `The robot starts at ${pt(START)} and must reach the goal at ${pt(GOAL)} without touching the dark obstacles. The tree begins as the start point alone. Each new branch will be at most ${step} long.`, views: views(null, null), vars: { nodes: 1, step } }));

  let goalIndex = -1;
  for (let i = 1; i <= limit && !found; i++) {
    iterations = i;
    t.count('iterations');
    let target, towardGoal = false;
    if (forced) target = forced[i - 1];
    else if (rng.next() < bias) { target = GOAL; towardGoal = true; } else target = [rng.float(0, SIZE), rng.float(0, SIZE)];

    let near = 0, best = Infinity;
    for (let k = 0; k < nodes.length; k++) {
      t.count('distance computations');
      const d = dist(nodes[k].x, nodes[k].y, target[0], target[1]);
      if (d < best) { best = d; near = k; }
    }
    const from = nodes[near];
    const fresh = best <= step ? [target[0], target[1]] : [from.x + ((target[0] - from.x) * step) / best, from.y + ((target[1] - from.y) * step) / best];
    const ok = best > 0 && !blocked(from.x, from.y, fresh[0], fresh[1]);
    const endFree = !rects.some((r) => pointInRect(fresh[0], fresh[1], r));
    let connected = false, gap = null;
    if (ok) {
      nodes.push({ x: fresh[0], y: fresh[1], parent: near });
      edges.push([from.x, from.y, fresh[0], fresh[1]]);
      const idx = nodes.length - 1;
      gap = dist(fresh[0], fresh[1], GOAL[0], GOAL[1]);
      if (gap === 0) { found = true; goalIndex = idx; connected = true; }
      else if (gap <= step && !blocked(fresh[0], fresh[1], GOAL[0], GOAL[1])) {
        nodes.push({ x: GOAL[0], y: GOAL[1], parent: idx });
        edges.push([fresh[0], fresh[1], GOAL[0], GOAL[1]]);
        found = true; goalIndex = nodes.length - 1; connected = true;
      }
    } else rejected++;
    if (log.length < 2000) log.push({ target: [target[0], target[1]], near: [from.x, from.y], new: fresh, ok, towardGoal });

    const count = nodes.length, nearPt = [from.x, from.y], d = best;
    t.frame(() => ({ line: !ok ? [3, 4, 5, 6] : connected ? [3, 4, 5, 7, 8, 9] : [3, 4, 5, 7],
      note: `Iteration ${i}. The target ${pt(target)} ${towardGoal ? 'is the goal itself, chosen by the goal bias' : 'is drawn at random'}. The nearest tree node is ${pt(nearPt)}, ${f2(d)} away. ${d <= step ? 'The target is within one step, so the branch goes all the way to it' : `A step of ${step} toward the target reaches ${pt(fresh)}`}. `
        + (!ok
          ? `That branch would pass through an obstacle${endFree ? ', although its end point lies in free space' : ''}, so it is **rejected** and the tree is unchanged.`
          : connected
            ? (gap === 0 ? 'The branch is clear and ends on the goal: **goal reached**.' : `The branch is clear, so it joins the tree. Its end is ${f2(gap)} from the goal, within one step, and the straight line to the goal is clear, so a final branch connects them: **goal reached**.`)
            : `The branch is clear, so it joins the tree, which now has ${count} nodes.`),
      views: views({ target: [target[0], target[1]], near: nearPt, new: fresh, ok }, null), vars: { nodes: count, rejected } }));
  }

  const path = [];
  if (found) for (let k = goalIndex; k !== -1; k = nodes[k].parent) path.unshift([nodes[k].x, nodes[k].y]);
  let pathLength = 0;
  for (let k = 1; k < path.length; k++) pathLength += dist(path[k - 1][0], path[k - 1][1], path[k][0], path[k][1]);
  const straight = dist(START[0], START[1], GOAL[0], GOAL[1]);
  t.frame(() => ({ line: found ? 10 : 11,
    note: found
      ? `The goal was reached after ${iterations} iterations. Following each node's parent back from the goal gives a path of ${path.length - 1} branches with total length ${f2(pathLength)}. A straight line from start to goal would be ${f2(straight)} long. The path is safe to follow but not the shortest: RRT stops at the first route it finds.`
      : `The planner stopped at its limit of ${limit} iterations without reaching the goal, and reports failure. That is all it can say. It cannot tell "no path exists" from "no path found yet": more iterations, or a different seed, might succeed, or the goal might be unreachable.`,
    views: views(null, path), vars: { nodes: nodes.length, rejected, ...(found ? { 'path length': f2(pathLength) } : {}) } }));

  return { found, path, pathLength, straight, iterations, rejected, nodes, edges, log, step, rects, start: START, goal: GOAL };
}

// Independent collision check for the tests: walk along the segment in tiny steps and test each point.
function crossesByWalking(ax, ay, bx, by, rects) {
  for (let s = 0; s <= 400; s++) {
    const x = ax + ((bx - ax) * s) / 400, y = ay + ((by - ay) * s) / 400;
    if (rects.some((r) => pointInRect(x, y, r))) return true;
  }
  return false;
}
function checkTree(r) {
  if (r.edges.length !== r.nodes.length - 1) return `${r.nodes.length} nodes but ${r.edges.length} edges`;
  for (let k = 1; k < r.nodes.length; k++) {
    const n = r.nodes[k], p = r.nodes[n.parent];
    if (!p || n.parent >= k) return `node ${k} has an invalid parent`;
    if (dist(p.x, p.y, n.x, n.y) > r.step + 1e-9) return `edge into node ${k} is longer than the step size`;
    if (crossesByWalking(p.x, p.y, n.x, n.y, r.rects)) return `edge into node ${k} passes through an obstacle`;
    if (n.x < 0 || n.x > SIZE || n.y < 0 || n.y > SIZE) return `node ${k} is outside the world`;
  }
  return true;
}
function checkPath(r) {
  if (!r.found) return 'no path was found';
  const p = r.path;
  if (p[0][0] !== r.start[0] || p[0][1] !== r.start[1]) return 'the path does not begin at the start';
  if (p[p.length - 1][0] !== r.goal[0] || p[p.length - 1][1] !== r.goal[1]) return 'the path does not end at the goal';
  for (let k = 1; k < p.length; k++) {
    if (dist(p[k - 1][0], p[k - 1][1], p[k][0], p[k][1]) > r.step + 1e-9) return `path step ${k} is longer than the step size`;
    if (crossesByWalking(p[k - 1][0], p[k - 1][1], p[k][0], p[k][1], r.rects)) return `path step ${k} passes through an obstacle`;
    if (!r.edges.some((e) => e[0] === p[k - 1][0] && e[1] === p[k - 1][1] && e[2] === p[k][0] && e[3] === p[k][1])) return `path step ${k} is not an edge of the tree`;
  }
  return r.pathLength >= r.straight - 1e-9 || 'the path is shorter than a straight line';
}

export default {
  meta: {
    id: 'rrt',
    name: 'Rapidly-Exploring Random Tree (RRT)',
    aliases: ['RRT', 'rapidly exploring random tree', 'sampling-based motion planning', 'random tree planner'],
    kind: 'algorithm',
    discipline: 'robotics',
    alsoIn: [
      { id: 'ai', why: 'It is a search method for planning problems whose states form a continuous space that cannot be listed or laid out as a grid.' },
      { id: 'computational-geometry', why: 'Its two inner operations are geometric: finding the nearest stored point to a query, and testing a segment against obstacles.' },
    ],
    subfield: 'Motion planning',
    family: 'Sampling-based planners',
    lab: 'robotics',
    year: 1998,
    authors: 'Steven M. LaValle',
    summary: 'Plans a collision-free path by growing a tree from the start toward random points, one short obstacle-checked branch at a time, until a branch reaches the goal.',
    difficulty: 'intermediate',
    order: 750,
    paradigms: ['randomized-sampling', 'graph-search'],
    randomized: true,
    approximate: true,
    time: { best: 'O(n log n) for n iterations with a spatial index', average: 'O(n²) for n iterations with a linear nearest-node scan', worst: 'No bound on the iterations needed', class: 'iterative' },
    space: { worst: 'O(n) tree nodes', class: 'linear' },
    tags: {
      problems: ['find a path around obstacles', 'robot motion planning', 'move a robot arm without collisions', 'plan a route in continuous space', 'path planning without a grid'],
      techniques: ['random sampling', 'nearest neighbour', 'collision checking', 'tree growth', 'goal bias'],
      applications: ['robotics', 'navigation', 'games', 'computer graphics', 'engineering design'],
    },
    prerequisites: ['bfs', 'concept:tree', 'concept:randomization', 'concept:configuration-space', 'concept:state-space'],
  },

  bigIdea: {
    simple: "A rapidly-exploring random tree, or RRT, finds a way for a robot to get from one place to another without bumping into things. It works a little like a plant growing through a garden full of rocks. The plant starts as a single shoot at the robot's starting point. Again and again, the planner picks a random spot somewhere on the map. It finds the part of the plant that is closest to that spot and grows a short new twig from there toward it. If the twig would poke through a rock, it is thrown away. Otherwise it stays. Random spots are scattered all over the map, so the plant is pulled outward in every direction and soon reaches into every open area. When a twig comes close enough to the goal, the planner follows the plant back from that twig to the root. That chain of twigs is a route the robot can follow. The route is usually crooked. It is the first one found, not the shortest.",
    what: 'RRT is a motion planning algorithm. It builds a tree of collision-free positions rooted at the start. Each iteration samples a random point in the space, finds the tree node nearest to it, and extends that node a short, fixed distance toward the sample. The new branch is kept only if the whole of it is free of obstacles. When a node lands within one step of the goal and can be joined to it, the path is read off by following parent links back to the start.',
    why: 'Planning on a grid works for a robot that is a point on a floor. A robot arm with six joints has a six-dimensional space of configurations, and a grid with 100 cells per joint would have a trillion cells. RRT never builds such a grid. It needs only two things from the world: a way to pick random configurations, and a test of whether a short motion collides. That makes it usable in high-dimensional spaces and with obstacles of any shape.',
    when: 'Use it for a single planning query in a continuous space, especially one with many dimensions or with awkward constraints on how the robot can move. For a small, low-dimensional map, a grid search with [A*](#/algorithm/a-star) is simpler and returns a shortest path on the grid. If path quality matters, use RRT* or smooth the result. If many queries will be made in the same environment, a roadmap built once is more economical.',
    interesting: 'The tree seems to know where the unexplored space is, although no step of the algorithm looks for it. The reason is geometric. A random sample is most likely to fall in a large empty region, and the node nearest to it is a node on the edge of the tree facing that region. So the nodes on the frontier are chosen for extension most often, and the tree is pulled toward whatever it has not yet reached.',
    where: 'RRT and its descendants are standard planners in robot software, used for robot arms, mobile robots, and self-driving vehicles. Related sampling-based planners are also used to animate characters and to study how molecules can move.',
    analogy: {
      title: 'Explorers and a dispatcher',
      text: "A team is exploring an unmapped island from a base camp. A dispatcher, who cannot see the terrain, keeps calling out random map coordinates. Each time, the camp nearest to those coordinates sends a scout a short walk in that direction. If the way is clear, the scout sets up a new camp there. If a cliff is in the way, the scout turns back. Now ask which camps answer most of the calls. While most of the island is unexplored, most coordinates fall far from every camp, and the camp nearest to a far-off point is one on the edge of the explored area. The edge camps do most of the sending, which is why the camps spread quickly across the whole island instead of crowding around the base.",
      limits: "Real scouts would learn from a cliff and walk around it. The algorithm learns nothing from a failed branch and may try the same wall many times. A real robot's position is often a list of joint angles and not a place on a map, and its obstacles in that space are invisible shapes known only through a yes-or-no collision test.",
    },
  },

  example: {
    setup: "A robot at (1, 1) must get around a wall. The wall is a thin vertical strip between x = 3 and x = 3.4, reaching from the bottom of the map up to y = 5.5. The tree starts as the single point (1, 1), and each new branch may be at most 1 long. Four random targets arrive in turn.",
    steps: [
      "The first target is (4, 5). The only point in the tree is (1, 1). The target is 3 across and 4 up from it, so it is 5 away. Go 1 of those 5 toward it: 0.6 across and 0.8 up, to (1.6, 1.8). Nothing is in the way, so add the branch.",
      "The next target is (1.6, 4.8). It is straight above (1.6, 1.8), 3 away, and farther than that from (1, 1). So the nearest tree point is (1.6, 1.8). Go 1 up, to (1.6, 2.8), and add the branch.",
      "The next target is (7.6, 2.8). The nearest tree point is (1.6, 2.8), which is 6 away. Go 1 toward the target, to (2.6, 2.8). That is still short of the wall, so add the branch.",
      "The next target is (8.6, 2.8). The nearest tree point is now (2.6, 2.8). Going 1 toward the target would reach (3.6, 2.8). That point is in open space, just beyond the wall. But the straight move from (2.6, 2.8) to (3.6, 2.8) passes through the wall between x = 3 and x = 3.4. The branch is rejected.",
    ],
    result: "After four targets the tree has four points and three branches. The fourth target shows why the whole branch must be checked and not only its end point. A planner that looked only at (3.6, 2.8) would have sent the robot through a wall. To get past, the tree must grow upward until it clears the top of the wall at y = 5.5.",
  },

  terms: [
    { term: "Motion planning", meaning: "Working out a sequence of movements that takes a robot from a start to a goal without hitting anything." },
    { term: "Configuration", meaning: "A complete description of how the robot is placed. For a point on a map it is two numbers. For an arm it is one angle per joint." },
    { term: "Free space", meaning: "All the configurations in which the robot touches no obstacle." },
    { term: "Tree", meaning: "A set of points joined by branches with no loops, so that each point has exactly one route back to the starting point, the root." },
    { term: "Node", meaning: "One point of the tree. Each node remembers its parent, the node it was grown from." },
    { term: "Collision check", meaning: "A test of whether a position, or a movement between two positions, touches an obstacle." },
    { term: "Step size", meaning: "The greatest length a new branch may have." },
    { term: "Goal bias", meaning: "The chance, at each iteration, that the target is the goal itself and not a random point." },
    { term: "Feasible path", meaning: "A path the robot can follow without collision. It need not be short." },
    { term: "Probabilistically complete", meaning: "If a path exists, the chance of finding it approaches certainty as the planner is given more and more iterations." },
  ],

  takeaway: "Grow a tree from the start by pulling its nearest point a short, obstacle-checked step toward one random spot after another, and it will spread through the open space until it touches the goal.",

  viz: {
    describe: 'A square map with dark rectangular obstacles, an ink dot for the start in the lower left and a brick dot for the goal in the upper right, ringed by a circle one step in radius. The tree is drawn in moss green. At each iteration a hollow ochre circle marks the random target, an ink ring marks the tree node nearest to it, and a short thick segment shows the attempted branch: terracotta if it is added, brick and dashed if it would hit an obstacle. When the goal is reached, the path from start to goal is drawn as a thick forest green line over the faded tree.',
    inputs: [
      { id: 'layout', type: 'select', label: 'Obstacles', options: Object.entries(LAYOUTS).map(([value, l]) => ({ value, label: l.label })), default: 'walls' },
      { id: 'step', type: 'range', label: 'Step size', min: 0.2, max: 2, step: 0.1, default: 0.8,
        help: 'The greatest length of a new branch. The world is 10 by 10.' },
      { id: 'bias', type: 'range', label: 'Goal bias', min: 0, max: 0.5, step: 0.05, default: 0.1,
        help: 'The chance that an iteration aims at the goal and not at a random point.' },
      { id: 'maxIter', type: 'range', label: 'Maximum iterations', min: 50, max: 1000, step: 50, default: 500 },
      { id: 'seed', type: 'seed', label: 'Random seed', default: 7 },
    ],
    presets: [
      { label: 'Two walls', values: { layout: 'walls', step: 0.8, bias: 0.1, maxIter: 500, seed: 7 } },
      { label: 'Scattered boxes', values: { layout: 'scattered', step: 0.8, bias: 0.1, maxIter: 500, seed: 7 } },
      { label: 'Narrow passage', values: { layout: 'passage', step: 0.8, bias: 0.1, maxIter: 1000, seed: 9 } },
      { label: 'Open space, no goal bias', values: { layout: 'open', step: 0.8, bias: 0, maxIter: 500, seed: 7 } },
      { label: 'Goal walled in', values: { layout: 'sealed', step: 0.8, bias: 0.1, maxIter: 300, seed: 7 } },
      { label: 'Heavy goal bias', values: { layout: 'walls', step: 0.8, bias: 0.5, maxIter: 500, seed: 7 } },
      { label: 'Small steps', values: { layout: 'walls', step: 0.3, bias: 0.1, maxIter: 1000, seed: 7 } },
      { label: 'Too few iterations', values: { layout: 'walls', step: 0.8, bias: 0.1, maxIter: 50, seed: 7 } },
    ],
    tryThis: [
      'Load "Two walls" and press Randomize on the seed several times. Every run finds a different path, and none of them is the shortest. Compare the reported path length with the straight-line distance.',
      'Load "Open space, no goal bias" and watch the early iterations. The tree sends long arms toward the corners before filling in. Then raise the goal bias to 0.3: with nothing in the way, the tree heads almost straight for the goal.',
      'Load "Two walls", note the number of iterations, then load "Heavy goal bias", which uses the same seed. Half of the iterations now pull the node nearest the goal straight toward it, into a wall, and are wasted. A little bias helps; a lot of it makes the planner stubborn.',
      'Load "Goal walled in". The tree fills everything it can reach and then stops at the iteration limit. Read the final note: the planner reports failure, and it has no way of knowing that the failure is permanent.',
      'Load "Narrow passage" and try several seeds. The tree fills the left half quickly and then waits for a lucky branch through the gap. Narrow passages are the classic weakness of sampling-based planners.',
    ],
    run,
    report: (r, c) => `${r.found ? `Path found after ${r.iterations} iterations: ${r.path.length - 1} branches, length ${f2(r.pathLength)} (straight line ${f2(r.straight)}).` : `No path found within ${r.iterations} iterations. This is not proof that none exists.`}\nTree: ${r.nodes.length} nodes. ${r.rejected} branches rejected for hitting obstacles.\n${c['distance computations'] || 0} distance computations, ${c['collision checks'] || 0} collision checks.`,
    experiment: {
      title: 'Nearest-node work as the tree grows',
      note: 'Each point is a real run in the "Goal walled in" world, where the planner can never finish early and so uses every iteration. The count is the number of distances computed while looking for the nearest node by scanning the whole tree. Each iteration scans a tree that is one node larger than before, so the total grows with the square of the number of iterations. The curve is n²/2 scaled to the last point. This is why practical planners keep the nodes in a spatial index.',
      metric: 'distance computations',
      metricLabel: 'Distance computations',
      sizeLabel: 'Iterations (n)',
      sizes: [50, 100, 200, 400, 800, 1600],
      variants: [{ id: 'scan', label: 'Linear scan for the nearest node' }],
      input: (n, variant, seed) => ({ layout: 'sealed', step: 0.8, bias: 0.1, maxIter: n, seed }),
      theory: [{ label: 'n² / 2 (scaled)', fn: (n) => (n * n) / 2, scaled: true }],
    },
  },

  logic: {
    intuition: 'Draw the tree so far, and around each node shade the part of the map that is closer to it than to any other node. Nodes deep inside the tree get small patches. Nodes on the outer edge get large ones, stretching out into the unexplored space. A random target lands in a patch with probability proportional to its area, and the node that owns the patch is the one that gets extended. So the tree grows mainly from its frontier, outward, without ever being told where the frontier is.',
    steps: [
      'Start a tree containing only the start configuration.',
      'Choose a target: with a small probability (the goal bias) take the goal itself, otherwise draw a point uniformly at random from the whole space.',
      'Find the node of the tree that is nearest to the target.',
      'Steer: compute the point reached by moving from that node toward the target by at most the step size.',
      'Check the entire segment from the node to the new point against every obstacle. If any part of it collides, discard it and go back to step 2.',
      'Otherwise add the new point to the tree, recording the nearest node as its parent.',
      'If the new point is within one step of the goal and the segment between them is free, add the goal as its child and stop. The path is found by following parents from the goal back to the start.',
      'If the iteration limit is reached first, report failure.',
    ],
    pseudocode: [
      'rrt(start, goal, step, bias, limit):',
      '  tree ← {start}',
      '  repeat limit times:',
      '    target ← goal (with chance bias) or a random point',
      '    near ← node of tree closest to target',
      '    new ← near moved toward target by at most step',
      '    if segment near→new hits an obstacle: continue',
      '    add new to tree with parent near',
      '    if new is within step of goal and new→goal is clear:',
      '      add goal with parent new',
      '      return the path from goal back to start',
      '  return failure',
    ],
    decisions: [
      { title: 'How large a step?', text: 'Large steps cross open space in few iterations but are rejected more often near obstacles and cannot thread narrow gaps. Small steps go anywhere but need many more nodes. A common choice is a few percent of the size of the space, adjusted to the clutter.' },
      { title: 'How much goal bias?', text: 'With no bias the tree reaches the goal only when it happens to grow near it. A bias of 5 to 10 percent directs some effort at the goal while keeping most of it on exploration. A large bias repeatedly drives the same node into whatever obstacle lies between it and the goal.' },
      { title: 'How to check a segment?', text: 'For a point robot among rectangles the segment can be tested exactly, as here. For real robots the usual method is to test intermediate configurations along the motion at a spacing fine enough that nothing can slip between them. Collision checking is normally where most of the running time goes.' },
      { title: 'How to find the nearest node?', text: 'A scan of all nodes is simple and is what this page does. Its cost grows with the tree, so serious implementations store the nodes in a k-d tree or a similar index.' },
    ],
    invariants: [
      'Every node of the tree is a collision-free configuration, and every edge is a collision-free motion no longer than the step size.',
      'The tree is connected and has no cycles: every node has exactly one path back to the start.',
      'Any path returned consists only of tree edges, so it is collision-free.',
    ],
    edgeCases: [
      'The goal is unreachable: the planner runs to its iteration limit and reports failure. It cannot prove that no path exists.',
      'The start or goal lies inside an obstacle: no valid plan exists, and a careful implementation checks this before planning.',
      'Narrow passages: the chance that a random branch enters a thin gap is small, so the number of iterations needed grows sharply as the gap narrows.',
      'A target that coincides with an existing node gives a branch of zero length, which should be skipped.',
      'A step size larger than the thickness of an obstacle: an end-point-only collision check would let branches jump straight through walls.',
      'Robots that cannot move in straight lines, such as cars: "move toward the target" must be replaced by a motion the robot can actually perform.',
    ],
    correctness: 'Two different properties are involved. Soundness is certain: every edge is collision-checked before it is added, so any path the algorithm returns is collision-free. Completeness is only probabilistic. If a path exists that keeps some clearance from the obstacles, the probability that the tree has not found one shrinks toward zero as the number of iterations grows. The argument covers such a path with a chain of small overlapping balls and shows that at every iteration there is a fixed positive chance of the tree advancing from one ball into the next. There is no guarantee for any fixed number of iterations, and no ability to detect that a problem has no solution. The path found is not optimal, and Karaman and Frazzoli proved that it does not become optimal however long the basic algorithm runs.',
    mistakes: [
      'Checking only the new point for collision and not the segment leading to it.',
      'Extending the tree from the most recently added node instead of from the node nearest to the target, which turns the search into a random walk.',
      'Sampling targets only near the tree, which destroys the pull toward unexplored space.',
      'Treating failure within the iteration limit as proof that no path exists.',
      'Sending the raw path to a robot without smoothing or shortening it.',
      'Forgetting to store parent links, so that the path cannot be recovered when the goal is reached.',
    ],
  },

  code: {
    sample: {
      input: 'A 10 by 10 world with one wall (x from 4 to 5, y from 0 to 7). Plan from (1, 1) to (9, 1) with step 1 and goal bias 0.1, using a small generator that behaves identically in every language (seed 2024).',
      expected: 'iterations: 89, tree nodes: 58\npath: 20 branches, length 18.97\nhighest point on the path: y = 7.63',
    },
    python: {
      source: `import math

WALL = (4.0, 0.0, 5.0, 7.0)   # one obstacle: x from 4 to 5, y from 0 to 7


class Lcg:
    """A small random number generator (Park-Miller). Integer arithmetic only,
    so it produces the same numbers in every language."""

    def __init__(self, seed):
        self.state = seed

    def uniform(self):
        self.state = self.state * 48271 % 2147483647
        return self.state / 2147483647


def hits_wall(a, b):
    """True if any part of the segment from a to b lies in the wall."""
    enter, leave = 0.0, 1.0
    for axis in (0, 1):
        low, high = WALL[axis], WALL[axis + 2]
        d = b[axis] - a[axis]
        if d == 0:
            if a[axis] < low or a[axis] > high:
                return False
        else:
            t1, t2 = (low - a[axis]) / d, (high - a[axis]) / d
            enter, leave = max(enter, min(t1, t2)), min(leave, max(t1, t2))
            if enter > leave:
                return False
    return True


def distance(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    return math.sqrt(dx * dx + dy * dy)


def rrt(start, goal, step, bias, limit, rng):
    nodes, parent = [start], [-1]
    for iteration in range(1, limit + 1):
        if rng.uniform() < bias:
            target = goal
        else:
            target = (10 * rng.uniform(), 10 * rng.uniform())
        near = min(range(len(nodes)), key=lambda i: distance(nodes[i], target))
        d = distance(nodes[near], target)
        new = target
        if d > step:                          # go only one step toward the target
            move_x = (target[0] - nodes[near][0]) * step / d
            move_y = (target[1] - nodes[near][1]) * step / d
            new = (nodes[near][0] + move_x, nodes[near][1] + move_y)
        if d == 0 or hits_wall(nodes[near], new):   # check the whole branch
            continue
        nodes.append(new)
        parent.append(near)
        if new != goal and distance(new, goal) <= step and not hits_wall(new, goal):
            nodes.append(goal)
            parent.append(len(nodes) - 2)
        if nodes[-1] == goal:
            path, k = [], len(nodes) - 1
            while k != -1:
                path.append(nodes[k])
                k = parent[k]
            return iteration, len(nodes), path[::-1]
    return limit, len(nodes), []


iterations, size, path = rrt((1.0, 1.0), (9.0, 1.0), 1.0, 0.1, 2000, Lcg(2024))
length = 0.0
for i in range(len(path) - 1):
    length += distance(path[i], path[i + 1])
print(f"iterations: {iterations}, tree nodes: {size}")
print(f"path: {len(path) - 1} branches, length {length:.2f}")
print("highest point on the path: y = " + f"{max(p[1] for p in path):.2f}")`,
      notes: [
        { line: 18, text: 'The collision test takes both ends of a branch. It clips the segment against the wall\'s range in x and then in y; if any part of the segment survives both, the branch touches the wall.' },
        { line: 48, text: 'The nearest node is found by scanning the whole tree. This line is the reason the running time grows with the square of the number of iterations.' },
        { line: 55, text: 'A branch that touches the wall anywhere along its length is discarded, and the loop moves on to a new random target.' },
        { line: 59, text: 'When a new node is within one step of the goal and the way is clear, the goal is attached and the search ends.' },
        { line: 64, text: 'The path is recovered by following parent links from the goal back to the start, then reversing.' },
      ],
    },
    javascript: {
      source: `const WALL = [4.0, 0.0, 5.0, 7.0];   // one obstacle: x from 4 to 5, y from 0 to 7

// A small random number generator (Park-Miller). Integer arithmetic only,
// so it produces the same numbers in every language.
class Lcg {
  constructor(seed) { this.state = seed; }
  uniform() {
    this.state = (this.state * 48271) % 2147483647;
    return this.state / 2147483647;
  }
}

// True if any part of the segment from a to b lies in the wall.
function hitsWall(a, b) {
  let enter = 0, leave = 1;
  for (const axis of [0, 1]) {
    const low = WALL[axis], high = WALL[axis + 2];
    const d = b[axis] - a[axis];
    if (d === 0) {
      if (a[axis] < low || a[axis] > high) return false;
    } else {
      const t1 = (low - a[axis]) / d, t2 = (high - a[axis]) / d;
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
      if (enter > leave) return false;
    }
  }
  return true;
}

function distance(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function rrt(start, goal, step, bias, limit, rng) {
  const nodes = [start], parent = [-1];
  for (let iteration = 1; iteration <= limit; iteration++) {
    const target = rng.uniform() < bias ? goal : [10 * rng.uniform(), 10 * rng.uniform()];
    let near = 0;
    for (let i = 1; i < nodes.length; i++) {
      if (distance(nodes[i], target) < distance(nodes[near], target)) near = i;
    }
    const d = distance(nodes[near], target);
    let fresh = target;
    if (d > step) {                           // go only one step toward the target
      const moveX = (target[0] - nodes[near][0]) * step / d;
      const moveY = (target[1] - nodes[near][1]) * step / d;
      fresh = [nodes[near][0] + moveX, nodes[near][1] + moveY];
    }
    if (d === 0 || hitsWall(nodes[near], fresh)) continue;   // check the whole branch
    nodes.push(fresh);
    parent.push(near);
    if (fresh !== goal && distance(fresh, goal) <= step && !hitsWall(fresh, goal)) {
      nodes.push(goal);
      parent.push(nodes.length - 2);
    }
    if (nodes[nodes.length - 1] === goal) {
      const path = [];
      for (let k = nodes.length - 1; k !== -1; k = parent[k]) path.unshift(nodes[k]);
      return [iteration, nodes.length, path];
    }
  }
  return [limit, nodes.length, []];
}

const [iterations, size, path] = rrt([1.0, 1.0], [9.0, 1.0], 1.0, 0.1, 2000, new Lcg(2024));
let length = 0;
for (let i = 0; i + 1 < path.length; i++) length += distance(path[i], path[i + 1]);
console.log("iterations: " + iterations + ", tree nodes: " + size);
console.log("path: " + (path.length - 1) + " branches, length " + length.toFixed(2));
console.log("highest point on the path: y = " + Math.max(...path.map((p) => p[1])).toFixed(2));`,
    },
    cpp: {
      source: `#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

struct Point { double x, y; };
const double WALL[4] = {4.0, 0.0, 5.0, 7.0};   // one obstacle: x from 4 to 5, y from 0 to 7

// A small random number generator (Park-Miller). Integer arithmetic only,
// so it produces the same numbers in every language.
struct Lcg {
    long long state;
    double uniform() {
        state = state * 48271 % 2147483647;
        return static_cast<double>(state) / 2147483647.0;
    }
};

// True if any part of the segment from a to b lies in the wall.
bool hits_wall(Point a, Point b) {
    double enter = 0.0, leave = 1.0;
    const double from[2] = {a.x, a.y}, to[2] = {b.x, b.y};
    for (int axis = 0; axis < 2; ++axis) {
        double low = WALL[axis], high = WALL[axis + 2];
        double d = to[axis] - from[axis];
        if (d == 0) {
            if (from[axis] < low || from[axis] > high) return false;
        } else {
            double t1 = (low - from[axis]) / d, t2 = (high - from[axis]) / d;
            enter = std::max(enter, std::min(t1, t2));
            leave = std::min(leave, std::max(t1, t2));
            if (enter > leave) return false;
        }
    }
    return true;
}

double distance(Point a, Point b) {
    double dx = b.x - a.x, dy = b.y - a.y;
    double xx = dx * dx, yy = dy * dy;
    return std::sqrt(xx + yy);
}

int main() {
    const Point start{1.0, 1.0}, goal{9.0, 1.0};
    const double step = 1.0, bias = 0.1;
    const int limit = 2000;
    Lcg rng{2024};
    std::vector<Point> nodes{start}, path;
    std::vector<int> parent{-1};
    int iterations = limit;
    for (int iteration = 1; iteration <= limit && path.empty(); ++iteration) {
        Point target = goal;
        bool aim_at_goal = rng.uniform() < bias;
        if (!aim_at_goal) { target.x = 10 * rng.uniform(); target.y = 10 * rng.uniform(); }
        int near = 0;
        for (int i = 1; i < static_cast<int>(nodes.size()); ++i) {
            if (distance(nodes[i], target) < distance(nodes[near], target)) near = i;
        }
        double d = distance(nodes[near], target);
        Point fresh = target;
        if (d > step) {                       // go only one step toward the target
            double move_x = (target.x - nodes[near].x) * step / d;
            double move_y = (target.y - nodes[near].y) * step / d;
            fresh = Point{nodes[near].x + move_x, nodes[near].y + move_y};
        }
        if (d == 0 || hits_wall(nodes[near], fresh)) continue;   // check the whole branch
        nodes.push_back(fresh);
        parent.push_back(near);
        bool at_goal = fresh.x == goal.x && fresh.y == goal.y;
        if (!at_goal && distance(fresh, goal) <= step && !hits_wall(fresh, goal)) {
            nodes.push_back(goal);
            parent.push_back(static_cast<int>(nodes.size()) - 2);
            at_goal = true;
        }
        if (at_goal) {
            for (int k = static_cast<int>(nodes.size()) - 1; k != -1; k = parent[k]) path.insert(path.begin(), nodes[k]);
            iterations = iteration;
        }
    }
    double length = 0.0, highest = 0.0;
    for (std::size_t i = 0; i + 1 < path.size(); ++i) length += distance(path[i], path[i + 1]);
    for (const Point& p : path) highest = std::max(highest, p.y);
    std::printf("iterations: %d, tree nodes: %d\\n", iterations, static_cast<int>(nodes.size()));
    std::printf("path: %d branches, length %.2f\\n", static_cast<int>(path.size()) - 1, length);
    std::printf("highest point on the path: y = %.2f\\n", highest);
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'Each iteration does one nearest-node query and one or two collision checks. With a plain scan the query costs time proportional to the size of the tree, so n iterations cost O(n²) distance computations, which the experiment on this page measures. A spatial index brings the query down to about O(log n) in low dimensions. The number of iterations needed is not bounded: it depends on the geometry of the free space, above all on its narrowest passage.',
    cases: [
      { case: 'n iterations, linear scan', time: 'O(n²) distance computations', when: 'The method on this page. Fine for a few thousand nodes.' },
      { case: 'n iterations, k-d tree', time: 'O(n log n) expected', when: 'Low to moderate dimensions. In high dimensions exact nearest-neighbour search loses its advantage and approximate methods are used.' },
      { case: 'Collision checking', time: 'O(n) checks, each as costly as the world is complex', when: 'One or two segment checks per iteration. For real robots this usually dominates the running time.' },
      { case: 'Iterations to find a path', time: 'No fixed bound', when: 'The probability of failure falls exponentially with the number of iterations when a path with clearance exists, but the rate depends on the problem and can be extremely slow.' },
    ],
    space: 'O(n) for the tree: one configuration and one parent link per node.',
    memory: 'The tree grows by at most one node per iteration, plus the goal. A planner that runs for a long time in a large space can accumulate millions of nodes, which is one reason to stop and restart, or to prune.',
    tradeoffs: 'RRT trades guarantees for reach. It gives up optimality and a definite answer about impossibility, and in exchange it handles spaces far too large for a grid. RRT* recovers optimality in the limit at the cost of extra nearest-neighbour and collision work per iteration.',
    assumptions: [
      'Distances and single collision checks are counted as unit operations; in practice a collision check costs far more than a distance.',
      'The k-d tree bound assumes a fixed, low dimension and reasonably spread points.',
      'Probabilistic completeness assumes a solution path with positive clearance from obstacles.',
      'The chart on this page counts distance computations in one two-dimensional world with a linear scan.',
    ],
  },

  tradeoffs: {
    excels: [
      'High-dimensional configuration spaces, such as arms with many joints.',
      'Obstacles of arbitrary shape, since only a collision test is needed.',
      'Single queries where any feasible path will do and speed matters.',
      'Robots with constraints on how they can move, by replacing the straight-line step with a simulated motion.',
    ],
    struggles: [
      'Narrow passages, which random branches rarely enter.',
      'Path quality: the raw result is jagged and longer than necessary.',
      'Problems with no solution, where it runs until stopped.',
      'Repeated queries in one environment, where the tree is built afresh each time.',
    ],
    misunderstandings: [
      "\"It finds the shortest path.\" It finds a path, usually a crooked one, and stops. Letting the basic algorithm run longer does not straighten it. Shorter paths need extra steps such as smoothing, or a variant such as RRT*.",
      "\"If it reports failure, no path exists.\" Failure means only that the iteration limit ran out. The same problem may succeed with more iterations or another seed, or it may truly be impossible. The algorithm cannot tell which.",
      "\"Random growth means it wanders aimlessly.\" The targets are random, but the tree always extends the node nearest to the target. That rule pulls the tree toward the largest unexplored regions, which is very different from a random walk.",
      "\"Checking the new point for collision is enough.\" A branch can start and end in free space and still pass through a thin obstacle in between. The whole motion has to be checked.",
    ],
    pitfalls: [
      'A collision check along the segment that is too coarse, so thin obstacles slip between the tested points.',
      'A distance measure that does not reflect how hard it is for the robot to move between two configurations, for instance mixing metres and radians without scaling.',
      'Planning for a point when the robot has a body: obstacles must be enlarged by the robot\'s size, or the collision test must use its real shape.',
    ],
    constraints: [
      'Paths are post-processed before execution: shortcut, smoothed, and given timing that respects speed and acceleration limits.',
      'Real-time systems replan continually as sensors update the map, so the time available per plan is fixed and short.',
    ],
    alternatives: [
      { id: 'a-star', name: 'A* Search', when: 'The space is small enough to grid. It returns a shortest path on the grid and can report that none exists.' },
      { id: 'dijkstra', name: 'Dijkstra\'s Algorithm', when: 'A graph of the free space already exists, such as a roadmap, and shortest paths from one point are wanted.' },
      { name: 'RRT*', when: 'Path length matters. It rewires the tree as it grows so that the path improves toward the optimum.' },
      { name: 'RRT-Connect', when: 'Speed matters. It grows two trees, from start and goal, and tries to join them.' },
      { name: 'Probabilistic roadmap (PRM)', when: 'Many queries will be made in the same static environment. The sampling work is done once and reused.' },
    ],
    comparison: {
      columns: ['', 'RRT', 'A* on a grid', 'RRT*'],
      rows: [
        ['Space', 'Continuous, any dimension', 'Discretized, low dimension', 'Continuous, any dimension'],
        ['Path quality', 'Feasible, not optimal', 'Optimal on the grid', 'Approaches optimal with more iterations'],
        ['If no path exists', 'Runs to its limit', 'Reports that none exists', 'Runs to its limit'],
        ['Work per iteration', 'One nearest-node query, one collision check', 'One node expansion', 'Several neighbour queries and collision checks'],
      ],
    },
  },

  applications: [
    { title: 'Robot arm motion planning', status: 'established', text: 'Open-source planning libraries used across robotics, such as OMPL and the MoveIt framework built on it, provide RRT, RRT-Connect and RRT* as standard planners for manipulators with many joints.' },
    { title: 'Autonomous driving', status: 'established', text: 'MIT\'s entry in the 2007 DARPA Urban Challenge planned its trajectories with a variant of RRT that grows the tree by simulating the vehicle under its own controller, so every branch is a motion the car can actually perform.' },
    { title: 'Character animation', status: 'illustrative', text: 'An animated figure reaching through clutter poses the same problem as a robot arm: find a collision-free motion in a space of many joint angles. Sampling-based planners can generate such motions automatically.' },
    { title: 'Molecular motion', status: 'illustrative', text: 'A flexible molecule can be treated as a linkage with many joints, and the question of whether a small molecule can find its way out of a protein\'s pocket can be explored with the same kind of tree.' },
  ],

  connections: [
    { to: 'a-star', type: 'same-problem', why: 'Both search for a path from start to goal. A* expands a given graph in order of estimated total cost and returns an optimal path; RRT builds its own graph by sampling and returns the first feasible path.' },
    { to: 'dijkstra', type: 'same-problem', why: 'Both grow a tree outward from the start with parent links that encode paths. Dijkstra grows it in order of distance over a fixed graph and guarantees shortest paths; RRT grows it toward random samples in continuous space.' },
    { to: 'bfs', type: 'prerequisite', why: 'Breadth-first search introduces the idea of exploring from a start, recording each new state\'s parent, and reading the path back from the goal. RRT keeps that structure and replaces the queue with random sampling.' },
    { to: 'monte-carlo', type: 'related', why: 'Both use random samples of a space in place of a grid, because the number of grid cells grows exponentially with the dimension while the usefulness of a random sample does not.' },
    { to: 'simulated-annealing', type: 'related', why: 'Both rely on randomness to get past obstacles that defeat a greedy approach: annealing accepts worse moves to leave local minima, and RRT samples everywhere so that it is not stuck pushing straight at the goal.' },
    { to: 'kalman-filter', type: 'related', why: 'Planning assumes the robot knows where it is. On a real robot that knowledge comes from a state estimator, and the plan is revised as the estimate changes.' },
    { to: 'knn', type: 'related', why: 'Both depend on nearest-neighbour queries among stored points, and both are sped up by the same spatial data structures.' },
    { to: 'concept:configuration-space', type: 'prerequisite', why: 'The tree lives in configuration space, where the whole robot is a single point and obstacles become forbidden regions.' },
    { to: 'concept:randomization', type: 'prerequisite', why: 'Random targets are what spread the tree evenly without any map of where free space lies.' },
    { to: 'concept:tree', type: 'prerequisite', why: 'Each node has exactly one parent, so the path to any node is unique and is recovered by walking up the parent links.' },
    { to: 'discipline:ai', type: 'application', why: 'Sampling-based planning extends state-space search to continuous spaces that cannot be enumerated.' },
    { to: 'discipline:computational-geometry', type: 'application', why: 'Nearest-neighbour search and segment-obstacle intersection are core geometric queries.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why does an RRT spread into unexplored areas so quickly, when its targets are chosen completely at random?',
      options: ['It remembers which areas it has visited and avoids them', 'Nodes on the edge of the tree are nearest to the largest empty regions, so they are extended most often', 'It always extends the newest node', 'Random targets are chosen far from the tree on purpose'],
      answer: 1,
      explain: [
        'The algorithm keeps no record of visited areas. Only the tree itself is stored.',
        'Correct. A uniform random target most often falls in a big empty region, and the nearest node to it is a frontier node facing that region. The bias toward exploration comes from the nearest-node rule.',
        'Extending the newest node would give a random walk, which explores far more slowly.',
        'Targets are uniform over the whole space. The outward pull comes from which node responds, not from where targets fall.',
      ],
    },
    {
      type: 'predict',
      q: 'The goal is completely enclosed by walls. The planner is given 300 iterations. What does it report?',
      options: ['A path that passes through the thinnest wall', 'That no path exists', 'Failure after 300 iterations, with no conclusion about whether a path exists', 'A path to the point nearest the goal'],
      answer: 2,
      explain: [
        'Every branch is checked along its whole length, so no branch can pass through a wall, however thin.',
        'The algorithm has no way of establishing that. It can only run out of iterations.',
        'Correct. The tree fills the reachable area and the limit is reached. The honest report is "not found within the limit".',
        'This implementation returns a path only when the goal itself is connected. Returning the nearest node is a possible extension, but it is not a solution.',
      ],
      tryInput: { layout: 'sealed', step: 0.8, bias: 0.1, maxIter: 300, seed: 7 },
    },
    {
      type: 'debug',
      q: 'A planner built on this loop sometimes returns paths that cut straight through thin walls. What is wrong?',
      code: `new = steer(nodes[near], target, step)
if point_in_obstacle(new):
    continue
nodes.append(new)
parent.append(near)`,
      options: ['The step size is too small', 'Only the end point of the branch is tested, not the segment from the nearest node to it', 'It should test the target, not the new point', 'The nearest node should be removed after use'],
      answer: 1,
      explain: [
        'A smaller step makes jumping a wall less likely. The bug appears when the step is larger than the wall is thick.',
        'Correct. Both ends can lie in free space while the segment between them crosses an obstacle. The test must cover the whole motion.',
        'The target may well lie inside an obstacle. That is harmless, because the tree only moves toward it.',
        'Nodes stay in the tree and can be extended many times.',
      ],
    },
    {
      type: 'choice',
      q: 'An RRT has found a path of length 18 where the shortest possible is 12. If the basic algorithm is simply run for more iterations, what happens to the path from start to goal in the tree?',
      options: ['It gradually shortens toward 12', 'It stays the same, because existing branches are never changed', 'It gets longer', 'It is replaced by a random new path'],
      answer: 1,
      explain: [
        'That is the behaviour of RRT*, which rewires the tree when a cheaper connection appears. The basic algorithm never does.',
        'Correct. Each node keeps the parent it was given. New nodes extend the tree but never alter the route to an existing node.',
        'Existing edges are not modified, so the path to the goal cannot change in either direction.',
        'Nothing is ever removed from the tree.',
      ],
    },
    {
      type: 'challenge',
      title: 'Shorten the path, then grow two trees',
      prompt: 'First add shortcutting: repeatedly pick two random points on the returned path, and if the straight segment between them is collision-free, replace the part of the path between them with that segment. Measure how much shorter the "Two walls" path becomes after 200 attempts. Then implement RRT-Connect: grow one tree from the start and one from the goal, and after each extension let the other tree try to grow all the way to the new node. Compare the number of iterations with plain RRT over 50 seeds.',
      hints: ['Shortcutting needs only the segment collision test you already have.', 'In RRT-Connect the "connect" move repeats the extend step toward the same target until it reaches it or hits an obstacle.'],
    },
  ],

  compare: {
    idea: 'Grow a tree by extending the node nearest to a random sample a short, collision-checked step toward it.',
    requires: 'A way to pick random positions, a way to measure distance, and a test for hitting an obstacle. It returns a workable route, not the shortest.',
    sensitivity: 'Sensitive to the step size, the goal bias, and above all to narrow passages in the free space. Results differ from seed to seed.',
    memory: 'O(n) nodes after n iterations.',
    difficulty: 'moderate',
    difficultyNote: 'The loop is short. Correct collision checking along a whole motion and fast nearest-node search are where the work lies.',
    limits: 'The route is not the shortest. It cannot prove that no route exists. It is slow to find its way through narrow gaps.',
    useWhen: 'The space to move through is continuous or has many joints, and any route that hits nothing, found quickly, is good enough.',
  },

  advanced: {
    history: 'Steven LaValle introduced the rapidly-exploring random tree in a 1998 technical report at Iowa State University, as a way to plan for systems with constraints on their motion. With James Kuffner he developed it further, including the two-tree RRT-Connect planner in 2000 and an analysis of its probabilistic completeness. The method followed the probabilistic roadmap planners of the mid-1990s, which had shown that random sampling could handle configuration spaces beyond the reach of grids. In 2011 Sertac Karaman and Emilio Frazzoli proved that the path found by RRT almost surely does not converge to an optimal one, and introduced RRT*, which does.',
    derivation: 'Why the tree explores. Let the tree have nodes $q_1, \\dots, q_n$ and let $V_i$ be the Voronoi region of $q_i$: the set of points of the space closer to $q_i$ than to any other node. A target drawn uniformly from a space of volume $|X|$ selects node $q_i$ for extension with probability\n\n$$P(\\text{extend } q_i) = \\frac{|V_i|}{|X|}.$$\n\nNodes surrounded by other nodes have small Voronoi regions. Nodes on the boundary of the explored area have regions that include all the unexplored space on their side. Extension is therefore concentrated on the frontier, and each successful extension splits a large region into smaller ones. LaValle called this the Voronoi bias. In the long run the distribution of tree nodes approaches the sampling distribution.',
    proof: 'A sketch of probabilistic completeness. Suppose a path from start to goal exists whose every point is at distance at least $\\delta > 0$ from the obstacles. Cover it with a sequence of balls $B_0, B_1, \\dots, B_m$ of radius proportional to $\\min(\\delta, \\text{step})$, centred on points of the path, so that consecutive centres are close together. Suppose the tree already has a node in $B_k$. If the next uniform sample lands in a suitable part of $B_{k+1}$, then the node nearest to the sample lies near $B_k$ and the straight segment to the new node stays within the clearance of the path, so it is collision-free and the tree gains a node in $B_{k+1}$. The sample lands there with some probability $p > 0$ that depends only on the radius. Reaching the goal therefore needs $m$ such successes, and the chance of fewer than $m$ successes in $n$ independent trials with success probability $p$ falls exponentially in $n$ for fixed $m$ and $p$. The constants can be very unfavourable when $\\delta$ is small, which is the narrow-passage problem in precise form.',
    complexityProof: 'With a linear scan, iteration $i$ computes at most $i$ distances, since the tree has at most $i$ nodes before it. Over $n$ iterations that is at most $\\sum_{i=1}^{n} i = n(n+1)/2$ distances, and it is close to that when most branches are accepted. The collision work is at most two segment checks per iteration.',
    variants: [
      { name: 'RRT-Connect', text: 'Grows trees from both start and goal and greedily extends each toward the other\'s newest node. Much faster in practice for many problems.' },
      { name: 'RRT*', text: 'Chooses the parent of each new node to minimize path cost among nearby nodes, and rewires those neighbours through the new node when that is cheaper. Asymptotically optimal.' },
      { name: 'Informed RRT*', text: 'Once a path is known, samples only from the region that could contain a shorter one, which speeds up convergence.' },
      { name: 'Kinodynamic RRT', text: 'Extends by simulating the robot\'s dynamics under a chosen control for a short time, so that every branch respects limits on velocity and acceleration.' },
      { name: 'Probabilistic roadmaps', text: 'Sample many configurations first and connect neighbours into a graph that can answer many queries.' },
    ],
    implementation: 'Store nodes in a k-d tree or use a library for nearest-neighbour search. Make the collision check conservative and test it separately. Scale the dimensions of the configuration so that the distance is meaningful. Limit planning by time as well as by iterations, and always post-process the path. For reproducible debugging, log the seed.',
    benchmarking: 'Because the algorithm is randomized, report distributions over many seeds: success rate within a time limit, median planning time, and path length. Use standard environments that include a narrow passage, and compare planners with the same collision checker.',
    references: [
      { authors: 'S. M. LaValle', year: 1998, title: 'Rapidly-exploring random trees: a new tool for path planning', venue: 'Technical Report TR 98-11, Computer Science Department, Iowa State University' },
      { authors: 'S. M. LaValle and J. J. Kuffner', year: 2001, title: 'Randomized kinodynamic planning', venue: 'The International Journal of Robotics Research 20(5), 378-400' },
      { authors: 'J. J. Kuffner and S. M. LaValle', year: 2000, title: 'RRT-Connect: an efficient approach to single-query path planning', venue: 'Proceedings of the IEEE International Conference on Robotics and Automation (ICRA)' },
      { authors: 'S. Karaman and E. Frazzoli', year: 2011, title: 'Sampling-based algorithms for optimal motion planning', venue: 'The International Journal of Robotics Research 30(7), 846-894' },
      { authors: 'L. E. Kavraki, P. Svestka, J.-C. Latombe and M. H. Overmars', year: 1996, title: 'Probabilistic roadmaps for path planning in high-dimensional configuration spaces', venue: 'IEEE Transactions on Robotics and Automation 12(4), 566-580' },
    ],
    furtherReading: [
      'S. M. LaValle, *Planning Algorithms* (Cambridge University Press, 2006), chapter 5, "Sampling-based motion planning". The author makes the book available online.',
      'Y. Kuwata, J. Teo, G. Fiore, S. Karaman, E. Frazzoli and J. P. How, "Real-time motion planning with applications to autonomous urban driving", *IEEE Transactions on Control Systems Technology* 17(5), 1105-1118 (2009).',
    ],
  },

  tests: [
    { name: 'default run: every tree edge is collision-free and within the step size, and the path is valid', input: { layout: 'walls', step: 0.8, bias: 0.1, maxIter: 500, seed: 7 },
      check: (r, c) => {
        const tree = checkTree(r);
        if (tree !== true) return tree;
        const path = checkPath(r);
        if (path !== true) return path;
        return (r.iterations === c.iterations && r.pathLength > 1.2 * r.straight) || `iterations ${r.iterations}, path length ${r.pathLength}`;
      } },
    { name: 'trees and paths are valid on every layout, over 15 seeds each, with large and small steps', input: { layout: 'scattered', step: 0.8, bias: 0.1, maxIter: 500, seed: 7 },
      check: () => {
        for (const layout of Object.keys(LAYOUTS)) for (const step of [0.4, 1.5]) for (let seed = 1; seed <= 15; seed++) {
          const r = run({ layout, step, bias: 0.1, maxIter: 400, seed }, QUIET);
          const tree = checkTree(r);
          if (tree !== true) return `${layout}, step ${step}, seed ${seed}: ${tree}`;
          if (r.found) { const path = checkPath(r); if (path !== true) return `${layout}, step ${step}, seed ${seed}: ${path}`; }
          else if (r.path.length !== 0 || r.iterations !== 400) return `${layout}, seed ${seed}: failure was not reported cleanly`;
        }
        return true;
      } },
    { name: 'the segment test never misses a crossing that walking along the segment finds', input: { layout: 'walls', step: 0.8, bias: 0.1, maxIter: 50, seed: 1 },
      check: () => {
        const box = { x: 4, y: 4, w: 2, h: 2 };
        if (!segmentHitsRect(3, 5, 7, 5, box)) return 'a segment straight through a box was not detected';
        if (!segmentHitsRect(3.5, 5.5, 5.5, 3.5, box) || !segmentHitsRect(5, 5, 5.5, 5.5, box)) return 'a corner cut or an inside segment was not detected';
        if (segmentHitsRect(3, 3, 7, 3, box) || segmentHitsRect(3, 3, 3, 7, box) || segmentHitsRect(1, 6.5, 3.4, 4.1, box)) return 'a clear segment was reported as a collision';
        const rng = makeRng(99);
        let extra = 0;
        for (const layout of Object.values(LAYOUTS)) for (let k = 0; k < 1500; k++) {
          const ax = rng.float(0, SIZE), ay = rng.float(0, SIZE), bx = ax + rng.float(-1.5, 1.5), by = ay + rng.float(-1.5, 1.5);
          const exact = layout.rects.some((q) => segmentHitsRect(ax, ay, bx, by, q)), walked = crossesByWalking(ax, ay, bx, by, layout.rects);
          if (walked && !exact) return `missed a collision on the segment (${ax}, ${ay}) to (${bx}, ${by})`;
          if (exact && !walked) extra++;
        }
        return extra <= 15 || `${extra} segments were reported as collisions that walking did not confirm`;
      } },
    { name: 'the worked example: three branches added, the fourth rejected although its end point is free', input: { layout: 'walls', step: 1, bias: 0, maxIter: 50, seed: 1, samples: [[4, 5], [1.6, 4.8], [7.6, 2.8], [8.6, 2.8]] },
      check: (r) => {
        const want = [[1, 1], [1.6, 1.8], [1.6, 2.8], [2.6, 2.8]];
        if (r.nodes.length !== 4 || r.found || r.iterations !== 4 || r.rejected !== 1) return `nodes ${r.nodes.length}, rejected ${r.rejected}`;
        for (const [k, [x, y]] of want.entries()) if (Math.abs(r.nodes[k].x - x) > 1e-9 || Math.abs(r.nodes[k].y - y) > 1e-9) return `node ${k} is (${r.nodes[k].x}, ${r.nodes[k].y})`;
        if (r.nodes[1].parent !== 0 || r.nodes[2].parent !== 1 || r.nodes[3].parent !== 2) return 'wrong parents';
        const last = r.log[3];
        const wall = r.rects[0];
        const endFree = !r.rects.some((q) => pointInRect(last.new[0], last.new[1], q));
        return (wall.x === 3 && wall.w === 0.4 && wall.h === 5.5 && !last.ok && Math.abs(last.new[0] - 3.6) < 1e-9 && Math.abs(last.new[1] - 2.8) < 1e-9 && Math.abs(last.near[0] - 2.6) < 1e-9 && endFree) || `fourth branch: ${JSON.stringify(last)}`;
      } },
    { name: 'quiz: a walled-in goal gives an honest failure after exactly 300 iterations', input: { layout: 'sealed', step: 0.8, bias: 0.1, maxIter: 300, seed: 7 },
      check: (r, c) => {
        if (r.found || r.path.length !== 0 || r.iterations !== 300 || c.iterations !== 300) return `found ${r.found}, iterations ${r.iterations}`;
        if (r.nodes.some((n) => n.x > 7.9 && n.y > 7.9)) return 'a node got inside the sealed room';
        return checkTree(r);
      } },
    { name: 'preset: 50 iterations are too few for the two walls, and failure is reported', input: { layout: 'walls', step: 0.8, bias: 0.1, maxIter: 50, seed: 7 },
      check: (r) => (!r.found && r.path.length === 0 && r.iterations === 50) || `found ${r.found} after ${r.iterations}` },
    { name: 'more iterations succeed more often in the narrow passage (40 seeds)', input: { layout: 'passage', step: 0.8, bias: 0.1, maxIter: 1000, seed: 9 },
      check: (r) => {
        let early = 0, late = 0;
        for (let seed = 1; seed <= 40; seed++) {
          const long = run({ layout: 'passage', step: 0.8, bias: 0.1, maxIter: 1000, seed }, QUIET);
          const short = run({ layout: 'passage', step: 0.8, bias: 0.1, maxIter: 100, seed }, QUIET);
          if (short.found && (!long.found || long.iterations !== short.iterations)) return `seed ${seed}: the longer run disagrees with the shorter one`;
          if (short.found) early++;
          if (long.found) late++;
        }
        return (r.found && late > early && late >= 28) || `${early} of 40 within 100 iterations, ${late} of 40 within 1000`;
      } },
    { name: 'preset: with seed 7, a goal bias of 0.5 needs more iterations than 0.1 on the two walls', input: { layout: 'walls', step: 0.8, bias: 0.5, maxIter: 500, seed: 7 },
      check: (r) => {
        const mild = run({ layout: 'walls', step: 0.8, bias: 0.1, maxIter: 500, seed: 7 }, QUIET);
        return (mild.found && r.found && r.iterations > 2 * mild.iterations) || `bias 0.5: ${r.iterations}, bias 0.1: ${mild.iterations}`;
      } },
    { name: 'the same seed gives the same tree, and the open world is solved', input: { layout: 'open', step: 0.8, bias: 0, maxIter: 500, seed: 7 },
      check: (r) => {
        const again = run({ layout: 'open', step: 0.8, bias: 0, maxIter: 500, seed: 7 }, QUIET);
        if (again.nodes.length !== r.nodes.length || again.pathLength !== r.pathLength) return 'two runs with the same seed differ';
        return checkPath(r);
      } },
  ],
};
