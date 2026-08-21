import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CircleAlert, Layers3, Undo2, Redo2, X } from 'lucide-react'
import {
  listerDiffusionsLineairesParChaine,
  listerProgrammesParChaine,
  listerTousLesEpisodes,
  listerBlocsGrilleTypeParChaine,
  listerToutesLesFenetresDroits,
  listerEpisodes,
  creerDiffusionLineaire,
} from '../lib/db.js'
import { enregistrerAction, etatPile, annulerDerniereAction, retablirAction, fusionnerChangements } from '../lib/undoManager.js'
import { deprogrammerDiffusion } from '../lib/deprogrammation.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import { couleurType } from '../lib/couleursType.js'
import { calculerAnomalies, compterBloquantes } from '../lib/anomalies.js'
import { blocsActifsCeJour } from '../lib/grilleType.js'
import { estProgrammable, estEpisodePret } from '../lib/droits.js'
import { PX_PAR_MINUTE, HAUTEUR_TOTALE, genererMarquesHeures, positionVersMinute, disposerEnPistes } from '../lib/grilleAxe.js'
import {
  aujourdHuiISO,
  ajouterJours,
  lundiDeLaSemaine,
  joursDeLaSemaine,
  jourAntenneLundi0,
  formaterJourCourt,
  formaterPlageSemaine,
  formaterDateLongue,
  heureEnMinutes,
  minutesEnHeure,
  DEBUT_JOURNEE_ANTENNE,
  minutesDepuisDebutAntenne,
} from '../lib/semaine.js'
import Modal from '../components/Modal.jsx'
import CataloguePanel from '../components/CataloguePanel.jsx'
import PopoverHistorique from '../components/PopoverHistorique.jsx'
import InspecteurBloc from '../components/InspecteurBloc.jsx'
import PanneauAnomalies from '../components/PanneauAnomalies.jsx'

const DUREE_PAR_DEFAUT_MIN = 30
const MARQUES_HEURES = genererMarquesHeures()

