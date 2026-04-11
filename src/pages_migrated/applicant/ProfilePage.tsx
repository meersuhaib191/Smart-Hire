"use client";
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Mail, Phone, MapPin, Upload, Briefcase, GraduationCap } from 'lucide-react';

export const ProfilePage = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">My Profile</h1>
        <Button>Save Changes</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Basic Info */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-slate-200 mb-4 overflow-hidden">
                <img src="https://ui-avatars.com/api/?name=Alex+Morgan&background=random" alt="Profile" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Alex Morgan</h2>
              <p className="text-slate-500 dark:text-slate-300">Senior Frontend Developer</p>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm">Change Photo</Button>
              </div>
              
              <div className="w-full mt-6 space-y-3">
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <Mail size={16} />
                  alex@example.com
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <Phone size={16} />
                  +1 (555) 123-4567
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <MapPin size={16} />
                  San Francisco, CA
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['React', 'TypeScript', 'Node.js', 'TailwindCSS', 'GraphQL', 'Next.js'].map(skill => (
                  <Badge key={skill} variant="secondary">{skill}</Badge>
                ))}
                <Badge variant="outline" className="border-dashed cursor-pointer hover:bg-slate-50">+ Add</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Detailed Info */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Professional Experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { role: "Senior Frontend Developer", company: "TechCorp Inc.", period: "2021 - Present", desc: "Leading the frontend team, migrating to Next.js." },
                { role: "Frontend Developer", company: "WebStudio", period: "2018 - 2021", desc: "Built responsive websites for various clients." }
              ].map((job, i) => (
                <div key={i} className="flex gap-4">
                  <div className="mt-1 bg-indigo-100 p-2 rounded-lg text-indigo-600">
                    <Briefcase size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{job.role}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-300">{job.company} • {job.period}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{job.desc}</p>
                  </div>
                </div>
              ))}
              <Button variant="ghost" className="w-full text-indigo-600">
                + Add Experience
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Education</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <div className="mt-1 bg-indigo-100 p-2 rounded-lg text-indigo-600">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">BS Computer Science</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-300">University of Technology • 2014 - 2018</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Resume</CardTitle>
              <CardDescription>Upload your latest resume (PDF, DOCX)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Click to upload or drag and drop</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-300">Maximum file size 5MB</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
