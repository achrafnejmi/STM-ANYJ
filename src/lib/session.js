// Session (choix de rôle uniquement, pas d'identifiant/mot de passe).
// Passe uniquement par storage.js — aucun accès localStorage direct ici.

import { get, set, remove } from './storage.js'

const CLE_SESSION = 'session:role'
export const ROLES = ['PROGRAMMATION', 'DIGITAL']

export function lireRole() {
  return get(CLE_SESSION) ?? null
}

export function definirRole(role) {
  if (!ROLES.includes(role)) {
    throw new Error(`role invalide : ${role}`)
  }
  set(CLE_SESSION, role)
}

export function deconnecter() {
  remove(CLE_SESSION)
}
