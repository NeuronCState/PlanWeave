import type { DesktopStatistics } from "@planweave-ai/runtime";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { createTranslator } from "../i18n";
import { formatElapsed, formatPercent } from "../viewHelpers";

type StatisticsViewProps = {
  statistics: DesktopStatistics | null;
  t: ReturnType<typeof createTranslator>;
};

export function StatisticsView({ statistics, t }: StatisticsViewProps) {
  return statistics ? (
    <div className="grid grid-cols-4 gap-3">
      <StatCard label={t("tasks")} value={`${statistics.implementedTaskCount}/${statistics.taskTotal}`} />
      <StatCard label={t("implementedRatio")} value={formatPercent(statistics.implementedRatio)} />
      <StatCard label={t("taskThroughput")} value={String(statistics.taskThroughput)} />
      <StatCard label={t("averageImplementationTime")} value={statistics.averageImplementationTimeMs === null ? "-" : formatElapsed(statistics.averageImplementationTimeMs)} />
      <StatCard label={t("remaining")} value={String(statistics.estimatedRemainingBlocks)} />
      <StatCard label={t("reviewsPassed")} value={String(statistics.reviewPassedCount)} />
      <StatCard label={t("reviewPassedRatio")} value={formatPercent(statistics.reviewPassedRatio)} />
      <StatCard label={t("feedback")} value={String(statistics.feedbackEnvelopeCount)} />
      <StatCard label={t("reworkCount")} value={String(statistics.reworkCount)} />
    </div>
  ) : null;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
