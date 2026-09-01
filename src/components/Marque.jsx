import { ABBR, NOM_COMPLET, ORG, LOGO_SVG } from '../lib/marque.js'

// Lockup de marque, 3 variantes. Le sous-titre peut se masquer sur petit
// écran, jamais l'abréviation "STM" (toujours identifiable, même en mobile).
export default function Marque({ variante = 'topbar' }) {
  if (variante === 'sidebar') {
    return <img src={LOGO_SVG} alt="SNRT" className="h-10 w-auto" />
  }

  if (variante === 'login') {
    return (
      <div className="flex flex-col items-center text-center">
        <img src={LOGO_SVG} alt="SNRT" className="mb-3 h-16 w-auto" />
        <span className="text-[32px] font-bold leading-none text-snrt-navy">{ABBR}</span>
        <span className="mt-1.5 text-sm tracking-wide text-slate-500">{NOM_COMPLET}</span>
        <span className="mt-2 text-[10px] text-slate-400">{ORG}</span>
      </div>
    )
  }

  // Variante "topbar" (défaut) : PAS d'étoile ici — la Sidebar juste à
  // gauche porte déjà la marque (variante "sidebar"), un 2ᵉ logo à quelques
  // pixels de distance lisait comme redondant. Le texte seul suffit à
  // identifier l'écran, l'étoile de la Sidebar reste la seule marque
  // iconique (visible aussi repliée, contrairement à celle-ci qui
  // disparaîtrait).
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-lg font-bold text-snrt-navy">{ABBR}</span>
      <span className="hidden text-[11px] tracking-wide text-slate-500 sm:inline">{NOM_COMPLET}</span>
    </div>
  )
}
