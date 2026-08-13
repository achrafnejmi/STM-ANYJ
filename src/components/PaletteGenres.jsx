import { GENRES } from '../lib/genres.js'
import { couleurGenre } from '../lib/couleursGenre.js'

// Source du glisser-déposer de l'écran Grille type — mécanique identique à
// LigneEpisode (CataloguePanel.jsx, P10) : payload dans un dragRef partagé
// (pas de dataTransfer), source et cible dans le même document.
export default function PaletteGenres({ dragRef }) {
  return (
    <div className="w-56 shrink-0 rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="mb-2 px-1 text-sm font-semibold text-slate-900">Genres</h3>
      <p className="mb-3 px-1 text-xs text-slate-500">Glissez un genre sur le calendrier pour créer un bloc.</p>
      <div className="space-y-1.5">
        {GENRES.map((g) => {
          const { fond, texte } = couleurGenre(g.fr)
          return (
            <div
              key={g.fr}
              draggable
              onDragStart={() => {
                dragRef.current = { genre: g.fr }
              }}
              className={`cursor-grab rounded-md px-3 py-2 text-sm font-medium shadow-sm active:cursor-grabbing ${fond} ${texte}`}
            >
              {g.fr}
            </div>
          )
        })}
      </div>
    </div>
  )
}
