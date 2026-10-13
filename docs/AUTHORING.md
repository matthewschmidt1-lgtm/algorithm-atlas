# Authoring a lesson

Every algorithm in the atlas is one file: `content/algorithms/<id>.js`. The lesson page, the
laboratory, the comparison tool, search, the library filters and the knowledge graph are all
generated from that record. Nothing else needs editing to publish a lesson.

**Read these three reference lessons before writing one.** They define the expected depth,
tone and structure:

- `content/algorithms/quick-sort.js` (bars view, experiment, full prose)
- `content/algorithms/dijkstra.js` (graph + rows views, independent reference test)
- `content/algorithms/gradient-descent.js` (scene views, log-scale input, presets)

## The pipeline

```bash
python3 tools/build.py --only my-id,other-id   # validate just your lessons (writes nothing)
python3 tools/shot.py my-id --step mid --out /some/path.png   # screenshot one frame; then look at it
python3 tools/build.py                          # full build: validate all, write the catalog
```

`build.py` runs headless Chrome and for each lesson: validates the record against the schema
(`js/core/schema.js`), executes `viz.run` on the default input, every preset, every quiz
`tryInput` and every test, validates the recorded frames, exercises the experiment, runs the
JavaScript sample in the sandbox, runs the Python sample with `python3`, and compiles and
runs the C++ sample with `clang++ -std=c++17`. Output of all three must equal
`code.sample.expected`. A lesson with any error is not published.

A lesson is done when `build.py --only <id>` prints `ok` with no errors, and you have looked
at at least two screenshots of it (a middle frame and the final frame) and the picture is
clear, uncluttered and correct.

## Accuracy rules (not negotiable)

- Do not invent anything: no made-up history, dates, people, citations, complexity bounds,
  benchmark numbers or deployments. If you are not certain of a fact, leave it out.
- `advanced.references` must be real publications you are confident exist, with correct
  authors, year, title and venue. Prefer the original paper and one standard textbook.
  If unsure of volume or page numbers, omit them rather than guess.
- `applications[].status` is `established` only for well-documented real uses. Use
  `illustrative` for plausible examples. When in doubt, `illustrative`.
- State what complexity bounds assume (`complexity.assumptions`).
- The visualization must be produced by genuinely running the algorithm. Never script
  frames by hand.
- Pseudocode, the three code samples and `viz.run` must implement the same algorithm.
- Only `year` and `authors` in `meta` if you are certain; otherwise omit both.
- Toy cryptography must say it is toy-sized and insecure.

## Three levels, one idea

Every lesson is read at three levels. All three explain the same algorithm. A beginner
must never be given a version that is easier because it is wrong.

| Level | The reader asks | Built from |
| --- | --- | --- |
| 1. Explain it simply | "What is this, in plain words?" | `bigIdea.simple`, `bigIdea.analogy`, `example`, the visualization (picture and notes only), `terms`, `takeaway` |
| 2. Help me understand | "How does it actually work?" | `logic.intuition`, `logic.steps`, live pseudocode, `viz.tryThis`, `code`, why it matters (`bigIdea.interesting`, `bigIdea.when`, `applications`), what could go wrong (`tradeoffs.misunderstandings`, `tradeoffs.struggles`, `logic.mistakes`), `quiz` |
| 3. Go deeper | "Why is it correct, and what does it cost?" | `complexity`, the experiment chart, `logic.correctness`, `advanced.history`, references, `tradeoffs.alternatives` and `comparison` |

Three rules shape the lesson page, and they should shape what you write:

1. **Each level shows only what that level is for.** Level 1 has no notation, no pseudocode and no
   running times on the page at all.
2. **Depth on demand.** Within a level, secondary detail sits in closed folds: `logic.decisions`,
   `logic.edgeCases` with `tradeoffs.pitfalls` and `constraints`, `complexity.assumptions` and
   `memory`, `logic.invariants`, `advanced.derivation`, `proof`, `complexityProof`, `variants`,
   `implementation`, `benchmarking`, `furtherReading`.
