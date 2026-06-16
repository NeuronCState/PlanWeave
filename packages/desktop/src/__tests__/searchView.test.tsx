/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DesktopSearchResultKind } from "@planweave-ai/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopSearchCanvasScope } from "../renderer/hooks/useDesktopSearch";
import { createTranslator } from "../renderer/i18n";
import { SearchView } from "../renderer/views/SearchView";

const searchResultKinds: DesktopSearchResultKind[] = ["task", "block", "prompt", "run_record", "review_attempt", "feedback"];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SearchView", () => {
  it("updates result kind and canvas scope controls through props", async () => {
    function SearchHarness() {
      const [selectedKinds, setSelectedKinds] = useState<DesktopSearchResultKind[]>(searchResultKinds);
      const [scope, setScope] = useState<DesktopSearchCanvasScope>("all");
      return (
        <SearchView
          handleSearchResultOpen={vi.fn().mockResolvedValue(undefined)}
          searchCanvasScope={scope}
          searchQuery=""
          searchResultKinds={searchResultKinds}
          searchResults={[]}
          selectedCanvasId="canvas-main"
          selectedSearchResultKinds={selectedKinds}
          setSearchCanvasScope={setScope}
          setSearchQuery={vi.fn()}
          setSearchResultKindEnabled={(kind, enabled) => {
            setSelectedKinds((current) => (enabled ? [...current, kind] : current.filter((selected) => selected !== kind)));
          }}
          t={createTranslator("en")}
        />
      );
    }

    render(<SearchHarness />);

    expect(screen.getByTestId("search-kind-feedback")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByTestId("search-kind-feedback"));
    expect(screen.getByTestId("search-kind-feedback")).toHaveAttribute("aria-pressed", "false");

    expect(screen.getByTestId("search-scope-all")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByTestId("search-scope-current"));
    expect(screen.getByTestId("search-scope-current")).toHaveAttribute("aria-pressed", "true");
  });
});
