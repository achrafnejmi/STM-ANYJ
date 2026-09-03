-- Snomark — migration P39 : nouveau rôle « Gestion des droits et du stock ».
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p38.sql.
-- Additive uniquement.

-- 1. Rôle ajouté à la contrainte CHECK (9 rôles métier).
alter table utilisateur drop constraint if exists utilisateur_role_check;
alter table utilisateur add constraint utilisateur_role_check check (role in (
  'SUPER_ADMIN', 'ADMIN_CHAINE', 'PROGRAMMATEUR', 'ACQUISITIONS', 'GESTION_DROITS_STOCK',
  'DOCUMENTALISTE', 'REDACTEUR', 'CONTROLE_PAD', 'MARKETING'));

-- 2. Réaffectation des comptes de démonstration.
--    Oumnia : Programmateur -> Gestion des droits et du stock.
update utilisateur set role = 'GESTION_DROITS_STOCK' where nom_utilisateur = 'oumnia.prog';
--    Younes : Administrateur de chaîne -> Programmateur (sa chaîne d'affectation
--    devient sans objet pour ce rôle).
update utilisateur set role = 'PROGRAMMATEUR', chaine_id = null where nom_utilisateur = 'younes.admin';
--    Fatine : inchangée (Chargé d'acquisitions).
