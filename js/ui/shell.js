// The frame around every page: header with navigation, search, display settings and the
// progress indicator, and the footer.

import { h, clear } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { store } from '../core/store.js';
import { algos } from '../core/catalog.js';
import { createSearchBox } from './searchbox.js';

// One short label each, at every width, so the row never runs into the search button.
// Connections is reached from the Atlas page and the footer.
const NAV = [
  { path: '/track/business', label: 'Business', match: ['/track/business', '/case'] },
  { path: '/track/ai', label: 'AI and ML', match: ['/track/ai'] },
  { path: '/library', label: 'Library', match: ['/library', '/algorithm', '/concept', '/problems'] },
  { path: '/lab', label: 'Lab', match: ['/lab', '/compare'] },
  { path: '/paths', label: 'Paths', match: ['/paths', '/path'] },
  { path: '/about', label: 'About', match: ['/about', '/verification'] },
  { path: '/explore', label: 'Atlas', match: ['/explore', '/disciplines', '/discipline', '/connections'] },
];

const MARK = `<svg class="mark" viewBox="0 0 32 32" width="26" height="26" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M16 3.5c6.6 0 12.5 5 12.5 12.300S22.800 28.500 16 28.500 3.500 22.900 3.500 16 9.400 3.500 16 3.500z" opacity=".45"/><path d="M16.300 9c3.900 0 7.100 3 7.100 6.900s-3.100 7.100-7.300 7.100-7.100-3.200-7.100-7 3.400-7 7.300-7z" opacity=".75"/></g><circle cx="16" cy="16" r="2.600" fill="var(--terracotta)"/></svg>`;

let links = [];
let progressEl = null;

function progressRing() {
  const total = algos.length;
  const explored = [...store.explored()].filter((id) => algos.some((a) => a.id === id)).length;
  const frac = total ? explored / total : 0;
  const r = 9, c = 2 * Math.PI * r;
  return `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="${r}" fill="none" stroke="var(--line-2)" stroke-width="2"/><circle cx="13" cy="13" r="${r}" fill="none" stroke="var(--terracotta)" stroke-width="2" stroke-linecap="round" stroke-dasharray="${(c * frac).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 13 13)"/></svg><span class="progress-text"><b>${explored}</b> of ${total}<span class="sr-only"> lessons opened. Open your atlas.</span></span>`;
}

