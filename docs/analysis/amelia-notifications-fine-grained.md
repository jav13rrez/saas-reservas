# Amelia Notifications — Fine-Grained Documentation

## Overview

**Notifications** administra las plantillas de email y SMS que se envían automáticamente en respuesta a eventos (nueva reserva, aprobación, recordatorio, cancelación, etc.). Cada evento de ciclo de vida de una reserva/evento puede disparar 1+ notificaciones.

---

## Notifications Structure

La sección es una lista de **eventos/triggers**, cada uno con plantillas de **Email** y opcionalmente **SMS**.

Eventos típicos:
- **Appointment Pending** → Cliente hace reserva (pendiente aprobación)
- **Appointment Approved** → Admin/empleado aprueba reserva
- **Appointment Rejected** → Admin rechaza reserva
- **Appointment Cancelled** → Reserva cancelada (por admin o cliente)
- **Appointment Rescheduled** → Cliente o admin cambia fecha/hora
- **Appointment Completed** → Después de la cita (invoice, feedback request)
- **Reminder** → X horas antes de cita (ej: 24h, 1h)
- **Follow-up** → Después de cita (satisfacción, upsell)
- **Wishlist / Waiting List** → Cliente se añade a lista de espera

---

## Notification Templates List View

### Controles Superiores

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Filter / Type** | Buttons | `Appointment`, `Event`, `Customer`, `All` | All | 🔶 | 🟡 |
| **Search** | Input text | Buscar por: nombre evento/trigger | - | 🔶 | 🟡 |

### Tabla / Lista de Eventos

| Elemento | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **EVENT NAME** | Texto | Nombre trigger (ej: "Appointment Pending") | Click abre detalle | 🔶 | 🟡 |
| **EMAILS** | Badge | "✓" si email template existe | Click abre editor email | 🔶 | 🟡 |
| **SMS** | Badge | "✓" si SMS template existe (o "SMS Premium") | Click abre editor SMS | 🔶 | 🟡 |
| **CUSTOMERS** | Checkbox | ☑ Enviar a cliente | Editable | 🔶 | 🟡 |
| **EMPLOYEES** | Checkbox | ☑ Enviar a empleado | Editable | 🔶 | 🟡 |
| **ADMIN** | Checkbox | ☑ Enviar a admin | Editable | 🔶 | 🟡 |
| **STATUS** | Toggle | ON / OFF | Click para toggle | 🔶 | 🟡 |

---

## Modal / Detail: Edit Notification Template

Cuando se hace click en un evento, se abre panel de edición con tabs para Email y SMS.

### Tab: Email Template

| Campo | Tipo | Contenido | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Subject Line** | Input text | Asunto del email | Ej: "Appointment Confirmation - {{service_name}}" | 🔶 | 🟡 |
| **From Name** | Input text | Nombre remitente | Ej: "Sports and Gym" | 🔶 | 🟡 |
| **From Email** | Input email | Email remitente | Info@domain.com | 🔶 | 🟡 |
| **Body (Rich Text)** | WYSIWYG editor | HTML/Markdown con template variables | Default template | 🔶 | 🟡 |
| **Send To** | Checkboxes | ☑ Customer, ☑ Employee, ☑ Admin | Varia por evento | 🔶 | 🟡 |
| **Attachments** | File picker (opcional) | Ej: invoice, receipt | None | 🔶 | 🟡 |
| **Send Immediately** | Radio | vs "Scheduled" | Immediately | 🔶 | 🟡 |
| **Send After** (si Scheduled) | Time picker | Horas/minutos después del evento | - | 🔶 | 🟡 |

#### Template Variables (Available)

Inserción via {{variable}}:

| Variable | Aplica a | Ejemplo Output |
|---|---|---|
| `{{customer_name}}` | All | "Hans Peter" |
| `{{customer_email}}` | All | "hans@example.com" |
| `{{employee_name}}` | All | "Edwina Appleby" |
| `{{service_name}}` | Appointment | "Aerobic" |
| `{{appointment_date}}` | Appointment | "June 23, 2026" |
| `{{appointment_time}}` | Appointment | "1:00 PM" |
| `{{appointment_duration}}` | Appointment | "1 hour" |
| `{{location_name}}` | Appointment | "Downtown Studio" |
| `{{amount}}` | Appointment (payment) | "$65.00" |
| `{{event_name}}` | Event | "Morning Yoga Session" |
| `{{event_date}}` | Event | "June 23, 2026" |
| `{{event_time}}` | Event | "5:00 AM" |
| `{{company_name}}` | All | "Sports and Gym" |
| `{{company_phone}}` | All | "+1-555-123-4567" |
| `{{company_website}}` | All | "www.example.com" |
| `{{confirmation_link}}` | Pending approval | URL para confirmar/rechazar |
| `{{reschedule_link}}` | Confirmed appointment | URL para cambiar fecha/hora |
| `{{cancel_link}}` | Confirmed appointment | URL para cancelar |

### Tab: SMS Template

