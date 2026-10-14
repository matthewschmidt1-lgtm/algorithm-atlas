#!/usr/bin/env python3
"""Run one lesson's demonstration and print what it did.

    python3 tools/run.py binary-search                              the default input
    python3 tools/run.py binary-search '{"size": 15, "where": "missing"}'
    python3 tools/run.py binary-search '{"size": 15}' '{"size": 31}'   several inputs at once
    python3 tools/run.py binary-search --result                     also print the full result object

It prints the lesson's inputs and presets first, then for each input the report the page
would show, the operation counts and the note on the last step. Use it to find out what the
page's own implementation does before writing a quiz answer or a prompt about it.
"""

import json
import sys
import urllib.parse

from build import run_page


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    lesson, raw = args[0], args[1:] or ["{}"]
    try:
        inputs = [json.loads(x) for x in raw]
    except ValueError as e:
        sys.exit("An input is not valid JSON: %s" % e)
    out = run_page("tools/run.html?id=%s&inputs=%s" % (lesson, urllib.parse.quote(json.dumps(inputs))), 60)
    head = out[0]
    if "error" in head:
        sys.exit(head["error"])
    print("inputs:")
    for f in head["inputs"]:
        lo, hi = f.get("min"), f.get("max")
        span = "  %s to %s" % (lo, hi) if lo is not None and hi is not None else "  at least %s" % lo if lo is not None else "  at most %s" % hi if hi is not None else ""
        extra = span + ("  one of %s" % f["options"] if f.get("options") else "")
        print("  %-14s %-8s default %s%s" % (f["id"], f["type"], json.dumps(f["default"]), extra))
    print("presets:")
    for p in head["presets"]:
        print("  %s  %s" % (p["label"], json.dumps(p["values"])))
    for r in out[1:]:
        print("\ninput %s" % json.dumps(r["input"]))
        if "error" in r:
            print("  the run failed: %s" % r["error"])
            continue
        print("  report:    " + r["report"].replace("\n", "\n             "))
        print("  counts:    " + json.dumps(r["counters"]))
        print("  steps:     %d" % r["steps"])
        print("  last note: " + r["lastNote"])
        if "--result" in sys.argv:
            print("  result:    " + json.dumps(r["result"]))


if __name__ == "__main__":
    main()
