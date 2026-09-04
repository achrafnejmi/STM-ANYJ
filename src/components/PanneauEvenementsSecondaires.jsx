import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  listerEvenementsSecondairesParEpisode,
  creerEvenementSecondaire,
  supprimerEvenementSecondaire,
} from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'
import { TYPES_EVENEMENT_SECONDAIRE } from '../lib/evenementsEpisode.js'

const FORM_VIDE = { type: TYPES_EVENEMENT_SECONDAIRE[0], start_time: '', duree_secondes: '' }

// Onglet « Événements secondaires » d'un épisode (P41, ancien STM) : type,
// timecode de début, durée en secondes. Ajout / suppression réservés aux rôles
// `editable` (peutGererCatalogue) ; lecture seule sinon.
export default function PanneauEvenementsSecondaires({ episodeId, editable }) {
  const [evenements, setEvenements] = useState([])
  const [form, setForm] = useState(FORM_VIDE)
  const [chargement, setChargement] = useState(true)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)

  function rafraichir() {
    setChargement(true)
    listerEvenementsSecondairesParEpisode(episodeId)
      .then(setEvenements)
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }

  useEffect(rafraichir, [episodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function ajouter(e) {
    e.preventDefault()
    setEnregistrement(true)
    setErreur(null)
    try {
      await creerEvenementSecondaire({
        episode_id: episodeId,
        type: form.type,
        start_time: form.start_time.trim() || null,
        duree_secondes: form.duree_secondes === '' ? null : Number(form.duree_secondes),
        cree_par: lireUtilisateur(),
      })
      setForm(FORM_VIDE)
      rafraichir()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnregistrement(false)
    }
  }

  async function retirer(id) {
    try {
      await supprimerEvenementSecondaire(id)
      rafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  return (
    <div className="space-y-4">
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      {editable && (
        <form onSubmit={ajouter} className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Événement</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-52 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {TYPES_EVENEMENT_SECONDAIRE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Start time</label>
            <input
              type="text"
              value={form.start_time}
              placeholder="HH:MM:SS:FF"
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Durée (s)</label>
            <input
              type="number"
              min="0"
              value={form.duree_secondes}
              onChange={(e) => setForm({ ...form, duree_secondes: e.target.value })}
              className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={enregistrement}
            className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
          >
            <Plus size={15} />
            Ajouter
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Événement secondaire</th>
              <th className="py-2 pr-4 font-medium">Start time</th>
              <th className="py-2 pr-4 font-medium">Durée (s)</th>
              {editable && <th className="py-2 pr-4"></th>}
            </tr>
          </thead>
          <tbody>
            {evenements.map((ev) => (
              <tr key={ev.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 text-slate-700">{ev.type}</td>
                <td className="py-2 pr-4 font-mono text-slate-700">{ev.start_time || '—'}</td>
                <td className="py-2 pr-4 text-slate-700">{ev.duree_secondes ?? '—'}</td>
                {editable && (
                  <td className="py-2 pr-4 text-right">
                    <button
                      type="button"
                      onClick={() => retirer(ev.id)}
                      title="Supprimer"
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!chargement && evenements.length === 0 && (
              <tr>
                <td colSpan={editable ? 4 : 3} className="py-3 text-sm text-slate-500">
                  Aucun événement secondaire.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
