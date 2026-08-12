import { useState } from 'react'
import { X, ShieldCheck } from 'lucide-react'
import { formaterJourCourt } from '../lib/semaine.js'

const NIVEAUX = [
  ['tous', 'Tous'],
  ['bloquant', 'Bloquants'],
  ['alerte', 'Alertes'],
  ['info', 'Infos'],
]

const STYLE_NIVEAU = {
  bloquant: { bordure: 'border-red-200', fond: 'bg-red-50', tag: 'bg-red-100 text-red-700' },
  alerte: { bordure: 'border-amber-200', fond: 'bg-amber-50', tag: 'bg-amber-100 text-amber-700' },
  info: { bordure: 'border-slate-200', fond: 'bg-white', tag: 'bg-slate-100 text-slate-600' },
}

// Panneau flottant (même gabarit que InspecteurBloc, P11) — mutuellement
// exclusif avec l'Inspecteur côté GrilleLineaire.jsx : ouvrir l'un ferme
// l'autre plutôt que d'empiler deux panneaux sur le même bord.
export default function PanneauAnomalies({ anomalies, onFermer, onAller }) {
  const [filtre, setFiltre] = useState('tous')
  const visibles = anomalies.filter((a) => filtre === 'tous' || a.niveau === filtre)
  const compte = (niveau) => anomalies.filter((a) => a.niveau === niveau).length

  return (
    <div className="fixed right-0 top-0 z-30 flex h-full w-96 flex-col overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Anomalies</h3>
        <button type="button" onClick={onFermer} className="text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
      </div>

      <div className="mb-3 flex gap-2 text-xs">
        <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">{compte('bloquant')}</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">{compte('alerte')}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{compte('info')}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {NIVEAUX.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltre(id)}
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              filtre === id ? 'bg-snrt-navy text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2">
        {visibles.map((a, i) => {
          const style = STYLE_NIVEAU[a.niveau]
          // Un trou d'antenne n'est rattaché à aucune transmission précise
          // (id: null) — non sélectionnable, comme dans le mockup de référence.
          const cliquable = a.id != null
          return (
            <button
              key={i}
              type="button"
              disabled={!cliquable}
              onClick={cliquable ? () => onAller(a.id) : undefined}
              className={`w-full rounded-md border p-2 text-left text-xs ${style.bordure} ${style.fond} ${
                cliquable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-slate-500">
                  {formaterJourCourt(a.date)} · {a.heure}
                </span>
                <span className={`rounded px-1.5 py-0.5 font-medium ${style.tag}`}>{a.type}</span>
              </div>
              <div className="text-slate-700">{a.message}</div>
            </button>
          )
        })}
        {visibles.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ShieldCheck size={24} className="text-emerald-500" />
            <p className="text-sm font-semibold text-slate-700">Rien à signaler</p>
            <p className="text-xs text-slate-500">Chevauchements, matériel, trous et écarts de grille type : la période est conforme.</p>
          </div>
        )}
      </div>
    </div>
  )
}
