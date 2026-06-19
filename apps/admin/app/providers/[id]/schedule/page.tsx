import { ProviderSchedule } from "@/features/provider-schedule";

export default async function ProviderSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProviderSchedule providerId={id} />;
}
