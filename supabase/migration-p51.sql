-- Snomark — migration P51 : cadre publicitaire quotidien (saisie du conducteur de pub).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p50.sql.
-- Additive. Un cadre = la liste des écrans publicitaires prévus pour une chaîne
-- et une date (nb de spots + durée de tranche), saisie par la régie pub. Aucun
-- lien avec les element_secondaire déjà placés à ce stade (P39a = saisie seule).

create table cadre_pub_ecran (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid not null references chaine(id) on delete cascade,
  date date not null,
  ordre integer not null default 0,
  nom text,                                 -- libellé libre, ex. « Ecran 09:30 »
  heure_previsionnelle time,                -- ex. 09:30:00
  contexte text,                            -- ex. « AVANT DOCUMENTAIRE ... »
  nb_spots integer not null default 0,
  duree_tranche_secondes integer,           -- durée totale de la coupure, ex. 47
  cree_par text,
  cree_le timestamptz not null default now()
);
alter table cadre_pub_ecran enable row level security;
create policy anon_all_cadre_pub_ecran on cadre_pub_ecran for all using (true) with check (true);
