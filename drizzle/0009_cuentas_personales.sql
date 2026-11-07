CREATE TABLE IF NOT EXISTS "cuentas_rubros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" varchar(60) NOT NULL,
	"tipo" varchar(10) DEFAULT 'gasto' NOT NULL,
	"previsto" numeric(12, 2),
	"servicio_id" uuid,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cuentas_mes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rubro_id" uuid NOT NULL,
	"periodo" varchar(7) NOT NULL,
	"previsto" numeric(12, 2),
	"real" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cuentas_mes_rubro_periodo_uq" UNIQUE("rubro_id","periodo")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cuentas_mes" ADD CONSTRAINT "cuentas_mes_rubro_id_cuentas_rubros_id_fk" FOREIGN KEY ("rubro_id") REFERENCES "public"."cuentas_rubros"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "cuentas_rubros" ADD CONSTRAINT "cuentas_rubros_servicio_id_servicios_vencimiento_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios_vencimiento"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
