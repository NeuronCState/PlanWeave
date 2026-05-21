import { afterEach, describe, expect, it } from "vitest";
import { getDesktopLayout, resetDesktopLayout, saveDesktopLayout } from "../desktop/index.js";
import { readJsonFile } from "../json.js";
import type { PlanPackageManifest } from "../types.js";
import { createTestWorkspace } from "./promptTestHelpers.js";

afterEach(() => {
  delete process.env.PLANWEAVE_HOME;
});

describe("desktop layout API", () => {
  it("stores desktop layout outside the Plan Package", async () => {
    const { root, init } = await createTestWorkspace();

    expect(await getDesktopLayout(root)).toMatchObject({ nodes: [] });
    const saved = await saveDesktopLayout(root, {
      version: "desktop-layout/v1",
      projectId: "ignored",
      nodes: [
        { nodeId: "T-001", x: 120, y: 240 },
        { nodeId: "G-001", x: 300, y: 420 }
      ],
      updatedAt: new Date(0).toISOString()
    });

    expect(saved.projectId).toBe(init.workspace.id);
    expect(await getDesktopLayout(root)).toMatchObject({
      projectId: init.workspace.id,
      nodes: [
        { nodeId: "T-001", x: 120, y: 240 },
        { nodeId: "G-001", x: 300, y: 420 }
      ]
    });
    expect(await readJsonFile<PlanPackageManifest>(init.workspace.manifestFile)).not.toHaveProperty("layout");
    expect(await resetDesktopLayout(root)).toMatchObject({ projectId: init.workspace.id, nodes: [] });
  });
});
