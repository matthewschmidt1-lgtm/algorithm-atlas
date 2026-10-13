// The laboratory's benches. A record joins a bench by setting meta.lab to its id.
// `want` says the same thing as `name` in everyday words. It is the heading used on the
// "I want to" page, which groups each lesson's problem phrases by bench.

export const labCategories = [
  { id: 'sorting-searching', name: 'Sorting and searching', want: 'Put things in order, or find one of them', blurb: 'Rearranging lists and finding items in them.' },
  { id: 'graphs', name: 'Graph traversal and pathfinding', want: 'Find a route or explore a network', blurb: 'Exploring networks and finding routes through them.' },
  { id: 'data-structures', name: 'Data structures', want: 'Keep track of things and look them up fast', blurb: 'Structures whose operations are themselves small algorithms.' },
  { id: 'dynamic-programming', name: 'Dynamic programming', want: 'Compare two texts, or choose the best combination', blurb: 'Filling tables of subproblem answers.' },
  { id: 'mathematics', name: 'Mathematical algorithms', want: 'Work with whole numbers, primes and frequencies', blurb: 'Number theory and transforms.' },
  { id: 'optimization', name: 'Optimization', want: 'Find the best setting or the lowest point', blurb: 'Searching landscapes for their lowest points.' },
  { id: 'machine-learning', name: 'Machine learning', want: 'Predict, classify or group from data', blurb: 'Fitting models to data.' },
  { id: 'neural-networks', name: 'Neural networks', want: 'Train a neural network, or generate an image', blurb: 'Layered models trained by gradient.' },
  { id: 'probability-statistics', name: 'Probability and statistics', want: 'Estimate, sample and reason about chance', blurb: 'Sampling, simulation and updating beliefs.' },
  { id: 'cryptography', name: 'Cryptography demonstrations', want: 'Keep a message secret', blurb: 'Toy-sized keys so every number is visible. Not for real secrets.' },
  { id: 'geometry', name: 'Computational geometry', want: 'Draw lines and outline shapes', blurb: 'Points, hulls and pixels.' },
  { id: 'robotics', name: 'Robotics and motion planning', want: 'Plan a path for a robot, or track something moving', blurb: 'Planning paths and estimating state.' },
  { id: 'numerical', name: 'Numerical simulation', want: 'Solve an equation or simulate motion', blurb: 'Approximating roots and integrating equations of motion.' },
  { id: 'compression', name: 'Compression and information theory', want: 'Make data smaller', blurb: 'Describing the same data in fewer bits.' },
];

export const labById = Object.fromEntries(labCategories.map((c) => [c.id, c]));
