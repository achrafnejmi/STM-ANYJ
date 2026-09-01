// Export du bilan stock (M9, P18 — EXG-M9-02 : Excel + Word + PDF). Pur :
// aucune dépendance xlsx/jspdf/docx ici — cette fonction ne fait que mettre
// en forme les données déjà calculées par bilans.js en un bundle unique,
// indépendant du format. Chaque format lit CE MÊME bundle (contenu
// identique dans les 3 : indicateurs, répartition par genre, fins de
// droits) ; l'appel aux bibliothèques d'export reste dans Accueil.jsx, même
// découpage que exportPlanMedia.js/exportConducteur.js.
import { formaterVolumeHeures } from './bilans.js'

const LIBELLES_STATUT = {
  TOUS: 'Tous',
  HORS_DROITS: 'Hors droits',
  FINS_DE_DROITS: 'Fins de droits proches',
  NON_PROGRAMMES: 'Non programmés sur la période',
}

// { titre, filtresLabel, indicateurs: [{libelle, valeur}], repartition:
// [{genre, volume, nbEpisodesPrets, nbTitres}], finsDeDroits: [{titre,
// dateFin, nbEpisodesPrets, passagesRestants}] } — même bundle consommé par
// les 3 formats.
export function construireDonneesBilan({ chaineNom, dateReference, filtreGenre, filtreStatut, indicateurs, repartition, finsDeDroits }) {
  return {
    titre: `Bilan stock — ${chaineNom}`,
    dateGeneration: dateReference,
    filtresLabel: `Genre : ${filtreGenre || 'Tous'} · Statut : ${LIBELLES_STATUT[filtreStatut] ?? 'Tous'}`,
    indicateurs: [
      { libelle: 'Volume disponible', valeur: formaterVolumeHeures(indicateurs.volumeMinutes) },
      { libelle: 'Titres retenus par les filtres', valeur: String(indicateurs.nbTitresRetenus) },
      { libelle: 'Fins de droits (< 45 jours)', valeur: String(indicateurs.nbTitresFinsDeDroits) },
      { libelle: 'Titres hors droits', valeur: String(indicateurs.nbTitresHorsDroits) },
    ],
    repartition: repartition.map((r) => ({
      genre: `${r.genre.fr} / ${r.genre.ar}`,
      volume: formaterVolumeHeures(r.volumeMinutes),
      nbEpisodesPrets: r.nbEpisodesPrets,
      nbTitres: r.nbTitres,
    })),
    finsDeDroits: finsDeDroits.map((f) => ({
      titre: f.titre,
      dateFin: f.dateFin,
      nbEpisodesPrets: f.nbEpisodesPrets,
      passagesRestants: f.passagesRestants,
    })),
  }
}

// AOA (array-of-arrays) prêt pour XLSX.utils.aoa_to_sheet — même convention
// que exportPlanMedia.js/exportConducteur.js.
export function construireLignesExcelBilan(donnees) {
  return [
    [donnees.titre],
    [donnees.filtresLabel],
    [],
    ['Indicateur', 'Valeur'],
    ...donnees.indicateurs.map((i) => [i.libelle, i.valeur]),
    [],
    ['Répartition par genre'],
    ['Genre (FR / AR)', 'Volume', 'Épisodes prêts', 'Titres'],
    ...donnees.repartition.map((r) => [r.genre, r.volume, r.nbEpisodesPrets, r.nbTitres]),
    [],
    ['À consommer avant expiration'],
    ['Titre', 'Échéance', 'Épisodes prêts', 'Passages restants'],
    ...donnees.finsDeDroits.map((f) => [f.titre, f.dateFin, f.nbEpisodesPrets, f.passagesRestants]),
  ]
}

export function construireNomFichierBilan(chaineNom, dateReference, extension) {
  return `Bilan stock — ${chaineNom} — ${dateReference}.${extension}`
}
