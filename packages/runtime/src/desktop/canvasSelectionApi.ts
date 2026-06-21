import { executePlanGraphCommand } from "../plangraph/index.js";
import { readActiveTaskCanvasSelection } from "./canvasSelectionStore.js";
import { desktopLayoutCommandStore } from "./layoutStore.js";

function graphCommandError(result: Awaited<ReturnType<typeof executePlanGraphCommand>>): Error {
  return new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
}

export async function selectTaskCanvas(projectRoot: string, canvasId: string): Promise<string> {
  const result = await executePlanGraphCommand({
    projectRoot,
    command: { type: "updateLayout", layoutScope: "canvas", layout: { activeCanvasId: canvasId } },
    dependencies: { layoutStore: desktopLayoutCommandStore }
  });
  if (!result.ok) {
    throw graphCommandError(result);
  }
  return (await readActiveTaskCanvasSelection(projectRoot)).activeCanvasId;
}
