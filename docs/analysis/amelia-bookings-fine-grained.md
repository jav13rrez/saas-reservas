# Amelia Bookings (Appointments) — Fine-Grained Documentation

## Overview

La sección **Bookings** (o **Appointments** en el hash routing) es la lista central de todas las reservas/citas en el sistema. Permite visualizar, filtrar, buscar, editar y crear nuevas reservas. Cada reserva tiene un conjunto completo de campos relacionados con cliente, empleado, servicio, horario, pago y estado.

---

## Bookings List View

### Controles Superiores

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Search Box** | Input text | Buscar por: nombre cliente, servicio, empleado, referencia | - | ✅ | 🟢 |
| **Filter Button** | Botón icono (funnel) | Abre panel de filtros avanzados | - | 🔶 | 🟡 |
| **Date Range Picker** | Input rango | Formato: `MMM DD, YYYY - MMM DD, YYYY` | Última semana | ✅ | 🟢 |
| **Bulk Actions** (si existe) | Dropdown/Buttons | Ej: "Change status", "Send email", "Delete" | - | 🔶 | 🟡 |
| **+ Add New** | Botón primario | Abre modal de nueva reserva | - | ✅ | 🟢 |

### Filtros Avanzados (desde panel Filtro)

| Filtro | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **By Status** | Multi-select checkbox | `Pending`, `Approved`, `Cancelled`, `Completed`, `Rejected`, `No-show` | Todos excepto Cancelled | 🔶 | 🟡 |
| **By Employee** | Multi-select | Listado de empleados | Todos | 🔶 | 🟡 |
| **By Service** | Multi-select | Listado de servicios | Todos | 🔶 | 🟡 |
| **By Location** | Multi-select | Listado de ubicaciones | Todas | 🔶 | 🟡 |
| **By Customer** | Search/Select | Nombre o email de cliente | - | 🔶 | 🟡 |
| **By Payment Status** | Select | `Paid`, `Not Paid`, `Partial` | Todos | 🔶 | 🟡 |

### Tabla Bookings

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **DATE** | Texto | `MMM DD, YYYY` | - | ✅ | 🟢 |
| **TIME** | Texto | `HH:MM am/pm` | - | ✅ | 🟢 |
| **CUSTOMER** | Avatar + Texto | Nombre cliente + foto circular | Click abre perfil/modal cliente | ✅ | 🟢 |
| **SERVICE** | Texto | Nombre servicio | - | ✅ | 🟢 |
| **EMPLOYEE** | Avatar + Texto | Nombre empleado + foto | Click abre perfil/modal empleado | ✅ | 🟢 |
| **DURATION** | Texto | `1h`, `30m`, `1h 30m` | - | ✅ | 🟢 |
| **STATUS** | Badge/Etiqueta | `Pending` (amarillo), `Approved` (verde), `Rejected` (rojo), `Cancelled` (gris), `Completed` (azul), `No-show` (naranja) | Click abre menu cambiar estado | ✅ | 🟡 |
| **PAID** | Monto USD | `$0.00`, `$XX.XX` | - | ✅ | 🟢 |
| **ACTIONS** | Menú/Botones | Edit, Delete, Duplicate, Send SMS, Send Email, View Invoice | Hover revela más opciones | 🔶 | 🟡 |

---

## Modal: New / Edit Appointment

### Estructura General

El modal tiene múltiples secciones / tabs:
1. **Details** (datos principales)
2. **Payment** (información de pago)
3. **Notes** (notas internas/client notes)
4. (Potencial sub-tab: **Custom Fields** si están habilitados)

### Tab: Details

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Employee** | Dropdown select | Listado de empleados disponibles | Required | - | ✅ | 🟢 |
| **Service** | Dropdown select | Listado de servicios | Required | - | ✅ | 🟢 |
| **Date** | Date picker | Cualquier fecha futura | Required | Hoy | ✅ | 🟢 |
| **Time** | Time picker | HH:MM (AM/PM) | Required + validar disponibilidad empleado | Próxima hora redonda | ✅ | 🟢 |
| **Duration** | Dropdown / computed | Duración del servicio (auto-rellenada) | Read-only si auto-calc o editable | Duración del servicio | ✅ | 🟡 |
| **Location** | Dropdown select | Listado de ubicaciones | Required | - | ✅ | 🟢 |
| **Customer** | Combobox search | Existentes + opción "New Customer" | Required | - | ✅ | 🟢 |
| **Customer Email** | Input email | Email válido | Requerido si cliente nuevo | - | ✅ | 🟢 |
| **Customer Phone** | Input tel | Formato: +XX XXX-XXX-XXXX | Opcional | - | ✅ | 🟢 |
| **Status** | Dropdown | `Pending`, `Approved`, `Rejected`, `Cancelled`, `Completed` | - | `Pending` | ✅ | 🟢 |
| **Reminder Sent** | Checkbox | ☑ / ☐ | - | False | 🔶 | 🟡 |
| **Notifications** | Checkbox[] | ☑ Send email to customer, ☑ Send SMS | - | Ambas checked | 🔶 | 🟡 |

