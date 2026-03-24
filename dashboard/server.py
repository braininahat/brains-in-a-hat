#!/usr/bin/env python3
"""
brains-in-a-hat: Live Agent Activity Dashboard Server

Python stdlib-only HTTP server that:
- Serves dashboard/index.html on localhost (auto-selected port)
- SSE endpoint /events that tails activity.jsonl and streams new events
- REST endpoint /api/activity that returns all events
- REST endpoint /api/agents that returns agent metadata from agents/ directory
- REST endpoint /api/projects that returns recently active projects
- Graceful shutdown on SIGINT

Usage:
    python dashboard/server.py [--project-dir /path/to/project]

The --project-dir flag specifies where .claude/team/activity.jsonl lives.
If omitted, defaults to the current working directory.

All /api/activity, /api/files, and /events endpoints accept an optional
?project=<path> query parameter to target a specific project directory.
"""

import argparse
import json
import os
import signal
import socket
import sys
import threading
import time
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

POLL_INTERVAL = 0.5  # seconds between file-tail checks
SSE_KEEPALIVE = 15   # seconds between SSE keepalive comments

# Resolve paths relative to this script's location
SCRIPT_DIR = Path(__file__).resolve().parent
PLUGIN_DIR = SCRIPT_DIR.parent
AGENTS_DIR = PLUGIN_DIR / "agents"
INDEX_HTML = SCRIPT_DIR / "index.html"

ACTIVE_SESSIONS_PATH = Path.home() / ".claude" / "team" / "active-sessions.jsonl"


