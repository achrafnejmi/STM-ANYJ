// Undo/Rollback ciblé (Grille linéaire + Grille type, P19b). Pas une fonction
// pure comme droits.js/anomalies.js : ce module parle à Supabase via db.js
// (qui reste "le seul accès données métier", CLAUDE.md) — une fine couche
// d'orchestration au-dessus.
//
// Principe : chaque écran garde son écriture db.js actuelle (simple ou en
// lot) INCHANGÉE, puis appelle enregistrerAction(...) une seule fois avec le
// tableau d'opérations déjà résolu — une action composée (répéter, scission
// vecteur, confirmation auto-prog) devient ainsi UNE seule entrée
// d'historique, annulée/rétablie comme un bloc atomique.
import {
  listerHistoriqueActionsParChaineEcran,
  creerHistoriqueAction,
  mettreAJourHistoriqueAction,
  perimerActionsAnnulees,
  obtenirDiffusionLineaire,
  creerDiffusionLineaire,
  mettreAJourDiffusionLineaire,
  supprimerDiffusionLineaire,
  obtenirBlocGrilleType,
  creerBlocGrilleType,
  mettreAJourBlocGrilleType,
  supprimerBlocGrilleType,
  obtenirElementSecondaire,
  creerElementSecondaire,
  mettreAJourElementSecondaire,
  supprimerElementSecondaire,
} from './db.js'
import { lireUtilisateur } from './session.js'

const TABLES = {
  diffusion_lineaire: {
    obtenir: obtenirDiffusionLineaire,
    creer: creerDiffusionLineaire,
    mettreAJour: mettreAJourDiffusionLineaire,
    supprimer: supprimerDiffusionLineaire,
  },
  bloc_grille_type: {
    obtenir: obtenirBlocGrilleType,
    creer: creerBlocGrilleType,
    mettreAJour: mettreAJourBlocGrilleType,
    supprimer: supprimerBlocGrilleType,
  },
  element_secondaire: {
    obtenir: obtenirElementSecondaire,
    creer: creerElementSecondaire,
    mettreAJour: mettreAJourElementSecondaire,
    supprimer: supprimerElementSecondaire,
  },
}

// P24/P28 : quelle colonne de historique_action porte l'id de document pour
// un écran donné — GRILLE_LINEAIRE, PLAN_MEDIA et GRILLE_TYPE ont chacun la
// leur (plusieurs documents ouverts en parallèle, une pile par document).
const COLONNE_DOCUMENT_PAR_ECRAN = {
  GRILLE_LINEAIRE: 'grille_id',
  PLAN_MEDIA: 'plan_media_id',
  GRILLE_TYPE: 'grille_type_id',
}

// Enregistre une action déjà exécutée par l'appelant comme une seule entrée
// d'historique — périme d'abord la pile de rétablissement de cet écran+chaîne
// (nouvelle branche = redo invalidé, sémantique undo/redo standard).
// operations: [{ table, type:'INSERT'|'UPDATE'|'DELETE', id, avant?, apres? }]
// documentId optionnel (P23 : grille ouverte ; P24 : plan média ouvert) —
// GRILLE_TYPE l'omet, comportement inchangé (une seule pile par chaîne).
export async function enregistrerAction({ chaineId, ecran, documentId = null, libelle, operations }) {
  await perimerActionsAnnulees(chaineId, ecran, documentId)
  const colonne = COLONNE_DOCUMENT_PAR_ECRAN[ecran]
  return creerHistoriqueAction({
    chaine_id: chaineId,
    ecran,
    ...(colonne ? { [colonne]: documentId } : {}),
    statut: 'ACTIVE',
    libelle,
    operations,
    cree_par: lireUtilisateur(),
  })
}

// Une seule lecture, tri/filtrage ACTIVE/ANNULEE côté client — table de
// taille PoC, même précédent que listerToutesLesFenetresDroits/listerTousLesEpisodes.
// L'entrée ANNULEE la plus récente est déterminée par `annule_le` (quand elle
// a été défaite), PAS par `cree_le` (quand elle a été créée) : ces deux ordres
// divergent dès le 2e Annuler consécutif — voir migration-p19b.sql.
async function obtenirEtatPileInterne(chaineId, ecran, documentId = null) {
  const lignes = await listerHistoriqueActionsParChaineEcran(chaineId, ecran, documentId)
  const active = lignes.find((l) => l.statut === 'ACTIVE') ?? null
  const annulees = lignes
    .filter((l) => l.statut === 'ANNULEE')
    .sort((a, b) => (b.annule_le ?? '').localeCompare(a.annule_le ?? ''))
  return { active, annulee: annulees[0] ?? null }
}

export async function etatPile(chaineId, ecran, documentId = null) {
  const { active, annulee } = await obtenirEtatPileInterne(chaineId, ecran, documentId)
  return {
    peutAnnuler: !!active,
    libelleAnnuler: active?.libelle ?? null,
    entreeActiveId: active?.id ?? null,
    peutRetablir: !!annulee,
    libelleRetablir: annulee?.libelle ?? null,
  }
}

