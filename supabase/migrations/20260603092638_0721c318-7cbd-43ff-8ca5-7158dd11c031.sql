ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_type_check;
ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_type_check
  CHECK (type IN ('holiday','exam','event','working','non_working','college_event'));

DROP POLICY IF EXISTS cal_admin_manage ON public.calendar_events;
CREATE POLICY cal_admin_manage ON public.calendar_events
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;