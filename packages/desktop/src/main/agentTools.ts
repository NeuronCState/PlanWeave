import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DesktopAgentCliProfile, DesktopAgentDetection } from "@planweave/runtime";

const execFileAsync = promisify(execFile);

const agentProfiles: DesktopAgentCliProfile[] = [
  {
    kind: "codex",
    name: "Codex",
    command: "codex",
    versionArgs: ["--version"],
    execArgs: ["exec", "-"],
    fullAccessArgs: ["exec", "--sandbox", "danger-full-access", "-"]
  },
  {
    kind: "claude-code",
    name: "Claude Code",
    command: "claude",
    versionArgs: ["--version"],
    execArgs: ["-p"],
    fullAccessArgs: ["--dangerously-skip-permissions", "-p"]
  },
  {
    kind: "opencode",
    name: "OpenCode",
    command: "opencode",
    versionArgs: ["--version"],
    execArgs: ["run", "-"],
    fullAccessArgs: ["run", "--permission", "full-access", "-"]
  }
];

async function detectAgent(profile: DesktopAgentCliProfile): Promise<DesktopAgentDetection> {
  try {
    const { stdout, stderr } = await execFileAsync(profile.command, profile.versionArgs, {
      timeout: 2_000,
      maxBuffer: 64 * 1024
    });
    const version = `${stdout}${stderr}`.trim().split(/\r?\n/)[0] ?? "";
    return {
      ...profile,
      installed: true,
      version: version || null,
      unavailableReason: null
    };
  } catch (caught) {
    return {
      ...profile,
      installed: false,
      version: null,
      unavailableReason: caught instanceof Error ? caught.message : String(caught)
    };
  }
}

export async function detectAgentTools(): Promise<DesktopAgentDetection[]> {
  return Promise.all(agentProfiles.map(detectAgent));
}
