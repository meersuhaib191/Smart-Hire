"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Search, MapPin, Briefcase, DollarSign, Filter, Star } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoadingSkeleton } from '@/components/ui/PageLoadingSkeleton';

type PublicJob = {
  id: string;
  title: string;
  description: string;
  created_at: string;
  company: string;
  skills: string[];
};

export const JobFeedPage = () => {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [applicationByJobId, setApplicationByJobId] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [types, setTypes] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/jobs', { cache: 'no-store' });
        const json = await res.json();
        if (res.ok) {
          setJobs(json.jobs || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/applicant/applications', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const rows = (json.applications || []) as Array<{ id: string; job_id: string }>;
        setAppliedJobIds(new Set(rows.map((r) => r.job_id)));
        const mapping: Record<string, string> = {};
        rows.forEach((r) => {
          mapping[r.job_id] = r.id;
        });
        setApplicationByJobId(mapping);
      } catch {
        // Ignore for anonymous visitors.
      }
    })();
  }, []);

  const toggleType = (type: string) => {
    setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const loc = location.trim().toLowerCase();

    return jobs.filter((job) => {
      const inferredType = job.title.toLowerCase().includes('intern') ? 'Internship' : 'Full-time';
      const matchesType = !types.length || types.includes(inferredType);
      const matchesQuery =
        !q ||
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        job.skills.some((skill) => skill.toLowerCase().includes(q));
      const matchesLocation = !loc || 'remote / flexible'.includes(loc);
      return matchesType && matchesQuery && matchesLocation;
    });
  }, [jobs, location, query, types]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Discover opportunities</h1>
        <p className="text-sm text-slate-500">Find jobs matched to your skills and apply in one click.</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Filters Sidebar */}
        <div className="w-full space-y-6 lg:w-72">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Filter size={20} />
            Filters
          </div>
          
          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardContent className="space-y-5 p-5">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Job Type</label>
              <div className="space-y-2">
                {['Full-time', 'Part-time', 'Contract', 'Internship'].map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={types.includes(type)}
                      onChange={() => toggleType(type)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Experience Level</label>
              <div className="space-y-2">
                {['Entry Level', 'Mid Level', 'Senior', 'Lead'].map((level) => (
                  <label key={level} className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    {level}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Salary Range</label>
              <input type="range" min="0" max="200" className="w-full" />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>$0k</span>
                <span>$200k+</span>
              </div>
            </div>
            </CardContent>
          </Card>
        </div>

        {/* Job List */}
        <div className="flex-1 space-y-4">
          <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_auto]">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by job title, skill, or company" 
                className="pl-10"
              />
            </div>
            <div className="w-1/3 relative hidden md:block">
              <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location" 
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="rounded-lg">{filteredJobs.length} results</Button>
          </div>

          <div className="space-y-3">
            {loading ? <PageLoadingSkeleton /> : filteredJobs.map((job) => (
              <Card key={job.id} className="rounded-2xl border-slate-200/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(job.company)}&background=111827&color=fff`}
                      alt={job.company}
                      className="h-12 w-12 rounded-xl object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600">{job.title}</h3>
                          <p className="text-slate-500 font-medium">{job.company}</p>
                        </div>
                        <Badge variant="secondary">Published</Badge>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <MapPin size={16} />
                          Remote / Flexible
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign size={16} />
                          Not specified
                        </div>
                        <div className="flex items-center gap-1">
                          <Briefcase size={16} />
                          {job.title.toLowerCase().includes('intern') ? 'Internship' : 'Full-time'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Star size={16} />
                          {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {job.skills.map((skill) => (
                          <span key={skill} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="self-center">
                      {appliedJobIds.has(job.id) ? (
                        <Link href={applicationByJobId[job.id] ? `/dashboard/applicant/applications/${applicationByJobId[job.id]}` : "/dashboard/applicant/applications"}>
                          <Button variant="secondary" className="rounded-lg">Already Applied</Button>
                        </Link>
                      ) : (
                        <Link href={`/jobs/${job.id}/apply`}>
                          <Button variant="outline" className="rounded-lg">Apply</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loading && filteredJobs.length === 0 && (
              <EmptyState
                title="No jobs match your filters."
                description="Try removing a filter or broadening your search."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
