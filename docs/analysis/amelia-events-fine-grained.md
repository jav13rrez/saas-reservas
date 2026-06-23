# Amelia Events — Fine-Grained Documentation

## Overview

La sección **Events** administra eventos especiales (cursos, workshops, seminarios, clases grupales) que diferenciados de las reservas individuales (appointments). Los eventos tienen capacidad limitada, registro de asistentes, fechas/horas específicas, y pueden requerir forma de pago.

---

## Events List View

### Controles Superiores

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Search Box** | Input text | Buscar por: nombre evento, instructor, ubicación | - | 🔶 | 🟡 |
| **Filter Button** | Botón icono (funnel) | Abre panel filtros avanzados | - | 🔶 | 🟡 |
| **Date Range Picker** | Input rango | Formato: `MMM DD, YYYY - MMM DD, YYYY` | Próximas 2 semanas | 🔶 | 🟡 |
| **Status Filter** | Quick buttons / Dropdown | `Upcoming`, `Ongoing`, `Ended`, `Cancelled`, `All` | Upcoming | 🔶 | 🟡 |
| **+ Add New Event** | Botón primario | Abre modal de nuevo evento | - | ✅ | 🟢 |

### Filtros Avanzados

| Filtro | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **By Organizer** | Multi-select | Listado de empleados/instructores | Todos | 🔶 | 🟡 |
| **By Location** | Multi-select | Listado de ubicaciones | Todas | 🔶 | 🟡 |
| **By Status** | Checkbox group | `Closed`, `Open`, `Cancelled` | Todos excepto Cancelled | 🔶 | 🟡 |
| **By Capacity Used** | Range slider | 0-100% | - | 🔶 | 🟡 |

### Tabla Events

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **DATE & TIME** | Texto | `MMM DD, YYYY at HH:MM am/pm` | - | ✅ | 🟢 |
| **NAME** | Texto | Nombre evento | Click abre detalle/modal | ✅ | 🟢 |
| **ORGANIZER** | Avatar + Texto | Nombre empleado + foto | Click abre perfil | 🔶 | 🟡 |
| **LOCATION** | Texto / Icono | Nombre ubicación | - | 🔶 | 🟡 |
| **BOOKED** | Texto | `5 / 20` (registrados / capacidad) | Muestra ocupación | ✅ | 🟢 |
| **STATUS** | Badge | `Closed` (rojo), `Open` (verde), `Cancelled` (gris) | Click abre menu cambiar estado | ✅ | 🟡 |
| **ATTENDEES** | Icono + Número | Icono grupo + conteo (ej: "👥 5") | Click abre lista asistentes | 🔶 | 🟡 |
| **ACTIONS** | Menú/Botones | Edit, Delete, View Attendees, Send Reminder, View Invoice | Hover/Menu ⋯ | 🔶 | 🟡 |

---

## Modal: New / Edit Event

### Estructura General

Tabs / Sections:
1. **Details** (básico: nombre, fecha, capacidad, instructor)
2. **Description** (descripción larga, tags)
3. **Pricing** (precio, depósito, pago)
4. **Attendees** (list de quién se registró, status de pago)
5. **Notes** (internas)

### Tab: Details

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Event Name** | Input text | Título evento | Required, max 100 chars | - | ✅ | 🟢 |
| **Organizer / Instructor** | Dropdown | Listado de empleados | Required | - | ✅ | 🟢 |
| **Location** | Dropdown | Listado de ubicaciones | Required | - | ✅ | 🟢 |
| **Start Date** | Date picker | Cualquier fecha futura | Required | - | ✅ | 🟢 |
| **Start Time** | Time picker | HH:MM AM/PM | Required | 09:00 AM | ✅ | 🟢 |
| **End Date** | Date picker | ≥ Start Date | Required | Same as Start | ✅ | 🟢 |
| **End Time** | Time picker | ≥ Start Time | Required | 10:00 AM | ✅ | 🟢 |
| **Capacity** | Input number | 1-9999 | ≥1, integer | 20 | ✅ | 🟡 |
| **Spots Left** | Computed readonly | Max capacity - registered | Read-only | - | 🔶 | 🟡 |
| **Color** | Color picker | Hex color para calendario | - | Purple | 🔶 | 🟡 |
| **Recurring** | Checkbox + Options | ☑ Repeat: Weekly / Monthly / Custom | - | False | 🔶 | 🟡 |
| **Repeat Interval** (si Recurring) | Dropdown | `Weekly`, `Bi-weekly`, `Monthly`, `Custom` | - | `Weekly` | 🔶 | 🟡 |
| **Repeat Until** (si Recurring) | Date picker | Fecha final de serie | - | 8 semanas | 🔶 | 🟡 |

