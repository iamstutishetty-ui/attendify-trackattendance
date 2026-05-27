ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_type_check;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_type_check
  CHECK (type IN ('holiday','exam','event','working','non_working'));

CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_class_date_key
  ON public.calendar_events(class_id, date);