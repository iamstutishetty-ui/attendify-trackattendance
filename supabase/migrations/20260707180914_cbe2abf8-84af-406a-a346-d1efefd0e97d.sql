
-- 1. Parent role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';

-- 2. Student ↔ Parent link
CREATE TABLE IF NOT EXISTS public.student_parents (
  student_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_user_id_text text NOT NULL,
  parent_password_plain text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.student_parents TO authenticated;
GRANT ALL ON public.student_parents TO service_role;
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Student or parent reads link" ON public.student_parents;
CREATE POLICY "Student or parent reads link" ON public.student_parents
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR parent_id = auth.uid());

-- 3. Colleges (table + owner policy only; member-read policy after classes.college_id exists)
CREATE TABLE IF NOT EXISTS public.colleges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.colleges TO authenticated;
GRANT ALL ON public.colleges TO service_role;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage own colleges" ON public.colleges;
CREATE POLICY "Admins manage own colleges" ON public.colleges
  FOR ALL TO authenticated
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

DROP TRIGGER IF EXISTS colleges_touch ON public.colleges;
CREATE TRIGGER colleges_touch BEFORE UPDATE ON public.colleges
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Extend classes (adds college_id, teacher/student codes, division, year)
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS college_id uuid REFERENCES public.colleges(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS teacher_class_code text,
  ADD COLUMN IF NOT EXISTS student_class_code text,
  ADD COLUMN IF NOT EXISTS division text,
  ADD COLUMN IF NOT EXISTS year text;

UPDATE public.classes
   SET teacher_class_code = COALESCE(teacher_class_code, class_code, 'T' || upper(substr(md5(random()::text || id::text), 1, 7)))
 WHERE teacher_class_code IS NULL;

UPDATE public.classes
   SET student_class_code = 'S' || upper(substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 7))
 WHERE student_class_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS classes_teacher_class_code_key ON public.classes (teacher_class_code) WHERE teacher_class_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS classes_student_class_code_key ON public.classes (student_class_code) WHERE student_class_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_class_codes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.teacher_class_code IS NULL OR NEW.teacher_class_code = '' THEN
    LOOP
      NEW.teacher_class_code := 'T' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.classes WHERE teacher_class_code = NEW.teacher_class_code);
    END LOOP;
  END IF;
  IF NEW.student_class_code IS NULL OR NEW.student_class_code = '' THEN
    LOOP
      NEW.student_class_code := 'S' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.classes WHERE student_class_code = NEW.student_class_code)
            AND NEW.student_class_code <> NEW.teacher_class_code;
    END LOOP;
  END IF;
  IF NEW.class_code IS NULL OR NEW.class_code = '' THEN
    NEW.class_code := NEW.teacher_class_code;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS classes_set_codes ON public.classes;
CREATE TRIGGER classes_set_codes BEFORE INSERT ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.set_class_codes();

-- 5. Now the member-read policy on colleges (references classes.college_id)
DROP POLICY IF EXISTS "Members can read college" ON public.colleges;
CREATE POLICY "Members can read college" ON public.colleges
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      LEFT JOIN public.class_enrollments e ON e.class_id = c.id
      LEFT JOIN public.student_parents sp ON sp.student_id = e.student_id
      WHERE c.college_id = colleges.id
        AND (c.teacher_id = auth.uid() OR e.student_id = auth.uid() OR sp.parent_id = auth.uid())
    )
  );

-- 6. Join RPCs
CREATE OR REPLACE FUNCTION public.join_class_by_code(_code text, _roll text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_class_id uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO v_class_id FROM public.classes
   WHERE upper(student_class_code) = upper(trim(_code)) AND archived = false LIMIT 1;
  IF v_class_id IS NULL THEN
    SELECT id INTO v_class_id FROM public.classes
     WHERE upper(class_code) = upper(trim(_code)) AND archived = false LIMIT 1;
  END IF;
  IF v_class_id IS NULL THEN RAISE EXCEPTION 'Invalid class code'; END IF;
  IF EXISTS (SELECT 1 FROM public.class_enrollments WHERE class_id = v_class_id AND student_id = v_uid) THEN
    RAISE EXCEPTION 'Already joined';
  END IF;
  INSERT INTO public.class_enrollments (class_id, student_id, roll_number)
  VALUES (v_class_id, v_uid, COALESCE(NULLIF(trim(_roll), ''), ''));
  RETURN v_class_id;
END $$;

CREATE OR REPLACE FUNCTION public.teacher_join_class_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_class_id uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO v_class_id FROM public.classes
   WHERE upper(teacher_class_code) = upper(trim(_code)) AND archived = false LIMIT 1;
  IF v_class_id IS NULL THEN RAISE EXCEPTION 'Invalid teacher class code'; END IF;
  UPDATE public.classes SET teacher_id = v_uid WHERE id = v_class_id;
  RETURN v_class_id;
END $$;

-- 7. Parent read-through policies
DROP POLICY IF EXISTS "Parent reads child attendance" ON public.attendance_records;
CREATE POLICY "Parent reads child attendance" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_parents sp
                 WHERE sp.parent_id = auth.uid() AND sp.student_id = attendance_records.student_id));

DROP POLICY IF EXISTS "Parent reads child enrollments" ON public.class_enrollments;
CREATE POLICY "Parent reads child enrollments" ON public.class_enrollments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_parents sp
                 WHERE sp.parent_id = auth.uid() AND sp.student_id = class_enrollments.student_id));

DROP POLICY IF EXISTS "Parent reads child classes" ON public.classes;
CREATE POLICY "Parent reads child classes" ON public.classes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_enrollments e
                 JOIN public.student_parents sp ON sp.student_id = e.student_id
                 WHERE sp.parent_id = auth.uid() AND e.class_id = classes.id));

DROP POLICY IF EXISTS "Parent reads child calendar" ON public.calendar_events;
CREATE POLICY "Parent reads child calendar" ON public.calendar_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_enrollments e
                 JOIN public.student_parents sp ON sp.student_id = e.student_id
                 WHERE sp.parent_id = auth.uid() AND e.class_id = calendar_events.class_id));

-- 8. Seed Mhatre admin (id: mhatre@admin123 / pw: mhatre2000admin@)
DO $$
DECLARE v_uid uuid; v_email text := 'mhatre-admin123@attendify.app';
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_email, crypt('mhatre2000admin@', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"user_id_text":"mhatre@admin123","full_name":"Mhatre Admin"}'::jsonb,
      '', '', '', ''
    );
    INSERT INTO public.profiles (id, user_id_text, full_name)
    VALUES (v_uid, 'mhatre@admin123', 'Mhatre Admin')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
