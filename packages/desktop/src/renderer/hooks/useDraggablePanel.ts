import { useCallback, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { clamp } from "../viewHelpers";

type PanelPosition = {
  left: number;
  top: number;
};

type PanelBounds = {
  width: number;
  height: number;
  margin?: number;
  maxHeight?: number;
  maxWidth?: number;
  minLeft?: number;
  minHeight?: number;
  minTop?: number;
  minWidth?: number;
  viewportHeightOffset?: number;
};

type PanelDrag = {
  offsetX: number;
  offsetY: number;
  pointerId: number;
};

type PanelResize = {
  height: number;
  pointerId: number;
  startX: number;
  startY: number;
  width: number;
};

export function useDraggablePanel(initialPosition: PanelPosition, bounds: PanelBounds) {
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState({ width: bounds.width, height: bounds.height });
  const [drag, setDrag] = useState<PanelDrag | null>(null);
  const [resize, setResize] = useState<PanelResize | null>(null);

  const startDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({
        offsetX: event.clientX - position.left,
        offsetY: event.clientY - position.top,
        pointerId: event.pointerId
      });
    },
    [position.left, position.top]
  );

  const moveDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const margin = bounds.margin ?? 12;
      const minLeft = bounds.minLeft ?? margin;
      const minTop = bounds.minTop ?? margin;
      const maxLeft = Math.max(minLeft, window.innerWidth - size.width - margin);
      const maxTop = Math.max(minTop, window.innerHeight - (bounds.viewportHeightOffset ?? 0) - size.height - margin);
      setPosition({
        left: clamp(event.clientX - drag.offsetX, minLeft, maxLeft),
        top: clamp(event.clientY - drag.offsetY, minTop, maxTop)
      });
    },
    [bounds.margin, bounds.minLeft, bounds.minTop, bounds.viewportHeightOffset, drag, size.height, size.width]
  );

  const stopDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDrag(null);
  }, []);

  const startResize = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setResize({
        height: size.height,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        width: size.width
      });
    },
    [size.height, size.width]
  );

  const moveResize = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!resize || resize.pointerId !== event.pointerId) {
        return;
      }
      const margin = bounds.margin ?? 12;
      const minWidth = bounds.minWidth ?? 360;
      const minHeight = bounds.minHeight ?? 360;
      const maxWidth = Math.min(bounds.maxWidth ?? 720, window.innerWidth - position.left - margin);
      const maxHeight = Math.min(bounds.maxHeight ?? 760, window.innerHeight - position.top - margin);
      setSize({
        width: clamp(resize.width + event.clientX - resize.startX, minWidth, maxWidth),
        height: clamp(resize.height + event.clientY - resize.startY, minHeight, maxHeight)
      });
    },
    [bounds.margin, bounds.maxHeight, bounds.maxWidth, bounds.minHeight, bounds.minWidth, position.left, position.top, resize]
  );

  const stopResize = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setResize(null);
  }, []);

  const panelStyle = useMemo<CSSProperties>(
    () => ({
      height: size.height,
      left: position.left,
      top: position.top,
      width: size.width
    }),
    [position.left, position.top, size.height, size.width]
  );

  return {
    dragHandlers: {
      onPointerCancel: stopDrag,
      onPointerDown: startDrag,
      onPointerMove: moveDrag,
      onPointerUp: stopDrag
    },
    panelStyle,
    resizeHandlers: {
      onPointerCancel: stopResize,
      onPointerDown: startResize,
      onPointerMove: moveResize,
      onPointerUp: stopResize
    }
  };
}
