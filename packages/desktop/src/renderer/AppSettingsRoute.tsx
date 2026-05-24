import type { Dispatch, SetStateAction } from "react";
import type { DesktopAgentDetection, DesktopGraphViewModel, DesktopRuntimeToolAvailability } from "@planweave/runtime";
import { WindowTitleBar } from "./components/WindowTitleBar";
import type { createTranslator, Language } from "./i18n";
import type { AppView, DesktopUiSettings } from "./types";
import { SettingsView } from "./views/SettingsView";

type AppSettingsRouteProps = {
  agentDetectionRefreshing: boolean;
  agents: DesktopAgentDetection[];
  graph: DesktopGraphViewModel | null;
  language: Language;
  refreshAgentDetections: () => Promise<void>;
  refreshRuntimeTools: () => Promise<void>;
  runtimeTools: DesktopRuntimeToolAvailability;
  setActiveView: Dispatch<SetStateAction<AppView>>;
  settings: DesktopUiSettings;
  t: ReturnType<typeof createTranslator>;
  updateSettings: (patch: Partial<DesktopUiSettings>) => void;
};

export function AppSettingsRoute({
  agentDetectionRefreshing,
  agents,
  graph,
  language,
  refreshAgentDetections,
  refreshRuntimeTools,
  runtimeTools,
  setActiveView,
  settings,
  t,
  updateSettings
}: AppSettingsRouteProps) {
  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <WindowTitleBar t={t} />
      <SettingsView
        graph={graph}
        agents={agents}
        agentDetectionRefreshing={agentDetectionRefreshing}
        language={language}
        refreshAgentDetections={refreshAgentDetections}
        refreshRuntimeTools={refreshRuntimeTools}
        runtimeTools={runtimeTools}
        setActiveView={setActiveView}
        settings={settings}
        t={t}
        updateSettings={updateSettings}
      />
    </div>
  );
}
