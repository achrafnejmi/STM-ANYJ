// Carte d'indicateur du tableau de bord (M9). `ton` ajoute un liseré de
// couleur discret à gauche, dans la palette SNRT uniquement (bleu = info,
// vert = favorable, orange = vigilance, rouge = alerte) — sobre, une seule
// touche de couleur par carte. `sousTexte` : précision courte sous la valeur
// (ratio, tendance, échéance…).
// P43 : `onClick` optionnel → la carte devient un <button> (drill-down du
// Dashboard d'audit) ; `actif` ajoute un anneau quand son tableau est déplié ;
// `fort` renforce la couleur (fond teinté + valeur colorée) pour bien
// distinguer 4 KPI côte à côte.
const TONS = {
  neutre: { bord: 'border-l-slate-200', fond: '', valeur: 'text-slate-900' },
  info: { bord: 'border-l-snrt-blue', fond: 'bg-snrt-blue/5', valeur: 'text-snrt-blue' },
  favorable: { bord: 'border-l-snrt-green', fond: 'bg-snrt-green/5', valeur: 'text-snrt-green' },
  vigilance: { bord: 'border-l-snrt-orange', fond: 'bg-snrt-orange/5', valeur: 'text-snrt-orange' },
  alerte: { bord: 'border-l-snrt-red', fond: 'bg-snrt-red/5', valeur: 'text-snrt-red' },
}

export default function CarteIndicateur({ libelle, valeur, description, ton = 'neutre', sousTexte, onClick, actif = false, fort = false }) {
  const t = TONS[ton] ?? TONS.neutre
  const classeBase = `rounded-lg border border-slate-200 border-l-4 p-4 text-left ${t.bord} ${
    fort ? t.fond || 'bg-white' : 'bg-white'
  }`
  const contenu = (
    <>
      <div className="text-xs font-medium text-slate-500">{libelle}</div>
      <div className={`mt-1 text-2xl font-semibold ${fort ? t.valeur : 'text-slate-900'}`}>{valeur}</div>
      {sousTexte && <div className="mt-0.5 text-xs text-slate-400">{sousTexte}</div>}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={description}
        className={`${classeBase} w-full transition-shadow hover:shadow-sm ${actif ? 'ring-2 ring-snrt-navy' : ''}`}
      >
        {contenu}
      </button>
    )
  }

  return (
    <div className={classeBase} title={description}>
      {contenu}
    </div>
  )
}
