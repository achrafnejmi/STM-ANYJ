// Génère les icônes de marque (favicons + touch icon + manifest icons) depuis
// la source unique design-reference (étoile SNRT multicolore, fond
// transparent). À relancer si la source change : `npm run brand:icons`.
//
// Après régénération, penser à incrémenter le `?v=N` sur les href/src qui
// référencent ces fichiers (index.html, public/brand/manifest.webmanifest) —
// le cache de favicon du navigateur est indexé par URL exacte, pas par
// contenu, donc un fichier changé sans URL changée reste caché à l'ancien.
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const SOURCE = 'design-reference/stm-existant/logo_favicon-removebg-preview.png'
const DOSSIER_SORTIE = 'public/brand'

const CIBLES = [
  ['favicon-16.png', 16],
  ['favicon-32.png', 32],
  ['favicon-48.png', 48],
  ['apple-touch-icon-180.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]

mkdirSync(DOSSIER_SORTIE, { recursive: true })

for (const [nom, taille] of CIBLES) {
  await sharp(SOURCE)
    .resize(taille, taille, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(`${DOSSIER_SORTIE}/${nom}`)
  console.log(`✓ ${DOSSIER_SORTIE}/${nom}`)
}
