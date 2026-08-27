// Chaînes SNRT (M1) : liste fermée des 5 espaces de travail. Valeurs (code,
// nom, nom arabe, ligne éditoriale) reprises du cahier STM Next / mockup V3 ;
// couleurs = tokens SNRT centralisés en P6 (src/index.css), jamais celles du
// mockup. Les id sont des UUID fixes, identiques à ceux insérés par
// supabase/migration-p9.sql, pour que l'écriture (chaine_id) ne nécessite pas
// d'aller-retour réseau supplémentaire.

import { get, set } from './storage.js'
import { listerChaines } from './db.js'

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

// Resynchronise CHAINES sur la table `chaine` (retouche post-P29,
// administrable — nom/nom_ar/ligne_editoriale/couleur_token) — même
// principe que chargerGenres()/chargerTranches() : mutation EN PLACE des
// objets déjà référencés ailleurs (id/code/logo restent fixes, jamais
// modifiés depuis l'UI), jamais de réassignation de CHAINES ni de ses
// entrées. Si la table est vide ou injoignable, les valeurs de secours
// ci-dessus sont conservées.
export async function chargerChaines() {
  try {
    const lignes = await listerChaines()
    for (const ligne of lignes) {
      const chaine = CHAINES.find((c) => c.id === ligne.id)
      if (!chaine) continue
      chaine.nom = ligne.nom
      chaine.nomAr = ligne.nom_ar
      chaine.ligneEditoriale = ligne.ligne_editoriale
      chaine.couleur = `bg-snrt-${ligne.couleur_token}`
    }
  } catch (erreur) {
    console.error('Chargement des chaînes impossible, valeurs de secours conservées.', erreur)
  }
}
