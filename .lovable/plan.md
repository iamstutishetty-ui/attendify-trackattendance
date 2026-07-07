# Mhatre College App — Full Restructure

Large change. Attendance internals stay untouched. Below is the complete plan; approve to implement in one pass.

## 1. Splash & Theme
- Replace `SplashScreen.tsx` with the provided "Mhatre College App" markup (Alfa Slab One via `<link>` in `__root.tsx` head — never `@import` in Tailwind v4 CSS).
- Set primary token in `src/styles.css` to Rosewood `#A65D57`; matching ring/accent shades. All buttons, gradients, gate icon inherit.

## 2. College Code Gate
- Hard-code `COLLEGE_CODE = "mhatrecollege@badlapur2000"`. Verified flag cached in `localStorage`.

## 3. Role Picker (new screen after gate, before login)
- 4 cards: Admin, Teacher, Parent, Student. Choice stored in `sessionStorage`.

## 4. Login screens
- **Admin / Parent** → new `SimpleLoginScreen`: ID, Password, Forgot Password (reuses existing `resetPasswordWithRecovery`).
- **Teacher / Student** → existing `AuthScreen` (Login + Create Account), signup forced to picked role.
- Admin account **mhatre@admin123 / mhatre2000admin@** seeded via migration (auth.users + profile + `admin` role).

## 5. Roles & unique IDs
- Add `'parent'` to `app_role` enum. `profiles.user_id_text` already unique → globally unique across all roles.

## 6. Parent auto-creation on student signup
- New table `student_parents { student_id PK, parent_id, parent_password_plain }`.
- New server fn `createParentForStudent` (loads `supabaseAdmin` inside handler):
  - Generates unique ID `parent_<8hex>`, strong password.
  - Creates auth user, profile, `parent` role, `student_parents` row.
- Called at end of student signup flow.
- Student's Settings shows a "Parent Account" block: Parent ID + Password (with copy).

## 7. Class-code split (Admin generates both)
- Add `classes.teacher_class_code` and `classes.student_class_code` (both unique, auto-generated on insert). Keep `class_code` for compatibility (mirrors teacher code).
- Update `join_class_by_code` → matches on `student_class_code`.
- Add `teacher_join_class_by_code` → matches on `teacher_class_code`, assigns teacher to `classes.teacher_id` (or a join table if class already has teacher).

## 8. Colleges (new)
- New table `colleges { id, admin_id, name, photo_url }` + `classes.college_id` FK. RLS: admin owns own colleges; teachers/students/parents read colleges they are linked to via class. GRANTs included.
- Storage bucket `college-photos` (public read) for optional photo.

## 9. Admin dashboard
Feature list (rectangular cards, top→bottom):
1. College Management (functional)
2. Notice · 3. Student Attendance (functional) · 4. Timetable · 5. Assignments · 6. Results · 7. Study Material · 8. Fees — others show ComingSoon.

**College Management**: list colleges (create with name + optional photo, delete with confirm). Open college → list classes with fields (Name, Division, Year), actions: Edit, Promote (Year → next), Delete (confirm). Each class card shows Teacher Code + Student Code with copy buttons.

## 10. Teacher / Student / Parent dashboards
- **Teacher**: Notice, Student Attendance (functional), Timetable, Assignments, Results, Study Material.
- **Student**: Notice, Student Attendance (functional), Timetable, Assignments, Results, Study Material, Fees.
- **Parent**: same list as Student. Read-only. Resolves linked `student_id` via `student_parents`, then renders `StudentApp` in a read-only mode (no mark/edit buttons rendered).

## 11. Header on every dashboard
- Top-left: Light/Dark theme toggle icon.
- Top-right: Settings gear → Sheet with User Name, User ID, Logout, Delete Account (confirm dialog → `deleteMyAccount`). Student's sheet also shows Parent Account section.

## 12. Attendance
- Untouched functionally. Remove the "Attendance Code" join UI; students join via Student Class Code (existing RPC swap in step 7). Teachers join via Teacher Class Code from a new dialog.

## 13. Files touched
- **New**: `RolePicker.tsx`, `SimpleLoginScreen.tsx`, `admin/CollegeManagement.tsx`, `parent/ParentApp.tsx`, `lib/parent.functions.ts`, `lib/colleges.functions.ts`, migration.
- **Edited**: `SplashScreen.tsx`, `styles.css`, `routes/__root.tsx`, `CollegeCodeGate.tsx`, `routes/index.tsx`, `CollegeApp.tsx`, `AuthScreen.tsx`, `admin/AdminApp.tsx`, teacher/student join dialogs.

Approve and I will execute the migration first (adds `parent` role, `colleges`, `student_parents`, code split, seeds Admin), then ship the code.
