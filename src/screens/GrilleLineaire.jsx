import { useEffect, useId, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import {
  listerChainesDiffusion,
  listerDiffusionsLineairesParChaine,
  listerProgrammes,
  creerDiffusionLineaire,
  mettreAJourDiffusionLineaire,
  supprimerDiffusionLineaire,
} from '../lib/db.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import {
  aujourdHuiISO,
  ajouterJours,
  lundiDeLaSemaine,
  joursDeLaSemaine,
  formaterJourCourt,
  formaterPlageSemaine,
  formaterDateLongue,
  heureEnMinutes,
  minutesEnHeure,
} from '../lib/semaine.js'
import Modal from '../components/Modal.jsx'

const RANGEE_MIN = 30 // minutes par rangée de la grille
const NB_RANGEES = (24 * 60) / RANGEE_MIN // 48
const HAUTEUR_RANGEE = 28 // px

// Toujours au moins 1 rangée, jamais un span ≤ 0 (créneaux à durée nulle/négative,
// ex. artefacts d'import autour de minuit).
function calculerRangees(heureDebut, heureFin) {
  const debut = heureEnMinutes(heureDebut)
  let fin = heureEnMinutes(heureFin)
  if (fin <= debut) fin = debut + RANGEE_MIN
  fin = Math.min(fin, NB_RANGEES * RANGEE_MIN)
  const rangeeDebut = Math.floor(debut / RANGEE_MIN)
  const rangeeFin = Math.max(rangeeDebut + 1, Math.ceil(fin / RANGEE_MIN))
  return { rangeeDebut, rangeeFin }
}

// Répartit les créneaux qui se chevauchent (pas de contrainte d'unicité en
// base) en pistes côte à côte plutôt que superposés.
function disposerEnPistes(diffusionsJour) {
  const triees = [...diffusionsJour].sort((a, b) => heureEnMinutes(a.heure_debut) - heureEnMinutes(b.heure_debut))
  const finPiste = [] // dernière minute de fin occupée par piste
  const resultat = []
  for (const d of triees) {
    const debut = heureEnMinutes(d.heure_debut)
    let piste = finPiste.findIndex((fin) => fin <= debut)
    if (piste === -1) {
      piste = finPiste.length
      finPiste.push(0)
    }
    const { rangeeFin } = calculerRangees(d.heure_debut, d.heure_fin)
    finPiste[piste] = rangeeFin * RANGEE_MIN
    resultat.push({ diffusion: d, piste })
  }
  const nbPistes = finPiste.length || 1
  return resultat.map((r) => ({ ...r, nbPistes }))
}

