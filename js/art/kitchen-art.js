// Line drawings for "Algorithms for the kitchen": one per recipe, and a pot that steams.
// Drawn in currentColor so they follow the theme. The moving parts carry class names that
// css/pages.css animates (kitchen section); nothing moves when the reader asks for less motion.

const svg = (body, { size = 56, label = '' } = {}) =>
  `<svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${body}</svg>`;

// A spice jar. Its lid lifts when the card is pointed at.
export const jarArt = (o) => svg(`
  <g class="ka-lid"><rect x="20" y="9" width="24" height="8" rx="2"/><path d="M24 9v8M30 9v8M36 9v8M42 9v8" stroke-width="1.2"/></g>
  <path d="M22 17h20v4c3 1 5 4 5 8v22a6 6 0 0 1-6 6H23a6 6 0 0 1-6-6V29c0-4 2-7 5-8z"/>
  <rect x="17" y="31" width="30" height="13" fill="currentColor" fill-opacity="0.14" stroke="none"/>
  <path d="M17 31h30M17 44h30" stroke-width="1.4"/>
  <circle cx="26" cy="51" r="1" fill="currentColor"/><circle cx="32" cy="52" r="1" fill="currentColor"/><circle cx="38" cy="50.5" r="1" fill="currentColor"/>`, o);

// A kitchen timer. Its hand sweeps round when the card is pointed at.
export const timerArt = (o) => svg(`
  <rect x="28" y="6" width="8" height="6" rx="1.5"/><path d="M32 12v4"/>
  <circle cx="32" cy="37" r="21"/>
  <path d="M32 19v3M50 37h-3M32 55v-3M14 37h3M44.7 24.3l-2.1 2.1M44.7 49.7l-2.1-2.1M19.3 49.7l2.1-2.1M19.3 24.3l2.1 2.1" stroke-width="1.6"/>
  <g class="ka-hand"><path d="M32 37V25"/></g>
  <circle cx="32" cy="37" r="2.2" fill="currentColor"/>`, o);

// Half a lemon. It rocks when the card is pointed at.
export const lemonArt = (o) => svg(`
  <g class="ka-rock">
    <circle cx="32" cy="34" r="22"/>
    <circle cx="32" cy="34" r="17" fill="currentColor" fill-opacity="0.12"/>
    <path d="M32 17v34M15 34h34M20 22l24 24M44 22L20 46" stroke-width="1.4"/>
    <circle cx="32" cy="34" r="2.5" fill="currentColor" stroke="none"/>
  </g>`, o);

// A pot on a low flame, with three wisps of steam that rise and fade on a slow loop.
export const potArt = (o) => svg(`
  <path class="ka-steam ka-steam-1" d="M24 20c-3-3 3-5 0-9"/>
  <path class="ka-steam ka-steam-2" d="M32 19c-3-3 3-5 0-9"/>
  <path class="ka-steam ka-steam-3" d="M40 20c-3-3 3-5 0-9"/>
  <path d="M14 27h36"/><path d="M10 27h4M50 27h4"/>
  <path d="M16 27v17a6 6 0 0 0 6 6h20a6 6 0 0 0 6-6V27"/>
  <path d="M26 24h12" stroke-width="2.4"/>
  <path class="ka-flame" d="M26 58c0-2 2-3 2-5 1 2 2 3 2 5M34 58c0-2 2-3 2-5 1 2 2 3 2 5" stroke-width="1.6"/>`, { size: 120, ...o });

// A slice of pizza. It lifts away from the pie when the card is pointed at.
export const pizzaArt = (o) => svg(`
  <path d="M12 40a22 22 0 0 0 40 0" stroke-width="1.6" opacity="0.55"/>
  <g class="ka-slice">
    <path d="M32 50L14 18c11-6 25-6 36 0z"/>
    <path d="M14 18c11-6 25-6 36 0" stroke-width="4" opacity="0.35"/>
    <circle cx="27" cy="25" r="2.6" fill="currentColor" fill-opacity="0.3"/><circle cx="37" cy="27" r="2.6" fill="currentColor" fill-opacity="0.3"/><circle cx="31" cy="36" r="2.4" fill="currentColor" fill-opacity="0.3"/>
  </g>`, o);

export const recipeArt = { spices: jarArt, dinner: timerArt, dressing: lemonArt, pizza: pizzaArt };

