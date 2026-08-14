// Moteur d'auto-programmation (M4, P15). Pur — aucun accès Supabase, aucune
// écriture. Prend en entrée des données déjà chargées par l'écran, renvoie
// une PROPOSITION (jamais une écriture directe) + un rapport. Le principe
// directeur du cahier comme de CLAUDE.md #3 est non négociable ici : le
// système propose, l'utilisateur décide — voir AutoProgrammation.jsx pour
// l'aperçu, la confirmation et l'écriture réelle (creerDiffusionsLineaires).
//
// Même famille que droits.js/anomalies.js/historique.js.
import { minutesEnHeure, jourAntenneLundi0, joursEntre } from './semaine.js'
import { blocsActifsCeJour, calculerTrous, trouverBlocPourMinute } from './grilleType.js'
import { estProgrammable, estEpisodePret, fenetresProchesDeLaFermeture } from './droits.js'

// --- règles par titre (§4.5.3) : défauts dépendant du genre ---

export const SEPARATION_DEFAUT_SERIE = 1
export const SEPARATION_DEFAUT_AUTRE = 7
export const DIFFUSIONS_MAX_DEFAUT_SERIE = 30
export const DIFFUSIONS_MAX_DEFAUT_AUTRE = 4
const GENRES_ORDRE_SEQUENTIEL = new Set(['Série', 'Jeunesse'])

// Les colonnes autoprog_* sont nullable : une valeur absente se voit
// appliquer le défaut dépendant du genre au moment de l'exécution, plutôt
// que d'être figée en base pour un titre jamais configuré.
export function reglesEffectives(programme) {
  const estSerie = programme.genre === 'Série'
  return {
    actif: programme.autoprog_actif ?? true,
    separationJours: programme.autoprog_separation_jours ?? (estSerie ? SEPARATION_DEFAUT_SERIE : SEPARATION_DEFAUT_AUTRE),
    diffusionsMax: programme.autoprog_diffusions_max ?? (estSerie ? DIFFUSIONS_MAX_DEFAUT_SERIE : DIFFUSIONS_MAX_DEFAUT_AUTRE),
    ordre: programme.autoprog_ordre ?? (GENRES_ORDRE_SEQUENTIEL.has(programme.genre) ? 'SEQUENTIEL' : 'RECENCE'),
  }
}

// --- occurrences de bloc à pourvoir (§4.5.5) ---

// Ambiguïté 1 (tranchée) : une diffusion MANUELLE est toujours protégée,
// jamais recalculée par le mode Écraser. Une diffusion AUTOMATIQUE n'est
// protégée que si Écraser est désactivé, ou si elle est hors de la période
// régénérée (un ancien run sur une autre période n'a pas à être touché).
function estProtegee(diffusion, { ecraser, dateDebut, dateFin }) {
  if (!ecraser) return true
  if (diffusion.origine !== 'AUTOMATIQUE') return true
  return diffusion.date < dateDebut || diffusion.date > dateFin
}

// Réutilise calculerTrous (déjà éprouvé pour les trous d'antenne, P13) plutôt
// que de réinventer « expanser les blocs × les dates » — un bloc entièrement
// vide en ressort comme un seul trou couvrant tout le bloc. Renvoie aussi
// `diffusionsProtegees` (les diffusions qui subsisteront après l'opération),
// qui sert ensuite de socle d'historique pour la séparation/rotation.
export function genererOccurrencesAPourvoir(dates, blocsGrilleType, diffusionsExistantes, options) {
  const protegees = diffusionsExistantes.filter((d) => estProtegee(d, options))
  const parJour = new Map()
  for (const d of protegees) {
    if (!parJour.has(d.date)) parJour.set(d.date, [])
    parJour.get(d.date).push(d)
  }

  const occurrences = []
  for (const date of dates) {
    const actifs = blocsActifsCeJour(blocsGrilleType, jourAntenneLundi0(date))
    const trous = calculerTrous(actifs, parJour.get(date) ?? [])
    // EXG-M3-07 : deux blocs peuvent se chevaucher (variantes saisonnières).
    // calculerTrous boucle bloc par bloc, donc un intervalle partagé par deux
    // blocs actifs ressortirait deux fois — on ne garde que le trou dont le
    // bloc est le bloc « canonique » de cette minute (même règle de
    // préséance que l'écart de genre, anomalies.js).
    for (const trou of trous) {
      if (trouverBlocPourMinute(actifs, trou.debut) !== trou.bloc) continue
      occurrences.push({ date, debut: trou.debut, fin: trou.fin, bloc: trou.bloc })
    }
  }
  // Ordre chronologique réel (date puis minute d'antenne) — pas une
  // concaténation de chaînes (anomalies.js s'en sert, mais seulement pour un
  // tri cosmétique d'affichage ; ici l'ordre de traitement EST l'algorithme,
  // il pilote les compteurs de séparation/rotation au fil de l'eau).
  occurrences.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.debut - b.debut))
  return { occurrences, diffusionsProtegees: protegees }
}

