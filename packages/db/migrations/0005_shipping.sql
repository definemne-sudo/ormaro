CREATE TYPE "public"."shipment_status" AS ENUM('requested', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shipping_option" AS ENUM('none', 'buyer', 'seller');--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"amount_euro" integer NOT NULL,
	"shipping_payer" "shipping_option" NOT NULL,
	"recipient_name" text NOT NULL,
	"phone" text NOT NULL,
	"city_key" text NOT NULL,
	"address" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" "shipment_status" DEFAULT 'requested' NOT NULL,
	"courier_key" text,
	"courier_name" text,
	"tracking_number" text,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_amount_check" CHECK ("shipments"."amount_euro" >= 0)
);
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "shipping" "shipping_option" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_city_key_cities_key_fk" FOREIGN KEY ("city_key") REFERENCES "public"."cities"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipments_conversation_idx" ON "shipments" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "shipments_buyer_idx" ON "shipments" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "shipments_seller_idx" ON "shipments" USING btree ("seller_id");