3. **Say each thing once.** Every field appears in exactly one place. Do not restate the simple
   explanation in `logic.intuition`, the history in the applications, or the applications in
   `bigIdea.when`. The fields `bigIdea.what`, `bigIdea.why`, `bigIdea.where` and `tradeoffs.excels`
   are no longer shown and need not be written.

Simplicity is the entry point and depth is the invitation. Nobody should need jargon
before they can become curious.

### The Simple Explanation (`bigIdea.simple`)

Write it for an intelligent, curious 12-year-old who has never met the subject.

- 80 to 200 words. Short sentences (aim for under 17 words on average). Everyday words.
- Say what the thing does and why anyone cares, using one familiar situation.
- No notation, no formulas, no code, no Big-O, no unexplained technical word. If a
  technical word is unavoidable, explain it in the same sentence.
- Do not talk down. Plain is not the same as childish.
- The test: could someone with no background explain the basic idea back to you after
  reading only this paragraph? If not, rewrite it.

### The analogy and where it stops (`bigIdea.analogy`)

`title`, `text`, and `limits`. An analogy introduces an idea; it does not replace the
accurate explanation. `limits` says plainly where the picture stops being true.

### The worked example (`example`)

One small case done by hand: `setup` (the input, with any term explained), `steps`
(three to six, each showing what the algorithm does to the actual values) and `result`
(the output, and one thing worth noticing). Use numbers a person can check in their head.
If the visualization can run the same case, add `tryInput: { ...viz inputs }` so the
reader can watch it, and add a test that pins the numbers you quote.

### Words to know (`terms`)

`[{ term, meaning }]`: every technical word the lesson relies on, each defined in one
plain sentence, in the order a reader meets them. At least three. In the prose itself,
define each term the first time it appears, and never introduce several new terms in
one paragraph.

### The Takeaway (`takeaway`)

One memorable sentence a beginner could repeat in their own words. No jargon.

### What could go wrong (`tradeoffs.misunderstandings` and friends)

`tradeoffs.misunderstandings` lists common wrong beliefs, each written as the belief in
quotes followed by the correction. Together with `struggles`, `pitfalls`,
`logic.edgeCases` and `logic.mistakes` it forms the "What could go wrong" section. Never
leave out a caveat because it complicates the story. Put it where the reader is ready for it.

## Writing style

Write like a knowledgeable teacher talking to one person.

- Plain, direct, concrete. Prefer short sentences, and vary their length.
- No em dashes, and no en dashes used as punctuation. Use a comma, a colon, a full stop,
  or restructure the sentence. The validator rejects em dashes.
- No stock phrases ("in today's world", "it's important to note", "let's dive in",
  "game-changing", "at its core", "delve"). No hype (revolutionary, powerful, magic,
  elegant). No exclamation marks. No summary sentences that repeat what was just said.
- Accuracy comes before simplicity. Simplify the language, not the truth.
- Prefer a concrete example to an abstract description.
- Use the same word for the same thing throughout a lesson.
- Frame notes (`note`) narrate what just happened and why, with the actual numbers, in
  words a level 1 reader can follow.
- If something is uncertain or disputed, say so.
- Inline markup available in all prose strings: `` `code` ``, `**bold**`, `*italic*`,
  `$inline TeX$`, `$$display TeX$$`, and links to other lessons `[text](#/algorithm/<id>)`.
  Blank lines separate paragraphs. Lines starting with `- ` form a list.
  In JS strings remember to double backslashes in TeX: `'$\\frac{a}{b}$'`.
  Keep TeX and notation out of level 1 fields (`simple`, `example`, `terms`, `takeaway`).

## Record shape

The default export is one object. `js/core/schema.js` lists every enumeration
(`KINDS`, `PARADIGMS`, `TIME_CLASSES`, `SPACE_CLASSES`, `CONNECTION_TYPES`, ...) and the
validator states exactly what is required.

