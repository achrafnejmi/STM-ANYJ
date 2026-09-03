-- Snomark — migration P41 : programmes exclusifs & demande de programmation inter-chaînes.
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p40.sql.
-- Additive uniquement.

-- 1. Chaînes autorisées à programmer un titre exclusif (en plus de son détenteur).
alter table programme add column if not exists chaines_autorisees uuid[] not null default '{}';

-- 2. Demande de programmation d'un titre exclusif par une chaîne tierce.
--    Circuit : programmateur Y (A_TRANSMETTRE) → admin Y transmet (SOUMISE) ou
--    rejette (REJETEE_INTERNE) → admin X (détenteur) approuve (ACCEPTEE, Y ajouté
--    à chaines_autorisees) ou refuse (REFUSEE).
create table demande_programmation (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programme(id) on delete cascade,
  chaine_demandeuse_id uuid not null references chaine(id),
  chaine_exclusive_id uuid not null references chaine(id),
  demandeur text not null,
  motif text,
  statut text not null default 'A_TRANSMETTRE' check (statut in (
    'A_TRANSMETTRE', 'SOUMISE', 'REJETEE_INTERNE', 'ACCEPTEE', 'REFUSEE')),
  transmise_par text,
  transmise_le timestamptz,
  traite_par text,
  traite_le timestamptz,
  cree_le timestamptz not null default now()
);

alter table demande_programmation enable row level security;
create policy anon_all_demande_programmation on demande_programmation for all using (true) with check (true);

-- 3. Types de notification du circuit.
alter table notification drop constraint if exists notification_type_check;
alter table notification add constraint notification_type_check check (type in (
  'NOUVEAU_PROGRAMME', 'DROITS_PROCHES', 'PUBLICATION_NON_LINEAIRE',
  'DEMANDE_PAD', 'RELANCE_PAD', 'DECISION_PAD',
  'DEMANDE_PROG_A_TRANSMETTRE', 'DEMANDE_PROG_SOUMISE', 'DEMANDE_PROG_DECISION'));

-- 4. Comptes de démonstration « Administrateur de chaîne » (aucun depuis P39 qui
--    a fait passer younes.admin en Programmateur).
insert into utilisateur (nom_utilisateur, nom_affiche, role, chaine_id) values
  ('safae.admin', 'Safae Bennis',  'ADMIN_CHAINE', '3d1c71e4-25e6-48fc-8072-0fe9ce261550'),  -- Al Aoula
  ('hamid.admin', 'Hamid Ait Ali', 'ADMIN_CHAINE', '948307a6-2c6e-4c2e-a46c-da9ca7d75611')   -- Arryadia
on conflict (nom_utilisateur) do nothing;
