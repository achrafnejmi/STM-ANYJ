-- Snomark — migration P38 : retrait des rôles hérités P30 (UTILISATEUR, ADMIN).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p37.sql.
-- Additive uniquement.

-- 1. Purge des comptes de test hérités (fixtures des phases précédentes).
delete from utilisateur where nom_utilisateur in (
  'Achraf Nejmi',
  'test.admin.shot', 'test.admin.shot2', 'test.fixes.e2e',
  'test.p30.e2e', 'test.p31.visual', 'test.p31.visual2'
);

-- 2. Filet : tout compte encore sur un rôle hérité bascule sur un rôle métier
--    (empêche l'échec de la nouvelle contrainte CHECK ci-dessous).
update utilisateur set role = 'PROGRAMMATEUR' where role in ('UTILISATEUR', 'ADMIN');

-- 3. Contrainte resserrée aux 8 rôles métier + défaut de colonne aligné
--    (l'ancien défaut 'UTILISATEUR' de migration-p30 n'est plus valide).
alter table utilisateur drop constraint if exists utilisateur_role_check;
alter table utilisateur add constraint utilisateur_role_check check (role in (
  'SUPER_ADMIN', 'ADMIN_CHAINE', 'PROGRAMMATEUR', 'ACQUISITIONS',
  'DOCUMENTALISTE', 'REDACTEUR', 'CONTROLE_PAD', 'MARKETING'));
alter table utilisateur alter column role set default 'PROGRAMMATEUR';
