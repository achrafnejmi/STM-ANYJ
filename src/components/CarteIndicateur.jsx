// Carte d'indicateur du tableau de bord (M9). `ton` ajoute un liseré de
// couleur discret à gauche, dans la palette SNRT uniquement (bleu = info,
// vert = favorable, orange = vigilance, rouge = alerte) — sobre, une seule
// touche de couleur par carte. `sousTexte` : précision courte sous la valeur
// (ratio, tendance, échéance…).
const TONS = {
  neutre: 'border-l-slate-200',
  info: 'border-l-snrt-blue',
  favorable: 'border-l-snrt-green',
  vigilance: 'border-l-snrt-orange',
  alerte: 'border-l-snrt-red',
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
