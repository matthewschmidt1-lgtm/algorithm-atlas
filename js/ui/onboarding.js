// Four optional questions that shape recommendations. Nothing is sent anywhere: the
// answers are stored in this browser alongside the rest of the visitor's progress.

import { h, nextId } from '../core/dom.js';
import { icon } from '../core/icons.js';
import * as C from '../core/catalog.js';
import { store } from '../core/store.js';
import { LEVELS, GOALS } from '../core/recommend.js';
import { LANGUAGE_LABELS } from '../core/schema.js';

export function openOnboarding({ onDone = () => {} } = {}) {
  const cur = store.state.profile || { level: 'beginner', interests: [], goals: [], languages: [] };
  const name = nextId('ob');
  const dialog = h('dialog.onboard', { 'aria-labelledby': `${name}-t` });

  const choice = (type, group, value, label, help, checked) => h('label.choice',
    h('input', { type, name: `${name}-${group}`, value, checked }),
    h('span.choice-body', h('span.choice-label', label), help ? h('span.choice-help', help) : null));

  const form = h('form', { method: 'dialog', onsubmit: (e) => {
    e.preventDefault();
    const val = (g) => [...form.querySelectorAll(`input[name="${name}-${g}"]:checked`)].map((i) => i.value);
    const languages = val('lang');
    store.setProfile({ level: val('level')[0] || 'beginner', interests: val('interest'), goals: val('goal'), languages });
    if (languages.length) store.setLanguage(languages[0]);
    dialog.close();
    onDone(true);
  } },
    h('div.onboard-head',
      h('div', h('p.eyebrow', 'Make the atlas yours'), h('h2', { id: `${name}-t` }, 'What are you curious about?')),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Close', html: icon('x'), onclick: () => { dialog.close(); onDone(false); } })),
    h('p.muted', 'Four quick questions. Skip any of them. You can explore everything either way.'),
    h('fieldset.onboard-set', h('legend', '1. How much experience do you have?'),
      h('div.choices', LEVELS.map((l) => choice('radio', 'level', l.id, l.label, l.help, cur.level === l.id)))),
    h('fieldset.onboard-set', h('legend', '2. Which fields interest you?'),
      h('div.choices.is-compact', C.disciplines.map((d) => choice('checkbox', 'interest', d.id, d.short, null, cur.interests.includes(d.id))))),
    h('fieldset.onboard-set', h('legend', '3. What are you hoping to do?'),
      h('div.choices', GOALS.map((g) => choice('checkbox', 'goal', g.id, g.label, null, cur.goals.includes(g.id))))),
    h('fieldset.onboard-set', h('legend', '4. Which programming languages do you prefer to read?'),
      h('div.choices.is-compact', Object.entries(LANGUAGE_LABELS).map(([id, label]) => choice('checkbox', 'lang', id, label, null, cur.languages.includes(id)))),
      h('p.small.faint', 'Lessons show code in Python, JavaScript and C++. Your first choice opens by default.')),
    h('p.onboard-note', store.persistent ? 'Your answers stay in this browser. There is no account and nothing is uploaded.' : 'This browser is blocking storage, so your answers will last only until you close the tab.'),
    h('div.onboard-actions',
      h('button.btn.btn-primary', { type: 'submit' }, 'Show my recommendations'),
      h('button.btn.btn-ghost', { type: 'button', onclick: () => { store.update((s) => { s.welcomeDismissed = true; }); dialog.close(); onDone(false); } }, 'Not now')));

  dialog.append(form);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) { dialog.close(); onDone(false); } });
  document.body.append(dialog);
  dialog.showModal();
}
