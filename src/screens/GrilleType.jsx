import { useEffect, useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  listerBlocsGrilleTypeParChaine,
  creerBlocGrilleType,
  mettreAJourBlocGrilleType,
  supprimerBlocGrilleType,
} from '../lib/db.js'
import { GENRES } from '../lib/genres.js'
import { couleurGenre } from '../lib/couleursGenre.js'
import { minutesDepuisDebutAntenne } from '../lib/semaine.js'

const JOURS_ABBR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] // 0=lundi..6=dimanche

const BLOC_VIDE = {
  nom: 'Nouveau bloc',
  heure_debut: '15:00',
  heure_fin: '16:00',
  jours: [0, 1, 2, 3, 4],
  frequence: 'Quotidien',
  genre_attendu: GENRES[0].fr,
}

function versFormulaire(bloc) {
  return {
    nom: bloc.nom,
    heure_debut: bloc.heure_debut.slice(0, 5),
    heure_fin: bloc.heure_fin.slice(0, 5),
    jours: bloc.jours,
    frequence: bloc.frequence,
    genre_attendu: bloc.genre_attendu,
  }
}

function formaterDuree(heureDebut, heureFin) {
  const minutes = minutesDepuisDebutAntenne(heureFin) - minutesDepuisDebutAntenne(heureDebut)
  if (minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

export default function GrilleType({ chaineActive }) {
  const [blocs, setBlocs] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [blocId, setBlocId] = useState(null)
  const [form, setForm] = useState(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [messageSucces, setMessageSucces] = useState(null)
  const idNom = useId()
  const idDebut = useId()
  const idFin = useId()

  useEffect(() => {
    rafraichir()
    setBlocId(null)
    setForm(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'au changement de chaîne
  }, [chaineActive])

  async function rafraichir() {
    setChargement(true)
    try {
      const lignes = await listerBlocsGrilleTypeParChaine(chaineActive.id)
      setBlocs(lignes)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setChargement(false)
    }
  }

  function afficherSucces(texte) {
    setMessageSucces(texte)
    setTimeout(() => setMessageSucces(null), 4000)
  }

  function selectionner(bloc) {
    setBlocId(bloc.id)
    setForm(versFormulaire(bloc))
    setErreur(null)
    setMessageSucces(null)
  }

  function nouveauBloc() {
    setBlocId('NOUVEAU')
    setForm({ ...BLOC_VIDE })
    setErreur(null)
    setMessageSucces(null)
  }

  function basculerJour(i) {
    setForm((f) => ({
      ...f,
      jours: f.jours.includes(i) ? f.jours.filter((j) => j !== i) : [...f.jours, i].sort(),
    }))
  }

  async function supprimer(id) {
    try {
      await supprimerBlocGrilleType(id)
      if (blocId === id) {
        setBlocId(null)
        setForm(null)
      }
      await rafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function enregistrer(e) {
    e.preventDefault()
    if (form.jours.length === 0) {
      setErreur('Choisissez au moins un jour d’application.')
      return
    }
    setEnregistrement(true)
    setErreur(null)
    try {
      const champs = {
        nom: form.nom.trim(),
        heure_debut: form.heure_debut,
        heure_fin: form.heure_fin,
        jours: form.jours,
        frequence: form.frequence,
        genre_attendu: form.genre_attendu,
        chaine_id: chaineActive.id,
      }
      if (blocId === 'NOUVEAU') {
        const cree = await creerBlocGrilleType(champs)
        afficherSucces(`Bloc « ${cree.nom} » enregistré.`)
        setBlocId(cree.id)
        setForm(versFormulaire(cree))
      } else {
        const maj = await mettreAJourBlocGrilleType(blocId, champs)
        afficherSucces('Bloc modifié.')
        setForm(versFormulaire(maj))
      }
      await rafraichir()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  const triés = [...blocs].sort(
    (a, b) => minutesDepuisDebutAntenne(a.heure_debut) - minutesDepuisDebutAntenne(b.heure_debut)
  )

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Grille type — {chaineActive.nom}</h2>
          <p className="text-sm text-slate-500">La grille type décrit la structure de la journée, pas les titres.</p>
        </div>
        <button
          type="button"
          onClick={nouveauBloc}
          className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover"
        >
          <Plus size={16} />
          Ajouter un bloc
        </button>
      </div>

      {messageSucces && <p className="mt-4 text-sm text-emerald-600">{messageSucces}</p>}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">Bloc</th>
                <th className="py-2 pr-4 font-medium">Début</th>
                <th className="py-2 pr-4 font-medium">Fin</th>
                <th className="py-2 pr-4 font-medium">Durée</th>
                <th className="py-2 pr-4 font-medium">Fréquence</th>
                <th className="py-2 pr-4 font-medium">Jours</th>
                <th className="py-2 pr-4 font-medium">Genre attendu</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {triés.map((b) => {
                const { fond } = couleurGenre(b.genre_attendu)
                return (
                  <tr
                    key={b.id}
                    onClick={() => selectionner(b)}
                    className={`cursor-pointer border-b border-slate-100 ${
                      blocId === b.id ? 'bg-snrt-navy/5' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2 pr-4 font-medium text-slate-800">
                      <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${fond}`} />
                      {b.nom}
                    </td>
                    <td className="py-2 pr-4 font-mono text-slate-600">{b.heure_debut.slice(0, 5)}</td>
                    <td className="py-2 pr-4 font-mono text-slate-600">{b.heure_fin.slice(0, 5)}</td>
                    <td className="py-2 pr-4 text-slate-500">{formaterDuree(b.heure_debut, b.heure_fin)}</td>
                    <td className="py-2 pr-4 text-slate-600">{b.frequence}</td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-0.5">
                        {JOURS_ABBR.map((j, i) => (
                          <span
                            key={i}
                            className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold ${
                              b.jours.includes(i) ? `${fond} text-white` : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {j}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{b.genre_attendu}</td>
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          supprimer(b.id)
                        }}
                        className="text-red-500 hover:text-red-700"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!chargement && triés.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-3 text-sm text-slate-500">
                    Aucun bloc de grille type pour « {chaineActive.nom} ».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          {!form ? (
            <p className="text-sm text-slate-500">Sélectionnez un bloc ou ajoutez-en un.</p>
          ) : (
            <form onSubmit={enregistrer} className="space-y-4 rounded-md border border-slate-200 p-4">
              <div>
                <label htmlFor={idNom} className="mb-1 block text-sm font-medium text-slate-700">
                  Nom *
                </label>
                <input
                  id={idNom}
                  type="text"
                  required
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
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
                    value={form.heure_debut}
                    onChange={(e) => setForm({ ...form, heure_debut: e.target.value })}
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
                    value={form.heure_fin}
                    onChange={(e) => setForm({ ...form, heure_fin: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">Durée : {formaterDuree(form.heure_debut, form.heure_fin)}</p>

              <div>
                <span className="mb-1 block text-sm font-medium text-slate-700">Jours d'application *</span>
                <div className="flex gap-1">
                  {JOURS_ABBR.map((j, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => basculerJour(i)}
                      className={`flex-1 rounded-md border py-1.5 text-xs font-semibold ${
                        form.jours.includes(i)
                          ? 'border-snrt-navy bg-snrt-navy text-white'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {j}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1 block text-sm font-medium text-slate-700">Fréquence</span>
                <div className="flex gap-2">
                  {['Quotidien', 'Hebdo'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setForm({ ...form, frequence: f })}
                      className={`flex-1 rounded-md border py-1.5 text-sm ${
                        form.frequence === f
                          ? 'border-snrt-navy bg-snrt-navy text-white'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1 block text-sm font-medium text-slate-700">Genre attendu *</span>
                <select
                  value={form.genre_attendu}
                  onChange={(e) => setForm({ ...form, genre_attendu: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {GENRES.map((g) => (
                    <option key={g.fr} value={g.fr}>
                      {g.fr} — {g.ar}
                    </option>
                  ))}
                </select>
              </div>

              {erreur && <p className="text-sm text-red-600">{erreur}</p>}
              <button
                type="submit"
                disabled={enregistrement}
                className="w-full rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
              >
                {enregistrement ? 'Enregistrement…' : 'Enregistrer le bloc'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
