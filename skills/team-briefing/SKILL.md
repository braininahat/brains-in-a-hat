# Team Briefing

Produce a session briefing using the session-manager agent.

## When to Use

At the start of every session, or when the user asks "what's the status?" or "where did we leave off?"

## Process

1. Spawn the `session-manager` agent
2. It reads memory files, git status, open issues, and team CODEOWNERS
3. Returns a concise briefing (under 20 lines)
4. Tech Lead presents the briefing to the user

## Plan Mode

If plan mode is active, append to the briefing:

> **Plan mode active** — team specialists available for exploration and design:
> - `researcher` — evidence-based investigation, comparison matrices
> - `system-designer` — architecture, interfaces, blueprints
> - `architect` — boundary review, dependency analysis
> - `domain-expert` — domain-specific validation
> - `testing-strategy` — test planning, coverage analysis
> - `docs-writer` — documentation audit, staleness detection
>
> These agents have read-only tool sets and work within plan mode constraints.
