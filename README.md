# Algorithm Atlas

*The algorithms behind AI and business decisions, explained and run in front of you.*

An interactive field guide to algorithms. Every lesson starts in plain language, runs a real
implementation you can step through, and unfolds as far as you want to go: from a simple
explanation, to the working details, to the proofs.

The site is static. There is no build step, no server code and no account system.

## Run it

```bash
python3 -m http.server 8975
```

Then open http://127.0.0.1:8975. Any static file server works. Routes use the URL hash, so no
rewrite rules are needed.

## How it is organised

```
index.html              the shell
css/                    base.css (design tokens), viz.css, site.css, pages.css, lab.css
js/
  app.js                boot and route table
  core/                 router, store (browser storage), catalog (content access), search,
                        schema (content schema + validator), tracer (execution recorder), recommend
  viz/                  the player and the seven renderers (bars, graph, grid, scene, table, rows, board)
  lib/                  shared input generators (arrays, graphs, grids, landscapes, datasets, ...)
  run/sandbox.js        the code playground (JavaScript in a worker, Python through Pyodide)
  ui/                   components: search box, explorer, code panel, chart, quiz, relationship map, ...
  art/                  the hero sketch, the universe map, the discipline plates
  pages/                one module per route
content/
  algorithms/<id>.js    one file per lesson: the only thing you add to publish a lesson
  roster.js             every lesson id, published or planned, and the concept ids
  disciplines.js        the twenty disciplines
  concepts.js           the glossary
  paths.js              learning paths
  connections.js        threads on the Connections page
  compare-groups.js     which lessons can be compared side by side
  synonyms.js           everyday words and questions mapped to lessons, for search
  catalog.generated.js  written by tools/build.py; never edit by hand
tools/
  build.py              the content pipeline
  shot.py               screenshot a lesson frame or a page
  gallery.html          one sample of every visualization kind
  phone.html            routes shown in 390px frames, for checking phone layouts
  embed.html            one lesson's player on its own (used by shot.py)
docs/AUTHORING.md       how to write a lesson
```

## The content pipeline

```bash
python3 tools/build.py                # validate every lesson, then write the catalog
python3 tools/build.py --check        # validate only
python3 tools/build.py --only a,b     # validate specific lessons
```

## The site tests

```bash
python3 tools/test.py                 # every suite, about 30 seconds
python3 tools/test.py --suite search  # one suite: search, defects, index, links, learning, player, followups, tracks
python3 tools/test.py --bench         # also print the search benchmark, query by query
```

`tools/build.py` checks the lessons. `tools/test.py` checks the site around them. It
opens the real pages in headless Chrome and looks at what a reader would see: that search
finds the right lesson for a plain question, that every internal link on every page leads
somewhere, that each suggested next step is a connection a lesson actually states, that
the demonstrations behave as their notes say. It needs only Python and Chrome.

The search is measured against `tools/search-benchmark.js`: 182 queries with a judgement
of which results would be right, 40 of them held out and never tuned against. It reports
how many questions were answered and how much of what was shown was right. Change the
search only with that benchmark open.

For each lesson the pipeline:

1. validates the record against the schema in `js/core/schema.js`, including the parts that make
   a lesson readable by a beginner (the simple explanation, a worked example, plain definitions,
   where the analogy stops, common misunderstandings, the takeaway);
2. runs the lesson's visualization code on its default input, every preset and every test, and
   checks the tests against independent reference answers;
3. runs the JavaScript sample in headless Chrome, the Python sample with `python3`, and compiles
   and runs the C++ sample with `clang++ -std=c++17`, and requires all three to print the
   expected output exactly;
4. runs each lesson's experiment at every size and compares the measured operation counts with
   the cost formulas the lesson states. A formula the measurements contradict fails the lesson;
5. rejects em dashes and stock phrases, to keep the writing plain.

What was verified is written into the catalog with each lesson (`checks`) and shown to readers:
a one-line summary under every lesson title, and the full record on the Verification page.

Only lessons with no errors are written to `content/catalog.generated.js`. Anything in the
roster without a passing lesson is shown on the site as planned.

It needs Python 3, Google Chrome and a C++ compiler. It does not need Node.

**Run `python3 tools/build.py` after any change to a lesson**, or the site will not see it.

## Adding content

- **A lesson:** add its id to `content/roster.js`, write `content/algorithms/<id>.js` following
  `docs/AUTHORING.md`, and run the pipeline. The lesson page, the library, search, the map, the
  lab and the connection graph all pick it up.
- **A discipline:** add one record to `content/disciplines.js` and one figure to `js/art/plates.js`.
- **A kind of visualization:** add a renderer in `js/viz/` and register it in `js/viz/stage.js`.

## Principles

- Accuracy before simplicity. Simplify the language, not the truth.
- Every visualization is produced by running the algorithm. Nothing is pre-recorded.
- Measured numbers and formulas are labelled as such and drawn differently.
- Nothing is published until it has passed the pipeline. Unwritten lessons are marked as planned.
- One primary purpose per page. Depth on demand. Repeat orientation, not whole explanations.
- The design is a field guide, not a dashboard: linen, charcoal, forest green, a little terracotta.

## Notes on the stack

This was specified with React, TypeScript and Next.js in mind. It is written as dependency-free
ES modules instead, because the machine it was built on has no Node toolchain. The module
boundaries follow the same plan (layout, navigation, search, catalog, lesson engine,
visualization engine, lab, paths, relationship graph, progress, content, validation), so moving
to a component framework later would be a port, not a redesign.

Search runs in the browser over the generated catalog. At thousands of lessons, replace
`build()` in `js/core/search.js` with a call to a server-side index and keep `search()` as is.

## Deploying

`npm start` runs `scripts/serve-site.sh`, which copies only the public site (`index.html`,
`assets`, `css`, `js`, `content`) into `dist/` and serves it with the `serve` package. The
pipeline, the authoring guide and the other tools are not published. On Railway, connect the
GitHub repository and generate a domain; each push to `main` redeploys.

The site is live at https://algorithm-atlas-production.up.railway.app. That address is written
in full in the share tags in `index.html` (`og:url`, `og:image`, `twitter:image` and the canonical
link), because most services ignore a relative one. Change it there if the domain changes.
