-- Snomark — migration P15 (M4 : auto-programmation).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p14b.sql.
-- Additive uniquement.

-- RG-17 : chaque transmission conserve son origine. Le défaut 'MANUELLE' est
-- exact pour toutes les lignes pré-P15 (aucun moteur auto n'existait avant
-- cette phase) — pas seulement une valeur sûre par défaut.
alter table diffusion_lineaire add column if not exists origine text not null default 'MANUELLE'
  check (origine in ('MANUELLE', 'AUTOMATIQUE'));

-- RG-16 : une génération automatique compte pour une opération unique — run_id
-- marque les lignes d'un même run pour annulation groupée (pas une entité
-- "run" à part entière, juste une étiquette partagée, cohérent avec le reste
-- du projet qui évite les tables superflues).
alter table diffusion_lineaire add column if not exists run_id uuid;
create index if not exists diffusion_lineaire_run_id_idx on diffusion_lineaire(run_id) where run_id is not null;

-- Règles par titre (§4.5.3 du cahier). Nullable : une valeur NULL se voit
-- appliquer le défaut dépendant du genre (Série/Jeunesse) au moment de
-- l'exécution, côté moteur (autoprog.js) — pas de valeur figée en base pour
-- les titres jamais configurés.
alter table programme add column if not exists autoprog_actif boolean not null default true;
alter table programme add column if not exists autoprog_separation_jours integer;
alter table programme add column if not exists autoprog_diffusions_max integer;
alter table programme add column if not exists autoprog_ordre text
  check (autoprog_ordre in ('SEQUENTIEL', 'RECENCE'));

-- Pas de nouvelle table, pas de nouvelle policy RLS : colonnes sur des tables
-- déjà couvertes par anon_all_programme / anon_all_diffusion_lineaire.
