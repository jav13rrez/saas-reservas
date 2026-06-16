import { CreditCard } from "lucide-react";
import { AreaPlaceholder } from "@/components/area-placeholder";

export default function BillingPage() {
  return (
    <AreaPlaceholder
      icon={CreditCard}
      title="Facturación"
      description="Planes (Starter, Professional, Enterprise), feature flags y cuotas de uso. El consumo por tenant se previsualiza en Operaciones."
      backed={[
        "Dominio de facturación: planes, feature flags y cuotas (packages/domain/src/billing)",
        "Lógica hasFeature / isWithinQuota / bookingQuotaRemaining",
        "Conciliación de pagos con Stripe (services/worker/src/jobs/payment-reconciliation.ts)",
        "Gating de funciones premium por plan (videomeeting-provisioning-service.ts)",
      ]}
    />
  );
}
