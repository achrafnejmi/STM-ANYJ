// Contrôle segmenté réutilisable (P31 — passe design). Trois variantes
// visuellement distinctes pour que l'œil sépare d'un coup les groupes de la
// barre d'outils de la Grille linéaire / Grille type :
//   'vue'    → navigation principale (Jour/Semaine/Mois/Année) : piste grise,
//              pouce blanc surélevé.
//   'filtre' → filtre d'affichage (Satellite/TNT) : capsule arrondie contour,
//              pouce navy plein.
//   'zoom'   → précision d'affichage (Vue d'ensemble/Standard/Précis) : petit,
//              discret, pouce gris.
const VARIANTES = {
  vue: {
    piste: 'inline-flex rounded-lg bg-slate-100 p-0.5',
    bouton: 'rounded-md px-3 py-1 text-sm transition-colors',
    actif: 'bg-white font-semibold text-snrt-navy shadow-sm',
    inactif: 'text-slate-500 hover:text-slate-800',
  },
  filtre: {
    piste: 'inline-flex rounded-full border border-slate-300 p-0.5',
    bouton: 'rounded-full px-3 py-0.5 text-xs font-medium transition-colors',
    actif: 'bg-snrt-navy text-white',
    inactif: 'text-slate-500 hover:bg-slate-100',
  },
  zoom: {
    piste: 'inline-flex overflow-hidden rounded-md border border-slate-200',
    bouton: 'px-2 py-1 text-xs transition-colors',
    actif: 'bg-slate-200 font-medium text-slate-800',
    inactif: 'text-slate-400 hover:text-slate-600 hover:bg-slate-50',
  },
}

export default function SegmentedControl({ variante = 'vue', options, value, onChange, title, className = '' }) {
  const v = VARIANTES[variante] ?? VARIANTES.vue
  return (
    <div className={`${v.piste} ${className}`} title={title}>
      {options.map(([code, label]) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          className={`${v.bouton} ${value === code ? v.actif : v.inactif}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
