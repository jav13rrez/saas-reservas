# Amelia Employees — Fine-Grained Documentation

## Overview

**Employees** administra los recursos humanos: empleados, instructores, terapeutes, etc. Cada empleado tiene perfil completo con horarios de trabajo, días libres, servicios que ofrecen, ubicaciones asignadas, información de contacto, y datos financieros (comisiones, pagos).

---

## Employees List View

### Controles Superiores

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Search Box** | Input text | Buscar por: nombre, email, teléfono | - | 🔶 | 🟡 |
| **Filter / Status** | Buttons/Dropdown | `Active`, `Inactive`, `All` | Active | 🔶 | 🟡 |
| **+ Add Employee** | Botón primario | Abre modal New Employee | - | ✅ | 🟢 |

### Tabla Employees

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **NAME** | Avatar + Texto | Nombre + foto circular | Click abre modal Edit | ✅ | 🟢 |
| **EMAIL** | Texto | Dirección email | - | ✅ | 🟢 |
| **PHONE** | Texto | Número teléfono | - | ✅ | 🟢 |
| **SERVICES** | Texto / Badges | Servicios que ofrece (ej: "Aerobic, Yoga") | - | 🔶 | 🟡 |
| **LOCATIONS** | Texto / Badges | Ubicaciones asignadas | - | 🔶 | 🟡 |
| **STATUS** | Badge | `Active` (verde), `Inactive` (gris) | Click abre menu cambiar | 🔶 | 🟡 |
| **ACTIONS** | Menú | Edit, Delete, View Schedule, Message | ⋯ menu | 🔶 | 🟡 |

---

## Modal: New / Edit Employee

### Estructura General

Tabs / Sections:
1. **Details** (info básica: nombre, email, teléfono, foto)
2. **Work Hours** (horarios de trabajo por día de semana)
3. **Days Off** (días libres, vacaciones)
4. **Special Days** (días con horario especial)
5. **Services** (servicios que ofrece)
6. **Assigned Locations** (ubicaciones donde trabaja)
7. **Finance** (comisión, tarifa, información de pago)

### Tab: Details

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **First Name** | Input text | Nombre | Required, max 50 | - | ✅ | 🟢 |
| **Last Name** | Input text | Apellido | Required, max 50 | - | ✅ | 🟢 |
| **Email** | Input email | Email | Required, unique | - | ✅ | 🟢 |
| **Phone** | Input tel | Teléfono | Format: +XX-XXX-XXX-XXXX | - | ✅ | 🟢 |
| **Profile Photo** | File upload | JPG, PNG (max 2MB) | Optional | No photo | 🔶 | 🟡 |
| **Status** | Radio | `Active`, `Inactive` | - | `Active` | ✅ | 🟢 |
| **Role / Title** | Input text | Título puesto (ej: "Instructor", "Therapist") | Optional | - | 🔶 | 🟡 |
| **Description** | Text area | Bio / descripción corta para clientes | Optional | - | 🔶 | 🟡 |
| **Send Welcome Email** | Checkbox | ☑ / ☐ | - | True | 🔶 | 🟡 |

### Tab: Work Hours

Estructura: **7 acordeones / fila por día de semana (MON-SUN)**

Cada día tiene:

| Campo | Tipo | Opciones | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Day of Week** | Label | MON, TUE, WED, THU, FRI, SAT, SUN | Read-only | - | ✅ | 🟢 |
| **Working** | Toggle / Checkbox | ☑ Working / ☐ Day Off | - | True (Mon-Fri), False (Sat-Sun) | ✅ | 🟡 |
| **Start Time** | Time picker (si Working=true) | HH:MM AM/PM | - | 09:00 AM | ✅ | 🟢 |
| **End Time** | Time picker (si Working=true) | HH:MM AM/PM | ≥ Start Time | 05:00 PM | ✅ | 🟢 |
| **Break Start** (si existe) | Time picker | HH:MM AM/PM | - | 12:00 PM | 🔶 | 🟡 |
| **Break End** (si existe) | Time picker | HH:MM AM/PM | > Break Start | 01:00 PM | 🔶 | 🟡 |
| **Lunch Break** (si existe) | Toggle | ☑ Has Lunch Break | - | False | 🔶 | 🟡 |

*Nota: ¿Hay funcionalidad de "breaks" durante el día? Confirmear en Amelia.*

### Tab: Days Off

| Elemento | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Days Off List** | Table | Date, Reason (ej: "Vacation", "Sick"), Repeat (ej: "Yearly") | Edit, Delete | 🔶 | 🟡 |
| **+ Add Day Off** | Button | Abre picker date + reason | Click agrega | 🔶 | 🟡 |
| **Date** | Date picker | Cualquier fecha | Required | - | 🔶 | 🟡 |
| **Reason** | Dropdown / Text | `Vacation`, `Sick Leave`, `Personal`, `Holiday`, `Custom text` | - | - | 🔶 | 🟡 |
| **Repeat** | Checkbox + Dropdown | ☑ Repeat Yearly (si es feriado fijo) | - | False | 🔶 | 🟡 |
| **Repeat Every** (si checked) | Number input | N años | - | 1 | 🔶 | 🟡 |

### Tab: Special Days

Días donde las horas de trabajo son distintas a lo normal.

