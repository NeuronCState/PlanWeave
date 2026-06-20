import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { planweaveToolDefinitions } from "./toolDefinitions.js";
import { planweaveToolOutputSchemas } from "./toolSchemas.js";
import { handlePlanweaveTool, planweaveToolNames } from "./tools.js";

export function registerPlanweaveTools(server: McpServer): void {
  for (const name of planweaveToolNames) {
    const definition = planweaveToolDefinitions[name];
    server.registerTool(
      name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema,
        outputSchema: planweaveToolOutputSchemas[name],
        annotations: definition.annotations
      },
      async (args) => handlePlanweaveTool(name, args)
    );
  }
}
