import { Ticket } from "lucide-react";
import { AreaPlaceholder } from "@/components/area-placeholder";

export default function EventsPage() {
  return (
    <AreaPlaceholder
      icon={Ticket}
      title="Eventos"
      description="Eventos con aforo, lista de espera y recurrencia, con resolución de conflictos de horario."
      backed={[
        "Dominio de eventos (packages/domain/src/events)",
        "Precios, lista de espera y recurrencia (application/events)",
        "Resolución de conflictos de recurrencia (application/scheduling)",
        "Rutas de eventos (services/api/src/api/event-routes.ts)",
      ]}
    />
  );
}
