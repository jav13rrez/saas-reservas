# Amelia Locations — Fine-Grained Documentation

## Overview

**Locations** administra las sedes/sucursales físicas (o virtuales) donde se ofrecen servicios. Cada ubicación tiene dirección, horarios de apertura, empleados asignados, servicios disponibles, y información de contacto.

---

## Locations List View

### Controles Superiores

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Search Box** | Input text | Buscar por: nombre, ciudad, dirección | - | 🔶 | 🟡 |
| **Filter / Status** | Buttons | `Active`, `Inactive`, `All` | Active | 🔶 | 🟡 |
| **+ Add Location** | Botón primario | Abre modal New Location | - | ✅ | 🟢 |

### Tabla Locations

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **NAME** | Texto | Nombre ubicación (ej: "Downtown Studio") | Click abre modal Edit | ✅ | 🟢 |
| **ADDRESS** | Texto | Dirección física | - | ✅ | 🟢 |
| **CITY** | Texto | Ciudad | - | 🔶 | 🟡 |
| **PHONE** | Texto | Teléfono de la ubicación | - | 🔶 | 🟡 |
| **EMPLOYEES** | Número | "3 employees" | - | 🔶 | 🟡 |
| **STATUS** | Badge | `Active` (verde), `Inactive` (gris) | Click abre menu | 🔶 | 🟡 |
| **ACTIONS** | Menú | Edit, Delete, View Map | ⋯ menu | 🔶 | 🟡 |

---

## Modal: New / Edit Location

### Estructura General

Tabs / Sections:
1. **Details** (información básica: nombre, dirección, contacto)
2. **Hours** (horarios de apertura)
3. **Employees** (empleados asignados)
4. **Services** (servicios disponibles en esta ubicación)
5. **Settings** (opciones: zona horaria, capacidad, etc.)

### Tab: Details

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Location Name** | Input text | Nombre | Required, max 100 | - | ✅ | 🟢 |
| **Street Address** | Input text | Dirección | Required, max 200 | - | ✅ | 🟢 |
| **City** | Input text | Ciudad | Required, max 50 | - | 🔶 | 🟡 |
| **State / Province** | Input text | Estado/Provincia | Optional, max 50 | - | 🔶 | 🟡 |
| **Postal Code** | Input text | Código postal | Optional, max 20 | - | 🔶 | 🟡 |
| **Country** | Dropdown | Listado de países | Optional | - | 🔶 | 🟡 |
| **Phone** | Input tel | Teléfono ubicación | Optional, format +XX-XXX | - | 🔶 | 🟡 |
| **Email** | Input email | Email contacto | Optional | - | 🔶 | 🟡 |
| **Website** | Input URL | URL sitio web | Optional | - | 🔶 | 🟡 |
| **Description** | Text area | Descripción de la ubicación | Optional | - | 🔶 | 🟡 |
| **Image / Photo** | File upload | JPG, PNG (max 2MB) | Optional | - | 🔶 | 🟡 |
| **Type** | Radio / Dropdown | `Physical`, `Virtual` (Zoom/Meet), `Hybrid` | `Physical` | 🔶 | 🟡 |
| **Zoom Link** (si Virtual) | Input URL | URL Zoom meeting | - | - | 🔶 | 🟡 |
| **Status** | Radio | `Active`, `Inactive` | `Active` | ✅ | 🟡 |

### Tab: Hours

**Horarios de Apertura**: Similar a Employees' Work Hours, pero a nivel de ubicación.

| Estructura | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **7 Acordeones (MON-SUN)** | Collapse/Expand | Cada día de semana | 🔶 | 🟡 |
| **Day of Week** | Label | MON, TUE, ..., SUN | Read-only | 🔶 | 🟡 |
| **Open** | Toggle | ☑ Open / ☐ Closed | - | True (Mon-Fri), False (Sat-Sun) | 🔶 | 🟡 |
| **Opening Time** (si Open) | Time picker | HH:MM AM/PM | - | 09:00 AM | 🔶 | 🟡 |
| **Closing Time** (si Open) | Time picker | HH:MM AM/PM | ≥ Opening | 05:00 PM | 🔶 | 🟡 |
| **Lunch Break Start** (opcional) | Time picker | HH:MM AM/PM | - | 12:00 PM | 🔶 | 🟡 |
| **Lunch Break End** (opcional) | Time picker | HH:MM AM/PM | > Lunch Start | 01:00 PM | 🔶 | 🟡 |

