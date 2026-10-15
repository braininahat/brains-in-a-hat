#!/bin/sh
# Twenty writers add one line each to the same file at once, each doing read, change, write under the lock.
# Without the lock most lines get lost (1 of 20 survived when tried); with it all twenty survive.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
: >"$dir/map"

writer() {
  python3 -I "$here/maplock.py" take "$dir/.lock" || true
  old=$(cat "$dir/map")
  sleep 0.05 # a slow change, so writers really overlap
  printf '%s\nwriter %s\n' "$old" "$1" | sed '/^$/d' >"$dir/map.tmp-$1"
  python3 -I "$here/maplock.py" put "$dir/map.tmp-$1" "$dir/map"
  python3 -I "$here/maplock.py" drop "$dir/.lock"
}

for n in $(seq 1 20); do writer "$n" & done
wait
lines=$(wc -l <"$dir/map")
[ "$lines" -eq 20 ] || { echo "FAIL: $lines of 20 writes kept"; exit 1; }

# A lock left by a dead writer is broken after 5 s instead of blocking forever.
mkdir "$dir/.lock"
touch -d '10 seconds ago' "$dir/.lock"
python3 -I "$here/maplock.py" take "$dir/.lock" || { echo 'FAIL: stale lock not broken'; exit 1; }
python3 -I "$here/maplock.py" drop "$dir/.lock"
echo 'pass: 20 of 20 parallel writes kept; stale lock broken'
