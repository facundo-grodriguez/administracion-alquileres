# Circuito completo del sistema — alcance del desarrollo

Este documento explica **todo lo que hace el asistente hoy** (versión 6.0.0) y **cómo viaja un mensaje** desde que lo escribís hasta que te llega la respuesta. Todos los ejemplos de este documento son una conversación real, corrida contra la base de datos y la API de OpenAI en producción para escribir este documento — no son inventados.

## 1. El circuito técnico

Así viaja un mensaje típico, de punta a punta:

```
Vos (Telegram)
   │  escribís en lenguaje natural
   ▼
Bot de Telegram (grammY)
   │  recibe el mensaje (webhook en Render, o long-polling en desarrollo local)
   ▼
ChatSession (historial de la conversación de ese chat)
   │  arma el pedido con el system prompt (reglas de comunicación) + historial
   ▼
API de OpenAI (gpt-5.4, function calling)
   │  el modelo decide qué herramienta(s) necesita llamar, si necesita alguna
   ▼
Tool (ej. crear_contrato, obtener_estado_pago)
   │  valida el input (Zod), llama a la capa de servicios
   ▼
Service (lógica de negocio: resolver ambigüedades, side-effects como
   │      auto-actualizar el balance financiero)
   ▼
Repository (Drizzle ORM)
   │  lee/escribe en la base
   ▼
Postgres (Supabase)
   │
   ▼
… el resultado vuelve por la misma cadena hasta el modelo, que compone
   la respuesta final en lenguaje de negocio (nunca IDs, nunca fechas ISO)
   ▼
Vos (Telegram) ← recibís la respuesta
```

Dos cosas importantes de este circuito:

- **El modelo puede encadenar varias herramientas en un solo mensaje tuyo.** Por ejemplo, "Creale un contrato a Martín Sosa..." primero busca/resuelve la propiedad y el inquilino, y recién después crea el contrato — todo en un solo intercambio con vos.
- **Dos cosas pasan por fuera de este circuito**, sin pasar por el modelo: el comando `/agenda` y el **recordatorio diario automático** arman el texto directo desde la base (más rápido, no gasta tokens de OpenAI) y te lo mandan tal cual.

### Dónde vive cada cosa

| Capa | Vive en | Rol |
|---|---|---|
| Interfaz | `src/interfaces/telegram/` | Recibe/manda mensajes de Telegram. También hay una versión por consola (`src/interfaces/cli/`) para pruebas. |
| Asistente | `src/core/assistant/` | El loop de conversación con OpenAI, las 27 herramientas, las reglas de comunicación (`systemPrompt.ts`). |
| Servicios | `src/core/services/` | Lógica de negocio: resolver "¿de qué contrato hablás?", calcular el balance, armar la agenda. |
| Repositorios | `src/core/repositories/` | Acceso a cada tabla de la base. |
| Base de datos | Supabase (Postgres) | 13 tablas: personas, propiedades, contratos, pagos, seguros, impuestos/servicios, reparaciones, proveedores, documentos, movimientos financieros, y las de soporte (garantes, actualizaciones de contrato, recordatorios). |
| Hosting | Render (free tier) | Corre el bot 24/7, modo webhook. Redeploy automático en cada push a GitHub. |
| Recordatorio diario | node-cron + GitHub Actions | Un aviso por día con lo que vence pronto; un ping externo gratuito despierta el servicio si estaba dormido. |

## 2. Recorrido completo por caso real

Todo lo que sigue es **una sola conversación real**, de punta a punta, con una propiedad, un inquilino, un garante, un proveedor, una reparación, un seguro, un impuesto y un movimiento manual — el ciclo completo de un mes de administración.

### Alta de personas

> **Vos:** Dá de alta a Laura Fernández como nueva persona, DNI 27888999, teléfono 1145551122
>
> **Bot:** Listo, registré la persona correctamente.
>
> Nombre: Laura Fernández
> DNI: 27.888.999
> Teléfono: 11 4555-1122

Lo mismo para el inquilino (Martín Sosa) y el garante (Diego Paz). Una persona no tiene un "rol" fijo guardado — se infiere de dónde se la referencia después (propietaria de una propiedad, inquilino de un contrato, garante de un contrato). La misma persona puede cumplir más de un rol.

### Alta de propiedad

> **Vos:** Dame de alta la propiedad Av. Corrientes 3200, piso 5 depto A, zona Almagro, del propietario Laura Fernández
>
> **Bot:** Listo, registré la propiedad correctamente.
>
> Propiedad: Av. Corrientes 3200, piso 5 depto A
> Zona: Almagro
> Propietaria: Laura Fernández

El bot resolvió sola la propietaria por nombre (no hizo falta darle un ID).

### Contrato con garante

