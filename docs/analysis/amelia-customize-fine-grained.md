# Amelia Customize — Fine-Grained Documentation

## Overview

**Customize** permite personalizar el **widget de reserva** embebible en WordPress (form que los clientes usan para reservar servicios). Controla pasos del checkout, campos visibles, labels, colores, y comportamiento del flujo de reserva.

---

## Customize Structure

Típicamente tiene tabs:
1. **Booking Form** (pasos, campos, validación)
2. **Appearance** (colores, fonts, branding)
3. **Settings** (comportamiento: redireccionamiento, confirmación, etc.)

---

## Tab: Booking Form

### Steps Configuration

El form está dividido en **pasos/páginas** que el cliente recorre. Típicamente:
1. Step 1: **Select Service** (elegir servicio)
2. Step 2: **Select Employee** (elegir empleado/instructor)
3. Step 3: **Select Date & Time** (fecha y hora)
4. Step 4: **Enter Customer Details** (nombre, email, teléfono)
5. Step 5: **Payment** (método de pago, confirmar)
6. Step 6: **Confirmation** (resumen, botón confirmar/pagar)

### Step Controls

Para cada Step, existen controles:

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Step Title** | Input text | Nombre del paso | Ej: "Select Service" | 🔶 | 🟡 |
| **Step Description** | Text area | Texto explicativo | Optional | 🔶 | 🟡 |
| **Required** | Checkbox | ☑ Este paso es obligatorio | True (excepto Confirmation) | 🔶 | 🟡 |
| **Show in Summary** | Checkbox | ☑ Mostrar resumen de este paso al final | True | 🔶 | 🟡 |

### Fields per Step

Cada paso tiene **campos configurables**:

#### Step 1: Select Service

| Campo | Control | Visible | Label | Required | Estado SaaS | Prioridad |
|---|---|---|---|---|---|---|
| **Service Selection** | Dropdown/Grid | ☑ | "Select a Service" | ✓ | 🔶 | 🟡 |
| **Service Description** | Toggle | ☑ | - | - | 🔶 | 🟡 |
| **Service Price** | Toggle | ☑ | - | - | 🔶 | 🟡 |
| **Service Duration** | Toggle | ☑ | - | - | 🔶 | 🟡 |

#### Step 2: Select Employee

| Campo | Control | Visible | Label | Required | Estado SaaS | Prioridad |
|---|---|---|---|---|---|---|
| **Employee Selection** | Dropdown | ☑ | "Select an Employee" | ☐ | 🔶 | 🟡 |
| **Employee Avatar** | Toggle | ☑ | - | - | 🔶 | 🟡 |
| **Employee Bio** | Toggle | ☑ | - | - | 🔶 | 🟡 |

#### Step 3: Select Date & Time

| Campo | Control | Visible | Label | Required | Estado SaaS | Prioridad |
|---|---|---|---|---|---|---|
| **Date Picker** | Calendar | ☑ | "Select a Date" | ✓ | 🔶 | 🟡 |
| **Time Picker** | Time selector | ☑ | "Select a Time" | ✓ | 🔶 | 🟡 |
| **Duration Override** | Input | ☐ | "Duration" | ☐ | 🔶 | 🟡 |

#### Step 4: Customer Details

| Campo | Control | Visible | Label | Required | Estado SaaS | Prioridad |
|---|---|---|---|---|---|---|
| **First Name** | Input text | ☑ | "First Name" | ✓ | 🔶 | 🟡 |
| **Last Name** | Input text | ☑ | "Last Name" | ☐ | 🔶 | 🟡 |
| **Email** | Input email | ☑ | "Email Address" | ✓ | 🔶 | 🟡 |
| **Phone** | Input tel | ☑ | "Phone Number" | ☐ | 🔶 | 🟡 |
| **Address** | Input text | ☐ | "Address" | ☐ | 🔶 | 🟡 |
| **City** | Input text | ☐ | "City" | ☐ | 🔶 | 🟡 |
| **Zip Code** | Input text | ☐ | "Postal Code" | ☐ | 🔶 | 🟡 |
| **Country** | Dropdown | ☐ | "Country" | ☐ | 🔶 | 🟡 |

Nota: **Required checkmark** indica si es campo obligatorio en el checkout.

#### Step 5: Payment

| Campo | Control | Visible | Label | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Payment Method Selection** | Radio/Dropdown | ☑ | "Payment Method" | 🔶 | 🟡 |
| **Coupon Code** | Input | ☑ | "Coupon Code (optional)" | 🔶 | 🟡 |
| **Price Summary** | Display | ☑ | - | 🔶 | 🟡 |
| **Terms & Conditions** | Checkbox | ☑ | "I agree to Terms" | 🔶 | 🟡 |
| **T&C Link** (si checked) | Input URL | - | URL a terms | 🔶 | 🟡 |

#### Step 6: Confirmation

| Elemento | Tipo | Editable | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Confirmation Title** | Input text | ☑ | "Booking Confirmed!" | 🔶 | 🟡 |
| **Confirmation Message** | Text area | ☑ | Mensaje customizado | 🔶 | 🟡 |
| **Confirmation Email** | Display | - | "A confirmation email has been sent..." | 🔶 | 🟡 |
| **Booking Details Summary** | Display (readonly) | - | Resumen de pasos anteriores | 🔶 | 🟡 |

