/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createTranslator } from "../renderer/i18n";
import { DesktopDiagnosticsPopover } from "../renderer/run/DesktopDiagnosticsPopover";
import { cleanupRendererTestEnvironment } from "./helpers/rendererTestEnvironment";

const t = createTranslator("en");

afterEach(() => {
  cleanupRendererTestEnvironment();
});

describe("DesktopDiagnosticsPopover", () => {
  it("opens with performance diagnostics expanded when diagnostics exist", async () => {
    render(
      <DesktopDiagnosticsPopover
        diagnostics={[{ code: "desktop_projection_slow_part", message: "Desktop projection project aggregation took 12 ms.", path: "project" }]}
        disabled={false}
        t={t}
      />
    );

    const triggerIcon = screen.getByRole("button", { name: "View desktop diagnostics" }).querySelector("svg");
    expect(triggerIcon).toHaveClass("lucide-gauge");
    expect(triggerIcon).not.toHaveClass("lucide-triangle-alert");

    await userEvent.click(screen.getByRole("button", { name: "View desktop diagnostics" }));

    expect(screen.getByTestId("desktop-diagnostics-popover")).toBeVisible();
    expect(screen.getByTestId("performance-diagnostics-section")).toHaveTextContent("Performance diagnostics (1)");
    expect(screen.getByTestId("desktop-performance-diagnostic")).toHaveTextContent("desktop_projection_slow_part");
    expect(screen.getByTestId("desktop-performance-diagnostic")).toHaveTextContent("Desktop projection project aggregation took 12 ms.");
  });

  it("renders search diagnostics in the search section", async () => {
    render(
      <DesktopDiagnosticsPopover
        diagnostics={[
          { code: "desktop_projection_slow_part", message: "Desktop projection project aggregation took 12 ms.", path: "project" },
          { code: "desktop_result_metadata_read_failed", message: "Result metadata could not be read.", path: "results/run.json" }
        ]}
        disabled={false}
        t={t}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "View desktop diagnostics" }));
    await userEvent.click(within(screen.getByTestId("search-diagnostics-section")).getByRole("button", { name: "Search diagnostics (1)" }));

    expect(screen.getByTestId("search-diagnostics-section")).toHaveTextContent("desktop_result_metadata_read_failed");
    expect(screen.getByTestId("desktop-search-diagnostic")).toHaveTextContent("Result metadata could not be read.");
    expect(screen.getByTestId("performance-diagnostics-section")).not.toHaveTextContent("desktop_result_metadata_read_failed");
  });

  it("renders runtime diagnostics in the runtime section", async () => {
    render(
      <DesktopDiagnosticsPopover
        diagnostics={[{ code: "auto_run_state_invalid_json", message: "Auto Run state could not be parsed.", path: "state.json" }]}
        disabled={false}
        t={t}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "View desktop diagnostics" }));

    expect(screen.getByTestId("runtime-diagnostics-section")).toHaveTextContent("Runtime diagnostics (1)");
    expect(screen.getByTestId("desktop-runtime-diagnostic")).toHaveTextContent("auto_run_state_invalid_json");
    expect(screen.getByTestId("desktop-runtime-diagnostic")).toHaveTextContent("state.json");
  });

  it("shows an empty state when there are no diagnostics", async () => {
    render(<DesktopDiagnosticsPopover diagnostics={[]} disabled={false} t={t} />);

    await userEvent.click(screen.getByRole("button", { name: "View desktop diagnostics" }));

    expect(screen.getByTestId("desktop-diagnostics-empty")).toHaveTextContent("No desktop diagnostics to review");
    expect(screen.queryByTestId("performance-diagnostics-section")).not.toBeInTheDocument();
  });

  it("disables the trigger while project actions are unavailable", () => {
    render(<DesktopDiagnosticsPopover diagnostics={[]} disabled={true} t={t} />);

    expect(screen.getByRole("button", { name: "View desktop diagnostics" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "View desktop diagnostics" }).querySelector("svg")).toHaveClass("lucide-gauge");
  });
});
