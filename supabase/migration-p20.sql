-- Phase 20 — Grille non-linéaire (extension hors cahier, PLAN.md §9).
-- Remplace la table fourre-tout diffusion_non_lineaire (schema.sql, jamais
-- utilisée, vide) par 2 tables indépendantes : publication_reseau (promo
-- réseaux sociaux) et publication_vod (mise en ligne streaming/VOD).

drop table if exists diffusion_non_lineaire;

-- Onglet 1 : Réseaux sociaux — une ligne = une case plateforme + format,
-- jamais un post multi-plateforme.
create table publication_reseau (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid not null references chaine(id),
  programme_id uuid not null references programme(id) on delete cascade,
  plateforme text not null check (plateforme in ('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'SNAPCHAT', 'YOUTUBE')),
  format text not null check (format in ('POST', 'REEL', 'STORY', 'VIDEO')),
  date_publication date not null,
  heure_publication time,
  titre text,
  description text,
  lien text,
  visuel text,
  statut text not null default 'BROUILLON' check (statut in ('BROUILLON', 'PROGRAMME', 'PUBLIE', 'ANNULE')),
  cree_par text,
  cree_le timestamptz not null default now()
);

create index publication_reseau_chaine_date_idx on publication_reseau(chaine_id, date_publication);

alter table publication_reseau enable row level security;

create policy anon_all_publication_reseau on publication_reseau for all using (true) with check (true);

-- Onglet 2 : Streaming / VOD — contenu complet en ligne, pas un post promo.
-- Pas de colonne format. `plateforme` reste une liste fermée à 1 valeur
-- aujourd'hui (FORJA), extensible par migration le jour où une 2e
-- plateforme VOD existe.
create table publication_vod (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid not null references chaine(id),
  programme_id uuid not null references programme(id) on delete cascade,
  plateforme text not null default 'FORJA' check (plateforme in ('FORJA')),
  date_publication date not null,
  heure_publication time,
  titre text,
  description text,
  lien text,
  visuel text,
  statut text not null default 'BROUILLON' check (statut in ('BROUILLON', 'PROGRAMME', 'PUBLIE', 'ANNULE')),
  cree_par text,
  cree_le timestamptz not null default now()
);

create index publication_vod_chaine_date_idx on publication_vod(chaine_id, date_publication);

alter table publication_vod enable row level security;

create policy anon_all_publication_vod on publication_vod for all using (true) with check (true);
