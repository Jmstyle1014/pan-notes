#!/usr/bin/env bash
# Runs Panyard's browser tests against the built app (source/pan-notes-panyard.html).
# Needs: python3, playwright (pip install playwright, then: playwright install chromium), numpy, pillow, tinycss2.
# Usage: tests/run_tests.sh            run everything
#        tests/run_tests.sh tcloud rt  run just these
# Screenshots and files the tests make go to tests/work/ (not committed).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$HERE")"
export SRC="$ROOT/source" APP="$ROOT/source/pan-notes-panyard.html" WORK="$HERE/work"
mkdir -p "$WORK/rt" "$WORK/pass" "$WORK/lk" && cp -r "$HERE/fixtures/." "$WORK/"
cd "$WORK"
# name and the arguments it takes
ALL=(
  "tlooks" "tcloud" "tpass" "tguide" "rt" "tfloat" "ttw" "tband" "ttt" "tfirst" "tscreens" "tnotes" "tarrange" "tgb" "tgame" "tlook" "trole" "tparts" "tkit" "tmodes" "tlite"
  "tbackup $APP" "twb $APP" "tmetro $APP" "tsets $APP pq" "ttune $APP" "tstage $APP pq guitar,tenor"
  "tspk" "ttapload $APP 6" "tlate $APP"
)
want=("$@"); fail=0
for t in "${ALL[@]}"; do
  name=${t%% *}; args=""; [ "$t" != "$name" ] && args=${t#* }
  if [ ${#want[@]} -gt 0 ] && [[ ! " ${want[*]} " =~ " $name " ]]; then continue; fi
  echo "===== $name"
  # shellcheck disable=SC2086
  if ! timeout 600 python3 "$HERE/$name.py" $args 2>&1 | tail -6; then fail=1; fi
  if [ "${PIPESTATUS[0]}" != "0" ]; then echo "!!!!! $name FAILED"; fail=1; fi
done
exit $fail
