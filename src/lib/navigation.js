// Liste unique des sections de la coquille (sidebar + routage App.jsx + hash URL).
import { Home, Tv2, FileSignature, Layers3, CalendarDays, ListChecks, Megaphone, Share2, ListOrdered, Settings } from 'lucide-react'

export const SECTIONS = [
  { id: 'ACCUEIL', label: 'Accueil', icone: Home },
  { id: 'PROGRAMMES', label: 'Programmes', icone: Tv2 },
  { id: 'CONTRATS', label: 'Contrats & droits', icone: FileSignature },
  { id: 'GRILLE_TYPE', label: 'Grille type', icone: Layers3 },
  { id: 'GRILLE_LINEAIRE', label: 'Grille linéaire', icone: CalendarDays },
  { id: 'AUTO_PROGRAMMATION', label: 'Auto-programmation', icone: ListChecks },
  { id: 'PLAN_MEDIA', label: 'Plan média', icone: Megaphone },
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
