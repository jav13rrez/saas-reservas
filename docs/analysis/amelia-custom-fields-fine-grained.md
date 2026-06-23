# Amelia Custom Fields — Fine-Grained Documentation

## Overview

**Custom Fields** permite crear campos de formulario personalizados que se aplican a entidades (Customers, Appointments, Events, Employees). Cada campo tiene tipo, validación, y aplica a contextos específicos.

---

## Custom Fields List View

### Controles Superiores

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Filter / Entity Type** | Buttons / Dropdown | `Customer`, `Appointment`, `Event`, `Employee`, `All` | All | 🔶 | 🟡 |
| **Search Box** | Input text | Buscar por: nombre campo | - | 🔶 | 🟡 |
| **+ Add Custom Field** | Botón primario | Abre modal New Field | - | 🔶 | 🟡 |

### Tabla Custom Fields

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **NAME** | Texto | Nombre del campo (ej: "Newsletter Preference") | Click abre modal Edit | 🔶 | 🟡 |
| **TYPE** | Badge | Tipo campo (ej: "Text", "Dropdown", "Checkbox") | - | 🔶 | 🟡 |
| **APPLIES TO** | Badges | Listado de entidades (`Customer`, `Appointment`, etc.) | - | 🔶 | 🟡 |
| **REQUIRED** | Badge | "✓" si obligatorio, "-" si opcional | - | 🔶 | 🟡 |
| **VISIBLE IN** | Texto | Dónde aparece (admin form, booking widget, etc.) | - | 🔶 | 🟡 |
| **ACTIONS** | Menú | Edit, Delete, Duplicate | ⋯ menu | 🔶 | 🟡 |

---

## Modal: New / Edit Custom Field

### Basic Info

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|---|
| **Field Name** | Input text | Nombre único | Required, unique, max 50 | - | 🔶 | 🟡 |
| **Field Label** | Input text | Etiqueta para mostrar | Required, max 100 | = Field Name | 🔶 | 🟡 |
| **Description** | Text area | Ayuda/instrucciones | Optional, max 200 | - | 🔶 | 🟡 |
| **Field Type** | Dropdown | Tipo campo (ver abajo) | Required | `Text` | 🔶 | 🟡 |
| **Required** | Checkbox | ☑ Campo obligatorio | - | False | 🔶 | 🟡 |
| **Placeholder** | Input text | Texto placeholder en input | Optional | - | 🔶 | 🟡 |

### Entity Type Selection

| Elemento | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Applies To** | Checkboxes | ☑ Customer, ☑ Appointment, ☑ Event, ☑ Employee | 🔶 | 🟡 |

**Nota**: Al seleccionar, puede cambiar opciones disponibles según entidad.

### Field Type & Options

Dependiendo del tipo seleccionado, aparecen controles adicionales:

#### Type: Text

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Max Length** | Input number | Máximo caracteres | 255 | 🔶 | 🟡 |
| **Regex Validation** | Input text | Patrón regex (opcional) | - | 🔶 | 🟡 |

#### Type: Number

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Min Value** | Input number | Mínimo valor | - | 🔶 | 🟡 |
| **Max Value** | Input number | Máximo valor | - | 🔶 | 🟡 |
| **Decimal Places** | Input number | Decimales permitidos | 0 | 🔶 | 🟡 |

#### Type: Email

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Validation** | Display | "RFC 5322 email validation" | Auto | 🔶 | 🟡 |

#### Type: Phone

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Format** | Dropdown | `International`, `US`, `Custom Regex` | `International` | 🔶 | 🟡 |

#### Type: Date

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Format** | Dropdown | `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD` | `MM/DD/YYYY` | 🔶 | 🟡 |
| **Min Date** | Input date | Fecha mínima permitida | - | 🔶 | 🟡 |
| **Max Date** | Input date | Fecha máxima permitida | - | 🔶 | 🟡 |

#### Type: Dropdown / Select

| Control | Tipo | Contenido / Opciones | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Options List** | Text area (line-separated) | Una opción por línea (ej: "Option 1\nOption 2\nOption 3") | 🔶 | 🟡 |
| **+ Add Option** | Button | Agrega nueva opción interactivamente | 🔶 | 🟡 |
| **Allow Custom Value** | Checkbox | ☑ Permitir que usuario escriba valor no en lista | False | 🔶 | 🟡 |

#### Type: Checkbox / Toggle

| Control | Tipo | Contenido | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Default Value** | Radio | `Checked` / `Unchecked` | `Unchecked` | 🔶 | 🟡 |
| **Label** | Input text | Texto junto a checkbox | - | 🔶 | 🟡 |

#### Type: Textarea

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Max Length** | Input number | Máximo caracteres | 1000 | 🔶 | 🟡 |
| **Rows** | Input number | Número de filas visibles | 4 | 🔶 | 🟡 |

#### Type: File Upload

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Allowed Extensions** | Input text | Ej: "pdf,doc,docx,jpg,png" | "pdf,doc,docx" | 🔶 | 🟡 |
| **Max File Size** | Input size | MB | 5 | 🔶 | 🟡 |

