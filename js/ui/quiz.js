// Knowledge check. Every option has its own explanation, shown when chosen. Answers are
// recorded through the store, which keeps them in this browser when storage is available.

import { h, clear, rich, renderMath, nextId } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { store } from '../core/store.js';
import { highlight } from './highlight.js';

const TYPE_LABEL = { choice: 'Question', predict: 'Predict, then check', debug: 'Find the bug', challenge: 'Practical challenge' };

export function createQuiz(lesson, { onTry = null } = {}) {
  const id = lesson.meta.id;
  const answerable = lesson.quiz.filter((q) => q.type !== 'challenge').length;
  const summary = h('p.quiz-summary', { 'aria-live': 'polite' });
  const paintSummary = () => {
    const m = store.mastery(id, answerable);
    summary.innerHTML = '';
    summary.append(
      m.mastered ? h('span.quiz-done', { html: `${icon('check', { size: 15 })} All ${answerable} answered correctly.` }) : `${m.correct} of ${answerable} answered correctly.`,
      ' ', h('span.faint', store.persistent ? 'Kept in this browser.' : 'Not saved: this browser is blocking storage.'));
  };

  const items = lesson.quiz.map((q, index) => {
    if (q.type === 'challenge') {
      return h('article.quiz-item.is-challenge',
        h('p.quiz-type', TYPE_LABEL.challenge),
        h('h3', q.title),
        h('div.prose', { html: `<p>${rich(q.prompt)}</p>` }),
        (q.hints || []).length ? h('details.fold', h('summary', q.hints.length === 1 ? 'Show a hint' : `Show ${q.hints.length} hints`), h('div.fold-body', h('ul.prose-list', q.hints.map((t) => h('li', { html: rich(t) }))))) : null);
    }
    const name = nextId('q');
    const feedback = h('div.quiz-feedback', { 'aria-live': 'polite', hidden: true });
    const saved = store.answers(id)[index];
    const options = h('div.quiz-options', { role: 'radiogroup', 'aria-labelledby': `${name}-q` });
    const choose = (i, record = true) => {
      const right = i === q.answer;
      [...options.children].forEach((el, k) => {
        el.classList.toggle('is-chosen', k === i);
        el.classList.toggle('is-right', k === i && right);
        el.classList.toggle('is-wrong', k === i && !right);
        el.setAttribute('aria-checked', k === i ? 'true' : 'false');
      });
      feedback.hidden = false;
      feedback.className = `quiz-feedback ${right ? 'is-right' : 'is-wrong'}`;
      feedback.innerHTML = `<p><strong>${right ? 'Correct.' : 'Not quite.'}</strong> ${rich(q.explain[i])}</p>`;
      if (!right) feedback.append(h('p.small.muted', 'Try another answer.'));
      renderMath(feedback);
      if (record) { store.recordAnswer(id, index, right); paintSummary(); }
    };
    q.options.forEach((text, i) => {
      const b = h('button.quiz-option', { type: 'button', role: 'radio', 'aria-checked': 'false', onclick: () => choose(i) },
        h('span.quiz-letter', String.fromCharCode(65 + i)), h('span', { html: rich(text) }));
      options.append(b);
    });
    options.addEventListener('keydown', (e) => {
      const list = [...options.children], at = list.indexOf(document.activeElement);
      if (at < 0) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); list[(at + 1) % list.length].focus(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); list[(at - 1 + list.length) % list.length].focus(); }
    });
    const item = h('article.quiz-item',
      h('p.quiz-type', TYPE_LABEL[q.type] || 'Question'),
      h('h3', { id: `${name}-q`, html: rich(q.q) }),
      q.code ? h('pre.code-pre.quiz-code', { html: `<code>${highlight(q.code, /def |print\(|elif |:\s*$/m.test(q.code) ? 'python' : 'javascript')}</code>` }) : null,
      options, feedback,
      q.tryInput && onTry ? h('p.quiz-try', h('button.btn.btn-sm', { type: 'button', onclick: () => onTry(q.tryInput), html: `${icon('play', { size: 13 })}<span>Run this case in the visualization</span>` }), h('span.small.faint', ' Make your prediction first.')) : null);
    renderMath(item);
    if (saved && saved.correct) choose(q.answer, false);
    return item;
  });

  paintSummary();
  return h('div.quiz', items, summary);
}
