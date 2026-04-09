"use client";
import React, { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { getJobsByCompany } from '@/services/jobsService';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Users, FileText, TrendingUp, Plus } from 'lucide-react';
import Link from 'next/link';

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

export const HRDashboard = () => {
  const { user } = useStore();
  const [jobs, setJobs] = useState<Array<{
    id: string;
    title: string;
    created_at: string;
    status: string;
    applications?: Array<{ id: string }>;
  }>>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    activeJobs: number;
    totalApplicants: number;
    interviewingCount: number;
    completionRate: number;
    funnel: Array<{ name: string; value: number }>;
    dailyApplicants: Array<{ name: string; applicants: number }>;
  } | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const fetchedJobs = (await getJobsByCompany()) as Array<{
          id: string;
          title: string;
          created_at: string;
          status: string;
          applications?: Array<{ id: string }>;
        }>;
        setJobs(fetchedJobs);
        setJobsError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch jobs.";
        setJobsError(message);
        console.error('Failed to fetch jobs:', error);
      }
      setIsLoadingJobs(false);
    };

    fetchJobs();
  }, [user?.id]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/hr/summary");
        const json = await res.json();
        if (res.ok && json.activeJobs != null) {
          setSummary({
            activeJobs: json.activeJobs,
            totalApplicants: json.totalApplicants,
            interviewingCount: json.interviewingCount ?? 0,
            completionRate: json.completionRate ?? 0,
            funnel: json.funnel || [],
            dailyApplicants: json.dailyApplicants || [],
          });
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">HR Dashboard</h1>
        <div className="flex gap-3">
          <Link href="/dashboard/hr/jobs/new">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Post New Job</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeJobs ?? "—"}</div>
            <p className="text-xs text-slate-500">Posted by your account</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applicants</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalApplicants ?? "—"}</div>
            <p className="text-xs text-slate-500">Applications on your jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interviewing</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.interviewingCount ?? "—"}</div>
            <p className="text-xs text-slate-500">Currently in interview stage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.completionRate ?? "—"}%</div>
            <p className="text-xs text-slate-500">Applications that reached COMPLETE</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Applicant Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary?.dailyApplicants || []}>
                  <defs>
                    <linearGradient id="colorApplicants" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="applicants" stroke="#6366f1" fillOpacity={1} fill="url(#colorApplicants)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Hiring Funnel</CardTitle>
            <CardDescription>Conversion rates across stages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary?.funnel || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(summary?.funnel || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {(summary?.funnel || []).map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-slate-600">{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Job Postings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoadingJobs ? (
              <div className="text-center py-8 text-slate-500">Loading jobs...</div>
            ) : jobsError ? (
              <div className="text-center py-8 text-red-600">{jobsError}</div>
            ) : jobs.length > 0 ? (
              jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                  <div>
                    <h4 className="font-semibold text-slate-900">{job.title}</h4>
                    <p className="text-xs text-slate-500">Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{job.applications ? job.applications.length : 0}</div>
                      <div className="text-xs text-slate-500">Applicants</div>
                    </div>
                    <Badge variant={job.status === 'PUBLISHED' ? 'success' : 'secondary'}>{job.status}</Badge>
                    <Button variant="ghost" size="sm">Manage</Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>No jobs posted yet.</p>
                <Link href="/dashboard/hr/jobs/new">
                  <Button variant="outline" className="mt-4">Create your first job</Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
