-- Snomark — migration P22b (correctif : chaine texte doit aussi devenir nullable).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run.
--
-- migration-p22.sql a rendu chaine_id (FK) nullable mais a oublié la colonne
-- texte historique programme.chaine (schema.sql : `chaine text not null`),
-- gardée « pour l'affichage uniquement » depuis P9b. Un programme partagé
-- envoie désormais chaine = null (comme chaine_id) — bloqué par cette
-- contrainte NOT NULL restée en place.

alter table programme alter column chaine drop not null;
