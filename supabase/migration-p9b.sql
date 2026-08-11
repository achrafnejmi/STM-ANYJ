-- Snomark — migration P9b (dédup et scoping alignés sur chaine_id).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p9.sql.
--
-- Prérequis vérifié manuellement avant d'écrire cette migration : 0 programme
-- avec chaine_id NULL (1 programme en base, backfillé par migration-p9.sql).
-- Si ce n'est plus vrai au moment de l'exécution, l'étape 1 échoue d'elle-même
-- (Postgres refuse la contrainte NOT NULL) — ne pas contourner l'erreur,
-- corriger les données concernées d'abord (leur donner un chaine_id valide).

-- 1. chaine_id devient obligatoire : source de vérité du scoping et du dédup,
--    la colonne texte programme.chaine reste pour l'affichage uniquement.
alter table programme alter column chaine_id set not null;

-- 2. Dédup basé sur chaine_id plutôt que sur le texte libre chaine. Le nom de
--    la contrainte texte est le nom par défaut généré par Postgres pour
--    `unique (titre, chaine)` (schema.sql) — IF EXISTS pour rester sans danger
--    si elle avait déjà été renommée/retirée.
alter table programme drop constraint if exists programme_titre_chaine_key;
alter table programme add constraint programme_titre_chaine_id_key unique (titre, chaine_id);
