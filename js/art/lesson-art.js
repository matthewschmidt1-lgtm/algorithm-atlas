// Small scenes for the lessons on the beginners' path, shown beside The Simple Explanation.
// Each one draws the lesson's own idea, not a decoration: a finger reading down a list, the
// middle of a dictionary, bubbles rising, a rectangle filling with squares. Drawn in
// currentColor so they take the lesson's accent and follow the theme. The moving parts carry
// class names that css/pages.css animates; nothing moves when the reader asks for less motion.

const scene = (body, label) =>
  `<svg viewBox="0 0 240 160" width="240" height="160" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}">${body}</svg>`;
const soft = (o = 0.14) => `fill="currentColor" fill-opacity="${o}"`;
const paper = 'fill="var(--surface)"';

// A finger reading down a sign-up sheet, one name at a time.
function linearSearch() {
  const lines = [0, 1, 2, 3, 4, 5].map((i) => `<path d="M78 ${44 + i * 16}h${[52, 38, 60, 44, 56, 34][i]}" stroke-width="3" opacity="${i === 3 ? 1 : 0.45}"/>`).join('');
  return scene(`
    <rect x="62" y="18" width="104" height="132" rx="4" ${paper}/>
    <path d="M78 30h40" stroke-width="2.4"/>
    ${lines}
    <g class="la-finger">
      <path d="M146 49h26a4 4 0 0 1 0 8h-26a4 4 0 0 1 0-8z" ${soft(0.3)}/>
      <path d="M149 51.5v3" stroke-width="1.2"/>
      <path d="M170 46c6-4 22-4 28 2v18c-6 6-22 6-28 0z" ${soft(0.3)}/>
      <path d="M176 61h14M176 66h12" stroke-width="1.4" opacity="0.7"/>
    </g>`, 'A finger moving down a sign-up sheet, checking one name at a time');
}

// A dictionary falling open at the middle, with a lens over the middle page.
function binarySearch() {
  return scene(`
    <path d="M120 40c-20-10-50-12-80-6v96c30-6 60-4 80 6z" ${paper}/>
    <path d="M120 40c20-10 50-12 80-6v96c-30-6-60-4-80 6z" ${paper}/>
    <path d="M120 40v96" stroke-width="2.4"/>
    <g class="la-half-left" opacity="0.55"><path d="M54 58h48M54 72h40M54 86h46M54 100h36" stroke-width="2.4"/>
      <text x="76" y="124" text-anchor="middle" font-size="12" font-weight="700" font-family="var(--font-sans)" fill="currentColor" stroke="none">A–L</text></g>
    <path d="M138 58h48M138 72h40M138 86h46M138 100h36" stroke-width="2.4" opacity="0.55"/>
    <text x="162" y="124" text-anchor="middle" font-size="12" font-weight="700" font-family="var(--font-sans)" fill="currentColor" stroke="none">M–Z</text>
    <g class="la-lens"><circle cx="120" cy="30" r="13" ${soft(0.18)}/><path d="M129 39l10 10" stroke-width="3"/></g>`, 'A dictionary open at the middle, with a magnifying glass over the middle pages');
}

// A glass of water with bubbles rising; the biggest rises fastest.
function bubbleSort() {
  const bubbles = [[96, 8, 0.0, 2.2], [120, 13, 0.4, 1.6], [140, 5, 1.0, 3.0], [108, 10, 1.6, 1.9], [132, 7, 2.2, 2.6]]
    .map(([x, r, d, t]) => `<circle class="la-bubble" cx="${x}" cy="128" r="${r}" ${soft(0.2)} style="--d:${d}s;--t:${t}s"/>`).join('');
  return scene(`
    <path d="M78 20l8 124h68l8-124" ${soft(0.06)}/>
    <path d="M82 46h76" stroke-width="1.6" opacity="0.6"/>
    ${bubbles}`, 'A glass of water with bubbles of different sizes rising to the top');
}

// The smallest apple lifted out of a crate and placed at the start of a row.
function selectionSort() {
  const apple = (x, y, r, cls = '') => `<g class="${cls}"><circle cx="${x}" cy="${y}" r="${r}" ${soft(0.28)}/><path d="M${x} ${y - r}v-5M${x} ${y - r - 3}c3-4 8-4 9-1" stroke-width="1.6"/></g>`;
  return scene(`
    <rect x="22" y="92" width="100" height="44" rx="3" ${soft(0.1)}/>
    <path d="M22 106h100M22 120h100" stroke-width="1.4" opacity="0.6"/>
    ${apple(46, 86, 12)}${apple(78, 84, 14)}${apple(106, 88, 10)}
    ${apple(150, 128, 8, 'la-apple')}
    <path d="M140 140h84" stroke-width="2.4"/>
    ${apple(178, 130, 9)}${apple(204, 128, 11)}`, 'Apples in a crate, with the smallest one lifted out and placed at the start of a row');
}

