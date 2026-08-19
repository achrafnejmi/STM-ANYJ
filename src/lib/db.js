// Seul point d'accès aux données métier (CLAUDE.md). Les écrans ne parlent
// jamais à Supabase en direct — tout passe par ce module.

import { supabase } from './supabaseClient.js'

function verifie({ data, error }) {
  if (error) throw error
  return data
}

// Pour insert/update : .single() exige exactement 1 ligne en relecture et lève
// si 0 ou plusieurs reviennent (ex. "Cannot coerce the result to a single JSON
// object") — une écriture qui a réussi ne doit jamais échouer à cause de sa
// seule relecture. .select() (sans .single()) renvoie un tableau, jamais
// d'exception sur le nombre de lignes ; on prend la première.
function verifiePremiere({ data, error }) {
  if (error) throw error
  return data[0]
}

// --- programme ---

export async function listerProgrammes() {
  return verifie(await supabase.from('programme').select('*').order('titre'))
}

export async function obtenirProgramme(id) {
  return verifie(await supabase.from('programme').select('*').eq('id', id).maybeSingle())
}

export async function creerProgramme(champs) {
  return verifiePremiere(await supabase.from('programme').insert(champs).select())
}

export async function mettreAJourProgramme(id, champs) {
  return verifiePremiere(await supabase.from('programme').update(champs).eq('id', id).select())
}

export async function supprimerProgramme(id) {
  verifie(await supabase.from('programme').delete().eq('id', id).select())
}

// Scoping par chaîne active (M1, P9) — filtre par chaine_id (FK, migration-p9),
// pas par le texte libre chaine.
export async function listerProgrammesParChaine(chaineId) {
  return verifie(await supabase.from('programme').select('*').eq('chaine_id', chaineId).order('titre'))
}

// --- attestation (Supabase Storage, bucket "attestations" — migration-p7.sql) ---

export async function televerserAttestation(programmeId, fichier) {
  const chemin = `${programmeId}/${fichier.name}`
  verifie(await supabase.storage.from('attestations').upload(chemin, fichier, { upsert: true }))
  return chemin
}

export async function supprimerAttestation(chemin) {
  verifie(await supabase.storage.from('attestations').remove([chemin]))
}

export function urlAttestation(chemin) {
  return supabase.storage.from('attestations').getPublicUrl(chemin).data.publicUrl
}

// --- episode ---

export async function listerEpisodes(programmeId) {
  return verifie(await supabase.from('episode').select('*').eq('programme_id', programmeId).order('numero'))
}

export async function obtenirEpisode(id) {
  return verifie(await supabase.from('episode').select('*').eq('id', id).maybeSingle())
}

export async function creerEpisode(champs) {
  return verifiePremiere(await supabase.from('episode').insert(champs).select())
}

export async function mettreAJourEpisode(id, champs) {
  return verifiePremiere(await supabase.from('episode').update(champs).eq('id', id).select())
}

export async function supprimerEpisode(id) {
  verifie(await supabase.from('episode').delete().eq('id', id).select())
}

// Pour agréger nb épisodes / dernière diffusion par programme dans la liste
// (ListeProgrammes) sans une requête par ligne. `id`/`pad` servent aussi au
// centre d'anomalies (P12, RG-08 : détecter un épisode programmé dont le
// support n'est plus prêt à diffuser). `titre`/`titre_ar` servent à la
// recherche multilingue (EXG-M6-02, P14b). `numero`/`duree` servent à la
// rotation séquentielle et au dimensionnement des créneaux de
// l'auto-programmation (autoprog.js, P15).
export async function listerTousLesEpisodes() {
  return verifie(
    await supabase.from('episode').select('id, programme_id, pad, derniere_diffusion, titre, titre_ar, numero, duree')
  )
}

// --- diffusion_lineaire ---

export async function listerDiffusionsLineaires() {
  return verifie(await supabase.from('diffusion_lineaire').select('*').order('date').order('heure_debut'))
}

export async function listerDiffusionsLineairesParChaine(chaineId) {
  return verifie(
    await supabase.from('diffusion_lineaire').select('*').eq('chaine_id', chaineId).order('date').order('heure_debut')
  )
}

