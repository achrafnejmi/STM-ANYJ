import { supprimerDiffusionLineaire } from './db.js'
import { enregistrerAction } from './undoManager.js'
import { formaterDateLongue } from './semaine.js'

// Chemin unique de déprogrammation d'une diffusion (P11 inspecteur + P21 Lot B
// X de la grille) : confirmation, suppression, puis alimentation de la pile
// annuler/rétablir (P19b). Ne gère pas l'affichage d'erreur — chaque appelant
// a son propre état local et attrape l'exception (même convention que le
// reste de l'app). `confirmer` = NotificationProvider.useNotification().confirmer
// (P21 Lot G) — injecté plutôt qu'importé : ce fichier n'est pas un composant,
// il ne peut pas appeler un hook lui-même.
export async function deprogrammerDiffusion(diffusion, { chaineActive, grilleId, onSupprime, confirmer }) {
  const confirme = await confirmer({
    titre: 'Déprogrammer',
    message: `Déprogrammer « ${diffusion.titre_cache} » (${diffusion.heure_debut}) du ${formaterDateLongue(diffusion.date)} ?`,
    labelConfirmer: 'Déprogrammer',
  })
  if (!confirme) return false
  await supprimerDiffusionLineaire(diffusion.id)
  await enregistrerAction({
    chaineId: chaineActive.id,
    ecran: 'GRILLE_LINEAIRE',
    grilleId,
    libelle: `Déprogrammation : ${diffusion.titre_cache}`,
    operations: [{ table: 'diffusion_lineaire', type: 'DELETE', id: diffusion.id, avant: diffusion }],
  })
  onSupprime(diffusion.id)
  return true
}
