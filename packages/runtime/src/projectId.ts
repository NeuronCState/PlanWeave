import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import { basename } from "node:path";

export function projectSlug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "project";
}

export async function createProjectId(projectRoot: string): Promise<string> {
  const rootPath = await realpath(projectRoot);
  const shortHash = createHash("sha256").update(rootPath).digest("hex").slice(0, 8);
  return `${projectSlug(basename(rootPath))}-${shortHash}`;
}

export function createManagedProjectId(name: string): string {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Managed project name must not be empty.");
  }
  const shortHash = createHash("sha256").update(`managed:${trimmedName}`).digest("hex").slice(0, 8);
  return `${projectSlug(trimmedName)}-${shortHash}`;
}
