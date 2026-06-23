# Amelia Features & Integrations — Fine-Grained Documentation

## Overview

**Features & Integrations** lista las integraciones externas (pasarelas de pago, videoconferencias, email, SMS, calendarios, CRM) que se pueden conectar a Amelia. Cada integración tiene su propia página de configuración con API keys, webhooks, y opciones.

---

## Integrations List View

### Estructura

La sección es una **galería / lista de tarjetas** de integraciones disponibles, agrupadas por categoría:

| Categoría | Integraciones Típicas |
|---|---|
| **Payment Gateways** | Stripe, PayPal, Square, Razorpay |
| **Video Conferencing** | Zoom, Google Meet, Microsoft Teams |
| **Email** | Gmail, SendGrid, Mailgun, SMTP |
| **SMS** | Twilio, Vonage (Nexmo), Amelia SMS Premium |
| **Calendar Sync** | Google Calendar, Outlook / Microsoft 365 |
| **CRM / Data** | Zapier, Make.com, HubSpot, Salesforce |
| **Forms** | Gravity Forms, WPForms, Formidable |
| **Accounting** | QuickBooks Online, Xero, Wave |

### Tarjeta de Integración

Para cada integración visible:

| Elemento | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Integration Logo/Icon** | Image | Logo oficial del servicio | - | 🔶 | 🟡 |
| **Integration Name** | Texto | Ej: "Stripe Payment Gateway" | - | 🔶 | 🟡 |
| **Description** | Texto corto | "Accept credit card payments online" | - | 🔶 | 🟡 |
| **Status Badge** | Badge | `Connected` (verde), `Not Connected` (gris), `Premium` (azul) | - | 🔶 | 🟡 |
| **Connect Button** | Button | "Connect", "Configure", "Settings" | Click abre modal/formulario | 🔶 | 🟡 |

### Integración No Conectada

Cuando status = "Not Connected":

| Control | Tipo | Contenido | Acción | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Documentation Link** | Link | "Learn more" o "View docs" | Opens external docs | 🔶 | 🟡 |
| **Connect / Enable Button** | Button primario | "Connect Now", "Set Up", "Enable" | Abre modal de configuración | 🔶 | 🟡 |
| **Pricing Info** (si premium) | Texto | "Premium feature - $X/month" | - | 🔶 | 🟡 |

---

## Integración Detail Modal / Page

Cuando se hace click en "Connect" o "Settings", se abre un formulario específico para esa integración.

### Generic Integración Form

Estructura típica:

| Sección | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Title & Icon** | Ej: "Stripe Payment Gateway" | 🔶 | 🟡 |
| **Description** | Qué hace y por qué conectar | 🔶 | 🟡 |
| **Documentation Link** | "Read full docs" → external | 🔶 | 🟡 |
| **Connection Form** | API keys, tokens, webhooks | 🔶 | 🟡 |
| **Test Connection** | Button para verificar credenciales | 🔶 | 🟡 |
| **Disconnect / Remove** | Button rojo para desconectar | 🔶 | 🟡 |
| **Settings** (si conectado) | Opciones de comportamiento | 🔶 | 🟡 |

---

## Integración Específicas Comunes

### Payment: Stripe

| Campo | Tipo | Contenido | Validación | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Publishable Key** | Input (password) | Clave pública de Stripe | Required, format validation | 🔶 | 🟡 |
| **Secret Key** | Input (password) | Clave secreta de Stripe | Required, format validation | 🔶 | 🟡 |
| **Test Mode** | Toggle | ☑ Usar claves de test | - | True (default) | 🔶 | 🟡 |
| **Webhook Secret** | Input (password) | Clave para validar webhooks | Auto-populated | 🔶 | 🟡 |
| **Currency** | Dropdown | USD, EUR, GBP, etc. | Required | USD | 🔶 | 🟡 |
| **Capture On** | Dropdown | `Authorization` (manual) vs `Charge` (auto) | `Charge` | 🔶 | 🟡 |

### Payment: PayPal

| Campo | Tipo | Contenido | Validación | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Client ID** | Input (password) | PayPal App Client ID | Required | 🔶 | 🟡 |
| **Secret** | Input (password) | PayPal App Secret | Required | 🔶 | 🟡 |
| **Sandbox Mode** | Toggle | ☑ Usar sandbox PayPal | - | True (default) | 🔶 | 🟡 |
| **Currency** | Dropdown | USD, EUR, etc. | Required | USD | 🔶 | 🟡 |

### Video: Zoom

| Campo | Tipo | Contenido | Validación | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **OAuth / API Key** | Input (password) | Zoom JWT or OAuth token | Required | 🔶 | 🟡 |
| **Auto-generate Links** | Checkbox | ☑ Auto-crear room Zoom para cada cita | - | True | 🔶 | 🟡 |
| **Meeting Duration** | Input number | Duración máxima (min) | - | 60 | 🔶 | 🟡 |
| **Send Link to Customer** | Checkbox | ☑ Incluir link Zoom en confirmación | - | True | 🔶 | 🟡 |
| **Waiting Room** | Checkbox | ☑ Habilitar waiting room Zoom | - | False | 🔶 | 🟡 |

### Email: SendGrid / SMTP

**SendGrid:**

| Campo | Tipo | Contenido | Validación | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **API Key** | Input (password) | SendGrid API key | Required | 🔶 | 🟡 |
| **From Email** | Input email | Email que enviará notificaciones | Required, owned by account | 🔶 | 🟡 |
| **From Name** | Input text | Nombre remitente | - | "Amelia" | 🔶 | 🟡 |

**SMTP Generic:**