### Custom Fields Integration

Si Custom Fields están habilitados:

| Función | Tipo | Estado SaaS | Prioridad |
|---|---|---|---|
| **+ Add Custom Field** | Button | Abre selector de custom fields disponibles | 🔶 | 🟡 |
| **Custom Field in Steps** | Checkbox per field | ☑ Include in booking form | 🔶 | 🟡 |
| **Field Position** | Dropdown | Which step to display | 🔶 | 🟡 |

---

## Tab: Appearance

### Color & Branding

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Primary Color** | Color picker | Hex color | `#7B68EE` | 🔶 | 🟡 |
| **Secondary Color** | Color picker | Hex color | `#6B5B95` | 🔶 | 🟡 |
| **Button Color** | Color picker | Hex color | `#7B68EE` | 🔶 | 🟡 |
| **Text Color** | Color picker | Hex color | `#333333` | 🔶 | 🟡 |
| **Background Color** | Color picker | Hex color | `#FFFFFF` | 🔶 | 🟡 |
| **Logo / Image** | File upload | JPG, PNG (max 2MB) | Company logo | 🔶 | 🟡 |

### Typography

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Font Family** | Dropdown | System fonts + Google Fonts | `Inter` | 🔶 | 🟡 |
| **Font Size (Body)** | Slider | 12px - 18px | 14px | 🔶 | 🟡 |
| **Font Size (Heading)** | Slider | 18px - 32px | 24px | 🔶 | 🟡 |

### Layout

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Layout Style** | Radio | `Single Page`, `Steps` (multi-page) | `Steps` | 🔶 | 🟡 |
| **Step Indicator** | Checkbox | ☑ Mostrar progress bar / step numbers | True | 🔶 | 🟡 |
| **Sidebar** | Checkbox | ☑ Show summary sidebar | True | 🔶 | 🟡 |
| **Max Width** | Input px | Ancho máximo widget | 600px | 🔶 | 🟡 |

---

## Tab: Settings

### Behavior & Validation

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Auto-advance Steps** | Checkbox | ☑ Avanzar automáticamente al llenar | False | 🔶 | 🟡 |
| **Show Step Summary** | Checkbox | ☑ Mostrar resumen cada 2-3 pasos | True | 🔶 | 🟡 |
| **Email Confirmation** | Checkbox | ☑ Enviar email confirmación al cliente | True | 🔶 | 🟡 |
| **SMS Confirmation** | Checkbox | ☑ Enviar SMS (si disponible) | False | 🔶 | 🟡 |
| **Require Phone** | Checkbox | ☑ Teléfono obligatorio | False | 🔶 | 🟡 |

### Redirects & URLs

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Redirect on Success** | Checkbox | ☑ Redirigir después de reserva | False | 🔶 | 🟡 |
| **Redirect URL** (si checked) | Input URL | URL destino | - | 🔶 | 🟡 |
| **Redirect on Cancel** | Checkbox | ☑ Redirigir si cliente cancela | False | 🔶 | 🟡 |
| **Cancel URL** (si checked) | Input URL | URL destino | - | 🔶 | 🟡 |

### Advanced

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Allow Past Dates** | Checkbox | ☑ Permitir reservar fechas pasadas | False | 🔶 | 🟡 |
| **Show Unavailable Slots** | Checkbox | ☑ Mostrar en gris slots no disponibles | True | 🔶 | 🟡 |
| **Multiple Services** | Checkbox | ☑ Permitir seleccionar múltiples servicios | False | 🔶 | 🟡 |
| **Location Selection** | Checkbox | ☑ Mostrar selector de ubicación | False | 🔶 | 🟡 |

---

## Preview / Test

| Función | Tipo | Efecto | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Live Preview** | Panel side-by-side | Muestra widget en vivo mientras editas | 🔶 | 🟡 |
| **Desktop / Mobile Toggle** | Button | Cambia preview a mobile view | 🔶 | 🟡 |
| **Test Booking Flow** | Button | Abre modal para test completo (sin guardar) | 🔶 | 🟡 |

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

*(Ninguna identificada.)*

### Prioridad Amarilla (🟡)

1. **Multi-Service Bookings** — ¿Permitir que cliente elija múltiples servicios en una sola reserva?
2. **Dynamic Pricing** — ¿Precio cambia según selecciones (servicio, empleado, fecha)?
3. **Conditional Fields** — ¿Mostrar campo X solo si Y está seleccionado?
4. **Custom Step Order** — ¿Reordenable drag-drop de pasos?
5. **Deposit Capture** — ¿Opción de capturar solo depósito en checkout?
6. **Guest Checkout** — ¿Permitir sin registrarse (guest customer)?
7. **Responsiveness** — ¿Mobile-first design validado?

### Notas de Implementación

- El **Live Preview** debe ser responsive y actualizar sin refresh.
- Los **Labels** customizables son críticos para multi-idioma.
- El **Layout** (single page vs steps) afecta UX drásticamente; step-based es recomendado.
- Los **Colores** deben contrastar adecuadamente (WCAG AA).
- Los **Custom Fields** en checkout requieren validación dinámica.
- El **Redirect on Success** es útil para Google Analytics / tracking.
- El **Timezone** del cliente debe respetarse al mostrar horarios disponibles.
