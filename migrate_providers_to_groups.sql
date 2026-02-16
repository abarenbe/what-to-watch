-- Migration: Streaming Services linked to GROUPS instead of USERS

-- 1. Create or Rename table
-- We'll create a new one to be clean, and drop the old one.
DROP TABLE IF EXISTS user_providers;

CREATE TABLE group_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  provider_id INTEGER NOT NULL,
  provider_name TEXT,
  logo_path TEXT,
  display_priority INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, provider_id)
);

-- 2. Enable RLS
ALTER TABLE group_providers ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Anyone in the group can view/edit providers for that group
CREATE POLICY "Group members can view group providers" ON group_providers FOR SELECT USING (
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);

CREATE POLICY "Group members can manage group providers" ON group_providers FOR ALL USING (
  group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
);