```js
export default {
  meta: {
    id, name, aliases: [],            // id must equal the file name; aliases feed search
    kind,                             // algorithm | data-structure | heuristic | model | protocol
    discipline,                       // primary discipline id: must match content/roster.js
    alsoIn: [{ id, why }],            // other disciplines where it is foundational or applied (0 to 4)
    subfield, family,                 // taxonomy: discipline > subfield > family > this
    variantOf,                        // optional rostered id
    lab,                              // laboratory category id (content/lab-categories.js)
    compareGroup,                     // optional, see "Compare groups"
    year, authors,                    // optional; only if certain
    summary,                          // one sentence, at most 190 characters
    difficulty,                       // beginner | intermediate | advanced
    order,                            // learning-order number within the atlas (given in your brief)
    paradigms: [],                    // from PARADIGMS
    randomized: false, approximate: false,
    time: { best, average, worst, class },   // class from TIME_CLASSES
    space: { worst, class },                 // class from SPACE_CLASSES
    tags: { problems: [], techniques: [], applications: [] },  // plain phrases people search for
    prerequisites: [],                // rostered ids and 'concept:<id>' references
  },
  bigIdea: { simple, when, interesting, analogy: { title, text, limits } },
  example: { setup, steps: [], result, tryInput? },   // a small case worked by hand
  terms: [{ term, meaning }],                         // plain definitions, at least 3
  takeaway,                                           // one sentence
  viz: { describe, inputs, presets, tryThis, run, report, experiment },
  logic: { intuition, steps, pseudocode, decisions, invariants, edgeCases, correctness, mistakes },
  code: { sample: { input, expected }, python: { source, notes }, javascript: { source }, cpp: { source } },
  complexity: { summary, cases: [{ case, time, when }], space, memory, tradeoffs, assumptions },
  tradeoffs: { struggles, pitfalls, misunderstandings, constraints, alternatives: [{ id?, name, when }], comparison? },
  applications: [{ title, text, status }],        // at least 3
  connections: [{ to, type, why }],               // at least 4; why explains the shared principle
  quiz: [ ... ],                                  // at least 4, with one of each type
  compare: { idea, requires, sensitivity, memory, difficulty, difficultyNote, limits, useWhen },
  advanced: { history, derivation?, proof?, complexityProof?, variants, implementation, benchmarking, references, furtherReading },
  tests: [{ name, input, check(result, counters) }],   // at least 2; check returns true or an error string
};
```

`tags.problems` should include the everyday phrasing a newcomer would type
("shortest route", "compress files", "make a neural network learn").

`tags.applications` should reuse this vocabulary where it fits: navigation, networking,
databases, search engines, compilers, operating systems, machine learning, computer graphics,
games, robotics, finance, bioinformatics, security, data compression, signal processing,
scientific computing, logistics, natural language, image processing, distributed systems,
statistics, standard libraries, data processing, engineering design.

References (`prerequisites`, `connections[].to`, `alternatives[].id`) may point to any id in
`content/roster.js` (including lessons other authors are writing and planned ones),
to `concept:<id>` (ids in `CONCEPT_IDS` in the roster), or, for connections,
`discipline:<id>`. The validator rejects anything else. Link text to other lessons with
`[name](#/algorithm/<id>)` only for roster entries whose status is `published`.

### Connections

`type` is one of `prerequisite`, `related`, `variant`, `same-problem`, `advanced`,
`application`. Include a mix: prerequisites (lessons and concepts), same-problem
alternatives, something more advanced, and at least one application in another
discipline (`discipline:<id>`). The `why` must state the shared principle in one or two
sentences ("Both relax edges until ...") and never just "related to X".

These sentences are shown in more places than the lesson's own Connections section. The
step offered at the foot of a lesson, the reasons given for recommendations, and the
connection graph all quote them. So write each one to make sense on its own, naming both
things. Use `prerequisite` and `advanced` only when you mean an order of learning: a
lesson that names another as a prerequisite is shown on that other lesson as "Builds on
this". `tools/test.py` fails if two lessons each call the other a prerequisite.

### Cost and approach are different things

