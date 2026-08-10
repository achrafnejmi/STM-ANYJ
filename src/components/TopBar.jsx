import { Menu, LogOut, UserRound } from 'lucide-react'
import { CHAINES } from '../lib/chaines.js'

export default function TopBar({
  utilisateur,
  onDeconnexion,
  onToggleSidebar,
  chaineActive,
  onChangerChaine,
}) {
  return (
    <div>
      <div className={`h-[3px] w-full ${chaineActive.couleur}`} />
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onToggleSidebar} className="text-slate-500 hover:text-slate-700 lg:hidden">
            <Menu size={22} />
          </button>
          <img src="/snrt-favicon.png" alt="SNRT" className="h-9 w-auto" />
          <span className="hidden text-sm font-semibold text-slate-700 sm:inline">STM Next</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${chaineActive.couleur}`}
          >
            {chaineActive.code}
          </span>
          <div className="flex flex-col">
            <select
              value={chaineActive.code}
              onChange={(e) => onChangerChaine(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-700"
            >
              {CHAINES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nom}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">{chaineActive.ligneEditoriale}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-sm text-slate-600">
            <UserRound size={16} />
            {utilisateur}
          </span>
          <button
            type="button"
            onClick={onDeconnexion}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </header>
    </div>
  )
}
