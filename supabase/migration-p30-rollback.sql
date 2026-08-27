-- Snomark — migration P30 rollback (Annuler/Rétablir : Grille non-linéaire).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p30.sql.
-- Additive uniquement (élargit une contrainte CHECK existante).

alter table historique_action drop constraint if exists historique_action_ecran_check;
alter table historique_action add constraint historique_action_ecran_check
  check (ecran in ('GRILLE_LINEAIRE', 'GRILLE_TYPE', 'PLAN_MEDIA', 'GRILLE_NON_LINEAIRE_RESEAUX', 'GRILLE_NON_LINEAIRE_VOD'));
