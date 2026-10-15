export type AtlasStepStatus = 'todo' | 'doing' | 'done' | 'dropped'

/** One step of the plan; any step can open its own sub-plan. */
export type AtlasNode = {
  id: string
  title: string
  status: AtlasStepStatus
  outcome?: string
  /** A detour is work that left its parent step's path, filed under it. */
  kind?: 'detour'
  why?: string
  children: AtlasNode[]
}

export type AtlasFact = { value: string; changedAt: number; was?: string }

export type AtlasStage = {
  name: string
  in?: string
  out?: string
  /** iris figure number showing a sample of this stage's output. */
  figure?: number
  note?: string
}

export type AtlasTrailKind = 'done' | 'decision' | 'deadend' | 'note' | 'checkpoint'

export type AtlasTrailItem = { t: number; kind: AtlasTrailKind; text: string }

export type AtlasResearch = { t: number; tool: string; query: string; summary: string }

export type AtlasParked = { t: number; text: string; from: string }

export type AtlasRecap = { t: number; where: string; learned: string; next: string; by: string }

export type AtlasDrift = { since: number; note: string; nodeId: string }

export type AtlasMap = {
  goal: string
  /** The top level of the plan. */
  plan: AtlasNode[]
  /** Node ids from the top level down to the step in focus; empty when none. */
  focus: string[]
  nextId: number
  facts: Record<string, AtlasFact>
  /** Fact keys shown in the band above the prompt. */
  pinned: string[]
  glossary: Record<string, string>
  stages: AtlasStage[]
  trail: AtlasTrailItem[]
  research: AtlasResearch[]
  parked: AtlasParked[]
  recap: AtlasRecap | null
  drift: AtlasDrift | null
  /** Node ids the user chose to keep working in despite a drift note. */
  keepGoing: string[]
}

export type AtlasTab = 'map' | 'pipeline' | 'glossary' | 'trail'

declare module 'claude-code' {
  interface PluginState {
    atlas: {
      map: AtlasMap
      /** Edits and commands since the last atlas_update. */
      changes: number
      isStale: boolean
      tab: AtlasTab
      /** iris figure numbers whose PNG Claude has read this session. */
      seen: number[]
      /** True while the watchdog is reading the last turn. */
      isWatching: boolean
      /** The person chose "Not now" on the empty-map band this session. */
      isInitDismissed: boolean
    }
  }
}
