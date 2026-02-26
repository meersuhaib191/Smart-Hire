"use client";
import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Search, MapPin, Briefcase, DollarSign, Filter, Star } from 'lucide-react';

const jobs = [
  {
    id: 1,
    title: 'Senior Frontend Engineer',
    company: 'TechCorp Inc.',
    location: 'Remote',
    salary: '$120k - $150k',
    type: 'Full-time',
    skills: ['React', 'TypeScript', 'Tailwind'],
    match: 95,
    posted: '2 days ago',
    logo: 'https://ui-avatars.com/api/?name=TechCorp&background=6366f1&color=fff'
  },
  {
    id: 2,
    title: 'Product Designer',
    company: 'Creative Studio',
    location: 'New York, NY',
    salary: '$100k - $130k',
    type: 'Full-time',
    skills: ['Figma', 'UI/UX', 'Prototyping'],
    match: 88,
    posted: '5 days ago',
    logo: 'https://ui-avatars.com/api/?name=Creative&background=f59e0b&color=fff'
  },
  {
    id: 3,
    title: 'Backend Developer',
    company: 'CloudSystems',
    location: 'San Francisco, CA',
    salary: '$140k - $180k',
    type: 'Contract',
    skills: ['Node.js', 'PostgreSQL', 'AWS'],
    match: 72,
    posted: '1 week ago',
    logo: 'https://ui-avatars.com/api/?name=Cloud&background=10b981&color=fff'
  },
  {
    id: 4,
    title: 'DevOps Engineer',
    company: 'ScaleUp',
    location: 'Remote',
    salary: '$130k - $160k',
    type: 'Full-time',
    skills: ['Docker', 'Kubernetes', 'CI/CD'],
    match: 65,
    posted: '3 days ago',
    logo: 'https://ui-avatars.com/api/?name=ScaleUp&background=ef4444&color=fff'
  }
];

export const JobFeedPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Filters Sidebar */}
        <div className="w-full md:w-64 space-y-6">
          <div className="flex items-center gap-2 font-semibold text-lg text-slate-900">
            <Filter size={20} />
            Filters
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Job Type</label>
              <div className="space-y-2">
                {['Full-time', 'Part-time', 'Contract', 'Internship'].map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
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
          </div>
        </div>

        {/* Job List */}
        <div className="flex-1 space-y-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by job title, skill, or company" 
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="w-1/3 relative hidden md:block">
              <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Location" 
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <Button>Search</Button>
          </div>

          <div className="space-y-4">
            {jobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow cursor-pointer border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <img src={job.logo} alt={job.company} className="w-12 h-12 rounded-lg" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600">{job.title}</h3>
                          <p className="text-slate-500 font-medium">{job.company}</p>
                        </div>
                        {job.match > 80 && (
                          <Badge variant="success" className="bg-green-50 text-green-700 border-green-200">
                            {job.match}% Match
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <MapPin size={16} />
                          {job.location}
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign size={16} />
                          {job.salary}
                        </div>
                        <div className="flex items-center gap-1">
                          <Briefcase size={16} />
                          {job.type}
                        </div>
                        <div className="flex items-center gap-1">
                          <Star size={16} />
                          {job.posted}
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
                      <Button variant="outline">View Details</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
