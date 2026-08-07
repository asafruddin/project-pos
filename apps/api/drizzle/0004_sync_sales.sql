ALTER TABLE "sales"
  ADD COLUMN "device_id" text NOT NULL DEFAULT 'legacy',
  ADD COLUMN "payment" jsonb NOT NULL DEFAULT '{"method":"cash","amount_minor":0}'::jsonb,
  ADD COLUMN "lines" jsonb NOT NULL DEFAULT '[]'::jsonb;
