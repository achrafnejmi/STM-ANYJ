-- Snomark — migration P28 (multi-documents : grilles type nommées + gabarits saisonniers).
-- À exécuter dans Supabase : Dashboard → SQL Editor.
--
-- IMPORTANT — exécution EN DEUX TEMPS, pas en un seul paste :
--   1. Coller et exécuter la PARTIE A ci-dessous.
--   2. Exécuter la requête de VÉRIFICATION seule ; le résultat DOIT être 0.
--      Si ce n'est pas 0, s'arrêter et ne pas exécuter la PARTIE B.
--   3. Si la vérification donne bien 0, coller et exécuter la PARTIE B.

-- ============================================================
-- PARTIE A
-- ============================================================

-- 1. Table grille_type : plusieurs grilles type nommées par chaîne, une seule
--    live à la fois (miroir exact de grille/plan_media, migration-p23/p24.sql)
--    + date_debut/date_fin optionnelles pour les gabarits saisonniers
--    (Ramadan/rentrée/été). Bascule SUGGÉRÉE seulement (P28) : ces 2 colonnes
--    ne pilotent aucune écriture automatique, juste un bandeau d'alerte côté
--    écran — la seule façon de rendre une grille type active reste le geste
--    manuel "Définir comme live", comme grille/plan_media.
create table if not exists grille_type (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid not null references chaine(id),
  nom text not null,
  est_live boolean not null default false,
  date_debut date,
  date_fin date,
  cree_le timestamptz not null default now(),
  cree_par text
);

create unique index if not exists grille_type_chaine_live_unique
  on grille_type (chaine_id) where est_live;

alter table grille_type enable row level security;
create policy "anon_all_grille_type" on grille_type for all to anon using (true) with check (true);

-- 2. Une "Grille type principale" par chaîne existante, marquée live — les
--    blocs déjà créés (P13) doivent rester actifs par défaut après migration.
insert into grille_type (chaine_id, nom, est_live)
select id, 'Grille type principale', true from chaine;

-- 3. bloc_grille_type.grille_type_id (cascade : supprimer une grille type
--    supprime ses blocs).
alter table bloc_grille_type
  add column if not exists grille_type_id uuid references grille_type(id) on delete cascade;

-- 4. Backfill : chaque bloc existant rattaché à la grille type live de sa chaîne.
update bloc_grille_type b
set grille_type_id = g.id
from grille_type g
where g.est_live = true and g.chaine_id = b.chaine_id;

-- ============================================================
-- VÉRIFICATION — exécuter seule, résultat attendu : 0
-- ============================================================
select count(*) as blocs_orphelins
from bloc_grille_type
where grille_type_id is null;

-- ============================================================
-- PARTIE B — seulement si la vérification ci-dessus a renvoyé 0
-- ============================================================

-- 5. NOT NULL désormais sûr : tous les blocs ont une grille type.
alter table bloc_grille_type alter column grille_type_id set not null;

-- 6. historique_action : colonne grille_type_id (l'écran GRILLE_TYPE est déjà
--    accepté par le CHECK depuis migration-p24.sql, rien à changer là).
alter table historique_action
  add column if not exists grille_type_id uuid references grille_type(id) on delete cascade;

create index if not exists historique_action_grille_type_idx
  on historique_action (grille_type_id, cree_le) where grille_type_id is not null;
