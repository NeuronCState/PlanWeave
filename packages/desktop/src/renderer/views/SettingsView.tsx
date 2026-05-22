import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DesktopGraphViewModel } from "@planweave/runtime";
import { ArrowLeftIcon, BlocksIcon, GitPullRequestIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaletteSettingsPanel } from "../components/PaletteSettingsPanel";
import type { createTranslator, Language } from "../i18n";
import type { AppView, AppearanceMode, DesktopUiSettings } from "../types";
import { ReviewPipelineView, type ReviewPipelineViewProps } from "./ReviewPipelineView";

type SettingsSection = "general" | "components" | "review";

type SettingsViewProps = ReviewPipelineViewProps & {
  graph: DesktopGraphViewModel | null;
  language: Language;
  setActiveView: Dispatch<SetStateAction<AppView>>;
  setProjectPath: Dispatch<SetStateAction<string>>;
  settings: DesktopUiSettings;
  t: ReturnType<typeof createTranslator>;
  updateSettings: (patch: Partial<DesktopUiSettings>) => void;
};

export function SettingsView({ graph, language, setActiveView, setProjectPath, settings, t, updateSettings, ...reviewProps }: SettingsViewProps) {
  const [section, setSection] = useState<SettingsSection>("general");
  const navItems = [
    { key: "general", label: t("settingsGeneral"), icon: SettingsIcon },
    { key: "components", label: t("settingsComponents"), icon: BlocksIcon },
    { key: "review", label: t("settingsReview"), icon: GitPullRequestIcon }
  ] satisfies Array<{ key: SettingsSection; label: string; icon: typeof SettingsIcon }>;

  return (
    <main className="flex h-full min-h-0 bg-background text-foreground">
      <aside className="flex w-[260px] shrink-0 flex-col border-r bg-sidebar p-3">
        <Button className="mb-4 justify-start text-muted-foreground" variant="ghost" onClick={() => setActiveView("graph")}>
          <ArrowLeftIcon data-icon="inline-start" />
          {t("backToApp")}
        </Button>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button className="justify-start" key={item.key} variant={section === item.key ? "secondary" : "ghost"} onClick={() => setSection(item.key)}>
                <Icon data-icon="inline-start" />
                {item.label}
              </Button>
            );
          })}
        </nav>
      </aside>
      <ScrollArea className="min-w-0 flex-1">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-12 py-10">
          {section === "general" ? (
            <section className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-semibold tracking-normal">{t("settingsGeneral")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("settingsGeneralHint")}</p>
              </div>
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
              </FieldGroup>
            </section>
          ) : null}
          {section === "components" ? (
            <section className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-semibold tracking-normal">{t("settingsComponents")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("settingsComponentsHint")}</p>
              </div>
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
            </section>
          ) : null}
          {section === "review" ? (
            <section className="flex h-[calc(100vh-5rem)] min-h-[640px] flex-col gap-6">
              <div>
                <h1 className="text-2xl font-semibold tracking-normal">{t("settingsReview")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("settingsReviewHint")}</p>
              </div>
              <ReviewPipelineView graph={graph} t={t} {...reviewProps} />
            </section>
          ) : null}
        </div>
      </ScrollArea>
    </main>
  );
}
