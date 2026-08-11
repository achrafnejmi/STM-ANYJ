// Seul point d'accès aux données métier (CLAUDE.md). Les écrans ne parlent
// jamais à Supabase en direct — tout passe par ce module.

import { supabase } from './supabaseClient.js'

function verifie({ data, error }) {
  if (error) throw error
  return data
}

// --- programme ---

export async function listerProgrammes() {
  return verifie(await supabase.from('programme').select('*').order('titre'))
}

export async function obtenirProgramme(id) {
  return verifie(await supabase.from('programme').select('*').eq('id', id).maybeSingle())
}

export async function creerProgramme(champs) {
  return verifie(await supabase.from('programme').insert(champs).select().single())
}

export async function mettreAJourProgramme(id, champs) {
  return verifie(await supabase.from('programme').update(champs).eq('id', id).select().single())
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

// --- segment ---

export async function listerSegments(programmeId) {
  return verifie(await supabase.from('segment').select('*').eq('programme_id', programmeId).order('numero'))
}

export async function obtenirSegment(id) {
  return verifie(await supabase.from('segment').select('*').eq('id', id).maybeSingle())
}

export async function creerSegment(champs) {
  return verifie(await supabase.from('segment').insert(champs).select().single())
}

export async function mettreAJourSegment(id, champs) {
  return verifie(await supabase.from('segment').update(champs).eq('id', id).select().single())
}

export async function supprimerSegment(id) {
  verifie(await supabase.from('segment').delete().eq('id', id).select())
}

// Pour agréger nb segments / dernière diffusion par programme dans la liste
// (ListeProgrammes) sans une requête par ligne.
export async function listerTousLesSegments() {
  return verifie(await supabase.from('segment').select('programme_id, derniere_diffusion'))
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

export async function obtenirDiffusionLineaire(id) {
  return verifie(await supabase.from('diffusion_lineaire').select('*').eq('id', id).maybeSingle())
}

export async function creerDiffusionLineaire(champs) {
  return verifie(await supabase.from('diffusion_lineaire').insert(champs).select().single())
}

export async function mettreAJourDiffusionLineaire(id, champs) {
  return verifie(await supabase.from('diffusion_lineaire').update(champs).eq('id', id).select().single())
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
  return verifie(await supabase.from('diffusion_non_lineaire').insert(champs).select().single())
}

export async function mettreAJourDiffusionNonLineaire(id, champs) {
  return verifie(await supabase.from('diffusion_non_lineaire').update(champs).eq('id', id).select().single())
}

export async function supprimerDiffusionNonLineaire(id) {
  verifie(await supabase.from('diffusion_non_lineaire').delete().eq('id', id).select())
}
