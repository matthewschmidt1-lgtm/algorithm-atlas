// A small hash router. Hash routes work on any static host with no server rewrites.
// Each route lazily imports its page module, which exports
//   default async function render({ params, query, path }) -> { el, title, destroy?, focus? }

import { h, clear } from './dom.js';

const routes = [];
let current = null;
let token = 0;
let outlet = null;
let onChange = () => {};

export function route(pattern, load) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '/?$');
  routes.push({ pattern, rx, keys, load });
}

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function href(path, query) {
  const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)).toString() : '';
  return '#' + path + (qs ? '?' + qs : '');
}

// Update the query string of the current route without re-rendering the page.
export function replaceQuery(query) {
  const { path } = parseHash();
  history.replaceState(null, '', href(path, query));
}

export function navigate(to) { location.hash = to.replace(/^#/, ''); }

async function go() {
  const my = ++token;
  const { path, query } = parseHash();
  let match = null, params = {};
  for (const r of routes) {
    const m = path.match(r.rx);
    if (m) { match = r; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break; }
  }
  if (!match) match = routes.find((r) => r.pattern === '/404');
  onChange(path);
  const slow = setTimeout(() => { if (my === token) outlet.setAttribute('aria-busy', 'true'); }, 180);
  let page;
  try {
    const mod = await match.load();
    page = await mod.default({ params, query, path });
  } catch (e) {
    console.error(e);
    page = { title: 'Something went wrong', el: h('div.page.narrow', h('p.eyebrow', 'Error'), h('h1', 'This page could not be shown.'), h('p.lede', 'The page failed to load. Check your connection and try again.'), h('p.muted.small', String(e && e.message ? e.message : e)), h('p', { style: { marginTop: '24px' } }, h('a.btn', { href: '#/' }, 'Back to the atlas'))) };
  }
  clearTimeout(slow);
  if (my !== token) { if (page && page.destroy) page.destroy(); return; }
  if (current && current.destroy) { try { current.destroy(); } catch (e) { console.error(e); } }
  current = page;
  outlet.removeAttribute('aria-busy');
  clear(outlet).append(page.el);
  document.title = page.title ? `${page.title} · Algorithm Atlas` : 'Algorithm Atlas';
  if (!page.keepScroll) window.scrollTo(0, 0);
  // Move focus to the new page's heading so keyboard and screen-reader users land in the right place.
  const target = page.el.querySelector('h1') || outlet;
  target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  if (page.afterMount) page.afterMount();
}

export function start(el, { onRoute } = {}) {
  outlet = el;
  if (onRoute) onChange = onRoute;
  window.addEventListener('hashchange', go);
  go();
}
