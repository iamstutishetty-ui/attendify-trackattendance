ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_email text;
CREATE INDEX IF NOT EXISTS idx_profiles_recovery_email ON public.profiles (lower(recovery_email));