#### Type: Multiselect

| Control | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Options List** | Text area | Una opción por línea | 🔶 | 🟡 |
| **+ Add Option** | Button | Agrega opción interactivamente | 🔶 | 🟡 |

### Display & Visibility

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Show in Customer Form** (si Customer selected) | Checkbox | ☑ / ☐ | True | 🔶 | 🟡 |
| **Show in Booking Widget** (si Appointment selected) | Checkbox | ☑ / ☐ | False | 🔶 | 🟡 |
| **Show in Admin Panel** | Checkbox | ☑ / ☐ | True | 🔶 | 🟡 |
| **Editable by Client** | Checkbox | ☑ / ☐ (si en widget) | False | 🔶 | 🟡 |
| **Display Order** | Input number | Orden en formulario | Auto | 🔶 | 🟡 |

### Advanced

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Conditional Display** | Checkbox | ☑ Show only if (another field has value) | False | 🔶 | 🟡 |
| **Condition Logic** (si checked) | Dropdown + Select | `If [Field X] [is/contains/equals] [value Y]` | - | 🔶 | 🟡 |

---

## Supported Field Types Summary

| Type | Use Case | Validatio | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Text** | Nombre, dirección, notas cortas | Max length, regex | 🔶 | 🟡 |
| **Number** | Edad, cantidad, ID | Min/max, decimals | 🔶 | 🟡 |
| **Email** | Email adicional | RFC 5322 | 🔶 | 🟡 |
| **Phone** | Teléfono | Format masks | 🔶 | 🟡 |
| **Date** | Fecha nacimiento, fecha evento | Min/max date | 🔶 | 🟡 |
| **Dropdown** | Categoría, preferencia | Listado fijo | 🔶 | 🟡 |
| **Multiselect** | Múltiples preferencias | Listado checkable | 🔶 | 🟡 |
| **Checkbox** | Aceptación T&Cs, opt-in | On/off | 🔶 | 🟡 |
| **Textarea** | Notas largas, descripción | Max length | 🔶 | 🟡 |
| **File Upload** | Documentos, certificados | Format, size | 🔶 | 🟡 |

---

## Acciones Rápidas desde Fila

| Acción | Efecto | Estado SaaS | Prioridad |
|---|---|---|---|
| **Edit** | Abre modal Edit Field | 🔶 | 🟡 |
| **Delete** | Confirmación, elimina campo (datos históricos?) | 🔶 | 🟡 |
| **Duplicate** | Crea copia del campo con "_copy" en nombre | 🔶 | 🟡 |

---

## Field Application Examples

### Customer Custom Field

Ej: "Preferred Contact Method"
- Type: Dropdown
- Applies To: `Customer`
- Options: `Email`, `Phone`, `SMS`
- Visible in: Admin panel + Customer profile form
- Usado en notificaciones para respetar preferencia

### Appointment Custom Field

Ej: "Session Notes for Therapist"
- Type: Textarea
- Applies To: `Appointment`
- Required: False
- Visible in: Booking widget (optional), Admin appointment detail
- Editable by client: True

### Event Custom Field

Ej: "Dietary Restrictions"
- Type: Multiselect
- Applies To: `Event`
- Options: `Vegetarian`, `Vegan`, `Gluten-free`, `Nut-free`, `None`
- Visible in: Event registration widget
- Editable by client: True

---

## Data Storage & Retrieval

- Custom field values se almacenan en tabla dinámica (ej: `custom_field_values`) vinculada a entidad + field ID.
- En formularios, aparecen junto a campos nativos.
- En reportes/exports, incluidos como columnas adicionales.

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

*(Ninguna identificada.)*

### Prioridad Amarilla (🟡)

1. **Conditional Display Logic** — ¿Soportado? ¿Complejidad (AND/OR)?
2. **Field Migration** — Si cambio tipo de field (Text → Dropdown), ¿se migra data?
3. **Bulk Edit** — ¿Editar valores de custom field para múltiples registros?
4. **Default Values** — ¿Soportado para todos los tipos?
5. **Formatting on Display** — ¿Dates/numbers se formatean según locale?
6. **Validation on Save** — ¿Se valida al guardar entity o al llenar form?
7. **Export Custom Fields** — ¿Se incluyen en CSV exports automáticamente?

### Notas de Implementación

- Los **field types** deben ser claramente categorizados (input, selection, file, etc.).
- La **validación** debe ser lado-cliente (UX) y lado-servidor (seguridad).
- Los **campos condicionales** pueden requerir JavaScript para mostrar/ocultar dinámicamente.
- El **File Upload** type requiere almacenamiento seguro (AWS S3, etc.).
- Los **custom fields** en booking widget afectan UX del cliente; mostrar solo lo esencial.
- La **reutilización** entre entidades (ej: field usado en Appointment y Customer) requiere mapeo cuidadoso.