// A fanned hand of cards with one card sliding into its place.
function insertionSort() {
  const card = (x, rot, n, cls = '') => `<g class="${cls}" transform="rotate(${rot} ${x + 18} 140)"><rect x="${x}" y="52" width="36" height="54" rx="4" ${paper}/>
    <text x="${x + 8}" y="68" font-size="12" font-weight="700" font-family="var(--font-sans)" fill="currentColor" stroke="none">${n}</text></g>`;
  return scene(`
    ${card(62, -18, 2)}${card(84, -6, 5)}${card(128, 6, 9)}${card(150, 18, 11)}
    ${card(106, 0, 7, 'la-card')}
    <path d="M70 140c30 10 70 10 100 0" stroke-width="2" opacity="0.5"/>`, 'A fanned hand of playing cards with one card sliding into its place');
}

// Two sorted stacks being combined into one.
function mergeSort() {
  const stack = (x, nums, top) => nums.map((n, i) => `<g><rect x="${x}" y="${top - i * 10}" width="44" height="28" rx="3" ${paper}/>
    <text x="${x + 22}" y="${top - i * 10 + 18}" text-anchor="middle" font-size="11" font-weight="700" font-family="var(--font-sans)" fill="currentColor" stroke="none">${i === nums.length - 1 ? n : ''}</text></g>`).join('');
  return scene(`
    ${stack(20, [8, 5], 112)}
    ${stack(176, [9, 6, 3], 112)}
    <rect x="98" y="112" width="44" height="28" rx="3" stroke-dasharray="4 4" stroke-width="1.6" opacity="0.6"/>
    <g class="la-move"><rect x="20" y="74" width="44" height="28" rx="3" ${soft(0.22)}/>
      <text x="42" y="92" text-anchor="middle" font-size="11" font-weight="700" font-family="var(--font-sans)" fill="currentColor" stroke="none">2</text></g>
    <path d="M70 66c14-14 30-14 40 0M170 66c-14-14-30-14-40 0" stroke-width="1.6" opacity="0.5"/>
    <path d="M10 146h220" stroke-width="2.4"/>`, 'Two sorted stacks of cards, with the smaller top card moving onto a new combined stack');
}

// A line of people split around one person holding a flag: shorter to the left, taller to the right.
function quickSort() {
  const person = (x, hgt, flag = false) => {
    const top = 140 - hgt;
    return `<g><circle cx="${x}" cy="${top + 7}" r="7" ${soft(flag ? 0.4 : 0.18)}/><path d="M${x} ${top + 14}v${hgt - 34}M${x} ${140 - 20}l-7 20M${x} ${140 - 20}l7 20M${x - 9} ${top + 26}h18"/>
      ${flag ? `<g class="la-flag"><path d="M${x + 9} ${top + 26}v-30"/><path d="M${x + 9} ${top - 4}l18 6-18 6z" ${soft(0.5)}/></g>` : ''}</g>`;
  };
  return scene(`
    ${person(28, 58)}${person(56, 66)}${person(84, 62)}
    ${person(120, 80, true)}
    ${person(160, 92)}${person(188, 100)}${person(216, 96)}
    <path d="M102 150h36" stroke-width="2.4"/>
    <path d="M14 150h76M150 150h80" stroke-width="1.6" opacity="0.5"/>`, 'A line of people split around one person holding a flag, shorter people to the left and taller to the right');
}

