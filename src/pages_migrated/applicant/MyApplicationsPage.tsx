"use client";
import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Search, Filter, Eye } from 'lucide-react';
import { Input } from '@/components/ui/Input';

const applications = [
  { id: 1, job: 'Senior Frontend Engineer', company: 'TechCorp Inc.', stage: 'Coding Challenge', updated: '2 days ago', status: 'In Progress' },
  { id: 2, job: 'Product Designer', company: 'Creative Studio', stage: 'Resume Screening', updated: '5 days ago', status: 'Pending' },
  { id: 3, job: 'Backend Developer', company: 'CloudSystems', stage: 'Final Review', updated: '1 week ago', status: 'Completed' },
  { id: 4, job: 'Full Stack Engineer', company: 'StartupXY', stage: 'Rejected', updated: '2 weeks ago', status: 'Rejected' },
];

export const MyApplicationsPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">My Applications</h1>
        <Button leftIcon={<Filter className="h-4 w-4" />} variant="outline">Filter</Button>
      </div>

      <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <Input 
          placeholder="Search applications..." 
          className="max-w-md border-slate-200" 
          leftIcon={<Search className="h-4 w-4 text-slate-400" />} 
        />
        <div className="flex-1"></div>
        <span className="text-sm text-slate-500 dark:text-slate-300">Showing 4 applications</span>
      </div>

      <Card>
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm text-left">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-slate-50/50 data-[state=selected]:bg-slate-50 border-slate-200">
                <th className="h-12 px-4 align-middle font-medium text-slate-500">Job Role</th>
                <th className="h-12 px-4 align-middle font-medium text-slate-500">Company</th>
                <th className="h-12 px-4 align-middle font-medium text-slate-500">Stage</th>
                <th className="h-12 px-4 align-middle font-medium text-slate-500">Last Updated</th>
                <th className="h-12 px-4 align-middle font-medium text-slate-500">Status</th>
                <th className="h-12 px-4 align-middle font-medium text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {applications.map((app) => (
                <tr key={app.id} className="border-b transition-colors hover:bg-slate-50 data-[state=selected]:bg-slate-50 border-slate-100">
                  <td className="p-4 align-middle font-medium text-slate-900">{app.job}</td>
                  <td className="p-4 align-middle text-slate-600">{app.company}</td>
                  <td className="p-4 align-middle">
                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100">
                      {app.stage}
                    </Badge>
                  </td>
                  <td className="p-4 align-middle text-slate-500">{app.updated}</td>
                  <td className="p-4 align-middle">
                    <Badge 
                      variant={
                        app.status === 'In Progress' ? 'primary' : 
                        app.status === 'Completed' ? 'success' : 
                        app.status === 'Rejected' ? 'error' : 'secondary'
                      }
                    >
                      {app.status}
                    </Badge>
                  </td>
                  <td className="p-4 align-middle text-right">
                    <Link href={`/dashboard/applicant/applications/${app.id}`}>
                      <Button variant="ghost" size="sm" leftIcon={<Eye className="h-4 w-4" />}>
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
