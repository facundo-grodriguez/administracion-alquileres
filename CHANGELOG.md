# Changelog

Versionado semántico (`MAJOR.MINOR.PATCH`) aplicado sobre este proyecto: **MAJOR** = etapa nueva (módulo o capacidad significativa), **MINOR** = funcionalidad menor agregada entre etapas, **PATCH** = fix o cambio de infraestructura sin funcionalidad nueva. Cada versión tiene un tag de Git con el mismo nombre (`vX.Y.Z`).

## [9.13.0] — 2026-11-06 — Cuentas personales
> 📒 Tu presupuesto del mes en el bot: rubros con lo previsto, el sueldo y cuánto sobra
> ⚙️ Se arman sin gastar IA: /cuentas con la lista, o el botón ⚙️ Rubros
> 🔗 Lo reservado y los vencimientos van por separado; si lo pedís, un rubro toma lo pagado en su vencimiento
> 📊 Pestaña "Cuentas" en la planilla, con tu misma estructura: rubro por fila, mes por columna

Cuentas personales del administrador, aparte de las propiedades (no tocan ningún balance). Se arman
con `/cuentas` y abajo la lista, un rubro por línea ("Compras 250000", "Sueldo 1020935"), que se lee
sin IA; "(vencimiento Moto GP)" vincula el rubro, "(sin vincular)" lo separa y "quitar Nafta" lo saca.
También desde el botón ⚙️ Rubros (flujo `configurar_cuenta`: agregar, cambiar lo reservado, vincular,
desvincular, quitar) o escribiéndole al asistente. Cada rubro tiene un previsto que se repite todos
los meses y se puede cambiar para un mes. Lo real se carga como total del mes o sumando ("este mes en
compras gasté 230000", o ➕ Nueva carga → 📒 Cuenta del mes); un rubro vinculado a un vencimiento
personal toma lo pagado ahí. Ningún rubro se vincula solo. 🔎 Consultas → 📒 Cuentas del mes muestra
sueldo, gastos previstos, lo que sobra, lo gastado hasta ahora y lo que sobraría, con ⬅️/➡️ meses.
Tools nuevas `configurar_cuenta`, `cargar_cuenta` y `ver_cuentas`. Tablas `cuentas_rubros` y
`cuentas_mes` (migración 0009, se aplica sola al arrancar).

## [9.12.0] — 2026-11-06 — Gastos y vencimientos conectados
> 💡 "Gastos sin pagar" junta todo: gastos cargados y vencimientos del mes, por Personal y cada propiedad
> ✅ Un solo botón "Pagar" para gastos y servicios
> 🔗 Sin duplicados: cargar a mano la luz del mes la vincula al vencimiento de esa propiedad
> 📅 La agenda de la mañana es el único aviso: ya no llega un mensaje por cada vencimiento

"💡 Gastos sin pagar" (Consultas, la ficha de la propiedad y la tool nueva `listar_sin_pagar`) muestra
los gastos de propiedades sin pagar y los vencimientos de servicios de este mes y los próximos 10 días,
en 👤 Personal y 🏠 cada propiedad con subtotales. "✅ Pagar" (`pagar_gasto`) ofrece las dos cosas: si
es un servicio sigue los pasos de "Pagar servicio" (monto real y, si está alquilada, quién pagó).

Al cargar un gasto de un rubro que la propiedad tiene agendado como vencimiento (luz, gas, agua,
expensas, ABL...), el mes del vencimiento queda vinculado al gasto: cuando se paga el gasto, el
vencimiento queda pagado (no avisa más) y en "sin pagar" aparece una sola vez. Si ese mes ya estaba
pagado desde el vencimiento, avisa que puede estar duplicado. La planilla suma a "Gastos propiedades"
los vencimientos de propiedades que faltan pagar.

El recordatorio diario manda un solo mensaje: la agenda, que ya lista los vencimientos de servicios,
ahora con el monto, ⚠️ en lo que vence hoy o está atrasado, la fecha en DD/MM/AAAA y los botones
"✅ Pagar" y "💡 Ver sin pagar". Se dejan de mandar los avisos sueltos de cada servicio.

## [9.11.1] — 2026-11-06 — Los avisos llegan aunque el bot esté dormido
> 🔔 La agenda y los avisos de servicios salen apenas el bot se despierta, si a las 9 estaba dormido
> 🕘 El bot usa la hora de Argentina: de 21 a 24 hs ya no cree que es el día siguiente

En el plan gratis de Render el bot se duerme sin tráfico y a las 9:00 no llegaba a mandar nada (el
ping de GitHub Actions llega horas tarde). Ahora, al arrancar y cada 10 minutos, revisa si ya pasó
AGENDA_HORA y lo de hoy no se mandó, y lo manda (sin repetir: queda registrado en la base). El
proceso fija `TZ` = AGENDA_TIMEZONE si no viene definida.

## [9.11.0] — 2026-11-06 — Cuotas que terminan y cuadro de servicios
> 🔚 Servicios con última cuota: avisa hasta ese mes y después se apaga solo
> 🗑️ Dar de baja ya no borra el seguimiento: lo cargado queda en la planilla
> 📊 Servicios personales en un cuadro: una fila por servicio y una columna por mes, con colores
> 👥 En 📅 Servicios del mes: ver todo, solo lo personal o solo las propiedades, y el total pagado

Al agendar un vencimiento se pregunta si vence todos los meses o termina en un mes (cuotas); en
"✏️ Modificar" se suma "🔚 Cuándo termina". Después del último mes no avisa, no aparece para pagar ni
en los meses siguientes, y lo pagado queda. Dar de baja guarda el seguimiento hasta este mes si ya
tiene algo cargado (si no, hasta el anterior). Columna nueva `hasta_periodo` (migración 0008, se
aplica sola al arrancar).

La pestaña "Servicios personales" pasa a ser un cuadro servicio × mes (el más nuevo a la izquierda y
sin meses futuros, salvo que ya estén pagados): cada celda es solo el monto y el estado va en el
color (verde pagado, amarillo por vencer, rojo vencido), con los totales "Pagado" y "Falta pagar" abajo.

"📅 Servicios del mes" deja una línea en blanco entre lo personal y cada propiedad, suma botones
👥 Todo / 👤 Personal / 🏠 Propiedades (los meses anteriores mantienen el filtro) y muestra el total
pagado al lado de "✅ Pagados". Cada grupo (👤 Personal y cada 🏠 propiedad) muestra su subtotal. Arregla el punto doble en "Actualizado ... p. m..".

## [9.10.1] — 2026-11-06 — Arreglo de la planilla de Google
> 📊 La planilla de Google ya se completa: el bot escribía en una dirección equivocada

Para borrar y escribir las pestañas se usaba `…/{id}:values:batchClear` en vez de
`…/{id}/values:batchClear` (igual con `batchUpdate`) y Google respondía 400. Si Google devuelve una
página de error, el mensaje de `/planilla` ya no la muestra entera.

## [9.10.0] — 2026-11-06 — Planilla de Google y servicios más claros
> 📊 Planilla de Google que se actualiza sola: resumen, alquileres, gastos y servicios personales
> 👤🏠 En 📅 Servicios del mes, lo personal y cada propiedad por separado; lo pagado, abajo y aparte
> ⬅️ Botón para ver los meses anteriores y qué pagaste en cada uno

Planilla de Google Sheets (opcional) con cuatro pestañas: Resumen por propiedad (alquilada o libre,
alquiler actual, cobrado / gastos / neto del año y meses adeudados), Alquileres mes a mes por contrato,
Gastos propiedades y Servicios personales. Unos segundos después de cada cambio en el bot se reescriben
las pestañas (solo si algo cambió) y una vez por día con el aviso diario. Se conecta con una cuenta de
servicio de Google: variables `GOOGLE_SERVICE_ACCOUNT_JSON` y `GOOGLE_SHEET_ID` (pasos en
`docs/planilla-google.md`). Sin agregar dependencias: el login de Google se firma con `node:crypto`.
Comando `/planilla` (la actualiza y manda el link) y botón en 🔎 Consultas.

"📅 Servicios del mes" se divide en "🕓 Falta pagar" (por fecha de vencimiento, con el total aproximado)
y "✅ Pagados" (con monto y fecha de pago), y dentro de cada uno primero 👤 Personal y después cada
🏠 propiedad. Suma el botón del mes anterior; un servicio agendado este mes no aparece como "vencido"
en los meses anteriores, salvo que tenga algo cargado de ese mes.

## [9.9.0] — 2026-11-03 — Servicios de propiedad suman al gasto
> 🏠 Al pagar un servicio de una propiedad, se carga también como gasto de esa propiedad
> 💲 "Ya lo pagué" te pregunta el monto real (con botón para usar el aproximado)
> 👤 Si la propiedad está alquilada, pregunta quién lo pagó; si no, resta del balance

Los vencimientos personales siguen siendo solo recordatorios. Los de una propiedad, al marcarlos pagados
(desde el aviso, en "✅ Pagar servicio" o escribiéndolo), crean un gasto de la propiedad con el rubro que
corresponde (luz, gas, expensas, ABL...; lo que no está en la lista va como "otro" con su nombre). Si la
propiedad no tiene contrato vigente lo paga el propietario y resta del balance; si está alquilada se
pregunta si lo pagó el propietario o el inquilino (lo del inquilino queda anotado y no resta). Volver a
marcar el mismo mes corrige ese gasto en vez de duplicarlo. Columna nueva `servicios_vencimiento_mes.gasto_id`
(migración 0007, que el bot aplica solo al arrancar).

## [9.8.0] — 2026-11-02 — Vencimientos de servicios
> 📅 Agendá vencimientos de servicios (luz, gas, celular, prepaga...), tuyos o de una propiedad
> ⏰ El bot te avisa 3 días antes y el mismo día, con botones "Ya lo pagué" y "Cambió la fecha"
> 🔎 Consultas → 📅 Servicios del mes: qué vence, qué está pago y cuánto falta

Se cargan una vez con el día fijo del mes (➕ Nueva carga → 📅 Vencimiento, o escribiendo "la luz vence el
15") y se repiten solos todos los meses. Si una factura vence otro día, se cambia solo para ese mes (desde
el aviso o en ✏️ Modificar → 📅 Vencimiento), y ahí también se cambia el día fijo, el monto o se da de baja.
Los avisos llegan junto con la agenda diaria, no se repiten y dejan de llegar al marcarlo pagado; si el bot
estuvo caído el día del vencimiento, avisa igual hasta 2 días después. También aparecen en la agenda y en
"Vencimientos (30 días)". Son recordatorios: no son gastos de propiedad ni tocan el balance. Tablas nuevas
`servicios_vencimiento` y `servicios_vencimiento_mes` (migración 0006, que el bot aplica solo al arrancar).

## [9.7.0] — 2026-10-21 — Servicios a cargo del inquilino
> 🏠 Servicios, expensas e impuestos los paga el inquilino: no se descuentan del alquiler
> 🔧 En arreglos y "otro" se pregunta quién paga
> ✏️ Corregir gasto: elegís propiedad, después mes y ahí el gasto

Regla de negocio: luz, gas, agua, internet, expensas, ABL, ARBA y seguro hogar los paga el inquilino, así
que quedan registrados pero no restan en el balance. En arreglos y "otro" se pregunta quién paga (en
"💡 Gasto", en "🧾 Varios gastos" por cada uno y en los servicios del "💰 Pago"); solo lo del propietario
resta. "Corregir gasto" permite cambiar quién paga. Al arrancar, los gastos de servicios ya cargados sin
responsable pasan al inquilino y salen del balance (`asegurarEsquema`).

"✏️ Modificar → 💡 Gasto" ya no lista todos los gastos juntos: primero se elige la propiedad, después el
mes (solo los que tienen gastos, con la cantidad; los más viejos se buscan escribiendo MM/AAAA) y recién
ahí los gastos de ese mes. Motor de flujos: el buscador de un paso "entidad" recibe lo ya contestado y
puede mostrar más de 8 opciones de entrada (`maxListado`).

## [9.6.0] — 2026-10-21 — Pago mixto, arreglos como gasto y fix de pregunta repetida
> 💵 Medio de pago: efectivo + transferencia
> 🔧 Nuevo tipo de gasto: Arreglo / reparación
> 🛡️ Seguros: queda solo Seguro hogar
> ✏️ Corregir gasto permite cambiar el tipo
> 🔧 Un toque doble ya no repite ni salta preguntas

- Tipo de gasto nuevo "Arreglo / reparación" (enum `tipo_gasto`, migración `0005`). El bot aplica ese
  cambio solo al arrancar (`src/core/db/asegurarEsquema.ts`, idempotente y solo aditivo), así no hace
  falta correr `npm run db:migrate` a mano. "Seguro incendio" deja de ofrecerse al cargar (los gastos
  viejos con ese tipo se conservan).
- "✏️ Modificar → 💡 Gasto" permite cambiar el tipo (ej. de Otro a Arreglo / reparación).
- En "💰 Pago", la opción "Efectivo + transferencia" pregunta cuánto fue en efectivo (tiene que ser menor
que el total) y el resto queda como transferencia; se guarda como "efectivo $X + transferencia $Y".

Si un botón de una carga se procesaba dos veces (doble toque, o Telegram reenviando el mensaje mientras
Render despierta), el segundo se tomaba como respuesta de la pregunta siguiente: o la repetía ("¿Quién
los paga?" dos veces) o, peor, la contestaba sola. Ahora cada botón lleva la marca de su pregunta
(carga, nivel y paso) y uno de una pregunta ya contestada se ignora.

## [9.5.0] — 2026-10-21 — Varios gastos de una vez, botones sin IA y contratos superpuestos
> 💰 Al cargar el pago del alquiler, podés sumar los servicios que pagó
> 🧾 Varios gastos: cargá todos los servicios juntos, ya pagos
> 🔧 Tocar el menú en medio de una carga ya no deja botones colgados
> 👉 Al tocar un botón, queda escrito lo que elegiste
> 🚫 No deja cargar un contrato sobre una propiedad alquilada en esas fechas
> 🔴 Al elegir propiedad para un contrato, marca las alquiladas
> ⚡ Todos los botones funcionan sin IA (menos IPC)
> 🎯 Pago, gasto, Finaer y contrato desde un botón ya traen la propiedad/contrato

- **💰 Pago + servicios**: después del medio de pago, "💰 Pago" pregunta si también pagó servicios o
  gastos de la propiedad; si sí, se cargan uno tras otro (tipo y monto) como gastos pagados con la misma
  fecha que el alquiler, cada uno independiente.
- **Fix botones colgados**: si se tocaba el menú a mitad de una carga, la carga se cancelaba sin avisar y
  sus botones viejos no respondían nada (o, con otra carga en curso, podían aplicarse a la carga nueva).
  Ahora avisa "Dejé sin terminar la carga de …", cada carga marca sus botones y un botón de una carga
  anterior responde que ya terminó. Empezar una carga nueva con otra a medias cancela la anterior avisando.
- **🧾 Varios gastos** (en Nueva carga): propiedad → "¿ya están pagados?" → fecha de pago → un gasto
  tras otro (tipo y monto) hasta "No hay más". Cada uno queda como un gasto independiente y, si están
  pagos, entran directo al balance sin pasar por "Pagar gasto". Si no están pagos, pide el vencimiento
  de cada uno.
- **Opción elegida visible**: al tocar un botón, el mensaje queda con "👉 <opción>" en vez de solo perder
  los botones, así se ve en el chat qué se eligió en cada paso.
- **Contratos superpuestos**: el alta (flujo y chat) rechaza un contrato cuyas fechas se pisan con otro
  vigente de la misma propiedad, y dice desde cuándo puede empezar una renovación. En el flujo guiado se
  chequea apenas se carga la fecha de fin (vuelve a pedir las fechas), y el listado de propiedades marca
  con 🔴 las que ya están alquiladas.
- **Botones sin OpenAI**: "Registrar pago", "Ver contrato", "Ver propiedad", "Agregar gasto", "Crear
  contrato", "Seguro Finaer" y "Próximos vencimientos" se resuelven con código propio (abren el flujo
  guiado o muestran el dato). Si el botón viene de una carga o detalle, trae la propiedad/contrato y el
  flujo no lo vuelve a preguntar. Solo "⚡ IPC" y el chat libre siguen pasando por la IA.
- Motor de flujos: pasos ya completados de antemano se saltean, validación de negocio por paso
  (`validar`) y `ejecutar` puede rechazar la carga (termina sin botones posteriores).

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
