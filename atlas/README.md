# atlas

A Claude Code **mod** that keeps a map of the work beside the transcript, so long sessions keep their way back to the top-level plan.

- **Plan tree with a focus path.** Steps can grow sub-steps and detours; finishing one rolls up to its parent. The band above the prompt shows the breadcrumb (`▶ 3 Training › 3.2 Learning-rate sweep`), pinned facts and parked items.
- **Watchdog.** After every turn a small model (Haiku) files the turn into the tree and refreshes a recap (where we are, what was learned, what is next). When work drifts, the band offers **Return**, **Keep going** and **Park**. `/atlas recap` runs a deeper recap on Sonnet.
- **Pane** (`/atlas`): a route picture of the plan, Now and Recap cards, the plan tree, parked tangents, facts, pipeline stages with iris thumbnails (marked *Seen* once Claude has read the render), glossary and trail.
- **Cold start.** In a project with history, `/atlas init` (or **Build map** in the band) asks the session's Claude to build the map from the conversation and the repository.
- Maps are stored per project folder and survive restarts. `/atlas project <path>` shows another project's map.

**Needs:** Claude Code ≥ 2.1.287, the iris mod, ImageMagick for the route picture.
