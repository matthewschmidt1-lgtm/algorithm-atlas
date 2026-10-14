#!/usr/bin/env python3
"""Algorithm Atlas content pipeline.

    python3 tools/build.py                 validate everything, then write content/catalog.generated.js
    python3 tools/build.py --check         validate everything, write nothing
    python3 tools/build.py --only a,b      validate only these ids (implies --check)

For every content/algorithms/<id>.js this:
  * validates the record against the schema and runs its viz tests (headless Chrome, tools/validate.js)
  * runs the JavaScript sample in the browser sandbox and compares its output
  * runs the Python sample with python3 and compares its output
  * compiles the C++ sample with clang++ -std=c++17, runs it and compares its output
Only records with zero errors are written to the catalog.

Needs only the Python standard library, Google Chrome and a C++ compiler. No Node.
"""

import argparse
import concurrent.futures
import functools
import http.server
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    shutil.which("google-chrome") or "",
    shutil.which("chromium") or "",
    shutil.which("chromium-browser") or "",
]


def find_chrome():
    for c in CHROME_CANDIDATES:
        if c and os.path.exists(c):
            return c
    sys.exit("Could not find Chrome or Chromium. Set the path in tools/build.py.")


class Handler(http.server.SimpleHTTPRequestHandler):
    report = None
    done = threading.Event()

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if self.path == "/__report":
            n = int(self.headers.get("Content-Length", "0"))
            Handler.report = json.loads(self.rfile.read(n).decode("utf-8"))
            Handler.done.set()
            self.send_response(204)
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()


