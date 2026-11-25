-- Optional DATA repair. Staging first; do not run until the signup trigger
-- has been repaired and an operator has reviewed the existing user accounts.
-- Does not change existing profile rows, paid plans, or passwords.
BEGIN;
INSERT INTO public.profiles (id,email,full_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name','')
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.id=u.id
WHERE p.id IS NULL AND u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;
COMMIT;