> **Vos:** Creale un contrato a Martín Sosa en Av. Corrientes 3200 piso 5 depto A: desde el 1/8/2026 hasta el 31/7/2028, alquiler 620000, vence el día 5, con Diego Paz como garante
>
> **Bot:** Listo, registré el contrato correctamente.
>
> Propiedad: Av. Corrientes 3200, piso 5 depto A
> Propietaria: Laura Fernández
> Inquilino: Martín Sosa
> Garante: Diego Paz
> Inicio: 01/08/2026
> Finalización: 31/07/2028
> Alquiler inicial: $620.000
> Vencimiento mensual: día 5

### Consulta de garantes

> **Vos:** ¿Quién es garante de Martín Sosa?
>
> **Bot:** El garante de Martín Sosa es Diego Paz.
>
> Propiedad: Av. Corrientes 3200, piso 5 depto A
> DNI: 30.111.222
> Teléfono: 11 6677-8899

### Cobro de alquiler

> **Vos:** Registrá el pago del alquiler de Martín Sosa, período actual, 620000, hoy, transferencia
>
> **Bot:** Listo, registré el pago correctamente. [...] Estado: Pagado

> **Vos:** ¿Está pago el alquiler de Martín?
>
> **Bot:** Sí, está pago. [...] Vencimiento: 05/07/2026 — Fecha de pago: 16/07/2026 — Estado: Pagado

Si el mismo período se vuelve a registrar con otro monto, el sistema **corrige** el pago existente en vez de duplicarlo.

### Proveedores y reparaciones

> **Vos:** Dame de alta un proveedor: Gasistería Nº1, gasista, zona Almagro, teléfono 1177889900
>
> **Vos:** Cargá una reparación en Av. Corrientes 3200: pérdida de gas en la cocina, la hace Gasistería Nº1, costo 90000
>
> **Bot:** Listo, registré la reparación correctamente. [...] Proveedor: Gasistería Nº1 — Costo: $90.000 — Estado: Pendiente

> **Vos:** Adjuntale un comprobante a la reparación de la pérdida de gas: [link de Drive], Factura_Gasista.pdf
>
> **Vos:** Marcá como completada la reparación de la pérdida de gas
>
> **Bot:** Listo, marqué la reparación como completada. [...] Estado: Completada

> **Vos:** Listame las reparaciones, incluidas las completadas
>
> **Bot:** - Av. Corrientes 3200, piso 5 depto A — Pérdida de gas en la cocina — Proveedor: Gasistería Nº1 — $90.000 — Completada — Comprobante: adjunto

### Seguros

> **Vos:** Cargá un seguro de Sancor Seguros para Av. Corrientes 3200, inicia hoy, vence en 11 meses, costo 38000
>
> **Vos:** Marcá como pagado el seguro de Sancor, hoy
>
> **Bot:** Listo, marqué el seguro como pagado. [...] Importe: $38.000 — Estado: Pagado

### Impuestos y servicios (con responsable de pago)

> **Vos:** Cargá el ABL de Av. Corrientes 3200: vence en 20 días, número de cuenta 456-789-1, monto estimado 27000, responsable propietario
>
> **Vos:** Marcá como pagado el ABL de Av. Corrientes 3200, hoy
>
> **Bot:** Listo, marqué el ABL como pagado. [...] Importe: $27.000 — Estado: Pagado

Los tipos disponibles son ABL, ARBA, luz, gas, agua, expensas, internet y otro, cada uno con quién es responsable de pagarlo (propietario o inquilino) si se sabe.

### Documentación (links a Google Drive)

> **Vos:** Vinculá la carpeta de Drive de Av. Corrientes 3200: [link]
>
> **Vos:** Subí el contrato de Av. Corrientes 3200: Contrato_Corrientes.pdf, [link]
>
> **Vos:** Mostrame la documentación de Av. Corrientes 3200
>
> **Bot:** Carpeta general: [link] — Documentos cargados: Contrato_Corrientes.pdf (Contrato) — [link]

No se suben archivos reales — se guardan los links a una carpeta de Drive que administrás vos mismo.

### Movimientos financieros y balance

> **Vos:** Registrá un gasto de 15000 en Av. Corrientes 3200 por limpieza de tanque, hoy
>
> **Vos:** ¿Cómo viene el balance de Av. Corrientes 3200 este mes?
>
> **Bot:** Período: 01/07/2026 al 16/07/2026 — Ingresos: $620.000 — Gastos: $170.000 — Resultado neto: $450.000
>
> Detalle:
> - Ingreso por alquiler de Martín Sosa: $620.000
> - Reparación por pérdida de gas en la cocina: $90.000
> - Seguro Sancor Seguros: $38.000
> - ABL: $27.000
> - Limpieza de tanque: $15.000

