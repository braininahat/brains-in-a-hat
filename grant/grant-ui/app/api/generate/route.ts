import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { catalog } from "@/lib/catalog";
import { getAuthToken } from "@/lib/auth";

export const maxDuration = 120;

const provider = createAnthropic({
  apiKey: getAuthToken(),
});

export async function POST(req: Request) {
  const { prompt, context } = await req.json();

  const result = streamText({
    model: provider("claude-haiku-4-5-20251001"),
    system: catalog.prompt({ mode: "standalone" }),
    prompt: context
      ? `${prompt}\n\nContext:\n${JSON.stringify(context)}`
      : prompt,
  });

  return result.toTextStreamResponse();
}
