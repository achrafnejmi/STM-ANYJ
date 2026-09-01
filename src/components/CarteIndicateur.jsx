// Carte d'indicateur du tableau de bord (M9). `ton` ajoute un liseré de
// couleur discret à gauche (bleu = info, vert = favorable, ambre = vigilance,
// rose = alerte) — sobre, une seule touche de couleur par carte. `sousTexte` :
// précision courte sous la valeur (ratio, tendance, échéance…).
const TONS = {
  neutre: 'border-l-slate-200',
  info: 'border-l-indigo-400',
  favorable: 'border-l-emerald-400',
  vigilance: 'border-l-amber-400',
  alerte: 'border-l-rose-400',
}

export default function CarteIndicateur({ libelle, valeur, description, ton = 'neutre', sousTexte }) {
  return (
    <div
      className={`rounded-lg border border-slate-200 border-l-4 bg-white p-4 ${TONS[ton] ?? TONS.neutre}`}
      title={description}
    >
      <div className="text-xs font-medium text-slate-500">{libelle}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{valeur}</div>
      {sousTexte && <div className="mt-0.5 text-xs text-slate-400">{sousTexte}</div>}
    </div>
  )
}
