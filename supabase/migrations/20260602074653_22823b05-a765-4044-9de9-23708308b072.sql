ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS months text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS semester_secondary text,
  ADD COLUMN IF NOT EXISTS months_secondary text[],
  ADD COLUMN IF NOT EXISTS current_phase smallint NOT NULL DEFAULT 1;