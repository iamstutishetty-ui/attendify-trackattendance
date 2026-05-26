
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_text TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Classes
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  semester TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  class_code TEXT NOT NULL UNIQUE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Class enrollments
CREATE TABLE public.class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roll_number TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);

-- Attendance records
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent')),
  marked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id, date)
);
CREATE INDEX idx_attendance_class_date ON public.attendance_records(class_id, date);
CREATE INDEX idx_attendance_student ON public.attendance_records(student_id);

-- Calendar events
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('holiday','exam','event','working')),
  title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_calendar_class ON public.calendar_events(class_id, date);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- profiles: all authenticated can read (to display names); user can update own
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles: user reads own; admin reads all; insert self only for student/teacher at signup, admins can manage
CREATE POLICY "user_roles_select_self" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_insert_self" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- classes: admin all read; teacher owns; student read if enrolled
CREATE POLICY "classes_select" ON public.classes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR teacher_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.class_enrollments e WHERE e.class_id = classes.id AND e.student_id = auth.uid())
  );
CREATE POLICY "classes_teacher_insert" ON public.classes FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(),'teacher'));
CREATE POLICY "classes_teacher_update" ON public.classes FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "classes_teacher_delete" ON public.classes FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- enrollments: admin all; teacher of class; student own
CREATE POLICY "enroll_select" ON public.class_enrollments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_enrollments.class_id AND c.teacher_id = auth.uid())
  );
CREATE POLICY "enroll_student_insert" ON public.class_enrollments FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND public.has_role(auth.uid(),'student'));
CREATE POLICY "enroll_teacher_manage" ON public.class_enrollments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_enrollments.class_id AND c.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_enrollments.class_id AND c.teacher_id = auth.uid()));

-- attendance: admin read; teacher of class CRUD; student read own
CREATE POLICY "att_select" ON public.attendance_records FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = attendance_records.class_id AND c.teacher_id = auth.uid())
  );
CREATE POLICY "att_teacher_write" ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = attendance_records.class_id AND c.teacher_id = auth.uid()));
CREATE POLICY "att_teacher_update" ON public.attendance_records FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = attendance_records.class_id AND c.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = attendance_records.class_id AND c.teacher_id = auth.uid()));
CREATE POLICY "att_teacher_delete" ON public.attendance_records FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = attendance_records.class_id AND c.teacher_id = auth.uid()));

-- calendar: teacher of class CRUD; students of class read; admin read
CREATE POLICY "cal_select" ON public.calendar_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = calendar_events.class_id AND c.teacher_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.class_enrollments e WHERE e.class_id = calendar_events.class_id AND e.student_id = auth.uid())
  );
CREATE POLICY "cal_teacher_manage" ON public.calendar_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = calendar_events.class_id AND c.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = calendar_events.class_id AND c.teacher_id = auth.uid()));

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER att_touch BEFORE UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_enrollments;
