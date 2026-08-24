// Import Plan média Excel (EXG-M2-11 volet import, P26) — format legacy
// confirmé sur un fichier réel (design-reference/PM MARDI 07 JUIL 2026
// (1).xlsx) : feuille "PM", ligne de titre, en-tête JOUR/H.FIN/CONTEXTE/
// CONTENU/DUREE, JOUR/H.FIN en report (remplis seulement à la 1ère ligne
// d'une coupure). Miroir du parseur mort de la Phase 1 (stm-import.js) pour
// la lecture brute du classeur — mais produit ici un résultat directement
// exploitable par le modèle actuel (P16/P23/P24) : coupures groupées,
// classification par préfixe, appariement contre de VRAIES transmissions de
// la grille live à la date choisie.
//
// Rattachement par H.FIN (pas par nom) : une coupure du fichier dont le
// H.FIN littéral correspond exactement à la fin d'une transmission de la
// grille live à la date cible est "appariée" — coche par défaut, placement
// séquentiel comme l'insertion manuelle. Une coupure sans correspondance
// exacte reste "non appariée" : proposée mais DÉCOCHÉE par défaut ; si
// l'utilisateur la coche, elle doit être rattachée à une coupure réelle du
// jour (la plus proche par défaut, modifiable) — jamais insérée sans ancre
// (element_secondaire.apres_transmission_id est NOT NULL en base) et jamais
// sans passer par estPlacementValide (voir revaliderLignes).
import * as XLSX from 'xlsx'
import { calculerIntervalles, estPlacementValide, heureHMSEnSecondes, secondesEnHeureHMS } from './planMedia.js'

function trouverFeuillePlanMedia(workbook) {
  return workbook.SheetNames.find((nom) => nom.trim().toLowerCase() === 'pm')
}

export function estFichierPlanMedia(workbook) {
  return Boolean(trouverFeuillePlanMedia(workbook))
}

function ligneVide(row) {
  return !row || row.every((cell) => cell == null || cell === '')
}

// Fraction de journée Excel (0 ≤ x < 1) → "HH:MM:SS", même convention que
// exportPlanMedia.js (fractionJourneeDepuisHMS, sens inverse).
function parserHeureExcel(valeur) {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur < 0 || valeur >= 1) return null
  return secondesEnHeureHMS(Math.round(valeur * 86400))
}

// Regroupe les lignes brutes en coupures : { heureFin: "HH:MM:SS"|null,
// lignes: [{ contexte, contenu, dureeSec }] }. Une nouvelle coupure démarre
// à chaque H.FIN renseigné (colonne en report) ; la toute première ligne du
// fichier ouvre toujours une coupure même sans H.FIN lisible (JOUR seul).
export function parserFeuillePlanMedia(workbook) {
  const nomFeuille = trouverFeuillePlanMedia(workbook)
  if (!nomFeuille) return { titre: null, coupures: [] }
  const lignesBrutes = XLSX.utils.sheet_to_json(workbook.Sheets[nomFeuille], { header: 1, raw: true, defval: null })
  const titre = typeof lignesBrutes[0]?.[0] === 'string' ? lignesBrutes[0][0] : null
  const indexEntete = lignesBrutes.findIndex((row) => row[0] === 'JOUR')
  const debut = indexEntete === -1 ? 0 : indexEntete + 1

  const coupures = []
  let coupureCourante = null
  for (let i = debut; i < lignesBrutes.length; i++) {
    const row = lignesBrutes[i]
    if (ligneVide(row)) continue
    const heureFin = parserHeureExcel(row[1])
    if (heureFin || !coupureCourante) {
      coupureCourante = { heureFin, lignes: [] }
      coupures.push(coupureCourante)
    }
    const dureeSec = typeof row[4] === 'number' ? Math.round(row[4] * 86400) : null
    if (row[3] == null || dureeSec == null) continue
    coupureCourante.lignes.push({ contexte: row[2] ?? null, contenu: String(row[3]).trim(), dureeSec })
  }
  return { titre, coupures }
}

