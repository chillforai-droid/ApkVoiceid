-- Add RLS policy for inserting profiles
CREATE POLICY "Users can insert own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
