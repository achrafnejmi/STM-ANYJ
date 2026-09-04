-- Snomark — migration P44 : métadonnées éditoriales de production sur le programme.
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p43.sql.
-- Additive uniquement. Champs du modèle de données du cahier des charges absents
-- de Snomark ; tout nullable, validation côté formulaire.

alter table programme add column if not exists type_production text;
alter table programme add column if not exists producteur text;
alter table programme add column if not exists realisation text;
alter table programme add column if not exists interpretes text;
alter table programme add column if not exists mots_cles text;
