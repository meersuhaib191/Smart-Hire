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
    // 1. Insert Job
    const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
            title: jobInput.title,
            description: jobInput.description,
            experience_required: jobInput.experience_required,
            company_id: companyId,
            status: 'PUBLISHED'
        })
        .select('id')
        .single();

    if (jobError) throw jobError;

    // 2. Insert Skills
    if (jobInput.skills.length > 0) {
        const skillsToInsert = jobInput.skills.map((skill) => ({
            job_id: job.id,
            skill_name: skill
        }));
        const { error: skillsError } = await supabase
            .from('job_skills')
            .insert(skillsToInsert);

        if (skillsError) throw skillsError;
    }

    // 3. Insert Weights
    const { error: weightsError } = await supabase
        .from('job_weights')
        .insert({
            job_id: job.id,
            ats_weight: jobInput.weights.ats_weight,
            mcq_weight: jobInput.weights.mcq_weight,
            coding_weight: jobInput.weights.coding_weight,
            interview_weight: jobInput.weights.interview_weight
        });

    if (weightsError) throw weightsError;

    return job.id;
};

export const getJobsByCompany = async (companyId: string) => {
    const { data: jobs, error } = await supabase
        .from('jobs')
        .select(`
      *,
      job_skills ( skill_name ),
      applications ( id )
    `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return jobs;
};
