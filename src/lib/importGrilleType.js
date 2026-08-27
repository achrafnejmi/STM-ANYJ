// Import Grille type Excel (P28b Partie E) — calibré sur un fichier réel
// (design-reference/Porjet de Grille Ramadan 2023 V24022023.xlsx) : une
// grille VISUELLE 2D (jours en colonnes, heures en lignes, cellules
// fusionnées), pas un tableau à colonnes nommées. Miroir de
// importPlanMedia.js (P26) pour la structure propose→aperçu→confirme ; le
// parseur lui-même (géométrie de fusions) est entièrement nouveau.
//
// Travaille en coordonnées ABSOLUES de la feuille (via encode_cell/
// decode_range) plutôt que sur le tableau de sheet_to_json({header:1}), dont
// les index sont relatifs au début de la plage utilisée (`!ref`, ex. "B1:L105"
// démarre en colonne B) — `!merges` utilise lui des coordonnées absolues
// (colonne A = 0) : mélanger les deux ferait dérailler silencieusement toute
// détection de fusion multi-colonnes (bug repéré et corrigé en écrivant ce
// fichier : une première version indexée sur sheet_to_json traitait chaque
// bloc multi-jours comme un bloc mono-jour).
import * as XLSX from 'xlsx'
import { heureEnMinutes, minutesEnHeure } from './semaine.js'

// Devinette du genre par mots-clés (liste validée avec l'utilisateur, non
// élargie au-delà de ce qui a été demandé — un contenu religieux non couvert
// ici, ex. "Prière du vendredi", reste à choisir à la main dans l'aperçu).
const REGLES_GENRE = [
  { motifs: ['documentaire', 'docu'], genre: 'Documentaire' },
  { motifs: ['série', 'serie'], genre: 'Série' },
  { motifs: ['film'], genre: 'Film' },
  { motifs: ['jt', 'journal', 'info'], genre: 'Information' },
  { motifs: ['coran', 'massira', 'dourouss', 'amdah'], genre: 'Religieux' },
  { motifs: ['sport', 'match'], genre: 'Sport' },
  { motifs: ['jeunesse', 'dessin'], genre: 'Jeunesse' },
]

export function classifierGenre(texte) {
  const normalise = texte.toLowerCase()
  for (const regle of REGLES_GENRE) {
    if (regle.motifs.some((m) => normalise.includes(m))) return regle.genre
  }
  return null
}

