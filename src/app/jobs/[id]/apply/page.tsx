"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { toast } from "sonner";

export default function ApplyPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const jobId = useMemo(() => id || "", [id]);
    const [loading, setLoading] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [success, setSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [applicantName, setApplicantName] = useState("");
    const [applicantEmail, setApplicantEmail] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    useEffect(() => {
        (async () => {
            try {
                const meRes = await fetch("/api/auth/me");
                const meJson = await meRes.json().catch(() => ({}));
                if (!meRes.ok) {
                    setErrorMessage(meJson?.error || "Please log in before applying.");
                    return;
                }
                setApplicantEmail(meJson?.user?.email || "");
                setApplicantName(meJson?.user?.name || "");

                const profileRes = await fetch("/api/applicant/profile");
                const profileJson = await profileRes.json().catch(() => ({}));
                if (profileRes.ok && profileJson?.profile?.fullName) {
                    setApplicantName(profileJson.profile.fullName);
                }

                if (jobId) {
                    const jobRes = await fetch(`/api/jobs/${jobId}`);
                    const jobJson = await jobRes.json().catch(() => ({}));
                    if (jobRes.ok && jobJson?.job?.title) setJobTitle(jobJson.job.title);
                }
            } finally {
                setLoadingProfile(false);
            }
        })();
    }, [jobId]);

    useEffect(() => {
        if (!success) return;
        const timer = window.setTimeout(() => {
            router.push("/dashboard/applicant/applications");
        }, 3000);
        return () => window.clearTimeout(timer);
    }, [router, success]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!jobId) {
            setErrorMessage("Invalid job id.");
            return;
        }
        setLoading(true);
        setErrorMessage(null);

        const formData = new FormData(e.currentTarget);
        formData.append("job_id", jobId);

        try {
            const res = await fetch("/api/apply", {
                method: "POST",
                body: formData,
            });

            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setSuccess(true);
            } else {
                const message = data?.error || "Failed to submit application";
                setErrorMessage(message);
                toast.error(message);
                console.error("Failed to submit:", data);
            }
        } catch (err) {
            setErrorMessage("Network error while submitting application.");
            toast.error("Network error while submitting application.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <div className="mx-auto mt-10 w-full max-w-3xl space-y-4">
                <Card className="rounded-2xl border-slate-200/80 shadow-sm text-center">
                    <CardHeader>
                        <CardTitle className="text-3xl font-bold text-green-600">Application Submitted!</CardTitle>
                        <CardDescription>Your application has been submitted successfully.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Redirecting to your applications dashboard in a few seconds...
                        </p>
                        <Button onClick={() => router.push("/dashboard/applicant/applications")} className="mt-2" variant="outline">
                            Open My Applications
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="mx-auto mt-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
            <Card className="rounded-2xl border-slate-200/80 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">Submit Application</CardTitle>
                    <CardDescription>
                        {jobTitle ? `Applying for ${jobTitle}.` : "Complete your application with your resume."} Your profile details are auto-filled.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="applicant_name">Full Name</Label>
                                <Input id="applicant_name" value={applicantName} disabled placeholder={loadingProfile ? "Loading..." : "Name from profile"} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="applicant_email">Email</Label>
                                <Input id="applicant_email" value={applicantEmail} disabled placeholder={loadingProfile ? "Loading..." : "Email from account"} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="resume">Resume (PDF)</Label>
                            <Input id="resume" name="resume" type="file" accept=".pdf" required />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cover_letter">Cover Letter (Optional)</Label>
                            <Textarea id="cover_letter" name="cover_letter" placeholder="Why are you a good fit?" rows={4} />
                        </div>

                        <Button type="submit" className="w-full rounded-lg" disabled={loading || loadingProfile || !jobId}>
                            {loading ? "Submitting..." : "Submit Application"}
                        </Button>
                        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
                    </form>
                </CardContent>
            </Card>
            <Card className="h-fit rounded-2xl border-slate-200/80 shadow-sm lg:sticky lg:top-24">
                <CardHeader>
                    <CardTitle className="text-lg">Application Progress</CardTitle>
                    <CardDescription>What happens after you submit</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="font-medium text-slate-800">1. ATS Screening</p>
                        <p className="text-slate-500">Resume gets parsed and scored.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="font-medium text-slate-800">2. MCQ + Coding</p>
                        <p className="text-slate-500">Shortlisted candidates receive assessments.</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="font-medium text-slate-800">3. AI Interview</p>
                        <p className="text-slate-500">Final screening before offer decisions.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
