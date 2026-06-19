import type { RuntimeSchemaTopicName, SchemaDocument as RuntimeSchemaDocument } from "@planweave-ai/runtime";

export type SchemaTopicName = RuntimeSchemaTopicName | "state" | "layout";

export type SchemaDocument = RuntimeSchemaDocument<SchemaTopicName>;
