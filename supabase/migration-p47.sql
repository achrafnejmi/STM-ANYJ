-- Snomark — migration P47 : 6e chaîne « Al Maghribia » (M1).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p46.sql.
-- Additive uniquement. id fixe, identique à src/lib/chaines.js (le front écrit
-- chaine_id sans requête supplémentaire — même convention que migration-p9).
-- Support de l'export conventionnel P41b (gabarit .pdf « format STM »,
-- journée d'antenne 07:00, gérée uniquement à l'export).

insert into chaine (id, code, nom, nom_ar, ligne_editoriale, couleur_token) values
  ('b8d6bf45-0fad-4b2c-8e03-7fe849f2d99e', 'AM', 'Al Maghribia', 'المغربية', 'Internationale', 'purple')
on conflict (id) do nothing;
