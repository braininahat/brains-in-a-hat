# Team Dashboard

Launch the live agent activity monitor in your browser.

## When to Use

When the user wants to see what agents are doing in real time, or says "show dashboard", "what are the agents doing", "open dashboard".

## Process

1. Start the dashboard server in the background:
   ```bash
   python "$(dirname "$0")/../../dashboard/server.py" --project-dir "$(pwd)" &
   ```
2. Capture the URL from stdout (printed as `brains-in-a-hat dashboard: http://...`)
3. Open in browser: `xdg-open <URL>` (Linux) or `open <URL>` (macOS)
4. Tell the user the dashboard is running and give them the URL

## What It Shows

- **Agent cards** — name, status (active/idle/done), current action, files touched
- **Activity timeline** — chronological event stream with agent-colored markers
- **Inter-agent messages** — SendMessage flow between agents
- **Connection status** — live SSE connection with auto-reconnect

## How It Works

Agents self-report to `.claude/team/activity.jsonl` as they work. The server tails this file and streams events to the browser via SSE. The PostToolUse hook also logs agent spawns from the orchestrator.

## Stopping

The server runs until killed. To stop: `pkill -f "dashboard/server.py"` or Ctrl+C in its terminal.
