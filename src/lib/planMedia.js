// Moteur de plan média (M5, P16). Pur — aucun accès Supabase, aucune écriture.
// Même contrat que autoprog.js : prend des données déjà chargées par l'écran,
// renvoie une PROPOSITION + un rapport, jamais une écriture directe (consigne
// explicite de cette phase : propose → aperçu → confirme → annulable).
//
// Tout le calcul de position/durée interne se fait en SECONDES entières,
// jamais via heureEnMinutes/minutesEnHeure (semaine.js) qui tronquent
// silencieusement les secondes (`hhmm.split(':').map(Number)` ne garde que
// [h, m]) — des éléments de 10 s/30 s placés bout à bout se chevaucheraient
// silencieusement si on repassait par ces helpers minute-only en interne.
import { minutesDepuisDebutAntenne, estPosterieur, dureeTransmissionMinutes } from './semaine.js'
import { trancheDe } from './tranches.js'

// Durées non paramétrables à l'écran (le cahier ne rend configurable que la
// durée d'un écran publicitaire, EXG-M5-07) — valeurs reprises du mockup de
// référence (design-reference/stm-next-mockup.html, catalogue SECONDAIRES),
// seule source disponible pour ces deux valeurs.
export const DUREE_HABILLAGE_SECONDES = 10
export const DUREE_BANDE_ANNONCE_SECONDES = 30
// Valeur par défaut du champ « durée d'un écran publicitaire » (seule durée
// réellement paramétrable à l'écran, EXG-M5-07) — reprise du mockup de
// référence, aucune autre source ne suggère de valeur.
export const DUREE_ECRAN_DEFAUT_SECONDES = 180
const GARDE_MAX_ITERATIONS_PAR_INTERVALLE = 100

// --- intervalles à pourvoir ---

// Écart entre la fin d'un programme et le début du suivant (§4.6.5) — pas de
// notion de bloc de grille type ici, contrairement à calculerTrous
// (grilleType.js) : rien avant le 1er programme du jour ni après le dernier.
// Renvoie des bornes en MINUTES d'antenne (même unité que calculerTrous), la
// conversion en secondes se fait au moment de consommer le budget.
export function calculerIntervalles(dates, diffusions) {
  const parJour = new Map()
  for (const d of diffusions) {
    if (!parJour.has(d.date)) parJour.set(d.date, [])
    parJour.get(d.date).push(d)
  }

  const intervalles = []
  for (const date of dates) {
    const jour = (parJour.get(date) ?? [])
      .slice()
      .sort((a, b) => minutesDepuisDebutAntenne(a.heure_debut) - minutesDepuisDebutAntenne(b.heure_debut))
    for (let i = 0; i < jour.length - 1; i++) {
      const debut = minutesDepuisDebutAntenne(jour[i].heure_fin)
      const fin = minutesDepuisDebutAntenne(jour[i + 1].heure_debut)
      if (fin <= debut) continue // chevauchement ou adjacence stricte : rien à combler
      intervalles.push({ date, debut, fin, apresTransmissionId: jour[i].id })
    }
  }
  return intervalles
}

// Points d'insertion MANUELLE du Plan média : un créneau APRÈS CHAQUE
// transmission de la journée — y compris le dernier programme (créneau jusqu'à
// 06:00 le lendemain, fin de la journée d'antenne). C'est le socle du Plan
// média : chaque programme de la grille linéaire de la journée est un point
// d'ancrage visible, indépendamment de l'existence d'un écart réel.
//
// À NE PAS confondre avec calculerIntervalles (moteur auto, §4.6.5) qui, lui,
// ignore volontairement l'après-dernier-programme. Deux programmes adjacents
// (aucun écart) donnent un créneau borné à [debut, debut] : le programme reste
// visible mais aucune insertion n'y est possible tant que l'écart est nul.
export function calculerPointsInsertion(dates, diffusions) {
  const parJour = new Map()
  for (const d of diffusions) {
    if (!parJour.has(d.date)) parJour.set(d.date, [])
    parJour.get(d.date).push(d)
  }

  const FIN_JOURNEE_ANTENNE_MINUTES = 30 * 60 // 06:00 le lendemain
  const points = []
  for (const date of dates) {
    const jour = (parJour.get(date) ?? [])
      .slice()
      .sort((a, b) => minutesDepuisDebutAntenne(a.heure_debut) - minutesDepuisDebutAntenne(b.heure_debut))
    jour.forEach((t, i) => {
      const debut = minutesDepuisDebutAntenne(t.heure_fin)
      const finSuivante =
        i < jour.length - 1 ? minutesDepuisDebutAntenne(jour[i + 1].heure_debut) : FIN_JOURNEE_ANTENNE_MINUTES
      points.push({ date, debut, fin: Math.max(finSuivante, debut), apresTransmissionId: t.id })
    })
  }
  return points
}

