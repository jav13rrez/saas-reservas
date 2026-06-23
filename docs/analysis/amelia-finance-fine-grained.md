# Amelia Finance — Fine-Grained Documentation

## Overview

**Finance** administra aspectos económicos: pagos de clientes, cupones/descuentos, tarjetas de regalo, comiisiones de empleados, reportes de ingresos. Típicamente multipart con sub-tabs para cada área.

---

## Finance Sub-Sections

### 1. Payments Tab

**Historial de todos los pagos (reservas + eventos).**

#### Controles

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Search Box** | Input text | Buscar por: nombre cliente, ID reserva | - | 🔶 | 🟡 |
| **Filter / Status** | Buttons | `Pending`, `Paid`, `Refunded`, `Partial`, `All` | All | 🔶 | 🟡 |
| **Date Range** | Input rango | `MMM DD, YYYY - MMM DD, YYYY` | Last 30 days | 🔶 | 🟡 |
| **Filter / Payment Method** | Multi-select | `Cash`, `Card`, `Bank Transfer`, `Stripe`, `PayPal`, etc. | All | 🔶 | 🟡 |

#### Tabla Payments

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **DATE** | Texto | `MMM DD, YYYY HH:MM` | - | 🔶 | 🟡 |
| **CUSTOMER** | Avatar + Texto | Nombre + foto | Click abre perfil | 🔶 | 🟡 |
| **BOOKING / EVENT** | Link | Nombre cita/evento | Click abre detalle | 🔶 | 🟡 |
| **AMOUNT** | Monto USD | `$XX.XX` | - | 🔶 | 🟡 |
| **METHOD** | Badge | `Cash`, `Card`, `Stripe`, etc. | - | 🔶 | 🟡 |
| **STATUS** | Badge | `Pending` (amarillo), `Paid` (verde), `Refunded` (gris), `Partial` (naranja) | Click menu cambiar | 🔶 | 🟡 |
| **REFERENCE** | Texto | ID de pago (Stripe, PayPal, etc.) | - | 🔶 | 🟡 |
| **ACTIONS** | Menú | View Invoice, Refund, Send Receipt | ⋯ menu | 🔶 | 🟡 |

#### Acciones

| Acción | Efecto | Estado SaaS | Prioridad |
|---|---|---|---|
| **View Invoice** | Abre/descarga PDF factura | 🔶 | 🟡 |
| **Refund** | Abre form de reembolso (monto, razón) | 🔶 | 🟡 |
| **Send Receipt** | Envía copia de recibo al cliente | 🔶 | 🟡 |

---

### 2. Coupons Tab

**Gestión de cupones/códigos de descuento.**

#### Controles

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Search Box** | Input text | Buscar por: código, nombre | - | 🔶 | 🟡 |
| **Filter / Status** | Buttons | `Active`, `Inactive`, `Expired`, `All` | Active | 🔶 | 🟡 |
| **+ Add Coupon** | Botón primario | Abre modal New Coupon | - | 🔶 | 🟡 |

#### Tabla Coupons

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **CODE** | Texto | Código cupón (ej: "SUMMER20") | Click abre modal Edit | 🔶 | 🟡 |
| **DISCOUNT** | Texto | `20%` o `$10 off` | - | 🔶 | 🟡 |
| **TYPE** | Badge | `Percentage`, `Fixed Amount` | - | 🔶 | 🟡 |
| **USAGE** | Número | `5 / 10` (usado / máximo) | - | 🔶 | 🟡 |
| **VALID UNTIL** | Fecha | `MMM DD, YYYY` o `Never` | - | 🔶 | 🟡 |
| **STATUS** | Badge | `Active` (verde), `Inactive` (gris), `Expired` (rojo) | Click menu | 🔶 | 🟡 |
| **ACTIONS** | Menú | Edit, Delete, View Usage | ⋯ menu | 🔶 | 🟡 |

#### Modal: New / Edit Coupon

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Coupon Code** | Input text | Código alfanumérico | Required, unique, max 20 | - | 🔶 | 🟡 |
| **Description** | Input text | Descripción interna | Optional, max 100 | - | 🔶 | 🟡 |
| **Discount Type** | Radio | `Percentage`, `Fixed Amount` | Required | `Percentage` | 🔶 | 🟡 |
| **Discount Value** | Input number | % o $ | Required, >0 | 10 | 🔶 | 🟡 |
| **Max Usage** | Input number | Máximo usos (vacío = unlimited) | Optional | Unlimited | 🔶 | 🟡 |
| **Valid From** | Date picker | Fecha inicio | - | Today | 🔶 | 🟡 |
| **Valid Until** | Date picker | Fecha fin (o Never) | ≥ Valid From | - | 🔶 | 🟡 |
| **Applicable To** | Multi-select | `All Services`, `Specific Services` | All | `All Services` | 🔶 | 🟡 |
| **Services** (si Specific) | Checkboxes | Listado de servicios | - | - | 🔶 | 🟡 |
| **Status** | Radio | `Active`, `Inactive` | - | `Active` | 🔶 | 🟡 |