| Campo | Tipo | Contenido | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Message** | Text area | Texto SMS (max 160 chars, ver contador) | Ej: "Hi {{customer_name}}, confirm at {{appointment_date}} {{appointment_time}}?" | 🔶 | 🟡 |
| **Send To** | Checkboxes | ☑ Customer, ☑ Employee | Varia por evento | 🔶 | 🟡 |
| **Character Count** | Display (readonly) | `N / 160` con advertencia si > 160 | Live update | 🔶 | 🟡 |
| **Send Immediately** | Radio | vs "Scheduled" | Immediately | 🔶 | 🟡 |
| **Send After** (si Scheduled) | Time picker | Horas/minutos después del evento | - | 🔶 | 🟡 |
| **SMS Provider** (si active) | Display | "Amelia SMS Premium" o "Twilio" | Read-only | 🔶 | 🟡 |

**Nota**: SMS requiere servicio de pago (Amelia SMS, Twilio). Si no activo, esta tab puede estar deshabilitada o mostrar "Upgrade required".

---

## Acciones Globales

| Acción | Efecto | Estado SaaS | Prioridad |
|---|---|---|---|
| **Test Email** | Abre input de email, envía template de prueba | 🔶 | 🟡 |
| **Test SMS** | Abre input de teléfono, envía SMS de prueba | 🔶 | 🟡 |
| **Reset to Default** | Revierte template a versión por defecto de Amelia | 🔶 | 🟡 |
| **Disable Template** | Desactiva notificación para este evento (toggle OFF) | 🔶 | 🟡 |

---

## Events Detalle

### Appointment Events

| Evento | Triggered | Default Recipients | Nota | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Appointment Pending** | Cliente crea reserva (pendiente aprobación) | Customer | Confirmación de recibido | 🔶 | 🟡 |
| **Appointment Approved** | Admin aprueba reserva | Customer, Employee | Confirmación final | 🔶 | 🟡 |
| **Appointment Rejected** | Admin rechaza reserva | Customer | Aviso de rechazo | 🔶 | 🟡 |
| **Appointment Cancelled** | Admin o cliente cancela | Customer, Employee, Admin | Aviso cancelación | 🔶 | 🟡 |
| **Appointment Rescheduled** | Cliente o admin cambia fecha/hora | Customer, Employee | Confirmación nueva fecha | 🔶 | 🟡 |
| **Appointment Reminder** | X horas antes de cita (ej: 24h, 1h) | Customer, Employee | Recordatorio | 🔶 | 🟡 |
| **Appointment Completed** | Después de cita (auto-scheduled) | Customer | Factura, feedback request | 🔶 | 🟡 |
| **Appointment No-show** | Si no marca asistencia | Customer, Employee, Admin | Notificación de inasistencia | 🔶 | 🟡 |

### Event Events (Eventos Grupales)

Similares a Appointment, pero para eventos.

| Evento | Triggered | Default Recipients | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Event Registered** | Cliente se registra en evento | Customer, Organizer | Confirmación registro | 🔶 | 🟡 |
| **Event Approved** | Organizador aprueba registro | Customer | Confirmación asistencia | 🔶 | 🟡 |
| **Event Cancelled** | Evento cancelado | Customer, Organizer | Aviso cancelación | 🔶 | 🟡 |
| **Event Reminder** | X horas antes | Customer, Organizer | Recordatorio | 🔶 | 🟡 |
| **Waitlist Notification** | Cliente se añade a lista de espera | Customer, Organizer | Confirmación waitlist | 🔶 | 🟡 |

### Customer Events

| Evento | Triggered | Default Recipients | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Customer Registration** | Nuevo cliente se registra | Customer, Admin | Bienvenida | 🔶 | 🟡 |
| **Password Reset** | Cliente solicita reset password | Customer | Link reset | 🔶 | 🟡 |
| **Newsletter** | Envío de newsletter marketing | Customers (opted-in) | Noticia/promo | 🔶 | 🟡 |

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

*(Ninguna identificada.)*

### Prioridad Amarilla (🟡)

1. **SMS Premium** — Confirmar proveedor (Amelia SMS vs Twilio), disponibilidad, pricing.
2. **Scheduled Send Timing** — ¿Timezone-aware para cliente? ¿Hour-level granularity?
3. **Template Language** — ¿Soporta condicionales (IF/ELSE)? ¿Loops?
4. **Attachments** — ¿Automático (invoice) o manual (custom file)?
5. **Unsubscribe Management** — ¿Footer con link unsubscribe automático (GDPR)?
6. **Bounce / Soft Fail Handling** — ¿Qué ocurre si email falla? ¿Retry logic?
7. **BCC / CC** — ¿Opción de agregar BCC admin a emails enviados?

### Notas de Implementación

- El **WYSIWYG editor** debería tener preview side-by-side.
- Las **Template variables** deben ser autocompletadas (dropdown o @mentions).
- El **Character counter** para SMS es crítico (mostrar color rojo si > 160).
- El **Test button** debería avisar si es la primera vez (confirmación extra).
- El **Reset to Default** debería mostrar diff antes de confirmar.
- Las **Notificaciones** deben ser rastreables en timeline de cliente/cita.
- El **Tone** de plantillas debe ser configurable (formal, casual, etc.) con presets.
