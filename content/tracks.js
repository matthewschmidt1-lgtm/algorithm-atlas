// The two tracks the atlas leads with. A track is an editorial choice: which published
// lessons matter most to one kind of reader, and in what groups. It adds nothing to a
// lesson. Everything shown about a lesson on a track page comes from the lesson itself.
//
//   lessons   ids of lessons, published or planned. A planned lesson is shown as planned.
//   why       (business track) for each lesson, one of the problem phrases that lesson
//             already declares in meta.tags.problems. It is the decision the lesson helps
//             with. tools/test.py fails if the lesson does not declare the phrase.
//   paths     existing learning paths that walk through the same ground in order.
//
// Lessons outside both tracks are not hidden. They stay in the library, the map and the
// search, and a track page lists the ones its lessons lean on.

export const tracks = [
  {
    id: 'ai',
    title: 'AI and machine learning',
    short: 'AI & ML',
    blurb: 'How machines learn from data, reason when they are unsure, search for a plan, and generate something new. Each lesson runs the real method in front of you.',
    reader: 'For people who want to understand these methods well enough to use them, and for people who will build with them.',
    groups: [
      { title: 'How a model learns', blurb: 'Almost all of machine learning is one idea: measure how wrong you are, then change the numbers a little in the direction that makes you less wrong.',
        lessons: ['gradient-descent', 'linear-regression', 'logistic-regression', 'perceptron', 'backpropagation', 'stochastic-gradient-descent', 'adam'] },
      { title: 'Learning from examples', blurb: 'Deciding what something is, or which things belong together, by how close it sits to what you have already seen.',
        lessons: ['knn', 'k-means', 'decision-tree', 'pca'] },
      { title: 'Reasoning when you are not sure', blurb: 'Working with chance instead of pretending it away: updating a belief, estimating by sampling, tracking something through noisy readings.',
        lessons: ['bayesian-updating', 'monte-carlo', 'metropolis-hastings', 'kalman-filter', 'particle-filter'] },
      { title: 'Search and planning', blurb: 'Finding a route, a plan or a good design when there are far too many possibilities to try them all.',
        lessons: ['a-star', 'rrt', 'simulated-annealing', 'genetic-algorithm', 'minimax', 'q-learning'] },
      { title: 'Images, language and graphs', blurb: 'How networks are shaped for pictures, for sequences of words and for things joined by links, and one model that generates images. Each demonstration is a small worked computation, not a trained model.',
        lessons: ['ddpm', 'attention', 'byte-pair-encoding', 'convolution', 'graph-neural-network'] },
    ],
    paths: ['machine-learning-first-principles', 'ai-foundations', 'deep-learning', 'generative-ai'],
  },
  {
    id: 'business',
    title: 'Decisions in business',
    short: 'Business',
    blurb: 'The methods behind forecasts, customer groups, budgets, schedules and routes. Each lesson says what the method needs, when to use it, and where it falls short.',
    reader: 'For people who have to decide whether a method fits a problem, and for people who will then build it.',
    groups: [
      { title: 'Predict and weigh risk', blurb: 'Turning past data into an estimate, and being honest about how sure you can be.',
        lessons: ['ab-testing', 'exponential-smoothing', 'linear-regression', 'logistic-regression', 'bayesian-updating', 'monte-carlo', 'binomial-option-pricing'],
        why: { 'ab-testing': 'did my change make a difference', 'exponential-smoothing': "forecast next month's sales", 'linear-regression': 'forecast from past data', 'logistic-regression': 'predict yes or no', 'bayesian-updating': 'update a belief with new evidence', 'monte-carlo': 'risk analysis', 'binomial-option-pricing': 'put a value on a choice you can make in the future' } },
      { title: 'Understand customers and networks', blurb: 'Finding the groups, the likenesses and the influence that are already in your data.',
        lessons: ['k-means', 'knn', 'pagerank', 'decision-tree'],
        why: { 'k-means': 'segment customers', knn: 'recommend similar things', pagerank: 'measure influence in a network', 'decision-tree': 'which customers are likely to leave' } },
      { title: 'Plan, schedule and allocate', blurb: 'Getting the most from a limited budget, ordering work that depends on other work, and moving things at the least cost.',
        lessons: ['knapsack', 'simplex', 'critical-path', 'topological-sort', 'dijkstra', 'kruskal', 'simulated-annealing', 'genetic-algorithm'],
        why: { simplex: 'what mix of products earns the most', 'critical-path': 'how long will the project take', knapsack: 'select projects within a budget', 'topological-sort': 'schedule jobs with prerequisites', dijkstra: 'route planning', kruskal: 'cheapest way to connect everything', 'simulated-annealing': 'find a good arrangement', 'genetic-algorithm': 'find a good design' } },
      { title: 'Run it at scale, and keep it private', blurb: 'What changes when the data no longer fits on one machine, and how information is kept from people who should not see it.',
        lessons: ['reservoir-sampling', 'consistent-hashing', 'rsa'],
        why: { 'reservoir-sampling': 'sample log entries', 'consistent-hashing': 'share load between machines', rsa: 'keep data private' } },
    ],
    paths: ['optimization-operations-research', 'quantitative-finance'],
  },
];
