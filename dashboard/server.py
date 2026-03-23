#!/usr/bin/env python3
"""
brains-in-a-hat: Live Agent Activity Dashboard Server

Python stdlib-only HTTP server that:
- Serves dashboard/index.html on localhost (auto-selected port)
- SSE endpoint /events that tails activity.jsonl and streams new events
- REST endpoint /api/activity that returns all events
- REST endpoint /api/agents that returns agent metadata from agents/ directory
- Graceful shutdown on SIGINT

Usage:
    python dashboard/server.py [--project-dir /path/to/project]

The --project-dir flag specifies where .claude/team/activity.jsonl lives.
If omitted, defaults to the current working directory.
"""

import argparse
import json
import os
import signal
import socket
import sys
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

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
        if self.path == "/" or self.path == "/index.html":
            self._serve_index()
        elif self.path == "/events":
            self._serve_sse()
        elif self.path == "/api/activity":
            self._serve_activity()
        elif self.path == "/api/agents":
            self._serve_agents()
        else:
            self.send_error(404)

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

    def _serve_activity(self):
        activity_file = self.server.activity_file
        events = activity_file.read_all()
        self._send_json(events)

    def _serve_agents(self):
        self._send_json(self.server.agents)

    def _serve_sse(self):
        """Stream new events as SSE (Server-Sent Events).

        Each event is sent as:
            data: {"ts": ..., "agent": ..., ...}

        A keepalive comment is sent every SSE_KEEPALIVE seconds to prevent
        proxy/browser timeouts.
        """
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self._send_cors_headers()
        self.end_headers()

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
            target=self.server.activity_file.tail,
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

class DashboardServer(HTTPServer):
    """HTTPServer subclass that carries shared state and supports clean shutdown."""

    allow_reuse_address = True

    def __init__(self, server_address, handler_class, activity_file, agents):
        super().__init__(server_address, handler_class)
        self.activity_file = activity_file
        self.agents = agents
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

    activity_file = ActivityFile(activity_path)
    agents = load_agents()

    port = find_free_port(args.port)

    server = DashboardServer(
        ("127.0.0.1", port),
        DashboardHandler,
        activity_file,
        agents,
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
