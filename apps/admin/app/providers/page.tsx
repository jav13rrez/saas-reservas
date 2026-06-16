import { UserCog } from "lucide-react";
import { AreaPlaceholder } from "@/components/area-placeholder";

export default function ProvidersPage() {
  return (
    <AreaPlaceholder
      icon={UserCog}
      title="Proveedores"
      description="Profesionales con horario semanal, zona horaria y portal con permisos. El alta básica ya está disponible en Configuración."
      backed={[
        "Dominio de tenancy y proveedores (packages/domain/src/tenancy)",
        "Servicio de portal de proveedor con permisos (application/portal)",
        "Alta de proveedor y horario semanal (/api/v1/admin/providers)",
        "Rutas de portal de proveedor/cliente (services/api/src/api/portal-routes.ts)",
      ]}
    />
  );
}
