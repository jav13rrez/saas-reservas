# Amelia Customers — Fine-Grained Documentation

## Overview

**Customers** administra los datos de clientes que han realizado o están registrados para hacer reservas. Cada cliente tiene perfil con contacto, dirección, historial de reservas, preferencias, y datos financieros (facturas, créditos).

---

## Customers List View

### Controles Superiores

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Search Box** | Input text | Buscar por: nombre, email, teléfono | - | ✅ | 🟢 |
| **Filter / Status** | Buttons | `Active`, `Inactive`, `All` | Active | 🔶 | 🟡 |
| **Filter / Recent** | Quick filter | `Last 30 days`, `Last 90 days`, `All` | All | 🔶 | 🟡 |
| **+ Add Customer** | Botón primario | Abre modal New Customer | - | ✅ | 🟢 |

### Tabla Customers

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **NAME** | Avatar + Texto | Nombre + foto circular | Click abre modal Edit | ✅ | 🟢 |
| **EMAIL** | Texto | Dirección email | - | ✅ | 🟢 |
| **PHONE** | Texto | Número teléfono | - | ✅ | 🟢 |
| **CITY** | Texto | Ciudad | - | 🔶 | 🟡 |
| **BOOKINGS** | Número | "5 bookings" | Click abre historial | 🔶 | 🟡 |
| **TOTAL SPENT** | Monto USD | `$XXX.XX` (suma de pagos) | - | 🔶 | 🟡 |
| **LAST BOOKING** | Fecha | `MMM DD, YYYY` | - | 🔶 | 🟡 |
| **STATUS** | Badge | `Active` (verde), `Inactive` (gris), `Blacklisted` (rojo) | Click menu | 🔶 | 🟡 |
| **ACTIONS** | Menú | Edit, Delete, Send Message, View Bookings | ⋯ menu | 🔶 | 🟡 |

---

## Modal: New / Edit Customer

### Estructura General

Tabs / Sections:
1. **Details** (información básica y contacto)
2. **Address** (dirección física y de facturación)
3. **Bookings** (historial de reservas)
4. **Invoices** (facturas y pagos)
5. **Notes** (notas internas)

### Tab: Details

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **First Name** | Input text | Nombre | Required, max 50 | - | ✅ | 🟢 |
| **Last Name** | Input text | Apellido | Optional, max 50 | - | ✅ | 🟢 |
| **Email** | Input email | Email | Required, unique | - | ✅ | 🟢 |
| **Phone** | Input tel | Teléfono | Optional, format +XX-XXX | - | ✅ | 🟢 |
| **Date of Birth** | Date picker | YYYY-MM-DD | Optional | - | 🔶 | 🟡 |
| **Gender** | Radio / Dropdown | `Male`, `Female`, `Other`, `Prefer not to say` | Optional | - | 🔶 | 🟡 |
| **Profile Photo** | File upload | JPG, PNG (max 2MB) | Optional | Default avatar | 🔶 | 🟡 |
| **Password** (si nuevo) | Input password | - | Required si nuevo cliente | - | 🔶 | 🟡 |
| **Newsletter Opt-in** | Checkbox | ☑ / ☐ | - | False | 🔶 | 🟡 |
| **Status** | Radio | `Active`, `Inactive`, `Blacklisted` | `Active` | 🔶 | 🟡 |
| **Note on Blacklist** (si Blacklisted) | Text area | Razón del blacklist | - | - | 🔶 | 🟡 |

### Tab: Address

| Campo | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Street Address** | Input text | Dirección | - | 🔶 | 🟡 |
| **City** | Input text | Ciudad | - | 🔶 | 🟡 |
| **State / Province** | Input text | Estado/Provincia | - | 🔶 | 🟡 |
| **Postal Code** | Input text | Código postal | - | 🔶 | 🟡 |
| **Country** | Dropdown | Listado países | - | 🔶 | 🟡 |
| **Billing Address (Different)** | Checkbox | ☑ / ☐ | False | 🔶 | 🟡 |
| **Billing Address Fields** (si checked) | Inputs | Iguales a arriba | - | 🔶 | 🟡 |

### Tab: Bookings

