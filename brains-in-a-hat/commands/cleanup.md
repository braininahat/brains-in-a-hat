---
name: cleanup
description: "Manual codebase hygiene sweep — dead code, unused imports, stale TODOs, inconsistent naming. Not lifecycle-automated."
allowed-tools: ["Agent", "Read", "Grep", "Glob", "LSP"]
---

# Cleanup

Manual only. Opportunistic hygiene sweep, not lifecycle-driven.

Run a codebase hygiene sweep to find cleanup opportunities.

## Sweep Checklist

- Dead code (unused functions, unreachable branches)
- Unused imports
- Stale TODO/FIXME/HACK comments (older than 30 days)
- Inconsistent naming (mixedCase vs snake_case)
- Empty files with no purpose
- Duplicate code that should be extracted
- Overly long files (>500 lines — candidate for splitting)
- Debug logging left in production code

## Process

1. If an argument is provided, focus the sweep on that path/scope
2. Otherwise, sweep the entire project
3. Use LSP and Grep to identify dead code and unused imports
4. Check git blame dates on TODO comments to find stale ones
5. Report findings grouped by risk level:
   - **Safe to remove:** dead code, unused imports
   - **Cosmetic:** naming inconsistencies
   - **Needs review:** duplicate code, long files

## Output

```
Cleanup Report:
- 3 unused imports in src/services/auth.py
- 2 stale TODOs in src/components/Dashboard.tsx (from 6 weeks ago)
- 1 dead function _legacyAuth() in src/middleware.py
- Recommendation: remove all, low risk
```

## Rules

- Propose changes, don't fix them directly
- Prioritize by risk (dead code = safe, naming = cosmetic)
- Never touch test files without testing-strategy sign-off
