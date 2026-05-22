import { useEffect, useMemo, useState } from "react";
import type { DesktopAgentDetection } from "@planweave/runtime";
import { bridge } from "../bridge";

export function useDetectedAgents() {
  const [agentDetections, setAgentDetections] = useState<DesktopAgentDetection[]>([]);

  useEffect(() => {
    if (!bridge) {
      return;
    }
    let cancelled = false;
    void bridge.detectAgentTools().then((detectedAgents) => {
      if (!cancelled) {
        setAgentDetections(detectedAgents);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const executorOptions = useMemo(() => agentDetections.filter((agent) => agent.installed).map((agent) => agent.command), [agentDetections]);

  return { agentDetections, executorOptions };
}
