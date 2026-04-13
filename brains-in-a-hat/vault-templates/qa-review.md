---
type: qa-review
write-path: "~/.brains_in_a_hat/vault/"
project: "{{key}}"
agents: [qa-engineer]
date: "{{date}}"
tags: [qa, review]
status: active
---

<!--
Filename convention: <KEY>--research-<slug>.md (qa-review notes use the research category).
After writing:
  source "$CLAUDE_PLUGIN_ROOT/hooks/lib-common.sh"
  ensure_vault_index "$KEY"
-->

# QA Review: {{date}}

## Scope
Files/changes reviewed.

## Findings
| Severity | File | Issue | Recommendation |
|----------|------|-------|----------------|

## Verdict
Advisory assessment: ship / fix-first / needs-discussion
