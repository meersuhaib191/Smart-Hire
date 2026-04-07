"use client";
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useStore, UserRole } from '@/store/useStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrainCircuit, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  role: z.enum(['applicant', 'hr']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export const RegisterPage = () => {
  const { register: registerUser, isLoading } = useStore();
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('applicant');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'applicant'
    }
  });

  const onSubmit = async (data: FormData) => {
    try {
      await registerUser(data.email, data.password, data.role, data.name);
      toast.success('Account created successfully!');
      if (data.role === 'hr') {
        router.push('/hr/complete-profile');
      } else {
        router.push('/applicant/complete-profile');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create account';
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen grid bg-slate-50 lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-slate-900 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10">
            <BrainCircuit size={22} />
          </div>
          <div>
            <p className="font-semibold">Smart Hire AI</p>
            <p className="text-xs text-slate-300">Recruitment Intelligence</p>
          </div>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">Create your hiring workspace.</h1>
          <p className="text-sm text-slate-300">
            HR teams can publish jobs and review candidates. Applicants can complete profile and apply in minutes.
          </p>
          <ul className="space-y-2 pt-2 text-sm text-slate-200">
            <li className="flex items-center gap-2"><CheckCircle2 size={16} /> AI-powered screening</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={16} /> Role-based secure dashboard</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={16} /> End-to-end hiring pipeline</li>
          </ul>
        </div>
        <p className="text-xs text-slate-400">Trusted by modern startups and hiring teams.</p>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-indigo-600 text-white">
              <BrainCircuit size={24} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Create account</h2>
            <p className="mt-1 text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign in
              </Link>
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => { setRole('applicant'); setValue('role', 'applicant'); }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${role === 'applicant' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Applicant
            </button>
            <button
              type="button"
              onClick={() => { setRole('hr'); setValue('role', 'hr'); }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${role === 'hr' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              HR
            </button>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <Input
              label="Full Name"
              type="text"
              placeholder="John Doe"
              {...register('name')}
              error={errors.name?.message}
              className="h-11 rounded-lg"
            />
            <Input
              label="Email address"
              type="email"
              placeholder="john@example.com"
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
            <Input
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              {...register('confirmPassword')}
              error={errors.confirmPassword?.message}
              className="h-11 rounded-lg"
            />

            <Button
              type="submit"
              className="h-11 w-full rounded-lg"
              isLoading={isLoading}
            >
              Create Account
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
