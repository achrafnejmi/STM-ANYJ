-- Snomark — migration P13 (M3 : grille type).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p11.sql.
-- Additive uniquement (P12 n'a nécessité aucune migration).

create table if not exists bloc_grille_type (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid not null references chaine(id),
  nom text not null,
  heure_debut time not null,
  heure_fin time not null,
  jours integer[] not null,        -- 0=lundi..6=dimanche (même convention que semaine.js/P11)
  frequence text not null default 'Quotidien' check (frequence in ('Quotidien', 'Hebdo')),
  genre_attendu text not null,     -- liste fermée des 9 genres (genres.js) ; pas de check DB, même précédent que programme.genre
  cree_le timestamptz not null default now()
);

-- Pas de contrainte d'unicité ni de check anti-chevauchement : EXG-M3-07
-- autorise explicitement deux blocs qui se chevauchent (variantes saisonnières).

alter table bloc_grille_type enable row level security;

create policy "anon_all_bloc_grille_type" on bloc_grille_type for all to anon
  using (true) with check (true);
