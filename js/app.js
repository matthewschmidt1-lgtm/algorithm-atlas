// Entry point: apply saved settings, load content, mount the frame, start the router.

import { store, applySettings } from './core/store.js';
import { loadContent } from './core/catalog.js';
import { route, start } from './core/router.js';
import { mountShell, setCurrentRoute } from './ui/shell.js';

applySettings();
await loadContent();

export const shell = mountShell(document.getElementById('shell-head'), document.getElementById('shell-foot'));

route('/', () => import('./pages/home.js'));
route('/explore', () => import('./pages/explore.js'));
route('/disciplines', () => import('./pages/disciplines.js'));
route('/discipline/:id', () => import('./pages/discipline.js'));
route('/track/:id', () => import('./pages/track.js'));
route('/library', () => import('./pages/library.js'));
route('/problems', () => import('./pages/problems.js'));
route('/algorithm/:id', () => import('./pages/lesson.js'));
route('/concept/:id', () => import('./pages/concept.js'));
route('/lab', () => import('./pages/lab.js'));
route('/lab/:id', () => import('./pages/lab.js'));
route('/compare', () => import('./pages/compare.js'));
route('/compare/:group', () => import('./pages/compare.js'));
route('/paths', () => import('./pages/paths.js'));
route('/path/:id', () => import('./pages/path.js'));
route('/connections', () => import('./pages/connections.js'));
route('/search', () => import('./pages/search.js'));
route('/profile', () => import('./pages/profile.js'));
route('/about', () => import('./pages/about.js'));
route('/verification', () => import('./pages/verification.js'));
route('/404', () => import('./pages/notfound.js'));

start(document.getElementById('main'), { onRoute: setCurrentRoute });

// Expose a little for debugging from the console.
window.atlas = { store };
