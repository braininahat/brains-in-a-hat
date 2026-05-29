#!/usr/bin/env bash
#
# lib-research.sh — Research-cache helpers for brains-in-a-hat hooks
#
# Source this file from other hook scripts:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib-research.sh"
#
# Provides content-addressed, TTL-aware lookup/write helpers for the
# research-cache subsystem (capture-research + vault-check hooks).
#
# Depends on lib-common.sh for VAULT_DIR and derive_project_*.
# Source lib-common.sh first, or let this file source it via SCRIPT_DIR.

SCRIPT_DIR_LR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
source "${SCRIPT_DIR_LR}/lib-common.sh"

# ── Cache directory ────────────────────────────────────────────────────

# research_cache_dir — single chokepoint for where cache entries live.
# Currently == $VAULT_DIR (flat layout, git-synced). Separated so it can
# diverge later without touching every call site.
research_cache_dir() {
  printf '%s' "${VAULT_DIR}"
}

# ── Hashing ───────────────────────────────────────────────────────────

# _sha256 <string> — emit the hex sha256 of the input string.
# Tries sha256sum (Linux) then shasum -a 256 (macOS/BSD).
_sha256() {
  local input="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$input" | sha256sum | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    printf '%s' "$input" | shasum -a 256 | awk '{print $1}'
  else
    # Fallback: use python3 (available everywhere modern)
    printf '%s' "$input" | uv run python3 -c "import sys,hashlib; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())"
  fi
}

# ── Type classification ────────────────────────────────────────────────

# classify_research_type <tool_name> — map a tool name to a cache subtype.
# Returns one of: context7 | webfetch | websearch | explore | unknown
classify_research_type() {
  local tool="$1"
  case "$tool" in
    mcp__*context7*__*) echo "context7" ;;
    WebFetch)           echo "webfetch" ;;
    WebSearch)          echo "websearch" ;;
    # explore: intentionally not wired to capture-research or vault-check —
    # Explore (Agent) returns analysis/synthesis, not a cacheable external doc.
    Agent)              echo "explore" ;;
    *)                  echo "unknown" ;;
  esac
}

# ── Query normalization ────────────────────────────────────────────────

# normalize_query <raw_query> — lowercase, collapse whitespace, strip
# leading/trailing spaces. Produces a stable key component.
normalize_query() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -s ' \t\n' ' ' | sed 's/^ //; s/ $//'
}

# ── Cache key computation ──────────────────────────────────────────────

# compute_cache_key <subtype> <primary> [<secondary>]
# primary:
#   webfetch  → URL
#   websearch → normalized query string
#   context7  → "<library_id>@<version>" (pass version as secondary, or "latest")
#   explore   → normalized prompt/query
# Returns the full hex sha256 of the canonical key string.
compute_cache_key() {
  local subtype="$1"
  local primary="$2"
  local secondary="${3:-}"
  local canonical

  case "$subtype" in
    webfetch)
      # Key on URL only (path + query params; strip fragments)
      canonical="webfetch:$(printf '%s' "$primary" | sed 's/#.*//')"
      ;;
    websearch)
      canonical="websearch:$(normalize_query "$primary")"
      ;;
    context7)
      local ver="${secondary:-latest}"
      canonical="context7:${primary}@${ver}"
      ;;
    explore)
      canonical="explore:$(normalize_query "$primary")"
      ;;
    *)
      canonical="unknown:${primary}"
      ;;
  esac

  _sha256 "$canonical"
}

# cache_shorthash <full_hex_sha256> — first 12 hex chars (48 bits).
# Same key → same shorthash → same filename → refresh-in-place dedup.
cache_shorthash() {
  printf '%s' "$1" | head -c 12
}

# cache_path_for <subtype> <shorthash> — full path to the cache markdown file.
cache_path_for() {
  local subtype="$1"
  local shorthash="$2"
  printf '%s/research-cache--%s--%s.md' "$(research_cache_dir)" "$subtype" "$shorthash"
}

# ── TTL table ─────────────────────────────────────────────────────────

