# Amelia Settings — Descripción fina campo a campo

**Propósito:** Referencia exhaustiva para Claude Code. Cada campo de la pantalla
Settings de Amelia está documentado con tipo, opciones, valor por defecto,
estado en nuestro SaaS y prioridad de implementación.

**Fuente:** Captura directa vía Chrome de `https://sports.wpamelia.com/wp-admin/admin.php?page=wpamelia-settings`
+ notas existentes de `amelia-ux-reference.md`.
**Fecha de captura:** 2026-06-23.

**Leyenda de estado:**
- ✅ Implementado (backend + UI)
- 🔶 En backend, sin UI de configuración
- ❌ No existe en nuestro SaaS

**Leyenda de prioridad:**
- 🔴 Alta (bloquea MVP o flujo principal)
- 🟡 Media (mejora experiencia operador)
- 🟢 Baja / diferible (feature avanzada)

---

## Estructura del menú Settings

```
Settings
├── General
├── Activation
├── Company
│   ├── General
│   ├── Working hours
│   └── Days off
├── Payments
├── Bookings
│   └── Appointments        ← único sub-tab en demo (Events y Packages no aparecen)
├── Notifications
│   ├── General
│   ├── Email
│   └── SMS                 ← requiere cuenta de pago Amelia SMS
└── Roles & permissions
    ├── Employee
    ├── Customer
    └── Admin
```

---

## 1. General

| Campo | Tipo | Opciones / valores | Default demo | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| Default time slot step | dropdown | 1min · 2min · 5min · 10min · 12min · 15min · 20min · **30min** · 45min · 1h · 1h 30min · 2h · 3h · 4h · 6h · 8h | 30min | ❌ no expuesto (hardcoded en motor) | 🟡 |
| Default phone country code | dropdown | «Identify by user's IP address» + todos los países con prefijo | By IP | ❌ | 🟢 |
| Show booking slots in client's time zone | toggle | ON / OFF | **OFF** | ❌ | 🟡 |
| Show Add To Calendar option to customers | toggle | ON / OFF | **ON** | ❌ | 🟡 |
| Default back-end page | dropdown | Dashboard · Calendar · Bookings · Events | Dashboard | ❌ (no aplica — es WP) | 🟢 |
| Default number of items per page (front end) | spinner (number) | cualquier entero positivo | 9 | ❌ | 🟢 |
| Redirect URL after booking | text | URL absoluta | (vacío) | ❌ | 🟡 |
| Minimum time required before booking | dropdown | Disabled · 1min · 2min · 5min · 10min · 12min · 15min · 20min · 30min · 45min · 1h … 8h | Disabled | 🔶 motor US3 tiene política; sin UI | 🔴 |
| Minimum time required before canceling | dropdown | ídem | Disabled | 🔶 ídem | 🔴 |
| Minimum time required before rescheduling | dropdown | ídem | Disabled | 🔶 ídem | 🔴 |
| Period available for booking in advance | spinner (días) | entero positivo | 365 | ❌ | 🟡 |
| Languages | multiselect dropdown | idiomas instalados en WP | (vacío) | ❌ (no aplica — es WP) | 🟢 |

**Observaciones para implementación:**
- Los campos de «Minimum time before …» tienen back-end completamente listo (US3,
  `BookingChangePolicy`). Solo falta una pantalla de configuración por tenant que
  grabe estos valores y el motor los consulte. **Esta es la brecha más crítica de General.**
- `Default time slot step` debería ser un ajuste del tenant; hoy la granularidad está
  hardcoded. Se puede añadir como campo en `tenant_settings`.
- «Redirect URL after booking» → útil para el widget público post-pago; diferible.

---

## 2. Activation

| Campo | Tipo | Notas | Estado SaaS |
|---|---|---|---|
| Purchase code | text | Licencia Envato de Amelia | ❌ no aplica (SaaS nativo) |
| Activate with Envato | button | OAuth Envato | ❌ no aplica |
| Preload entities when page loads | toggle ON/OFF | Carga datos en memoria al arrancar | ❌ no aplica (distinta arquitectura) |
| Hide tips & suggestions | toggle ON/OFF | Oculta el panel lateral de tips | ❌ no aplica |

