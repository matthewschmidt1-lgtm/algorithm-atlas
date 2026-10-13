#!/bin/sh
# Serve only the public website in production. The content pipeline, authoring
# guide and other tooling stay in the repository and out of the published site.
set -e
rm -rf dist && mkdir -p dist
cp -R index.html robots.txt serve.json assets css js content dist/
exec npx serve dist -l "${PORT:-3000}" --no-clipboard
