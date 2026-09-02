-- Snomark — migration P36 / P35b (Bible & Synopsis, PoC).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p35.sql.
-- Additive uniquement.

-- Une « bible » par programme : le PDF descriptif déposé par le Documentaliste,
-- son texte OCR (SIMULÉ en démo) et le synopsis FR/AR (généré, SIMULÉ en démo).
create table bible (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null unique references programme(id) on delete cascade,
  fichier_chemin text,
  ocr_texte text,
  synopsis_fr text,
  synopsis_ar text,
  cree_par text,
  cree_le timestamptz not null default now()
);

alter table bible enable row level security;
create policy anon_all_bible on bible for all using (true) with check (true);

-- Bucket de stockage du PDF (miroir du bucket 'attestations', migration-p7.sql).
insert into storage.buckets (id, name, public) values ('bibles', 'bibles', true)
  on conflict (id) do nothing;
create policy anon_all_bibles on storage.objects for all
  using (bucket_id = 'bibles') with check (bucket_id = 'bibles');
