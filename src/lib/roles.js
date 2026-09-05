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
  { code: 'REDACTEUR_FR', label: 'Rédacteur (FR)' },
  { code: 'REDACTEUR_AR', label: 'Rédacteur (AR)' },
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
  'SYNOPSIS_FR',
  'SYNOPSIS_AR',
  'PILOTAGE_DROITS_STOCK',
  'SUIVI_PAD',
  'CONTROLE_PAD',
  'DEMANDES_PROGRAMMATION',
  'BIBLES_SYNOPSIS',
  'TABLEAU_BORD_REDACTION',
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
    'DEMANDES_PROGRAMMATION',
    'ADMINISTRATION',
  ],
  // Travaille depuis la grille (principe : « la grille est le produit ») mais a
  // besoin de tout le contexte de programmation : catalogue, plan média,
  // conducteur, tableau de bord. Peut initier une demande PAD (cf.
  // peutDemanderPad) sans jamais mettre un épisode en PAD (cf. peutMettreEnPad).
  PROGRAMMATEUR: [
    'GRILLE_LINEAIRE',
    'ACCUEIL',
    'PROGRAMMES',
    'GRILLE_TYPE',
    'AUTO_PROGRAMMATION',
    'PLAN_MEDIA',
    'CONDUCTEUR',
  ],
  ACQUISITIONS: ['PROGRAMMES', 'CONTRATS'],
  // Pilote le stock, les droits et le circuit PAD (sans faire la mise en PAD) :
  // tableau de bord dédié + suivi des demandes, en plus de Programmes et
  // Contrats & droits. Seul rôle (avec le Super Admin) habilité à émettre une
  // demande de validation PAD — cf. peutDemanderPad.
  GESTION_DROITS_STOCK: ['PILOTAGE_DROITS_STOCK', 'SUIVI_PAD', 'PROGRAMMES', 'CONTRATS'],
  DOCUMENTALISTE: ['BIBLE'],
  REDACTEUR_FR: ['TABLEAU_BORD_REDACTION', 'BIBLES_SYNOPSIS', 'SYNOPSIS_FR'],
  REDACTEUR_AR: ['TABLEAU_BORD_REDACTION', 'BIBLES_SYNOPSIS', 'SYNOPSIS_AR'],
  CONTROLE_PAD: ['CONTROLE_PAD'],
  // P45 : accès à toute la section Programmes, mais en LECTURE SEULE (cf.
  // peutEditerProgramme) — Marketing / Digital consulte le catalogue et
  // surtout l'onglet Historique (diffusions linéaires + non-linéaires d'un
  // titre) ; il ne crée, n'édite ni ne supprime rien.
  MARKETING: ['ACCUEIL', 'PROGRAMMES', 'GRILLE_NON_LINEAIRE'],
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

// Verrou de chaîne : l'Administrateur de chaîne, ET tout utilisateur explicitement
// rattaché à une chaîne dans Administration (utilisateur.chaine_id non nul), sont
// forcés sur CETTE chaîne — sélecteur verrouillé côté TopBar, chaîne imposée à la
// connexion. Les comptes sans chaîne (chaine_id null) gardent le sélecteur libre.
export function chaineVerrouillee(role, utilisateur) {
  return role === 'ADMIN_CHAINE' || utilisateur?.chaine_id != null
}

// Émission d'une nouvelle demande de validation PAD (bouton du panneau
// Épisodes) : le Programmateur (qui la déclenche quand il veut programmer un
// épisode non PAD), la Gestion des droits et du stock, et le Super Admin.
export function peutDemanderPad(role) {
  return role === 'PROGRAMMATEUR' || role === 'GESTION_DROITS_STOCK' || role === 'SUPER_ADMIN'
}

// Mise en PAD directe d'un épisode (case « PAD » du panneau Épisodes) : ni le
// Programmateur ni la Gestion des droits et du stock ne le font — c'est le rôle
// de l'entité Contrôle PAD (via son écran), ou une décision d'acceptation de
// demande. Ici : le catalogage (Acquisitions), l'Admin de chaîne, le Super Admin.
export function peutMettreEnPad(role) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN_CHAINE' || role === 'ACQUISITIONS'
}

