#!/usr/bin/env sh
# Hashi pack runner (sh)
# Usage: ./run_hashi_pack.sh [easy|medium|hard|all]
# Environment options:
#   COUNT   : target puzzle count per difficulty (default 50)
#   THREADS : worker thread count (default 4)
#   TRIES   : max tries per puzzle (0 uses preset default)
#   START   : starting index for seed generation (default 0)
#   OUT     : output file (defaults to project hashi_pack_output.js if omitted)
set -eu

DIFF="${1:-all}"
COUNT="${COUNT:-50}"
THREADS="${THREADS:-4}"
TRIES="${TRIES:-0}"
START="${START:-0}"
OUT="${OUT:-}"

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
SCRIPT="$SCRIPT_DIR/make_hashi_pack.cjs"

ARGS="$SCRIPT $DIFF --count=$COUNT --threads=$THREADS --start=$START"
if [ "$TRIES" -gt 0 ] 2>/dev/null; then
  ARGS="$ARGS --tries=$TRIES"
fi
if [ -n "$OUT" ]; then
  ARGS="$ARGS --out=$OUT"
fi

node $ARGS
