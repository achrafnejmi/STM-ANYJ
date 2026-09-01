// Interface générique clé-valeur, seul point d'accès à la persistance
// (remplaçable par une vraie API STM plus tard — CLAUDE.md). Ne connaît rien
// du domaine (Offre/Notification) : les clés lui sont fournies telles quelles.

const backend = (() => {
  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage
  }
  // Fallback mémoire (Node / vérifications headless, pas de localStorage) :
  // ré-implémente la forme minimale de l'API Web Storage.
  const memoire = new Map()
  return {
    getItem: (cle) => (memoire.has(cle) ? memoire.get(cle) : null),
    setItem: (cle, valeur) => {
      memoire.set(cle, valeur)
    },
    removeItem: (cle) => {
      memoire.delete(cle)
    },
    key: (i) => Array.from(memoire.keys())[i] ?? null,
    get length() {
      return memoire.size
    },
  }
})()

export function set(cle, valeur) {
  backend.setItem(cle, JSON.stringify(valeur))
}

export function get(cle) {
  const brut = backend.getItem(cle)
  return brut == null ? undefined : JSON.parse(brut)
}

export function remove(cle) {
  backend.removeItem(cle)
}

export function list(prefixe) {
  const resultats = []
  for (let i = 0; i < backend.length; i++) {
    const cle = backend.key(i)
    if (cle && cle.startsWith(prefixe)) resultats.push(get(cle))
  }
  return resultats
}
