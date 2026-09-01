// Stock et bilans (M9, P18). Calcul pur, recalculé à chaque rendu — même
// famille que droits.js/couverture.js. Aucune écriture, aucun accès Supabase.
import { estProgrammable, estEpisodePret, fenetresProchesDeLaFermeture } from './droits.js'
import { GENRES } from './genres.js'
import { joursEntre, dureeTransmissionMinutes } from './semaine.js'

// EXG-M9-01, définition littérale : un épisode compte dans le volume
// disponible seulement s'il est prêt à diffuser ET que son titre a des
// droits ouverts à la date de référence (jamais l'un sans l'autre).
function episodeDisponible(episode, programmeId, fenetresDroits, dateReference) {
  return estEpisodePret(episode) && estProgrammable(programmeId, fenetresDroits, dateReference).ok
}

// Indicateurs de tête (§4.10.2) : réagissent tous aux mêmes filtres
// genre/statut déjà appliqués par l'appelant sur `programmesFiltres`.
export function calculerIndicateursTete(programmesFiltres, episodesParProgrammeId, fenetresDroits, dateReference) {
  let volumeMinutes = 0
  let nbTitresHorsDroits = 0

  for (const p of programmesFiltres) {
    const episodes = episodesParProgrammeId.get(p.id) ?? []
    for (const ep of episodes) {
      if (episodeDisponible(ep, p.id, fenetresDroits, dateReference)) volumeMinutes += ep.duree ?? 0
    }
    if (!estProgrammable(p.id, fenetresDroits, dateReference).ok) nbTitresHorsDroits += 1
  }

  const idsFilters = new Set(programmesFiltres.map((p) => p.id))
  const idsFinsDeDroits = new Set(
    fenetresProchesDeLaFermeture(fenetresDroits, dateReference)
      .filter((f) => idsFilters.has(f.programme_id))
      .map((f) => f.programme_id)
  )

  return {
    volumeMinutes,
    nbTitresRetenus: programmesFiltres.length,
    nbTitresFinsDeDroits: idsFinsDeDroits.size,
    nbTitresHorsDroits,
  }
}

// Indicateurs approfondis du tableau de bord (P31) — même famille que
// calculerIndicateursTete, calculés à partir des mêmes données déjà chargées
// par l'écran. Trois axes : rotation du catalogue, maturité PAD, marge de
// diffusion (droits) — plus un aperçu du plan média live.
//
// `programmes` = tout le catalogue de la chaîne (pour la rotation, volontairement
// indépendante des filtres genre/statut) ; `programmesFiltres` = les titres
// retenus par les filtres (pour la maturité PAD, cohérente avec les cartes de
// tête). `diffusionsPeriode` = grille LIVE sur la semaine de référence.
export function calculerIndicateursApprofondis({
  programmes,
  programmesFiltres,
  episodesParProgrammeId,
  fenetresDroits,
  diffusionsPeriode,
  elementsSecondaires,
  dateReference,
}) {
  // --- rotation du catalogue sur la période ---
  const idsAntenne = new Set(diffusionsPeriode.map((d) => d.programme_id).filter(Boolean))
  const nbTitresTotal = programmes.length
  const nbTitresAntenne = programmes.filter((p) => idsAntenne.has(p.id)).length
  const nbTitresDormants = nbTitresTotal - nbTitresAntenne
  const tauxRotation = nbTitresTotal > 0 ? Math.round((nbTitresAntenne / nbTitresTotal) * 100) : 0
  const nbPassagesSemaine = diffusionsPeriode.length
  const chargeAntenneMinutes = diffusionsPeriode.reduce((acc, d) => acc + dureeTransmissionMinutes(d), 0)

  // --- maturité PAD sur les titres retenus par les filtres ---
  let nbEpisodesPrets = 0
  let nbEpisodesTotal = 0
  for (const p of programmesFiltres) {
    const eps = episodesParProgrammeId.get(p.id) ?? []
    nbEpisodesTotal += eps.length
    nbEpisodesPrets += eps.filter((ep) => estEpisodePret(ep)).length
  }
  const tauxPad = nbEpisodesTotal > 0 ? Math.round((nbEpisodesPrets / nbEpisodesTotal) * 100) : 0

  // --- marge de diffusion (droits) ---
  let passagesRestantsCumul = 0
  let nbFenetresIllimitees = 0
  for (const f of fenetresDroits) {
    if (f.illimite) {
      nbFenetresIllimitees += 1
      continue
    }
    passagesRestantsCumul += Math.max(0, (f.passages_autorises ?? 0) - (f.passages_consommes ?? 0))
  }
  const proches = fenetresProchesDeLaFermeture(fenetresDroits, dateReference)
  const prochaineEcheance = proches.reduce(
    (min, f) => (min == null || f.date_fin < min ? f.date_fin : min),
    null
  )
  const joursAvantEcheance = prochaineEcheance ? joursEntre(dateReference, prochaineEcheance) : null

  // --- plan média live ---
  const volumeSecondaireMinutes = Math.round(
    elementsSecondaires.reduce((acc, e) => acc + (e.duree_secondes ?? 0), 0) / 60
  )
  const parTypeSecondaire = {}
  for (const e of elementsSecondaires) parTypeSecondaire[e.type] = (parTypeSecondaire[e.type] ?? 0) + 1

  return {
    nbTitresTotal,
    nbTitresAntenne,
    nbTitresDormants,
    tauxRotation,
    nbPassagesSemaine,
    chargeAntenneMinutes,
    nbEpisodesPrets,
    nbEpisodesTotal,
    tauxPad,
    passagesRestantsCumul,
    nbFenetresIllimitees,
    joursAvantEcheance,
    volumeSecondaireMinutes,
    parTypeSecondaire,
  }
}