// --- séparation / plafond ---

function respecteSeparationEtMax(programmeId, dateVisee, regles, ctx) {
  const dates = ctx.datesConnuesParTitre.get(programmeId) ?? []
  // Bidirectionnel : une diffusion (manuelle, typiquement) déjà positionnée
  // APRÈS la date en cours de traitement doit aussi compter — sinon un
  // passage chronologique en avance de phase ne la « voit » pas encore.
  const separationOk = dates.every((d) => Math.abs(joursEntre(d, dateVisee)) >= regles.separationJours)
  if (!separationOk) return { ok: false, motif: 'SEPARATION' }
  if ((ctx.nbPlacementsParTitre.get(programmeId) ?? 0) >= regles.diffusionsMax) return { ok: false, motif: 'MAX' }
  return { ok: true, motif: null }
}

// --- choix de l'épisode (déterministe, anti-doublon) ---

function choisirEpisode(regles, episodesDuTitre, ctx) {
  const pad = episodesDuTitre.filter((e) => estEpisodePret(e))
  if (pad.length === 0) return null

  if (regles.ordre === 'SEQUENTIEL') {
    // Épisodes PAD triés par numéro ; on reprend juste après le plus
    // récemment diffusé parmi eux (absent de l'historique → -1, démarre au
    // premier). Comme `pad` est déjà filtré PAD, le suivant dans l'ordre est
    // toujours un candidat valide — pas de recherche supplémentaire.
    const tries = [...pad].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0))
    let dernierIndex = -1
    let dernierDate = null
    tries.forEach((e, i) => {
      const d = ctx.dernierePlacementParEpisode.get(e.id)
      if (d && (!dernierDate || d > dernierDate)) {
        dernierDate = d
        dernierIndex = i
      }
    })
    return tries[(dernierIndex + 1) % tries.length]
  }

  // RECENCE : jamais diffusé (aucune entrée connue) toujours prioritaire sur
  // tout épisode déjà diffusé, quelle que soit son ancienneté ; sinon date la
  // plus ancienne en premier ; égalité → plus petit numéro.
  const tries = [...pad].sort((a, b) => {
    const da = ctx.dernierePlacementParEpisode.get(a.id)
    const db = ctx.dernierePlacementParEpisode.get(b.id)
    if (!da && !db) return (a.numero ?? 0) - (b.numero ?? 0)
    if (!da) return -1
    if (!db) return 1
    if (da !== db) return da < db ? -1 : 1
    return (a.numero ?? 0) - (b.numero ?? 0)
  })
  return tries[0]
}

// --- notation des titres restants (étape 4, §4.5.5) ---
//
// Le cahier énonce 4 facteurs sans formule ("selon l'ancienneté de leur
// dernière diffusion, le volume de stock disponible, le nombre de diffusions
// déjà programmées sur la période, et une prime accordée aux titres dont les
// droits arrivent à échéance") — poids choisis ici, documentés pour un
// ajustement facile après démo :
//   +1 point par jour depuis la dernière diffusion connue (jamais diffusé =
//     10000 points, priorité maximale, toujours devant un titre récent).
//   +2 points par épisode PAD en stock (favorise les titres avec plus de
//     choix, évite d'épuiser un petit catalogue en quelques jours).
//   -5 points par diffusion déjà placée sur la période traitée (favorise la
//     diversité de la grille plutôt que la concentration d'un même titre).
//   +500 points si une fenêtre de droits du titre se referme à moins de 45
//     jours (RG-04/EXG-M4-08 — prime aux fins de droits ; poids volontairement
//     dominant, il s'agit d'un enjeu financier direct, pas de confort éditorial).
// Départage final, toujours déterministe : titre (localeCompare) puis
// programme_id — jamais l'ordre d'itération d'une Map/d'un tableau.
const POIDS_ANCIENNETE = 1
const POIDS_STOCK = 2
const POIDS_CONCENTRATION = -5
const PRIME_ECHEANCE = 500
const JAMAIS_DIFFUSE = 10000

