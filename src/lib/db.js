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

export async function trouverProgrammeParTitreEtChaine(titre, chaine) {
  return verifie(
    await supabase.from('programme').select('*').eq('titre', titre).eq('chaine', chaine).maybeSingle()
  )
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

// --- segment --- (CRUD prêt pour P7, rien ne l'appelle encore)

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

// --- diffusion_lineaire ---

export async function listerDiffusionsLineaires() {
  return verifie(await supabase.from('diffusion_lineaire').select('*').order('date').order('heure_debut'))
}

export async function obtenirDiffusionLineaire(id) {
  return verifie(await supabase.from('diffusion_lineaire').select('*').eq('id', id).maybeSingle())
}

export async function creerDiffusionLineaire(champs) {
  return verifie(await supabase.from('diffusion_lineaire').insert(champs).select().single())
}

export async function creerDiffusionsLineaires(lignes) {
  return verifie(await supabase.from('diffusion_lineaire').insert(lignes).select())
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
