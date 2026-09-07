// Sélecteur compact « premium » (P49 — passe design) : remplace un contrôle
// segmenté horizontal (Jour/Semaine/Mois/Année, Vue d'ensemble/Standard/Précis)
// par un menu déroulant ancré, pour libérer de la place dans la barre d'outils
// de la Grille linéaire / Grille type. Menu maison (pas un <select> natif) :
// pouce blanc, panneau ombré, coche sur l'option active, navigation clavier.
// Même API que SegmentedControl (options={[[code, label]]}, value, onChange,
// title) → substitution directe sur les sites d'appel concernés.
import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export default function SelecteurCompact({ options, value, onChange, title, className = '' }) {
  const [ouvert, setOuvert] = useState(false)
  const [indexActif, setIndexActif] = useState(-1)
  const conteneurRef = useRef(null)
  const listeId = useId()

  const indexValeur = options.findIndex(([code]) => code === value)
  const labelCourant = indexValeur >= 0 ? options[indexValeur][1] : '—'

  // Fermeture au clic hors du composant + touche Échap.
  useEffect(() => {
    if (!ouvert) return
    function surClicExterieur(e) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target)) setOuvert(false)
    }
    function surTouche(e) {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('mousedown', surClicExterieur)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('mousedown', surClicExterieur)
      document.removeEventListener('keydown', surTouche)
    }
  }, [ouvert])

  function basculer() {
    setOuvert((o) => {
      const prochain = !o
      if (prochain) setIndexActif(indexValeur >= 0 ? indexValeur : 0)
      return prochain
    })
  }

  function choisir(code) {
    onChange(code)
    setOuvert(false)
  }

  function surToucheDeclencheur(e) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!ouvert) basculer()
      else if (e.key !== 'ArrowDown' && indexActif >= 0) choisir(options[indexActif][0])
      else setIndexActif((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp' && ouvert) {
      e.preventDefault()
      setIndexActif((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Home' && ouvert) {
      e.preventDefault()
      setIndexActif(0)
    } else if (e.key === 'End' && ouvert) {
      e.preventDefault()
      setIndexActif(options.length - 1)
    }
  }

  return (
    <div ref={conteneurRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        title={title}
        onClick={basculer}
        onKeyDown={surToucheDeclencheur}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
          ouvert
            ? 'border-snrt-navy bg-white text-snrt-navy ring-2 ring-snrt-navy/15'
            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
        }`}
      >
        <span className="min-w-[4.5rem] text-left">{labelCourant}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-slate-400 transition-transform ${ouvert ? 'rotate-180' : ''}`}
        />
      </button>
      {ouvert && (
        <ul
          id={listeId}
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 min-w-full w-max rounded-lg border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-black/5"
        >
          {options.map(([code, label], i) => {
            const selectionne = code === value
            return (
              <li key={code} role="option" aria-selected={selectionne}>
                <button
                  type="button"
                  onClick={() => choisir(code)}
                  onMouseEnter={() => setIndexActif(i)}
                  className={`flex w-full items-center justify-between gap-4 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                    i === indexActif ? 'bg-slate-100' : ''
                  } ${selectionne ? 'font-semibold text-snrt-navy' : 'text-slate-600'}`}
                >
                  {label}
                  {selectionne && <Check size={13} className="shrink-0 text-snrt-navy" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
