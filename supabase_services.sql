-- STREAMING SERVICES SUPPORT
-- Run this in Supabase SQL Editor to add the new tables

-- 1. Create table for User Providers
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

-- 2. Enable RLS
ALTER TABLE user_providers ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Users can manage their own
CREATE POLICY "Users can insert own providers" ON user_providers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own providers" ON user_providers FOR DELETE USING (auth.uid() = user_id);

-- Viewing: Users can view their own. Group sharing is handled via API (admin client).
CREATE POLICY "Users can view own providers" ON user_providers FOR SELECT USING (auth.uid() = user_id);
