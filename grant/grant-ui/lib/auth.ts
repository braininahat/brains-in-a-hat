import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

/**
 * Read Claude CLI's OAuth token — no API key needed.
 */
export function getAuthToken(): string {
  const credPath = join(homedir(), ".claude", ".credentials.json");
  const creds = JSON.parse(readFileSync(credPath, "utf-8"));
  const token = creds.claudeAiOauth?.accessToken;
  if (!token) throw new Error("No OAuth token. Run 'claude login' first.");
  return token;
}
