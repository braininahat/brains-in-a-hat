# brains-in-a-hat

A 20-agent AI software team for Claude Code. Smart routing, auto-CODEOWNERS, self-improvement, and proactive DX suggestions.

## Install

```bash
# Install the team plugin
claude plugins add /path/to/brains-in-a-hat/brains-in-a-hat

# Install the visualization plugin (optional)
claude plugins add /path/to/brains-in-a-hat/grant
```

## Plugins

| Plugin | Purpose |
|--------|---------|
| `brains-in-a-hat` | 20-agent dev team — routing, QA, memory, retrospectives |
| `grant` | Visualization agent — architecture diagrams, git activity, code maps |

## Team Roster

### Always Active
| Agent | Role |
|-------|------|
| Session Manager | Briefings at session start, memory updates at end |
| QA Engineer | Advisory QA reviews before commits |
| Meta/Retro | Retrospectives, DX suggestions, CODEOWNERS maintenance |

### Routed by Task Type
| Agent | Trigger |
|-------|---------|
| System Designer | New features, architectural decisions |
| Architect | Code review for boundary violations |
| UI Reviewer | QML/CSS/HTML visual changes |
| Qt/QML | PySide6/Qt-specific patterns |
| MLOps | ONNX models, inference, weights |
| Signal Processing | Audio/video pipelines, timestamps |
| Hardware/Device | Probe protocol, WiFi, USB, V4L2 |
| Domain Expert | Clinical/domain-specific validation |
| Profiler | Performance, latency, memory |
| Researcher | Technical investigation, benchmarks |
| Data/Schema | SQLite, migrations, config |
| UX/Workflow | End-to-end user flows |
| Testing Strategy | Test suite design, coverage |

### Periodic/On-Demand
| Agent | Role |
|-------|------|
| DevOps | CI/CD, GitHub Actions |
| Packaging | AppImage, Docker, PyInstaller |
| Docs Writer | Specs, CLAUDE.md, API docs |
| Parker | Issues, backlog, milestones, GitHub Projects |

## Features

- **Smart routing** — Neal (orchestrator) activates 4-6 agents per task based on files touched
- **Auto-CODEOWNERS** — Meta Agent generates ownership mapping on install, maintains during retros
- **Self-improvement** — retrospectives after major tasks, agent prompt updates
- **Proactive DX** — suggests hooks, aliases, workflow improvements (rate-limited)
- **Advisory QA** — QA reviews are advisory; they never block commits

## Skills

### brains-in-a-hat
- `/assemble` — Activate the brains-in-a-hat team (Neal + all agents)
- `/team-briefing` — Session start briefing: branch status, uncommitted changes, open tasks
- `/team-debrief` — Session end memory update: save decisions, WIP, workflow changes
- `/team-retro` — Post-task retrospective: what went well, what to improve
- `/team-review` — QA review of staged/modified changes before commit
- `/team-cleanup` — Find dead code, unused imports, stale TODOs

### grant
- `/grant` — Visualize architecture, git activity, code structure, or agent topology

## Dashboard

The dashboard auto-starts via the `session-start` hook each time a Claude Code session opens. It requires Python 3 or `uv` to be available on `$PATH`.

- Runs at `http://localhost:8787` by default
- Accepts a `?project=<path>` query parameter for multi-project use
- Logs to `.brains_in_a_hat/state/dashboard.log` in the current project

## Configuration

### User Preferences

Copy `examples/user-preferences.json` to `.brains_in_a_hat/user-preferences.json` in your project and customize. Controls communication style, tool preferences, engineering principles. The Meta Agent also learns and updates this file over time.

### Domain Knowledge

Copy `examples/domain-config.json` to `.brains_in_a_hat/domain-config.json` and customize for your domain. The included example is for clinical speech-language pathology — replace with your own domain terminology, compliance requirements, and validation rules.

## Cross-Device / Cross-Account

The plugin lives in a Git repo — install on any device with Claude Code. Project-specific config (CODEOWNERS, domain-config) stays in `.brains_in_a_hat/`. Vault artifacts persist globally at `~/.brains_in_a_hat/vault/`.

## License

MIT