// --- protection RG-M5-06 (inconditionnelle, pas de case « Écraser ») ---

// Une ligne MANUELLE est toujours protégée. Une ligne AUTOMATIQUE ne l'est
// que si elle est hors de la période régénérée — contrairement à M4, ce n'est
// jamais conditionné par une case à cocher (RG-M5-06 est impérative).
function estProtege(element, dateDebut, dateFin) {
  if (element.origine !== 'AUTOMATIQUE') return true
  return element.date < dateDebut || element.date > dateFin
}

function secondesEnMinutes(secondes) {
  return Math.floor(secondes / 60)
}

export function secondesEnHeureHMS(secondesDepuisDebutAntenne) {
  const total = ((secondesDepuisDebutAntenne % 86400) + 86400) % 86400
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Inverse de secondesEnHeureHMS : reconstruit les « secondes depuis le début
// de la journée d'antenne » à partir d'une heure d'horloge "HH:MM:SS" telle
// que stockée en base (element_secondaire.heure_debut/heure_fin). Même
// bascule que minutesDepuisDebutAntenne (semaine.js), à la seconde près :
// une heure avant 06:00 appartient à la fin de la journée d'antenne en cours
// (ex. "01:00:00" → 90000, pas 3600).
export function heureHMSEnSecondes(hms) {
  const [h, m, s] = hms.split(':').map(Number)
  const secondesClock = h * 3600 + m * 60 + (s || 0)
  const DEBUT_JOURNEE_ANTENNE_SECONDES = 360 * 60
  return secondesClock < DEBUT_JOURNEE_ANTENNE_SECONDES ? secondesClock + 86400 : secondesClock
}

// Insertion manuelle (précision seconde) : vrai si le placement reste dans
// les bornes de la coupure (intervalle, en minutes d'antenne — mêmes bornes
// que calculerIntervalles) ET ne chevauche aucun élément déjà présent dans
// cette même coupure. `elementsDansCetIntervalle` : lignes element_secondaire
// dont apres_transmission_id est déjà celui de la coupure visée (filtrage à
// la charge de l'appelant, pas ici).
export function estPlacementValide(heureDebutSecondes, dureeSecondes, intervalle, elementsDansCetIntervalle) {
  const debutBorne = intervalle.debut * 60
  const finBorne = intervalle.fin * 60
  if (heureDebutSecondes < debutBorne) return false
  if (heureDebutSecondes + dureeSecondes > finBorne) return false

  const finPlacement = heureDebutSecondes + dureeSecondes
  return elementsDansCetIntervalle.every((e) => {
    const debutExistant = heureHMSEnSecondes(e.heure_debut)
    const finExistant = heureHMSEnSecondes(e.heure_fin)
    return finPlacement <= debutExistant || heureDebutSecondes >= finExistant
  })
}

// --- notation des campagnes candidates (§4.6.5) ---
//
// Le cahier énonce 3 facteurs sans formule ("sa priorité, l'écart entre son
// objectif et le nombre de bandes-annonces déjà placées, et l'appartenance de
// l'intervalle à ses tranches ciblées") — poids choisis ici, documentés pour
// ajustement facile après démo :
//   Priorité dominante : HAUTE=300 / NORMALE=100 / BASSE=0.
//   Écart à l'objectif, normalisé en ratio borné [0, 60] — jamais une valeur
//     brute non bornée : une campagne à objectif=1000 avec 1 seule BA placée
//     ne doit pas écraser la priorité avec un score de +999.
//   Bonus tranche ciblée : +50 si l'intervalle appartient aux tranches
//     ciblées de la campagne (sinon la campagne reste éligible mais avec une
//     note inférieure, jamais exclue pour ce seul motif).
// Départage final, toujours déterministe : titre du programme promu
// (localeCompare) puis campagne.id.
const POIDS_PRIORITE = { HAUTE: 300, NORMALE: 100, BASSE: 0 }
const POIDS_ECART_MAX = 60
const BONUS_TRANCHE = 50

function noterCampagne(campagne, placeesActuelles, tranche) {
  const ecart =
    campagne.objectif > 0 ? Math.round((POIDS_ECART_MAX * (campagne.objectif - placeesActuelles)) / campagne.objectif) : 0
  const bonusTranche = tranche && campagne.tranches_ciblees.includes(tranche.code) ? BONUS_TRANCHE : 0
  return (POIDS_PRIORITE[campagne.priorite] ?? POIDS_PRIORITE.NORMALE) + ecart + bonusTranche
}

function ajouterMotif(motifsParCampagne, campagneId, motif) {
  if (!motifsParCampagne.has(campagneId)) motifsParCampagne.set(campagneId, new Set())
  motifsParCampagne.get(campagneId).add(motif)
}

// Meilleure campagne éligible pour CET intervalle précis. Applique dans
// l'ordre : période de la campagne (structurel, jamais un motif de rapport),
// objectif déjà atteint (cesse d'être candidate — succès, pas un motif
// d'échec), RG-M5-04 (déjà retenue dans cet intervalle, garde explicite par
// Set — indépendante de la séparation, qui ne suffit pas seule quand
// separation_minutes=0), RG-M5-02 (maximum journalier), RG-M5-03 (séparation,
// en minutes), RG-M5-01 (diffusion à venir, sur TOUTE la chaîne).
function meilleureCampagne(campagnes, intervalle, tranche, dejaUtiliseesDansIntervalle, ctx) {
  const candidats = []
  for (const c of campagnes) {
    if (intervalle.date < c.date_debut || intervalle.date > c.date_fin) continue
    const placees = ctx.totalParCampagne.get(c.id) ?? 0
    if (placees >= c.objectif) continue
    if (dejaUtiliseesDansIntervalle.has(c.id)) continue

    const kj = `${c.id}|${intervalle.date}`
    if ((ctx.parJourParCampagne.get(kj) ?? 0) >= c.max_par_jour) {
      ajouterMotif(ctx.motifsParCampagne, c.id, 'MAX_JOUR')
      continue
    }
    // Bidirectionnel : une diffusion MANUELLE plus tard le même jour (déjà
    // protégée, donc déjà connue avant même que le passage chronologique de
    // ce run ne l'atteigne) doit aussi compter — comparer seulement à la
    // dernière minute VUE JUSQU'ICI raterait une collision avec un placement
    // qui existe déjà plus loin dans la même journée.
    const minutesConnues = ctx.minutesConnuesParCampagneJour.get(kj) ?? []
    const separationOk = minutesConnues.every((m) => Math.abs(intervalle.debut - m) >= c.separation_minutes)
    if (!separationOk) {
      ajouterMotif(ctx.motifsParCampagne, c.id, 'SEPARATION')
      continue
    }
    const diffusionAVenir = ctx.diffusionsToutes.some(
      (d) =>
        d.programme_id === c.programme_id &&
        estPosterieur(d.date, minutesDepuisDebutAntenne(d.heure_debut), intervalle.date, intervalle.debut)
    )
    if (!diffusionAVenir) {
      ajouterMotif(ctx.motifsParCampagne, c.id, 'AUCUNE_DIFFUSION_A_VENIR')
      continue
    }

    candidats.push({ campagne: c, score: noterCampagne(c, placees, tranche) })
  }

  if (candidats.length === 0) return null
  candidats.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const titreA = ctx.programmesParId.get(a.campagne.programme_id)?.titre ?? ''
    const titreB = ctx.programmesParId.get(b.campagne.programme_id)?.titre ?? ''
    const cmp = titreA.localeCompare(titreB)
    return cmp !== 0 ? cmp : a.campagne.id.localeCompare(b.campagne.id)
  })
  return candidats[0].campagne
}

