import { ScrollText } from "lucide-react";
import { AreaPlaceholder } from "@/components/area-placeholder";

export default function AuditPage() {
  return (
    <AreaPlaceholder
      icon={ScrollText}
      title="Auditoría"
      description="Registro de eventos por tenant con filtros por tipo, actor y rango de fechas. El panel de Operaciones ya muestra los eventos recientes."
      backed={[
        "Búsqueda de audit log con filtros (services/api/src/api/audit-routes.ts)",
        "Endpoint GET /audit/events con aislamiento por x-tenant-id",
        "Eventos de auditoría en el dominio (packages/domain)",
      ]}
    />
  );
}
