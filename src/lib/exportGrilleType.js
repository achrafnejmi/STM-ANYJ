// Export Grille type (M3, P28b) — colonnes exactement celles décrites par le
// cahier (composition d'écran M3, tableau des blocs) : nom, heure de début,
// heure de fin, durée calculée, fréquence, jours d'application, genre
// attendu — jamais de "type de bloc" (retiré en P28b, hors cahier). Pur :
// aucune dépendance xlsx/jspdf/docx ici, même découpage que
// exportListeTransmissions.js — l'écran (GrilleType.jsx) possède les appels
// aux 3 bibliothèques.
import { formaterDureeMinutes, minutesDepuisDebutAntenne } from './semaine.js'

const JOURS_ABBR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export const ENTETE_GRILLE_TYPE = ['Nom', 'Heure début', 'Heure fin', 'Durée', 'Fréquence', 'Jours', 'Genre attendu']

function formaterJours(jours) {
  return [...jours]
    .sort((a, b) => a - b)
    .map((j) => JOURS_ABBR[j])
    .join(', ')
}

export function construireDonneesGrilleType({ grilleTypeNom, chaineNom, blocs }) {
  const lignes = [...blocs]
    .sort((a, b) => minutesDepuisDebutAntenne(a.heure_debut) - minutesDepuisDebutAntenne(b.heure_debut))
    .map((b) => ({
      nom: b.nom || b.genre_attendu || '—',
      debut: b.heure_debut.slice(0, 5),
      fin: b.heure_fin.slice(0, 5),
      duree: formaterDureeMinutes(minutesDepuisDebutAntenne(b.heure_fin) - minutesDepuisDebutAntenne(b.heure_debut)),
      frequence: b.frequence,
      jours: formaterJours(b.jours),
      genre: b.genre_attendu || '—',
    }))
  return { titre: `Grille type — ${grilleTypeNom} (${chaineNom})`, lignes }
}

export function construireLignesExcelGrilleType(donnees) {
  return [
    [donnees.titre],
    [],
    ENTETE_GRILLE_TYPE,
    ...donnees.lignes.map((l) => [l.nom, l.debut, l.fin, l.duree, l.frequence, l.jours, l.genre]),
  ]
}

export function construireNomFichierGrilleType(grilleTypeNom, extension) {
  return `Grille type — ${grilleTypeNom}.${extension}`
}
