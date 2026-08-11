-- Snomark — migration P10 (M2 tranche 1/3 : Plan de diffusion).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p9b.sql.
--
-- 1. Renommage segment → episode (cohérence avec le vocabulaire du cahier).
--    Base vérifiée à 0 ligne au moment de l'écriture de cette migration :
--    renommage pur, aucune donnée à migrer.
alter table segment rename to episode;
alter policy "anon_all_segment" on episode rename to "anon_all_episode";

-- 2. Une transmission référence désormais l'épisode précis diffusé (pas
--    seulement le programme). diffusion_lineaire vérifiée à 0 ligne au moment
--    de l'écriture de cette migration : NOT NULL directement, sans étape
--    intermédiaire nullable (si ce n'est plus vrai à l'exécution, Postgres
--    refusera la colonne et il faudra revoir cette hypothèse plutôt que
--    contourner l'erreur).
alter table diffusion_lineaire add column episode_id uuid not null references episode(id);

-- 3. Numéro d'épisode dénormalisé sur la transmission (même rôle que
--    titre_cache existant) : évite de recharger tous les épisodes de tous les
--    programmes de la chaîne juste pour étiqueter les blocs de la grille.
alter table diffusion_lineaire add column episode_numero integer;
