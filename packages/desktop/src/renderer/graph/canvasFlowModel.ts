import { MarkerType, type Edge } from "@xyflow/react";
import type {
  DesktopCanvasGraphEdgeViewModel,
  DesktopCanvasGraphViewModel,
  DesktopCanvasHealthEdgeSummary,
  DesktopCanvasMapLayout
} from "@planweave-ai/runtime";
import type { CanvasFlowNode, CanvasNodeData } from "../types";
import { CanvasNodeCard } from "./CanvasNodeCard";

export const canvasNodeTypes = {
  canvas: CanvasNodeCard
};

export type CanvasNodeTypes = typeof canvasNodeTypes;

export type DisplayCanvasEdgeData = {
  health: DesktopCanvasHealthEdgeSummary | null;
  manifestEdgeType: DesktopCanvasGraphEdgeViewModel["type"];
  manifestFrom: string;
  manifestTo: string;
};

function edgeStroke(health: DesktopCanvasHealthEdgeSummary | null): string {
  if (health?.severity === "error") {
    return "#dc2626";
  }
  if (health?.severity === "warning") {
    return "#d97706";
  }
  return "#0f766e";
}

export function canvasMapNodes(
  graph: DesktopCanvasGraphViewModel,
  layout: DesktopCanvasMapLayout | null,
  labels: CanvasNodeData["labels"],
  selectedCanvasId: string | null,
  onCanvasOpen: (canvasId: string) => void,
  onAgentPromptCopy: CanvasNodeData["onAgentPromptCopy"],
  onCanvasSelect: (canvasId: string) => void
): CanvasFlowNode[] {
  const layoutByCanvas = new Map(layout?.nodes.map((node) => [node.canvasId, node]) ?? []);
  const healthByCanvas = new Map(graph.health.canvases.map((canvas) => [canvas.canvasId, canvas]));
  return graph.canvases.map((canvas, index) => {
    const saved = layoutByCanvas.get(canvas.canvasId);
    return {
      id: canvas.canvasId,
      type: "canvas",
      position: saved ? { x: saved.x, y: saved.y } : { x: 80 + (index % 3) * 380, y: 80 + Math.floor(index / 3) * 220 },
      data: {
        canvas,
        health: healthByCanvas.get(canvas.canvasId) ?? null,
        labels,
        selected: selectedCanvasId === canvas.canvasId,
        onOpen: onCanvasOpen,
        onAgentPromptCopy,
        onSelect: onCanvasSelect
      }
    };
  });
}

export function canvasMapEdges(graph: DesktopCanvasGraphViewModel): Edge[] {
  const canvasIds = new Set(graph.canvases.map((canvas) => canvas.canvasId));
  const healthByEdge = new Map(graph.health.edges.map((edge) => [`${edge.from}:${edge.type}:${edge.to}`, edge]));
  return graph.edges
    .filter((edge) => canvasIds.has(edge.from) && canvasIds.has(edge.to))
    .map((edge) => {
      const health = healthByEdge.get(`${edge.from}:${edge.type}:${edge.to}`) ?? null;
      const stroke = edgeStroke(health);
      return {
        id: `${edge.from}-${edge.type}-${edge.to}`,
        source: edge.to,
        target: edge.from,
        data: {
          health,
          manifestEdgeType: edge.type,
          manifestFrom: edge.from,
          manifestTo: edge.to
        } satisfies DisplayCanvasEdgeData,
        animated: health?.severity === "warning",
        type: "smoothstep",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: stroke,
          width: 18,
          height: 18
        },
        style: {
          stroke,
          strokeWidth: health && health.severity !== "ok" ? 3 : 2.4,
          opacity: 0.95
        }
      } satisfies Edge;
    });
}
