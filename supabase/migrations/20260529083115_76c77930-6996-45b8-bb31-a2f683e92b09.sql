CREATE OR REPLACE FUNCTION public.join_class_by_code(_code text, _roll text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT private.has_role(v_uid, 'student'::app_role) THEN
    RAISE EXCEPTION 'Only students can join classes';
  END IF;

  SELECT id INTO v_class_id FROM public.classes
   WHERE upper(class_code) = upper(trim(_code)) AND archived = false
   LIMIT 1;
  IF v_class_id IS NULL THEN RAISE EXCEPTION 'Invalid class code'; END IF;

  IF EXISTS (SELECT 1 FROM public.class_enrollments WHERE class_id = v_class_id AND student_id = v_uid) THEN
    RAISE EXCEPTION 'Already joined';
  END IF;

  INSERT INTO public.class_enrollments (class_id, student_id, roll_number)
  VALUES (v_class_id, v_uid, COALESCE(NULLIF(trim(_roll), ''), ''));

  RETURN v_class_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_class_by_code(text, text) TO authenticated;

-- Admin lookup of one class by code (bypass RLS for admins only)
CREATE OR REPLACE FUNCTION public.admin_get_class_by_code(_code text)
RETURNS TABLE(id uuid, name text, semester text, academic_year text, class_code text, teacher_name text, total_students bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT private.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN QUERY
    SELECT c.id, c.name, c.semester, c.academic_year, c.class_code,
           COALESCE(p.full_name, p.user_id_text, '—'),
           (SELECT count(*) FROM public.class_enrollments e WHERE e.class_id = c.id)
      FROM public.classes c
      LEFT JOIN public.profiles p ON p.id = c.teacher_id
     WHERE upper(c.class_code) = upper(trim(_code))
     LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_class_by_code(text) TO authenticated;