# Changelog

Versionado semántico (`MAJOR.MINOR.PATCH`) aplicado sobre este proyecto: **MAJOR** = etapa nueva (módulo o capacidad significativa), **MINOR** = funcionalidad menor agregada entre etapas, **PATCH** = fix o cambio de infraestructura sin funcionalidad nueva. Cada versión tiene un tag de Git con el mismo nombre (`vX.Y.Z`).

## [9.4.0] — 2026-10-21 — Modificar, pagar gastos y balance por propiedad
> ✏️ Modificar: propiedad, pago de alquiler y gasto
> ✅ Pagar gasto (en Nueva carga)
> 💡 Al cargar un gasto pregunta si ya está pagado
> 💵 Balance general o por propiedad
> 👤 Elegir inquilino/garante ya no lista a los dueños
> ⚡ Alquiler actual pasó a Modificar

- **✏️ Modificar** (botón nuevo del menú principal): editar una propiedad (dirección/nombre, zona, tipo,
  propietario), corregir un pago de alquiler (el bot avisa "Pago corregido (antes: $X)"), corregir un
  gasto (monto, vencimiento, fecha de pago; el balance se actualiza) y cargar el alquiler actual.
- **Gastos en el balance**: un gasto solo entra al balance cuando está pagado, y antes eso solo se podía
  hacer por chat. Ahora el alta pregunta si ya está pagado, hay un flujo "✅ Pagar gasto" y el balance
  avisa cuántos gastos cargados siguen sin pagar.
- **💵 Balance** en Consultas: general o por propiedad, de este mes, el mes anterior o este año.
- Al cargar un contrato, el listado inicial de inquilinos y garantes no muestra a los dueños de
  propiedades (buscando por nombre se encuentra a cualquiera).
- El historial de pagos ofrece "✏️ Corregir un mes".
- El aviso de versión nueva lista las novedades ítem por ítem (líneas `> ` de cada entrada de este CHANGELOG).

## [9.3.0] — 2026-10-21 — Aviso automático de versión nueva
Al arrancar una versión nueva, el bot le manda a los usuarios autorizados un mensaje "✅ Bot actualizado
a vX.Y.Z" con las novedades (el título de esa versión en este CHANGELOG) y el menú principal actualizado:
el teclado de Telegram se refresca solo, sin tener que mandar /start. Se avisa una sola vez por versión
(queda registrado en la tabla `recordatorios`), así que los reinicios de Render no repiten el mensaje.

## [9.2.1] — 2026-10-18 — Botón de alquiler actual en Vencimientos
La consulta "📆 Vencimientos (30 días)" ahora también ofrece el botón "⚡ Cargar alquiler actual" cuando
hay una actualización de alquiler vencida (antes solo aparecía en "⚡ Actualizaciones de alquiler").

## [9.2.0] — 2026-10-18 — Consultas, pagos anteriores y alquiler actual
- **🔎 Consultas**: botón nuevo en el menú principal que junta todas las consultas con botones, sin
  pasar por OpenAI — cobros del mes, meses sin pago, historial de pagos por contrato, detalle de un
  contrato, garantes, vencimientos, actualizaciones de alquiler, gastos sin pagar y balance del mes/año.
- **📚 Pagos anteriores**: flujo guiado para cargar de una vez varios meses ya cobrados (para contratos
  que vienen de antes de usar el bot). Sin monto, cada mes toma el valor que correspondía en ese momento;
  los meses ya pagados no se tocan. Nueva tool `historial_pagos` para consultarlo por chat.
- **⚡ Alquiler actual**: flujo y tool `registrar_alquiler_actual` para cargar a mano cuánto se paga hoy
  cuando el aumento ya se aplicó por fuera del bot. Saca la alerta de actualización pendiente hasta el
  próximo ajuste (sin monto, solo la marca como hecha). La agenda y el aviso diario ofrecen el botón
  cuando hay actualizaciones vencidas. El próximo cálculo por IPC parte de ese monto real.
- **Fix**: los cobros (💰 Pagos, agenda) usaban siempre el precio inicial del contrato aunque hubiera
  actualizaciones registradas; ahora usan el valor vigente de cada período.

## [9.1.1] — 2026-10-11 — Fix de estabilidad en modo webhook
Un error dentro de un handler (ej. la base de datos inaccesible) tumbaba el proceso entero en Render:
en modo webhook grammY no pasa por `bot.catch` y la promesa rechazada quedaba sin capturar, además de
que Telegram reintentaba el mismo update en loop. Ahora el servidor HTTP captura el error, lo loguea
(solo el mensaje, sin el `ctx` que incluía el token del bot) y responde 200. Se agrega además un handler
global de `unhandledRejection`.

## [9.1.0] — 2026-07-17 — QA v9
Ajustes a los flujos guiados de la etapa 9, a partir de una ronda de prueba real por Telegram:
(1) el texto final de cada alta ya no muestra el `(id: ...)` interno; (2) `crear_persona` standalone
pregunta primero el tipo (Propietario/Inquilino/Garante) y confirma con un encabezado acorde
("✅ Inquilino registrado correctamente."); (3) los pasos que relacionan entidades (propietario,
inquilino, garante, propiedad) muestran de entrada un listado de los existentes como botones, sin
esperar a que el usuario escriba nada — reutilizando el dato en vez de pedir escribirlo de nuevo;
(4) el botón "➕ Crear nuevo" ahora dice qué crea puntualmente (ej. "➕ Crear inquilino"); (5) el
botón "❌ Cancelar" pide confirmación antes de descartar la carga en curso, en cualquier paso —
un toque accidental ya no borra todo sin aviso. Cuando un sub-flujo de alta inline ya conoce el rol
por contexto (ej. el inquilino de un contrato nuevo), no lo vuelve a preguntar.

## [9.0.0] — 2026-07-17 — Etapa 9
Flujos guiados por máquina de estados (`src/core/flows`) para las 6 altas del asistente (persona, propiedad, contrato, pago, gasto, Seguro Finaer): se completan 100% por botones/texto corto, sin ninguna llamada a OpenAI, reutilizando exactamente las mismas tools que usa la IA. Soporta sub-flujos anidados (crear una persona o propiedad nueva sin salir del alta de un contrato) y detecta si el usuario abandonó el flujo a mitad de camino para derivarlo al asistente. Los 4 accesos fijos del menú principal (Propiedades/Contratos/Pagos/Resumen) también dejaron de pasar por OpenAI. De paso se corrigió un alias de import (`@/config/env.js`) inconsistente con el resto del proyecto. Ver [`docs/etapa-9-flujos-guiados.md`](docs/etapa-9-flujos-guiados.md).

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
