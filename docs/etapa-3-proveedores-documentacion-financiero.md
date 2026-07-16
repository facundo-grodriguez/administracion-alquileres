# Etapa 3 — Proveedores, documentación, obligaciones ampliadas y control financiero

**Estado: ✅ Completada**

## Objetivo

Cerrar los módulos que quedaban fuera de alcance de la etapa 2: poder asignar un **proveedor** a cada reparación, dejar **documentación** (contratos, pólizas, comprobantes) enlazada a Google Drive en vez de perdida en chats o carpetas sueltas, saber **quién es responsable de pagar** cada impuesto/servicio (propietario o inquilino), y llevar un **control financiero** básico (ingresos/gastos/resultado neto) por propiedad.

**Hallazgo clave que acotó el alcance**: antes de escribir código se revisó el schema existente y se encontró que `proveedores`, `documentos` y `movimientos_financieros` ya existían como tablas (creadas en el v1 pero sin repos/services/tools), y que `reparaciones` ya tenía las columnas `proveedor_id` y `comprobante_documento_id` sin usar. La propuesta original planteaba una tabla "Obligaciones" nueva que unificara alquiler/expensas/impuestos/seguros — pero `impuestos_servicios` ya cubría ese rol para todo salvo "internet". Por eso esta etapa fue mayormente **completar y conectar lo que ya estaba modelado**, no construir de cero.

## Qué se implementa

### 1. Proveedores
Alta y búsqueda (por nombre, rubro/categoría o zona) de proveedores. Se asignan a reparaciones por ID, resuelto previamente con `buscar_proveedor`.

### 2. Reparaciones completas
`crear_reparacion` ahora acepta `proveedor_id`. Nueva tool `adjuntar_comprobante_reparacion` (link de Drive) usando la relación `comprobante` que ya existía en el schema pero no se cargaba. `listar_reparaciones` muestra proveedor y si tiene comprobante adjunto.

### 3. Obligaciones ampliadas (impuestos/servicios)
Se agregó el tipo `internet` al enum existente y un campo `responsable` (`propietario` | `inquilino`) a `impuestos_servicios`, en vez de crear una tabla "Obligaciones" paralela. Nueva tool `listar_impuestos_servicios` para consultar las obligaciones de una propiedad sin limitarse a la ventana de vencimiento de 30 días (a diferencia de `listar_vencimientos`).

### 4. Documentación (Google Drive)
Se reutiliza la tabla polimórfica `documentos` (ya existía) tal cual, guardando el link de Drive en `storage_path`. Nuevo campo `carpeta_drive_url` en `propiedades` para el link a la carpeta general. Tools nuevas: `crear_documento`, `buscar_documentos`, `vincular_carpeta_drive`.

### 5. Movimientos financieros
Ledger simple de ingresos/gastos por propiedad. Los pagos de alquiler (`crear_recibo`) y los costos de reparaciones (`crear_reparacion`) se reflejan **solos** ahí (best-effort, sin bloquear el alta principal si falla). Nueva tool `crear_movimiento_financiero` para cargar ingresos/gastos manuales (ej: compra de un electrodoméstico) y `obtener_balance_financiero` para calcular ingresos/gastos/resultado neto de una propiedad (o todas) en un rango de fechas.

## Decisiones

- **Extender `impuestos_servicios` en vez de crear una tabla "Obligaciones"**: el enum ya cubría ABL/ARBA/luz/gas/agua/expensas; solo faltaba "internet". Una tabla paralela hubiera duplicado el concepto de "impuesto/servicio" que ya existía y funcionaba.
- **`documentos` sigue siendo polimórfica sin FK real** (por diseño desde el v1): `entidad_tipo` + `entidad_id` sin relación fija. Por eso `buscar_documentos` hace dos consultas (documentos + propiedad para leer `carpeta_drive_url`) en vez de una sola query relacional.
- **Solo Drive, no Supabase Storage**: se guardan links, no se suben archivos. Coincide con `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, que ya estaban marcadas en el código como "fase 2, no se usa en v1".
- **Auto-poblado de `movimientos_financieros` solo desde `pagos` y `reparaciones`, no desde `seguros`/`impuestos_servicios`**: estas dos últimas modelan una obligación *futura* (fecha de vencimiento), no un pago *realizado* — no tienen concepto de "pagado" ni fecha real de pago. Auto-generar un gasto en el momento de cargar un seguro o un ABL registraría en el balance un gasto que todavía no ocurrió.
- **Best-effort, no transaccional**: si falla el registro del movimiento financiero derivado, no aborta el alta del pago/reparación (que es el dato que importa) — solo lo loguea. Mismo criterio de riesgo que ya usa el resto del código (`ejecutarTool` en `chatSession.ts`, el scheduler de agenda).
- **Idempotente vía upsert**: `crear_recibo` y `crear_reparacion` usan `referencia_tipo` + `referencia_id` para actualizar el movimiento financiero existente en vez de duplicarlo si se corrige un pago o una reparación ya cargados. Se ajustó también la descripción de la tool `crear_recibo` (y se agregó el ID de contrato a la respuesta de `obtener_estado_pago`) para que el asistente supiera que puede usarla para corregir un pago ya registrado, no solo para cargarlo por primera vez.
- **Montos sumados en JS, no con `SUM()` en SQL**: a esta escala (uso personal, decenas de movimientos) es más simple y consistente con cómo el resto del código resuelve todo en JS.

## Fuera de alcance (etapas siguientes)

- Subida real de archivos (Supabase Storage) — se guardan solo links a Drive.
- Que `seguros`/`impuestos_servicios` alimenten el balance financiero (requeriría agregarles un concepto de "pagado", como tiene `pagos`).
- Edición/borrado de propiedades, personas, proveedores (hoy solo alta y consulta).
- Deploy 24/7 (Railway).
- Web.

## Progreso

- [x] Schema: enum `internet` (impuestos/servicios), enum `inventario` (documentos), enum `responsable_pago`, campo `responsable` en `impuestos_servicios`, campo `carpeta_drive_url` en `propiedades`. Migración `0001` aplicada contra Supabase.
- [x] Repositorios nuevos (`proveedores`, `documentos`, `movimientos_financieros`) y ampliados (`propiedades`, `reparaciones`)
- [x] Servicios nuevos (`reparaciones.service`, `movimientos.service`) y ampliados (`pagos.service`, `vencimientos.service`)
- [x] 9 tools nuevas + 4 tools existentes ajustadas, registradas en `tools/index.ts`
- [x] `systemPrompt.ts` actualizado con las capacidades nuevas
- [x] `seed.ts` actualizado (proveedores, documentos, movimientos financieros, responsable en obligaciones)
- [x] Validación: typecheck, lint (Biome) y 13 tests en verde
- [x] Prueba end-to-end contra la base real + OpenAI: alta y búsqueda de proveedores, reparación con proveedor resuelto por nombre, comprobante adjuntado, obligación con responsable, carpeta de Drive vinculada, documentos consultados, balance por propiedad y general, corrección de un pago verificando que el movimiento financiero se actualiza (upsert) en vez de duplicarse

## Resultado

El asistente ahora cubre los 5 módulos que quedaban pendientes desde el v1: proveedores, reparaciones con proveedor y comprobante, obligaciones con responsable de pago, documentación enlazada a Drive, y balance financiero por propiedad. Los datos de prueba usados para esta validación se cargaron y luego se eliminaron (`TRUNCATE`) al terminar, dejando la base vacía para carga de datos reales, como ya estaba antes de esta etapa.
