import { rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeJsonFile } from "../json.js";
import { validatePackage } from "../validatePackage.js";
import { basicManifest, createTestWorkspace } from "./promptTestHelpers.js";

describe("validatePackage", () => {
  it("accepts a complete v1 block-level package", async () => {
    const { root } = await createTestWorkspace();

    const report = await validatePackage({ projectRoot: root });

    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("rejects legacy global_prompt and missing block prompt files", async () => {
    const { root, init } = await createTestWorkspace();
    const manifest = { ...basicManifest(), global_prompt: "global-prompt.md" };
    await writeJsonFile(init.workspace.manifestFile, manifest);

    const report = await validatePackage({ projectRoot: root });

    expect(report.ok).toBe(false);
    expect(report.errors.map((error) => error.code)).toContain("manifest_schema");
  });

  it("warns about stale prompt files instead of treating them as active contract", async () => {
    const { root, init } = await createTestWorkspace();
    await rm(join(init.workspace.packageDir, "nodes", "T-001", "blocks", "C-001.prompt.md"));

    const report = await validatePackage({ projectRoot: root });

    expect(report.ok).toBe(false);
    expect(report.errors.map((error) => error.code)).toContain("prompt_missing");
  });
});
