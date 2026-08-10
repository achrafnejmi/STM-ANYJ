import { Menu, LogOut, UserRound } from 'lucide-react'

export default function TopBar({ utilisateur, onDeconnexion, onToggleSidebar }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggleSidebar} className="text-slate-500 hover:text-slate-700 lg:hidden">
          <Menu size={22} />
        </button>
        <img src="/snrt-favicon.png" alt="SNRT" className="h-9 w-auto" />
        <span className="hidden text-sm font-semibold text-slate-700 sm:inline">
          Snomark — STM nouvelle génération
        </span>
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
  )
}
