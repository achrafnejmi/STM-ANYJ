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

// PUBLICATION_NON_LINEAIRE (P35c) : événement ponctuel écrit au moment où une
// publication réseaux sociaux / VOD passe à PUBLIÉ (PanneauPublication.jsx).
export function messagePublicationNonLineaire(titreProgramme, plateforme) {
  return `« ${titreProgramme} » publié en non-linéaire${plateforme ? ` sur ${plateforme}` : ''}`
}

// Circuit PAD (P36), événements ponctuels routés par rôle (destinataire_role) :
// DEMANDE_PAD / RELANCE_PAD → Contrôle PAD ; DECISION_PAD → Gestion des droits
// et du stock.
function etiquetteEpisode(titreProgramme, numeroEp) {
  return `« ${titreProgramme} »${numeroEp != null ? ` — ÉP. ${numeroEp}` : ''}`
}

export function messageDemandePad(titreProgramme, numeroEp) {
  return `${etiquetteEpisode(titreProgramme, numeroEp)} : demande de validation PAD`
}

export function messageRelancePad(titreProgramme, numeroEp, nbRelances) {
  return `${etiquetteEpisode(titreProgramme, numeroEp)} : relance n°${nbRelances} pour la validation PAD`
}

export function messageDecisionPad(titreProgramme, numeroEp, statut) {
  return `${etiquetteEpisode(titreProgramme, numeroEp)} : validation PAD ${statut === 'ACCEPTEE' ? 'acceptée' : 'refusée'}`
}

// Circuit « demande de programmation » d'un titre exclusif (P37), routé par rôle :
// A_TRANSMETTRE → Admin de la chaîne demandeuse ; SOUMISE → Admin de la chaîne
// détentrice ; DECISION → Admin demandeur (ou Programmateur si rejet interne).
export function messageDemandeProgAT(titreProgramme, chaineDemandeuse) {
  return `« ${titreProgramme} » — demande de programmation de ${chaineDemandeuse} à transmettre`
}

export function messageDemandeProgSoumise(titreProgramme, chaineDemandeuse) {
  return `« ${titreProgramme} » — ${chaineDemandeuse} demande à programmer ce titre exclusif`
}

export function messageDemandeProgDecision(titreProgramme, statut) {
  const issue =
    statut === 'ACCEPTEE' ? 'approuvée' : statut === 'REJETEE_INTERNE' ? 'non transmise' : 'refusée'
  return `« ${titreProgramme} » — demande de programmation ${issue}`
}

// Cible d'un clic sur une notification (P36) : section(s) « source » par ordre de
// préférence. L'appelant (App.jsx) navigue vers la première que le rôle courant
// peut voir ; si aucune (ou type absent d'ici), il ouvre la fiche du programme
// référencé. Rend le routage cohérent pour TOUT le système de notifications.
export const SECTIONS_CIBLE_NOTIFICATION = {
  DEMANDE_PAD: ['CONTROLE_PAD', 'SUIVI_PAD'],
  RELANCE_PAD: ['CONTROLE_PAD', 'SUIVI_PAD'],
  DECISION_PAD: ['SUIVI_PAD', 'CONTROLE_PAD'],
  PUBLICATION_NON_LINEAIRE: ['GRILLE_NON_LINEAIRE'],
  DEMANDE_PROG_A_TRANSMETTRE: ['DEMANDES_PROGRAMMATION'],
  DEMANDE_PROG_SOUMISE: ['DEMANDES_PROGRAMMATION'],
  DEMANDE_PROG_DECISION: ['DEMANDES_PROGRAMMATION'],
  // NOUVEAU_PROGRAMME / DROITS_PROCHES : pas de section dédiée → ouverture de la
  // fiche programme (onglet Droits pour une alerte de fin de droits). Idem si le
  // rôle ne voit pas la section cible (ex. Programmateur → rejet interne).
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
