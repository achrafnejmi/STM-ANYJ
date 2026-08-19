-- Phase 19b — Undo/Rollback ciblé (Grille linéaire + Grille type).
-- Pile séquentielle persistée (jamais localStorage — CLAUDE.md réserve
-- storage.js aux données de session). Portée : diffusion_lineaire et
-- bloc_grille_type uniquement.

create table if not exists historique_action (
  id uuid primary key default gen_random_uuid(),
  chaine_id uuid not null references chaine(id),
  ecran text not null check (ecran in ('GRILLE_LINEAIRE', 'GRILLE_TYPE')),
  statut text not null default 'ACTIVE' check (statut in ('ACTIVE', 'ANNULEE', 'PERIMEE')),
  libelle text not null,
  -- operations = [{ table, type: 'INSERT'|'UPDATE'|'DELETE', id, avant, apres }, ...]
  operations jsonb not null,
  cree_par text,
  cree_le timestamptz not null default now(),
  -- Rempli à l'Annuler, vidé au Rétablir — nécessaire pour que Rétablir
  -- reprenne les entrées ANNULEE dans l'ordre inverse de LEUR annulation
  -- (qui diverge de l'ordre de création dès le 2e Annuler consécutif).
  annule_le timestamptz
);

create index if not exists historique_action_chaine_ecran_idx
  on historique_action(chaine_id, ecran, cree_le);

alter table historique_action enable row level security;

create policy anon_all_historique_action on historique_action for all using (true) with check (true);
