import { ComponentIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { createTranslator } from "../i18n";
import type { DesktopUiSettings, PaletteDropComponent } from "../types";

type ComponentPaletteProps = {
  addPaletteComponent: (type: PaletteDropComponent) => Promise<void>;
  handlePaletteDragStart: (event: React.DragEvent, type: PaletteDropComponent) => void;
  settings: DesktopUiSettings;
  t: ReturnType<typeof createTranslator>;
};

export function ComponentPalette({ addPaletteComponent, handlePaletteDragStart, settings, t }: ComponentPaletteProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-2 p-3 pt-4">
        <div className="text-sm font-semibold">{t("componentPalette")}</div>
        {settings.palette.dragHint ? <div className="text-xs text-muted-foreground">{t("dragHint")}</div> : null}
        {settings.palette.visible.task ? (
          <Button className="justify-start" draggable variant="outline" onClick={() => void addPaletteComponent("task")} onDragStart={(event) => handlePaletteDragStart(event, "task")}>
            <ComponentIcon data-icon="inline-start" />
            {t("taskNode")}
          </Button>
        ) : null}
        {settings.palette.visible.implementation ? (
          <Button className="justify-start" draggable variant="outline" onClick={() => void addPaletteComponent("implementation")} onDragStart={(event) => handlePaletteDragStart(event, "implementation")}>
            <ComponentIcon data-icon="inline-start" />
            {t("implementationBlock")}
          </Button>
        ) : null}
        {settings.palette.visible.check ? (
          <Button className="justify-start" draggable variant="outline" onClick={() => void addPaletteComponent("check")} onDragStart={(event) => handlePaletteDragStart(event, "check")}>
            <ComponentIcon data-icon="inline-start" />
            {t("checkBlock")}
          </Button>
        ) : null}
        {settings.palette.visible.review ? (
          <Button className="justify-start" draggable variant="outline" onClick={() => void addPaletteComponent("review")} onDragStart={(event) => handlePaletteDragStart(event, "review")}>
            <ComponentIcon data-icon="inline-start" />
            {t("reviewBlock")}
          </Button>
        ) : null}
        {settings.palette.visible.context ? (
          <Button className="justify-start" draggable variant="outline" onClick={() => void addPaletteComponent("context")} onDragStart={(event) => handlePaletteDragStart(event, "context")}>
            <ComponentIcon data-icon="inline-start" />
            {t("contextNode")}
          </Button>
        ) : null}
      </div>
      <Separator />
    </>
  );
}