function noterTitre(programme, dateVisee, ctx) {
  const derniere = ctx.dernierePlacementParTitre.get(programme.id)
  const anciennete = derniere ? Math.max(0, joursEntre(derniere, dateVisee)) : JAMAIS_DIFFUSE
  const stock = ctx.stockParProgramme.get(programme.id) ?? 0
  const nbPlaces = ctx.nbPlacementsParTitre.get(programme.id) ?? 0
  const fenetresDuTitre = ctx.fenetresDroits.filter((f) => f.programme_id === programme.id)
  const primeEcheance = fenetresProchesDeLaFermeture(fenetresDuTitre, dateVisee).length > 0 ? PRIME_ECHEANCE : 0
  return anciennete * POIDS_ANCIENNETE + stock * POIDS_STOCK + nbPlaces * POIDS_CONCENTRATION + primeEcheance
}

// --- motifs exacts pour un bloc non pourvu (EXG-M4-03) ---

const LIBELLES_MOTIFS = {
  INACTIF: 'Tous les titres du genre attendu sont désactivés pour l’auto-programmation.',
  GENRE: 'Aucun titre du genre attendu dans le catalogue de la chaîne.',
  DROITS: 'Titres du genre attendu tous hors droits à cette date.',
  SEPARATION: 'Titres éligibles tous exclus par la règle de séparation.',
  MAX: 'Titres éligibles tous exclus (nombre maximum de diffusions atteint).',
  PAD: 'Aucun épisode prêt à diffuser (PAD) parmi les titres éligibles.',
}
// Ordre de priorité du motif rapporté quand plusieurs raisons se sont
// cumulées (le premier obstacle rencontré dans le pipeline de filtrage).
const PRIORITE_MOTIFS = ['GENRE', 'INACTIF', 'DROITS', 'SEPARATION', 'MAX', 'PAD']

function motifPourBloc(motifsRencontres) {
  for (const m of PRIORITE_MOTIFS) {
    if (motifsRencontres.has(m)) return LIBELLES_MOTIFS[m]
  }
  return 'Aucun titre éligible.'
}

// --- génération de la proposition ---

