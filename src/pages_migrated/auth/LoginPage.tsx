"use client";
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrainCircuit, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export const LoginPage = () => {
  const { login, isLoading, user, isAuthenticated, hasCheckedSession } = useStore();
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
      toast.success('Logged in successfully');
      
      const user = useStore.getState().user;
      if (user) {
        const hrNeedsProfile = (user.role === 'hr' || user.role === 'admin') && (!user.isProfileComplete || !user.company?.trim());
        if (hrNeedsProfile) {
          router.push('/hr/complete-profile');
        } else if (user.role === 'hr' || user.role === 'admin') {
          router.push('/hr/dashboard');
        } else if (user.role === 'applicant' && !user.isProfileComplete) {
          router.push('/applicant/complete-profile');
        } else {
          router.push('/applicant/dashboard');
        }
      } else {
        router.push('/applicant/dashboard');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed. Please check your credentials.';
      toast.error(message);
    }
  };

  useEffect(() => {
    if (!hasCheckedSession || !isAuthenticated || !user) return;

    const hrNeedsProfile =
      (user.role === 'hr' || user.role === 'admin') && (!user.isProfileComplete || !user.company?.trim());

    if (hrNeedsProfile) {
      router.replace('/hr/complete-profile');
      return;
    }

    if (user.role === 'hr' || user.role === 'admin') {
      router.replace('/hr/dashboard');
      return;
    }

    if (user.role === 'applicant' && !user.isProfileComplete) {
      router.replace('/applicant/complete-profile');
      return;
    }

    router.replace('/applicant/dashboard');
  }, [hasCheckedSession, isAuthenticated, user, router]);

  return (
    <div className="min-h-screen grid bg-slate-50 lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 backdrop-blur">
            <BrainCircuit size={22} />
          </div>
          <div>
            <p className="font-semibold">Smart Hire AI</p>
            <p className="text-xs text-indigo-100">Hiring Intelligence Platform</p>
          </div>
        </div>
        <div className="max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
            <Sparkles size={14} />
            Built for modern hiring teams
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Hire faster with role-based automation and AI screening.
          </h1>
          <p className="text-sm leading-relaxed text-indigo-100/90">
            Manage applications, assessments, and interviews from one secure dashboard for HR and Applicants.
          </p>
        </div>
        <p className="text-xs text-indigo-200/80">© {new Date().getFullYear()} Smart Hire AI</p>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-indigo-600 text-white">
              <BrainCircuit size={24} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">
              New to Smart Hire?{' '}
              <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
                Create account
              </Link>
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <Input
              label="Email address"
              type="email"
              placeholder="applicant@example.com"
              {...register('email')}
              error={errors.email?.message}
              className="h-11 rounded-lg"
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              error={errors.password?.message}
              className="h-11 rounded-lg"
            />

            <Button
              type="submit"
              className="h-11 w-full rounded-lg"
              isLoading={isLoading}
            >
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            By continuing, you agree to Smart Hire terms and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
};