export default function GrilleLineaire({ chaineActive, onAnomaliesBloquantes }) {
  const [vue, setVue] = useState('SEMAINE')
  const [dateReference, setDateReference] = useState(aujourdHuiISO())
  const [diffusions, setDiffusions] = useState([])
  const [programmes, setProgrammes] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [blocsGrilleType, setBlocsGrilleType] = useState([])
  const [fenetresDroits, setFenetresDroits] = useState([])
  const [afficherGrilleType, setAfficherGrilleType] = useState(true)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [modale, setModale] = useState(null)
  const [blocSelectionne, setBlocSelectionne] = useState(null)
  const [anomaliesOuvertes, setAnomaliesOuvertes] = useState(false)
  const [historiqueOuvert, setHistoriqueOuvert] = useState(null)
  const [pile, setPile] = useState({ peutAnnuler: false, libelleAnnuler: null, peutRetablir: false, libelleRetablir: null })
  const dragRef = useRef(null)

  useEffect(() => {
    setChargement(true)
    Promise.all([
      listerProgrammesParChaine(chaineActive.id),
      listerDiffusionsLineairesParChaine(chaineActive.id),
      listerTousLesEpisodes(),
      listerBlocsGrilleTypeParChaine(chaineActive.id),
      listerToutesLesFenetresDroits(),
    ])
      .then(([lignesProgrammes, lignesDiffusions, lignesEpisodes, lignesBlocs, lignesFenetres]) => {
        setProgrammes(lignesProgrammes)
        setDiffusions(lignesDiffusions)
        setEpisodes(lignesEpisodes)
        setBlocsGrilleType(lignesBlocs)
        setFenetresDroits(lignesFenetres)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  // Rafraîchi après chaque écriture (diffusions change systématiquement
  // après une création/édition/suppression, y compris via undoManager) — pas
  // de canal séparé à faire remonter depuis chaque site d'écriture.
  useEffect(() => {
    etatPile(chaineActive.id, 'GRILLE_LINEAIRE').then(setPile)
  }, [chaineActive, diffusions])

  // Ctrl+Z/Ctrl+Y locaux à cet écran (pas globaux comme Ctrl+K de la
  // recherche) — jamais interceptés si le focus est dans un champ texte, pour
  // ne pas voler le undo natif du navigateur.
  useEffect(() => {
    function onKeyDown(e) {
      const cible = document.activeElement
      if (cible && ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName)) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        gererAnnuler()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        gererRetablir()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gererAnnuler/gererRetablir lisent chaineActive par closure, seule dépendance réelle
  }, [chaineActive])

  const lundi = lundiDeLaSemaine(dateReference)
  const jours = useMemo(
    () => (vue === 'SEMAINE' ? joursDeLaSemaine(lundi) : [dateReference]),
    [vue, lundi, dateReference]
  )

  const programmesParId = useMemo(() => new Map(programmes.map((p) => [p.id, p])), [programmes])
  const programmesDeLaChaine = useMemo(
    () => [...programmes].sort((a, b) => a.titre.localeCompare(b.titre)),
    [programmes]
  )

  const diffusionsParJour = useMemo(() => {
    const map = new Map()
    for (const j of jours) map.set(j, [])
    for (const d of diffusions) {
      if (map.has(d.date)) map.get(d.date).push(d)
    }
    return map
  }, [diffusions, jours])

  const episodesParId = useMemo(() => new Map(episodes.map((e) => [e.id, e])), [episodes])

  // Anomalies calculées sur la période affichée (cahier §4.9.1), pas sur tout
  // l'historique de la chaîne — se recalcule à chaque écriture sans action
  // dédiée (EXG-M8-01), puisque `diffusions`/`jours` en dépendent déjà.
  const diffusionsAffichees = useMemo(
    () => jours.flatMap((j) => diffusionsParJour.get(j) ?? []),
    [jours, diffusionsParJour]
  )
  const anomalies = useMemo(
    () => calculerAnomalies(diffusionsAffichees, episodesParId, blocsGrilleType, fenetresDroits),
    [diffusionsAffichees, episodesParId, blocsGrilleType, fenetresDroits]
  )
  const idsBloquants = useMemo(
    () => new Set(anomalies.filter((a) => a.niveau === 'bloquant').map((a) => a.id)),
    [anomalies]
  )
  const nbBloquantes = compterBloquantes(anomalies)

  useEffect(() => {
    onAnomaliesBloquantes?.(nbBloquantes)
  }, [nbBloquantes, onAnomaliesBloquantes])

  const genresPresents = useMemo(() => {
    const set = new Set()
    for (const j of jours) {
      for (const d of diffusionsParJour.get(j) ?? []) {
        set.add(programmesParId.get(d.programme_id)?.genre || '')
      }
    }
    return [...set]
  }, [diffusionsParJour, jours, programmesParId])

  function naviguer(delta) {
    const pas = vue === 'SEMAINE' ? 7 * delta : delta
    setDateReference((d) => ajouterJours(d, pas))
  }

  function ouvrirCreation(date, heureDebut) {
    setBlocSelectionne(null)
    setAnomaliesOuvertes(false)
    setModale({ mode: 'CREATION', date, heureDebut })
  }

  // Panneau Anomalies et Inspecteur partagent le même emplacement flottant
  // (P11 : panneau flottant plutôt que 3e colonne) — mutuellement exclusifs,
  // comme le prescrit le cahier pour les 2 onglets du panneau droit (§4.3.2).
  function ouvrirAnomalies() {
    setBlocSelectionne(null)
    setAnomaliesOuvertes(true)
  }

  function allerVersAnomalie(id) {
    const diffusion = diffusions.find((d) => d.id === id)
    if (!diffusion) return
    setAnomaliesOuvertes(false)
    setBlocSelectionne(diffusion)
  }

  function appliquerCreation(nouvelle) {
    setDiffusions((prev) => [...prev, nouvelle])
    setModale(null)
  }

  // Réutilisée par l'onglet Bloc (édition horaire) et l'onglet Vecteur (mise à
  // jour de l'original après scission) de l'Inspecteur — si le bloc modifié
  // est celui actuellement inspecté, son affichage est resynchronisé sans que
  // l'utilisateur ait besoin de rouvrir le panneau.
  function appliquerEdition(maj) {
    setDiffusions((prev) => prev.map((d) => (d.id === maj.id ? maj : d)))
    setBlocSelectionne((actuel) => (actuel && actuel.id === maj.id ? maj : actuel))
  }

  function appliquerSuppression(id) {
    setDiffusions((prev) => prev.filter((d) => d.id !== id))
    setBlocSelectionne((actuel) => (actuel && actuel.id === id ? null : actuel))
  }

  // Onglet Répéter de l'Inspecteur : ajout en bloc après un insert en 1 seule
  // requête (creerDiffusionsLineaires), et onglet Vecteur : ajout de la ligne
  // SATELLITE créée par la scission (tableau à 1 élément).
  function appliquerCreationMultiple(nouvelles) {
    setDiffusions((prev) => [...prev, ...nouvelles])
  }

  // Applique le résultat d'un Annuler/Rétablir (toolbar ou raccourcis P11/P15
  // unifiés dans la pile générique, undoManager.js) à l'état local — même
  // mécanique que appliquerEdition/appliquerSuppression, réutilisée plutôt
  // que dupliquée : `ligne === null` -> la transmission disparaît, sinon elle
  // (ré)apparaît avec ce contenu.
  function appliquerChangementsPile(changements) {
    setDiffusions((prev) => fusionnerChangements(prev, changements))
    setBlocSelectionne((actuel) => {
      if (!actuel) return actuel
      const c = changements.find((c) => c.id === actuel.id)
      return c ? c.ligne : actuel
    })
  }

  async function gererAnnuler() {
    const resultat = await annulerDerniereAction(chaineActive.id, 'GRILLE_LINEAIRE')
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    appliquerChangementsPile(resultat.changements)
  }

  async function gererRetablir() {
    const resultat = await retablirAction(chaineActive.id, 'GRILLE_LINEAIRE')
    if (!resultat.ok) {
      setErreur(resultat.motif)
      return
    }
    appliquerChangementsPile(resultat.changements)
  }

  // La `date` d'une transmission = le jour d'antenne de la colonne où l'on
  // dépose/clique (RG-19/20) — jamais recalculée depuis heureDebut, même pour
  // un dépôt entre 00:00 et 05:59 qui reste rattaché à ce même jour d'antenne.
  //
  // Garde-fou (RG-01/RG-03/RG-07, EXG-M2-04/05, P14a) : contrôle AVANT toute
  // écriture, à la date de diffusion VISÉE (jourAntenne), pas aujourd'hui.
  // Le catalogue empêche déjà le drag d'un épisode non-PAD (defense en
  // profondeur ici, même logique que les gardes anti-réponse-périmée déjà en
  // place ailleurs) ; les droits du titre, eux, ne peuvent être vérifiés
  // qu'ici puisqu'ils dépendent du jour visé, connu seulement au dépôt.
  function deposerEpisode(jourAntenne, minuteDebut) {
    const payload = dragRef.current
    dragRef.current = null
    if (!payload) return
    const episode = episodesParId.get(payload.episodeId)
    if (!estEpisodePret(episode)) {
      setErreur('Dépôt refusé — support non prêt à diffuser (PAD).')
      return
    }
    const droits = estProgrammable(payload.programmeId, fenetresDroits, jourAntenne)
    if (!droits.ok) {
      setErreur(`Dépôt refusé — ${droits.motif}`)
      return
    }
    const heureDebut = minutesEnHeure(minuteDebut)
    const heureFin = minutesEnHeure(minuteDebut + (payload.duree ?? DUREE_PAR_DEFAUT_MIN))
    const programme = programmesParId.get(payload.programmeId)
    const champs = {
      programme_id: payload.programmeId,
      episode_id: payload.episodeId,
      episode_numero: payload.numero ?? null,
      chaine: chaineActive.nom,
      chaine_id: chaineActive.id,
      date: jourAntenne,
      heure_debut: heureDebut,
      heure_fin: heureFin,
      genre: programme?.genre || null,
      titre_cache: programme?.titre ?? null,
    }
    creerDiffusionLineaire(champs)
      .then((cree) =>
        enregistrerAction({
          chaineId: chaineActive.id,
          ecran: 'GRILLE_LINEAIRE',
          libelle: `Dépôt : ${cree.titre_cache}`,
          operations: [{ table: 'diffusion_lineaire', type: 'INSERT', id: cree.id, apres: cree }],
        }).then(() => appliquerCreation(cree))
      )
      .catch((err) => setErreur(err.message))
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex rounded-md border border-slate-300 text-sm">
              <button
                type="button"
                onClick={() => setVue('SEMAINE')}
                className={`px-3 py-2 ${vue === 'SEMAINE' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Semaine
              </button>
              <button
                type="button"
                onClick={() => setVue('JOUR')}
                className={`px-3 py-2 ${vue === 'JOUR' ? 'bg-snrt-navy text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Jour
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => naviguer(-1)}
              className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[12rem] text-center text-sm font-medium text-slate-700">
              {vue === 'SEMAINE' ? formaterPlageSemaine(lundi) : formaterDateLongue(dateReference)}
            </span>
            <button
              type="button"
              onClick={() => naviguer(1)}
              className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-50"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setDateReference(aujourdHuiISO())}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => setAfficherGrilleType((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
                afficherGrilleType
                  ? 'border-snrt-navy bg-snrt-navy/5 text-snrt-navy'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
              title="Afficher les blocs de la grille type en fond"
            >
              <Layers3 size={15} />
              Grille type
            </button>
            <button
              type="button"
              onClick={ouvrirAnomalies}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
                nbBloquantes > 0
                  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CircleAlert size={15} />
              Anomalies
              {nbBloquantes > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">{nbBloquantes}</span>
              )}
            </button>
            <div className="flex rounded-md border border-slate-300">
              <button
                type="button"
                onClick={gererAnnuler}
                disabled={!pile.peutAnnuler}
                title={pile.peutAnnuler ? `Annuler : ${pile.libelleAnnuler}` : 'Rien à annuler'}
                className="rounded-l-md border-r border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                onClick={gererRetablir}
                disabled={!pile.peutRetablir}
                title={pile.peutRetablir ? `Rétablir : ${pile.libelleRetablir}` : 'Rien à rétablir'}
                className="rounded-r-md p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Redo2 size={15} />
              </button>
            </div>
          </div>
        </div>

        {genresPresents.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
            {genresPresents.map((g) => {
              const { fond } = couleurGenre(g)
              return (
                <span key={g} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${fond}`} />
                  {g || 'Sans genre'}
                </span>
              )
            })}
          </div>
        )}

        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      </div>

      <div className="flex items-start gap-4">
        <CataloguePanel chaineActive={chaineActive} dragRef={dragRef} onOuvrirHistorique={setHistoriqueOuvert} />

        {!chargement && (
          <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4">
            <div className="max-h-[70vh] overflow-y-auto">
              <div className="grid" style={{ gridTemplateColumns: `56px repeat(${jours.length}, minmax(140px, 1fr))` }}>
                <div className="sticky top-0 z-10 bg-white" style={{ gridRow: 1, gridColumn: 1 }} />
                {jours.map((j, i) => (
                  <div
                    key={j}
                    style={{ gridRow: 1, gridColumn: i + 2 }}
                    className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2 text-center text-xs font-medium text-slate-600"
                  >
                    {formaterJourCourt(j)}
                  </div>
                ))}

                <div className="relative" style={{ gridRow: 2, gridColumn: 1, height: HAUTEUR_TOTALE }}>
                  {MARQUES_HEURES.map((m) => (
                    <div
                      key={m}
                      style={{ position: 'absolute', top: (m - DEBUT_JOURNEE_ANTENNE) * PX_PAR_MINUTE - 6, right: 8 }}
                      className="text-[11px] text-slate-400"
                    >
                      {minutesEnHeure(m)}
                    </div>
                  ))}
                </div>

                {jours.map((j, i) => {
                  const pistees = disposerEnPistes(diffusionsParJour.get(j) ?? [])
                  const bandes = afficherGrilleType ? blocsActifsCeJour(blocsGrilleType, jourAntenneLundi0(j)) : []
                  return (
                    <div
                      key={j}
                      className="relative cursor-pointer border-l border-slate-100 hover:bg-slate-50/50"
                      style={{ gridRow: 2, gridColumn: i + 2, height: HAUTEUR_TOTALE }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const minute = positionVersMinute(e.clientY - rect.top)
                        ouvrirCreation(j, minutesEnHeure(minute))
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const rect = e.currentTarget.getBoundingClientRect()
                        const minute = positionVersMinute(e.clientY - rect.top)
                        deposerEpisode(j, minute)
                      }}
                    >
                      {MARQUES_HEURES.map((m) => (
                        <div
                          key={m}
                          className="absolute left-0 right-0 border-t border-slate-100"
                          style={{ top: (m - DEBUT_JOURNEE_ANTENNE) * PX_PAR_MINUTE }}
                        />
                      ))}
                      {/* Bandes de grille type (EXG-M3-04) : purement visuelles,
                          pointer-events-none garantit qu'aucun geste (clic,
                          drag) n'est intercepté — le clic traverse jusqu'à la
                          cellule ou au bloc de transmission en dessous/dessus.
                          Rendues avant les blocs de transmission dans le JSX
                          pour rester visuellement en arrière-plan. */}
                      {bandes.map((bloc) => {
                        // Couleur du TYPE de bloc (Grille type — évolution des
                        // types) ; repli sur le genre attendu pour d'éventuels
                        // blocs sans type (avant cette évolution / migration).
                        const { fondClair, bordure } = bloc.type_bloc
                          ? couleurType(bloc.type_bloc)
                          : couleurGenre(bloc.genre_attendu)
                        const topBande = (minutesDepuisDebutAntenne(bloc.heure_debut) - DEBUT_JOURNEE_ANTENNE) * PX_PAR_MINUTE
                        const hauteurBande =
                          (minutesDepuisDebutAntenne(bloc.heure_fin) - minutesDepuisDebutAntenne(bloc.heure_debut)) *
                          PX_PAR_MINUTE
                        return (
                          <div
                            key={bloc.id}
                            className={`pointer-events-none absolute left-0 right-0 overflow-hidden border-t ${fondClair} ${bordure}`}
                            style={{ top: `${topBande}px`, height: `${hauteurBande}px` }}
                          >
                            <span className="absolute left-1 top-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                              {bloc.nom}
                            </span>
                          </div>
                        )
                      })}
                      {pistees.map(({ item: diffusion, debut, fin, piste, nbPistes }) => {
                        const top = (debut - DEBUT_JOURNEE_ANTENNE) * PX_PAR_MINUTE
                        const hauteur = Math.max(14, (fin - debut) * PX_PAR_MINUTE - 2)
                        const genre = programmesParId.get(diffusion.programme_id)?.genre
                        const { fond, texte } = couleurGenre(genre)
                        const etiquetteEpisode =
                          diffusion.episode_numero != null ? `ÉP.${String(diffusion.episode_numero).padStart(2, '0')} — ` : ''
                        const estSelectionne = blocSelectionne?.id === diffusion.id
                        const enAnomalieBloquante = idsBloquants.has(diffusion.id)
                        const selectionner = (e) => {
                          e.stopPropagation()
                          setModale(null)
                          setAnomaliesOuvertes(false)
                          setBlocSelectionne(diffusion)
                        }
                        return (
                          <div
                            role="button"
                            tabIndex={0}
                            key={diffusion.id}
                            onClick={selectionner}
                            onKeyDown={(e) => {
                              if (e.target !== e.currentTarget) return
                              if (e.key === 'Enter' || e.key === ' ') selectionner(e)
                            }}
                            className={`group absolute cursor-pointer overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ${fond} ${texte} ${
                              estSelectionne
                                ? 'ring-2 ring-offset-1 ring-snrt-navy'
                                : enAnomalieBloquante
                                  ? 'ring-2 ring-offset-1 ring-red-600'
                                  : ''
                            }`}
                            style={{
                              top: `${top}px`,
                              height: `${hauteur}px`,
                              left: `${(piste / nbPistes) * 100}%`,
                              width: `${100 / nbPistes}%`,
                            }}
                          >
                            <button
                              type="button"
                              title="Déprogrammer"
                              onClick={(e) => {
                                e.stopPropagation()
                                deprogrammerDiffusion(diffusion, { chaineActive, onSupprime: appliquerSuppression }).catch((err) =>
                                  setErreur(err.message)
                                )
                              }}
                              className="absolute -top-1.5 -right-1.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-red-600 opacity-0 shadow-sm ring-1 ring-red-200 hover:bg-red-50 focus-visible:opacity-100 group-hover:opacity-100"
                            >
                              <X size={10} strokeWidth={3} />
                            </button>
                            <div className="font-medium">
                              {diffusion.heure_debut}–{diffusion.heure_fin}
                            </div>
                            <div className="truncate">
                              {etiquetteEpisode}
                              {diffusion.vecteur ? `[${diffusion.vecteur === 'SATELLITE' ? 'SAT' : 'TNT'}] ` : ''}
                              {diffusion.titre_cache}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {modale && (
        <Modal titre="Ajouter un créneau" onFermer={() => setModale(null)}>
          <FormulaireCreneau
            modale={modale}
            chaineActive={chaineActive}
            programmesDisponibles={programmesDeLaChaine}
            programmesParId={programmesParId}
            fenetresDroits={fenetresDroits}
            onCree={appliquerCreation}
          />
        </Modal>
      )}

      {historiqueOuvert && (
        <PopoverHistorique programme={historiqueOuvert} onFermer={() => setHistoriqueOuvert(null)} />
      )}

      {blocSelectionne && (
        <InspecteurBloc
          diffusion={blocSelectionne}
          programme={programmesParId.get(blocSelectionne.programme_id)}
          chaineActive={chaineActive}
          onFermer={() => setBlocSelectionne(null)}
          onModifie={appliquerEdition}
          onSupprime={appliquerSuppression}
          onCreerPlusieurs={appliquerCreationMultiple}
          onChangementsPile={appliquerChangementsPile}
        />
      )}

      {anomaliesOuvertes && (
        <PanneauAnomalies
          anomalies={anomalies}
          onFermer={() => setAnomaliesOuvertes(false)}
          onAller={allerVersAnomalie}
        />
      )}
    </div>
  )
}

function FormulaireCreneau({ modale, chaineActive, programmesDisponibles, programmesParId, fenetresDroits, onCree }) {
  const [date, setDate] = useState(modale.date)
  // RG-03 : « non proposé » — les programmes hors droits À LA DATE COURANTE
  // DU FORMULAIRE (pas la date d'ouverture) sont exclus du select, recalculé
  // à chaque changement de date.
  const programmesProgrammables = useMemo(
    () => programmesDisponibles.filter((p) => estProgrammable(p.id, fenetresDroits, date).ok),
    [programmesDisponibles, fenetresDroits, date]
  )
  const [programmeId, setProgrammeId] = useState(programmesProgrammables[0]?.id ?? '')
  const [episodes, setEpisodes] = useState([])
  const [chargementEpisodes, setChargementEpisodes] = useState(false)
  const [episodeId, setEpisodeId] = useState('')
  const [heureDebut, setHeureDebut] = useState(modale.heureDebut)
  const [heureFin, setHeureFin] = useState(
    minutesEnHeure(heureEnMinutes(modale.heureDebut ?? '06:00') + DUREE_PAR_DEFAUT_MIN)
  )
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idProgramme = useId()
  const idEpisode = useId()
  const idDate = useId()
  const idDebut = useId()
  const idFin = useId()
  const requeteEpisodesId = useRef(0)

  // Si le programme sélectionné sort de la liste programmable (changement de
  // date vers un jour hors droits), retombe sur le premier programme encore
  // programmable — RG-03 « non proposé », pas seulement refusé à la soumission.
  useEffect(() => {
    setProgrammeId((actuel) =>
      programmesProgrammables.some((p) => p.id === actuel) ? actuel : (programmesProgrammables[0]?.id ?? '')
    )
  }, [programmesProgrammables])

  // `requeteEpisodesId` ignore la réponse d'un fetch dépassé par un
  // changement de programme plus récent (même pattern que `requeteId` dans
  // ListeProgrammes.jsx) — sans ça, une réponse arrivée en retard peut écraser
  // episodes/episodeId avec ceux d'un AUTRE programme que celui affiché.
  useEffect(() => {
    const idAppel = ++requeteEpisodesId.current
    if (!programmeId) {
      setEpisodes([])
      return
    }
    setChargementEpisodes(true)
    listerEpisodes(programmeId)
      .then((lignes) => {
        if (idAppel !== requeteEpisodesId.current) return
        setEpisodes(lignes)
        // RG-07 : ne présélectionne qu'un épisode prêt à diffuser (PAD).
        setEpisodeId((actuel) =>
          lignes.some((ep) => ep.id === actuel && estEpisodePret(ep)) ? actuel : (lignes.find(estEpisodePret)?.id ?? '')
        )
      })
      .catch((err) => {
        if (idAppel !== requeteEpisodesId.current) return
        setErreur(err.message)
      })
      .finally(() => {
        if (idAppel === requeteEpisodesId.current) setChargementEpisodes(false)
      })
  }, [programmeId])

  const episodesPrets = useMemo(() => episodes.filter(estEpisodePret), [episodes])

  // Recalcule heure_fin sur la durée de l'épisode sélectionné — réagit à la
  // valeur (episodeId), pas seulement à l'événement onChange du <select>, pour
  // couvrir aussi la présélection automatique (programme à un seul épisode).
  // heureDebut est lu par closure (valeur du rendu courant, jamais périmée
  // puisque cet effet se redéclenche sur la sélection elle-même) sans figurer
  // dans les dépendances : un changement ultérieur de heureDebut seul ne doit
  // pas re-écraser une heure de fin déjà ajustée manuellement par l'utilisateur.
  useEffect(() => {
    const ep = episodes.find((e) => e.id === episodeId)
    if (!ep) return
    setHeureFin(minutesEnHeure(heureEnMinutes(heureDebut) + (ep.duree ?? DUREE_PAR_DEFAUT_MIN)))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volontaire, voir commentaire ci-dessus
  }, [episodeId, episodes])

  if (programmesDisponibles.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun programme sur la chaîne « {chaineActive.nom} ». Créez d'abord un programme sur cette chaîne dans
        l'écran Programmes.
      </p>
    )
  }

  if (programmesProgrammables.length === 0) {
    return (
      <p className="text-sm text-amber-600">
        Aucun programme programmable à cette date sur la chaîne « {chaineActive.nom} » (droits fermés ou épuisés).
        Changez de date ou ajustez les fenêtres de droits depuis la fiche du titre.
      </p>
    )
  }

  async function enregistrer(e) {
    e.preventDefault()
    if (!episodeId) {
      setErreur('Choisissez un épisode.')
      return
    }
    // Revalidation silencieuse juste avant l'écriture (état potentiellement
    // périmé si le formulaire est resté ouvert le temps qu'une donnée change)
    // — défense en profondeur, le contrôle réel a déjà eu lieu via les
    // options proposées (RG-03).
    const episodeChoisi = episodes.find((ep) => ep.id === episodeId)
    if (!estEpisodePret(episodeChoisi)) {
      setErreur('Cet épisode n’est plus prêt à diffuser (PAD).')
      return
    }
    const droits = estProgrammable(programmeId, fenetresDroits, date)
    if (!droits.ok) {
      setErreur(`Dépôt refusé — ${droits.motif}`)
      return
    }
    setEnregistrement(true)
    setErreur(null)
    const programme = programmesParId.get(programmeId)
    const episode = episodes.find((ep) => ep.id === episodeId)
    const champs = {
      programme_id: programmeId,
      episode_id: episodeId,
      episode_numero: episode?.numero ?? null,
      chaine: chaineActive.nom,
      chaine_id: chaineActive.id,
      date,
      heure_debut: heureDebut,
      heure_fin: heureFin,
      genre: programme?.genre || null,
      titre_cache: programme?.titre ?? null,
    }
    try {
      const cree = await creerDiffusionLineaire(champs)
      await enregistrerAction({
        chaineId: chaineActive.id,
        ecran: 'GRILLE_LINEAIRE',
        libelle: `Création : ${cree.titre_cache}`,
        operations: [{ table: 'diffusion_lineaire', type: 'INSERT', id: cree.id, apres: cree }],
      })
      onCree(cree)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <form onSubmit={enregistrer} className="space-y-4">
      <div>
        <label htmlFor={idProgramme} className="mb-1 block text-sm font-medium text-slate-700">
          Programme *
        </label>
        <select
          id={idProgramme}
          value={programmeId}
          required
          onChange={(e) => setProgrammeId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {programmesProgrammables.map((p) => (
            <option key={p.id} value={p.id}>
              {p.titre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={idEpisode} className="mb-1 block text-sm font-medium text-slate-700">
          Épisode *
        </label>
        <select
          id={idEpisode}
          value={episodeId}
          required
          disabled={chargementEpisodes || episodesPrets.length === 0}
          onChange={(e) => setEpisodeId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
        >
          {episodesPrets.length === 0 && (
            <option value="">{chargementEpisodes ? 'Chargement…' : 'Aucun épisode prêt à diffuser'}</option>
          )}
          {episodesPrets.map((ep) => (
            <option key={ep.id} value={ep.id}>
              ÉP.{String(ep.numero ?? '?').padStart(2, '0')} — {ep.titre || 'Sans titre'} ({ep.duree ?? '?'} min)
            </option>
          ))}
        </select>
        {!chargementEpisodes && episodes.length === 0 && (
          <p className="mt-1 text-xs text-amber-600">
            Ce programme n'a aucun épisode — ajoutez-en un dans sa fiche avant de créer une transmission.
          </p>
        )}
        {!chargementEpisodes && episodes.length > 0 && episodesPrets.length === 0 && (
          <p className="mt-1 text-xs text-amber-600">
            Aucun épisode de ce programme n'est prêt à diffuser (PAD) — RG-07.
          </p>
        )}
      </div>
      <div>
        <label htmlFor={idDate} className="mb-1 block text-sm font-medium text-slate-700">
          Date (jour d'antenne) *
        </label>
        <input
          id={idDate}
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={idDebut} className="mb-1 block text-sm font-medium text-slate-700">
            Heure début *
          </label>
          <input
            id={idDebut}
            type="time"
            required
            value={heureDebut}
            onChange={(e) => setHeureDebut(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={idFin} className="mb-1 block text-sm font-medium text-slate-700">
            Heure fin *
          </label>
          <input
            id={idFin}
            type="time"
            required
            value={heureFin}
            onChange={(e) => setHeureFin(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      <div className="flex items-center justify-end pt-2">
        <button
          type="submit"
          disabled={enregistrement}
          className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
        >
          {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
