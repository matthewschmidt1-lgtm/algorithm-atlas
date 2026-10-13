// Bresenham's line algorithm on a small pixel grid. The picture counts y upward from the
// bottom-left corner, as on graph paper. Screens usually count rows downward, which only
// mirrors the picture.

const COLS = 24, ROWS = 16;
const QUIET = { count() {}, frame() {} };   // a tracer that records nothing, used by the tests
const f2 = (v) => (Math.round(v * 100) / 100).toFixed(2);

function run(input, t) {
  const x0 = Number(input.x0), y0 = Number(input.y0), x1 = Number(input.x1), y1 = Number(input.y1);
  if (![x0, y0, x1, y1].every(Number.isInteger)) throw new Error('Endpoints must be whole pixel coordinates.');
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
  const steep = dy > dx;
  const major = steep ? dy : dx, minor = steep ? dx : dy;
  const majorName = steep ? 'y' : 'x', minorName = steep ? 'x' : 'y';
  let D = 2 * minor - major;
  let x = x0, y = y0;
  const pixels = [[x, y]];
  let Dmin = D, Dmax = D, maxOff = 0;

  // Where the true line is, measured along the minor axis, when the major coordinate is m.
  const trueMinor = (px, py) => {
    if (major === 0) return steep ? px : py;
    const along = steep ? (py - y0) / (y1 - y0) : (px - x0) / (x1 - x0);
    return steep ? x0 + along * (x1 - x0) : y0 + along * (y1 - y0);
  };
  const offset = (px, py) => Math.abs((steep ? px : py) - trueMinor(px, py));
  const P = (px, py) => `(${px}, ${py})`;

  const views = (cands, finished = false) => {
    const cols = Math.max(COLS, x0 + 1, x1 + 1), rows = Math.max(ROWS, y0 + 1, y1 + 1);
    const cells = new Array(rows * cols).fill('empty');
    const at = (px, py) => (rows - 1 - py) * cols + px;
    cells[at(x1, y1)] = 'goal';
    for (const [px, py] of pixels) cells[at(px, py)] = 'on';
    if (cands) for (const [px, py] of cands) cells[at(px, py)] = 'frontier';
    if (!finished) cells[at(x, y)] = 'special';
    const centres = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) centres.push([c, r]);
    const ticks = pixels.map(([px, py]) => (steep ? [px, py, trueMinor(px, py), py] : [px, py, px, trueMinor(px, py)]));
    const layers = [
      { type: 'points', points: centres, role: 'faint', r: 1.1, alpha: 0.55 },
      { type: 'line', points: [[x0, y0], [x1, y1]], role: 'forest', width: 1.6 },
      { type: 'segments', segments: ticks, role: 'brick', width: 2.2 },
      { type: 'points', points: pixels.slice(), role: 'on', r: 3.4 },
    ];
    if (cands) layers.push({ type: 'points', points: cands.slice(), role: 'frontier', r: 5, hollow: true });
    if (!finished) layers.push({ type: 'points', points: [[x, y]], role: 'special', r: 4.2 });
    return [
      { kind: 'grid', title: 'The pixel grid', rows, cols, cells,
        legend: [{ label: 'lit pixel', role: 'on' }, { label: 'pixel just lit', role: 'special' }, { label: 'two choices for the next pixel', role: 'frontier' }, { label: 'far endpoint', role: 'goal' }] },
      { kind: 'scene', title: 'The true line and the pixel centres chosen', x: [-0.5, cols - 0.5], y: [-0.5, rows - 0.5], aspect: 0.5, equal: true,
        axes: { xLabel: 'x (columns)', yLabel: 'y (rows)' }, layers,
        legend: [{ label: 'true line', role: 'forest' }, { label: 'chosen pixel centre', role: 'on' }, { label: 'distance from the true line', role: 'brick' }] },
    ];
  };

  t.count('pixels');
  t.frame(() => ({
    line: [1, 2, 3, 4, 5, 6, 7, 8],
    note: major === 0
      ? `Both endpoints are the same pixel, ${P(x0, y0)}, so the line is that one pixel.`
      : `Draw from ${P(x0, y0)} to ${P(x1, y1)}. The line covers ${dx} pixel${dx === 1 ? '' : 's'} across and ${dy} up or down, so **${majorName}** changes more: take one step along ${majorName} for every pixel. The error term starts at 2 × ${minor} − ${major} = **${D}**. Light the first pixel.`,
    views: views(null),
    vars: { pixel: P(x, y), 'error term D': D, 'long direction': majorName },
  }));

  for (let i = 0; i < major; i++) {
    const before = D;
    const straight = steep ? [x, y + sy] : [x + sx, y];
    const diagonal = [x + sx, y + sy];
    t.count('comparisons');
    const diag = D > 0;
    const cands = minor === 0 ? [straight] : [straight, diagonal];
    if (diag) { D -= 2 * major; t.count('additions', 2); }
    D += 2 * minor;
    t.count('additions', 2);
    const after = D;
    Dmin = Math.min(Dmin, D); Dmax = Math.max(Dmax, D);
    t.frame(() => ({
      line: diag ? [10, 11, 12, 13] : [10, 13],
      note: minor === 0
        ? `The line runs straight along ${majorName}, so the error term never rises above zero and the only choice is ${P(...straight)}.`
        : diag
          ? `The next pixel is either ${P(...straight)} or ${P(...diagonal)}. The error term is **${before}**, above zero: the true line passes nearer to ${P(...diagonal)}, so step along ${minorName} as well. Subtract 2 × ${major} = ${2 * major}, then add 2 × ${minor} = ${2 * minor}. The error term is now ${after}.`
          : `The next pixel is either ${P(...straight)} or ${P(...diagonal)}. The error term is **${before}**, ${before === 0 ? 'exactly zero: the true line passes exactly halfway between the two, and the rule keeps the straight step on a tie' : `not above zero: the true line passes nearer to ${P(...straight)}`}. Step along ${majorName} only, and add 2 × ${minor} = ${2 * minor}. The error term is now ${after}.`,
      views: views(cands),
      vars: { pixel: P(x, y), 'error term D': `${before} → ${after}`, 'next pixel': P(...(diag ? diagonal : straight)) },
    }));
    if (diag) { if (steep) x += sx; else y += sy; }
    if (steep) y += sy; else x += sx;
    pixels.push([x, y]);
    t.count('pixels');
    const off = offset(x, y);
    maxOff = Math.max(maxOff, off);
    t.frame(() => ({
      line: [14, 15],
      note: `Light ${P(x, y)}. In this ${steep ? 'row' : 'column'} the true line is at ${minorName} = ${f2(trueMinor(x, y))}, which is ${f2(off)} of a pixel from the centre chosen.${i === major - 1 ? ' This is the far endpoint.' : ''}`,
      views: views(null),
      vars: { pixel: P(x, y), 'error term D': D, [`true ${minorName}`]: f2(trueMinor(x, y)) },
    }));
  }

  t.frame(() => ({
    line: null,
    note: `Done: **${pixels.length} pixels**, one for each step along ${majorName} plus the starting pixel. No pixel centre is more than ${f2(maxOff)} of a pixel from the true line, and the loop used only whole-number additions and one comparison per pixel.`,
    views: views(null, true),
    vars: { from: P(x0, y0), to: P(x1, y1), 'largest distance': f2(maxOff) },
  }));

  return { pixels, x0, y0, x1, y1, dx, dy, steep, major, minor, maxOffset: maxOff, Dmin, Dmax };
}

