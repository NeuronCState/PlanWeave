import { z } from "zod";
import { edgeTypes, nodeTypes, supportedManifestVersion } from "../types.js";

const parallelPolicySchema = z
  .object({
    safe: z.boolean().default(false),
    locks: z.array(z.string()).default([])
  })
  .strict();

const taskNodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("task"),
    title: z.string().min(1),
    prompt: z.string().min(1),
    acceptance: z.array(z.string().min(1)).min(1),
    parallel: parallelPolicySchema.default({ safe: false, locks: [] })
  })
  .strict();

const contextNodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(nodeTypes).exclude(["task"]),
    title: z.string().min(1),
    summary: z.string().min(1)
  })
  .strict();

export const manifestSchema = z
  .object({
    version: z.literal(supportedManifestVersion),
    project: z
      .object({
        title: z.string().min(1),
        description: z.string()
      })
      .strict(),
    execution: z
      .object({
        parallel: z
          .object({
            enabled: z.boolean(),
            maxConcurrent: z.number().int().positive()
          })
          .strict()
      })
      .strict(),
    global_prompt: z.string().min(1),
    nodes: z.array(z.discriminatedUnion("type", [taskNodeSchema, contextNodeSchema])),
    edges: z.array(
      z
        .object({
          from: z.string().min(1),
          to: z.string().min(1),
          type: z.enum(edgeTypes)
        })
        .strict()
    )
  })
  .strict();

export type ParsedManifest = z.infer<typeof manifestSchema>;
