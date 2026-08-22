// Chaînes SNRT (M1) : liste fermée des 5 espaces de travail. Valeurs (code,
// nom, nom arabe, ligne éditoriale) reprises du cahier STM Next / mockup V3 ;
// couleurs = tokens SNRT centralisés en P6 (src/index.css), jamais celles du
// mockup. Les id sont des UUID fixes, identiques à ceux insérés par
// supabase/migration-p9.sql, pour que l'écriture (chaine_id) ne nécessite pas
// d'aller-retour réseau supplémentaire.

import { get, set } from './storage.js'

export const CHAINES = [
  {
    id: '3d1c71e4-25e6-48fc-8072-0fe9ce261550',
    code: 'AW',
    nom: 'Al Aoula',
    nomAr: 'الأولى',
    ligneEditoriale: 'Généraliste nationale',
    couleur: 'bg-snrt-red',
    logo: '/brand/aw.png',
  },
  {
    id: '948307a6-2c6e-4c2e-a46c-da9ca7d75611',
    code: 'AR',
    nom: 'Arryadia',
    nomAr: 'الرياضية',
    ligneEditoriale: 'Sport',
    couleur: 'bg-snrt-green',
    logo: '/brand/ar.png',
  },
  {
    id: '20fd7905-7f60-4d11-8c62-274aef1f5bb9',
    code: 'AT',
    nom: 'Athaqafia',
    nomAr: 'الثقافية',
    ligneEditoriale: 'Culture et savoirs',
    couleur: 'bg-snrt-cyan',
    logo: '/brand/at.png',
  },
  {
    id: 'bfdaf3eb-cd99-4517-b0fa-c299fe886087',
    code: 'AS',
    nom: 'Assadissa',
    nomAr: 'السادسة',
    ligneEditoriale: 'Religieux',
    couleur: 'bg-snrt-orange',
    logo: '/brand/as.png',
  },
  {
    id: 'bcc05c72-880f-4b80-a9bc-b915637ff813',
    code: 'TM',
    nom: 'Tamazight',
    nomAr: 'تمازيغت',
    ligneEditoriale: 'Amazighe',
    couleur: 'bg-snrt-blue',
    logo: '/brand/tm.png',
  },
]

export function chaineParCode(code) {
  return CHAINES.find((c) => c.code === code) ?? null
}

// Insensible à la casse : le texte libre programme.chaine (donnée historique,
// avant le <select> fermé) peut diverger en casse de l'officiel (ex. "Al aoula"
// vs "Al Aoula") — une comparaison stricte renvoyait alors null, donc un
// chaine_id null, rejeté par la contrainte NOT NULL en base. Même tolérance
// que le scoping .ilike déjà utilisé côté lecture (db.js).
export function chaineParNom(nom) {
  const normalise = nom?.trim().toLowerCase()
  return CHAINES.find((c) => c.nom.toLowerCase() === normalise) ?? null
}

const CLE_CHAINE_ACTIVE = 'session:chaine'

export function lireChaineActive() {
  const code = get(CLE_CHAINE_ACTIVE)
  return chaineParCode(code) ?? CHAINES[0]
}

export function definirChaineActive(code) {
  if (!chaineParCode(code)) {
    throw new Error('Chaîne inconnue.')
  }
  set(CLE_CHAINE_ACTIVE, code)
}
