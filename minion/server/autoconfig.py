"""Auto-configuration: detect VRAM, select optimal model+quant+KV config.

Selection logic accounts for:
  - What's actually cached locally (no surprise multi-GB downloads)
  - KV cache memory at the target context length
  - A safety margin so the system doesn't OOM

Usage:
    vram = detect_vram()
    config = select_config("code", vram)
    manager = ServerManager(config)
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from .manager import ServerConfig
from .models import QuantVariant, load_registry


class GpuBusyError(RuntimeError):
    """Raised when GPU contention makes spawning unsafe."""


# ---------------------------------------------------------------------------
# GPU detection
# ---------------------------------------------------------------------------

def detect_vram() -> int:
    """Return free VRAM in MiB for GPU 0, or 0 if nvidia-smi unavailable."""
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.free", "--format=csv,noheader,nounits"],
            text=True, stderr=subprocess.DEVNULL,
        )
        line = out.strip().splitlines()[0].strip()
        return int(line)
    except Exception:
        return 0


def detect_total_vram() -> int:
    """Return total VRAM in MiB for GPU 0."""
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            text=True, stderr=subprocess.DEVNULL,
        )
        return int(out.strip().splitlines()[0].strip())
    except Exception:
        return 0


def check_gpu_contention() -> None:
    """Raise GpuBusyError if GPU is under heavy load.

    Checks GPU 0 via nvidia-smi. Raises if:
      - VRAM usage > 50% of total
      - GPU utilization > 80%

    Does nothing (no error) if nvidia-smi is unavailable.
    """
    try:
        out = subprocess.check_output(
            [
                "nvidia-smi",
                "--query-gpu=memory.used,memory.total,utilization.gpu",
                "--format=csv,noheader,nounits",
            ],
            text=True, stderr=subprocess.DEVNULL,
        )
        line = out.strip().splitlines()[0]
        parts = [p.strip() for p in line.split(",")]
        mem_used, mem_total, util = int(parts[0]), int(parts[1]), int(parts[2])
    except Exception:
        return  # Can't determine — allow spawn

    vram_pct = mem_used / mem_total if mem_total > 0 else 0.0
    if vram_pct > 0.5:
        raise GpuBusyError(
            f"GPU VRAM {vram_pct:.0%} used ({mem_used}/{mem_total} MiB) — "
            "training run likely in progress"
        )
    if util > 80:
        raise GpuBusyError(
            f"GPU utilization at {util}% — busy with another workload"
        )


# ---------------------------------------------------------------------------
# KV cache estimation
# ---------------------------------------------------------------------------

# Model dimensions for KV cache size estimation.
# KV cache per token = 2 (K+V) * n_layers * d_head * n_kv_heads * dtype_bytes
# For MoE models, attention layers use same KV structure as dense models.
_MODEL_KV_PARAMS: dict[str, tuple[int, int, int]] = {
    # (n_layers, n_kv_heads, d_head)
    "devstral":    (40, 8, 128),   # Mistral-based, GQA 8 KV heads
    "qwen35":      (36, 4, 128),   # Qwen 3.5 27B, GQA 4 KV heads
    "gemma4-26b":  (34, 4, 256),   # Gemma 4 26B MoE
    "gemma4-31b":  (36, 8, 128),   # Gemma 4 31B dense
}

KV_DTYPE_BYTES: dict[str, float] = {
    "bf16": 2.0,
    "f16": 2.0,
    "q8_0": 1.1,  # ~1.1 bytes effective with quantization overhead
    "q4_0": 0.6,
}


def estimate_kv_cache_mib(
    model_id: str,
    context: int,
    kv_type: str = "bf16",
) -> float:
    """Estimate KV cache VRAM in MiB for a given model, context, and KV dtype."""
    if model_id not in _MODEL_KV_PARAMS:
        # Conservative fallback: assume large model
        return context * 0.5 / 1024  # ~0.5 MB per 1K tokens
    n_layers, n_kv_heads, d_head = _MODEL_KV_PARAMS[model_id]
    dtype_bytes = KV_DTYPE_BYTES.get(kv_type, 2.0)
    # 2 for K+V tensors
    bytes_total = 2 * n_layers * n_kv_heads * d_head * context * dtype_bytes
    return bytes_total / (1024 * 1024)


# ---------------------------------------------------------------------------
# Model selection
# ---------------------------------------------------------------------------

def is_cached(quant: QuantVariant) -> bool:
    """Check if this quant variant is available locally (no download needed)."""
    # Check explicit local path
    if Path(quant.local_path).exists():
        return True
    # Check llama.cpp cache convention
    llama_cache = (
        Path.home() / ".cache" / "llama.cpp"
    )
    if llama_cache.exists():
        # Check for any file matching the HF filename
        for f in llama_cache.iterdir():
            if f.name == quant.hf_file:
                return True
    return False


def max_context_for_budget(
    model_id: str,
    vram_budget_mib: float,
    kv_type: str = "bf16",
) -> int:
    """Given leftover VRAM after loading the model, compute max context tokens."""
    if model_id not in _MODEL_KV_PARAMS or vram_budget_mib <= 0:
        return 0
    n_layers, n_kv_heads, d_head = _MODEL_KV_PARAMS[model_id]
    dtype_bytes = KV_DTYPE_BYTES.get(kv_type, 2.0)
    bytes_per_token = 2 * n_layers * n_kv_heads * d_head * dtype_bytes
    mib_per_token = bytes_per_token / (1024 * 1024)
    if mib_per_token <= 0:
        return 0
    return int(vram_budget_mib / mib_per_token)


def list_candidates(
    vram_mib: int,
    context: int = 98304,
    kv_type: str = "q8_0",
    require_cached: bool = True,
    safety_margin_mib: int = 512,
) -> list[dict]:
    """Return all model+quant combos ranked by quality, with fit info.

    "fits" means the model can load and serve at least 8k context (the auto-fit
    minimum). KV estimates are shown at the requested context for planning, but
    auto-mode grows dynamically so the real constraint is model + minimum KV.

    Each entry includes max_context — the largest context the VRAM can support.
    """
    registry = load_registry()
    candidates = []
    # Minimum useful context for "fits" check (matches -fitc 8192 in auto mode)
    min_context = 8192

    for model in registry.values():
        kv_mib_target = estimate_kv_cache_mib(model.id, context, kv_type)
        kv_mib_min = estimate_kv_cache_mib(model.id, min_context, kv_type)
        for quant in model.quants:
            model_mib = quant.size_gb * 1024
            cached = is_cached(quant)

            # Standard mode: full model + KV on GPU
            min_total = model_mib + kv_mib_min + safety_margin_mib
            target_total = model_mib + kv_mib_target + safety_margin_mib
            fits = min_total <= vram_mib
            headroom_for_kv = vram_mib - model_mib - safety_margin_mib
            max_ctx = max_context_for_budget(model.id, headroom_for_kv, kv_type)
            candidates.append({
                "model": model,
                "quant": quant,
                "cached": cached,
                "model_mib": model_mib,
                "kv_mib": kv_mib_target,
                "total_mib": target_total,
                "fits": fits,
                "headroom_mib": vram_mib - target_total,
                "max_context": max_ctx,
                "cpu_moe": False,
            })

            # MoE models get a second candidate with --cpu-moe:
            # Expert weights on CPU, only attention + KV on GPU.
            # Rough estimate: attention params ~30% of total for MoE models.
            if model.is_moe:
                attn_mib = model_mib * 0.30  # attention layers ~30% of weights
                min_total_moe = attn_mib + kv_mib_min + safety_margin_mib
                target_total_moe = attn_mib + kv_mib_target + safety_margin_mib
                fits_moe = min_total_moe <= vram_mib
                headroom_moe = vram_mib - attn_mib - safety_margin_mib
                max_ctx_moe = max_context_for_budget(model.id, headroom_moe, kv_type)
                candidates.append({
                    "model": model,
                    "quant": quant,
                    "cached": cached,
                    "model_mib": attn_mib,
                    "kv_mib": kv_mib_target,
                    "total_mib": target_total_moe,
                    "fits": fits_moe,
                    "headroom_mib": vram_mib - target_total_moe,
                    "max_context": max_ctx_moe,
                    "cpu_moe": True,
                })

    # Sort: cached+fits first, then by largest quant (higher quality)
    def sort_key(c: dict) -> tuple:
        return (
            c["cached"] if require_cached else True,
            c["fits"],
            c["quant"].size_gb,
        )

    candidates.sort(key=sort_key, reverse=True)
    return candidates


def select_config(
    task_type: str = "code",
    vram_mib: int = 0,
    port: int = 8000,
    context: int = 98304,
    kv_type: str = "q8_0",
    model_id: str | None = None,
    quant_id: str | None = None,
) -> ServerConfig:
    """Pick best model+quant+KV tier for available VRAM.

    Selection priority:
      1. If model_id/quant_id specified, use those (explicit override)
      2. Otherwise, pick the best cached quant that fits in VRAM
      3. Account for KV cache overhead at the target context length
      4. Never pick a quant that isn't locally cached (avoid download timeouts)
    """
    registry = load_registry()

    # Explicit override
    if model_id and quant_id:
        model = registry[model_id]
        quant = next(q for q in model.quants if q.id == quant_id)
        return ServerConfig(
            model=model, quant=quant, kv_type=kv_type,
            gpu_only=True, context=str(context) if context != 32768 else "auto",
            flash="on", cuda="on", cpu_moe="off", port=port,
        )

    # Auto-select: best cached quant that fits
    # For task_type "code", prefer devstral; for others, consider all models
    candidates = list_candidates(vram_mib, context, kv_type)

    # Filter to coding models for "code" task type
    if task_type == "code":
        code_candidates = [c for c in candidates if c["model"].id == "devstral"]
        if code_candidates:
            candidates = code_candidates

    # Pick first candidate that is cached and fits
    for c in candidates:
        if c["cached"] and c["fits"]:
            model = c["model"]
            quant = c["quant"]
            use_cpu_moe = c.get("cpu_moe", False)
            return ServerConfig(
                model=model, quant=quant, kv_type=kv_type,
                gpu_only=not use_cpu_moe,
                context=str(context) if context != 32768 else "auto",
                flash="on", cuda="on",
                cpu_moe="on" if use_cpu_moe else "off",
                port=port,
            )

    # Fallback: pick largest cached quant even if tight on VRAM
    for c in candidates:
        if c["cached"]:
            model = c["model"]
            quant = c["quant"]
            use_cpu_moe = c.get("cpu_moe", False)
            return ServerConfig(
                model=model, quant=quant, kv_type=kv_type,
                gpu_only=not use_cpu_moe,
                context=str(context) if context != 32768 else "auto",
                flash="on", cuda="on",
                cpu_moe="on" if use_cpu_moe else "off",
                port=port,
            )

    # Last resort: pick default devstral Q4_K_M (will download if needed)
    devstral = registry["devstral"]
    quant = next(q for q in devstral.quants if q.id == "Q4_K_M")
    return ServerConfig(
        model=devstral, quant=quant, kv_type=kv_type,
        gpu_only=True, context="auto", flash="on", cuda="on",
        cpu_moe="off", port=port,
    )
