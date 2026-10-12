import { makeRng } from './rng.js';

export const ARRAY_ORDERS = [
  { value: 'random', label: 'Random' },
  { value: 'nearly', label: 'Nearly sorted' },
  { value: 'sorted', label: 'Already sorted' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'few', label: 'Few distinct values' },
];

// The standard input fields for anything that consumes a list of numbers.
// Modules spread this into viz.inputs so that compare groups can feed every member the same input.
export function arrayInputs({ size = 16, maxSize = 64, order = 'random' } = {}) {
  return [
    { id: 'size', type: 'range', label: 'Number of items', min: 4, max: maxSize, step: 1, default: size },
    { id: 'order', type: 'select', label: 'Starting order', options: ARRAY_ORDERS, default: order },
    { id: 'seed', type: 'seed', label: 'Random seed', default: 7 },
    { id: 'custom', type: 'list', label: 'Or type your own values', default: [], maxLength: 64, min: -999, max: 999,
      help: 'Comma-separated numbers. Leave empty to use the generated list.' },
  ];
}

export function makeArray({ size = 16, order = 'random', seed = 7 } = {}, { min = 1, max = 99 } = {}) {
  const rng = makeRng(seed);
  const n = Math.max(0, Math.floor(size));
  let a;
  if (order === 'few') {
    const pool = [rng.int(min, max), rng.int(min, max), rng.int(min, max), rng.int(min, max)];
    a = Array.from({ length: n }, () => rng.pick(pool));
    return a;
  }
  a = Array.from({ length: n }, () => rng.int(min, max));
  if (order === 'sorted' || order === 'nearly' || order === 'reversed') a.sort((x, y) => x - y);
  if (order === 'reversed') a.reverse();
  if (order === 'nearly') {
    const swaps = Math.max(1, Math.floor(n / 10));
    for (let k = 0; k < swaps; k++) {
      const i = rng.int(0, n - 2);
      [a[i], a[i + 1]] = [a[i + 1], a[i]];
    }
  }
  return a;
}

// Custom values win when present; otherwise generate from (size, order, seed).
export function resolveArray(input, range) {
  if (Array.isArray(input.custom) && input.custom.length) return input.custom.slice();
  return makeArray(input, range);
}

export function isSorted(a) {
  for (let i = 1; i < a.length; i++) if (a[i - 1] > a[i]) return false;
  return true;
}

export function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  const x = a.slice().sort((p, q) => p - q);
  const y = b.slice().sort((p, q) => p - q);
  return x.every((v, i) => v === y[i]);
}

/* ---- searching ---- */

export const SEARCH_TARGETS = [
  { value: 'random', label: 'A value somewhere in the list' },
  { value: 'first', label: 'The first value' },
  { value: 'middle', label: 'The middle value' },
  { value: 'last', label: 'The last value' },
  { value: 'missing', label: 'A value that is not in the list' },
];

// The standard input fields for search algorithms (spread into viz.inputs).
export function searchInputs({ size = 16, maxSize = 64 } = {}) {
  return [
    { id: 'size', type: 'range', label: 'Number of items', min: 4, max: maxSize, step: 1, default: size },
    { id: 'where', type: 'select', label: 'Search for', options: SEARCH_TARGETS, default: 'random' },
    { id: 'seed', type: 'seed', label: 'Random seed', default: 7 },
    { id: 'custom', type: 'list', label: 'Or type your own sorted values', default: [], maxLength: 64, min: -999, max: 999, integer: true,
      help: 'Comma-separated whole numbers. They are sorted and de-duplicated for you.' },
    { id: 'target', type: 'number', label: 'Target (used with your own values)', default: 0, min: -999, max: 999 },
  ];
}

// Returns { array, target }: array is sorted ascending with distinct integers.
export function resolveSearch(input) {
  if (Array.isArray(input.custom) && input.custom.length) {
    const array = [...new Set(input.custom)].sort((a, b) => a - b);
    return { array, target: Number(input.target) || 0 };
  }
  const rng = makeRng((input.seed || 1) * 31 + 5);
  const n = Math.max(1, Math.floor(input.size || 16));
  const array = [];
  let v = rng.int(1, 4);
  for (let i = 0; i < n; i++) { array.push(v); v += rng.int(1, 5) * 2; } // even gaps leave odd "missing" values
  let target;
  switch (input.where) {
    case 'first': target = array[0]; break;
    case 'last': target = array[n - 1]; break;
    case 'middle': target = array[(n - 1) >> 1]; break;
    case 'missing': target = array[rng.int(0, n - 1)] + 1; break;
    default: target = array[rng.int(0, n - 1)];
  }
  return { array, target };
}
