-- Snomark — migration P30 (Droits illimités + rôles).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p29.sql.
-- Additive uniquement.

-- --- Droits illimités (par fenêtre, production interne SNRT) ---

alter table fenetre_droits add column if not exists illimite boolean not null default false;

-- Une fenêtre illimitée n'a ni échéance ni plafond de passages — un sentinel
-- (ex. 9999-12-31 ou 999999) fausserait les calculs de jours/passages
-- restants, donc on relâche les NOT NULL plutôt que d'inventer une valeur.
alter table fenetre_droits alter column date_fin drop not null;
alter table fenetre_droits alter column passages_autorises drop not null;

-- Une fenêtre NON illimitée garde l'obligation actuelle (date_fin +
-- passages_autorises renseignés).
alter table fenetre_droits add constraint fenetre_droits_illimite_ck
  check (illimite or (date_fin is not null and passages_autorises is not null));

-- --- Rôles (Administrateur / Utilisateur) ---

create table if not exists utilisateur (
  nom_utilisateur text primary key,
  role text not null default 'UTILISATEUR' check (role in ('ADMIN', 'UTILISATEUR')),
  cree_le timestamptz not null default now()
);

-- Amorçage : premier Administrateur (décision utilisateur), nom exact tapé à
-- la connexion.
insert into utilisateur (nom_utilisateur, role) values ('Achraf Nejmi', 'ADMIN')
  on conflict (nom_utilisateur) do nothing;

alter table utilisateur enable row level security;

create policy "anon_all_utilisateur" on utilisateur for all to anon
  using (true) with check (true);
