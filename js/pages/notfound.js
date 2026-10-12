import { h } from '../core/dom.js';

export default async function render() {
  return {
    title: 'Page not found',
    el: h('div.page.wrap.narrow',
      h('header.page-head',
        h('p.eyebrow', 'Off the map'),
        h('h1', 'There is no page at this address.'),
        h('p.lede', 'The link may be out of date, or the lesson it points to may not be written yet.')),
      h('p', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } },
        h('a.btn.btn-primary', { href: '#/' }, 'Back to the atlas'),
        h('a.btn', { href: '#/library' }, 'Browse the library'))),
  };
}
