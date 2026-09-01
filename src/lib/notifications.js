// Centre de notifications (P29) — deux déclencheurs, deux mécaniques :
// - NOUVEAU_PROGRAMME : événement ponctuel, écrit UNE fois au moment de la
//   création (voir FicheProgramme.jsx), jamais recalculé ici.
// - DROITS_PROCHES : une CONDITION qui devient vraie progressivement (une
//   fenêtre de droits qui franchit le seuil RG-04 un jour donné) — pas de
//   geste utilisateur associé, donc pas de point d'écriture ponctuel côté
//   appli. Réconciliée au chargement (App.jsx) : comparer les fenêtres
//   actuellement proches de la fermeture (fenetresProchesDeLaFermeture,
//   droits.js — AUCUNE formule dupliquée ici) aux notifications déjà
//   connues, et ne créer que celles qui manquent (l'index unique sur
//   fenetre_droits_id est un filet de sécurité, pas le mécanisme principal
//   de dédoublonnage).
import { fenetresProchesDeLaFermeture } from './droits.js'

export function messageNouveauProgramme(programme) {
  return `Nouveau programme catalogué : « ${programme.titre} »`
}

export function messageDroitsProches(titreProgramme, fenetre) {
  const passagesRestants = Math.max(0, fenetre.passages_autorises - fenetre.passages_consommes)
  return `« ${titreProgramme} » — fenêtre de droits ferme le ${fenetre.date_fin} (${passagesRestants} passage${passagesRestants > 1 ? 's' : ''} restant${passagesRestants > 1 ? 's' : ''})`
}

// Lignes DROITS_PROCHES manquantes pour une chaîne : fenêtres actuellement
// proches de la fermeture qui n'ont pas encore de notification existante
// (notificationsExistantes = déjà chargées par l'appelant, App.jsx).
export function calculerNotificationsDroitsManquantes({ chaineId, fenetresDroits, programmesParId, notificationsExistantes, dateReference }) {
  const idsExistants = new Set(
    notificationsExistantes.filter((n) => n.type === 'DROITS_PROCHES').map((n) => n.fenetre_droits_id)
  )
  return fenetresProchesDeLaFermeture(fenetresDroits, dateReference)
    .filter((f) => programmesParId.has(f.programme_id) && !idsExistants.has(f.id))
    .map((f) => ({
      chaine_id: chaineId,
      type: 'DROITS_PROCHES',
      programme_id: f.programme_id,
      fenetre_droits_id: f.id,
      message: messageDroitsProches(programmesParId.get(f.programme_id).titre, f),
      lu: false,
    }))
}
