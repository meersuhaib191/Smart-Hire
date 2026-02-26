"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { createJob } from '@/services/jobsService';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';

const jobSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    experience_required: z.coerce.number().min(0, "Experience cannot be negative"),
    ats_weight: z.coerce.number().min(0).max(1),
    mcq_weight: z.coerce.number().min(0).max(1),
    coding_weight: z.coerce.number().min(0).max(1),
    interview_weight: z.coerce.number().min(0).max(1),
}).refine(data => {
    const sum = data.ats_weight + data.mcq_weight + data.coding_weight + data.interview_weight;
    // Use a small epsilon for floating point comparison
    return Math.abs(sum - 1.0) < 0.01;
}, {
    message: "The sum of all stage weights must exactly equal 1.00",
    path: ["ats_weight"] // Show error on the first weight field
});

type JobFormValues = z.infer<typeof jobSchema>;

export const JobCreationForm = () => {
    const router = useRouter();
    const { user } = useStore();
    const [skills, setSkills] = useState<string[]>([]);
    const [currentSkill, setCurrentSkill] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<JobFormValues>({
        resolver: zodResolver(jobSchema) as any,
        defaultValues: {
            title: "",
            description: "",
            experience_required: 0,
            ats_weight: 1.0,
            mcq_weight: 0.0,
            coding_weight: 0.0,
            interview_weight: 0.0,
        }
    });

    const addSkill = () => {
        if (currentSkill.trim() && !skills.includes(currentSkill.trim())) {
            setSkills([...skills, currentSkill.trim()]);
            setCurrentSkill("");
        }
    };

    const removeSkill = (skillToRemove: string) => {
        setSkills(skills.filter(s => s !== skillToRemove));
    };

    const onSubmit = async (data: JobFormValues) => {
        if (!user?.company) {
            toast.error("You must be associated with a company to post jobs.");
            return;
        }

        if (skills.length === 0) {
            toast.error("Please add at least one required skill.");
            return;
        }

        setIsSubmitting(true);
        try {
            // In a real application, user.company would be an ID. 
            // If it's just a string name right now, we would need to look up or create the company.
            // For this step, we will assume user.company is the company_id or we use user.id if company is missing.
            // We will need to ensure the user has a linked company_id. 
            // Let's assume we have a company_id for now.

            await createJob({
                title: data.title,
                description: data.description,
                experience_required: data.experience_required,
                skills,
                weights: {
                    ats_weight: data.ats_weight,
                    mcq_weight: data.mcq_weight,
                    coding_weight: data.coding_weight,
                    interview_weight: data.interview_weight
                }
            }, user.company);

            toast.success("Job posted successfully!");
            router.push('/dashboard/hr');
        } catch (error: any) {
            console.error("Job creation failed:", error);
            toast.error(error.message || "Failed to create job.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="max-w-3xl mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl">Create New Job Posting</CardTitle>
                <CardDescription>Define the role, requirements, and AI evaluation stage weights.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                    {/* Basic Details */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">1. Basic Details</h3>

                        <div className="space-y-2">
                            <Label>Job Title</Label>
                            <Input
                                {...form.register("title")}
                                placeholder="e.g. Senior Frontend Developer"
                                error={form.formState.errors.title?.message}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                {...form.register("description")}
                                placeholder="Describe the responsibilities and requirements..."
                                className="min-h-[150px] text-slate-900"
                            />
                            {form.formState.errors.description && (
                                <p className="text-xs text-red-500 font-medium">{form.formState.errors.description.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Experience Required (Years)</Label>
                            <Input
                                type="number"
                                {...form.register("experience_required")}
                                min="0"
                                error={form.formState.errors.experience_required?.message}
                            />
                        </div>
                    </div>

                    {/* Skills */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">2. Required Skills</h3>
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
                                <Plus className="h-4 w-4 mr-2" /> Add
                            </Button>
                        </div>

                        {skills.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {skills.map(skill => (
                                    <div key={skill} className="flex items-center bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium border border-indigo-100">
                                        {skill}
                                        <button type="button" onClick={() => removeSkill(skill)} className="ml-2 text-indigo-400 hover:text-indigo-900 focus:outline-none">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* AI Weights Configuration */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">3. AI Evaluation Stage Weights</h3>
                        <p className="text-sm text-slate-500">
                            Set the importance of each stage. The total must exactly equal 1.00 (100%).
                            For a pure Resume-screening job, set ATS to 1.0.
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Resume ATS Weight (0.0 - 1.0)</Label>
                                <Input
                                    type="number" step="0.05"
                                    {...form.register("ats_weight")}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>MCQ Test Weight (0.0 - 1.0)</Label>
                                <Input
                                    type="number" step="0.05"
                                    {...form.register("mcq_weight")}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Coding Test Weight (0.0 - 1.0)</Label>
                                <Input
                                    type="number" step="0.05"
                                    {...form.register("coding_weight")}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>AI Interview Weight (0.0 - 1.0)</Label>
                                <Input
                                    type="number" step="0.05"
                                    {...form.register("interview_weight")}
                                />
                            </div>
                        </div>
                        {form.formState.errors.ats_weight && (
                            <p className="text-sm text-red-500 font-medium">{form.formState.errors.ats_weight.message}</p>
                        )}

                        {/* Live Sum Counter */}
                        <div className="p-3 bg-slate-50 border rounded-md flex justify-between items-center text-sm">
                            <span className="font-medium text-slate-700">Total Weight Sum:</span>
                            <span className={`font-bold ${Math.abs(form.watch("ats_weight") + form.watch("mcq_weight") + form.watch("coding_weight") + form.watch("interview_weight") - 1) < 0.01
                                ? "text-success-600"
                                : "text-red-500"
                                }`}>
                                {(form.watch("ats_weight") + form.watch("mcq_weight") + form.watch("coding_weight") + form.watch("interview_weight")).toFixed(2)} / 1.00
                            </span>
                        </div>
                    </div>

                    <div className="pt-6 border-t font-medium flex justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Publish Job
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};
