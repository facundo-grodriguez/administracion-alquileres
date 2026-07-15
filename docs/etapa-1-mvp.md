# Etapa 1 — MVP: bot conversacional de administración de alquileres

**Estado: ✅ Completada**

## Objetivo

Construir desde cero un asistente que centralice la gestión de alquileres y permita consultar y cargar datos en **lenguaje natural**, en vez de tener la información dispersa y controlar los vencimientos a mano.

## Qué se implementó

### Base de datos (Postgres en Supabase, vía Drizzle ORM)
Esquema relacional completo con **13 tablas** (aunque el v1 usa activamente 4): `personas`, `propiedades`, `contratos`, `contratos_garantes`, `actualizaciones_contrato`, `pagos`, `proveedores`, `seguros`, `impuestos_servicios`, `reparaciones`, `documentos`, `movimientos_financieros`, `recordatorios`. Migración inicial generada y aplicada.

### Lógica de negocio (`src/core`, agnóstica de interfaz)
- **Repositorios** (acceso tipado a la base): personas, propiedades, contratos, pagos.
- **Servicios**: `pagos.service` (estado de pago, atrasados, cobros del mes, generar recibo), `vencimientos.service` (contratos por vencer), `agenda.service` (resumen).

### Asistente con IA
- 8 herramientas (tools) que el modelo puede usar: `buscar_propiedad`, `buscar_persona`, `obtener_estado_pago`, `listar_vencimientos`, `crear_persona`, `crear_propiedad`, `crear_contrato`, `crear_recibo`.
- El LLM nunca toca la base directo: siempre pasa por las tools, validadas con Zod.

### Interfaces
- **Telegram** (`@Alqui_Adminbot`) — interfaz principal, con control de acceso por lista de IDs autorizados.
- **CLI** (`npm run chat`) — para pruebas locales sin Telegram.

## Decisiones

- **Stack**: TypeScript/Node, Drizzle ORM sobre Postgres de Supabase, Zod para validación, Vitest para tests, Biome para lint/formato.
- **Arquitectura desacoplada**: toda la lógica en `src/core`; las interfaces (Telegram, CLI) son capas delgadas. Permite agregar una web más adelante sin reescribir nada.
- **Dos cambios de rumbo durante la etapa**:
  1. De interfaz CLI a **bot de Telegram** (más práctico para un solo administrador, chat en el celular sin frontend).
  2. Del proveedor de IA: se arrancó con Claude/Anthropic y se migró a **OpenAI** (function calling con la Chat Completions API). Como el `ChatSession` mantiene la misma firma, el cambio no afectó ni la base ni las interfaces. Modelo por defecto: `gpt-5.4`.

### Problemas resueltos al probar en vivo
- Los modelos `gpt-5.6-*` exigen el parámetro `reasoning_effort` cuando se usan tools, y además tienen rollout gateado (401 hasta que OpenAI habilita la cuenta) → se usa `gpt-5.4`.
- Entornos con IPv6 mal configurado no alcanzaban `api.telegram.org` → se fuerza IPv4 (`dns.setDefaultResultOrder`).

## Estado final

Funciona end-to-end: pregunta en lenguaje natural → tool call → consulta real a Supabase → respuesta. Probado por Telegram. Código validado (typecheck, lint, 9 tests) y en GitHub.

### Fuera de alcance (para etapas siguientes)
Seguros, impuestos/servicios y reparaciones (tablas creadas pero sin lógica), documentación/Storage, proveedores, control financiero completo, recordatorios automáticos, interfaz web, deploy 24/7.