/* ---- checks shared by the tests ---- */

const key = (p) => `${p[0]},${p[1]}`;
const trace = (x0, y0, x1, y1) => run({ x0, y0, x1, y1 }, QUIET);

// Every property the lesson claims, checked from the definition of the true line rather than
// from the algorithm's own error term.
function checkLine(r) {
  const { pixels, x0, y0, x1, y1, dx, dy } = r;
  const n = Math.max(dx, dy) + 1;
  if (pixels.length !== n) return `expected ${n} pixels, got ${pixels.length}`;
  if (key(pixels[0]) !== key([x0, y0])) return 'the first pixel is not the start point';
  if (key(pixels[n - 1]) !== key([x1, y1])) return `the last pixel is ${key(pixels[n - 1])}, not the end point ${x1},${y1}`;
  for (let i = 0; i < n; i++) {
    const [px, py] = pixels[i];
    // Cross-multiplied distance test: |minor offset| <= 1/2, using integers only.
    const twiceOff = dy > dx ? Math.abs(2 * ((px - x0) * (y1 - y0) - (py - y0) * (x1 - x0))) : Math.abs(2 * ((py - y0) * (x1 - x0) - (px - x0) * (y1 - y0)));
    if (twiceOff > Math.max(dx, dy)) return `pixel ${px},${py} is more than half a pixel from the true line`;
    if (i > 0) {
      const ax = Math.abs(px - pixels[i - 1][0]), ay = Math.abs(py - pixels[i - 1][1]);
      if (ax > 1 || ay > 1 || (dy > dx ? ay : ax) !== 1) return `pixels ${i - 1} and ${i} are not neighbours`;
    }
  }
  if (r.Dmin < 2 * r.minor - 2 * r.major || r.Dmax > 2 * r.minor) return 'the error term left its proven range';
  return true;
}

