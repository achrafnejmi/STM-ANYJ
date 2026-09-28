-- Snomark — migration P54 : lien Mplanner sur la fiche programme.
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p53.sql.
-- Additive / idempotent. Mplanner est une application externe qui gère et
-- calcule les ressources (coût, acteurs…) des productions INTERNES. Un simple
-- lien (URL), saisi et affiché sur l'onglet Général de la fiche programme,
-- visible uniquement pour les programmes en production interne. Aucun
-- rattachement/API : juste un pointeur vers l'outil externe.

alter table programme add column if not exists lien_mplanner text;
