-- Snomark — schéma des tables cœur (P5, PLAN.md §4).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run.
-- Base supposée vide (confirmé) : aucune précaution anti-écrasement.

create extension if not exists pgcrypto;

create table programme (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  titre_ar text,
  genre text,
  sous_genre text,
  thematique text,
  description text,
  date_production date,
  code text,
  nombre_segments integer,
  auteur text,
  exclusivite boolean not null default false,
  chaine text not null,
  cree_par text,
  cree_le timestamptz not null default now(),
  unique (titre, chaine)
);

create table segment (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programme(id) on delete cascade,
  numero integer,
  titre text,
  duree integer, -- minutes
  date_production date,
  code text,
  description text,
  pad boolean not null default false,
  derniere_diffusion date,
  nombre_diffusions integer not null default 0
);

create table diffusion_lineaire (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programme(id) on delete cascade,
  chaine text not null,
  date date not null,
  heure_debut time not null,
  heure_fin time not null,
  genre text,
  titre_cache text
);

create table diffusion_non_lineaire (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programme(id) on delete cascade,
  plateforme text not null check (plateforme in ('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'VOD', 'FORJA')),
  type_contenu text not null check (type_contenu in ('POST', 'REEL', 'VIDEO', 'VOD')),
  date_publication date not null,
  heure_publication time,
  titre text,
  description text,
  lien text,
  visuel text,
  statut text,
  cree_par text,
  cree_le timestamptz not null default now()
);

-- RLS : activé avec une policy permissive pour le rôle anon (PoC démo,
-- pas d'auth Supabase réelle branchée). Voir avertissement dans README.md.
alter table programme enable row level security;
alter table segment enable row level security;
alter table diffusion_lineaire enable row level security;
alter table diffusion_non_lineaire enable row level security;

create policy "anon_all_programme" on programme for all to anon using (true) with check (true);
create policy "anon_all_segment" on segment for all to anon using (true) with check (true);
create policy "anon_all_diffusion_lineaire" on diffusion_lineaire for all to anon using (true) with check (true);
create policy "anon_all_diffusion_non_lineaire" on diffusion_non_lineaire for all to anon using (true) with check (true);
