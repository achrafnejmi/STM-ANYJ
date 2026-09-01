// Phase 1 : mock STM — parse des xlsx (grille de programmes + plan média) en Programme[] (§4/§6 PLAN.md).
// Lecture seule : on ne écrit jamais dans STM, ce module ne fait que normaliser un import.

import * as XLSX from 'xlsx'

const MARQUEURS_FIN_EMISSION = ["TIGIRA N USSIFD", "fin d'émission", 'fin de diffusion', 'clôture']

// Excel (système 1900) : jour 0 = 1899-12-30. Conversion via l'epoch Unix.
export function excelSerialToISODate(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Accepte "HH.MM" (texte) ou une fraction de journée Excel (nombre). Retourne "HH:MM" ou null si illisible.
export function parseHeure(value) {
  if (value == null) return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value >= 1) return null
    const minutesTotal = Math.round(value * 24 * 60)
    const h = Math.floor(minutesTotal / 60)
    const m = minutesTotal % 60
    if (h > 23) return null
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{1,2})\.(\d{2})$/)
    if (!match) return null
    const h = Number(match[1])
    const m = Number(match[2])
    if (h > 23 || m > 59) return null
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  return null
}

function heureEnMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function estMarqueurFinEmission(titre) {
  if (!titre) return false
  const t = titre.trim().toLowerCase()
  return MARQUEURS_FIN_EMISSION.some((m) => t === m.toLowerCase())
}

export function slugify(texte) {
  if (!texte) return 'sans-titre'
  const slug = texte
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'sans-titre'
}

function ligneVide(row) {
  return !row || row.every((cell) => cell == null || cell === '')
}

/** @returns {import('./model.js').Programme[]} */
export function parseGrille(workbook, { chaine = '' } = {}) {
  const nomFeuille = workbook.SheetNames.find((nom) => {
    const json = XLSX.utils.sheet_to_json(workbook.Sheets[nom], { header: 1, raw: true, defval: null })
    return json.length > 1
  }) ?? workbook.SheetNames[0]

  const lignes = XLSX.utils.sheet_to_json(workbook.Sheets[nomFeuille], { header: 1, raw: true, defval: null })

  const programmes = []
  let precedent = null // { titre, date } de la dernière ligne non vide traitée

  for (let i = 1; i < lignes.length; i++) {
    const row = lignes[i]
    if (ligneVide(row)) continue

    const titre = typeof row[0] === 'string' ? row[0].trim() : row[0] == null ? '' : String(row[0]).trim()
    const date = typeof row[2] === 'number' ? excelSerialToISODate(row[2]) : null
    const heureDebut = parseHeure(row[3])

    const heureFinBrute = row[4]
    const heureFin = heureFinBrute === 0 ? heureDebut : parseHeure(heureFinBrute)

    let anomalie = null
    if (!titre || !date || !heureDebut) {
      anomalie = 'champs obligatoires manquants (titre, date ou heure_debut)'
    } else if (!heureFin) {
      anomalie = 'heure_fin invalide ou illisible'
    } else if (heureEnMinutes(heureFin) < heureEnMinutes(heureDebut)) {
      anomalie = 'fin avant début'
    } else if (estMarqueurFinEmission(titre)) {
      anomalie = "marqueur de fin d'émission"
    } else if (precedent && precedent.date === date && precedent.titre.toLowerCase() === titre.toLowerCase()) {
      anomalie = 'doublon (répétition du programme précédent)'
    }

    programmes.push({
      programme_id: `${slugify(titre)}-${date ?? 'date-inconnue'}-${heureDebut ?? 'heure-inconnue'}`,
      titre,
      genre: '',
      chaine,
      date: date ?? undefined,
      heure_debut: heureDebut ?? undefined,
      heure_fin: heureFin ?? undefined,
      _anomalie: anomalie,
    })

    precedent = { titre, date }
  }

  return programmes
}

function trouverFeuillePlanMedia(workbook) {
  return workbook.SheetNames.find((nom) => nom.trim().toLowerCase() === 'pm')
}

// Plan média : liste séparée, non sélectionnable, sans logique d'anomalie (§7 Phase 1 PLAN.md).
export function parsePlanMedia(workbook) {
  const nomFeuille = trouverFeuillePlanMedia(workbook)
  if (!nomFeuille) return []

  const lignes = XLSX.utils.sheet_to_json(workbook.Sheets[nomFeuille], { header: 1, raw: true, defval: null })
  const indexEntete = lignes.findIndex((row) => row[0] === 'JOUR')
  const debut = indexEntete === -1 ? 0 : indexEntete + 1

  const entrees = []
  for (let i = debut; i < lignes.length; i++) {
    const row = lignes[i]
    if (ligneVide(row)) continue
    if (row[0] == null && row[3] == null) continue

    const dureeSec = typeof row[4] === 'number' ? Math.round(row[4] * 86400) : null

    entrees.push({
      jour: row[0] ?? null,
      heure_fin: parseHeure(row[1]),
      contexte: row[2] ?? null,
      contenu: row[3] ?? null,
      duree_sec: dureeSec,
    })
  }

  return entrees
}

export function estPlanMedia(workbook) {
  return Boolean(trouverFeuillePlanMedia(workbook))
}

/**
 * Point d'entrée : lit le classeur, détecte grille vs plan média, dispatch vers le bon parseur.
 * @param {ArrayBuffer|Uint8Array} donneesFichier
 * @param {{ chaine?: string }} options
 */
export function parseFichierSTM(donneesFichier, { chaine = '' } = {}) {
  const workbook = XLSX.read(donneesFichier, { type: 'array', raw: true })

  if (estPlanMedia(workbook)) {
    return { type: 'PLAN_MEDIA', planMedia: parsePlanMedia(workbook) }
  }
  return { type: 'GRILLE', programmes: parseGrille(workbook, { chaine }) }
}
