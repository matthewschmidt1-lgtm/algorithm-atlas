#!/usr/bin/env python3
"""Algorithm Atlas site tests.

    python3 tools/test.py                  run every suite
    python3 tools/test.py --suite search   run one suite (search, defects, index, links, learning, player, followups, tracks, practice, kitchen, beginners, journey)
    python3 tools/test.py --bench          also print the search benchmark, query by query
    python3 tools/test.py --json out.json  also save the full report

The lessons themselves are checked by tools/build.py. This checks the site around them:
search, links, navigation and the behaviour of the interface. The tests run in headless
Chrome against the real pages, so they need only Python and Chrome.
"""

import argparse
import json
import sys
import time

from build import run_page


def pct(a, b):
    return "%3.0f%%" % (100.0 * a / b) if b else "  n/a"


def print_bench(bench, rows, hide_heldout=False):
    print("\nSearch benchmark (top three results per query)")
    print("  %-52s %8s %9s %9s %10s %7s" % ("set", "queries", "answered", "first ok", "precision", "wrong"))
    def line(name, s):
        print("  %-52s %8d %4d/%-4d %4d/%-4d %10s %7d" % (
            name[:52], s["queries"], s["answered"], s["answerable"], s["firstRight"], s["answerable"],
            pct(s["right"], s["shown"]), s["misleading"]))
    for key, s in bench["bySet"].items():
        line(bench["sets"][key], s)
    line("ALL EXCEPT HELD OUT", bench["tuned"])
    line("HELD OUT", bench["heldout"])
    if bench.get("tracks"):
        line("NEW TRACK LESSONS (untuned)", bench["tracks"])
    line("EVERYTHING", bench["all"])
    if rows:
        print()
        for r in bench["rows"]:
            if hide_heldout and r["set"] == "heldout":
                continue
            mark = {"pass": "ok   ", "weak": "weak ", "empty": "EMPTY", "wrong": "WRONG"}[r["verdict"]]
            extra = ("   broader: " + ", ".join(r["broader"])) if r["broader"] else ""
            print("  %s [%-8s] %-46s -> %s%s" % (mark, r["set"], r["q"][:46], ", ".join(r["top"]) or "(nothing)", extra))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--suite", default="all")
    ap.add_argument("--bench", action="store_true", help="print the search benchmark query by query")
    ap.add_argument("--json", help="save the full report to this file")
    ap.add_argument("--no-heldout-rows", action="store_true", help="when tuning, do not print the held-out queries one by one")
    args = ap.parse_args()

    t0 = time.time()
    report = run_page("tools/tests.html?suite=" + args.suite, timeout=600)
    failed = 0
    suite = None
    for r in report["results"]:
        if r["suite"] != suite:
            suite = r["suite"]
            print("\n" + suite)
        failed += not r["ok"]
        print("  %s  %s" % ("ok  " if r["ok"] else "FAIL", r["name"]))
        if r.get("detail") and (not r["ok"] or args.bench):
            print("        " + str(r["detail"]).replace("\n", "\n        "))
    if report.get("bench"):
        print_bench(report["bench"], args.bench, args.no_heldout_rows)
    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=1)
    print("\n%d tests, %d failed, %.1fs" % (len(report["results"]), failed, time.time() - t0))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
