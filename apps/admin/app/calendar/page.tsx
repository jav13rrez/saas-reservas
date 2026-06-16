import { CalendarDays } from "lucide-react";
import { AreaPlaceholder } from "@/components/area-placeholder";

export default function CalendarPage() {
  return (
    <AreaPlaceholder
      icon={CalendarDays}
      title="Calendario"
      description="Disponibilidad calculada y sincronización con calendarios externos vía OAuth, con detección de conflictos."
      backed={[
        "Motor de disponibilidad (application/availability)",
        "Endpoint público de disponibilidad (services/api/src/api/availability-routes.ts)",
        "Sincronización de calendario con detección de conflictos (services/worker/src/jobs/calendar-sync.ts)",
        "Webhooks de calendario (services/api/src/api/calendar-webhook-routes.ts)",
      ]}
    />
  );
}
