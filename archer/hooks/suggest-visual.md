---
event: PostToolUse
tool: Write
---

Check if the file just written is a model definition or training config that would benefit from visualization:

**Diagram triggers** — if the file matches ANY of these, briefly suggest a diagram:
- Python file containing `nn.Module`, `LightningModule`, `class.*Encoder`, `class.*Decoder`, `class.*Model`
- YAML file containing `encoder`, `decoder`, `batch_size`, `max_epochs`, `head_type`
- Python file with new `forward()` method or architecture class

If triggered, append ONE line to the response:
> Architecture changed. Run `/archer:diagram` to visualize, or `/archer:render-figures` to update all figures.

**Report triggers** — if the file matches ANY of these, suggest a report:
- JSON file containing `per`, `accuracy`, `loss`, `bootstrap`, `ci`
- Log file containing `Best model:`, `val/loss`, `Epoch`, `wandb`
- Multiple result files written in the same session

If triggered, append ONE line:
> New results available. Run `typst compile` on your report to include updated metrics.

**Rules:**
- Never auto-generate diagrams or reports without user confirmation
- Suggest at most once per file write (don't repeat for the same file)
- Keep suggestions to exactly one line
- Do NOT suggest for test files, configs unrelated to ML, or documentation
