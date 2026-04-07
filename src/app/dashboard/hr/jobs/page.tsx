import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function HrJobsPage() {
  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
          <CardDescription>Manage all job postings from one place.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Use the dashboard overview for current postings, or create a new role now.
          </p>
          <Link href="/dashboard/hr/jobs/new">
            <Button>Create New Job</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
