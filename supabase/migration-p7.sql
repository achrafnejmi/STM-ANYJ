-- Snomark — migration P7 (fiche programme : attestation).
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après schema.sql.

alter table programme add column attestation_chemin text;

insert into storage.buckets (id, name, public)
values ('attestations', 'attestations', true)
on conflict (id) do nothing;

create policy "anon_all_attestations" on storage.objects for all to anon
  using (bucket_id = 'attestations')
  with check (bucket_id = 'attestations');