function allPairs(cols, rows, fn) {
  for (let ax = 0; ax < cols; ax++) for (let ay = 0; ay < rows; ay++)
    for (let bx = 0; bx < cols; bx++) for (let by = 0; by < rows; by++) {
      const verdict = fn(ax, ay, bx, by);
      if (verdict !== true) return `${ax},${ay} to ${bx},${by}: ${verdict}`;
    }
  return true;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export default {
  meta: {
    id: 'bresenham-line',
    name: 'Bresenham\'s Line Algorithm',
    aliases: ['Bresenham', 'line rasterization', 'line drawing algorithm', 'integer line algorithm', 'midpoint line algorithm'],
    kind: 'algorithm',
    discipline: 'computer-graphics',
    alsoIn: [
      { id: 'computational-geometry', why: 'It answers a question of digital geometry: which grid points best approximate a line segment, decided by the sign of a whole-number expression.' },
      { id: 'robotics', why: 'Mapping and collision checking on occupancy grids need the list of cells a straight ray passes through, and this is a standard way to produce it.' },
    ],
    subfield: 'Rasterization',
    family: 'Line drawing',
    lab: 'geometry',
    year: 1965,
    authors: 'Jack E. Bresenham',
    summary: 'Draws a straight line on a pixel grid by stepping one pixel at a time and tracking the drift from the true line with whole-number additions only.',
    difficulty: 'beginner',
    order: 900,
    paradigms: ['incremental'],
    randomized: false,
    approximate: false,
    time: { best: 'O(max(|Δx|, |Δy|))', average: 'O(max(|Δx|, |Δy|))', worst: 'O(max(|Δx|, |Δy|))', class: 'linear' },
    space: { worst: 'O(1)', class: 'constant' },
    tags: {
      problems: ['draw a line on a screen', 'which pixels make a straight line', 'line between two points on a grid', 'rasterize a line', 'cells crossed by a ray'],
      techniques: ['incremental error term', 'integer arithmetic', 'decision variable', 'octant symmetry'],
      applications: ['computer graphics', 'robotics', 'games', 'image processing'],
    },
    prerequisites: ['concept:discretization', 'concept:floating-point', 'concept:invariant'],
  },

  bigIdea: {
    simple: "A screen is a grid of tiny squares called pixels. Each pixel is either lit or dark. So how do you draw a slanted line? You cannot light half a pixel. You have to choose whole pixels that sit as close to the true line as they can. Bresenham's algorithm chooses them one at a time. It walks from one end of the line to the other, one column per step. At each step there are only two choices: stay in the same row, or move over by one row. To decide, it keeps one running number. That number says how far the chosen pixels have drifted from the true line. When the drift passes half a pixel, the walk moves over a row and the number drops back. The number is always a whole number, with no fractions. So the method only needs to add, subtract and compare, which even a very basic computer chip does quickly.",
    what: 'Bresenham\'s algorithm turns a line between two grid points into a list of pixels. It steps one pixel at a time along whichever direction, x or y, changes more. A single integer, the **error term**, records how far the true line has moved away from the row or column being drawn. When it rises above zero, the algorithm takes one step in the other direction too and lowers the error term again.',
    why: 'Jack Bresenham wrote it at IBM in 1962 to steer a digital plotter, a machine whose pen could only move a fixed small step at a time in one of eight directions. Computers of that period did fractional arithmetic slowly, so a method that needed only whole-number addition and a sign test was a real saving on every step of every line.',
    when: 'Use it whenever you need the grid cells along a straight segment and want one cell per step with exact, repeatable results: plain one-pixel lines, rays through a grid map, or movement between two tiles. If you need smooth edges, use an antialiased method such as Xiaolin Wu\'s. If you need every cell the line touches, including ones it only clips at a corner, use a grid traversal such as Amanatides and Woo\'s instead.',
    interesting: 'The obvious method multiplies by the slope and rounds, which needs fractions at every pixel. Bresenham\'s method lights exactly the same pixels, apart from its choice on exact ties, without ever computing a fraction. It works because the question "which of two pixels is closer?" only needs the sign of a number, and that sign can be tracked with whole numbers.',
    where: 'It was the standard way to draw lines on plotters and early raster displays, and the same error-term technique is still used wherever something has to advance in even whole steps: listing the cells a sensor beam crosses in a robot\'s grid map, checking lines of sight in tile-based games, and keeping the motors of a machine tool in step.',
    analogy: {
      title: 'Stacking blocks beside a ramp',
      text: 'Picture a long, gentle ramp, and a supply of square blocks that you stack beside it so the block tops follow the ramp as closely as blocks can. Walk along the ramp one block-width at a time. At each stop, look at the gap between the ramp and the top of your stack. If the ramp has climbed more than half a block above the stack, add one block. Otherwise leave the stack alone. You never measure the ramp from the ground again. You only keep track of the gap, and the gap changes by the same amount at every stop.',
      limits: 'A person would measure the gap with a ruler and get fractions. The algorithm avoids that: it scales everything by a fixed whole number first, so the quantity it tracks is always a whole number, and it compares against zero instead of against half a block. The ramp also only climbs gently to the right. Real lines can head in any direction, including steeper than 45 degrees, where the algorithm must walk row by row instead of column by column. And a pixel is a small square of light, so a drawn line still looks like a staircase when you look closely.',
    },
  },

  example: {
    setup: "Draw a line from pixel (0, 0) to pixel (5, 2). It goes 5 pixels across and 2 up, so step one column at a time. Keep one whole number called the error term. It starts at 2 × 2 − 5 = −1: twice the rise, minus the run. Before each step, check it. If it is above zero, go up a row and subtract 10, which is twice the run. Then always add 4, which is twice the rise.",
    steps: [
      "Light (0, 0). The error term is −1, not above zero, so stay in row 0. Add 4 to get 3. Move right and light (1, 0).",
      "The error term is 3, above zero, so go up to row 1 and subtract 10 to get −7. Add 4 to get −3. Move right and light (2, 1).",
      "The error term is −3, so stay in row 1. Add 4 to get 1. Move right and light (3, 1).",
      "The error term is 1, above zero, so go up to row 2 and subtract 10 to get −9. Add 4 to get −5. Move right and light (4, 2).",
      "The error term is −5, so stay in row 2. Add 4 to get −1. Move right and light (5, 2), the endpoint.",
    ],
    result: "The line is the six pixels (0, 0), (1, 0), (2, 1), (3, 1), (4, 2), (5, 2). The true line has heights 0, 0.4, 0.8, 1.2, 1.6 and 2 in those columns, and each one rounds to the row that was chosen. The algorithm found those rows without working out a single fraction.",
    tryInput: { x0: 0, y0: 0, x1: 5, y1: 2 },
  },

  terms: [
    { term: "Pixel", meaning: "One small square of a screen or image. Here each pixel is either lit or dark." },
    { term: "Raster", meaning: "A picture stored as a grid of pixels. Turning a shape into pixels is called rasterizing it." },
    { term: "Endpoint", meaning: "One of the two pixels where the line starts and finishes." },
    { term: "Long direction (major axis)", meaning: "Whichever of across or up-and-down the line covers more pixels in. The algorithm takes one step in this direction for every pixel." },
    { term: "Short direction (minor axis)", meaning: "The other direction. The algorithm steps this way only now and then." },
    { term: "Error term", meaning: "One whole number that tracks how far the true line has drifted from the pixels chosen so far. Its sign decides the next pixel." },
    { term: "Integer arithmetic", meaning: "Calculating with whole numbers only, with no fractions or decimals." },
    { term: "Octant", meaning: "One of the eight 45 degree wedges a line can point into. A line algorithm has to work in all eight." },
  ],

  takeaway: "Take one step per pixel along the line's longer direction, and step sideways whenever a running whole-number tally says the true line has drifted more than half a pixel.",

  viz: {
    describe: 'A grid of 24 by 16 pixels, with y counted upward from the bottom-left corner. Lit pixels are terracotta, the pixel just lit is drawn in ink, the two candidate pixels for the next step are ochre, and the far endpoint is brick red until the line reaches it. Below the grid, a second picture shows the true line in green over a dot for each pixel centre, with the chosen centres marked and a short brick red tick from each one to the true line showing how far off it is.',
    inputs: [
      { id: 'x0', type: 'range', label: 'Start, x', min: 0, max: COLS - 1, step: 1, default: 2 },
      { id: 'y0', type: 'range', label: 'Start, y', min: 0, max: ROWS - 1, step: 1, default: 3 },
      { id: 'x1', type: 'range', label: 'End, x', min: 0, max: COLS - 1, step: 1, default: 21 },
      { id: 'y1', type: 'range', label: 'End, y', min: 0, max: ROWS - 1, step: 1, default: 11,
        help: 'y is counted upward from the bottom row, as on graph paper. Screens usually count downward, which mirrors the picture and changes nothing else.' },
    ],
    presets: [
      { label: 'Gentle slope', values: { x0: 2, y0: 3, x1: 21, y1: 11 } },
      { label: 'Steep: walks row by row', values: { x0: 9, y0: 1, x1: 14, y1: 14 } },
      { label: 'Right to left, downward', values: { x0: 21, y0: 12, x1: 3, y1: 5 } },
      { label: 'Exact diagonal', values: { x0: 4, y0: 2, x1: 15, y1: 13 } },
      { label: 'Horizontal', values: { x0: 2, y0: 8, x1: 21, y1: 8 } },
      { label: 'Ties: slope exactly one half', values: { x0: 3, y0: 4, x1: 19, y1: 12 } },
    ],
    tryThis: [
      'Load "Gentle slope" and step through it. Each time the error term goes above zero, the line climbs a row and the error term drops by 2 × 19 = 38. Watch the brick red ticks in the lower picture: none is ever longer than half a pixel.',
      'Load "Steep: walks row by row". The line now covers more rows than columns, so the algorithm steps along y and only sometimes along x. Set the end point back to a gentle slope and compare which direction gets a step for every pixel.',
      'Load "Ties: slope exactly one half". In every second column the true line passes exactly halfway between two pixels and the error term is exactly 0. Now swap the two endpoints by hand and run it again: the tied pixels land on the other side, so the two drawings differ.',
      'Move the end point until the line is an exact diagonal, then make it horizontal. Count the lit pixels each time. Both use one pixel per column, although the diagonal line is about 1.4 times as long, which is why diagonal lines look fainter on a real screen.',
    ],
    run,
    report: (r, c) => `Lit ${r.pixels.length} pixels from (${r.x0}, ${r.y0}) to (${r.x1}, ${r.y1}), stepping along ${r.steep ? 'y' : 'x'}.\n${c.comparisons || 0} comparisons and ${c.additions || 0} whole-number additions, with no multiplication or division inside the loop.\nLargest distance from the true line: ${f2(r.maxOffset)} of a pixel.\n${r.pixels.map((p) => `(${p[0]},${p[1]})`).join(' ')}`,
    experiment: {
      title: 'Additions as the line gets longer',
      note: 'Each point is a real run of this page\'s implementation on a line that covers n pixels in its long direction. The work is exactly two additions per pixel, plus two more each time the line steps sideways, so a diagonal costs the most.',
      metric: 'additions',
      metricLabel: 'Whole-number additions',
      sizeLabel: 'Pixels covered in the long direction (n)',
      sizes: [8, 16, 32, 64, 128, 256, 512, 1024],
      variants: [
        { id: 'flat', label: 'Horizontal line' },
        { id: 'quarter', label: 'Slope one quarter' },
        { id: 'diagonal', label: 'Exact diagonal' },
      ],
      input: (n, variant) => ({ x0: 0, y0: 0, x1: n, y1: variant === 'diagonal' ? n : variant === 'quarter' ? n / 4 : 0 }),
      theory: [
        { label: '2n (horizontal)', fn: (n) => 2 * n, variant: 'flat' },
        { label: '2.5n (slope one quarter)', fn: (n) => 2.5 * n, variant: 'quarter' },
        { label: '4n (diagonal)', fn: (n) => 4 * n, variant: 'diagonal' },
      ],
    },
  },

  logic: {
    intuition: 'Suppose the line is gentle, so each step moves one column to the right. From the pixel just lit there are only two sensible places to go: straight across, or across and up one. The right choice is whichever centre is closer to the true line, and that depends only on whether the line crosses the next column above or below the halfway mark between the two. The algorithm does not compute where the line crosses. It keeps a number proportional to "crossing height minus halfway mark" and updates it by a fixed amount per step, so only its sign ever has to be checked.',
    steps: [
      'Work out how far the line goes across (`dx`) and up or down (`dy`), ignoring signs, and note which way it travels in each direction.',
      'Call the direction with the larger change the major axis and the other the minor axis. If they are equal, either choice gives the same diagonal.',
      'Set the error term `D` to twice the minor change minus the major change, and light the starting pixel.',
      'For each step: if `D` is above zero, move one pixel along the minor axis and subtract twice the major change from `D`.',
      'Then, always, add twice the minor change to `D`, move one pixel along the major axis, and light the pixel you are now on.',
      'After as many steps as the major change, you are on the far endpoint. Stop.',
    ],
    pseudocode: [
      'line(x0, y0, x1, y1):',
      '  dx ← |x1 − x0|',
      '  dy ← |y1 − y0|',
      '  sx, sy ← +1 or −1',
      '  major ← the longer axis',
      '  minor ← the other axis',
      '  D ← 2·Δminor − Δmajor',
      '  (x, y) ← (x0, y0)',
      '  light pixel (x, y)',
      '  repeat Δmajor times:',
      '    if D > 0:',
      '      step along minor',
      '      D ← D − 2·Δmajor',
      '    D ← D + 2·Δminor',
      '    step along major',
      '    light pixel (x, y)',
    ],
    decisions: [
      { title: 'Which axis drives the loop?', text: 'The one with the larger change. Stepping along it lights exactly one pixel per step and leaves no gaps. If a steep line were stepped along x, it would jump several rows at once and come out as scattered dots.' },
      { title: 'What happens on an exact tie?', text: 'When `D` is exactly zero the true line passes exactly halfway between the two candidates and both are equally good. This lesson tests `D > 0`, so a tie keeps the straight step. Testing `D >= 0` is just as valid and takes the diagonal step instead. The choice matters only if two programs must agree pixel for pixel.' },
      { title: 'Why multiply everything by two?', text: 'The natural comparison is against half a pixel, and the natural increment is the slope, a fraction. Multiplying the whole comparison by 2 × Δmajor removes both the one half and the division, leaving whole numbers. Only the sign of `D` is used, so the scaling changes nothing about the decisions.' },
    ],
    invariants: [
      'Before each decision, `D` equals 2 × Δmajor times the signed distance, along the minor axis, from the halfway mark between the two candidate pixels to the point where the true line crosses the next step.',
      'Every lit pixel centre is at most half a pixel from the true line, measured along the minor axis.',
      '`D` always stays between 2·Δminor − 2·Δmajor and 2·Δminor, so it needs only slightly more bits than the coordinates themselves.',
    ],
    edgeCases: [
      'Both endpoints the same: the loop runs zero times and one pixel is lit.',
      'Horizontal and vertical lines: the minor change is 0, `D` never rises above zero, and the line is a straight run.',
      'Exact diagonals: `D` is above zero before every step, so every step is diagonal.',
      'Steep lines (more rows than columns): the roles of x and y are exchanged. Forgetting this is the most common bug.',
      'Lines drawn right to left or downward: handled by the step directions `sx` and `sy`, which may be −1.',
      'Exact ties: drawing from A to B and from B to A can light different pixels wherever `D` is zero, because the tie rule favours the straight step in the direction of travel.',
      'Endpoints that are not whole pixel coordinates need a different starting value for the error term. This lesson assumes whole-number endpoints.',
    ],
    correctness: 'Take a gentle line heading right and up; the other cases are mirror images. Define $F(x, y) = \\Delta y\\,(x - x_0) - \\Delta x\\,(y - y_0)$. It is zero on the true line, positive below it and negative above it. Standing on pixel $(x, y)$, the two candidates are $(x+1, y)$ and $(x+1, y+1)$, and the upper one is closer exactly when the line passes above their midpoint $(x+1, y+\\tfrac12)$, that is when $F(x+1, y+\\tfrac12) > 0$. The error term is $D = 2F(x+1, y+\\tfrac12)$, which is always an integer. At the start it is $2\\Delta y - \\Delta x$. A straight step raises $x$ by one and so adds $2\\Delta y$. A diagonal step also raises $y$ by one and so adds $2\\Delta y - 2\\Delta x$. Those are exactly the updates in the loop, so by induction `D` always has the stated meaning and each step picks the nearer candidate. The first pixel lies on the line, and choosing the nearer of two candidates one pixel apart keeps every later pixel within half a pixel of it.',
    mistakes: [
      'Handling only gentle lines that go left to right, then finding that steep or reversed lines come out as a few scattered pixels or never reach the endpoint.',
      'Mixing up the two updates: subtracting twice the minor change, or adding twice the major change.',
      'Updating the error term after moving instead of before, which shifts every decision by one step.',
      'Looping one time too few and leaving out the far endpoint.',
      'Assuming the drawing from A to B is always the same set of pixels as from B to A.',
    ],
  },

  code: {
    sample: {
      input: 'Three lines: gentle from (0, 0) to (5, 2), steep from (0, 0) to (2, 5), and right to left from (6, 1) to (0, 4).',
      expected: '(0,0) (1,0) (2,1) (3,1) (4,2) (5,2)\n(0,0) (0,1) (1,2) (1,3) (2,4) (2,5)\n(6,1) (5,1) (4,2) (3,2) (2,3) (1,3) (0,4)',
    },
    python: {
      source: `def bresenham(x0, y0, x1, y1):
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x1 > x0 else -1
    sy = 1 if y1 > y0 else -1
    steep = dy > dx
    major, minor = (dy, dx) if steep else (dx, dy)
    error = 2 * minor - major
    x, y = x0, y0
    pixels = [(x, y)]
    for _ in range(major):
        if error > 0:
            if steep:
                x += sx
            else:
                y += sy
            error -= 2 * major
        error += 2 * minor
        if steep:
            y += sy
        else:
            x += sx
        pixels.append((x, y))
    return pixels


for ends in [(0, 0, 5, 2), (0, 0, 2, 5), (6, 1, 0, 4)]:
    print(" ".join(f"({x},{y})" for x, y in bresenham(*ends)))`,
      notes: [
        { line: 5, text: 'A steep line covers more rows than columns. The loop must then step along y, or it would skip rows and leave gaps.' },
        { line: 7, text: 'The starting error term: twice the short change minus the long change. Doubling is what keeps the "half a pixel" comparison in whole numbers.' },
        { line: 11, text: 'The only decision in the algorithm. Above zero means the true line has passed the halfway mark, so step sideways and pull the error term back down.' },
        { line: 17, text: 'Every step adds the same amount, twice the short change. This is the slope, scaled so that no division is needed.' },
      ],
    },
    javascript: {
      source: `function bresenham(x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x1 > x0 ? 1 : -1;
  const sy = y1 > y0 ? 1 : -1;
  const steep = dy > dx;
  const major = steep ? dy : dx, minor = steep ? dx : dy;
  let error = 2 * minor - major;
  let x = x0, y = y0;
  const pixels = [[x, y]];
  for (let i = 0; i < major; i++) {
    if (error > 0) {
      if (steep) x += sx; else y += sy;
      error -= 2 * major;
    }
    error += 2 * minor;
    if (steep) y += sy; else x += sx;
    pixels.push([x, y]);
  }
  return pixels;
}

for (const ends of [[0, 0, 5, 2], [0, 0, 2, 5], [6, 1, 0, 4]]) {
  console.log(bresenham(...ends).map(([x, y]) => "(" + x + "," + y + ")").join(" "));
}`,
    },
    cpp: {
      source: `#include <cstdlib>
#include <iostream>
#include <utility>
#include <vector>

std::vector<std::pair<int, int>> bresenham(int x0, int y0, int x1, int y1) {
    int dx = std::abs(x1 - x0), dy = std::abs(y1 - y0);
    int sx = x1 > x0 ? 1 : -1;
    int sy = y1 > y0 ? 1 : -1;
    bool steep = dy > dx;
    int major = steep ? dy : dx, minor = steep ? dx : dy;
    int error = 2 * minor - major;
    int x = x0, y = y0;
    std::vector<std::pair<int, int>> pixels = {{x, y}};
    for (int i = 0; i < major; ++i) {
        if (error > 0) {
            if (steep) x += sx; else y += sy;
            error -= 2 * major;
        }
        error += 2 * minor;
        if (steep) y += sy; else x += sx;
        pixels.push_back({x, y});
    }
    return pixels;
}

int main() {
    int lines[3][4] = {{0, 0, 5, 2}, {0, 0, 2, 5}, {6, 1, 0, 4}};
    for (auto& e : lines) {
        auto pixels = bresenham(e[0], e[1], e[2], e[3]);
        for (std::size_t k = 0; k < pixels.size(); ++k) {
            std::cout << "(" << pixels[k].first << "," << pixels[k].second << ")"
                      << (k + 1 < pixels.size() ? " " : "\\n");
        }
    }
    return 0;
}`,
    },
  },

  complexity: {
    summary: 'The loop runs once per pixel, and a line that covers n pixels in its long direction has n + 1 pixels. Each pass does one comparison and either two or four whole-number additions. Nothing depends on the size of the screen, only on the length of the line.',
    cases: [
      { case: 'Every line', time: 'O(max(|Δx|, |Δy|))', when: 'One loop pass per pixel. The slope changes the constant, between 2 and 4 additions per pixel, but not the growth.' },
      { case: 'Per pixel', time: 'O(1)', when: 'One sign test and at most four additions, with no multiplication, division or fractions.' },
    ],
    space: 'O(1) beyond the output: the current pixel, the error term and a few constants. Storing the pixel list, as the samples here do, takes space proportional to its length.',
    memory: 'The error term stays between 2·Δminor − 2·Δmajor and 2·Δminor, so it fits in an integer one or two bits wider than the coordinates. This small, predictable range is what made the method suitable for the hardware of the 1960s and for simple circuits since.',
    tradeoffs: 'The method gives up smoothness for speed and exactness: each pixel is fully on or fully off, so the line shows stair steps. Antialiased methods spread each step over two pixels with partial brightness, at the cost of more arithmetic and a display that can show shades.',
    assumptions: [
      'Both endpoints have whole-number pixel coordinates.',
      'Adding and comparing integers of this size takes constant time.',
      'The count is per line. Clipping a line to the screen, or drawing thick lines, is extra work not counted here.',
      'The chart on this page counts additions made by this implementation, not wall-clock time.',
    ],
  },

  tradeoffs: {
    excels: [
      'One-pixel-wide lines where every pixel is either on or off.',
      'Hardware and firmware with no fast fractional arithmetic.',
      'Any task that needs exact, repeatable results: the same endpoints always give the same pixels on every machine.',
      'Listing grid cells along a ray, one cell per step.',
    ],
    struggles: [
      'Smooth-looking lines: the result is visibly stepped, and antialiasing needs a different method.',
      'Thick lines, dashed lines and lines with rounded ends, which need extra machinery on top.',
      'Uniform brightness: a diagonal line has the same number of pixels as a horizontal one of the same width in columns, but is about 1.4 times as long, so it looks fainter.',
      'Finding every cell a ray touches. The method picks one cell per step, so it can pass between two cells that touch only at a corner.',
    ],
    misunderstandings: [
      "\"It is an approximation of the proper way to draw a line.\" For on-or-off pixels it is the proper way. It lights the pixel nearest the true line at every step, exactly as rounding the true height would, apart from its fixed choice on exact ties.",
      "\"Whole numbers make it less accurate than using decimals.\" The whole-number version is the more reliable one. Decimal arithmetic in a computer rounds a little at every step, and those small errors can add up along a long line. The whole numbers here are exact.",
      "\"A line from A to B is the same pixels as a line from B to A.\" Usually, but not always. When the true line passes exactly halfway between two pixels, the tie is settled by the direction of travel, so the two drawings can differ at those pixels.",
      "\"It only works for lines going up and to the right.\" The textbook presentation often shows only that case. The full algorithm swaps the roles of x and y for steep lines and steps by −1 for lines heading left or down.",
    ],
    pitfalls: [
      'Testing only one octant. Check all eight directions, plus horizontal, vertical, diagonal and single-pixel lines.',
      'Integer overflow of the error term when coordinates are close to the limit of the integer type.',
      'Drawing shared edges of adjacent shapes in opposite directions and getting gaps or doubled pixels at ties.',
    ],
    constraints: [
      'Lines that extend beyond the screen must be clipped first, and clipping must not change which pixels are chosen inside the screen.',
      'Graphics hardware follows its own published rules for which pixels a line covers, so its output is not guaranteed to match this algorithm pixel for pixel.',
    ],
    alternatives: [
      { name: 'Digital differential analyzer (DDA)', when: 'Simplicity matters more than exactness: add the slope as a fraction at every step and round.' },
      { name: 'Xiaolin Wu\'s line algorithm', when: 'The display can show shades and you want smooth, antialiased lines.' },
      { name: 'Amanatides and Woo grid traversal', when: 'You need every cell a ray passes through, for example in ray casting or conservative collision checks.' },
      { id: 'de-casteljau', name: 'De Casteljau\'s Algorithm', when: 'The shape is a curve. A curve is usually split into short straight pieces first, and each piece is then drawn as a line.' },
    ],
    comparison: {
      columns: ['', 'Bresenham', 'DDA', 'Xiaolin Wu'],
      rows: [
        ['Arithmetic', 'Integer add and compare', 'Fractional add and round', 'Fractional'],
        ['Pixels per step', 'One, on or off', 'One, on or off', 'Two, with partial brightness'],
        ['Rounding error', 'None', 'Can build up along long lines', 'Small, not visible'],
        ['Appearance', 'Stepped', 'Stepped', 'Smooth'],
      ],
    },
  },

  applications: [
    { title: 'Plotters and raster line drawing', status: 'established', text: 'The algorithm was written to drive a pen plotter and became the standard textbook method for turning a line into pixels on raster displays. Its incremental error term is also the basis of the usual integer methods for circles and for walking the edges of polygons.' },
    { title: 'Tracing sensor beams through occupancy grids', status: 'established', text: 'A robot that maps its surroundings with a range sensor stores the map as a grid of cells. For each beam, the cells between the sensor and the point it hit are marked as free space. Bresenham\'s algorithm is a common way to list those cells.' },
    { title: 'Keeping machine axes in step', status: 'established', text: 'A machine tool or 3D printer moving in a straight line must send step pulses to two or more motors in the right ratio. Open-source motion firmware such as Grbl does this with a Bresenham-style counter: the axis with the most steps drives the loop and the others step when their error terms overflow.' },
    { title: 'Lines of sight on tile maps', status: 'illustrative', text: 'A tile-based game can decide whether one square can see another by walking the line between them and stopping at the first wall. Because the algorithm picks one tile per step, designers have to decide how to treat lines that squeeze past a corner.' },
  ],

  connections: [
    { to: 'concept:discretization', type: 'prerequisite', why: 'A line is continuous and a screen is not. The algorithm is a rule for replacing each point of the line with the nearest available grid cell.' },
    { to: 'concept:floating-point', type: 'related', why: 'The method exists to avoid fractional arithmetic. Tracking a scaled integer instead of a rounded fraction removes both the cost and the accumulated rounding error.' },
    { to: 'concept:invariant', type: 'prerequisite', why: 'The proof is one loop invariant: the error term always equals a fixed multiple of the gap between the true line and the midpoint of the next two candidates.' },
    { to: 'graham-scan', type: 'related', why: 'Both decide geometry by the sign of the same kind of whole-number expression. The error term here says which side of the line a midpoint lies on; the turn test in the scan says which side of a line a third point lies on.' },
    { to: 'euclidean-algorithm', type: 'advanced', why: 'The pattern of long and short runs in a digital line is governed by the continued fraction of its slope, which is what the Euclidean algorithm computes for Δy and Δx.' },
    { to: 'euler-method', type: 'related', why: 'Both advance in fixed steps and add a constant increment per step. Euler\'s method lets its rounding error grow; Bresenham keeps the error as an exact integer and corrects it as soon as it passes half a pixel.' },
    { to: 'de-casteljau', type: 'advanced', why: 'Curves are commonly drawn by splitting them into short straight segments, each of which is then rasterized as a line.' },
    { to: 'a-star', type: 'application', why: 'A grid planner can shorten the path A* returns by testing whether two cells on it can be joined directly, and that test is a walk along the line between them.' },
    { to: 'rrt', type: 'application', why: 'A planner that works on a grid map has to check whether the straight segment between two positions crosses an occupied cell, which means listing the cells along that segment.' },
    { to: 'discipline:robotics', type: 'application', why: 'Occupancy-grid mapping marks the cells along each sensor beam as free, and those cells are found by rasterizing the beam as a line.' },
    { to: 'discipline:computational-geometry', type: 'related', why: 'Digital geometry studies which sets of grid points count as straight lines. The pixels chosen here are the standard answer.' },
  ],

  quiz: [
    {
      type: 'choice',
      q: 'Why does the algorithm step along the direction in which the line changes more?',
      options: ['It makes the arithmetic use smaller numbers', 'So that every step lights exactly one pixel and the line has no gaps', 'Because the other direction would need division', 'It makes the line look smoother'],
      answer: 1,
      explain: [
        'The size of the numbers is much the same either way.',
        'Correct. Along the long direction the line moves at most one pixel sideways per step. Stepping along the short direction would skip several pixels at a time.',
        'Neither choice needs division. The error term works the same way with the roles exchanged.',
        'Smoothness needs partial brightness. The choice of driving direction only prevents gaps.',
      ],
    },
    {
      type: 'predict',
      q: 'The line from (2, 3) to (21, 11) covers 19 pixels across and 8 up. How many pixels will be lit?',
      options: ['20', '21', '27', '28'],
      answer: 0,
      explain: [
        'Correct. One pixel per step along x: 19 steps plus the starting pixel.',
        '21 is the straight-line length, about 20.6, rounded up. The count depends only on the longer of the two changes.',
        '27 is 19 + 8. That would be the count if across and up moves were separate steps, but a diagonal step does both at once.',
        '28 counts across and up moves separately and adds the starting pixel. Diagonal steps make it far fewer.',
      ],
      tryInput: { x0: 2, y0: 3, x1: 21, y1: 11 },
    },
    {
      type: 'debug',
      q: 'Asked for the line from (0, 0) to (2, 6), this version returns only (0,0), (1,1), (2,2) and never reaches the endpoint. What is wrong?',
      code: `def line(x0, y0, x1, y1):
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x1 > x0 else -1
    sy = 1 if y1 > y0 else -1
    error = 2 * dy - dx
    x, y = x0, y0
    pixels = [(x, y)]
    for _ in range(dx):
        if error > 0:
            y += sy
            error -= 2 * dx
        error += 2 * dy
        x += sx
        pixels.append((x, y))
    return pixels`,
      options: ['The error term should start at 0', 'It always steps along x, even when the line covers more rows than columns', 'The test should be error >= 0', 'sx and sy are the wrong way round'],
      answer: 1,
      explain: [
        'The starting value 2·dy − dx is right for a gentle line. Changing it would not make the loop long enough.',
        'Correct. This line is steep: 6 rows but only 2 columns. The loop must run 6 times, stepping along y each time and along x only when the error term says so.',
        'That only changes what happens on exact ties. The loop would still stop after two steps.',
        'The directions are correct. The problem is which axis drives the loop.',
      ],
    },
    {
      type: 'predict',
      q: 'Drawing from (0, 0) to (4, 2) lights (1, 0) and (3, 1) along the way. If you draw the same line backwards, from (4, 2) to (0, 0), are the same five pixels lit?',
      options: ['Yes, a line is the same in both directions', 'No: it lights (1, 1) and (3, 2) instead of (1, 0) and (3, 1)', 'No: it lights only four pixels', 'No: it misses (0, 0)'],
      answer: 1,
      explain: [
        'The true line is the same, but in columns 1 and 3 it passes exactly halfway between two pixels, and the tie is settled by the direction of travel.',
        'Correct. On a tie the rule keeps the straight step. Travelling the other way, the straight step lands on the other pixel of each tied pair.',
        'Both directions take four steps and light five pixels.',
        'Both endpoints are always lit.',
      ],
      tryInput: { x0: 4, y0: 2, x1: 0, y1: 0 },
    },
    {
      type: 'challenge',
      title: 'A circle with the same trick',
      prompt: 'Write a function that lights the pixels of a circle of whole-number radius r centred on a pixel, using only integer addition, subtraction and comparison inside the loop. Start at the top of the circle and walk one eighth of the way round. At each step choose between moving right and moving right and down, by tracking the sign of x² + y² − r² at the midpoint between the two candidates. Use symmetry to light the other seven eighths.',
      hints: ['You never need to recompute x² + y². Work out how it changes when x grows by one, and when y shrinks by one.', 'The first eighth ends when x becomes larger than y.', 'Each point (x, y) gives eight pixels: swap x and y, and change the sign of either or both.'],
    },
  ],

  compare: {
    idea: 'Step one pixel at a time along the longer direction and use the sign of an integer error term to decide when to step sideways.',
    requires: 'Two end points on whole-number grid positions. The result is exact: the nearest square at every step.',
    sensitivity: 'None in running time beyond the line\'s length. The output depends on the direction of travel only at exact ties.',
    memory: 'O(1): the current pixel, the error term and four constants.',
    difficulty: 'low',
    difficultyNote: 'A dozen lines. The care goes into covering all eight directions and the endpoints.',
    limits: 'Squares are either on or off, so lines look stepped. It marks one square per step, so it does not list every square the line touches.',
    useWhen: 'You need the squares of a grid along a straight line, quickly and exactly, and stepped edges are acceptable.',
  },

  advanced: {
    history: 'Jack Bresenham developed the algorithm in 1962 at IBM\'s development laboratory in San Jose, where a Calcomp plotter had been attached to an IBM 1401 computer. He published it in the IBM Systems Journal in 1965. In 1977 he published a companion algorithm for circular arcs based on the same idea. The derivation through the midpoint between two candidate pixels, used in this lesson and in most textbooks, follows work by M. L. V. Pitteway (1967) and J. R. Van Aken (1984). Xiaolin Wu published a fast antialiased line algorithm in 1991.',
    derivation: 'For a gentle line heading right and up, write the line as the zero set of\n\n$$F(x, y) = \\Delta y\\,(x - x_0) - \\Delta x\\,(y - y_0).$$\n\n$F$ is positive below the line and negative above it. From pixel $(x, y)$ the candidates are $E = (x+1, y)$ and $NE = (x+1, y+1)$, with midpoint $M = (x+1, y+\\tfrac12)$. Define the decision variable\n\n$$D = 2F(M) = 2\\Delta y\\,(x + 1 - x_0) - 2\\Delta x\\,(y - y_0) - \\Delta x.$$\n\nIf $D > 0$ the line passes above $M$ and $NE$ is nearer; otherwise $E$ is nearer or tied. At the start $(x, y) = (x_0, y_0)$, so $D_0 = 2\\Delta y - \\Delta x$. Choosing $E$ replaces $x$ by $x+1$ and gives $D \\leftarrow D + 2\\Delta y$. Choosing $NE$ also replaces $y$ by $y+1$ and gives $D \\leftarrow D + 2\\Delta y - 2\\Delta x$. Both increments are constants, so the loop needs no multiplication.',
    proof: 'Claim: every lit pixel is within half a pixel of the true line along the minor axis. Let $e_k$ be the true height minus the chosen row at step $k$, so $e_0 = 0$. The decision variable satisfies $D = 2\\Delta x\\,(e_k + m - \\tfrac12)$ where $m = \\Delta y / \\Delta x \\le 1$ is the slope. If $D \\le 0$ the row is kept and $e_{k+1} = e_k + m \\le \\tfrac12$. If $D > 0$ the row rises and $e_{k+1} = e_k + m - 1 > -\\tfrac12$. In the first case $e_{k+1} \\ge e_k \\ge -\\tfrac12$ by induction, and in the second $e_{k+1} \\le e_k \\le \\tfrac12$ because $m \\le 1$. So $-\\tfrac12 \\le e_k \\le \\tfrac12$ for every $k$. After $\\Delta x$ steps the true height is $y_1$, a whole number. The chosen row is also a whole number and differs from it by at most one half, so it is $y_1$: the last pixel is the endpoint.',
    complexityProof: 'The loop body executes $\\Delta_{major}$ times. Each execution performs one comparison, two additions for the straight step, and two more if the step is diagonal. Exactly $\\Delta_{minor}$ of the steps are diagonal, because the line must gain that many pixels in the minor direction and gains at most one per step. The total is $\\Delta_{major}$ comparisons and $2(\\Delta_{major} + \\Delta_{minor})$ additions, which is what the chart on this page measures.',
    variants: [
      { name: 'Midpoint line algorithm', text: 'The same algorithm derived by testing which side of the line the midpoint between two candidates lies on. The derivation extends directly to circles and ellipses.' },
      { name: 'Bresenham\'s circle algorithm', text: 'Walks one eighth of a circle with an integer decision variable and mirrors each point into the other seven eighths.' },
      { name: 'Run-length versions', text: 'A gentle line is a sequence of horizontal runs whose lengths take only two adjacent values. Computing whole runs at a time lights several pixels per decision.' },
      { name: 'Xiaolin Wu\'s antialiased line', text: 'Lights the two pixels that straddle the true line at each step, with brightness in proportion to how close each is.' },
      { name: 'Three dimensions', text: 'One driving axis and two error terms, one for each of the other axes, give the voxels along a line in space.' },
    ],
    implementation: 'Decide the tie rule deliberately and keep it the same everywhere. If shared edges must match, always draw between two given points in one canonical direction. Clip lines to the screen before drawing in a way that preserves the error term, or pixels near the border will shift. Use an integer type with at least two more bits than the largest coordinate.',
    benchmarking: 'On current processors fractional arithmetic is fast, so the speed advantage over a careful DDA is small or absent, and memory writes dominate. The lasting advantages are exactness and suitability for simple hardware. Compare outputs pixel by pixel, including ties, before comparing speed.',
    references: [
      { authors: 'J. E. Bresenham', year: 1965, title: 'Algorithm for computer control of a digital plotter', venue: 'IBM Systems Journal 4(1), 25-30' },
      { authors: 'J. E. Bresenham', year: 1977, title: 'A linear algorithm for incremental digital display of circular arcs', venue: 'Communications of the ACM 20(2), 100-106' },
      { authors: 'M. L. V. Pitteway', year: 1967, title: 'Algorithm for drawing ellipses or hyperbolae with a digital plotter', venue: 'The Computer Journal 10(3), 282-289' },
      { authors: 'X. Wu', year: 1991, title: 'An efficient antialiasing technique', venue: 'Computer Graphics (Proceedings of SIGGRAPH 91) 25(4)' },
      { authors: 'J. Amanatides and A. Woo', year: 1987, title: 'A fast voxel traversal algorithm for ray tracing', venue: 'Proceedings of Eurographics 87' },
    ],
    furtherReading: [
      'J. D. Foley, A. van Dam, S. K. Feiner and J. F. Hughes, *Computer Graphics: Principles and Practice* (2nd edition), section 3.2, "Scan converting lines".',
      'S. Thrun, W. Burgard and D. Fox, *Probabilistic Robotics*, chapter 9, on occupancy grid mapping.',
    ],
  },

  tests: [
    { name: 'default line: endpoints, pixel count, half-pixel bound, no gaps', input: {},
      check: (r) => checkLine(r) },
    { name: 'the worked example lights (0,0) (1,0) (2,1) (3,1) (4,2) (5,2)', input: { x0: 0, y0: 0, x1: 5, y1: 2 },
      check: (r) => r.pixels.map(key).join(' ') === '0,0 1,0 2,1 3,1 4,2 5,2' || `got ${r.pixels.map(key).join(' ')}` },
    { name: 'the default line has max(19, 8) + 1 = 20 pixels', input: { x0: 2, y0: 3, x1: 21, y1: 11 },
      check: (r, c) => (r.pixels.length === 20 && c.comparisons === 19 && c.additions === 2 * (19 + 8)) || `got ${r.pixels.length} pixels, ${c.additions} additions` },
    { name: 'every pair of endpoints on a 9 by 7 grid, in all eight octants', input: {},
      check: () => allPairs(9, 7, (ax, ay, bx, by) => checkLine(trace(ax, ay, bx, by))) },
    { name: 'mirror images of a line are mirror images pixel for pixel', input: {},
      check: () => allPairs(8, 6, (ax, ay, bx, by) => {
        const a = trace(ax, ay, bx, by).pixels, m = trace(7 - ax, ay, 7 - bx, by).pixels, v = trace(ax, 5 - ay, bx, 5 - by).pixels;
        return a.every((p, i) => m[i][0] === 7 - p[0] && m[i][1] === p[1] && v[i][0] === p[0] && v[i][1] === 5 - p[1]) || 'mirror image differs';
      }) },
    { name: 'a reversed line lights the same pixels whenever no exact tie can occur', input: {},
      check: () => allPairs(9, 7, (ax, ay, bx, by) => {
        const r = trace(ax, ay, bx, by);
        if (r.major === 0 || (r.major / gcd(r.major, r.minor)) % 2 === 0) return true;   // ties are possible: skip
        const fwd = new Set(r.pixels.map(key)), back = trace(bx, by, ax, ay).pixels;
        return back.every((p) => fwd.has(key(p))) || 'reversed line differs without a tie';
      }) },
    { name: 'the tie case in the quiz: (4,2) to (0,0) lights (3,2) and (1,1)', input: { x0: 4, y0: 2, x1: 0, y1: 0 },
      check: (r) => {
        const back = r.pixels.map(key).join(' '), fwd = trace(0, 0, 4, 2).pixels.map(key).join(' ');
        return (back === '4,2 3,2 2,1 1,1 0,0' && fwd === '0,0 1,0 2,1 3,1 4,2') || `forward ${fwd}; backward ${back}`;
      } },
    { name: 'single pixel, horizontal, vertical and diagonal lines', input: { x0: 7, y0: 7, x1: 7, y1: 7 },
      check: (r) => {
        if (r.pixels.length !== 1) return 'a single-pixel line should light one pixel';
        const h = trace(2, 5, 9, 5).pixels, v = trace(4, 9, 4, 1).pixels, d = trace(10, 10, 3, 3).pixels;
        if (!h.every((p, i) => p[0] === 2 + i && p[1] === 5)) return 'horizontal line is wrong';
        if (!v.every((p, i) => p[0] === 4 && p[1] === 9 - i)) return 'vertical line is wrong';
        return d.every((p, i) => p[0] === 10 - i && p[1] === 10 - i) || 'diagonal line is wrong';
      } },
  ],
};
