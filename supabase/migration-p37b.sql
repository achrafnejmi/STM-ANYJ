-- Snomark — migration P37b : comptage des diffusions payantes (droits d'auteur).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p52.sql.
-- Additive. Pour les programmes EXTERNES, les interprètes sont payés sur droits
-- d'image à partir de la 4e diffusion réelle. L'app NE calcule AUCUN montant :
-- elle fournit, par programme, le nombre de diffusions réelles (rapprochées de
-- la pige par le nom, approximatif) et le nombre de diffusions payantes
-- (au-delà de `seuil_gratuit`). La Gestion des droits et du stock vérifie /
-- corrige / valide ; la finance applique ensuite ses barèmes.
-- Une ligne par programme (précédent : bible, fenetre_droits).

create table if not exists droit_auteur (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null unique references programme(id) on delete cascade,
  seuil_gratuit integer not null default 3,     -- diffusions non payantes (les 3 premières)
  exclusions uuid[] not null default '{}',      -- diffusion_reelle décochées (faux positifs du rapprochement)
  nb_reelles_manuel integer,                    -- override si le rapprochement rate (null = compte auto)
  note text,
  valide boolean not null default false,
  valide_le timestamptz,
  valide_par text,
  cree_par text,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);

create index if not exists droit_auteur_programme_idx on droit_auteur(programme_id);

alter table droit_auteur enable row level security;
create policy anon_all_droit_auteur on droit_auteur for all using (true) with check (true);
