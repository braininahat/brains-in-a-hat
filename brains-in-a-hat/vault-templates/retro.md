---
type: retro
write-path: "~/.brains_in_a_hat/vault/"
project: "{{key}}"
agents: []
date: "{{date}}"
tags: [retro]
status: active
---

<!--
Filename convention: <KEY>--retro-<date>.md (final) or <KEY>--retro-checkpoint-<iso>.md (checkpoint).
After writing:
  source "$CLAUDE_PLUGIN_ROOT/hooks/lib-common.sh"
  ensure_vault_index "$KEY"
-->

# Retrospective: {{date}}

## What Happened
Brief summary of the session's work.

## What Went Well
- Agent contributions that were valuable
- Decisions that paid off: [[decision-x]]

## What Was Missed
- Gaps in coverage, late catches, rework

## Agent Effectiveness
| Agent | Spawned | Useful | Notes |
|-------|---------|--------|-------|
| [[agent-researcher]] | 2 | 2 | solid research on X |
| [[agent-qa-engineer]] | 1 | 1 | caught regression in Y |

## Action Items
- [ ] Prompt improvement for [[agent-x]]: add check for Z
- [ ] New CODEOWNERS rule: `path/` → agent-y

## Carried Forward
<!-- Open items from prior retros — meta-retro copies these automatically -->
<!-- Items pending 3+ sessions get ESCALATED tag -->
