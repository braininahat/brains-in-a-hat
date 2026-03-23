# Team Briefing

Produce a session briefing using the session-manager agent.

## When to Use

At the start of every session, or when the user asks "what's the status?" or "where did we leave off?"

## Process

1. Spawn the `session-manager` agent
2. It reads memory files, git status, open issues, and team CODEOWNERS
3. Returns a concise briefing (under 20 lines)
4. Tech Lead presents the briefing to the user
