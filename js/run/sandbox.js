// Safe in-browser execution for the code playground.
//
// JavaScript runs in a dedicated Web Worker created from a Blob: no DOM, no access to the
// page, and it is terminated if it exceeds the time limit. Python runs the same way using
// Pyodide (CPython compiled to WebAssembly), fetched from the CDN only when first requested.
// C++ cannot run in the browser; its samples are verified offline by tools/build.py.

const MAX_OUTPUT = 20000;

const JS_PRELUDE = `
const __out = [];
let __size = 0;
const __fmt = (v) => {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return String(v);
  try { return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v); } catch (e) { return String(v); }
};
const __log = (...a) => {
  const line = a.map(__fmt).join(' ');
  __size += line.length + 1;
  if (__size <= ${MAX_OUTPUT}) __out.push(line);
};
self.console = { log: __log, info: __log, warn: __log, error: __log, debug: __log };
self.fetch = undefined; self.XMLHttpRequest = undefined; self.importScripts = undefined; self.WebSocket = undefined;
`;

export function runJavaScript(source, { timeout = 4000 } = {}) {
  return new Promise((resolve) => {
    const body = `${JS_PRELUDE}
const __t0 = performance.now();
try {
  (function () { "use strict";
${source}
  })();
  self.postMessage({ ok: true, out: __out.join('\\n'), ms: performance.now() - __t0, clipped: __size > ${MAX_OUTPUT} });
} catch (e) {
  self.postMessage({ ok: false, out: __out.join('\\n'), error: String(e && e.message ? e.name + ': ' + e.message : e), ms: performance.now() - __t0 });
}`;
    let url, worker, timer;
    const finish = (r) => { clearTimeout(timer); if (worker) worker.terminate(); if (url) URL.revokeObjectURL(url); resolve(r); };
    try {
      url = URL.createObjectURL(new Blob([body], { type: 'text/javascript' }));
      worker = new Worker(url);
    } catch (e) {
      return finish({ ok: false, out: '', error: 'This browser blocked the sandboxed worker, so the code was not run.' });
    }
    timer = setTimeout(() => finish({ ok: false, out: '', error: `Stopped after ${timeout / 1000} seconds (time limit).`, timedOut: true }), timeout);
    worker.onmessage = (ev) => finish(ev.data);
    worker.onerror = (ev) => { ev.preventDefault(); finish({ ok: false, out: '', error: ev.message || 'The code could not be parsed.' }); };
  });
}

/* ---- Python via Pyodide, loaded on demand in its own worker ---- */

const PYODIDE_VERSION = '0.26.4';
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const PY_WORKER = `
let ready = null;
function boot() {
  if (!ready) {
    importScripts('${PYODIDE_BASE}pyodide.js');
    ready = loadPyodide({ indexURL: '${PYODIDE_BASE}' });
  }
  return ready;
}
self.onmessage = async (ev) => {
  const { id, source } = ev.data;
  let out = [], size = 0;
  const push = (s) => { size += s.length + 1; if (size <= ${MAX_OUTPUT}) out.push(s); };
  try {
    const py = await boot();
    self.postMessage({ id, phase: 'running' });
    py.setStdout({ batched: push });
    py.setStderr({ batched: push });
    const t0 = performance.now();
    await py.runPythonAsync(source);
    self.postMessage({ id, done: true, ok: true, out: out.join('\\n'), ms: performance.now() - t0, clipped: size > ${MAX_OUTPUT} });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e).trim().split('\\n').slice(-3).join('\\n');
    self.postMessage({ id, done: true, ok: false, out: out.join('\\n'), error: msg });
  }
};`;

let pyWorker = null, pyUrl = null, pyLoaded = false, pySeq = 0;

function resetPython() {
  if (pyWorker) pyWorker.terminate();
  if (pyUrl) URL.revokeObjectURL(pyUrl);
  pyWorker = null; pyUrl = null; pyLoaded = false;
}

export const pythonIsLoaded = () => pyLoaded;

// onPhase('loading' | 'running') lets the UI show an honest loading state.
export function runPython(source, { timeout = 8000, loadTimeout = 60000, onPhase = () => {} } = {}) {
  return new Promise((resolve) => {
    try {
      if (!pyWorker) {
        pyUrl = URL.createObjectURL(new Blob([PY_WORKER], { type: 'text/javascript' }));
        pyWorker = new Worker(pyUrl);
      }
    } catch (e) {
      return resolve({ ok: false, out: '', error: 'This browser blocked the sandboxed worker, so the code was not run.' });
    }
    const id = ++pySeq;
    const worker = pyWorker;
    let timer = null;
    const finish = (r) => { clearTimeout(timer); worker.removeEventListener('message', onMsg); worker.removeEventListener('error', onErr); resolve(r); };
    const arm = (ms, message) => {
      clearTimeout(timer);
      timer = setTimeout(() => { resetPython(); finish({ ok: false, out: '', error: message, timedOut: true }); }, ms);
    };
    function onMsg(ev) {
      const m = ev.data;
      if (m.id !== id) return;
      if (m.phase === 'running') { pyLoaded = true; onPhase('running'); arm(timeout, `Stopped after ${timeout / 1000} seconds (time limit).`); return; }
      if (m.done) finish(m);
    }
    function onErr(ev) { ev.preventDefault(); resetPython(); finish({ ok: false, out: '', error: 'The Python runtime could not be loaded. Check your connection and try again.' }); }
    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', onErr);
    onPhase(pyLoaded ? 'running' : 'loading');
    arm(pyLoaded ? timeout : loadTimeout, 'The Python runtime took too long to load. Check your connection and try again.');
    worker.postMessage({ id, source });
  });
}

// Output comparison used by the playground and the validator: ignore trailing whitespace only.
export const normalizeOutput = (s) => String(s ?? '').replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
