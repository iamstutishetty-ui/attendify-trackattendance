import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Self-delete: any authenticated user can delete their own account.
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Kept for backwards compatibility — admins may delete only themselves via this path.
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.userId !== context.userId) {
      throw new Error("You can only delete your own account.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Reset password using the recovery email registered at signup.
// User provides their username (ID) and recovery email; if they match, password is reset.
export const resetPasswordWithRecovery = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      userIdText: z.string().min(1).max(64),
      recoveryEmail: z.string().email(),
      newPassword: z.string().min(1).max(128),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const uid = data.userIdText.trim().toLowerCase();
    const email = data.recoveryEmail.trim().toLowerCase();
    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, recovery_email")
      .eq("user_id_text", uid)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prof) throw new Error("No account found with that ID");
    if (!prof.recovery_email || prof.recovery_email.toLowerCase() !== email) {
      throw new Error("Recovery email does not match our records");
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(prof.id, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
