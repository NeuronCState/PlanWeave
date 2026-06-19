import { describe, expect, it } from "vitest";
import { edgeTypes, executorAdapters, reviewTriggerConditions, supportedManifestVersion } from "../types.js";
import { manifestSchemaTopLevelFields } from "../schema/manifest.js";
import { projectGraphEdgeTypes, supportedProjectGraphVersion } from "../projectGraph/types.js";
import { projectGraphManifestSchemaTopLevelFields } from "../projectGraph/schema.js";
import { manifestSchemaDocument, projectSchemaDocument } from "../schemaDocs/index.js";

describe("runtime schema documents", () => {
  it("keeps manifest document top-level fields aligned with the Zod schema shape", () => {
    expect(Object.keys(manifestSchemaDocument.schema).sort()).toEqual([...manifestSchemaTopLevelFields].sort());
  });

  it("keeps project document top-level fields aligned with the Zod schema shape", () => {
    expect(Object.keys(projectSchemaDocument.schema).sort()).toEqual([...projectGraphManifestSchemaTopLevelFields].sort());
  });

  it("documents manifest version and key enums from runtime constants", () => {
    const documentText = JSON.stringify(manifestSchemaDocument.schema);
    for (const value of [supportedManifestVersion, ...edgeTypes, ...executorAdapters, ...reviewTriggerConditions]) {
      expect(documentText).toContain(value);
    }
  });

  it("documents project graph version and edge types from runtime constants", () => {
    const documentText = JSON.stringify(projectSchemaDocument.schema);
    for (const value of [supportedProjectGraphVersion, ...projectGraphEdgeTypes]) {
      expect(documentText).toContain(value);
    }
  });
});
