import { supabase } from '@/utils/supabase/client';

export interface JobInput {
    title: string;
    description: string;
    experience_required: number;
    skills: string[];
    weights: {
        ats_weight: number;
        mcq_weight: number;
        coding_weight: number;
        interview_weight: number;
    };
}

export const createJob = async (jobInput: JobInput, companyId: string) => {
    const response = await fetch('/api/hr/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: jobInput.title,
            description: jobInput.description,
            experience_required: jobInput.experience_required,
            company_id: companyId,
            skills: jobInput.skills,
            weights: jobInput.weights,
        }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const detail = payload?.detail ? ` (${payload.detail})` : '';
        throw new Error((payload?.error || 'Failed to create job') + detail);
    }
    return payload.jobId as string;
};

export const getJobsByCompany = async () => {
    const response = await fetch('/api/hr/jobs', { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || 'Failed to fetch HR jobs');
    }
    return (payload?.jobs || []) as Array<Record<string, unknown>>;
};
