-- Snomark — migration P34 (Règles Plan média : annonces intra-programme).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p33.sql.
-- Additive uniquement.

-- Une règle place désormais des annonces ENTRE les programmes (colonne
-- existante `nombre_annonces`, dans la coupure qui suit la transmition) ET
-- DANS le programme (`annonces_intra`, réparties uniformément sur sa durée).
alter table regle_plan_media add column if not exists annonces_intra integer not null default 0;
