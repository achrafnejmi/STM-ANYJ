-- Snomark — migration P23 (multi-documents : grilles nommées).
-- À exécuter dans Supabase : Dashboard → SQL Editor.
--
-- IMPORTANT — exécution EN DEUX TEMPS, pas en un seul paste :
--   1. Coller et exécuter la PARTIE A ci-dessous.
--   2. Exécuter la requête de VÉRIFICATION seule ; le résultat DOIT être 0.
--      Si ce n'est pas 0, s'arrêter et ne pas exécuter la PARTIE B (des
--      diffusions existantes n'ont pas pu être rattachées à une chaîne connue —
--      à investiguer avant de continuer).
--   3. Si la vérification donne bien 0, coller et exécuter la PARTIE B.

-- ============================================================
-- PARTIE A
-- ============================================================

-- 1. Table grille : plusieurs grilles nommées par chaîne, une seule live à la fois.
create table if not exists grille (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid not null references chaine(id),
  nom text not null,
  est_live boolean not null default false,
  cree_le timestamptz not null default now(),
  cree_par text
);

create unique index if not exists grille_chaine_live_unique
  on grille (chaine_id) where est_live;

alter table grille enable row level security;
create policy "anon_all_grille" on grille for all to anon using (true) with check (true);

-- 2. Une grille "Grille principale" par chaîne existante, marquée live.
insert into grille (chaine_id, nom, est_live)
select id, 'Grille principale', true from chaine;

-- 3. diffusion_lineaire.grille_id (cascade : supprimer une grille supprime ses
--    diffusions, et par ricochet les element_secondaire qui leur sont chaînés).
alter table diffusion_lineaire
  add column if not exists grille_id uuid references grille(id) on delete cascade;

-- 4. Backfill : chaque diffusion existante rattachée à la grille live de sa chaîne.
--    Repli sur le nom texte (chaine) si chaine_id est resté NULL, même logique que
--    le backfill historique de migration-p9.sql.
update diffusion_lineaire d
set grille_id = g.id
from grille g
where g.est_live = true
  and g.chaine_id = coalesce(
    d.chaine_id,
    (select c.id from chaine c where lower(trim(c.nom)) = lower(trim(d.chaine)))
  );

-- 6 (historique_action) est fait en Partie B, après vérification — elle ne dépend
-- pas du backfill ci-dessus mais reste groupée avec le NOT NULL pour un seul aller-
-- retour Supabase après la vérification.

-- ============================================================
-- VÉRIFICATION — exécuter seule, résultat attendu : 0
-- ============================================================
select count(*) as diffusions_orphelines
from diffusion_lineaire
where grille_id is null;

-- ============================================================
-- PARTIE B — seulement si la vérification ci-dessus a renvoyé 0
-- ============================================================

-- 5. NOT NULL désormais sûr : toutes les diffusions ont une grille.
alter table diffusion_lineaire alter column grille_id set not null;

-- 6. historique_action : colonne grille_id, nullable — seul l'écran GRILLE_LINEAIRE
--    s'en sert (GRILLE_TYPE continue de fonctionner sans, comme aujourd'hui). Les
--    actions enregistrées AVANT cette migration (grille_id NULL) ne réapparaîtront
--    plus dans aucune pile une fois le filtre par grille actif — acceptable, c'est
--    un historique de PoC ("Table de taille PoC", commentaire migration-p19b.sql).
alter table historique_action
  add column if not exists grille_id uuid references grille(id) on delete cascade;

create index if not exists historique_action_grille_idx
  on historique_action (grille_id, cree_le) where grille_id is not null;
