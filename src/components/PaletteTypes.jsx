import { TYPES_BLOC } from '../lib/typesBloc.js'
import { couleurType } from '../lib/couleursType.js'

// Source du glisser-déposer de l'écran Grille type — mécanique identique à
// LigneEpisode (CataloguePanel.jsx, P10) : payload dans un dragRef partagé
// (pas de dataTransfer), source et cible dans le même document.
export default function PaletteTypes({ dragRef }) {
  return (
    <div className="w-56 shrink-0 rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="mb-2 px-1 text-sm font-semibold text-slate-900">Types de bloc</h3>
      <p className="mb-3 px-1 text-xs text-slate-500">Glissez un type sur le calendrier pour créer un bloc.</p>
      <div className="space-y-1.5">
        {TYPES_BLOC.map((t) => {
          const { fond, texte } = couleurType(t.nom)
          return (
            <div
              key={t.nom}
              draggable
              onDragStart={() => {
                dragRef.current = { type: t.nom }
              }}
              className={`cursor-grab rounded-md px-3 py-2 shadow-sm active:cursor-grabbing ${fond} ${texte}`}
            >
              <div className="text-sm font-medium">{t.nom}</div>
              <div className="text-[11px] opacity-80">
                {t.heure_debut}–{t.heure_fin}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
