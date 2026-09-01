// Fond de l'écran de connexion (P31 — passe design). Scène 3D « broadcasting »
// aux couleurs SNRT : espace navy, limbe terrestre avec halo d'atmosphère,
// orbites en perspective, un satellite qui tourne et émet un faisceau, une
// station au sol qui pulse, un champ d'étoiles, et l'étoile SNRT en balise.
// Purement décoratif : aria-hidden, pointer-events-none, aucune donnée.
// Toutes les animations sont coupées si prefers-reduced-motion (voir index.css,
// sélecteur [data-fondlogin]).

// Trajectoires elliptiques (coordonnées viewBox) — reprises par offset-path.
const ORBITE_SAT = 'path("M 210 560 a 590 150 0 1 0 1180 0 a 590 150 0 1 0 -1180 0")'
const ORBITE_SAT2 = 'path("M 40 560 a 760 196 0 1 0 1520 0 a 760 196 0 1 0 -1520 0")'

// Champ d'étoiles fixe (positions pseudo-aléatoires mais déterministes).
const ETOILES = Array.from({ length: 150 }, (_, i) => {
  const x = (i * 149.3 + (i % 11) * 13) % 1600
  const y = (i * 83.7 + (i % 7) * 37) % 660
  const r = 0.3 + ((i * 53) % 100) / 95
  const scintille = i % 9 === 0
  return { x, y, r, scintille, delai: -(i % 5) * 0.9 }
})

