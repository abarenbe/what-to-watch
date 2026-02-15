-- FIX INFINITE RECURSION IN RLS POLICIES

-- 1. Fix Group Members Policy
-- The previous policy caused infinite recursion by querying group_members within its own policy.
DROP POLICY IF EXISTS "Members viewable by group" ON group_members;
-- Also drop any other potential select policies to be safe
DROP POLICY IF EXISTS "Members viewable by group members" ON group_members;

-- New simple policy: Users can ONLY see their own membership rows.
-- This breaks the recursion loop.
CREATE POLICY "Users can view own memberships" ON group_members 
FOR SELECT USING (auth.uid() = user_id);

-- 2. Fix User Providers Policy (Streaming Services)
-- The previous policy attempted to look up group members recursively.
-- Since our app uses the Admin Client for group lookups, we can restrict this to just the owner.
DROP POLICY IF EXISTS "Users can view group providers" ON user_providers;

-- Simple policy: You see your own providers.
CREATE POLICY "Users can view own providers" ON user_providers 
FOR SELECT USING (auth.uid() = user_id);
