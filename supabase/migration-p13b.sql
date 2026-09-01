-- Snomark — migration P13b (Grille type : types de bloc).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p13.sql.
-- Additive uniquement.

alter table bloc_grille_type add column if not exists type_bloc text
  check (type_bloc in (
    'Matinale', 'Jeunesse', 'Mi-journée', 'Info midi', 'Après-midi',
    'Religieux', 'Access', 'Prime', 'Deuxième partie'
  ));

-- Nullable volontairement : les blocs déjà en base n'ont pas ce concept, le
-- rendu retombe sur couleurGenre(genre_attendu) si type_bloc est vide.
-- genre_attendu reste inchangé (sert toujours l'écart de genre M3-05).