// Historique (approximation, P10) : diffusion_lineaire passées d'un programme,
// pas un constat d'antenne réel (aucune table "Diffusion constatée" n'existe
// encore — voir migration-p10.sql). Utilisée par PopoverHistorique et par le
// calcul de "dernière diffusion" par épisode dans CataloguePanel.
export async function listerDiffusionsLineairesParProgramme(programmeId) {
  return verifie(
    await supabase
      .from('diffusion_lineaire')
      .select('*')
      .eq('programme_id', programmeId)
      .order('date', { ascending: false })
      .order('heure_debut', { ascending: false })
  )
}

export async function obtenirDiffusionLineaire(id) {
  return verifie(await supabase.from('diffusion_lineaire').select('*').eq('id', id).maybeSingle())
}

export async function creerDiffusionLineaire(champs) {
  return verifiePremiere(await supabase.from('diffusion_lineaire').insert(champs).select())
}

// Insert en lot (P11, onglet Répéter) : une seule requête réseau pour créer
// plusieurs transmissions d'un coup — renvoie le tableau complet des lignes
// créées (nécessaire pour l'annulation locale par id juste après application).
export async function creerDiffusionsLineaires(lignes) {
  return verifie(await supabase.from('diffusion_lineaire').insert(lignes).select())
}

export async function mettreAJourDiffusionLineaire(id, champs) {
  return verifiePremiere(await supabase.from('diffusion_lineaire').update(champs).eq('id', id).select())
}

export async function supprimerDiffusionLineaire(id) {
  verifie(await supabase.from('diffusion_lineaire').delete().eq('id', id).select())
}

// --- auto-programmation (M4, P15) ---

// EXG-M4-02/RG-16 : annulation en une seule opération de tout ce qu'un run a
// créé — suppression en lot par run_id plutôt que la boucle par id de
// l'onglet Répéter (P11), puisque run_id existe justement pour ça.
export async function supprimerDiffusionsLineairesParRun(runId) {
  return verifie(await supabase.from('diffusion_lineaire').delete().eq('run_id', runId).select())
}

// Mode « Écraser » : supprime les diffusions AUTOMATIQUE (jamais MANUELLE,
// voir droits.js/autoprog.js) de la chaîne sur la période visée, avant
// réinsertion des nouvelles propositions confirmées.
export async function supprimerDiffusionsLineairesAutomatiquesParPeriode(chaineId, dateDebut, dateFin) {
  return verifie(
    await supabase
      .from('diffusion_lineaire')
      .delete()
      .eq('chaine_id', chaineId)
      .eq('origine', 'AUTOMATIQUE')
      .gte('date', dateDebut)
      .lte('date', dateFin)
      .select()
  )
}

// --- diffusion_non_lineaire --- (CRUD prêt pour P9, rien ne l'appelle encore)

export async function listerDiffusionsNonLineaires() {
  return verifie(await supabase.from('diffusion_non_lineaire').select('*').order('date_publication'))
}

export async function obtenirDiffusionNonLineaire(id) {
  return verifie(await supabase.from('diffusion_non_lineaire').select('*').eq('id', id).maybeSingle())
}

export async function creerDiffusionNonLineaire(champs) {
  return verifiePremiere(await supabase.from('diffusion_non_lineaire').insert(champs).select())
}

export async function mettreAJourDiffusionNonLineaire(id, champs) {
  return verifiePremiere(await supabase.from('diffusion_non_lineaire').update(champs).eq('id', id).select())
}

export async function supprimerDiffusionNonLineaire(id) {
  verifie(await supabase.from('diffusion_non_lineaire').delete().eq('id', id).select())
}

// --- bloc_grille_type (M3, P13) ---

export async function listerBlocsGrilleTypeParChaine(chaineId) {
  return verifie(
    await supabase.from('bloc_grille_type').select('*').eq('chaine_id', chaineId).order('heure_debut')
  )
}

export async function obtenirBlocGrilleType(id) {
  return verifie(await supabase.from('bloc_grille_type').select('*').eq('id', id).maybeSingle())
}

export async function creerBlocGrilleType(champs) {
  return verifiePremiere(await supabase.from('bloc_grille_type').insert(champs).select())
}

export async function mettreAJourBlocGrilleType(id, champs) {
  return verifiePremiere(await supabase.from('bloc_grille_type').update(champs).eq('id', id).select())
}

