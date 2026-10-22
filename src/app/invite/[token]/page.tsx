import { WorkspacePage } from "@/features/trips/WorkspacePage";
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <WorkspacePage mode="invite" token={token} />;
}
