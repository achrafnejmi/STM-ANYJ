// Import de la pige (retour d'antenne réel, P36a) — miroir du parseur
// d'import Plan média (importPlanMedia.js) : module PUR, aucun accès Supabase.
// Lit un classeur exporté de l'outil d'audience (feuille « Data » à colonnes
// nommées + feuille « Info » de métadonnées) et produit des GROUPES
// (chaîne + date) directement exploitables par l'aperçu modifiable.
//
// La pige = ce qui a réellement été diffusé, à la seconde. On stocke le nom
// tel quel (aucun rattachement au catalogue), le genre brut du fichier
// (code + 3 niveaux), et on DEVINE un type d'élément (modifiable ensuite).
//
// Heures : le fichier exprime un axe linéaire depuis 00:00 pouvant dépasser
// 24 h (queue de nuit : 25:00 → 27:00). On conserve cet axe en secondes
// (debutSecondes/finSecondes) pour l'ordre et la durée, et on dérive l'heure
// d'horloge réelle (27:00:00 → 03:00:00) pour les colonnes `time`.
import * as XLSX from 'xlsx'

const EN_TETES_ATTENDUES = ['Chaîne', 'Date', 'Programme', 'H.Début', 'H.Fin', 'Durée', 'Code Genre']

function normaliser(s) {
  return (s ?? '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function trouverFeuille(workbook, nom) {
  const cible = normaliser(nom)
  const trouve = workbook.SheetNames.find((n) => normaliser(n) === cible)
  return trouve ? workbook.Sheets[trouve] : null
}

export function estFichierPige(workbook) {
  const feuille = trouverFeuille(workbook, 'Data')
  if (!feuille) return false
  const lignes = XLSX.utils.sheet_to_json(feuille, { header: 1, raw: false, defval: null })
  const entete = lignes.find((row) => Array.isArray(row) && row.some((c) => normaliser(c) === 'chaine'))
  if (!entete) return false
  const presentes = new Set(entete.map(normaliser))
  return EN_TETES_ATTENDUES.every((h) => presentes.has(normaliser(h)))
}

// "H:MM:SS" (ou "HH:MM:SS", HH pouvant valoir ≥ 24) → secondes entières.
// Tolère aussi un nombre (fraction de journée Excel) au cas où.
export function hmsEnSecondes(valeur) {
  if (valeur == null || valeur === '') return null
  if (typeof valeur === 'number' && Number.isFinite(valeur)) return Math.round(valeur * 86400)
  const parts = String(valeur).trim().split(':').map((x) => Number(x))
  if (parts.some((n) => Number.isNaN(n))) return null
  const [h = 0, m = 0, s = 0] = parts
  return h * 3600 + m * 60 + s
}

// Secondes → "HH:MM:SS". `HH` non borné par défaut (affichage aperçu) ;
// appeler avec `sec % 86400` pour une heure d'horloge (colonnes `time`).
export function secondesEnHms(sec) {
  if (sec == null) return null
  const total = Math.max(0, Math.round(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// "8/31/26" (M/D/YY, feuille Data) → "2026-08-31". Rejet (null) si non reconnu.
export function parserDateUS(valeur) {
  const t = String(valeur ?? '').trim()
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  const mois = Number(m[1])
  const jour = Number(m[2])
  let annee = Number(m[3])
  if (annee < 100) annee += 2000
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

// Résout le libellé de chaîne du fichier ("AL AOULA", "2M"…) vers une chaîne
// SNRT (comparaison insensible casse/accents/espaces). null si non reconnue.
export function resoudreChaine(chaineNom, chaines) {
  const cible = normaliser(chaineNom)
  if (!cible) return null
  const trouvee = chaines.find((c) => normaliser(c.nom) === cible)
  return trouvee?.id ?? null
}

// Devinette du type d'élément depuis Code Genre + Genre Niv.1 + Genre Niv.2.
// Modifiable ensuite dans l'aperçu. Ordre des règles = du plus spécifique au
// plus général (préfixe de code d'abord, puis libellés).
export function devinerType(codeGenre, niv1, niv2) {
  const code = normaliser(codeGenre)
  const n1 = normaliser(niv1)
  const n2 = normaliser(niv2)

  if (code.startsWith('ja') || n2 === 'auto promotion') return 'AUTO_PROMO'
  if (code.startsWith('jf') || n2.includes('communique')) return 'COMMUNIQUE'
  if (n1 === 'publicite' && (n2.includes('bande') || n2.includes('annonce'))) return 'BA'
  if (n1 === 'publicite' || code.startsWith('ia')) return 'SPOT'
  if (n1 === 'autres' || code === 'z') return 'AUTRE'
  if (n1) return 'PROGRAMME'
  return 'AUTRE'
}

const RE_SOUS_LIGNE = /\((?:d[eé]but|suite|fin)(?:\s+\d+)?\)\s*$/i

// Lit la feuille « Info » (paires clé/valeur) → métadonnées libres.
function lireMeta(workbook) {
  const feuille = trouverFeuille(workbook, 'Info')
  if (!feuille) return {}
  const lignes = XLSX.utils.sheet_to_json(feuille, { header: 1, raw: false, defval: null })
  const map = {}
  for (const row of lignes) {
    if (!Array.isArray(row) || row.length < 2) continue
    const cle = normaliser(String(row[0]).replace(/["':]/g, ''))
    if (cle && row[1] != null) map[cle] = String(row[1]).trim()
  }
  return {
    db: map['db'] ?? null,
    user: map['user'] ?? null,
    dates: map['dates'] ?? null,
    chaines: map['chaine(s)'] ?? map['chaines'] ?? null,
    analyseLe: map['analysis run on'] ?? null,
  }
}

// Parse le classeur → { meta, groupes }. Un `groupe` = un futur import pige :
// { chaineNom, chaineId, date, jour, lignes: [...] }. Chaque ligne porte déjà
// son type deviné, ses secondes, son marqueur sous-ligne et son éventuel
// chevauchement résiduel (jamais bloquant).
export function parserFichierPige(workbook, chaines) {
  const feuille = trouverFeuille(workbook, 'Data')
  if (!feuille) return { meta: {}, groupes: [] }
  const lignesBrutes = XLSX.utils.sheet_to_json(feuille, { header: 1, raw: false, defval: null })

  const indexEntete = lignesBrutes.findIndex(
    (row) => Array.isArray(row) && row.some((c) => normaliser(c) === 'chaine')
  )
  if (indexEntete === -1) return { meta: lireMeta(workbook), groupes: [] }

  const entete = lignesBrutes[indexEntete].map(normaliser)
  const col = (nom) => entete.indexOf(normaliser(nom))
  const iChaine = col('Chaîne')
  const iDate = col('Date')
  const iJour = col('Jour Nommé')
  const iCodeEcran = col('Code Ecran')
  const iCodeProgram = col('Code Program')
  const iProgramme = col('Programme')
  const iDebut = col('H.Début')
  const iFin = col('H.Fin')
  const iDuree = col('Durée')
  const iLibelle = col('Libellé Complémentaire')
  const iCodeGenre = col('Code Genre')
  const iNiv1 = col('Genre Niv.1')
  const iNiv2 = col('Genre Niv.2')
  const iNiv3 = col('Genre Niv.3')

  const brutes = []
  for (let i = indexEntete + 1; i < lignesBrutes.length; i++) {
    const row = lignesBrutes[i]
    if (!Array.isArray(row) || row.every((c) => c == null || c === '')) continue
    const chaineNom = String(row[iChaine] ?? '').trim()
    const date = parserDateUS(row[iDate])
    if (!chaineNom || !date) continue

    const debutSecondes = hmsEnSecondes(row[iDebut])
    let finSecondes = hmsEnSecondes(row[iFin])
    const dureeSecondes = hmsEnSecondes(row[iDuree]) ?? 0
    if (debutSecondes == null || finSecondes == null) continue

    // Fin « après minuit » codée sans dépasser 24 h dans le texte → on décale
    // d'un jour et on signalera (comme le wraparound de semaine.js).
    let wraparound = false
    if (finSecondes < debutSecondes) {
      finSecondes += 86400
      wraparound = true
    }

    const programmeBrut = String(row[iProgramme] ?? '')
    const estSousLigne = /^\s/.test(programmeBrut) || RE_SOUS_LIGNE.test(programmeBrut)

    brutes.push({
      chaineNom,
      date,
      jour: iJour === -1 ? null : (row[iJour] ?? null),
      codeEcran: iCodeEcran === -1 ? null : (row[iCodeEcran] ?? null),
      codeProgram: iCodeProgram === -1 ? null : (row[iCodeProgram] ?? null),
      programme: programmeBrut.trim(),
      heureDebutTexte: secondesEnHms(debutSecondes),
      heureFinTexte: secondesEnHms(finSecondes),
      heureDebutHorloge: secondesEnHms(debutSecondes % 86400),
      heureFinHorloge: secondesEnHms(finSecondes % 86400),
      debutSecondes,
      finSecondes,
      dureeSecondes,
      dureeTexte: secondesEnHms(dureeSecondes),
      libelleComplementaire: iLibelle === -1 ? null : (row[iLibelle] ?? null),
      codeGenre: iCodeGenre === -1 ? null : (row[iCodeGenre] ?? null),
      genreNiv1: iNiv1 === -1 ? null : (row[iNiv1] ?? null),
      genreNiv2: iNiv2 === -1 ? null : (row[iNiv2] ?? null),
      genreNiv3: iNiv3 === -1 ? null : (row[iNiv3] ?? null),
      estSousLigne,
      wraparound,
    })
  }

  // Groupement par (chaîne, date).
  const parGroupe = new Map()
  for (const b of brutes) {
    const cle = `${b.chaineNom}__${b.date}`
    if (!parGroupe.has(cle)) parGroupe.set(cle, [])
    parGroupe.get(cle).push(b)
  }

  const groupes = []
  for (const [, lignesGroupe] of parGroupe) {
    // Tri du déroulé : par seconde de début, puis la ligne parente avant ses
    // sous-lignes à début égal (rattachement fiable), puis la plus longue
    // d'abord.
    lignesGroupe.sort(
      (a, b) =>
        a.debutSecondes - b.debutSecondes ||
        (a.estSousLigne ? 1 : 0) - (b.estSousLigne ? 1 : 0) ||
        b.finSecondes - a.finSecondes
    )

    const lignes = lignesGroupe.map((b, idx) => ({
      ordre: idx + 1,
      codeEcran: b.codeEcran,
      codeProgram: b.codeProgram,
      programme: b.programme,
      heureDebutTexte: b.heureDebutTexte,
      heureFinTexte: b.heureFinTexte,
      heureDebutHorloge: b.heureDebutHorloge,
      heureFinHorloge: b.heureFinHorloge,
      debutSecondes: b.debutSecondes,
      finSecondes: b.finSecondes,
      dureeSecondes: b.dureeSecondes,
      dureeTexte: b.dureeTexte,
      libelleComplementaire: b.libelleComplementaire,
      codeGenre: b.codeGenre,
      genreNiv1: b.genreNiv1,
      genreNiv2: b.genreNiv2,
      genreNiv3: b.genreNiv3,
      typeElement: devinerType(b.codeGenre, b.genreNiv1, b.genreNiv2),
      estSousLigne: b.estSousLigne,
      parentOrdre: null,
      chevauchement: b.wraparound,
    }))

    // Rattachement des sous-lignes à leur parente : dernière ligne NON
    // indentée précédente de même Code Program.
    for (let i = 0; i < lignes.length; i++) {
      if (!lignes[i].estSousLigne) continue
      for (let j = i - 1; j >= 0; j--) {
        if (!lignes[j].estSousLigne && lignes[j].codeProgram === lignes[i].codeProgram) {
          lignes[i].parentOrdre = lignes[j].ordre
          break
        }
      }
    }

    // Chevauchements résiduels entre lignes consécutives, hors relation
    // parente/enfant (le parent englobe légitimement ses tronçons).
    for (let i = 1; i < lignes.length; i++) {
      const prec = lignes[i - 1]
      const cur = lignes[i]
      const lieesParente =
        cur.parentOrdre === prec.ordre ||
        prec.parentOrdre === cur.ordre ||
        (cur.parentOrdre != null && cur.parentOrdre === prec.parentOrdre)
      if (!lieesParente && cur.debutSecondes < prec.finSecondes - 1) {
        cur.chevauchement = true
      }
    }

    groupes.push({
      chaineNom: lignesGroupe[0].chaineNom,
      chaineId: resoudreChaine(lignesGroupe[0].chaineNom, chaines),
      date: lignesGroupe[0].date,
      jour: lignesGroupe[0].jour,
      lignes,
    })
  }

  groupes.sort((a, b) => a.chaineNom.localeCompare(b.chaineNom) || a.date.localeCompare(b.date))
  return { meta: lireMeta(workbook), groupes }
}
