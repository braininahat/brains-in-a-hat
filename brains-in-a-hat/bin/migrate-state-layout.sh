#!/usr/bin/env bash
#
# migrate-state-layout.sh — one-shot migration to per-key state layout.
#
# v0.7+ moves all runtime state out of in-tree .brains_in_a_hat/state/ to
# ~/.brains_in_a_hat/state/<KEY>/ where KEY = <owner>-<name> (from gh),
# and renames vault files from <gh-name>--*.md to <owner-name>--*.md.
#
# Idempotent. Safe to re-run. --dry shows what would change without writing.
#
# Actions:
#   1. Visit each project path in ~/.brains_in_a_hat/active-sessions.jsonl.
#      For each existing path, run `gh repo view` to compute the new
#      owner-name key. Build {project_path → key} and {gh_name → key} maps.
#   2. For each known project: move its in-tree .brains_in_a_hat/state/
#      contents to ~/.brains_in_a_hat/state/<key>/. Skip when old is
#      already under BIH_HOME (recursive move case).
#   3. Rename vault files <gh-name>--*.md → <owner-name>--*.md.
#   4. Bootstrap per-project index notes via ensure_vault_index for each key.
#   5. Park rogue files at ~/.brains_in_a_hat/state/* root level under
#      ~/.brains_in_a_hat/state/_orphaned/.
#   6. Best-effort: rewrite `project:` frontmatter in vault notes to use KEY.

set -euo pipefail

DRY=0
[ "${1:-}" = "--dry" ] && DRY=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${PLUGIN_ROOT}/hooks/lib-common.sh"

# Make ensure_vault_index find its template
export CLAUDE_PLUGIN_ROOT="${PLUGIN_ROOT}"

say() { echo "[migrate] $*"; }
warn() { echo "[migrate] WARNING: $*" >&2; }
run() {
  if [ "$DRY" = "1" ]; then
    echo "+ $*"
  else
    "$@"
  fi
}

# Compute owner-name key for a given project directory. Must cd there
# because gh reads from the current git repo. Returns empty string if
# the path doesn't exist or gh can't resolve owner/name.
compute_owner_name_key() {
  local proj="$1"
  [ -d "$proj" ] || { printf ''; return; }
  local owner name
  owner=$(cd "$proj" && gh repo view --json owner -q '.owner.login' 2>/dev/null || true)
  name=$(cd "$proj" && gh repo view --json name -q '.name' 2>/dev/null || true)
  if [ -n "$owner" ] && [ -n "$name" ]; then
    printf '%s-%s' "$owner" "$name" | sed 's|/|-|g'
  fi
}

# ── Step 1: build project → key and gh-name → key maps ───────────────

declare -A PROJECT_KEYS      # absolute project path → owner-name key
declare -A NAME_KEYS         # gh short name → owner-name key (unique)
declare -A NAME_COLLISIONS   # gh short name → " key1 key2 ..." when ambiguous
SKIPPED_PATHS=()             # paths that don't exist or aren't gh repos

if [ -f "${BIH_HOME}/active-sessions.jsonl" ]; then
  declare -A SEEN_PROJ
  while IFS= read -r line; do
    p=$(echo "$line" | jq -r '.project // empty' 2>/dev/null) || continue
    n=$(echo "$line" | jq -r '.name // empty' 2>/dev/null) || true
    [ -n "$p" ] || continue
    # Skip duplicate entries for the same path (active-sessions.jsonl
    # has many per project)
    [ -n "${SEEN_PROJ[$p]:-}" ] && continue
    SEEN_PROJ["$p"]=1

    k=$(compute_owner_name_key "$p" 2>/dev/null || true)
    if [ -z "$k" ]; then
      SKIPPED_PATHS+=("$p")
      continue
    fi
    PROJECT_KEYS["$p"]="$k"
    if [ -n "$n" ] && [ "$n" != "null" ]; then
      existing="${NAME_KEYS[$n]:-}"
      if [ -z "$existing" ]; then
        NAME_KEYS["$n"]="$k"
      elif [ "$existing" != "$k" ]; then
        # Collision: multiple owner-name keys share the same short gh name.
        # Record the set, unset the single mapping — rename step will skip.
        NAME_COLLISIONS["$n"]="${NAME_COLLISIONS[$n]:-${existing}} ${k}"
      fi
    fi
  done < "${BIH_HOME}/active-sessions.jsonl"

  # For any collided names, report and remove the single-valued mapping.
  for n in "${!NAME_COLLISIONS[@]}"; do
    warn "gh short name '$n' maps to multiple owner-name keys: ${NAME_COLLISIONS[$n]} — vault renames for this prefix will be SKIPPED (manual disambiguation required)."
    unset "NAME_KEYS[$n]"
  done
fi

say "Resolved ${#PROJECT_KEYS[@]} project(s) to owner-name keys"
if [ "${#SKIPPED_PATHS[@]}" -gt 0 ]; then
  say "Skipped ${#SKIPPED_PATHS[@]} path(s) (not a gh repo, missing, or unreachable):"
  printf '  %s\n' "${SKIPPED_PATHS[@]}" | sort -u
