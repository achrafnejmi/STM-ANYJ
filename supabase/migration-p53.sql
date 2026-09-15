-- Snomark — migration P53 : compte démo « Ilyas » (rapport de volume horaire, P40).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p52.sql.
-- Additive / idempotent. Aucune table : le rapport de volume horaire est
-- entièrement recalculé à la demande depuis la pige (diffusion_reelle) et le
-- catalogue — rien à persister, rien à migrer côté schéma.
--
-- Ilyas produit le rapport d'activité de programmation (volume horaire réellement
-- diffusé, par genre et par programme). Rôle PROGRAMMATEUR : il a déjà le contexte
-- de programmation (grille, plan média, conducteur, pige en lecture seule).
-- `chaine_id` à null : le rapport est édité chaîne par chaîne, il doit pouvoir
-- changer de chaîne active (pas de verrou, cf. chaineVerrouillee / P48).

insert into utilisateur (nom_utilisateur, nom_affiche, role, chaine_id) values
  ('ilyas.prog', 'Ilyas Elalaoui', 'PROGRAMMATEUR', null)
on conflict (nom_utilisateur) do nothing;
