-- Snomark — migration P45 : publications non-linéaires rattachables à un épisode.
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p44.sql.
-- Additive uniquement. `episode_id` NULL = publication au niveau du programme entier
-- (comportement historique). `on delete set null` : supprimer l'épisode ne détruit
-- pas la publication.

alter table publication_reseau add column if not exists episode_id uuid references episode(id) on delete set null;
alter table publication_vod    add column if not exists episode_id uuid references episode(id) on delete set null;
