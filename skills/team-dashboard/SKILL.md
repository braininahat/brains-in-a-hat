# Team Dashboard

Launch the web dashboard showing agent activity and metrics.

## When to Use

When the user wants to see team activity, agent effectiveness, or task status visually.

## Process

1. Start the local dashboard server (`dashboard/`)
2. Open in browser
3. Dashboard reads from:
   - `.claude/team/metrics/agent-effectiveness.json`
   - `.claude/team/retrospectives/*.md`
   - `.claude/team/CODEOWNERS`
   - Git log for activity timeline

## Note

Dashboard is Phase 2. This skill is a placeholder for when the dashboard is built.
