-- Snomark — migration P16b (Plan média : bibliothèque de spots, type SPOT).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p16.sql.
-- Additive.

-- Bibliothèque de spots réutilisables (BA/pub/habillage/autopromo/spot),
-- distincte de element_secondaire qui représente une INSTANCE déjà placée.
-- chaine_id nullable : NULL = spot global (dispo sur toutes les chaînes,
-- ex. campagne institutionnelle SNRT), non NULL = propre à une chaîne
-- (ex. habillage/jingle spécifique).
create table if not exists spot_bibliotheque (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid references chaine(id),
  libelle text not null,
  type text not null check (type in ('BANDE_ANNONCE', 'ECRAN_PUBLICITAIRE', 'HABILLAGE', 'AUTOPROMOTION', 'SPOT')),
  duree_secondes integer not null,
  cree_le timestamptz not null default now()
);
alter table spot_bibliotheque enable row level security;
create policy "anon_all_spot_bibliotheque" on spot_bibliotheque for all to anon using (true) with check (true);

-- Ajout du type SPOT (catch-all Forja/sensibilisation/institutionnel — le
-- libellé libre porte la nuance, pas une multiplication des types) à la
-- contrainte existante sur element_secondaire.type.
alter table element_secondaire drop constraint if exists element_secondaire_type_check;
alter table element_secondaire add constraint element_secondaire_type_check
  check (type in ('BANDE_ANNONCE', 'ECRAN_PUBLICITAIRE', 'HABILLAGE', 'AUTOPROMOTION', 'SPOT'));

-- Note d'application (pas une contrainte SQL) : BANDE_ANNONCE reste par
-- convention toujours lié à une campagne (campagne_id non nul), y compris
-- pour les lignes insérées manuellement — le CHECK partagé avec
-- spot_bibliotheque ne l'impose pas structurellement.
