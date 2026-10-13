// Tiny DOM helpers. h('div.card', { onclick }, child, ...) builds elements; rich() renders lesson prose.

export function h(spec, attrs, ...children) {
  if (attrs === null || attrs === undefined || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) {
    if (attrs !== undefined && attrs !== null) children.unshift(attrs);
    attrs = {};
  }
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val; } }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Inline lesson markup: `code`, **strong**, *em*, $tex$, [label](#/route).
export function rich(text) {
  const stash = [];
  const keep = (html) => { stash.push(html); return `\u0000${stash.length - 1}\u0000`; };
  let s = String(text ?? '');
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => keep(`<span class="math math-block" data-tex="${esc(tex.trim())}" data-display="1">${esc(tex.trim())}</span>`));
  s = s.replace(/\$([^$\n]+?)\$/g, (_, tex) => keep(`<span class="math" data-tex="${esc(tex)}">${esc(tex)}</span>`));
  s = s.replace(/`([^`\n]+?)`/g, (_, code) => keep(`<code>${esc(code)}</code>`));
  s = esc(s);
  s = s.replace(/\[([^\]]+?)\]\((#\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)]);
}

// Block markup: blank lines separate paragraphs; lines starting "- " form a list.
export function richBlock(text) {
  const blocks = String(text ?? '').trim().split(/\n\s*\n/);
  return blocks.map((b) => {
    const lines = b.split('\n').map((l) => l.trim());
    if (lines.every((l) => l.startsWith('- '))) return `<ul>${lines.map((l) => `<li>${rich(l.slice(2))}</li>`).join('')}</ul>`;
    return `<p>${rich(lines.join(' '))}</p>`;
  }).join('');
}

export function prose(text, cls = 'prose') {
  const el = h('div', { class: cls, html: richBlock(text) });
  renderMath(el);
  return el;
}

export function span(text, cls) {
  const el = h('span', { class: cls || '', html: rich(text) });
  renderMath(el);
  return el;
}

// KaTeX is fetched from the CDN the first time a page actually contains mathematics.
// Until it arrives (or if it never does) the TeX source stays readable.
const KATEX = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/';
let katexWaiters = [];
let katexState = 'idle';
function loadKatex() {
  if (katexState !== 'idle') return;
  katexState = 'loading';
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = KATEX + 'katex.min.css';
  document.head.append(css);
  const js = document.createElement('script');
  js.src = KATEX + 'katex.min.js';
  js.onload = () => { katexState = 'ready'; const w = katexWaiters; katexWaiters = []; for (const root of w) renderMath(root); };
  js.onerror = () => { katexState = 'failed'; katexWaiters = []; };
  document.head.append(js);
}
export function renderMath(root) {
  const nodes = root.querySelectorAll ? root.querySelectorAll('.math:not([data-done])') : [];
  if (!nodes.length) return;
  if (!window.katex) { if (katexState !== 'failed') { katexWaiters.push(root); loadKatex(); } return; }
  for (const n of nodes) {
    try {
      window.katex.render(n.dataset.tex, n, { displayMode: n.dataset.display === '1', throwOnError: false, output: 'htmlAndMathml' });
      n.dataset.done = '1';
    } catch { /* leave the source text */ }
  }
}

export const fmt = (n) => (typeof n === 'number' ? (Number.isInteger(n) ? n.toLocaleString('en-US') : (Math.abs(n) >= 100 ? n.toFixed(1) : n.toPrecision(4)).replace(/\.?0+$/, '')) : String(n));

export function debounce(fn, ms = 150) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const prefersReducedMotion = () =>
  document.documentElement.dataset.motion === 'reduce' ||
  (document.documentElement.dataset.motion !== 'full' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

let uid = 0;
export const nextId = (p = 'id') => `${p}-${++uid}`;

// Scroll an element to the top of the window and keep it there while the page finishes
// laying out. Figures, code and mathematics above it settle a moment after a page appears,
// which would otherwise leave a linked section off screen. Stops as soon as the reader
// scrolls, clicks or types.
export function holdInView(el) {
  let mine = true;
  const stop = () => { mine = false; };
  for (const ev of ['wheel', 'touchstart', 'keydown', 'mousedown']) window.addEventListener(ev, stop, { once: true, passive: true });
  const rest = () => parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const place = () => { if (mine && el.isConnected && Math.abs(el.getBoundingClientRect().top - rest()) > 6) el.scrollIntoView({ block: 'start' }); };
  requestAnimationFrame(place);
  for (const ms of [120, 400, 900, 1600]) setTimeout(place, ms);
}