`meta.time.class` names how the work typically grows with the size of the input, from a
fixed list (`constant`, `logarithmic`, `linear`, `linearithmic`, `quadratic`, `cubic`,
`polynomial`, `pseudo-polynomial`, `exponential`, and `iterative` for methods whose cost is
the number of steps you choose to run). `meta.time.worst` is the worst case, written out.
The site turns the class into one standard wording everywhere ("Linear time", "Time set by
steps run"), so do not put a description of the method in either field. How the method
works (greedy, dynamic programming, local search) belongs in `meta.paradigms`, which is
always shown under its own label, "Approach".

### The business guide (`content/tracks.js`, `content/cases.js`)

The business guide is built for someone with a decision to make. Each lesson on it has a
`role`, a `question` and a `bridge`:

- `role: 'direct'` when the lesson itself models a recognisable business problem,
  `'method'` when it teaches a general method on a simplified example. Lessons that only
  support others are not listed: the page finds them from prerequisites and labels them
  technical foundations.
- `question` is the decision, as a question, without naming the method.
- `bridge` says what the method does for that decision, what the lesson's own example is
  when it is a simplified one ("The lesson ..."), and where the method stops being reliable.

Do not replace a simple teaching example with a business one to make a lesson look more
practical. Keep the example that teaches the mechanics best and let the bridge say what it
stands for. The same question and bridge appear on the lesson beside its demonstration.

A worked case (`content/cases.js`) runs one lesson's real method on a business problem
with realistic, invented figures, and says what the model leaves out. Add one only when it
can be checked: `tools/test.py` compares the budget case with a search over every
combination.

### Problem phrases (`meta.tags.problems`)

Each phrase is something a person might say they want to do, in everyday words: "find an
item in a list", "pack the most value into a limited bag". They are the single source
for two things: search, and the "I want to" page (`#/problems`), which lists every phrase
and links it to the lessons that declare it. There is no second list to keep in step.
Prefer a sentence with a verb to a term of art, give each lesson at least one phrase no
other lesson uses, and do not name the algorithm in it.

### Quiz

```js
{ type: 'choice',  q, options: [..], answer: index, explain: [one string per option] }
{ type: 'predict', q, options, answer, explain, tryInput: { ...viz inputs } }   // learner predicts, then runs it
{ type: 'debug',   q, code: `...`, options, answer, explain }
{ type: 'challenge', title, prompt, hints: [] }
```

`explain` gives feedback for every option, right and wrong, saying why. The page adds
"Correct." or "Not quite." itself, so an explanation need not begin with a verdict (one
that does has it removed). `tryInput` loads
that input into the lesson's visualization so the learner can check the prediction; the
stated answer must be what the visualization actually shows (add a test that proves it).

## The visualization

```js
viz: {
  describe: 'Text alternative: what the picture shows and what the colours mean.',
  inputs: [ ... ],            // controls; see below
  presets: [{ label, values: { inputId: value } }],
  tryThis: ['...', '...'],    // at least two guided experiments, each naming what to change and what to watch
  run(input, t) { ... return result; },
  report: (result, counters, input) => 'plain text for the output panel',
  experiment: { ... },        // optional, see below
}
```

### `run(input, t)`

`input` is an object with one property per declared input. `t` is the tracer:

```js
t.count('comparisons');            // increment a named counter (optionally t.count(name, by))
t.frame(() => ({                   // record a step. The function is not called in count-only mode,
  line: 3,                         //   0-based index into logic.pseudocode, or an array, or null
  note: 'Plain-language explanation of this step, with **the actual values**.',
  views: [ ... ],                  //   one or more views (first is the main picture)
  vars: { i: 2, pivot: 7 },        //   optional small key/value state readout
  ask: { q, options: [..], answer: index },   // optional, see "Prediction" below
}));
```

- Always build frames inside the `() => ({...})` thunk and **copy** mutable state there
  (`values: a.slice()`), because frames are kept.
- Record a frame for every meaningful step: each comparison, relaxation, update. Aim for
  20 to 300 frames on the default input. Start with a frame that explains the setup and end
  with one that states the result.
- Throw `new Error('helpful message')` for inputs the algorithm cannot handle; the player
  shows the message.
- Return a result object for `report`, the tests and the comparison tool.
- `run` must be deterministic: use `makeRng(input.seed)`, never `Math.random()`.
- It is also called in count-only mode with large inputs for the experiment, so do not
  do expensive work outside the thunks that only the picture needs.
- A note for a step that makes a claim must give the reason, and name any rule the claim
  depends on. "Its distance is final" is not enough; "no edge has a negative cost, so a
  detour could only add to it" is. Do not let a counter move without a step that says what
  was done.
- Where an input breaks a rule the algorithm depends on, prefer showing what goes wrong to
  refusing to run, provided the demonstration does exactly what the code on the page would
  do and the last step compares the answer with the truth. Refuse only where there is no
  answer to compare with, and say why.

#### Prediction (an experiment, in two lessons so far)

A frame may carry `ask: { q, options, answer }`. When the reader turns on "Ask me to
predict each step first", the player stops before that frame, shows the question, and
reveals the frame once they answer. Compute the answer in `run` from the same values the
step uses, never by hand, and list the options in an order that gives nothing away. It is
in Binary Search and Dijkstra only, until it has been tried with real learners.

### Inputs

```js
{ id, label, type: 'range', min, max, step, default, help? }       // add scale: 'log' for rates and tolerances
{ id, label, type: 'select', options: [{ value, label }], default }
{ id, label, type: 'seed', default }                               // number field with a Randomize button
{ id, label, type: 'number', default, min?, max? }
{ id, label, type: 'list', default: [], maxLength, min?, max?, integer? }   // run() receives number[]
{ id, label, type: 'text', default, maxLength }
{ id, label, type: 'toggle', default }
{ id, label, type: 'cells', default: [] }                          // edited by clicking grid cells
```

Use the shared helpers so related lessons accept identical inputs:

| Helper | From | Gives |
| --- | --- | --- |
| `arrayInputs()`, `resolveArray(input)` | `js/lib/arrays.js` | list of numbers from size / order / seed, or custom values |
| `searchInputs()`, `resolveSearch(input)` | `js/lib/arrays.js` | `{ array (sorted, distinct), target }` |
| `graphInputs()`, `resolveGraph(input, opts)`, `adjacency(g)`, `graphView(g, {...})`, `layoutTree(root, children)` | `js/lib/graphs.js` | random or typed graphs with positions; `opts`: `directed`, `weighted`, `dag` |
| `gridInputs()`, `makeGrid(input)`, `neighbors4`, `manhattan`, `gridView(grid, roleOf)` | `js/lib/grids.js` | grid worlds with clickable walls |
| `LANDSCAPES`, `landscapeById`, `landscapeOptions`, `landscapeLayers(L)`, `fromUnit` | `js/lib/landscapes.js` | 2-D objective functions with gradients and contour layers |
| `makeRng(seed)` | `js/lib/rng.js` | `next()`, `float(lo,hi)`, `int(lo,hi)`, `normal(mu,sigma)`, `pick(arr)`, `shuffle(arr)` |

For graph lessons the source is the first node (`graph.nodes[0].id`, the leftmost) and
the target is the last node (the rightmost).

### Views

Each frame carries `views: [...]`. Every view may have `title` and
`legend: [{ label, role }]`. Open `tools/gallery.html` through a local server to see each kind.

**Roles** colour things consistently across the site. The palette is deliberately small
and natural (forest green, moss, sage, terracotta, ochre, brick, ink). Use the semantic
role that fits; use a colour name only for neutral series such as clusters.

| Colour | Semantic roles | Colour-name role |
| --- | --- | --- |
| terracotta (the thing happening now) | `active`, `current`, `on` | `terracotta` |
| ochre (candidates under consideration) | `compare`, `frontier` | `ochre` |
| brick (something moved, refused or aimed at) | `swap`, `alert`, `rejected`, `goal`, `target` | `brick` |
| ink (anchors) | `pivot`, `special`, `source`, `start` | `ink` |
| forest green (finished and final) | `done`, `sorted`, `path`, `tree` | `forest` |
| moss, sage (quiet series, contours) | | `moss`, `sage` |
| neutral | `default`, `dim`, `visited`, `wall`, `empty`, `muted`, `text`, `faint`, `off` | |

For several neutral series (clusters, classes, chains) assign colours in this order:
`forest`, `terracotta`, `ochre`, `moss`, `ink`, `brick`, `sage` (exported as `SERIES`
from `js/viz/theme.js`). Never rely on colour alone: say what happened in the note, and
give every multi-colour view a `legend`. There is no cyan, violet, teal, amber or coral.

```js
{ kind: 'bars', values: [5, 2, 9], roles: { 0: 'compare' }, markers: [{ index: 0, label: 'i' }],
  range: [lo, hi], aux: { label: 'buffer', values: [1, null, null], roles: {} } }

{ kind: 'graph', directed: false,
  nodes: [{ id, x, y, label?, sub?, role? }],     // x, y in [0, 1]; sub is a small caption under the node
  edges: [{ u, v, w?, role? }] }                  // edge roles: default, active, tree, path, rejected, dim
// Usually built with graphView(graph, { nodeRole: id => ..., nodeSub: id => ..., edgeRole: edgeIndex => ... })
// Trees: compute positions with layoutTree and emit a graph view.

{ kind: 'grid', rows, cols, cells: [role, ...],   // rows*cols roles: empty, wall, start, goal, frontier, visited, current, path, on, ...
  labels?: [...], editable?: 'toggles' }          // or values: [0..1, ...] with palette: 'gray' | 'heat' for images and heatmaps
// Usually built with gridView(grid, idx => role)

{ kind: 'table', colLabels: [], rowLabels: [], corner: '', cells: [[...]], roles: { 'r,c': 'current' } }

{ kind: 'rows', rows: [{ label: 'Queue', cells: [{ t: 'A', sub: 3, role: 'frontier' }] }] }   // strips of labelled cells

{ kind: 'board', columns: [{ title: 'Alice', role: 'forest', items: [{ label, value, role?, note? }] }] }   // lanes of key/value cards

{ kind: 'scene', x: [min, max], y: [min, max], aspect: 0.56, equal: false, axes: { xLabel, yLabel } | false,
  layers: [
    { type: 'line', points: [[x, y], ...], role, width?, dash?, closed?, fill? },
    { type: 'points', points: [[x, y], ...] | [{ x, y, role?, r?, label? }], role, r?, hollow?, ring? },
    { type: 'segments', segments: [[x1, y1, x2, y2], ...], role, width?, arrow? },
    { type: 'polygon', points, role, fill? },
    { type: 'circle', c: [x, y], r, role, fill? },          // r in data units (pixels: true for screen units)
    { type: 'rect', x, y, w, h, role },                     // filled; obstacles default to the wall colour
    { type: 'bars', xs: [], heights: [], barWidth?, role, roles? },   // histograms, spectra, amplitudes
    { type: 'band', upper: [[x, y]...], lower: [[x, y]...], role },   // uncertainty bands
    { type: 'contour', nx, ny, values, x, y, role, levels },          // see sampleLandscape
    { type: 'heat', nx, ny, values, x, y, role },
    { type: 'text', at: [x, y], text, role, align? },
  ] }
// Every layer accepts alpha. Set equal: true when circles must stay round (geometry, robotics).
// Filled shapes accept fillAlpha and stroke: false; heat accepts range: [lo, hi] to fix its scale
// across frames; text accepts size. A graph view accepts aspect (height / width).
```

A second, smaller scene (`aspect: 0.2`) under the main view works well for "error by step"
or "loss by step" charts. Keep a frame to at most two or three views.

If no existing view can show your algorithm honestly, say so in your report instead of
forcing it; do not edit the shared renderers.

### Experiment (optional but expected where growth with input size is meaningful)

```js
experiment: {
  title: 'Comparisons as the list grows',
  note: 'What was run, on what inputs, and what the curves are.',
  metric: 'comparisons', metricLabel: 'Comparisons',      // a counter name incremented with t.count
  sizeLabel: 'Number of items (n)',
  sizes: [8, 16, 32, 64, 128, 256],
  variants: [{ id: 'random', label: 'Random order' }, { id: 'sorted', label: 'Already sorted' }],
  input: (n, variantId, seed) => ({ ...inputs for this size }),
  theory: [{ label: 'n log₂ n', fn: (n) => n * Math.log2(n) },        // exact, comparable counts
           { label: 'n² (scaled)', fn: (n) => n * n, scaled: true, variant: 'sorted' }],   // shape only
}
```

The chart is drawn from real count-only runs in the visitor's browser. The experiment input
bypasses slider limits, so `run` must work for the largest size (keep it under about a
second). `sizes` can be any numeric parameter, not only input length.

**The pipeline checks every formula against the code.** It runs the implementation at each
size and compares the counts with each `theory` entry (`js/core/verify.js`). The result is
stored with the lesson and shown to readers as part of its check record:

| Relation | Meaning |
| --- | --- |
| exact | every count equals the formula |
| close | counts at the larger sizes are within 15% of it |
| average | for `expected: true` formulas: single runs scatter around it and average within 20% |
| growth | counts grow at the same rate (required for `scaled: true` curves) |
| upper / lower | counts never cross it |

If none of these holds, the lesson fails: the stated cost and the implementation disagree, and
one of them must be fixed. Give each formula the `variant` it describes (a worst-case formula
belongs to the worst-case series). Add `expected: true` to an average over random inputs, and
`reference: true` to a curve drawn only for scale or comparison, which is then not checked and
is labelled "for reference" on the chart. Prefer an exact formula to a scaled one where you can.

## Code samples

- Three complete programs (Python 3.9-compatible standard library only, modern JavaScript,
  C++17) that print exactly the same text, equal to `code.sample.expected`.
- Deterministic. No input reading, no randomness unless you implement the same small
  generator in all three languages. Format floats explicitly to a fixed number of decimals.
- JavaScript prints with `console.log` of strings only (build the line yourself).
- Readable first: clear names, the same structure as the pseudocode, 20 to 60 lines each.
- `code.python.notes`: at least two `{ line, text }` explanations of the important lines
  (1-based line numbers). Notes for the other languages are optional.
- Spaces only, no tabs. In C++ sources inside template strings, write `\\n` for a newline escape.

## Tests

`tests` run `viz.run` through the same path as the page. Make them real: check the result
against an independent reference or a mathematical property (sortedness, a brute-force
answer, a known closed form), and include edge cases. One test should pin any number that
the quiz or prose quotes.

## Compare groups

Lessons with the same `meta.compareGroup` can be run side by side on identical inputs, so
all members must accept the same input fields and report the same counters.

| Group | Members | Shared inputs | Counters / result |
| --- | --- | --- | --- |
| `sorting` | sorts | `arrayInputs()` | `comparisons`, `writes`; result `{ sorted, original }` |
| `searching` | linear, binary | `searchInputs()` | `comparisons`; result `{ index, array, target }` |
| `traversal` | bfs, dfs | `graphInputs({ weighted: false })` | `edges examined`; result `{ order, graph }` |
| `shortest-path` | dijkstra, bellman-ford | `graphInputs()` | `relaxations`; result `{ dist, path, source, target, graph }` |
| `sequence-comparison` | edit-distance, lcs, needleman-wunsch | `a`, `b` (text) | `cells filled` |
| `lossless-compression` | huffman, RLE, LZ77 | `text` | result `{ inputBits, outputBits }` |
| `root-finding` | newton, bisection | `fn`, `tolerance` | `function evaluations`; result `{ root, iterations }` |
| `ode-integration` | euler, rk4 | `system`, `dt`, `duration` | `derivative evaluations`; result `{ maxError }` |
| `landscape-minimization` | gradient descent, annealing, genetic | `landscape`, `seed` | `function evaluations` (or `gradient evaluations`); result `{ bestValue, x, y }` |
| `classification` | k-NN, logistic regression, perceptron | `dataset`, `points`, `seed` | result `{ accuracy }` |

A lesson may add inputs of its own beyond the shared ones.

## Files you may touch

Only the lesson files assigned to you, plus any shared helper your brief says you own.
Do not edit `js/`, `css/`, `tools/`, other lessons, the roster or the catalog. If you need
something from shared code, work around it inside your module and say so in your report.
