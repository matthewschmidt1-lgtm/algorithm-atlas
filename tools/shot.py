#!/usr/bin/env python3
"""Screenshot one frame of a lesson's visualization, for visual review while authoring.

    python3 tools/shot.py quick-sort                 middle frame
    python3 tools/shot.py dijkstra --step end        last frame
    python3 tools/shot.py a-star --step 12 --out /tmp/a.png --theme light
    python3 tools/shot.py --url '#/library' --out /tmp/lib.png --width 390 --height 844

Prints the path of the PNG it wrote.
"""

import argparse
import functools
import http.server
import shutil
import subprocess
import sys
import tempfile
import threading
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import find_chrome  # noqa: E402


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("id", nargs="?")
    ap.add_argument("--step", default="mid")
    ap.add_argument("--theme", default="dark")
    ap.add_argument("--input", default="", help="JSON object of input overrides")
    ap.add_argument("--url", default="", help="screenshot a site route instead, e.g. '#/library'")
    ap.add_argument("--out", default="")
    ap.add_argument("--width", type=int, default=1180)
    ap.add_argument("--height", type=int, default=980)
    ap.add_argument("--wait", type=int, default=4000, help="virtual time budget in ms")
    args = ap.parse_args()

    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d/" % httpd.server_address[1]
    if args.url:
        url = base + "index.html" + args.url
        name = "page"
    else:
        if not args.id:
            sys.exit("Give an algorithm id or --url.")
        qs = {"id": args.id, "step": args.step, "theme": args.theme}
        if args.input:
            qs["input"] = args.input
        url = base + "tools/embed.html?" + urllib.parse.urlencode(qs)
        name = "%s-%s" % (args.id, args.step)
    out = Path(args.out) if args.out else Path(tempfile.gettempdir()) / ("atlas-shot-%s.png" % name)
    profile = tempfile.mkdtemp(prefix="atlas-shot-")
    subprocess.run(
        [find_chrome(), "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
         "--user-data-dir=" + profile, "--window-size=%d,%d" % (args.width, args.height),
         "--virtual-time-budget=%d" % args.wait, "--screenshot=" + str(out), url],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
    httpd.shutdown()
    shutil.rmtree(profile, ignore_errors=True)
    print(out)


if __name__ == "__main__":
    main()
