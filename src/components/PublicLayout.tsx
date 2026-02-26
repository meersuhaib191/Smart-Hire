"use client";
import React from 'react';
import Link from 'next/link';
import { Button } from './ui/Button';
import { BrainCircuit, Menu } from 'lucide-react';

export const PublicLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-slate-900">
            <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
              <BrainCircuit size={20} />
            </div>
            SmartHire
          </Link>
          
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/features" className="hover:text-indigo-600 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-indigo-600 transition-colors">Pricing</Link>
            <Link href="/jobs" className="hover:text-indigo-600 transition-colors">Jobs</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu size={20} />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 py-12 text-slate-600 text-sm">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 font-bold text-lg text-slate-900 mb-4">
              <BrainCircuit size={20} className="text-indigo-600" />
              SmartHire
            </div>
            <p className="mb-4 text-slate-500">
              The intelligent hiring operating system for modern teams.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">Product</h4>
            <ul className="space-y-2">
              <li><Link href="#" className="hover:text-indigo-600">Features</Link></li>
              <li><Link href="#" className="hover:text-indigo-600">Pricing</Link></li>
              <li><Link href="#" className="hover:text-indigo-600">API</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><Link href="#" className="hover:text-indigo-600">Documentation</Link></li>
              <li><Link href="#" className="hover:text-indigo-600">Guides</Link></li>
              <li><Link href="#" className="hover:text-indigo-600">Support</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">Company</h4>
            <ul className="space-y-2">
              <li><Link href="#" className="hover:text-indigo-600">About</Link></li>
              <li><Link href="#" className="hover:text-indigo-600">Blog</Link></li>
              <li><Link href="#" className="hover:text-indigo-600">Careers</Link></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-slate-100 text-center text-slate-400">
          © 2024 Smart Hire Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
