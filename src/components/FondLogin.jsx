// Fond de l'écran de connexion (P31 — passe design). Purement décoratif :
// `aria-hidden`, `pointer-events-none`, aucune donnée. Parti pris : sobre et
// lisible — un dégradé navy calme, un sol 3D en perspective (seul élément
// réellement animé), un halo qui fait « flotter » la carte, et une grande
// étoile SNRT en filigrane. Rien de clignotant, rien qui parasite la lecture.
// Toutes les animations sont coupées si prefers-reduced-motion (index.css,
// sélecteur [data-fondlogin]).

export default function FondLogin() {
  return (
    <div data-fondlogin aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 1. Fond : dégradé navy vertical, clair en haut → sombre en bas */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, #2c4a68 0%, #243c54 42%, #1b2d41 78%, #16273a 100%)' }}
      />

      {/* 2. Deux voiles de couleur SNRT, diffus, cantonnés en haut pour ne pas
          salir le bas de l'image */}
      <div
        className="absolute -left-32 -top-40 h-[36rem] w-[36rem] rounded-full"
        style={{ background: 'var(--color-snrt-cyan)', opacity: 0.18, filter: 'blur(120px)' }}
      />
      <div
        className="absolute -right-40 -top-52 h-[40rem] w-[40rem] rounded-full"
        style={{ background: 'var(--color-snrt-blue)', opacity: 0.22, filter: 'blur(130px)' }}
      />

      {/* 3. Sol 3D en perspective — la grille cyan défile vers l'horizon.
          Masque radial (conteneur) + masque linéaire (grille) → aucun bord dur. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[52%]"
        style={{
          perspective: '640px',
          WebkitMaskImage: 'radial-gradient(120% 100% at 50% 100%, #000 45%, transparent 100%)',
          maskImage: 'radial-gradient(120% 100% at 50% 100%, #000 45%, transparent 100%)',
        }}
      >
        <div
          className="absolute inset-0 origin-bottom"
          style={{
            transform: 'rotateX(70deg)',
            backgroundImage:
              'linear-gradient(rgba(90,190,225,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(90,190,225,0.22) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            WebkitMaskImage: 'linear-gradient(to top, #000 0%, transparent 70%)',
            maskImage: 'linear-gradient(to top, #000 0%, transparent 70%)',
            animation: 'fondlogin-grille 7s linear infinite',
          }}
        />
      </div>

      {/* 4. Grande étoile SNRT en filigrane, rotation très lente sur l'axe Y */}
      <img
        src="/brand/favicon.svg"
        alt=""
        className="absolute left-1/2 top-[30%] w-72 -translate-x-1/2"
        style={{ opacity: 0.06, transformStyle: 'preserve-3d', animation: 'fondlogin-etoile-lente 40s linear infinite' }}
      />

      {/* 5. Halo doux derrière la carte : la fait ressortir du fond */}
      <div
        className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(36,156,204,0.20) 0%, transparent 62%)' }}
      />

      {/* 6. Vignette légère */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(90% 70% at 50% 45%, transparent 45%, rgba(12,21,33,0.5) 100%)' }}
      />
    </div>
  )
}
