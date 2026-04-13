"use client";
import React from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { BrainCircuit, Code, Users, BarChart } from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/store/useStore';

export const LandingPage = () => {
  const { user, isAuthenticated, hasCheckedSession } = useStore();
  const isSignedIn = hasCheckedSession && isAuthenticated && Boolean(user?.id);
  const dashboardHref =
    user?.role === 'hr' || user?.role === 'admin' ? '/hr/dashboard' : '/applicant/dashboard';
  const getStartedHref = isSignedIn ? dashboardHref : '/login';

  return (
    <div className="bg-white dark:bg-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32 lg:pt-32 lg:pb-40">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold tracking-wider text-indigo-600 uppercase bg-indigo-50 rounded-full">
              The Future of Hiring and Careers
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-6xl mb-6">
              The Intelligent <br />
              <span className="text-indigo-600">Talent Marketplace Operating System</span>
            </h1>
            <p className="max-w-2xl mx-auto text-xl text-slate-500 dark:text-slate-300 mb-10">
              A single platform for employers to hire smarter and for candidates to get hired faster.
              Automate assessments, surface real skills, and match the right talent to the right roles.
            </p>
            <div className="flex justify-center gap-4">
              <Link href={getStartedHref}>
                <Button size="lg" className="px-8 text-lg h-14">Get Started</Button>
              </Link>
              <Link href="/jobs">
                <Button variant="outline" size="lg" className="px-8 text-lg h-14">Browse Jobs</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-slate-50 dark:bg-slate-900/40">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
              Everything you need to hire and get hired
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
              From job discovery to offer decisions, we&apos;ve got both sides covered.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <BrainCircuit className="h-8 w-8 text-indigo-600" />,
                title: "AI Screening",
                description: "Automatically parse and score resumes based on real skills, not just keywords."
              },
              {
                icon: <Code className="h-8 w-8 text-indigo-600" />,
                title: "Code Assessments",
                description: "Built-in IDE with test cases and anti-cheat mechanisms for technical roles."
              },
              {
                icon: <Users className="h-8 w-8 text-indigo-600" />,
                title: "AI Interviews",
                description: "Conduct asynchronous video interviews analyzed for soft skills and confidence."
              },
              {
                icon: <BarChart className="h-8 w-8 text-indigo-600" />,
                title: "Smart Ranking",
                description: "Get a prioritized list of candidates based on holistic performance data."
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="bg-indigo-50 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl mb-6">
                Streamline your talent journey
              </h2>
              <div className="space-y-8">
                {[
                  "Post jobs or discover relevant opportunities",
                  "Run and take skill-based assessments",
                  "Use AI interviews and insights to evaluate fit",
                  "Move faster from shortlist to offer and acceptance"
                ].map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                      {i + 1}
                    </div>
                    <p className="text-lg text-slate-700 dark:text-slate-300 pt-0.5">{step}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:w-1/2 relative">
              <div className="absolute inset-0 bg-indigo-600 rounded-3xl rotate-3 opacity-10 transform scale-105"></div>
              <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900/70">
                {/* Mock UI of Pipeline */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">Senior React Developer</div>
                    <span className="text-green-600 text-sm font-medium bg-green-50 px-2 py-1 rounded">Active</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {['Applied (42)', 'Screening (18)', 'Interview (5)', 'Offer (1)'].map((stage, i) => (
                      <div key={i} className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md ${i === 1 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                        {stage}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                        <div className="flex-1">
                          <div className="h-3 bg-slate-300 rounded w-24 mb-1"></div>
                          <div className="h-2 bg-slate-200 rounded w-16"></div>
                        </div>
                        <div className="text-right">
                          <div className="text-indigo-600 font-bold text-sm">9{i}%</div>
                          <div className="text-xs text-slate-400">Match</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to transform hiring and job search?</h2>
          <p className="text-indigo-100 mb-10 max-w-2xl mx-auto text-lg">
            Join companies and candidates using Smart Hire to connect through skill-first matching.
          </p>
          <Link href={getStartedHref}>
            <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 border-transparent text-lg px-8 h-14">
              Get Started
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};
