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
            .select('id')
            .eq('id', jobId)
            .maybeSingle();

        if (jobLookupError || !jobRow?.id) {
            return NextResponse.json(
                { error: "Job not found.", details: jobLookupError?.message },
                { status: 404 }
            );
        }

        // Applicant-side submission only persists the application.
        // ATS scoring/matching runs in HR/review stages.

        // 2. Upload resume to Supabase Storage.
        const safeName = (resumeFile.name || "resume.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
        const resumePath = `${jobId}/${authUser.id}/${Date.now()}_${safeName}`;
        const { data: uploaded, error: uploadError } = await supabase.storage
            .from('resumes')
            .upload(resumePath, resumeFile, { upsert: true, contentType: resumeFile.type || "application/pdf" });
        if (uploadError || !uploaded?.path) {
            return NextResponse.json(
                {
                    error: 'Failed to upload resume.',
                    details: uploadError?.message,
                },
                { status: 500 }
            );
        }

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
                    resume_snapshot_url: uploaded.path
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
                    },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                {
                    error: 'Failed to save application in Supabase.',
                    details: dbError.message,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Application submitted successfully",
            application: appData,
        });

    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Please log in before applying.' }, { status: 401 });
        }
        console.error("Error processing application:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
