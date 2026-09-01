-- Snomark — migration P33 (Bibliothèque de règles Plan média, plusieurs règles par chaîne).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p32.sql.
-- Additive uniquement.

-- P32 posait UNE règle par chaîne (index unique sur chaine_id). Le client veut
-- une VÉRITABLE bibliothèque : plusieurs règles nommées, chacune activable
-- indépendamment pour la génération auto (toutes les règles actives
-- s'appliquent, empilées), et sélectionnable individuellement pour
-- l'application manuelle (onglet Composition). On lève donc la contrainte
-- d'unicité et on ajoute nom + genres ciblés.
drop index if exists regle_plan_media_chaine_unique;

alter table regle_plan_media add column if not exists nom text not null default 'Règle';
-- Genres ciblés par la règle (libellés FR, table genre) — vide = tous genres.
alter table regle_plan_media add column if not exists genres text[] not null default '{}';

create index if not exists regle_plan_media_chaine_idx on regle_plan_media(chaine_id);
