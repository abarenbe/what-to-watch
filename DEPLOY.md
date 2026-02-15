# Deployment Guide for "What to Watch"

This guide outlines the steps to deploy your Next.js application to production using Vercel (recommended) and Supabase.

## Prerequisites

1.  **GitHub Repository**: Your code should be pushed to a GitHub repository.
2.  **Vercel Account**: Sign up at [vercel.com](https://vercel.com).
3.  **Supabase Project**: You already have this set up.

## Step 1: Push Code to GitHub

Ensure all your latest changes are committed and pushed.

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

*(If you haven't connected a remote repository yet, create a new repo on GitHub and follow the instructions to push your local code there.)*

## Step 2: Deploy to Vercel

1.  Go to the [Vercel Dashboard](https://vercel.com/dashboard).
2.  Click **"Add New..."** -> **"Project"**.
3.  Import your "what-to-watch" repository from GitHub.
4.  In the **"Configure Project"** screen:
    *   **Framework Preset**: Next.js (should be auto-detected).
    *   **Root Directory**: `./` (default).
    *   **Environment Variables**: Expand this section. You need to add the variables from your `.env.local` file:
        *   `NEXT_PUBLIC_SUPABASE_URL`: (Your Supabase URL)
        *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (Your Supabase Anon Key)
        *   `TMDB_ACCESS_TOKEN`: (Your TMDB Access Token)

5.  Click **"Deploy"**.

Vercel will build your project. Once complete, you will get a production URL (e.g., `https://what-to-watch.vercel.app`).

## Step 3: Configure Supabase Authentication

This is critical for logging in on the production site.

1.  Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2.  Select your project.
3.  Navigate to **Authentication** -> **URL Configuration**.
4.  **Site URL**: Set this to your production URL (e.g., `https://what-to-watch.vercel.app`).
5.  **Redirect URLs**: Add the following:
    *   `https://what-to-watch.vercel.app/**`
    *   `https://what-to-watch.vercel.app/auth/callback` (if you implement a purely server-side auth flow later)
    *   `http://localhost:3000/**` (keep this for local development)

6.  Click **Save**.

## Step 4: Verify Database

Ensure your production database has the latest schema. If you have been developing locally or on a test instance:

1.  Go to the **SQL Editor** in Supabase.
2.  Run the contents of `combined_fix.sql` (found in your project root) to ensure all tables, policies, and functions are up to date.

## Step 5: Test

Visit your Vercel URL.
1.  Try logging in.
2.  Test the "Discovery" feed.
3.  Test swiping and "My List".
4.  Test the new filters (Free/Classic/Search).
