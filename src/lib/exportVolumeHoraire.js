// Export Word du rapport de volume horaire (P40). PUR : aucune dépendance
// `docx` ici — on ne produit qu'un bundle de chaînes déjà formatées, que
// RapportVolume.jsx transforme en tableaux Word (même découpage que
// exportGrilleChaine.js / exportListeTransmissions.js).
//
// Structure reprise du rapport d'activité papier
// (design-reference/Rapport d'activité Programmation TV 030925 (2).docx) :
// des tables à groupes avec une ligne Total par groupe — mais le regroupement
// est le GENRE (et non l'« obligation du Cahier des Charges » : la partie
// conformité HACA est hors périmètre) et les chiffres viennent de la pige
// (durées réelles cumulées à la seconde) et non de `durée nominale × épisodes`.
import { formaterDateLongue } from './semaine.js'
import { formaterVolumeHeures } from './bilans.js'

// Secondes → « 61 h 15 », via le formateur de volume déjà utilisé par les
// bilans (M9) — une seule convention d'affichage des volumes dans l'app.
export function formaterVolumeSecondes(secondes) {
  return formaterVolumeHeures(Math.round((secondes ?? 0) / 60))
}

// `timestamptz` → « 31 août 2026 », « — » si absent ou illisible (l'export ne
// doit jamais imprimer « NaN undefined NaN »).
function formaterDateISOCourt(iso) {
  const jour = (iso ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(jour) ? formaterDateLongue(jour) : '—'
}

export const ENTETE_GENRE = ['Genre (pige)', 'Nb diffusions', 'Volume horaire']
export const ENTETE_PROGRAMME = ['Genre', 'Programme', 'Nb diffusions réelles', 'Volume horaire']
export const ENTETE_NON_RAPPROCHEES = ['Programme (nom de pige)', 'Genre (pige)', 'Nb diffusions', 'Volume horaire']
export const ENTETE_SOURCES = ['Pige', "Date d'antenne", 'Lignes', 'Importée le']

// `imports` : les import_pige ACTIFS de la période — la source exacte des
// chiffres. Un rapport d'audit doit pouvoir dire d'où il sort.
export function construireDonneesVolumeHoraire({ chaineNom, periodeLabel, dateISO, utilisateur, rapport, imports = [] }) {
  const { parGenre, groupes, lignesNonRapprochees, totaux } = rapport

  return {
    titre: `Rapport de volume horaire — ${chaineNom}`,
    periodeLabel,
    sousTitre: `Période : ${periodeLabel}`,
    pied: `Édité le ${formaterDateLongue(dateISO)} par ${utilisateur ?? '—'}`,
    mention:
      "Source : pige (retour d'antenne réel), programmes uniquement — bandes-annonces, spots, auto-promotions et communiqués exclus. " +
      'La répartition par genre est calculée depuis le genre porté par la pige (fiable). ' +
      'La ventilation par programme repose sur un rapprochement de nom (approximatif), vérifié avant édition.',

    // Sources — les piges effectivement prises en compte
    tableSources: {
      titre: 'Piges prises en compte',
      note: "Seules les piges actives alimentent le calcul (un ré-import archive la précédente).",
      entete: ENTETE_SOURCES,
      lignes: imports.map((i) => [
        i.nom ?? '—',
        formaterDateLongue(i.date),
        String(i.nb_lignes ?? 0),
        `${formaterDateISOCourt(i.cree_le)}${i.cree_par ? ` par ${i.cree_par}` : ''}`,
      ]),
      vide: imports.length === 0,
    },

    // Table 1 — fiable
    tableGenre: {
      titre: 'Répartition par genre',
      entete: ENTETE_GENRE,
      lignes: parGenre.map((g) => [g.genre, String(g.nb), formaterVolumeSecondes(g.secondes)]),
      total: ['Total', String(totaux.genre.nb), formaterVolumeSecondes(totaux.genre.secondes)],
    },

    // Table 2 — approximatif, groupée par genre catalogue avec sous-totaux
    tableProgramme: {
      titre: 'Détail par programme',
      entete: ENTETE_PROGRAMME,
      groupes: groupes.map((g) => ({
        genre: g.genre,
        lignes: g.programmes.map((p) => [g.genre, p.titre, String(p.nb), formaterVolumeSecondes(p.secondes)]),
        total: [`Total ${g.genre}`, '', String(g.total.nb), formaterVolumeSecondes(g.total.secondes)],
      })),
      total: ['Total général', '', String(totaux.programme.nb), formaterVolumeSecondes(totaux.programme.secondes)],
    },

    // Table 3 — présente seulement s'il reste des lignes non attribuées
    tableNonRapprochees:
      lignesNonRapprochees.length === 0
        ? null
        : {
            titre: 'Diffusions non rapprochées à un programme du catalogue',
            note:
              'Ces diffusions sont bien comptées dans la répartition par genre ci-dessus ; seule leur attribution à un programme du catalogue manque.',
            entete: ENTETE_NON_RAPPROCHEES,
            lignes: lignesNonRapprochees.map((l) => [l.nom, l.genre, String(l.nb), formaterVolumeSecondes(l.secondes)]),
            total: ['Total', '', String(totaux.nonRapprochees.nb), formaterVolumeSecondes(totaux.nonRapprochees.secondes)],
          },

    // Contrôle d'honnêteté, imprimé dans le document
    controle: libelleControle(totaux),
  }
}

// « Contrôle : 120 h 00 (par genre) = 95 h 30 (par programme) + 24 h 30 (non
// rapprochées) ✔ » — l'écart, s'il existe, est dit et non masqué.
export function libelleControle(totaux) {
  const g = formaterVolumeSecondes(totaux.genre.secondes)
  const p = formaterVolumeSecondes(totaux.programme.secondes)
  const n = formaterVolumeSecondes(totaux.nonRapprochees.secondes)
  const base = `Contrôle : ${g} (par genre) = ${p} (par programme) + ${n} (non rapprochées)`
  return totaux.coherent ? `${base} ✔` : `${base} — ÉCART DÉTECTÉ, à vérifier`
}

export function nomFichierVolumeHoraire(chaineNom, periodeLabel) {
  const propre = (s) =>
    (s ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^0-9a-zA-Z]+/g, '-')
      .replace(/^-|-$/g, '')
  return `volume-horaire_${propre(chaineNom)}_${propre(periodeLabel)}.docx`
}