### Tab: Description

| Campo | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Description (long)** | Rich text / Markdown | Descripción detallada evento | 🔶 | 🟡 |
| **Tags** | Multi-select combobox | Tags para categorización (ej: "Yoga", "Beginner") | 🔶 | 🟡 |

### Tab: Pricing

| Campo | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Price** | Input currency | USD | 0 | ✅ | 🟢 |
| **Deposit Required** | Checkbox | ☑ / ☐ | False | 🔶 | 🟡 |
| **Deposit Amount** | Input currency (si checked) | ≤ Price | 0 | 🔶 | 🟡 |
| **Payment Method** | Multi-select | `Cash`, `Card`, `Bank Transfer`, `Stripe`, `PayPal` | Offline | 🔶 | 🟡 |
| **Coupon Code** | Input + search | Código válido | - | 🔶 | 🟡 |

### Tab: Attendees

| Elemento | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Attendees List** | Table | Nombre, email, teléfono, payment status, check-in status | Remove, Mark as paid, Mark no-show | 🔶 | 🟡 |
| **Add Attendee** | Input + Button | Campo búsqueda de cliente existente o crear nuevo | Click agrega a lista | 🔶 | 🟡 |
| **Waitlist** (si full) | Checkbox + List | Mostrar lista de espera si capacidad llena | Promote to attendee | 🔶 | 🟡 |

### Tab: Notes

| Campo | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Staff Notes** | Text area | Notas internas | 🔶 | 🟡 |

---

## Acciones Rápidas desde Fila

| Acción | Efecto | Estado SaaS | Prioridad |
|---|---|---|---|
| **Edit** | Abre modal Edit Event | ✅ | 🟢 |
| **Delete** | Confirmación + elimina evento | 🔶 | 🟡 |
| **View Attendees** | Abre lista de registrados (similar Tab Attendees) | 🔶 | 🟡 |
| **Send Reminder** | Abre composer email/SMS con template | 🔶 | 🟡 |
| **Change Status** | Popup menu: Open ↔ Closed ↔ Cancelled | ✅ | 🟡 |
| **View Invoice** | Abre PDF factura (si evento pagado) | 🔶 | 🟡 |

---

## Validaciones y Lógica

1. **Capacidad**: Si "Booked >= Capacity", status automático cambia a "Closed" o se abre "Waitlist".

2. **Series Recurrentes**: Al marcar "Recurring", crear múltiples instancias del evento (evento padre + children).
   - Cambios en padre: ¿aplican a todos los children o solo futuro?

3. **Payment**: 
   - Si evento tiene precio > 0 y está "Open", aceptar registros pero requiere pago.
   - Payment Status: `Paid`, `Not Paid`, `Partial`, `Refunded`.

4. **Check-in**: ¿Hay funcionalidad de check-in al evento (marcar asistencia)?

5. **Historial de cambios**: ¿Timeline de cambios de status?

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

*(Ninguna bloqueante identificada.)*

### Prioridad Amarilla (🟡)

1. **Recurring Events** — Confirmar si es soportado y cómo se manejan cambios en series.
2. **Waitlist** — ¿Existe? ¿Cómo se promueven de waitlist a attendee?
3. **Check-in Functionality** — ¿Existe forma de marcar asistencia al evento?
4. **Event Templates** — ¿Opción de usar plantillas para eventos recurrentes similares?
5. **Attendees Report** — ¿Export de lista de asistentes a CSV?
6. **Capacity Management** — Confirmar comportamiento cuando evento llena (auto-close, waitlist, error).

### Notas de Implementación

- Events comparten la misma estructura de navegación y filtros que Bookings, pero con columnas/campos específicos de evento.
- La capacidad es un campo clave; cambiar capacidad después de registros puede requerir confirmación.
- Precio evento es global; cada evento tiene un precio único (no por asistente si es grupal).
- Status "Open/Closed" es distinto de "Cancelled"; Closed = lleno, Cancelled = evento no ocurrirá.