export async function supprimerBlocGrilleType(id) {
  verifie(await supabase.from('bloc_grille_type').delete().eq('id', id).select())
}

// --- fenetre_droits (M6, P14a) ---

export async function listerFenetresDroitsParProgramme(programmeId) {
  return verifie(
    await supabase.from('fenetre_droits').select('*').eq('programme_id', programmeId).order('date_debut')
  )
}

// Bulk, même précédent que listerTousLesEpisodes() : table de taille PoC,
// filtrage client-side (par programme_id, déjà chargés et scopés par chaîne)
// plutôt qu'une jointure PostgREST sur programme.chaine_id.
export async function listerToutesLesFenetresDroits() {
  return verifie(await supabase.from('fenetre_droits').select('*'))
}

export async function creerFenetreDroits(champs) {
  return verifiePremiere(await supabase.from('fenetre_droits').insert(champs).select())
}

export async function mettreAJourFenetreDroits(id, champs) {
  return verifiePremiere(await supabase.from('fenetre_droits').update(champs).eq('id', id).select())
}

export async function supprimerFenetreDroits(id) {
  verifie(await supabase.from('fenetre_droits').delete().eq('id', id).select())
}

// --- campagne (M5, P16) ---

export async function listerCampagnesParChaine(chaineId) {
  return verifie(await supabase.from('campagne').select('*').eq('chaine_id', chaineId).order('date_debut'))
}

export async function creerCampagne(champs) {
  return verifiePremiere(await supabase.from('campagne').insert(champs).select())
}

export async function mettreAJourCampagne(id, champs) {
  return verifiePremiere(await supabase.from('campagne').update(champs).eq('id', id).select())
}

export async function supprimerCampagne(id) {
  verifie(await supabase.from('campagne').delete().eq('id', id).select())
}

// --- element_secondaire (M5, P16) ---

// Bulk, non filtré par date : RG-M5-01/02/03 portent sur tout l'historique de
// la chaîne (diffusion à venir, maximum journalier, séparation), jamais
// seulement la fenêtre affichée à l'écran — même précédent que
// listerDiffusionsLineairesParChaine, déjà utilisé ainsi par autoprog.js.
export async function listerElementsSecondairesParChaine(chaineId) {
  return verifie(
    await supabase.from('element_secondaire').select('*').eq('chaine_id', chaineId).order('date').order('heure_debut')
  )
}

export async function creerElementsSecondaires(lignes) {
  return verifie(await supabase.from('element_secondaire').insert(lignes).select())
}

// EXG-M5-06 : suppression unitaire d'un élément généré, sans attendre le
// Conducteur (P17) qui offrira la même action depuis son propre écran.
export async function supprimerElementSecondaire(id) {
  verifie(await supabase.from('element_secondaire').delete().eq('id', id).select())
}

// EXG-M5-02/RG-16 (même mécanisme que M4) : annulation en une opération de
// tout ce qu'un run a créé.
export async function supprimerElementsSecondairesParRun(runId) {
  return verifie(await supabase.from('element_secondaire').delete().eq('run_id', runId).select())
}

// RG-M5-06 : contrairement à son équivalent M4, cette suppression est
// INCONDITIONNELLE — pas de case « Écraser », chaque génération recalcule
// systématiquement les éléments AUTOMATIQUE de la période, jamais les MANUELLE.
export async function supprimerElementsSecondairesAutomatiquesParPeriode(chaineId, dateDebut, dateFin) {
  return verifie(
    await supabase
      .from('element_secondaire')
      .delete()
      .eq('chaine_id', chaineId)
      .eq('origine', 'AUTOMATIQUE')
      .gte('date', dateDebut)
      .lte('date', dateFin)
      .select()
  )
}

// Insertion manuelle dans une coupure (P16b) : singulier, mirroir de
// creerElementsSecondaires (bulk, moteur auto) — même coexistence que
// creerDiffusionLineaire/creerDiffusionsLineaires.
export async function creerElementSecondaire(champs) {
  return verifiePremiere(await supabase.from('element_secondaire').insert(champs).select())
}

// --- spot_bibliotheque (P16b) ---

