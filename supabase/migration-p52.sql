-- Snomark — migration P52 : rôle « Régie publicitaire » (Abir) — conducteur de pub.
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p51.sql.
-- Additive / idempotent. Abir prépare le cadre publicitaire (cadre_pub_ecran,
-- P39a) dans la section « Conducteur de publicité » ; le Programmateur
-- (Salma / Younes) le voit en lecture seule pour élaborer le plan média — plus
-- besoin de l'envoi par mail.

alter table utilisateur drop constraint if exists utilisateur_role_check;
alter table utilisateur add constraint utilisateur_role_check check (role in (
  'SUPER_ADMIN', 'ADMIN_CHAINE', 'PROGRAMMATEUR', 'ACQUISITIONS', 'GESTION_DROITS_STOCK',
  'DOCUMENTALISTE', 'REDACTEUR_FR', 'REDACTEUR_AR', 'CONTROLE_PAD', 'MARKETING', 'AUDIT', 'REGIE_PUB'));

insert into utilisateur (nom_utilisateur, nom_affiche, role, chaine_id) values
  ('abir.regie', 'Abir', 'REGIE_PUB', null)
on conflict (nom_utilisateur) do nothing;
