// The search benchmark: questions people might type, with a judgement of which results
// would be right. Run by tools/test.py. It measures two things and both matter:
//
//   answered   of the questions the atlas can answer, how many show a right result in the top three
//   precision  of everything shown in the top three, how much was right
//
// A search that shows something for every question but often shows the wrong lesson scores
// well on the first and badly on the second, which is why both are reported.
//
// Each fixture:
//   q        the query, exactly as typed
//   set      which group it belongs to (see SETS)
//   ok       refs that count as right in the top three. A lesson id, or "concept:id",
//            "path:id", "discipline:id", "compare:id". Planned lessons count only where listed.
//   none     true when no published lesson answers it. The right behaviour is to show nothing
//            as a match (a planned lesson listed in `ok`, or clearly labelled broader
//            suggestions, are fine).
//   forbid   refs that must not appear in the top three, because showing them would mislead
//   was      for the questions of the original audit: how the search did before this work
//
// The "heldout" set was written before any change to the search and was not used to tune it.
// Do not edit a fixture to make a failing search pass. (A result nobody had judged may be
// added to `ok` when it is plainly right: two discipline pages were added that way.) Add the missing vocabulary to
// content/synonyms.js or to the lesson's own aliases and problem phrases instead.

export const SETS = {
  original: 'The fifteen questions of the original audit',
  audit: 'Further questions tried during the audit',
  plural: 'Singular and plural forms',
  typo: 'Misspellings and run-together names',
  abbrev: 'Abbreviations and aliases',
  everyday: 'Everyday applications',
  trap: 'False-positive risks',
  none: 'Questions the atlas cannot answer',
  expert: 'Precise queries from someone who knows the subject',
  heldout: 'Held out: written before the changes and never tuned against',
};

const SORTS = ['quick-sort', 'merge-sort', 'insertion-sort', 'heap-sort', 'counting-sort', 'bubble-sort', 'selection-sort', 'compare:sorting'];
const ROUTES = ['dijkstra', 'a-star', 'bfs', 'bellman-ford', 'concept:shortest-path', 'compare:shortest-path'];
const COMPRESS = ['lz77', 'huffman-coding', 'run-length-encoding', 'concept:entropy', 'concept:prefix-code', 'compare:lossless-compression', 'discipline:information-theory'];
const SECRET = ['rsa', 'diffie-hellman', 'concept:public-key-cryptography', 'modular-exponentiation', 'discipline:cryptography', 'path:cryptography-security'];
const ALIGN = ['needleman-wunsch', 'edit-distance', 'lcs'];
const ROOTS = ['newtons-method', 'bisection-method', 'compare:root-finding'];
const ODES = ['euler-method', 'runge-kutta-4', 'compare:ode-integration'];
const TRAIN = ['gradient-descent', 'backpropagation', 'perceptron', 'logistic-regression', 'concept:neural-network', 'concept:loss-function'];
const CLASSIFY = ['logistic-regression', 'perceptron', 'knn', 'backpropagation', 'concept:supervised-learning'];

