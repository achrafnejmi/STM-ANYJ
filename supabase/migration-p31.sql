-- Snomark — migration P31 (Insertion manuelle « hors coupure » au Plan média).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p30.sql.
-- Additive uniquement.

-- La grille linéaire live pouvant être incomplète au moment où l'on compose le
-- Plan média, un BA / spot / écran publicitaire doit pouvoir être placé
-- librement dans la journée d'antenne (06:00 → 06:00) sans être ancré à une
-- transmission précise. On relâche donc le NOT NULL sur apres_transmission_id :
--   apres_transmission_id renseigné  → élément placé dans une coupure (inchangé) ;
--   apres_transmission_id NULL       → élément « hors coupure », rattaché à la
--                                      seule journée d'antenne (colonne `date`).
-- Le ON DELETE CASCADE de la clé étrangère est conservé (sans effet quand NULL).
alter table element_secondaire alter column apres_transmission_id drop not null;
