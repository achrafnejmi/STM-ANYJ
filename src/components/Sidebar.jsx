import { X } from 'lucide-react'
import { SECTIONS } from '../lib/navigation.js'
import Marque from './Marque.jsx'

export default function Sidebar({ section, onNaviguer, ouverte, onFermer, badges = {} }) {
  return (
    <>
      {ouverte && <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={onFermer} />}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-snrt-navy transition-transform duration-200 lg:static lg:translate-x-0 ${
          ouverte ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5">
          <Marque variante="sidebar" />
          <button type="button" onClick={onFermer} className="text-white/70 hover:text-white lg:hidden">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-2 pb-4">
          {SECTIONS.map(({ id, label, icone: Icone }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNaviguer(id)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                section === id ? 'bg-snrt-navy-hover text-white' : 'text-white/70 hover:bg-snrt-navy-hover hover:text-white'
              }`}
            >
              <Icone size={18} />
              <span className="flex-1 text-left">{label}</span>
              {badges[id] > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {badges[id]}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>
    </>
  )
}