// Seven bars that sort themselves into order and back, on a slow loop: algorithms at work.
// Each bar moves between its place in a jumbled row and its place in the sorted row.
export const sortingArt = () => {
  const heights = [34, 58, 22, 70, 46, 28, 62];
  const sorted = heights.slice().sort((a, b) => a - b);
  const bars = heights.map((hgt, i) => {
    const to = sorted.indexOf(hgt);
    return `<rect class="ka-bar" x="${8 + i * 20}" y="${86 - hgt}" width="14" height="${hgt}" rx="2" style="--dx:${(to - i) * 20}px;--d:${i * 0.12}s"/>`;
  }).join('');
  return `<svg viewBox="0 0 150 96" width="150" height="96" aria-hidden="true" fill="currentColor"><path d="M2 88h146" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>${bars}</svg>`;
};

// Larger scenes for the recipe panels on the kitchen page, one per recipe. Drawn in
// currentColor, with soft fills of the same colour, so they follow each panel's accent and
// the theme. The moving parts carry class names that css/pages.css animates gently.
const scene = (body, label) =>
  `<svg viewBox="0 0 240 160" width="240" height="160" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}">${body}</svg>`;
const soft = 'fill="currentColor" fill-opacity="0.14"';

// A shelf of jars in alphabetical order. The middle one is looked at first.
function spiceScene() {
  const letters = ['A', 'C', 'F', 'J', 'M', 'P', 'T'];
  const jars = letters.map((l, i) => {
    const x = 18 + i * 30, mid = i === 3, h = [40, 46, 38, 48, 42, 46, 40][i], y = 118 - h;
    return `<g class="${mid ? 'ks-mid' : ''}">
      <g class="${mid ? 'ks-lid' : ''}"><rect x="${x + 3}" y="${y - 8}" width="18" height="8" rx="2" ${mid ? 'fill="currentColor" fill-opacity="0.5"' : soft}/></g>
      <rect x="${x}" y="${y}" width="24" height="${h}" rx="5" ${mid ? 'fill="currentColor" fill-opacity="0.22"' : soft}/>
      <rect x="${x}" y="${y + 12}" width="24" height="13" fill="var(--surface)" stroke-width="1.4"/>
      <text x="${x + 12}" y="${y + 22}" text-anchor="middle" font-size="10" font-weight="700" font-family="var(--font-sans)" fill="currentColor" stroke="none">${l}</text>
    </g>`;
  }).join('');
  return scene(`
    <path class="ks-arrow" d="M120 14v14M114 22l6 7 6-7" stroke-width="2.2"/>
    ${jars}
    <rect x="8" y="118" width="224" height="8" rx="2" fill="currentColor" fill-opacity="0.35"/>
    <path d="M24 126v14M216 126v14" stroke-width="3"/>`, 'A shelf of spice jars labelled A to T in order, with the middle jar being opened first');
}

// A roast chicken, a pot of potatoes and a clock showing seven o'clock.
function dinnerScene() {
  return scene(`
    <circle cx="198" cy="40" r="22" ${soft}/>
    <path d="M198 21v4M217 40h-4M198 59v-4M179 40h4" stroke-width="1.6"/>
    <path d="M198 40V25" stroke-width="2.2"/><path d="M198 40l-6 10" stroke-width="2.8"/>
    <circle cx="198" cy="40" r="2" fill="currentColor"/>
    <path class="ks-steam ks-steam-1" d="M66 70c-4-5 4-8 0-14"/>
    <path class="ks-steam ks-steam-2" d="M82 66c-4-5 4-8 0-14"/>
    <path class="ks-steam ks-steam-3" d="M98 70c-4-5 4-8 0-14"/>
    <ellipse cx="82" cy="128" rx="58" ry="8" ${soft}/>
    <path d="M40 122c-4-20 14-36 42-36s46 16 42 36z" fill="currentColor" fill-opacity="0.22"/>
    <path d="M60 98c6-6 16-8 22-8" stroke-width="1.4" opacity="0.6"/>
    <ellipse cx="58" cy="104" rx="13" ry="9" transform="rotate(-35 58 104)" fill="currentColor" fill-opacity="0.32"/>
    <ellipse cx="106" cy="104" rx="13" ry="9" transform="rotate(35 106 104)" fill="currentColor" fill-opacity="0.32"/>
    <path d="M52 95l-8-10M112 95l8-10"/>
    <circle cx="41" cy="83" r="2.6"/><circle cx="46" cy="80" r="2.6"/><circle cx="123" cy="83" r="2.6"/><circle cx="118" cy="80" r="2.6"/>
    <path d="M156 100h44v22a6 6 0 0 1-6 6h-32a6 6 0 0 1-6-6z" ${soft}/>
    <path d="M150 100h56M148 108h8M200 108h8"/><path d="M172 94h12" stroke-width="2.6"/>
    <path d="M10 136h220" stroke-width="2.4"/>`, 'A roast chicken on a platter, a pot of potatoes and a clock showing seven o\'clock');
}

