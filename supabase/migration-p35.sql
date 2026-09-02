-- Snomark — migration P35a (Système de rôles multi-utilisateurs, PoC).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p34.sql.
-- Additive uniquement. SIMULATION de workflow métier pour la démo — PAS de vraie
-- sécurité : aucune RLS restreinte, aucun mot de passe. La vraie auth Supabase
-- (mot de passe, RLS par rôle, auth.uid()) est reportée à la production.

-- La table utilisateur (P30) passe de 2 rôles à 8, + nom affiché distinct de
-- l'identifiant technique (PK), + chaîne d'affectation pour l'Administrateur de chaîne.
alter table utilisateur add column if not exists nom_affiche text;
alter table utilisateur add column if not exists chaine_id uuid references chaine(id);

alter table utilisateur drop constraint if exists utilisateur_role_check;
alter table utilisateur add constraint utilisateur_role_check check (role in (
  'SUPER_ADMIN', 'ADMIN_CHAINE', 'PROGRAMMATEUR', 'ACQUISITIONS', 'DOCUMENTALISTE',
  'REDACTEUR', 'CONTROLE_PAD', 'MARKETING',
  'ADMIN', 'UTILISATEUR'   -- rétro-compat P30, le temps de migrer
));

-- Reprise de la ligne seed P30 ('Achraf Nejmi' / ADMIN) → identifiant technique + SUPER_ADMIN.
update utilisateur set nom_utilisateur = 'achraf.nejmi' where nom_utilisateur = 'Achraf Nejmi';
update utilisateur
  set role = 'SUPER_ADMIN', nom_affiche = coalesce(nom_affiche, 'Achraf Nejmi')
  where nom_utilisateur = 'achraf.nejmi';

-- Utilisateurs de démo (un par rôle). Noms affichés = placeholders éditables
-- depuis l'écran Administration.
insert into utilisateur (nom_utilisateur, nom_affiche, role, chaine_id) values
  ('achraf.nejmi',  'Achraf Nejmi',      'SUPER_ADMIN',    null),
  ('younes.admin',  'Younes El Idrissi', 'ADMIN_CHAINE',   '3d1c71e4-25e6-48fc-8072-0fe9ce261550'), -- Al Aoula
  ('oumnia.prog',   'Oumnia Bennani',    'PROGRAMMATEUR',  null),
  ('fatine.acq',    'Fatine Alaoui',     'ACQUISITIONS',   null),
  ('karim.doc',     'Karim Ouazzani',    'DOCUMENTALISTE', null),
  ('salma.redac',   'Salma Cherkaoui',   'REDACTEUR',      null),
  ('nabil.pad',     'Nabil Tazi',        'CONTROLE_PAD',   null),
  ('imane.digital', 'Imane Berrada',     'MARKETING',      null)
on conflict (nom_utilisateur) do nothing;
