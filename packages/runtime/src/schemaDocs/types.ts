export type RuntimeSchemaTopicName = "manifest" | "project";

export type SchemaDocument<Name extends string = RuntimeSchemaTopicName> = {
  name: Name;
  summary: string;
  path: string;
  ownership: string;
  validation: string[];
  schema: Record<string, unknown>;
  notes: string[];
};
