// Liste unique des sections de la coquille (sidebar + routage App.jsx + hash URL).
import { Home, Tv2, FileSignature, CalendarRange, CalendarDays, Share2, ListOrdered, Settings } from 'lucide-react'

export const SECTIONS = [
  { id: 'ACCUEIL', label: 'Accueil', icone: Home },
  { id: 'PROGRAMMES', label: 'Programmes', icone: Tv2 },
  { id: 'CONTRATS', label: 'Contrats & droits', icone: FileSignature },
  { id: 'PRE_GRILLE', label: 'Pré-grille', icone: CalendarRange },
  { id: 'GRILLE_LINEAIRE', label: 'Grille linéaire', icone: CalendarDays },
  { id: 'GRILLE_NON_LINEAIRE', label: 'Grille non-linéaire', icone: Share2 },
  { id: 'CONDUCTEUR', label: 'Conducteur', icone: ListOrdered },
  { id: 'ADMINISTRATION', label: 'Administration', icone: Settings },
]

export function sectionVersHash(id) {
  return id.toLowerCase().replace(/_/g, '-')
}

export function hashVersSection(hash) {
  const slug = hash.replace(/^#/, '')
  if (!slug) return null
  const id = slug.toUpperCase().replace(/-/g, '_')
  return SECTIONS.some((s) => s.id === id) ? id : null
}
