"use client";

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { createJob } from '@/services/jobsService';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { Loader2, Plus, Sparkles, X } from 'lucide-react';

export const JobCreationForm = () => {
    const router = useRouter();
    const { user } = useStore();
    const [step, setStep] = useState(1);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [experienceRequired, setExperienceRequired] = useState(0);
    const [submissionDeadlineAt, setSubmissionDeadlineAt] = useState("");
    const [skills, setSkills] = useState<string[]>([]);
    const [currentSkill, setCurrentSkill] = useState("");
    const [atsWeight, setAtsWeight] = useState(1);
    const [mcqWeight, setMcqWeight] = useState(0);
    const [codingWeight, setCodingWeight] = useState(0);
    const [interviewWeight, setInterviewWeight] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const totalWeight = useMemo(
        () => Number(atsWeight) + Number(mcqWeight) + Number(codingWeight) + Number(interviewWeight),
        [atsWeight, mcqWeight, codingWeight, interviewWeight]
    );
    const progress = Math.round((step / 4) * 100);

    const addSkill = () => {
        if (currentSkill.trim() && !skills.includes(currentSkill.trim())) {
            setSkills([...skills, currentSkill.trim()]);
            setCurrentSkill("");
        }
    };

    const removeSkill = (skillToRemove: string) => {
        setSkills(skills.filter(s => s !== skillToRemove));
    };

    const validateCurrentStep = () => {
        if (step === 1) {
            if (title.trim().length < 3) {
                toast.error("Job title must be at least 3 characters.");
                return false;
            }
            if (description.trim().length < 10) {
                toast.error("Description must be at least 10 characters.");
                return false;
            }
            if (submissionDeadlineAt) {
                const ts = new Date(submissionDeadlineAt).getTime();
                if (Number.isNaN(ts) || ts <= Date.now()) {
                    toast.error("Submission deadline must be a future date and time.");
                    return false;
                }
            }
        }
        if (step === 2 && skills.length === 0) {
            toast.error("Add at least one required skill.");
            return false;
        }
        if (step === 3 && Math.abs(totalWeight - 1) > 0.01) {
            toast.error("Stage weights must sum to 1.00.");
            return false;
        }
        return true;
    };

    const onSubmit = async () => {
        if (!user?.company) {
            toast.error("You must be associated with a company to post jobs.");
            return;
        }
        if (!validateCurrentStep()) return;
        if (Math.abs(totalWeight - 1) > 0.01) {
            toast.error("Stage weights must sum to 1.00.");
            return;
        }

        setIsSubmitting(true);
        try {
            await createJob({
                title,
                description,
                experience_required: Number(experienceRequired || 0),
                submission_deadline_at: submissionDeadlineAt ? new Date(submissionDeadlineAt).toISOString() : undefined,
                skills,
                weights: {
                    ats_weight: Number(atsWeight),
                    mcq_weight: Number(mcqWeight),
                    coding_weight: Number(codingWeight),
                    interview_weight: Number(interviewWeight)
                }
            }, user.company);

            toast.success("Job posted successfully!");
            router.push('/dashboard/hr');
        } catch (error: unknown) {
            console.error("Job creation failed:", error);
            const message = error instanceof Error ? error.message : "Failed to create job.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="mx-auto max-w-5xl rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-2xl">Create New Job Posting</CardTitle>
                        <CardDescription>
                            Step-by-step wizard: Role info → Requirements → Screening setup → Preview.
                        </CardDescription>
                    </div>
                    <Badge variant="secondary">{progress}% complete</Badge>
                </div>
                <div className="pt-2">
                    <Progress value={progress} className="h-2" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-8">
                    {step === 1 ? (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">1. Role Information</h3>
                            <div className="space-y-2">
                                <Label>Job Title</Label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Senior Frontend Developer"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe responsibilities, impact, and ideal profile..."
                                    className="min-h-[180px] text-slate-900"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Experience Required (Years)</Label>
                                <Input
                                    type="number"
                                    value={String(experienceRequired)}
                                    onChange={(e) => setExperienceRequired(Number(e.target.value || 0))}
                                    min="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Application Submission Deadline</Label>
                                <Input
                                    type="datetime-local"
                                    value={submissionDeadlineAt}
                                    onChange={(e) => setSubmissionDeadlineAt(e.target.value)}
                                />
                                <p className="text-xs text-slate-500">
                                    ATS shortlist runs automatically after this deadline.
                                </p>
                            </div>
                        </div>
                    ) : null}

                    {step === 2 ? (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">2. Requirements</h3>
                            <p className="text-sm text-slate-500">
                                Add required skills used for ATS matching and challenge generation.
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    value={currentSkill}
                                    onChange={(e) => setCurrentSkill(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addSkill();
                                        }
                                    }}
                                    placeholder="e.g. React, TypeScript, Node.js"
                                />
                                <Button type="button" onClick={addSkill} variant="secondary">
                                    <Plus className="mr-2 h-4 w-4" /> Add
                                </Button>
                            </div>
                            {skills.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {skills.map((skill) => (
                                        <div key={skill} className="flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                                            {skill}
                                            <button type="button" onClick={() => removeSkill(skill)} className="ml-2 text-indigo-400 hover:text-indigo-900 focus:outline-none">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">No skills added yet.</p>
                            )}
                        </div>
                    ) : null}

                    {step === 3 ? (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">3. Screening Setup</h3>
                            <p className="text-sm text-slate-500">
                                Configure weighted evaluation across ATS, MCQ, Coding, and AI Interview.
                            </p>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Resume ATS Weight</Label>
                                    <Input type="number" step="0.05" value={String(atsWeight)} onChange={(e) => setAtsWeight(Number(e.target.value || 0))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>MCQ Weight</Label>
                                    <Input type="number" step="0.05" value={String(mcqWeight)} onChange={(e) => setMcqWeight(Number(e.target.value || 0))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Coding Weight</Label>
                                    <Input type="number" step="0.05" value={String(codingWeight)} onChange={(e) => setCodingWeight(Number(e.target.value || 0))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>AI Interview Weight</Label>
                                    <Input type="number" step="0.05" value={String(interviewWeight)} onChange={(e) => setInterviewWeight(Number(e.target.value || 0))} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between rounded-xl border bg-slate-50 p-3 text-sm">
                                <span className="font-medium text-slate-700">Total Weight</span>
                                <span className={`font-bold ${Math.abs(totalWeight - 1) < 0.01 ? "text-green-600" : "text-red-500"}`}>
                                    {totalWeight.toFixed(2)} / 1.00
                                </span>
                            </div>
                        </div>
                    ) : null}

                    {step === 4 ? (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">4. Preview & Publish</h3>
                            <Card className="rounded-2xl border-slate-200 bg-slate-50/70">
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <CardTitle className="text-xl">{title || "Untitled role"}</CardTitle>
                                            <CardDescription>{user?.company || "Company"}</CardDescription>
                                        </div>
                                        <Badge variant="secondary">Draft Preview</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{description || "No description yet."}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {skills.map((skill) => (
                                            <Badge key={skill} variant="outline">{skill}</Badge>
                                        ))}
                                        {skills.length === 0 ? <span className="text-sm text-slate-500">No skills added.</span> : null}
                                    </div>
                                    <div className="grid gap-2 text-sm md:grid-cols-2">
                                        <p><span className="font-medium">Experience:</span> {experienceRequired} years</p>
                                        <p>
                                            <span className="font-medium">Deadline:</span>{" "}
                                            {submissionDeadlineAt ? new Date(submissionDeadlineAt).toLocaleString() : "Not set"}
                                        </p>
                                        <p><span className="font-medium">ATS:</span> {atsWeight}</p>
                                        <p><span className="font-medium">MCQ:</span> {mcqWeight}</p>
                                        <p><span className="font-medium">Coding:</span> {codingWeight}</p>
                                        <p><span className="font-medium">Interview:</span> {interviewWeight}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-700">
                                <div className="flex items-center gap-2 font-medium">
                                    <Sparkles className="h-4 w-4" />
                                    Automation enabled
                                </div>
                                <p className="mt-1 text-indigo-600">Publishing will auto-seed MCQs and coding challenge using your role + skills.</p>
                            </div>
                        </div>
                    ) : null}

                    <div className="flex justify-between border-t pt-6">
                        <Button type="button" variant="outline" onClick={() => (step === 1 ? router.back() : setStep((s) => s - 1))}>
                            {step === 1 ? "Cancel" : "Back"}
                        </Button>
                        <div className="flex gap-3">
                            {step < 4 ? (
                                <Button
                                    type="button"
                                    onClick={() => {
                                        if (!validateCurrentStep()) return;
                                        setStep((s) => Math.min(4, s + 1));
                                    }}
                                >
                                    Continue
                                </Button>
                            ) : (
                                <Button type="button" disabled={isSubmitting} onClick={onSubmit}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Publish Job
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
