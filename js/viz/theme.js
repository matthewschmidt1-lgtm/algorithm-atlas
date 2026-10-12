// Canvas colours come from the CSS custom properties, so every visualization follows the
// theme. The visualization palette is the site palette: forest, moss, sage, terracotta,
// a deepened sand (ochre), brick and ink.

let cache = null;

export function palette() {
  if (cache) return cache;
  const cs = getComputedStyle(document.documentElement);
  const v = (n, fb) => cs.getPropertyValue(n).trim() || fb;
  cache = {
    bg: v('--bg', '#F4F0E7'),
    surface: v('--surface', '#FAF7F1'),
    surface2: v('--surface-2', '#EFEADF'),
    surface3: v('--surface-3', '#E3DCCB'),
    text: v('--text', '#292D27'),
    text2: v('--text-2', '#4C5248'),
    text3: v('--text-3', '#686D61'),
    line: v('--line-solid', '#D9D2C2'),
    terracotta: v('--viz-terracotta', '#B86F52'),
    ochre: v('--viz-ochre', '#C29A4C'),
    brick: v('--viz-brick', '#8A3F2A'),
    ink: v('--viz-ink', '#292D27'),
    forest: v('--viz-forest', '#3D6E52'),
    moss: v('--viz-moss', '#84935F'),
    sage: v('--viz-sage', '#9AA792'),
    stone: v('--viz-default', '#BDB9AB'),
    wall: v('--viz-wall', '#4E554A'),
    visited: v('--viz-visited', '#B9C3AE'),
    onFill: v('--viz-on-fill', '#FAF7F1'),
    mono: v('--font-mono', 'ui-monospace, monospace'),
    sans: v('--font-sans', 'system-ui, sans-serif'),
    serif: v('--font-serif', 'Georgia, serif'),
  };
  return cache;
}

export function invalidatePalette() { cache = null; }
if (typeof document !== 'undefined') document.addEventListener('atlas:theme', invalidatePalette);

// Semantic roles (left) share a small set of colours (keys). Lessons use the semantic
// name where one fits and a colour name only for neutral series such as clusters.
const GROUPS = {
  terracotta: ['active', 'current', 'on', 'terracotta'],
  ochre: ['compare', 'frontier', 'ochre'],
  brick: ['swap', 'alert', 'rejected', 'goal', 'target', 'brick'],
  ink: ['pivot', 'special', 'source', 'start', 'ink'],
  forest: ['done', 'sorted', 'path', 'tree', 'forest'],
  moss: ['moss'],
  sage: ['sage'],
  visited: ['visited'],
  stone: ['default'],
  wall: ['wall'],
  text: ['text'],
  text2: ['muted'],
  text3: ['dim', 'faint', 'off'],
};
const ROLE_TO_KEY = {};
for (const [key, roles] of Object.entries(GROUPS)) for (const r of roles) ROLE_TO_KEY[r] = key;

export const ROLES = Object.keys(ROLE_TO_KEY).concat(['empty']);
// Colour names usable for neutral series, in the order to assign them.
export const SERIES = ['forest', 'terracotta', 'ochre', 'moss', 'ink', 'brick', 'sage'];

export function roleKey(role) { return ROLE_TO_KEY[role] || 'stone'; }
export function roleColor(role, pal = palette()) { return pal[roleKey(role)] || pal.stone; }

function parse(c) {
  c = c.trim();
  if (c[0] === '#') {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = c.match(/(\d+(\.\d+)?)/g);
  return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
const mixCache = new Map();
export function mix(a, b, t) {
  const k = a + b + (Math.round(t * 50) / 50);
  let out = mixCache.get(k);
  if (!out) {
    const p = parse(a), q = parse(b);
    out = `rgb(${Math.round(p[0] + (q[0] - p[0]) * t)},${Math.round(p[1] + (q[1] - p[1]) * t)},${Math.round(p[2] + (q[2] - p[2]) * t)})`;
    if (mixCache.size > 4000) mixCache.clear();
    mixCache.set(k, out);
  }
  return out;
}
export function alpha(c, a) {
  const p = parse(c);
  return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
}
