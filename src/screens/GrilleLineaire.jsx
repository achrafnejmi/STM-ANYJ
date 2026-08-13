import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CircleAlert, Layers3 } from 'lucide-react'
import {
  listerDiffusionsLineairesParChaine,
  listerProgrammesParChaine,
  listerTousLesEpisodes,
  listerBlocsGrilleTypeParChaine,
  listerEpisodes,
  creerDiffusionLineaire,
  supprimerDiffusionLineaire,
} from '../lib/db.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import { calculerAnomalies, compterBloquantes } from '../lib/anomalies.js'
import { blocsActifsCeJour } from '../lib/grilleType.js'
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
  const [afficherGrilleType, setAfficherGrilleType] = useState(true)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [modale, setModale] = useState(null)
  const [blocSelectionne, setBlocSelectionne] = useState(null)
  const [anomaliesOuvertes, setAnomaliesOuvertes] = useState(false)
  const [historiqueOuvert, setHistoriqueOuvert] = useState(null)
  const dragRef = useRef(null)

  useEffect(() => {
    setChargement(true)
    Promise.all([
      listerProgrammesParChaine(chaineActive.id),
      listerDiffusionsLineairesParChaine(chaineActive.id),
      listerTousLesEpisodes(),
      listerBlocsGrilleTypeParChaine(chaineActive.id),
    ])
      .then(([lignesProgrammes, lignesDiffusions, lignesEpisodes, lignesBlocs]) => {
        setProgrammes(lignesProgrammes)
        setDiffusions(lignesDiffusions)
        setEpisodes(lignesEpisodes)
        setBlocsGrilleType(lignesBlocs)
      })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
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
    () => calculerAnomalies(diffusionsAffichees, episodesParId, blocsGrilleType),
    [diffusionsAffichees, episodesParId, blocsGrilleType]
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

  // Annulation locale (non générique, P11 uniquement) : supprime en base les
  // lignes que l'onglet Répéter vient tout juste de créer, par id.
  function annulerCreationMultiple(ids) {
    const idsASupprimer = new Set(ids)
    Promise.all(ids.map((id) => supprimerDiffusionLineaire(id)))
      .then(() => setDiffusions((prev) => prev.filter((d) => !idsASupprimer.has(d.id))))
      .catch((err) => setErreur(err.message))
  }

  // La `date` d'une transmission = le jour d'antenne de la colonne où l'on
  // dépose/clique (RG-19/20) — jamais recalculée depuis heureDebut, même pour
  // un dépôt entre 00:00 et 05:59 qui reste rattaché à ce même jour d'antenne.
  function deposerEpisode(jourAntenne, minuteDebut) {
    const payload = dragRef.current
    dragRef.current = null
    if (!payload) return
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
    creerDiffusionLineaire(champs).then(appliquerCreation).catch((err) => setErreur(err.message))
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
                        const { fondClair, bordure } = couleurGenre(bloc.genre_attendu)
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
                        return (
                          <button
                            type="button"
                            key={diffusion.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setModale(null)
                              setAnomaliesOuvertes(false)
                              setBlocSelectionne(diffusion)
                            }}
                            className={`absolute overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ${fond} ${texte} ${
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
                            <div className="font-medium">
                              {diffusion.heure_debut}–{diffusion.heure_fin}
                            </div>
                            <div className="truncate">
                              {etiquetteEpisode}
                              {diffusion.vecteur ? `[${diffusion.vecteur === 'SATELLITE' ? 'SAT' : 'TNT'}] ` : ''}
                              {diffusion.titre_cache}
                            </div>
                          </button>
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
          onAnnulerPlusieurs={annulerCreationMultiple}
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

function FormulaireCreneau({ modale, chaineActive, programmesDisponibles, programmesParId, onCree }) {
  const [programmeId, setProgrammeId] = useState(programmesDisponibles[0]?.id ?? '')
  const [episodes, setEpisodes] = useState([])
  const [chargementEpisodes, setChargementEpisodes] = useState(false)
  const [episodeId, setEpisodeId] = useState('')
  const [date, setDate] = useState(modale.date)
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
        setEpisodeId((actuel) => (lignes.some((ep) => ep.id === actuel) ? actuel : (lignes[0]?.id ?? '')))
      })
      .catch((err) => {
        if (idAppel !== requeteEpisodesId.current) return
        setErreur(err.message)
      })
      .finally(() => {
        if (idAppel === requeteEpisodesId.current) setChargementEpisodes(false)
      })
  }, [programmeId])

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

  async function enregistrer(e) {
    e.preventDefault()
    if (!episodeId) {
      setErreur('Choisissez un épisode.')
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
          {programmesDisponibles.map((p) => (
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
          disabled={chargementEpisodes || episodes.length === 0}
          onChange={(e) => setEpisodeId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
        >
          {episodes.length === 0 && <option value="">{chargementEpisodes ? 'Chargement…' : 'Aucun épisode'}</option>}
          {episodes.map((ep) => (
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
