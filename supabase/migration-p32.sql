-- Snomark — migration P32 (Règle personnalisée du Plan média).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p31.sql.
-- Additive uniquement. Extension hors cahier (comme la grille non-linéaire P20).

-- Une seule règle par chaîne, partagée entre les deux modes du Plan média :
--  - Génération auto : si `active`, la règle AJOUTE `nombre_annonces` éléments dans
--    chaque coupure dont le programme précédent dure entre duree_min_minutes et
--    duree_max_minutes (elle ne remplace pas le remplissage par défaut).
--  - Application manuelle (onglet Composition, bouton « Appliquer la règle ») :
--    geste explicite, disponible même si `active` est faux ; sélection de
--    programmes + aperçu + confirmation, écriture en origine MANUELLE.
-- spot_ids : entrées de spot_bibliotheque à piocher ; vide = tirage dans toute
-- la bibliothèque de la chaîne.
create table regle_plan_media (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid not null references chaine(id) on delete cascade,
  active boolean not null default false,
  duree_min_minutes integer not null default 0,
  duree_max_minutes integer not null default 30,
  nombre_annonces integer not null default 1,
  spot_ids uuid[] not null default '{}',
  cree_le timestamptz not null default now()
);

create unique index regle_plan_media_chaine_unique on regle_plan_media(chaine_id);

alter table regle_plan_media enable row level security;

create policy anon_all_regle_plan_media on regle_plan_media for all using (true) with check (true);
