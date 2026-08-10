import { useEffect, useId, useState } from 'react'
import { Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { listerSegments, creerSegment, mettreAJourSegment, supprimerSegment } from '../lib/db.js'
import Placeholder from '../components/Placeholder.jsx'

const ONGLETS = [
  { id: 'INFOS', label: 'Informations générales' },
  { id: 'SUPPORTS', label: 'Supports' },
  { id: 'EVENEMENTS', label: 'Événements secondaires' },
]

const SEGMENT_VIDE = {
  numero: '',
  titre: '',
  duree: '',
  date_production: '',
  code: '',
  description: '',
  pad: false,
}

function versFormulaire(segment) {
  return {
    numero: segment.numero ?? '',
    titre: segment.titre ?? '',
    duree: segment.duree ?? '',
    date_production: segment.date_production ?? '',
    code: segment.code ?? '',
    description: segment.description ?? '',
    pad: segment.pad ?? false,
  }
}

export default function SegmentsPanel({ programmeId, onSegmentsChange }) {
  const [segments, setSegments] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [segmentId, setSegmentId] = useState(null)
  const [onglet, setOnglet] = useState('INFOS')
  const [form, setForm] = useState(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const idDescription = useId()
  const idPad = useId()

  useEffect(() => {
    rafraichir()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'au changement de programme, pas à onSegmentsChange (identité instable côté parent)
  }, [programmeId])

  async function rafraichir() {
    setChargement(true)
    try {
      const lignes = await listerSegments(programmeId)
      setSegments(lignes)
      onSegmentsChange?.(lignes)
    } catch (err) {
      setErreur(err.message)
    } finally {
      setChargement(false)
    }
  }

  function selectionner(segment) {
    setSegmentId(segment.id)
    setForm(versFormulaire(segment))
    setOnglet('INFOS')
    setErreur(null)
  }

  function nouveauSegment() {
    setSegmentId('NOUVEAU')
    setForm({ ...SEGMENT_VIDE, numero: segments.length + 1 })
    setOnglet('INFOS')
    setErreur(null)
  }

  async function supprimer(id) {
    try {
      await supprimerSegment(id)
      if (segmentId === id) {
        setSegmentId(null)
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
        numero: form.numero === '' ? null : Number(form.numero),
        titre: form.titre.trim(),
        duree: form.duree === '' ? null : Number(form.duree),
        date_production: form.date_production || null,
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        pad: form.pad,
        programme_id: programmeId,
      }
      if (segmentId === 'NOUVEAU') {
        const cree = await creerSegment(champs)
        setSegmentId(cree.id)
      } else {
        await mettreAJourSegment(segmentId, champs)
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
        <h2 className="text-base font-semibold text-slate-900">Segments</h2>
        <button
          type="button"
          onClick={nouveauSegment}
          className="flex items-center gap-1.5 rounded-full bg-emerald-600 p-2 text-white hover:bg-emerald-700"
          title="Ajouter un segment"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_2fr]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">N°</th>
                <th className="py-2 pr-4 font-medium">Titre</th>
                <th className="py-2 pr-4 font-medium">PAD</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {segments.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => selectionner(s)}
                  className={`cursor-pointer border-b border-slate-100 ${
                    segmentId === s.id ? 'bg-snrt-navy/5' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-2 pr-4 text-slate-700">{s.numero ?? '—'}</td>
                  <td className="py-2 pr-4 text-slate-700">{s.titre || '—'}</td>
                  <td className="py-2 pr-4">{s.pad && <CheckCircle2 size={16} className="text-emerald-600" />}</td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        supprimer(s.id)
                      }}
                      className="text-red-500 hover:text-red-700"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!chargement && segments.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-sm text-slate-500">
                    Aucun segment pour ce programme.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          {!form ? (
            <p className="text-sm text-slate-500">Sélectionnez un segment ou ajoutez-en un.</p>
          ) : (
            <>
              <div className="mb-4 flex gap-4 border-b border-slate-200">
                {ONGLETS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOnglet(o.id)}
                    className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
                      onglet === o.id
                        ? 'border-snrt-navy text-snrt-navy'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {onglet === 'SUPPORTS' && <Placeholder titre="Supports" />}
              {onglet === 'EVENEMENTS' && <Placeholder titre="Événements secondaires" />}
              {onglet === 'INFOS' && (
                <form onSubmit={enregistrer} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Champ label="N°" type="number" value={form.numero} onChange={(v) => setForm({ ...form, numero: v })} />
                    <Champ
                      label="Durée (minutes) *"
                      type="number"
                      required
                      value={form.duree}
                      onChange={(v) => setForm({ ...form, duree: v })}
                    />
                  </div>
                  <Champ label="Titre" value={form.titre} onChange={(v) => setForm({ ...form, titre: v })} />
                  <div className="grid grid-cols-2 gap-4">
                    <Champ
                      label="Date de production"
                      type="date"
                      value={form.date_production}
                      onChange={(v) => setForm({ ...form, date_production: v })}
                    />
                    <Champ label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
                  </div>
                  <div>
                    <label htmlFor={idDescription} className="mb-1 block text-sm font-medium text-slate-700">
                      Description
                    </label>
                    <textarea
                      id={idDescription}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={3}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <label htmlFor={idPad} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      id={idPad}
                      type="checkbox"
                      checked={form.pad}
                      onChange={(e) => setForm({ ...form, pad: e.target.checked })}
                    />
                    PAD (prêt à diffuser)
                  </label>
                  {segmentId !== 'NOUVEAU' && (
                    <div className="grid grid-cols-2 gap-4 text-sm text-slate-500">
                      <div>
                        Dernière diffusion :{' '}
                        {segments.find((s) => s.id === segmentId)?.derniere_diffusion || '—'}
                      </div>
                      <div>
                        Nombre de diffusions : {segments.find((s) => s.id === segmentId)?.nombre_diffusions ?? 0}
                      </div>
                    </div>
                  )}
                  {erreur && <p className="text-sm text-red-600">{erreur}</p>}
                  <button
                    type="submit"
                    disabled={enregistrement}
                    className="rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
                  >
                    {enregistrement ? 'Enregistrement…' : 'Enregistrer le segment'}
                  </button>
                </form>
              )}
            </>
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
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  )
}
