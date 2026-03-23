# brains-in-a-hat

A 23-agent AI software team for Claude Code. Smart routing, auto-CODEOWNERS, self-improvement, and proactive DX suggestions.

## Install

```bash
claude plugins add /path/to/brains-in-a-hat
```

## Team Roster

### Always Active
| Agent | Role |
|-------|------|
| Tech Lead | Orchestrates team, routes tasks, synthesizes findings |
| Session Manager | Briefings at session start, memory updates at end |
| QA Engineer | Tests before every commit, blocks if tests fail |
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
| Research Analyst | Technical investigation, benchmarks |
| Data/Schema | SQLite, migrations, config |
| UX/Workflow | End-to-end user flows |
| Testing Strategy | Test suite design, coverage |
| IP/Patent | Technical disclosures, novelty |

### Periodic/On-Demand
| Agent | Role |
|-------|------|
| DevOps | CI/CD, GitHub Actions |
| Packaging | AppImage, Docker, PyInstaller |
| Docs Writer | Specs, CLAUDE.md, API docs |
| Issue Triager | GitHub issue management |
| Code Janitor | Dead code, stale TODOs, hygiene |

## Features

- **Smart routing** — Tech Lead activates 4-6 agents per task based on files touched
- **Auto-CODEOWNERS** — Meta Agent generates ownership mapping on install, maintains during retros
- **Self-improvement** — retrospectives after major tasks, agent prompt updates
- **Proactive DX** — suggests hooks, aliases, workflow improvements (rate-limited)
- **Pre-commit enforcement** — QA must approve before commits to owned paths

## Skills

- `/team-briefing` — Session start briefing
- `/team-debrief` — Session end memory update
- `/team-retro` — Post-task retrospective
- `/team-dashboard` — Launch web dashboard (Phase 2)

## Configuration

### User Preferences

Copy `examples/user-preferences.json` to `.claude/team/user-preferences.json` in your project and customize. Controls communication style, tool preferences, engineering principles. The Meta Agent also learns and updates this file over time.

### Domain Knowledge

Copy `examples/domain-config.json` to `.claude/team/domain-config.json` and customize for your domain. The included example is for clinical speech-language pathology — replace with your own domain terminology, compliance requirements, and validation rules.

## Cross-Device / Cross-Account

The plugin lives in a Git repo — install on any device with Claude Code. Project-specific state (memory, CODEOWNERS, retrospectives) stays in each project's `.claude/team/` directory.

## License

MIT
