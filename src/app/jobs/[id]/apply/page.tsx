"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ApplyPage({ params }: { params: { id: string } }) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [aiResult, setAiResult] = useState<{
        score?: number;
        matched_skills?: string[];
        missing_skills?: string[];
    } | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        formData.append("job_id", params.id);

        try {
            const res = await fetch("/api/apply", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                setAiResult(data.ats_analysis);
                setSuccess(true);
            } else {
                console.error("Failed to submit");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <div className="max-w-2xl mx-auto p-8 mt-10 border rounded-xl shadow-sm bg-card text-center space-y-4">
                <h1 className="text-3xl font-bold text-green-600 mb-2">Application Submitted!</h1>
                <p className="text-gray-600 dark:text-gray-300">Your resume was analyzed by our AI system.</p>

                {aiResult && (
                    <div className="mt-8 p-6 bg-muted rounded-lg text-left">
                        <h2 className="text-xl font-semibold mb-2">AI Match Analysis</h2>
                        <div className="text-5xl font-bold mb-4">
                            <span className={aiResult.score >= 70 ? "text-green-500" : aiResult.score >= 40 ? "text-yellow-500" : "text-red-500"}>
                                {aiResult.score?.toFixed(1) || "0"}%
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <div>
                                <h3 className="font-medium text-green-600 mb-2">Matched Skills</h3>
                                <div className="flex flex-wrap gap-1">
                                    {aiResult.matched_skills?.map((s: string) => (
                                        <span key={s} className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">{s}</span>
                                    ))}
                                    {(!aiResult.matched_skills || aiResult.matched_skills.length === 0) && <span className="text-xs text-muted-foreground">None found</span>}
                                </div>
                            </div>
                            <div>
                                <h3 className="font-medium text-red-600 mb-2">Missing Skills</h3>
                                <div className="flex flex-wrap gap-1">
                                    {aiResult.missing_skills?.map((s: string) => (
                                        <span key={s} className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded">{s}</span>
                                    ))}
                                    {(!aiResult.missing_skills || aiResult.missing_skills.length === 0) && <span className="text-xs text-muted-foreground">None</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <Button onClick={() => window.location.reload()} className="mt-8" variant="outline">
                    Submit Another
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-8 mt-10 border rounded-xl shadow-sm bg-card">
            <h1 className="text-2xl font-bold mb-6">Apply for Job #{params.id}</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="applicant_name">Full Name</Label>
                    <Input id="applicant_name" name="applicant_name" required placeholder="John Doe" />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="applicant_email">Email</Label>
                    <Input id="applicant_email" name="applicant_email" type="email" required placeholder="john@example.com" />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="resume">Resume (PDF)</Label>
                    <Input id="resume" name="resume" type="file" accept=".pdf" required />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="cover_letter">Cover Letter (Optional)</Label>
                    <Textarea id="cover_letter" name="cover_letter" placeholder="Why are you a good fit?" rows={4} />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Analyzing Resume..." : "Submit Application"}
                </Button>
            </form>
        </div>
    );
}