// Statistiques du non-linéaire (P31). Les deux canaux sont traités
// SÉPARÉMENT — les réseaux sociaux (promo) et la VOD (contenu complet en
// ligne) ne se mélangent jamais. `joursPeriode` = dates ISO de la semaine de
// référence (pour « publié cette semaine »). Aucune notion d'épisode ici.
function bilanCanal(publications, periode) {
  const parStatut = { BROUILLON: 0, PROGRAMME: 0, PUBLIE: 0, ANNULE: 0 }
  let publieesPeriode = 0
  for (const p of publications) {
    parStatut[p.statut] = (parStatut[p.statut] ?? 0) + 1
    if (p.statut === 'PUBLIE' && periode.has(p.date_publication)) publieesPeriode += 1
  }
  const total = publications.length
  const actives = total - parStatut.ANNULE
  return {
    total,
    parStatut,
    publieesPeriode,
    enPreparation: parStatut.BROUILLON + parStatut.PROGRAMME,
    tauxPublie: actives > 0 ? Math.round((parStatut.PUBLIE / actives) * 100) : 0,
  }
}

export function calculerStatsNonLineaire(publicationsReseau, publicationsVod, joursPeriode = []) {
  const periode = new Set(joursPeriode)

  const parPlateforme = new Map()
  for (const p of publicationsReseau) parPlateforme.set(p.plateforme, (parPlateforme.get(p.plateforme) ?? 0) + 1)

  return {
    reseau: {
      ...bilanCanal(publicationsReseau, periode),
      // ordonné du plus fréquent au moins fréquent, pour un graphe lisible
      parPlateforme: [...parPlateforme.entries()]
        .map(([plateforme, nb]) => ({ plateforme, nb }))
        .sort((a, b) => b.nb - a.nb),
    },
    vod: bilanCanal(publicationsVod, periode),
  }
}

// Répartition par genre (§4.10.2) : les 9 genres de la liste fermée, dans cet
// ordre — « nombre d'épisodes prêts » compte exactement les épisodes qui
// contribuent au volume de la ligne (PAD + droits ouverts), pas un simple
// total PAD indépendant, pour rester cohérent avec le volume affiché à côté.
export function calculerRepartitionParGenre(programmes, episodesParProgrammeId, fenetresDroits, dateReference) {
  const parGenre = new Map(GENRES.map((g) => [g.fr, { volumeMinutes: 0, nbEpisodesPrets: 0, nbTitres: 0 }]))

  for (const p of programmes) {
    const entree = parGenre.get(p.genre)
    if (!entree) continue // genre non renseigné ou hors liste fermée : ignoré
    const episodes = episodesParProgrammeId.get(p.id) ?? []
    let contribue = false
    for (const ep of episodes) {
      if (episodeDisponible(ep, p.id, fenetresDroits, dateReference)) {
        entree.volumeMinutes += ep.duree ?? 0
        entree.nbEpisodesPrets += 1
        contribue = true
      }
    }
    if (contribue) entree.nbTitres += 1
  }

  return GENRES.map((g) => ({ genre: g, ...parGenre.get(g.fr) }))
}

// « À consommer avant expiration » (§4.10.2) : titres dont une fenêtre se
// referme sous 45 jours (droits.js, déjà validée en P14a), triés par
// échéance croissante. Une seule ligne par titre même si plusieurs fenêtres
// proches existent (la plus proche gagne).
export function calculerTitresFinsDeDroits(programmes, episodesParProgrammeId, fenetresDroits, dateReference) {
  const programmesParId = new Map(programmes.map((p) => [p.id, p]))
  const parTitre = new Map()
  for (const f of fenetresProchesDeLaFermeture(fenetresDroits, dateReference)) {
    if (!programmesParId.has(f.programme_id)) continue
    const actuelle = parTitre.get(f.programme_id)
    if (!actuelle || f.date_fin < actuelle.date_fin) parTitre.set(f.programme_id, f)
  }

  return [...parTitre.entries()]
    .map(([programmeId, fenetre]) => ({
      programmeId,
      titre: programmesParId.get(programmeId)?.titre ?? '—',
      dateFin: fenetre.date_fin,
      nbEpisodesPrets: (episodesParProgrammeId.get(programmeId) ?? []).filter((ep) => estEpisodePret(ep)).length,
      passagesRestants: Math.max(0, fenetre.passages_autorises - fenetre.passages_consommes),
    }))
    .sort((a, b) => (a.dateFin < b.dateFin ? -1 : a.dateFin > b.dateFin ? 1 : 0))
}

// EXG-M9-03 : un titre est « non programmé » sur la période s'il n'a aucune
// ligne dans les diffusions de cette période (déjà filtrées par l'appelant).
export function estProgrammeNonProgramme(programmeId, diffusionsPeriode) {
  return !diffusionsPeriode.some((d) => d.programme_id === programmeId)
}

export function formaterVolumeHeures(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h} h ${String(m).padStart(2, '0')}`
}
