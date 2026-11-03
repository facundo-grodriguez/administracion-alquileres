ALTER TABLE "servicios_vencimiento_mes" ADD COLUMN IF NOT EXISTS "gasto_id" uuid;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "servicios_vencimiento_mes" ADD CONSTRAINT "servicios_vencimiento_mes_gasto_id_gastos_propiedad_id_fk" FOREIGN KEY ("gasto_id") REFERENCES "public"."gastos_propiedad"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
