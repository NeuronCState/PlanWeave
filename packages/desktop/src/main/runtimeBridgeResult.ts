import type { DesktopGraphEditResult, GraphEditResult } from "@planweave-ai/runtime";

export function cloneableGraphEditResult(result: GraphEditResult): DesktopGraphEditResult {
  const { graph: _graph, ...cloneable } = result;
  return cloneable;
}
