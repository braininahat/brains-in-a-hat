"""Auto-configuration: detect VRAM, select optimal model+quant+KV config.

Usage:
    vram = detect_vram()
    config = select_config("code", vram)
    manager = ServerManager(config)
"""

from __future__ import annotations

import subprocess

from .manager import ServerConfig
from .models import MODEL_INDEX


def detect_vram() -> int:
    """Return free VRAM in MiB for GPU 0, or 0 if nvidia-smi unavailable."""
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.free", "--format=csv,noheader,nounits"],
            text=True, stderr=subprocess.DEVNULL,
        )
        # First line = GPU 0
        line = out.strip().splitlines()[0].strip()
        return int(line)
    except Exception:
        return 0


def select_config(task_type: str = "code", vram_mib: int = 0, port: int = 8000) -> ServerConfig:
    """Pick best model+quant+KV tier for available VRAM.

    task_type is reserved for future routing (e.g. "code" vs "chat").
    Currently always selects Devstral as it's the coding-optimised model.

    VRAM tiers:
      > 20480 MiB (~20 GB free): Devstral Q5_K_XL + bf16 KV
      default (any 24GB GPU):    Devstral Q4_K_XL + bf16 KV
    """
    devstral = MODEL_INDEX["devstral"]

    # Select quant based on free VRAM headroom
    # Q5_K_XL is ~20 GB; leave ~4 GB for KV cache overhead
    if vram_mib > 20480:
        quant = next(q for q in devstral.quants if q.id == "Q5_K_XL")
    else:
        quant = next(q for q in devstral.quants if q.id == "Q4_K_XL")

    return ServerConfig(
        model=devstral,
        quant=quant,
        kv_type="bf16",   # Native on Ada Lovelace (RTX 4090)
        gpu_only=True,
        context="auto",
        flash="on",
        cuda="on",
        cpu_moe="off",
        port=port,
    )
