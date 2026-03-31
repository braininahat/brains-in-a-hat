import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { z } from "zod";

// Read Claude CLI's OAuth token — no API key needed
function getAuthToken(): string {
  const credPath = join(homedir(), ".claude", ".credentials.json");
  const creds = JSON.parse(readFileSync(credPath, "utf-8"));
  const token = creds.claudeAiOauth?.accessToken;
  if (!token) throw new Error("No OAuth token found. Run 'claude login' first.");
  return token;
}

const anthropic = new Anthropic({
  apiKey: getAuthToken(),
});

const GRANT_PROMPT = `You are Grant, a visual-first communicator. Named after Grant Sanderson (3Blue1Brown).

You answer questions by creating beautiful, interactive HTML visualizations. Produce a SINGLE self-contained HTML file that makes the answer self-evident through visuals.

## What "visual" means

Pick the right form for each question:

- Architecture → interactive node graph, animated flow diagram
- Comparison → side-by-side layout with linked highlighting
- Timeline → horizontal timeline with expandable events
- Explanation → step-by-step animated walkthrough
- Status/overview → dashboard with meaningful metrics
- Code flow → animated sequence showing data through functions

## HTML quality bar

Your HTML must look DESIGNED, not generated:

- Beautiful typography (load Google Fonts via CDN if it helps)
- Thoughtful color palette — not random, not all gray
- Generous whitespace, clear visual hierarchy
- Smooth CSS animations where they aid understanding
- Dark background (#1b1b2f range) works well
- Interactive where it adds value (hover, click, expand)
- All CSS/JS inline, libraries via CDN only

## Output format

Return ONLY the complete HTML document. No markdown, no explanation, no code fences. Just the raw HTML starting with <!DOCTYPE html>.`;

const server = new McpServer({
  name: "grant",
  version: "0.1.0",
});

server.tool(
  "visualize",
  "Generate an interactive HTML visualization for any question or concept. Returns self-contained HTML that can be opened in a browser. Use this when a visual explanation would be clearer than text.",
  {
    question: z.string().describe("The question or concept to visualize"),
    context: z
      .string()
      .optional()
      .describe(
        "Optional additional context — code snippets, file contents, data to include in the visualization"
      ),
  },
  async ({ question, context }) => {
    const userMessage = context
      ? `${question}\n\nContext:\n${context}`
      : question;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      system: GRANT_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const html = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      content: [{ type: "text", text: html }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
