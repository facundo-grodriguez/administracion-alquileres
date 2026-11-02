CREATE TABLE IF NOT EXISTS "servicios_vencimiento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" varchar(80) NOT NULL,
	"propiedad_id" uuid,
	"dia_vencimiento" integer NOT NULL,
	"monto" numeric(12, 2),
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "servicios_vencimiento_mes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"servicio_id" uuid NOT NULL,
	"periodo" varchar(7) NOT NULL,
	"fecha_vencimiento" date,
	"fecha_pago" date,
	"monto" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servicios_vencimiento_mes_servicio_periodo_uq" UNIQUE("servicio_id","periodo")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "servicios_vencimiento" ADD CONSTRAINT "servicios_vencimiento_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "servicios_vencimiento_mes" ADD CONSTRAINT "servicios_vencimiento_mes_servicio_id_servicios_vencimiento_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios_vencimiento"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
