-- Snomark — migration P11 (M2 tranche 2/3 : Inspecteur de bloc — Vecteur).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p10.sql.
--
-- NULL = diffusion unifiée (TNT+Satellite), le cas par défaut (RG-10). Seules
-- les lignes issues d'une scission (onglet Vecteur) portent une valeur
-- explicite. Pas de colonne de liaison entre les 2 lignes scindées — limite
-- assumée (RG-14 se fait manuellement pour cette tranche, voir plan P11).
alter table diffusion_lineaire add column vecteur text check (vecteur in ('TNT', 'SATELLITE'));
