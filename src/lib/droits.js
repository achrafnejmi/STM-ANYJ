// Contrôle des droits de diffusion (M6, P14a). Calcul pur, recalculé à
// chaque rendu — même famille que grilleType.js/anomalies.js.
//
// Décision "permissif" (validée) : un titre SANS aucune fenêtre de droits
// est considéré programmable par défaut — pas de régression sur le
// catalogue existant, qui n'a aucune fenêtre tant que personne n'en a
// saisi. Le blocage strict (RG-01/RG-03) ne s'active que si au moins une
// fenêtre existe pour ce titre et qu'aucune n'est valide à la date visée.

// RG-02 : le contrôle se fait à la date de DIFFUSION VISÉE (dateISO passé
// par l'appelant — la colonne jour d'antenne où on dépose/programme),
// jamais "aujourd'hui", sauf quand l'appelant le décide explicitement
// (ex. catalogue, qui utilise aujourdHuiISO() comme référence d'affichage).
export function estProgrammable(programmeId, fenetresDroits, dateISO) {
  const fenetresDuTitre = fenetresDroits.filter((f) => f.programme_id === programmeId)
  if (fenetresDuTitre.length === 0) return { ok: true, motif: null }

  // Fenêtre illimitée (retouche post-P29, production interne SNRT) : ni
  // échéance ni plafond de passages, toujours valide — court-circuite le
  // test date/passages ci-dessous.
  const valide = fenetresDuTitre.find(
    (f) => f.illimite || (dateISO >= f.date_debut && dateISO <= f.date_fin && f.passages_consommes < f.passages_autorises)
  )
  if (valide) return { ok: true, motif: null }

  const dansUneFenetre = fenetresDuTitre.some((f) => dateISO >= f.date_debut && dateISO <= f.date_fin)
  if (!dansUneFenetre) {
    return { ok: false, motif: `Hors fenêtre de droits à la date du ${dateISO}.` }
  }
  return { ok: false, motif: 'Passages autorisés épuisés.' }
}

// RG-07 : contrôle per-épisode, indépendant des droits du titre — un
// épisode précis peut être non prêt même si le titre a des droits valides.
export function estEpisodePret(episode) {
  return episode?.pad === true
}

// RG-04/EXG-M6-08 : fenêtre qui se referme dans moins de 45 jours, ou
// laissant moins de 5 passages — alerte non bloquante. Une fenêtre déjà
// expirée n'est pas "proche de la fermeture", elle est juste invalide
// (gérée séparément par estProgrammable).
function fenetreProcheDeLaFermeture(fenetre, dateISO) {
  // Une fenêtre illimitée n'a ni échéance ni plafond — jamais "proche de la
  // fermeture" par définition.
  if (fenetre.illimite) return false
  const joursRestants = (new Date(fenetre.date_fin) - new Date(dateISO)) / 86400000
  const passagesRestants = fenetre.passages_autorises - fenetre.passages_consommes
  return joursRestants >= 0 && (joursRestants < 45 || passagesRestants < 5)
}

export function fenetresProchesDeLaFermeture(fenetresDroits, dateISO) {
  return fenetresDroits.filter((f) => fenetreProcheDeLaFermeture(f, dateISO))
}
