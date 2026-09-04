-- Snomark — migration P42 : rédaction du synopsis séparée FR / AR (deux rôles).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p41.sql.
-- Additive uniquement.

-- 1. Le rôle REDACTEUR devient REDACTEUR_FR / REDACTEUR_AR.
alter table utilisateur drop constraint if exists utilisateur_role_check;
update utilisateur set role = 'REDACTEUR_FR' where role = 'REDACTEUR';   -- salma.redac
alter table utilisateur add constraint utilisateur_role_check check (role in (
  'SUPER_ADMIN', 'ADMIN_CHAINE', 'PROGRAMMATEUR', 'ACQUISITIONS', 'GESTION_DROITS_STOCK',
  'DOCUMENTALISTE', 'REDACTEUR_FR', 'REDACTEUR_AR', 'CONTROLE_PAD', 'MARKETING'));

-- 2. Compte de démonstration pour la rédactrice arabe (nom affiché : placeholder éditable).
insert into utilisateur (nom_utilisateur, nom_affiche, role, chaine_id) values
  ('khadija.redac', 'Khadija Idrissi', 'REDACTEUR_AR', null)
on conflict (nom_utilisateur) do nothing;
