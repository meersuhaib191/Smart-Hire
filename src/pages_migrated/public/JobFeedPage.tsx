"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Search, MapPin, Briefcase, DollarSign, Filter, Star } from 'lucide-react';

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
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [types, setTypes] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/jobs');
        const json = await res.json();
        if (res.ok) {
          setJobs(json.jobs || []);
        }
      } finally {
        setLoading(false);
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
          </div>
        </div>

        {/* Job List */}
        <div className="flex-1 space-y-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex gap-4">
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
            <Button variant="outline">{filteredJobs.length} results</Button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <p className="text-sm text-slate-500">Loading jobs...</p>
            ) : filteredJobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow cursor-pointer border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Image
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(job.company)}&background=6366f1&color=fff`}
                      alt={job.company}
                      width={48}
                      height={48}
                      className="rounded-lg"
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
                      <Link href={`/jobs/${job.id}/apply`}>
                        <Button variant="outline">Apply</Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loading && filteredJobs.length === 0 && (
              <p className="text-sm text-slate-500">No jobs match your filters.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
