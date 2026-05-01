CREATE TABLE IF NOT EXISTS "ai_followup_turns" (
	"id" serial PRIMARY KEY NOT NULL,
	"block_id" integer NOT NULL,
	"parent_response_id" integer NOT NULL,
	"participant_session_id" integer NOT NULL,
	"turn_number" integer NOT NULL,
	"ai_question" text NOT NULL,
	"participant_answer" text,
	"status" varchar(16) DEFAULT 'answered' NOT NULL,
	"provider" varchar(16),
	"model" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_followup_turns" ADD CONSTRAINT "ai_followup_turns_block_id_session_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."session_blocks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_followup_turns" ADD CONSTRAINT "ai_followup_turns_parent_response_id_block_responses_id_fk" FOREIGN KEY ("parent_response_id") REFERENCES "public"."block_responses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_followup_turns" ADD CONSTRAINT "ai_followup_turns_participant_session_id_participant_sessions_id_fk" FOREIGN KEY ("participant_session_id") REFERENCES "public"."participant_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_followup_turns_parent_turn_idx" ON "ai_followup_turns" ("parent_response_id","turn_number");
