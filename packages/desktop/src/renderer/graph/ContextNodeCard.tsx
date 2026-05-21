import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContextFlowNode } from "../types";

export function ContextNodeCard({ data }: NodeProps<ContextFlowNode>) {
  const { node, selected } = data;
  return (
    <Card className={`w-[280px] border bg-card shadow-sm ${selected ? "ring-2 ring-ring" : ""}`} size="sm">
      <Handle type="target" position={Position.Left} />
      <CardHeader className="min-h-14">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm">
          <span className="truncate">{node.title}</span>
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <Badge variant="outline">{node.type}</Badge>
          <span className="truncate">{node.nodeId}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-4 text-xs text-muted-foreground">{node.summary}</p>
      </CardContent>
      <Handle type="source" position={Position.Right} />
    </Card>
  );
}
