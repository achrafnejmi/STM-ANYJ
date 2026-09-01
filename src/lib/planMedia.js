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
import { minutesDepuisDebutAntenne, dureeTransmissionMinutes } from './semaine.js'

// Durée d'une bande-annonce insérée manuellement (PanneauInsertionManuelle) —
// valeur reprise du mockup de référence (design-reference/stm-next-mockup.html,
// catalogue SECONDAIRES).
export const DUREE_BANDE_ANNONCE_SECONDES = 30

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

// --- génération par règles (P32/P33/P34) ---

// `dates` : période sélectionnée. `points` : sortie de calculerPointsInsertion
// pour ces dates — un point par transmission de la journée, dernier inclus.
// `diffusionsToutes` donne la transmission (heure_debut/heure_fin, programme_id)
// via son id. `elementsExistants` : éléments du plan média — on ne chevauche
// jamais ceux qui sont PROTÉGÉS (MANUELLE ou hors période). `runId` : uuid posé
// sur chaque ligne proposée (annulation groupée). `spots` : bibliothèque.
// `regles` : bibliothèque de règles ; TOUTES les règles actives s'appliquent
// (empilées). Pour chaque transmission dont la durée ∈ [min, max] ET (genres
// vide OU son genre est ciblé), une règle pose `nombre_annonces` items ENTRE
// les programmes (dans la coupure qui suit) et `annonces_intra` items DANS le
// programme (répartis sur sa durée). Items piochés en rotation dans le pool de
// la règle (spot_ids, ou toute la bibliothèque si vide). Aucun moteur campagne.
export function genererElementsSecondaires({
  dates,
  points,
  programmesParId,
  diffusionsToutes,
  elementsExistants,
  runId,
  chaineActive,
  planMediaId,
  spots = [],
  regles = [],
}) {
  const dateDebut = dates[0]
  const dateFin = dates[dates.length - 1]
  const proteges = elementsExistants.filter((e) => estProtege(e, dateDebut, dateFin))
  const diffusionsParId = new Map(diffusionsToutes.map((d) => [d.id, d]))
  const reglesActives = regles.filter((r) => r.active)
  const poolParRegle = new Map(
    reglesActives.map((r) => [r.id, r.spot_ids?.length ? spots.filter((s) => r.spot_ids.includes(s.id)) : spots])
  )
  const indexPiocheParRegle = new Map(reglesActives.map((r) => [r.id, 0]))
  const placements = []

  // Éléments déjà présents (protégés) + déjà posés dans ce run, rattachés à la
  // transmission `tId`, dont l'heure de début tombe dans la fenêtre [aSec, bSec[.
  const elementsDansFenetre = (tId, dateJour, aSec, bSec) =>
    [...proteges, ...placements].filter((e) => {
      if (e.apres_transmission_id !== tId || e.date !== dateJour) return false
      const d = heureHMSEnSecondes(e.heure_debut)
      return d >= aSec && d < bSec
    })

  // Pose jusqu'à `nb` items en série depuis `curseurDepartSec`, tant que ça
  // rentre dans la fenêtre et ne chevauche rien.
  const poserSerie = (r, fenetre, curseurDepartSec, nb, dejaLa) => {
    let curseur = curseurDepartSec
    const finSec = fenetre.fin * 60
    for (let k = 0; k < nb; k++) {
      const pool = poolParRegle.get(r.id)
      const idx = indexPiocheParRegle.get(r.id)
      const item = pool[idx % pool.length]
      if (curseur + item.duree_secondes > finSec) break
      if (!estPlacementValide(curseur, item.duree_secondes, fenetre, dejaLa)) break
      const ligne = {
        chaine_id: chaineActive.id,
        plan_media_id: planMediaId,
        date: fenetre.date,
        heure_debut: secondesEnHeureHMS(curseur),
        heure_fin: secondesEnHeureHMS(curseur + item.duree_secondes),
        duree_secondes: item.duree_secondes,
        apres_transmission_id: fenetre.apresTransmissionId,
        type: item.type,
        libelle: item.libelle,
        campagne_id: null,
        origine: 'AUTOMATIQUE',
        run_id: runId,
      }
      placements.push(ligne)
      dejaLa.push(ligne)
      indexPiocheParRegle.set(r.id, idx + 1)
      curseur += item.duree_secondes
    }
  }

  for (const point of points) {
    const t = diffusionsParId.get(point.apresTransmissionId)
    if (!t) continue
    const dureeProg = dureeTransmissionMinutes(t)
    const genreProg = programmesParId.get(t.programme_id)?.genre ?? null
    const debutProgMin = minutesDepuisDebutAntenne(t.heure_debut.slice(0, 5))
    const finProgMin = minutesDepuisDebutAntenne(t.heure_fin.slice(0, 5))

    for (const r of reglesActives) {
      if (dureeProg < r.duree_min_minutes || dureeProg > r.duree_max_minutes) continue
      if (r.genres?.length && (!genreProg || !r.genres.includes(genreProg))) continue
      const pool = poolParRegle.get(r.id)
      if (!pool || pool.length === 0) continue

      // ENTRE les programmes : dans la coupure qui suit, à la suite des
      // éléments déjà présents.
      const nbInter = r.nombre_annonces ?? 0
      if (nbInter > 0 && point.fin > point.debut) {
        const fenetre = { date: point.date, debut: point.debut, fin: point.fin, apresTransmissionId: t.id }
        const deja = elementsDansFenetre(t.id, point.date, point.debut * 60, point.fin * 60)
        const depart = deja.length
          ? Math.max(point.debut * 60, ...deja.map((e) => heureHMSEnSecondes(e.heure_fin)))
          : point.debut * 60
        poserSerie(r, fenetre, depart, nbInter, deja)
      }

      // DANS le programme : points de coupure répartis uniformément sur sa durée.
      const nbIntra = r.annonces_intra ?? 0
      if (nbIntra > 0 && finProgMin > debutProgMin) {
        const fenetre = { date: point.date, debut: debutProgMin, fin: finProgMin, apresTransmissionId: t.id }
        const deja = elementsDansFenetre(t.id, point.date, debutProgMin * 60, finProgMin * 60)
        const spanSec = (finProgMin - debutProgMin) * 60
        for (let i = 1; i <= nbIntra; i++) {
          const ideal = Math.round(debutProgMin * 60 + (spanSec * i) / (nbIntra + 1))
          const dernierFin = deja.length
            ? Math.max(...deja.map((e) => heureHMSEnSecondes(e.heure_fin)))
            : debutProgMin * 60
          poserSerie(r, fenetre, Math.max(ideal, dernierFin), 1, deja)
        }
      }
    }
  }

  return { propositions: placements, rapport: { causesNonCouvertes: [] } }
}
