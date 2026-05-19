import { describe, expect, it } from "vitest";
import { formatSection, getPromptSection, parsePromptSections } from "../prompt/sections.js";

describe("prompt sections", () => {
  it("parses managed and user sections through public markers", () => {
    const markdown = [
      formatSection("managed", "header", "> Status: ready"),
      formatSection("user", "task-body", "Do the work.")
    ].join("\n\n");

    const sections = parsePromptSections(markdown);

    expect(sections).toHaveLength(2);
    expect(getPromptSection(markdown, "user", "task-body")).toBe("Do the work.");
  });
});
