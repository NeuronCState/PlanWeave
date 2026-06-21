import { projectGraphEdgeTypes, supportedProjectGraphVersion } from "../projectGraph/types.js";
import type { SchemaDocument } from "./types.js";

export const projectSchemaDocument: SchemaDocument<"project"> = {
  name: "project",
  summary: "Project-level canvas graph schema.",
  path: "project-graph.json inside the CLI-returned workspaceRoot",
  ownership: "User/agent editable project graph source. Do not write runtime state, results, or desktop layout here.",
  validation: ["planweave validate --json", "planweave schema project"],
  schema: {
    version: supportedProjectGraphVersion,
    canvases: [
      {
        id: "CLI-safe canvas id, unique; start with letter/number, then letters/numbers/dot/underscore/hyphen",
        type: "canvas",
        title: "string, non-empty",
        description: "string, optional",
        packageDir: "workspaceRoot-relative package directory",
        stateFile: "workspaceRoot-relative runtime state file",
        resultsDir: "workspaceRoot-relative results directory"
      }
    ],
    edges: [{ from: "CLI-safe canvas id", to: "CLI-safe canvas id", type: projectGraphEdgeTypes[0] }],
    crossTaskEdges: [
      {
        from: { canvasId: "CLI-safe canvas id", taskId: "task id string" },
        to: { canvasId: "CLI-safe canvas id", taskId: "task id string" },
        type: projectGraphEdgeTypes[0]
      }
    ]
  },
  notes: [
    "PlanWeave stores project metadata, package, state, results, and desktop files under workspaceRoot; managed projects use that workspace as their project root.",
    "External projects keep source code outside workspaceRoot and store the optional sourceRoot in project metadata.",
    "Canvas ids must be CLI-safe because generated agent commands pass them to --canvas without shell quoting.",
    "Use canvas edges only when the whole downstream canvas waits for the whole upstream canvas.",
    "Use crossTaskEdges when only specific tasks have cross-canvas ordering.",
    "Use block parallel.locks for write conflicts that have no logical ordering.",
    "Edge direction matches manifest task edges: from depends_on to, so from waits for to.",
    "Desktop layout stores canvas coordinates only; canvas dependencies belong in this schema."
  ]
};
