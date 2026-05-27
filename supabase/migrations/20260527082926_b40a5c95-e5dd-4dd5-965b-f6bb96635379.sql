CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.is_enrolled(_class_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_enrollments WHERE class_id = _class_id AND student_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_enrolled(uuid, uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS user_roles_select_self ON public.user_roles;
CREATE POLICY user_roles_select_self ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_admin_all ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS classes_select ON public.classes;
CREATE POLICY classes_select ON public.classes FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR teacher_id = auth.uid() OR private.is_enrolled(id, auth.uid()));

DROP POLICY IF EXISTS classes_teacher_insert ON public.classes;
CREATE POLICY classes_teacher_insert ON public.classes FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND private.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS enroll_select ON public.class_enrollments;
CREATE POLICY enroll_select ON public.class_enrollments FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin')
    OR student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_enrollments.class_id AND c.teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS enroll_student_insert ON public.class_enrollments;
CREATE POLICY enroll_student_insert ON public.class_enrollments FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND private.has_role(auth.uid(), 'student'));

DROP POLICY IF EXISTS att_select ON public.attendance_records;
CREATE POLICY att_select ON public.attendance_records FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin')
    OR student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = attendance_records.class_id AND c.teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS cal_select ON public.calendar_events;
CREATE POLICY cal_select ON public.calendar_events FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = calendar_events.class_id AND c.teacher_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.class_enrollments e WHERE e.class_id = calendar_events.class_id AND e.student_id = auth.uid())
  );

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_enrolled(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_my_role();