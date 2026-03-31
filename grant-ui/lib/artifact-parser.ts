/**
 * Detect and extract HTML artifacts from Grant's output.
 *
 * Grant wraps artifacts in fenced code blocks:
 *   ```html_artifact title="Auth Flow"
 *   <!DOCTYPE html>...
 *   ```
 *
 * This parser splits a message into segments: text and inline artifacts.
 */

export interface ArtifactRef {
  type: "artifact";
  html: string;
  title: string;
}

export interface TextSegment {
  type: "text";
  content: string;
}

export type MessageSegment = ArtifactRef | TextSegment;

const ARTIFACT_RE = /```html_artifact\s+title="([^"]+)"\n([\s\S]*?)```/g;

export function parseMessage(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(ARTIFACT_RE)) {
    const matchStart = match.index!;

    // Text before this artifact
    if (matchStart > lastIndex) {
      const text = content.slice(lastIndex, matchStart).trim();
      if (text) {
        segments.push({ type: "text", content: text });
      }
    }

    segments.push({
      type: "artifact",
      title: match[1],
      html: match[2].trim(),
    });

    lastIndex = matchStart + match[0].length;
  }

  // Trailing text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      segments.push({ type: "text", content: text });
    }
  }

  // No artifacts found — return as single text segment
  if (segments.length === 0 && content.trim()) {
    segments.push({ type: "text", content: content.trim() });
  }

  return segments;
}