export const fixtures = [
  /* ---- the original fifteen ---- */
  { q: 'how do I find the fastest route', set: 'original', was: 'pass', ok: ROUTES },
  { q: 'shortest route between two places', set: 'original', was: 'pass', ok: ROUTES },
  { q: 'put a list in order', set: 'original', was: 'pass', ok: SORTS },
  { q: 'make a file smaller', set: 'original', was: 'pass', ok: COMPRESS },
  { q: 'keep a message secret', set: 'original', was: 'pass', ok: SECRET },
  { q: 'how does Netflix know what I like', set: 'original', was: 'fail', ok: ['knn', 'k-means'], forbid: ['bayesian-updating'] },
  { q: 'predict house prices', set: 'original', was: 'fail', ok: ['linear-regression'], forbid: ['path:quantitative-finance'] },
  { q: 'find groups in data', set: 'original', was: 'pass', ok: ['k-means', 'union-find', 'knn', 'kruskal', 'concept:unsupervised-learning'] },
  { q: 'how does Google rank pages', set: 'original', was: 'pass', ok: ['pagerank'] },
  { q: 'why does my GPS reroute', set: 'original', was: 'fail', ok: [...ROUTES, 'kalman-filter'] },
  { q: 'how do computers generate images', set: 'original', was: 'pass', ok: ['ddpm', 'path:generative-ai', 'discipline:deep-learning'], forbid: ALIGN },
  { q: 'find a word in a document', set: 'original', was: 'marginal', ok: ['hash-table', 'linear-search', 'binary-search', 'lz77', 'edit-distance'] },
  { q: 'schedule tasks', set: 'original', was: 'pass', ok: ['topological-sort', 'concept:topological-order'] },
  { q: 'spot spam', set: 'original', was: 'fail', ok: ['logistic-regression', 'bayesian-updating', 'concept:supervised-learning'] },
  { q: 'guess a number quickly', set: 'original', was: 'pass', ok: ['binary-search', 'bisection-method'] },

  /* ---- further questions from the audit ---- */
  { q: 'how does autocorrect work', set: 'audit', was: 'pass', ok: ['edit-distance', 'lcs'] },
  { q: 'what is the best way to pack a bag', set: 'audit', was: 'fail', ok: ['knapsack'], forbid: ['dijkstra', 'a-star', 'bfs', 'bellman-ford'] },
  { q: 'recommend movies', set: 'audit', was: 'fail', ok: ['knn', 'k-means'] },
  { q: 'how does a computer play chess', set: 'audit', was: 'fail', none: true, ok: ['minimax'] },
  { q: 'is this number prime', set: 'audit', was: 'pass', ok: ['sieve-of-eratosthenes', 'concept:prime-numbers', 'miller-rabin'] },
  { q: 'draw a line of best fit', set: 'audit', was: 'pass', ok: ['linear-regression'] },
  { q: 'solve a maze', set: 'audit', was: 'pass', ok: ['dfs', 'bfs', 'a-star'] },
  { q: 'how do maps work', set: 'audit', was: 'fail', ok: ROUTES, forbid: ['backpropagation', 'pagerank'] },
  { q: 'how does ChatGPT work', set: 'audit', was: 'fail', none: true, ok: ['attention', 'byte-pair-encoding', 'backpropagation', 'gradient-descent'] },
  { q: 'find duplicates', set: 'audit', was: 'pass', ok: ['hash-table'] },
  { q: 'generate random numbers', set: 'audit', was: 'fail', ok: ['monte-carlo', 'reservoir-sampling', 'metropolis-hastings', 'concept:randomization', 'concept:sampling'], forbid: ALIGN },
  { q: 'find the cheapest flights', set: 'audit', was: 'pass', ok: ROUTES },
  { q: 'how do passwords get stored', set: 'audit', was: 'fail', none: true, ok: ['sha-256'], forbid: ['discipline:distributed-systems'] },

  /* ---- singular and plural ---- */
  { q: 'predict a house price', set: 'plural', ok: ['linear-regression'] },
  { q: 'sort lists', set: 'plural', ok: SORTS },
  { q: 'sorting a list', set: 'plural', ok: SORTS },
  { q: 'find primes', set: 'plural', ok: ['sieve-of-eratosthenes', 'concept:prime-numbers', 'miller-rabin'] },
  { q: 'find a prime number', set: 'plural', ok: ['sieve-of-eratosthenes', 'concept:prime-numbers', 'miller-rabin'] },
  { q: 'compress a file', set: 'plural', ok: COMPRESS },
  { q: 'compressing files', set: 'plural', ok: COMPRESS },
  { q: 'shortest paths', set: 'plural', ok: ROUTES },
  { q: 'ranking web pages', set: 'plural', ok: ['pagerank'] },
  { q: 'rank a web page', set: 'plural', ok: ['pagerank'] },
  { q: 'grouping similar items', set: 'plural', ok: ['k-means', 'knn', 'union-find', 'concept:unsupervised-learning'] },
  { q: 'movie recommendations', set: 'plural', ok: ['knn', 'k-means'] },
  { q: 'recommend a movie', set: 'plural', ok: ['knn', 'k-means'] },
  { q: 'detecting cycles', set: 'plural', ok: ['dfs', 'union-find', 'topological-sort', 'bellman-ford'] },
  { q: 'detect a cycle', set: 'plural', ok: ['dfs', 'union-find', 'topological-sort', 'bellman-ford'] },
  { q: 'encrypting messages', set: 'plural', ok: SECRET },
  { q: 'find a duplicate', set: 'plural', ok: ['hash-table'] },
  { q: 'simulating pendulums', set: 'plural', ok: ODES },
  { q: 'word frequencies', set: 'plural', ok: ['hash-table', 'counting-sort', 'huffman-coding'], forbid: ['fft'] },
  { q: 'frequencies in a signal', set: 'plural', ok: ['fft', 'concept:fourier-transform'] },

  /* ---- misspellings and run-together names ---- */
  { q: 'djikstra', set: 'typo', ok: ['dijkstra'] },
  { q: 'dijsktra', set: 'typo', ok: ['dijkstra'] },
  { q: 'dijkstras algorithm', set: 'typo', ok: ['dijkstra'] },
  { q: 'quicksort', set: 'typo', ok: ['quick-sort'] },
  { q: 'quik sort', set: 'typo', ok: ['quick-sort'] },
  { q: 'mergesort', set: 'typo', ok: ['merge-sort'] },
  { q: 'binery search', set: 'typo', ok: ['binary-search'] },
  { q: 'huffmann coding', set: 'typo', ok: ['huffman-coding'] },
  { q: 'baysian updating', set: 'typo', ok: ['bayesian-updating'] },
  { q: 'gradiant descent', set: 'typo', ok: ['gradient-descent'] },
  { q: 'fibonnaci', set: 'typo', ok: ['fibonacci-dp'] },
  { q: 'euclidian algorithm', set: 'typo', ok: ['euclidean-algorithm'] },
  { q: 'levenstein', set: 'typo', ok: ['edit-distance'] },
  { q: 'kmeans', set: 'typo', ok: ['k-means'] },
  { q: 'knapsak', set: 'typo', ok: ['knapsack'] },
  { q: 'page rank', set: 'typo', ok: ['pagerank'] },
  { q: 'montecarlo', set: 'typo', ok: ['monte-carlo'] },
  { q: 'breath first search', set: 'typo', ok: ['bfs'] },
  { q: 'depth first serach', set: 'typo', ok: ['dfs'] },
  { q: 'newton raphson', set: 'typo', ok: ['newtons-method'] },
  { q: 'topological sorting', set: 'typo', ok: ['topological-sort', 'concept:topological-order'] },

  /* ---- abbreviations and aliases ---- */
  { q: 'bfs', set: 'abbrev', ok: ['bfs'] },
  { q: 'dfs', set: 'abbrev', ok: ['dfs'] },
  { q: 'fft', set: 'abbrev', ok: ['fft'] },
  { q: 'knn', set: 'abbrev', ok: ['knn'] },
  { q: 'rk4', set: 'abbrev', ok: ['runge-kutta-4'] },
  { q: 'mst', set: 'abbrev', ok: ['kruskal', 'prim', 'concept:spanning-tree'] },
  { q: 'lcs', set: 'abbrev', ok: ['lcs'] },
  { q: 'rle', set: 'abbrev', ok: ['run-length-encoding'] },
  { q: 'gcd', set: 'abbrev', ok: ['euclidean-algorithm'] },
  { q: 'dp', set: 'abbrev', ok: ['fibonacci-dp', 'knapsack', 'lcs', 'edit-distance', 'concept:dynamic-programming'] },
  { q: 'rsa', set: 'abbrev', ok: ['rsa'] },
  { q: 'mcmc', set: 'abbrev', ok: ['metropolis-hastings'] },
  { q: 'a*', set: 'abbrev', ok: ['a-star'] },
  { q: 'astar', set: 'abbrev', ok: ['a-star'] },
  { q: 'a star search', set: 'abbrev', ok: ['a-star'] },
  { q: 'sgd', set: 'abbrev', none: true, ok: ['stochastic-gradient-descent', 'gradient-descent'] },
  { q: 'pca', set: 'abbrev', none: true, ok: ['pca'] },
  { q: 'bst', set: 'abbrev', none: true, ok: ['binary-search-tree'] },
  { q: 'hcf', set: 'abbrev', ok: ['euclidean-algorithm'] },
  { q: 'sha256', set: 'abbrev', none: true, ok: ['sha-256'] },

  /* ---- everyday applications ---- */
  { q: 'gps navigation', set: 'everyday', ok: [...ROUTES, 'kalman-filter'] },
  { q: 'how does google maps find a route', set: 'everyday', ok: ROUTES },
  { q: 'spam detection', set: 'everyday', ok: ['logistic-regression', 'bayesian-updating', 'concept:supervised-learning'] },
  { q: 'spam filter', set: 'everyday', ok: ['logistic-regression', 'bayesian-updating', 'concept:supervised-learning'] },
  { q: 'how does netflix recommend shows', set: 'everyday', ok: ['knn', 'k-means'] },
  { q: 'how does spotify suggest songs', set: 'everyday', ok: ['knn', 'k-means'] },
  { q: 'spell checker', set: 'everyday', ok: ['edit-distance', 'lcs'] },
  { q: 'zip a file', set: 'everyday', ok: COMPRESS },
  { q: 'video game pathfinding', set: 'everyday', ok: ['a-star', 'dijkstra', 'bfs', 'rrt'] },
  { q: 'self driving car', set: 'everyday', ok: ['a-star', 'rrt', 'kalman-filter', 'dijkstra', 'discipline:robotics', 'path:robotics-autonomous-systems'] },
  { q: 'dna matching', set: 'everyday', ok: ['needleman-wunsch', 'edit-distance', 'lcs', 'discipline:biology'] },
  { q: 'how does shazam recognise a song', set: 'everyday', ok: ['fft', 'concept:fourier-transform'] },
  { q: 'sort a spreadsheet column', set: 'everyday', ok: SORTS },
  { q: 'search my contacts', set: 'everyday', ok: ['binary-search', 'linear-search', 'hash-table'] },
  { q: 'https', set: 'everyday', ok: SECRET },

  /* ---- false-positive risks ---- */
  { q: 'general relativity', set: 'trap', none: true, ok: [], forbid: [...ALIGN, 'genetic-algorithm'] },
  { q: 'different kinds of sorting', set: 'trap', ok: SORTS, forbid: ['edit-distance', 'lcs', 'needleman-wunsch'] },
  { q: 'diffusion model', set: 'trap', ok: ['ddpm', 'path:generative-ai'], forbid: ALIGN },
  { q: 'best way to learn', set: 'trap', ok: ['path:absolute-beginners', 'linear-search', 'binary-search', 'bubble-sort'], forbid: ['dijkstra', 'a-star', 'bellman-ford'] },
  { q: 'search a sorted list', set: 'trap', ok: ['binary-search', 'linear-search', 'compare:searching'], forbid: ['bubble-sort', 'selection-sort', 'heap-sort'] },
  { q: 'normal distribution', set: 'trap', ok: ['metropolis-hastings', 'monte-carlo', 'kalman-filter', 'ddpm', 'concept:probability', 'concept:gaussian-distribution', 'concept:sampling'], forbid: ['consistent-hashing', 'pagerank'] },
  { q: 'line segment intersection', set: 'trap', none: true, ok: ['bresenham-line', 'graham-scan', 'discipline:computational-geometry'], forbid: ['k-means'] },
  { q: 'letter frequencies', set: 'trap', ok: ['huffman-coding', 'counting-sort', 'hash-table'], forbid: ['fft'] },
  { q: 'prim', set: 'trap', none: true, ok: ['prim', 'kruskal'], forbid: ['sieve-of-eratosthenes'] },
  { q: 'gene', set: 'trap', ok: ['needleman-wunsch', 'genetic-algorithm'] },
  { q: 'genetic', set: 'trap', ok: ['genetic-algorithm'] },
  { q: 'hash map', set: 'trap', ok: ['hash-table', 'consistent-hashing', 'concept:hashing'], forbid: ROUTES },
  { q: 'social network', set: 'trap', ok: ['pagerank', 'bfs', 'union-find', 'dfs', 'concept:graph'], forbid: ['backpropagation', 'perceptron'] },
  { q: 'neural network', set: 'trap', ok: [...TRAIN, 'ddpm'] },
  { q: 'tree', set: 'trap', ok: ['kruskal', 'huffman-coding', 'dfs', 'bfs', 'rrt', 'binary-search-tree', 'decision-tree', 'concept:tree', 'concept:spanning-tree', 'concept:heap'] },
  { q: 'compress images', set: 'trap', ok: [...COMPRESS, 'k-means'], forbid: ['ddpm'] },
  { q: 'resort booking', set: 'trap', none: true, ok: [], forbid: SORTS },
  { q: 'zip code lookup', set: 'trap', ok: ['hash-table', 'binary-search', 'linear-search'], forbid: ['lz77', 'huffman-coding', 'run-length-encoding'] },

  /* ---- questions the atlas cannot answer ---- */
  { q: 'translate languages', set: 'none', none: true, ok: ['attention', 'byte-pair-encoding', 'discipline:nlp', 'path:natural-language-processing'] },
  { q: 'undo a mistake', set: 'none', none: true, ok: [] },
  { q: 'how to split a bill', set: 'none', none: true, ok: [] },
  { q: 'weather forecast', set: 'none', none: true, ok: ['euler-method', 'runge-kutta-4', 'kalman-filter', 'linear-regression'] },
  { q: 'blockchain', set: 'none', none: true, ok: ['sha-256'] },
  { q: 'pizza recipe', set: 'none', none: true, ok: [] },
  { q: 'asdfgh', set: 'none', none: true, ok: [] },
  { q: 'how to learn guitar', set: 'none', none: true, ok: [] },
  { q: 'javascript frameworks', set: 'none', none: true, ok: [] },
  { q: 'random forest', set: 'none', none: true, ok: ['decision-tree'] },

  /* ---- precise queries ---- */
  { q: 'dijkstra proof', set: 'expert', ok: ['dijkstra'] },
  { q: 'dijkstra correctness', set: 'expert', ok: ['dijkstra'] },
  { q: 'dijkstra complexity', set: 'expert', ok: ['dijkstra'] },
  { q: 'dijkstra vs a*', set: 'expert', ok: ['compare:shortest-path', 'dijkstra', 'a-star'] },
  { q: 'quick sort vs merge sort', set: 'expert', ok: ['compare:sorting', 'quick-sort', 'merge-sort'] },
  { q: 'merge sort python', set: 'expert', ok: ['merge-sort'] },
  { q: 'heap sort', set: 'expert', ok: ['heap-sort'] },
  { q: 'levenshtein', set: 'expert', ok: ['edit-distance'] },
  { q: 'disjoint set union', set: 'expert', ok: ['union-find'] },
  { q: 'kahn', set: 'expert', ok: ['topological-sort'] },

  /* ---- held out ---- */
  { q: 'quickest way to get across town', set: 'heldout', ok: ROUTES },
  { q: 'arrange names alphabetically', set: 'heldout', ok: SORTS },
  { q: 'shrink a photo', set: 'heldout', ok: [...COMPRESS, 'k-means'] },
  { q: 'is my email spam', set: 'heldout', ok: ['logistic-regression', 'bayesian-updating', 'concept:supervised-learning'] },
  { q: 'songs I might enjoy', set: 'heldout', ok: ['knn', 'k-means'] },
  { q: 'finding the closest match for a misspelled word', set: 'heldout', ok: ['edit-distance', 'lcs', 'knn'] },
  { q: 'plan a project with dependencies', set: 'heldout', ok: ['topological-sort', 'concept:topological-order'] },
  { q: 'connect houses with the least wire', set: 'heldout', ok: ['kruskal', 'prim', 'concept:spanning-tree'] },
  { q: 'what are the odds', set: 'heldout', ok: ['monte-carlo', 'bayesian-updating', 'concept:probability', 'concept:bayes-theorem'] },
  { q: 'how do search engines decide what comes first', set: 'heldout', ok: ['pagerank'] },
  { q: 'teach a computer to tell cats from dogs', set: 'heldout', ok: [...CLASSIFY, ...TRAIN] },
  { q: 'solving equations numerically', set: 'heldout', ok: [...ROOTS, ...ODES, 'discipline:mathematics', 'path:scientific-computing'] },
  { q: 'keep my chats private', set: 'heldout', ok: SECRET },
  { q: 'which servers should store my data', set: 'heldout', ok: ['consistent-hashing', 'hash-table'] },
  { q: 'kruskals', set: 'heldout', ok: ['kruskal'] },
  { q: 'bellman ford', set: 'heldout', ok: ['bellman-ford'] },
  { q: 'baeysian', set: 'heldout', ok: ['bayesian-updating', 'concept:bayes-theorem'] },
  { q: 'selction sort', set: 'heldout', ok: ['selection-sort'] },
  { q: 'hashtable', set: 'heldout', ok: ['hash-table'] },
  { q: 'minimum spanning trees', set: 'heldout', ok: ['kruskal', 'prim', 'concept:spanning-tree'] },
  { q: 'RK4 vs Euler', set: 'heldout', ok: [...ODES] },
  { q: 'merge sort complexity', set: 'heldout', ok: ['merge-sort'] },
  { q: 'how do robots avoid walls', set: 'heldout', ok: ['rrt', 'a-star', 'kalman-filter', 'discipline:robotics', 'path:robotics-autonomous-systems'] },
  { q: 'generate a picture from text', set: 'heldout', ok: ['ddpm', 'path:generative-ai'], forbid: ALIGN },
  { q: 'largest number that divides two numbers', set: 'heldout', ok: ['euclidean-algorithm'] },
  { q: 'random sample from a huge file', set: 'heldout', ok: ['reservoir-sampling'] },
  { q: 'cooking pasta', set: 'heldout', none: true, ok: [] },
  { q: 'generic programming', set: 'heldout', none: true, ok: [], forbid: ['genetic-algorithm', 'fibonacci-dp'] },
  { q: 'primer on sorting', set: 'heldout', ok: SORTS, forbid: ['sieve-of-eratosthenes'] },
  { q: 'gene alignment', set: 'heldout', ok: ['needleman-wunsch', 'edit-distance', 'lcs'] },
  { q: 'transformers', set: 'heldout', none: true, ok: ['attention'] },
  { q: 'elections voting', set: 'heldout', none: true, ok: [] },
  { q: 'draw a straight line with pixels', set: 'heldout', ok: ['bresenham-line'] },
  { q: 'wrap a fence around trees', set: 'heldout', ok: ['graham-scan'] },
  { q: 'how does zip work', set: 'heldout', ok: COMPRESS },
  { q: 'medical test accuracy', set: 'heldout', ok: ['bayesian-updating', 'concept:bayes-theorem'] },
  { q: 'learning rate', set: 'heldout', ok: ['gradient-descent', 'backpropagation', 'perceptron', 'concept:learning-rate'] },
  { q: 'detect loops in a linked list', set: 'heldout', ok: ['dfs', 'union-find', 'topological-sort'] },
  { q: 'stable sorting', set: 'heldout', ok: [...SORTS, 'concept:stability'] },
  { q: 'how do computers shuffle cards', set: 'heldout', none: true, ok: ['reservoir-sampling', 'monte-carlo'] },
];

