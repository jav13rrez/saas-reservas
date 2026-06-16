import { Contact } from "lucide-react";
import { AreaPlaceholder } from "@/components/area-placeholder";

export default function CustomersPage() {
  return (
    <AreaPlaceholder
      icon={Contact}
      title="Clientes"
      description="Acceso de cliente sin contraseña (passwordless) y anonimización GDPR preservando métricas. El registro de clientes persistente está pendiente."
      backed={[
        "Acceso passwordless Ed25519 con nonces de un solo uso (application/identity)",
        "Sesiones HttpOnly y rutas de portal de cliente (portal-routes.ts)",
        "Anonimización GDPR preservando métricas (ADR-0014)",
      ]}
    />
  );
}
