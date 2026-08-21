import { supprimerDiffusionLineaire } from './db.js'
import { enregistrerAction } from './undoManager.js'
import { formaterDateLongue } from './semaine.js'

// Chemin unique de déprogrammation d'une diffusion (P11 inspecteur + P21 Lot B
// X de la grille) : confirmation, suppression, puis alimentation de la pile
// annuler/rétablir (P19b). Ne gère pas l'affichage d'erreur — chaque appelant
// a son propre état local et attrape l'exception (même convention que le
// reste de l'app).
export async function deprogrammerDiffusion(diffusion, { chaineActive, onSupprime }) {
  const confirme = window.confirm(
    `Déprogrammer « ${diffusion.titre_cache} » (${diffusion.heure_debut}) du ${formaterDateLongue(diffusion.date)} ?`
  )
  if (!confirme) return false
  await supprimerDiffusionLineaire(diffusion.id)
  await enregistrerAction({
    chaineId: chaineActive.id,
    ecran: 'GRILLE_LINEAIRE',
    libelle: `Déprogrammation : ${diffusion.titre_cache}`,
    operations: [{ table: 'diffusion_lineaire', type: 'DELETE', id: diffusion.id, avant: diffusion }],
  })
  onSupprime(diffusion.id)
  return true
}
