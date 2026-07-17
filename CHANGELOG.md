# Changelog

Versionado semántico (`MAJOR.MINOR.PATCH`) aplicado sobre este proyecto: **MAJOR** = etapa nueva (módulo o capacidad significativa), **MINOR** = funcionalidad menor agregada entre etapas, **PATCH** = fix o cambio de infraestructura sin funcionalidad nueva. Cada versión tiene un tag de Git con el mismo nombre (`vX.Y.Z`).

## [8.0.0] — 2026-07-16 — Etapa 8
Botones interactivos contextuales en Telegram: menú principal fijo (Reply Keyboard) + 12 teclados contextuales (Inline Keyboard) que cambian según el momento de la conversación — inferidos automáticamente tras un alta exitosa (`crear_propiedad`/`crear_contrato`/`crear_recibo`/`crear_gasto`), o señalados por el modelo con la tool `sugerir_botones` para preguntas de opción múltiple. Nueva tool `consultar_contrato`. El texto libre sigue funcionando igual en todo momento. Fix de un bug preexistente en `buscar_persona` (el filtro `rol` no encontraba personas recién asignadas por primera vez). Ver [`docs/etapa-8-botones-interactivos.md`](docs/etapa-8-botones-interactivos.md).

## [7.0.0] — 2026-07-16 — Etapa 7
Modelo simplificado: `seguros`+`impuestos_servicios` unificados en `gastos_propiedad`; Seguro Finaer pasa a ser parte del contrato. Actualización automática del alquiler por IPC (`actualizar_alquiler`), sin consultar la API si todavía no corresponde. Reparaciones, proveedores y documentación quedan deshabilitados (código intacto, no registrados en el asistente). Ver [`docs/etapa-7-modelo-simplificado-y-actualizacion-automatica.md`](docs/etapa-7-modelo-simplificado-y-actualizacion-automatica.md).

## [6.0.0] — 2026-07-16 — Etapa 6
Consulta de garantes por chat. Seguros e impuestos/servicios se pueden marcar como pagados y se reflejan solos en el balance financiero (dejan de aparecer como vencimiento pendiente una vez pagados). Ver [`docs/etapa-6-garantes-y-balance.md`](docs/etapa-6-garantes-y-balance.md).

## [5.0.1] — 2026-07-16
Adopción de versionado estricto: tags de Git retroactivos para el historial existente, este changelog, `package.json` alineado.

## [5.0.0] — 2026-07-16 — Etapa 5
Deploy 24/7 en Render (free tier): modo webhook + `render.yaml` + ping externo por GitHub Actions para el recordatorio diario. Ver [`docs/etapa-5-deploy-24-7.md`](docs/etapa-5-deploy-24-7.md).

## [4.0.1] — 2026-07-16
Fix: `chatSession.ts` ya no filtra errores técnicos crudos de la base de datos (SQL, nombres de tabla/columna) al modelo.

## [4.0.0] — 2026-07-16 — Etapa 4
El asistente deja de mostrar IDs internos, UUIDs y fechas ISO en cualquier respuesta. Confirmaciones de alta completas en lenguaje de negocio, formato uniforme. Ver [`docs/etapa-4-ux-lenguaje-de-negocio.md`](docs/etapa-4-ux-lenguaje-de-negocio.md).

## [3.0.0] — 2026-07-15 — Etapa 3
Proveedores, reparaciones con proveedor/comprobante, obligaciones ampliadas (tipo "internet" + responsable de pago), documentación con links a Drive, movimientos financieros con balance. Ver [`docs/etapa-3-proveedores-documentacion-financiero.md`](docs/etapa-3-proveedores-documentacion-financiero.md).

## [2.1.1] — 2026-07-16
Node actualizado a 22+ (probado con Node 24 LTS).

## [2.1.0] — 2026-07-16
QA general: fixes de lógica (monto no actualizado al corregir un pago, digest marcado como enviado aunque fallaran todos los envíos), código muerto eliminado, configuración de OpenAI centralizada, logger de uso/costo (`DEBUG_AI`).

## [2.0.0] — Etapa 2
Agenda unificada (`obtener_agenda`), seguros/impuestos-servicios/reparaciones (alta y consulta), recordatorio diario proactivo. Ver [`docs/etapa-2-agenda-recordatorios.md`](docs/etapa-2-agenda-recordatorios.md).

## [1.0.0] — Etapa 1 (MVP)
Personas, propiedades, contratos, pagos. Bot de Telegram con asistente en lenguaje natural (migrado de Claude a la API de OpenAI). Ver [`docs/etapa-1-mvp.md`](docs/etapa-1-mvp.md).