---

### 3. Gift Cards Tab

**Administración de tarjetas de regalo (store credit).**

#### Controles

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Search Box** | Input text | Buscar por: cliente, número tarjeta | - | 🔶 | 🟡 |
| **Filter / Status** | Buttons | `Active`, `Used`, `Expired`, `Cancelled` | Active | 🔶 | 🟡 |
| **+ Create Gift Card** | Botón primario | Abre modal New Gift Card | - | 🔶 | 🟡 |

#### Tabla Gift Cards

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **CARD NUMBER** | Texto | ID único (ej: "GIFT-001234") | Click abre detalle | 🔶 | 🟡 |
| **AMOUNT** | Monto USD | Valor original (ej: `$50.00`) | - | 🔶 | 🟡 |
| **BALANCE** | Monto USD | Saldo restante | - | 🔶 | 🟡 |
| **PURCHASED BY** | Texto | Nombre cliente que compró | - | 🔶 | 🟡 |
| **ASSIGNED TO** | Texto | Nombre cliente a quien se asignó (si distinto) | - | 🔶 | 🟡 |
| **PURCHASED DATE** | Fecha | `MMM DD, YYYY` | - | 🔶 | 🟡 |
| **EXPIRY DATE** | Fecha | `MMM DD, YYYY` o `Never` | - | 🔶 | 🟡 |
| **STATUS** | Badge | `Active` (verde), `Used` (gris), `Expired` (rojo) | - | 🔶 | 🟡 |
| **ACTIONS** | Menú | View Details, Resend, Cancel | ⋯ menu | 🔶 | 🟡 |

#### Modal: New / Edit Gift Card

| Campo | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Amount** | Input currency | Valor USD | Required, >0 | 50.00 | 🔶 | 🟡 |
| **Purchased By** | Combobox (customer) | Cliente que compra (si regalo) | - | - | 🔶 | 🟡 |
| **Assign To** | Combobox (customer) | Cliente beneficiario (puede ser nuevo) | - | - | 🔶 | 🟡 |
| **Email To Customer** | Checkbox | ☑ Enviar código por email | - | True | 🔶 | 🟡 |
| **Valid Until** | Date picker | Fecha expiración (o Never) | - | 1 year from today | 🔶 | 🟡 |
| **Personal Message** | Text area | Mensaje personalizado (p.ej en regalo) | Optional, max 200 | - | 🔶 | 🟡 |

---

## Global Finance Controls

### Totals / KPIs Section

Resumen visible en top de Finance:

| Métrica | Tipo | Valor | Período | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Total Revenue** | KPI | `$X,XXX.XX` | Período seleccionado | 🔶 | 🟡 |
| **Outstanding Payments** | KPI | `$XXX.XX` (Pending + Partial) | - | 🔶 | 🟡 |
| **Refunds Issued** | KPI | `$XXX.XX` | Período seleccionado | 🔶 | 🟡 |
| **Discounts Applied** | KPI | `$XXX.XX` (via cupones) | Período seleccionado | 🔶 | 🟡 |

### Export / Reports

| Control | Tipo | Opciones | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Export Payments** | Button | CSV, PDF, Excel | 🔶 | 🟡 |
| **Export Coupons Used** | Button | CSV | 🔶 | 🟡 |
| **Financial Report** | Button | Abre PDF report (ingresos, gastos, profit) | 🔶 | 🟡 |

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

*(Ninguna identificada.)*

### Prioridad Amarilla (🟡)

1. **Payment Gateway Integration** — ¿Stripe/PayPal integrados? ¿Manual entry? ¿Webhooks para confirmar pagos?
2. **Refund Workflow** — ¿Reembolso manual o automático a método original? ¿Aprobación requerida?
3. **Commission Calculation** — ¿Automático según perfil empleado o manual? ¿Reportable aquí?
4. **Tax Handling** — ¿Incluir impuestos en cálculos? ¿Rates por ubicación?
5. **Recurring Payments** — ¿Membresías/suscripciones? ¿Pagos automáticos?
6. **Store Credit / Gift Cards** — ¿Plenamente implementado o parcial?
7. **Reconciliation** — ¿Herramientas para conciliar pagos online vs. registros?

### Notas de Implementación

- Los **Status de Pago** (Pending, Paid, Partial, Refunded) deben ser intuitivos visualmente (colores, iconos).
- Los **Coupons** aplicables solo en checkout (no documentado aquí pero crítico para UX).
- Los **Gift Cards** pueden ser comprados como producto o generados administrativamente.
- El **Export** debería incluir metadatos (fecha export, período, filtros aplicados).
- Los **Períodos** de reporte (30/60/90 días, trimestral, anual) son configurables.
