// Carte d'indicateur du tableau de bord (M9). `ton` ajoute un liseré de
// couleur discret à gauche, dans la palette SNRT uniquement (bleu = info,
// vert = favorable, orange = vigilance, rouge = alerte) — sobre, une seule
// touche de couleur par carte. `sousTexte` : précision courte sous la valeur
// (ratio, tendance, échéance…).
// P43 : `onClick` optionnel → la carte devient un <button> (drill-down du
// Dashboard d'audit) ; `actif` ajoute un anneau quand son tableau est déplié.
const TONS = {
  neutre: 'border-l-slate-200',
  info: 'border-l-snrt-blue',
  favorable: 'border-l-snrt-green',
  vigilance: 'border-l-snrt-orange',
  alerte: 'border-l-snrt-red',
}

export default function CarteIndicateur({ libelle, valeur, description, ton = 'neutre', sousTexte, onClick, actif = false }) {
  const classeBase = `rounded-lg border border-slate-200 border-l-4 bg-white p-4 text-left ${TONS[ton] ?? TONS.neutre}`
  const contenu = (
    <>
      <div className="text-xs font-medium text-slate-500">{libelle}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{valeur}</div>
      {sousTexte && <div className="mt-0.5 text-xs text-slate-400">{sousTexte}</div>}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={description}
        className={`${classeBase} w-full transition-shadow hover:shadow-sm ${
          actif ? 'ring-2 ring-snrt-navy' : ''
        }`}
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
