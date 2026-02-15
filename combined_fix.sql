-- COMBINED FIX: RUN THIS TO FIX EVERYTHING

-- 1. Fix Group Members Recursion
DROP POLICY IF EXISTS "Members viewable by group" ON group_members;
DROP POLICY IF EXISTS "Members viewable by group members" ON group_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON group_members;

CREATE POLICY "Users can view own memberships" ON group_members 
FOR SELECT USING (auth.uid() = user_id);

-- 2. Create Streaming Services Table (if it doesn't exist)
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

-- 3. Enable RLS on User Providers
ALTER TABLE user_providers ENABLE ROW LEVEL SECURITY;

-- 4. Streaming Services Policies (Non-Recursive)
DROP POLICY IF EXISTS "Users can insert own providers" ON user_providers;
DROP POLICY IF EXISTS "Users can delete own providers" ON user_providers;
DROP POLICY IF EXISTS "Users can view group providers" ON user_providers;
DROP POLICY IF EXISTS "Users can view own providers" ON user_providers;

CREATE POLICY "Users can insert own providers" ON user_providers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own providers" ON user_providers FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own providers" ON user_providers FOR SELECT USING (auth.uid() = user_id);
