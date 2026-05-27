
CREATE OR REPLACE FUNCTION public.is_enrolled(_class_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.class_enrollments WHERE class_id = _class_id AND student_id = _user_id)
$$;

DROP POLICY IF EXISTS classes_select ON public.classes;
CREATE POLICY classes_select ON public.classes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR teacher_id = auth.uid()
  OR public.is_enrolled(id, auth.uid())
);

DROP POLICY IF EXISTS enroll_select ON public.class_enrollments;
CREATE POLICY enroll_select ON public.class_enrollments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR student_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_enrollments.class_id AND c.teacher_id = auth.uid())
);
