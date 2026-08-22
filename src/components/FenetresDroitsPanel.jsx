import { useEffect, useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  listerFenetresDroitsParProgramme,
  creerFenetreDroits,
  mettreAJourFenetreDroits,
  supprimerFenetreDroits,
} from '../lib/db.js'
import { aujourdHuiISO } from '../lib/semaine.js'
import { useNotification, useGardeModifications } from './NotificationProvider.jsx'

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

// Seuil "proche de l'expiration" (P21 Lot A, remplace l'ancienne jauge) :
// ambre si la fin approche (≤30 jours) ou s'il ne reste qu'un seul passage,
// rouge si expirée ou épuisée, vert sinon — même convention rouge/ambre/vert
// que le reste de l'app (cf. Conducteur.jsx, PanneauAnomalies.jsx).
const JOURS_SEUIL_PROCHE = 30

function statutFenetre(f, aujourdHui) {
  const expiree = aujourdHui > f.date_fin
  const restants = f.passages_autorises - f.passages_consommes
  const epuisee = restants <= 0
  if (expiree || epuisee) return 'rouge'
  const joursAvantFin = Math.ceil((new Date(`${f.date_fin}T00:00:00Z`) - new Date(`${aujourdHui}T00:00:00Z`)) / 86400000)
  if (joursAvantFin <= JOURS_SEUIL_PROCHE || restants === 1) return 'ambre'
  return 'vert'
}

const CLASSES_STATUT = {
  rouge: 'bg-red-100 text-red-700',
  ambre: 'bg-amber-100 text-amber-700',
  vert: 'bg-emerald-100 text-emerald-700',
}

// Cartes de fenêtres de droits (EXG-M6-04) : début / fin / passages restants
// affichés clairement, pastille de couleur selon l'état (P21 Lot A —
// remplace l'ancienne jauge de progression).
function CartesFenetres({ fenetres }) {
  const aujourdHui = aujourdHuiISO()
  if (fenetres.length === 0) {
    return <p className="text-sm text-slate-500">Aucune fenêtre de droits pour ce titre — programmable par défaut (aucune restriction).</p>
  }
  return (
    <div className="space-y-2">
      {fenetres.map((f) => {
        const restants = f.passages_autorises - f.passages_consommes
        const statut = statutFenetre(f, aujourdHui)
        return (
          <div key={f.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
            <span className="text-sm text-slate-700">
              {f.date_debut} → {f.date_fin}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASSES_STATUT[statut]}`}>
              {restants < 0 ? 0 : restants}/{f.passages_autorises} passages restants
            </span>
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
  const [valeurInitiale, setValeurInitiale] = useState(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const notifier = useNotification()
  const { demanderConfirmation } = useGardeModifications(form, valeurInitiale)

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

  // Garde-fou "modifications non enregistrées" (P21 Lot G) : changer de ligne
  // sélectionnée ou ouvrir "nouvelle fenêtre" abandonnerait silencieusement la
  // saisie en cours sinon.
  async function selectionner(fenetre) {
    if (!(await demanderConfirmation())) return
    setFenetreId(fenetre.id)
    setForm(versFormulaire(fenetre))
    setValeurInitiale(versFormulaire(fenetre))
    setErreur(null)
  }

  async function nouvelleFenetre() {
    if (!(await demanderConfirmation())) return
    setFenetreId('NOUVEAU')
    setForm({ ...FENETRE_VIDE })
    setValeurInitiale({ ...FENETRE_VIDE })
    setErreur(null)
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
        notifier.succes('Fenêtre de droits enregistrée.')
        setFenetreId(null)
        setForm(null)
        setValeurInitiale(null)
      } else {
        await mettreAJourFenetreDroits(fenetreId, champs)
        notifier.succes('Fenêtre modifiée.')
        setValeurInitiale(form)
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

      {!chargement && (
        <div className="mb-4">
          <CartesFenetres fenetres={fenetres} />
        </div>
      )}

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