**Observación:** Este sub-tab es específico del plugin WP. No hay equivalente en nuestro SaaS.

---

## 3. Company

### 3a. General

| Campo | Tipo | Notas | Estado SaaS | Prioridad |
|---|---|---|---|---|
| Upload image (logo) | file upload | PNG · JPG · JPEG; logo del tenant | ❌ no hay gestor de logo de tenant en UI | 🟡 |
| Name | text (+ Translate i18n) | Nombre comercial del tenant | 🔶 existe en entidad Tenant; sin UI Settings | 🟡 |
| Address | text | Dirección física; integra Google Maps si hay API key | ❌ | 🟢 |
| Country | select | Lista de países | ❌ | 🟢 |
| Website | text | URL del sitio web del tenant | ❌ | 🟢 |
| VAT number | text | NIF / CIF / número fiscal | ❌ | 🟢 |
| Phone number | phone selector | Selector de país + número | 🔶 | 🟢 |
| Email | text | Email de contacto del negocio | 🔶 | 🟡 |

**Observación:** Estos campos forman el «perfil del tenant». El equivalente SaaS es una
pantalla «Mi negocio / Company profile» que grabe en `tenants` o en una tabla
`tenant_profiles`. Algunos datos (VAT, address) son relevantes para facturas
(módulo Finance). Prioridad media salvo logo + nombre que son básicos.

### 3b. Working hours (horario global de la empresa)

| Campo | Tipo | Valores | Default demo | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| Toggle ON/OFF por día (×7) | toggle | ON = día laborable, OFF = cerrado | Mon–Fri ON, Sat–Sun OFF | ❌ (solo existe por proveedor, no global) | 🟡 |
| Tramo horario por día | time range | HH:MM am/pm – HH:MM am/pm | 9:00 am – 5:00 pm | ❌ | 🟡 |
| «Add work hours» por día | button | Añade tramo adicional (varios tramos/día) | — | ❌ | 🟢 |
| «Apply to all days» | button | Copia el tramo del día a todos los días activos | — | ❌ | 🟢 |

**Observación:** Amelia usa el horario global como **capa base**: el slot válido es la
intersección empresa ∩ empleado ∩ servicio. En nuestro SaaS tenemos Work hours por
proveedor (ADR-0018 / provider-schedule) pero **no tenemos horario de empresa**.
Añadir esta capa requiere una tabla `tenant_working_hours` (dow, start_time, end_time)
y que `AvailabilityService` la consulte antes de los slots del proveedor.

### 3c. Days off (días libres globales de la empresa)

| Campo | Tipo | Notas | Estado SaaS | Prioridad |
|---|---|---|---|---|
| «Add day off» | button | Abre modal para añadir festivo | ❌ | 🟡 |
| Start date | date picker | Inicio del período libre | ❌ | 🟡 |
| End date | date picker | Fin del período libre (puede ser igual a Start) | ❌ | 🟡 |
| Day off name | text | Nombre del festivo (p.ej. "Christmas") | ❌ | 🟡 |
| Repeat yearly | toggle ON/OFF | Si marcado, se repite cada año | ❌ | 🟡 |

**Observación:** Equivalente a una tabla `tenant_days_off`
(start_date, end_date, name, repeat_yearly, tenant_id). Similar a los Days off del
proveedor (ya implementados) pero a nivel de empresa. La disponibilidad debe bloquear
slots que caigan en días libres globales.

---

## 4. Payments

