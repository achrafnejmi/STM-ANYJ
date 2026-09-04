-- Snomark — migration P43 : supports & événements secondaires des épisodes.
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p42.sql.
-- Additive uniquement. La table de l'épisode s'appelle `episode` (renommée depuis
-- `segment` en migration-p10) ; la FK suit la convention `episode_id`.

-- Supports d'un épisode (onglet « Supports » de la fiche programme, ancien STM).
create table support (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episode(id) on delete cascade,
  numero_support text,
  type_support text,
  tc_in text,                     -- timecode d'entrée (texte libre, ex. HH:MM:SS:FF)
  cree_par text,
  cree_le timestamptz not null default now()
);
alter table support enable row level security;
create policy anon_all_support on support for all using (true) with check (true);

-- Événements secondaires d'un épisode (onglet « Événements secondaires »).
create table evenement_secondaire (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episode(id) on delete cascade,
  type text not null,
  start_time text,                -- timecode de début
  duree_secondes integer,         -- durée en secondes (cf. conducteur, cahier des charges)
  cree_par text,
  cree_le timestamptz not null default now()
);
alter table evenement_secondaire enable row level security;
create policy anon_all_evenement_secondaire on evenement_secondaire for all using (true) with check (true);
