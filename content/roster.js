// The roster: every algorithm id the atlas knows about, published or planned, plus the
// closed vocabularies that records may reference. The validator resolves cross-references
// against this file, so lessons can link to each other before both are written.
//
// status 'published' entries must have content/algorithms/<id>.js; 'planned' entries are
// shown as planned (never as lessons) wherever they are referenced.

export const roster = [
  // Algorithms and data structures
  { id: 'bubble-sort', name: 'Bubble Sort', discipline: 'algorithms', status: 'published' },
  { id: 'insertion-sort', name: 'Insertion Sort', discipline: 'algorithms', status: 'published' },
  { id: 'selection-sort', name: 'Selection Sort', discipline: 'algorithms', status: 'published' },
  { id: 'merge-sort', name: 'Merge Sort', discipline: 'algorithms', status: 'published' },
  { id: 'quick-sort', name: 'Quick Sort', discipline: 'algorithms', status: 'published' },
  { id: 'heap-sort', name: 'Heap Sort', discipline: 'algorithms', status: 'published' },
  { id: 'counting-sort', name: 'Counting Sort', discipline: 'algorithms', status: 'published' },
  { id: 'linear-search', name: 'Linear Search', discipline: 'algorithms', status: 'published' },
  { id: 'binary-search', name: 'Binary Search', discipline: 'algorithms', status: 'published' },
  { id: 'union-find', name: 'Union-Find (Disjoint Set Union)', discipline: 'algorithms', status: 'published' },
  { id: 'hash-table', name: 'Hash Table with Linear Probing', discipline: 'algorithms', status: 'published' },
  // Graph theory
  { id: 'bfs', name: 'Breadth-First Search', discipline: 'graph-theory', status: 'published' },
  { id: 'dfs', name: 'Depth-First Search', discipline: 'graph-theory', status: 'published' },
  { id: 'topological-sort', name: 'Topological Sort (Kahn\'s Algorithm)', discipline: 'graph-theory', status: 'published' },
  { id: 'dijkstra', name: 'Dijkstra\'s Algorithm', discipline: 'graph-theory', status: 'published' },
  { id: 'bellman-ford', name: 'Bellman-Ford Algorithm', discipline: 'graph-theory', status: 'published' },
  { id: 'a-star', name: 'A* Search', discipline: 'ai', status: 'published' },
  { id: 'kruskal', name: 'Kruskal\'s Algorithm', discipline: 'graph-theory', status: 'published' },
  { id: 'pagerank', name: 'PageRank', discipline: 'graph-theory', status: 'published' },
  // Dynamic programming, strings, compression
  { id: 'fibonacci-dp', name: 'Fibonacci by Dynamic Programming', discipline: 'algorithms', status: 'published' },
  { id: 'edit-distance', name: 'Edit Distance (Levenshtein)', discipline: 'nlp', status: 'published' },
  { id: 'lcs', name: 'Longest Common Subsequence', discipline: 'nlp', status: 'published' },
  { id: 'knapsack', name: '0/1 Knapsack', discipline: 'optimization', status: 'published' },
  { id: 'needleman-wunsch', name: 'Needleman-Wunsch Alignment', discipline: 'biology', status: 'published' },
  { id: 'huffman-coding', name: 'Huffman Coding', discipline: 'information-theory', status: 'published' },
  { id: 'run-length-encoding', name: 'Run-Length Encoding', discipline: 'information-theory', status: 'published' },
  { id: 'lz77', name: 'LZ77 Compression', discipline: 'information-theory', status: 'published' },
  // Mathematics and numerical methods
  { id: 'euclidean-algorithm', name: 'Euclidean Algorithm', discipline: 'mathematics', status: 'published' },
  { id: 'sieve-of-eratosthenes', name: 'Sieve of Eratosthenes', discipline: 'mathematics', status: 'published' },
  { id: 'modular-exponentiation', name: 'Fast Modular Exponentiation', discipline: 'mathematics', status: 'published' },
  { id: 'newtons-method', name: 'Newton\'s Method', discipline: 'mathematics', status: 'published' },
  { id: 'bisection-method', name: 'Bisection Method', discipline: 'mathematics', status: 'published' },
  { id: 'fft', name: 'Fast Fourier Transform', discipline: 'mathematics', status: 'published' },
  { id: 'euler-method', name: 'Euler\'s Method', discipline: 'physics', status: 'published' },
  { id: 'runge-kutta-4', name: 'Runge-Kutta (RK4)', discipline: 'physics', status: 'published' },
  // Optimization
  { id: 'gradient-descent', name: 'Gradient Descent', discipline: 'optimization', status: 'published' },
  { id: 'simulated-annealing', name: 'Simulated Annealing', discipline: 'optimization', status: 'published' },
  { id: 'genetic-algorithm', name: 'Genetic Algorithm', discipline: 'optimization', status: 'published' },
  // Machine learning and deep learning
  { id: 'linear-regression', name: 'Linear Regression', discipline: 'machine-learning', status: 'published' },
  { id: 'logistic-regression', name: 'Logistic Regression', discipline: 'machine-learning', status: 'published' },
  { id: 'k-means', name: 'k-Means Clustering', discipline: 'machine-learning', status: 'published' },
  { id: 'knn', name: 'k-Nearest Neighbours', discipline: 'machine-learning', status: 'published' },
  { id: 'perceptron', name: 'Perceptron', discipline: 'deep-learning', status: 'published' },
  { id: 'backpropagation', name: 'Backpropagation', discipline: 'deep-learning', status: 'published' },
  { id: 'ddpm', name: 'Diffusion Models (DDPM)', discipline: 'deep-learning', status: 'published' },
  // Probability, statistics, estimation
  { id: 'monte-carlo', name: 'Monte Carlo Estimation', discipline: 'statistics', status: 'published' },
  { id: 'bayesian-updating', name: 'Bayesian Updating', discipline: 'statistics', status: 'published' },
  { id: 'metropolis-hastings', name: 'Metropolis-Hastings', discipline: 'statistics', status: 'published' },
  { id: 'reservoir-sampling', name: 'Reservoir Sampling', discipline: 'statistics', status: 'published' },
  { id: 'kalman-filter', name: 'Kalman Filter', discipline: 'robotics', status: 'published' },
  { id: 'rrt', name: 'Rapidly-Exploring Random Tree (RRT)', discipline: 'robotics', status: 'published' },
  // Cryptography, geometry, systems, quantum
  { id: 'rsa', name: 'RSA', discipline: 'cryptography', status: 'published' },
  { id: 'diffie-hellman', name: 'Diffie-Hellman Key Exchange', discipline: 'cryptography', status: 'published' },
  { id: 'graham-scan', name: 'Graham Scan', discipline: 'computational-geometry', status: 'published' },
  { id: 'bresenham-line', name: 'Bresenham\'s Line Algorithm', discipline: 'computer-graphics', status: 'published' },
  { id: 'consistent-hashing', name: 'Consistent Hashing', discipline: 'distributed-systems', status: 'published' },
  { id: 'grovers-search', name: 'Grover\'s Search', discipline: 'quantum-computing', status: 'published' },

  // Planned: referenced by lessons and paths, not yet written. Shown as "planned" everywhere.
  { id: 'prim', name: 'Prim\'s Algorithm', discipline: 'graph-theory', status: 'planned' },
  { id: 'floyd-warshall', name: 'Floyd-Warshall Algorithm', discipline: 'graph-theory', status: 'planned' },
  { id: 'binary-search-tree', name: 'Binary Search Tree', discipline: 'algorithms', status: 'planned' },
  { id: 'radix-sort', name: 'Radix Sort', discipline: 'algorithms', status: 'planned' },
  { id: 'minimax', name: 'Minimax with Alpha-Beta Pruning', discipline: 'ai', status: 'planned' },
  { id: 'q-learning', name: 'Q-Learning', discipline: 'ai', status: 'planned' },
  { id: 'stochastic-gradient-descent', name: 'Stochastic Gradient Descent', discipline: 'optimization', status: 'planned' },
  { id: 'adam', name: 'Adam Optimizer', discipline: 'optimization', status: 'planned' },
  { id: 'simplex', name: 'Simplex Method', discipline: 'optimization', status: 'planned' },
  { id: 'decision-tree', name: 'Decision Tree Learning', discipline: 'machine-learning', status: 'planned' },
  { id: 'pca', name: 'Principal Component Analysis', discipline: 'machine-learning', status: 'planned' },
  { id: 'convolution', name: 'Convolution and Edge Detection', discipline: 'computer-vision', status: 'planned' },
  { id: 'attention', name: 'Attention and the Transformer', discipline: 'deep-learning', status: 'planned' },
  { id: 'byte-pair-encoding', name: 'Byte-Pair Encoding', discipline: 'nlp', status: 'planned' },
  { id: 'viterbi', name: 'Viterbi Algorithm', discipline: 'nlp', status: 'planned' },
  { id: 'miller-rabin', name: 'Miller-Rabin Primality Test', discipline: 'cryptography', status: 'planned' },
  { id: 'sha-256', name: 'SHA-256', discipline: 'cryptography', status: 'planned' },
  { id: 'shors-algorithm', name: 'Shor\'s Algorithm', discipline: 'quantum-computing', status: 'planned' },
  { id: 'de-casteljau', name: 'De Casteljau\'s Algorithm', discipline: 'computer-graphics', status: 'planned' },
  { id: 'raft', name: 'Raft Consensus', discipline: 'distributed-systems', status: 'planned' },
  { id: 'gaussian-elimination', name: 'Gaussian Elimination', discipline: 'mathematics', status: 'planned' },
  { id: 'binomial-option-pricing', name: 'Binomial Option Pricing', discipline: 'finance', status: 'planned' },
  { id: 'particle-filter', name: 'Particle Filter', discipline: 'robotics', status: 'planned' },
  { id: 'graph-neural-network', name: 'Graph Neural Networks', discipline: 'deep-learning', status: 'planned' },
];

