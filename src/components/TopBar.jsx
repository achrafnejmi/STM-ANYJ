import { Menu, LogOut, UserRound, Search, Bell } from 'lucide-react'
import { CHAINES } from '../lib/chaines.js'
import Marque from './Marque.jsx'

export default function TopBar({
  utilisateur,
  onDeconnexion,
  onToggleSidebar,
  chaineActive,
  onChangerChaine,
  onOuvrirRecherche,
  onOuvrirNotifications,
  nbNotificationsNonLues = 0,
}) {
  return (
    <div>
      <div className={`h-[3px] w-full ${chaineActive.couleur}`} />
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onToggleSidebar} className="text-slate-500 hover:text-snrt-accent lg:hidden">
            <Menu size={22} />
          </button>
          <Marque variante="topbar" />
        </div>

        <button
          type="button"
          onClick={onOuvrirRecherche}
          title="Recherche globale (Ctrl+K)"
          className="hidden items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 sm:flex"
        >
          <Search size={16} />
          Rechercher…
          <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-400">Ctrl+K</kbd>
        </button>

        <div className="flex items-start gap-2">
          <img src={chaineActive.logo} alt={chaineActive.nom} className="h-8 w-8 shrink-0 object-contain" />
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
          <button
            type="button"
            onClick={onOuvrirNotifications}
            title="Notifications"
            className="relative text-slate-500 hover:text-snrt-accent"
          >
            <Bell size={20} />
            {nbNotificationsNonLues > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                {nbNotificationsNonLues}
              </span>
            )}
          </button>
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
