CREATE TYPE "public"."estado_contrato" AS ENUM('vigente', 'finalizado', 'rescindido');--> statement-breakpoint
CREATE TYPE "public"."estado_pago" AS ENUM('pendiente', 'pagado', 'atrasado', 'parcial');--> statement-breakpoint
CREATE TYPE "public"."estado_recordatorio" AS ENUM('pendiente', 'notificado', 'resuelto');--> statement-breakpoint
CREATE TYPE "public"."estado_reparacion" AS ENUM('pendiente', 'en_curso', 'completada');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('contrato', 'poliza', 'recibo', 'factura', 'comprobante', 'foto', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_impuesto_servicio" AS ENUM('ABL', 'ARBA', 'luz', 'gas', 'agua', 'expensas', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento_financiero" AS ENUM('ingreso', 'gasto');--> statement-breakpoint
CREATE TABLE "actualizaciones_contrato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contrato_id" uuid NOT NULL,
	"fecha_vigencia" date NOT NULL,
	"valor_nuevo" numeric(12, 2) NOT NULL,
	"indice_aplicado" varchar(60),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contratos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"propiedad_id" uuid NOT NULL,
	"inquilino_id" uuid NOT NULL,
	"fecha_inicio" date NOT NULL,
	"fecha_fin" date NOT NULL,
	"valor_alquiler_inicial" numeric(12, 2) NOT NULL,
	"indice_actualizacion" varchar(60),
	"dia_vencimiento_pago" integer DEFAULT 10 NOT NULL,
	"deposito" numeric(12, 2),
	"estado" "estado_contrato" DEFAULT 'vigente' NOT NULL,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contratos_garantes" (
	"contrato_id" uuid NOT NULL,
	"persona_id" uuid NOT NULL,
	CONSTRAINT "contratos_garantes_contrato_id_persona_id_pk" PRIMARY KEY("contrato_id","persona_id")
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entidad_tipo" varchar(40) NOT NULL,
	"entidad_id" uuid NOT NULL,
	"tipo_documento" "tipo_documento" NOT NULL,
	"storage_path" text NOT NULL,
	"nombre_archivo" text NOT NULL,
	"mime_type" varchar(120),
	"tamano_bytes" integer,
	"subido_en" timestamp with time zone DEFAULT now() NOT NULL,
	"notas" text
);
--> statement-breakpoint
CREATE TABLE "impuestos_servicios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"propiedad_id" uuid NOT NULL,
	"tipo" "tipo_impuesto_servicio" NOT NULL,
	"numero_cuenta" varchar(80),
	"fecha_vencimiento" date NOT NULL,
	"periodicidad" varchar(40),
	"monto_estimado" numeric(12, 2),
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos_financieros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"propiedad_id" uuid NOT NULL,
	"tipo" "tipo_movimiento_financiero" NOT NULL,
	"categoria" varchar(60) NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"fecha" date NOT NULL,
	"referencia_tipo" varchar(40),
	"referencia_id" uuid,
	"descripcion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contrato_id" uuid NOT NULL,
	"periodo" date NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"fecha_vencimiento" date NOT NULL,
	"fecha_pago" date,
	"estado" "estado_pago" DEFAULT 'pendiente' NOT NULL,
	"medio_pago" varchar(60),
	"documento_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre_completo" text NOT NULL,
	"dni" varchar(20),
	"telefono" varchar(40),
	"email" varchar(255),
	"direccion" text,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propiedades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direccion" text NOT NULL,
	"zona" varchar(120),
	"propietario_id" uuid NOT NULL,
	"tipo" varchar(60),
	"medidores" jsonb,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proveedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"categoria" varchar(60) NOT NULL,
	"telefono" varchar(40),
	"zona" varchar(120),
	"horarios" text,
	"confianza" integer,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recordatorios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" varchar(60) NOT NULL,
	"entidad_tipo" varchar(40) NOT NULL,
	"entidad_id" uuid NOT NULL,
	"fecha_evento" date NOT NULL,
	"dias_anticipacion" integer DEFAULT 7 NOT NULL,
	"estado" "estado_recordatorio" DEFAULT 'pendiente' NOT NULL,
	"mensaje" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reparaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"propiedad_id" uuid NOT NULL,
	"proveedor_id" uuid,
	"fecha" date NOT NULL,
	"descripcion" text NOT NULL,
	"costo" numeric(12, 2),
	"comprobante_documento_id" uuid,
	"estado" "estado_reparacion" DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seguros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"propiedad_id" uuid NOT NULL,
	"compania" text NOT NULL,
	"numero_poliza" varchar(80),
	"fecha_inicio" date NOT NULL,
	"fecha_vencimiento" date NOT NULL,
	"costo" numeric(12, 2),
	"documento_id" uuid,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actualizaciones_contrato" ADD CONSTRAINT "actualizaciones_contrato_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_inquilino_id_personas_id_fk" FOREIGN KEY ("inquilino_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos_garantes" ADD CONSTRAINT "contratos_garantes_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos_garantes" ADD CONSTRAINT "contratos_garantes_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impuestos_servicios" ADD CONSTRAINT "impuestos_servicios_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_propietario_id_personas_id_fk" FOREIGN KEY ("propietario_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparaciones" ADD CONSTRAINT "reparaciones_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparaciones" ADD CONSTRAINT "reparaciones_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparaciones" ADD CONSTRAINT "reparaciones_comprobante_documento_id_documentos_id_fk" FOREIGN KEY ("comprobante_documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguros" ADD CONSTRAINT "seguros_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguros" ADD CONSTRAINT "seguros_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contratos_fecha_fin_idx" ON "contratos" USING btree ("fecha_fin");--> statement-breakpoint
CREATE INDEX "contratos_propiedad_idx" ON "contratos" USING btree ("propiedad_id");--> statement-breakpoint
CREATE INDEX "documentos_entidad_idx" ON "documentos" USING btree ("entidad_tipo","entidad_id");--> statement-breakpoint
CREATE INDEX "impuestos_servicios_fecha_vencimiento_idx" ON "impuestos_servicios" USING btree ("fecha_vencimiento");--> statement-breakpoint
CREATE INDEX "movimientos_financieros_propiedad_fecha_idx" ON "movimientos_financieros" USING btree ("propiedad_id","fecha");--> statement-breakpoint
CREATE INDEX "pagos_periodo_estado_idx" ON "pagos" USING btree ("periodo","estado");--> statement-breakpoint
CREATE INDEX "pagos_contrato_idx" ON "pagos" USING btree ("contrato_id");--> statement-breakpoint
CREATE INDEX "seguros_fecha_vencimiento_idx" ON "seguros" USING btree ("fecha_vencimiento");