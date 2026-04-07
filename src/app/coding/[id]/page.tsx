import { Suspense } from "react";
import { CodingPage } from "@/pages_migrated/applicant/CodingPage";
import { PageLoadingSkeleton } from "@/components/ui/PageLoadingSkeleton";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-8"><PageLoadingSkeleton /></div>}>
      <CodingPage challengeId={id} />
    </Suspense>
  );
}