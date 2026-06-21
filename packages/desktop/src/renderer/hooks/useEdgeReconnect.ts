import { useCallback, useRef } from "react";
import type { Connection, Edge, FinalConnectionState } from "@xyflow/react";

type UseEdgeReconnectArgs = {
  handleConnect: (connection: Connection) => Promise<void>;
  handleEdgesDelete: (deletedEdges: Edge[]) => Promise<void>;
};

export function useEdgeReconnect({ handleConnect, handleEdgesDelete }: UseEdgeReconnectArgs) {
  const reconnectSucceededRef = useRef(false);

  const handleReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      reconnectSucceededRef.current = true;
      void (async () => {
        await handleEdgesDelete([oldEdge]);
        await handleConnect(connection);
      })();
    },
    [handleConnect, handleEdgesDelete]
  );

  const handleReconnectStart = useCallback(() => {
    reconnectSucceededRef.current = false;
  }, []);

  const handleReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: Edge, _handleType: "source" | "target", connectionState: FinalConnectionState) => {
      if (reconnectSucceededRef.current || connectionState.isValid) {
        return;
      }
      void handleEdgesDelete([edge]);
    },
    [handleEdgesDelete]
  );

  return {
    handleReconnect,
    handleReconnectEnd,
    handleReconnectStart
  };
}