fi

# ── Step 2: relocate in-tree state to per-key dirs ───────────────────

for proj in "${!PROJECT_KEYS[@]}"; do
  key="${PROJECT_KEYS[$proj]}"
  old="${proj}/.brains_in_a_hat/state"
  [ -d "$old" ] || continue
  # Skip if $old is already inside BIH_HOME (rogue writes from cwd=$HOME
  # — these get handled by the orphan step).
  old_real=$(realpath "$old" 2>/dev/null || printf '%s' "$old")
  case "$old_real" in
    "${BIH_HOME}"*)
      say "Skip recursive move: $old is under ${BIH_HOME} (will be orphaned if loose)"
      continue
      ;;
  esac
  new=$(state_dir "$key")
  say "Move in-tree state: $old → $new"
  run mkdir -p "$new"
  if [ "$DRY" = "1" ]; then
    echo "+ cp -a $old/. $new/ && rm -rf $old"
  else
    cp -a "$old/." "$new/" 2>/dev/null || true
    rm -rf "$old" 2>/dev/null || true
  fi
done

# ── Step 3: rename vault files <gh-name>--*.md → <owner-name>--*.md ──

if [ -d "$VAULT_DIR" ]; then
  shopt -s nullglob
  for f in "${VAULT_DIR}"/*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    case "$base" in
      *--*) ;;
      *) continue ;;
    esac
    prefix="${base%%--*}"
    rest="${base#*--}"
    # Skip owner-name-shaped prefixes (contain a dash, could already be migrated)
    # — actual check: is this prefix a value in NAME_KEYS already? then skip
    ALREADY=0
    for v in "${NAME_KEYS[@]}"; do
      [ "$prefix" = "$v" ] && { ALREADY=1; break; }
    done
    [ "$ALREADY" = "1" ] && continue
    # Skip legacy path-based keys (start with -)
    case "$prefix" in
      -*) continue ;;
    esac
    new_key="${NAME_KEYS[$prefix]:-}"
    if [ -z "$new_key" ]; then
      say "SKIP rename: $base (no key mapping for prefix '$prefix')"
      continue
    fi
    new_name="${new_key}--${rest}"
    new_path="${VAULT_DIR}/${new_name}"
    if [ "$f" = "$new_path" ]; then
      continue
    fi
    if [ -e "$new_path" ]; then
      warn "rename conflict: $new_path already exists, skipping $base"
      continue
    fi
    say "Rename: $base → $new_name"
    run mv "$f" "$new_path"
  done
  shopt -u nullglob
fi

# ── Step 4: bootstrap per-project index notes ────────────────────────

declare -A UNIQUE_KEYS
for v in "${PROJECT_KEYS[@]}"; do UNIQUE_KEYS["$v"]=1; done
for key in "${!UNIQUE_KEYS[@]}"; do
  if [ "$DRY" = "1" ]; then
    echo "+ ensure_vault_index $key"
  else
    ensure_vault_index "$key" 2>/dev/null || warn "ensure_vault_index $key failed"
  fi
done

# ── Step 5: park rogue files at state root ───────────────────────────

shopt -s nullglob
orphaned="${STATE_ROOT}/_orphaned"
ROGUES=("${STATE_ROOT}"/*)
ANY_ROGUE=0
for f in "${ROGUES[@]}"; do
  [ -f "$f" ] || continue
  ANY_ROGUE=1
  break
done
if [ "$ANY_ROGUE" = "1" ]; then
  run mkdir -p "$orphaned"
  for f in "${STATE_ROOT}"/*; do
    [ -f "$f" ] || continue
    say "Orphan: $(basename "$f") → _orphaned/"
    run mv "$f" "$orphaned/"
  done
fi
shopt -u nullglob

# ── Step 6: rewrite project: frontmatter to use new KEY ──────────────

if [ -d "$VAULT_DIR" ]; then
  shopt -s nullglob
  for f in "${VAULT_DIR}"/*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    # Only rewrite files whose prefix is now a known owner-name key
    case "$base" in
      *--*) ;;
      *) continue ;;
    esac
    prefix="${base%%--*}"
    KNOWN=0
    for v in "${PROJECT_KEYS[@]}"; do
      [ "$prefix" = "$v" ] && { KNOWN=1; break; }
    done
    [ "$KNOWN" = "1" ] || continue
    if grep -q '^project:' "$f" 2>/dev/null; then
      if [ "$DRY" = "1" ]; then
        echo "+ sed -i 's|^project:.*|project: \"${prefix}\"|' $f"
      else
        sed -i "s|^project:.*|project: \"${prefix}\"|" "$f"
      fi
    fi
  done
  shopt -u nullglob
fi

say "Migration complete."
[ -d "$orphaned" ] && say "Review ${orphaned} for keep/delete decisions."
[ "$DRY" = "1" ] && say "(dry run — no changes applied)"
