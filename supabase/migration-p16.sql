-- Snomark — migration P16 (M5 : plan média — campagnes, habillage, écrans pub).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p15.sql.
-- Additive uniquement.

create table if not exists campagne (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid not null references chaine(id),
  programme_id uuid not null references programme(id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  objectif integer not null,
  priorite text not null default 'NORMALE' check (priorite in ('HAUTE', 'NORMALE', 'BASSE')),
  max_par_jour integer not null,
  separation_minutes integer not null default 0,
  tranches_ciblees text[] not null default '{}',
  cree_le timestamptz not null default now()
);

-- Élément secondaire : distinct de diffusion_lineaire (Transmission), « rattaché »
-- à celle qui le précède (apres_transmission_id) — sert à reconstituer l'ordre
-- dans le futur Conducteur (P17). heure_debut/heure_fin/duree_secondes sont
-- stockées explicitement bien que le modèle conceptuel du cahier (§6.1) ne liste
-- qu'une durée : diffusion_lineaire fait déjà ce même choix d'implémentation
-- physique pour heure_fin (absente elle aussi du modèle conceptuel de
-- Transmission), et RG-M5-03 (séparation en minutes) a besoin d'une position
-- comparable sans recalcul à chaque vérification.
create table if not exists element_secondaire (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid not null references chaine(id),
  date date not null,
  heure_debut time not null,
  heure_fin time not null,
  duree_secondes integer not null,
  apres_transmission_id uuid not null references diffusion_lineaire(id) on delete cascade,
  type text not null check (type in ('BANDE_ANNONCE', 'ECRAN_PUBLICITAIRE', 'HABILLAGE', 'AUTOPROMOTION')),
  libelle text,
  -- set null (pas cascade) : supprimer une campagne ne doit pas effacer les
  -- diffusions déjà passées à l'antenne, seulement détacher leur origine.
  campagne_id uuid references campagne(id) on delete set null,
  origine text not null default 'MANUELLE' check (origine in ('MANUELLE', 'AUTOMATIQUE')),
  run_id uuid
);
create index if not exists element_secondaire_run_id_idx on element_secondaire(run_id) where run_id is not null;
create index if not exists element_secondaire_apres_transmission_idx on element_secondaire(apres_transmission_id);

alter table campagne enable row level security;
alter table element_secondaire enable row level security;
create policy "anon_all_campagne" on campagne for all to anon using (true) with check (true);
create policy "anon_all_element_secondaire" on element_secondaire for all to anon using (true) with check (true);
