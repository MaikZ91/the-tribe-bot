-- THE TRIBE App: Profile, "Wer geht hin" und "Ich bin unterwegs"
-- Einmal im Supabase-Dashboard unter SQL Editor ausführen. Ändert keine bestehenden Tabellen.

create table if not exists public.tribe_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  avatar_url text,
  moods text[] default '{}',
  genres text[] default '{}',
  city text default 'Bielefeld',
  created_at timestamptz default now()
);

create table if not exists public.tribe_going (
  user_id uuid references auth.users(id) on delete cascade,
  event_id text not null,
  event_date date not null,
  created_at timestamptz default now(),
  primary key (user_id, event_id)
);

create table if not exists public.tribe_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  place text not null check (char_length(place) between 1 and 60),   -- nur Location/Viertel, keine GPS-Koordinaten
  mood text,
  city text default 'Bielefeld',
  expires_at timestamptz not null default now() + interval '3 hours'
);

alter table public.tribe_profiles enable row level security;
alter table public.tribe_going    enable row level security;
alter table public.tribe_presence enable row level security;

-- Nur angemeldete Mitglieder sehen andere; jeder ändert nur seine eigenen Daten
create policy "profiles lesen (Mitglieder)" on public.tribe_profiles for select to authenticated using (true);
create policy "eigenes Profil schreiben"   on public.tribe_profiles for all    to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "going lesen (Mitglieder)"   on public.tribe_going    for select to authenticated using (true);
create policy "eigenes going schreiben"    on public.tribe_going    for all    to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "presence lesen (aktiv)"     on public.tribe_presence for select to authenticated using (expires_at > now());
create policy "eigene presence schreiben"  on public.tribe_presence for all    to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and expires_at <= now() + interval '6 hours');

-- Anonyme Zähler für Nicht-Angemeldete ("12 gehen hin"), ohne Namen
create or replace view public.tribe_going_counts with (security_invoker = false) as
  select event_id, count(*)::int as n from public.tribe_going where event_date >= current_date group by event_id;
grant select on public.tribe_going_counts to anon, authenticated;

-- Live-Updates
alter publication supabase_realtime add table public.tribe_going, public.tribe_presence;
