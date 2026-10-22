import { WorkspacePage } from "@/features/trips/WorkspacePage";
export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <WorkspacePage mode="room" roomId={tripId} />;
}
