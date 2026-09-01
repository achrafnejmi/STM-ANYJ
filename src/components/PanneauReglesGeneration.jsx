import { Play, Pencil, Plus } from 'lucide-react'

// Génération du Plan média par règles (P32/P33/P34 — hors cahier). Cet onglet
// ne contient plus que la bibliothèque de règles + le bouton « Générer » : le
// moteur campagnes (tableau Campagnes, rapport de couverture, options
// habillage/écran pub/tranches) a été retiré. Une règle ajoute N annonces
// (spots/BA/écrans pris dans la bibliothèque) entre ET dans les programmes
// dont la durée / le genre correspondent. Le résultat est identique à une
// composition manuelle : des element_secondaire posés autour des programmes.
export default function PanneauReglesGeneration({
  periodeLabel,
  onGenerer,
  chargement,
  regles = [],
  onNouvelleRegle,
  onEditerRegle,
  onBasculerActiveRegle,
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-1 text-base font-semibold text-slate-900">Génération par règles</h2>
      <p className="mb-4 text-sm text-slate-500">{periodeLabel}</p>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Bibliothèque de règles</span>
        <button type="button" onClick={onNouvelleRegle} className="flex items-center gap-1 text-xs font-medium text-snrt-navy hover:underline">
          <Plus size={13} />
          Nouvelle règle
        </button>
      </div>

      {regles.length === 0 ? (
        <p className="text-xs text-slate-400">
          Aucune règle. Une règle ajoute automatiquement des annonces (spots / bandes-annonces / écrans pub) entre et dans
          les programmes de la grille selon leur durée et leur genre.
        </p>
      ) : (
        <div className="space-y-2">
          {regles.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={r.active}
                onChange={(e) => onBasculerActiveRegle(r.id, e.target.checked)}
                title={r.active ? 'Active pour la génération' : 'Inactive'}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-700">{r.nom}</div>
                <div className="text-slate-400">
                  {r.duree_min_minutes}–{r.duree_max_minutes} min · {r.nombre_annonces ?? 0} entre / {r.annonces_intra ?? 0} dans ·{' '}
                  {r.genres?.length ? r.genres.join(', ') : 'tous genres'}
                </div>
              </div>
              <button type="button" onClick={() => onEditerRegle(r)} className="text-slate-400 hover:text-snrt-navy">
                <Pencil size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onGenerer}
        disabled={chargement}
        className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-md bg-snrt-navy px-4 py-2 text-sm font-medium text-white hover:bg-snrt-navy-hover disabled:opacity-60"
      >
        <Play size={16} />
        Générer
      </button>
    </div>
  )
}
