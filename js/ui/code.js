// The code panel: one implementation per language, with line notes, a copy button, and a
// playground that really runs the code (JavaScript in a sandboxed worker, Python through
// Pyodide loaded on demand). C++ cannot run in a browser; the panel says so plainly, and
// says that the sample was compiled and checked when the site was built.

import { h, clear, rich, renderMath } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { store } from '../core/store.js';
import { LANGUAGES, LANGUAGE_LABELS } from '../core/schema.js';
import { highlightLines } from './highlight.js';
import { runJavaScript, runPython, pythonIsLoaded, normalizeOutput } from '../run/sandbox.js';

export function createCodePanel(lesson, { compact = false } = {}) {
  const code = lesson.code;
  const langs = LANGUAGES.filter((l) => code[l] && code[l].source);
  let lang = langs.includes(store.state.language) ? store.state.language : langs[0];
  let editing = false;
  const edited = {};

  const pre = h('pre.code-pre', { tabindex: '0' });
  const editor = h('textarea.code-editor', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', hidden: true, 'aria-label': 'Editable source code' });
  const notes = h('ol.code-notes');
  const output = h('div.code-output', { hidden: true, 'aria-live': 'polite' });
  const status = h('p.code-status');
  const tabs = h('div.tabs', { role: 'tablist', 'aria-label': 'Programming language' });
  const copyBtn = h('button.btn.btn-sm.btn-ghost', { type: 'button', html: `${icon('copy', { size: 15 })}<span>Copy</span>` });
  const runBtn = h('button.btn.btn-sm.btn-primary', { type: 'button' });
  const editBtn = h('button.btn.btn-sm', { type: 'button' });
  const resetBtn = h('button.btn.btn-sm.btn-ghost', { type: 'button', hidden: true }, 'Restore original');

  const current = () => (edited[lang] !== undefined ? edited[lang] : code[lang].source);
  const expected = () => normalizeOutput(code[lang].expected ?? code.sample.expected);

  function renderSource() {
    pre.innerHTML = `<code>${highlightLines(current(), lang)}</code>`;
    pre.hidden = editing; editor.hidden = !editing;
    if (editing) { editor.value = current(); editor.rows = Math.min(40, current().split('\n').length + 1); }
    clear(notes);
    const list = (code[lang].notes || []);
    notes.hidden = !list.length || edited[lang] !== undefined;
    for (const n of list) {
      const li = h('li', { tabindex: '0' }, h('span.code-note-line', `Line ${n.line}`), h('span', { html: rich(n.text) }));
      const mark = (on) => { const el = pre.querySelector(`[data-line="${n.line}"]`); if (el) el.classList.toggle('is-marked', on); };
      li.addEventListener('mouseenter', () => mark(true)); li.addEventListener('mouseleave', () => mark(false));
      li.addEventListener('focus', () => mark(true)); li.addEventListener('blur', () => mark(false));
      notes.append(li);
    }
    renderMath(notes);
  }

  function renderControls() {
    const runnable = lang !== 'cpp';
    runBtn.hidden = !runnable; editBtn.hidden = !runnable;
    runBtn.innerHTML = `${icon('play', { size: 14 })}<span>Run ${LANGUAGE_LABELS[lang]}</span>`;
    editBtn.textContent = editing ? 'Done editing' : 'Edit the code';
    resetBtn.hidden = edited[lang] === undefined;
    if (!runnable) {
      status.textContent = 'C++ cannot run inside a web page. This program was compiled with clang++ (C++17) and its output was checked against the expected output when the site was built.';
    } else if (lang === 'python') {
      status.textContent = pythonIsLoaded() ? 'Runs in your browser with Pyodide, a build of Python for the web. Time limit: 8 seconds.' : 'Runs in your browser. The first run downloads the Python runtime (Pyodide, several megabytes) from a public CDN. Time limit: 8 seconds.';
    } else {
      status.textContent = 'Runs in your browser inside an isolated worker with no access to this page or the network. Time limit: 4 seconds.';
    }
  }

  function setLang(l) {
    lang = l; store.setLanguage(l); editing = false;
    [...tabs.children].forEach((b) => b.setAttribute('aria-selected', b.dataset.lang === l ? 'true' : 'false'));
    output.hidden = true; clear(output);
    renderSource(); renderControls();
  }

  async function run() {
    if (editing) edited[lang] = editor.value;
    const src = current();
    runBtn.disabled = true;
    output.hidden = false;
    clear(output).append(h('p.code-run-state', lang === 'python' && !pythonIsLoaded() ? 'Downloading the Python runtime. This happens once.' : 'Running.'));
    const res = lang === 'python'
      ? await runPython(src, { onPhase: (p) => { const el = output.querySelector('.code-run-state'); if (el) el.textContent = p === 'loading' ? 'Downloading the Python runtime. This happens once.' : 'Running.'; } })
      : await runJavaScript(src);
    runBtn.disabled = false;
    clear(output);
    const out = normalizeOutput(res.out);
    const unchanged = edited[lang] === undefined || edited[lang] === code[lang].source;
    if (res.ok) {
      const matches = out === expected();
      output.append(
        h('p.code-run-state.is-ok', { html: `${icon('check', { size: 15 })} Ran in your browser${typeof res.ms === 'number' ? ` in ${res.ms < 1 ? 'under 1' : Math.round(res.ms)} ms` : ''}.${unchanged ? (matches ? ' The output matches the expected output.' : ' The output differs from the expected output shown below.') : ' This is your edited version.'}` }),
        h('pre.code-out', out || '(no output)'));
      if (unchanged && !matches) output.append(h('p.small.muted', 'Expected:'), h('pre.code-out', expected()));
      if (res.clipped) output.append(h('p.small.muted', 'Output was cut off at 20,000 characters.'));
    } else {
      output.append(h('p.code-run-state.is-bad', { html: `${icon('x', { size: 15 })} ${res.timedOut ? 'Stopped.' : 'The program did not finish.'}` }), h('pre.code-out.is-error', res.error || 'Unknown error'));
      if (out) output.append(h('p.small.muted', 'Output before it stopped:'), h('pre.code-out', out));
    }
    renderControls();
  }

  for (const l of langs) tabs.append(h('button', { type: 'button', role: 'tab', dataset: { lang: l }, 'aria-selected': 'false', onclick: () => setLang(l) }, LANGUAGE_LABELS[l]));
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(editing ? editor.value : current()); copyBtn.lastChild.textContent = 'Copied'; }
    catch { copyBtn.lastChild.textContent = 'Copy failed'; }
    setTimeout(() => { copyBtn.lastChild.textContent = 'Copy'; }, 1600);
  });
  runBtn.addEventListener('click', run);
  editBtn.addEventListener('click', () => { if (editing) edited[lang] = editor.value; editing = !editing; renderSource(); renderControls(); if (editing) editor.focus(); });
  resetBtn.addEventListener('click', () => { delete edited[lang]; editing = false; output.hidden = true; renderSource(); renderControls(); });
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.altKey) { e.preventDefault(); const s = editor.selectionStart; editor.setRangeText('    ', s, editor.selectionEnd, 'end'); }
    if (e.key === 'Escape') { editBtn.focus(); }
  });

  const el = h(`div.code-panel${compact ? '.is-compact' : ''}`,
    h('div.code-head', tabs, h('div.code-tools', copyBtn)),
    h('div.code-body', pre, editor),
    compact ? null : h('div.code-sample',
      h('div', h('p.panel-cap', 'What this program does'), h('p', code.sample.input)),
      h('div', h('p.panel-cap', 'Expected output'), h('pre.code-out', code.sample.expected))),
    h('div.code-run', h('div.code-run-buttons', runBtn, editBtn, resetBtn), status),
    output,
    compact ? null : h('div.code-notes-wrap', h('p.panel-cap', 'Lines worth a second look'), notes));
  setLang(lang);
  return { el, setLang };
}