export function mountShell(headHost, footHost) {
  /* ---- search dialog ---- */
  const dialog = h('dialog.search-dialog', { 'aria-label': 'Search the atlas' });
  const box = createSearchBox({ large: true, onNavigate: () => dialog.close() });
  dialog.append(
    h('div.search-dialog-head', h('span.panel-cap', 'Search the atlas'), h('button.icon-btn', { type: 'button', 'aria-label': 'Close search', html: icon('x'), onclick: () => dialog.close() })),
    box.el,
    h('p.search-hint', 'Try a name, or describe the problem: "shortest route", "compress files", "make a neural network learn".'));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  const openSearch = () => { if (!dialog.open) { dialog.showModal(); box.clear(); box.focus(); } };

  /* ---- display settings ---- */
  const panel = h('div.settings-panel', { hidden: true, role: 'dialog', 'aria-label': 'Display and accessibility' });
  const settingsBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Display and accessibility settings', 'aria-expanded': 'false', title: 'Display and accessibility', html: icon('a11y') });
  const renderPanel = () => {
    const s = store.state.settings;
    const scale = Math.round((s.textScale || 1) * 100);
    const sw = (label, checked, onchange, help) => h('label.setting-row', h('span.setting-text', h('span.setting-label', label), help ? h('span.setting-help', help) : null),
      h('span.switch', h('input', { type: 'checkbox', checked, onchange }), h('span.switch-track')));
    clear(panel).append(
      h('div.panel-cap', 'Display and accessibility'),
      h('div.setting-row', h('span.setting-text', h('span.setting-label', 'Text size'), h('span.setting-help', `${scale}%`)),
        h('span.setting-buttons',
          h('button.btn.btn-sm', { type: 'button', 'aria-label': 'Smaller text', disabled: scale <= 90, onclick: () => { store.setSetting('textScale', Math.max(0.9, (s.textScale || 1) - 0.1)); renderPanel(); } }, 'A−'),
          h('button.btn.btn-sm', { type: 'button', 'aria-label': 'Larger text', disabled: scale >= 140, onclick: () => { store.setSetting('textScale', Math.min(1.4, (s.textScale || 1) + 0.1)); renderPanel(); } }, 'A+'))),
      sw('Night reading', s.theme === 'dark', (e) => { store.setSetting('theme', e.target.checked ? 'dark' : 'light'); syncTheme(); }, 'A dark version of the same page.'),
      sw('Reduce motion', s.motion === 'reduce', (e) => store.setSetting('motion', e.target.checked ? 'reduce' : 'auto'), 'Stops ambient animation. Demonstrations still step when you ask.'),
      sw('Higher contrast', s.contrast === 'high', (e) => store.setSetting('contrast', e.target.checked ? 'high' : 'normal'), 'Darker secondary text and stronger rules.'),
      h('div.setting-row', h('span.setting-text', h('span.setting-label', 'Open lessons at'), h('span.setting-help', 'You can change level on any lesson.')),
        h('select.setting-select', { 'aria-label': 'Default explanation level', onchange: (e) => store.setDepth(Number(e.target.value)) },
          [[1, 'Explain it simply'], [2, 'Help me understand'], [3, 'Go deeper']].map(([v, t]) => h('option', { value: v, selected: store.state.depth === v }, t)))));
  };
  const togglePanel = (yes) => {
    const show = yes ?? panel.hidden;
    panel.hidden = !show;
    settingsBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (show) { renderPanel(); const first = panel.querySelector('button, input, select'); if (first) first.focus(); }
  };
  settingsBtn.addEventListener('click', () => togglePanel());
  document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target) && !settingsBtn.contains(e.target)) togglePanel(false); });

  const themeBtn = h('button.icon-btn', { type: 'button', onclick: () => { store.setSetting('theme', store.state.settings.theme === 'dark' ? 'light' : 'dark'); syncTheme(); } });
  function syncTheme() {
    const dark = store.state.settings.theme === 'dark';
    themeBtn.innerHTML = icon(dark ? 'sun' : 'moon');
    const label = dark ? 'Switch to the light theme' : 'Switch to night reading';
    themeBtn.setAttribute('aria-label', label);
    themeBtn.title = label;
    if (!panel.hidden) renderPanel();
  }
  syncTheme();

  progressEl = h('a.progress-link', { href: '#/profile', title: 'Your atlas: progress, favourites and recommendations', html: progressRing() });
  store.subscribe(() => { progressEl.innerHTML = progressRing(); });

  links = NAV.map((n) => ({ ...n, el: h('a.nav-link', { href: '#' + n.path }, n.label) }));

  headHost.replaceWith(h('header.site-head',
    h('div.head-row.wrap',
      h('a.wordmark', { href: '#/', 'aria-label': 'Algorithm Atlas, home', html: `${MARK}<span>Algorithm Atlas</span>` }),
      h('nav.primary', { 'aria-label': 'Primary' }, links.map((l) => l.el)),
      h('div.head-tools',
        h('button.search-open', { type: 'button', onclick: openSearch, 'aria-label': 'Search the atlas', html: `${icon('search', { size: 17 })}<span class="search-open-text">Search</span><kbd aria-hidden="true">/</kbd>` }),
        progressEl, themeBtn, h('div.settings-wrap', settingsBtn, panel))),
    dialog));

  footHost.replaceWith(h('footer.site-foot',
    h('div.wrap.foot-grid',
      h('div.foot-about',
        h('p.foot-mark', { html: `${MARK}<span>Algorithm Atlas</span>` }),
        store.persistent ? null : h('p.foot-note', 'This browser is blocking storage, so progress will not be remembered after you close the tab.'),
        h('p.foot-made', h('a', { href: 'https://matthew-schmidt-production.up.railway.app/', target: '_blank', rel: 'noopener' }, 'Made by Matty'))),
      h('nav.foot-nav', { 'aria-label': 'Footer' },
        h('div', h('p.panel-cap', 'Explore'), h('a', { href: '#/explore' }, 'The Algorithm Universe'), h('a', { href: '#/disciplines' }, 'Disciplines'), h('a', { href: '#/problems' }, 'I want to…'), h('a', { href: '#/library' }, 'Algorithm Library'), h('a', { href: '#/connections' }, 'Connections')),
        h('div', h('p.panel-cap', 'Learn'), h('a', { href: '#/paths' }, 'Learning Paths'), h('a', { href: '#/lab' }, 'Interactive Lab'), h('a', { href: '#/compare' }, 'Compare algorithms'), h('a', { href: '#/profile' }, 'Your atlas')),
        h('div', h('p.panel-cap', 'About'), h('a', { href: '#/about' }, 'About the atlas'), h('a', { href: '#/verification' }, 'How lessons are checked'), h('a', { href: '#/about?at=accessibility' }, 'Accessibility'))))));

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
    if ((e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape' && !panel.hidden) { togglePanel(false); settingsBtn.focus(); }
  });

  return { openSearch };
}

export function setCurrentRoute(path) {
  for (const l of links) {
    const on = l.match.some((m) => path === m || path.startsWith(m + '/'));
    if (on) l.el.setAttribute('aria-current', 'page'); else l.el.removeAttribute('aria-current');
  }
}
