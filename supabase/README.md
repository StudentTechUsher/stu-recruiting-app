# Supabase Migrations

This directory contains SQL migrations for Supabase-managed Postgres.

## Applying migrations

Use the Supabase CLI in your environment:

- `supabase db push`

The current migration adds `public.profiles`, RLS policies, and auth-user bootstrap triggers.
