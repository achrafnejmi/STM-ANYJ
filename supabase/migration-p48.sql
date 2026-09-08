-- Snomark — migration P48 : respect de la grille type (P43).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p47.sql.
-- Additive / idempotent.

-- Partie A : `ecart_grille_type_accepte` = true quand l'utilisateur a confirmé
-- « programmer quand même » malgré un genre non conforme au bloc de grille type
-- actif. Défaut false : lignes existantes et placements auto-programmés restent
-- « non signalés au dépôt ».
alter table diffusion_lineaire
  add column if not exists ecart_grille_type_accepte boolean not null default false;

-- Partie B : rôle d'audit (section « Dashboard » — respect de la grille type).
-- Reprend la liste de migration-p42 + 'AUDIT'.
alter table utilisateur drop constraint if exists utilisateur_role_check;
alter table utilisateur add constraint utilisateur_role_check check (role in (
  'SUPER_ADMIN', 'ADMIN_CHAINE', 'PROGRAMMATEUR', 'ACQUISITIONS', 'GESTION_DROITS_STOCK',
  'DOCUMENTALISTE', 'REDACTEUR_FR', 'REDACTEUR_AR', 'CONTROLE_PAD', 'MARKETING', 'AUDIT'));

insert into utilisateur (nom_utilisateur, nom_affiche, role, chaine_id) values
  ('taoufik.audit', 'Taoufik', 'AUDIT', null)
on conflict (nom_utilisateur) do nothing;
