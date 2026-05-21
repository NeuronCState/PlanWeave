import type { Dispatch, SetStateAction } from "react";
import type { DesktopGraphViewModel } from "@planweave/runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaletteSettingsPanel } from "../components/PaletteSettingsPanel";
import type { createTranslator, Language } from "../i18n";
import type { AppearanceMode, DesktopUiSettings } from "../types";

type SettingsViewProps = {
  graph: DesktopGraphViewModel | null;
  language: Language;
  setProjectPath: Dispatch<SetStateAction<string>>;
  settings: DesktopUiSettings;
  t: ReturnType<typeof createTranslator>;
  updateSettings: (patch: Partial<DesktopUiSettings>) => void;
};

export function SettingsView({ graph, language, setProjectPath, settings, t, updateSettings }: SettingsViewProps) {
  return (
    <Card className="mx-auto w-full max-w-5xl">
      <CardHeader>
        <CardTitle>{t("settings")}</CardTitle>
        <CardDescription>{t("runtimePathHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <FieldLabel>{t("runtimePath")}</FieldLabel>
              <Input
                value={settings.runtimePath}
                onChange={(event) => {
                  updateSettings({ runtimePath: event.target.value });
                  setProjectPath(event.target.value);
                }}
              />
              <FieldDescription>{t("runtimePathHint")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>{t("defaultExecutor")}</FieldLabel>
              <Select value={settings.defaultExecutor || "__manual"} onValueChange={(value) => updateSettings({ defaultExecutor: value === "__manual" ? "" : value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__manual">{t("manualExecutor")}</SelectItem>
                    {graph?.executorOptions.map((executor) => (
                      <SelectItem value={executor} key={executor}>
                        {executor}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t("appearance")}</FieldLabel>
              <Select value={settings.appearance} onValueChange={(value) => updateSettings({ appearance: value as AppearanceMode })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="system">{t("appearanceSystem")}</SelectItem>
                    <SelectItem value="light">{t("appearanceLight")}</SelectItem>
                    <SelectItem value="dark">{t("appearanceDark")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <FieldLabel>{t("language")}</FieldLabel>
              <Select value={language} onValueChange={(value) => updateSettings({ language: value as Language })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="system">{t("systemLanguage")}</SelectItem>
                    <SelectItem value="zh-CN">简体中文</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <FieldLabel>{t("notificationRules")}</FieldLabel>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              {[
                { key: "autoRunFailure", label: t("notifyAutoRun") },
                { key: "graphExceptions", label: t("notifyGraphExceptions") },
                { key: "dirtyPrompts", label: t("notifyDirtyPrompts") },
                { key: "fileSyncConflict", label: t("notifyFileSync") }
              ].map(({ key, label }) => (
                <Select
                  key={key}
                  value={settings.notifications[key as keyof DesktopUiSettings["notifications"]] ? "enabled" : "disabled"}
                  onValueChange={(value) =>
                    updateSettings({
                      notifications: {
                        ...settings.notifications,
                        [key]: value === "enabled"
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
                      <SelectItem value="disabled">{t("disabled")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ))}
            </div>
          </Field>
          <PaletteSettingsPanel
            labels={{
              blockSetImplementation: t("blockSetImplementation"),
              blockSetImplementationCheck: t("blockSetImplementationCheck"),
              blockSetImplementationCheckReview: t("blockSetImplementationCheckReview"),
              checkBlock: t("checkBlock"),
              componentVisibility: t("componentVisibility"),
              contextNode: t("contextNode"),
              defaultBlockSet: t("defaultBlockSet"),
              disabled: t("disabled"),
              dragHint: t("dragHint"),
              enabled: t("enabled"),
              implementationBlock: t("implementationBlock"),
              paletteSettings: t("paletteSettings"),
              reviewBlock: t("reviewBlock"),
              taskNode: t("taskNode")
            }}
            settings={settings}
            updateSettings={updateSettings}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
