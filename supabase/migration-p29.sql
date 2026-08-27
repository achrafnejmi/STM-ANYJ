-- Snomark — migration P29 (Notifications).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p28.sql.
-- Additive uniquement.

create table if not exists notification (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid not null references chaine(id),
  type text not null check (type in ('NOUVEAU_PROGRAMME', 'DROITS_PROCHES')),
  programme_id uuid references programme(id) on delete cascade,
  fenetre_droits_id uuid references fenetre_droits(id) on delete cascade,
  message text not null,
  lu boolean not null default false,
  cree_le timestamptz not null default now()
);

-- Empêche de recréer la même alerte à chaque réconciliation/visite (P29 :
-- NOUVEAU_PROGRAMME est écrit une fois à la création ; DROITS_PROCHES est
-- réconcilié au chargement — les deux index partiels évitent les doublons
-- dans chacun des deux cas).
create unique index if not exists notification_nouveau_uniq
  on notification (chaine_id, programme_id) where type = 'NOUVEAU_PROGRAMME';
create unique index if not exists notification_droits_uniq
  on notification (chaine_id, fenetre_droits_id) where type = 'DROITS_PROCHES';

alter table notification enable row level security;

create policy "anon_all_notification" on notification for all to anon
  using (true) with check (true);
