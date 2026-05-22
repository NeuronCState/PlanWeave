import type { Dispatch, SetStateAction } from "react";
import type { DesktopRunRecord } from "@planweave/runtime";
import { SquareIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { createTranslator } from "../i18n";

type BlockRunRecordCardProps = {
  selectedRunRecord: DesktopRunRecord;
  setSelectedRunRecord: Dispatch<SetStateAction<DesktopRunRecord | null>>;
  t: ReturnType<typeof createTranslator>;
};

export function BlockRunRecordCard({ selectedRunRecord, setSelectedRunRecord, t }: BlockRunRecordCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">{t("runRecordDetail")}</CardTitle>
        <CardDescription>{selectedRunRecord.recordId}</CardDescription>
        <CardAction>
          <Button size="icon-sm" variant="ghost" aria-label={t("closeRecord")} onPointerDown={(event) => event.stopPropagation()} onClick={() => setSelectedRunRecord(null)}>
            <SquareIcon data-icon="inline-start" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex max-h-80 flex-col gap-2 overflow-hidden">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Badge variant="outline">{selectedRunRecord.adapter ?? t("manualExecutor")}</Badge>
          <Badge variant={selectedRunRecord.exitCode === 0 || selectedRunRecord.exitCode === null ? "secondary" : "destructive"}>{selectedRunRecord.exitCode ?? "-"}</Badge>
        </div>
        {selectedRunRecord.stdoutSummary ? (
          <div className="text-xs text-muted-foreground">
            {t("latestOutput")}: {selectedRunRecord.stdoutSummary}
          </div>
        ) : null}
        {selectedRunRecord.stderrSummary ? (
          <div className="text-xs text-destructive">
            {t("stderr")}: {selectedRunRecord.stderrSummary}
          </div>
        ) : null}
        <ScrollArea className="h-40 rounded-md border p-2">
          <pre className="whitespace-pre-wrap text-xs">{selectedRunRecord.reportMarkdown || selectedRunRecord.promptMarkdown}</pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
