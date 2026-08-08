-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ==========================================
-- 1. PROFILES & IDENTITY
-- ==========================================

CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    display_name TEXT,
    username TEXT UNIQUE NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    country TEXT,
    language TEXT,
    timezone TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_business BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.username_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. COMMUNICATION (MESSAGES & CONVERSATIONS)
-- ==========================================

CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_group BOOLEAN DEFAULT FALSE,
    last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.conversation_members (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL, -- 'voice', 'text', 'image'
    content_body TEXT,
    storage_path TEXT, -- For voice files
    transcript TEXT, -- AI generated
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. CALLS & PRESENCE
-- ==========================================

CREATE TABLE public.call_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID REFERENCES public.profiles(id),
    receiver_id UUID REFERENCES public.profiles(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration INTEGER,
    status TEXT -- 'missed', 'completed', 'declined'
);

CREATE TABLE public.user_presence (
    user_id UUID REFERENCES public.profiles(id) PRIMARY KEY,
    status TEXT, -- 'online', 'busy', 'offline'
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. BUSINESS & ORGANIZATIONS
-- ==========================================

CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.organization_members (
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT, -- 'admin', 'member'
    PRIMARY KEY (organization_id, user_id)
);

-- ==========================================
-- 5. SECURITY & AUDIT
-- ==========================================

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (examples)
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