# ttl_for_type <subtype> [<query_or_url>]
# Returns TTL in days as an integer.
#
# Defaults:
#   context7   → 30
#   websearch  → 7
#   webfetch   → 7
#   explore    → 7
#   unknown    → 7
#
# Override via env: BRAINS_TTL_CONTEXT7, BRAINS_TTL_WEBSEARCH, etc. (uppercase).
# Security/CVE override: if query/url contains "cve", "vulnerability", "security
# advisory", "exploit", or "patch" (case-insensitive) → 1 day, always.
ttl_for_type() {
  local subtype="$1"
  local hint="${2:-}"  # optional query or URL for security detection

  # Security/CVE override — trumps everything
  if printf '%s' "$hint" | grep -qiE 'cve|vulnerabilit|security.?advisor|exploit|patch'; then
    echo 1
    return
  fi

  local env_var
  env_var="BRAINS_TTL_$(printf '%s' "$subtype" | tr '[:lower:]' '[:upper:]')"
  # Use env override if set and numeric
  if [ -n "${!env_var:-}" ] && printf '%s' "${!env_var}" | grep -qE '^[0-9]+$'; then
    echo "${!env_var}"
    return
  fi

  case "$subtype" in
    context7)  echo 30 ;;
    websearch) echo 7  ;;
    webfetch)  echo 7  ;;
    explore)   echo 7  ;;
    *)         echo 7  ;;
  esac
}

# ── Staleness check ───────────────────────────────────────────────────

# is_stale <fetched_at_iso8601> <ttl_days>
# Returns exit 0 (stale) or exit 1 (fresh).
# Portable: tries GNU date, then BSD date, then python3.
is_stale() {
  local fetched_at="$1"
  local ttl_days="$2"
  local now_epoch fetched_epoch age_days

  # Parse fetched_at to epoch
  if date --version >/dev/null 2>&1; then
    # GNU date
    fetched_epoch=$(date -d "$fetched_at" +%s 2>/dev/null) || fetched_epoch=""
  else
    # BSD date (macOS)
    fetched_epoch=$(date -j -f '%Y-%m-%dT%H:%M:%SZ' "$fetched_at" +%s 2>/dev/null) \
      || fetched_epoch=$(date -j -f '%Y-%m-%d' "$fetched_at" +%s 2>/dev/null) \
      || fetched_epoch=""
  fi

  # Fallback to python3 if date parsing failed
  if [ -z "$fetched_epoch" ]; then
    fetched_epoch=$(uv run python3 -c "
import sys
from datetime import datetime, timezone
s = '${fetched_at}'.replace('Z','+00:00')
try:
    dt = datetime.fromisoformat(s)
except ValueError:
    dt = datetime.strptime(s[:10], '%Y-%m-%d').replace(tzinfo=timezone.utc)
print(int(dt.timestamp()))
" 2>/dev/null) || fetched_epoch=""
  fi

  [ -z "$fetched_epoch" ] && return 0  # can't parse → treat as stale

  now_epoch=$(date +%s)
  age_days=$(( (now_epoch - fetched_epoch) / 86400 ))

  [ "$age_days" -ge "$ttl_days" ]  # 0 = stale (age ≥ ttl), 1 = fresh
}

# ── Cache lookup ──────────────────────────────────────────────────────

# find_cache_hit <subtype> <full_sha256_key> [<url_for_grep_fallback>]
# Prints the path to the cache file if it exists; prints nothing if not found.
# First tries the direct content-addressed path; if that misses and a URL is
# given, falls back to grepping source_url: in the cache dir (handles legacy or
# manually written entries).
find_cache_hit() {
  local subtype="$1"
  local full_key="$2"
  local url_hint="${3:-}"

  local shorthash
  shorthash=$(cache_shorthash "$full_key")
  local direct_path
  direct_path=$(cache_path_for "$subtype" "$shorthash")

  if [ -f "$direct_path" ]; then
    printf '%s' "$direct_path"
    return 0
  fi

  # Grep fallback: search for matching source_url: in all cache files of this type
  if [ -n "$url_hint" ] && [ -d "$(research_cache_dir)" ]; then
    local hit
    hit=$(grep -rl "^source_url: ${url_hint}$" "$(research_cache_dir)" \
            --include="research-cache--${subtype}--*.md" 2>/dev/null | head -1) || true
    if [ -n "$hit" ]; then
      printf '%s' "$hit"
      return 0
    fi
  fi

  return 1
}

# read_cache_field <file_path> <field_name>
# Read a single frontmatter field value from a cache markdown file.
# Returns empty string if field not found.
read_cache_field() {
  local file="$1"
  local field="$2"
  [ -f "$file" ] || return 0
  if command -v jq >/dev/null 2>&1; then
    # Use grep-based parse (jq doesn't parse YAML frontmatter)
    :
  fi
  grep -m1 "^${field}:" "$file" 2>/dev/null | sed "s/^${field}:[[:space:]]*//" | tr -d "'\""
}