export default function GrilleLineaire() {
  const [chaines, setChaines] = useState([])
  const [chaineSelectionnee, setChaineSelectionnee] = useState('')
  const [vue, setVue] = useState('SEMAINE')
  const [dateReference, setDateReference] = useState(aujourdHuiISO())
  const [diffusions, setDiffusions] = useState([])
  const [programmes, setProgrammes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [modale, setModale] = useState(null)
  const idChaine = useId()

  useEffect(() => {
    listerChainesDiffusion()
      .then((lignes) => {
        setChaines(lignes)
        if (lignes.length > 0) setChaineSelectionnee((c) => c || lignes[0])
      })
      .catch((err) => setErreur(err.message))
    listerProgrammes()
      .then(setProgrammes)
      .catch((err) => setErreur(err.message))
  }, [])

  useEffect(() => {
    if (!chaineSelectionnee) {
      setDiffusions([])
      setChargement(false)
      return
    }
    setChargement(true)
    listerDiffusionsLineairesParChaine(chaineSelectionnee)
      .then(setDiffusions)
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineSelectionnee])

  const lundi = lundiDeLaSemaine(dateReference)
  const jours = useMemo(
    () => (vue === 'SEMAINE' ? joursDeLaSemaine(lundi) : [dateReference]),
    [vue, lundi, dateReference]
  )

  const programmesParId = useMemo(() => new Map(programmes.map((p) => [p.id, p])), [programmes])
  const programmesDeLaChaine = useMemo(
    () => programmes.filter((p) => p.chaine === chaineSelectionnee).sort((a, b) => a.titre.localeCompare(b.titre)),
    [programmes, chaineSelectionnee]
  )

  const diffusionsParJour = useMemo(() => {
    const map = new Map()
    for (const j of jours) map.set(j, [])
    for (const d of diffusions) {
      if (map.has(d.date)) map.get(d.date).push(d)
    }
    return map
  }, [diffusions, jours])

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
    setModale({ mode: 'CREATION', date, heureDebut })
  }

  function ouvrirEdition(diffusion) {
    setModale({ mode: 'EDITION', diffusion })
  }

  function appliquerCreation(nouvelle) {
    setDiffusions((prev) => [...prev, nouvelle])
    setModale(null)
  }

  function appliquerEdition(maj) {
    setDiffusions((prev) => prev.map((d) => (d.id === maj.id ? maj : d)))
    setModale(null)
  }

  function appliquerSuppression(id) {
    setDiffusions((prev) => prev.filter((d) => d.id !== id))
    setModale(null)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor={idChaine} className="mb-1 block text-sm font-medium text-slate-700">
                Chaîne
              </label>
              <select
                id={idChaine}
                value={chaineSelectionnee}
                onChange={(e) => setChaineSelectionnee(e.target.value)}
                className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {chaines.length === 0 && <option value="">-- Aucune chaîne --</option>}
                {chaines.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
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

      {!chargement && chaineSelectionnee && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="max-h-[70vh] overflow-y-auto">
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${jours.length}, minmax(120px, 1fr))` }}>
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

              <div className="relative" style={{ gridRow: 2, gridColumn: 1 }}>
                <div style={{ display: 'grid', gridTemplateRows: `repeat(${NB_RANGEES}, ${HAUTEUR_RANGEE}px)` }}>
                  {Array.from({ length: NB_RANGEES }).map(
                    (_, i) =>
                      i % 2 === 0 && (
                        <div
                          key={i}
                          style={{ gridRow: `${i + 1} / span 2` }}
                          className="pr-2 text-right text-[11px] text-slate-400"
                        >
                          {minutesEnHeure(i * RANGEE_MIN)}
                        </div>
                      )
                  )}
                </div>
              </div>

              {jours.map((j, i) => {
                const pistees = disposerEnPistes(diffusionsParJour.get(j) ?? [])
                return (
                  <div key={j} className="relative border-l border-slate-100" style={{ gridRow: 2, gridColumn: i + 2 }}>
                    <div style={{ display: 'grid', gridTemplateRows: `repeat(${NB_RANGEES}, ${HAUTEUR_RANGEE}px)` }}>
                      {Array.from({ length: NB_RANGEES }).map((_, i) => (
                        <div
                          key={i}
                          style={{ gridRow: i + 1 }}
                          className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                          onClick={() => ouvrirCreation(j, minutesEnHeure(i * RANGEE_MIN))}
                        />
                      ))}
                    </div>
                    {pistees.map(({ diffusion, piste, nbPistes }) => {
                      const { rangeeDebut, rangeeFin } = calculerRangees(diffusion.heure_debut, diffusion.heure_fin)
                      const genre = programmesParId.get(diffusion.programme_id)?.genre
                      const { fond, texte } = couleurGenre(genre)
                      return (
                        <button
                          type="button"
                          key={diffusion.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            ouvrirEdition(diffusion)
                          }}
                          className={`absolute overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ${fond} ${texte}`}
                          style={{
                            top: `${rangeeDebut * HAUTEUR_RANGEE}px`,
                            height: `${(rangeeFin - rangeeDebut) * HAUTEUR_RANGEE - 2}px`,
                            left: `${(piste / nbPistes) * 100}%`,
                            width: `${100 / nbPistes}%`,
                          }}
                        >
                          <div className="font-medium">
                            {diffusion.heure_debut}–{diffusion.heure_fin}
                          </div>
                          <div className="truncate">{diffusion.titre_cache}</div>
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

      {!chaineSelectionnee && !chargement && (
        <p className="text-sm text-slate-500">
          Aucune chaîne avec des créneaux pour l'instant — importez une grille depuis l'écran Programmes.
        </p>
      )}

      {modale && (
        <Modal titre={modale.mode === 'CREATION' ? 'Ajouter un créneau' : 'Modifier le créneau'} onFermer={() => setModale(null)}>
          <FormulaireCreneau
            modale={modale}
            chaine={chaineSelectionnee}
            programmesDisponibles={programmesDeLaChaine}
            programmesParId={programmesParId}
            onCree={appliquerCreation}
            onModifie={appliquerEdition}
            onSupprime={appliquerSuppression}
          />
        </Modal>
      )}
    </div>
  )
}

function FormulaireCreneau({ modale, chaine, programmesDisponibles, programmesParId, onCree, onModifie, onSupprime }) {
  const estEdition = modale.mode === 'EDITION'
  const diffusionInitiale = estEdition ? modale.diffusion : null

  const [programmeId, setProgrammeId] = useState(diffusionInitiale?.programme_id ?? programmesDisponibles[0]?.id ?? '')
  const [date, setDate] = useState(diffusionInitiale?.date ?? modale.date)
  const [heureDebut, setHeureDebut] = useState(diffusionInitiale?.heure_debut ?? modale.heureDebut)
  const [heureFin, setHeureFin] = useState(
    diffusionInitiale?.heure_fin ?? minutesEnHeure(heureEnMinutes(modale.heureDebut ?? '00:00') + RANGEE_MIN)
  )
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const idProgramme = useId()
  const idDate = useId()
  const idDebut = useId()
  const idFin = useId()

  if (programmesDisponibles.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun programme sur la chaîne « {chaine} ». Créez d'abord un programme sur cette chaîne dans l'écran
        Programmes.
      </p>
    )
  }

  async function enregistrer(e) {
    e.preventDefault()
    setEnregistrement(true)
    setErreur(null)
    const programme = programmesParId.get(programmeId)
    const champs = {
      programme_id: programmeId,
      chaine,
      date,
      heure_debut: heureDebut,
      heure_fin: heureFin,
      genre: programme?.genre || null,
      titre_cache: programme?.titre ?? null,
    }
    try {
      if (estEdition) {
        const maj = await mettreAJourDiffusionLineaire(diffusionInitiale.id, champs)
        onModifie(maj)
      } else {
        const cree = await creerDiffusionLineaire(champs)
        onCree(cree)
      }
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  async function supprimer() {
    setEnregistrement(true)
    setErreur(null)
    try {
      await supprimerDiffusionLineaire(diffusionInitiale.id)
      onSupprime(diffusionInitiale.id)
    } catch (err) {
      setErreur(err.message)
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
        <label htmlFor={idDate} className="mb-1 block text-sm font-medium text-slate-700">
          Date *
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
      <div className="flex items-center justify-between pt-2">
        {estEdition ? (
          <button
            type="button"
            onClick={supprimer}
            disabled={enregistrement}
            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
          >
            <Trash2 size={16} />
            Supprimer
          </button>
        ) : (
          <span />
        )}
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
