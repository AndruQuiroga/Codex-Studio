#!/usr/bin/env bash
set -euo pipefail

# Determine repository root relative to this script
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${API_PORT:-5050}"

cd "$ROOT/apps/api"

# Activate virtual environment if present
if [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
fi

# Ensure PROJECT_ROOT is set so settings can validate
export PROJECT_ROOT="${PROJECT_ROOT:-$ROOT}"

python -m uvicorn main:app --reload --port "$PORT"
