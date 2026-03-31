---
type: dashboard
write-path: "~/.brains_in_a_hat/vault/projects/{{project}}/"
tags: [dashboard, index]
---
# Dashboard

## Recent Decisions
```dataview
TABLE date, agents, status
FROM #decision
SORT date DESC
LIMIT 10
```

## Recent Retrospectives
```dataview
TABLE date, tags
FROM #retro
SORT date DESC
LIMIT 5
```

## Research Notes
```dataview
TABLE date, tags, status
FROM #research
SORT date DESC
LIMIT 10
```

## Agent Activity
```dataview
TABLE length(rows) as "Notes"
FROM ""
FLATTEN agents as agent
GROUP BY agent
SORT length(rows) DESC
```

## Superseded Decisions
```dataview
TABLE date, agents
FROM #decision
WHERE status = "superseded"
SORT date DESC
```