// Score a search function against the fixtures.
//   run(q) must return { top: [ref, ...], broader: [ref, ...] } where `top` is what the
//   interface presents as matches (best first) and `broader` what it presents, separately
//   and labelled, as looser suggestions.
export function score(run, { sets = null } = {}) {
  const rows = [];
  for (const f of fixtures) {
    if (sets && !sets.includes(f.set)) continue;
    const res = run(f.q);
    const top = res.top.slice(0, 3);
    const ok = new Set(f.ok || []);
    const forbid = new Set(f.forbid || []);
    const right = top.filter((r) => ok.has(r));
    const wrong = top.filter((r) => !ok.has(r));
    const forbidden = top.filter((r) => forbid.has(r));
    let verdict;
    if (f.none) verdict = wrong.length ? 'wrong' : 'pass';
    else if (forbidden.length) verdict = 'wrong';
    else if (right.length && ok.has(top[0])) verdict = 'pass';
    else if (right.length) verdict = 'weak';
    else if (!top.length) verdict = 'empty';
    else verdict = 'wrong';
    rows.push({ q: f.q, set: f.set, was: f.was || '', none: !!f.none, top, right: right.length, shown: top.length, forbidden, broader: (res.broader || []).slice(0, 3), note: res.note || '', verdict });
  }
  const summarise = (list) => {
    const answerable = list.filter((r) => !r.none);
    const shown = list.reduce((s, r) => s + r.shown, 0);
    const right = list.reduce((s, r) => s + r.right, 0);
    const unanswerable = list.filter((r) => r.none);
    return {
      queries: list.length,
      answered: answerable.filter((r) => r.right > 0 && !r.forbidden.length).length,
      answerable: answerable.length,
      firstRight: answerable.filter((r) => r.verdict === 'pass').length,
      shown, right,
      precision: shown ? right / shown : 1,
      misleading: list.filter((r) => r.verdict === 'wrong').length,
      quietWhenUnanswerable: unanswerable.filter((r) => r.verdict === 'pass').length,
      unanswerable: unanswerable.length,
    };
  };
  const bySet = {};
  for (const id of Object.keys(SETS)) { const list = rows.filter((r) => r.set === id); if (list.length) bySet[id] = summarise(list); }
  return { rows, bySet, tuned: summarise(rows.filter((r) => r.set !== 'heldout')), heldout: summarise(rows.filter((r) => r.set === 'heldout')), all: summarise(rows) };
}
