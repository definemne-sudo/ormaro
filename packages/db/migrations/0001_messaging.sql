CREATE TYPE "public"."offer_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_offer_check";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "offer_status" "offer_status";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_offer_check" CHECK (("messages"."kind" = 'offer') = ("messages"."offer_euro" is not null and "messages"."offer_status" is not null));