| Campo | Tipo | Opciones / valores | Default demo | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| Currency | dropdown | Lista completa de monedas ISO | US Dollar | ❌ (hardcoded en formateador) | 🟡 |
| Price symbol position | dropdown | Before · After | Before | ❌ | 🟢 |
| Price separator | dropdown | Comma-dot · Dot-comma · Space-dot · etc. | Comma-dot | ❌ | 🟢 |
| Price number of decimals | spinner (0–4) | entero | 2 | ❌ | 🟢 |
| Custom currency symbol | text | Símbolo libre (sobreescribe el de la moneda) | $ | ❌ | 🟢 |
| Default payment method | dropdown | On-site · (Stripe / PayPal / Mollie cuando activos) | On-site | ❌ sin UI; Stripe wired (ADR-0019) | 🟡 |
| On-site | toggle ON/OFF | Habilita pago presencial como opción | **ON** | ❌ sin UI | 🟡 |

**Observación:** El bloque de formato monetario (Currency, symbol position, separator,
decimals) debería guardarse en `tenant_settings` y ser consumido por el helper
`@/lib/format`. Hoy el formato está hardcoded. La pasarela activa (Stripe) está wired
detrás de `STRIPE_SECRET_KEY` pero no hay UI para que el operador la active/configure.
**Pendiente: pantalla de integración de pasarelas** (puede ser parte de
Features & Integrations en nuestro admin).

---

## 5. Bookings

### 5a. Appointments (único sub-tab visible)

| Campo | Tipo | Opciones | Default demo | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| Default appointment status | dropdown | Pending · **Approved** | Approved | ❌ hardcoded `confirmed` | 🟡 |
| Allow booking above maximum capacity | toggle ON/OFF | — | **ON** | ❌ | 🟢 |
| Allow booking below minimum capacity | toggle ON/OFF | — | **ON** | ❌ | 🟢 |
| Use service duration for booking a time slot | toggle ON/OFF | — | **ON** | 🔶 comportamiento fijo en motor | 🟢 |
| Include service buffer time in time slots | toggle ON/OFF | — | **ON** | 🔶 buffer existe en dominio; no configurable | 🟢 |
| People counting logic | radio group | **Customer plus additional people** · Total people | Customer plus... | ❌ | 🟢 |
| Employee selection logic | dropdown | **Random** · Round-robin · Highest price · Lowest price | Random | ❌ (operador elige proveedor a mano) | 🟡 |

**Observaciones:**
- **Default appointment status (Pending vs Approved):** En Amelia «Pending» significa que
  el admin debe aprobar manualmente cada reserva. Es un flujo valioso para ciertos negocios
  (clínicas, servicios premium). Nuestro `BookingService` siempre crea con `confirmed`;
  añadir modo `pending` requiere un enum de estado y un endpoint `PATCH /bookings/:id/approve`.
- **Employee selection logic:** «Random» / «Round-robin» / «Highest price» / «Lowest price»
  es la lógica de **autoasignación** de proveedor cuando el cliente no elige uno desde el
  widget. Hoy el operador asigna manualmente. Esta feature desbloquea el flujo «el cliente
  reserva sin elegir quién le atiende».

---

## 6. Notifications

### 6a. General

| Campo | Tipo | Opciones | Default demo | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| Notify the customer(s) by default | toggle ON/OFF | — | **ON** | ❌ sin UI (notificación siempre activa cuando hay provider) | 🟡 |
| **Redirect URLs** (bloque) | — | — | — | — | — |
| Successful cancellation redirect URL | text | URL absoluta | (vacío) | ❌ | 🟢 |
| Unsuccessful cancellation redirect URL | text | URL absoluta | (vacío) | ❌ | 🟢 |
| Redirect URL for successfully approved booking | text | URL absoluta | (vacío) | ❌ | 🟢 |
| Redirect URL for unsuccessfully approved booking | text | URL absoluta | (vacío) | ❌ | 🟢 |
| Redirect URL for successfully rejected booking | text | URL absoluta | (vacío) | ❌ | 🟢 |
| Redirect URL for unsuccessfully rejected booking | text | URL absoluta | (vacío) | ❌ | 🟢 |

**Observación:** «Notify the customer(s) by default» es el toggle que en el modal de
New Appointment aparece como «Notify the customer(s)» — su valor por defecto se configura
aquí. Los redirect URLs son para el widget público: tras completar o cancelar, redirige al
tenant. Diferibles para MVP; útiles para flujos de pago externo (Stripe redirect).

