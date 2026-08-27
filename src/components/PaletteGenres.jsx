import { GENRES } from '../lib/genres.js'
import { couleurGenre } from '../lib/couleursGenre.js'

// Source du glisser-déposer de l'écran Grille type — mécanique identique à
// LigneEpisode (CataloguePanel.jsx, P10) : payload dans un dragRef partagé
// (pas de dataTransfer), source et cible dans le même document.
//
// P28b : remplace l'ancienne palette de "types de bloc" (Matinale/Jeunesse/...,
// hors cahier, retirée) — un bloc de grille type n'a plus qu'un genre attendu,
// conforme à la composition d'écran M3 du cahier ("repère de couleur DU
// GENRE").
export default function PaletteGenres({ dragRef }) {
  return (
    <div className="w-56 shrink-0 rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="mb-2 px-1 text-sm font-semibold text-slate-900">Genre attendu</h3>
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
              className={`cursor-grab rounded-md px-3 py-2 shadow-sm active:cursor-grabbing ${fond} ${texte}`}
            >
              <div className="text-sm font-medium">{g.fr}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
