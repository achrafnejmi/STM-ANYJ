import { useEffect, useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  listerFenetresDroitsParProgramme,
  creerFenetreDroits,
  mettreAJourFenetreDroits,
  supprimerFenetreDroits,
} from '../lib/db.js'
import { aujourdHuiISO } from '../lib/semaine.js'

const FENETRE_VIDE = {
  date_debut: aujourdHuiISO(),
  date_fin: '',
  passages_autorises: '',
  passages_consommes: 0,
}

function versFormulaire(fenetre) {
  return {
    date_debut: fenetre.date_debut,
    date_fin: fenetre.date_fin,
    passages_autorises: fenetre.passages_autorises,
    passages_consommes: fenetre.passages_consommes,
  }
}

// Position 0-100% de `dateISO` dans [debut, fin], clampée aux bords (avant
// la fenêtre = 0%, après = 100%) — pour le repère "aujourd'hui" de la frise.
function positionDansLaFenetre(debut, fin, dateISO) {
  const d = new Date(`${debut}T00:00:00Z`)
  const f = new Date(`${fin}T00:00:00Z`)
  const x = new Date(`${dateISO}T00:00:00Z`)
  const total = f - d
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, ((x - d) / total) * 100))
}

// Frise simple (EXG-M6-04, version allégée) : une barre par fenêtre, période
// représentée proportionnellement, repère du jour courant, passages restants.
// La frise pluriannuelle avec marques de diffusions passées est P14b.
function Frise({ fenetres }) {
  const aujourdHui = aujourdHuiISO()
  if (fenetres.length === 0) {
    return <p className="text-sm text-slate-500">Aucune fenêtre de droits pour ce titre — programmable par défaut (aucune restriction).</p>
  }
  return (
    <div className="space-y-3">
      {fenetres.map((f) => {
        const position = positionDansLaFenetre(f.date_debut, f.date_fin, aujourdHui)
        const expiree = aujourdHui > f.date_fin
        const epuisee = f.passages_consommes >= f.passages_autorises
        const restants = f.passages_autorises - f.passages_consommes
        return (
          <div key={f.id}>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
              <span>
                {f.date_debut} → {f.date_fin}
              </span>
              <span className={epuisee || expiree ? 'font-medium text-red-600' : 'text-slate-600'}>
                {restants < 0 ? 0 : restants}/{f.passages_autorises} passages restants
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full ${expiree || epuisee ? 'bg-red-300' : 'bg-emerald-400'}`}
                style={{ width: `${expiree ? 100 : position}%` }}
              />
              {!expiree && (
                <div
                  className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-snrt-navy"
                  style={{ left: `${position}%` }}
                  title="Aujourd'hui"
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function FenetresDroitsPanel({ programmeId }) {
  const [fenetres, setFenetres] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [fenetreId, setFenetreId] = useState(null)
  const [form, setForm] = useState(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [messageSucces, setMessageSucces] = useState(null)

  useEffect(() => {
    rafraichir()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'au changement de programme
  }, [programmeId])

  async function rafraichir() {
    setChargement(true)
    try {
      const lignes = await listerFenetresDroitsParProgramme(programmeId)
      setFenetres(lignes)
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

  function selectionner(fenetre) {
    setFenetreId(fenetre.id)
    setForm(versFormulaire(fenetre))
    setErreur(null)
    setMessageSucces(null)
  }

  function nouvelleFenetre() {
    setFenetreId('NOUVEAU')
    setForm({ ...FENETRE_VIDE })
    setErreur(null)
    setMessageSucces(null)
  }

  async function supprimer(id) {
    try {
      await supprimerFenetreDroits(id)
      if (fenetreId === id) {
        setFenetreId(null)
        setForm(null)
      }
      await rafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function enregistrer(e) {
    e.preventDefault()
    setEnregistrement(true)
    setErreur(null)
    try {
      const champs = {
        date_debut: form.date_debut,
        date_fin: form.date_fin,
        passages_autorises: Number(form.passages_autorises),
        passages_consommes: Number(form.passages_consommes) || 0,
        programme_id: programmeId,
      }
      if (fenetreId === 'NOUVEAU') {
        await creerFenetreDroits(champs)
        afficherSucces('Fenêtre de droits enregistrée.')
        setFenetreId(null)
        setForm(null)
      } else {
        await mettreAJourFenetreDroits(fenetreId, champs)
        afficherSucces('Fenêtre modifiée.')
      }
      await rafraichir()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Droits</h2>
        <button
          type="button"
          onClick={nouvelleFenetre}
          className="flex items-center gap-1.5 rounded-full bg-emerald-600 p-2 text-white hover:bg-emerald-700"
          title="Ajouter une fenêtre de droits"
        >
          <Plus size={16} />
        </button>
      </div>

      {messageSucces && <p className="mb-4 text-sm text-emerald-600">{messageSucces}</p>}
      {!chargement && <div className="mb-4"><Frise fenetres={fenetres} /></div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_1.5fr]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">Début</th>
                <th className="py-2 pr-4 font-medium">Fin</th>
                <th className="py-2 pr-4 font-medium">Passages</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {fenetres.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => selectionner(f)}
                  className={`cursor-pointer border-b border-slate-100 ${
                    fenetreId === f.id ? 'bg-snrt-navy/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-2 pr-4 text-slate-700">{f.date_debut}</td>
                  <td className="py-2 pr-4 text-slate-700">{f.date_fin}</td>
                  <td className="py-2 pr-4 text-slate-700">
                    {f.passages_consommes}/{f.passages_autorises}
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        supprimer(f.id)
                      }}
                      className="text-red-500 hover:text-red-700"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!chargement && fenetres.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-sm text-slate-500">
                    Aucune fenêtre de droits pour ce titre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          {!form ? (
            <p className="text-sm text-slate-500">Sélectionnez une fenêtre ou ajoutez-en une.</p>
          ) : (
            <form onSubmit={enregistrer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Champ
                  label="Date de début *"
                  type="date"
                  required
                  value={form.date_debut}
                  onChange={(v) => setForm({ ...form, date_debut: v })}
                />
                <Champ
                  label="Date de fin *"
                  type="date"
                  required
                  value={form.date_fin}
                  onChange={(v) => setForm({ ...form, date_fin: v })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Champ
                  label="Passages autorisés *"
                  type="number"
                  required
                  value={form.passages_autorises}
                  onChange={(v) => setForm({ ...form, passages_autorises: v })}
                />
                <Champ
                  label="Passages consommés"
                  type="number"
                  value={form.passages_consommes}
                  onChange={(v) => setForm({ ...form, passages_consommes: v })}
                />
              </div>
              <p className="text-xs text-slate-500">
                Les passages consommés ne se décomptent pas automatiquement à la programmation (RG-06 : décompte à
                la diffusion effective) — à ajuster ici manuellement si besoin.
              </p>
              {erreur && <p className="text-sm text-red-600">{erreur}</p>}
              <button
                type="submit"
                disabled={enregistrement}
                className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
              >
                {enregistrement ? 'Enregistrement…' : 'Enregistrer la fenêtre'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Champ({ label, type = 'text', value, onChange, required }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  )
}
