// Nomenclatures de l'onglet Réseaux sociaux (Grille non-linéaire, hors
// cahier, P20) — listes fermées, identiques aux CHECK constraints de
// migration-p20.sql (table publication_reseau). Codées en dur : pas
// d'administration, un ajout de plateforme/format demande une migration de
// toute façon (CHECK constraint).
export const PLATEFORMES_RESEAU = [
  { code: 'FACEBOOK', libelle: 'Facebook' },
  { code: 'INSTAGRAM', libelle: 'Instagram' },
  { code: 'TIKTOK', libelle: 'TikTok' },
  { code: 'SNAPCHAT', libelle: 'Snapchat' },
  { code: 'YOUTUBE', libelle: 'YouTube' },
]

export const FORMATS_RESEAU = [
  { code: 'POST', libelle: 'Post' },
  { code: 'REEL', libelle: 'Reel' },
  { code: 'STORY', libelle: 'Story' },
  { code: 'VIDEO', libelle: 'Vidéo' },
]
