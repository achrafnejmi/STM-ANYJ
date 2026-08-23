-- Snomark — migration P22 (modèle d'exclusivité).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run.
--
-- Un programme est désormais partagé par toutes les chaînes par défaut ;
-- chaine_id NULL = partagé, non NULL = exclusif à cette chaîne. Aucune donnée
-- existante n'est rebasculée : tous les programmes déjà en base gardent leur
-- chaine_id actuel (donc restent exclusifs à leur chaîne actuelle) tant qu'on
-- ne les édite pas explicitement.

-- 1. chaine_id redevient nullable (obligatoire depuis migration-p9b.sql).
alter table programme alter column chaine_id drop not null;

-- 2. La colonne exclusivite n'a jamais été lue par le code (juste stockée
--    depuis schema.sql, jamais consultée pour une logique de scoping) —
--    chaine_id IS NOT NULL est désormais l'unique source de vérité de
--    l'exclusivité, pas la peine de garder un état redondant.
alter table programme drop column if exists exclusivite;

-- 3. La contrainte unique (titre, chaine_id) (migration-p9b.sql) ne bloque pas
--    deux programmes partagés avec le même titre : Postgres traite deux NULL
--    comme distincts dans un UNIQUE multi-colonnes. Index partiel dédié au cas
--    partagé (chaine_id NULL) ; le cas exclusif reste couvert par la
--    contrainte existante, inchangée.
create unique index if not exists programme_titre_partage_key
  on programme (titre) where chaine_id is null;
