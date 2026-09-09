-- Snomark — migration P36a : import de la pige (retour d'antenne réel).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p52.sql.
-- Additive / idempotent. La pige = ce qui a RÉELLEMENT été diffusé (à la seconde),
-- importé depuis un fichier d'audience (feuille « Data »). P36a = import SEUL, aucune
-- consommation par les autres écrans à ce stade. Trois parties : (1) import_pige
-- (l'import nommé, non destructif), (2) diffusion_reelle (les lignes calées sur le
-- fichier), (3) extension de historique_action pour l'annuler/rétablir (écran PIGE).

-- 1. import_pige : un import = une chaîne + une date, nommé. Un ré-import de la même
--    chaîne/date désactive le précédent (actif = false) sans le supprimer.
create table if not exists import_pige (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  chaine_id uuid references chaine(id) on delete cascade,   -- null = chaîne hors SNRT (non importée par l'UI)
  chaine_nom text not null,                  -- libellé brut du fichier, toujours conservé
  date date not null,                        -- jour de diffusion déclaré par le fichier
  jour text,                                 -- « Lundi » (colonne Jour Nommé)
  source_fichier text,                       -- nom du .xlsx importé
  analyse_le text,                           -- « Analysis run on » de la feuille Info
  nb_lignes integer not null default 0,
  actif boolean not null default true,
  cree_par text,
  cree_le timestamptz not null default now()
);

create index if not exists import_pige_chaine_date_idx on import_pige (chaine_id, date);
create unique index if not exists import_pige_actif_uniq
  on import_pige (chaine_id, date) where actif and chaine_id is not null;

alter table import_pige enable row level security;
create policy anon_all_import_pige on import_pige for all using (true) with check (true);

-- 2. diffusion_reelle : une ligne du fichier = une ligne ici. Heures d'horloge
--    réelles (27:00 → 03:00, 26:00 → 02:00) en `time` ; axe linéaire du fichier
--    conservé en secondes (debut/fin_secondes, peut dépasser 86400) pour garantir
--    l'ordre du déroulé et une durée toujours positive. Aucun lien FK vers
--    programme (import autonome) : le nom est stocké tel quel.
create table if not exists diffusion_reelle (
  id uuid primary key default gen_random_uuid(),
  import_pige_id uuid not null references import_pige(id) on delete cascade,
  chaine_id uuid references chaine(id) on delete cascade,
  chaine_nom text not null,
  date date not null,
  jour text,
  ordre integer not null,                    -- rang dans le fichier (colonne « Rows »)
  code_ecran text,
  code_program text,                         -- conservé pour un rapprochement catalogue ultérieur (pas de FK)
  programme text not null,                   -- nom tel quel (trim)
  heure_debut time not null,                 -- heure d'horloge : 27:00 → 03:00
  heure_fin time not null,
  debut_secondes integer not null,           -- axe linéaire du fichier depuis 00:00 (10800 = 3:00, 97200 = 27:00)
  fin_secondes integer not null,             -- toujours > debut_secondes
  duree_secondes integer not null,           -- colonne Durée
  libelle_complementaire text,
  code_genre text,
  genre_niv1 text,
  genre_niv2 text,
  genre_niv3 text,
  type_element text not null
    check (type_element in ('PROGRAMME', 'BA', 'SPOT', 'AUTO_PROMO', 'COMMUNIQUE', 'AUTRE')),
  est_sous_ligne boolean not null default false,   -- sous-ligne (DEBUT)/(SUITE)/(FIN)
  parent_ordre integer,                      -- `ordre` de la ligne parente (si sous-ligne)
  chevauchement boolean not null default false,
  cree_le timestamptz not null default now()
);

create index if not exists diffusion_reelle_import_idx on diffusion_reelle (import_pige_id);
create index if not exists diffusion_reelle_chaine_date_idx on diffusion_reelle (chaine_id, date);
create index if not exists diffusion_reelle_programme_idx on diffusion_reelle (lower(programme));

alter table diffusion_reelle enable row level security;
create policy anon_all_diffusion_reelle on diffusion_reelle for all using (true) with check (true);

-- 3. historique_action : nouvel écran PIGE + colonne import_pige_id (même
--    traitement que plan_media_id en P24). La liste des valeurs du CHECK reprend
--    celle de migration-p30-rollback.sql, augmentée de 'PIGE'.
alter table historique_action drop constraint if exists historique_action_ecran_check;
alter table historique_action add constraint historique_action_ecran_check
  check (ecran in ('GRILLE_LINEAIRE', 'GRILLE_TYPE', 'PLAN_MEDIA',
                   'GRILLE_NON_LINEAIRE_RESEAUX', 'GRILLE_NON_LINEAIRE_VOD', 'PIGE'));

alter table historique_action
  add column if not exists import_pige_id uuid references import_pige(id) on delete cascade;

create index if not exists historique_action_import_pige_idx
  on historique_action (import_pige_id, cree_le) where import_pige_id is not null;
