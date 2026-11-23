CREATE TABLE "compliance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"device_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"score" double precision NOT NULL,
	"worker_count" integer NOT NULL,
	"violation_count" integer NOT NULL,
	CONSTRAINT "compliance_metrics_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"device_id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"session_id" uuid NOT NULL,
	"uptime_sec" integer NOT NULL,
	"fps" double precision NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"last_event_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_rules" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"requires_helmet" boolean DEFAULT true NOT NULL,
	"requires_vest" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"device_id" text NOT NULL,
	"camera_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"priority" text NOT NULL,
	"worker_id" integer,
	"confidence" double precision NOT NULL,
	"compliance_score" double precision NOT NULL,
	"frame_width" integer NOT NULL,
	"frame_height" integer NOT NULL,
	"detections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_path" text,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"agent_briefing" text,
	CONSTRAINT "violations_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE INDEX "compliance_metrics_time_idx" ON "compliance_metrics" USING btree ("time");--> statement-breakpoint
CREATE INDEX "violations_timestamp_idx" ON "violations" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "violations_priority_idx" ON "violations" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "violations_ack_idx" ON "violations" USING btree ("acknowledged","timestamp");