// A 48 by 18 floor filled with ever smaller squares: two of 18, one of 12, two of 6.
function euclid() {
  const k = 4.2, ox = 20, oy = 42;
  const sq = (x, y, s, i) => `<rect class="la-tile" x="${ox + x * k}" y="${oy + y * k}" width="${s * k}" height="${s * k}" ${soft(0.12 + i * 0.06)} style="--d:${i * 0.6}s"/>`;
  return scene(`
    <rect x="${ox}" y="${oy}" width="${48 * k}" height="${18 * k}" stroke-width="2.4"/>
    ${sq(0, 0, 18, 0)}${sq(18, 0, 18, 1)}${sq(36, 0, 12, 2)}${sq(36, 12, 6, 3)}${sq(42, 12, 6, 4)}
    <text x="${ox + 24 * k}" y="${oy - 8}" text-anchor="middle" font-size="11" font-family="var(--font-sans)" fill="currentColor" stroke="none">48</text>
    <text x="${ox - 5}" y="${oy + 9 * k + 4}" text-anchor="end" font-size="11" font-family="var(--font-sans)" fill="currentColor" stroke="none">18</text>`, 'A 48 by 18 rectangle filled with two squares of side 18, one of side 12 and two of side 6');
}

// The numbers 2 to 31 in a grid; the multiples fade away and the primes stay.
function sieve() {
  const smallest = (n) => { for (let p = 2; p * p <= n; p++) if (n % p === 0) return p; return n; };
  const cells = [];
  for (let n = 2; n <= 31; n++) {
    const i = n - 2, x = 22 + (i % 6) * 34, y = 16 + Math.floor(i / 6) * 27, p = smallest(n), prime = p === n;
    const delay = prime ? 0 : { 2: 0.6, 3: 1.6, 5: 2.6 }[p];
    cells.push(`<g class="${prime ? 'la-prime' : 'la-out'}" style="--d:${delay}s"><rect x="${x}" y="${y}" width="28" height="22" rx="3" ${prime ? soft(0.22) : paper}/>
      <text x="${x + 14}" y="${y + 15}" text-anchor="middle" font-size="11" font-weight="${prime ? 700 : 400}" font-family="var(--font-sans)" fill="currentColor" stroke="none">${n}</text></g>`);
  }
  return scene(cells.join(''), 'The numbers 2 to 31 in a grid, with the multiples of 2, 3 and 5 fading away to leave the primes');
}

// Ripples spreading across a pond and reaching the points around it.
function bfs() {
  const pts = [[150, 70, 1], [92, 96, 1], [176, 104, 2], [70, 52, 2], [196, 50, 3], [40, 110, 3]];
  return scene(`
    <ellipse cx="120" cy="84" rx="112" ry="66" ${soft(0.08)}/>
    <circle class="la-ripple" cx="120" cy="84" r="10" style="--d:0s"/>
    <circle class="la-ripple" cx="120" cy="84" r="10" style="--d:1s"/>
    <circle class="la-ripple" cx="120" cy="84" r="10" style="--d:2s"/>
    <circle cx="120" cy="84" r="5" fill="currentColor"/>
    ${pts.map(([x, y, ring]) => `<circle class="la-point" cx="${x}" cy="${y}" r="6" ${paper} style="--d:${ring * 0.9}s"/>`).join('')}`, 'Ripples spreading outward across a pond from a dropped stone, reaching nearby points before distant ones');
}

// A string of beads, and the same string written as counts.
function runLength() {
  const beads = 'WWWWBBWWW'.split('').map((c, i) => `<circle cx="${30 + i * 22}" cy="54" r="9" ${c === 'B' ? 'fill="currentColor" fill-opacity="0.75"' : paper}/>`).join('');
  const label = (x, n, filled) => `<g class="la-count" style="--d:${x / 200}s"><text x="${x}" y="122" text-anchor="end" font-size="20" font-weight="700" font-family="var(--font-sans)" fill="currentColor" stroke="none">${n}</text>
    <circle cx="${x + 14}" cy="115" r="9" ${filled ? 'fill="currentColor" fill-opacity="0.75"' : paper}/></g>`;
  return scene(`
    <path d="M20 54h196" stroke-width="1.4" opacity="0.5"/>
    ${beads}
    <path class="la-arrow" d="M120 74v18M113 85l7 8 7-8" stroke-width="2.2"/>
    ${label(66, 4, false)}${label(128, 2, true)}${label(190, 3, false)}`, 'A string of beads, four white, two black and three white, written below as 4 white, 2 black, 3 white');
}

export const lessonArt = {
  'linear-search': linearSearch,
  'binary-search': binarySearch,
  'bubble-sort': bubbleSort,
  'selection-sort': selectionSort,
  'insertion-sort': insertionSort,
  'merge-sort': mergeSort,
  'quick-sort': quickSort,
  'euclidean-algorithm': euclid,
  'sieve-of-eratosthenes': sieve,
  bfs,
  'run-length-encoding': runLength,
};
