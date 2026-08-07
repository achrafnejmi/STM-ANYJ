import { ClipboardList, Megaphone } from 'lucide-react'
import { definirRole } from '../lib/session.js'

export default function Login({ onChoix }) {
  function choisir(role) {
    definirRole(role)
    onChoix(role)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center text-lg font-semibold text-slate-900">
          Notification des offres non linéaires
        </h1>
        <p className="mb-8 text-center text-sm text-slate-500">Choisissez votre rôle</p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => choisir('PROGRAMMATION')}
            className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-slate-400"
          >
            <ClipboardList size={20} className="text-slate-600" />
            <div>
              <div className="font-medium text-slate-900">Programmation</div>
              <div className="text-sm text-slate-500">Importer la grille, créer et notifier des offres</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => choisir('DIGITAL')}
            className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-slate-400"
          >
            <Megaphone size={20} className="text-slate-600" />
            <div>
              <div className="font-medium text-slate-900">Digital</div>
              <div className="text-sm text-slate-500">Recevoir et suivre les notifications</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
