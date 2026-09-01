-- Snomark — migration P14a (M6 : Contrats & droits, garde-fou grille).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p13b.sql.
-- Additive uniquement.

create table if not exists fenetre_droits (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programme(id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  passages_autorises integer not null,
  passages_consommes integer not null default 0,
  cree_le timestamptz not null default now()
);

-- Pas de check date_fin > date_debut ni passages_consommes <= passages_autorises :
-- validation côté formulaire, pas de contrainte dure qui bloquerait une
-- correction manuelle légitime (même précédent que bloc_grille_type.jours).

alter table fenetre_droits enable row level security;

create policy "anon_all_fenetre_droits" on fenetre_droits for all to anon
  using (true) with check (true);

-- Option A (décidée) : pas de table contrat (hors périmètre cahier §1.5.2) —
-- juste une référence texte libre sur le titre.
alter table programme add column if not exists reference_contrat text;
