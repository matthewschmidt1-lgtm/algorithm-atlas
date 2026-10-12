// Two-dimensional objective functions shared by the optimization lessons, so that gradient
// descent, simulated annealing and genetic algorithms can be run on identical problems.
// Every landscape gives f, its exact gradient, a plotting domain and its known minima.

const TAU = 2 * Math.PI;

export const LANDSCAPES = [
  {
    id: 'bowl', label: 'Round bowl (convex)',
    f: (x, y) => x * x + y * y,
    grad: (x, y) => [2 * x, 2 * y],
    x: [-3, 3], y: [-3, 3], minima: [[0, 0]], fmin: 0,
    about: 'f(x, y) = x² + y². One minimum, equal curvature in every direction.',
  },
  {
    id: 'valley', label: 'Narrow valley (ill-conditioned)',
    f: (x, y) => 0.5 * x * x + 6 * y * y,
    grad: (x, y) => [x, 12 * y],
    x: [-3, 3], y: [-2, 2], minima: [[0, 0]], fmin: 0,
    about: 'f(x, y) = ½x² + 6y². Twelve times steeper across the valley than along it.',
  },
  {
    id: 'rosenbrock', label: 'Curved valley (Rosenbrock, b = 10)',
    f: (x, y) => (1 - x) ** 2 + 10 * (y - x * x) ** 2,
    grad: (x, y) => [-2 * (1 - x) - 40 * x * (y - x * x), 20 * (y - x * x)],
    x: [-2, 2], y: [-1, 3], minima: [[1, 1]], fmin: 0,
    about: 'f(x, y) = (1 − x)² + 10(y − x²)². A curved, flat-bottomed valley; the minimum is at (1, 1).',
  },
  {
    id: 'himmelblau', label: 'Four minima (Himmelblau)',
    f: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2,
    grad: (x, y) => [4 * x * (x * x + y - 11) + 2 * (x + y * y - 7), 2 * (x * x + y - 11) + 4 * y * (x + y * y - 7)],
    x: [-5, 5], y: [-5, 5],
    minima: [[3, 2], [-2.805118, 3.131312], [-3.77931, -3.283186], [3.584428, -1.848126]], fmin: 0,
    about: 'f(x, y) = (x² + y − 11)² + (x + y² − 7)². Four equally good minima; which one you reach depends on where you start.',
  },
  {
    id: 'rastrigin', label: 'Many local minima (Rastrigin)',
    f: (x, y) => 20 + x * x - 10 * Math.cos(TAU * x) + y * y - 10 * Math.cos(TAU * y),
    grad: (x, y) => [2 * x + 10 * TAU * Math.sin(TAU * x), 2 * y + 10 * TAU * Math.sin(TAU * y)],
    x: [-4, 4], y: [-4, 4], minima: [[0, 0]], fmin: 0,
    about: 'f(x, y) = 20 + x² − 10cos(2πx) + y² − 10cos(2πy). A bowl covered in ripples: one global minimum at the origin and a local minimum near every integer point.',
  },
];

export const landscapeById = Object.fromEntries(LANDSCAPES.map((l) => [l.id, l]));
export const landscapeOptions = LANDSCAPES.map((l) => ({ value: l.id, label: l.label }));

const sampleCache = new Map();
// Samples f on a grid for contour drawing. Cached: the surface never changes.
export function sampleLandscape(L, nx = 64, ny = 48) {
  const key = `${L.id}:${nx}:${ny}`;
  if (!sampleCache.has(key)) {
    const values = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      const y = L.y[0] + (j / (ny - 1)) * (L.y[1] - L.y[0]);
      for (let i = 0; i < nx; i++) values[j * nx + i] = L.f(L.x[0] + (i / (nx - 1)) * (L.x[1] - L.x[0]), y);
    }
    sampleCache.set(key, values);
  }
  return { type: 'contour', nx, ny, values: sampleCache.get(key), x: L.x, y: L.y, role: 'sage', levels: 12 };
}

// Map a normalized position in [-1, 1] to the landscape's domain.
export const fromUnit = (L, ux, uy) => [
  L.x[0] + ((ux + 1) / 2) * (L.x[1] - L.x[0]),
  L.y[0] + ((uy + 1) / 2) * (L.y[1] - L.y[0]),
];

// Standard layers for drawing a landscape: contours plus hollow markers on the known minima.
export function landscapeLayers(L) {
  return [
    sampleLandscape(L),
    { type: 'points', points: L.minima, role: 'forest', hollow: true, r: 5 },
  ];
}
