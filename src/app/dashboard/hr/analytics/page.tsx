import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function HrAnalyticsPage() {
  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
          <CardDescription>Hiring performance and candidate pipeline insights.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Start with the candidate analytics page to review stage scores and rankings by job.
          </p>
          <Link href="/dashboard/applicants">
            <Button variant="outline">Open Candidate Analytics</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
