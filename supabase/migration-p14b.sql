-- Snomark — migration P14b (M6 : historique + métadonnées multilingues).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p14a.sql.
-- Additive uniquement.

alter table programme add column if not exists titre_en text;
alter table programme add column if not exists description_ar text;
alter table programme add column if not exists description_en text;

alter table episode add column if not exists titre_ar text;

-- Pas de nouvelle table, pas de nouvelle policy RLS : ces colonnes sont sur
-- des tables déjà couvertes par les policies anon_all_programme /
-- anon_all_episode existantes. Tout nullable, validation côté formulaire
-- (même précédent que le reste du projet).
