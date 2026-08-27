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

// Scoping par chaîne active (M1, P9) — filtre par chaine_id (FK, migration-p9).
// P22 : chaine_id NULL = programme partagé par toutes les chaînes, fusionné
// avec les exclusifs à cette chaîne — même pattern .or() que
// listerSpotsBibliotheque (P16b), un simple .eq() ne peut pas exprimer
// « cette chaîne OU aucune chaîne » sur la même colonne.
export async function listerProgrammesParChaine(chaineId) {
  return verifie(
    await supabase.from('programme').select('*').or(`chaine_id.eq.${chaineId},chaine_id.is.null`).order('titre')
  )
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

// --- grille (P23) : plusieurs grilles nommées par chaîne, une seule live ---

export async function listerGrillesParChaine(chaineId) {
  return verifie(await supabase.from('grille').select('*').eq('chaine_id', chaineId).order('cree_le'))
}

export async function obtenirGrilleLiveParChaine(chaineId) {
  return verifie(
    await supabase.from('grille').select('*').eq('chaine_id', chaineId).eq('est_live', true).maybeSingle()
  )
}

export async function creerGrille(champs) {
  return verifiePremiere(await supabase.from('grille').insert(champs).select())
}

export async function mettreAJourGrille(id, champs) {
  return verifiePremiere(await supabase.from('grille').update(champs).eq('id', id).select())
}

export async function supprimerGrille(id) {
  verifie(await supabase.from('grille').delete().eq('id', id).select())
}

// Bascule la grille live d'une chaîne : désactive l'ancienne puis active la
// cible (2 updates séquentiels, pas de transaction atomique côté client
// Supabase — acceptable pour un PoC mono-utilisateur ; l'ordre évite de
// violer l'index unique partiel grille_chaine_live_unique).
export async function definirGrilleLive(chaineId, grilleId) {
  verifie(await supabase.from('grille').update({ est_live: false }).eq('chaine_id', chaineId).eq('est_live', true))
  return verifiePremiere(await supabase.from('grille').update({ est_live: true }).eq('id', grilleId).select())
}

// --- diffusion_lineaire ---

export async function listerDiffusionsLineaires() {
  return verifie(await supabase.from('diffusion_lineaire').select('*').order('date').order('heure_debut'))
}

// P23 : reste volontairement la vue "toutes les grilles de la chaîne" — c'est
// ce dont GrilleLineaire.jsx a besoin pour afficher plusieurs onglets à la
// fois (filtrage par grille_id fait côté client, même pattern que le
// filtrage par date déjà en place).
export async function listerDiffusionsLineairesParChaine(chaineId) {
  return verifie(
    await supabase.from('diffusion_lineaire').select('*').eq('chaine_id', chaineId).order('date').order('heure_debut')
  )
}

// P23 : vue restreinte à UNE grille — utilisée par les écrans qui ne doivent
// voir que la grille live d'une chaîne (Conducteur, Accueil, Plan média,
// Auto-programmation).
export async function listerDiffusionsLineairesParGrille(grilleId) {
  return verifie(
    await supabase.from('diffusion_lineaire').select('*').eq('grille_id', grilleId).order('date').order('heure_debut')
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
// voir droits.js/autoprog.js) de la grille cible sur la période visée, avant
// réinsertion des nouvelles propositions confirmées. P23 : grilleId ajouté
// (la grille cible de l'auto-programmation est choisie par l'utilisateur,
// pas figée sur la live — voir AutoProgrammation.jsx).
export async function supprimerDiffusionsLineairesAutomatiquesParPeriode(chaineId, dateDebut, dateFin, grilleId) {
  return verifie(
    await supabase
      .from('diffusion_lineaire')
      .delete()
      .eq('chaine_id', chaineId)
      .eq('grille_id', grilleId)
      .eq('origine', 'AUTOMATIQUE')
      .gte('date', dateDebut)
      .lte('date', dateFin)
      .select()
  )
}

// --- publication_reseau (Grille non-linéaire, hors cahier, P20) ---

export async function listerPublicationsReseauParChaine(chaineId) {
  return verifie(
    await supabase.from('publication_reseau').select('*').eq('chaine_id', chaineId).order('date_publication')
  )
}

export async function creerPublicationReseau(champs) {
  return verifiePremiere(await supabase.from('publication_reseau').insert(champs).select())
}

export async function mettreAJourPublicationReseau(id, champs) {
  return verifiePremiere(await supabase.from('publication_reseau').update(champs).eq('id', id).select())
}

export async function supprimerPublicationReseau(id) {
  verifie(await supabase.from('publication_reseau').delete().eq('id', id).select())
}

// --- publication_vod (Grille non-linéaire, hors cahier, P20) ---

export async function listerPublicationsVodParChaine(chaineId) {
  return verifie(await supabase.from('publication_vod').select('*').eq('chaine_id', chaineId).order('date_publication'))
}

export async function creerPublicationVod(champs) {
  return verifiePremiere(await supabase.from('publication_vod').insert(champs).select())
}

export async function mettreAJourPublicationVod(id, champs) {
  return verifiePremiere(await supabase.from('publication_vod').update(champs).eq('id', id).select())
}

export async function supprimerPublicationVod(id) {
  verifie(await supabase.from('publication_vod').delete().eq('id', id).select())
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

export async function listerBlocsGrilleTypeParGrilleType(grilleTypeId) {
  return verifie(
    await supabase.from('bloc_grille_type').select('*').eq('grille_type_id', grilleTypeId).order('heure_debut')
  )
}

// Bulk (P28, dupliquerGrilleType) — même précédent que creerDiffusionsLineaires/creerElementsSecondaires.
export async function creerBlocsGrilleType(lignes) {
  return verifie(await supabase.from('bloc_grille_type').insert(lignes).select())
}

// --- grille_type (multi-documents + gabarits saisonniers, P28) ---

export async function listerGrillesTypeParChaine(chaineId) {
  return verifie(await supabase.from('grille_type').select('*').eq('chaine_id', chaineId).order('cree_le'))
}

export async function obtenirGrilleTypeLiveParChaine(chaineId) {
  return verifie(
    await supabase.from('grille_type').select('*').eq('chaine_id', chaineId).eq('est_live', true).maybeSingle()
  )
}

export async function creerGrilleType(champs) {
  return verifiePremiere(await supabase.from('grille_type').insert(champs).select())
}

export async function mettreAJourGrilleType(id, champs) {
  return verifiePremiere(await supabase.from('grille_type').update(champs).eq('id', id).select())
}

export async function supprimerGrilleType(id) {
  verifie(await supabase.from('grille_type').delete().eq('id', id).select())
}

export async function definirGrilleTypeLive(chaineId, grilleTypeId) {
  verifie(await supabase.from('grille_type').update({ est_live: false }).eq('chaine_id', chaineId).eq('est_live', true))
  return verifiePremiere(await supabase.from('grille_type').update({ est_live: true }).eq('id', grilleTypeId).select())
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

// --- plan_media (P24) : plusieurs plans média nommés par chaîne, un seul live ---

export async function listerPlanMediaParChaine(chaineId) {
  return verifie(await supabase.from('plan_media').select('*').eq('chaine_id', chaineId).order('cree_le'))
}

export async function obtenirPlanMediaLiveParChaine(chaineId) {
  return verifie(
    await supabase.from('plan_media').select('*').eq('chaine_id', chaineId).eq('est_live', true).maybeSingle()
  )
}

export async function creerPlanMedia(champs) {
  return verifiePremiere(await supabase.from('plan_media').insert(champs).select())
}

export async function mettreAJourPlanMedia(id, champs) {
  return verifiePremiere(await supabase.from('plan_media').update(champs).eq('id', id).select())
}

export async function supprimerPlanMedia(id) {
  verifie(await supabase.from('plan_media').delete().eq('id', id).select())
}

// Bascule le plan média live d'une chaîne — même mécanique que
// definirGrilleLive (P23) : 2 updates séquentiels, pas de transaction
// atomique côté client Supabase, acceptable pour un PoC mono-utilisateur.
export async function definirPlanMediaLive(chaineId, planMediaId) {
  verifie(await supabase.from('plan_media').update({ est_live: false }).eq('chaine_id', chaineId).eq('est_live', true))
  return verifiePremiere(await supabase.from('plan_media').update({ est_live: true }).eq('id', planMediaId).select())
}

// --- element_secondaire (M5, P16) ---

// Bulk, non filtré par date : RG-M5-01/02/03 portent sur tout l'historique de
// la chaîne (diffusion à venir, maximum journalier, séparation), jamais
// seulement la fenêtre affichée à l'écran — même précédent que
// listerDiffusionsLineairesParChaine, déjà utilisé ainsi par autoprog.js.
// P24 : reste volontairement la vue "tous les plans média de la chaîne" —
// c'est ce dont PlanMedia.jsx a besoin pour afficher plusieurs onglets à la
// fois (filtrage par plan_media_id fait côté client).
export async function listerElementsSecondairesParChaine(chaineId) {
  return verifie(
    await supabase.from('element_secondaire').select('*').eq('chaine_id', chaineId).order('date').order('heure_debut')
  )
}

// P24 : vue restreinte à UN plan média — utilisée par les écrans qui ne
// doivent voir que le plan média live d'une chaîne (Conducteur, Accueil).
export async function listerElementsSecondairesParPlanMedia(planMediaId) {
  return verifie(
    await supabase
      .from('element_secondaire')
      .select('*')
      .eq('plan_media_id', planMediaId)
      .order('date')
      .order('heure_debut')
  )
}

export async function obtenirElementSecondaire(id) {
  return verifie(await supabase.from('element_secondaire').select('*').eq('id', id).maybeSingle())
}

export async function creerElementsSecondaires(lignes) {
  return verifie(await supabase.from('element_secondaire').insert(lignes).select())
}

// EXG-M5-06 : suppression unitaire d'un élément généré, sans attendre le
// Conducteur (P17) qui offrira la même action depuis son propre écran.
export async function supprimerElementSecondaire(id) {
  verifie(await supabase.from('element_secondaire').delete().eq('id', id).select())
}

// P24 : ajoutée pour compléter la forme {obtenir, creer, mettreAJour,
// supprimer} exigée par le TABLES map d'undoManager.js — aucune opération de
// cette phase ne produit de type UPDATE sur cette table, mais la forme est
// nécessaire pour l'intégrer au système d'annuler/rétablir.
export async function mettreAJourElementSecondaire(id, champs) {
  return verifiePremiere(await supabase.from('element_secondaire').update(champs).eq('id', id).select())
}

// EXG-M5-02/RG-16 (même mécanisme que M4) : annulation en une opération de
// tout ce qu'un run a créé.
export async function supprimerElementsSecondairesParRun(runId) {
  return verifie(await supabase.from('element_secondaire').delete().eq('run_id', runId).select())
}

// RG-M5-06 : contrairement à son équivalent M4, cette suppression est
// INCONDITIONNELLE — pas de case « Écraser », chaque génération recalcule
// systématiquement les éléments AUTOMATIQUE de la période, jamais les
// MANUELLE. P24 : planMediaId ajouté — la génération cible le document
// actuellement ouvert dans Plan média, pas systématiquement le live.
export async function supprimerElementsSecondairesAutomatiquesParPeriode(chaineId, dateDebut, dateFin, planMediaId) {
  return verifie(
    await supabase
      .from('element_secondaire')
      .delete()
      .eq('chaine_id', chaineId)
      .eq('plan_media_id', planMediaId)
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

// P24 : deux écrans ont désormais leur propre colonne de document sur
// historique_action (grille_id, plan_media_id) — GRILLE_TYPE n'en a aucune
// (une seule pile par chaîne, comportement inchangé depuis P19b).
const COLONNE_DOCUMENT_PAR_ECRAN = {
  GRILLE_LINEAIRE: 'grille_id',
  PLAN_MEDIA: 'plan_media_id',
}

// Table de taille PoC — une seule lecture par écran+chaîne, tri/filtrage
// ACTIVE/ANNULEE fait côté undoManager.js (même précédent que
// listerToutesLesFenetresDroits/listerTousLesEpisodes). documentId optionnel
// — filtre en plus par grille/plan média pour les écrans qui ont plusieurs
// documents ouverts en parallèle (une pile annuler/rétablir par document) ;
// GRILLE_TYPE continue de l'omettre, comportement inchangé.
export async function listerHistoriqueActionsParChaineEcran(chaineId, ecran, documentId = null) {
  let requete = supabase.from('historique_action').select('*').eq('chaine_id', chaineId).eq('ecran', ecran)
  const colonne = COLONNE_DOCUMENT_PAR_ECRAN[ecran]
  if (documentId && colonne) requete = requete.eq(colonne, documentId)
  return verifie(await requete.order('cree_le', { ascending: false }))
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
// documentId optionnel, même règle que listerHistoriqueActionsParChaineEcran.
export async function perimerActionsAnnulees(chaineId, ecran, documentId = null) {
  let requete = supabase
    .from('historique_action')
    .update({ statut: 'PERIMEE' })
    .eq('chaine_id', chaineId)
    .eq('ecran', ecran)
    .eq('statut', 'ANNULEE')
  const colonne = COLONNE_DOCUMENT_PAR_ECRAN[ecran]
  if (documentId && colonne) requete = requete.eq(colonne, documentId)
  return verifie(await requete.select())
}

// --- notification (P29 : centre de notifications persistant, lu/non lu par chaîne) ---

export async function listerNotificationsParChaine(chaineId) {
  return verifie(await supabase.from('notification').select('*').eq('chaine_id', chaineId).order('cree_le', { ascending: false }))
}

// Insertion en lot (fan-out NOUVEAU_PROGRAMME sur les chaînes visées, ou lignes
// DROITS_PROCHES manquantes) — même précédent que creerBlocsGrilleType.
export async function creerNotifications(lignes) {
  return verifie(await supabase.from('notification').insert(lignes).select())
}

export async function marquerNotificationLue(id) {
  return verifiePremiere(await supabase.from('notification').update({ lu: true }).eq('id', id).select())
}

export async function marquerToutesNotificationsLues(chaineId) {
  return verifie(await supabase.from('notification').update({ lu: true }).eq('chaine_id', chaineId).eq('lu', false).select())
}

// --- utilisateur (retouche post-P29 : rôles Administrateur/Utilisateur) ---

// Upsert best-effort (jamais d'écrasement d'un rôle déjà attribué :
// ignoreDuplicates fait que la ligne existante n'est pas touchée), puis
// relecture pour renvoyer le rôle réel (nouveau ou déjà en place — ex.
// l'admin amorcé par la migration).
export async function obtenirOuCreerUtilisateur(nom) {
  const { error } = await supabase.from('utilisateur').upsert({ nom_utilisateur: nom }, { onConflict: 'nom_utilisateur', ignoreDuplicates: true })
  if (error) throw error
  return verifie(await supabase.from('utilisateur').select('*').eq('nom_utilisateur', nom).maybeSingle())
}

export async function listerUtilisateurs() {
  return verifie(await supabase.from('utilisateur').select('*').order('nom_utilisateur'))
}

export async function mettreAJourRoleUtilisateur(nom, role) {
  return verifiePremiere(await supabase.from('utilisateur').update({ role }).eq('nom_utilisateur', nom).select())
}