| Elemento | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Bookings History Table** | Table (readonly) | DATE, TIME, SERVICE, EMPLOYEE, STATUS, AMOUNT | View detail | 🔶 | 🟡 |
| **Pagination** | Controls | Si hay muchas reservas | Navigate | 🔶 | 🟡 |

### Tab: Invoices

| Elemento | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Invoices List** | Table | INV. NO., DATE, AMOUNT, PAID, DUE DATE | View PDF, Download, Resend | 🔶 | 🟡 |
| **Credit Balance** | Display | `$XXX.XX available credit` (si existe store credit) | - | 🔶 | 🟡 |
| **Manual Payment Log** | Table (readonly) | DATE, AMOUNT, METHOD, NOTE | - | 🔶 | 🟡 |

### Tab: Notes

| Campo | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Staff Notes** | Text area | Notas internas (no visible cliente) | 🔶 | 🟡 |
| **Activity Timeline** (readonly) | Log | Historial de cambios, emails enviados, etc. | 🔶 | 🟡 |

---

## Acciones Rápidas desde Fila

| Acción | Efecto | Estado SaaS | Prioridad |
|---|---|---|---|
| **Edit** | Abre modal Edit Customer (todos tabs) | ✅ | 🟢 |
| **Delete** | Confirmación, elimina cliente (¿reservas históricas?) | 🔶 | 🟡 |
| **Send Message** | Abre composer SMS/Email | 🔶 | 🟡 |
| **View Bookings** | Abre historial de reservas del cliente | 🔶 | 🟡 |
| **Blacklist** | Cambia status a Blacklisted | 🔶 | 🟡 |

---

## Bulk Actions (si existen)

| Acción | Efecto | Estado SaaS | Prioridad |
|---|---|---|---|
| **Send Email to Selected** | Composer SMS/Email para múltiples clientes | 🔶 | 🟡 |
| **Export to CSV** | Descarga listado en formato CSV | 🔶 | 🟡 |
| **Change Status (Bulk)** | Marca múltiples clientes como Inactive/Blacklisted | 🔶 | 🟡 |

---

## Validaciones y Lógica

1. **Email**: Debe ser único en el sistema. Auto-check en tiempo real mientras escribe.

2. **Password**: 
   - Si cliente nuevo: requerido al crear
   - Si edit cliente: opción de reset password (enví reset link)

3. **Blacklist**:
   - Si blacklisted, no puede hacer nuevas reservas
   - Histra historial: reservas existentes se conservan

4. **Newsletter Opt-in**:
   - Correlaciona con preferencias de email/SMS

5. **Credit Balance**:
   - Puede ser resultado de reembolsos o promociones
   - Aplicable a futuras reservas

6. **Address Optional**:
   - No requerido para reservas online, pero útil para envíos/facturas

---

## Integración con Reservas

- Cuando se crea una reserva con cliente existente, algunos campos se pre-rellenan (email, teléfono, dirección).
- Si cliente nuevo se crea desde modal de reserva, se redirige aquí para completar perfil (opcional en workflow rápido).
- Cambios en perfil cliente no retroactivos a reservas pasadas, solo a futuras.

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

*(Ninguna identificada.)*

### Prioridad Amarilla (🟡)

1. **Blacklist Functionality** — Confirmar si previene nuevas reservas o solo marca registro.
2. **Store Credit** — ¿Existe? ¿Manual entry o automático (reembolsos)?
3. **Password Reset Flow** — ¿Admin puede resetear o solo cliente via email link?
4. **Billing Address** — ¿Separado de dirección física o siempre igual?
5. **Customer Groups/Segments** — ¿Opción de etiquetar clientes (VIP, Corporate, etc.)?
6. **Export / Bulk Actions** — ¿Existen? ¿Qué acciones soportan?

### Notas de Implementación

- El **Profile Photo** puede ser avatar con iniciales si no hay foto.
- El **Newsletter Opt-in** debería estar claro y GDPR compliant.
- El **Gender** es optional (respeto a privacidad).
- El **Status** Blacklisted debería advertencia visual clara en modal.
- El **Activity Timeline** en Notes es read-only y muestra eventos automáticos (login, emails, cambios estado).
- Los tabs **Bookings** e **Invoices** son readonly desde este modal (links a secciones principales).
