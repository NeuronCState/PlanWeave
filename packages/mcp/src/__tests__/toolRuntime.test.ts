import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runtimeGateway } from "../toolRuntime.js";

afterEach(() => {
  delete process.env.PLANWEAVE_HOME;
});

describe("MCP runtime gateway", () => {
  it("initializes new projects as managed PlanWeave workspaces without mcp-projects roots", async () => {
    const home = await mkdtemp(join(tmpdir(), "planweave-mcp-home-"));
    process.env.PLANWEAVE_HOME = home;

    const project = await runtimeGateway.initProject("New Demo Project");

    expect(project.kind).toBe("managed");
    expect(project.rootPath).toBe(project.workspaceRoot);
    expect(project.sourceRoot).toBeNull();
    expect(project.workspaceRoot).toBe(join(home, "projects", project.projectId));
    await expect(access(join(home, "mcp-projects"))).rejects.toThrow();
  });
});