// Fusionne bibliothèque globale (chaine_id NULL) et propre à la chaîne —
// première utilisation de .or() dans ce fichier : un simple .eq() ne peut
// pas exprimer « cette chaîne OU aucune chaîne » sur la même colonne.
export async function listerSpotsBibliotheque(chaineId) {
  return verifie(
    await supabase.from('spot_bibliotheque').select('*').or(`chaine_id.eq.${chaineId},chaine_id.is.null`).order('libelle')
  )
}

export async function creerSpotBibliotheque(champs) {
  return verifiePremiere(await supabase.from('spot_bibliotheque').insert(champs).select())
}

export async function mettreAJourSpotBibliotheque(id, champs) {
  return verifiePremiere(await supabase.from('spot_bibliotheque').update(champs).eq('id', id).select())
}

export async function supprimerSpotBibliotheque(id) {
  verifie(await supabase.from('spot_bibliotheque').delete().eq('id', id).select())
}

// --- genre (M0/Administration, P19a) ---

export async function listerGenres() {
  return verifie(await supabase.from('genre').select('*').order('ordre'))
}

export async function creerGenre(champs) {
  return verifiePremiere(await supabase.from('genre').insert(champs).select())
}

export async function mettreAJourGenre(id, champs) {
  return verifiePremiere(await supabase.from('genre').update(champs).eq('id', id).select())
}

export async function supprimerGenre(id) {
  verifie(await supabase.from('genre').delete().eq('id', id).select())
}

// Garde-fou avant renommage/suppression (P19a) : combien de programmes
// portent aujourd'hui ce libellé — .select avec count/head:true ne rapatrie
// aucune ligne, juste le nombre.
export async function compterProgrammesParGenre(libelleFr) {
  const { count, error } = await supabase
    .from('programme')
    .select('id', { count: 'exact', head: true })
    .eq('genre', libelleFr)
  if (error) throw error
  return count ?? 0
}

// --- tranche_antenne (M5/Administration, P19a) ---

export async function listerTranchesAntenne() {
  return verifie(await supabase.from('tranche_antenne').select('*').order('ordre'))
}

export async function creerTrancheAntenne(champs) {
  return verifiePremiere(await supabase.from('tranche_antenne').insert(champs).select())
}

export async function mettreAJourTrancheAntenne(id, champs) {
  return verifiePremiere(await supabase.from('tranche_antenne').update(champs).eq('id', id).select())
}

export async function supprimerTrancheAntenne(id) {
  verifie(await supabase.from('tranche_antenne').delete().eq('id', id).select())
}

// Garde-fou avant renommage/suppression (P19a) : combien de campagnes ciblent
// aujourd'hui ce code de tranche (campagne.tranches_ciblees, tableau de codes,
// P16) — .contains() teste l'appartenance au tableau côté PostgREST.
export async function compterCampagnesParTranche(code) {
  const { count, error } = await supabase
    .from('campagne')
    .select('id', { count: 'exact', head: true })
    .contains('tranches_ciblees', [code])
  if (error) throw error
  return count ?? 0
}

// --- historique_action (Undo/Rollback ciblé, P19b) ---

// Table de taille PoC — une seule lecture par écran+chaîne, tri/filtrage
// ACTIVE/ANNULEE fait côté undoManager.js (même précédent que
// listerToutesLesFenetresDroits/listerTousLesEpisodes).
export async function listerHistoriqueActionsParChaineEcran(chaineId, ecran) {
  return verifie(
    await supabase
      .from('historique_action')
      .select('*')
      .eq('chaine_id', chaineId)
      .eq('ecran', ecran)
      .order('cree_le', { ascending: false })
  )
}

export async function creerHistoriqueAction(champs) {
  return verifiePremiere(await supabase.from('historique_action').insert(champs).select())
}

export async function mettreAJourHistoriqueAction(id, champs) {
  return verifiePremiere(await supabase.from('historique_action').update(champs).eq('id', id).select())
}

// Périme la pile de rétablissement d'un écran+chaîne — appelé avant toute
// nouvelle action réelle (pas un Annuler/Rétablir), sémantique undo/redo
// standard : une nouvelle branche d'historique invalide le redo en attente.
export async function perimerActionsAnnulees(chaineId, ecran) {
  return verifie(
    await supabase
      .from('historique_action')
      .update({ statut: 'PERIMEE' })
      .eq('chaine_id', chaineId)
      .eq('ecran', ecran)
      .eq('statut', 'ANNULEE')
      .select()
  )
}