// `dates` : toutes les dates de la période sélectionnée (pas seulement
// celles avec une occurrence — sert de borne au calcul « diffusions max sur
// la période », Ambiguïté 6). `occurrences`/`diffusionsProtegees` : sortie de
// genererOccurrencesAPourvoir. `episodesParProgramme` : Map programme_id ->
// episode[]. `runId` : uuid généré côté écran (crypto.randomUUID()), posé sur
// chaque ligne proposée pour permettre l'annulation groupée (RG-16).
export function genererProposition({
  dates,
  occurrences,
  diffusionsProtegees,
  programmes,
  episodesParProgramme,
  fenetresDroits,
  respecterGenre,
  runId,
  chaineActive,
}) {
  const datesConnuesParTitre = new Map()
  const dernierePlacementParTitre = new Map()
  const dernierePlacementParEpisode = new Map()

  for (const d of diffusionsProtegees) {
    if (!d.programme_id) continue
    if (!datesConnuesParTitre.has(d.programme_id)) datesConnuesParTitre.set(d.programme_id, [])
    datesConnuesParTitre.get(d.programme_id).push(d.date)
    const dp = dernierePlacementParTitre.get(d.programme_id)
    if (!dp || d.date > dp) dernierePlacementParTitre.set(d.programme_id, d.date)
    if (d.episode_id) {
      const de = dernierePlacementParEpisode.get(d.episode_id)
      if (!de || d.date > de) dernierePlacementParEpisode.set(d.episode_id, d.date)
    }
  }

  // « Diffusions maximum sur la période » (Ambiguïté 6, tranchée) : compte
  // sur la période complète sélectionnée, pas seulement les occurrences
  // effectivement vides.
  const nbPlacementsParTitre = new Map()
  const ensembleDates = new Set(dates)
  for (const d of diffusionsProtegees) {
    if (!d.programme_id || !ensembleDates.has(d.date)) continue
    nbPlacementsParTitre.set(d.programme_id, (nbPlacementsParTitre.get(d.programme_id) ?? 0) + 1)
  }

  const stockParProgramme = new Map(
    programmes.map((p) => [p.id, (episodesParProgramme.get(p.id) ?? []).filter(estEpisodePret).length])
  )

  const ctx = { datesConnuesParTitre, dernierePlacementParTitre, dernierePlacementParEpisode, nbPlacementsParTitre, stockParProgramme, fenetresDroits }

  const placements = []
  const nonPourvus = []

  for (const occ of occurrences) {
    const candidats = []
    const motifsRencontres = new Set()

    for (const p of programmes) {
      const regles = reglesEffectives(p)
      if (!regles.actif) {
        motifsRencontres.add('INACTIF')
        continue
      }
      if (respecterGenre && p.genre !== occ.bloc.genre_attendu) {
        motifsRencontres.add('GENRE')
        continue
      }
      // Droits/PAD : toujours vérifiés, sans exception ni privilège
      // (RG-01/RG-05/EXG-M4-04) — la case « Uniquement les contrats
      // valides » de l'écran est verrouillée, ceci n'est jamais contournable.
      if (!estProgrammable(p.id, fenetresDroits, occ.date).ok) {
        motifsRencontres.add('DROITS')
        continue
      }
      const sepMax = respecteSeparationEtMax(p.id, occ.date, regles, ctx)
      if (!sepMax.ok) {
        motifsRencontres.add(sepMax.motif)
        continue
      }
      const episode = choisirEpisode(regles, episodesParProgramme.get(p.id) ?? [], ctx)
      if (!episode) {
        motifsRencontres.add('PAD')
        continue
      }
      candidats.push({ programme: p, episode })
    }

    if (candidats.length === 0) {
      nonPourvus.push({
        date: occ.date,
        heure: minutesEnHeure(occ.debut),
        bloc: occ.bloc.nom,
        genreAttendu: occ.bloc.genre_attendu,
        motif: motifPourBloc(motifsRencontres),
      })
      continue
    }

    candidats.sort((a, b) => {
      const scoreDiff = noterTitre(b.programme, occ.date, ctx) - noterTitre(a.programme, occ.date, ctx)
      if (scoreDiff !== 0) return scoreDiff
      const cmpTitre = a.programme.titre.localeCompare(b.programme.titre)
      return cmpTitre !== 0 ? cmpTitre : a.programme.id.localeCompare(b.programme.id)
    })
    const { programme, episode } = candidats[0]

    const heureDebut = minutesEnHeure(occ.debut)
    // Taille du créneau = durée de l'épisode, comme la saisie manuelle
    // (FormulaireCreneau/drag-and-drop, GrilleLineaire.jsx) — pas la durée
    // pleine du bloc/trou (Ambiguïté 3, tranchée).
    const heureFin = minutesEnHeure(occ.debut + (episode.duree ?? occ.fin - occ.debut))

    placements.push({
      programme_id: programme.id,
      episode_id: episode.id,
      episode_numero: episode.numero,
      chaine: chaineActive.nom,
      chaine_id: chaineActive.id,
      date: occ.date,
      heure_debut: heureDebut,
      heure_fin: heureFin,
      genre: programme.genre,
      titre_cache: programme.titre,
      origine: 'AUTOMATIQUE',
      run_id: runId,
    })

    if (!datesConnuesParTitre.has(programme.id)) datesConnuesParTitre.set(programme.id, [])
    datesConnuesParTitre.get(programme.id).push(occ.date)
    const dp = dernierePlacementParTitre.get(programme.id)
    if (!dp || occ.date > dp) dernierePlacementParTitre.set(programme.id, occ.date)
    nbPlacementsParTitre.set(programme.id, (nbPlacementsParTitre.get(programme.id) ?? 0) + 1)
    const de = dernierePlacementParEpisode.get(episode.id)
    if (!de || occ.date > de) dernierePlacementParEpisode.set(episode.id, occ.date)
  }

  // EXG-M4-08 : signale les titres RETENUS dont les droits arrivent à
  // échéance sur la période (pas de nouvelle logique, réutilise
  // fenetresProchesDeLaFermeture).
  const echeancesProches = []
  const titresSignales = new Set()
  for (const pl of placements) {
    if (titresSignales.has(pl.programme_id)) continue
    const fenetresDuTitre = fenetresDroits.filter((f) => f.programme_id === pl.programme_id)
    if (fenetresProchesDeLaFermeture(fenetresDuTitre, pl.date).length > 0) {
      titresSignales.add(pl.programme_id)
      echeancesProches.push({ programme_id: pl.programme_id, titre: pl.titre_cache })
    }
  }

  return { propositions: placements, rapport: { placements, nonPourvus, echeancesProches } }
}
