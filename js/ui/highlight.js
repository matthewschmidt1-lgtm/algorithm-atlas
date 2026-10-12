// A small syntax highlighter for the three languages the atlas publishes. It only needs to
// tell comments, strings, numbers, keywords and function names apart, so a tokenizer of a
// few dozen lines does the job and no library has to be downloaded.

import { esc } from '../core/dom.js';

const KW = {
  python: 'and as assert break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield',
  javascript: 'async await break case catch class const continue default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield',
  cpp: 'auto bool break case catch char class const constexpr continue default delete do double else enum false float for if include inline int long namespace new nullptr operator private public return short signed sizeof static struct switch template this throw true try typedef typename unsigned using virtual void while std size_t',
};
const sets = Object.fromEntries(Object.entries(KW).map(([k, v]) => [k, new Set(v.split(' '))]));

export function highlight(source, lang) {
  const kw = sets[lang] || sets.javascript;
  const lineComment = lang === 'python' ? '#' : '//';
  let out = '', i = 0;
  const n = source.length;
  const span = (cls, text) => `<span class="tk-${cls}">${esc(text)}</span>`;
  while (i < n) {
    const ch = source[i];
    if (source.startsWith(lineComment, i) || (lang === 'cpp' && ch === '#' && /^#\s*\w+/.test(source.slice(i, i + 12)) && (i === 0 || source[i - 1] === '\n'))) {
      const isPre = ch === '#' && lang === 'cpp';
      let j = source.indexOf('\n', i); if (j < 0) j = n;
      out += span(isPre ? 'kw' : 'com', source.slice(i, j)); i = j; continue;
    }
    if (lang !== 'python' && source.startsWith('/*', i)) { let j = source.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; out += span('com', source.slice(i, j)); i = j; continue; }
    if (lang === 'python' && (source.startsWith('"""', i) || source.startsWith("'''", i))) { const q = source.slice(i, i + 3); let j = source.indexOf(q, i + 3); j = j < 0 ? n : j + 3; out += span('str', source.slice(i, j)); i = j; continue; }
    if (ch === '"' || ch === "'" || (ch === '`' && lang === 'javascript')) {
      let j = i + 1;
      while (j < n && source[j] !== ch) { if (source[j] === '\\') j++; if (source[j] === '\n' && ch !== '`') break; j++; }
      j = Math.min(n, j + 1);
      out += span('str', source.slice(i, j)); i = j; continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[i + 1] || ''))) {
      const m = source.slice(i).match(/^(0[xX][0-9a-fA-F]+|[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?[a-zA-Z]*)/);
      out += span('num', m[0]); i += m[0].length; continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const m = source.slice(i).match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
      const word = m[0];
      const after = source.slice(i + word.length).match(/^\s*\(/);
      out += kw.has(word) ? span('kw', word) : after ? span('fn', word) : esc(word);
      i += word.length; continue;
    }
    out += esc(ch); i++;
  }
  return out;
}

// Source rendered as numbered lines so that notes can point at a line.
export function highlightLines(source, lang) {
  return highlight(source, lang).split('\n').map((line, i) => `<span class="code-line" data-line="${i + 1}"><span class="code-no" aria-hidden="true">${i + 1}</span><span class="code-text">${line || ' '}</span></span>`).join('');
}
