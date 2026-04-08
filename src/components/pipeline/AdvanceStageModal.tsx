"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PipelineStageId, stageLabels } from "./types";

type AdvanceStageModalProps = {
  fromStage: PipelineStageId;
  nextStage: PipelineStageId;
  max: number;
  onConfirm: (topN: number) => Promise<void> | void;
  disabled?: boolean;
};

export function AdvanceStageModal({ fromStage, nextStage, max, onConfirm, disabled }: AdvanceStageModalProps) {
  const safeMax = Math.max(1, max);
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(Math.min(5, safeMax));
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl" disabled={disabled}>
          Advance Top Candidates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Advance Candidates to {stageLabels[nextStage]}</DialogTitle>
          <DialogDescription>
            Select how many top-ranked applicants to move from {stageLabels[fromStage]} to {stageLabels[nextStage]}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">Top candidates to advance</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{n}</p>
          </div>
          <Slider
            value={[n]}
            min={1}
            max={safeMax}
            step={1}
            onValueChange={(v) => setN(v[0] || 1)}
          />
          <p className="text-xs text-slate-500">Available in stage: {safeMax}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm(n);
                setOpen(false);
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? "Advancing..." : `Advance ${n} Candidates`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

