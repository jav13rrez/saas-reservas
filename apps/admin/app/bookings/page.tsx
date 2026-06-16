import { CalendarCheck } from "lucide-react";
import { AreaPlaceholder } from "@/components/area-placeholder";

export default function BookingsPage() {
  return (
    <AreaPlaceholder
      icon={CalendarCheck}
      title="Reservas"
      description="Gestión de citas: alta desde checkout, cancelación con reembolso y reprogramación con validación de disponibilidad."
      backed={[
        "Dominio de reservas y pagos (packages/domain/src/bookings, payments)",
        "Checkout y webhooks de pago (services/api/src/api/checkout-routes.ts)",
        "Cambios de reserva: cancelar y reprogramar (application/booking-change)",
        "Bloqueo de slots con Redis e idempotencia de webhooks",
      ]}
    />
  );
}
