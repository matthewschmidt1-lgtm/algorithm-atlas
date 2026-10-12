// Small seeded two-dimensional datasets shared by the machine learning and neural network
// lessons, so that k-nearest neighbours, logistic regression, the perceptron and a small
// neural network can all be run on identical points.
//
// Every coordinate lies inside DATA_RANGE = [-1.5, 1.5] on both axes and is rounded to three
// decimals. The same arguments always give the same points (makeRng(seed), never Math.random).
//
// Exports
//
//   DATA_RANGE        [-1.5, 1.5], the plotting range of both axes for every dataset.
//   SEPARABLE_MARGIN, SEPARABLE_LINE   the guarantee of the 'separable' set, described below.
//
//   DATASETS          The four classification sets: [{ id, label, separable, about }].
//                     `separable` is true only for the set that is guaranteed to be linearly
//                     separable. The other three are built not to be, but a small sample can
//                     turn out separable by chance: use isLinearlySeparable to check one.
//   datasetById       The same records keyed by id.
//   datasetOptions    [{ value, label }] of the classification sets, for a select input.
//
//   makeDataset({ dataset, points, seed, ... })
//       -> { points: [{ x, y, label }], x: [min, max], y: [min, max] }
//     Classification sets (labels are 0 and 1, alternating, so the classes are balanced
//     and interleaved in visiting order):
//       'separable'   two blobs that a straight line separates. Guaranteed: every point is
//                     at least SEPARABLE_MARGIN (0.1) from the line SEPARABLE_LINE, which is
//                     0.768x + 0.640y = 0.3, with class 1 on the positive side. The line
//                     deliberately misses the origin, so a classifier has to learn a bias.
//       'overlap'     two wide blobs that run into each other. Usually no line separates them.
//       'moons'       two interleaved half-circles. Usually no line separates them.
//       'xor'         four blobs at the corners of a square, labelled 0 where x and y have the
//                     same sign and 1 where they differ. No line separates the four corners.
//     Other sets, reached through the same function:
//       'blobs'       k round clusters for clustering. Extra arguments: k (1 to 7, default 3)
//                     and spread (standard deviation, default 0.16). `label` is the cluster a
//                     point was drawn from (0 to k-1), and the result also carries
//                     `centers: [[x, y], ...]`, the true blob centres.
//       'line'        a noisy straight line for regression. Extra arguments: noise (standard
//                     deviation of the vertical scatter, default 0.2), slope (default 0.7) and
//                     intercept (default 0.1). x values are spread evenly with a little
//                     jitter, `label` is always 0, and the result also carries `slope` and
//                     `intercept`, the line the points were generated around.
//
//   makeBlobs({ k, points, seed, spread })           shorthand for dataset 'blobs'
//   makeLine({ points, noise, seed, slope, intercept })   shorthand for dataset 'line'
//
//   isLinearlySeparable(points)
//       -> true if some straight line has every label 0 point strictly on one side and every
//          label 1 point strictly on the other. An exact check of the given sample (up to
//          rounding), costing O(n³) for n points, so call it once per run, not per step.
//
//   CLASS_ROLES       ['forest', 'terracotta']: the colour roles for label 0 and label 1, so
//                     every classification lesson draws the two classes the same way.
//
//   probabilityHeat(predict, { cells, x, y, strength })
//       -> one `heat` scene layer that shades the plane by a classifier's output.
//     `predict(x, y)` returns a number from 0 to 1: a hard label, or the probability of
//     class 1. Territory where the output is 1 is tinted with the class 1 colour
//     (CLASS_ROLES[1]); where it is 0 the background is left clear, and values between
//     shade in proportion. The colour scale is fixed at 0 to 1 whatever values occur.
//     `cells` (default 30) is the grid size along each axis, x and y default to DATA_RANGE,
//     and `strength` (default 0.45) caps the depth of the tint so points stay readable on it.
//     Put the returned layer first in the scene's layer list, and say in the legend that
//     shading means class 1.

import { makeRng } from './rng.js';

export const DATA_RANGE = [-1.5, 1.5];
export const SEPARABLE_MARGIN = 0.1;
// { a, b, c }: the line a·x + b·y = c with (a, b) a unit vector.
export const SEPARABLE_LINE = { a: 0.6 / Math.hypot(0.6, 0.5), b: 0.5 / Math.hypot(0.6, 0.5), c: 0.3 };

