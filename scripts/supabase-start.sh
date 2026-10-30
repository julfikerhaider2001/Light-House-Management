#!/usr/bin/env bash
# Starts local Supabase, retrying transient failures (registry rate limits on image pulls,
# half-started stacks holding ports). Usage: scripts/supabase-start.sh <exclude-list>
set -euo pipefail

exclude="${1:-}"
for attempt in 1 2 3; do
  if npx supabase start -x "$exclude"; then
    exit 0
  fi
  echo "::warning::supabase start failed (attempt $attempt); cleaning up and retrying"
  npx supabase stop --no-backup || true
  sleep $((attempt * 20))
done
echo "::error::supabase start failed after 3 attempts"
exit 1