| Campo | Tipo | Contenido | Validación | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **SMTP Host** | Input text | Host SMTP (ej: "smtp.gmail.com") | Required | - | 🔶 | 🟡 |
| **SMTP Port** | Input number | Puerto (25, 465, 587) | Required | 587 | 🔶 | 🟡 |
| **Security** | Dropdown | `None`, `TLS`, `SSL` | Required | TLS | 🔶 | 🟡 |
| **Username** | Input text | Usuario SMTP | - | - | 🔶 | 🟡 |
| **Password** | Input (password) | Contraseña SMTP | - | - | 🔶 | 🟡 |
| **From Email** | Input email | Email remitente | - | - | 🔶 | 🟡 |

### SMS: Twilio / Vonage

**Twilio:**

| Campo | Tipo | Contenido | Validación | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Account SID** | Input (password) | Twilio Account SID | Required | 🔶 | 🟡 |
| **Auth Token** | Input (password) | Twilio Auth Token | Required | 🔶 | 🟡 |
| **Phone Number** | Input tel | Número Twilio para enviar | Required, format +1... | 🔶 | 🟡 |

### Calendar: Google Calendar

| Campo | Tipo | Contenido | Validación | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **OAuth Authenticate** | Button | "Authorize with Google" | Click abre popup OAuth | 🔶 | 🟡 |
| **Sync Direction** | Radio | `Amelia → Google`, `Google → Amelia`, `Bidirectional` | `Bidirectional` | 🔶 | 🟡 |
| **Auto-sync Appointments** | Checkbox | ☑ Sincronizar reservas automáticamente | - | True | 🔶 | 🟡 |
| **Calendar Selection** | Dropdown | Seleccionar qué calendar de Google usar | Primary | 🔶 | 🟡 |

### Automation: Zapier / Make

| Campo | Tipo | Contenido | Validación | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Webhook URL** | Input (password) | Webhook URL generado por Zapier/Make | Required | 🔶 | 🟡 |
| **Events** | Checkboxes | ☑ Appointment created, ☑ Appointment updated, ☑ Payment received, etc. | Multiple allowed | All | 🔶 | 🟡 |
| **Test Webhook** | Button | Envía evento test a Zapier | - | 🔶 | 🟡 |

---

## Global Integration Settings (si existen)

| Control | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Rate Limiting** | Input number | Llamadas API por minuto | - | Según integración | 🔶 | 🟡 |
| **Retry Failed Attempts** | Checkbox | ☑ Reintentar webhook/sync fallidos | True | 🔶 | 🟡 |
| **Max Retries** | Input number | Máximo intentos reintentos | 3 | 🔶 | 🟡 |
| **Log API Calls** | Checkbox | ☑ Registrar todas las llamadas (para debug) | False | 🔶 | 🟡 |

---

## Integration Status & Health

Cada integración conectada muestra:

| Elemento | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Last Sync** | Timestamp | Cuándo fue el último sync/call exitoso | 🔶 | 🟡 |
| **Status Indicator** | Icon + Tooltip | "Connected & healthy", "Connected but errors", "Disconnected" | 🔶 | 🟡 |
| **Error Log** | Link | "View recent errors" → abre tabla de errores | 🔶 | 🟡 |
| **Disconnect Button** | Button (rojo) | Desconecta integración (requiere confirmación) | 🔶 | 🟡 |

---

## Premium Features / Integrations

Algunas integraciones requieren suscripción:

| Feature | Típicamente Premium | Costo Indicativo | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **SMS (Amelia SMS)** | Sí | $X/month | 🔶 | 🟡 |
| **Google Calendar Sync** | Puede ser | Gratuito | 🔶 | 🟡 |
| **Zoom Integration** | Puede ser | Depende plan Zoom | 🔶 | 🟡 |
| **Advanced Reporting** | Sí | Addon | 🔶 | 🟡 |

---

## Webhook & API Integration

Para integraciones que requieren webhooks:

| Elemento | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Webhook URL** | Input (copy-to-clipboard) | URL única para Amelia → exterior | 🔶 | 🟡 |
| **Webhook Events** | Checkboxes | Qué eventos disparan el webhook | 🔶 | 🟡 |
| **Webhook Signing Key** | Input (password) | Clave para validar firma del webhook | 🔶 | 🟡 |
| **Webhook Logs** | Link | Historial de llamadas webhook | 🔶 | 🟡 |
| **Test Webhook** | Button | Envía evento test | 🔶 | 🟡 |

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

1. **Payment Gateway Primary** — ¿Cuál es la integración de pago por defecto / recomendada?

### Prioridad Amarilla (🟡)

1. **Integration List Completeness** — Confirmar lista completa de integraciones soportadas (pueden cambiar).
2. **Webhook Retry Logic** — Confirmar comportamiento en caso de fallo (exponential backoff, max retries).
3. **Data Privacy / Encryption** — ¿API keys se encriptan en DB? ¿Nunca se muestran después de guardarse?
4. **Multi-Integration** — ¿Múltiples Stripe accounts? ¿Fallback si uno falla?
5. **Sync Conflicts** — Si Google Calendar ↔ Amelia, ¿qué gana en conflicto de cambios?
6. **Rate Limiting** — ¿Amelia respeta rate limits de APIs externas (Stripe, Zoom, etc.)?
7. **Deprecation Warnings** — ¿Sistema alertifica si integración será deprecated?

### Notas de Implementación

- Los **API keys** deben ser almacenados encriptados y nunca mostrados tras guardar.
- Los **Webhooks** deben incluir firma/token para validación de seguridad.
- Los **Logs** de integración son críticos para troubleshooting.
- Los **Test buttons** deben enviar eventos reales pequeños (no data de producción).
- Los **Estatuses** de integración (healthy, errors, disconnected) deben ser visuales claros.
- Las **Integraciones premium** deben tener upgrade prompts / CTA claros.
- El **Documentation link** debe apuntar a guides específicos (no genérico).
