-- Snomark — migration P53 : compte démo « Ilyas » (rapport de volume horaire, P40).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p52.sql.
-- Additive / idempotent. Aucune table : le rapport de volume horaire est
-- entièrement recalculé à la demande depuis la pige (diffusion_reelle) et le
-- catalogue — rien à persister, rien à migrer côté schéma.
--
-- Ilyas produit le rapport d'activité de programmation (volume horaire réellement
-- diffusé, par genre et par programme). Rôle AUDIT, comme Taoufik
-- (`taoufik.audit`, migration-p48) : consultation et édition de rapports, aucune
-- écriture sur la programmation. `chaine_id` à null — le rapport est édité
-- chaîne par chaîne, il doit pouvoir changer de chaîne active (pas de verrou,
-- cf. chaineVerrouillee / P48).
--
-- RATTRAPAGE : une première version de cette migration créait `ilyas.prog` avec
-- le rôle PROGRAMMATEUR (erreur sur le rôle d'Ilyas). Si elle a déjà été jouée,
-- la ligne est supprimée ici — aucune FK ne pointe vers `utilisateur`
-- (`cree_par`, `demandeur`… sont du texte libre), rien ne casse. Rejouer ce
-- fichier converge vers le bon état dans les deux cas.

delete from utilisateur where nom_utilisateur = 'ilyas.prog';

insert into utilisateur (nom_utilisateur, nom_affiche, role, chaine_id) values
  ('ilyas.audit', 'Ilyas Elalaoui', 'AUDIT', null)
on conflict (nom_utilisateur) do nothing;
