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
import { BrainCircuit } from 'lucide-react';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  role: z.enum(['applicant', 'hr', 'admin']),
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
      router.push(`/dashboard/${data.role}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-slate-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <BrainCircuit size={32} />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900">Create your account</h2>
          <p className="mt-2 text-sm text-slate-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </p>
        </div>

        <div className="flex justify-center space-x-4 mt-6">
          <button
            type="button"
            onClick={() => { setRole('applicant'); setValue('role', 'applicant'); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              role === 'applicant'
                ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            Applicant
          </button>
          <button
            type="button"
            onClick={() => { setRole('hr'); setValue('role', 'hr'); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              role === 'hr'
                ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            HR Manager
          </button>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-md shadow-sm space-y-4">
            <Input
              label="Full Name"
              type="text"
              placeholder="John Doe"
              {...register('name')}
              error={errors.name?.message}
            />
            <Input
              label="Email address"
              type="email"
              placeholder="john@example.com"
              {...register('email')}
              error={errors.email?.message}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              error={errors.password?.message}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              {...register('confirmPassword')}
              error={errors.confirmPassword?.message}
            />
          </div>

          <div>
            <Button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              isLoading={isLoading}
            >
              Create Account
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
