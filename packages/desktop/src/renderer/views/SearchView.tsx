import type { Dispatch, SetStateAction } from "react";
import type { DesktopSearchResult, DesktopSearchResultKind } from "@planweave-ai/runtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchResultList } from "../components/SearchResultList";
import type { DesktopSearchCanvasScope } from "../hooks/useDesktopSearch";
import type { createTranslator } from "../i18n";

type SearchViewProps = {
  handleSearchResultOpen: (result: DesktopSearchResult) => Promise<void>;
  searchCanvasScope: DesktopSearchCanvasScope;
  searchQuery: string;
  searchResultKinds: DesktopSearchResultKind[];
  searchResults: DesktopSearchResult[];
  selectedCanvasId: string | null;
  selectedSearchResultKinds: DesktopSearchResultKind[];
  setSearchCanvasScope: Dispatch<SetStateAction<DesktopSearchCanvasScope>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setSearchResultKindEnabled: (kind: DesktopSearchResultKind, enabled: boolean) => void;
  t: ReturnType<typeof createTranslator>;
};

function searchKindLabel(kind: DesktopSearchResultKind, t: ReturnType<typeof createTranslator>): string {
  switch (kind) {
    case "task":
      return t("searchKindTask");
    case "block":
      return t("searchKindBlock");
    case "prompt":
      return t("searchKindPrompt");
    case "run_record":
      return t("searchKindRunRecord");
    case "review_attempt":
      return t("searchKindReviewAttempt");
    case "feedback":
      return t("searchKindFeedback");
  }
  const exhaustiveKind: never = kind;
  return exhaustiveKind;
}

export function SearchView({
  handleSearchResultOpen,
  searchCanvasScope,
  searchQuery,
  searchResultKinds,
  searchResults,
  selectedCanvasId,
  selectedSearchResultKinds,
  setSearchCanvasScope,
  setSearchQuery,
  setSearchResultKindEnabled,
  t
}: SearchViewProps) {
  const selectedKinds = new Set(selectedSearchResultKinds);
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-medium">{t("query")}</div>
      <Input data-testid="search-query-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium text-muted-foreground">{t("searchResultKinds")}</div>
        <div className="flex flex-wrap gap-2">
          {searchResultKinds.map((kind) => {
            const selected = selectedKinds.has(kind);
            return (
              <Button
                aria-pressed={selected}
                data-testid={`search-kind-${kind}`}
                key={kind}
                size="sm"
                variant={selected ? "secondary" : "outline"}
                onClick={() => setSearchResultKindEnabled(kind, !selected)}
              >
                {searchKindLabel(kind, t)}
              </Button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium text-muted-foreground">{t("searchCanvasScope")}</div>
        <div className="flex flex-wrap gap-2">
          <Button
            aria-pressed={searchCanvasScope === "all"}
            data-testid="search-scope-all"
            size="sm"
            variant={searchCanvasScope === "all" ? "secondary" : "outline"}
            onClick={() => setSearchCanvasScope("all")}
          >
            {t("searchScopeAllCanvases")}
          </Button>
          <Button
            aria-pressed={searchCanvasScope === "current"}
            data-testid="search-scope-current"
            disabled={!selectedCanvasId}
            size="sm"
            variant={searchCanvasScope === "current" ? "secondary" : "outline"}
            onClick={() => setSearchCanvasScope("current")}
          >
            {t("searchScopeCurrentCanvas")}
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[520px]">
        <SearchResultList results={searchResults} targetMissingLabel={t("searchTargetMissing")} onOpenResult={handleSearchResultOpen} />
      </ScrollArea>
    </div>
  );
}
