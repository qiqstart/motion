#!/usr/bin/env bash
# Create the standard labels in the current repo (or pass -R owner/repo via REPO).
set -e
for a in "bug d73a4a Something is broken" "feature a2eeef New feature or improvement" "in-progress fbca04 Claimed by an agent"; do
  set -- $a; n=$1; c=$2; shift 2
  gh label create "$n" --color "$c" --description "$*" --force ${REPO:+-R "$REPO"}
done
