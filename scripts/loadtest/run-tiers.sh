#!/bin/bash
# Runs the concurrency ladder for Scenario E (realistic mixed traffic),
# one tier at a time, saving a JSON summary per tier under reports/loadtest/.
#
#   ./scripts/loadtest/run-tiers.sh 50 100 500 1000
#
# Tiers run sequentially on purpose: overlapping them would muddle which
# concurrency level produced which latency. Between tiers we pause so the
# backend settles, otherwise a tier inherits the previous one's queue.
#
# Always run scripts/loadtest/check-tokens.js first -- expired tokens make
# every tier look like a total backend failure.

set -u
cd "$(dirname "$0")/../.."

TIERS=${*:-"50 100 500 1000"}
RAMP=${RAMP:-30s}
HOLD=${HOLD:-60s}
SETTLE=${SETTLE:-20}
STAMP=$(date +%Y-%m-%dT%H-%M-%S)
OUTDIR="reports/loadtest/ladder-$STAMP"
mkdir -p "$OUTDIR"

echo "Ladder: $TIERS  (ramp $RAMP, hold $HOLD, settle ${SETTLE}s between tiers)"
echo "Output: $OUTDIR"
echo ""

for VUS in $TIERS; do
  echo "==================== TIER: $VUS VUs ===================="
  VUS="$VUS" RAMP="$RAMP" HOLD="$HOLD" \
    SUMMARY_OUT="$OUTDIR/tier-$VUS.json" \
    k6 run --quiet scripts/loadtest/scenario-e-mixed-realistic.js
  STATUS=$?
  if [ $STATUS -eq 0 ]; then
    echo "  RESULT: tier $VUS PASSED thresholds"
  else
    echo "  RESULT: tier $VUS BREACHED thresholds (k6 exit $STATUS)"
  fi
  echo ""
  sleep "$SETTLE"
done

echo "==================== LADDER COMPLETE ===================="
echo "Summaries in $OUTDIR"
