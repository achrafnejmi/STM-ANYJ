import { X, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { SECTIONS } from '../lib/navigation.js'
import Marque from './Marque.jsx'

// `repliee` (retouche post-P29) : rail d'icônes desktop, distinct du tiroir
// mobile `ouverte`/`onFermer` ci-dessous — les deux mécanismes coexistent,
// le repli n'a aucun sens sur le tiroir mobile qui se ferme déjà entièrement.
export default function Sidebar({ section, onNaviguer, ouverte, onFermer, badges = {}, repliee = false, onBasculerReplier }) {
  return (
    <>
      {ouverte && <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={onFermer} />}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-snrt-navy transition-[transform,width] duration-200 lg:static lg:translate-x-0 ${
          repliee ? 'lg:w-16' : 'lg:w-64'
        } w-64 ${ouverte ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`flex items-center px-4 py-5 ${repliee ? 'lg:justify-center lg:px-0' : 'justify-between'}`}>
          <Marque variante="sidebar" />
          <button type="button" onClick={onFermer} className="text-white/70 hover:text-snrt-accent lg:hidden">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-2 pb-4">
          {SECTIONS.map(({ id, label, icone: Icone }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNaviguer(id)}
              title={label}
              className={`relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                repliee ? 'lg:justify-center lg:px-2' : ''
              } ${section === id ? 'bg-snrt-navy-hover text-white' : 'text-white/70 hover:bg-snrt-navy-hover hover:text-white'}`}
            >
              {section === id && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-snrt-accent" />}
              <Icone size={18} className="shrink-0" />
              <span className={repliee ? 'flex-1 text-left lg:hidden' : 'flex-1 text-left'}>{label}</span>
              {badges[id] > 0 && (
                <span
                  className={
                    repliee
                      ? 'rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white lg:absolute lg:right-1 lg:top-1 lg:px-1 lg:py-0 lg:text-[9px]'
                      : 'rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white'
                  }
                >
                  {badges[id]}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={onBasculerReplier}
          title={repliee ? 'Étendre le menu' : 'Réduire le menu'}
          className={`hidden items-center border-t border-white/10 py-3 text-white/70 hover:bg-snrt-navy-hover hover:text-snrt-accent lg:flex ${
            repliee ? 'justify-center' : 'justify-end px-4'
          }`}
        >
          {repliee ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </aside>
    </>
  )
}
