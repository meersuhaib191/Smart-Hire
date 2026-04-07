import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
        const applicantName = formData.get('applicant_name') as string;
        const applicantEmail = formData.get('applicant_email') as string;
        if (!resumeFile || !jobId || !applicantName) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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
            const aiResponse = await fetch('http://127.0.0.1:8000/analyze-resume', {
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
        const { data: existingUser, error: userLookupError } = await supabase
            .from('users')
            .select('id')
            .eq('email', applicantEmail)
            .maybeSingle();

        if (userLookupError) {
            return NextResponse.json(
                {
                    error: 'Failed to validate applicant against Supabase users.',
                    details: userLookupError.message,
                    ats_analysis: aiResults
                },
                { status: 500 }
            );
        }

        if (!existingUser) {
            return NextResponse.json(
                {
                    error: 'No user found for this email. Please register/login first so your user exists in Supabase.',
                    ats_analysis: aiResults
                },
                { status: 400 }
            );
        }

        const { data: appData, error: dbError } = await supabase
            .from('applications')
            .insert([
                {
                    job_id: jobId,
                    user_id: existingUser.id,
                    resume_snapshot_url: null
                }
            ])
            .select()
            .single();

        if (dbError) {
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
        console.error("Error processing application:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
