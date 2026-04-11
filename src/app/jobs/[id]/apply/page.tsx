import { ApplyModal } from "@/components/jobs/ApplyModal";

type ApplyPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { id } = await params;
  return <ApplyModal jobId={id} />;
}