// Relance d'une demande PAD déjà en cours (suivi du circuit) : la Gestion des
// droits et du stock, plus le Super Admin. Le Programmateur, lui, ne fait
// qu'initier (peutDemanderPad).
export function peutRelancerPad(role) {
  return role === 'GESTION_DROITS_STOCK' || role === 'SUPER_ADMIN'
}

// Gestion du catalogue (P37 ; P41 : + Gestion des droits et du stock) : éditer
// l'exclusivité d'un programme, gérer supports & événements secondaires des
// épisodes. Un Programmateur ne touche pas au catalogue.
// NB : depuis P45, la création / suppression d'un programme a son propre
// périmètre (peutCreerProgramme) et l'édition de la fiche le sien
// (peutEditerProgramme).
export function peutGererCatalogue(role) {
  return (
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN_CHAINE' ||
    role === 'ACQUISITIONS' ||
    role === 'GESTION_DROITS_STOCK'
  )
}

// Créer / supprimer un programme (P45) : réservé au catalogage — Chargé
// d'acquisitions, Gestion des droits et du stock, Super Admin. L'Admin de
// chaîne ne crée ni ne supprime de programme (décision P45) ; il conserve
// l'édition des métadonnées et des épisodes (cf. peutEditerProgramme).
export function peutCreerProgramme(role) {
  return role === 'SUPER_ADMIN' || role === 'ACQUISITIONS' || role === 'GESTION_DROITS_STOCK'
}

// Éditer une fiche programme (P45) : enregistrer les onglets Général /
// Métadonnées / Droits et gérer les épisodes. Ouvert à tous les rôles qui
// atteignent la section Programmes SAUF Marketing / Digital, qui y accède en
// lecture seule pour consulter l'historique des titres.
export function peutEditerProgramme(role) {
  return (
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN_CHAINE' ||
    role === 'PROGRAMMATEUR' ||
    role === 'ACQUISITIONS' ||
    role === 'GESTION_DROITS_STOCK'
  )
}

// Initier une demande de programmation d'un titre exclusif à une autre chaîne
// (P37) : le Programmateur, plus le Super Admin.
export function peutDemanderProgrammation(role) {
  return role === 'PROGRAMMATEUR' || role === 'SUPER_ADMIN'
}

// Traiter une demande de programmation (transmettre / rejeter / approuver /
// refuser) : l'Administrateur de chaîne, plus le Super Admin.
export function peutTraiterDemandeProgrammation(role) {
  return role === 'ADMIN_CHAINE' || role === 'SUPER_ADMIN'
}

// Déposer / remplacer la bible d'un programme (panneau Métadonnées de la fiche).
// La consultation est ouverte à tous ceux qui atteignent la fiche ; le dépôt est
// réservé au catalogage, à la Gestion des droits et du stock, au Documentaliste,
// à l'Admin de chaîne et au Super Admin — pas au Programmateur.
export function peutGererBible(role) {
  return (
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN_CHAINE' ||
    role === 'ACQUISITIONS' ||
    role === 'GESTION_DROITS_STOCK' ||
    role === 'DOCUMENTALISTE'
  )
}

// Cloche de notifications (P36) : une notification sans destinataire_role est
// visible par toute la chaîne (comportement P29) ; sinon seul le rôle visé — et
// le Super Administrateur, qui supervise tout — la voit.
export function notificationVisible(notif, role) {
  return notif.destinataire_role == null || notif.destinataire_role === role || role === 'SUPER_ADMIN'
}

export function libelleRole(code) {
  return ROLES.find((r) => r.code === code)?.label ?? code ?? ''
}

// Langue de rédaction d'un rôle Rédacteur (P40) — `null` pour tout autre rôle
// (vue combinée FR + AR).
export function langueRedacteur(role) {
  return role === 'REDACTEUR_FR' ? 'FR' : role === 'REDACTEUR_AR' ? 'AR' : null
}
