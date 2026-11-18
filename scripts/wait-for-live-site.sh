#!/usr/bin/env bash
# Waits until the live site serves the page of the new build.
#
#   wait-for-live-site.sh <site address> <path of the built index.html>
#
# The publish workflow runs this after its push to the gh-pages branch.
# If the page does not change in two minutes, the script asks GitHub Pages
# for a build, because a push from a workflow does not always start one.
# Exit status 0: the live site serves the build. 1: it did not in the time limit.
#
# Environment: GITHUB_REPOSITORY and GH_TOKEN (for the build request).
# WAIT_SECONDS (default 10) and WAIT_ATTEMPTS (default 60) set the time limit.
set -uo pipefail

site="${1%/}/"
built_page="$2"
wait_seconds="${WAIT_SECONDS:-10}"
attempts="${WAIT_ATTEMPTS:-60}"
# The attempt at which the script asks for a build: after one fifth of the time limit.
request_at=$(( attempts / 5 ))
if [ "$request_at" -lt 1 ]; then request_at=1; fi

is_live() {
  # The query makes each request new for the cache in front of the site.
  curl --fail --silent --show-error --location --max-time 20 "${site}?attempt=$1-$RANDOM" 2>/dev/null \
    | cmp --silent - "$built_page"
}

for attempt in $(seq 1 "$attempts"); do
  if is_live "$attempt"; then
    echo "The live site serves the build: $site"
    exit 0
  fi
  if [ "$attempt" -eq "$request_at" ]; then
    echo "The live site did not change yet. Asking GitHub Pages for a build."
    gh api --method POST "repos/$GITHUB_REPOSITORY/pages/builds" --silent \
      || echo "::warning::The request for a GitHub Pages build failed."
  fi
  sleep "$wait_seconds"
done

echo "::error::The build is in the gh-pages branch, but $site does not serve it. In the repository settings, open Pages and make sure that the source is the gh-pages branch. Then run this workflow again."
exit 1
