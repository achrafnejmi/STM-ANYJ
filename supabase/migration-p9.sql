-- Snomark — migration P9 (M1 : espace de travail par chaîne).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p7.sql.
-- Additive uniquement : ne modifie ni ne supprime aucune colonne/donnée existante.

create table if not exists chaine (
  id uuid primary key,
  code text not null unique,
  nom text not null unique,
  nom_ar text,
  ligne_editoriale text,
  couleur_token text not null,
  cree_le timestamptz not null default now()
);

-- id fixes, identiques à src/lib/chaines.js (pas de gen_random_uuid() ici :
-- le front doit pouvoir écrire chaine_id sans requête supplémentaire).
insert into chaine (id, code, nom, nom_ar, ligne_editoriale, couleur_token) values
  ('3d1c71e4-25e6-48fc-8072-0fe9ce261550', 'AW', 'Al Aoula',  'الأولى',   'Généraliste nationale', 'red'),
  ('948307a6-2c6e-4c2e-a46c-da9ca7d75611', 'AR', 'Arryadia',  'الرياضية', 'Sport',                  'green'),
  ('20fd7905-7f60-4d11-8c62-274aef1f5bb9', 'AT', 'Athaqafia', 'الثقافية', 'Culture et savoirs',     'cyan'),
  ('bfdaf3eb-cd99-4517-b0fa-c299fe886087', 'AS', 'Assadissa', 'السادسة',  'Religieux',               'orange'),
  ('bcc05c72-880f-4b80-a9bc-b915637ff813', 'TM', 'Tamazight', 'تمازيغت',  'Amazighe',                'blue')
on conflict (id) do nothing;

alter table programme add column if not exists chaine_id uuid references chaine(id);
alter table diffusion_lineaire add column if not exists chaine_id uuid references chaine(id);

-- Backfill best-effort (insensible à la casse/espaces) : les lignes dont la
-- valeur texte ne correspond à aucune des 5 chaînes officielles gardent
-- chaine_id = null, sans erreur ni perte de la colonne texte d'origine.
update programme p set chaine_id = c.id
  from chaine c
  where lower(trim(p.chaine)) = lower(c.nom) and p.chaine_id is null;

update diffusion_lineaire d set chaine_id = c.id
  from chaine c
  where lower(trim(d.chaine)) = lower(c.nom) and d.chaine_id is null;

alter table chaine enable row level security;

create policy "anon_all_chaine" on chaine for all to anon
  using (true)
  with check (true);
