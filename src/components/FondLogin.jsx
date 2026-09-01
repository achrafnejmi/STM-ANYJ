// Fond animé de l'écran de connexion (P31 — passe design). Purement
// décoratif : `aria-hidden`, `pointer-events-none`, aucune donnée. Rendu en
// transforms GPU only ; toutes les animations sont coupées si l'utilisateur a
// activé « prefers-reduced-motion » (voir index.css, sélecteur [data-fondlogin]).
//
// Couches, du fond vers l'avant :
//  1. dégradé radial navy → profondeur ;
//  2. orbes floutés aux couleurs SNRT (cyan / bleu / vert / rouge) en dérive lente ;
//  3. sol en perspective (grille cyan qui défile vers l'horizon) → sensation 3D ;
//  4. étoiles SNRT (favicon) flottantes qui pivotent sur l'axe Y ;
//  5. vignette pour concentrer le regard sur la carte de connexion.
function Orbe({ couleur, className, animation, opacite }) {
  return (
    <div
      className={`absolute rounded-full ${className}`}
      style={{ background: couleur, opacity: opacite, filter: 'blur(90px)', animation }}
    />
  )
}

function EtoileFlottante({ className, animation, animationDelay, opacite, lueur }) {
  return (
    <img
      src="/brand/favicon.svg"
      alt=""
      className={`absolute ${className}`}
      style={{
        opacity: opacite,
        transformStyle: 'preserve-3d',
        filter: lueur ? `drop-shadow(0 0 24px ${lueur})` : undefined,
        animation,
        animationDelay,
      }}
    />
  )
}

export default function FondLogin() {
  return (
    <div data-fondlogin aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(125% 125% at 50% 0%, #2f4d6c 0%, #243c54 45%, #1a2c40 100%)' }}
      />

      <Orbe
        couleur="var(--color-snrt-cyan)"
        opacite={0.4}
        className="-left-24 top-[22%] h-80 w-80"
        animation="fondlogin-orbe-a 19s ease-in-out infinite alternate"
      />
      <Orbe
        couleur="var(--color-snrt-blue)"
        opacite={0.32}
        className="-right-16 top-[6%] h-96 w-96"
        animation="fondlogin-orbe-b 23s ease-in-out infinite alternate"
      />
      <Orbe
        couleur="var(--color-snrt-green)"
        opacite={0.24}
        className="bottom-[-14%] left-1/3 h-80 w-80"
        animation="fondlogin-orbe-c 21s ease-in-out infinite alternate"
      />
      <Orbe
        couleur="var(--color-snrt-red)"
        opacite={0.2}
        className="bottom-[4%] right-1/4 h-56 w-56"
        animation="fondlogin-orbe-a 17s ease-in-out infinite alternate-reverse"
      />

      {/* Sol 3D en perspective */}
      <div
        className="absolute inset-x-0 bottom-0 h-[55%]"
        style={{
          perspective: '520px',
          WebkitMaskImage: 'linear-gradient(to top, #000 6%, transparent 84%)',
          maskImage: 'linear-gradient(to top, #000 6%, transparent 84%)',
        }}
      >
        <div
          className="absolute inset-0 origin-bottom"
          style={{
            transform: 'rotateX(66deg)',
            backgroundImage:
              'linear-gradient(rgba(36,156,204,0.30) 1px, transparent 1px), linear-gradient(90deg, rgba(36,156,204,0.30) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            animation: 'fondlogin-grille 6s linear infinite',
          }}
        />
      </div>

      <EtoileFlottante
        className="left-[12%] top-[18%] w-16"
        opacite={0.28}
        lueur="rgba(36,156,204,0.55)"
        animation="fondlogin-etoile 15s ease-in-out infinite"
      />
      <EtoileFlottante
        className="right-[15%] top-[28%] w-10"
        opacite={0.2}
        animation="fondlogin-etoile 19s ease-in-out infinite reverse"
        animationDelay="-4s"
      />
      <EtoileFlottante
        className="left-[24%] bottom-[24%] w-12"
        opacite={0.16}
        animation="fondlogin-etoile 23s ease-in-out infinite"
        animationDelay="-9s"
      />

      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(80% 60% at 50% 45%, transparent 38%, rgba(14,24,37,0.58) 100%)' }}
      />
    </div>
  )
}
