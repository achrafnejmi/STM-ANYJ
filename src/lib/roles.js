// Rôles multi-utilisateurs (P35, PoC démo). SIMULATION du workflow métier :
// l'app masque/montre les écrans et actions selon le rôle choisi au login.
// AUCUNE vraie barrière de sécurité (pas de mot de passe, RLS ouvertes) — la
// vraie auth Supabase viendra en production. Ce fichier est le POINT UNIQUE de
// définition « quel rôle voit quoi ».

export const ROLES = [
  { code: 'SUPER_ADMIN', label: 'Super Administrateur' },
  { code: 'ADMIN_CHAINE', label: 'Administrateur de chaîne' },
  { code: 'PROGRAMMATEUR', label: 'Programmateur' },
  { code: 'ACQUISITIONS', label: "Chargé d'acquisitions" },
  { code: 'GESTION_DROITS_STOCK', label: 'Gestion des droits et du stock' },
  { code: 'DOCUMENTALISTE', label: 'Documentaliste' },
  { code: 'REDACTEUR', label: 'Rédacteur' },
  { code: 'CONTROLE_PAD', label: 'Contrôle PAD' },
  { code: 'MARKETING', label: 'Marketing / Digital' },
]

// Toutes les sections connues (les 3 dernières n'existent qu'à partir de P35b/c
// dans navigation.js ; les lister ici à l'avance est sans effet — le filtrage
// se fait par intersection avec SECTIONS).
const TOUTES = [
  'ACCUEIL',
  'PROGRAMMES',
  'CONTRATS',
  'GRILLE_TYPE',
  'GRILLE_LINEAIRE',
  'AUTO_PROGRAMMATION',
  'PLAN_MEDIA',
  'GRILLE_NON_LINEAIRE',
  'CONDUCTEUR',
  'ADMINISTRATION',
  'BIBLE',
  'SYNOPSIS',
  'CONTROLE_PAD',
]

export const SECTIONS_PAR_ROLE = {
  SUPER_ADMIN: TOUTES,
  ADMIN_CHAINE: [
    'ACCUEIL',
    'PROGRAMMES',
    'CONTRATS',
    'GRILLE_TYPE',
    'GRILLE_LINEAIRE',
    'AUTO_PROGRAMMATION',
    'PLAN_MEDIA',
    'GRILLE_NON_LINEAIRE',
    'CONDUCTEUR',
    'ADMINISTRATION',
  ],
  PROGRAMMATEUR: ['GRILLE_TYPE', 'GRILLE_LINEAIRE'],
  ACQUISITIONS: ['PROGRAMMES', 'CONTRATS'],
  // Comme ACQUISITIONS pour les écrans (Programmes + Contrats & droits), mais
  // c'est le seul rôle (avec le Super Admin) habilité à émettre une nouvelle
  // demande de validation PAD depuis le panneau Épisodes — cf. peutDemanderPad.
  GESTION_DROITS_STOCK: ['PROGRAMMES', 'CONTRATS'],
  DOCUMENTALISTE: ['BIBLE'],
  REDACTEUR: ['SYNOPSIS'],
  CONTROLE_PAD: ['CONTROLE_PAD'],
  MARKETING: ['ACCUEIL', 'GRILLE_NON_LINEAIRE'],
}

// `role` peut être null pendant le chargement async → fallback « tout » pour
// éviter un flash de Sidebar vide ; la garde de route dans App.jsx n'agit
// qu'une fois le rôle réellement connu.
export function sectionsAutorisees(role) {
  return SECTIONS_PAR_ROLE[role] ?? TOUTES
}

export function peutVoirSection(role, sectionId) {
  return sectionsAutorisees(role).includes(sectionId)
}

// Première section autorisée présente dans `sectionsExistantes` (les ids de
// navigation.js) — cible de redirection quand la section courante est interdite.
export function premiereSection(role, sectionsExistantes) {
  const autorisees = sectionsAutorisees(role)
  return autorisees.find((id) => sectionsExistantes.includes(id)) ?? 'ACCUEIL'
}

export function chaineVerrouillee(role) {
  return role === 'ADMIN_CHAINE'
}

// Émission d'une nouvelle demande de validation PAD (bouton du panneau
// Épisodes) : réservée à la Gestion des droits et du stock, plus le Super
// Administrateur qui voit tout.
export function peutDemanderPad(role) {
  return role === 'GESTION_DROITS_STOCK' || role === 'SUPER_ADMIN'
}

export function libelleRole(code) {
  return ROLES.find((r) => r.code === code)?.label ?? code ?? ''
}
