import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createTmuxSessionInfo, isTmuxAvailable, killActiveTmuxSessions, killTmuxSessionsForRun, runCommandInTmux } from "../autoRun/tmuxExecutor.js";

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

describe("tmux executor", () => {
  it("does not create a session when tmux monitoring is disabled", async () => {
    const dir = await mkdtemp(join(tmpdir(), "planweave-tmux-disabled-"));
    tempDirs.push(dir);

    await expect(
      createTmuxSessionInfo({
        runDir: dir,
        runId: "RUN-DISABLED",
        ref: "T-001#B-001",
        kind: "block",
        enabled: false
      })
    ).resolves.toBeNull();
  });

  it("runs a command inside a per-run tmux session and mirrors output to log files", async () => {
    if (!(await isTmuxAvailable())) {
      return;
    }
    const dir = await mkdtemp(join(tmpdir(), "planweave-tmux-"));
    tempDirs.push(dir);
    const tmux = await createTmuxSessionInfo({
      runDir: dir,
      runId: "RUN-001",
      ref: "T-001#B-001",
      kind: "block"
    });

    expect(tmux).toMatchObject({
      sessionName: expect.stringContaining("planweave-T-001-B-001-RUN-001"),
      readOnlyAttachCommand: expect.stringContaining("tmux attach-session -r -t")
    });

    const result = await runCommandInTmux({
      command: process.execPath,
      args: ["-e", "process.stdout.write('hello from tmux'); process.stderr.write('progress from tmux');"],
      cwd: dir,
      stdin: "",
      stdoutPath: join(dir, "stdout.md"),
      stderrPath: join(dir, "stderr.log"),
      timeoutMs: 5000,
      tmux: tmux!,
      onStdout: () => undefined,
      onStderr: () => undefined
    });

    expect(result).toMatchObject({ exitCode: 0, timedOut: false });
    await expect(readFile(join(dir, "stdout.md"), "utf8")).resolves.toBe("hello from tmux");
    await expect(readFile(join(dir, "stderr.log"), "utf8")).resolves.toBe("progress from tmux");
  });

  it("can stop an active tmux-backed command", async () => {
    if (!(await isTmuxAvailable())) {
      return;
    }
    const dir = await mkdtemp(join(tmpdir(), "planweave-tmux-stop-"));
    tempDirs.push(dir);
    const tmux = await createTmuxSessionInfo({
      runDir: dir,
      runId: "RUN-STOP",
      ref: "T-001#B-002",
      kind: "block"
    });

    const running = runCommandInTmux({
      command: process.execPath,
      args: ["-e", "setInterval(() => process.stdout.write('tick\\n'), 100);"],
      cwd: dir,
      stdin: "",
      stdoutPath: join(dir, "stdout.md"),
      stderrPath: join(dir, "stderr.log"),
      timeoutMs: 10000,
      tmux: tmux!,
      onStdout: () => undefined,
      onStderr: () => undefined
    });

    await new Promise((resolve) => setTimeout(resolve, 250));
    await expect(killActiveTmuxSessions()).resolves.toContain(tmux!.sessionName);
    await expect(running).resolves.toMatchObject({ exitCode: 130, timedOut: false });
  });

  it("kills only active tmux sessions owned by the requested run", async () => {
    if (!(await isTmuxAvailable())) {
      return;
    }
    const runADir = await mkdtemp(join(tmpdir(), "planweave-tmux-owner-a-"));
    const runBDir = await mkdtemp(join(tmpdir(), "planweave-tmux-owner-b-"));
    tempDirs.push(runADir, runBDir);
    const runATmux = await createTmuxSessionInfo({
      runDir: runADir,
      runId: "RUN-A",
      tmuxOwnerRunId: "AUTO-RUN-A",
      ref: "T-001#B-001",
      kind: "block"
    });
    const runBTmux = await createTmuxSessionInfo({
      runDir: runBDir,
      runId: "RUN-B",
      tmuxOwnerRunId: "AUTO-RUN-B",
      ref: "T-001#B-002",
      kind: "block"
    });

    const runA = runCommandInTmux({
      command: process.execPath,
      args: ["-e", "setInterval(() => process.stdout.write('a\\n'), 100);"],
      cwd: runADir,
      stdin: "",
      stdoutPath: join(runADir, "stdout.md"),
      stderrPath: join(runADir, "stderr.log"),
      timeoutMs: 10000,
      tmux: runATmux!,
      onStdout: () => undefined,
      onStderr: () => undefined
    });
    const runB = runCommandInTmux({
      command: process.execPath,
      args: ["-e", "setInterval(() => process.stdout.write('b\\n'), 100);"],
      cwd: runBDir,
      stdin: "",
      stdoutPath: join(runBDir, "stdout.md"),
      stderrPath: join(runBDir, "stderr.log"),
      timeoutMs: 10000,
      tmux: runBTmux!,
      onStdout: () => undefined,
      onStderr: () => undefined
    });

    await new Promise((resolve) => setTimeout(resolve, 250));
    await expect(killTmuxSessionsForRun("AUTO-RUN-A")).resolves.toEqual([runATmux!.sessionName]);
    await expect(runA).resolves.toMatchObject({ exitCode: 130, timedOut: false });
    await expect(killActiveTmuxSessions()).resolves.toContain(runBTmux!.sessionName);
    await expect(runB).resolves.toMatchObject({ exitCode: 130, timedOut: false });
  });
});
