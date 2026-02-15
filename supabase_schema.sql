-- WHAT TO WATCH: SUPABASE DATABASE SCHEMA (RESET & UPDATE)
-- Run this in the Supabase SQL Editor explicitly to fix schema mismatches.

-- ⚠️ RESET SECTION: Drops existing tables to ensure schema matches code ⚠️
-- This is safe for a prototype as it rebuilds the structure correctly.
DROP VIEW IF EXISTS group_matches;
DROP TABLE IF EXISTS swipes CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS tonight_picks CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create a table for Family/Friend Groups
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create a table for User Profiles (linked to Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  active_group_id UUID REFERENCES groups(id),  -- Currently selected group
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Group Members junction table (users can be in MULTIPLE groups)
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

-- 4. Create a table for Swipes
CREATE TABLE swipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  movie_id TEXT NOT NULL,
  media_type TEXT DEFAULT 'movie' CHECK (media_type IN ('movie', 'tv')),
  score INTEGER CHECK (score >= 0 AND score <= 3),
  status TEXT DEFAULT 'swiped' CHECK (status IN ('swiped', 'watching', 'watched')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, movie_id, media_type, group_id)
);

-- 5. Automatically identify Matches (View)
CREATE OR REPLACE VIEW group_matches AS
SELECT 
  s.group_id,
  s.movie_id,
  s.media_type,
  SUM(s.score) as total_match_score,
  COUNT(s.user_id) as swipe_count
FROM swipes s
GROUP BY s.group_id, s.movie_id, s.media_type
HAVING 
  MIN(s.score) > 0
  AND MAX(s.score) >= 2;

-- Enable Real-time for swipes
ALTER PUBLICATION supabase_realtime ADD TABLE swipes;

-- 6. Tonight Picks
CREATE TABLE tonight_picks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  movie_id TEXT NOT NULL,
  media_type TEXT DEFAULT 'movie' CHECK (media_type IN ('movie', 'tv')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, movie_id, media_type)
);

ALTER PUBLICATION supabase_realtime ADD TABLE tonight_picks;

-- 7. Auto-create profile on signup (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8. Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tonight_picks ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles (for display names), update their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Groups: viewable by members, creatable by anyone
CREATE POLICY "Groups viewable by members" ON groups FOR SELECT USING (
  id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  OR created_by = auth.uid()
);
CREATE POLICY "Anyone can create groups" ON groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- Also allow looking up by invite code for joining
CREATE POLICY "Groups findable by invite code" ON groups FOR SELECT USING (true);

-- Group members: viewable by fellow group members, joinable/leavable
CREATE POLICY "Users can view own memberships" ON group_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can join groups" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON group_members FOR DELETE USING (auth.uid() = user_id);

-- Swipes: users can manage their own, read group members'
CREATE POLICY "Users can read group swipes" ON swipes FOR SELECT USING (
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can insert own swipes" ON swipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own swipes" ON swipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own swipes" ON swipes FOR DELETE USING (auth.uid() = user_id);

-- Tonight Picks: similar logic
CREATE POLICY "Group members can view tonight picks" ON tonight_picks FOR SELECT USING (
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can insert own tonight picks" ON tonight_picks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tonight picks" ON tonight_picks FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own tonight picks" ON tonight_picks FOR UPDATE USING (auth.uid() = user_id);

-- 9. Streaming Services
CREATE TABLE IF NOT EXISTS user_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id INTEGER NOT NULL,
  provider_name TEXT,
  logo_path TEXT,
  display_priority INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider_id)
);

ALTER TABLE user_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own providers" ON user_providers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own providers" ON user_providers FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own providers" ON user_providers FOR SELECT USING (auth.uid() = user_id);


-- 10. BACKFILL PROFILES (Fixes broken accounts from reset)
INSERT INTO public.profiles (id, display_name, avatar_url)
SELECT id, 
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email),
    raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
