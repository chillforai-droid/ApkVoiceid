-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Privacy
    contact_requests TEXT DEFAULT 'everyone' CHECK (contact_requests IN ('everyone', 'contacts_of_contacts', 'nobody')),
    calls TEXT DEFAULT 'contacts' CHECK (calls IN ('everyone', 'contacts', 'nobody')),
    voice_messages TEXT DEFAULT 'contacts' CHECK (voice_messages IN ('everyone', 'contacts', 'nobody')),
    
    -- Notifications
    notify_contact_requests BOOLEAN DEFAULT true,
    notify_messages BOOLEAN DEFAULT true,
    notify_calls BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can select own settings" ON public.user_settings;
CREATE POLICY "Users can select own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER on_user_settings_updated
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
