-- WHAT TO WATCH: SUPABASE DATABASE SCHEMA

-- 1. Create a table for Family Groups
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create a table for User Profiles (linked to Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id),
  display_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create a table for Swipes
CREATE TABLE swipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  movie_id TEXT NOT NULL, -- TMDb ID
  media_type TEXT DEFAULT 'movie' CHECK (media_type IN ('movie', 'tv')),
  score INTEGER CHECK (score >= 0 AND score <= 3), -- 0:Left, 1:Down, 2:Right, 3:Up
  status TEXT DEFAULT 'swiped' CHECK (status IN ('swiped', 'watching', 'watched')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, movie_id, media_type) -- One swipe per user per media item
);

-- 4. Automatically identify Matches (View)
-- This view calculates the "Match Score" based on your logic:
-- Everyone > 0 AND At least one >= 2
CREATE VIEW group_matches AS
SELECT 
  s.group_id,
  s.movie_id,
  s.media_type,
  SUM(s.score) as total_match_score,
  COUNT(s.user_id) as swipe_count
FROM swipes s
GROUP BY s.group_id, s.movie_id, s.media_type
HAVING 
  MIN(s.score) > 0 -- Rule 1: Everyone above 0
  AND MAX(s.score) >= 2; -- Rule 2: At least one person is 2 or 3

-- Enable Real-time for swipes
ALTER PUBLICATION supabase_realtime ADD TABLE swipes;
