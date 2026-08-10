import { Clock } from 'lucide-react'

export default function Placeholder({ titre, phase }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-10 py-12 text-center">
        <Clock size={28} className="mx-auto mb-3 text-slate-400" />
        <h2 className="mb-1 text-base font-semibold text-slate-900">{titre}</h2>
        <p className="text-sm text-slate-500">Bientôt{phase ? ` — Phase ${phase}` : ''}</p>
      </div>
    </div>
  )
}
