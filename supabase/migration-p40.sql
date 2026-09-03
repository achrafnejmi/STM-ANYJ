-- Snomark — migration P40 : espaces spécialisés « Gestion des droits et du
-- stock » & « Contrôle PAD » (relances + notifications routées par rôle).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p39.sql.
-- Additive uniquement.

-- 1. Suivi des relances sur une demande de validation PAD.
alter table demande_pad add column if not exists relances integer not null default 0;
alter table demande_pad add column if not exists derniere_relance_le timestamptz;

-- 2. Notifications routées : destinataire_role null = visible par toute la
--    chaîne (comportement P29 / P35c inchangé) ; sinon la cloche filtre sur le rôle.
alter table notification add column if not exists destinataire_role text;

-- 3. Circuit PAD : 3 nouveaux types de notification.
alter table notification drop constraint if exists notification_type_check;
alter table notification add constraint notification_type_check check (type in (
  'NOUVEAU_PROGRAMME', 'DROITS_PROCHES', 'PUBLICATION_NON_LINEAIRE',
  'DEMANDE_PAD', 'RELANCE_PAD', 'DECISION_PAD'));
