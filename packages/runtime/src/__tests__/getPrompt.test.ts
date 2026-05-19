import { describe, expect, it } from "vitest";
import { getPrompt } from "../prompt/getPrompt.js";
import { createPackageWorkspace } from "./promptTestHelpers.js";

describe("getPrompt", () => {
  it("returns the refreshed Prompt Surface markdown", async () => {
    const { root } = await createPackageWorkspace();

    const markdown = await getPrompt({ projectRoot: root, taskId: "T-001" });

    expect(markdown).toContain("# T-001: Implement task");
    expect(markdown).toContain("Keep this body.");
    delete process.env.PLANWEAVE_HOME;
  });
});
