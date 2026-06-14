import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
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

describe("STEP-1 CLI contract", () => {
  it("runs the documented block-level review feedback loop", async () => {
    const readme = await readFile(join(repoRoot, "examples/basic-plan-package/README.md"), "utf8");
    expect(readme).toContain("planweave prompt T-001#B-001");
    expect(readme).toContain("planweave submit-feedback --report");

    const home = await mkdtemp(join(tmpdir(), "planweave-home-"));
    const env = { ...process.env, PLANWEAVE_HOME: home };
    const init = JSON.parse((await planweave(["init", "--json"], env)).stdout);
    await cp(join(repoRoot, "examples/basic-plan-package/package"), init.workspace.packageDir, {
      recursive: true,
      force: true
    });

    const validation = JSON.parse((await planweave(["validate", "--json"], env)).stdout);
    expect(validation.ok).toBe(true);

    expect(JSON.parse((await planweave(["claim-next"], env)).stdout)).toMatchObject({
      kind: "block",
      ref: "T-001#B-001"
    });
    expect((await planweave(["prompt", "T-001#B-001"], env)).stdout).toContain("Create a small implementation report");
    const implementation = join(home, "implementation.md");
    await writeFile(implementation, "Implemented.\n", "utf8");
    await planweave(["submit-result", "T-001#B-001", "--report", implementation], env);

    expect(JSON.parse((await planweave(["claim", "--type", "review"], env)).stdout)).toMatchObject({
      kind: "block",
      ref: "T-001#R-001"
    });
    const review = join(home, "review.json");
    await writeFile(
      review,
      JSON.stringify({
        reviewBlockRef: "T-001#R-001",
        taskId: "T-001",
        verdict: "needs_changes",
        content: "Adjust the implementation report."
      }),
      "utf8"
    );
    await planweave(["submit-review", "T-001#R-001", "--result", review], env);
    expect(JSON.parse((await planweave(["claim-next"], env)).stdout)).toEqual({
      kind: "feedback",
      content: "Adjust the implementation report."
    });
    const feedback = join(home, "feedback.md");
    await writeFile(feedback, "Adjusted.\n", "utf8");
    await planweave(["submit-feedback", "--report", feedback], env);

    expect(JSON.parse((await planweave(["claim-next"], env)).stdout)).toMatchObject({
      kind: "block",
      ref: "T-001#R-001",
      reason: "feedback_resolved"
    });
    await writeFile(
      review,
      JSON.stringify({
        reviewBlockRef: "T-001#R-001",
        taskId: "T-001",
        verdict: "passed",
        content: "Passed."
      }),
      "utf8"
    );
    await planweave(["submit-review", "T-001#R-001", "--result", review], env);
    const status = JSON.parse((await planweave(["status", "--json"], env)).stdout);
    expect(status.counts.tasks.implemented).toBe(1);
    expect(status.counts.blocks.completed).toBe(2);
  }, 20_000);

  it("operates a non-default canvas in a formal multi-canvas project", async () => {
    const home = await mkdtemp(join(tmpdir(), "planweave-home-"));
    const root = await mkdtemp(join(tmpdir(), "planweave-project-"));
    const env = { ...process.env, PLANWEAVE_HOME: home, INIT_CWD: root };
    const init = JSON.parse((await planweave(["init", "--json"], env)).stdout);
    await cp(join(repoRoot, "examples/basic-plan-package/package"), init.workspace.packageDir, {
      recursive: true,
      force: true
    });
    const desktopPackageDir = join(init.workspace.workspaceRoot, "canvases", "desktop", "package");
    await cp(join(repoRoot, "examples/basic-plan-package/package"), desktopPackageDir, {
      recursive: true,
      force: true
    });
    await writeFile(
      join(desktopPackageDir, "nodes", "T-001", "blocks", "B-001.prompt.md"),
      "Desktop canvas block prompt.\n",
      "utf8"
    );
    await writeFile(
      join(init.workspace.workspaceRoot, "project-graph.json"),
      `${JSON.stringify(
        {
          version: "plan-project/v1",
          canvases: [
            {
              id: "runtime",
              type: "canvas",
              title: "Runtime",
              packageDir: "package",
              stateFile: "state.json",
              resultsDir: "results"
            },
            {
              id: "desktop",
              type: "canvas",
              title: "Desktop",
              packageDir: "canvases/desktop/package",
              stateFile: "canvases/desktop/state.json",
              resultsDir: "canvases/desktop/results"
            }
          ],
          edges: [],
          crossTaskEdges: []
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const paths = JSON.parse((await planweave(["paths", "--json"], env)).stdout);
    expect(paths.projectGraphPath).toBe(join(init.workspace.workspaceRoot, "project-graph.json"));
    expect(paths.activeCanvasId).toBe("runtime");
    expect(paths.canvases.map((canvas: { canvasId: string }) => canvas.canvasId)).toEqual(["runtime", "desktop"]);

    const initialDesktopStatus = JSON.parse((await planweave(["status", "--json", "--canvas", "desktop"], env)).stdout);
    expect(initialDesktopStatus.claimHints.find((hint: { ref: string }) => hint.ref === "T-001#B-001")?.recommendedCommand).toContain(
      "planweave claim --canvas desktop"
    );
    expect(JSON.parse((await planweave(["claim-next", "--canvas", "desktop"], env)).stdout)).toMatchObject({
      kind: "block",
      ref: "T-001#B-001"
    });
    const desktopPrompt = (await planweave(["prompt", "--canvas", "desktop", "T-001#B-001"], env)).stdout;
    expect(desktopPrompt).toContain("Desktop canvas block prompt");
    expect(desktopPrompt).toContain("planweave submit-result --canvas desktop T-001#B-001 --report");
    const desktopStatus = JSON.parse((await planweave(["status", "--json", "--canvas", "desktop"], env)).stdout);
    expect(desktopStatus.currentRefs).toEqual(["T-001#B-001"]);

    const runtimeStatus = JSON.parse((await planweave(["status", "--json"], env)).stdout);
    expect(runtimeStatus.currentRefs).toEqual([]);
    expect(JSON.parse((await planweave(["current", "--canvas", "desktop"], env)).stdout).items[0].submitCommand).toContain("--canvas desktop");
  }, 20_000);
});
