CREATE TABLE public.admin_saved_classes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_id, class_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_saved_classes TO authenticated;
GRANT ALL ON public.admin_saved_classes TO service_role;
ALTER TABLE public.admin_saved_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_saved_select" ON public.admin_saved_classes FOR SELECT TO authenticated
  USING (admin_id = auth.uid() AND private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_saved_insert" ON public.admin_saved_classes FOR INSERT TO authenticated
  WITH CHECK (admin_id = auth.uid() AND private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_saved_delete" ON public.admin_saved_classes FOR DELETE TO authenticated
  USING (admin_id = auth.uid() AND private.has_role(auth.uid(), 'admin'::app_role));