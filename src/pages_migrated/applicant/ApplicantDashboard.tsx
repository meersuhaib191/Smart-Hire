"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Briefcase, Calendar, CheckCircle, Clock, Trophy, Video } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

type ApplicationRow = {
  id: string;
  job_id: string;
  pipeline_step?: string | null;
  current_stage?: string | null;
  applied_at?: string | null;
  jobs?: { title?: string | null } | null;
};

const stageLabel = (value?: string | null) => {
  const v = (value || '').toUpperCase();
  if (!v) return 'Applied';
  if (v === 'ATS') return 'Screening';
  if (v === 'MCQ') return 'MCQ';
  if (v === 'CODING') return 'Coding';
  if (v === 'INTERVIEW') return 'Interview';
  if (v === 'COMPLETE') return 'Complete';
  return value || 'Applied';
};

export const ApplicantDashboard = () => {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/applicant/applications');
        const json = await res.json();
        if (res.ok) {
          setApplications(json.applications || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const total = applications.length;
    const interviewCount = applications.filter((a) => {
      const step = (a.pipeline_step || a.current_stage || '').toUpperCase();
      return step === 'INTERVIEW' || step === 'COMPLETE';
    }).length;
    const completedCount = applications.filter((a) => (a.pipeline_step || '').toUpperCase() === 'COMPLETE').length;
    const activeCount = applications.filter((a) => (a.pipeline_step || '').toUpperCase() !== 'COMPLETE').length;
    const responseRate = total ? Math.round((completedCount / total) * 100) : 0;
    return { total, interviewCount, completedCount, activeCount, responseRate };
  }, [applications]);

  const monthlyData = useMemo(() => {
    const monthMap = new Map<string, number>();
    applications.forEach((item) => {
      if (!item.applied_at) return;
      const date = new Date(item.applied_at);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });
    return Array.from(monthMap.entries())
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .slice(-6)
      .map(([key, count]) => {
        const [year, month] = key.split('-').map(Number);
        const d = new Date(year, month - 1, 1);
        return { name: d.toLocaleString('en-US', { month: 'short' }), applications: count };
      });
  }, [applications]);

  const recentApplications = useMemo(
    () =>
      [...applications]
        .sort((a, b) => new Date(b.applied_at || 0).getTime() - new Date(a.applied_at || 0).getTime())
        .slice(0, 3),
    [applications]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <div className="flex gap-3">
          <Link href="/jobs">
            <Button>Find Jobs</Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Applications</CardTitle>
            <Briefcase className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : stats.total}</div>
            <p className="text-xs text-slate-500">Total submitted by you</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interviews</CardTitle>
            <Calendar className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : stats.interviewCount}</div>
            <p className="text-xs text-slate-500">Interview or completed stage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profile Score</CardTitle>
            <Trophy className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : `${stats.responseRate}%`}</div>
            <p className="text-xs text-slate-500">Completed pipeline rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : stats.activeCount}</div>
            <p className="text-xs text-slate-500">Applications still in progress</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Activity Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Application Activity</CardTitle>
            <CardDescription>Your application history over the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}`} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Bar dataKey="applications" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Applications */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Applications</CardTitle>
            <CardDescription>Latest updates on your job search.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentApplications.map((item) => {
                const status = stageLabel(item.pipeline_step || item.current_stage);
                const isInterview = status === 'Interview';
                const isDone = status === 'Complete';
                return (
                <div key={item.id} className="flex items-center">
                  <div className={`mr-4 h-9 w-9 rounded-full flex items-center justify-center ${isInterview ? 'bg-indigo-100' : isDone ? 'bg-green-100' : 'bg-amber-100'}`}>
                    {isInterview ? <Video className="h-4 w-4 text-indigo-500" /> : isDone ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-amber-500" />}
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium leading-none">{item.jobs?.title || 'Untitled role'}</p>
                    <p className="text-xs text-slate-500">{item.job_id}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={isInterview ? 'primary' : status === 'Screening' ? 'warning' : 'secondary'}>
                      {status}
                    </Badge>
                    <p className="text-xs text-slate-400 mt-1">{item.applied_at ? formatDistanceToNow(new Date(item.applied_at), { addSuffix: true }) : '—'}</p>
                  </div>
                </div>
              )})}
              {!loading && recentApplications.length === 0 && (
                <p className="text-sm text-slate-500">No applications yet. Start by applying to a job.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
