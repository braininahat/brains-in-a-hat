---
description: "Run a QA review of staged/modified changes before committing. Advisory only — reports findings without blocking. Use before commits or when asking 'is this ready?'"
argument-hint: "(no arguments)"
allowed-tools: ["Agent", "Read", "Grep", "Glob", "Bash"]
---

# Team Review

Spawn the `qa-engineer` agent to review staged changes.

## Process

1. Run `git diff --cached --name-only` and `git diff --name-only` to identify modified files
2. Spawn `qa-engineer` agent (model=sonnet)
3. QA runs tests, checks syntax, looks for regressions
4. Returns an advisory report — findings are informational, not blocking
5. Present the QA report to the user

## Note

This is advisory only. QA reports findings but never blocks commits. The user decides whether to act on the report.
