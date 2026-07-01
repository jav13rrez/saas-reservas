# Estado: reservas-ui-ciclo-pagos (T012/T013)

Iniciado: 2026-07-01

## Sub-tareas (a-g)

- [x] a. vitest.config.ts: incluir `apps/admin/src/**/*.test.ts` en proyecto `unit`. (pnpm test: 376 passed, 7 skipped, verde)
- [x] b. demo-store.ts: extender BookingStatus a 6 estados + creación respeta requiresApproval + ocupación.
      (usa DomainBookingStatus/canTransition/InvalidBookingTransitionError de packages/domain;
      añadido @saas-reservas/domain como dep de apps/admin/package.json; requiere dist buildeado)
- [x] c. source/bookings.ts: mapeo 6 estados sin colapsar + funciones de transición (demo+api).
- [x] d. app/api/bookings/[id]/{approve,reject,complete,no-show}/route.ts
- [x] e. source/booking-payment.ts + demo-store payment storage + app/api/bookings/[id]/payment/route.ts
      (apps/admin typecheck limpio, pnpm test 376 passed/7 skipped verde tras b-e)
- [x] f. UI: botones de acción por fila + sección Payment
      (features/bookings/index.tsx reescrito; features/calendar/index.tsx actualizado
      para OCCUPIES_SLOT en vez de status==="confirmed". pnpm --filter admin build: verde,
      24 rutas generadas incluidas las nuevas approve/reject/complete/no-show/payment)
- [x] g. Tests unitarios apps/admin/src/\*_/_.test.ts
      (apps/admin/src/server/**tests**/booking-lifecycle.test.ts: 8 tests, verde.
      Cubre: 6 estados sin colapso, 2 transiciones inválidas rechazadas
      (InvalidBookingTransitionError), ocupación tras reject/cancel, upsert+lectura
      pago con depósito<=importe aceptado, depósito>importe rechazado, pago para
      booking inexistente rechazado)

## VERIFY completo — ÉXITO

- `pnpm typecheck` -> verde (tsc --build, packages/services referenciados en tsconfig.json raíz)
- `pnpm lint` -> verde (eslint .)
- `pnpm format:check` -> verde (tras `prettier --write` sobre el test nuevo y loops/\*)
- `pnpm test` -> 384 passed | 7 skipped (63 archivos pasan, 4 skipped) — incluye
  apps/admin/src/server/**tests**/booking-lifecycle.test.ts (8 tests nuevos)
- `pnpm --filter @saas-reservas/admin build` -> verde, 24 rutas generadas
- Extra: `pnpm -r --filter "./apps/*" build` (las 3 apps) -> verde

Loop completado con éxito. Las 7 sub-tareas (a-g) hechas.

## Log de intentos fallidos

(vacío por ahora)

## Notas de contexto recopiladas

- TRANSITIONS dominio (packages/domain/src/bookings/booking.ts):
  pending -> approved | rejected | expired
  approved -> canceled | rescheduled | completed | no_show
  resto terminal.
- Nota: dominio tiene "expired" y "rescheduled" también, pero loop solo pide
  acciones Aprobar/Rechazar/Completar/No-show desde la UI (no expired/rescheduled).
- Ocupación demo-store: liberar en rejected/canceled; mantener en pending/approved/completed/no_show.
- Rutas API ya existentes: POST /v1/admin/bookings/:id/{approve,reject,complete,no-show}
  GET/PUT /v1/admin/bookings/:id/payment
- Patrón de referencia: source/settings.ts + app/api/settings/route.ts (3 capas demo/source/route).
- api-client.ts: apiGet/apiSend ya manejan sesión y errores.
- ManualPayment domain type: bookingId, method, status, amount, deposit, currency, transactionRef?, notes?.
  validateManualPayment ya valida method/status/amount/deposit<=amount.
- IMPORTANTE: estoy en worktree /home/user/saas-reservas/.claude/worktrees/agent-a9d0d1c7ce3fc19db,
  aislado del checkout compartido /home/user/saas-reservas. loops/ no existía aquí, se copió del
  checkout compartido. Todo el trabajo debe hacerse dentro de este worktree.
