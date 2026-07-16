# Etapa 6 — Consulta de garantes y seguros/impuestos alimentando el balance

**Estado: ✅ Completada**

## Objetivo

De la lista completa de pendientes del roadmap, el usuario marcó explícitamente dos para construir ahora y descartó el resto por ahora: edición/borrado de datos (depende del mantenimiento manual o queda para si lo piden), subida real de archivos (ya cubierto por los links a Drive de la etapa 3), y recordatorios por-evento escalados (el digest diario ya alcanza). Interfaz web y WhatsApp quedaron confirmados como líneas futuras, fuera de esta etapa.

## Qué se implementa

### 1. Consulta de garantes
El dato ya existía en el schema (`contratos_garantes`) y ya se cargaba en cada resolución de contrato, pero nunca se expuso al asistente. Nueva función `pagos.service.obtenerGarantes()`, que reutiliza la misma resolución fuzzy (por nombre de inquilino o dirección) que ya usaba `obtenerEstadoPago`. Nueva tool `consultar_garantes`.

### 2. Seguros e impuestos/servicios alimentando el balance
Hasta esta etapa, `seguros` e `impuestos_servicios` modelaban una obligación futura sin concepto de "pagado" — por eso quedaron fuera del balance financiero en la etapa 3. Se agrega `fecha_pago` (nullable) a ambas tablas, con el mismo patrón ya usado para pagos y reparaciones: al marcar como pagado, se refleja automáticamente en `movimientos_financieros` (best-effort, con upsert por `referencia_tipo`+`referencia_id` para que corregir un pago actualice en vez de duplicar).

Nuevas tools: `marcar_seguro_pagado`, `marcar_impuesto_servicio_pagado`, `listar_seguros` (análoga a `listar_impuestos_servicios` de la etapa 3, para poder encontrar el ID a marcar). `listar_vencimientos`/`obtener_agenda` dejan de mostrar un seguro o impuesto ya pagado como vencimiento próximo.

**Nota sobre IDs**: la etapa 4 había sacado el marcador `(id: ...)` de `crear_seguro`, `crear_impuesto_servicio` y `listar_impuestos_servicios` porque en ese momento ningún tool lo necesitaba. Esta etapa lo repone en esos tres — la misma regla de la etapa 4 (exponer ID solo si hace falta para encadenar) aplicada correctamente, no una regresión.

## Decisiones

- **`obtenerGarantes` vive en `pagos.service.ts`**, junto a `resolverContrato` (la función que reutiliza) — evita mover código que ya funciona a un archivo nuevo solo por prolijidad.
- **No se modela recurrencia**: marcar un seguro/impuesto como pagado actualiza esa fila puntual; para el próximo período se sigue cargando una fila nueva con `crear_seguro`/`crear_impuesto_servicio`, igual que ya funcionaba.
- **Filtrado de pagados en `listarXPorVencer`**: un seguro/impuesto ya pagado no tiene sentido seguir mostrándolo como "hay que pagar esto pronto".

## Fuera de alcance (descartado explícitamente, no por falta de tiempo)

- Edición y borrado de propiedades/personas/proveedores/contratos.
- Subida real de archivos a Supabase Storage.
- Recordatorios por-evento escalados.

## Pendiente para más adelante (confirmado, no descartado)

- Interfaz web: cuando se construya, panel de **solo lectura** (agenda, balance, listados) — sin repetir el asistente de IA. Alcance a definir en su momento.
- WhatsApp como canal adicional: el costo no es un impedimento real para este volumen de uso (conversaciones iniciadas por el usuario son gratis e ilimitadas; el único mensaje proactivo diario costaría fracciones de centavo), pero requiere verificación de Meta Business y más fricción de setup que Telegram.

## Progreso

- [x] Schema: `fecha_pago` en `seguros` e `impuestos_servicios`, migración aplicada
- [x] Repos: `marcarPagado` + filtro de pagados en `listarXPorVencer`
- [x] Servicios nuevos `seguros.service.ts`, `impuestos.service.ts` (mismo patrón que `reparaciones.service.ts`)
- [x] `pagos.service.obtenerGarantes`
- [x] 4 tools nuevas + 3 tools existentes ajustadas (reponer ID)
- [x] `systemPrompt.ts` actualizado
- [x] Typecheck, lint, 13 tests en verde
- [x] Prueba end-to-end contra datos reales sembrados: consulta de garantes (con y sin garante cargado), marcar seguro/impuesto como pagado, balance reflejando ambos por separado por propiedad, corrección de un pago vía upsert (sin duplicar), y confirmación de que lo pagado desaparece de la agenda

## Resultado

El asistente ahora responde "¿quién es garante de X?" y puede marcar seguros e impuestos/servicios como pagados, con el gasto reflejándose solo en el balance financiero de la propiedad correspondiente.