const LIMIT = 1.45;
const round3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r; // never return negative zero
};
const clip = (v) => round3(Math.min(LIMIT, Math.max(-LIMIT, v)));

export const CLASS_ROLES = ['forest', 'terracotta'];

export const DATASETS = [
  { id: 'separable', label: 'Two separate groups', separable: true,
    about: 'Two compact groups with a clear gap between them. A straight line separates them.' },
  { id: 'overlap', label: 'Two overlapping groups', separable: false,
    about: 'Two wide groups that run into each other. Usually any straight line leaves some points on the wrong side.' },
  { id: 'moons', label: 'Two interleaved moons', separable: false,
    about: 'Two half-circles that hook into each other. The classes barely mix, but the boundary between them is curved.' },
  { id: 'xor', label: 'Four alternating corners (XOR)', separable: false,
    about: 'Four groups at the corners of a square, with opposite corners sharing a label. No straight line separates them.' },
];

export const datasetById = Object.fromEntries(DATASETS.map((d) => [d.id, d]));
export const datasetOptions = DATASETS.map((d) => ({ value: d.id, label: d.label }));

// Signed distance from the separating line of the 'separable' set (positive on the class 1 side).
const sepSide = (x, y) => SEPARABLE_LINE.a * x + SEPARABLE_LINE.b * y - SEPARABLE_LINE.c;

function classificationPoint(id, i, rng) {
  const label = i % 2;
  switch (id) {
    case 'separable': {
      // Blob centres sit 0.6 either side of the line, along its normal.
      const s = label ? 1 : -1;
      const cx = SEPARABLE_LINE.a * (SEPARABLE_LINE.c + 0.6 * s), cy = SEPARABLE_LINE.b * (SEPARABLE_LINE.c + 0.6 * s);
      for (;;) {
        const x = clip(rng.normal(cx, 0.3)), y = clip(rng.normal(cy, 0.3));
        if (sepSide(x, y) * s >= SEPARABLE_MARGIN) return { x, y, label };
      }
    }
    case 'overlap': {
      const s = label ? 1 : -1;
      return { x: clip(rng.normal(0.38 * s, 0.42)), y: clip(rng.normal(0.3 * s, 0.42)), label };
    }
    case 'moons': {
      const a = rng.float(0, Math.PI);
      const mx = label ? 1 - Math.cos(a) : Math.cos(a);
      const my = label ? 0.5 - Math.sin(a) : Math.sin(a);
      return { x: clip((mx - 0.5) * 0.85 + rng.normal(0, 0.07)), y: clip((my - 0.25) * 1.15 + rng.normal(0, 0.07)), label };
    }
    case 'xor': {
      const corner = i % 4; // 0: (+,+) label 0, 1: (-,+) label 1, 2: (-,-) label 0, 3: (+,-) label 1
      const sx = corner === 0 || corner === 3 ? 1 : -1;
      const sy = corner < 2 ? 1 : -1;
      return { x: clip(rng.normal(0.7 * sx, 0.2)), y: clip(rng.normal(0.7 * sy, 0.2)), label };
    }
    default:
      throw new Error(`Unknown dataset "${id}".`);
  }
}

export function makeBlobs({ k = 3, points = 60, seed = 1, spread = 0.16 } = {}) {
  const n = Math.max(1, Math.floor(points));
  const groups = Math.max(1, Math.min(7, Math.floor(k)));
  const rng = makeRng(seed * 7919 + 13);
  // Place the centres by rejection so that no two are close together; relax the gap if needed.
  const centers = [];
  let gap = 1.05, tries = 0;
  while (centers.length < groups) {
    const c = [rng.float(-1.0, 1.0), rng.float(-1.0, 1.0)];
    if (centers.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1]) >= gap)) centers.push([round3(c[0]), round3(c[1])]);
    else if (++tries % 40 === 0) gap *= 0.9;
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const label = i % groups;
    out.push({ x: clip(rng.normal(centers[label][0], spread)), y: clip(rng.normal(centers[label][1], spread)), label });
  }
  return { points: out, x: DATA_RANGE.slice(), y: DATA_RANGE.slice(), centers };
}

