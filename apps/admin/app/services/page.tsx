import { Package } from "lucide-react";
import { AreaPlaceholder } from "@/components/area-placeholder";

export default function ServicesPage() {
  return (
    <AreaPlaceholder
      icon={Package}
      title="Servicios"
      description="Catálogo de servicios reservables: categorías, duración, buffers y precio. El alta básica ya está disponible en Configuración."
      backed={[
        "Dominio de catálogo (packages/domain/src/catalog)",
        "Servicio de catálogo de administración (application/catalog)",
        "Alta de categoría, servicio y asignación a proveedor (/api/v1/admin/*)",
      ]}
    />
  );
}
