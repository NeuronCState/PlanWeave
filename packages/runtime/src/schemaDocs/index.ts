import { manifestSchemaDocument } from "./manifest.js";
import { projectSchemaDocument } from "./project.js";
import type { RuntimeSchemaTopicName, SchemaDocument } from "./types.js";

export const runtimeSchemaTopicOrder: RuntimeSchemaTopicName[] = ["manifest", "project"];

export const runtimeSchemaDocuments: Record<RuntimeSchemaTopicName, SchemaDocument> = {
  manifest: manifestSchemaDocument,
  project: projectSchemaDocument
};

export { manifestSchemaDocument } from "./manifest.js";
export { projectSchemaDocument } from "./project.js";
export type { RuntimeSchemaTopicName, SchemaDocument } from "./types.js";
