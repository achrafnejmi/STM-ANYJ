// Volume horaire réellement diffusé (P40). Fonction PURE, aucun accès Supabase.
//
// SOURCE : la pige (`diffusion_reelle`) = le RÉEL diffusé, jamais le programmé
// (`diffusion_lineaire`). L'appelant ne fournit que des lignes de type
// PROGRAMME (hors BA / SPOT / AUTO_PROMO / COMMUNIQUE), issues d'imports pige
// ACTIFS, d'une chaîne et d'une période.
//
// DEUX NIVEAUX D'INÉGALE FIABILITÉ — la distinction est assumée et affichée :
//  · PAR GENRE — le genre est porté par la ligne de pige elle-même
//    (`genre_niv1`) : aucun rapprochement au catalogue, chiffre FIABLE.
//  · PAR PROGRAMME — rapprochement par le NOM (rapprochementPige.js),
//    APPROXIMATIF : vérifié et corrigé par l'utilisateur avant l'export.
//
// GARDE-FOU (CLAUDE.md : jamais de perte silencieuse) : une ligne qu'aucun
// programme du catalogue ne réclame — ou que l'utilisateur a décochée — n'est
// pas jetée, elle bascule dans « non rapprochées ». D'où l'égalité de contrôle,
// affichée dans l'écran comme dans l'export :
//     total par genre = total par programme + total non rapprochées

import { pigeCorrespondAuTitre } from './rapprochementPige.js'

export const GENRE_NON_RENSEIGNE = '(genre non renseigné)'

function secondesDe(diffusions) {
  return diffusions.reduce((s, d) => s + (d.duree_secondes ?? 0), 0)
}

function totaliser(lignes) {
  return {
    nb: lignes.reduce((s, l) => s + l.nb, 0),
    secondes: lignes.reduce((s, l) => s + l.secondes, 0),
  }
}

// Rattache chaque ligne de pige à AU PLUS UN programme du catalogue. Une ligne
// peut matcher plusieurs titres (« AL BOYOUT » ⊂ « AL BOYOUT ASSRAR ») : on
// retient alors le titre le plus long (le plus spécifique), départage
// alphabétique pour rester déterministe — compter la ligne deux fois casserait
// l'égalité de contrôle. Les `exclusions` (ids décochés par l'utilisateur)
// rejoignent les non rapprochées : décocher signifie « cette ligne n'est pas ce
// programme », pas « cette diffusion n'existe pas ».
export function rapprocher(diffusions, programmes, exclusions = new Set()) {
  const parProgramme = new Map()
  const nonRapprochees = []

  for (const d of diffusions) {
    if (exclusions.has(d.id)) {
      nonRapprochees.push(d)
      continue
    }
    const candidats = programmes.filter((p) => pigeCorrespondAuTitre(d.programme, [p.titre, p.titre_ar]))
    if (candidats.length === 0) {
      nonRapprochees.push(d)
      continue
    }
    const choisi = [...candidats].sort(
      (a, b) => (b.titre ?? '').length - (a.titre ?? '').length || (a.titre ?? '').localeCompare(b.titre ?? '')
    )[0]
    if (!parProgramme.has(choisi.id)) parProgramme.set(choisi.id, { programme: choisi, diffusions: [] })
    parProgramme.get(choisi.id).diffusions.push(d)
  }

  return { parProgramme, nonRapprochees }
}

// Table 1 — FIABLE : genre porté par la pige (`genre_niv1` brut, aucune
// correspondance vers les 9 genres internes, qui sont une autre taxonomie).
export function calculerVolumeParGenre(diffusions) {
  const parGenre = new Map()
  for (const d of diffusions) {
    const genre = d.genre_niv1?.trim() || GENRE_NON_RENSEIGNE
    if (!parGenre.has(genre)) parGenre.set(genre, { genre, nb: 0, secondes: 0 })
    const entree = parGenre.get(genre)
    entree.nb += 1
    entree.secondes += d.duree_secondes ?? 0
  }
  return [...parGenre.values()].sort((a, b) => b.secondes - a.secondes || a.genre.localeCompare(b.genre))
}

// Table 2 — APPROXIMATIF : une ligne par programme du catalogue rapproché.
export function calculerVolumeParProgramme(parProgramme) {
  return [...parProgramme.values()]
    .map(({ programme, diffusions }) => ({
      programmeId: programme.id,
      titre: programme.titre,
      genre: programme.genre?.trim() || GENRE_NON_RENSEIGNE,
      nb: diffusions.length,
      secondes: secondesDe(diffusions),
    }))
    .sort((a, b) => b.secondes - a.secondes || a.titre.localeCompare(b.titre))
}

// Regroupement par genre du CATALOGUE, avec un sous-total par groupe — reprend
// le patron « groupe → programmes → Total » du rapport d'activité papier.
export function grouperParGenreCatalogue(lignesProgramme) {
  const parGenre = new Map()
  for (const l of lignesProgramme) {
    if (!parGenre.has(l.genre)) parGenre.set(l.genre, [])
    parGenre.get(l.genre).push(l)
  }
  return [...parGenre.entries()]
    .map(([genre, programmes]) => ({ genre, programmes, total: totaliser(programmes) }))
    .sort((a, b) => b.total.secondes - a.total.secondes || a.genre.localeCompare(b.genre))
}

// Table 3 — les lignes sans rattachement, regroupées par nom de pige brut.
// Elles SONT comptées dans la Table 1 (le genre ne dépend pas du catalogue) :
// seule leur attribution à un programme manque.
export function calculerVolumeNonRapprochees(nonRapprochees) {
  const parNom = new Map()
  for (const d of nonRapprochees) {
    const nom = d.programme?.trim() || '(sans titre)'
    const genre = d.genre_niv1?.trim() || GENRE_NON_RENSEIGNE
    const cle = `${nom}__${genre}`
    if (!parNom.has(cle)) parNom.set(cle, { nom, genre, nb: 0, secondes: 0 })
    const entree = parNom.get(cle)
    entree.nb += 1
    entree.secondes += d.duree_secondes ?? 0
  }
  return [...parNom.values()].sort((a, b) => b.secondes - a.secondes || a.nom.localeCompare(b.nom))
}

// Point d'entrée unique : tout le rapport en un objet, contrôle de cohérence
// compris. `rapprochements` (liste à plat des lignes rattachées, avec leur
// programme) alimente le panneau de vérification.
export function construireRapport({ diffusions, programmes, exclusions = new Set() }) {
  const { parProgramme, nonRapprochees } = rapprocher(diffusions, programmes, exclusions)

  const parGenre = calculerVolumeParGenre(diffusions)
  const lignesProgramme = calculerVolumeParProgramme(parProgramme)
  const groupes = grouperParGenreCatalogue(lignesProgramme)
  const lignesNonRapprochees = calculerVolumeNonRapprochees(nonRapprochees)

  const totalGenre = totaliser(parGenre)
  const totalProgramme = totaliser(lignesProgramme)
  const totalNonRapprochees = totaliser(lignesNonRapprochees)

  return {
    parGenre,
    lignesProgramme,
    groupes,
    lignesNonRapprochees,
    rapprochements: [...parProgramme.values()].flatMap(({ programme, diffusions: lignes }) =>
      lignes.map((d) => ({ diffusion: d, programme }))
    ),
    totaux: {
      genre: totalGenre,
      programme: totalProgramme,
      nonRapprochees: totalNonRapprochees,
      coherent: totalGenre.secondes === totalProgramme.secondes + totalNonRapprochees.secondes,
    },
  }
}