export const rosterById = Object.fromEntries(roster.map((r) => [r.id, r]));

// Concept ids. Definitions live in content/concepts.js; lessons reference them as "concept:<id>".
export const CONCEPT_IDS = [
  // foundations of analysis
  'big-o', 'recursion', 'recurrence', 'invariant', 'lower-bound', 'amortized-analysis', 'comparison-model',
  'stability', 'in-place', 'brute-force',
  // paradigms
  'divide-and-conquer', 'greedy', 'dynamic-programming', 'memoization', 'backtracking', 'randomization',
  'local-search', 'heuristic', 'approximation',
  // structures
  'array', 'graph', 'tree', 'queue', 'stack', 'priority-queue', 'heap', 'hashing', 'matrix',
  // graph and DP ideas
  'shortest-path', 'spanning-tree', 'topological-order', 'relaxation', 'connectivity',
  'optimal-substructure', 'overlapping-subproblems',
  // mathematics
  'modular-arithmetic', 'prime-numbers', 'complex-numbers', 'linear-algebra', 'derivative', 'gradient',
  'chain-rule', 'convexity', 'convergence', 'floating-point', 'differential-equation', 'discretization',
  'fourier-transform',
  // probability
  'probability', 'expectation', 'bayes-theorem', 'markov-chain', 'sampling', 'law-of-large-numbers',
  'gaussian-distribution',
  // learning
  'loss-function', 'learning-rate', 'overfitting', 'supervised-learning', 'unsupervised-learning',
  'neural-network', 'activation-function', 'distance-metric', 'feature-space',
  // information and security
  'entropy', 'prefix-code', 'public-key-cryptography', 'one-way-function',
  // other
  'np-hardness', 'state-space', 'configuration-space', 'superposition', 'simulation',
  'exploration-exploitation', 'load-balancing',
];