### 6b. Email

| Campo | Tipo | Opciones | Default demo | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| Mail service | dropdown | **PHP Mail** · WP Mail · SMTP · Mailgun · Outlook Mailer | PHP Mail | 🔶 Brevo wired (ADR-0020); sin UI | 🔴 |
| Sender name | text* (required) | Nombre que aparece en el «De:» | (vacío, required) | ❌ no configurable por tenant | 🔴 |
| Sender email | text* (required) | Email del remitente | (vacío, required) | ❌ hardcoded en `.env` (`MESSAGING_FROM_EMAIL`) | 🔴 |
| Reply-to email | text (opcional) | Email de respuesta distinto al remitente | (vacío) | ❌ | 🟡 |
| Send all notifications to additional addresses | multiselect dropdown | Empleados/emails del tenant | (vacío) | ❌ | 🟢 |
| Notify selected employees about empty package purchases | multiselect dropdown | Empleados del tenant | (vacío) | ❌ | 🟢 |
| Send ICS file for approved bookings | toggle ON/OFF | Adjunta archivo .ics (añadir al calendario) | **OFF** | ❌ | 🟢 |
| Send ICS file for pending bookings | toggle ON/OFF | — | **OFF** | ❌ | 🟢 |

**Observación:** Los campos críticos son **Mail service + Sender name + Sender email**:
en nuestro SaaS, `MESSAGING_FROM_EMAIL` y el proveedor Brevo están en `.env` a nivel
de plataforma, no configurables por tenant. Para un SaaS multi-tenant real, cada tenant
debería poder configurar su propio remitente (o usar el de la plataforma como relay).
**Acción concreta:** añadir `sender_name` y `sender_email` a `tenant_settings` para que
el dispatcher los use en lugar del global de `.env`.

### 6c. SMS

Requiere cuenta de pago en el servicio «Amelia SMS» (propio de TMS Plugins).
En el demo, el sub-tab SMS redirige al sub-tab Email sin mostrar contenido.

Campos esperados (conocidos por documentación de Amelia):

| Campo | Tipo | Notas | Estado SaaS |
|---|---|---|---|
| Amelia SMS balance | display | Saldo restante de créditos SMS | ❌ no aplica |
| Sign in / Create account | button | Acceso al portal de créditos SMS | ❌ no aplica |
| Sender name (SMS) | text | Hasta 11 caracteres alfanuméricos | ❌ (Brevo SMS como adapter futuro) |

**Observación:** Para nuestro SaaS, SMS sería un adapter (`SmsMessageProvider`)
detrás del puerto `MessageProvider` ya existente (hoy Brevo email, ADR-0020).
Twilio o Brevo SMS son las opciones concretas. Diferido.

---

## 7. Roles & permissions

### 7a. Employee

Tres acordeones colapsables:

**Manage personal schedule:**
| Toggle | Default demo | Estado SaaS | Prioridad |
|---|---|---|---|
| Allow employees to manage their services | OFF | ❌ no hay UI de permisos por rol | 🟡 |
| Allow employees to manage their schedule | ON | ❌ | 🟡 |
| Allow employees to manage their special days | ON | ❌ | 🟡 |
| Allow employees to manage their days off | ON | ❌ | 🟡 |

**Manage bookings:**
| Campo | Tipo | Default demo | Estado SaaS | Prioridad |
|---|---|---|---|---|
| Limit appointments per employee | toggle ON/OFF | OFF | ❌ | 🟢 |

**Panel & access permissions:**
| Campo | Tipo | Default demo | Estado SaaS | Prioridad |
|---|---|---|---|---|
| Employee panel page URL | text | `https://sports.wpamelia.com/employee-panel/` | 🔶 backend tiene portal de proveedor; sin URL configurable | 🟡 |
| Allow employees to manage their appointments | toggle ON/OFF | OFF | ❌ | 🟡 |
| Allow employees to manage their events | toggle ON/OFF | OFF | ❌ | 🟢 |
| Allow employees to manage customers | toggle ON/OFF | OFF | ❌ | 🟢 |

