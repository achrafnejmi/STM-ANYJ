// Logos de marque en SVG inline (Grille non-linéaire, P20) — aucune
// dépendance npm (ni simple-icons ni image externe), un seul tracé par
// plateforme, coloré via `currentColor` (le fond/la couleur d'icône viennent
// de couleursPlateforme.js côté appelant). Repères simplifiés, pas des
// tracés officiels pixel-exacts — suffisant pour une reconnaissance visuelle
// dans une carte de calendrier. FORJA n'a pas de marque publique : son vrai
// logo (public/brand/forja-logo.svg) s'affiche via <img>, jamais via ce
// composant — voir CalendrierPublications.jsx.
export default function LogoPlateforme({ code, size = 16, className = '' }) {
  const commun = { width: size, height: size, viewBox: '0 0 24 24', className, 'aria-hidden': true }

  switch (code) {
    case 'FACEBOOK':
      return (
        <svg {...commun} fill="currentColor">
          <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94Z" />
        </svg>
      )
    case 'INSTAGRAM':
      return (
        <svg {...commun} fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'TIKTOK':
      return (
        <svg {...commun} fill="currentColor">
          <path d="M16.5 2h-3.1v13.6a2.9 2.9 0 1 1-2.9-2.9c.27 0 .53.03.78.09V9.6a6 6 0 1 0 5.22 5.95V8.2a7.6 7.6 0 0 0 4.5 1.46V6.55A4.6 4.6 0 0 1 16.5 2Z" />
        </svg>
      )
    case 'SNAPCHAT':
      return (
        <svg {...commun} fill="currentColor">
          <path d="M12 2c2.7 0 4.7 2.2 4.7 5v1.9c0 .3.25.4.45.4.5 0 1.2-.4 1.6-.4.4 0 .8.2.8.7 0 .6-.7 1-1.5 1.4-.3.15-.5.5-.35.9.5 1.5 2 3 3.6 3.3.3.05.3.4.05.6-.6.4-1.6.6-2.3.7-.15 0-.25.1-.3.25-.05.2-.1.5-.15.7-.05.2-.2.3-.45.3-.3 0-.7-.05-1.2-.05-.9 0-1.5.5-3 .5s-2.1-.5-3-.5c-.5 0-.9.05-1.2.05-.25 0-.4-.1-.45-.3-.05-.2-.1-.5-.15-.7-.05-.15-.15-.25-.3-.25-.7-.1-1.7-.3-2.3-.7-.25-.2-.25-.55.05-.6 1.6-.3 3.1-1.8 3.6-3.3.15-.4-.05-.75-.35-.9-.8-.4-1.5-.8-1.5-1.4 0-.5.4-.7.8-.7.4 0 1.1.4 1.6.4.2 0 .45-.1.45-.4V7c0-2.8 2-5 4.7-5Z" />
        </svg>
      )
    case 'YOUTUBE':
      return (
        <svg {...commun} fill="currentColor">
          <path d="M21.6 7.2s-.2-1.5-.85-2.15c-.8-.85-1.7-.85-2.1-.9C15.9 4 12 4 12 4h-.02s-3.9 0-6.65.15c-.4.05-1.3.05-2.1.9C2.6 5.7 2.4 7.2 2.4 7.2S2.2 9 2.2 10.7v1.6c0 1.7.2 3.5.2 3.5s.2 1.5.85 2.15c.8.85 1.85.8 2.3.9 1.7.15 7.1.2 7.1.2s3.9 0 6.65-.15c.4-.05 1.3-.05 2.1-.9.65-.65.85-2.15.85-2.15s.2-1.8.2-3.5v-1.6c0-1.7-.2-3.5-.2-3.5ZM10 14.7V8.8l5.3 2.95L10 14.7Z" />
        </svg>
      )
    default:
      return null
  }
}
