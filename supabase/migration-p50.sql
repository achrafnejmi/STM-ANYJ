-- Snomark — migration P50 : demande de validation PAD d'un spot de bibliothèque.
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p49.sql.
-- Additive / idempotent. Une demande PAD (table demande_pad, circuit Contrôle PAD)
-- peut désormais cibler un spot_bibliotheque au lieu du couple (programme, épisode)
-- — même flux que pour un épisode non PAD (P38b).

alter table demande_pad add column if not exists spot_bibliotheque_id uuid
  references spot_bibliotheque(id) on delete cascade;

alter table demande_pad alter column programme_id drop not null;
alter table demande_pad alter column episode_id drop not null;

alter table demande_pad drop constraint if exists demande_pad_cible_ck;
alter table demande_pad add constraint demande_pad_cible_ck check (
  (programme_id is not null and episode_id is not null) or spot_bibliotheque_id is not null
);
