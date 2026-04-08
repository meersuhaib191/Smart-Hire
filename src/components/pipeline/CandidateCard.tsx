"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CandidateRow, PipelineStageId, scoreFor, stageLabels } from "./types";
import { Eye, MoveRight, UserX } from "lucide-react";

type CandidateCardProps = {
  candidate: CandidateRow;
  onMove: (applicationId: string, targetStage: PipelineStageId) => void;
  onReject: (applicationId: string) => void;
  onView: (applicationId: string) => void;
};

const initials = (email: string) =>
  email
    .split("@")[0]
    .split(/[._-]/g)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2) || "CA";

export function CandidateCard({ candidate, onMove, onReject, onView }: CandidateCardProps) {
  const score = scoreFor(candidate);
  const pipelineStep = String(candidate.pipelineStep || "ATS").toUpperCase() as PipelineStageId;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("applicationId", candidate.applicationId);
      }}
      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-9 w-9 border border-slate-200">
            <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">
              {initials(candidate.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{candidate.email}</p>
            <p className="text-xs text-slate-500">Rank #{candidate.rankPosition ?? "—"}</p>
          </div>
        </div>
        <Badge variant={score >= 75 ? "success" : score >= 50 ? "warning" : "secondary"}>
          {score.toFixed(1)}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{stageLabels[pipelineStep] || pipelineStep}</Badge>
        {candidate.stages.slice(0, 2).map((s) => (
          <Badge key={`${candidate.applicationId}-${s.stage_type}`} variant="secondary">
            {String(s.stage_type).toUpperCase()}: {Number(s.score).toFixed(0)}
          </Badge>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 opacity-80 transition group-hover:opacity-100">
        <Button size="sm" variant="outline" className="rounded-xl px-2" onClick={() => onView(candidate.applicationId)}>
          <Eye size={14} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl px-2"
          onClick={() => onMove(candidate.applicationId, "INTERVIEW")}
          title="Quick move to interview"
        >
          <MoveRight size={14} />
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl px-2" onClick={() => onReject(candidate.applicationId)}>
          <UserX size={14} />
        </Button>
      </div>
    </div>
  );
}

