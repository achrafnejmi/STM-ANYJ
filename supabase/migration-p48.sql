-- Snomark — migration P48 : respect de la grille type — marqueur d'override.
-- À exécuter dans Supabase : Dashboard → SQL Editor → coller → Run, après migration-p47.sql.
-- Additive uniquement. `ecart_grille_type_accepte` = true quand l'utilisateur a
-- confirmé « programmer quand même » malgré un genre non conforme au bloc de
-- grille type actif (P43 partie A). Défaut false : lignes existantes et
-- placements auto-programmés restent « non signalés au dépôt ».

alter table diffusion_lineaire
  add column if not exists ecart_grille_type_accepte boolean not null default false;
