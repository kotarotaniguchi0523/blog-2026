#!/usr/bin/env bash
set -euo pipefail

# Run from the repository root.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

extra=()
if [[ "${LINT_ACTIONS_ONLINE:-0}" == "1" ]]; then
  extra=(--online=strict)
fi

jactionlint --strict-exit --profile pedantic "${extra[@]}"
sisakulint -enable-rule missing-timeout-minutes
