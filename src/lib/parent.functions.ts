import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMAIL_DOMAIN = "attendify.app";

function randId(len = 6): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, len);
}
function randPassword(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, 10);
  return b64 + "@1";
}

// Called by a signed-in student right after their signup to auto-create a linked parent account.
export const createParentForStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ studentFullName: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const studentId = context.userId;

    // Idempotent: return existing link if any.
    const { data: existing } = await supabaseAdmin
      .from("student_parents").select("parent_user_id_text, parent_password_plain")
      .eq("student_id", studentId).maybeSingle();
    if (existing) {
      return { parentId: existing.parent_user_id_text, parentPassword: existing.parent_password_plain };
    }

    // Generate a unique parent ID
    let parentIdText = `parent_${randId(8)}`;
    for (let i = 0; i < 8; i++) {
      const { data: dup } = await supabaseAdmin.from("profiles").select("id").eq("user_id_text", parentIdText).maybeSingle();
      if (!dup) break;
      parentIdText = `parent_${randId(8)}`;
    }
    const parentPassword = randPassword();
    const parentEmail = `${parentIdText}@${EMAIL_DOMAIN}`.toLowerCase();

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: parentEmail,
      password: parentPassword,
      email_confirm: true,
      user_metadata: { user_id_text: parentIdText, full_name: `Parent of ${data.studentFullName}` },
    });
    if (cErr || !created.user) throw new Error(cErr?.message || "Could not create parent account");
    const parentAuthId = created.user.id;

    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: parentAuthId,
      user_id_text: parentIdText,
      full_name: `Parent of ${data.studentFullName}`,
    });
    if (pErr) throw new Error(pErr.message);

    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: parentAuthId, role: "parent" });
    if (rErr) throw new Error(rErr.message);

    const { error: lErr } = await supabaseAdmin.from("student_parents").insert({
      student_id: studentId,
      parent_id: parentAuthId,
      parent_user_id_text: parentIdText,
      parent_password_plain: parentPassword,
    });
    if (lErr) throw new Error(lErr.message);

    return { parentId: parentIdText, parentPassword };
  });

// Read the parent credentials for the current signed-in student.
export const getMyParentCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("student_parents")
      .select("parent_user_id_text, parent_password_plain")
      .eq("student_id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { parentId: data.parent_user_id_text, parentPassword: data.parent_password_plain };
  });

// Look up the linked student id for the current signed-in parent.
export const getMyLinkedStudent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("student_parents")
      .select("student_id")
      .eq("parent_id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.student_id ?? null;
  });
