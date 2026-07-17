# Roadmap — etapas desarrolladas y pendientes

Vista rápida de qué versión del asistente está en producción, qué se construyó en cada etapa y qué falta. El detalle de cada etapa completada está en su propio documento (ver [`README.md`](README.md)); acá se resume todo junto para tener el panorama completo por versión.

## Desarrolladas ✅

| Versión | Etapa | Qué agrega | Documento |
|---|---|---|---|
| v1 | 1 — MVP | Personas, propiedades, contratos, pagos. Chat en lenguaje natural (OpenAI) sobre Telegram y CLI. | [etapa-1-mvp.md](etapa-1-mvp.md) |
| v2 | 2 — Agenda y recordatorios | Seguros, impuestos/servicios y reparaciones (alta + consulta). Agenda unificada (`obtener_agenda`). Recordatorio diario proactivo (digest por Telegram, mientras el bot esté prendido). | [etapa-2-agenda-recordatorios.md](etapa-2-agenda-recordatorios.md) |
| v3 | 3 — Proveedores, documentación y financiero | Proveedores (alta/búsqueda, asignables a reparaciones). Reparaciones con proveedor y comprobante adjunto. Obligaciones ampliadas: tipo "internet" + responsable de pago (propietario/inquilino). Documentación con links a Google Drive por propiedad. Movimientos financieros (ingresos/gastos) con balance por propiedad o general, auto-poblados desde pagos y reparaciones. | [etapa-3-proveedores-documentacion-financiero.md](etapa-3-proveedores-documentacion-financiero.md) |
| v4 | 4 — Lenguaje de negocio | El asistente deja de mostrar IDs internos, UUIDs y fechas en formato ISO en cualquier respuesta (chat y digest diario). Confirmaciones de alta completas (propiedad, inquilino, montos, fechas en DD/MM/AAAA) con formato uniforme: confirmación → info principal → datos relevantes → próximo paso sugerido. | [etapa-4-ux-lenguaje-de-negocio.md](etapa-4-ux-lenguaje-de-negocio.md) |
| v5 | 5 — Deploy 24/7 | Modo webhook + `render.yaml` + ping externo (GitHub Actions) para correr en Render free tier sin depender de la PC del administrador. Deploy confirmado funcionando. | [etapa-5-deploy-24-7.md](etapa-5-deploy-24-7.md) |
| v6 | 6 — Garantes y balance | Consulta de garantes por chat. Seguros e impuestos/servicios pueden marcarse como pagados y se reflejan solos en el balance financiero (ya no aparecen como vencimiento pendiente una vez pagados). | [etapa-6-garantes-y-balance.md](etapa-6-garantes-y-balance.md) |
| v7 | 7 — Modelo simplificado + actualización por IPC | Seguros e impuestos/servicios unificados en una sola tabla de "gastos de propiedad". Seguro Finaer pasa a ser parte del contrato. Actualización automática del alquiler por IPC (`actualizar_alquiler`), sin gastar la API si todavía no corresponde. Reparaciones, proveedores y documentación quedan deshabilitados (código intacto). | [etapa-7-modelo-simplificado-y-actualizacion-automatica.md](etapa-7-modelo-simplificado-y-actualizacion-automatica.md) |
| v8 | 8 — Botones interactivos | Menú principal (Reply Keyboard) + 12 teclados contextuales (Inline Keyboard) que cambian según el momento de la conversación — inferidos automáticamente tras un alta exitosa, o señalados por el modelo con `sugerir_botones` para preguntas de opción múltiple. El texto libre sigue funcionando igual en todo momento. | [etapa-8-botones-interactivos.md](etapa-8-botones-interactivos.md) |

Además, entre etapas se hizo una **QA general** del proyecto (revisión de arquitectura, corrección de 2 bugs reales — monto no actualizado al corregir un pago, digest marcado como enviado aunque fallaran todos los envíos —, eliminación de código muerto, límite de tokens/temperatura estandarizado en el único call site de OpenAI, logger de uso/costo por `DEBUG_AI=true`) y una **migración de infraestructura** (Node 18 → 22+/24, limpieza de datos de prueba duplicados en la base).

## Pendientes ⏳

Revisadas explícitamente con el usuario en la etapa 6. Confirmadas para más adelante:

| Candidata | Qué requeriría | Estado |
|---|---|---|
| **Cargar `RAPIDAPI_KEY`** | Ninguna: es solo cargar el valor en Render/`.env`. | Pendiente explícito desde la etapa 7 — sin esto, `actualizar_alquiler` nunca calcula el valor real. |
| **Interfaz web** | Nueva capa en `src/interfaces/web` (panel de **solo lectura**: agenda, balance, listados — sin repetir el asistente de IA), reutilizando `src/core` sin cambios. | Confirmada, alcance a definir cuando se planifique. |
| **WhatsApp** como canal adicional | Nueva capa en `src/interfaces`, análoga a Telegram, vía Cloud API de Meta. | Confirmada como candidata; costo no es impedimento (conversaciones iniciadas por el usuario son gratis e ilimitadas, el único mensaje proactivo diario cuesta fracciones de centavo) pero requiere verificación de Meta Business — más fricción de setup que Telegram. |

Deshabilitadas en la etapa 7 (código y schema intactos en el repo, solo no registradas en `tools/index.ts`/`systemPrompt.ts` — reactivarlas no requiere reescribir nada, solo volver a registrarlas):

| Módulo | Por qué se apagó |
|---|---|
| Reparaciones | Fuera del modelo simplificado que pidió el usuario; prioriza menos módulos para el chat. |
| Proveedores | Solo tenía sentido junto con reparaciones. |
| Documentación (Drive) | Idem — se puede reactivar como upgrade si hace falta. |

Descartadas explícitamente por el usuario (no son bugs ni gaps, son decisiones de alcance):

| Candidata | Por qué se descartó |
|---|---|
| Edición y borrado de propiedades/personas/proveedores/contratos | Prefiere que dependa del mantenimiento manual (Supabase directo) o que sea un upgrade si se lo piden más adelante. Única excepción: `cargar_seguro_finaer` (etapa 7), acotada a los campos de Finaer de un contrato existente. |
| Subida real de archivos (Supabase Storage) | Los links a Google Drive ya cubrían el caso de uso; ahora tampoco aplica porque documentación está deshabilitada. |
| Recordatorios por-evento escalados | El digest diario de la etapa 2 ya alcanza. |
| Email como canal adicional | Telegram (y eventualmente WhatsApp) cubren el uso actual. |
| Actualización automática por ICL | La integración de la etapa 7 es específica de IPC; ICL queda fuera por ahora. |

## Convención de versión

Desde que el proyecto se desplegó 24/7 (etapa 5), se usa versionado semántico estricto (`MAJOR.MINOR.PATCH`), reflejado en `package.json` y en tags de Git (`vX.Y.Z`) sobre cada commit relevante:

- **MAJOR**: etapa nueva (módulo o capacidad significativa) — coincide con el número de etapa.
- **MINOR**: funcionalidad menor agregada entre etapas (ej. el logger de uso de la QA general).
- **PATCH**: fix o cambio de infraestructura sin funcionalidad nueva (ej. upgrade de Node, fix de un bug).

Detalle versión por versión en [`CHANGELOG.md`](../CHANGELOG.md). El historial previo a la etapa 5 se etiquetó de forma retroactiva sobre los commits ya existentes.