### 7b. Customer

**Customer configuration:**
| Toggle | Default demo | Estado SaaS | Prioridad |
|---|---|---|---|
| Check customer's name for existing email/phone when booking | ON | ❌ (no hay deduplicación en UI de reserva) | 🟡 |
| Automatically create Amelia Customer user | OFF | ❌ | 🟢 |
| Require password for login | ON | 🔶 passwordless (Ed25519) ya implementado (US3) | ✅ |

**Manage bookings:**
| Campo | Tipo | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|
| Limit appointments per customer | toggle ON/OFF | OFF | ❌ | 🟢 |
| Limit package purchases per customer | toggle ON/OFF | OFF | ❌ | 🟢 |
| Limit events per customer | toggle ON/OFF | OFF | ❌ | 🟢 |

**Panel & access permissions:**
| Campo | Tipo | Default demo | Estado SaaS | Prioridad |
|---|---|---|---|---|
| Customer Panel Page URL | text | URL del portal de cliente | 🔶 portal existe en backend; sin URL configurable | 🟡 |
| Allow customers to reschedule their own appointments | toggle ON/OFF | ON | 🔶 backend US3 lo permite; toggle no expuesto | 🟡 |
| Allow customers to cancel packages | toggle ON/OFF | ON | ❌ | 🟢 |
| Allow customers to delete their profile | toggle ON/OFF | OFF | ❌ | 🟢 |

### 7c. Admin

| Toggle | Default demo | Estado SaaS | Prioridad |
|---|---|---|---|
| Allow admin to book appointment at any time | OFF | ❌ (admin ya puede reservar; no hay bypass de working hours) | 🟡 |
| Allow admin to book over an existing appointment | OFF | ❌ (motor rechaza siempre el solape) | 🟡 |

**Observación:** Estos dos overrides de admin son especialmente relevantes para el caso
«el operador crea una reserva urgente fuera de horario» o «quiere solapar dos citas de
emergencia». Implementarlos requiere pasar el rol del actor al `AvailabilityService` y
saltarse las validaciones correspondientes cuando el rol es `admin`.

---

## Resumen de brechas críticas (para Claude Code)

### 🔴 Alta prioridad (bloquean flujos reales)

1. **UI de políticas de tiempo** (min. antes de reservar / cancelar / reagendar):
   back-end listo en US3. Falta una pantalla en Settings > General que grabe
   `booking_min_lead_time`, `cancel_min_lead_time`, `reschedule_min_lead_time`
   en `tenant_settings` y el motor los lea.

2. **Sender name / Sender email por tenant** en Settings > Notifications > Email:
   añadir a `tenant_settings`; el dispatcher los usa en lugar del global de `.env`.

3. **UI de activación de pasarela de pago** (Settings > Payments > Default payment method):
   Stripe está wired pero el operador no puede activarlo desde el admin.

### 🟡 Media prioridad

4. **Default appointment status (Pending vs Approved)**: toggle por tenant en Settings >
   Bookings > Appointments; requiere estado `pending` en el dominio y endpoint de aprobación.

5. **Employee selection logic (autoasignación)**: Random / Round-robin / Highest price /
   Lowest price; desbloquea el flujo de widget sin elección de proveedor.

6. **Horario global de empresa** (Company > Working hours / Days off): tabla
   `tenant_working_hours` + `tenant_days_off`; el motor los consulta como capa base.

7. **Perfil del tenant** (Company > General): logo, nombre, dirección, país, VAT, email.
   Necesario para facturas (Finance) y para branding del widget.

8. **UI de permisos de roles** (Roles & permissions): qué puede hacer el staff /
   el cliente / el admin desde sus respectivos portales.

### 🟢 Baja prioridad / diferible

9. Formato monetario configurable (currency, symbol position, separator, decimals).
10. Period available for booking in advance.
11. Show booking slots in client's timezone.
12. Redirect URLs post-booking/cancellation.
13. ICS attachment en emails.
14. SMS (adapter externo, diferido).

---

_Última actualización: 2026-06-23_
