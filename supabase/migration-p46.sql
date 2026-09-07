-- Snomark — migration P46 : type de production interne/externe (remplace type_production).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p45.sql.
-- Partie additive : nouvelle colonne `production` (enum interne/externe, défaut INTERNE).
-- Partie NON additive (assumée) : suppression de `type_production` (P44), après
-- reprise de sa valeur — le toggle interne/externe la remplace intégralement.

alter table programme add column if not exists production text not null default 'INTERNE'
  check (production in ('INTERNE', 'EXTERNE'));

update programme set production = 'EXTERNE'
  where lower(coalesce(type_production, '')) in ('production externe', 'acquisition', 'coproduction');

alter table programme drop column if exists type_production;
