// The disciplines of the atlas. Adding a discipline is adding one record here; every page
// (universe, discovery grid, library filters, search) reads from this list.
//
// group  colour family used across the site (see GROUPS)
// pos    position on the universe map, in a 1000 x 640 coordinate space
// related[].why explains the shared principle, never just "related"

export const GROUPS = {
  foundations: { label: 'Foundations of computing', color: 'forest' },
  mathematics: { label: 'Mathematical sciences', color: 'ochre' },
  intelligence: { label: 'Learning and intelligence', color: 'terracotta' },
  nature: { label: 'Natural sciences', color: 'moss' },
  applied: { label: 'Applied systems', color: 'brick' },
};

export const disciplines = [
  {
    id: 'algorithms', name: 'Algorithms and Data Structures', short: 'Algorithms & DS', group: 'foundations', pos: [455, 330],
    blurb: 'The core toolkit: how to organize data and solve problems step by step, and how to measure the cost of doing so.',
    description: 'Sorting, searching, and the structures that make them fast. This is where the vocabulary of the whole atlas is defined: correctness, invariants, and the growth of running time with input size.',
    subfields: ['Sorting', 'Searching', 'Heaps and priority queues', 'Hash tables', 'Disjoint sets', 'Complexity analysis'],
    applications: ['Databases and indexes', 'Operating systems', 'Compilers', 'Every standard library'],
    related: [
      { id: 'graph-theory', why: 'Graph algorithms are built from the same queues, heaps and disjoint sets studied here.' },
      { id: 'mathematics', why: 'Running-time analysis is applied discrete mathematics: sums, recurrences and proofs by induction.' },
      { id: 'information-theory', why: 'The n log n lower bound for comparison sorting is an information argument: each comparison yields at most one bit.' },
      { id: 'distributed-systems', why: 'Hashing and ordering carry over directly when the data no longer fits on one machine.' },
    ],
  },
  {
    id: 'graph-theory', name: 'Graph Theory', short: 'Graph Theory', group: 'foundations', pos: [300, 250],
    blurb: 'Networks of things and the links between them: how to explore, route, rank and connect.',
    description: 'A graph models anything made of pairwise relationships. Traversals, shortest paths, spanning trees and ranking all come from asking structured questions about nodes and edges.',
    subfields: ['Traversal', 'Shortest paths', 'Minimum spanning trees', 'Ordering and scheduling', 'Link analysis'],
    applications: ['Route planning', 'Network routing', 'Dependency resolution', 'Web search ranking'],
    related: [
      { id: 'algorithms', why: 'Every graph algorithm is a data structure choice: a queue gives breadth-first search, a priority queue gives Dijkstra.' },
      { id: 'robotics', why: 'Motion planning turns free space into a graph and then searches it.' },
      { id: 'machine-learning', why: 'Graph neural networks learn by passing messages along edges, a learned form of graph traversal.' },
      { id: 'distributed-systems', why: 'A network of machines is a graph; routing protocols are distributed shortest-path computations.' },
    ],
  },
  {
    id: 'computational-geometry', name: 'Computational Geometry', short: 'Geometry', group: 'foundations', pos: [250, 425],
    blurb: 'Algorithms about points, lines and shapes: hulls, intersections and nearest neighbours.',
    description: 'Geometric problems reward careful ordering. Sorting points by angle or sweeping a line across the plane turns questions about shape into questions about sequence.',
    subfields: ['Convex hulls', 'Line and segment problems', 'Proximity', 'Rasterization'],
    applications: ['Collision detection', 'Geographic information systems', 'Computer-aided design', 'Rendering'],
    related: [
      { id: 'computer-graphics', why: 'Drawing is geometry made discrete: every line and curve on a screen is a rasterization problem.' },
      { id: 'robotics', why: 'A robot plans in a geometric world; obstacles, clearances and reachable regions are geometric objects.' },
      { id: 'algorithms', why: 'Most geometric algorithms start with a sort and maintain a stack or balanced tree as an invariant.' },
    ],
  },
  {
    id: 'distributed-systems', name: 'Distributed Systems', short: 'Distributed', group: 'foundations', pos: [130, 315],
    blurb: 'Getting many machines to act as one: partitioning data, spreading load and agreeing on state.',
    description: 'When no single machine can see everything, algorithms must tolerate delay, failure and change. The recurring ideas are partitioning, replication and agreement.',
    subfields: ['Partitioning and load balancing', 'Replication', 'Consensus', 'Large-scale graph processing'],
    applications: ['Distributed caches', 'Key-value stores', 'Content delivery networks', 'Web-scale ranking'],
    related: [
      { id: 'algorithms', why: 'Hash tables become consistent hashing once buckets are machines that can join and leave.' },
      { id: 'graph-theory', why: 'Iterative graph computations such as PageRank are the classic workload for cluster frameworks.' },
      { id: 'cryptography', why: 'Machines that do not share a room need authenticated, tamper-evident messages to trust each other.' },
    ],
  },
  {
    id: 'computer-graphics', name: 'Computer Graphics', short: 'Graphics', group: 'foundations', pos: [140, 485],
    blurb: 'Turning mathematical descriptions of shape and light into pixels.',
    description: 'Graphics algorithms are exercises in doing geometry quickly and with integers where possible, because the same operation is repeated for millions of pixels.',
    subfields: ['Rasterization', 'Curves and surfaces', 'Sampling and filtering', 'Physically based simulation'],
    applications: ['Rendering engines', 'Fonts and vector drawing', 'Games', 'Visual effects'],
    related: [
      { id: 'computational-geometry', why: 'Rasterization and hidden-surface removal are geometric problems solved incrementally.' },
      { id: 'physics', why: 'Animation integrates equations of motion step by step, the same numerical methods physicists use.' },
      { id: 'computer-vision', why: 'Graphics maps a scene to an image; vision tries to invert that map.' },
    ],
  },
  {
    id: 'mathematics', name: 'Mathematics', short: 'Mathematics', group: 'mathematics', pos: [520, 140],
    blurb: 'Number theory and numerical methods: the oldest algorithms, and the ones every other field leans on.',
    description: 'From Euclid\'s algorithm to Newton\'s method and the Fourier transform, mathematical algorithms compute exact answers about integers and convergent approximations about real numbers.',
    subfields: ['Number theory', 'Root finding', 'Numerical integration', 'Transforms'],
    applications: ['Cryptographic arithmetic', 'Scientific computing', 'Signal analysis', 'Engineering simulation'],
    related: [
      { id: 'cryptography', why: 'Modern cryptography is number theory with very large integers: greatest common divisors, modular powers and primes.' },
      { id: 'physics', why: 'Physical laws are differential equations; simulating them means solving those equations numerically.' },
      { id: 'optimization', why: 'Finding where a derivative is zero is root finding; Newton\'s method serves both fields.' },
      { id: 'statistics', why: 'Probability rests on measure and integration; estimation is applied calculus and linear algebra.' },
    ],
  },
  {
    id: 'statistics', name: 'Statistics', short: 'Statistics', group: 'mathematics', pos: [705, 175],
    blurb: 'Reasoning under uncertainty: estimating, sampling and updating beliefs from data.',
    description: 'Statistical algorithms turn random samples into estimates with known error. Sampling, simulation and Bayesian updating are procedures for learning from incomplete evidence.',
    subfields: ['Monte Carlo methods', 'Bayesian inference', 'Sampling', 'Regression', 'State estimation'],
    applications: ['Clinical trials', 'Polling and surveys', 'Risk estimation', 'Sensor fusion'],
    related: [
      { id: 'machine-learning', why: 'Fitting a model is statistical estimation; regression was statistics long before it was machine learning.' },
      { id: 'physics', why: 'Monte Carlo and Markov chain sampling were invented to study physical systems too complex to solve exactly.' },
      { id: 'finance', why: 'Pricing and risk are expectations over uncertain futures, estimated by simulation.' },
      { id: 'ai', why: 'Probabilistic AI represents beliefs as distributions and updates them with Bayes\' rule.' },
    ],
  },
  {
    id: 'optimization', name: 'Optimization', short: 'Optimization', group: 'mathematics', pos: [615, 300],
    blurb: 'Finding the best choice among many: following slopes, exploring landscapes and trading off constraints.',
    description: 'Optimization algorithms search a space of candidates for the one with the lowest cost. Some follow the gradient downhill; others explore more widely to escape local traps.',
    subfields: ['Gradient methods', 'Combinatorial optimization', 'Metaheuristics', 'Dynamic programming'],
    applications: ['Training machine learning models', 'Logistics and scheduling', 'Engineering design', 'Portfolio construction'],
    related: [
      { id: 'machine-learning', why: 'Training a model means minimizing a loss function; learning is optimization over parameters.' },
      { id: 'mathematics', why: 'Gradients, convexity and convergence proofs come directly from calculus and analysis.' },
      { id: 'finance', why: 'Choosing a portfolio is an optimization problem: maximize expected return for a given risk.' },
      { id: 'physics', why: 'Simulated annealing borrows the statistical mechanics of slowly cooling metal to escape local minima.' },
      { id: 'biology', why: 'Genetic algorithms borrow selection, crossover and mutation from evolution as a search strategy.' },
    ],
  },
  {
    id: 'information-theory', name: 'Information Theory', short: 'Information', group: 'mathematics', pos: [385, 90],
    blurb: 'Measuring information, and squeezing redundancy out of data without losing meaning.',
    description: 'Entropy sets a hard limit on how far data can be compressed. Compression algorithms approach that limit by giving frequent patterns short descriptions.',
    subfields: ['Entropy coding', 'Dictionary compression', 'Run-length methods'],
    applications: ['File compression', 'Image and video formats', 'Network protocols', 'Storage systems'],
    related: [
      { id: 'algorithms', why: 'Huffman coding is a greedy algorithm driven by a priority queue; information theory proves why greedy is optimal here.' },
      { id: 'cryptography', why: 'Both study what a message reveals: compression removes redundancy, encryption hides what remains.' },
      { id: 'nlp', why: 'Language models are judged by cross-entropy: how many bits they need to predict the next token.' },
      { id: 'statistics', why: 'Entropy is an expectation; coding and estimation are two views of the same probability model.' },
    ],
  },
  {
    id: 'ai', name: 'Artificial Intelligence', short: 'AI', group: 'intelligence', pos: [705, 405],
    blurb: 'Search, planning and reasoning: machines choosing actions to reach goals.',
    description: 'Classical AI frames intelligence as search through a space of states, guided by heuristics, and as reasoning about what is likely given the evidence.',
    subfields: ['Heuristic search', 'Planning', 'Probabilistic reasoning', 'Evolutionary computation'],
    applications: ['Game playing', 'Route and task planning', 'Diagnosis', 'Automated design'],
    related: [
      { id: 'graph-theory', why: 'A state space is a graph; A* is Dijkstra\'s algorithm told which direction looks promising.' },
      { id: 'machine-learning', why: 'Learning replaces hand-written heuristics and rules with ones estimated from data.' },
      { id: 'robotics', why: 'A robot is an AI planner with a body: it searches for actions that are physically feasible.' },
      { id: 'statistics', why: 'Reasoning under uncertainty is Bayesian inference applied to an agent\'s beliefs.' },
    ],
  },
  {
    id: 'machine-learning', name: 'Machine Learning', short: 'Machine Learning', group: 'intelligence', pos: [800, 290],
    blurb: 'Algorithms that improve with data: fitting lines, drawing boundaries and finding groups.',
    description: 'A learning algorithm chooses a model from a family by optimizing how well it explains examples. The classical methods remain the clearest way to see what that means.',
    subfields: ['Regression', 'Classification', 'Clustering', 'Instance-based learning'],
    applications: ['Forecasting', 'Spam and fraud detection', 'Recommendation', 'Customer segmentation'],
    related: [
      { id: 'optimization', why: 'Almost every learning algorithm is gradient descent, or a close relative, applied to a loss function.' },
      { id: 'statistics', why: 'Models are probability distributions; training is maximum likelihood or Bayesian estimation.' },
      { id: 'deep-learning', why: 'A neural network is logistic regression stacked in layers and trained by the same gradient idea.' },
      { id: 'computer-vision', why: 'Clustering and classification on pixels and features were the first vision pipelines.' },
    ],
  },
  {
    id: 'deep-learning', name: 'Deep Learning', short: 'Deep Learning', group: 'intelligence', pos: [915, 215],
    blurb: 'Layered neural networks trained by backpropagation, and the generative models built from them.',
    description: 'Deep learning composes simple differentiable units into large functions and trains them end to end. Backpropagation makes that possible by computing every gradient in one backward pass.',
    subfields: ['Neural network training', 'Generative models', 'Representation learning'],
    applications: ['Image recognition', 'Speech and language models', 'Image generation', 'Scientific modelling'],
    related: [
      { id: 'machine-learning', why: 'The perceptron and logistic regression are single neurons; depth adds learned intermediate features.' },
      { id: 'optimization', why: 'Training is stochastic gradient descent on a non-convex loss with millions of parameters.' },
      { id: 'mathematics', why: 'Backpropagation is the chain rule of calculus organized as dynamic programming over a computation graph.' },
      { id: 'physics', why: 'Diffusion models reverse a noising process modelled on thermodynamic diffusion.' },
    ],
  },
  {
    id: 'computer-vision', name: 'Computer Vision', short: 'Vision', group: 'intelligence', pos: [925, 385],
    blurb: 'Extracting structure from images: grouping pixels, finding frequencies and generating pictures.',
    description: 'Vision algorithms treat an image as a grid of numbers and look for structure in it: regions of similar colour, repeating frequencies, edges and learned features.',
    subfields: ['Segmentation and quantization', 'Frequency analysis', 'Image generation'],
    applications: ['Photo compression', 'Medical imaging', 'Autonomous driving', 'Image synthesis'],
    related: [
      { id: 'deep-learning', why: 'Modern vision is dominated by learned features; diffusion models generate images by learned denoising.' },
      { id: 'machine-learning', why: 'Colour quantization is k-means clustering in colour space.' },
      { id: 'mathematics', why: 'JPEG-style compression and image filtering rely on Fourier-family transforms.' },
      { id: 'computer-graphics', why: 'Vision and graphics are inverse problems that share geometry and image formation models.' },
    ],
  },
  {
    id: 'nlp', name: 'Natural Language Processing', short: 'NLP', group: 'intelligence', pos: [860, 500],
    blurb: 'Algorithms over text: comparing strings, aligning sequences and compressing language.',
    description: 'Before and beneath neural language models lie sequence algorithms: measuring how far apart two strings are, finding what they share, and exploiting the statistics of symbols.',
    subfields: ['String similarity', 'Sequence alignment', 'Statistical text models'],
    applications: ['Spell checking', 'Search and autocomplete', 'Diff tools', 'Machine translation evaluation'],
    related: [
      { id: 'biology', why: 'Aligning two sentences and aligning two genomes are the same dynamic program with different scoring.' },
      { id: 'information-theory', why: 'Predicting text well and compressing text well are the same task.' },
      { id: 'deep-learning', why: 'Language models are neural networks trained by backpropagation to predict the next token.' },
      { id: 'algorithms', why: 'Edit distance is the textbook dynamic program; tries and hashing power dictionaries.' },
    ],
  },
  {
    id: 'physics', name: 'Physics', short: 'Physics', group: 'nature', pos: [575, 525],
    blurb: 'Simulating nature: stepping equations of motion forward and sampling states of matter.',
    description: 'Computational physics replaces equations that cannot be solved on paper with procedures that approximate them: integrate forward in small steps, or sample the states a system can be in.',
    subfields: ['Numerical integration of ODEs', 'Monte Carlo simulation', 'Spectral methods'],
    applications: ['Orbital mechanics', 'Molecular dynamics', 'Climate and weather models', 'Circuit simulation'],
    related: [
      { id: 'mathematics', why: 'Euler and Runge-Kutta methods are numerical analysis; their error terms come from Taylor series.' },
      { id: 'statistics', why: 'The Metropolis algorithm was created to sample configurations of interacting particles.' },
      { id: 'optimization', why: 'Physical systems settle into minimum-energy states; annealing turns that into a search method.' },
      { id: 'quantum-computing', why: 'Quantum algorithms manipulate amplitudes according to the same linear algebra as quantum mechanics.' },
    ],
  },
  {
    id: 'biology', name: 'Biology', short: 'Biology', group: 'nature', pos: [715, 580],
    blurb: 'Comparing sequences of life, and borrowing evolution as a problem-solving method.',
    description: 'Bioinformatics compares DNA and protein sequences to infer shared ancestry and function. In the other direction, evolution itself inspired a family of search algorithms.',
    subfields: ['Sequence alignment', 'Evolutionary computation'],
    applications: ['Genome comparison', 'Protein homology search', 'Phylogenetics', 'Drug discovery'],
    related: [
      { id: 'nlp', why: 'DNA is a string over a four-letter alphabet; alignment and edit distance are one family of dynamic programs.' },
      { id: 'optimization', why: 'Genetic algorithms treat candidate solutions as a population under selection pressure.' },
      { id: 'statistics', why: 'Alignment scores are log-likelihood ratios: how much more probable is common ancestry than chance?' },
    ],
  },
  {
    id: 'quantum-computing', name: 'Quantum Computing', short: 'Quantum', group: 'nature', pos: [420, 570],
    blurb: 'Computing with amplitudes: algorithms that use interference to find answers faster.',
    description: 'A quantum algorithm arranges for wrong answers to cancel and right answers to reinforce. Small instances can be simulated exactly on a classical computer, which is how they are shown here.',
    subfields: ['Quantum search', 'Amplitude amplification'],
    applications: ['Unstructured search (theoretical speedup)', 'Cryptanalysis research', 'Quantum simulation'],
    related: [
      { id: 'physics', why: 'The state of a quantum register evolves by unitary matrices, the mathematics of quantum mechanics.' },
      { id: 'cryptography', why: 'Quantum algorithms change which problems are hard, and so which cryptosystems remain safe.' },
      { id: 'mathematics', why: 'Grover\'s algorithm is a rotation in a two-dimensional plane; its analysis is trigonometry and linear algebra.' },
    ],
  },
  {
    id: 'cryptography', name: 'Cryptography', short: 'Cryptography', group: 'applied', pos: [215, 120],
    blurb: 'Keeping secrets and establishing trust with arithmetic that is easy one way and hard the other.',
    description: 'Public-key cryptography relies on operations such as modular exponentiation that are quick to compute and believed infeasible to reverse without a secret.',
    subfields: ['Public-key encryption', 'Key exchange', 'Number-theoretic primitives'],
    applications: ['Secure web connections (TLS)', 'Digital signatures', 'Secure messaging', 'Software updates'],
    related: [
      { id: 'mathematics', why: 'RSA and Diffie-Hellman are Euclid\'s algorithm and fast exponentiation applied modulo large numbers.' },
      { id: 'information-theory', why: 'Shannon defined perfect secrecy in the same terms he used to define information.' },
      { id: 'distributed-systems', why: 'Every protocol between machines that do not trust the network depends on key exchange.' },
      { id: 'quantum-computing', why: 'Shor\'s algorithm would break RSA and Diffie-Hellman on a large enough quantum computer.' },
    ],
  },
  {
    id: 'finance', name: 'Finance', short: 'Finance', group: 'applied', pos: [870, 100],
    blurb: 'Pricing uncertainty: simulating futures, filtering noise and optimizing under risk.',
    description: 'Quantitative finance applies simulation, estimation and optimization to prices that move randomly. The algorithms are borrowed from statistics, physics and operations research.',
    subfields: ['Monte Carlo pricing', 'Time-series filtering', 'Root finding for implied quantities', 'Portfolio optimization'],
    applications: ['Derivative pricing', 'Risk measurement', 'Implied volatility', 'Portfolio construction'],
    related: [
      { id: 'statistics', why: 'A price is modelled as a random process; valuation is an expected value estimated by sampling.' },
      { id: 'optimization', why: 'Portfolio selection balances return against variance, a constrained optimization problem.' },
      { id: 'mathematics', why: 'Implied volatility has no closed form; it is found with Newton\'s method or bisection.' },
    ],
  },
  {
    id: 'robotics', name: 'Robotics', short: 'Robotics', group: 'applied', pos: [500, 430],
    blurb: 'Machines that move: planning collision-free paths and estimating where they are.',
    description: 'A robot must decide where to go and work out where it is. Planning searches the space of possible configurations; estimation fuses noisy sensors into a best guess.',
    subfields: ['Motion planning', 'State estimation', 'Grid and roadmap search'],
    applications: ['Autonomous vehicles', 'Warehouse automation', 'Drones', 'Robotic arms'],
    related: [
      { id: 'ai', why: 'Path planning is heuristic search; A* was developed for the robot Shakey.' },
      { id: 'graph-theory', why: 'Roadmaps and occupancy grids are graphs; shortest-path algorithms produce the route.' },
      { id: 'statistics', why: 'The Kalman filter is recursive Bayesian estimation for linear systems with Gaussian noise.' },
      { id: 'computational-geometry', why: 'Collision checking asks whether geometric shapes intersect.' },
    ],
  },
];

export const disciplineById = Object.fromEntries(disciplines.map((d) => [d.id, d]));
export const disciplineColor = (id) => GROUPS[(disciplineById[id] || {}).group || 'foundations'].color;
