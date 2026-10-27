// The two tracks the atlas leads with. A track is an editorial choice: which published
// lessons matter most to one kind of reader, and in what groups. It adds nothing to a
// lesson. Everything shown about a lesson on a track page comes from the lesson itself.
//
//   lessons   lessons in the group, published or planned. Each is an id, or on the business
//             guide an object:
//               id        the lesson
//               role      'direct'  the lesson itself models a recognisable business problem
//                         'method'  the lesson teaches a general method on a simplified example
//               question  the business decision, as a question. It leads the card.
//               bridge    what the method does for that decision, what the lesson's own
//                         demonstration is when it is a simplified one, and where the method
//                         stops being reliable. Two to four plain sentences.
//             Lessons these lean on are found from the lessons' own prerequisites and shown
//             as technical foundations. They are not listed here.
//   paths     existing learning paths that walk through the same ground in order.
//
// The business question and bridge are also shown on the lesson itself, beside its
// demonstration, so a reader who arrives at a simple example knows what it stands for.
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
    blurb: 'Each lesson here starts from a decision a business has to make. The question comes first, then what the method does for it and where it stops being reliable.',
    reader: 'Most of these lessons teach a method on a small, simple example, and each card says so. For people who have to decide whether a method fits a problem, and for people who will then build it.',
    cases: ['budget'],
    groups: [
      { title: 'What will happen, and how sure are we?', short: 'Forecasting', blurb: 'Turning what you have observed into an estimate, and being honest about how far to trust it.',
        lessons: [
          { id: 'ab-testing', role: 'direct', question: 'Did the change we made actually work, or was it chance?',
            bridge: 'Show two versions to similar groups of customers and compare the results. The test tells you how surprising the difference would be if the two versions were really the same. It can only be trusted if you fix the sample size first and do not stop early because the numbers look good.' },
          { id: 'exponential-smoothing', role: 'direct', question: 'How much will we sell next month?',
            bridge: 'Forecast from your own sales history, giving recent months more say than old ones and allowing for a trend and a busy season. It assumes the future resembles the recent past, so it cannot foresee a promotion, a new competitor or a shock.' },
          { id: 'linear-regression', role: 'method', question: 'How does one number move when another changes?',
            bridge: 'Fit a straight line through past figures, such as sales against advertising spend, to estimate the effect and make a first forecast. The lesson fits a line to a small scatter of points. A line describes a pattern in the data. It does not show that one thing causes the other.' },
          { id: 'logistic-regression', role: 'method', question: 'How likely is a yes: a purchase, a click, a missed payment?',
            bridge: 'Turn what you know about a customer or a case into a probability between 0 and 1. The lesson separates two groups of points with a straight boundary. Real behaviour is rarely that tidy, so treat the probabilities as estimates and check them against what actually happened.' },
          { id: 'bayesian-updating', role: 'method', question: 'How much should new evidence change what we believe?',
            bridge: 'Start from what you believed before, such as a typical conversion rate, and adjust it as results arrive, without overreacting to a small sample. The lesson uses a coin whose fairness is unknown. The answer depends on the starting belief, so state that belief openly.' },
          { id: 'monte-carlo', role: 'method', question: 'What range of outcomes should we plan for when demand, costs or timings are uncertain?',
            bridge: 'Run thousands of plausible scenarios and look at the spread of results, not at a single forecast. The lesson shows the sampling on the simplest case there is, estimating π from random points. A simulation is only as good as the assumptions fed into it, and more runs sharpen the answer slowly.' },
          { id: 'binomial-option-pricing', role: 'direct', question: 'What is the right to decide later worth today?',
            bridge: 'Value an option, such as the right to buy at a fixed price, by laying out the ways the price could move and working backward from the end. The model assumes prices move in fixed up and down steps of a known size. This is an explanation of a model, not advice.' },
        ] },
      { title: 'Who are our customers, and what matters in our network?', short: 'Customers and networks', blurb: 'Finding the groups, the likenesses and the influence that are already in your data.',
        lessons: [
          { id: 'k-means', role: 'method', question: 'What natural groups do our customers fall into?',
            bridge: 'Sort customers into a chosen number of groups whose members resemble each other, for example by spend and how often they visit. The lesson groups unlabelled points on a plane. The method always returns the number of groups you ask for, whether or not the groups are real, so check that they mean something.' },
          { id: 'knn', role: 'method', question: 'What did similar customers do?',
            bridge: 'Predict what a new case will do, or recommend something, by looking at the most similar past cases. The lesson classifies a new point by its nearest neighbours. Everything depends on a sensible measure of similarity, and answers get slower as the history grows.' },
          { id: 'decision-tree', role: 'method', question: 'Which customers are likely to leave, and why?',
            bridge: 'Turn past cases into a short list of yes-or-no questions that anyone can read and challenge. The lesson grows a tree on a small set of points with two measurements. A tree allowed to grow deep memorises the past instead of learning from it, so check its accuracy on cases it has not seen.' },
          { id: 'pagerank', role: 'method', question: 'Who or what matters most in a network?',
            bridge: 'Score the pages of a site, the accounts in a network or the suppliers in a chain by who points to them, counting a link from something important for more. The lesson ranks a small web of pages. It sees only the links, so it can be gamed and it knows nothing about quality.' },
        ] },
      { title: 'How should we use limited money, time and capacity?', short: 'Money, time and capacity', blurb: 'Getting the most from a budget, ordering work that depends on other work, and moving things at the least cost.',
        lessons: [
          { id: 'knapsack', role: 'method', question: 'Which projects should we fund with a fixed budget?',
            bridge: 'Choose the set of all-or-nothing options that gives the most value without going over one limit. The lesson packs plain items into a bag with a weight limit, and the worked case on this page runs the same method on a budget. It handles a single limit, and it assumes the value of each choice does not depend on the others.' },
          { id: 'simplex', role: 'direct', question: 'What mix of products earns the most under several limits at once?',
            bridge: 'Decide how much of each product to make when labour, materials and machine time are all limited. The lesson solves a two-product plan that can be drawn as a picture. It assumes profit and the use of each resource grow in straight proportion, with no bulk discounts and no minimum batch.' },
          { id: 'critical-path', role: 'direct', question: 'How long will the project take, and which tasks cannot slip?',
            bridge: 'Work out the earliest finish date from the tasks, how long each takes and what depends on what, and find the chain of tasks with no slack. It treats every duration as certain and assumes enough people for tasks to overlap, so a real plan needs a margin.' },
          { id: 'topological-sort', role: 'method', question: 'In what order can the work be done?',
            bridge: 'Put tasks, build steps or approvals into an order that never starts something before the things it depends on. The lesson orders the nodes of a small dependency graph. It gives one valid order, not the best one, and it tells you when the dependencies go round in a circle.' },
          { id: 'dijkstra', role: 'method', question: 'What is the cheapest route through our network?',
            bridge: 'Find the least costly way from one place to every other, where cost can be distance, time or money. The lesson uses a small graph of nodes and costs. No cost may be negative, and it finds a route between two places, not a delivery round with many stops.' },
          { id: 'kruskal', role: 'method', question: 'What is the cheapest way to connect every site?',
            bridge: 'Lay cable, pipes or links so that every location is connected at the lowest total cost. The lesson connects the nodes of a small graph. The result has no spare links, so one failure cuts it in two, and it does not give the shortest route between two sites.' },
          { id: 'simulated-annealing', role: 'method', question: 'How do we find a good plan when there are too many to try?',
            bridge: 'Improve a timetable, a layout or a delivery round by trying small changes, now and then accepting a worse one so as not to get stuck. The lesson searches a bumpy surface for its lowest point. It gives a good answer, not a proven best, and two runs can disagree.' },
          { id: 'genetic-algorithm', role: 'method', question: 'How do we search for a good design when no formula describes it?',
            bridge: 'Keep a population of candidate designs, combine the better ones and vary them at random, generation after generation. The lesson evolves points toward the low ground of a surface. It needs thousands of trials and promises nothing, so it suits problems where a trial is cheap.' },
        ] },
      { title: 'How do we handle more data than one machine can hold?', short: 'Very large data', blurb: 'What changes when the data never stops arriving, or no longer fits in one place.',
        lessons: [
          { id: 'reservoir-sampling', role: 'method', question: 'How do we take a fair sample of data that never stops arriving?',
            bridge: 'Keep a fixed-size random sample of orders, log lines or sensor readings as they stream past, without storing them all or knowing how many will come. The lesson samples a short stream of numbers. Every item gets the same chance, so it cannot favour recent data.' },
          { id: 'consistent-hashing', role: 'method', question: 'How do we share load across servers that come and go?',
            bridge: 'Decide which server holds which customer\'s data so that adding or removing a server moves only a small share of it. The lesson places servers and keys on a ring. It decides who holds what and nothing else: copies, failures and uneven demand need further machinery.' },
        ] },
      { title: 'How do we keep information private?', short: 'Privacy', blurb: 'How a message is locked so that only the intended reader can open it.',
        lessons: [
          { id: 'rsa', role: 'method', question: 'How can a customer send us a secret without meeting us first?',
            bridge: 'Publish a key that anyone can use to lock a message and that only you can unlock. The lesson uses tiny primes so that every number can be seen. Real systems use keys hundreds of digits long, add padding, and rely on a tested library. Never build your own.' },
        ] },
    ],
    paths: ['optimization-operations-research', 'quantitative-finance', 'cryptography-security'],
  },
];
