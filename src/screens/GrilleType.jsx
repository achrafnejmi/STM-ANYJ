import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { listerBlocsGrilleTypeParChaine, creerBlocGrilleType } from '../lib/db.js'
import { GENRES } from '../lib/genres.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import { minutesEnHeure, DEBUT_JOURNEE_ANTENNE } from '../lib/semaine.js'
import { PX_PAR_MINUTE, HAUTEUR_TOTALE, genererMarquesHeures, positionVersMinute, disposerEnPistes } from '../lib/grilleAxe.js'
import PaletteGenres from '../components/PaletteGenres.jsx'
import PanneauBlocGrilleType from '../components/PanneauBlocGrilleType.jsx'

const MARQUES_HEURES = genererMarquesHeures()
const DUREE_PAR_DEFAUT_BLOC_MIN = 120 // 2h

// Calendrier hebdomadaire FIXE (pas de date ni de navigation semaine
// précédente/suivante) : un bloc_grille_type n'est pas daté, seulement
// rattaché à des jours de semaine récurrents (0=lundi..6=dimanche, même
// convention que semaine.js/P11).
const JOURS_SEMAINE = [
  { index: 0, label: 'Lundi' },
  { index: 1, label: 'Mardi' },
  { index: 2, label: 'Mercredi' },
  { index: 3, label: 'Jeudi' },
  { index: 4, label: 'Vendredi' },
  { index: 5, label: 'Samedi' },
  { index: 6, label: 'Dimanche' },
]

export default function GrilleType({ chaineActive }) {
  const [blocs, setBlocs] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [blocSelectionne, setBlocSelectionne] = useState(null)
  const dragRef = useRef(null)

  useEffect(() => {
    setChargement(true)
    setBlocSelectionne(null)
    listerBlocsGrilleTypeParChaine(chaineActive.id)
      .then(setBlocs)
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }, [chaineActive])

  const genresPresents = [...new Set(blocs.map((b) => b.genre_attendu))]

  // Création directe en base (pas d'étape de formulaire intermédiaire), le
  // panneau s'ouvre ensuite sur le bloc fraîchement créé pour le renommer —
  // même logique que deposerEpisode dans GrilleLineaire.jsx (P10/P11).
  function creerEtSelectionner(champs) {
    setErreur(null)
    creerBlocGrilleType({ ...champs, chaine_id: chaineActive.id })
      .then((cree) => {
        setBlocs((prev) => [...prev, cree])
        setBlocSelectionne(cree)
      })
      .catch((err) => setErreur(err.message))
  }

  function deposerGenre(jourIndex, minuteDebut) {
    const payload = dragRef.current
    dragRef.current = null
    if (!payload) return
    creerEtSelectionner({
      nom: payload.genre,
      heure_debut: minutesEnHeure(minuteDebut),
      heure_fin: minutesEnHeure(minuteDebut + DUREE_PAR_DEFAUT_BLOC_MIN),
      jours: [jourIndex],
      frequence: 'Quotidien',
      genre_attendu: payload.genre,
    })
  }

  // Bouton "+ Ajouter un bloc" : fallback clavier/sans souris du
  // glisser-déposer, valeurs génériques (renommables tout de suite dans le
  // panneau qui s'ouvre juste après, comme pour le dépôt).
  function nouveauBlocGenerique() {
    creerEtSelectionner({
      nom: GENRES[0].fr,
      heure_debut: '15:00',
      heure_fin: '17:00',
      jours: [0],
      frequence: 'Quotidien',
      genre_attendu: GENRES[0].fr,
    })
  }

  function appliquerModification(maj) {
    setBlocs((prev) => prev.map((b) => (b.id === maj.id ? maj : b)))
    setBlocSelectionne(maj)
  }

  function appliquerSuppression(id) {
    setBlocs((prev) => prev.filter((b) => b.id !== id))
    setBlocSelectionne(null)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Grille type — {chaineActive.nom}</h2>
            <p className="text-sm text-slate-500">La grille type décrit la structure de la journée, pas les titres.</p>
          </div>
          <button
            type="button"
            onClick={nouveauBlocGenerique}
            className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover"
          >
            <Plus size={16} />
            Ajouter un bloc
          </button>
        </div>

        {genresPresents.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
            {genresPresents.map((g) => {
              const { fond } = couleurGenre(g)
              return (
                <span key={g} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${fond}`} />
                  {g}
                </span>
              )
            })}
          </div>
        )}

        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      </div>

      <div className="flex items-start gap-4">
        <PaletteGenres dragRef={dragRef} />

        {!chargement && (
          <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4">
            <div className="max-h-[70vh] overflow-y-auto">
              <div className="grid" style={{ gridTemplateColumns: `56px repeat(${JOURS_SEMAINE.length}, minmax(140px, 1fr))` }}>
                <div className="sticky top-0 z-10 bg-white" style={{ gridRow: 1, gridColumn: 1 }} />
                {JOURS_SEMAINE.map((j, i) => (
                  <div
                    key={j.index}
                    style={{ gridRow: 1, gridColumn: i + 2 }}
                    className="sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2 text-center text-xs font-medium text-slate-600"
                  >
                    {j.label}
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

                {JOURS_SEMAINE.map((j, i) => {
                  const blocsDuJour = blocs.filter((b) => b.jours.includes(j.index))
                  const pistees = disposerEnPistes(blocsDuJour)
                  return (
                    <div
                      key={j.index}
                      className="relative border-l border-slate-100"
                      style={{ gridRow: 2, gridColumn: i + 2, height: HAUTEUR_TOTALE }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const rect = e.currentTarget.getBoundingClientRect()
                        const minute = positionVersMinute(e.clientY - rect.top)
                        deposerGenre(j.index, minute)
                      }}
                    >
                      {MARQUES_HEURES.map((m) => (
                        <div
                          key={m}
                          className="absolute left-0 right-0 border-t border-slate-100"
                          style={{ top: (m - DEBUT_JOURNEE_ANTENNE) * PX_PAR_MINUTE }}
                        />
                      ))}
                      {pistees.map(({ item: bloc, debut, fin, piste, nbPistes }) => {
                        const top = (debut - DEBUT_JOURNEE_ANTENNE) * PX_PAR_MINUTE
                        const hauteur = Math.max(14, (fin - debut) * PX_PAR_MINUTE - 2)
                        const { fond, texte } = couleurGenre(bloc.genre_attendu)
                        const estSelectionne = blocSelectionne?.id === bloc.id
                        return (
                          <button
                            type="button"
                            key={bloc.id}
                            onClick={() => setBlocSelectionne(bloc)}
                            className={`absolute overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ${fond} ${texte} ${
                              estSelectionne ? 'ring-2 ring-offset-1 ring-snrt-navy' : ''
                            }`}
                            style={{
                              top: `${top}px`,
                              height: `${hauteur}px`,
                              left: `${(piste / nbPistes) * 100}%`,
                              width: `${100 / nbPistes}%`,
                            }}
                          >
                            <div className="font-medium truncate">{bloc.nom}</div>
                            <div className="truncate opacity-80">{bloc.genre_attendu}</div>
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

      {blocSelectionne && (
        <PanneauBlocGrilleType
          bloc={blocSelectionne}
          onFermer={() => setBlocSelectionne(null)}
          onModifie={appliquerModification}
          onSupprime={appliquerSuppression}
        />
      )}
    </div>
  )
}
