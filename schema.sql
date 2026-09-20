-- =========================================================
-- SCHEMA SUPABASE - Site de Download de Músicas
-- Executar em: Supabase Dashboard > SQL Editor > New query
-- =========================================================

-- Extensão para UUID
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- TABELA: categories (géneros)
-- ---------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- TABELA: artists
-- ---------------------------------------------------------
create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  bio text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- TABELA: songs
-- ---------------------------------------------------------
create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  artist_id uuid not null references artists(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  description text,
  cover_url text,
  audio_url text not null,
  audio_size_mb numeric,
  duration_seconds integer,
  published boolean not null default false,
  views integer not null default 0,
  downloads integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- evita duas músicas com o mesmo slug para o mesmo artista
  unique (artist_id, slug)
);

create index if not exists idx_songs_published on songs(published);
create index if not exists idx_songs_artist on songs(artist_id);
create index if not exists idx_songs_category on songs(category_id);
create index if not exists idx_songs_created_at on songs(created_at desc);

-- ---------------------------------------------------------
-- TABELA: song_events (log de views/downloads para
-- proteção contra contagem artificial - permite dedupe)
-- ---------------------------------------------------------
create table if not exists song_events (
  id bigint generated always as identity primary key,
  song_id uuid not null references songs(id) on delete cascade,
  event_type text not null check (event_type in ('view','download')),
  session_hash text not null, -- hash da sessão/IP, nunca dados pessoais em claro
  created_at timestamptz not null default now()
);

create index if not exists idx_song_events_dedupe
  on song_events(song_id, event_type, session_hash, created_at);

-- ---------------------------------------------------------
-- FUNÇÃO: incrementar view ou download com proteção
-- (chamada pelo Cloudflare Worker, nunca direto do browser)
-- Só conta se não existir o mesmo (song_id, tipo, sessão) 
-- nos últimos 60 minutos.
-- ---------------------------------------------------------
create or replace function register_song_event(
  p_song_id uuid,
  p_event_type text,
  p_session_hash text
) returns json
language plpgsql
security definer
as $$
declare
  v_recent_count integer;
  v_new_views integer;
  v_new_downloads integer;
begin
  if p_event_type not in ('view','download') then
    raise exception 'invalid event_type';
  end if;

  select count(*) into v_recent_count
  from song_events
  where song_id = p_song_id
    and event_type = p_event_type
    and session_hash = p_session_hash
    and created_at > now() - interval '60 minutes';

  if v_recent_count = 0 then
    insert into song_events(song_id, event_type, session_hash)
    values (p_song_id, p_event_type, p_session_hash);

    if p_event_type = 'view' then
      update songs set views = views + 1 where id = p_song_id
      returning views into v_new_views;
    else
      update songs set downloads = downloads + 1 where id = p_song_id
      returning downloads into v_new_downloads;
    end if;
  end if;

  select views, downloads into v_new_views, v_new_downloads
  from songs where id = p_song_id;

  return json_build_object('views', v_new_views, 'downloads', v_new_downloads);
end;
$$;

-- ---------------------------------------------------------
-- TRIGGER: updated_at automático
-- ---------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_songs_updated_at on songs;
create trigger trg_songs_updated_at before update on songs
for each row execute function set_updated_at();

drop trigger if exists trg_artists_updated_at on artists;
create trigger trg_artists_updated_at before update on artists
for each row execute function set_updated_at();

-- =========================================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================================
alter table artists enable row level security;
alter table categories enable row level security;
alter table songs enable row level security;
alter table song_events enable row level security;

-- Leitura pública (site e gerador) só de dados "públicos"
create policy "public read artists" on artists
  for select using (true);

create policy "public read categories" on categories
  for select using (true);

create policy "public read published songs" on songs
  for select using (published = true);

-- Nenhuma política de insert/update/delete para o anon key:
-- só a service_role (usada no GitHub Actions e no Worker,
-- nunca no browser) pode escrever. Isso é automático porque
-- RLS bloqueia tudo que não tenha policy explícita, e a
-- service_role ignora RLS por definição no Supabase.

-- song_events: ninguém lê/escreve diretamente por RLS;
-- só a função register_song_event (security definer) escreve.