class QuietServer(http.server.ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        # the browser is closed as soon as it has reported, often in the middle of a request
        pass


def serve():
    handler = functools.partial(Handler, directory=str(ROOT))
    httpd = QuietServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def run_page(path, timeout=240):
    """Open a page of this repo in headless Chrome and wait for it to post its report."""
    Handler.report = None
    Handler.done.clear()
    httpd = serve()
    port = httpd.server_address[1]
    profile = tempfile.mkdtemp(prefix="atlas-chrome-")
    url = "http://127.0.0.1:%d/%s" % (port, path)
    proc = subprocess.Popen(
        [find_chrome(), "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
         "--disable-extensions", "--window-size=1280,900", "--user-data-dir=" + profile, url],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ok = Handler.done.wait(timeout)
    proc.terminate()
    try:
        proc.wait(5)
    except subprocess.TimeoutExpired:
        proc.kill()
    httpd.shutdown()
    shutil.rmtree(profile, ignore_errors=True)
    if not ok:
        sys.exit("Timed out waiting for the browser (%ds): %s" % (timeout, path))
    return Handler.report


def run_browser(ids, timeout=240, full=False):
    return run_page("tools/validate.html?ids=%s%s" % (",".join(ids), "&full=1" if full else ""), timeout)


def norm(s):
    lines = [ln.rstrip() for ln in str(s or "").replace("\r", "").split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def check_python(src, expected, work):
    path = work / "sample.py"
    path.write_text(src, encoding="utf-8")
    try:
        r = subprocess.run([sys.executable, "-I", str(path)], capture_output=True, text=True, timeout=20)
    except subprocess.TimeoutExpired:
        return "code.python timed out after 20 s"
    if r.returncode != 0:
        return "code.python exited with an error:\n      " + r.stderr.strip().replace("\n", "\n      ")[-900:]
    if norm(r.stdout) != norm(expected):
        return "code.python output mismatch.\n      expected: %r\n      actual:   %r" % (norm(expected), norm(r.stdout))
    return None


def check_cpp(src, expected, work):
    cxx = shutil.which("clang++") or shutil.which("g++")
    if not cxx:
        return "no C++ compiler found (clang++ or g++), so code.cpp was not verified"
    path = work / "sample.cpp"
    exe = work / "sample"
    path.write_text(src, encoding="utf-8")
    c = subprocess.run([cxx, "-std=c++17", "-O1", "-Wall", "-o", str(exe), str(path)], capture_output=True, text=True, timeout=120)
    if c.returncode != 0:
        return "code.cpp failed to compile:\n      " + c.stderr.strip().replace("\n", "\n      ")[-1200:]
    try:
        r = subprocess.run([str(exe)], capture_output=True, text=True, timeout=20)
    except subprocess.TimeoutExpired:
        return "code.cpp timed out after 20 s"
    if r.returncode != 0:
        return "code.cpp exited with code %d" % r.returncode
    if norm(r.stdout) != norm(expected):
        return "code.cpp output mismatch.\n      expected: %r\n      actual:   %r" % (norm(expected), norm(r.stdout))
    return None


def check_native(result):
    errs = []
    code = result.get("code") or {}
    with tempfile.TemporaryDirectory(prefix="atlas-code-") as tmp:
        work = Path(tmp)
        if code.get("python"):
            e = check_python(code["python"]["source"], code["python"].get("expected"), work)
            if e:
                errs.append(e)
        if code.get("cpp"):
            e = check_cpp(code["cpp"]["source"], code["cpp"].get("expected"), work)
            if e:
                errs.append(e)
        # further programs in the same lesson are held to the same standard
        for i, x in enumerate(code.get("more") or []):
            sub = work / ("more%d" % i)
            sub.mkdir()
            if x.get("python"):
                e = check_python(x["python"]["source"], x["python"].get("expected"), sub)
                if e:
                    errs.append("code.more[%d]: %s" % (i, e))
            if x.get("cpp"):
                e = check_cpp(x["cpp"]["source"], x["cpp"].get("expected"), sub)
                if e:
                    errs.append("code.more[%d]: %s" % (i, e))
        # break-it lines: the change must really alter what the Python program does
        broken = result.setdefault("broken", [])
        for b in code.get("breakIt") or []:
            out, finished = run_broken(b["source"], work)
            broken.append({"i": b["i"], "lang": "python", "ok": finished, "out": out})
            if finished and code.get("python") and norm(out) == norm(code["python"].get("expected")):
                errs.append("code.breakIt[%d] changes nothing in Python: the program prints the same output. Choose sample inputs that expose the mistake." % b["i"])
            if out == HUNG and not b.get("hangs"):
                errs.append("code.breakIt[%d] makes the Python program run for ever. Say so with hangs: true, or choose a change that finishes." % b["i"])
    return errs


HUNG = "did not finish within the time limit"


def run_broken(src, work):
    """Run a deliberately broken program. Returns (what it printed or how it failed, whether it finished cleanly)."""
    path = work / "broken.py"
    path.write_text(src, encoding="utf-8")
    try:
        r = subprocess.run([sys.executable, "-I", str(path)], capture_output=True, text=True, timeout=4)
    except subprocess.TimeoutExpired:
        return HUNG, False
    if r.returncode != 0:
        last = (r.stderr.strip().split("\n") or [""])[-1]
        return (norm(r.stdout) + "\n" if r.stdout.strip() else "") + last, False
    return norm(r.stdout), True


def tool_version(cmd):
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        return (out.stdout or out.stderr).strip().split("\n")[0]
    except Exception:
        return "unknown"


def build_info(entries):
    """Facts about this run of the pipeline, published with the catalog so the site can state them."""
    cxx = shutil.which("clang++") or shutil.which("g++")
    relations = {}
    for e in entries:
        for c in e["checks"]["cost"]:
            relations[c["relation"]] = relations.get(c["relation"], 0) + 1
    return {
        "date": time.strftime("%Y-%m-%d"),
        "python": "Python %d.%d.%d" % sys.version_info[:3],
        "cxx": tool_version([cxx, "--version"]) if cxx else "none",
        "browser": tool_version([find_chrome(), "--version"]),
        "lessons": len(entries),
        "tests": sum(len(e["checks"]["tests"]) for e in entries),
        "runs": sum(e["checks"]["runs"] for e in entries),
        "frames": sum(e["checks"]["frames"] for e in entries),
        "programs": sum(len(e["checks"]["languages"]) + e["checks"].get("morePrograms", 0) for e in entries),
        "brokenOnPurpose": sum(e["checks"].get("brokenOnPurpose", 0) for e in entries),
        "formulas": sum(len(e["checks"]["cost"]) for e in entries),
        "relations": relations,
        "lessonsWithCostCheck": sum(1 for e in entries if e["checks"]["cost"]),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="comma-separated ids to validate (implies --check)")
    ap.add_argument("--check", action="store_true", help="validate without writing the catalog")
    ap.add_argument("--quiet", action="store_true", help="print failures and the summary only")
    ap.add_argument("--broken", action="store_true", help="also print what each break-it change makes the program do")
    args = ap.parse_args()

    all_ids = sorted(p.stem for p in (ROOT / "content" / "algorithms").glob("*.js"))
    ids = all_ids
    if args.only:
        want = [s.strip() for s in args.only.split(",") if s.strip()]
        unknown = [w for w in want if w not in all_ids]
        if unknown:
            sys.exit("No such module file(s): " + ", ".join(unknown))
        ids = want
    if not ids:
        sys.exit("No algorithm modules found.")

    t0 = time.time()
    report = run_browser(ids, full=not args.only)
    results = report["results"]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        native = list(pool.map(check_native, results))
    for r, extra in zip(results, native):
        r["errors"].extend(extra)
        if extra:
            r["entry"] = None

    failed = 0
    for r in results:
        bad = bool(r["errors"])
        failed += bad
        if bad or not args.quiet:
            info = "" if bad else "  (%s frames, views: %s)" % (r.get("frames", "?"), ", ".join(r.get("views") or []))
            print("%s  %s%s" % ("FAIL" if bad else "ok  ", r["id"], info))
        for e in r["errors"]:
            print("    error: " + e)
        if args.broken:
            for b in sorted(r.get("broken") or [], key=lambda b: (b["i"], b["lang"])):
                print("    breakIt[%d] %-10s %s\n      %s" % (b["i"], b["lang"], "prints:" if b["ok"] else "fails:", str(b["out"]).replace("\n", "\n      ")))
        if not args.quiet or bad:
            for w in r["warnings"]:
                print("    warn:  " + w)

    write = not args.check and not args.only
    if write:
        entries = [r["entry"] for r in results if r.get("entry")]
        entries.sort(key=lambda e: (e.get("order", 0), e["name"]))
        info = build_info(entries)
        body = ("// GENERATED by tools/build.py. Do not edit by hand.\n"
                "// One lightweight record per validated lesson; full lessons load on demand.\n"
                "// Each record carries `checks`: what the pipeline verified for that lesson.\n"
                "export const buildInfo = " + json.dumps(info, ensure_ascii=False, indent=1) + ";\n"
                "export const catalog = " + json.dumps(entries, ensure_ascii=False, indent=1) + ";\n")
        (ROOT / "content" / "catalog.generated.js").write_text(body, encoding="utf-8")
        print("\nWrote content/catalog.generated.js with %d entries." % len(entries))
        if report.get("missing"):
            print("Rostered as published but no module file yet: " + ", ".join(report["missing"]))

    print("\n%d checked, %d failed, %.1fs" % (len(results), failed, time.time() - t0))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
