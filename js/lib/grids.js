import { makeRng } from './rng.js';

// Standard input fields for grid-world algorithms (spread into viz.inputs).
// `toggles` is edited by clicking cells in the visualization; each listed cell flips wall/open.
export function gridInputs({ rows = 14, cols = 24, density = 0.28 } = {}) {
  return [
    { id: 'rows', type: 'range', label: 'Rows', min: 6, max: 24, step: 1, default: rows },
    { id: 'cols', type: 'range', label: 'Columns', min: 8, max: 40, step: 1, default: cols },
    { id: 'density', type: 'range', label: 'Wall density', min: 0, max: 0.45, step: 0.01, default: density },
    { id: 'seed', type: 'seed', label: 'Random seed', default: 5 },
    { id: 'toggles', type: 'cells', label: 'Edited cells', default: [],
      help: 'Click or tap any cell in the picture to add or remove a wall.' },
  ];
}

// Returns { rows, cols, walls: Uint8Array, start, goal }. Start is left-middle, goal right-middle.
export function makeGrid({ rows = 14, cols = 24, density = 0.28, seed = 5, toggles = [] } = {}) {
  const rng = makeRng(seed * 104729 + rows * 131 + cols);
  const walls = new Uint8Array(rows * cols);
  for (let i = 0; i < walls.length; i++) walls[i] = rng.next() < density ? 1 : 0;
  const start = Math.floor(rows / 2) * cols + 1;
  const goal = Math.floor(rows / 2) * cols + (cols - 2);
  for (const k of toggles) if (k >= 0 && k < walls.length) walls[k] = walls[k] ? 0 : 1;
  walls[start] = 0;
  walls[goal] = 0;
  return { rows, cols, walls, start, goal };
}

export function neighbors4(grid, idx) {
  const { rows, cols, walls } = grid;
  const r = Math.floor(idx / cols), c = idx % cols;
  const out = [];
  if (r > 0 && !walls[idx - cols]) out.push(idx - cols);
  if (c < cols - 1 && !walls[idx + 1]) out.push(idx + 1);
  if (r < rows - 1 && !walls[idx + cols]) out.push(idx + cols);
  if (c > 0 && !walls[idx - 1]) out.push(idx - 1);
  return out;
}

export const manhattan = (grid, a, b) =>
  Math.abs(Math.floor(a / grid.cols) - Math.floor(b / grid.cols)) + Math.abs((a % grid.cols) - (b % grid.cols));

// Build a `grid` view. roleOf(idx) may return undefined to keep the base role (wall / empty / start / goal).
export function gridView(grid, roleOf = () => undefined, { editable = 'toggles', title } = {}) {
  const cells = new Array(grid.rows * grid.cols);
  for (let i = 0; i < cells.length; i++) {
    let role = grid.walls[i] ? 'wall' : 'empty';
    const r = roleOf(i);
    if (r && !grid.walls[i]) role = r;
    if (i === grid.start) role = 'start';
    if (i === grid.goal) role = 'goal';
    cells[i] = role;
  }
  return { kind: 'grid', title, rows: grid.rows, cols: grid.cols, cells, editable };
}
