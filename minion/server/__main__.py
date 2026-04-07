#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["textual>=3.0", "httpx"]
# ///
"""Devstral Server TUI — start, monitor, and manage the local LLM server.

Launch:
    uv run python -m server          # from minion/
    uv run minion/server/__main__.py  # from repo root

Keys:
    s  Start server with selected config
    k  Kill running server
    r  Refresh GPU/server status
    q  Quit
"""

from __future__ import annotations

import asyncio
import subprocess
import sys
from pathlib import Path

from textual import work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.reactive import reactive
from textual.widgets import DataTable, Footer, Header, Label, Static

# Ensure server package is importable
_HERE = Path(__file__).resolve().parent
if str(_HERE.parent) not in sys.path:
    sys.path.insert(0, str(_HERE.parent))

from server.autoconfig import (
    GpuBusyError,
    check_gpu_contention,
    detect_total_vram,
    detect_vram,
    estimate_kv_cache_mib,
    list_candidates,
    select_config,
)
from server.manager import ServerConfig, ServerManager


class StatusPanel(Static):
    """Shows GPU and server status."""

    server_status = reactive("Unknown")
    vram_free = reactive(0)
    vram_total = reactive(0)
    model_name = reactive("—")
    context_size = reactive("—")

    def render(self) -> str:
        if self.vram_total > 0:
            pct = (self.vram_total - self.vram_free) / self.vram_total * 100
            vram_bar_width = 30
            filled = int(pct / 100 * vram_bar_width)
            bar = "█" * filled + "░" * (vram_bar_width - filled)
            vram_line = f"  VRAM: [{bar}] {self.vram_free}/{self.vram_total} MiB free ({pct:.0f}% used)"
        else:
            vram_line = "  VRAM: unavailable (no nvidia-smi)"

        if self.server_status == "running":
            status_icon = "[green]● Running[/green]"
        elif self.server_status == "starting":
            status_icon = "[yellow]◌ Starting...[/yellow]"
        else:
            status_icon = "[red]○ Stopped[/red]"

        return (
            f"  Server: {status_icon}\n"
            f"  Model:  {self.model_name}\n"
            f"  Context: {self.context_size}\n"
            f"{vram_line}"
        )


