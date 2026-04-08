"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PipelineStageId, stageLabels } from "./types";

type PipelineStageColumnProps = {
  stage: PipelineStageId;
  count: number;
  conversionRate: number;
  onDropApplication: (applicationId: string, stage: PipelineStageId) => void;
  children: ReactNode;
};

export function PipelineStageColumn({
  stage,
  count,
  conversionRate,
  onDropApplication,
  children,
}: PipelineStageColumnProps) {
  return (
    <Card
      className="min-h-[280px] rounded-2xl border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const appId = e.dataTransfer.getData("applicationId");
        if (appId) onDropApplication(appId, stage);
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold text-slate-900">{stageLabels[stage]}</CardTitle>
          <Badge variant="secondary">{count}</Badge>
        </div>
        <p className="text-xs text-slate-500">Conversion: {conversionRate.toFixed(0)}%</p>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

