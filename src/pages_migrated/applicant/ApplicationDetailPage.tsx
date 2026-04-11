"use client";
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CheckCircle, Clock, FileText, Code, Video, BrainCircuit } from 'lucide-react';
import Link from 'next/link';

const stages = [
  { id: 1, name: 'Resume Screening', status: 'completed', score: 92, icon: FileText },
  { id: 2, name: 'Skills Assessment', status: 'completed', score: 88, icon: CheckCircle },
  { id: 3, name: 'Coding Challenge', status: 'current', score: null, icon: Code },
  { id: 4, name: 'AI Interview', status: 'locked', score: null, icon: Video },
  { id: 5, name: 'Final Review', status: 'locked', score: null, icon: BrainCircuit },
];

export const ApplicationDetailPage = () => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/applicant/applications" className="mb-2 inline-block text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300">
            &larr; Back to Applications
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Senior Frontend Engineer</h1>
          <p className="text-slate-500 dark:text-slate-300">TechCorp Inc. • Remote • $120k - $150k</p>
        </div>
        <Badge variant="primary" className="text-base px-3 py-1">In Progress</Badge>
      </div>

      {/* Progress Stepper */}
      <div className="relative">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 transform -translate-y-1/2"></div>
        <div className="flex justify-between w-full">
          {stages.map((stage) => {
            const isCompleted = stage.status === 'completed';
            const isCurrent = stage.status === 'current';
            const Icon = stage.icon;
            
            return (
              <div key={stage.id} className="flex flex-col items-center z-10 bg-slate-50 px-2">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                    ${isCompleted ? 'bg-green-100 border-green-500 text-green-600' : 
                      isCurrent ? 'bg-indigo-100 border-indigo-500 text-indigo-600 ring-4 ring-indigo-50' : 
                      'bg-white border-slate-300 text-slate-300'}`}
                >
                  <Icon size={20} />
                </div>
                <div className="mt-3 text-center">
                  <p className={`text-sm font-medium ${isCurrent ? 'text-indigo-700' : isCompleted ? 'text-green-700' : 'text-slate-500'}`}>
                    {stage.name}
                  </p>
                  {stage.score && (
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                      {stage.score}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Action */}
      <Card className="border-indigo-100 bg-indigo-50/50 dark:border-indigo-500/40 dark:bg-indigo-500/15">
        <CardHeader>
          <CardTitle className="text-indigo-900 dark:text-indigo-200">Current Stage: Coding Challenge</CardTitle>
          <CardDescription className="text-indigo-700 dark:text-indigo-300">
            You have been invited to take the coding assessment. This will take approximately 60 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Link href="/coding/challenge-123">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700">
                Start Challenge
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
              <Clock size={16} />
              Expires in 2 days
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Resume Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-300">Overall Match</span>
                <span className="font-bold text-green-600">92%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '92%' }}></div>
              </div>
              
              <div className="border-t border-slate-100 pt-4 dark:border-slate-700">
                <h4 className="font-medium mb-2">Key Skills Detected</h4>
                <div className="flex flex-wrap gap-2">
                  {['React', 'TypeScript', 'Tailwind', 'Node.js', 'Redux'].map(skill => (
                    <Badge key={skill} variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 relative border-l border-slate-200 ml-2 pl-6 pb-2">
              {[
                { event: "Application Submitted", date: "Oct 12, 10:30 AM", type: "info" },
                { event: "Resume Screened (Passed)", date: "Oct 12, 10:32 AM", type: "success" },
                { event: "Skills Assessment Completed", date: "Oct 13, 2:15 PM", type: "success" },
                { event: "Coding Challenge Invited", date: "Oct 14, 9:00 AM", type: "info" },
              ].map((item, i) => (
                <div key={i} className="relative mb-6 last:mb-0">
                  <div className={`absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 border-white ${item.type === 'success' ? 'bg-green-500' : 'bg-indigo-500'}`}></div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.event}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">{item.date}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
