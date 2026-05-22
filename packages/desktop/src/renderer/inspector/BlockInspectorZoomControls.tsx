import type { Dispatch, PointerEvent, SetStateAction } from "react";
import { XIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { createTranslator } from "../i18n";

type BlockInspectorZoomControlsProps = {
  onClose: () => void;
  setZoom: Dispatch<SetStateAction<number>>;
  t: ReturnType<typeof createTranslator>;
  zoom: number;
};

const stopHeaderDrag = (event: PointerEvent<HTMLButtonElement>) => {
  event.stopPropagation();
};

export function BlockInspectorZoomControls({ onClose, setZoom, t, zoom }: BlockInspectorZoomControlsProps) {
  return (
    <>
      <Button size="icon-sm" variant="ghost" aria-label="缩小 Block 面板内容" onPointerDown={stopHeaderDrag} onClick={() => setZoom((current) => Math.max(0.8, current - 0.1))}>
        <ZoomOutIcon data-icon="inline-start" />
      </Button>
      <Badge variant="outline">{Math.round(zoom * 100)}%</Badge>
      <Button size="icon-sm" variant="ghost" aria-label="放大 Block 面板内容" onPointerDown={stopHeaderDrag} onClick={() => setZoom((current) => Math.min(1.4, current + 0.1))}>
        <ZoomInIcon data-icon="inline-start" />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label={t("close")} onPointerDown={stopHeaderDrag} onClick={onClose}>
        <XIcon data-icon="inline-start" />
      </Button>
    </>
  );
}
