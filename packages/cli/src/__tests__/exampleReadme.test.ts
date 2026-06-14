import { execFile } from "node:child_process";
import { cp, readFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../../../..");

async function planweave(args: string[], env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("pnpm", ["--silent", "--filter", "@planweave-ai/cli", "planweave", ...args], {
    cwd: repoRoot,
    env
  });
}

function parseJson<T = unknown>(stdout: string): T {
  return JSON.parse(stdout) as T;
}

describe("basic Plan Package README workflow", () => {
  it("uses a pnpm wrapper that preserves JSON stdout", async () => {
    const readme = await readFile(join(repoRoot, "examples/basic-plan-package/README.md"), "utf8");
    expect(readme).toContain("pnpm --silent --filter @planweave-ai/cli planweave");

    const home = await mkdtemp(join(tmpdir(), "planweave-home-"));
    const { stdout, stderr } = await planweave(["init", "--json"], { ...process.env, PLANWEAVE_HOME: home });

    expect(stderr).toBe("");
    expect(() => JSON.parse(stdout)).not.toThrow();
    expect(parseJson<{ workspace: { packageDir: string } }>(stdout).workspace.packageDir).toEqual(expect.stringContaining(home));
  });

  it("runs the documented block/review/feedback retry workflow", async () => {
    const home = await mkdtemp(join(tmpdir(), "planweave-home-"));
    const env = { ...process.env, PLANWEAVE_HOME: home };
    const init = parseJson<{ workspace: { packageDir: string } }>((await planweave(["init", "--json"], env)).stdout);
    await cp(join(repoRoot, "examples/basic-plan-package/package"), init.workspace.packageDir, {
      recursive: true,
      force: true
    });

    expect(parseJson<{ ok: boolean }>((await planweave(["validate", "--json"], env)).stdout).ok).toBe(true);
    const manualRun = parseJson<{ kind: string; claim: { ref: string }; adapterResult: { promptPath: string } }>(
      (await planweave(["run", "--once", "--executor", "manual", "--json"], env)).stdout
    );
    expect(manualRun).toMatchObject({
      kind: "manual",
      claim: { ref: "T-001#B-001" },
      adapterResult: { promptPath: expect.stringContaining("prompt.md") }
    });
    expect(parseJson<{ kind: string; ref: string }>((await planweave(["claim-next"], env)).stdout)).toMatchObject({
      kind: "block",
      ref: "T-001#B-001"
    });
    await planweave(["prompt", "T-001#B-001"], env);

    const implementation = join(home, "implementation-1.md");
    await writeFile(implementation, "First implementation.\n", "utf8");
    await planweave(["submit-result", "T-001#B-001", "--report", implementation], env);

    expect(parseJson<{ kind: string; ref: string }>((await planweave(["claim-next"], env)).stdout)).toMatchObject({
      kind: "block",
      ref: "T-001#R-001"
    });
    await planweave(["prompt", "T-001#R-001"], env);

    const firstReview = join(home, "review-1.json");
    await writeFile(
      firstReview,
      JSON.stringify({
        reviewBlockRef: "T-001#R-001",
        taskId: "T-001",
        verdict: "needs_changes",
        content: "Needs a test adjustment."
      }),
      "utf8"
    );
    await planweave(["submit-review", "T-001#R-001", "--result", firstReview], env);

    expect(parseJson<{ kind: string; content: string }>((await planweave(["claim-next"], env)).stdout)).toMatchObject({
      kind: "feedback",
      content: "Needs a test adjustment."
    });
    const feedback = join(home, "feedback-1.md");
    await writeFile(feedback, "Handled requested test adjustment.\n", "utf8");
    await planweave(["submit-feedback", "--report", feedback], env);

    expect(parseJson<{ kind: string; ref: string; reason: string }>((await planweave(["claim-next"], env)).stdout)).toMatchObject({
      kind: "block",
      ref: "T-001#R-001",
      reason: "feedback_resolved"
    });
    const secondReview = join(home, "review-2.json");
    await writeFile(
      secondReview,
      JSON.stringify({
        reviewBlockRef: "T-001#R-001",
        taskId: "T-001",
        verdict: "passed",
        content: "Passed."
      }),
      "utf8"
    );
    await planweave(["submit-review", "T-001#R-001", "--result", secondReview], env);

    const status = parseJson<{ counts: { tasks: { implemented: number } } }>((await planweave(["status", "--json"], env)).stdout);
    expect(status.counts.tasks.implemented).toBe(1);
  }, 20_000);

  it("runs the documented manual auto-run entrypoint without auto-submitting work", async () => {
    const home = await mkdtemp(join(tmpdir(), "planweave-home-"));
    const env = { ...process.env, PLANWEAVE_HOME: home };
    const init = parseJson<{ workspace: { packageDir: string } }>((await planweave(["init", "--json"], env)).stdout);
    await cp(join(repoRoot, "examples/basic-plan-package/package"), init.workspace.packageDir, {
      recursive: true,
      force: true
    });

    const run = parseJson<{ kind: string; adapterResult: { promptPath: string } }>(
      (await planweave(["run", "--once", "--executor", "manual", "--json"], env)).stdout
    );

    expect(run.kind).toBe("manual");
    expect(run.adapterResult.promptPath).toContain("prompt.md");
    expect(await readFile(run.adapterResult.promptPath, "utf8")).toContain("# T-001#B-001");
    const status = parseJson<{ latestRuns: Array<{ ref: string; status: string }> }>((await planweave(["run-status", "--json"], env)).stdout);
    expect(status.latestRuns.find((run) => run.ref === "T-001#B-001")?.status).toBe("in_progress");
  });
});
