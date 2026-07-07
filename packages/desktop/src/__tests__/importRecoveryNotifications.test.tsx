/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultDesktopSettings } from "../shared/desktopSettings";
import { createTranslator } from "../renderer/i18n";
import { buildNotificationItems } from "../renderer/notifications";
import { NotificationsView } from "../renderer/views/NotificationsView";

describe("import recovery notifications", () => {
  it("builds a pending import recovery notification from runtime summaries", () => {
    const notifications = buildNotificationItems({
      autoRunState: null,
      fileSyncDiagnostics: [],
      graph: null,
      lastFileChange: null,
      pendingImportRecoveries: [
        {
          transactionId: "import-tx-1",
          recoveryRoot: "/tmp/project/desktop/recovery/package-import/import-tx-1",
          createdAt: "2026-07-06T00:00:00.000Z",
          operationCount: 3,
          phases: ["prepared", "applied"]
        }
      ],
      promptConflicts: [],
      settings: defaultDesktopSettings,
      t: createTranslator("en")
    });

    expect(notifications).toEqual([
      {
        id: "import-recovery:import-tx-1",
        title: "Unfinished import recovery found",
        detail: "Transaction: import-tx-1 · Operations: 3 · Phases: prepared, applied",
        tone: "destructive",
        kind: "importRecovery",
        transactionId: "import-tx-1",
        read: false
      }
    ]);
  });

  it("passes the pending import transaction id to the rollback action", async () => {
    const onRollbackImportRecovery = vi.fn().mockResolvedValue(undefined);

    render(
      <NotificationsView
        notificationItems={[
          {
            id: "import-recovery:import-tx-1",
            title: "发现未完成的导入恢复",
            detail: "事务: import-tx-1 · 操作数: 3 · 阶段: prepared, applied",
            tone: "destructive",
            read: false,
            kind: "importRecovery",
            transactionId: "import-tx-1"
          }
        ]}
        onApplyLocalPromptConflicts={vi.fn()}
        onKeepLocalPromptConflicts={vi.fn()}
        onMarkNotificationRead={vi.fn()}
        onOpenGraph={vi.fn()}
        onReloadPromptConflicts={vi.fn()}
        onRollbackImportRecovery={onRollbackImportRecovery}
        refreshPackageFiles={vi.fn()}
        t={createTranslator("zh-CN")}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "回滚导入" }));

    expect(onRollbackImportRecovery).toHaveBeenCalledWith("import-tx-1");
  });
});
