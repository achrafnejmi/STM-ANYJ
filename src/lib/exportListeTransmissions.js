// Export « Liste des transmissions » (EXG-M2-11, P26). Pur : aucune
// dépendance xlsx/jspdf/docx ici — même découpage que exportBilan.js/
// exportPlanMedia.js, l'écran (GrilleLineaire.jsx) possède les appels aux 3
// bibliothèques. Portée : la grille active (P23) et la période/vue
// actuellement affichées (P25) — pas de sélecteur de période séparé.
import { estProgrammable } from './droits.js'
import { formaterDureeMinutes } from './semaine.js'
import { heureHMSEnSecondes } from './planMedia.js'

const LIBELLES_VECTEUR = { TNT: 'TNT', SATELLITE: 'Satellite' }

export const ENTETE_LISTE_TRANSMISSIONS = ['Date', 'Début', 'Fin', 'Titre', 'Épisode', 'Genre', 'Durée', 'Vecteur', 'Support', 'Statut des droits']

// « Support » (EXG-M2-11) : aucun champ de ce nom n'existe dans le modèle de
// données actuel — le cahier le décrit comme alimenté par les systèmes de
// production externes, hors du périmètre de saisie de STM Next. Affiché "—"
// plutôt que d'ajouter une migration pour une donnée qu'aucun écran ne permet
// de renseigner.
export function construireDonneesListeTransmissions({ chaineNom, periodeLabel, diffusions, programmesParId, fenetresDroits }) {
  const lignes = [...diffusions]
    .sort((a, b) => a.date.localeCompare(b.date) || a.heure_debut.localeCompare(b.heure_debut))
    .map((d) => {
      const programme = programmesParId.get(d.programme_id)
      const droits = estProgrammable(d.programme_id, fenetresDroits, d.date)
      return {
        date: d.date,
        debut: d.heure_debut?.slice(0, 5) ?? '',
        fin: d.heure_fin?.slice(0, 5) ?? '',
        titre: programme?.titre ?? d.titre_cache ?? '—',
        episode: d.episode_numero != null ? `ÉP.${String(d.episode_numero).padStart(2, '0')}` : '—',
        genre: d.genre || '—',
        // Wraparound-safe (journée d'antenne 06:00→06:00, RG-19/20) — même
        // calcul que construireDerouleJour (conducteur.js, P17), pas une
        // simple soustraction de minutes qui donnerait un résultat négatif
        // pour une transmission finissant après minuit.
        duree: formaterDureeMinutes((heureHMSEnSecondes(d.heure_fin) - heureHMSEnSecondes(d.heure_debut)) / 60),
        vecteur: d.vecteur ? (LIBELLES_VECTEUR[d.vecteur] ?? d.vecteur) : 'Unifié',
        support: '—',
        statutDroits: droits.ok ? 'OK' : droits.motif,
      }
    })
  return { titre: `Liste des transmissions — ${chaineNom}`, periodeLabel, lignes }
}

export function construireLignesExcelListeTransmissions(donnees) {
  return [
    [donnees.titre],
    [donnees.periodeLabel],
    [],
    ENTETE_LISTE_TRANSMISSIONS,
    ...donnees.lignes.map((l) => [l.date, l.debut, l.fin, l.titre, l.episode, l.genre, l.duree, l.vecteur, l.support, l.statutDroits]),
  ]
}

export function construireNomFichierListeTransmissions(chaineNom, periodeLabel, extension) {
  return `Liste des transmissions — ${chaineNom} — ${periodeLabel}.${extension}`
}
