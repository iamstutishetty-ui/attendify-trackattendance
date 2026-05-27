import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "teacher" | "student";

export interface Profile {
  id: string;
  user_id_text: string;
  full_name: string;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = React.createContext<AuthCtx | null>(null);

// Map an Instagram-style ID to a synthetic email Supabase will accept.
export const idToEmail = (userIdText: string) =>
  `${userIdText.trim().toLowerCase()}@attendify.app`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [role, setRole] = React.useState<AppRole | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadProfile = React.useCallback(async (uid: string) => {
    const [{ data: prof }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("id,user_id_text,full_name").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
    ]);
    setProfile(prof ?? null);
    setRole((roleRow?.role as AppRole) ?? null);
    return { profile: prof ?? null, role: (roleRow?.role as AppRole) ?? null };
  }, []);

  React.useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setLoading(true);
        setTimeout(() => { loadProfile(s.user.id).finally(() => setLoading(false)); }, 0);
      } else {
        setProfile(null);
        setRole(null);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const currentUser = currentSession?.user ?? user;
    setSession(currentSession ?? null);
    setUser(currentUser ?? null);
    if (currentUser) await loadProfile(currentUser.id);
    else { setProfile(null); setRole(null); }
    setLoading(false);
  }, [user, loadProfile]);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <Ctx.Provider value={{ user, session, profile, role, loading, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
