import { describe, expect, it } from "vitest";
import { renderManagedSections } from "../prompt/renderManagedSections.js";

describe("managed prompt sections", () => {
  it("are removed from the v1 source/render split", async () => {
    await expect(renderManagedSections({})).rejects.toThrow("Managed prompt sections were removed");
  });
});
