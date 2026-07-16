# Roadmap — etapas desarrolladas y pendientes

Vista rápida de qué versión del asistente está en producción, qué se construyó en cada etapa y qué falta. El detalle de cada etapa completada está en su propio documento (ver [`README.md`](README.md)); acá se resume todo junto para tener el panorama completo por versión.

## Desarrolladas ✅

| Versión | Etapa | Qué agrega | Documento |
|---|---|---|---|
| v1 | 1 — MVP | Personas, propiedades, contratos, pagos. Chat en lenguaje natural (OpenAI) sobre Telegram y CLI. | [etapa-1-mvp.md](etapa-1-mvp.md) |
| v2 | 2 — Agenda y recordatorios | Seguros, impuestos/servicios y reparaciones (alta + consulta). Agenda unificada (`obtener_agenda`). Recordatorio diario proactivo (digest por Telegram, mientras el bot esté prendido). | [etapa-2-agenda-recordatorios.md](etapa-2-agenda-recordatorios.md) |
| v3 | 3 — Proveedores, documentación y financiero | Proveedores (alta/búsqueda, asignables a reparaciones). Reparaciones con proveedor y comprobante adjunto. Obligaciones ampliadas: tipo "internet" + responsable de pago (propietario/inquilino). Documentación con links a Google Drive por propiedad. Movimientos financieros (ingresos/gastos) con balance por propiedad o general, auto-poblados desde pagos y reparaciones. | [etapa-3-proveedores-documentacion-financiero.md](etapa-3-proveedores-documentacion-financiero.md) |
| v4 | 4 — Lenguaje de negocio | El asistente deja de mostrar IDs internos, UUIDs y fechas en formato ISO en cualquier respuesta (chat y digest diario). Confirmaciones de alta completas (propiedad, inquilino, montos, fechas en DD/MM/AAAA) con formato uniforme: confirmación → info principal → datos relevantes → próximo paso sugerido. | [etapa-4-ux-lenguaje-de-negocio.md](etapa-4-ux-lenguaje-de-negocio.md) |
| v5 | 5 — Deploy 24/7 | Modo webhook + `render.yaml` + ping externo (GitHub Actions) para correr en Render free tier sin depender de la PC del administrador. Código listo; falta que el usuario cree la cuenta y despliegue. | [etapa-5-deploy-24-7.md](etapa-5-deploy-24-7.md) |

Además, entre etapas se hizo una **QA general** del proyecto (revisión de arquitectura, corrección de 2 bugs reales — monto no actualizado al corregir un pago, digest marcado como enviado aunque fallaran todos los envíos —, eliminación de código muerto, límite de tokens/temperatura estandarizado en el único call site de OpenAI, logger de uso/costo por `DEBUG_AI=true`) y una **migración de infraestructura** (Node 18 → 22+/24, limpieza de datos de prueba duplicados en la base).

## Pendientes ⏳

No tienen todavía un número de etapa asignado porque no se planificaron en detalle; orden sugerido de mayor a menor impacto práctico:

| Candidata | Qué requeriría | Por qué todavía no |
|---|---|---|
| **Consulta de garantes** | Tool que exponga la relación contrato↔garante (el dato ya existe en `contratos_garantes`, no hay endpoint). | Detectado en QA de etapa 4/5, gap de alcance menor, no bloqueante. |
| **Edición y borrado** de propiedades, personas, proveedores, contratos | Tools de update/delete + reglas de qué se puede borrar si tiene datos relacionados (ej. una propiedad con contratos). | Hoy el asistente solo da de alta y consulta; corregir un dato mal cargado requiere entrar directo a Supabase. |
| **Subida real de archivos** (Supabase Storage) | Cliente de Storage (ya hay credenciales reservadas para esto) + tool de subida vía Telegram (recibir el archivo, no solo el link). | Etapa 3 resolvió la documentación con links a Drive, que ya cubre el caso de uso principal sin necesitar credenciales adicionales ni manejo de archivos binarios. |
| **`seguros`/`impuestos_servicios` alimentando el balance financiero** | Agregarles un concepto de "pagado" (fecha de pago real), como ya tiene `pagos`. | Requiere decidir el modelo de datos correcto para no mezclar "obligación" con "pago realizado" — quedó documentado como decisión explícita en la etapa 3. |
| **Recordatorios por-evento escalados** (varios avisos con urgencia creciente, no solo el digest diario) | Ampliar `recordatorios` (ya trackea qué se avisó) + lógica de umbrales. | El digest diario (etapa 2) ya cubre el caso de uso principal; esto es un refinamiento, no una funcionalidad faltante. |
| **Interfaz web** | Nueva capa en `src/interfaces/web`, reutilizando `src/core` sin cambios (arquitectura ya preparada para esto). | Telegram cubre el uso actual (administrador único); no hay necesidad concreta todavía. |
| **WhatsApp / email** como canal adicional | Nueva capa en `src/interfaces`, análogo a Telegram. | No pedido todavía; Telegram es el canal principal. |

## Convención de versión

Cada etapa completada sube la versión menor (v1 → v2 → v3...). Todavía no se usó versionado semántico estricto en `package.json` (sigue en `0.1.0`); si el proyecto pasa a producción con deploy 24/7, es un buen momento para empezar a taggear releases en Git alineadas a este número.
