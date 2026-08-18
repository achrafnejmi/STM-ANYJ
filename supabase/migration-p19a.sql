-- Phase 19a — Administration (nomenclatures) : Genres + Tranches d'antenne.
-- Remplace les constantes en dur de src/lib/genres.js et src/lib/tranches.js
-- par deux tables éditables depuis l'écran Administration. Additif pur :
-- aucune colonne existante modifiée (programme.genre, bloc_grille_type.genre_attendu,
-- diffusion_lineaire.genre, campagne.tranches_ciblees restent des colonnes
-- texte libre, la valeur qui y est stockée aujourd'hui devient la clé
-- naturelle de correspondance avec ces nouvelles tables).

create table if not exists genre (
  id uuid primary key default gen_random_uuid(),
  libelle_fr text not null unique,
  libelle_ar text not null,
  couleur_token text not null,
  ordre integer not null default 0
);

alter table genre enable row level security;

create policy anon_all_genre on genre for all using (true) with check (true);

-- Seed identique aux 9 valeurs codées en dur avant cette migration
-- (src/lib/genres.js + src/lib/couleursGenre.js) — zéro changement de
-- comportement au moment de l'exécution.
insert into genre (libelle_fr, libelle_ar, couleur_token, ordre) values
  ('Information', 'أخبار', 'rouge', 0),
  ('Magazine', 'مجلة', 'cyan', 1),
  ('Série', 'مسلسل', 'bleu', 2),
  ('Film', 'فيلم', 'orange', 3),
  ('Documentaire', 'وثائقي', 'turquoise', 4),
  ('Sport', 'رياضة', 'vert', 5),
  ('Jeunesse', 'أطفال', 'rose', 6),
  ('Religieux', 'ديني', 'indigo', 7),
  ('Divertissement', 'ترفيه', 'violet', 8)
on conflict (libelle_fr) do nothing;

create table if not exists tranche_antenne (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  libelle_fr text not null,
  libelle_ar text not null,
  debut_minutes integer not null,
  fin_minutes integer not null,
  ordre integer not null default 0
);

alter table tranche_antenne enable row level security;

create policy anon_all_tranche_antenne on tranche_antenne for all using (true) with check (true);

-- Seed identique aux 5 tranches codées en dur avant cette migration
-- (src/lib/tranches.js, minutes depuis 06:00 = début de la journée
-- d'antenne). Les libellés arabes n'existaient nulle part dans le code —
-- traductions proposées, éditables immédiatement depuis Administration si un
-- terme plus adapté au vocabulaire broadcast est préféré.
insert into tranche_antenne (code, libelle_fr, libelle_ar, debut_minutes, fin_minutes, ordre) values
  ('MATIN', 'Matin', 'صباح', 360, 720, 0),
  ('JOURNEE', 'Journée', 'نهار', 720, 1080, 1),
  ('ACCESS', 'Access', 'بداية الذروة', 1080, 1245, 2),
  ('PRIME', 'Prime', 'الذروة', 1245, 1440, 3),
  ('NUIT', 'Nuit', 'ليل', 1440, 1800, 4)
on conflict (code) do nothing;
