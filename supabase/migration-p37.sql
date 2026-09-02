-- Snomark — migration P37 / P35c (Contrôle PAD & notification Marketing, PoC).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p36.sql.
-- Additive uniquement.

-- Demande de validation PAD : un programmateur signale un épisode non-PAD dont
-- il aurait besoin ; le rôle Contrôle PAD la traite (accepte → episode.pad=true,
-- ou refuse). Circuit simplifié pour la démo.
create table demande_pad (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid not null references chaine(id),
  programme_id uuid not null references programme(id) on delete cascade,
  episode_id uuid not null references episode(id) on delete cascade,
  demandeur text not null,
  motif text,
  statut text not null default 'EN_ATTENTE' check (statut in ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE')),
  traite_par text,
  traite_le timestamptz,
  cree_le timestamptz not null default now()
);

alter table demande_pad enable row level security;
create policy anon_all_demande_pad on demande_pad for all using (true) with check (true);

-- Nouveau type de notification : une publication non-linéaire passée à PUBLIÉ
-- (destinée au rôle Marketing / Digital — non ciblée par utilisateur, la table
-- notification restant scopée par chaîne).
alter table notification drop constraint if exists notification_type_check;
alter table notification add constraint notification_type_check
  check (type in ('NOUVEAU_PROGRAMME', 'DROITS_PROCHES', 'PUBLICATION_NON_LINEAIRE'));
