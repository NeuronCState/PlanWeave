import { afterEach, describe, expect, it } from "vitest";
import { listProjects } from "../desktop/index.js";
import { createTestWorkspace } from "./promptTestHelpers.js";

afterEach(() => {
  delete process.env.PLANWEAVE_HOME;
});

describe("desktop project API", () => {
  it("lists projects from the PlanWeave home registry", async () => {
    const { init } = await createTestWorkspace();

    await expect(listProjects()).resolves.toEqual([
      expect.objectContaining({
        projectId: init.workspace.id,
        rootPath: init.workspace.rootPath
      })
    ]);
  });
});
