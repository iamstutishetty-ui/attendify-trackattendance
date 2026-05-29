## Critical bug: class code lookup
Students can't find classes by code because RLS on `classes` only allows SELECT when the user is the teacher or already enrolled. I will add a SECURITY DEFINER function `public.join_class_by_code(code text, roll text)` that:
- Looks up the class by `class_code` bypassing RLS
- Confirms the caller has the `student` role
- Inserts into `class_enrollments` for `auth.uid()` with the given roll number
- Returns the class id/name, or raises a clear error ("Invalid class code" / "Already joined")

The student "Join class" dialog will call this RPC instead of the two-step select+insert. This fixes the "Invalid class code" error for both first-time joins and re-joins.

## 1. Auth (AuthScreen)
- Pre-check username uniqueness in `profiles.user_id_text` before signup; show "Username already taken" toast and abort.
- Keep password validation as-is (Supabase default min 6).

## 2. Theme
- Persist theme to `localStorage` and only change when the user toggles it. (Will check current theme code; if there's no toggle yet, this is a no-op aside from making sure nothing auto-switches.)

## 3. Admin dashboard
- Remove auto-listing of all classes. Replace with an input: admin types a class code → fetches that one class's stats only (via a new server function `getClassByCodeForAdmin` using `supabaseAdmin` + admin role check).
- Remove "All teachers" / "All semesters" filters.
- Accounts section: remove delete buttons for teachers/students. Add "Delete my account" button that calls `deleteAccount({ userId: me })` (server fn updated to allow self-delete for admins only).

## 4. Teacher
- Profile tab: remove "Save full name" button, add "Delete account" button (self-delete via same server fn).
- Classes: add inline rename + delete-class button (RLS already allows teacher delete).
- Class creation: add "Split year into 2 semesters" toggle, with semester number + months pickers (single academic year shared).
- Defaulters: add semester selector + above/below 75% toggle.
- Calendar: remove class selector; working/non-working marks apply to ALL the teacher's classes (loop upsert across every class the teacher owns).
- Class-code fix is shared with student via the new RPC, but teacher-side code display is already correct.

## 5. Student
- Roll number input stays in the Join dialog (already there) — teacher will not set it.
- Join uses the new `join_class_by_code` RPC → fixes invalid-code error.

## Technical notes
- New migration: `join_class_by_code` SECURITY DEFINER function + GRANT EXECUTE to authenticated; allow self-delete in `deleteAccount` server fn for admins; no schema changes to tables.
- All UI changes are surgical to existing components (`AuthScreen.tsx`, `AdminApp.tsx`, `TeacherApp.tsx`, `StudentApp.tsx`, `accounts.functions.ts`).
- I will NOT touch the design system, routing, or auth context beyond what's listed.

Confirm and I'll ship it in one pass.
