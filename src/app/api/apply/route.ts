import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthUser } from '@/server/auth/session';

// Initialize Supabase Client (Assume env vars are set)
const projectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const configuredAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseUrl =
    (configuredUrl && !configuredUrl.includes('your-project.supabase.co') ? configuredUrl : '') ||
    (projectId ? `https://${projectId}.supabase.co` : '');
const supabaseAnonKey =
    configuredAnonKey && configuredAnonKey !== 'your-anon-key' && configuredAnonKey !== 'your_anon_key'
        ? configuredAnonKey
        : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const supabase = createClient(supabaseUrl, supabaseKey);
const aiBackendUrl = (process.env.AI_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export async function POST(request: Request) {
    try {
        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json(
                { error: 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_PROJECT_ID/NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.' },
                { status: 500 }
            );
        }

        const formData = await request.formData();
        const resumeFile = formData.get('resume') as File;
        const jobId = formData.get('job_id') as string;
        if (!resumeFile || !jobId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const authUser = await requireAuthUser();
        if (!authUser.email) {
            return NextResponse.json({ error: "Authenticated user email not found." }, { status: 400 });
        }

        const { data: jobRow, error: jobLookupError } = await supabase
            .from('jobs')
            .select('description')
            .eq('id', jobId)
            .maybeSingle();

        if (jobLookupError || !jobRow?.description) {
            return NextResponse.json(
                { error: "Job not found or missing description.", details: jobLookupError?.message },
                { status: 404 }
            );
        }

        // 1. Send the file to Python AI Backend for scoring
        const aiFormData = new FormData();
        aiFormData.append('resume', resumeFile);
        aiFormData.append('job_description', jobRow.description);

        let aiResults = { score: 0, matched_skills: [], missing_skills: [] };

        try {
            const aiResponse = await fetch(`${aiBackendUrl}/analyze-resume`, {
                method: 'POST',
                body: aiFormData,
            });

            if (aiResponse.ok) {
                aiResults = await aiResponse.json();
            } else {
                console.error("AI Backend Error:", await aiResponse.text());
            }
        } catch (aiError) {
            console.error("Failed to connect to Python AI Backend:", aiError);
            // We continue processing the application even if AI fails, just with a 0 score
        }

        // 2. Upload resume to Supabase Storage (if configured, ignoring for now if bucket doesn't exist)
        // const { data: fileData, error: uploadError } = await supabase.storage
        //   .from('resumes')
        //   .upload(`${jobId}/${Date.now()}_${resumeFile.name}`, resumeFile);

        // 3. Save application using current schema:
        // applications(job_id, user_id, resume_snapshot_url, current_stage, ...)
        const roleRaw = String(authUser.user_metadata?.role || '').toUpperCase();
        const dbRole = roleRaw === 'HR' ? 'HR' : roleRaw === 'PLATFORM_ADMIN' ? 'PLATFORM_ADMIN' : 'APPLICANT';
        const { error: ensureUserError } = await supabase
            .from('users')
            .upsert(
                {
                    id: authUser.id,
                    email: authUser.email,
                    role: dbRole,
                },
                { onConflict: 'id' }
            );
        if (ensureUserError) {
            return NextResponse.json(
                {
                    error: 'Failed to initialize applicant profile in database.',
                    details: ensureUserError.message,
                    ats_analysis: aiResults
                },
                { status: 500 }
            );
        }

        const { data: appData, error: dbError } = await supabase
            .from('applications')
            .insert([
                {
                    job_id: jobId,
                    user_id: authUser.id,
                    resume_snapshot_url: null
                }
            ])
            .select()
            .single();

        if (dbError) {
            if (dbError.code === '23505') {
                return NextResponse.json(
                    {
                        error: 'You have already applied to this job.',
                        details: dbError.message,
                        ats_analysis: aiResults
                    },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                {
                    error: 'Failed to save application in Supabase.',
                    details: dbError.message,
                    ats_analysis: aiResults
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Application submitted successfully",
            application: appData,
            ats_analysis: aiResults
        });

    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Please log in before applying.' }, { status: 401 });
        }
        console.error("Error processing application:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
