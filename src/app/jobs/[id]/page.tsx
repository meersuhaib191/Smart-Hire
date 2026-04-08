"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Briefcase, Building2, Clock3, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type JobDetail = {
  id: string;
  title: string;
  description: string;
  created_at: string;
  status: string;
  company: string;
  skills: string[];
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (res.ok) setJob(json.job || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <p className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">Loading job details...</p>;
  }
  if (!job) {
    return <p className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">Job not found.</p>;
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Link href="/jobs" className="text-sm text-slate-500 transition hover:text-slate-900">
          ← Back to jobs
        </Link>

        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-3xl font-semibold">{job.title}</CardTitle>
                <CardDescription className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1"><Building2 size={14} /> {job.company}</span>
                  <span className="inline-flex items-center gap-1"><MapPin size={14} /> Remote / Flexible</span>
                  <span className="inline-flex items-center gap-1"><Clock3 size={14} /> {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
                </CardDescription>
              </div>
              <Badge variant="secondary">{job.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Role Overview</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {job.description || "Description not provided."}
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Requirements</h3>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill) => (
                  <Badge key={skill} variant="outline">{skill}</Badge>
                ))}
                {job.skills.length === 0 ? <p className="text-sm text-slate-500">No skills listed.</p> : null}
              </div>
            </section>
          </CardContent>
        </Card>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Apply for this role</CardTitle>
            <CardDescription>Ready to move forward? Submit your profile and resume.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full rounded-xl">
              <Link href={`/jobs/${job.id}/apply`}>
                <Briefcase className="mr-2 h-4 w-4" />
                Apply Now
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full rounded-xl">
              <Link href="/dashboard/applicant/applications">Track Applications</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