def parse_args():
    parser = argparse.ArgumentParser(
        description="brains-in-a-hat live agent activity dashboard"
    )
    parser.add_argument(
        "--project-dir",
        type=str,
        default=os.getcwd(),
        help="Project root where .claude/team/activity.jsonl lives (default: cwd)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=0,
        help="Port to bind (default: auto-select)",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Agent metadata loader
# ---------------------------------------------------------------------------

def load_agents():
    """Read agent .md files from the agents/ directory.

    Parses YAML-ish frontmatter (name + description) without importing yaml.
    Returns a list of dicts: [{"id": "researcher", "name": "researcher", "description": "..."}]
    """
    agents = []
    if not AGENTS_DIR.is_dir():
        return agents

    for md_file in sorted(AGENTS_DIR.glob("*.md")):
        agent_id = md_file.stem  # e.g. "researcher"
        name = agent_id
        description = ""

        try:
            text = md_file.read_text(encoding="utf-8")
        except OSError:
            continue

        # Parse simple frontmatter between --- delimiters
        if text.startswith("---"):
            parts = text.split("---", 2)
            if len(parts) >= 3:
                frontmatter = parts[1]
                for line in frontmatter.strip().splitlines():
                    line = line.strip()
                    if line.startswith("name:"):
                        name = line[len("name:"):].strip().strip("'\"")
                    elif line.startswith("description:"):
                        description = line[len("description:"):].strip().strip("'\"")

        agents.append({
            "id": agent_id,
            "name": name,
            "description": description,
        })

    return agents


# ---------------------------------------------------------------------------
# Projects loader
# ---------------------------------------------------------------------------

def load_projects():
    """Read active-sessions.jsonl, deduplicate by project path, filter to 24h.

    Each line in the file is expected to have at least a "project" key (absolute
    path string) and a "ts" key (ISO-8601 timestamp).  An optional "name" key
    provides a human-readable label.

    Returns a list of dicts sorted by most-recent activity:
        [{"project": "/abs/path", "ts": "2026-...", "name": "my-project"}, ...]
    """
    projects = []
    if not ACTIVE_SESSIONS_PATH.is_file():
        return projects

    cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=24)

    # Keyed by project path -> most recent entry
    seen = {}

    try:
        with open(ACTIVE_SESSIONS_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue

                project = entry.get("project", "")
                ts_raw = entry.get("ts", "")
                if not project or not ts_raw:
                    continue

                # Parse timestamp; accept with or without trailing Z
                try:
                    ts_str = ts_raw.replace("Z", "+00:00")
                    ts = datetime.fromisoformat(ts_str)
                    # Ensure tz-aware
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                except ValueError:
                    continue

                if ts < cutoff:
                    continue

                if project not in seen or ts > datetime.fromisoformat(
                    seen[project]["ts"].replace("Z", "+00:00")
                ):
                    seen[project] = {
                        "project": project,
                        "ts": ts_raw,
                        "name": entry.get("name", Path(project).name),
                    }
    except OSError:
        pass

    # Sort by most recent first
    projects = sorted(
        seen.values(),
        key=lambda e: e["ts"],
        reverse=True,
    )
    return projects


# ---------------------------------------------------------------------------
# Activity file reader
# ---------------------------------------------------------------------------

class ActivityFile:
    """Thread-safe reader for the activity.jsonl file.

    Supports reading all events and tailing for new events.
    """

    def __init__(self, path):
        self.path = Path(path)
        self._lock = threading.Lock()

    def read_all(self):
        """Return all events as a list of dicts."""
        events = []
        if not self.path.is_file():
            return events

        try:
            with open(self.path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            events.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
        except OSError:
            pass

        return events

    def tail(self, stop_event, callback):
        """Tail the file, calling callback(event_dict) for each new line.

        Blocks until stop_event is set. Creates the parent directory and file
        if they do not exist, so the SSE stream is ready from the start.
        """
        # Ensure the file exists
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.touch()

        with open(self.path, "r", encoding="utf-8") as f:
            # Seek to end -- we only want new events
            f.seek(0, 2)
            buf = ""

            while not stop_event.is_set():
                chunk = f.read(8192)
                if chunk:
                    buf += chunk
                    while "\n" in buf:
                        line, buf = buf.split("\n", 1)
                        line = line.strip()
                        if line:
                            try:
                                event = json.loads(line)
                                callback(event)
                            except json.JSONDecodeError:
                                continue
                else:
                    stop_event.wait(POLL_INTERVAL)


# ---------------------------------------------------------------------------
# HTTP request handler
# ---------------------------------------------------------------------------

class DashboardHandler(BaseHTTPRequestHandler):
    """Handle dashboard HTTP requests.

    Routes:
        GET /              -> serve index.html
        GET /events        -> SSE stream of new activity events
        GET /api/activity  -> JSON array of all events
        GET /api/agents    -> JSON array of agent metadata
        GET /api/files     -> JSON array of project files (path + type)
        GET /api/vault     -> JSON array of vault notes (path + type + title)
        GET /api/projects  -> JSON array of recently active projects

    All data endpoints accept an optional ?project=<abs-path> query parameter.
    When provided, that directory is used instead of the server default.
    """

    # Suppress default logging -- we do our own
    def log_message(self, format, *args):
        pass

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")

    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        path = parsed.path

        if path == "/" or path == "/index.html":
            self._serve_index()
        elif path == "/events":
            self._serve_sse(qs)
        elif path == "/api/activity":
            self._serve_activity(qs)
        elif path == "/api/agents":
            self._serve_agents()
        elif path == "/api/files":
            self._serve_files(qs)
        elif path == "/api/vault":
            self._serve_vault()
        elif path == "/api/projects":
            self._serve_projects()
        else:
            self.send_error(404)

    def _resolve_project_dir(self, qs):
        """Return a resolved Path for the project directory.

        Uses the ?project=<path> query parameter when present; falls back to
        the server-level default (self.server.project_dir).
        """
        project_values = qs.get("project", [])
        if project_values:
            candidate = Path(project_values[0]).resolve()
            if candidate.is_dir():
                return candidate
        return self.server.project_dir

    def _serve_index(self):
        try:
            content = INDEX_HTML.read_bytes()
        except OSError:
            self.send_error(500, "index.html not found")
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _serve_activity(self, qs):
        project_dir = self._resolve_project_dir(qs)
        activity_path = project_dir / ".claude" / "team" / "activity.jsonl"
        activity_file = ActivityFile(activity_path)
        events = activity_file.read_all()
        self._send_json(events)

    def _serve_agents(self):
        self._send_json(self.server.agents)

    def _serve_files(self, qs):
        """Walk project_dir and return a JSON array of up to 500 files.

        Each entry: {"path": "<relative>", "type": "<extension without dot>"}
        Directories in EXCLUDE_DIRS are skipped entirely.
        """
        EXCLUDE_DIRS = {
            ".git", "node_modules", "__pycache__",
            ".claude", ".obsidian", ".venv", "venv", "dist", "build", ".env",
        }
        MAX_FILES = 500

        project_dir = self._resolve_project_dir(qs)
        files = []

        for root, dirs, filenames in os.walk(project_dir):
            # Prune excluded directories in-place so os.walk skips them
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

            for filename in sorted(filenames):
                abs_path = Path(root) / filename
                try:
                    rel_path = abs_path.relative_to(project_dir)
                except ValueError:
                    continue

                ext = abs_path.suffix.lstrip(".")
                files.append({"path": str(rel_path), "type": ext})

                if len(files) >= MAX_FILES:
                    self._send_json(files)
                    return

        self._send_json(files)

    def _serve_vault(self):
        """Walk ~/.claude/vault/ and return a JSON array of vault notes.

        Each entry: {"path": "<relative>", "type": "<dir-derived type>", "title": "<filename-derived>"}
        Only .md files are included.
        Type is determined from the immediate parent directory name using VAULT_TYPE_MAP.
        Title is the stem with hyphens replaced by spaces, title-cased.
        """
        VAULT_TYPE_MAP = {
            "decisions": "decision",
            "retros": "retro",
            "research": "research",
            "architecture": "architecture",
        }

        vault_dir = self.server.vault_dir
        notes = []

        if not vault_dir.is_dir():
            self._send_json(notes)
            return

        for root, dirs, filenames in os.walk(vault_dir):
            # Sort dirs for deterministic ordering
            dirs.sort()
            root_path = Path(root)

            for filename in sorted(filenames):
                if not filename.endswith(".md"):
                    continue

                abs_path = root_path / filename
                try:
                    rel_path = abs_path.relative_to(vault_dir)
                except ValueError:
                    continue

                # Type from immediate parent directory name
                parent_name = abs_path.parent.name
                note_type = VAULT_TYPE_MAP.get(parent_name, parent_name)

                # Title from filename stem
                stem = abs_path.stem
                title = stem.replace("-", " ").title()

                notes.append({
                    "path": str(rel_path),
                    "type": note_type,
                    "title": title,
                })

        self._send_json(notes)

    def _serve_projects(self):
        """Return recently active projects from active-sessions.jsonl."""
        self._send_json(load_projects())

    def _serve_sse(self, qs):
        """Stream new events as SSE (Server-Sent Events).

        Each event is sent as:
            data: {"ts": ..., "agent": ..., ...}

        A keepalive comment is sent every SSE_KEEPALIVE seconds to prevent
        proxy/browser timeouts.

        Accepts an optional ?project=<path> query parameter to tail a specific
        project's activity file.
        """
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self._send_cors_headers()
        self.end_headers()

        project_dir = self._resolve_project_dir(qs)
        activity_path = project_dir / ".claude" / "team" / "activity.jsonl"
        activity_file = ActivityFile(activity_path)

        stop = threading.Event()
        last_keepalive = time.monotonic()

        def on_event(event):
            nonlocal last_keepalive
            try:
                msg = "data: " + json.dumps(event, ensure_ascii=False) + "\n\n"
                self.wfile.write(msg.encode("utf-8"))
                self.wfile.flush()
                last_keepalive = time.monotonic()
            except (BrokenPipeError, ConnectionResetError, OSError):
                stop.set()

        # Start tailing in a background thread
        tail_thread = threading.Thread(
            target=activity_file.tail,
            args=(stop, on_event),
            daemon=True,
        )
        tail_thread.start()

        # Keep connection alive with periodic comments
        try:
            while not stop.is_set() and not self.server.shutdown_event.is_set():
                now = time.monotonic()
                if now - last_keepalive >= SSE_KEEPALIVE:
                    try:
                        self.wfile.write(b": keepalive\n\n")
                        self.wfile.flush()
                        last_keepalive = now
                    except (BrokenPipeError, ConnectionResetError, OSError):
                        break
                stop.wait(1.0)
        finally:
            stop.set()
            tail_thread.join(timeout=2.0)


# ---------------------------------------------------------------------------
# Server with graceful shutdown
# ---------------------------------------------------------------------------

class DashboardServer(ThreadingMixIn, HTTPServer):
    """Threaded HTTPServer that carries shared state and supports clean shutdown."""
    daemon_threads = True

    allow_reuse_address = True

    def __init__(self, server_address, handler_class, agents, project_dir):
        super().__init__(server_address, handler_class)
        self.agents = agents
        self.project_dir = project_dir
        self.vault_dir = Path.home() / ".claude" / "vault"
        self.shutdown_event = threading.Event()


def find_free_port(preferred=0):
    """Find a free port. If preferred is 0, let the OS choose."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(("127.0.0.1", preferred))
        return s.getsockname()[1]


def main():
    args = parse_args()

    project_dir = Path(args.project_dir).resolve()
    activity_path = project_dir / ".claude" / "team" / "activity.jsonl"

    # Ensure the activity directory exists
    activity_path.parent.mkdir(parents=True, exist_ok=True)

    agents = load_agents()

    port = find_free_port(args.port)

    server = DashboardServer(
        ("127.0.0.1", port),
        DashboardHandler,
        agents,
        project_dir,
    )

    # Graceful shutdown on SIGINT / SIGTERM
    def handle_signal(signum, frame):
        sys.stderr.write("\nShutting down dashboard...\n")
        server.shutdown_event.set()
        # Run shutdown in a thread to avoid deadlock
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    url = f"http://127.0.0.1:{port}"
    print(f"brains-in-a-hat dashboard: {url}")
    print(f"Activity file: {activity_path}")
    print(f"Agents loaded: {len(agents)}")
    sys.stdout.flush()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print("Dashboard stopped.")


if __name__ == "__main__":
    main()