const LIBELLES_MOTIFS = {
  AUCUNE_DIFFUSION_A_VENIR: 'Aucune diffusion à venir du programme promu.',
  MAX_JOUR: 'Maximum journalier atteint chaque jour disponible.',
  SEPARATION: 'Séparation minimale non respectée sur les intervalles disponibles.',
}
const PRIORITE_MOTIFS = ['AUCUNE_DIFFUSION_A_VENIR', 'MAX_JOUR', 'SEPARATION']

// Motif résiduel volontairement unique (pas de distinction « concurrencée »
// vs « budget insuffisant ») : les deux se confondent en pratique — une
// campagne peut être placée une fois puis manquer d'intervalles restants
// avant d'atteindre son objectif, sans qu'aucune autre campagne n'ait
// jamais été en concurrence directe sur ce créneau précis.
const MOTIF_RESIDUEL = "Pas assez d'intervalles disponibles sur la période pour atteindre l'objectif."

function motifCouverture(motifsRencontres) {
  for (const m of PRIORITE_MOTIFS) {
    if (motifsRencontres.has(m)) return LIBELLES_MOTIFS[m]
  }
  return MOTIF_RESIDUEL
}

// --- génération ---

// `dates` : période complète sélectionnée à l'écran. `intervalles` : sortie
// de calculerIntervalles pour ces mêmes dates, déjà triés par date puis
// heure. `diffusionsToutes`/`elementsExistants` : tout l'historique de la
// chaîne, pas seulement la période affichée (RG-M5-01/02/03 en dépendent).
// `opts` : { habillageActif, ecranPubActif, bandesAnnoncesActives,
// dureeEcranSecondes, tranchesCommercialisees: string[] }. `runId` : uuid
// généré côté écran, posé sur chaque ligne proposée (annulation groupée).
// `spots` : bibliothèque (spot_bibliotheque) — servent uniquement à la règle
// P32. `regle` : { active, duree_min_minutes, duree_max_minutes,
// nombre_annonces, spot_ids } ou null — si active, AJOUTE nombre_annonces
// éléments (piochés dans le pool) dans chaque coupure dont le programme
// précédent dure entre [min, max] minutes ; s'ajoute au remplissage par
// défaut, ne le remplace pas.
export function genererElementsSecondaires({
  dates,
  intervalles,
  campagnes,
  programmesParId,
  diffusionsToutes,
  elementsExistants,
  opts,
  runId,
  chaineActive,
  planMediaId,
  spots = [],
  regle = null,
}) {
  const dateDebut = dates[0]
  const dateFin = dates[dates.length - 1]
  const elementsProteges = elementsExistants.filter((e) => estProtege(e, dateDebut, dateFin))

  const totalParCampagne = new Map()
  const parJourParCampagne = new Map()
  const minutesConnuesParCampagneJour = new Map() // kj -> minute[], pas un seul rolling max (voir RG-M5-03)

  for (const e of elementsProteges) {
    if (e.type !== 'BANDE_ANNONCE' || !e.campagne_id) continue
    totalParCampagne.set(e.campagne_id, (totalParCampagne.get(e.campagne_id) ?? 0) + 1)
    const kj = `${e.campagne_id}|${e.date}`
    parJourParCampagne.set(kj, (parJourParCampagne.get(kj) ?? 0) + 1)
    if (!minutesConnuesParCampagneJour.has(kj)) minutesConnuesParCampagneJour.set(kj, [])
    minutesConnuesParCampagneJour.get(kj).push(minutesDepuisDebutAntenne(e.heure_debut))
  }

  const ctx = {
    totalParCampagne,
    parJourParCampagne,
    minutesConnuesParCampagneJour,
    diffusionsToutes,
    programmesParId,
    motifsParCampagne: new Map(),
  }

  // Règle P32 : durée du programme précédent + pool d'items à piocher.
  const diffusionsParId = new Map(diffusionsToutes.map((d) => [d.id, d]))
  const poolRegle = regle?.spot_ids?.length ? spots.filter((s) => regle.spot_ids.includes(s.id)) : spots
  let indexPiocheRegle = 0

  const placements = []

  for (const intervalle of intervalles) {
    let resteSecondes = (intervalle.fin - intervalle.debut) * 60
    let curseurSecondes = intervalle.debut * 60
    const campagnesUtiliseesDansCetIntervalle = new Set()
    const tranche = trancheDe(intervalle.debut)

    const placer = (type, dureeSecondes, campagneId, libelle) => {
      placements.push({
        chaine_id: chaineActive.id,
        plan_media_id: planMediaId,
        date: intervalle.date,
        heure_debut: secondesEnHeureHMS(curseurSecondes),
        heure_fin: secondesEnHeureHMS(curseurSecondes + dureeSecondes),
        duree_secondes: dureeSecondes,
        apres_transmission_id: intervalle.apresTransmissionId,
        type,
        libelle,
        campagne_id: campagneId ?? null,
        origine: 'AUTOMATIQUE',
        run_id: runId,
      })
      resteSecondes -= dureeSecondes
      curseurSecondes += dureeSecondes
    }

    if (opts.habillageActif && resteSecondes >= DUREE_HABILLAGE_SECONDES) {
      placer('HABILLAGE', DUREE_HABILLAGE_SECONDES, null, "Habillage d'inter-programme")
    }

    if (
      opts.ecranPubActif &&
      tranche &&
      opts.tranchesCommercialisees.includes(tranche.code) &&
      resteSecondes >= opts.dureeEcranSecondes
    ) {
      placer('ECRAN_PUBLICITAIRE', opts.dureeEcranSecondes, null, `Écran publicitaire — ${tranche.label}`)
    }

    // Règle P32 (s'ajoute au défaut) : si le programme qui précède cette
    // coupure dure entre [min, max] minutes, on pose nombre_annonces items
    // piochés en rotation dans le pool, tant que le budget le permet.
    if (regle?.active && regle.nombre_annonces > 0 && poolRegle.length > 0) {
      const precedente = diffusionsParId.get(intervalle.apresTransmissionId)
      const dureeProg = precedente ? dureeTransmissionMinutes(precedente) : null
      if (dureeProg != null && dureeProg >= regle.duree_min_minutes && dureeProg <= regle.duree_max_minutes) {
        for (let k = 0; k < regle.nombre_annonces; k++) {
          const item = poolRegle[indexPiocheRegle % poolRegle.length]
          indexPiocheRegle += 1
          if (resteSecondes < item.duree_secondes) break
          placer(item.type, item.duree_secondes, null, item.libelle)
        }
      }
    }

    if (opts.bandesAnnoncesActives) {
      let garde = 0
      while (resteSecondes >= DUREE_BANDE_ANNONCE_SECONDES && garde++ < GARDE_MAX_ITERATIONS_PAR_INTERVALLE) {
        const campagne = meilleureCampagne(campagnes, intervalle, tranche, campagnesUtiliseesDansCetIntervalle, ctx)
        if (!campagne) break

        const titre = programmesParId.get(campagne.programme_id)?.titre ?? 'Programme'
        const minutePlacement = secondesEnMinutes(curseurSecondes)
        placer('BANDE_ANNONCE', DUREE_BANDE_ANNONCE_SECONDES, campagne.id, `Bande-annonce — ${titre}`)

        campagnesUtiliseesDansCetIntervalle.add(campagne.id)
        totalParCampagne.set(campagne.id, (totalParCampagne.get(campagne.id) ?? 0) + 1)
        const kj = `${campagne.id}|${intervalle.date}`
        parJourParCampagne.set(kj, (parJourParCampagne.get(kj) ?? 0) + 1)
        if (!minutesConnuesParCampagneJour.has(kj)) minutesConnuesParCampagneJour.set(kj, [])
        minutesConnuesParCampagneJour.get(kj).push(minutePlacement)
      }
    }
  }

  // EXG-M5-05 : cause exacte pour chaque campagne n'ayant pas atteint son
  // objectif à l'issue du run.
  const causesNonCouvertes = []
  for (const campagne of campagnes) {
    const placees = totalParCampagne.get(campagne.id) ?? 0
    if (placees >= campagne.objectif) continue
    const titre = programmesParId.get(campagne.programme_id)?.titre ?? 'Programme'
    causesNonCouvertes.push({
      campagne_id: campagne.id,
      titre,
      placees,
      objectif: campagne.objectif,
      motif: motifCouverture(ctx.motifsParCampagne.get(campagne.id) ?? new Set()),
    })
  }

  return { propositions: placements, rapport: { causesNonCouvertes } }
}
