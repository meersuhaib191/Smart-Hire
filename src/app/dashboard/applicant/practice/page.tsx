import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ApplicantPracticePage() {
  return (
    <div className="container mx-auto p-8">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Practice Arena</CardTitle>
          <CardDescription>
            Practice MCQ and coding challenges before your real assessments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            This page is now live as a dedicated route. We can next wire real practice sets from the backend.
          </p>
          <Link href="/dashboard/applicant/applications">
            <Button variant="outline">Go to My Applications</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
