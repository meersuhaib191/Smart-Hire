"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";

type AppRow = {
  id: string;
  pipeline_step: string;
  current_stage: string;
  applied_at: string;
  jobs: { title: string } | null;
};

export default function Page() {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/applicant/applications");
        const json = await res.json();
        if (res.ok) setRows(json.applications || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">My Applications</h1>
      <Card>
        <CardHeader>
          <CardTitle>Active Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="text-sm text-slate-500">No applications yet.</p>
          ) : null}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <p className="font-medium">{r.jobs?.title || "Job"}</p>
                <p className="text-xs text-slate-500">
                  Stage: {r.pipeline_step} · Status: {r.current_stage}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{r.pipeline_step}</Badge>
                <Link href={`/dashboard/applicant/applications/${r.id}`}>
                  <Button size="sm" variant="outline">
                    Open
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}