// Export Programmes (retouche post-P29) — colonnes exactement celles déjà
// affichées par ListeProgrammes.jsx (Titre, Chaîne, Genre, Durée moyenne, Nb
// épisodes, Dernière diffusion). Pur : aucune dépendance xlsx/jspdf/docx ici,
// même découpage que exportGrilleType.js — l'écran possède les appels aux 3
// bibliothèques.
import { formaterDureeMinutes, formaterDateLongue } from './semaine.js'

export const ENTETE_PROGRAMMES = ['Titre', 'Chaîne', 'Genre', 'Durée moyenne', 'Nb épisodes', 'Dernière diffusion']

export function construireDonneesProgrammes({ chaineNom, programmes, dureeMoyenneParProgramme, nbEpisodesParProgramme, derniereDiffusionParProgramme }) {
  const lignes = programmes.map((p) => ({
    titre: p.titre,
    chaine: p.chaine_id == null ? 'Toutes chaînes' : p.chaine,
    genre: p.genre || '—',
    duree: formaterDureeMinutes(dureeMoyenneParProgramme.get(p.id)),
    nbEpisodes: nbEpisodesParProgramme.get(p.id) ?? 0,
    derniereDiffusion: derniereDiffusionParProgramme.get(p.id) ? formaterDateLongue(derniereDiffusionParProgramme.get(p.id)) : '—',
  }))
  return { titre: `Programmes — ${chaineNom}`, lignes }
}

export function construireLignesExcelProgrammes(donnees) {
  return [
    [donnees.titre],
    [],
    ENTETE_PROGRAMMES,
    ...donnees.lignes.map((l) => [l.titre, l.chaine, l.genre, l.duree, l.nbEpisodes, l.derniereDiffusion]),
  ]
}

export function construireNomFichierProgrammes(chaineNom, extension) {
  return `Programmes — ${chaineNom}.${extension}`
}
