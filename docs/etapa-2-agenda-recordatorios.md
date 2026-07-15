# Etapa 2 — Agenda unificada y recordatorios proactivos

**Estado: ✅ Completada**

## Objetivo

Convertir el bot de un asistente que solo responde consultas en uno **proactivo**: que centralice todos los vencimientos en una agenda unificada y **avise solo** una vez por día sobre lo que vence pronto y lo atrasado, para que el administrador no tenga que acordarse de fechas.

## Qué se implementa

### 1. Carga de datos que faltaban
Las tablas `seguros`, `impuestos_servicios` y `reparaciones` existían pero no se podían usar. Se agregan repositorios, servicios y tools para **registrarlas y consultarlas** (sin esto, la agenda de esos rubros estaría siempre vacía).

### 2. Agenda unificada
Un solo resumen que junta:
- Alquileres a cobrar y pagos pendientes/atrasados (reutiliza lo del v1).
- Contratos próximos a vencer.
- Seguros próximos a vencer.
- Impuestos y servicios con vencimiento cercano (ABL, ARBA, luz, gas, etc.).
- Reparaciones abiertas.

### 3. Consultas rápidas en lenguaje natural
- "¿Qué tengo pendiente hoy?"
- "¿Qué vence esta semana?"
- "¿Qué seguros tengo que renovar?"
- "¿Qué reparaciones tengo abiertas?"

Nuevas tools: `obtener_agenda`, `crear_seguro`, `crear_impuesto_servicio`, `crear_reparacion`, `listar_reparaciones`, `marcar_reparacion_completada`; y `listar_vencimientos` extendida con filtro por tipo.

### 4. Recordatorio diario automático (proactivo)
Un **digest diario**: una vez por día, a una hora configurable, el bot escribe solo con el resumen de lo que vence pronto (con "en X días") y lo atrasado. Usa `node-cron` y deduplica para no repetir si el bot se reinicia. Comando `/enviar_agenda` para probar el aviso en el momento.

### 5. `/agenda` mejorado
El comando pasa a mostrar el resumen completo (cobros + vencimientos de todos los tipos + reparaciones), no solo contratos y atrasos.

## Decisiones

- **Alcance completo** (con carga de seguros/impuestos/reparaciones), acordado con el usuario: es lo que hace que las consultas de esos rubros tengan sentido.
- **Modelo de recordatorio: digest diario** (un mensaje que sirve de agenda + aviso anticipado), en vez de N mensajes por evento. Más simple y coherente; los avisos por-evento escalados quedan como refinamiento futuro.
- **Scheduler ahora, deploy después**: se construye el aviso automático ya (funciona mientras el bot esté prendido); queda listo para cuando se despliegue 24/7 en la nube.
- **Sin migración de base**: todas las tablas necesarias ya existían del v1.
- Config nueva por env vars (con defaults): `AGENDA_HORA` (09:00), `AGENDA_TIMEZONE` (America/Argentina/Buenos_Aires), `AGENDA_DIAS_ANTICIPACION` (30).

## Fuera de alcance (etapas siguientes)

- **Proveedores** (las reparaciones se cargan sin proveedor por ahora).
- **Deploy 24/7** (Railway) para que los avisos lleguen con la PC apagada.
- Recordatorios por-evento escalados, documentación/Storage, control financiero completo, web.

## Progreso

- [x] Util `diasEntreISO` + tests
- [x] Repositorios (seguros, impuestos/servicios, reparaciones, recordatorios)
- [x] Servicios (vencimientos unificado, agenda enriquecida)
- [x] Tools nuevas (`obtener_agenda`, `crear_seguro`, `crear_impuesto_servicio`, `crear_reparacion`, `listar_reparaciones`, `marcar_reparacion_completada`) + `listar_vencimientos` extendida con filtro por tipo
- [x] Scheduler (digest diario con `node-cron`) + comando `/enviar_agenda`
- [x] `/agenda` mejorado (resumen completo)
- [x] Seed con datos de ejemplo (seguro, ABL, reparación)
- [x] Validación (typecheck, lint, 13 tests) y prueba end-to-end contra la base + OpenAI

## Resultado

El bot ahora centraliza toda la agenda y responde consultas como "¿qué seguros tengo que renovar?" o "¿qué tengo pendiente hoy?" llamando a las nuevas herramientas. El `/agenda` muestra cobros + vencimientos de todos los tipos + reparaciones, y el recordatorio diario queda programado (funciona mientras el bot esté prendido; para 24/7 falta el deploy, que es la etapa siguiente).
