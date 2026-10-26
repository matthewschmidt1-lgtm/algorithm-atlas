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
