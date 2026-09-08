-- Snomark — migration P49 : BA/spots enrichis (genre, fenêtre de validité, PAD).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p48.sql.
-- Additive. Les 3 attributs vivent sur la DÉFINITION du spot (spot_bibliotheque),
-- pas sur les éléments posés (element_secondaire) — relus en direct à l'insertion.
-- Modèle de fenêtre permissif calqué sur fenetre_droits : bornes nullables,
-- absence de borne = toujours valide de ce côté. `pad` défaut false : matériel
-- non livré tant que non validé (garde-fou dur à l'insertion, cf. P38a).

alter table spot_bibliotheque add column if not exists genre text;
alter table spot_bibliotheque add column if not exists validite_debut date;
alter table spot_bibliotheque add column if not exists validite_fin date;
alter table spot_bibliotheque add column if not exists pad boolean not null default false;

alter table spot_bibliotheque drop constraint if exists spot_bibliotheque_validite_ck;
alter table spot_bibliotheque add constraint spot_bibliotheque_validite_ck
  check (validite_debut is null or validite_fin is null or validite_fin >= validite_debut);
