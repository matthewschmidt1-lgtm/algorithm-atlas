// The visitor's learning state. There are no accounts: everything lives in this browser's
// localStorage. If storage is blocked the site still works, and says plainly that nothing
// will be remembered after the tab closes.

const KEY = 'algorithm-atlas:v1';

const fresh = () => ({
  profile: null,          // { level, interests: [], goals: [], languages: [] } once the visitor answers
  welcomeDismissed: false,
  depth: 1,               // preferred explanation level: 1 simple, 2 understand, 3 deeper
  recents: [],            // [{ id, t }] most recent first
  favorites: [],          // lesson ids
  quiz: {},               // { [lessonId]: { [questionIndex]: { correct, t } } }
  collections: {},        // { [name]: [lessonIds] }
  pathSkips: {},          // { [pathId]: [stageIds] }
  pagesSeen: [],          // pages that count as journey stops, such as the kitchen
  language: 'python',
  settings: { theme: 'light', motion: 'auto', textScale: 1, contrast: 'normal' },
});

let state = fresh();
let persistent = false;
const listeners = new Set();

try {
  const probe = '__atlas_probe__';
  localStorage.setItem(probe, '1');
  localStorage.removeItem(probe);
  persistent = true;
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    state = { ...fresh(), ...saved, settings: { ...fresh().settings, ...(saved.settings || {}) } };
  }
} catch { persistent = false; }

// ?theme=dark or ?theme=light in the address overrides the saved theme for this visit.
try {
  const forced = new URLSearchParams(location.search).get('theme');
  if (forced === 'dark' || forced === 'light') state.settings.theme = forced;
} catch { /* no location */ }

function save() {
  if (persistent) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { persistent = false; }
  }
  for (const fn of listeners) fn(state);
}

export const store = {
  get state() { return state; },
  get persistent() { return persistent; },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  update(fn) { fn(state); save(); },

  visit(id) {
    state.recents = [{ id, t: Date.now() }, ...state.recents.filter((r) => r.id !== id)].slice(0, 40);
    save();
  },
  explored() { return new Set(state.recents.map((r) => r.id)); },
  seePage(id) { if (!state.pagesSeen.includes(id)) { state.pagesSeen = [...state.pagesSeen, id]; save(); } },
  pageSeen(id) { return state.pagesSeen.includes(id); },

  isFavorite(id) { return state.favorites.includes(id); },
  toggleFavorite(id) {
    state.favorites = state.favorites.includes(id) ? state.favorites.filter((x) => x !== id) : [id, ...state.favorites];
    save();
    return state.favorites.includes(id);
  },

  recordAnswer(lessonId, index, correct) {
    const q = state.quiz[lessonId] || (state.quiz[lessonId] = {});
    // keep the first correct answer; a later wrong click does not erase it
    if (!q[index] || !q[index].correct) q[index] = { correct, t: Date.now() };
    save();
  },
  answers(lessonId) { return state.quiz[lessonId] || {}; },
  // A lesson counts as mastered when every answerable question has been answered correctly.
  mastery(lessonId, answerable) {
    const a = state.quiz[lessonId] || {};
    const correct = Object.values(a).filter((x) => x.correct).length;
    return { answered: Object.keys(a).length, correct, total: answerable, mastered: answerable > 0 && correct >= answerable };
  },

  setDepth(d) { state.depth = d; save(); },
  setLanguage(l) { state.language = l; save(); },
  setProfile(p) { state.profile = p; state.welcomeDismissed = true; if (p && p.level) state.depth = p.level === 'advanced' ? 3 : p.level === 'intermediate' ? 2 : 1; save(); },

  addToCollection(name, id) {
    const list = state.collections[name] || (state.collections[name] = []);
    if (!list.includes(id)) list.push(id);
    save();
  },
  removeFromCollection(name, id) {
    if (!state.collections[name]) return;
    state.collections[name] = state.collections[name].filter((x) => x !== id);
    save();
  },
  deleteCollection(name) { delete state.collections[name]; save(); },

  toggleStageSkip(pathId, stageId) {
    const list = state.pathSkips[pathId] || (state.pathSkips[pathId] = []);
    const i = list.indexOf(stageId);
    if (i >= 0) list.splice(i, 1); else list.push(stageId);
    save();
  },

  setSetting(key, value) { state.settings[key] = value; save(); applySettings(); },

  reset() { const settings = state.settings; state = fresh(); state.settings = settings; save(); },
};

export function applySettings() {
  const s = state.settings;
  const root = document.documentElement;
  const themeChanged = root.dataset.theme !== s.theme;
  root.dataset.theme = s.theme;
  if (s.motion === 'reduce') root.dataset.motion = 'reduce'; else delete root.dataset.motion;
  if (s.contrast === 'high') root.dataset.contrast = 'high'; else delete root.dataset.contrast;
  root.style.setProperty('--text-scale', String(s.textScale || 1));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = s.theme === 'dark' ? '#1D211C' : '#F4F0E7';
  if (themeChanged) document.dispatchEvent(new CustomEvent('atlas:theme'));
  document.dispatchEvent(new CustomEvent('atlas:settings'));
}