Los ingresos por alquiler y los gastos de reparaciones/seguros/impuestos **se cargan solos** al balance en cuanto se registra el pago — no hay que cargarlos dos veces. Solo lo que no tiene otro origen (como la limpieza del tanque) se carga a mano.

### Agenda y vencimientos

> **Vos:** ¿Qué tengo pendiente hoy?
>
> **Bot:** Hoy no tenés nada pendiente. Está todo al día.

Como el ABL y el seguro ya se marcaron como pagados, no vuelven a aparecer como pendientes — solo se avisa de lo que sigue sin resolver.

### Búsquedas

> **Vos:** Buscá la propiedad Corrientes → Av. Corrientes 3200, piso 5 depto A — Zona: Almagro — Propietaria: Laura Fernández
>
> **Vos:** Buscá una persona que se llame Sosa → Martín Sosa — DNI 35.222.333
>
> **Vos:** Buscá un gasista en Almagro → Gasistería Nº1 — Zona: Almagro — Tel: 11 7788-9900

## 3. Recordatorio diario (sin que preguntes)

Una vez por día (por defecto 09:00, hora Argentina), el bot te manda por su cuenta el mismo tipo de resumen que ves en "¿qué tengo pendiente hoy?" — alquileres a cobrar/atrasados, vencimientos próximos, reparaciones abiertas. No hace falta pedirlo. `/enviar_agenda` lo dispara en el momento para probarlo.

## 4. Tabla completa de herramientas (27)

| Categoría | Herramienta | Qué hace |
|---|---|---|
| Consultas | `buscar_propiedad` | Busca por dirección, zona, propietario o inquilino |
| | `buscar_persona` | Busca por nombre, DNI o teléfono |
| | `obtener_estado_pago` | ¿Está pago el alquiler de X? |
| | `obtener_agenda` | Resumen completo de lo pendiente |
| | `listar_vencimientos` | Contratos/seguros/impuestos por vencer, con filtro por tipo |
| | `listar_reparaciones` | Abiertas o todas |
| | `buscar_proveedor` | Por rubro, zona o nombre |
| | `buscar_documentos` | Documentos + carpeta de Drive de una propiedad |
| | `listar_impuestos_servicios` | Todos los de una propiedad, pagados o no |
| | `listar_seguros` | Todos los de una propiedad, pagados o no |
| | `obtener_balance_financiero` | Ingresos/gastos de una propiedad o de todas |
| | `consultar_garantes` | Quién es garante de un inquilino/contrato |
| Altas | `crear_persona`, `crear_propiedad`, `crear_contrato`, `crear_recibo`, `crear_seguro`, `crear_impuesto_servicio`, `crear_reparacion`, `crear_proveedor`, `crear_documento`, `crear_movimiento_financiero` | Registran cada entidad |
| Actualizaciones | `marcar_reparacion_completada`, `vincular_carpeta_drive`, `adjuntar_comprobante_reparacion`, `marcar_seguro_pagado`, `marcar_impuesto_servicio_pagado` | Actualizan un registro existente |

## 5. Reglas de comunicación (aplican a todo lo anterior)

- Nunca se muestra un ID interno, un UUID, ni el nombre de una tabla o columna — salvo que lo pidas explícitamente.
- Las propiedades siempre se identifican por dirección, nunca por número interno.
- Las fechas siempre en formato DD/MM/AAAA; los períodos de alquiler como "Julio 2026".
- Toda alta confirma con los datos de negocio completos, no solo "listo".

## 6. Qué NO hace hoy (límites conocidos del alcance)

- **No se puede editar ni borrar** una persona, propiedad, proveedor o contrato ya cargado — solo dar de alta y consultar. Corregir un dato mal cargado requiere entrar directo a Supabase. *(Descartado a pedido explícito: se prefiere que dependa del mantenimiento manual.)*
- **No sube archivos reales** — solo guarda links a Google Drive, que administrás vos. *(Descartado: la solución con Drive ya cubre el caso de uso.)*
- **El recordatorio es un solo digest diario**, no avisos escalonados por urgencia. *(Descartado: lo que hay ya alcanza.)*
- **No hay interfaz web** todavía — solo Telegram. Cuando se construya, va a ser un panel de solo lectura (agenda, balance, listados), no un chat nuevo.
- **No hay WhatsApp** todavía — el costo no sería un problema, pero el setup (verificación de Meta Business) tiene más fricción que Telegram.
- El recordatorio diario depende de que Render esté despierto a esa hora (free tier) — un ping externo gratuito lo despierta a tiempo, pero no es 100% infalible.

## Historial de versiones

Ver [`../CHANGELOG.md`](../CHANGELOG.md) para el detalle versión por versión, y [`roadmap.md`](roadmap.md) para qué se evaluó y se descartó explícitamente.