// Comparaison superficielle par clé (jamais de comparaison d'objet entière en
// une seule chaîne) — les deux côtés proviennent systématiquement de lectures
// db.js (jamais reconstruits à la main), donc les mêmes clés dans le même
// format (ex. heure_debut en "HH:MM:SS" si la colonne est de type time).
function memeContenu(a, b) {
  const cles = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const cle of cles) {
    if (JSON.stringify(a[cle]) !== JSON.stringify(b[cle])) return false
  }
  return true
}

// `etatAttendu` = ce que la base DOIT contenir maintenant pour que l'inverse
// de cette opération soit sûr (null = la ligne ne doit plus exister).
async function verifierEtatActuel(op, etatAttendu) {
  const ligneActuelle = await TABLES[op.table].obtenir(op.id)
  if (etatAttendu === null) return ligneActuelle === null
  if (ligneActuelle === null) return false
  return memeContenu(ligneActuelle, etatAttendu)
}

// Annule l'entrée ACTIVE la plus récente de cet écran+chaîne. Vérification
// COMPLÈTE d'abord, écriture ensuite : si une seule opération de l'entrée a
// divergé depuis, TOUTE l'entrée est refusée (une action composée s'annule en
// bloc ou pas du tout — jamais la moitié d'une scission), sans propagation
// vers d'autres entrées de la pile.
export async function annulerDerniereAction(chaineId, ecran, documentId = null) {
  const { active } = await obtenirEtatPileInterne(chaineId, ecran, documentId)
  if (!active) return { ok: false, motif: 'Rien à annuler.' }

  const operations = [...active.operations].reverse()
  for (const op of operations) {
    const valide = await verifierEtatActuel(op, op.type === 'DELETE' ? null : op.apres)
    if (!valide) {
      return {
        ok: false,
        motif: `Cette action ne peut plus être annulée (« ${active.libelle} ») : la donnée a été modifiée ou supprimée depuis.`,
      }
    }
  }

  for (const op of operations) {
    if (op.type === 'INSERT') await TABLES[op.table].supprimer(op.id)
    else if (op.type === 'UPDATE') await TABLES[op.table].mettreAJour(op.id, op.avant)
    else if (op.type === 'DELETE') await TABLES[op.table].creer(op.avant)
  }

  await mettreAJourHistoriqueAction(active.id, { statut: 'ANNULEE', annule_le: new Date().toISOString() })

  return {
    ok: true,
    libelle: active.libelle,
    changements: operations.map((op) => ({ table: op.table, id: op.id, ligne: op.type === 'INSERT' ? null : op.avant })),
  }
}

// Rétablit l'entrée ANNULEE la plus récente (par annule_le). Même garde
// tout-ou-rien que l'annulation.
export async function retablirAction(chaineId, ecran, documentId = null) {
  const { annulee } = await obtenirEtatPileInterne(chaineId, ecran, documentId)
  if (!annulee) return { ok: false, motif: 'Rien à rétablir.' }

  const operations = annulee.operations // ordre chronologique d'origine
  for (const op of operations) {
    const valide = await verifierEtatActuel(op, op.type === 'INSERT' ? null : op.avant)
    if (!valide) {
      return {
        ok: false,
        motif: `Cette action ne peut plus être rétablie (« ${annulee.libelle} ») : la donnée a été modifiée ou supprimée depuis.`,
      }
    }
  }

  for (const op of operations) {
    if (op.type === 'INSERT') await TABLES[op.table].creer(op.apres)
    else if (op.type === 'UPDATE') await TABLES[op.table].mettreAJour(op.id, op.apres)
    else if (op.type === 'DELETE') await TABLES[op.table].supprimer(op.id)
  }

  await mettreAJourHistoriqueAction(annulee.id, { statut: 'ACTIVE', annule_le: null })

  return {
    ok: true,
    libelle: annulee.libelle,
    changements: operations.map((op) => ({ table: op.table, id: op.id, ligne: op.type === 'DELETE' ? null : op.apres })),
  }
}

// Applique les `changements` renvoyés par annulerDerniereAction/retablirAction
// à un tableau d'état React local (diffusions, blocs...) — même mécanique que
// les appliquerEdition/appliquerSuppression déjà en place dans les écrans,
// réutilisée ici plutôt que dupliquée.
export function fusionnerChangements(lignes, changements) {
  let next = lignes
  for (const c of changements) {
    if (c.ligne === null) {
      next = next.filter((l) => l.id !== c.id)
    } else if (next.some((l) => l.id === c.id)) {
      next = next.map((l) => (l.id === c.id ? c.ligne : l))
    } else {
      next = [...next, c.ligne]
    }
  }
  return next
}
