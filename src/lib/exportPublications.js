// Export des publications (Grille non-linéaire, hors cahier, P20). Pur :
// aucune dépendance xlsx/jspdf/docx ici — même découpage que
// exportBilan.js/exportConducteur.js. Partagé par les 2 onglets (Réseaux
// sociaux / Streaming VOD) ; la colonne Format n'existe que côté Réseaux
// (`avecFormat`). Colonne Statut toujours en tête de tableau (bien visible).
import { statutPublication } from './statutsPublication.js'

// { titre, filtresLabel, colonnes: [...], lignes: [[...], ...] } — bundle
// unique consommé par les 3 formats (Excel/PDF/Word), même précédent que
// construireDonneesBilan.
export function construireDonneesPublications({ libelleOnglet, chaineNom, periodeLabel, publications, avecFormat }) {
  const colonnes = ['Statut', 'Date', 'Heure', 'Plateforme', ...(avecFormat ? ['Format'] : []), 'Titre', 'Épisode', 'Lien']
  const lignes = publications.map((p) => [
    statutPublication(p.statut).libelle,
    p.date_publication,
    p.heure_publication ? p.heure_publication.slice(0, 5) : '—',
    p.plateforme,
    ...(avecFormat ? [p.format] : []),
    p.titre || p.programmeTitre || '—',
    p.episodeLabel || '—',
    p.lien || '—',
  ])
  return {
    titre: `${libelleOnglet} — ${chaineNom}`,
    filtresLabel: `Période : ${periodeLabel}`,
    colonnes,
    lignes,
  }
}

// AOA (array-of-arrays) prêt pour XLSX.utils.aoa_to_sheet — même convention
// que exportPlanMedia.js/exportConducteur.js.
export function construireLignesExcelPublications(donnees) {
  return [[donnees.titre], [donnees.filtresLabel], [], donnees.colonnes, ...donnees.lignes]
}

export function construireNomFichierPublications(libelleOnglet, chaineNom, periodeLabel, extension) {
  return `${libelleOnglet} — ${chaineNom} — ${periodeLabel}.${extension}`
}
