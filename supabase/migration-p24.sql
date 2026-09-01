-- Snomark — migration P24 (multi-documents : plans média nommés).
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

-- 1. Table plan_media : plusieurs plans média nommés par chaîne, un seul live
--    à la fois (miroir exact de la table grille, migration-p23.sql).
create table if not exists plan_media (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid not null references chaine(id),
  nom text not null,
  est_live boolean not null default false,
  cree_le timestamptz not null default now(),
  cree_par text
);

create unique index if not exists plan_media_chaine_live_unique
  on plan_media (chaine_id) where est_live;

alter table plan_media enable row level security;
create policy "anon_all_plan_media" on plan_media for all to anon using (true) with check (true);

-- 2. Un "Plan média principal" par chaîne existante, marqué live.
insert into plan_media (chaine_id, nom, est_live)
select id, 'Plan média principal', true from chaine;

-- 3. element_secondaire.plan_media_id (cascade : supprimer un plan média
--    supprime ses éléments).
alter table element_secondaire
  add column if not exists plan_media_id uuid references plan_media(id) on delete cascade;

-- 4. Backfill : chaque élément existant rattaché au plan média live de sa
--    chaîne (element_secondaire.chaine_id est déjà NOT NULL depuis P16, pas
--    de repli sur un texte libre nécessaire ici contrairement à P23).
update element_secondaire e
set plan_media_id = p.id
from plan_media p
where p.est_live = true and p.chaine_id = e.chaine_id;

-- ============================================================
-- VÉRIFICATION — exécuter seule, résultat attendu : 0
-- ============================================================
select count(*) as elements_orphelins
from element_secondaire
where plan_media_id is null;

-- ============================================================
-- PARTIE B — seulement si la vérification ci-dessus a renvoyé 0
-- ============================================================

-- 5. NOT NULL désormais sûr : tous les éléments ont un plan média.
alter table element_secondaire alter column plan_media_id set not null;

-- 6. historique_action : nouvel écran PLAN_MEDIA + colonne plan_media_id
--    (même traitement que grille_id en P23). Le nom de contrainte ci-dessous
--    est le nom par défaut Postgres pour un CHECK inline sur une colonne
--    (table_colonne_check) — vérifier avec \d historique_action si l'ALTER
--    échoue.
alter table historique_action drop constraint if exists historique_action_ecran_check;
alter table historique_action add constraint historique_action_ecran_check
  check (ecran in ('GRILLE_LINEAIRE', 'GRILLE_TYPE', 'PLAN_MEDIA'));

alter table historique_action
  add column if not exists plan_media_id uuid references plan_media(id) on delete cascade;

create index if not exists historique_action_plan_media_idx
  on historique_action (plan_media_id, cree_le) where plan_media_id is not null;
