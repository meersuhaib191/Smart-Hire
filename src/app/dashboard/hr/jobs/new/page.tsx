import { JobCreationForm } from '@/components/hr/JobCreationForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewJobPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/hr" className="text-slate-500 hover:text-slate-900 transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Post a Job</h1>
            </div>
            <JobCreationForm />
        </div>
    );
}
