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
// (ListeProgrammes) sans une requête par ligne.
export async function listerTousLesEpisodes() {
  return verifie(await supabase.from('episode').select('programme_id, derniere_diffusion'))
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

export async function mettreAJourDiffusionLineaire(id, champs) {
  return verifiePremiere(await supabase.from('diffusion_lineaire').update(champs).eq('id', id).select())
}

export async function supprimerDiffusionLineaire(id) {
  verifie(await supabase.from('diffusion_lineaire').delete().eq('id', id).select())
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
