import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const estadoPagoEnum = pgEnum("estado_pago", ["pendiente", "pagado", "atrasado", "parcial"]);
export const estadoContratoEnum = pgEnum("estado_contrato", ["vigente", "finalizado", "rescindido"]);
export const estadoReparacionEnum = pgEnum("estado_reparacion", ["pendiente", "en_curso", "completada"]);
export const estadoRecordatorioEnum = pgEnum("estado_recordatorio", ["pendiente", "notificado", "resuelto"]);
export const tipoDocumentoEnum = pgEnum("tipo_documento", [
  "contrato",
  "poliza",
  "recibo",
  "factura",
  "comprobante",
  "foto",
  "inventario",
  "otro",
]);
export const tipoGastoEnum = pgEnum("tipo_gasto", [
  "expensas",
  "ABL",
  "ARBA",
  "luz",
  "gas",
  "agua",
  "internet",
  "seguro_hogar",
  "seguro_incendio", // ya no se ofrece al cargar; se conserva por los gastos viejos
  "reparacion",
  "otro",
]);
export const estadoGastoEnum = pgEnum("estado_gasto", ["pendiente", "pagado"]);
export const tipoMovimientoFinancieroEnum = pgEnum("tipo_movimiento_financiero", ["ingreso", "gasto"]);
export const responsablePagoEnum = pgEnum("responsable_pago", ["propietario", "inquilino"]);
export const indiceActualizacionEnum = pgEnum("indice_actualizacion", ["IPC", "ICL"]);
export const frecuenciaActualizacionEnum = pgEnum("frecuencia_actualizacion", [
  "mensual",
  "trimestral",
  "semestral",
  "anual",
]);

// personas: inquilinos, propietarios, garantes y administradores. El rol no es un campo fijo:
// se infiere de dónde se referencia a la persona (propietarioId de una propiedad, inquilinoId
// de un contrato, fila en contratos_garantes), porque una misma persona puede cumplir más de un rol.
export const personas = pgTable("personas", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombreCompleto: text("nombre_completo").notNull(),
  dni: varchar("dni", { length: 20 }),
  telefono: varchar("telefono", { length: 40 }),
  email: varchar("email", { length: 255 }),
  direccion: text("direccion"),
  notas: text("notas"),
  ...timestamps,
});

export const proveedores = pgTable("proveedores", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombre: text("nombre").notNull(),
  categoria: varchar("categoria", { length: 60 }).notNull(),
  telefono: varchar("telefono", { length: 40 }),
  zona: varchar("zona", { length: 120 }),
  horarios: text("horarios"),
  confianza: integer("confianza"),
  observaciones: text("observaciones"),
  ...timestamps,
});

// documentos es polimórfica (entidadTipo + entidadId) para no duplicar la tabla de archivos
// por cada entidad que puede tener adjuntos (propiedad, contrato, pago, seguro, reparacion, persona).
// No lleva FK real a esas tablas porque entidadTipo determina a cuál apunta entidadId.
export const documentos = pgTable(
  "documentos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entidadTipo: varchar("entidad_tipo", { length: 40 }).notNull(),
    entidadId: uuid("entidad_id").notNull(),
    tipoDocumento: tipoDocumentoEnum("tipo_documento").notNull(),
    storagePath: text("storage_path").notNull(),
    nombreArchivo: text("nombre_archivo").notNull(),
    mimeType: varchar("mime_type", { length: 120 }),
    tamanoBytes: integer("tamano_bytes"),
    subidoEn: timestamp("subido_en", { withTimezone: true }).defaultNow().notNull(),
    notas: text("notas"),
  },
  (t) => [index("documentos_entidad_idx").on(t.entidadTipo, t.entidadId)],
);

export const propiedades = pgTable("propiedades", {
  id: uuid("id").defaultRandom().primaryKey(),
  direccion: text("direccion").notNull(),
  zona: varchar("zona", { length: 120 }),
  propietarioId: uuid("propietario_id")
    .notNull()
    .references(() => personas.id),
  tipo: varchar("tipo", { length: 60 }),
  medidores: jsonb("medidores"),
  observaciones: text("observaciones"),
  carpetaDriveUrl: text("carpeta_drive_url"),
  ...timestamps,
});

