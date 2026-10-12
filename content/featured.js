// Demonstrations shown on the home page. Each one is the lesson's real implementation,
// started from the input given here. Entries whose lesson is not published are skipped.

export const featured = [
  { id: 'dijkstra', line: 'Finding the cheapest route through a network.', input: { nodes: 9, density: 0.45, seed: 3 } },
  { id: 'quick-sort', line: 'Putting a list in order by splitting it around a pivot.', input: { size: 22, order: 'random', seed: 4 } },
  { id: 'a-star', line: 'Steering a search toward its goal through a maze.', input: {} },
  { id: 'gradient-descent', line: 'Walking downhill on a surface to find its lowest point.', input: { landscape: 'himmelblau', rate: 0.005, steps: 90 } },
  { id: 'pagerank', line: 'Ranking pages by who links to them.', input: {} },
  { id: 'backpropagation', line: 'A small neural network learning to separate two classes.', input: {} },
  { id: 'fft', line: 'Finding the frequencies hidden in a signal.', input: {} },
  { id: 'genetic-algorithm', line: 'A population of candidate answers improving by selection.', input: {} },
  { id: 'monte-carlo', line: 'Estimating a quantity from random samples.', input: {} },
  { id: 'ddpm', line: 'Building an image by removing noise step by step.', input: {} },
];
