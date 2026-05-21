import type { BlockType } from "@planweave/runtime";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DesktopUiSettings, PaletteComponentKey } from "../types";

export function PaletteSettingsPanel({
  labels,
  settings,
  updateSettings
}: {
  settings: DesktopUiSettings;
  labels: {
    blockSetImplementation: string;
    blockSetImplementationCheck: string;
    blockSetImplementationCheckReview: string;
    checkBlock: string;
    componentVisibility: string;
    contextNode: string;
    defaultBlockSet: string;
    disabled: string;
    dragHint: string;
    enabled: string;
    implementationBlock: string;
    paletteSettings: string;
    reviewBlock: string;
    taskNode: string;
  };
  updateSettings: (patch: Partial<DesktopUiSettings>) => void;
}) {
  return (
    <section className="flex flex-col gap-4 border-t pt-4">
      <div className="text-base font-semibold">{labels.paletteSettings}</div>
      <FieldGroup>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <Field>
            <FieldLabel>{labels.defaultBlockSet}</FieldLabel>
            <Select
              value={settings.palette.defaultBlockSet.join(",")}
              onValueChange={(value) =>
                updateSettings({
                  palette: {
                    ...settings.palette,
                    defaultBlockSet: value.split(",").filter(Boolean) as BlockType[]
                  }
                })
              }
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="implementation">{labels.blockSetImplementation}</SelectItem>
                  <SelectItem value="implementation,check">{labels.blockSetImplementationCheck}</SelectItem>
                  <SelectItem value="implementation,check,review">{labels.blockSetImplementationCheckReview}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{labels.dragHint}</FieldLabel>
            <Select
              value={settings.palette.dragHint ? "enabled" : "disabled"}
              onValueChange={(value) => updateSettings({ palette: { ...settings.palette, dragHint: value === "enabled" } })}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="enabled">{labels.enabled}</SelectItem>
                  <SelectItem value="disabled">{labels.disabled}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel>{labels.componentVisibility}</FieldLabel>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
            {[
              { key: "task", label: labels.taskNode },
              { key: "implementation", label: labels.implementationBlock },
              { key: "check", label: labels.checkBlock },
              { key: "review", label: labels.reviewBlock },
              { key: "context", label: labels.contextNode }
            ].map(({ key, label }) => (
              <Select
                key={key}
                value={settings.palette.visible[key as PaletteComponentKey] ? "enabled" : "disabled"}
                onValueChange={(value) =>
                  updateSettings({
                    palette: {
                      ...settings.palette,
                      visible: {
                        ...settings.palette.visible,
                        [key]: value === "enabled"
                      }
                    }
                  })
                }
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder={label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="enabled">{label}</SelectItem>
                    <SelectItem value="disabled">{labels.disabled}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            ))}
          </div>
        </Field>
      </FieldGroup>
    </section>
  );
}
