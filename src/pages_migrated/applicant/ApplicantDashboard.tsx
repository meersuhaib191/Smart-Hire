"use client";
import React from 'react';
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
  LineChart,
  Line
} from 'recharts';
import { Briefcase, Calendar, CheckCircle, Clock, Trophy, Video } from 'lucide-react';
import Link from 'next/link';

const data = [
  { name: 'Jan', applications: 2 },
  { name: 'Feb', applications: 5 },
  { name: 'Mar', applications: 3 },
  { name: 'Apr', applications: 8 },
  { name: 'May', applications: 4 },
  { name: 'Jun', applications: 6 },
];

export const ApplicantDashboard = () => {
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
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-slate-500">+2 from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interviews</CardTitle>
            <Calendar className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-slate-500">Scheduled this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profile Score</CardTitle>
            <Trophy className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
            <p className="text-xs text-slate-500">Top 15% of candidates</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42%</div>
            <p className="text-xs text-slate-500">+4% from average</p>
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
                <BarChart data={data}>
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
              {[
                {
                  role: "Frontend Developer",
                  company: "TechFlow",
                  status: "Interview",
                  date: "2 days ago",
                  icon: <Video className="h-4 w-4 text-indigo-500" />,
                  color: "bg-indigo-100"
                },
                {
                  role: "Product Designer",
                  company: "Creative Inc",
                  status: "Review",
                  date: "5 days ago",
                  icon: <Clock className="h-4 w-4 text-amber-500" />,
                  color: "bg-amber-100"
                },
                {
                  role: "React Engineer",
                  company: "StartUp Co",
                  status: "Rejected",
                  date: "1 week ago",
                  icon: <CheckCircle className="h-4 w-4 text-slate-500" />,
                  color: "bg-slate-100"
                },
              ].map((item, i) => (
                <div key={i} className="flex items-center">
                  <div className={`mr-4 h-9 w-9 rounded-full flex items-center justify-center ${item.color}`}>
                    {item.icon}
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium leading-none">{item.role}</p>
                    <p className="text-xs text-slate-500">{item.company}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={item.status === 'Interview' ? 'primary' : item.status === 'Review' ? 'warning' : 'secondary'}>
                      {item.status}
                    </Badge>
                    <p className="text-xs text-slate-400 mt-1">{item.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