// Réseau de lumières au sol sur le limbe terrestre (villes) — plusieurs bandes
// de rayons, avec des « trous » (océans) pour un rendu de continent éclairé.
const VILLES = Array.from({ length: 170 }, (_, i) => {
  if ((i * 53) % 19 < 5) return null // ~1/4 sans lumière
  const a = -1.32 + (i / 169) * 2.64
  const rr = 806 + ((i * 61) % 3) * 19 + ((i * 29) % 15)
  const hub = i % 17 === 0
  return {
    x: 800 + rr * Math.cos(a),
    y: 1520 + rr * Math.sin(a),
    r: hub ? 2 : (i % 5 === 0 ? 1.5 : 1),
    fill: hub ? '#ffe7bb' : '#ffd9a0',
    opacity: 0.28 + ((i * 17) % 52) / 100,
    scintille: i % 4 === 0,
    delai: -(i % 9) * 0.4,
  }
}).filter(Boolean)

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
          <radialGradient id="fl-terre2" cx="50%" cy="-8%" r="92%">
            <stop offset="0%" stopColor="#325a7d" />
            <stop offset="55%" stopColor="#294c6a" />
            <stop offset="100%" stopColor="#22415f" />
          </radialGradient>
          <filter id="fl-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="fl-flou" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <radialGradient id="fl-nebuleuse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3a6fa8" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#2a4f86" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2a4f86" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fl-aurore" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#00a374" stopOpacity="0.32" />
            <stop offset="60%" stopColor="#249ccc" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#249ccc" stopOpacity="0" />
          </linearGradient>
          <clipPath id="fl-terre-clip">
            <circle cx="800" cy="1520" r="876" />
          </clipPath>
        </defs>

        <rect width="1600" height="900" fill="url(#fl-espace)" />

        {/* Nébuleuses lointaines — profondeur */}
        <ellipse cx="300" cy="330" rx="440" ry="260" fill="url(#fl-nebuleuse)" />
        <ellipse cx="1180" cy="250" rx="360" ry="200" fill="url(#fl-nebuleuse)" opacity="0.6" />
        <ellipse cx="1440" cy="130" rx="300" ry="150" fill="url(#fl-nebuleuse)" opacity="0.45" />

        {/* Galaxie spirale très lointaine (haut-gauche) */}
        <g transform="translate(210 150) rotate(-18)" opacity="0.5" style={{ transformOrigin: '210px 150px', animation: 'fondlogin-spin 120s linear infinite' }}>
          <ellipse rx="120" ry="34" fill="url(#fl-nebuleuse)" />
          <ellipse rx="66" ry="20" fill="#cfe6f2" opacity="0.10" />
          <circle r="4" fill="#eaf3fa" opacity="0.5" />
        </g>

        {/* Comète — tête + traîne, dérive lente (remplace la lune) */}
        <g style={{ animation: 'fondlogin-comete 26s ease-in-out infinite' }}>
          <path d="M 1478 96 C 1560 70 1636 58 1712 40 C 1642 78 1566 104 1490 122 Z" fill="#bfe0ef" opacity="0.20" />
          <circle cx="1480" cy="104" r="4.5" fill="#eef7fc" filter="url(#fl-glow)" />
        </g>

        {/* Étoiles filantes (rares) */}
        <g stroke="#cfe6f2" strokeWidth="2" strokeLinecap="round">
          <line x1="120" y1="90" x2="150" y2="102" style={{ animation: 'fondlogin-filante 11s ease-in -3s infinite' }} />
          <line x1="980" y1="60" x2="1010" y2="74" style={{ animation: 'fondlogin-filante 14s ease-in -9s infinite' }} />
          <line x1="1240" y1="470" x2="1276" y2="452" style={{ animation: 'fondlogin-filante 17s ease-in -6s infinite' }} />
        </g>

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

        {/* Constellations — motif « réseau de diffusion » */}
        <g stroke="#8fd6ee" strokeWidth="0.8" strokeOpacity="0.32" fill="#dff1f9">
          <polyline points="1180,110 1276,168 1352,120 1436,196 1392,286" fill="none" />
          <polyline points="1276,168 1330,250" fill="none" />
          {[
            [1180, 110],
            [1276, 168],
            [1352, 120],
            [1436, 196],
            [1392, 286],
            [1330, 250],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2" style={{ animation: `fondlogin-scintille 4s ease-in-out ${-i * 0.7}s infinite` }} />
          ))}
          <polyline points="150,300 236,352 210,452 320,470 300,560" fill="none" />
          {[
            [150, 300],
            [236, 352],
            [210, 452],
            [320, 470],
            [300, 560],
          ].map(([x, y], i) => (
            <circle key={`b${i}`} cx={x} cy={y} r="1.8" style={{ animation: `fondlogin-scintille 4.6s ease-in-out ${-i * 0.9}s infinite` }} />
          ))}
          <polyline points="640,140 700,96 792,132 760,214" fill="none" />
          {[
            [640, 140],
            [700, 96],
            [792, 132],
            [760, 214],
          ].map(([x, y], i) => (
            <circle key={`c${i}`} cx={x} cy={y} r="1.8" style={{ animation: `fondlogin-scintille 5s ease-in-out ${-i * 1.1}s infinite` }} />
          ))}
        </g>

        {/* Orbites en perspective (précession très lente) + satellites de données */}
        <g
          fill="none"
          stroke="#249ccc"
          style={{ transformOrigin: '800px 560px', animation: 'fondlogin-precess 160s linear infinite' }}
        >
          <ellipse cx="800" cy="560" rx="590" ry="150" strokeOpacity="0.28" strokeWidth="1.5" />
          <ellipse cx="800" cy="560" rx="430" ry="108" strokeOpacity="0.2" strokeWidth="1.5" strokeDasharray="3 7" />
          <ellipse cx="800" cy="560" rx="760" ry="196" strokeOpacity="0.14" strokeWidth="1.5" />
          <ellipse cx="800" cy="560" rx="300" ry="76" strokeOpacity="0.16" strokeWidth="1.2" strokeDasharray="2 8" />
        </g>
        {/* Paquets qui circulent sur les orbites */}
        <circle r="2.4" fill="#bfe9f7" style={{ offsetPath: "path('M 500 560 a 300 76 0 1 0 600 0 a 300 76 0 1 0 -600 0')", animation: 'fondlogin-orbite 12s linear infinite' }} />
        <circle r="2" fill="#8fd6ee" style={{ offsetPath: ORBITE_SAT, animation: 'fondlogin-orbite 22s linear -8s infinite' }} />
        <circle r="2" fill="#8fd6ee" style={{ offsetPath: ORBITE_SAT2, animation: 'fondlogin-orbite 34s linear -14s infinite reverse' }} />

        {/* Limbe terrestre + atmosphère */}
        <circle cx="800" cy="1520" r="880" fill="url(#fl-terre2)" />

        {/* Détails du globe : méridiens/parallèles, nuages, réseau de villes */}
        <g clipPath="url(#fl-terre-clip)">
          <g fill="none" stroke="#3fb4dd" strokeOpacity="0.12" strokeWidth="1.4">
            <circle cx="800" cy="1520" r="812" />
            <circle cx="800" cy="1520" r="742" />
            <circle cx="800" cy="1520" r="660" />
            <ellipse cx="800" cy="1520" rx="300" ry="876" />
            <ellipse cx="800" cy="1520" rx="560" ry="876" />
            <ellipse cx="800" cy="1520" rx="770" ry="876" />
          </g>
          {/* nuages */}
          <g fill="#dfeef5" opacity="0.10" filter="url(#fl-flou)">
            <ellipse cx="520" cy="678" rx="150" ry="26" />
            <ellipse cx="980" cy="700" rx="190" ry="30" />
            <ellipse cx="1230" cy="676" rx="120" ry="22" />
          </g>
          {/* réseau de villes (lumières au sol) */}
          <g>
            {VILLES.map((v, i) => (
              <circle
                key={i}
                cx={v.x}
                cy={v.y}
                r={v.r}
                fill={v.fill}
                opacity={v.opacity}
                style={v.scintille ? { animation: `fondlogin-scintille 3.8s ease-in-out ${v.delai}s infinite` } : undefined}
              />
            ))}
          </g>
        </g>

        {/* Aurore au-dessus de l'horizon */}
        <path
          d="M -60 690 C 380 636 620 664 800 650 C 1010 634 1250 664 1660 636 L 1660 736 L -60 736 Z"
          fill="url(#fl-aurore)"
          style={{ transformOrigin: '800px 700px', animation: 'fondlogin-aurore 14s ease-in-out infinite' }}
        />

        <path
          d="M -80 705 A 880 880 0 0 1 1680 705"
          fill="none"
          stroke="#3fb4dd"
          strokeWidth="3"
          strokeOpacity="0.55"
          filter="url(#fl-glow)"
        />

        {/* Liaison sol-sol le long de l'horizon + paquets de données */}
        <path id="fl-lien-sol" d="M 360 742 Q 800 700 1230 748" fill="none" stroke="#3fb4dd" strokeOpacity="0.28" strokeWidth="1.2" strokeDasharray="3 9" />
        <circle r="2.6" fill="#bfe9f7" style={{ offsetPath: "path('M 360 742 Q 800 700 1230 748')", animation: 'fondlogin-orbite 6s linear infinite' }} />
        <circle r="2.2" fill="#bfe9f7" style={{ offsetPath: "path('M 360 742 Q 800 700 1230 748')", animation: 'fondlogin-orbite 6s linear -3s infinite' }} />

        {/* Station au sol : pylône + balise + ondes + radar + empreinte */}
        <g transform="translate(360 792)">
          {/* empreinte de couverture au sol */}
          <ellipse
            cx="0"
            cy="6"
            rx="118"
            ry="30"
            fill="none"
            stroke="#3fb4dd"
            strokeOpacity="0.22"
            style={{ animation: 'fondlogin-balise 5s ease-in-out infinite' }}
          />
          {/* balayage radar */}
          <g style={{ transformOrigin: '0px -52px', animation: 'fondlogin-radar 7s linear infinite' }}>
            <path d="M 0 -52 L 96 -78 A 100 100 0 0 1 96 -26 Z" fill="#3fb4dd" opacity="0.10" />
          </g>
          <g fill="none" stroke="#3fb4dd" strokeWidth="2">
            <circle cx="0" cy="-52" r="6" style={{ animation: 'fondlogin-onde 4.2s ease-out infinite' }} />
            <circle cx="0" cy="-52" r="6" style={{ animation: 'fondlogin-onde 4.2s ease-out -1.4s infinite' }} />
            <circle cx="0" cy="-52" r="6" style={{ animation: 'fondlogin-onde 4.2s ease-out -2.8s infinite' }} />
          </g>
          <path d="M -11 0 L 11 0 L 4 -50 L -4 -50 Z" fill="#22405c" stroke="#3fb4dd" strokeWidth="1.5" />
          <line x1="-7" y1="-16" x2="7" y2="-16" stroke="#3fb4dd" strokeWidth="1.5" />
          <line x1="-9" y1="-33" x2="9" y2="-33" stroke="#3fb4dd" strokeWidth="1.5" />
          <circle cx="0" cy="-52" r="3.4" fill="#cc2430" style={{ animation: 'fondlogin-balise 2.2s ease-in-out infinite' }} />
          {/* Liaison montante (flux de données) + paquet */}
          <line
            x1="6"
            y1="-50"
            x2="150"
            y2="-150"
            stroke="#3fb4dd"
            strokeWidth="1.4"
            strokeOpacity="0.5"
            strokeDasharray="2 8"
            style={{ animation: 'fondlogin-flux 1.4s linear infinite' }}
          />
          <circle r="2.4" fill="#eaf8fe" style={{ offsetPath: "path('M 6 -50 L 150 -150')", animation: 'fondlogin-orbite 1.9s linear infinite' }} />
          {/* petite parabole d'appoint */}
          <g transform="translate(26 -6) rotate(-24)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="#3fb4dd" strokeWidth="1.4" />
            <path d="M -8 -3 A 9 9 0 0 1 8 -3 Z" fill="#22405c" stroke="#3fb4dd" strokeWidth="1.2" />
          </g>
        </g>

        {/* Seconde station au sol, à droite, avec grappe de paraboles */}
        <g transform="translate(1230 812) scale(0.82)">
          <ellipse cx="0" cy="6" rx="128" ry="32" fill="none" stroke="#3fb4dd" strokeOpacity="0.2" style={{ animation: 'fondlogin-balise 5.6s ease-in-out -1s infinite' }} />
          <g fill="none" stroke="#3fb4dd" strokeWidth="2">
            <circle cx="0" cy="-52" r="6" style={{ animation: 'fondlogin-onde 4.6s ease-out -0.6s infinite' }} />
            <circle cx="0" cy="-52" r="6" style={{ animation: 'fondlogin-onde 4.6s ease-out -2.1s infinite' }} />
            <circle cx="0" cy="-52" r="6" style={{ animation: 'fondlogin-onde 4.6s ease-out -3.6s infinite' }} />
          </g>
          <path d="M -11 0 L 11 0 L 4 -50 L -4 -50 Z" fill="#22405c" stroke="#3fb4dd" strokeWidth="1.5" />
          <line x1="-8" y1="-24" x2="8" y2="-24" stroke="#3fb4dd" strokeWidth="1.5" />
          <circle cx="0" cy="-52" r="3.4" fill="#cc2430" style={{ animation: 'fondlogin-balise 2.6s ease-in-out -0.7s infinite' }} />
          {/* grappe de paraboles */}
          {[
            [-46, 4, -28],
            [-24, 8, -16],
            [40, 6, 20],
          ].map(([tx, ty, rot], i) => (
            <g key={i} transform={`translate(${tx} ${ty}) rotate(${rot})`}>
              <line x1="0" y1="0" x2="0" y2="10" stroke="#3fb4dd" strokeWidth="1.6" />
              <path d="M -11 -4 A 12 12 0 0 1 11 -4 Z" fill="#22405c" stroke="#3fb4dd" strokeWidth="1.4" />
            </g>
          ))}
        </g>

        {/* Second satellite — orbite externe, sens inverse, plus petit */}
        <g style={{ offsetPath: ORBITE_SAT2, offsetRotate: '0deg', animation: 'fondlogin-orbite 46s linear infinite reverse' }}>
          <g opacity="0.7" transform="scale(0.68)">
            <g fill="#1f4e6b" stroke="#3fb4dd" strokeWidth="1">
              <rect x="-64" y="-11" width="38" height="22" />
              <rect x="26" y="-11" width="38" height="22" />
            </g>
            <line x1="-24" y1="0" x2="24" y2="0" stroke="#3fb4dd" strokeWidth="1" />
            <rect x="-13" y="-14" width="26" height="28" rx="3" fill="#dfe8ee" stroke="#22405c" strokeWidth="1.5" />
            <circle cx="0" cy="-14" r="2.2" fill="#cc2430" />
            <ellipse cx="0" cy="22" rx="9" ry="4.5" fill="#3fb4dd" />
          </g>
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
        style={{ background: 'radial-gradient(115% 85% at 50% 34%, transparent 62%, rgba(16,28,44,0.24) 100%)' }}
      />
      {/* Remontée de bleu sur toute la moitié basse — supprime la bande sombre
          sous l'horizon (harmonise avec le bleu du milieu de scène) */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: 'linear-gradient(to top, rgba(46,82,114,0.55) 0%, rgba(46,82,114,0.18) 45%, transparent 100%)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-28"
        style={{ background: 'linear-gradient(to top, rgba(63,180,221,0.10), transparent)' }}
      />
    </div>
  )
}
