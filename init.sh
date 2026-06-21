#!/usr/bin/env bash
set -euo pipefail

echo "=== video-lens harness init ==="

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required but was not found on PATH." >&2
  exit 1
fi

echo "=== Installing dependencies when needed ==="
if [ ! -d node_modules ]; then
  pnpm install --frozen-lockfile
else
  echo "node_modules exists; skipping install."
fi

echo "=== Running tests ==="
pnpm test

echo "=== Running build ==="
pnpm build

echo "=== Harness verification complete ==="
