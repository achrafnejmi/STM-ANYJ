// Fond de l'écran de connexion (P31 — passe design). Scène 3D « broadcasting »
// aux couleurs SNRT : espace navy, limbe terrestre avec halo d'atmosphère,
// orbites en perspective, un satellite qui tourne et émet un faisceau, une
// station au sol qui pulse, un champ d'étoiles, et l'étoile SNRT en balise.
// Purement décoratif : aria-hidden, pointer-events-none, aucune donnée.
// Toutes les animations sont coupées si prefers-reduced-motion (voir index.css,
// sélecteur [data-fondlogin]).

// Trajectoire elliptique du satellite (orbite médiane), en coordonnées du
// viewBox — reprise telle quelle par offset-path.
const ORBITE_SAT = 'path("M 210 560 a 590 150 0 1 0 1180 0 a 590 150 0 1 0 -1180 0")'

// Champ d'étoiles fixe (positions pseudo-aléatoires mais déterministes).
const ETOILES = Array.from({ length: 60 }, (_, i) => {
  const x = (i * 149.3) % 1600
  const y = (i * 83.7 + (i % 7) * 37) % 620
  const r = 0.4 + ((i * 53) % 100) / 90
  const scintille = i % 9 === 0
  return { x, y, r, scintille, delai: -(i % 5) * 0.9 }
})

export default function FondLogin() {
  return (
    <div data-fondlogin aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-[#16273a]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="fl-espace" cx="50%" cy="34%" r="80%">
            <stop offset="0%" stopColor="#2c4a68" />
            <stop offset="55%" stopColor="#213a52" />
            <stop offset="100%" stopColor="#14243a" />
          </radialGradient>
          <radialGradient id="fl-terre2" cx="50%" cy="0%" r="60%">
            <stop offset="0%" stopColor="#23415d" />
            <stop offset="100%" stopColor="#101f31" />
          </radialGradient>
          <filter id="fl-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="1600" height="900" fill="url(#fl-espace)" />

        {/* Champ d'étoiles */}
        <g fill="#cfe6f2">
          {ETOILES.map((e, i) => (
            <circle
              key={i}
              cx={e.x}
              cy={e.y}
              r={e.r}
              opacity={e.scintille ? 0.8 : 0.35}
              style={e.scintille ? { animation: `fondlogin-scintille 3.4s ease-in-out ${e.delai}s infinite` } : undefined}
            />
          ))}
        </g>

        {/* Orbites en perspective (précession très lente) */}
        <g
          fill="none"
          stroke="#249ccc"
          style={{ transformOrigin: '800px 560px', animation: 'fondlogin-precess 160s linear infinite' }}
        >
          <ellipse cx="800" cy="560" rx="590" ry="150" strokeOpacity="0.28" strokeWidth="1.5" />
          <ellipse cx="800" cy="560" rx="430" ry="108" strokeOpacity="0.2" strokeWidth="1.5" strokeDasharray="3 7" />
          <ellipse cx="800" cy="560" rx="760" ry="196" strokeOpacity="0.14" strokeWidth="1.5" />
        </g>

        {/* Limbe terrestre + atmosphère */}
        <circle cx="800" cy="1520" r="880" fill="url(#fl-terre2)" />
        <path
          d="M -80 705 A 880 880 0 0 1 1680 705"
          fill="none"
          stroke="#3fb4dd"
          strokeWidth="3"
          strokeOpacity="0.55"
          filter="url(#fl-glow)"
        />

        {/* Station au sol : pylône + balise + ondes de diffusion */}
        <g transform="translate(360 792)">
          <g fill="none" stroke="#3fb4dd" strokeWidth="2">
            <circle cx="0" cy="-52" r="6" style={{ animation: 'fondlogin-onde 4.2s ease-out infinite' }} />
            <circle cx="0" cy="-52" r="6" style={{ animation: 'fondlogin-onde 4.2s ease-out -1.4s infinite' }} />
            <circle cx="0" cy="-52" r="6" style={{ animation: 'fondlogin-onde 4.2s ease-out -2.8s infinite' }} />
          </g>
          <path d="M -11 0 L 11 0 L 4 -50 L -4 -50 Z" fill="#22405c" stroke="#3fb4dd" strokeWidth="1.5" />
          <line x1="-7" y1="-16" x2="7" y2="-16" stroke="#3fb4dd" strokeWidth="1.5" />
          <line x1="-9" y1="-33" x2="9" y2="-33" stroke="#3fb4dd" strokeWidth="1.5" />
          <circle cx="0" cy="-52" r="3.4" fill="#cc2430" style={{ animation: 'fondlogin-balise 2.2s ease-in-out infinite' }} />
        </g>

        {/* Satellite en orbite + faisceau de liaison descendante */}
        <g style={{ offsetPath: ORBITE_SAT, offsetRotate: '0deg', animation: 'fondlogin-orbite 30s linear infinite' }}>
          <g opacity="0.95">
            {/* panneaux solaires */}
            <g fill="#1f4e6b" stroke="#3fb4dd" strokeWidth="1">
              <rect x="-70" y="-13" width="42" height="26" />
              <rect x="28" y="-13" width="42" height="26" />
            </g>
            <line x1="-49" y1="-13" x2="-49" y2="13" stroke="#3fb4dd" strokeWidth="0.8" />
            <line x1="49" y1="-13" x2="49" y2="13" stroke="#3fb4dd" strokeWidth="0.8" />
            <line x1="-28" y1="0" x2="28" y2="0" stroke="#3fb4dd" strokeWidth="1" />
            {/* corps */}
            <rect x="-15" y="-17" width="30" height="34" rx="3" fill="#e9eff3" stroke="#22405c" strokeWidth="1.5" />
            <circle cx="0" cy="-17" r="2.6" fill="#cc2430" />
            {/* antenne parabolique */}
            <line x1="0" y1="17" x2="0" y2="24" stroke="#e9eff3" strokeWidth="1.5" />
            <ellipse cx="0" cy="27" rx="11" ry="5.5" fill="#3fb4dd" />
            {/* faisceau vers le sol */}
            <path d="M 0 27 L -34 150 L 34 150 Z" fill="#3fb4dd" opacity="0.12" />
            <circle cx="0" cy="30" r="4" fill="none" stroke="#8fd6ee" strokeWidth="1.5" style={{ animation: 'fondlogin-onde 3s ease-out infinite' }} />
            <circle cx="0" cy="30" r="4" fill="none" stroke="#8fd6ee" strokeWidth="1.5" style={{ animation: 'fondlogin-onde 3s ease-out -1.5s infinite' }} />
          </g>
        </g>

        {/* Étoile SNRT — balise centrale, rotation lente */}
        <image
          href="/brand/favicon.svg"
          x="670"
          y="300"
          width="260"
          height="260"
          opacity="0.07"
          style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'fondlogin-spin 48s linear infinite' }}
        />
      </svg>

      {/* Halo derrière la carte + vignette (hors SVG, pour rester net au redimensionnement) */}
      <div
        className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(36,156,204,0.18) 0%, transparent 62%)' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(92% 72% at 50% 46%, transparent 44%, rgba(10,18,30,0.55) 100%)' }}
      />
    </div>
  )
}
