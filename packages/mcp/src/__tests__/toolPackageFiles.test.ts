import { describe, expect, it } from "vitest";
import { importPackageFiles } from "../toolPackageFiles.js";

describe("toolPackageFiles", () => {
  it("rejects imported package paths that escape the package root", async () => {
    await expect(
      importPackageFiles("Bad Import", [{ path: "../manifest.json", content: "{}", encoding: "utf8" }], false)
    ).rejects.toThrow("Invalid package file path");
  });
});