// A bowl of salad, a bottle of oil and half a lemon dripping into the bowl.
function dressingScene() {
  return scene(`
    <path d="M26 52h16v-12h-4v-10h-8v10h-4z" ${soft}/>
    <path d="M22 60c0-6 4-8 4-8h16s4 2 4 8v62a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6z" ${soft}/>
    <path d="M22 96h24v26a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6z" fill="currentColor" fill-opacity="0.3" stroke="none"/>
    <g class="ks-lemon">
      <circle cx="176" cy="38" r="22" ${soft}/>
      <circle cx="176" cy="38" r="16" fill="var(--surface)" stroke-width="1.4"/>
      <path d="M176 22v32M160 38h32M165 27l22 22M187 27l-22 22" stroke-width="1.2"/>
    </g>
    <path class="ks-drop" d="M172 64c-3 4-4 6-4 8a4 4 0 0 0 8 0c0-2-1-4-4-8z" fill="currentColor" fill-opacity="0.6" stroke-width="1.4"/>
    <path d="M90 102c4-18 18-22 26-16M120 98c6-16 22-18 28-10M104 100c-2-14 6-22 14-22M138 102c4-12 14-14 20-10" fill="currentColor" fill-opacity="0.22" stroke-width="1.6"/>
    <path d="M78 100h104c0 22-20 36-52 36s-52-14-52-36z" ${soft}/>
    <path d="M10 140h220" stroke-width="2.4"/>`, 'A bowl of salad, a bottle of oil, and half a lemon dripping juice into the bowl');
}

// A wood-fired oven with a fire inside: snow falling on one side, sun on the other.
function pizzaScene() {
  const flakes = [[20, 30], [38, 54], [16, 78], [44, 96], [26, 112]].map(([x, y], i) =>
    `<g class="ks-flake" style="--d:${i * 0.7}s"><path d="M${x} ${y - 4}v8M${x - 4} ${y}h8M${x - 3} ${y - 3}l6 6M${x + 3} ${y - 3}l-6 6" stroke-width="1.3"/></g>`).join('');
  return scene(`
    ${flakes}
    <circle cx="212" cy="30" r="9" ${soft}/>
    <path d="M212 14v-4M212 50v-4M196 30h-4M232 30h-4M200 18l-3-3M227 45l-3-3M224 18l3-3M197 45l3-3" stroke-width="1.5"/>
    <path class="ks-smoke ks-smoke-1" d="M152 24c-4-4 4-6 0-11"/><path class="ks-smoke ks-smoke-2" d="M160 22c-4-4 4-6 0-11"/>
    <rect x="148" y="28" width="16" height="30" rx="2" ${soft}/>
    <path d="M58 136V104a62 62 0 0 1 124 0v32z" fill="currentColor" fill-opacity="0.2"/>
    <path d="M94 136v-16a26 26 0 0 1 52 0v16z" fill="var(--surface)"/>
    <g class="ks-fire">
      <path d="M108 136c-4-10 4-14 6-22 3 8 8 12 4 22z" fill="currentColor" fill-opacity="0.55" stroke-width="1.4"/>
      <path d="M120 136c-3-8 3-12 4-18 3 6 6 10 3 18z" fill="currentColor" fill-opacity="0.35" stroke-width="1.4"/>
    </g>
    <path d="M10 136h220" stroke-width="2.4"/>`, 'A dome-shaped wood-fired oven with a fire inside, snow falling on the left and the sun shining on the right');
}

export const sceneArt = { spices: spiceScene, dinner: dinnerScene, dressing: dressingScene, pizza: pizzaScene };