| Elemento | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Special Days List** | Table | Date, Start Time, End Time, Reason | Edit, Delete | 🔶 | 🟡 |
| **+ Add Special Day** | Button | Abre form date + times | Click agrega | 🔶 | 🟡 |
| **Date** | Date picker | - | Required | - | 🔶 | 🟡 |
| **Start Time** | Time picker | - | - | 09:00 AM | 🔶 | 🟡 |
| **End Time** | Time picker | - | ≥ Start | 05:00 PM | 🔶 | 🟡 |
| **Reason** | Text input | Ej: "Holiday hours", "Extended hours" | Optional | - | 🔶 | 🟡 |

### Tab: Services

Multi-select de servicios que ofrece este empleado.

| Elemento | Tipo | Contenido / Opciones | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Services Checklist** | Checkboxes | Listado de todos los servicios (se pueden filtrar) | 🔶 | 🟡 |
| **Search / Filter** | Input | Buscar servicio por nombre | 🔶 | 🟡 |
| **[✓] Service Name** | Checkbox + expand | Ej: "Yoga" → expande para mostrar opciones: Duración, Precio fijo (override), Min buffer | 🔶 | 🟡 |
| **Service Duration** (si expand) | Time picker | Duración estándar del servicio (read-only o override?) | 🔶 | 🟡 |
| **Price Override** (si expand) | Input currency | Precio custom para este empleado (vacío = usa precio servicio) | 🔶 | 🟡 |
| **Minimum Buffer** (si expand) | Input min | Buffer mínimo entre reservas (ej: 15 min) | 🔶 | 🟡 |

*Nota: ADR-0016 menciona que la asignación de servicios es mediante el Resource. Verificar modelo actual.*

### Tab: Assigned Locations

Multi-select de ubicaciones donde trabaja este empleado.

| Elemento | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Locations Checkboxes** | Checkboxes | Listado de ubicaciones, ☑ si asignado | 🔶 | 🟡 |
| **[✓] Location Name** | Checkbox | Ej: "Downtown Studio", "Gym A" | 🔶 | 🟡 |

*Nota: Correlaciona con campo `resourceIds[]` que debería tener `locationIds[]` según ADR-0016.*

### Tab: Finance

| Campo | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Commission Type** | Radio | `Percentage`, `Fixed Amount`, `No Commission` | `Percentage` | 🔶 | 🟡 |
| **Commission Value** (si % o Fixed) | Input number + % | Ej: 20% o $50/reserva | - | 20% | 🔶 | 🟡 |
| **Payment Method** | Dropdown | `Bank Transfer`, `Check`, `Cash`, `PayPal`, `Stripe` | `Bank Transfer` | 🔶 | 🟡 |
| **Bank Account** (si BT) | Input IBAN/Routing | Account number para pagos | Optional | - | 🔶 | 🟡 |
| **Salary / Hourly Rate** (si aplica) | Input currency | Salario mensual o tarifa horaria | Optional | - | 🔶 | 🟡 |
| **Contract Type** | Dropdown | `Full-time`, `Part-time`, `Contract`, `Freelance` | - | 🔶 | 🟡 |

---

## Acciones Rápidas desde Fila

| Acción | Efecto | Estado SaaS | Prioridad |
|---|---|---|---|
| **Edit** | Abre modal Edit Employee (todos los tabs) | ✅ | 🟢 |
| **Delete** | Confirmación, elimina empleado (¿qué pasa con reservas existentes?) | 🔶 | 🟡 |
| **View Schedule** | Abre calendario de empleado (próximas reservas) | 🔶 | 🟡 |
| **Message** | Abre composer SMS/Email para enviar mensaje | 🔶 | 🟡 |
| **Deactivate** | Cambia status a Inactive (sin eliminar data) | 🔶 | 🟡 |

---

## Validaciones y Lógica

1. **Horas de Trabajo**: 
   - No pueden sobreponerse breaks con horas de trabajo
   - Si Working=false un día, start/end times se deshabilitan

2. **Servicios**:
   - ¿Empleado sin servicios asignados puede recibir reservas?
   - ¿Override de precio debe ser válido (≥0)?

3. **Ubicaciones**:
   - Empleado debe tener ≥1 ubicación asignada
   - Al crear reserva, empleado debe estar en esa ubicación

4. **Días Libres vs Special Days**:
   - Si hay Day Off y Special Day en misma fecha, ¿cuál prevalece?
   - Ambos bloquean reservas en ese día

5. **Inactivación**:
   - Al marcar Inactive, ¿se cancela automáticamente futuras reservas?

6. **Eliminación**:
   - ¿Soft delete o hard delete?
   - ¿Qué pasa con reservas históricas?

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

1. **Service Assignment Model** — ADR-0016 indica que va a cambiar. Documentar modelo actual vs futuro.

### Prioridad Amarilla (🟡)

1. **Break / Buffer Time** — Confirmar si existe "break" durante turno y cómo se valida.
2. **Repeat Yearly Days Off** — Confirmar si feriados fijos se repiten automáticamente.
3. **Price Overrides** — Confirmar si se permite override de precio por servicio/empleado.
4. **Deletion Behavior** — Qué ocurre con historial de reservas si se elimina empleado.
5. **Inactivation Cascade** — ¿Se cancela automáticamente futuras reservas al inactivar?
6. **Finance Integration** — ¿Integración con sistema de pago para comisiones? ¿Manual?

### Notas de Implementación

- Los tabs de Work Hours, Days Off, Special Days están pensados para ser expandibles/colapsables para mejor UX.
- Las Checkboxes de servicios/ubicaciones pueden ser scrolleables si hay muchas opciones.
- El Tab Finance probablemente sea visible solo para ciertos roles (manager, admin).
- Photo upload debería tener preview e imagen circular (avatar).
- Status Active/Inactive es fundamental; Inactive debería deshabilitar para nuevas reservas.