class ServerTUI(App):
    """Devstral server manager TUI."""

    CSS = """
    Screen {
        layout: vertical;
    }
    #status-panel {
        height: auto;
        min-height: 6;
        border: solid $accent;
        margin: 1 2;
        padding: 1;
    }
    #config-table {
        height: 1fr;
        margin: 0 2;
        border: solid $primary;
    }
    #log-panel {
        height: 8;
        margin: 1 2;
        border: solid $secondary;
        padding: 0 1;
        overflow-y: auto;
    }
    .panel-title {
        text-style: bold;
        margin: 0 2;
        color: $text;
    }
    """

    TITLE = "Devstral Server Manager"
    BINDINGS = [
        Binding("s", "start_server", "Start", priority=True),
        Binding("k", "kill_server", "Kill", priority=True),
        Binding("r", "refresh", "Refresh", priority=True),
        Binding("q", "quit", "Quit", priority=True),
    ]

    selected_row: int = 0
    manager: ServerManager | None = None

    def compose(self) -> ComposeResult:
        yield Header()
        yield Label(" GPU & Server Status", classes="panel-title")
        yield StatusPanel(id="status-panel")
        yield Label(" Available Configurations  (↑↓ to select, s to start)", classes="panel-title")
        yield DataTable(id="config-table", cursor_type="row")
        yield Label(" Log", classes="panel-title")
        yield Static("Ready.", id="log-panel")
        yield Footer()

    def on_mount(self) -> None:
        table = self.query_one("#config-table", DataTable)
        table.add_columns(
            "Model", "Quant", "GPU VRAM", "KV@32k", "Total",
            "Cached", "Fits", "Max Ctx", "MoE→CPU",
        )
        self.refresh_all()

    _log_lines: list[str] = []

    def log_message(self, msg: str) -> None:
        panel = self.query_one("#log-panel", Static)
        self._log_lines.append(msg)
        if len(self._log_lines) > 20:
            self._log_lines = self._log_lines[-20:]
        panel.update("\n".join(self._log_lines))

    @work(thread=True)
    def refresh_all(self) -> None:
        """Refresh GPU status, server health, and config table."""
        vram_free = detect_vram()
        vram_total = detect_total_vram()

        status_panel = self.query_one("#status-panel", StatusPanel)
        status_panel.vram_free = vram_free
        status_panel.vram_total = vram_total

        # Check server health
        try:
            import httpx as _httpx
            r = _httpx.get("http://localhost:8000/health", timeout=2.0)
            if r.status_code == 200:
                status_panel.server_status = "running"
                try:
                    props = _httpx.get("http://localhost:8000/props", timeout=3.0)
                    data = props.json()
                    gen = data.get("default_generation_settings", {})
                    n_ctx = gen.get("n_ctx", "?")
                    status_panel.context_size = f"{n_ctx} tokens"
                    # Try to get model name from props
                    model_name = data.get("model", "Unknown")
                    status_panel.model_name = model_name
                except Exception:
                    status_panel.context_size = "?"
            else:
                status_panel.server_status = "stopped"
                status_panel.model_name = "—"
                status_panel.context_size = "—"
        except Exception:
            status_panel.server_status = "stopped"
            status_panel.model_name = "—"
            status_panel.context_size = "—"

        # Populate config table
        candidates = list_candidates(vram_free, context=32768, kv_type="bf16")
        self.call_from_thread(self._update_table, candidates)

    def _update_table(self, candidates: list[dict]) -> None:
        table = self.query_one("#config-table", DataTable)
        table.clear()
        for c in candidates:
            cached_str = "✓" if c["cached"] else "✗"
            fits_str = "✓" if c["fits"] else "✗"
            cpu_moe_str = "✓" if c.get("cpu_moe") else ""
            max_ctx = c.get("max_context", 0)
            max_ctx_str = f"{max_ctx // 1024}k" if max_ctx >= 1024 else str(max_ctx)
            table.add_row(
                c["model"].name,
                c["quant"].id,
                f"{c['model_mib']:.0f} MiB",
                f"{c['kv_mib']:.0f} MiB",
                f"{c['total_mib']:.0f} MiB",
                cached_str,
                fits_str,
                max_ctx_str,
                cpu_moe_str,
            )

    def action_refresh(self) -> None:
        self.log_message("Refreshing...")
        self.refresh_all()

    @work(thread=True)
    def action_start_server(self) -> None:
        status_panel = self.query_one("#status-panel", StatusPanel)
        if status_panel.server_status == "running":
            self.call_from_thread(self.log_message, "Server already running.")
            return

        try:
            check_gpu_contention()
        except GpuBusyError as e:
            self.call_from_thread(self.log_message, f"GPU busy: {e}")
            return

        status_panel.server_status = "starting"
        vram = detect_vram()

        # Get selected row from table
        table = self.query_one("#config-table", DataTable)
        cursor_row = table.cursor_row
        candidates = list_candidates(vram, context=32768, kv_type="bf16")

        if cursor_row is not None and 0 <= cursor_row < len(candidates):
            selected = candidates[cursor_row]
            if not selected["cached"]:
                self.call_from_thread(
                    self.log_message,
                    f"⚠ {selected['model'].name} {selected['quant'].id} not cached locally — would need download. Select a cached config.",
                )
                status_panel.server_status = "stopped"
                return
            use_cpu_moe = selected.get("cpu_moe", False)
            config = select_config(
                "code", vram, port=8000,
                model_id=selected["model"].id,
                quant_id=selected["quant"].id,
            )
            if use_cpu_moe:
                config = ServerConfig(
                    model=config.model, quant=config.quant, kv_type=config.kv_type,
                    gpu_only=False, context=config.context, flash=config.flash,
                    cuda=config.cuda, cpu_moe="on", port=config.port,
                )
        else:
            config = select_config("code", vram, port=8000)

        self.call_from_thread(
            self.log_message,
            f"Starting {config.model.name} {config.quant.id} (KV: {config.kv_type})...",
        )

        self.manager = ServerManager(config)
        in_use, pid = self.manager.check_port()
        if in_use:
            self.call_from_thread(
                self.log_message,
                f"Port 8000 already in use (PID {pid}). Kill first.",
            )
            status_panel.server_status = "stopped"
            return

        self.manager.spawn()

        # Wait for healthy in a thread-safe way
        try:
            n_ctx = asyncio.run(self.manager.wait_healthy(timeout=120.0))
            status_panel.server_status = "running"
            status_panel.model_name = f"{config.model.name} {config.quant.id}"
            status_panel.context_size = f"{n_ctx} tokens"
            kv_est = estimate_kv_cache_mib(config.model.id, 32768, config.kv_type)
            self.call_from_thread(
                self.log_message,
                f"✓ Server ready — {config.model.name} {config.quant.id} | "
                f"ctx={n_ctx} | KV ~{kv_est:.0f} MiB",
            )
        except TimeoutError:
            self.manager.shutdown()
            status_panel.server_status = "stopped"
            self.call_from_thread(self.log_message, "✗ Server failed to start within 120s.")

    @work(thread=True)
    def action_kill_server(self) -> None:
        status_panel = self.query_one("#status-panel", StatusPanel)

        if self.manager:
            self.manager.shutdown()
            self.manager = None

        # Also kill any orphaned llama-server processes
        try:
            subprocess.run(["pkill", "-f", "llama-server"], capture_output=True)
        except Exception:
            pass

        status_panel.server_status = "stopped"
        status_panel.model_name = "—"
        status_panel.context_size = "—"
        self.call_from_thread(self.log_message, "Server killed.")
        self.refresh_all()


def main() -> None:
    app = ServerTUI()
    app.run()


if __name__ == "__main__":
    main()