// Cherche tous les motifs "N'" (nombre + apostrophe) dans le texte, où qu'ils
// soient — un seul motif = haute confiance ; zéro ou plusieurs = incertain
// (zéro : repli sur la hauteur de la fusion côté appelant ; plusieurs :
// somme, cf. plan — un multiplicateur SANS apostrophe comme "x30"/"x2" est
// délibérément ignoré : sur le fichier réel "Oussrati (52'x30)" désigne un
// nombre d'épisodes de la série, pas 52×30 minutes pour CE créneau).
export function extraireDureeMinutes(texte) {
  const motifs = [...texte.matchAll(/(\d+)\s*'/g)].map((m) => Number(m[1]))
  if (motifs.length === 0) return { minutes: null, confiance: 'absente' }
  if (motifs.length === 1) return { minutes: motifs[0], confiance: 'haute' }
  return { minutes: motifs.reduce((a, b) => a + b, 0), confiance: 'incertaine' }
}

function valeurCellule(feuille, r, c) {
  const cellule = feuille[XLSX.utils.encode_cell({ r, c })]
  return cellule ? cellule.v : null
}

// Ligne + colonne (absolues) où "LUNDI" apparaît — la colonne des heures est
// toujours immédiatement à sa gauche sur le fichier réel, les 7 jours
// occupent les 7 colonnes suivantes.
function trouverEntete(feuille, range) {
  const derniereLigneScannee = Math.min(range.e.r, range.s.r + 10)
  for (let r = range.s.r; r <= derniereLigneScannee; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const v = valeurCellule(feuille, r, c)
      if (typeof v === 'string' && v.trim().toLowerCase().startsWith('lundi')) {
        return { ligne: r, colonneLundi: c }
      }
    }
  }
  return null
}

function trouverFeuilleGrilleType(workbook) {
  return workbook.SheetNames.find((nom) => {
    const feuille = workbook.Sheets[nom]
    if (!feuille['!ref']) return false
    return trouverEntete(feuille, XLSX.utils.decode_range(feuille['!ref'])) != null
  })
}

export function estFichierGrilleType(workbook) {
  return Boolean(trouverFeuilleGrilleType(workbook))
}

// Parse la feuille en une liste plate de "coupures" brutes : { texte,
// heureDebut: "HH:MM", jours: [0..6], nbCreneaux }. `jours`/`nbCreneaux`
// viennent directement de la géométrie de la fusion couvrant la cellule
// (n'importe quelle plage de jours/lignes, pas seulement "1 jour" ou "tous
// les jours") ; une cellule non fusionnée = 1 jour, 1 créneau de 15 min.
export function parserFeuilleGrilleType(workbook) {
  const nomFeuille = trouverFeuilleGrilleType(workbook)
  if (!nomFeuille) return { titre: null, coupures: [] }
  const feuille = workbook.Sheets[nomFeuille]
  const range = XLSX.utils.decode_range(feuille['!ref'])
  const entete = trouverEntete(feuille, range)
  const colonneHeure = entete.colonneLundi - 1
  const colonneLundi = entete.colonneLundi
  const colonneFinJours = entete.colonneLundi + 6

  let titre = null
  for (let r = range.s.r; r < entete.ligne && !titre; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const v = valeurCellule(feuille, r, c)
      if (typeof v === 'string' && v.trim()) {
        titre = v.trim()
        break
      }
    }
  }

  // Reconstruction de l'heure de chaque ligne de données par un compteur de
  // position (0=nouvelle heure, 1/2/3=+15/+30/+45min), calé UNIQUEMENT sur les
  // lignes où la colonne heure porte une valeur explicite — jamais sur un
  // calcul de bloc de 4 lignes strict aveugle. Cas réel découvert (ligne 63
  // du fichier réel, juste avant 22h) : une ligne de CONTENU insérée
  // HORS grille, colonne heure vide, qui ne correspond à AUCUN créneau du
  // quadrillage 15 min — la première version incrémentait l'heure précédente
  // sur cette ligne (en la prenant pour le "22:00" manquant), ce qui décalait
  // d'un cran TOUT le reste du fichier (confirmé par l'utilisateur : les
  // dernières lignes affichaient des minutes aberrantes comme 22:56/22:57...
  // au lieu du quadrillage 15 min). Fix : une ligne à colonne heure vide ne
  // consomme JAMAIS de position — elle hérite du dernier créneau connu (bloc
  // hors grille, à vérifier dans l'aperçu) sans décaler les lignes suivantes.
  const heuresParLigne = new Map()
  let heureCourante = null
  let position = 0
  for (let r = entete.ligne + 1; r <= range.e.r; r++) {
    let ligneVide = true
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (valeurCellule(feuille, r, c) != null) {
        ligneVide = false
        break
      }
    }
    if (ligneVide) continue
    const valeurHeure = valeurCellule(feuille, r, colonneHeure)
    if (typeof valeurHeure === 'number') {
      if (position === 0) heureCourante = valeurHeure
      if (heureCourante !== null) {
        heuresParLigne.set(
          r,
          position === 0
            ? `${String(heureCourante).padStart(2, '0')}:00`
            : `${String(heureCourante).padStart(2, '0')}:${String(position * 15).padStart(2, '0')}`
        )
      }
      position = (position + 1) % 4
    } else {
      const derniereEtiquette = [...heuresParLigne.values()].at(-1) ?? null
      if (derniereEtiquette) heuresParLigne.set(r, derniereEtiquette)
    }
  }

  const merges = feuille['!merges'] ?? []
  const coupures = []
  for (let r = entete.ligne + 1; r <= range.e.r; r++) {
    for (let c = colonneLundi; c <= colonneFinJours; c++) {
      const valeur = valeurCellule(feuille, r, c)
      if (typeof valeur !== 'string' || !valeur.trim()) continue
      const heureDebut = heuresParLigne.get(r)
      if (!heureDebut) continue
      const fusion = merges.find((m) => m.s.r === r && m.s.c === c)
      const jourDebut = (fusion ? fusion.s.c : c) - colonneLundi
      const jourFin = (fusion ? fusion.e.c : c) - colonneLundi
      const jours = []
      for (let j = jourDebut; j <= jourFin; j++) jours.push(j)
      const nbCreneaux = fusion ? fusion.e.r - fusion.s.r + 1 : 1
      coupures.push({ texte: valeur.replace(/\r\n/g, ' ').trim(), heureDebut, jours, nbCreneaux })
    }
  }
  return { titre, coupures }
}

// Genre de repli quand aucun mot-clé ne correspond (ex. « Prière du
// vendredi », « Al Madih », « Nafahat Ramadania » — contenu religieux hors de
// la liste de mots-clés validée, cf. REGLES_GENRE) : une estimation modifiable
// dans l'aperçu, jamais une case vide qui bloquerait la ligne (genre_attendu
// est NOT NULL en base) — la ligne reste cochable d'emblée (via « Sélectionner
// tout » ou individuellement), toujours signalée en ambre pour relecture.
const GENRE_PAR_DEFAUT = 'Divertissement'

// Construit l'aperçu (une ligne par coupure détectée) : genre deviné par
// mots-clés, sinon GENRE_PAR_DEFAUT (jamais vide) ; durée devinée (repli sur
// la hauteur de fusion × 15 min si aucun motif) ; ambre si le genre est une
// estimation (pas de mot-clé trouvé) OU si la durée est incertaine ; cochée
// par défaut seulement si le genre vient d'un mot-clé (une estimation reste
// décochée par défaut, à valider explicitement par l'utilisateur).
export function apparierProposition(coupures) {
  return coupures.map((c, i) => {
    const genreDevine = classifierGenre(c.texte)
    const { minutes, confiance } = extraireDureeMinutes(c.texte)
    const dureeMinutes = minutes ?? c.nbCreneaux * 15
    return {
      id: `l${i}`,
      nom: c.texte,
      heureDebut: c.heureDebut,
      dureeMinutes,
      jours: c.jours,
      genre: genreDevine ?? GENRE_PAR_DEFAUT,
      ambre: !genreDevine || confiance !== 'haute',
      coche: Boolean(genreDevine),
    }
  })
}

export function calculerHeureFin(heureDebut, dureeMinutes) {
  return minutesEnHeure(heureEnMinutes(heureDebut) + dureeMinutes)
}
