// The laboratory's benches. A record joins a bench by setting meta.lab to its id.

export const labCategories = [
  { id: 'sorting-searching', name: 'Sorting and searching', blurb: 'Rearranging lists and finding items in them.' },
  { id: 'graphs', name: 'Graph traversal and pathfinding', blurb: 'Exploring networks and finding routes through them.' },
  { id: 'data-structures', name: 'Data structures', blurb: 'Structures whose operations are themselves small algorithms.' },
  { id: 'dynamic-programming', name: 'Dynamic programming', blurb: 'Filling tables of subproblem answers.' },
  { id: 'mathematics', name: 'Mathematical algorithms', blurb: 'Number theory and transforms.' },
  { id: 'optimization', name: 'Optimization', blurb: 'Searching landscapes for their lowest points.' },
  { id: 'machine-learning', name: 'Machine learning', blurb: 'Fitting models to data.' },
  { id: 'neural-networks', name: 'Neural networks', blurb: 'Layered models trained by gradient.' },
  { id: 'probability-statistics', name: 'Probability and statistics', blurb: 'Sampling, simulation and updating beliefs.' },
  { id: 'cryptography', name: 'Cryptography demonstrations', blurb: 'Toy-sized keys so every number is visible. Not for real secrets.' },
  { id: 'geometry', name: 'Computational geometry', blurb: 'Points, hulls and pixels.' },
  { id: 'robotics', name: 'Robotics and motion planning', blurb: 'Planning paths and estimating state.' },
  { id: 'numerical', name: 'Numerical simulation', blurb: 'Approximating roots and integrating equations of motion.' },
  { id: 'compression', name: 'Compression and information theory', blurb: 'Describing the same data in fewer bits.' },
];

export const labById = Object.fromEntries(labCategories.map((c) => [c.id, c]));
