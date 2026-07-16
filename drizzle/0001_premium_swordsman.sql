CREATE TYPE "public"."responsable_pago" AS ENUM('propietario', 'inquilino');--> statement-breakpoint
ALTER TYPE "public"."tipo_documento" ADD VALUE 'inventario' BEFORE 'otro';--> statement-breakpoint
ALTER TYPE "public"."tipo_impuesto_servicio" ADD VALUE 'internet' BEFORE 'otro';--> statement-breakpoint
ALTER TABLE "impuestos_servicios" ADD COLUMN "responsable" "responsable_pago";--> statement-breakpoint
ALTER TABLE "propiedades" ADD COLUMN "carpeta_drive_url" text;