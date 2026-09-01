// Session : accès simple (nom d'utilisateur libre, pas de mot de passe).
// Passe uniquement par storage.js — aucun accès localStorage direct ici.

import { get, set, remove } from './storage.js'

const CLE_SESSION = 'session:utilisateur'

export function lireUtilisateur() {
  return get(CLE_SESSION) ?? null
}

export function connecter(nom) {
  if (!nom || !nom.trim()) {
    throw new Error("Le nom d'utilisateur est requis.")
  }
  set(CLE_SESSION, nom.trim())
}

export function deconnecter() {
  remove(CLE_SESSION)
}
