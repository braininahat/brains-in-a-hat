import { readFile } from "fs/promises";
import { resolve } from "path";
import { NextRequest } from "next/server";

/**
 * Serves Grant's HTML artifacts from .claude/grant/ in the project directory.
 *
 * GET /api/artifact?path=.claude/grant/auth-flow.html
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");

  if (!path || !path.startsWith(".claude/grant/") || !path.endsWith(".html")) {
    return new Response("Invalid artifact path", { status: 400 });
  }

  // Resolve relative to cwd (project root)
  const fullPath = resolve(process.cwd(), path);

  // Ensure we're not escaping the project directory
  if (!fullPath.startsWith(resolve(process.cwd()))) {
    return new Response("Path traversal denied", { status: 403 });
  }

  try {
    const html = await readFile(fullPath, "utf-8");
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new Response("Artifact not found", { status: 404 });
  }
}
