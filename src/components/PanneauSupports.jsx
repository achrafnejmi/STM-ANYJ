import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { listerSupportsParEpisode, creerSupport, supprimerSupport } from '../lib/db.js'
import { lireUtilisateur } from '../lib/session.js'

const FORM_VIDE = { numero_support: '', type_support: '', tc_in: '' }

// Onglet « Supports » d'un épisode (P41, ancien STM) : liste des supports
// rattachés (numéro, type, timecode d'entrée). Ajout / suppression réservés aux
// rôles `editable` (peutGererCatalogue) ; lecture seule sinon.
export default function PanneauSupports({ episodeId, editable }) {
  const [supports, setSupports] = useState([])
  const [form, setForm] = useState(FORM_VIDE)
  const [chargement, setChargement] = useState(true)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)

  function rafraichir() {
    setChargement(true)
    listerSupportsParEpisode(episodeId)
      .then(setSupports)
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false))
  }

  useEffect(rafraichir, [episodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function attacher(e) {
    e.preventDefault()
    setEnregistrement(true)
    setErreur(null)
    try {
      await creerSupport({
        episode_id: episodeId,
        numero_support: form.numero_support.trim() || null,
        type_support: form.type_support.trim() || null,
        tc_in: form.tc_in.trim() || null,
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

  async function detacher(id) {
    try {
      await supprimerSupport(id)
      rafraichir()
    } catch (err) {
      setErreur(err.message)
    }
  }

  return (
    <div className="space-y-4">
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      {editable && (
        <form onSubmit={attacher} className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <Champ
            label="Numéro de support"
            value={form.numero_support}
            onChange={(v) => setForm({ ...form, numero_support: v })}
          />
          <Champ
            label="Type de support"
            value={form.type_support}
            onChange={(v) => setForm({ ...form, type_support: v })}
          />
          <Champ label="Tc in" value={form.tc_in} onChange={(v) => setForm({ ...form, tc_in: v })} placeholder="HH:MM:SS:FF" />
          <button
            type="submit"
            disabled={enregistrement}
            className="flex items-center gap-1.5 rounded-md bg-snrt-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
          >
            <Plus size={15} />
            Attacher un support
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4 font-medium">Numéro de support</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Tc in</th>
              {editable && <th className="py-2 pr-4"></th>}
            </tr>
          </thead>
          <tbody>
            {supports.map((s) => (
              <tr key={s.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 text-slate-700">{s.numero_support || '—'}</td>
                <td className="py-2 pr-4 text-slate-700">{s.type_support || '—'}</td>
                <td className="py-2 pr-4 font-mono text-slate-700">{s.tc_in || '—'}</td>
                {editable && (
                  <td className="py-2 pr-4 text-right">
                    <button
                      type="button"
                      onClick={() => detacher(s.id)}
                      title="Détacher ce support"
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!chargement && supports.length === 0 && (
              <tr>
                <td colSpan={editable ? 4 : 3} className="py-3 text-sm text-slate-500">
                  Aucun support attaché.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Champ({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-44 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
    </div>
  )
}
