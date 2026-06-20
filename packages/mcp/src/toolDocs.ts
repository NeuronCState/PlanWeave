export const authoringRules = [
  "Use projectId and optional canvasId from list_projects/open_project; MCP tools do not accept arbitrary server absolute paths.",
  "Create a new isolated task canvas with create_canvas before writing a plan that should not modify an existing demo canvas.",
  "Create and update graph structure through create_task, create_block, add_dependency, and related write tools.",
  "Use update_task_acceptance, update_block_dependencies, update_block_planning, update_review_pipeline, and project graph dependency tools for plan metadata that is not prompt text.",
  "Keep the graph acyclic. Use preview_execution_graph before large dependency changes.",
  "Write task and block prompts through write_task_prompt and write_block_prompt, then run refresh_prompts and validate_project.",
  "Use implementation blocks for work and review blocks for review gates; review blocks should depend on the implementation blocks they inspect.",
  "Import packages only from structured file lists, and validate before relying on the imported project."
] as const;

export const exampleFiles = [
  {
    path: "manifest.json",
    encoding: "utf8" as const,
    content: JSON.stringify(
      {
        schemaVersion: 1,
        project: { name: "Example PlanWeave Project" },
        review: { maxFeedbackCycles: 2, completionPolicy: "strict" },
        nodes: [
          {
            id: "T-001",
            type: "task",
            title: "Build the feature",
            prompt: "nodes/T-001/prompt.md",
            acceptance: ["Feature behavior is implemented and validated."],
            blocks: [
              {
                id: "B-001",
                type: "implementation",
                title: "Implement feature",
                prompt: "nodes/T-001/blocks/B-001.prompt.md",
                depends_on: [],
                parallel: { safe: false, locks: [] }
              },
              {
                id: "R-001",
                type: "review",
                title: "Review feature",
                prompt: "nodes/T-001/blocks/R-001.prompt.md",
                depends_on: ["B-001"],
                review: { required: true, maxFeedbackCycles: 2, hook: null }
              }
            ]
          }
        ],
        edges: []
      },
      null,
      2
    )
  },
  {
    path: "nodes/T-001/prompt.md",
    encoding: "utf8" as const,
    content: "# Build the feature\n\nDescribe the user-visible outcome and acceptance criteria.\n"
  },
  {
    path: "nodes/T-001/blocks/B-001.prompt.md",
    encoding: "utf8" as const,
    content: "# Implement feature\n\nMake the smallest code change that satisfies the task.\n"
  },
  {
    path: "nodes/T-001/blocks/R-001.prompt.md",
    encoding: "utf8" as const,
    content: "# Review feature\n\nCheck correctness, regressions, and test coverage.\n"
  }
] as const;
