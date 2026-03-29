-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

-- Create enum types
create type platform_type as enum ('tiktok', 'instagram', 'youtube', 'twitter', 'other');
create type category_type as enum ('food', 'fitness', 'recipe', 'how-to', 'video-analysis', 'other');
create type item_status as enum ('pending', 'processing', 'done', 'failed');

-- SavedItem table
create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  platform platform_type not null default 'other',
  category category_type not null default 'other',
  raw_content jsonb,
  extracted_data jsonb,
  action_taken text,
  user_correction text,
  status item_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast user lookups
create index idx_saved_items_user_id on public.saved_items(user_id);
create index idx_saved_items_status on public.saved_items(status);
create index idx_saved_items_created_at on public.saved_items(created_at desc);

-- Row-level security
alter table public.saved_items enable row level security;

create policy "Users can view their own items"
  on public.saved_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own items"
  on public.saved_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own items"
  on public.saved_items for update
  using (auth.uid() = user_id);

create policy "Users can delete their own items"
  on public.saved_items for delete
  using (auth.uid() = user_id);

-- Trigger to keep updated_at in sync
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger saved_items_updated_at
  before update on public.saved_items
  for each row execute function public.update_updated_at();