export function makeLine({ points = 30, noise = 0.2, seed = 1, slope = 0.7, intercept = 0.1 } = {}) {
  const n = Math.max(1, Math.floor(points));
  const rng = makeRng(seed * 104729 + 7);
  const out = [];
  for (let i = 0; i < n; i++) {
    const base = n === 1 ? 0 : -1.25 + (2.5 * i) / (n - 1);
    const x = clip(base + rng.float(-0.04, 0.04));
    const y = clip(slope * x + intercept + (noise > 0 ? rng.normal(0, noise) : 0));
    out.push({ x, y, label: 0 });
  }
  return { points: out, x: DATA_RANGE.slice(), y: DATA_RANGE.slice(), slope, intercept };
}

export function makeDataset({ dataset = 'separable', points = 40, seed = 1, ...rest } = {}) {
  if (dataset === 'blobs') return makeBlobs({ points, seed, ...rest });
  if (dataset === 'line') return makeLine({ points, seed, ...rest });
  if (!datasetById[dataset]) throw new Error(`Unknown dataset "${dataset}".`);
  const n = Math.max(1, Math.floor(points));
  const rng = makeRng(seed * 2654435 + DATASETS.findIndex((d) => d.id === dataset) + 1);
  const out = [];
  for (let i = 0; i < n; i++) out.push(classificationPoint(dataset, i, rng));
  return { points: out, x: DATA_RANGE.slice(), y: DATA_RANGE.slice() };
}

// One heat layer that shades the plane by a classifier's output in [0, 1]. The scene renderer
// stretches a heat layer between its own smallest and largest value, so a column of cells
// holding 0 and 1 is added outside the right edge of the range, where the scene clips it. That pins the colour scale to 0..1 for every frame, so a classifier that is
// unsure everywhere looks pale everywhere.
export function probabilityHeat(predict, { cells = 30, x = DATA_RANGE, y = DATA_RANGE, strength = 0.45 } = {}) {
  // Two extra columns: a copy of the last real column (cells are drawn half a pixel wide of
  // their slot, so this is what shows at the very edge), then the hidden 0 / 1 column.
  const nx = cells + 2, ny = cells;
  const cw = (x[1] - x[0]) / cells, ch = (y[1] - y[0]) / cells;
  const values = new Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const cy = y[0] + (j + 0.5) * ch;
    for (let i = 0; i < nx; i++) {
      const col = Math.min(i, cells - 1);
      values[j * nx + i] = i === cells + 1
        ? j % 2
        : strength * Math.min(1, Math.max(0, predict(x[0] + (col + 0.5) * cw, cy)));
    }
  }
  return { type: 'heat', nx, ny, values, x: [x[0], x[1] + 2 * cw], y: y.slice(), role: CLASS_ROLES[1] };
}

// Whether a straight line can strictly separate the label 0 points from the label 1 points.
// Two finite point sets are separable exactly when their convex hulls are disjoint, and then
// the direction joining the closest points of the two hulls separates them. Those closest
// points are either two input points of different classes, or an input point and an edge
// between two input points of the same class. So it is enough to try, for every pair of
// input points, the direction joining them and the direction perpendicular to it.
export function isLinearlySeparable(points) {
  const zero = points.filter((p) => p.label === 0), one = points.filter((p) => p.label !== 0);
  if (!zero.length || !one.length) return true;
  const EPS = 1e-9;
  const splits = (ux, uy) => {
    let zMin = Infinity, zMax = -Infinity, oMin = Infinity, oMax = -Infinity;
    for (const p of zero) { const v = ux * p.x + uy * p.y; if (v < zMin) zMin = v; if (v > zMax) zMax = v; }
    for (const p of one) { const v = ux * p.x + uy * p.y; if (v < oMin) oMin = v; if (v > oMax) oMax = v; }
    return zMax < oMin - EPS || oMax < zMin - EPS;
  };
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].x - points[i].x, dy = points[j].y - points[i].y;
      const len = Math.hypot(dx, dy);
      if (len < EPS) continue;
      if (splits(dx / len, dy / len) || splits(-dy / len, dx / len)) return true;
    }
  }
  return false;
}