export const contratos = pgTable(
  "contratos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propiedadId: uuid("propiedad_id")
      .notNull()
      .references(() => propiedades.id, { onDelete: "cascade" }),
    inquilinoId: uuid("inquilino_id")
      .notNull()
      .references(() => personas.id),
    fechaInicio: date("fecha_inicio").notNull(),
    fechaFin: date("fecha_fin").notNull(),
    valorAlquilerInicial: numeric("valor_alquiler_inicial", { precision: 12, scale: 2 }).notNull(),
    indiceActualizacion: indiceActualizacionEnum("indice_actualizacion"),
    frecuenciaActualizacion: frecuenciaActualizacionEnum("frecuencia_actualizacion"),
    diaVencimientoPago: integer("dia_vencimiento_pago").notNull().default(10),
    deposito: numeric("deposito", { precision: 12, scale: 2 }),
    estado: estadoContratoEnum("estado").notNull().default("vigente"),
    observaciones: text("observaciones"),
    // Seguro Finaer: forma parte del contrato (no es una entidad aparte). El estado
    // (vigente/vencido) se deriva de finaerFechaVencimiento, no se guarda.
    finaerActivo: boolean("finaer_activo").notNull().default(false),
    finaerNumeroPoliza: varchar("finaer_numero_poliza", { length: 80 }),
    finaerFechaInicio: date("finaer_fecha_inicio"),
    finaerFechaVencimiento: date("finaer_fecha_vencimiento"),
    finaerObservaciones: text("finaer_observaciones"),
    ...timestamps,
  },
  (t) => [index("contratos_fecha_fin_idx").on(t.fechaFin), index("contratos_propiedad_idx").on(t.propiedadId)],
);

// tabla puente N:M porque un contrato puede tener más de un garante.
export const contratosGarantes = pgTable(
  "contratos_garantes",
  {
    contratoId: uuid("contrato_id")
      .notNull()
      .references(() => contratos.id, { onDelete: "cascade" }),
    personaId: uuid("persona_id")
      .notNull()
      .references(() => personas.id),
  },
  (t) => [primaryKey({ columns: [t.contratoId, t.personaId] })],
);

// Historial de recalculos de alquiler (IPC/ICL). Una fila por período de actualización ya
// aplicado; "último valor vigente" = la fila con fechaVigencia más reciente para el contrato.
export const actualizacionesContrato = pgTable(
  "actualizaciones_contrato",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contratoId: uuid("contrato_id")
      .notNull()
      .references(() => contratos.id, { onDelete: "cascade" }),
    fechaVigencia: date("fecha_vigencia").notNull(),
    valorNuevo: numeric("valor_nuevo", { precision: 12, scale: 2 }).notNull(),
    indiceAplicado: varchar("indice_aplicado", { length: 60 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("actualizaciones_contrato_contrato_fecha_key").on(t.contratoId, t.fechaVigencia)],
);

export const pagos = pgTable(
  "pagos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contratoId: uuid("contrato_id")
      .notNull()
      .references(() => contratos.id, { onDelete: "cascade" }),
    // primer día del mes que representa el período, ej. 2026-07-01 para julio 2026.
    periodo: date("periodo").notNull(),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    fechaVencimiento: date("fecha_vencimiento").notNull(),
    fechaPago: date("fecha_pago"),
    estado: estadoPagoEnum("estado").notNull().default("pendiente"),
    medioPago: varchar("medio_pago", { length: 60 }),
    documentoId: uuid("documento_id").references(() => documentos.id),
    observaciones: text("observaciones"),
    ...timestamps,
  },
  (t) => [index("pagos_periodo_estado_idx").on(t.periodo, t.estado), index("pagos_contrato_idx").on(t.contratoId)],
);

// Reemplaza a las antiguas tablas "seguros" e "impuestos_servicios" (etapas 2/3): un solo lugar
// para cualquier gasto recurrente de la propiedad (expensas, ABL, ARBA, servicios, seguros, etc.)
// en vez de una tabla por rubro — mismo flujo de alta para todo.
export const gastosPropiedad = pgTable(
  "gastos_propiedad",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propiedadId: uuid("propiedad_id")
      .notNull()
      .references(() => propiedades.id, { onDelete: "cascade" }),
    tipo: tipoGastoEnum("tipo").notNull(),
    responsable: responsablePagoEnum("responsable"),
    monto: numeric("monto", { precision: 12, scale: 2 }),
    periodicidad: varchar("periodicidad", { length: 40 }),
    fechaVencimiento: date("fecha_vencimiento").notNull(),
    fechaPago: date("fecha_pago"),
    estado: estadoGastoEnum("estado").notNull().default("pendiente"),
    observaciones: text("observaciones"),
    ...timestamps,
  },
  (t) => [index("gastos_propiedad_fecha_vencimiento_idx").on(t.fechaVencimiento)],
);

