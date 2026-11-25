CREATE TABLE IF NOT EXISTS compliance_metrics (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	event_id uuid NOT NULL,
	time timestamp with time zone NOT NULL,
	received_at timestamp with time zone DEFAULT now() NOT NULL,
	source text NOT NULL,
	device_id text NOT NULL,
	session_id uuid NOT NULL,
	score double precision NOT NULL,
	worker_count integer NOT NULL,
	violation_count integer NOT NULL,
	CONSTRAINT compliance_metrics_event_id_unique UNIQUE (event_id)
);

CREATE TABLE IF NOT EXISTS devices (
	device_id text PRIMARY KEY NOT NULL,
	status text NOT NULL,
	source text NOT NULL,
	session_id uuid NOT NULL,
	uptime_sec integer NOT NULL,
	fps double precision NOT NULL,
	last_seen timestamp with time zone NOT NULL,
	last_event_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS site_rules (
	id integer PRIMARY KEY DEFAULT 1 NOT NULL,
	requires_helmet boolean DEFAULT true NOT NULL,
	requires_vest boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS violations (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	event_id uuid NOT NULL,
	timestamp timestamp with time zone NOT NULL,
	received_at timestamp with time zone DEFAULT now() NOT NULL,
	source text NOT NULL,
	device_id text NOT NULL,
	camera_id text NOT NULL,
	session_id uuid NOT NULL,
	event_type text NOT NULL,
	priority text NOT NULL,
	worker_id integer,
	confidence double precision NOT NULL,
	compliance_score double precision NOT NULL,
	frame_width integer NOT NULL,
	frame_height integer NOT NULL,
	detections jsonb DEFAULT '[]'::jsonb NOT NULL,
	image_path text,
	acknowledged boolean DEFAULT false NOT NULL,
	acknowledged_at timestamp with time zone,
	agent_briefing text,
	CONSTRAINT violations_event_id_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS compliance_metrics_time_idx ON compliance_metrics (time);
CREATE INDEX IF NOT EXISTS violations_timestamp_idx ON violations (timestamp);
CREATE INDEX IF NOT EXISTS violations_priority_idx ON violations (priority);
CREATE INDEX IF NOT EXISTS violations_ack_idx ON violations (acknowledged, timestamp);

INSERT INTO site_rules (id, requires_helmet, requires_vest)
VALUES (1, true, true)
ON CONFLICT (id) DO NOTHING;
