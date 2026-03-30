import { createClaudeCode } from "ai-sdk-provider-claude-code";

/**
 * Claude Code provider instance.
 *
 * Uses the CLI's existing OAuth auth — no API key needed locally.
 * The CLI discovers plugins from the project's .claude-plugin/ directory
 * when cwd points to the project root.
 */
export const claudeCode = createClaudeCode({
  defaultSettings: {
    // Grant needs tool access for repo analysis
    permissionMode: "bypassPermissions",
    // Cap agentic turns to prevent runaway
    maxTurns: 20,
  },
});