### Tab: Payment

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Amount** | Input currency | USD, puede ser 0 | Debe ser ≥0 | Precio del servicio | ✅ | 🟢 |
| **Payment Method** | Dropdown | `Cash`, `Card`, `Check`, `Bank Transfer`, `Stripe`, `PayPal`, `Offline` | - | `Offline` | 🔶 | 🟡 |
| **Payment Status** | Radio buttons | `Paid`, `Not Paid`, `Partial` | - | `Not Paid` | ✅ | 🟡 |
| **Deposit Amount** | Input currency | Si servicio requiere depósito | ≤ Amount | 0 | 🔶 | 🟡 |
| **Transaction ID** | Input text | Ej: ID de Stripe, PayPal | - | - | 🔶 | 🟡 |
| **Coupon/Discount Code** | Input + search | Código de cupón válido | Valida existencia + descuento | - | 🔶 | 🟡 |
| **Notes (Finance)** | Text area | Notas sobre pago | - | - | 🔶 | 🟡 |

### Tab: Notes

| Campo | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Staff Notes** | Text area | Notas internas (no visible cliente) | 🔶 | 🟡 |
| **Client Notes** | Text area | Notas visibles al cliente (ej: instrucciones) | 🔶 | 🟡 |
| **Timeline** (si existe) | Log readonly | Historial de cambios de estado, emails enviados, etc. | 🔶 | 🟡 |

---

## Acciones Rápidas desde Fila

| Acción | Trigger | Efecto | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Edit** | Icono/Botón edit | Abre modal Edit Appointment | ✅ | 🟢 |
| **Delete** | Icono/Botón trash | Abre confirmación, elimina | 🔶 | 🟡 |
| **Duplicate** | Botón/Menu | Crea copia de cita (mismo service, empleado, duración; nueva fecha/hora) | 🔶 | 🟡 |
| **Send SMS** | Botón mensaje | Abre composer SMS con template | 🔶 | 🟡 |
| **Send Email** | Botón email | Abre composer email con template | 🔶 | 🟡 |
| **View Invoice** | Botón/Link | Abre PDF o modal de factura | 🔶 | 🟡 |
| **Reschedule** | Botón | Abre date/time picker para cambiar hora | 🔶 | 🟡 |
| **Change Status** | Dropdown en fila | Abre popup/menu para cambiar estado sin abrir modal | ✅ | 🟡 |

---

## Validaciones y Lógica

1. **Disponibilidad Empleado**: Al seleccionar empleado + fecha + hora, debe validarse que:
   - Empleado no tiene otra reserva en ese horario
   - Empleado está asignado a esa ubicación
   - Horario respeta "Work Hours" del empleado

2. **Duración Servicio**: Al seleccionar servicio, auto-populate duración. ¿Editable?

3. **Cliente Nuevo vs Existente**: 
   - Si selecciona cliente existente: pre-llenar email/teléfono
   - Si selecciona "New Customer": campo email + phone required

4. **Notificaciones**: Al crear/editar, ¿se envían automáticamente o se confirma antes de guardar?

5. **Cambio de Status**: 
   - `Pending` → `Approved`: ¿envía confirmación al cliente?
   - `Pending` → `Rejected`: ¿envía cancelación?
   - Cambios posteriores: ¿requieren confirmación adicional?

---

## Búsqueda y Filtrado Avanzado

- **Búsqueda global**: Por nombre cliente, servicio, empleado
- **Filtros anidables**: ¿se pueden combinar (ej: "Pending + Employee X + Service Y")?
- **Guardar filtros**: ¿opción de guardar búsquedas frecuentes?
- **Export**: ¿opción de exportar a CSV/Excel la lista filtrada?

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

*(Ninguna bloqueante identificada.)*

### Prioridad Amarilla (🟡)

1. **Filtros Avanzados Panel** — No explorado en detalle. Documentar estructura exacta de filtros, combinabilidad, estado de cada filtro.
2. **Bulk Actions** — ¿Existen? ¿Qué opciones hay (cambiar status masivo, enviar email, etc.)?
3. **Custom Fields en Modal** — Si están habilitados, ¿dónde aparecen? ¿En tab separado o dentro de Details?
4. **Payment Methods** — Confirmar lista exacta de métodos soportados (Stripe, PayPal, Square, etc.).
5. **Notifications / Email Templates** — Confirmar qué eventos disparan emails/SMS automáticos.
6. **Reschedule UX** — ¿Es inline en la fila o abre modal? ¿Valida disponibilidad al reschedule?
7. **Customer Creation** — Al crear cliente nuevo desde modal, ¿qué campos son required? ¿Se crea un perfil completo o solo email/name/phone?

### Notas de Implementación

- La tabla es probablemente paginada; confirmar límite de filas por página y navegación de páginas.
- La columna STATUS debería permitir cambio rápido sin abrir modal (click en badge abre popup de opciones).
- Las acciones en la fila pueden estar en un menú "⋯" (tres puntos) si hay muchas opciones.
- Los iconos de empleado/cliente (avatares) son imágenes de perfil o iniciales coloreadas.
- El rango de fechas debe ser editable (click en "MMM DD - MMM DD" abre calendar picker).