export const reparaciones = pgTable("reparaciones", {
  id: uuid("id").defaultRandom().primaryKey(),
  propiedadId: uuid("propiedad_id")
    .notNull()
    .references(() => propiedades.id, { onDelete: "cascade" }),
  proveedorId: uuid("proveedor_id").references(() => proveedores.id),
  fecha: date("fecha").notNull(),
  descripcion: text("descripcion").notNull(),
  costo: numeric("costo", { precision: 12, scale: 2 }),
  comprobanteDocumentoId: uuid("comprobante_documento_id").references(() => documentos.id),
  estado: estadoReparacionEnum("estado").notNull().default("pendiente"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ledger unificado para el módulo de control financiero; se puebla al crear pagos,
// reparaciones, seguros e impuestos/servicios (referenciaTipo + referenciaId apuntan al origen).
export const movimientosFinancieros = pgTable(
  "movimientos_financieros",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propiedadId: uuid("propiedad_id")
      .notNull()
      .references(() => propiedades.id, { onDelete: "cascade" }),
    tipo: tipoMovimientoFinancieroEnum("tipo").notNull(),
    categoria: varchar("categoria", { length: 60 }).notNull(),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    fecha: date("fecha").notNull(),
    referenciaTipo: varchar("referencia_tipo", { length: 40 }),
    referenciaId: uuid("referencia_id"),
    descripcion: text("descripcion"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("movimientos_financieros_propiedad_fecha_idx").on(t.propiedadId, t.fecha)],
);

// fase futura (notificaciones push): persiste qué vencimientos ya se notificaron
// para que un job (pg_cron / Edge Function) no duplique avisos.
export const recordatorios = pgTable("recordatorios", {
  id: uuid("id").defaultRandom().primaryKey(),
  tipo: varchar("tipo", { length: 60 }).notNull(),
  entidadTipo: varchar("entidad_tipo", { length: 40 }).notNull(),
  entidadId: uuid("entidad_id").notNull(),
  fechaEvento: date("fecha_evento").notNull(),
  diasAnticipacion: integer("dias_anticipacion").notNull().default(7),
  estado: estadoRecordatorioEnum("estado").notNull().default("pendiente"),
  mensaje: text("mensaje"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const personasRelations = relations(personas, ({ many }) => ({
  propiedadesEnPropiedad: many(propiedades),
  contratosComoInquilino: many(contratos),
  contratosComoGarante: many(contratosGarantes),
}));

export const proveedoresRelations = relations(proveedores, ({ many }) => ({
  reparaciones: many(reparaciones),
}));

export const propiedadesRelations = relations(propiedades, ({ one, many }) => ({
  propietario: one(personas, { fields: [propiedades.propietarioId], references: [personas.id] }),
  contratos: many(contratos),
  gastos: many(gastosPropiedad),
  reparaciones: many(reparaciones),
  movimientosFinancieros: many(movimientosFinancieros),
}));

export const contratosRelations = relations(contratos, ({ one, many }) => ({
  propiedad: one(propiedades, { fields: [contratos.propiedadId], references: [propiedades.id] }),
  inquilino: one(personas, { fields: [contratos.inquilinoId], references: [personas.id] }),
  garantes: many(contratosGarantes),
  pagos: many(pagos),
  actualizaciones: many(actualizacionesContrato),
}));

export const contratosGarantesRelations = relations(contratosGarantes, ({ one }) => ({
  contrato: one(contratos, { fields: [contratosGarantes.contratoId], references: [contratos.id] }),
  persona: one(personas, { fields: [contratosGarantes.personaId], references: [personas.id] }),
}));

export const actualizacionesContratoRelations = relations(actualizacionesContrato, ({ one }) => ({
  contrato: one(contratos, { fields: [actualizacionesContrato.contratoId], references: [contratos.id] }),
}));

export const pagosRelations = relations(pagos, ({ one }) => ({
  contrato: one(contratos, { fields: [pagos.contratoId], references: [contratos.id] }),
  documento: one(documentos, { fields: [pagos.documentoId], references: [documentos.id] }),
}));

export const gastosPropiedadRelations = relations(gastosPropiedad, ({ one }) => ({
  propiedad: one(propiedades, { fields: [gastosPropiedad.propiedadId], references: [propiedades.id] }),
}));

export const reparacionesRelations = relations(reparaciones, ({ one }) => ({
  propiedad: one(propiedades, { fields: [reparaciones.propiedadId], references: [propiedades.id] }),
  proveedor: one(proveedores, { fields: [reparaciones.proveedorId], references: [proveedores.id] }),
  comprobante: one(documentos, { fields: [reparaciones.comprobanteDocumentoId], references: [documentos.id] }),
}));

export const movimientosFinancierosRelations = relations(movimientosFinancieros, ({ one }) => ({
  propiedad: one(propiedades, { fields: [movimientosFinancieros.propiedadId], references: [propiedades.id] }),
}));