### Tab: Employees

Multi-select de empleados asignados a esta ubicación.

| Elemento | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Employees Checkboxes** | Checkboxes | Listado de empleados, ☑ si asignado | 🔶 | 🟡 |
| **[✓] Employee Name** | Checkbox | Ej: "Edwina Appleby" | 🔶 | 🟡 |
| **Search / Filter** | Input | Buscar empleado por nombre | 🔶 | 🟡 |

### Tab: Services

Multi-select de servicios disponibles en esta ubicación.

| Elemento | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Services Checkboxes** | Checkboxes | Listado de servicios, ☑ si disponible | 🔶 | 🟡 |
| **[✓] Service Name** | Checkbox | Ej: "Yoga", "Aerobic" | 🔶 | 🟡 |
| **Search / Filter** | Input | Buscar servicio | 🔶 | 🟡 |

### Tab: Settings

| Campo | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Timezone** | Dropdown | IANA timezone (ej: "America/New_York", "Europe/London") | Browser timezone | 🔶 | 🟡 |
| **Max Concurrent Reservations** | Input number | Número máximo de reservas simultáneamente | Unlimited | 🔶 | 🟡 |
| **Enable Cancellation** | Checkbox | ☑ Permite que clientes cancelen | True | 🔶 | 🟡 |
| **Cancellation Hours Before** | Input number | Horas antes de cita para cancelar | 24 | 🔶 | 🟡 |
| **Enable Rescheduling** | Checkbox | ☑ Permite cambiar horario | True | 🔶 | 🟡 |
| **Rescheduling Hours Before** | Input number | Horas antes para reprogramar | 24 | 🔶 | 🟡 |
| **Currency** | Dropdown | USD, EUR, GBP, etc. | USD | 🔶 | 🟡 |
| **Decimal Separator** | Radio | `,` (1,50) vs `.` (1.50) | . | 🔶 | 🟡 |

---

## Acciones Rápidas desde Fila

| Acción | Efecto | Estado SaaS | Prioridad |
|---|---|---|---|
| **Edit** | Abre modal Edit Location (todos tabs) | ✅ | 🟢 |
| **Delete** | Confirmación, elimina ubicación (¿reservas?) | 🔶 | 🟡 |
| **View Map** | Abre mapa (Google Maps / Leaflet) de la dirección | 🔶 | 🟡 |
| **Deactivate** | Cambia status a Inactive | 🔶 | 🟡 |

---

## Validaciones y Lógica

1. **Dirección**: Si Type = `Physical`, dirección required. Si Type = `Virtual`, dirección optional.

2. **Zoom Link**: Si Type = `Virtual` o `Hybrid`, Zoom Link required.

3. **Horarios**:
   - Opening Time < Closing Time
   - Lunch Break no sobreponerse con horario
   - Si Open=false, tiempos se deshabilitan

4. **Empleados**:
   - Empleado asignado a ubicación debe tener esa ubicación en su perfil
   - Cambiar asignación: ¿afecta reservas existentes?

5. **Servicios**:
   - Servicio disponible en ubicación, pero empleado que lo ofrece no está asignado: ¿posible?

6. **Timezone**:
   - Afecta horas de disponibilidad y notificaciones

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

*(Ninguna identificada.)*

### Prioridad Amarilla (🟡)

1. **Virtual/Hybrid Services** — Confirmar si existen y cómo se manejan (auto-generate link, manual, etc.).
2. **Lunch Breaks** — Confirmar si es configurable y bloquea reservas.
3. **Concurrent Reservations Limit** — ¿Existe? ¿Es por empleado o por ubicación?
4. **Cancellation / Rescheduling Windows** — Confirmar si es configurable por ubicación o global.
5. **Deletion Policy** — Soft/hard delete. Qué pasa con reservas/empleados/servicios asignados.
6. **Multi-Currency** — ¿Cada ubicación puede tener moneda diferente?

### Notas de Implementación

- El **Photo** puede ser un avatar/thumbnail de la ubicación.
- El **Map View** es opcional pero recomendado para UX de cliente.
- Los **Horarios** deben ser intuitivos; considerar "Copy from previous day" para agilizar entrada.
- El campo **Timezone** es crítico para notificaciones y cálculos de disponibilidad.
- El **Type** (Physical/Virtual/Hybrid) influye en qué campos son required.
- Si hay múltiples monedas/idiomas, considerar UI adaptativa por ubicación.
