CREATE TYPE "public"."estado_gasto" AS ENUM('pendiente', 'pagado');--> statement-breakpoint
CREATE TYPE "public"."frecuencia_actualizacion" AS ENUM('mensual', 'trimestral', 'semestral', 'anual');--> statement-breakpoint
CREATE TYPE "public"."indice_actualizacion" AS ENUM('IPC', 'ICL');--> statement-breakpoint
CREATE TYPE "public"."tipo_gasto" AS ENUM('expensas', 'ABL', 'ARBA', 'luz', 'gas', 'agua', 'internet', 'seguro_hogar', 'seguro_incendio', 'otro');--> statement-breakpoint
CREATE TABLE "gastos_propiedad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"propiedad_id" uuid NOT NULL,
	"tipo" "tipo_gasto" NOT NULL,
	"responsable" "responsable_pago",
	"monto" numeric(12, 2),
	"periodicidad" varchar(40),
	"fecha_vencimiento" date NOT NULL,
	"fecha_pago" date,
	"estado" "estado_gasto" DEFAULT 'pendiente' NOT NULL,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "impuestos_servicios_fecha_vencimiento_idx";--> statement-breakpoint
DROP INDEX "seguros_fecha_vencimiento_idx";--> statement-breakpoint
ALTER TABLE "contratos" ALTER COLUMN "indice_actualizacion" SET DATA TYPE "public"."indice_actualizacion" USING "indice_actualizacion"::"public"."indice_actualizacion";--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "frecuencia_actualizacion" "frecuencia_actualizacion";--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "finaer_activo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "finaer_numero_poliza" varchar(80);--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "finaer_fecha_inicio" date;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "finaer_fecha_vencimiento" date;--> statement-breakpoint
ALTER TABLE "contratos" ADD COLUMN "finaer_observaciones" text;--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "observaciones" text;--> statement-breakpoint
ALTER TABLE "gastos_propiedad" ADD CONSTRAINT "gastos_propiedad_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gastos_propiedad_fecha_vencimiento_idx" ON "gastos_propiedad" USING btree ("fecha_vencimiento");--> statement-breakpoint
ALTER TABLE "actualizaciones_contrato" ADD CONSTRAINT "actualizaciones_contrato_contrato_fecha_key" UNIQUE("contrato_id","fecha_vigencia");