// Devinette du type (modifiable ensuite dans l'aperçu) — mêmes préfixes que
// l'export (exportPlanMedia.js : "BA " + titre pour une bande-annonce).
export function classifierType(contenu) {
  const texte = (contenu ?? '').trim()
  if (/^ba\s+/i.test(texte)) {
    const nomProgrammeDevine = texte.replace(/^ba\s+/i, '').trim()
    return { type: 'BANDE_ANNONCE', libelle: `Bande-annonce — ${nomProgrammeDevine}`, nomProgrammeDevine }
  }
  if (/^spot\s+/i.test(texte)) {
    return { type: 'SPOT', libelle: texte, nomProgrammeDevine: null }
  }
  return { type: 'AUTOPROMOTION', libelle: texte, nomProgrammeDevine: null }
}

function normaliser(s) {
  return (s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

// Campagne suggérée pour une bande-annonce devinée par titre de programme —
// correspondance exacte ou incluse dans un sens ou l'autre (le fichier réel
// ajoute parfois un horaire au titre, ex. "BA RIHLAT AL OMR 22H00"). Simple
// suggestion : toujours modifiable dans l'aperçu, jamais imposée.
function trouverCampagneParTitre(campagnes, programmesParId, nomProgrammeDevine) {
  const cible = normaliser(nomProgrammeDevine)
  if (!cible) return null
  const trouvee = campagnes.find((c) => {
    const titre = normaliser(programmesParId.get(c.programme_id)?.titre)
    return titre && (titre === cible || cible.includes(titre) || titre.includes(cible))
  })
  return trouvee?.id ?? null
}

// Construit la proposition d'aperçu : une ligne par élément du fichier,
// aplatie (plus de notion de coupure côté UI, chaque ligne porte sa propre
// ancre). `diffusionsCible` : diffusions de la grille LIVE à la date choisie
// uniquement (l'appelant filtre déjà par date).
//
// Statut par coupure :
// - APPARIEE : H.FIN du fichier == heure_fin exacte d'une transmission de
//   `diffusionsCible` → ancrée sur cette transmission, placement séquentiel
//   dans l'intervalle qui la suit (comme l'insertion manuelle), cochée par
//   défaut.
// - NON_APPARIEE_RATTACHABLE : aucune correspondance exacte mais la grille a
//   au moins une coupure ce jour-là → ancre par défaut = la coupure la plus
//   proche (par H.FIN littéral du fichier), liste d'alternatives fournie
//   pour que l'utilisateur choisisse manuellement ; heure de départ
//   pré-remplie au H.FIN littéral du fichier si dans les bornes de l'ancre
//   choisie, sinon calée sur le début de cette ancre. DÉCOCHÉE par défaut.
// - NON_APPARIABLE : aucune transmission ce jour-là dans la grille live →
//   aucune ancre possible (apres_transmission_id est NOT NULL en base),
//   case à cocher désactivée en amont côté UI.
export function apparierProposition({ coupuresFichier, dateCible, diffusionsCible, campagnes, programmesParId }) {
  const intervalles = calculerIntervalles([dateCible], diffusionsCible)
  const intervallesParAncre = new Map(intervalles.map((iv) => [iv.apresTransmissionId, iv]))
  const diffusionsParHeureFin = new Map(diffusionsCible.map((d) => [heureHMSEnSecondes(d.heure_fin), d]))

  const lignes = []
  let compteur = 0
  for (const coupure of coupuresFichier) {
    const heureFinSecondes = coupure.heureFin ? heureHMSEnSecondes(coupure.heureFin) : null
    const ancreExacte = heureFinSecondes != null ? diffusionsParHeureFin.get(heureFinSecondes) : null

    let statutCoupure
    let ancreParDefaut
    let alternativesCoupure = null
    if (ancreExacte) {
      statutCoupure = 'APPARIEE'
      ancreParDefaut = ancreExacte.id
    } else if (diffusionsCible.length > 0) {
      statutCoupure = 'NON_APPARIEE_RATTACHABLE'
      alternativesCoupure = intervalles
        .slice()
        .sort((a, b) => {
          const refA = heureFinSecondes != null ? Math.abs(a.debut * 60 - heureFinSecondes) : 0
          const refB = heureFinSecondes != null ? Math.abs(b.debut * 60 - heureFinSecondes) : 0
          return refA - refB
        })
        .map((iv) => {
          const diffusion = diffusionsCible.find((d) => d.id === iv.apresTransmissionId)
          const titre = diffusion ? programmesParId.get(diffusion.programme_id)?.titre : null
          return {
            apresTransmissionId: iv.apresTransmissionId,
            label: `après ${titre ?? '—'}, de ${diffusion?.heure_fin?.slice(0, 5) ?? '?'} à ${secondesEnHeureHMS(iv.fin * 60).slice(0, 5)}`,
          }
        })
      ancreParDefaut = alternativesCoupure[0]?.apresTransmissionId ?? null
    } else {
      statutCoupure = 'NON_APPARIABLE'
      ancreParDefaut = null
    }

    // Calé dans les bornes de l'ancre par défaut quand elle est connue (les 2
    // côtés — un H.FIN littéral largement hors bornes ne doit jamais produire
    // une heure de départ par défaut hors de la coupure choisie, même si le
    // résultat reste ensuite soumis à estPlacementValide comme toute ligne).
    const intervalleParDefaut = ancreParDefaut ? intervallesParAncre.get(ancreParDefaut) : null
    let curseurSecondes = intervalleParDefaut
      ? Math.min(Math.max(intervalleParDefaut.debut * 60, heureFinSecondes ?? intervalleParDefaut.debut * 60), intervalleParDefaut.fin * 60)
      : (heureFinSecondes ?? 0)

    for (const l of coupure.lignes) {
      const { type, libelle, nomProgrammeDevine } = classifierType(l.contenu)
      const campagneId = type === 'BANDE_ANNONCE' ? trouverCampagneParTitre(campagnes, programmesParId, nomProgrammeDevine) : null
      lignes.push({
        id: `l${compteur++}`,
        contexte: l.contexte,
        contenu: l.contenu,
        dureeSec: l.dureeSec,
        type,
        libelle,
        campagneId,
        statutCoupure,
        apresTransmissionId: ancreParDefaut,
        alternativesCoupure,
        heureDebut: secondesEnHeureHMS(curseurSecondes),
        coche: statutCoupure === 'APPARIEE',
      })
      curseurSecondes += l.dureeSec
    }
  }
  return { lignes, intervallesParAncre }
}

// Revalide l'ensemble des lignes actuellement COCHÉES, groupées par ancre
// choisie — même règle que l'insertion manuelle (estPlacementValide),
// appliquée à un lot entier plutôt qu'à une seule ligne : deux lignes
// cochées sur la même coupure ne doivent jamais se chevaucher, et aucune ne
// doit déborder des bornes de sa coupure. Appelée à chaque édition (case,
// heure, coupure choisie) — aucune ligne cochée n'échappe au contrôle, y
// compris une ligne d'une coupure APPARIEE dont l'heure a été décalée à la
// main. Renvoie l'ensemble des ids en conflit.
export function revaliderLignes(lignes, intervallesParAncre) {
  const parAncre = new Map()
  for (const ligne of lignes) {
    if (!ligne.coche || !ligne.apresTransmissionId) continue
    if (!parAncre.has(ligne.apresTransmissionId)) parAncre.set(ligne.apresTransmissionId, [])
    parAncre.get(ligne.apresTransmissionId).push(ligne)
  }

  const invalides = new Set()
  for (const [ancre, groupe] of parAncre) {
    const intervalle = intervallesParAncre.get(ancre)
    if (!intervalle) {
      groupe.forEach((l) => invalides.add(l.id))
      continue
    }
    groupe.sort((a, b) => heureHMSEnSecondes(a.heureDebut) - heureHMSEnSecondes(b.heureDebut))
    const placees = []
    for (const l of groupe) {
      const debutSecondes = heureHMSEnSecondes(l.heureDebut)
      if (!estPlacementValide(debutSecondes, l.dureeSec, intervalle, placees)) {
        invalides.add(l.id)
        continue
      }
      placees.push({ heure_debut: l.heureDebut, heure_fin: secondesEnHeureHMS(debutSecondes + l.dureeSec) })
    }
  }
  return invalides
}
